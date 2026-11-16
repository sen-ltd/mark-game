// Mark and its relatives (Fraenkel, "Aperiodic subtraction games", EJC 18(2) 2011 #P19).
//
//   Mark-t   from n: subtract 1, 2, …, t−1, or move to ⌊n/t⌋.   Mark = Mark-2.
//   MiMark-t the same moves in misère play (the last mover loses).
//   UpMark   from n: subtract 1, or move to ⌈n/2⌉; 1 is the end position.
//
// Everything here is plain integer arithmetic on numbers < 2^31, no dependencies.

export type Rule = 'mark' | 'mimark' | 'upmark';

/** Distinct options of n (ascending). */
export function options(rule: Rule, t: number, n: number): number[] {
  const s = new Set<number>();
  if (rule === 'upmark') {
    if (n >= 2) {
      s.add(n - 1);
      s.add(Math.ceil(n / 2));
    }
  } else if (n > 0) {
    for (let i = 1; i < t && n - i >= 0; i++) s.add(n - i);
    s.add(Math.floor(n / t));
  }
  return [...s].sort((a, b) => a - b);
}

/** Labelled moves (for the UI): "−i" or "÷t" / "⌈÷2⌉", with their target. */
export function moves(rule: Rule, t: number, n: number): { label: string; to: number }[] {
  const out: { label: string; to: number }[] = [];
  if (rule === 'upmark') {
    if (n >= 2) out.push({ label: '−1', to: n - 1 }, { label: '⌈÷2⌉', to: Math.ceil(n / 2) });
    return out;
  }
  if (n === 0) return out;
  for (let i = 1; i < t && n - i >= 0; i++) out.push({ label: `−${i}`, to: n - i });
  out.push({ label: `÷${t}`, to: Math.floor(n / t) });
  return out;
}

export function mex(vals: Iterable<number>): number {
  let bits = 0;
  for (const v of vals) if (v < 31) bits |= 1 << v;
  let m = 0;
  while (bits & (1 << m)) m++;
  return m;
}

/**
 * Sprague–Grundy values of Mark-t for 0 ≤ n < N by the mex recursion (normal play).
 * Uint8Array: g ≤ t because every position has at most t options.
 */
export function grundyTable(t: number, N: number): Uint8Array {
  const g = new Uint8Array(N);
  for (let n = 1; n < N; n++) {
    let bits = 1 << g[Math.floor(n / t)];
    for (let i = 1; i < t && n - i >= 0; i++) bits |= 1 << g[n - i];
    let m = 0;
    while (bits & (1 << m)) m++;
    g[n] = m;
  }
  return g;
}

/** UpMark Grundy values for 0 ≤ n < N (n = 0 is not a position; it is left at 0, n = 1 is the end). */
export function upGrundyTable(N: number): Uint8Array {
  const g = new Uint8Array(N);
  for (let n = 2; n < N; n++) {
    const bits = (1 << g[n - 1]) | (1 << g[Math.ceil(n / 2)]);
    let m = 0;
    while (bits & (1 << m)) m++;
    g[n] = m;
  }
  return g;
}

/** Misère outcome of Mark-t for 0 ≤ n < N: 1 = P-position (the previous player wins). */
export function misereTable(t: number, N: number): Uint8Array {
  const P = new Uint8Array(N); // n = 0: no move, the player to move wins in misère → N
  for (let n = 1; n < N; n++) {
    let allN = P[Math.floor(n / t)] === 0;
    for (let i = 1; allN && i < t && n - i >= 0; i++) if (P[n - i] === 1) allN = false;
    P[n] = allN ? 1 : 0;
  }
  return P;
}

// ------------------------------------------------------------------ numeration

/** Number of trailing zeros of n > 0 in base t. */
export function tz(n: number, t = 2): number {
  let c = 0;
  while (n % t === 0) {
    n /= t;
    c++;
  }
  return c;
}

/** Vile: base-t representation ends in an even number of 0s.  Dopey: odd. (n > 0) */
export const isVile = (n: number, t = 2) => n > 0 && tz(n, t) % 2 === 0;
export const isDopey = (n: number, t = 2) => n > 0 && tz(n, t) % 2 === 1;

export function popcount(n: number): number {
  let c = 0;
  while (n) {
    c += n & 1;
    n = Math.floor(n / 2);
  }
  return c;
}
/** Evil: even number of 1s in binary.  Odious: odd. */
export const isOdious = (n: number) => popcount(n) % 2 === 1;
export const isEvil = (n: number) => popcount(n) % 2 === 0;

export function isPowerOf(n: number, t: number): boolean {
  if (n < 1) return false;
  while (n % t === 0) n /= t;
  return n === 1;
}

export const toBase = (n: number, t: number) => n.toString(t);

// ------------------------------------------------------------------ closed forms

/** Theorem 2 (and §6 for t > 2): Mark-t P-positions are 0 and the base-t dopey numbers. */
export const markP = (n: number, t = 2) => n === 0 || isDopey(n, t);

