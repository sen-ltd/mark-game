// Recompute every checkable statement of Fraenkel, "Aperiodic subtraction games"
// (Electron. J. Combin. 18(2) (2011) #P19) by exhaustive mex tables, plus this
// repository's own observations. Writes runs/verify.json (read by the demo page).
//
//   node tools/verify.mts            # N = 2^24 for t = 2, 2^22 for t = 3..8
//   VERIFY_LOG2=18 node tools/verify.mts   # quick run

import { writeFileSync, mkdirSync } from 'node:fs';
import {
  grundyTable, upGrundyTable, misereTable, tz, isOdious, isEvil, isVile, isDopey, isPowerOf,
  markP, mimarkP, upmarkP, upmarkPAsPrinted, markG2, popcount,
} from '../src/mark.ts';

const LOG2 = Number(process.env.VERIFY_LOG2 ?? 24);
const N = 2 ** LOG2;
const NT = 2 ** Math.min(LOG2, 22); // for t = 3..8
const TS = [2, 3, 4, 5, 6, 7, 8];
const t0 = performance.now();
const sec = () => ((performance.now() - t0) / 1000).toFixed(1);
const log = (s: string) => console.log(`[${sec()}s] ${s}`);
const fmt = (x: number) => x.toLocaleString('en');

type Claim = { id: string; source: string; claim: string; ok: boolean; result: string };
const claims: Claim[] = [];
const notes: { id: string; title: string; result: string }[] = [];
function claim(id: string, source: string, text: string, bad: number, result: string) {
  const ok = bad === 0;
  claims.push({ id, source, claim: text, ok, result });
  log(`${ok ? 'OK ' : 'NG '} ${id}: ${result}`);
}
const spite = (n: number) => (isOdious(n) ? 'odious' : 'evil');

// ------------------------------------------------------------------ the paper's recursions, array-based
/** Membership of B (P-positions per the recursion) for 0 ≤ n < M. kind as in the paper. */
function recursionB(kind: 'mark' | 'mimark' | 'upmark', t: number, M: number) {
  const used = new Uint8Array(M); // 1 = in A, 2 = in B
  const A: number[] = [], B: number[] = [];
  let m = 0;
  let dup = 0;
  for (let n = 0; ; n++) {
    while (m < M && used[m]) m++;
    if (m >= M) break;
    const a = m;
    used[a] = 1;
    A.push(a);
    const b = kind === 'mark' ? t * a : n === 0 ? 1 : kind === 'mimark' ? 2 * a : 2 * a - 1;
    if (b < M) {
      if (used[b] && !(kind === 'mark' && n === 0)) dup++; // complementarity violation
      used[b] = 2;
    }
    B.push(b);
  }
  if (kind === 'mark') used[0] = 2; // a_0 = b_0 = 0: the paper's P-position 0
  return { used, A, B, dup };
}

// ------------------------------------------------------------------ Mark (t = 2)
const g2 = grundyTable(2, N);
log(`Mark Grundy table built (${fmt(N)} positions)`);

