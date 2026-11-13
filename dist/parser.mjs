/**
 * Expiria | Leitura unificada do texto colado.
 * Um único passo extrai espirometria, volumes, DLCO, resistência/oscilometria,
 * dados do paciente (sexo, idade, estatura, peso, Hb, data) e o método.
 * Regras de segurança: colunas só são atribuídas a partir de um cabeçalho
 * reconhecido; linhas ambíguas não são adivinhadas e são devolvidas em `skipped`.
 */

// ---------- normalização ----------
const stripAccents = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
// Mantém o comprimento da linha (para alinhamento por posição em texto monoespaçado).
const softNorm = s => stripAccents(String(s)).toLowerCase()
  .replace(/[   ]/g, ' ')
  .replace(/[₀-₉]/g, c => String(c.charCodeAt(0) - 0x2080))
  .replace(/[−–—]/g, '-');
// Normalização de rótulos (pode alterar o comprimento).
const JUNK_PREFIX = /^[\s|•*·>~(\[-]*(?:[^\s]{1,2}\s{2,})?[\s|•*·>~(\[-]*/;
const labelNorm = s => softNorm(s).replace(JUNK_PREFIX, '').replace(/^([a-z0-9\/%-]{2,9}?)l\)/, '$1 l)')
  .replace(/^(vef|fev)[l|i!](?![a-z])/, '$11')
  .replace(/\b(vef|fev)\s+1\b/g, '$11')
  .replace(/\s*\/\s*/g, '/')
  .replace(/\b(r5)\s*-\s*(r20)\b/g, '$1-$2')
  .replace(/\s+/g, ' ').trim();

// ---------- vocabulário de colunas ----------
const HEADER_PHRASES = [
  [/\bpre[- ]?b\.?d\b\.?/g, 'pre-bd'], [/\bp[o0e6]s[- ]?b\.?d\b\.?/g, 'pos-bd'], [/\bpost[- ]?b\.?d\b\.?/g, 'pos-bd'],
  [/\b(?:var|chg|change|mud|alt)[a-z]*\.? ?%/g, '%var'],
  [/(?<![a-z0-9])% ?(?:do )?(?:prev(?:isto)?|pred(?:icted)?|teor(?:ico)?|ref)\b\.?/g, '%pred'], [/\b(?:escore|score)[ -]?z\b/g, 'z'], [/\bz[ -]?score\b/g, 'z'],
  [/\blim(?:ite)?\.? ?inf(?:erior)?\b\.?/g, 'lin'], [/\blim(?:ite)?\.? ?sup(?:erior)?\b\.?/g, 'lsn'],
  [/% ?(?:var|chg|change|mud|alt|delta)[a-z]*\.?/g, '%var'], [/\b(?:var|chg|change|mud|alt)[a-z]*\.? ?%/g, '%var'],
];
function columnType(tok) {
  const t = tok.replace(/[.:]+$/, '');
  if (/^(pre|pr[eo]-bd|prebd|basal|baseline)$/.test(t)) return 'pre';
  if (/^(pos|post|p[o0e6]s-bd|p[o0e6]sbd|post-bd|postbd)$/.test(t)) return 'post'; // OCR troca ó por é/6
  if (/^(medidos?|medidas?|observados?|obs|real|atual|actual|meas|measured|best|melhor|resultados?|result|valor|valores)$/.test(t)) return 'meas';
  if (/^(previstos?|prev|predicted|pred|teoricos?|teor|ref|referencia|reference|esperados?)$/.test(t)) return 'pred';
  if (/^(lin|lln|li|lower)$/.test(t)) return 'lln';
  if (/^(lsn|uln|ls|upper)$/.test(t)) return 'uln';
  if (/^(%|%pred|%prev|z|zscore|z-score|%var|var|delta|δ|chg|%chg|change|diff|dif|%dif|mudanca|percentil|pct)$/.test(t)) return 'skip';
  if (/^(unid|unidade|unidades|unit|units|un)$/.test(t)) return 'unit';
  return null;
}
const LABEL_WORDS = /^(parametro|parametros|parameter|parameters|variavel|variaveis|teste|test|indice|medida|item|exame)$/;

// ---------- rótulos de linha ----------
// Ordem importa: rótulos mais específicos primeiro.
const ROWS = [
  ['spiro', 'ratio', /^(?:(?:vef1|fev1)\s*(?:\/|%|\s)\s*(?:cvf|fvc)(?:\s*%)?|(?:vef|fev)[1li|!]?\s?[\/|il1u!]?\s?(?:cvf|fvc)|indice de tiffeneau|tiffeneau)(?![a-z0-9])/],
  ['skip', null, /^(?:vef1|fev1)\/(?:vef6|fev6|cv|vc|svc|cvl)(?![a-z0-9])/],
  ['spiro', 'fev1', /^(?:vef1|fev1)(?:[.,]0)?(?![a-z0-9/])/],
  ['spiro', 'fvc', /^(?:cvf|fvc)(?![a-z0-9/])/],
  ['volumes', 'rvtlc', /^(?:vr\/cpt|rv\/tlc|vr\s?[|il1!]\s?cpt|rv\s?[|il1!]\s?tlc)(?![a-z0-9])/],
  ['diffusion', 'kco', /^(?:kco|dlco\/va|dl\/va|dlco\/vab|tlco\/va|dlcoc\/va|dlco\/va\s*sb|dlco\s?[|il1!n]\s?v?a|dlcona)(?![a-z0-9])/],
  ['diffusion', 'dlcoc', /^(?:dlcoc|dlco\s*(?:cor|corr|corrigid[ao]|adj|hb|c)|tlcoc)(?![a-z0-9])/],
  ['diffusion', 'dlco', /^(?:dlco|dco|tlco|dl\s*co)(?![a-z0-9/])/],
  ['diffusion', 'va', /^(?:va|vab|volume alveolar)(?![a-z0-9/])/],
  ['volumes', 'tlc', /^(?:cpt|tlc)(?![a-z0-9/])/],
  ['volumes', 'rv', /^(?:vr|rv)(?![a-z0-9/])/],
  ['volumes', 'frc', /^(?:crf|frc|tgv|vgt)(?![a-z0-9/])/],
  ['volumes', 'erv', /^(?:vre|erv)(?![a-z0-9/])/],
  ['volumes', 'ic', /^(?:ci|ic)(?![a-z0-9/])/],
  ['volumes', 'vc', /^(?:cv lenta|cvl|cv|svc|vc|vc max|ivc|cvi)(?![a-z0-9/])/],
  ['resistance', 'sgaw', /^sgaw(?![a-z0-9/])/],
  ['resistance', 'sraw', /^(?:sraw|sreff|sraw\s*eff|sraw\s*tot)(?![a-z0-9/])/],
  ['resistance', 'gaw', /^gaw(?![a-z0-9/])/],
  ['resistance', 'raw', /^(?:raw|rtot|raw\s*tot|reff)(?![a-z0-9/])/],
  ['resistance', 'r5r20', /^r5-r20(?![a-z0-9])/],
  ['resistance', 'r5', /^r\s?5(?:\s*hz)?(?![a-z0-9-])/],
  ['resistance', 'r20', /^r\s?20(?:\s*hz)?(?![a-z0-9])/],
  ['resistance', 'x5', /^x\s?5(?:\s*hz)?(?![a-z0-9])/],
  ['resistance', 'ax', /^ax(?![a-z0-9])/],
  ['resistance', 'fres', /^(?:fres|f\s*res|fr)(?![a-z0-9])/],
];
// Qualificadores/unidades que podem seguir o rótulo ou aparecer nas células.
const UNIT_TOKEN = /^(?:l|litros?|ml|%|sb|pleth|pl|best|kpa(?:[.·*]s\/l|\/l)?|cmh2o(?:[.·*]s\/l|[.·*]s)?|hz|ml\/min\/mmhg|mmol\/min\/kpa|mmol\/(?:min\/)?kpa\/l|ml\/min\/mmhg\/l|l\/s|l\/kpa[.·*]s|1\/kpa[.·*]s|hpa[.·*]s\/l|btps|stpd)$/;
const BLANK_TOKEN = /^(?:-+|\.|\*|n\/?a|nd|--?|·|…)$/;

function numberToken(tok) {
  let t = tok.replace(/^[(\[]+|[)\]]+$/g, '');
  // OCR: O/o → 0, I/l → 1 apenas dentro de tokens numéricos.
  if (/\d/.test(t) && /^[-+]?[\dOoIl]+(?:[.,][\dOoIl]+)?[*#↓↑%]*[lh]?$/i.test(t)) t = t.replace(/[Oo]/g, '0').replace(/(\d)[Il](?=\d)/g, '$11').replace(/^[Il](?=\d)/, '1');
  const m = t.match(/^([-+]?\d+(?:[.,]\d+)?)(?:\*+|#|↓|↑|%|\s*\(?[lh]\)?)?$/i);
  return m ? Number(m[1].replace(',', '.')) : null;
}

function splitCells(raw) {
  for (const d of ['\t', '|', ';']) if (raw.includes(d)) {
    const cells = raw.split(d).map(c => c.trim());
    if (d === '|') { if (cells[0] === '') cells.shift(); if (cells.at(-1) === '') cells.pop(); }
    if (cells.length >= 3) return {delimited: true, cells};
  }
  return {delimited: false, cells: null};
}

// Ruído de OCR na margem: até 2 tokens curtos depois de um vão grande de espaços.
function dropMarginJunk(line) {
  const m = line.match(/^(.*\S)(\s{8,})((?:\S{1,2}\s*){1,2})$/);
  if (!m || !/\S/.test(m[1]) || m[3].trim().split(/\s+/).some(t => numberToken(t) !== null)) return line;
  return m[1] + ' '.repeat(m[2].length + m[3].length);
}

// ---------- cabeçalho ----------
function readHeader(raw) {
  let line = softNorm(raw).replace(/\s{8,}\S{1,2}\s*$/, ''); // ruído de OCR na margem direita
  if (/(?:^|\s)[-+]?\d+(?:[.,]\d+)?(?:\s|$)/.test(line)) return null; // cabeçalho não tem números soltos
  // Substituições com o mesmo comprimento, para preservar posições de colunas.
  for (const [re, rep] of HEADER_PHRASES) line = line.replace(re, m => rep.length <= m.length ? rep.padEnd(m.length) : rep);
  const {delimited, cells} = splitCells(line);
  const toks = [];
  if (delimited) cells.forEach(t => toks.push({t, center: null}));
  else { const re = /\S+/g; let m; while ((m = re.exec(dropMarginJunk(line)))) toks.push({t: m[0], center: m.index + m[0].length / 2}); }
  let known = 0, unknown = 0;
  const entries = toks.map(({t, center}, i) => {
    const sub = t.split(/\s+/).filter(Boolean);
    const type = sub.length === 1 ? columnType(sub[0]) : (sub.map(columnType).find(Boolean) || null);
    if (type) { known++; return {c: type, center}; }
    if (!t || LABEL_WORDS.test(t) || (i === 0 && delimited)) return {c: 'label', center};
    unknown++; return {c: null, center};
  });
  // Coluna desconhecida no meio do cabeçalho (ex.: "Vard" lido pelo OCR) ocupa uma posição: vira 'skip'.
  if (!delimited) { const first = entries.findIndex(e => e.c && e.c !== 'label'); entries.forEach((e, i) => { if (e.c === null && i > first && first >= 0) e.c = 'skip'; }); }
  const values = entries.map(e => e.c).filter(c => c && !['skip', 'unit', 'label'].includes(c));
  if (known < 2 || !values.length || unknown > known) return null;
  const kept = delimited ? entries : entries.filter(e => e.c && e.c !== 'label');
  return {delimited, cols: kept.map(e => e.c), centers: delimited ? null : kept.map(e => e.center),
    groupOnly: values.every(c => c === 'pre' || c === 'post') && known === toks.filter(x => x.t).length};
}

function mergeHeaders(group, header) {
  // Cabeçalho em duas linhas: "Pré-BD  Pós-BD" seguido de "Medido %Prev Medido %Prev Previsto LIN".
  const order = group.cols.filter(c => c === 'pre' || c === 'post');
  let k = 0;
  return {...header, cols: header.cols.map(c => c === 'meas' ? (order[k++] || 'skip') : c)};
}

// ---------- alinhamento de uma linha de dados ----------
function alignRow(rawLine, labelEnd, header) {
  let tokens;
  if (header.delimited) {
    const {delimited, cells} = splitCells(softNorm(rawLine));
    if (!delimited) return null;
    const out = {};
    let bad = false;
    header.cols.forEach((c, i) => {
      if (!c || c === 'label' || c === 'skip' || c === 'unit') return;
      const cell = (cells[i] || '').replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim();
      if (!cell || BLANK_TOKEN.test(cell)) return;
      const n = numberToken(cell.split(/\s+/)[0]);
      if (n === null) bad = true; else out[c] = n;
    });
    return bad ? null : out;
  }
  // texto livre separado por espaços
  const soft = softNorm(rawLine);
  const rest = soft.slice(labelEnd);
  const restOffset = labelEnd;
  const re = /\S+/g; tokens = []; let m;
  const cleaned = dropMarginJunk(rest).replace(/\([^)]*\)|\[[^\]]*\]/g, s => ' '.repeat(s.length));
  while ((m = re.exec(cleaned))) {
    const t = m[0];
    if (UNIT_TOKEN.test(t) && numberToken(t) === null) continue;
    if (/^[()\[\]{}:;=~!|]+$/.test(t) || /^\(?l\)$/.test(t)) continue; // parênteses/pontuação soltos do OCR
    tokens.push({t, center: restOffset + m.index + t.length / 2});
  }
  const keep = header.cols.map((c, i) => [c, header.centers ? header.centers[i] : null]).filter(([c]) => c !== 'label' && c !== 'unit');
  const cols = keep.map(x => x[0]), centers = header.centers ? keep.map(x => x[1]) : null;
  // Número solto muito à direita da última coluna (borda da foto, carimbo): descartar.
  if (centers && tokens.length > cols.length) { const limit = Math.max(...centers) + 15; while (tokens.length > cols.length && tokens.at(-1).center > limit) tokens.pop(); }
  const assign = (list, colList) => {
    const out = {}, decs = {}; let ok = true;
    list.forEach((tok, i) => {
      const c = colList[i];
      if (c === 'skip' || c === null) return;
      if (BLANK_TOKEN.test(tok.t)) return;
      const n = numberToken(tok.t);
      if (n === null) ok = false; else { out[c] = n; const d = tok.t.match(/[.,](\d+)/); decs[c] = d ? d[1].length : 0; }
    });
    if (ok) Object.defineProperty(out, 'decs', {value: decs, enumerable: false});
    return ok ? out : null;
  };
  if (tokens.length === cols.length) return assign(tokens, cols);
  const essential = cols.filter(c => c !== 'skip');
  // Células vazias em colunas acessórias (%prev, z, var%): sobram exatamente os valores essenciais.
  if (tokens.length === essential.length && tokens.every(x => numberToken(x.t) !== null)) return assign(tokens, essential);
  // Texto monoespaçado: alinhar pela posição do cabeçalho.
  if (centers && tokens.length < cols.length && tokens.length) {
    const used = new Set(), mapped = [];
    for (const tok of tokens) {
      let best = -1, dist = Infinity;
      centers.forEach((c, i) => { const d = Math.abs(c - tok.center); if (d < dist) { dist = d; best = i; } });
      if (best < 0 || used.has(best) || dist > 8) return null;
      used.add(best); mapped.push([tok, cols[best]]);
    }
    return assign(mapped.map(x => x[0]), mapped.map(x => x[1]));
  }
  return null;
}

// Faixas plausíveis (unidades tradicionais). Fora delas, um inteiro de OCR pode ter perdido a vírgula.
const PLAUSIBLE = {fev1: [.2, 9], fvc: [.2, 10], tlc: [1, 14], rv: [.2, 9], frc: [.4, 11], erv: [.02, 5], ic: [.2, 7], vc: [.3, 10], dlco: [.3, 70], va: [.4, 13], kco: [.3, 15]};
function restoreDecimals(key, values) {
  const range = PLAUSIBLE[key], decs = values.decs;
  if (!range || !decs) return [];
  const seen = Object.values(decs).filter(d => d > 0), fixed = [];
  const mode = seen.length ? seen.sort((a, b) => seen.filter(x => x === b).length - seen.filter(x => x === a).length)[0] : (key === 'dlco' ? 1 : 2);
  for (const c of Object.keys(values)) {
    const v = values[c];
    if (decs[c] !== 0 || (v >= range[0] && v <= range[1])) continue;
    const tries = [mode, mode === 2 ? 1 : 2];
    if (!['dlco', 'kco'].includes(key) && v >= 1000) tries.unshift(3); // provável mL sem unidade
    for (const d of tries) { const x = v / 10 ** d; if (x >= range[0] && x <= range[1]) { values[c] = Math.round(x * 1000) / 1000; fixed.push(c); break; } }
  }
  return fixed;
}

// Coerência mínima da linha: protege contra números colados pelo OCR ("1,42 2,72" → "142272").
const LOWER_IS_ABNORMAL = new Set(['fev1', 'fvc', 'ratio', 'vc', 'ic', 'erv', 'dlco', 'va', 'kco', 'gaw', 'sgaw']);
function coherent(key, v) {
  const range = PLAUSIBLE[key];
  if (range) for (const c of Object.keys(v)) if (v[c] < range[0] || v[c] > range[1]) return false;
  if (key === 'ratio') for (const c of Object.keys(v)) if (v[c] < 15 || v[c] > 130) return false;
  const pred = v.pred;
  if (pred > 0) {
    if (v.lln != null && LOWER_IS_ABNORMAL.has(key) && !(v.lln < pred)) return false;
    if (v.lln != null && v.uln != null && !(v.lln < v.uln)) return false;
    if (v.uln != null && !(v.uln > pred) && key !== 'x5') return false;
    for (const c of ['pre', 'meas', 'post']) if (v[c] != null && range && (v[c] / pred < .05 || v[c] / pred > 6)) return false;
  }
  return true;
}

// ---------- dados do paciente ----------
const num = s => Number(String(s).replace(',', '.'));
function readDemographics(text) {
  const t = softNorm(text), d = {}, found = [];
  let m;
  if ((m = t.match(/\b(?:sexo|sex|genero|gender)\s*[:=\-]?\s*(masculino|feminino|masc|fem|male|female|homem|mulher|m|f)\b/))) {
    d.sex = /^(m|masc|masculino|male|homem)$/.test(m[1]) ? 'M' : 'F'; found.push('sexo');
  }
  if ((m = t.match(/\b(?:idade|age)\s*[:=\-]?\s*(\d{1,3})(?:[.,]\d+)?\s*(?:anos|a|y|yrs|years)?\b/)) || (m = t.match(/\b(\d{1,3})\s*anos\b/))) {
    const a = Number(m[1]); if (a > 0 && a < 120) { d.age = a; found.push('idade'); }
  }
  if ((m = t.match(/\b(?:altura|estatura|height|alt)\s*[:=\-]?\s*(\d+(?:[.,]\d+)?)\s*(cm|m)?\b/))) {
    let h = num(m[1]); if (h < 3) h *= 100; if (h >= 50 && h <= 250) { d.height = Math.round(h * 10) / 10; found.push('estatura'); }
  }
  if ((m = t.match(/\b(?:peso|weight)\s*[:=\-]?\s*(\d+(?:[.,]\d+)?)\s*(?:kg)?\b/))) {
    const w = num(m[1]); if (w >= 2 && w <= 400) { d.weight = w; found.push('peso'); }
  }
  if ((m = t.match(/\b(?:hb|hgb|hemoglobina|hemoglobin)\s*(?:\(g\/dl\))?\s*[:=\-]?\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:g\/dl)?/))) {
    const hb = num(m[1]); if (hb >= 3 && hb <= 25) { d.hemoglobin = hb; found.push('Hb'); }
  }
  // Data do exame e nascimento (para calcular idade, se ausente).
  const date = (re) => { const x = t.match(re); if (!x) return null; let [, dd, mm, yy] = x; yy = yy.length === 2 ? (Number(yy) > 30 ? '19' : '20') + yy : yy; const iso = `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`; return Number.isNaN(Date.parse(iso)) ? null : iso; };
  const exam = date(/\b(?:data(?:\s+do\s+exame)?|date|realizado em|data de realizacao|test date)\s*[:=\-]?\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
  const birth = date(/\b(?:nascimento|nasc|data de nascimento|dn|dob|birth(?:\s*date)?|d\.n\.)\s*[:=\-]?\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
  if (exam) { d.date = exam; found.push('data'); }
  if (d.age == null && birth) {
    const ref = exam ? new Date(exam) : new Date(), b = new Date(birth);
    let a = ref.getUTCFullYear() - b.getUTCFullYear();
    if (ref.getUTCMonth() < b.getUTCMonth() || (ref.getUTCMonth() === b.getUTCMonth() && ref.getUTCDate() < b.getUTCDate())) a--;
    if (a > 0 && a < 120) { d.age = a; found.push('idade (pelo nascimento)'); }
  }
  if ((m = String(text).match(/(?:^|\n)[ \t]*(?:nome|paciente|patient|name)[ \t]*[:=][ \t]*([^\n\t]+?)(?=[ ]{2,}|\t|\r?\n|[ ]+(?:sexo|idade|data|altura|peso|registro|prontuario|rg|id|dn|nasc)\b|$)/i))) {
    const name = m[1].trim(); if (name.length >= 2 && name.length <= 80 && !/\d{3,}/.test(name)) d.patient = name;
  }
  return {demographics: d, found};
}

function readSettings(text) {
  const t = softNorm(text), s = {};
  if (/pletismogra|plethysmogra|body\s*box|cabine/.test(t)) s.volumeMethod = 'pleth';
  else if (/dilui[cç]ao|helio|helium|washout|lavagem|nitrogen|n2 mbw/.test(t)) s.volumeMethod = 'gas';
  if (/mmol\/(?:min\/)?kpa/.test(t)) s.dlcoUnit = 'si';
  else if (/ml\/min\/mmhg/.test(t)) s.dlcoUnit = 'traditional';
  if (/dlcoc|dlco\s*(?:cor|corr|corrigid|adj)|corrigid[ao]\s+(?:para|pela)\s+(?:hb|hemoglobina)/.test(t)) s.hbCorrected = true;
  return s;
}

// ---------- função principal ----------
export function parseExam(text, {manualColumns = null} = {}) {
  const out = {spirometry: {}, volumes: {}, diffusion: {}, resistance: {}, demographics: {}, settings: {}, skipped: [], found: [], inferred: []};
  const lines = String(text || '').split(/\r?\n/);
  let header = manualColumns ? {delimited: false, cols: manualColumns.map(c => c === 'pre' ? 'pre' : c), centers: null} : null;
  let lastHeaderLine = -9, pendingGroup = null, dlcoc = null;
  lines.forEach((raw, idx) => {
    if (!raw.trim()) return;
    const soft = softNorm(raw).trim();
    if (!manualColumns) {
      const h = readHeader(raw);
      if (h) {
        if (h.groupOnly && !h.cols.includes('meas')) {
          // pode ser só um grupo ("Pré  Pós"); vira cabeçalho se nenhuma linha "Medido" vier logo depois
          pendingGroup = h; header = h; lastHeaderLine = idx; return;
        }
        header = pendingGroup && idx - lastHeaderLine <= 2 && h.cols.filter(c => c === 'meas').length >= 2 ? mergeHeaders(pendingGroup, h) : h;
        pendingGroup = null; lastHeaderLine = idx; return;
      }
    }
    const lab = labelNorm(raw);
    const row = ROWS.find(([, , re]) => re.test(lab));
    if (!row || row[0] === 'skip') return;
    const [group, key, re] = row;
    if (!header) { out.skipped.push(raw.trim()); return; }
    // localizar o fim do rótulo na linha original normalizada (sem alterar comprimento)
    const labelText = lab.match(re)[0];
    const labelEnd = findLabelEnd(softNorm(raw), labelText);
    let values = alignRow(raw, labelEnd, header);
    if (!values || !Object.keys(values).length) { out.skipped.push(raw.trim()); return; }
    if (key === 'ratio' || key === 'rvtlc') for (const c of Object.keys(values)) if (values[c] > 0 && values[c] <= 1) values[c] = Math.round(values[c] * 10000) / 100;
    if (group === 'spiro' && key !== 'ratio' && (/(?:^|[\s(\[])ml(?:$|[\s)\]])/.test(soft.slice(0, labelEnd + 8)) || header.unitMl)) for (const c of Object.keys(values)) values[c] = Math.round(values[c]) / 1000;
    const restored = restoreDecimals(key === 'dlcoc' ? 'dlco' : key, values);
    if (!coherent(key === 'dlcoc' ? 'dlco' : key, values)) { out.skipped.push(raw.trim()); return; }
    if (restored.length) out.inferred.push(key);
    const measured = values.pre ?? values.meas;
    if (group === 'spiro') {
      if (out.spirometry[key]) return;
      const r = {};
      if (measured != null) r.pre = measured;
      for (const c of ['post', 'pred', 'lln']) if (values[c] != null) r[c] = values[c];
      if (Object.keys(r).length) out.spirometry[key] = r;
      return;
    }
    const r = {};
    if (measured != null) r.measured = measured;
    for (const c of ['pred', 'lln', 'uln']) if (values[c] != null) r[c] = values[c];
    if (r.measured == null) { out.skipped.push(raw.trim()); return; }
    if (key === 'dlcoc') { dlcoc = dlcoc || r; return; }
    if (!out[group][key]) out[group][key] = r;
  });
  if (dlcoc && !out.diffusion.dlco) { out.diffusion.dlco = dlcoc; out.settings.hbCorrected = true; }
  const demo = readDemographics(text);
  out.demographics = demo.demographics; out.found = demo.found;
  Object.assign(out.settings, readSettings(text));
  if (Object.keys(out.resistance).some(k => ['r5', 'r20', 'r5r20', 'x5', 'ax', 'fres'].includes(k))) out.settings.resistanceMethod = 'osc';
  else if (Object.keys(out.resistance).length) out.settings.resistanceMethod = 'pleth';
  out.counts = {
    spirometry: Object.values(out.spirometry).reduce((n, r) => n + Object.keys(r).length, 0),
    volumes: Object.keys(out.volumes).length, diffusion: Object.keys(out.diffusion).length, resistance: Object.keys(out.resistance).length,
  };
  return out;
}

function findLabelEnd(soft, labelText) {
  // Avança pela linha consumindo os caracteres do rótulo normalizado (ignorando espaços extras).
  let i = soft.match(JUNK_PREFIX)[0].length, j = 0;
  const target = labelText.replace(/\s+/g, '');
  while (i < soft.length && j < target.length) {
    const ch = soft[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === target[j]) { i++; j++; continue; }
    break;
  }
  return i;
}
