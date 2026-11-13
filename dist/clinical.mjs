const valid=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
export function interpret(d, options={}){
 const a=d.fev1||{},b=d.fvc||{},r=d.ratio||{},errors=[];
 for(const [key,row] of Object.entries(d))for(const [col,v]of Object.entries(row))if(v!=null&&(!valid(v)||(key==='ratio'?v>100:v>15)))errors.push(`Rever ${key.toUpperCase()} / ${col}: valor fora da faixa aceita.`);
 for(const col of ['pre','post'])if(valid(a[col])&&valid(b[col])&&a[col]>b[col])errors.push(`VEF1 maior que CVF (${col}). Confira valores e unidades.`);
 const ratio=valid(a.pre)&&valid(b.pre)?a.pre/b.pre*100:null;
 let pattern='indeterminate';
 if(!errors.length&&ratio!==null&&valid(r.lln)){
  if(ratio<r.lln)pattern='obstruction';
  else if(valid(b.lln))pattern=b.pre<b.lln?'low-fvc':(valid(a.lln)&&a.pre<a.lln?'indeterminate':'normal');
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
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/₁/g,'1');
export function parseTable(text,manualColumns=null){
 const out={};let columns=manualColumns;
 for(const raw of text.split(/\r?\n/)){
  const line=norm(raw).trim();
  if(!manualColumns&&/\b(pre|pre-bd|basal)\b/.test(line)&&!/^\s*(vef|fev|cvf|fvc)/.test(line)){
   const tokens=line.replace(/%\s+(prev\w*|pred\w*)/g,'%pred').split(/[\s;|\t]+/);
   const mapped=tokens.map(t=>/^(pre|pre-bd|basal)$/.test(t)?'pre':/^(pos|post|pos-bd|post-bd)$/.test(t)?'post':/^(previsto|predicted|pred|prev|teorico)$/.test(t)?'pred':/^(lin|lln)$/.test(t)?'lln':/^(%|%pred|%prev|z|z-score|delta|%var)$/.test(t)?'skip':null).filter(Boolean);
   if(mapped.includes('pre'))columns=mapped;
   continue;
  }
  if(!columns)continue;
  const match=line.match(/^(vef\s*1\s*\/\s*cvf|fev\s*1\s*\/\s*fvc|vef\s*1|fev\s*1|cvf|fvc)\b(.*)$/);
  if(!match)continue;
  const key=match[1].includes('/')?'ratio':/^(vef|fev)/.test(match[1])?'fev1':'fvc';
  const tokens=match[2].replace(/\([^)]*\)/g,'').replace(/^\s*(l|litros|%)\s*/,'').trim().split(/[\s;|\t]+/).filter(Boolean);
  if(tokens.length!==columns.length||out[key])continue;
  const row={};let bad=false;
  tokens.forEach((t,i)=>{if(columns[i]==='skip')return; if(/^[-–—]+$/.test(t))return; if(!/^\d+(?:[.,]\d+)?%?$/.test(t)){bad=true;return;}let n=Number(t.replace('%','').replace(',','.'));if(key==='ratio'&&n>0&&n<=1)n*=100;row[columns[i]]=n;});
  if(!bad)out[key]=row;
 }
 return out;
}