// §2 table
{
  const { A, B } = recursionB('mark', 2, 200);
  const pa = [0, 1, 3, 4, 5, 7, 9, 11, 12, 13, 15, 16, 17, 19, 20, 21, 23, 25, 27, 28, 29, 31, 33, 35];
  const pb = [0, 2, 6, 8, 10, 14, 18, 22, 24, 26, 30, 32, 34, 38, 40, 42, 46, 50, 54, 56, 58, 62, 66, 70];
  let bad = 0;
  pa.forEach((v, i) => { if (A[i] !== v) bad++; });
  pb.forEach((v, i) => { if (B[i] !== v) bad++; });
  claim('tab-AB', '§2 table', 'The printed a_n, b_n (n = 0..23) are what recursions (1), (2) produce: a_n = mex{a_i, b_i : i < n}, b_n = 2a_n.', bad, `${48 - bad}/48 printed entries match`);
}
const rec2 = recursionB('mark', 2, N);
claim('prop1', 'Proposition 1', 'A and B are complementary: every n ≥ 1 is in exactly one of them.', rec2.dup,
  `${fmt(rec2.A.length)} terms of A and ${fmt(rec2.B.filter((b) => b < N).length)} of B below ${fmt(N)}; ${rec2.dup} collisions`);
{
  let bad = 0;
  for (let n = 0; n < N; n++) if ((g2[n] === 0) !== (rec2.used[n] === 2)) bad++;
  claim('thm1', 'Theorem 1', 'For Mark, P = B and N = A.', bad, `${bad} exceptions in 0 ≤ n < ${fmt(N)}`);
}
{
  let bad = 0, P = 0;
  for (let n = 1; n < N; n++) { if (g2[n] === 0) P++; if ((g2[n] === 0) !== isDopey(n)) bad++; }
  claim('thm2', 'Theorem 2', 'P-positions are exactly the dopey numbers (binary ends in an odd number of 0s), N-positions the vile ones.', bad,
    `${bad} exceptions in 1 ≤ n < ${fmt(N)}; ${fmt(P)} P-positions = ${(100 * P / (N - 1)).toFixed(3)} % (→ 1/3)`);
}
{
  let bad = 0;
  for (const S of [rec2.A, rec2.B]) {
    const s = S.filter((x) => x >= 1 && x < N);
    for (let k = 0; k < s.length; k++) if (spite(s[k]) !== (k % 2 === 0 ? 'odious' : 'evil')) bad++;
  }
  claim('thm3', 'Theorem 3', 'The elements of A alternate in spite (a₁ odious, a₂ evil, …); the same holds for B.', bad,
    `${bad} exceptions over all a_n, b_n < ${fmt(N)}`);
}
{
  const printed = [0, 1, 0, 2, 1, 2, 0, 1, 0, 2, 0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 0, 2];
  let bad = 0;
  printed.forEach((v, i) => { if (g2[i] !== v) bad++; });
  let max = 0;
  for (let n = 0; n < N; n++) if (g2[n] > max) max = g2[n];
  claim('tab-g', '§3 table', 'The printed g(0..23) and W is a ternary word (g ≤ 2).', bad + (max > 2 ? 1 : 0), `${24 - bad}/24 printed values match; max g = ${max}`);
}
// Theorem 4
{
  // (i) 0s dopey and alternate in spite
  let bad = 0, prev = '';
  const zeros: number[] = [];
  for (let n = 1; n < N; n++) if (g2[n] === 0) {
    zeros.push(n);
    if (!isDopey(n)) bad++;
    const s = spite(n);
    if (prev && s === prev) bad++;
    prev = s;
  }
  claim('thm4-i', 'Theorem 4 (i)', 'The 0s of W are dopey and alternate in spite.', bad, `${bad} exceptions among ${fmt(zeros.length)} zeros`);
  // (ii)
  let bad2 = 0;
  for (const n of zeros) {
    if (n + 1 >= N) continue;
    const [before, after] = isOdious(n) ? [1, 2] : [2, 1];
    if (g2[n - 1] !== before || g2[n + 1] !== after) bad2++;
  }
  claim('thm4-ii', 'Theorem 4 (ii)', 'Every odious 0 is preceded by 1 and followed by 2; every evil 0 is preceded by 2 and followed by 1.', bad2, `${bad2} exceptions`);
  // (iii)
  let bad3 = 0;
  for (let n = 1; n < N; n++) {
    if (g2[n] === 1 && !(isOdious(n) && isVile(n))) bad3++;
    if (g2[n] === 2 && !(isEvil(n) && isVile(n))) bad3++;
  }
  claim('thm4-iii', 'Theorem 4 (iii)', 'All 1s of W are odious, all 2s evil, and both are vile.', bad3, `${bad3} exceptions in 1 ≤ n < ${fmt(N)}`);
  // Note 3 (the converse, which makes g closed-form)
  let bad3b = 0;
  for (let n = 0; n < N; n++) if (g2[n] !== markG2(n)) bad3b++;
  claim('note3', 'Note 3 / Note 4', 'Conversely every vile odious number has g = 1 and every vile evil number g = 2, so g is computed from the binary representation alone.', bad3b, `${bad3b} exceptions in 0 ≤ n < ${fmt(N)}`);
  // (iv) chains between consecutive zeros
  const seen = new Map<string, number>();
  let bad4 = 0;
  for (let k = 1; k < zeros.length; k++) {
    const a = zeros[k - 1], b = zeros[k];
    let w = '';
    for (let n = a; n <= b; n++) w += g2[n];
    seen.set(w, (seen.get(w) ?? 0) + 1);
    const allowed = isEvil(a) ? ['010', '01210'] : ['020', '02120'];
    if (!allowed.includes(w)) bad4++;
  }
  claim('thm4-iv', 'Theorem 4 (iv)', 'Between consecutive 0s only 010, 01210 (leading 0 evil) and 020, 02120 (leading 0 odious) occur.', bad4,
    `${bad4} exceptions; counts ${[...seen].map(([w, c]) => `${w} ×${fmt(c)}`).join(', ')}`);
  // (v) where 01210/02120 and 010/020 begin
  let bad5 = 0, tested = 0;
  for (let k = 1; ; k++) {
    const n = (2 ** k - 1) * 2; // R(n) = 1^k 0
    if (n + 4 >= N) break;
    tested++;
    let w = '';
    for (let m = n; m <= n + 4; m++) w += g2[m];
    const long = k % 2 === 1;
    if (long ? !(w === '01210' || w === '02120') : !(w.slice(0, 3) === '010' || w.slice(0, 3) === '020')) bad5++;
  }
  // the second part of (v): each subword appears in both halves of the range (≈ "infinitely often")
  const half = (lo: number, hi: number) => {
    const s = new Set<string>();
    for (let k = 1; k < zeros.length; k++) if (zeros[k - 1] >= lo && zeros[k] < hi) {
      let w = '';
      for (let n = zeros[k - 1]; n <= zeros[k]; n++) w += g2[n];
      s.add(w);
    }
    return s.size;
  };
  const h1 = half(0, N / 2), h2 = half(N / 2, N);
  claim('thm4-v', 'Theorem 4 (v)', 'At R(n) = 1^{2t−1}0 a subword 01210 or 02120 begins, at R(n) = 1^{2t}0 a subword 010 or 020; all four subwords appear infinitely often.',
    bad5 + (h1 < 4 ? 1 : 0) + (h2 < 4 ? 1 : 0), `${bad5} exceptions over ${tested} values of n; all four chains appear in [0, N/2) (${h1}) and in [N/2, N) (${h2})`);
}
{
  const e = [1000, 2000, 15, 14].map((n) => g2[n] === 0);
  const bad = (e[0] ? 0 : 1) + (e[1] ? 1 : 0) + (e[2] ? 1 : 0) + (e[3] ? 0 : 1);
  claim('epilogue', '§7 Epilogue', 'From 1000 the second player (Peter) wins, from 2000 the first (Nathan); 15 is an N-position and 15 → 14 wins.', bad,
    `1000 = ${(1000).toString(2)}: ${e[0] ? 'P' : 'N'}; 2000 = ${(2000).toString(2)}: ${e[1] ? 'P' : 'N'}; 15: ${e[2] ? 'P' : 'N'}; 14: ${e[3] ? 'P' : 'N'}`);
}

