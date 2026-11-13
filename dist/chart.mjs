/**
 * Expiria | Gráfico de resultados: cada parâmetro em % do previsto,
 * com a faixa LIN–LSN e marcadores pré (círculo) e pós-BD (losango).
 * Não é curva fluxo-volume: curvas exigem o sinal bruto do equipamento.
 */
const PRE = '#00897b', POST = '#c2410c', INK = '#073c46', MUTED = '#617d84', GRID = '#e3eeee', BAND = '#d7f1ec', SURFACE = '#ffffff';
const fin = x => typeof x === 'number' && Number.isFinite(x);
const pct = (v, pred) => fin(v) && fin(pred) && pred > 0 ? 100 * v / pred : null;
const br = (n, k = 0) => n.toFixed(k).replace('.', ',');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

/** Monta as linhas a partir da espirometria e do resultado de analyzeFull. */
export function chartRows(spiro = {}, full = null, names = {}) {
  const groups = [];
  const s = [];
  const add = (list, label, unit, pre, post, pred, lln, uln) => {
    const p = pct(pre, pred);
    if (p === null) return;
    list.push({label, unit, pre, post, pred, lln, uln, prePct: p, postPct: pct(post, pred), llnPct: pct(lln, pred), ulnPct: pct(uln, pred)});
  };
  const f1 = spiro.fev1 || {}, fv = spiro.fvc || {}, r = spiro.ratio || {};
  add(s, 'VEF1', 'L', f1.pre, f1.post, f1.pred, f1.lln, null);
  add(s, 'CVF', 'L', fv.pre, fv.post, fv.pred, fv.lln, null);
  const ratioPre = fin(f1.pre) && fin(fv.pre) && fv.pre > 0 ? 100 * f1.pre / fv.pre : r.pre;
  const ratioPost = fin(f1.post) && fin(fv.post) && fv.post > 0 ? 100 * f1.post / fv.post : r.post;
  add(s, 'VEF1/CVF', '%', ratioPre, ratioPost, r.pred, r.lln, null);
  if (s.length) groups.push(['Espirometria', s]);
  if (full) {
    for (const [title, rows] of [['Volumes pulmonares', full.volumes], ['Difusão', full.diffusion], ['Resistência', full.resistance]]) {
      const list = [];
      for (const row of rows || []) {
        if (row.key === 'x5' || !fin(row.measured)) continue; // X5 é negativo: % do previsto não tem sentido
        const [label, unit] = names[row.key] || [row.key, ''];
        add(list, label, unit, row.measured, null, row.pred, row.lln, row.uln);
      }
      if (list.length) groups.push([title, list]);
    }
  }
  return groups;
}