/**
 * Theorem 6 for t = 2: MiMark P-positions are the dopey numbers with the powers of 2 swapped
 * (even powers in, odd powers out). The same rule for every t ≥ 2 is this repository's
 * computational observation (checked for t = 2..8 by tools/verify.mts).
 */
export function mimarkP(n: number, t = 2): boolean {
  if (n === 0) return false;
  if (isPowerOf(n, t)) return tz(n, t) % 2 === 0;
  return tz(n, t) % 2 === 1;
}

/**
 * UpMark P-positions, Theorem 8 in the form its proof uses: n = 1, or the binary
 * representation ends in 1 0^{2k} 1 (k ≥ 1), or in 1^k (k ≥ 2) — i.e. n ≡ 3 (mod 4).
 */
export function upmarkP(n: number): boolean {
  if (n === 1) return true;
  if (n % 4 === 3) return true;
  if (n % 2 === 0 || n < 5) return false;
  const z = tz(n - 1, 2) - 1; // R(n) = … 1 0^z 1
  return z >= 2 && z % 2 === 0;
}

/** Theorem 8 exactly as printed: "… or in 1 0 1^k, k > 1". Misses every n ≡ 3 (mod 4) without that 0. */
export function upmarkPAsPrinted(n: number): boolean {
  if (n === 1) return true;
  const s = n.toString(2);
  return /1(00)+1$/.test(s) || /101{2,}$/.test(s);
}

/**
 * Theorem 4 (iii) + Note 3: the Grundy value of Mark (t = 2) is 0 on 0 and the dopey numbers,
 * 1 on vile odious numbers and 2 on vile evil numbers.
 */
export function markG2(n: number): number {
  if (n === 0 || isDopey(n, 2)) return 0;
  return isOdious(n) ? 1 : 2;
}

// ------------------------------------------------------------------ cached tables for the UI

const cache = new Map<string, Uint8Array>();
export const TABLE_N = 1 << 20;

function table(key: string, make: () => Uint8Array): Uint8Array {
  let v = cache.get(key);
  if (!v) {
    v = make();
    cache.set(key, v);
  }
  return v;
}

/** Grundy value of n in normal play (Mark-t or UpMark). Mark uses the closed form; others the table. */
export function grundy(rule: Exclude<Rule, 'mimark'>, t: number, n: number): number {
  if (rule === 'upmark') {
    if (n < TABLE_N) return table('up', () => upGrundyTable(TABLE_N))[n];
    throw new RangeError(`n must be < ${TABLE_N}`);
  }
  if (t === 2) return markG2(n);
  if (n < TABLE_N) return table(`g${t}`, () => grundyTable(t, TABLE_N))[n];
  throw new RangeError(`n must be < ${TABLE_N}`);
}

/** Is n a P-position of a single game under the rule? (closed forms, any n < 2^53) */
export function isP(rule: Rule, t: number, n: number): boolean {
  if (rule === 'mark') return markP(n, t);
  if (rule === 'mimark') return mimarkP(n, t);
  return upmarkP(n);
}

export const isTerminal = (rule: Rule, n: number) => (rule === 'upmark' ? n <= 1 : n === 0);

/** XOR of Grundy values of a sum (normal play only). */
export function sumValue(rule: Exclude<Rule, 'mimark'>, t: number, piles: number[]): number {
  return piles.reduce((x, n) => x ^ grundy(rule, t, n), 0);
}

/**
 * A winning move in the position: for normal play, any move bringing the XOR to 0;
 * for misère (single pile only), a move to a misère P-position. null when none exists.
 */
export function bestMove(rule: Rule, t: number, piles: number[]): { i: number; to: number } | null {
  if (rule === 'mimark') {
    if (piles.length !== 1) throw new Error('misère sums are not solved here');
    for (const to of options(rule, t, piles[0])) if (mimarkP(to, t)) return { i: 0, to };
    return null;
  }
  const total = sumValue(rule, t, piles);
  if (total === 0) return null;
  for (let i = 0; i < piles.length; i++) {
    const gi = grundy(rule, t, piles[i]);
    for (const to of options(rule, t, piles[i])) if (grundy(rule, t, to) === (total ^ gi)) return { i, to };
  }
  return null; // unreachable by the Sprague–Grundy theorem
}

/** The first terms of the sequences A (N-positions) and B (P-positions) built by the paper's recursions. */
export function recursionAB(kind: 'mark' | 'mimark' | 'upmark', t: number, count: number) {
  // a_n = mex{a_i, b_i : i < n}, with b_n = t·a_n (Mark-t), b_0 = 1, b_n = 2a_n (MiMark),
  // b_0 = 1, b_n = 2a_n − 1 (UpMark).
  const A: number[] = [], B: number[] = [];
  const used = new Set<number>();
  let m = 0;
  for (let n = 0; n < count; n++) {
    while (used.has(m)) m++;
    const a = m;
    A.push(a);
    used.add(a);
    let b: number;
    if (kind === 'mark') b = t * a;
    else if (kind === 'mimark') b = n === 0 ? 1 : 2 * a;
    else b = n === 0 ? 1 : 2 * a - 1;
    B.push(b);
    used.add(b);
  }
  return { A, B };
}
