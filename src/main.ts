import './style.css';
import {
  bestMove, grundy, isOdious, isP, isPowerOf, isTerminal, misereTable, moves, popcount, sumValue, toBase, tz,
  upGrundyTable, grundyTable, type Rule,
} from './mark.ts';
import verifyRun from '../runs/verify.json';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fmt = (x: number) => x.toLocaleString('en');
const MAX_N = 1_000_000;

// categorical colours for g = 1..6 (validated for the dark surface); g = 0 is black (P-position)
const GCOL = ['#000000', '#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c'];

// ------------------------------------------------------------------ state
let rule: Rule = 'mark';
let t = 2;
let piles: number[] = [1000, 2000];
let history: number[][] = [];
let lastCpu: { i: number; to: number } | null = null;
let shown: { i: number; to: number } | null = null;

const ruleSel = $<HTMLSelectElement>('rule');
const tSel = $<HTMLSelectElement>('tSel');
const kSel = $<HTMLSelectElement>('kSel');
const hints = $<HTMLInputElement>('hints');
const cpu = $<HTMLInputElement>('cpu');
const custom = $<HTMLInputElement>('custom');
const pilesEl = $('piles');
const statusEl = $('status');

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const normal = () => rule !== 'mimark';
const nr = () => rule as Exclude<Rule, 'mimark'>;
const over = () => piles.every((n) => isTerminal(rule, n));
/** "won" for the player to move */
const winning = () => (normal() ? sumValue(nr(), t, piles) !== 0 : !isP(rule, t, piles[0]));

function randomPosition() {
  const k = rule === 'mimark' ? 1 : Number(kSel.value);
  for (let tries = 0; tries < 200; tries++) {
    piles = Array.from({ length: k }, () => rnd(rule === 'upmark' ? 2 : 1, rnd(0, 1) ? 200 : 5000));
    if (winning()) break; // the player starts from a won position
  }
  reset();
}

function reset() {
  history = [];
  lastCpu = null;
  shown = null;
  render();
}

function play(i: number, to: number) {
  history.push([...piles]);
  piles = piles.map((n, j) => (j === i ? to : n));
  lastCpu = null;
  shown = null;
  if (cpu.checked && !over()) {
    let mv = bestMove(rule, t, piles);
    if (!mv) {
      // lost position: make the move that keeps the game longest (largest remaining total)
      let best: { i: number; to: number } | null = null;
      piles.forEach((n, j) => moves(rule, t, n).forEach((m) => { if (!best || m.to > best.to) best = { i: j, to: m.to }; }));
      mv = best;
    }
    if (mv) {
      piles = piles.map((n, j) => (j === mv!.i ? mv!.to : n));
      lastCpu = mv;
    }
  }
  render();
}

// ------------------------------------------------------------------ render: play
function digits(n: number) {
  if (rule === 'upmark') {
    const s = n.toString(2);
    return `<span class="dg">${s}</span>`;
  }
  if (n === 0) return '<span class="dg">0</span>';
  const s = toBase(n, t);
  const z = tz(n, t);
  return `<span class="dg">${s.slice(0, s.length - z)}<b class="${z % 2 ? 'tz-odd' : 'tz-even'}">${s.slice(s.length - z)}</b></span>`;
}

function classify(n: number): string {
  if (rule === 'upmark') {
    if (n === 1) return 'end position';
    if (n % 2 === 0) return 'even → N';
    if (n % 4 === 3) return 'ends in 11 → P';
    const z = tz(n - 1, 2) - 1;
    return `ends in 1 0<sup>${z}</sup> 1, ${z % 2 ? 'odd' : 'even'} → ${z % 2 ? 'N' : 'P'}`;
  }
  if (n === 0) return 'zero';
  const z = tz(n, t);
  let s = `${z} trailing 0${z === 1 ? '' : 's'} in base ${t} → <b>${z % 2 ? 'dopey' : 'vile'}</b>`;
  if (t === 2 && z % 2 === 0) s += `, ${popcount(n)} ones → <b>${isOdious(n) ? 'odious' : 'evil'}</b>`;
  if (rule === 'mimark' && isPowerOf(n, t)) s += ` · power of ${t}: misère swaps it`;
  return s;
}