// ------------------------------------------------------------------ MiMark (t = 2)
const mis2 = misereTable(2, N);
log('MiMark table built');
{
  const { A, B } = recursionB('mimark', 2, 200);
  const pa = [0, 2, 3, 5, 7, 8, 9, 11, 12, 13, 15, 17, 19, 20, 21, 23, 25, 27, 28, 29, 31, 32, 33, 35];
  const pb = [1, 4, 6, 10, 14, 16, 18, 22, 24, 26, 30, 34, 38, 40, 42, 46, 50, 54, 56, 58, 62, 64, 66, 70];
  let bad = 0;
  pa.forEach((v, i) => { if (A[i] !== v) bad++; });
  pb.forEach((v, i) => { if (B[i] !== v) bad++; });
  claim('tab-mis', '§4 table', 'The printed MiMark a_n, b_n (n = 0..23) are what recursion (1), (3) produces (b₀ = 1, b_n = 2a_n).', bad, `${48 - bad}/48 printed entries match`);
  const r = recursionB('mimark', 2, N);
  let bad5 = r.dup;
  for (let n = 0; n < N; n++) if ((mis2[n] === 1) !== (r.used[n] === 2)) bad5++;
  claim('thm5', 'Theorem 5', 'For MiMark (misère Mark), P = B and N = A with B from (3).', bad5, `${bad5} exceptions in 0 ≤ n < ${fmt(N)}`);
  let bad6 = 0;
  for (let n = 0; n < N; n++) if ((mis2[n] === 1) !== mimarkP(n, 2)) bad6++;
  let diff = 0;
  for (let n = 1; n < N; n++) if ((mis2[n] === 1) !== (g2[n] === 0)) diff++;
  claim('thm6', 'Theorem 6', 'MiMark P-positions are the dopey numbers with the powers of 2 swapped: 2^{2k} in, 2^{2k+1} out.', bad6,
    `${bad6} exceptions; misère and normal play differ at only ${diff} positions below ${fmt(N)} (the powers of 2)`);
}

