/**
 * Expiria | Provas de função pulmonar completas.
 * Motor determinístico, sem rede e sem inferência por IA.
 * Referências: Lessa 2021 (pletismografia), Guimarães 2019 (DLCO),
 * ATS/ERS 2017 (Hb) e ERS/ATS 2022 (padrões interpretativos).
 * Valores de referência brasileiros derivam de adultos brancos, não obesos;
 * não extrapolar para fora da amostra.
 */
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const positive=x=>finite(x)&&x>0;
const optional=(x)=>finite(x)?x:null;
const minus=(a,b)=>a-b;
const scaled=(x,n)=>Math.round(x*10**n)/10**n;
const VOLUME_KEYS=['tlc','rv','frc','erv','ic','vc','rvtlc'];
const DLCO_KEYS=['dlco','va','kco'];
const RES_KEYS=['raw','sraw','gaw','sgaw','r5','r20','r5r20','x5','ax','fres'];
export const PARAMETERS={
 tlc:['CPT','L'],rv:['VR','L'],frc:['CRF','L'],erv:['VRE','L'],ic:['CI','L'],vc:['CV lenta','L'],rvtlc:['VR/CPT','%'],
 dlco:['DLCO','mL/min/mmHg'],va:['VA','L'],kco:['KCO','mL/min/mmHg/L'],
 raw:['Raw','cmH₂O·s/L'],sraw:['sRaw','cmH₂O·s'],gaw:['Gaw','L/(cmH₂O·s)'],sgaw:['sGaw','1/(cmH₂O·s)'],
 r5:['R5','kPa·s/L'],r20:['R20','kPa·s/L'],r5r20:['R5–R20','kPa·s/L'],
 x5:['X5','kPa·s/L'],ax:['AX','kPa/L'],fres:['Fres','Hz']
};
const limits=(pred,lo=null,hi=null,source='')=>({pred, lln:finite(lo)?pred+lo:null, uln:finite(hi)?pred+hi:null,source});
export function brazilReferences({sex,age,height,weight}={},section='all'){
 const errors=[];
 if(!['M','F'].includes(sex)||!positive(age)||!positive(height))return {refs:{},errors:['Informe sexo de referência, idade e estatura para calcular os previstos brasileiros.']};
 const male=sex==='M',range=male?{age:[25,88],height:[156,189],bmi:[19.7,30.1]}:{age:[21,92],height:[140,176],bmi:[18.4,30.4]};
 if(age<range.age[0]||age>range.age[1]||height<range.height[0]||height>range.height[1]){
  return {refs:{},errors:['Idade ou estatura fora dos intervalos da amostra brasileira publicada: não extrapolar referências.']};
 }
 if(positive(weight)){
  const bmi=weight/(height/100)**2;
  if(bmi<range.bmi[0]||bmi>range.bmi[1])return {refs:{},errors:['IMC fora da faixa de validação das equações brasileiras; usar referência apropriada ou valores conferidos do equipamento.']};
 }else errors.push('Peso ausente: faixa de IMC não conferida; cálculos dependentes de peso indisponíveis.');
 const h=height,a=age,w=weight;
 const refs={};
 if(section==='all'||section==='volumes'){
  if(male){
   refs.tlc=limits(.081*h-7.404,-1.05,1.08,'Lessa 2021 / limites SPPT');
   refs.rv=limits(.014*h+.018*a-1.273,-.62,.68,'Lessa 2021 / SPPT');
   refs.rvtlc=limits(14.723+.305*a,-7.5,8.4,'Lessa 2021 / SPPT');
   refs.frc=limits(.041*h+.009*a-4.123,-.89,.85,'Lessa 2021 / SPPT');
   refs.erv=limits(.023*h-.010*a-2.16,-.90,null,'Lessa 2021 / SPPT');
   refs.vc=limits(.064*h-.020*a-5.422,-.45*1.645,null,'Lessa 2021; LIN estimado com EPE');
   if(positive(w))refs.ic=limits(.018*h+.020*w-.011*a-.986,-.61,null,'Lessa 2021 / SPPT; conferir errata do sinal da constante');
  }else{
   refs.tlc=limits(.057*h-4.205,-.74,.83,'Lessa 2021 / SPPT');
   refs.rv=limits(.021*h+.017*a-2.60,-.62,.62,'Lessa 2021 / SPPT');
   refs.rvtlc=limits(15.58+.345*a,-11.3,9.9,'Lessa 2021 / SPPT');
   refs.frc=limits(.034*h+.009*a-3.381,-.74,.93,'Lessa 2021 / SPPT');
   refs.erv=limits(.012*h-.007*a-.693,-.53,null,'Lessa 2021 / SPPT');
   refs.vc=limits(.038*h-.016*a-1.967,-.38*1.645,null,'Lessa 2021; LIN estimado com EPE');
   if(positive(w))refs.ic=limits(.014*h-.009*a+.013*w-.223,-.32*1.645,null,'Lessa 2021; LIN estimado com EPE');
  }
 }
 if(section==='all'||section==='dlco'){
  // Tabela 3 original de Guimarães et al 2019. A página-resumo da SPPT
  // apresenta coeficientes diferentes; prevalece o artigo primário.
  if(male){
   refs.dlco=limits(.335*h-.148*a-22.48,-5,null,'Guimarães 2019, tabela 3');
   refs.va=limits(.091*h-9.76,-1,null,'Guimarães 2019, tabela 3');
   refs.kco=limits(5.03-.019*a,-.82,null,'Guimarães 2019, tabela 3');
  }else{
   refs.dlco=limits(.244*h-.087*a-15.32,-4.18,null,'Guimarães 2019, tabela 3');
   refs.va=limits(.058*h-5.06,-.83,null,'Guimarães 2019, tabela 3');
   refs.kco=limits(.019*h+.98,-1.05,null,'Guimarães 2019, tabela 3');
  }
 }
 for(const [key,item] of Object.entries(refs))if(!positive(item.pred)||finite(item.lln)&&item.lln<=0){
  // Valores fisicamente não plausíveis não devem ser usados como limite.
  if(!positive(item.pred)){delete refs[key];errors.push('Previsto inválido para '+PARAMETERS[key][0]+'.');}
  else if(item.lln<=0){item.lln=null;errors.push('LIN não positivo para '+PARAMETERS[key][0]+'; limite omitido.');}
 }
 return {refs,errors};
}
export function adjustPredictedDLCOForHb(ref,hb,sex){
 if(!ref||!positive(ref.pred)||!positive(hb)||!['M','F'].includes(sex))return null;
 // ERS/ATS: ajustar o *previsto* à Hb, não ajustar também o medido.
 const referenceHb=sex==='M'?14.6:13.4;
 const factor=1.7*hb/(hb+.7*referenceHb);
 return {...ref,pred:ref.pred*factor,lln:finite(ref.lln)?ref.lln*factor:null,
  uln:finite(ref.uln)?ref.uln*factor:null,source:ref.source+'; previsto ajustado à Hb (ERS/ATS 2017)',hbFactor:factor};
}
const measuredRow=(row,base)=>({
 measured:optional(row?.measured),pred:optional(row?.pred)??optional(base?.pred),
 lln:optional(row?.lln)??optional(base?.lln),uln:optional(row?.uln)??optional(base?.uln),
 source:positive(row?.pred)||finite(row?.lln)||finite(row?.uln)?'Valores conferidos do equipamento':base?.source||'Referência não informada'
});
const classification=(row,key)=>{
 if(!finite(row.measured))return 'absent';
 if(!finite(row.lln)&&!finite(row.uln))return 'unclassified';
 if(['rv','frc','rvtlc','tlc','raw','sraw','r5','r20','r5r20','ax','fres'].includes(key)){
  if(finite(row.uln)&&row.measured>row.uln)return 'high';
  if(finite(row.lln)&&row.measured<row.lln)return 'low';
 }else{
  if(finite(row.lln)&&row.measured<row.lln)return 'low';
  if(finite(row.uln)&&row.measured>row.uln)return 'high';
 }
 return 'normal';
};
const assessment=(rows,keys)=>keys.map(key=>{
 const row=rows[key]||{},pct=positive(row.pred)&&finite(row.measured)?100*row.measured/row.pred:null;
 return {key,...row,percentPred:pct,status:classification(row,key)};
});
function supplied(data){return Object.values(data||{}).some(x=>x&&finite(x.measured));}
export function analyzeFull(input={}){
 const demo=input.demographics||{},vol=input.volumes||{},diff=input.diffusion||{},res=input.resistance||{};
 const settings=input.settings||{},warnings=[],errors=[];
 const method=settings.volumeMethod||'pleth';
 let refV={},refD={};
 const referenceChoice=settings.reference||'brazil';
 if(referenceChoice==='brazil'){
  if(supplied(vol)&&method==='pleth'){
   const r=brazilReferences(demo,'volumes');refV=r.refs;warnings.push(...r.errors);
  }else if(supplied(vol)&&method!=='pleth')warnings.push('Equações Lessa são específicas de pletismografia; inserir limites do método utilizado.');
  if(supplied(diff)){const r=brazilReferences(demo,'dlco');refD=r.refs;warnings.push(...r.errors);}
 }
 const V={},D={},R={};
 for(const key of VOLUME_KEYS)V[key]=measuredRow(vol[key],refV[key]);
 for(const key of DLCO_KEYS)D[key]=measuredRow(diff[key],refD[key]);
 for(const key of RES_KEYS)R[key]=measuredRow(res[key],null);
 if(!finite(V.rvtlc.measured)&&positive(V.tlc.measured)&&finite(V.rv.measured)){
  V.rvtlc.measured=V.rv.measured/V.tlc.measured*100;V.rvtlc.derived=true;
 }
 if(!finite(D.kco.measured)&&positive(D.va.measured)&&finite(D.dlco.measured)){
  D.kco.measured=D.dlco.measured/D.va.measured;D.kco.derived=true;
 }
 if(!finite(R.r5r20.measured)&&finite(R.r5.measured)&&finite(R.r20.measured)){
  R.r5r20.measured=R.r5.measured-R.r20.measured;R.r5r20.derived=true;
 }
 // Aferir se a DLCO já foi corrigida no equipamento antes de aplicar Hb.
 if(settings.hbMode==='predicted'){
  if(!positive(demo.hemoglobin))warnings.push('Correção de referência por Hb solicitada sem hemoglobina válida.');
  else if(D.dlco.source==='Valores conferidos do equipamento'&&finite(diff.dlco?.pred))warnings.push('DLCO com previsto informado pelo equipamento: conferir correção de Hb; não foi feita correção dupla.');
  else{
   const corrected=adjustPredictedDLCOForHb(D.dlco,demo.hemoglobin,demo.sex);
   if(corrected){D.dlco={...D.dlco,...corrected};}
  }
 }else if(settings.hbMode==='already'){
  warnings.push('DLCO marcada como previamente corrigida: nenhuma correção adicional aplicada; verificar o método do equipamento.');
 }else if(supplied(diff))warnings.push('Hemoglobina não ajustada automaticamente; avaliar necessidade de correção antes da conclusão clínica.');
 for(const [key,row]of Object.entries({...V,...D,...R})){
  if(!finite(row.measured))continue;
  if(key==='x5'){
   if(row.measured< -5||row.measured>5)errors.push('X5 fora da faixa de segurança; conferir unidade.');
  }else if(row.measured<0||(!['r5r20'].includes(key)&&row.measured===0)||row.measured>({rvtlc:100,fres:100,raw:50,sraw:200,ax:100,dlco:100,kco:20}[key]??20)){
   errors.push('Valor inválido ou unidade suspeita: '+PARAMETERS[key][0]+'.');
  }
  if(finite(row.lln)&&finite(row.uln)&&row.lln>=row.uln)errors.push('LIN ≥ LSN em '+PARAMETERS[key][0]+'.');
 }
 if(positive(V.tlc.measured)&&finite(V.rv.measured)&&V.rv.measured>V.tlc.measured)
  errors.push('VR maior que CPT: verifique a extração dos dados.');
 if(positive(V.tlc.measured)&&finite(V.frc.measured)&&V.frc.measured>V.tlc.measured)
  errors.push('CRF maior que CPT: verifique a extração dos dados.');
 if(positive(V.tlc.measured)&&positive(V.ic.measured)&&positive(V.frc.measured)&&Math.abs(V.ic.measured+V.frc.measured-V.tlc.measured)>Math.max(.5,V.tlc.measured*.15))
  warnings.push('CPT difere de CI + CRF; revisar método, manobras ou transcrição.');
 if(positive(V.tlc.measured)&&positive(D.va.measured)&&D.va.measured/V.tlc.measured>1.15)warnings.push('VA maior que 115% da CPT: verificar testes, método e transcrição.');
 if(positive(D.dlco.measured)&&positive(D.va.measured)&&positive(diff.kco?.measured)&&Math.abs(D.dlco.measured/D.va.measured-diff.kco.measured)>.15*diff.kco.measured)warnings.push('KCO digitado difere de DLCO/VA em mais de 15%.');
 if(positive(V.tlc.measured)&&positive(V.rv.measured)&&finite(vol.rvtlc?.measured)&&Math.abs(V.rv.measured/V.tlc.measured*100-vol.rvtlc.measured)>5)warnings.push('VR/CPT não coincide com VR e CPT; conferir valores.');
 if(settings.resistanceMethod==='osc'&&supplied(res))warnings.push('Oscilometria: confirmar equações de referência, posição, frequências e unidades do aparelho.');
 else if(supplied(res))warnings.push('Resistência: limites de referência devem ser informados pelo aparelho/laboratório; não há equação automática selecionada.');
 const volumes=assessment(V,VOLUME_KEYS),diffusion=assessment(D,DLCO_KEYS);
 const resistance=assessment(R,settings.resistanceMethod==='osc'?RES_KEYS.slice(4):RES_KEYS.slice(0,4));
 const get=(x,k)=>x.find(r=>r.key===k);
 const tlc=get(volumes,'tlc'),rv=get(volumes,'rv'),ratio=get(volumes,'rvtlc'),frc=get(volumes,'frc');
 const dl=get(diffusion,'dlco'),va=get(diffusion,'va'),kco=get(diffusion,'kco');
 const remarks=[];
 const isSpiroObstruction=input.spirometry?.pattern==='obstruction';
 if(tlc.status==='low')remarks.push(isSpiroObstruction?'Distúrbio ventilatório misto (obstrução espirométrica associada a CPT reduzida).':'CPT abaixo do LIN: distúrbio ventilatório restritivo confirmado.');
 else if(tlc.status==='normal'||tlc.status==='high'){
  if(isSpiroObstruction)remarks.push('Obstrução espirométrica sem restrição confirmada pela CPT.');
  else if(input.spirometry?.pattern==='low-fvc')remarks.push('CVF reduzida com CPT não reduzida: não confirma restrição.');
 }else if(isSpiroObstruction&&input.spirometry?.lowFvc)remarks.push('CVF reduzida na obstrução: sem CPT interpretável, não diferenciar aprisionamento de distúrbio misto.');
 if(rv.status==='high'||ratio.status==='high')remarks.push('Achados volumétricos compatíveis com aprisionamento aéreo (VR e/ou VR/CPT acima do LSN).');
 if(frc.status==='high'||tlc.status==='high')remarks.push('Hiperinsuflação/volumes aumentados (CRF e/ou CPT acima do LSN); correlacionar com a mecânica ventilatória.');
 if(dl.status==='low')remarks.push('DLCO abaixo do limite inferior da normalidade; correlacionar com VA, KCO, hemoglobina e contexto clínico.');
 else if(dl.status==='normal')remarks.push('DLCO não reduzida para a referência aplicada.');
 else if(finite(dl.measured))remarks.push('DLCO mensurada, mas sem LIN confiável: classificação não disponível.');
 if(va.status==='low'&&kco.status==='normal')remarks.push('VA reduzido com KCO preservado não normaliza a DLCO nem estabelece etiologia.');
 if(supplied(res)){
  const high=resistance.filter(r=>['raw','sraw','r5','r20','r5r20','ax','fres'].includes(r.key)&&r.status==='high');
  const low=resistance.filter(r=>['gaw','sgaw','x5'].includes(r.key)&&r.status==='low');
  if(high.length||low.length)remarks.push('Alterações nos parâmetros de resistência/mecânica: '+[...high,...low].map(r=>PARAMETERS[r.key][0]).join(', ')+'.');
  else if(resistance.some(r=>finite(r.measured)&&r.status==='unclassified'))remarks.push('Resistência/mecânica mensurada, sem limites específicos suficientes para classificação.');
  else remarks.push('Parâmetros de resistência/mecânica dentro dos limites informados.');
 }
 if(!remarks.length)remarks.push('Não há dados complementares suficientes para conclusão funcional integrada.');
 if(errors.length)remarks.unshift('ATENÇÃO: inconsistências numéricas impedem laudo final até correção.');
 const hasData=supplied(vol)||supplied(diff)||supplied(res);
 return {volumes,diffusion,resistance,remarks,warnings:[...new Set(warnings)],errors,hasData,
  hasVolumes:supplied(vol),hasDiffusion:supplied(diff),hasResistance:supplied(res),
  vaToTlc:positive(D.va.measured)&&positive(V.tlc.measured)?100*D.va.measured/V.tlc.measured:null,
  references:{volume:'Lessa et al., J Bras Pneumol 2021;47:e20200359',diffusion:'Guimarães et al., J Bras Pneumol 2019;45:e20180262',hb:'ERS/ATS DLCO 2017'}};
}
export function parseSupplement(text,mode='auto'){
 const defs=[
  ['tlc',/^(?:cpt|tlc)\b/i],['rv',/^(?:vr|rv)\b/i],['frc',/^(?:crf|frc|f r c)\b/i],['erv',/^(?:vre|erv)\b/i],['ic',/^(?:ci|ic)\b/i],['vc',/^(?:cv(?:\s+lenta)?|svc)\b/i],
  ['rvtlc',/^(?:vr\s*\/\s*cpt|rv\s*\/\s*tlc)\b/i],
  ['dlco',/^(?:dlco|dco|tlco)\b/i],['va',/^(?:va|volume\s+alveolar)\b/i],['kco',/^(?:kco)\b/i],
  ['raw',/^raw\b/i],['sraw',/^sraw\b/i],['gaw',/^gaw\b/i],['sgaw',/^sgaw\b/i],
  ['r5r20',/^r5\s*[-–]\s*r20\b/i],['r5',/^r5\b/i],['r20',/^r20\b/i],
  ['x5',/^x5\b/i],['ax',/^ax\b/i],['fres',/^(?:fres|fr)\b/i]
 ];
 let columns=null;const out={volumes:{},diffusion:{},resistance:{}};let count=0;
 for(const raw of String(text||'').split(/\r?\n/)){
  const line=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/₅/g,'5').trim();
  // Only map tabular values when a verifiable heading is present.
  if(/\b(medido|observado|real|meas(?:ured)?)\b/i.test(line)&&/\b(previsto|pred|predicted)\b/i.test(line)&&line.length<130){
   const toks=line.replace(/% ?(?:prev(?:isto)?|pred(?:icted)?)/ig,'percent').split(/[\t\s;|]+/);
   const arr=toks.map(x=>/^(medido|observado|real|meas|measured)$/i.test(x)?'measured':
    /^(previsto|pred|predicted)$/i.test(x)?'pred':
    /^(lin|lln)$/i.test(x)?'lln':/^(lsn|uln)$/i.test(x)?'uln':
    /^(percent|%|z|score|zscore)$/i.test(x)?'skip':null).filter(Boolean);
   columns=arr.includes('measured')&&arr.includes('pred')?arr:null;
   continue;
  }
  if(!columns)continue;
  const matched=defs.find(([,re])=>re.test(line));if(!matched)continue;
  const [key,re]=matched;
  const values=line.replace(re,'').replace(/^\s*\([^)]*\)/,'').trim().split(/[\s;|\t]+/).filter(Boolean);
  if(values.length!==columns.length)continue;
  const row={};let ok=true;
  values.forEach((t,i)=>{
   if(columns[i]==='skip')return;
   if(/^[-–—]+$/.test(t))return;
   if(!/^-?\d+(?:[.,]\d+)?$/.test(t)){ok=false;return;}
   row[columns[i]]=Number(t.replace(',','.'));
  });
  if(!ok||!finite(row.measured))continue;
  const group=VOLUME_KEYS.includes(key)?'volumes':DLCO_KEYS.includes(key)?'diffusion':'resistance';
  if(!out[group][key]){out[group][key]=row;count++;}
 }
 return {data:out,count};
}