function render() {
  tSel.disabled = rule === 'upmark';
  kSel.disabled = rule === 'mimark';
  const total = normal() ? sumValue(nr(), t, piles) : 0;
  pilesEl.innerHTML = '';
  piles.forEach((n, i) => {
    const card = document.createElement('div');
    card.className = 'pile';
    if (lastCpu && lastCpu.i === i) card.classList.add('cpu');
    const g = normal() ? grundy(nr(), t, n) : null;
    const p = isP(rule, t, n);
    card.innerHTML = `
      <div class="phead"><span class="nums">${fmt(n)}</span>${digits(n)}
        <span class="g">${g === null ? (p ? 'P' : 'N') : `g = ${g}`}</span>
        ${isTerminal(rule, n) ? '<span class="dim">no moves</span>' : ''}</div>
      <div class="small dim">${classify(n)}</div>`;
    const mv = document.createElement('div');
    mv.className = 'moves';
    for (const m of moves(rule, t, n)) {
      const btn = document.createElement('button');
      btn.className = 'mv';
      btn.innerHTML = `${m.label}<small>${fmt(m.to)}</small>`;
      if (hints.checked) {
        const good = normal() ? (total ^ (g as number) ^ grundy(nr(), t, m.to)) === 0 : isP(rule, t, m.to);
        btn.classList.add(good ? 'win' : 'lose');
      }
      if (shown && shown.i === i && shown.to === m.to) btn.classList.add('shown');
      btn.addEventListener('click', () => play(i, m.to));
      mv.appendChild(btn);
    }
    card.appendChild(mv);
    if (lastCpu && lastCpu.i === i) {
      const d = document.createElement('div');
      d.className = 'small dim';
      d.textContent = `computer moved here → ${fmt(lastCpu.to)}`;
      card.appendChild(d);
    }
    pilesEl.appendChild(card);
  });

  if (over()) {
    const youLast = lastCpu === null && history.length > 0;
    const youWin = rule === 'mimark' ? !youLast : youLast;
    statusEl.innerHTML = history.length === 0 ? 'No moves here — start a new position.'
      : !cpu.checked ? '<b>Game over.</b>'
      : youWin ? `<b class="win-t">You win${rule === 'mimark' ? ' — the computer had to make the last move' : ''}.</b>`
      : `<b class="lose-t">The computer wins.</b>`;
  } else if (normal()) {
    statusEl.innerHTML = total === 0
      ? `XOR of Grundy values = <b>0</b>: <span class="lose-t">P-position</span> — every move hands the opponent a win.`
      : `XOR of Grundy values = <b>${total}</b>: <span class="win-t">winning</span> — a green move brings the XOR back to 0.`;
  } else {
    statusEl.innerHTML = isP(rule, t, piles[0])
      ? `<span class="lose-t">misère P-position</span>: whatever you do, the opponent can force you to make the last move.`
      : `<span class="win-t">misère N-position</span>: move to the green option and the opponent is the one who ends the game.`;
  }
  renderWhy();
  drawWord();
}

function renderWhy() {
  const why = $('why');
  if (rule === 'upmark') {
    why.innerHTML = `<p class="small">UpMark (Theorem 8): even numbers are N-positions (subtract 1 or halve to reach an odd P). The P-positions are 1,
      the numbers ending in <span class="zk">11</span> (n ≡ 3 mod 4) and those ending in <span class="zk">1 0<sup>2k</sup> 1</span>, k ≥ 1.
      <b>The theorem as printed says "1 0 1<sup>k</sup>"</b>, which drops 3, 7, 15, 19, 31, 35, … — half of all P-positions.
      The proof works with "1<sup>k</sup>", which is right.</p>` + xorTable();
    return;
  }
  if (rule === 'mimark') {
    why.innerHTML = `<p class="small">Misère: the player who moves to 0 loses. Fraenkel's Theorem 6 (t = 2): P-positions are the dopey numbers
      except that the powers of 2 swap sides — 1, 4, 16, 64, … become P, and 2, 8, 32, … become N. This page uses the same swap
      for every t (powers of t), which <b>tools/verify.mts</b> confirms for t = 2..8 up to 4 million positions; the paper lists misère Mark-t as open.</p>`;
    return;
  }
  why.innerHTML = `<p class="small">Mark-${t}: the P-positions are the numbers whose base-${t} representation ends in an <b>odd</b> number of 0s.
    From one (trailing zeros <span class="tz-odd">odd</span>) subtracting 1…${t - 1} leaves no trailing zero and dividing by ${t} removes one: both reach
    an <span class="tz-even">even</span> count. From any other number exactly one move restores an odd count.
    ${t === 2 ? 'For t = 2 the Grundy value of a vile number is 1 if it has an odd number of 1s (odious) and 2 if even (evil) — Theorem 4.' :
      `For t ≥ 3 the Grundy values (0…${t}) are taken from a mex table; their structure is an open problem in the paper.`}</p>` + xorTable();
}

function xorTable() {
  if (!normal()) return '';
  let total = 0;
  const w = Math.max(...piles.map((n) => grundy(nr(), t, n).toString(2).length), 2);
  const rows = piles.map((n) => {
    const g = grundy(nr(), t, n);
    total ^= g;
    return `<tr><td class="num">${fmt(n)}</td><td class="num">${g}</td><td class="num zk">${g.toString(2).padStart(w, '0')}</td></tr>`;
  });
  return `<table class="why"><tr><th>n</th><th>g</th><th>binary</th></tr>${rows.join('')}
    <tr class="sum"><td>XOR</td><td class="num">${total}</td><td class="num zk">${total.toString(2).padStart(w, '0')}</td></tr></table>`;
}