// ------------------------------------------------------------------ UpMark
const up = upGrundyTable(N);
log('UpMark table built');
{
  const { A, B } = recursionB('upmark', 2, 200);
  const pa = [0, 2, 4, 5, 6, 8, 10, 12, 13, 14, 16, 17, 18, 20, 21, 22, 24, 26, 28, 29, 30, 32, 34, 36];
  const pb = [1, 3, 7, 9, 11, 15, 19, 23, 25, 27, 31, 33, 35, 39, 41, 43, 47, 51, 55, 57, 59, 63, 67, 71];
  let bad = 0;
  pa.forEach((v, i) => { if (A[i] !== v) bad++; });
  pb.forEach((v, i) => { if (B[i] !== v) bad++; });
  claim('tab-up', '§5 table', 'The printed UpMark a_n, b_n (n = 0..23) are what recursion (1), (4) produces (b₀ = 1, b_n = 2a_n − 1).', bad, `${48 - bad}/48 printed entries match`);
  const r = recursionB('upmark', 2, N);
  let bad7 = r.dup;
  for (let n = 1; n < N; n++) if ((up[n] === 0) !== (r.used[n] === 2)) bad7++;
  claim('thm7', 'Theorem 7', 'For UpMark, P = B and N = A with B from (4).', bad7, `${bad7} exceptions in 1 ≤ n < ${fmt(N)}`);

  let badAsPrinted = 0, badProof = 0, missed = 0, Pc = 0;
  const ex: number[] = [];
  for (let n = 1; n < N; n++) {
    const P = up[n] === 0;
    if (P) Pc++;
    if (P !== upmarkPAsPrinted(n)) { badAsPrinted++; if (P) missed++; if (ex.length < 6) ex.push(n); }
    if (P !== upmarkP(n)) badProof++;
  }
  claim('thm8-printed', 'Theorem 8 (as printed)', 'B consists of 1 and the numbers whose binary representation ends in 1 0^{2k} 1 (k ≥ 1) or in 1 0 1^k (k > 1).', badAsPrinted,
    `${fmt(badAsPrinted)} exceptions, all P-positions it misses (${fmt(missed)} of ${fmt(Pc)}): ${ex.map((n) => `${n} = ${n.toString(2)}`).join(', ')}, … — every n ≡ 3 (mod 4) whose final run of 1s is not preceded by "10"`);
  claim('thm8-proof', 'Theorem 8 (proof\'s B′)', 'B consists of 1 and the numbers ending in 1 0^{2k} 1 (k ≥ 1) or in 1^k (k > 1) — the set B′ the proof actually works with.', badProof,
    `${badProof} exceptions in 1 ≤ n < ${fmt(N)}: the theorem's "10 1^k" should read "1^k" (equivalently n ≡ 3 mod 4)`);
  let badA = 0;
  for (let n = 2; n < N; n++) {
    const inA = n % 2 === 0 || (n % 4 === 1 && (tz(n - 1, 2) - 1) % 2 === 1); // R(n) = … 1 0^{odd} 1
    if (inA !== (up[n] !== 0)) badA++;
  }
  claim('thm8-A', 'Theorem 8 (A)', 'A consists of the even numbers and the numbers ending in 1 0^{2k−1} 1.', badA, `${badA} exceptions in 2 ≤ n < ${fmt(N)}`);
  const Bs = r.B.filter((b) => b >= 3 && b < N); // b_1, b_2, …
  let badS = 0;
  Bs.forEach((b, i) => { if (spite(b) !== (i % 2 === 0 ? 'evil' : 'odious')) badS++; });
  claim('thm8-spite', 'Theorem 8 (spite)', 'The members of B alternate in spite: b_{2n} odious, b_{2n−1} evil.', badS, `${badS} exceptions over ${fmt(Bs.length)} terms`);
  // Corollary 1
  let badC = 0, cnt = 0;
  for (let t = 1; 2 * t + 3 < N; t++) {
    const a = 2 * t - 1, b = 2 * t + 1;
    const same = spite(a) === spite(b);
    const c = tz(a + 1, 2); // length of the final run of 1s of R(2t−1)
    const endsPat2 = c >= 2 && c % 2 === 0; // R(2t−1) ends in 0 1^{2k} (a leading 0 is implicit)
    if (same !== endsPat2) badC++;
    if (endsPat2 && up[2 * t + 3] !== 0) badC++;
    if (up[a] === 0) { cnt++; if ((up[b] === 0) !== !same) badC++; }
  }
  claim('cor1', 'Corollary 1', '(i) If 2t−1 ∈ P then 2t+1 ∈ P iff their spites differ; (ii) the spites agree iff R(2t−1) ends in 0 1^{2k}, and then 2t+3 ∈ P.', badC,
    `${badC} exceptions over all odd pairs below ${fmt(N)} (${fmt(cnt)} with 2t−1 ∈ P)`);
}

