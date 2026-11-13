const valid=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
export function interpret(d, options={}){
 const a=d.fev1||{},b=d.fvc||{},r=d.ratio||{},errors=[];
 for(const [key,row] of Object.entries(d))for(const [col,v]of Object.entries(row))if(v!=null&&(!valid(v)||(key==='ratio'?v>100:v>15)))errors.push(`Rever ${key.toUpperCase()} / ${col}: valor fora da faixa aceita.`);
 for(const col of ['pre','post'])if(valid(a[col])&&valid(b[col])&&a[col]>b[col])errors.push(`VEF1 maior que CVF (${col}). Confira valores e unidades.`);
 const ratio=valid(a.pre)&&valid(b.pre)?a.pre/b.pre*100:null;
 let pattern='indeterminate';
 if(!errors.length&&ratio!==null&&valid(r.lln)){
  if(ratio<r.lln)pattern='obstruction';
  else if(valid(b.lln))pattern=b.pre<b.lln?'low-fvc':(valid(a.lln)&&a.pre<a.lln?'low-fev1':'normal');
 }
 const deltas={};
 for(const [name,row]of [['fev1',a],['fvc',b]])if(valid(row.pre)&&valid(row.post)&&valid(row.pred))deltas[name]={liters:row.post-row.pre,percent:(row.post-row.pre)/row.pred*100};
 const europeanResponse=Object.values(deltas).some(x=>x.percent>10+1e-9)?'positive':Object.keys(deltas).length===2?'negative':'incomplete';
 const abnormal=(ratio!==null&&valid(r.lln)&&ratio<r.lln)||(valid(a.pre)&&valid(a.lln)&&a.pre<a.lln)||(valid(b.pre)&&valid(b.lln)&&b.pre<b.lln);
 const normal=ratio!==null&&valid(r.lln)&&ratio>=r.lln&&valid(a.lln)&&a.pre>=a.lln&&valid(b.lln)&&b.pre>=b.lln;
 const guideline=options.guideline==='ers2022'?'ers2022':'sbpt2024';
 const threshold=abnormal?7:normal?10:null;
 let response=guideline==='ers2022'?europeanResponse:threshold===null?'incomplete':Object.values(deltas).some(x=>x.percent+1e-9>=threshold)?'positive':Object.keys(deltas).length===2?'negative':'incomplete';
 if(errors.length)response='incomplete';
 return {pattern,response,ratio,deltas,errors,threshold,guideline,europeanResponse:errors.length?'incomplete':europeanResponse,baseline:abnormal?'alterado':normal?'normal':'indeterminado',lowFvc:valid(b.pre)&&valid(b.lln)&&b.pre<b.lln};
}
// Compatibilidade: a leitura agora é feita pelo parser unificado.
import {parseExam} from './parser.mjs';
export function parseTable(text,manualColumns=null){return parseExam(text,{manualColumns}).spirometry;}