// ------------------------------------------------------------------ the word W
const word = $<HTMLCanvasElement>('word');
const COLS = 64, ROWS = 20;
let cell = 0, ox = 0, oy = 0;
const misCache = new Map<number, Uint8Array>();
const gTab = new Map<string, Uint8Array>();

function val(n: number): number {
  if (rule === 'mimark') {
    let m = misCache.get(t);
    if (!m) { m = misereTable(t, COLS * ROWS + 1); misCache.set(t, m); }
    return m[n] ? 0 : -1; // -1 = N in misère (no Grundy value shown)
  }
  if (rule === 'upmark' && n === 0) return -2;
  return grundy(nr(), t, n);
}

function drawWord() {
  $('wordSub').textContent = rule === 'mimark' ? `— misère Mark-${t}: P / N only` : rule === 'upmark' ? '— UpMark' : `— Mark-${t}`;
  const ctx = word.getContext('2d')!;
  ctx.fillStyle = '#1d1f23';
  ctx.fillRect(0, 0, word.width, word.height);
  ox = 44; oy = 4;
  cell = Math.min((word.width - ox - 4) / COLS, (word.height - oy - 4) / ROWS);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const n = r * COLS + c;
    const v = val(n);
    ctx.fillStyle = v === -2 ? '#1d1f23' : v === -1 ? '#4a4d55' : GCOL[v];
    ctx.fillRect(ox + c * cell + 1, oy + r * cell + 1, cell - 2, cell - 2);
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  for (const n of piles) if (n < COLS * ROWS) ctx.strokeRect(ox + (n % COLS) * cell, oy + Math.floor(n / COLS) * cell, cell, cell);
  ctx.fillStyle = '#9c9fa6';
  ctx.font = '11px ui-monospace, monospace';
  ctx.textAlign = 'right';
  for (let r = 0; r < ROWS; r += 2) ctx.fillText(String(r * COLS), ox - 6, oy + (r + 0.75) * cell);
  ctx.textAlign = 'left';
  const maxG = rule === 'mimark' ? -1 : rule === 'upmark' ? 2 : t;
  $('legend').innerHTML = rule === 'mimark'
    ? `<i style="background:#000"></i>P <i style="background:#4a4d55"></i>N`
    : Array.from({ length: maxG + 1 }, (_, g) => `<i style="background:${GCOL[g]}"></i>g = ${g}${g === 0 ? ' (P)' : ''}`).join(' ');
}

function cellAt(e: MouseEvent): number | null {
  const r = word.getBoundingClientRect();
  const sx = ((e.clientX - r.left) * word.width) / r.width, sy = ((e.clientY - r.top) * word.height) / r.height;
  const c = Math.floor((sx - ox) / cell), row = Math.floor((sy - oy) / cell);
  if (c < 0 || c >= COLS || row < 0 || row >= ROWS) return null;
  return row * COLS + c;
}
word.addEventListener('mousemove', (e) => {
  const n = cellAt(e);
  if (n === null || (rule === 'upmark' && n === 0)) { $('hover').textContent = ''; return; }
  const v = val(n);
  const b = rule === 'upmark' ? n.toString(2) : toBase(n, t);
  $('hover').textContent = `n = ${n}  (${b} in base ${rule === 'upmark' ? 2 : t})  ${v < 0 ? 'N' : v === 0 ? 'P, g = 0' : `N, g = ${v}`}`;
});
word.addEventListener('mouseleave', () => { $('hover').textContent = ''; });
word.addEventListener('click', (e) => {
  const n = cellAt(e);
  if (n === null || isTerminal(rule, n) || (rule === 'upmark' && n === 0)) return;
  kSel.value = '1';
  piles = [n];
  reset();
});