// ------------------------------------------------------------------ Mark-t (t ≥ 2)
const gt = new Map<number, Uint8Array>();
gt.set(2, g2);
for (const t of TS) if (t > 2) gt.set(t, grundyTable(t, NT));
log('Mark-t tables built');
{
  let bad = 0;
  const parts: string[] = [];
  for (const t of TS) {
    const g = gt.get(t)!;
    const M = g.length;
    const r = recursionB('mark', t, M);
    let b1 = r.dup, b2 = 0;
    for (let n = 0; n < M; n++) {
      if ((g[n] === 0) !== (r.used[n] === 2)) b1++;
      if ((g[n] === 0) !== markP(n, t)) b2++;
    }
    bad += b1 + b2;
    parts.push(`t=${t}: ${b1}/${b2}`);
  }
  claim('mark-t', '§6', 'For Mark-t (subtract 1..t−1 or go to ⌊n/t⌋), P = B with b_n = t·a_n, and P = the dopey numbers in base t.', bad,
    `exceptions (recursion / base-t dopey) ${parts.join(', ')}; N = ${fmt(N)} for t = 2, ${fmt(NT)} for t ≥ 3`);
  const { A, B } = recursionB('mark', 4, 200);
  const pa = [0, 1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 29];
  const pb = [0, 4, 8, 12, 20, 24, 28, 36, 40, 44, 52, 56, 60, 64, 68, 72, 76, 84, 88, 92, 100, 104, 108, 116];
  let bt = 0;
  pa.forEach((v, i) => { if (A[i] !== v) bt++; });
  pb.forEach((v, i) => { if (B[i] !== v) bt++; });
  claim('tab-t4', '§6 table', 'The printed Mark-4 a_n, b_n (n = 0..23).', bt, `${48 - bt}/48 printed entries match`);
}
{
  // Theorem 9: no eventual period. Exhaustively: for each r ≤ R there is a violation P(n) ≠ P(n+r) with n ≥ n0 = M/4.
  let bad = 0;
  const parts: string[] = [];
  for (const t of TS) {
    const g = gt.get(t)!;
    const M = g.length, n0 = M >> 2, R = 1 << 12;
    let worst = 0;
    for (let r = 1; r <= R; r++) {
      let n = n0;
      while (n + r < M && (g[n] === 0) === (g[n + r] === 0)) n++;
      if (n + r >= M) bad++;
      else worst = Math.max(worst, n - n0);
    }
    parts.push(`t=${t}: worst first break ${worst} after n0`);
  }
  claim('thm9', 'Theorem 9', 'Mark-t is aperiodic (finite check: no period r ≤ 4,096 holds on [M/4, M)).', bad, parts.join('; '));
}

