import {test} from 'node:test';
import assert from 'node:assert/strict';
import {brazilReferences,analyzeFull,adjustPredictedDLCOForHb,parseSupplement} from '../dist/full-function.mjs';
const man={sex:'M',age:50,height:175,weight:70,hemoglobin:12};
const woman={sex:'F',age:45,height:160,weight:62,hemoglobin:11};
const near=(a,b,tol=.00001)=>assert.ok(Math.abs(a-b)<tol,'Expected '+a+' ≈ '+b);
test('Lessa male TLC/RV/FRC/ERV/IC equations and reference limits',()=>{
 const {refs,errors}=brazilReferences(man);
 assert.equal(errors.length,0);
 near(refs.tlc.pred,.081*175-7.404);near(refs.tlc.lln,refs.tlc.pred-1.05);
 near(refs.rv.pred,.014*175+.018*50-1.273);near(refs.frc.pred,.041*175+.009*50-4.123);
 near(refs.ic.pred,.018*175+.02*70-.011*50-.986);
 near(refs.erv.pred,.023*175-.01*50-2.16);
});
test('Lessa female equations and reference limits',()=>{
 const {refs}=brazilReferences(woman);
 near(refs.tlc.pred,.057*160-4.205);near(refs.tlc.uln,refs.tlc.pred+.83);
 near(refs.rv.pred,.021*160+.017*45-2.60);
 near(refs.rvtlc.pred,15.58+.345*45);
 near(refs.ic.pred,.014*160-.009*45+.013*62-.223);
});
test('Guimarães original Table 3, not discordant society summary',()=>{
 const m=brazilReferences(man,'dlco').refs,w=brazilReferences(woman,'dlco').refs;
 near(m.dlco.pred,.335*175-.148*50-22.48);
 near(m.dlco.lln,m.dlco.pred-5);
 near(m.va.pred,.091*175-9.76);near(m.kco.pred,5.03-.019*50);
 near(w.dlco.pred,.244*160-.087*45-15.32);
 near(w.va.pred,.058*160-5.06);near(w.kco.pred,.019*160+.98);
});
test('Do not silently extrapolate age, height or BMI',()=>{
 assert.equal(Object.keys(brazilReferences({...man,age:15}).refs).length,0);
 assert.equal(Object.keys(brazilReferences({...man,height:200}).refs).length,0);
 assert.equal(Object.keys(brazilReferences({...man,weight:120}).refs).length,0);
});
test('Hemoglobin adjustment applies to predicted, not measured',()=>{
 const ref={pred:25,lln:20};
 const adjusted=adjustPredictedDLCOForHb(ref,10,'M');
 near(adjusted.pred,25*17/(10+10.22));
 near(adjusted.lln,20*17/(10+10.22));
});
test('Confirmed TLC restriction and mixed pattern only with obstruction',()=>{
 const input={demographics:man,settings:{reference:'brazil'},
 volumes:{tlc:{measured:4}},spirometry:{pattern:'obstruction',lowFvc:true}};
 const result=analyzeFull(input);
 assert.ok(result.remarks.some(x=>x.includes('misto')));
 const without=analyzeFull({...input,volumes:{}});
 assert.equal(without.remarks.some(x=>x.includes('misto')),false);
});
test('Normal TLC with raised RV/TLC indicates air trapping not restriction',()=>{
 const ref=brazilReferences(man).refs;
 const result=analyzeFull({demographics:man,settings:{reference:'brazil'},
 volumes:{tlc:{measured:ref.tlc.pred},rv:{measured:ref.rv.pred+1.5}}});
 assert.ok(result.remarks.some(x=>x.includes('aprisionamento')));
 assert.equal(result.remarks.some(x=>x.includes('restritivo confirmado')),false);
});
test('DLCO low with normal KCO and low VA is still abnormal',()=>{
 const ref=brazilReferences(woman,'dlco').refs;
 const result=analyzeFull({demographics:woman,settings:{reference:'brazil'},
 diffusion:{dlco:{measured:ref.dlco.lln-1},va:{measured:ref.va.lln-.2},kco:{measured:ref.kco.pred}}});
 assert.ok(result.remarks.some(x=>x.includes('DLCO abaixo')));
 assert.ok(result.remarks.some(x=>x.includes('não normaliza')));
});
test('Resistance with no supplied limits stays unclassified',()=>{
 const result=analyzeFull({settings:{reference:'equipment'},resistance:{raw:{measured:3}}});
 assert.equal(result.resistance.find(r=>r.key==='raw').status,'unclassified');
 assert.ok(result.remarks.some(x=>x.includes('não classific')));
});
test('Resistance with lab upper limit can be interpreted',()=>{
 const result=analyzeFull({settings:{reference:'equipment'},resistance:{raw:{measured:3,uln:2}}});
 assert.equal(result.resistance.find(r=>r.key==='raw').status,'high');
});
test('R5-R20 from measured oscillometry and negative X5',()=>{
 const result=analyzeFull({settings:{reference:'equipment',resistanceMethod:'osc'},
 resistance:{r5:{measured:.6},r20:{measured:.3},x5:{measured:-.2,lln:-.1}}});
 near(result.resistance.find(r=>r.key==='r5r20').measured,.3);
 assert.equal(result.resistance.find(r=>r.key==='x5').status,'low');
});
test('Physically impossible volumes block report',()=>{
 const result=analyzeFull({settings:{reference:'equipment'},
 volumes:{tlc:{measured:4},rv:{measured:5}}});
 assert.ok(result.errors.some(x=>x.includes('VR maior')));
});
test('Unambiguous measured/predicted/LLN header can be extracted',()=>{
 const parsed=parseSupplement('Parâmetro Medido Previsto LIN LSN\nCPT 4,5 6,5 5,1 7,8\nDLCO 16,0 24,0 19,0 29,0');
 assert.equal(parsed.count,2);
 assert.deepEqual(parsed.data.volumes.tlc,{measured:4.5,pred:6.5,lln:5.1,uln:7.8});
});
test('Ambiguous rows are not guessed',()=>{
 const p=parseSupplement('CPT 4.5 6.5 5.1');assert.equal(p.count,0);
});
