import { describe, expect, it } from 'vitest';
import {
  bestMove, grundy, grundyTable, isP, markG2, markP, mimarkP, misereTable, moves, options, recursionAB, sumValue,
  upGrundyTable, upmarkP, upmarkPAsPrinted,
} from '../src/mark.ts';

const N = 1 << 14;

describe('moves', () => {
  it('Mark-t subtracts 1..t−1 or divides by t; UpMark rounds the half up and stops at 1', () => {
    expect(options('mark', 2, 28)).toEqual([14, 27]);
    expect(options('mark', 3, 10)).toEqual([3, 8, 9]);
    expect(options('mark', 2, 1)).toEqual([0]);
    expect(options('mark', 2, 0)).toEqual([]);
    expect(options('upmark', 2, 9)).toEqual([5, 8]);
    expect(options('upmark', 2, 2)).toEqual([1]);
    expect(options('upmark', 2, 1)).toEqual([]);
    expect(moves('mark', 3, 2).map((m) => m.to)).toEqual([1, 0, 0]);
  });
});

describe('the paper\'s tables', () => {
  it('§2 and §3: a_n, b_n and g(0..23) of Mark', () => {
    const { A, B } = recursionAB('mark', 2, 24);
    expect(A).toEqual([0, 1, 3, 4, 5, 7, 9, 11, 12, 13, 15, 16, 17, 19, 20, 21, 23, 25, 27, 28, 29, 31, 33, 35]);
    expect(B).toEqual([0, 2, 6, 8, 10, 14, 18, 22, 24, 26, 30, 32, 34, 38, 40, 42, 46, 50, 54, 56, 58, 62, 66, 70]);
    expect([...grundyTable(2, 24)].join('')).toBe('010212010201210212012102');
  });
  it('§4, §5, §6: MiMark, UpMark and Mark-4 sequences', () => {
    expect(recursionAB('mimark', 2, 8).B).toEqual([1, 4, 6, 10, 14, 16, 18, 22]);
    expect(recursionAB('upmark', 2, 8).B).toEqual([1, 3, 7, 9, 11, 15, 19, 23]);
    expect(recursionAB('mark', 4, 8).B).toEqual([0, 4, 8, 12, 20, 24, 28, 36]);
  });
});

describe('closed forms against the mex tables', () => {
  it('Theorem 2 / §6: Mark-t P-positions are the base-t dopey numbers (t = 2..6)', () => {
    for (let t = 2; t <= 6; t++) {
      const g = grundyTable(t, N);
      for (let n = 0; n < N; n++) expect(g[n] === 0).toBe(markP(n, t));
    }
  });
  it('Theorem 4 (iii) + Note 3: g(n) of Mark from vile/dopey and odious/evil', () => {
    const g = grundyTable(2, N);
    for (let n = 0; n < N; n++) expect(markG2(n)).toBe(g[n]);
  });
  it('Theorem 6, and its extension to every t: misère P-positions swap the powers of t', () => {
    for (let t = 2; t <= 6; t++) {
      const P = misereTable(t, N);
      for (let n = 0; n < N; n++) expect(P[n] === 1).toBe(mimarkP(n, t));
    }
    expect([...Array(20).keys()].filter((n) => mimarkP(n, 2))).toEqual([1, 4, 6, 10, 14, 16, 18]);
  });
  it('Theorem 8: UpMark P-positions — the proof\'s form holds, the printed form misses n ≡ 3 (mod 4)', () => {
    const g = upGrundyTable(N);
    let missed = 0;
    for (let n = 1; n < N; n++) {
      expect(g[n] === 0).toBe(upmarkP(n));
      if ((g[n] === 0) !== upmarkPAsPrinted(n)) {
        missed++;
        expect(g[n]).toBe(0);
        expect(n % 4).toBe(3);
      }
    }
    expect(missed).toBeGreaterThan(1000);
    expect(upmarkPAsPrinted(19)).toBe(false); // 10011
    expect(upmarkP(19)).toBe(true);
  });
});

describe('play', () => {
  it('Epilogue: 1000 is lost for the first player, 2000 is won', () => {
    expect(isP('mark', 2, 1000)).toBe(true);
    expect(isP('mark', 2, 2000)).toBe(false);
    expect(bestMove('mark', 2, [15])).toEqual({ i: 0, to: 14 });
    expect(bestMove('mark', 2, [2000])).toEqual({ i: 0, to: 1000 });
  });
  it('every winning move found for sums brings the XOR to 0, and none exists from XOR 0', () => {
    for (const t of [2, 3, 5]) {
      for (let a = 1; a < 60; a++) for (let b = 1; b < 60; b += 7) {
        const s = sumValue('mark', t, [a, b]);
        const mv = bestMove('mark', t, [a, b]);
        if (s === 0) expect(mv).toBeNull();
        else {
          const p = [a, b];
          p[mv!.i] = mv!.to;
          expect(sumValue('mark', t, p)).toBe(0);
        }
      }
    }
  });
  it('winning moves are unique in a single Mark-t game', () => {
    for (const t of [2, 3, 4]) {
      for (let n = 1; n < 4000; n++) {
        if (markP(n, t)) continue;
        expect(options('mark', t, n).filter((o) => markP(o, t)).length).toBe(1);
      }
    }
  });
  it('grundy() uses the closed form for t = 2 and a table for t ≥ 3 and UpMark', () => {
    expect(grundy('mark', 2, 123456789)).toBe(markG2(123456789));
    expect(grundy('mark', 3, 4)).toBe(3);
    expect(grundy('upmark', 2, 1)).toBe(0);
    expect(() => grundy('mark', 3, 1 << 21)).toThrow(RangeError);
  });
});
