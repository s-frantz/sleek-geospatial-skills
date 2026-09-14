/**
 * Rung 2: the placement decisions, tested as the arithmetic they are.
 *
 * No browser and no DOM here, because `adjacentPlacement` takes its obstacles and safe area
 * as arguments and `cascadeSlot` is pure arithmetic. That is not an accident of style: a
 * function that reads the document can only be tested by building a document, and then the
 * test is mostly about the fixture.
 */

import { describe, it, expect } from 'vitest';
import {
    adjacentPlacement, cascadeSlot, CASCADE_STEP, rect, overlaps,
} from '../../app/js/ui/popup-placement.js';

const SAFE = rect(10, 10, 1260, 780);
const SIZE = { w: 280, h: 160 };

/** @param {{left: number, top: number}} pos */
const asRect = (pos) => rect(pos.left, pos.top, SIZE.w, SIZE.h);

describe('overlaps', () => {
    it('is false for rectangles that merely touch', () => {
        expect(overlaps(rect(0, 0, 10, 10), rect(10, 0, 10, 10))).toBe(false);
    });

    it('is true for genuine intersection', () => {
        expect(overlaps(rect(0, 0, 10, 10), rect(9, 9, 10, 10))).toBe(true);
    });
});

describe('cascadeSlot', () => {
    it('puts the first popup at the column home', () => {
        const s = cascadeSlot(230, 0, 280, 1280);
        expect(s.left).toBe(230);
        expect(s.nextOffset).toBe(CASCADE_STEP);
    });

    it('steps each kept popup one CASCADE_STEP further right', () => {
        const first = cascadeSlot(230, 0, 280, 1280);
        const second = cascadeSlot(230, first.nextOffset, 280, 1280);
        expect(second.left).toBe(230 + CASCADE_STEP);
    });

    it('wraps back to the home instead of walking off the right edge', () => {
        // An offset that would push the popup past the viewport.
        const s = cascadeSlot(230, 900, 280, 1280);
        expect(s.left).toBe(230);
        // And the wrap restarts the walk, so the NEXT popup cascades off the home again.
        expect(s.nextOffset).toBe(CASCADE_STEP);
    });
});

describe('adjacentPlacement', () => {
    it('prefers the right of the anchor when it fits', () => {
        const pos = adjacentPlacement({ x: 400, y: 400 }, SIZE, [], SAFE);
        expect(pos.side).toBe('right');
        expect(pos.left).toBeGreaterThan(400);
    });

    it('goes left when the right would leave the safe area', () => {
        const pos = adjacentPlacement({ x: 1200, y: 400 }, SIZE, [], SAFE);
        expect(pos.side).toBe('left');
        expect(pos.left + SIZE.w).toBeLessThan(1200);
    });

    it('clamps the cross axis instead of abandoning the side', () => {
        // Anchor near the top: a right placement centred on it would poke above the safe
        // area. The side survives; the top is pulled down.
        const pos = adjacentPlacement({ x: 400, y: 20 }, SIZE, [], SAFE);
        expect(pos.side).toBe('right');
        expect(pos.top).toBe(SAFE.top);
    });

    it('never lands on furniture', () => {
        const panel = rect(10, 10, 320, 780);
        const pos = adjacentPlacement({ x: 360, y: 400 }, SIZE, [panel], SAFE);
        expect(overlaps(asRect(pos), panel)).toBe(false);
    });

    it('never lands on an open table', () => {
        const table = rect(10, 620, 1260, 170);
        const pos = adjacentPlacement({ x: 640, y: 600 }, SIZE, [table], SAFE);
        expect(overlaps(asRect(pos), table)).toBe(false);
    });

    it('covers the anchor rather than fleeing to a corner when nothing fits', () => {
        const boxed = [
            rect(10, 10, 1260, 300),      // above
            rect(10, 500, 1260, 290),     // below
            rect(10, 310, 380, 190),      // left
            rect(900, 310, 370, 190),     // right
        ];
        const anchor = { x: 640, y: 400 };
        const pos = adjacentPlacement(anchor, SIZE, boxed, SAFE);
        expect(pos.side).toBe('over');
        const r = asRect(pos);
        expect(anchor.x).toBeGreaterThanOrEqual(r.left);
        expect(anchor.x).toBeLessThanOrEqual(r.right);
        expect(anchor.y).toBeGreaterThanOrEqual(r.top);
        expect(anchor.y).toBeLessThanOrEqual(r.bottom);
    });

    it('stays inside the safe area even in the last resort', () => {
        const pos = adjacentPlacement({ x: 12, y: 12 }, SIZE, [rect(0, 0, 1280, 800)], SAFE);
        const r = asRect(pos);
        expect(r.left).toBeGreaterThanOrEqual(SAFE.left);
        expect(r.top).toBeGreaterThanOrEqual(SAFE.top);
        expect(r.right).toBeLessThanOrEqual(SAFE.right);
        expect(r.bottom).toBeLessThanOrEqual(SAFE.bottom);
    });
});
