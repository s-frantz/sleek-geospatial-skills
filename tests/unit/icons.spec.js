/**
 * Rung 2: glyph geometry, as numbers read out of the markup.
 *
 * `npm run icons` measures how glyphs RENDER. These are the claims a glyph's drawing makes
 * before anything renders it: which diagonal a pair of arrows runs along, and where a shape's
 * ink is centred.
 */

import { describe, it, expect } from 'vitest';
import { icon } from '../../app/js/icons.js';

/** Every `<line>` in a glyph, as [x1, y1, x2, y2]. @param {string} name */
const lines = (name) => [...icon(name).matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)]
    .map((m) => m.slice(1).map(Number));

describe('FULL and TIGHT', () => {
    // In SVG, y grows downward, so a run from bottom-left to top-right has dx and dy of
    // opposite signs, and one from top-left to bottom-right has them the same.
    it('FULL runs bottom-left to top-right, its arrows out to those two corners', () => {
        const ls = lines('full');
        expect(ls).toHaveLength(2);
        for (const [x1, y1, x2, y2] of ls) expect((x2 - x1) * (y2 - y1)).toBeLessThan(0);
        const ends = ls.map(([x1, y1]) => `${x1},${y1}`).sort();
        expect(ends).toEqual(['21,3', '3,21']);
    });

    it('TIGHT runs top-left to bottom-right, the other diagonal, so a press swaps the glyph', () => {
        const ls = lines('tight');
        expect(ls).toHaveLength(2);
        for (const [x1, y1, x2, y2] of ls) expect((x2 - x1) * (y2 - y1)).toBeGreaterThan(0);
    });
});

describe('the compass', () => {
    it('is one closed arrowhead whose ink is centred in the 24 box, so it spins in place', () => {
        const d = icon('compass').match(/<path d="([^"]+)"/)?.[1] ?? '';
        expect(d.trim().endsWith('Z')).toBe(true);
        const n = (d.match(/[\d.]+/g) ?? []).map(Number);
        const xs = n.filter((_, i) => i % 2 === 0);
        const ys = n.filter((_, i) => i % 2 === 1);
        expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(12, 2);
        expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(12, 2);
        // One end, not a two-ended needle: a single topmost vertex, and it is the tip.
        expect(ys.filter((y) => y === Math.min(...ys))).toHaveLength(1);
    });
});