// ------------------------------------------------------------------ own observations
{
  let bad = 0;
  const parts: string[] = [];
  for (const t of TS) {
    const M = t === 2 ? N : NT;
    const P = t === 2 ? mis2 : misereTable(t, M);
    let b = 0, diff = 0;
    for (let n = 0; n < M; n++) {
      if ((P[n] === 1) !== mimarkP(n, t)) b++;
      if (n > 0 && (P[n] === 1) !== markP(n, t)) diff++;
    }
    bad += b;
    parts.push(`t=${t}: ${b} (differs from normal play at ${diff})`);
  }
  claim('own-mis-t', 'this repo (extends Thm 6)', 'Misère Mark-t for every t = 2..8: P = base-t dopey numbers with the powers of t swapped (t^{2k} in, t^{2k+1} out). §7 lists misère Mark-t as open.', bad,
    `exceptions ${parts.join(', ')}`);
}
{
  // own: how many winning moves does an N-position have? (normal play, every t; misère t = 2)
  let bad = 0;
  const parts: string[] = [];
  for (const t of TS) {
    const g = gt.get(t)!;
    const M = g.length;
    let Npos = 0, multi = 0;
    for (let n = 1; n < M; n++) {
      if (g[n] === 0) continue;
      Npos++;
      const opts = new Set<number>([Math.floor(n / t)]);
      for (let i = 1; i < t && n - i >= 0; i++) opts.add(n - i);
      let w = 0;
      for (const o of opts) if (g[o] === 0) w++;
      if (w !== 1) multi++;
    }
    bad += multi;
    parts.push(`t=${t}: ${fmt(Npos - multi)}/${fmt(Npos)}`);
  }
  claim('own-unique', 'this repo', 'In Mark-t (t = 2..8) every N-position has exactly one winning move: never both a subtraction and the division reach a P-position.', bad,
    `N-positions with exactly one winning move: ${parts.join(', ')}`);
}
{
  let bad = 0;
  const parts: string[] = [];
  for (const t of TS) {
    const g = gt.get(t)!;
    // density on [1, t^k) for the largest t^k ≤ M: exact count of dopey numbers vs (t^k − 1)/(t+1)
    let k = 0;
    while (t ** (k + 1) <= g.length) k++;
    const M = t ** k;
    let P = 0, maxg = 0;
    const hist = new Array(t + 2).fill(0);
    for (let n = 1; n < M; n++) { if (g[n] === 0) P++; if (g[n] > maxg) maxg = g[n]; hist[g[n]]++; }
    // exact count of dopey numbers in [1, t^k): Σ_{j odd < k} (t−1)·t^{k−1−j}
    let exact = 0;
    for (let j = 1; j < k; j += 2) exact += (t - 1) * t ** (k - 1 - j);
    if (P !== exact) bad++;
    if (maxg !== t || hist.slice(0, t + 1).some((h) => h === 0)) bad++;
    parts.push(`t=${t}: ${(P / (M - 1) * 100).toFixed(2)} % (1/(t+1) = ${(100 / (t + 1)).toFixed(2)} %), g ∈ 0..${maxg}`);
  }
  claim('own-density', 'this repo', 'Mark-t: the P-density is exactly Σ_{j odd} (t−1)/t^{j+1} → 1/(t+1), and the Grundy values fill 0..t (each with frequency ≈ 1/(t+1)).', bad, parts.join('; '));
}
{
  // Grundy structure for t ≥ 3: Mark (t = 2) is determined by vile + parity of the binary digit sum.
  // Is Mark-t determined by (base-t digit sum mod m) for vile n, m = 2..2t+2? Report.
  const parts: string[] = [];
  for (const t of [3, 4, 5]) {
    const g = gt.get(t)!;
    let found = 0;
    for (let m = 2; m <= 2 * t + 2; m++) {
      const map = new Map<number, number>();
      let okm = true;
      for (let n = 1; n < 1 << 16 && okm; n++) {
        if (g[n] === 0) continue;
        let s = 0, x = n;
        while (x) { s += x % t; x = Math.floor(x / t); }
        const key = s % m;
        if (map.has(key) && map.get(key) !== g[n]) okm = false;
        map.set(key, g[n]);
      }
      if (okm) found = m;
    }
    parts.push(`t=${t}: ${found ? `determined by digit sum mod ${found}` : 'not a function of the digit sum mod m for any m ≤ 2t+2'}`);
  }
  notes.push({ id: 'g-t', title: 'Grundy values of Mark-t, t ≥ 3 (open in §7)', result: `For t = 2 the value of a vile n is its binary spite. ${parts.join('; ')}. The g-function of Mark-t stays the paper's open problem.` });
}
{
  const parts: string[] = [];
  for (const t of [2, 3, 4]) {
    const g = gt.get(t)!;
    let s = '';
    for (let n = 0; n < 40; n++) s += g[n];
    parts.push(`t=${t}: ${s}`);
  }
  notes.push({ id: 'words', title: 'The words W for t = 2, 3, 4 (n = 0..39)', result: parts.join(' · ') });
  void popcount; void isPowerOf;
}

const out = {
  N, NT, seconds: (performance.now() - t0) / 1000,
  paper: 'A. S. Fraenkel, Aperiodic subtraction games, Electron. J. Combin. 18(2) (2011) #P19',
  claims, notes,
};
mkdirSync(new URL('../runs/', import.meta.url), { recursive: true });
writeFileSync(new URL('../runs/verify.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
const ok = claims.filter((c) => c.ok).length;
log(`${ok}/${claims.length} claims hold; wrote runs/verify.json`);
for (const n of notes) log(`note ${n.id}: ${n.result}`);
process.exit(0);
