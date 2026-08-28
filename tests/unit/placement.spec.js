/**
 * Rung 2: the placement decision, tested as the arithmetic it is.
 *
 * No browser and no DOM here, because `choosePlacement` takes the visible area, the furniture
 * and the existing popups as arguments. That is not an accident of style: a function that
 * reads the document can only be tested by building a document, and then the test is mostly
 * about the fixture.
 */

import { describe, it, expect } from 'vitest';
import { choosePlacement, rect, overlaps, PLACEMENT } from '../../app/js/ui/popup-placement.js';

const VISIBLE = rect(10, 10, 1260, 780);
const SIZE = { w: 250, h: 160 };

/** @param {{left: number, top: number}} pos @returns {import('../../app/js/ui/popup-placement.js').Rect} */
const asRect = (pos) => rect(pos.left, pos.top, SIZE.w, SIZE.h);

describe('overlaps', () => {
    it('is false for rectangles that merely touch', () => {
        expect(overlaps(rect(0, 0, 10, 10), rect(10, 0, 10, 10))).toBe(false);
    });

    it('is true for genuine intersection', () => {
        expect(overlaps(rect(0, 0, 10, 10), rect(9, 9, 10, 10))).toBe(true);
    });
});

describe('choosePlacement, clean', () => {
    it('puts the first popup at the right edge of the visible area', () => {
        const pos = choosePlacement({
            anchor: { x: 400, y: 400 }, size: SIZE, mode: PLACEMENT.CLEAN, visible: VISIBLE,
        });
        expect(pos.strategy).toBe('clean-column');
        expect(pos.left + SIZE.w).toBe(VISIBLE.right);
        expect(pos.top).toBe(VISIBLE.top);
    });

    it('stacks the second popup below the first rather than on it', () => {
        const first = asRect(choosePlacement({
            anchor: { x: 400, y: 400 }, size: SIZE, mode: PLACEMENT.CLEAN, visible: VISIBLE,
        }));
        const second = choosePlacement({
            anchor: { x: 500, y: 500 }, size: SIZE, mode: PLACEMENT.CLEAN, visible: VISIBLE,
            existing: [first],
        });
        expect(overlaps(asRect(second), first)).toBe(false);
        expect(second.top).toBeGreaterThan(first.bottom - 1);
    });

    it('leaves the column when the column is blocked by furniture', () => {
        // A control stack occupying the whole right edge.
        const stack = rect(1150, 0, 130, 800);
        const pos = choosePlacement({
            anchor: { x: 400, y: 400 }, size: SIZE, mode: PLACEMENT.CLEAN, visible: VISIBLE,
            furniture: [stack],
        });
        expect(pos.strategy).not.toBe('clean-column');
        expect(overlaps(asRect(pos), stack)).toBe(false);
    });
});

describe('choosePlacement, adjacent', () => {
    it('prefers the right of the anchor when it fits', () => {
        const pos = choosePlacement({
            anchor: { x: 400, y: 400 }, size: SIZE, mode: PLACEMENT.ADJACENT, visible: VISIBLE,
        });
        expect(pos.strategy).toBe('right');
        expect(pos.left).toBeGreaterThan(400);
    });

    it('goes left when the right would leave the visible area', () => {
        const pos = choosePlacement({
            anchor: { x: 1200, y: 400 }, size: SIZE, mode: PLACEMENT.ADJACENT, visible: VISIBLE,
        });
        expect(pos.strategy).toBe('left');
        expect(pos.left + SIZE.w).toBeLessThan(1200);
    });

    it('never lands on the panel', () => {
        const panel = rect(10, 10, 320, 780);
        const pos = choosePlacement({
            anchor: { x: 360, y: 400 }, size: SIZE, mode: PLACEMENT.ADJACENT, visible: VISIBLE,
            furniture: [panel],
        });
        expect(overlaps(asRect(pos), panel)).toBe(false);
    });

    it('never lands on an open dock', () => {
        const dock = rect(260, 640, 760, 160);
        const pos = choosePlacement({
            anchor: { x: 640, y: 620 }, size: SIZE, mode: PLACEMENT.ADJACENT, visible: VISIBLE,
            furniture: [dock],
        });
        expect(overlaps(asRect(pos), dock)).toBe(false);
    });
});

describe('choosePlacement, the last resort', () => {
    it('covers the anchor rather than fleeing to a corner when nothing fits', () => {
        // Furniture on every side, leaving only the anchor's own neighbourhood.
        const boxed = [
            rect(10, 10, 1260, 300),      // above
            rect(10, 500, 1260, 290),     // below
            rect(10, 310, 380, 190),      // left
            rect(900, 310, 370, 190),     // right
        ];
        const anchor = { x: 640, y: 400 };
        const pos = choosePlacement({
            anchor, size: SIZE, mode: PLACEMENT.ADJACENT, visible: VISIBLE, furniture: boxed,
        });
        expect(pos.strategy).toBe('over-anchor');
        const r = asRect(pos);
        expect(anchor.x).toBeGreaterThanOrEqual(r.left);
        expect(anchor.x).toBeLessThanOrEqual(r.right);
        expect(anchor.y).toBeGreaterThanOrEqual(r.top);
        expect(anchor.y).toBeLessThanOrEqual(r.bottom);
    });

    it('stays inside the visible area even in the last resort', () => {
        const pos = choosePlacement({
            anchor: { x: 12, y: 12 }, size: SIZE, mode: PLACEMENT.ADJACENT, visible: VISIBLE,
            furniture: [rect(0, 0, 1280, 800)],
        });
        const r = asRect(pos);
        expect(r.left).toBeGreaterThanOrEqual(VISIBLE.left);
        expect(r.top).toBeGreaterThanOrEqual(VISIBLE.top);
        expect(r.right).toBeLessThanOrEqual(VISIBLE.right);
        expect(r.bottom).toBeLessThanOrEqual(VISIBLE.bottom);
    });
});