export function chartSVG(groups, {width = 760} = {}) {
  const rows = groups.reduce((n, [, l]) => n + l.length, 0);
  if (!rows) return '';
  const W = Math.round(Math.max(320, Math.min(760, width))), narrow = W < 560, L = narrow ? 70 : 112, R = narrow ? 92 : 150, top = narrow ? 58 : 44, rowH = 30, headH = 26;
  const H = top + groups.length * headH + rows * rowH + 34;
  const values = groups.flatMap(([, l]) => l.flatMap(x => [x.prePct, x.postPct, x.ulnPct].filter(fin)));
  const max = Math.min(250, Math.max(160, Math.ceil(Math.max(...values) / 50) * 50));
  const x = v => L + (Math.max(0, Math.min(max, v)) / max) * (W - L - R);
  const out = [];
  out.push(`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Resultados em porcentagem do previsto, com faixa de normalidade" xmlns="http://www.w3.org/2000/svg" style="font-family:'DM Sans',system-ui,sans-serif;max-width:${W}px">`);
  // legenda
  const lx = narrow ? 0 : L, ly2 = narrow ? 38 : 16, lx3 = narrow ? 0 : L + 210;
  out.push(`<g font-size="11" fill="${INK}"><circle cx="${lx + 6}" cy="16" r="5" fill="${PRE}"/><text x="${lx + 16}" y="20">Pré-BD / medido</text>`,
    `<path d="M${lx + 136} 10 l6 6 -6 6 -6 -6z" fill="${POST}"/><text x="${lx + 148}" y="20">Pós-BD</text>`,
    `<rect x="${lx3}" y="${ly2 - 6}" width="22" height="12" rx="3" fill="${BAND}"/><text x="${lx3 + 28}" y="${ly2 + 4}">Faixa normal (LIN–LSN)</text></g>`);
  // grade
  const plotTop = top - 6, plotBottom = H - 30;
  for (let t = 0; t <= max; t += narrow && max > 160 ? 100 : 50) {
    out.push(`<line x1="${x(t)}" x2="${x(t)}" y1="${plotTop}" y2="${plotBottom}" stroke="${t === 100 ? '#b9d3d4' : GRID}" stroke-width="1"/>`,
      `<text x="${x(t)}" y="${H - 14}" font-size="10" fill="${MUTED}" text-anchor="middle">${t}%</text>`);
  }
  let y = top;
  for (const [title, list] of groups) {
    out.push(`<text x="0" y="${y + 16}" font-size="10" font-weight="700" letter-spacing="1.2" fill="${MUTED}">${esc(title.toUpperCase())}</text>`);
    y += headH;
    for (const r of list) {
      const cy = y + rowH / 2;
      out.push(`<text x="0" y="${cy + 4}" font-size="12" font-weight="600" fill="${INK}">${esc(r.label)}</text>`);
      const lo = fin(r.llnPct) ? r.llnPct : (fin(r.ulnPct) ? 0 : null), hi = fin(r.ulnPct) ? r.ulnPct : (fin(r.llnPct) ? max : null);
      if (lo !== null && hi !== null) out.push(`<rect x="${x(lo)}" y="${cy - 7}" width="${Math.max(2, x(hi) - x(lo))}" height="14" rx="4" fill="${BAND}"/>`);
      const tip = (kind, v, p) => `${r.label} ${kind}: ${br(v, r.unit === '%' ? 0 : 2)} ${r.unit} · ${br(p)}% do previsto` + (fin(r.llnPct) ? ` · LIN ${br(r.llnPct)}%` : '') + (fin(r.ulnPct) ? ` · LSN ${br(r.ulnPct)}%` : '');
      if (fin(r.postPct)) {
        out.push(`<line x1="${x(r.prePct)}" x2="${x(r.postPct)}" y1="${cy}" y2="${cy}" stroke="${MUTED}" stroke-width="2" stroke-linecap="round" opacity=".45"/>`);
        out.push(`<path d="M${x(r.postPct)} ${cy - 7} l7 7 -7 7 -7 -7z" fill="${POST}" stroke="${SURFACE}" stroke-width="2"><title>${esc(tip('pós-BD', r.post, r.postPct))}</title></path>`);
      }
      out.push(`<circle cx="${x(r.prePct)}" cy="${cy}" r="6" fill="${PRE}" stroke="${SURFACE}" stroke-width="2"><title>${esc(tip(fin(r.postPct) ? 'pré-BD' : 'medido', r.pre, r.prePct))}</title></circle>`);
      const flag = fin(r.llnPct) && r.prePct < r.llnPct ? ' ↓ LIN' : fin(r.ulnPct) && r.prePct > r.ulnPct ? ' ↑ LSN' : '';
      const over = r.prePct > max || (fin(r.postPct) && r.postPct > max) ? ' ›' : '';
      const label = `${br(r.prePct)}%` + (fin(r.postPct) ? `→${br(r.postPct)}%` : '') + over;
      out.push(`<text x="${W - R + 10}" y="${cy + 4}" font-size="12" fill="${INK}">${esc(label)}<tspan fill="${MUTED}" font-size="10">${esc(narrow ? flag.replace(/ (LIN|LSN)/, '') : flag)}</tspan></text>`);
      y += rowH;
    }
  }
  out.push('</svg>');
  return out.join('');
}