// ------------------------------------------------------------------ the period chart
function drawPeriod() {
  const cv = $<HTMLCanvasElement>('period');
  const ctx = cv.getContext('2d')!;
  const tt = rule === 'upmark' ? 2 : t;
  const M = 1 << 16, R = 256;
  const tab = rule === 'upmark' ? (gTab.get('up') ?? gTab.set('up', upGrundyTable(M + R + 1)).get('up')!)
    : (gTab.get(`g${tt}`) ?? gTab.set(`g${tt}`, grundyTable(tt, M + R + 1)).get(`g${tt}`)!);
  const dis: number[] = [];
  for (let r = 1; r <= R; r++) {
    let d = 0;
    for (let n = 1; n <= M; n++) if ((tab[n] === 0) !== (tab[n + r] === 0)) d++;
    dis.push(d / M);
  }
  ctx.fillStyle = '#1d1f23';
  ctx.fillRect(0, 0, cv.width, cv.height);
  const L = 54, B = cv.height - 22, T = 8, Wd = cv.width - L - 8;
  const lo = Math.log10(1e-4), hi = Math.log10(1);
  const y = (p: number) => B - ((Math.log10(Math.max(p, 1e-4)) - lo) / (hi - lo)) * (B - T);
  ctx.strokeStyle = '#34373e';
  ctx.fillStyle = '#9c9fa6';
  ctx.font = '11px ui-monospace, monospace';
  ctx.textAlign = 'right';
  for (const p of [1, 0.1, 0.01, 0.001, 0.0001]) {
    ctx.beginPath(); ctx.moveTo(L, y(p)); ctx.lineTo(L + Wd, y(p)); ctx.stroke();
    ctx.fillText(`${p * 100}%`, L - 6, y(p) + 4);
  }
  const bw = Wd / R;
  ctx.fillStyle = '#3987e5';
  dis.forEach((p, i) => {
    const h = B - y(p);
    ctx.beginPath();
    ctx.roundRect(L + i * bw + 0.5, B - h, Math.max(1, bw - 1), h, [Math.min(2, bw / 2), Math.min(2, bw / 2), 0, 0]);
    ctx.fill();
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9c9fa6';
  for (let r = 0; r <= R; r += 32) ctx.fillText(String(r), L + (r - 0.5) * bw, B + 15);
  ctx.textAlign = 'left';
  let best = 0;
  dis.forEach((p, i) => { if (p < dis[best]) best = i; });
  $('periodNote').textContent = `Share of n ≤ ${fmt(M)} with P(n) ≠ P(n + r), for each shift r = 1…${R} (${rule === 'upmark' ? 'UpMark' : `Mark-${tt}`}, log scale). ` +
    `The best candidate period is r = ${best + 1}${isPowerOf(best + 1, tt) ? ` = a power of ${tt}` : ''}, still wrong at ${(dis[best] * 100).toFixed(3)} % of positions — and Theorem 9 shows every r fails eventually.`;
  cv.onmousemove = (e) => {
    const rc = cv.getBoundingClientRect();
    const sx = ((e.clientX - rc.left) * cv.width) / rc.width;
    const r = Math.floor((sx - L) / bw) + 1;
    cv.title = r >= 1 && r <= R ? `r = ${r}: P(n) ≠ P(n + r) for ${(dis[r - 1] * 100).toFixed(3)} % of n` : '';
  };
}

// ------------------------------------------------------------------ paper check
function renderChecks() {
  const run = verifyRun as { N: number; NT: number; seconds: number; claims: { id: string; source: string; claim: string; ok: boolean; result: string }[]; notes: { id: string; title: string; result: string }[] };
  const ok = run.claims.filter((c) => c.ok).length;
  $('checkHead').textContent = `— ${ok}/${run.claims.length} hold, n < ${fmt(run.N)} (t = 2), < ${fmt(run.NT)} (t = 3..8), ${run.seconds.toFixed(0)} s`;
  $('checks').innerHTML = run.claims.map((c) => `
    <div class="chk-row"><b class="${c.ok ? 'ok' : 'ng'}">${c.ok ? '✓' : '✗'}</b> <span class="dim">${c.source}</span><br>
    ${c.claim}<br><span class="small dim">${c.result}</span></div>`).join('');
  $('notes').innerHTML = run.notes.map((n) => `<div class="chk-row"><b>${n.title}</b><br><span class="small dim zk">${n.result}</span></div>`).join('');
}

// ------------------------------------------------------------------ wiring
ruleSel.addEventListener('change', () => { rule = ruleSel.value as Rule; if (rule === 'upmark') t = 2; tSel.value = String(t); randomPosition(); drawPeriod(); });
tSel.addEventListener('change', () => { t = Number(tSel.value); randomPosition(); drawPeriod(); });
kSel.addEventListener('change', randomPosition);
$('random').addEventListener('click', randomPosition);
hints.addEventListener('change', render);
custom.addEventListener('change', () => {
  const v = custom.value.replace(/[,_\s]/g, '');
  const n = Number(v);
  if (!/^\d+$/.test(v) || n > MAX_N || isTerminal(rule, n) || (rule === 'upmark' && n < 1)) { custom.classList.add('bad'); return; }
  custom.classList.remove('bad');
  kSel.value = '1';
  piles = [n];
  reset();
});
$('undo').addEventListener('click', () => {
  const prev = history.pop();
  if (prev) { piles = prev; lastCpu = null; shown = null; render(); }
});
$('best').addEventListener('click', () => {
  if (over()) return;
  shown = bestMove(rule, t, piles);
  if (!shown) statusEl.innerHTML += ' <span class="dim">(no winning move exists here)</span>';
  else render();
});

renderChecks();
render();
drawPeriod();
