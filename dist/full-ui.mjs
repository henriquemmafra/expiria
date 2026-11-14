import {analyzeFull,brazilReferences,brazilSpirometryReferences,adjustPredictedDLCOForHb,PARAMETERS} from './full-function.mjs';
import {interpret as interpretSpirometry} from './clinical.mjs';
import {chartRows,chartSVG} from './chart.mjs';
const $=id=>document.getElementById(id);
const nval=id=>{const v=$(id)?.value.trim();return v?Number(v.replace(',','.')):null;};
const fmt=(n,k=2)=>typeof n==='number'&&Number.isFinite(n)?n.toFixed(k).replace('.',','):'—';
const groups={volumes:['tlc','rv','frc','erv','ic','vc','rvtlc'],diffusion:['dlco','va','kco'],
 resistance:['raw','sraw','gaw','sgaw','r5','r20','r5r20','x5','ax','fres']};
const container=document.createElement('section');container.id='full-panel';container.className='panel full-panel';
container.innerHTML=[
 '<div class="section-head"><div><span class="eyebrow">02B / FUNÇÃO PULMONAR COMPLETA</span><h2>Volumes, DLCO e resistência</h2></div><span class="pill">Módulos independentes</span></div>',
 '<p class="muted">Preencha somente os módulos realizados. Revise os valores no original; os previstos do equipamento podem ser digitados quando necessário.</p>',
 '<div class="full-meta">',
 '<label>Sexo de referência<select id="full-sex"><option value="">Não informado</option><option value="M">Masculino</option><option value="F">Feminino</option></select></label>',
 '<label>Idade (anos)<input type="number" id="full-age" min="1" max="120"></label>',
 '<label>Estatura (cm)<input type="number" id="full-height" min="80" max="230"></label>',
 '<label>Peso (kg)<input type="number" id="full-weight" min="10" max="300"></label>',
 '<label>Hemoglobina (g/dL)<input type="number" id="full-hb" step="0.1" min="3" max="25"></label>',
 '<label>Referência<select id="full-reference"><option value="brazil">Brasileira — estudos originais</option><option value="equipment">Valores conferidos do laboratório</option></select></label>',
 '<label>Técnica de volumes<select id="full-method"><option value="pleth">Pletismografia</option><option value="gas">Diluição/lavagem de gases</option><option value="other">Outra / não informada</option></select></label>',
 '<label>Hemoglobina na DLCO<select id="full-hbmode"><option value="none">Não aplicar automaticamente</option><option value="predicted">Medida sem correção: ajustar o previsto pela Hb</option><option value="already">Medida já corrigida no equipamento</option></select></label>',
 '<label>Unidade da DLCO/KCO<select id="full-dlco-unit"><option value="traditional">mL/min/mmHg (tradicional)</option><option value="si">mmol/min/kPa (SI)</option></select></label>',
 '<label>Qualidade dos exames complementares<select id="full-quality"><option value="unknown">Ainda não verificada</option><option value="verified">Conferida por profissional habilitado</option><option value="limited">Exame tecnicamente limitado</option></select></label>',
 '<label>Método de resistência<select id="full-resmethod"><option value="pleth">Pletismografia · Raw/sRaw/Gaw/sGaw</option><option value="osc">Oscilometria · R5/R20/X5/AX/Fres</option></select></label>',
 '</div><p id="full-ref-info" class="full-help" role="status"></p><div id="full-tables"></div>',
 '<div class="full-actions"><button id="full-extract">Extrair dados complementares do texto</button><span id="full-extract-status" role="status">Somente tabelas com cabeçalhos reconhecidos.</span></div>',
 '<p class="full-help">Equações brasileiras se aplicam a adultos brancos e não obesos dentro dos intervalos dos estudos, e à técnica correspondente. Para resistência e oscilometria, informe os limites do equipamento/laboratório.</p>',
 '<button id="full-generate" class="primary wide" disabled>Gerar laudo integrado <span>→</span></button>',
 '<p class="small muted">Ferramenta não validada para uso clínico autônomo. Confira todos os dados e unidades com o original.</p>'
].join('');
document.querySelector('.workspace').after(container);
for(const [group,keys]of Object.entries(groups)){
 const section=document.createElement('details');section.className='full-details';section.open=group==='volumes';
 const headings={volumes:'Volumes pulmonares',diffusion:'Difusão pulmonar — DLCO',resistance:'Resistência / oscilometria'};
 const summary=document.createElement('summary');summary.textContent=headings[group];section.append(summary);
 const wrap=document.createElement('div');wrap.className='table-wrap';
 const table=document.createElement('table');table.innerHTML='<thead><tr><th>Parâmetro</th><th>Medido</th><th>Previsto</th><th>LIN</th><th>LSN</th></tr></thead>';
 const tbody=document.createElement('tbody');
 for(const key of keys){
  const tr=document.createElement('tr');tr.dataset.param=key;
  const title=document.createElement('td');
  const b=document.createElement('strong');b.textContent=PARAMETERS[key][0];title.append(b);
  const small=document.createElement('small');small.textContent=PARAMETERS[key][1];title.append(small);
  const auto=document.createElement('small');auto.id='full-ref-'+key;auto.className='full-auto-ref';title.append(auto);tr.append(title);
  for(const col of ['measured','pred','lln','uln']){
   const td=document.createElement('td'),input=document.createElement('input');
   input.id='full-'+group+'-'+key+'-'+col;input.inputMode='decimal';input.placeholder=col==='measured'?'—':'auto / —';
   input.setAttribute('aria-label',PARAMETERS[key][0]+' '+col);input.autocomplete='off';
   input.addEventListener('input',()=>{const own=input.classList.contains('calc')||/-measured$/.test(input.id)===false;input.classList.remove('auto','calc');input.title='';if(own)input.dataset.manual='1';fillReferences();markEdited();invalidate();});td.append(input);tr.append(td);
  }tbody.append(tr);
 }
 table.append(tbody);wrap.append(table);section.append(wrap);$('full-tables').append(section);
}
function showMode(){
 const oscillometry=$('full-resmethod').value==='osc';
 for(const tr of $('full-tables').querySelectorAll('tr[data-param]')){
  const k=tr.dataset.param;
  if(groups.resistance.includes(k))tr.hidden=oscillometry?groups.resistance.slice(0,4).includes(k):groups.resistance.slice(4).includes(k);
 }
}
function demographics(){return {sex:$('full-sex').value,age:nval('full-age'),height:nval('full-height'),weight:nval('full-weight'),hemoglobin:nval('full-hb')};}
function sourceData(){
 const d={volumes:{},diffusion:{},resistance:{}};
 for(const [group,keys]of Object.entries(groups))for(const key of keys){
  const row={};
  for(const col of ['measured','pred','lln','uln']){
   const el=$('full-'+group+'-'+key+'-'+col);if(el&&el.classList.contains('calc'))continue;
   const v=nval('full-'+group+'-'+key+'-'+col);if(v!==null)row[col]=v;
  }
  if(Object.keys(row).length&&!(group==='resistance'&&($('full-resmethod').value==='osc'?groups.resistance.slice(0,4).includes(key):groups.resistance.slice(4).includes(key))))d[group][key]=row;
 }
 if($('full-dlco-unit').value==='si')for(const key of groups.diffusion){
  if(key==='va')continue;
  const row=d.diffusion[key];if(!row)continue;
  for(const col of ['measured','pred','lln','uln'])if(Number.isFinite(row[col]))row[col]*=2.987;
 }
 return d;
}
function spiroData(){
 const d={fev1:{},fvc:{},ratio:{}};
 for(const key of Object.keys(d))for(const col of ['pre','post','pred','lln']){
  const input=$(key+'-'+col);if(input&&input.value.trim())d[key][col]=Number(input.value.trim().replace(',','.'));
 }
 return d;
}
function fullAnalysis(){
 return analyzeFull({...sourceData(),demographics:demographics(),settings:{
  reference:$('full-reference').value,volumeMethod:$('full-method').value,
  hbMode:$('full-hbmode').value,resistanceMethod:$('full-resmethod').value,quality:$('full-quality').value
 },spirometry:interpretSpirometry(spiroData())});
}
function markEdited(){$('confirmed').checked=false;$('interpret').disabled=true;}
// Previsto/LIN/LSN calculados: preenchem só caixas vazias (ou já calculadas), nunca o que veio do exame ou foi digitado.
const CALC_TITLE='Calculado pelo Expiria a partir de sexo, idade e estatura';
const shown=(v,dec=2)=>String(Math.round(v*10**dec)/10**dec).replace('.',',');
function putCalc(input,value,source,dec){
 if(!input||input.dataset.manual)return 0;
 const empty=!input.value.trim(),calc=input.classList.contains('calc');
 if(!empty&&!calc)return 0;
 if(value==null||!Number.isFinite(value)){if(calc){input.value='';input.classList.remove('auto','calc');input.title='';}return 0;}
 input.value=shown(value,dec);input.classList.add('auto','calc');input.title=CALC_TITLE+' — '+source;return 1;
}
function fillReferences(){
 const demo=demographics();let spiro=0,supp=0;
 const sp=brazilSpirometryReferences(demo);
 for(const key of ['fev1','fvc'])for(const col of ['pred','lln'])spiro+=putCalc($(key+'-'+col),sp.refs[key]?.[col],sp.refs[key]?.source,2);
 spiro+=putCalc($('ratio-lln'),sp.refs.ratio?.lln,sp.refs.ratio?.source,1);
 const ratioLln=$('ratio-lln');
 if(sp.refs.ratio&&(!ratioLln.dataset.pred||ratioLln.dataset.predCalc)){ratioLln.dataset.pred=sp.refs.ratio.pred;ratioLln.dataset.predCalc='1';}
 else if(!sp.refs.ratio&&ratioLln.dataset.predCalc){delete ratioLln.dataset.pred;delete ratioLln.dataset.predCalc;}
 const brazil=$('full-reference').value==='brazil',refs=brazil?brazilReferences(demo).refs:{};
 const si=$('full-dlco-unit').value==='si',hb=$('full-hbmode').value==='predicted';
 for(const [group,keys]of [['volumes',groups.volumes],['diffusion',groups.diffusion]])for(const key of keys){
  let ref=group==='volumes'&&$('full-method').value!=='pleth'?null:refs[key];
  const hasMeasured=nval('full-'+group+'-'+key+'-measured')!==null;
  if(ref&&key==='dlco'&&hb){const adj=adjustPredictedDLCOForHb(ref,demo.hemoglobin,demo.sex);if(adj)ref=adj;}
  const k=si&&group==='diffusion'&&key!=='va'?1/2.987:1;
  for(const col of ['pred','lln','uln']){
   const v=hasMeasured&&ref&&Number.isFinite(ref[col])?ref[col]*k:null;
   supp+=putCalc($('full-'+group+'-'+key+'-'+col),v,ref?.source||'',key==='rvtlc'?1:2);
  }
 }
 return {spiro,supp,errors:sp.errors};
}
// Edição manual: o valor passa a ser do usuário e não é mais recalculado.
for(const input of document.querySelectorAll('#values input'))input.addEventListener('input',()=>{input.classList.remove('calc');input.title='';input.dataset.manual='1';});
function invalidate(){
 const result=fullAnalysis(),s=spiroData();
 $('full-generate').disabled=!$('confirmed').checked||(!result.hasData&&!(s.fev1.pre&&s.fvc.pre));
 $('report-panel').hidden=true;
 const refs=$('full-reference').value==='brazil'?brazilReferences(demographics()):{refs:{},errors:[]};
 for(const key of [...groups.volumes,...groups.diffusion]){
  const el=$('full-ref-'+key),r=$('full-method').value!=='pleth'&&groups.volumes.includes(key)?null:refs.refs[key];
  if(el)el.textContent=r?'Prev. '+fmt(r.pred)+' · LIN '+fmt(r.lln):'';
 }
 $('full-ref-info').textContent=refs.errors.join(' ')||'Referências brasileiras apenas para a população e método estudados. Fora das faixas, use dados do equipamento.';
}
function lines(rows){
 return rows.filter(r=>Number.isFinite(r.measured)).map(r=>{
  const status=r.status==='normal'?(Number.isFinite(r.lln)&&Number.isFinite(r.uln)?'dentro dos limites informados':Number.isFinite(r.lln)?'não abaixo do LIN':Number.isFinite(r.uln)?'não acima do LSN':'não classificável'):{low:'abaixo do LIN',high:'acima do LSN',unclassified:'não classificável',absent:'não informado'}[r.status];
  return PARAMETERS[r.key][0]+': '+fmt(r.measured)+' '+PARAMETERS[r.key][1]+
   '; previsto '+fmt(r.pred)+(r.percentPred!=null?' ('+fmt(r.percentPred,1)+'% do previsto)':'')+
   '; LIN '+fmt(r.lln)+'; LSN '+fmt(r.uln)+' — '+status+(r.derived?' [calculado de parâmetros medidos]':'')+'.';
 }).join('\n');
}
function appendix(r){
 let report='';
 if(r.hasData)report+='\n\nQUALIDADE DOS EXAMES COMPLEMENTARES\n'+$('full-quality').selectedOptions[0].text+'.';
 if(r.hasVolumes)report+='\n\nVOLUMES PULMONARES\nMétodo: '+$('full-method').selectedOptions[0].text+'\n'+lines(r.volumes);
 if(r.hasDiffusion){
  report+='\n\nDIFUSÃO PULMONAR — DLCO\n'+lines(r.diffusion);
  report+='\nHemoglobina: '+(Number.isFinite(demographics().hemoglobin)?fmt(demographics().hemoglobin,1)+' g/dL':'não informada')+
  '. Correção por Hb: '+$('full-hbmode').selectedOptions[0].text+'.';
  if(r.vaToTlc!=null)report+='\nVA/CPT: '+fmt(r.vaToTlc,1)+'%.';
 }
 if(r.hasResistance)report+='\n\nRESISTÊNCIA / MECÂNICA\n'+$('full-resmethod').selectedOptions[0].text+'\n'+lines(r.resistance);
 report+='\n\nCONCLUSÃO FUNCIONAL INTEGRADA\n'+r.remarks.join('\n');
 if(r.warnings.length)report+='\n\nLIMITAÇÕES\n'+r.warnings.map(s=>'• '+s).join('\n');
 report+='\n\nREFERÊNCIAS DOS NOVOS MÓDULOS\nLessa et al. J Bras Pneumol 2021;47:e20200359 (volumes por pletismografia). Guimarães et al. J Bras Pneumol 2019;45:e20180262 (DLCO, VA, KCO: tabela original). ERS/ATS 2017 para Hb. Equações não validadas fora da população estudada.';
 return report;
}
function addCard(r){
 const card=document.createElement('div');card.className='result';
 const span=document.createElement('span');span.textContent='Função pulmonar completa';
 const strong=document.createElement('strong');strong.textContent=[r.hasVolumes&&'Volumes',r.hasDiffusion&&'DLCO',r.hasResistance&&'Resistência'].filter(Boolean).join(' · ');
 card.append(span,strong);$('result-cards').append(card);
}
function generate(){
 if(!$('confirmed').checked){$('full-extract-status').textContent='Confira os valores e assinale a confirmação antes de gerar o laudo.';return;}
 const r=fullAnalysis(),spi=interpretSpirometry(spiroData());
 const invalid=[...container.querySelectorAll('input')].filter(x=>x.value.trim()&&(!Number.isFinite(Number(x.value.trim().replace(',','.')))||x.type==='number'&&(x.validity.rangeOverflow||x.validity.rangeUnderflow)));
 if(invalid.length){$('full-extract-status').textContent='Corrigir campos numéricos inválidos: '+invalid.map(x=>x.getAttribute('aria-label')||x.id).join(', ');return;}
 if(r.errors.length){$('full-extract-status').textContent='Corrigir valores: '+r.errors.join(' ');return;}
 if(!r.hasData){if(!$('interpret').disabled)$('interpret').click();return;}
 if(spiroData().fev1.pre&&spiroData().fvc.pre&&!spi.errors.length&&!$('interpret').disabled){
  $('interpret').click();return; // o listener abaixo acrescenta o anexo uma vez
 }
 $('result-cards').replaceChildren();
 $('report').value='EXPIRIA · SUGESTÃO DE LAUDO PARA REVISÃO MÉDICA\n'+
   ($('patient').value?'Exame: '+$('patient').value+'\n':'')+
   ($('date').value?'Data: '+$('date').value.split('-').reverse().join('/')+'\n':'')+
   '\nESPIROMETRIA\nNão interpretada: valores ou referências insuficientes.';
 $('report').value+=appendix(r);addCard(r);
 $('report-panel').hidden=false;$('report-panel').scrollIntoView({behavior:'smooth'});
 $('report-status').textContent='Revise as limitações e confirme o exame original.';
}
function drawChart(){
 const s=spiroData(),pred=Number($('ratio-lln').dataset.pred);if(Number.isFinite(pred)&&pred>0)s.ratio.pred=pred;
 $('chart-wrap').hidden=false;const width=$('chart').clientWidth||760;
 const full=fullAnalysis(),svg=chartSVG(chartRows(s,full.hasData&&!full.errors.length?full:null,PARAMETERS),{width});
 $('chart').innerHTML=svg;$('chart-wrap').hidden=!svg;
}
$('full-generate').onclick=()=>{generate();if(!$('report-panel').hidden)drawChart();};
$('interpret').addEventListener('click',()=>{
 if(!$('report-panel').hidden)drawChart();
 const r=fullAnalysis();if(!r.hasData)return;
 if(r.errors.length){$('report').value+='\n\nATENÇÃO: resultados complementares omitidos por inconsistências numéricas: '+r.errors.join(' ');return;}
 $('report').value+=appendix(r);addCard(r);
});
const SELECT_DEFAULTS={'full-sex':'','full-reference':'brazil','full-method':'pleth','full-hbmode':'none','full-dlco-unit':'traditional','full-resmethod':'pleth','full-quality':'unknown'};
function setField(id,value){const el=$(id);if(!el||value==null||value==='')return;el.value=String(value);el.classList.add('auto');}
// Cada texto colado é um exame novo: limpa o anterior e preenche o que foi lido.
document.addEventListener('expiria:parsed',({detail:p})=>{
 for(const input of container.querySelectorAll('input')){input.value='';input.classList.remove('auto','calc');input.title='';delete input.dataset.manual;}
 for(const [id,v]of Object.entries(SELECT_DEFAULTS)){$(id).value=v;$(id).classList.remove('auto');}
 const d=p.demographics||{},st=p.settings||{};
 setField('full-sex',d.sex);setField('full-age',d.age);setField('full-height',d.height);setField('full-weight',d.weight);setField('full-hb',d.hemoglobin);
 setField('full-method',st.volumeMethod);setField('full-dlco-unit',st.dlcoUnit);setField('full-resmethod',st.resistanceMethod);
 if(st.hbCorrected)setField('full-hbmode','already');
 let added=0;
 for(const group of ['volumes','diffusion','resistance'])for(const [key,row]of Object.entries(p[group]||{}))for(const [col,val]of Object.entries(row)){
  const input=$('full-'+group+'-'+key+'-'+col);if(input){input.value=String(Math.round(val*1000)/1000).replace('.',',');input.classList.add('auto');added++;}
 }
 const calc=fillReferences();
 for(const section of container.querySelectorAll('.full-details'))if([...section.querySelectorAll('input')].some(x=>x.value))section.open=true;
 showMode();markEdited();invalidate();
 if(calc.spiro)$('status').textContent+=` Previsto e LIN da espirometria calculados por Pereira 2007 a partir de sexo, idade e estatura (${calc.spiro} campos verdes). Equações de adultos brancos: em adultos negros os previstos são menores (Prata 2018).`;
 else if(calc.errors.length&&(!$('fev1-lln').value||!$('fvc-lln').value||!$('ratio-lln').value)&&Object.keys(p.spirometry||{}).length)$('status').textContent+=' '+calc.errors[0];
 if(calc.supp)$('status').textContent+=` Previsto/LIN de volumes e DLCO calculados pelas referências brasileiras (${calc.supp} campos verdes).`;
 $('full-extract-status').textContent=added?added+' campos complementares lidos do texto. Confira valores e unidades no exame original.':'Sem tabelas complementares no texto.';
});
$('full-extract').onclick=()=>$('extract').click();
$('full-extract').textContent='Reler o texto colado';
for(const id of ['full-sex','full-age','full-height','full-weight','full-hb','full-reference','full-method','full-hbmode','full-dlco-unit','full-resmethod','full-quality']){
 $(id).addEventListener('input',()=>{$(id).classList.remove('auto');showMode();fillReferences();markEdited();invalidate();});
}
$('confirmed').addEventListener('change',invalidate);
$('reset').addEventListener('click',()=>{
 // Só reinicializar controles adicionais se o formulário principal tiver sido limpo.
 if($('source').value||$('fev1-pre').value)return;
 for(const input of container.querySelectorAll('input')){input.value='';input.classList.remove('auto','calc');input.title='';delete input.dataset.manual;}
 for(const select of container.querySelectorAll('select')){select.selectedIndex=0;select.classList.remove('auto');}
 showMode();invalidate();
});
showMode();invalidate();
