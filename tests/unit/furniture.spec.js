/**
 * Rung 2: the furniture contract, tested as arithmetic.
 *
 * The demo only ever ships two pieces of furniture (a left panel, a table), so nothing
 * in the running app exercises this file's N-ARY case — three or four pieces of furniture on
 * different edges at once. That gap is deliberate (see docs — CONTRIBUTING.md — for why the
 * demo stays small) but it means this arithmetic is the ONLY place the multi-edge case is
 * ever actually checked. `edgeOf` and `coverFromEdgeFurniture` are pure and DOM-free for
 * exactly this reason: no browser, no fixture, just rects.
 */

import { describe, it, expect } from 'vitest';
import {
    edgeOf, coverFromEdgeFurniture, nearDockPoint, nearBottomEdge, nearLeftEdge, makeBorrow, HOME, SNAP,
} from '../../app/js/utils/furniture.js';

describe('nearLeftEdge', () => {
    it('catches the panel held against the left edge anywhere down it, the middle included', () => {
        // Halfway down a tall viewport: 400px from the top corner nearDockPoint() compared against.
        expect(nearLeftEdge({ left: 10 }, 10)).toBe(true);
        expect(nearLeftEdge({ left: 10 + SNAP }, 10)).toBe(true);
        expect(nearLeftEdge({ left: 0 }, 10)).toBe(true);
    });

    it('lets a panel clear of the edge stay undocked', () => {
        expect(nearLeftEdge({ left: 10 + SNAP + 1 }, 10)).toBe(false);
        expect(nearLeftEdge({ left: 500 }, 10)).toBe(false);
    });
});

const VIEWPORT = { width: 1280, height: 800 };

describe('edgeOf', () => {
    it('reads left when a rect hugs the left edge', () => {
        expect(edgeOf({ left: 0, top: 100, right: 300, bottom: 700 }, VIEWPORT)).toBe('left');
    });

    it('reads right when a rect hugs the right edge', () => {
        expect(edgeOf({ left: 1000, top: 100, right: 1280, bottom: 700 }, VIEWPORT)).toBe('right');
    });

    it('reads top when a rect hugs the top edge', () => {
        expect(edgeOf({ left: 200, top: 0, right: 1000, bottom: 60 }, VIEWPORT)).toBe('top');
    });

    it('reads bottom when a rect hugs the bottom edge', () => {
        expect(edgeOf({ left: 200, top: 700, right: 1000, bottom: 800 }, VIEWPORT)).toBe('bottom');
    });

    it('reads null for furniture parked away from every edge', () => {
        // An undocked panel dragged to the middle of the map: not furniture any more.
        expect(edgeOf({ left: 400, top: 300, right: 700, bottom: 500 }, VIEWPORT)).toBe(null);
    });

    it('honours the HOME threshold rather than requiring an exact 0', () => {
        expect(edgeOf({ left: HOME, top: 100, right: 300, bottom: 700 }, VIEWPORT)).toBe('left');
        expect(edgeOf({ left: HOME + 1, top: 100, right: 300, bottom: 700 }, VIEWPORT)).toBe(null);
    });

    it('reads a full-width band as bottom, not left — even with equal insets on three sides', () => {
        // Exactly this app's own table: left/right/bottom all inset 10px, which puts it
        // within HOME of three edges at once. A caught regression: the first cut of edgeOf()
        // checked left before bottom and misclassified the table as left-docked furniture,
        // which zeroed its bottom-padding contribution — a Playwright test (zoom-to landing a
        // layer under the table) is what caught it, not this file, which is why this case is
        // pinned here too.
        const table = { left: 10, top: 550, right: 1270, bottom: 790 };
        expect(edgeOf(table, VIEWPORT)).toBe('bottom');
    });

    it('reads a full-height column as left, not top — the rotated version of the same case', () => {
        const panel = { left: 10, top: 10, right: 310, bottom: 790 };
        expect(edgeOf(panel, VIEWPORT)).toBe('left');
    });
});

describe('coverFromEdgeFurniture — the N-ary case', () => {
    it('accounts for furniture on all four edges at once', () => {
        // Exactly the case the two-edge demo cannot exercise: a left panel, a right
        // inspector, a top toolbar, and a table, all open simultaneously.
        const furniture = [
            { edge: 'left', rect: { left: 0, top: 0, right: 300, bottom: 800 } },
            { edge: 'right', rect: { left: 1000, top: 0, right: 1280, bottom: 800 } },
            { edge: 'top', rect: { left: 0, top: 0, right: 1280, bottom: 50 } },
            { edge: 'bottom', rect: { left: 0, top: 650, right: 1280, bottom: 800 } },
        ];
        const cover = coverFromEdgeFurniture(furniture, VIEWPORT);
        expect(cover).toEqual({ left: 300, right: 280, top: 50, bottom: 150 });
    });

    it('takes the maximum, not the sum, when two things share an edge', () => {
        // Two panels both hugging the left edge — mid-drag past each other, say — must
        // contribute once, by whichever intrudes further, not stack their padding.
        const furniture = [
            { edge: 'left', rect: { left: 0, top: 0, right: 200, bottom: 400 } },
            { edge: 'left', rect: { left: 0, top: 400, right: 350, bottom: 800 } },
        ];
        const cover = coverFromEdgeFurniture(furniture, VIEWPORT);
        expect(cover.left).toBe(350);
    });

    it('ignores furniture that occupies no edge', () => {
        const cover = coverFromEdgeFurniture([], VIEWPORT);
        expect(cover).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
    });
});

describe('nearDockPoint', () => {
    const point = { x: 10, y: 10 };

    it('catches a rect inside the radius on both axes', () => {
        expect(nearDockPoint({ left: 30, top: 40 }, point)).toBe(true);
    });

    it('does not catch a rect that is close on one axis and far on the other', () => {
        // The reason it is per-axis and not radial: a panel sitting hard against the left
        // edge but 300px down the screen is not "nearly home" in any sense a reader means.
        expect(nearDockPoint({ left: 10, top: 340 }, point)).toBe(false);
        expect(nearDockPoint({ left: 700, top: 10 }, point)).toBe(false);
    });

    it('is symmetric: overshooting the point is as near as falling short', () => {
        expect(nearDockPoint({ left: 10 - SNAP, top: 10 }, point)).toBe(true);
        expect(nearDockPoint({ left: 10 + SNAP, top: 10 }, point)).toBe(true);
        expect(nearDockPoint({ left: 10 + SNAP + 1, top: 10 }, point)).toBe(false);
    });

    it('has a catch radius wider than the occlusion threshold, so anything that snaps was already occluding', () => {
        expect(SNAP).toBeGreaterThan(HOME);
    });
});

describe('nearBottomEdge', () => {
    // A 250px table on an 800px viewport with a 10px inset docks with its top at 540.
    const dockTop = 540;

    it('catches the rect anywhere along the edge, because it docks along the edge, not at a corner', () => {
        // The case nearDockPoint() got wrong for the table: held at the foot of the map, but in the
        // middle, far from the bottom-left corner it was being compared against.
        for (const left of [10, 400, 1100]) {
            expect(nearBottomEdge(/** @type {any} */ ({ left, top: dockTop }), dockTop)).toBe(true);
        }
    });

    it('catches within SNAP above the docked top and not beyond it', () => {
        expect(nearBottomEdge({ top: dockTop - SNAP }, dockTop)).toBe(true);
        expect(nearBottomEdge({ top: dockTop - SNAP - 1 }, dockTop)).toBe(false);
        expect(nearBottomEdge({ top: 200 }, dockTop)).toBe(false);
    });

    it('is one-sided: pushed down past the docked top is held against the edge, not far from it', () => {
        expect(nearBottomEdge({ top: dockTop + SNAP + 1 }, dockTop)).toBe(true);
        expect(nearBottomEdge({ top: dockTop + 300 }, dockTop)).toBe(true);
    });
});

describe('makeBorrow', () => {
    /** A thing that can be folded, standing in for the layer panel. */
    function subject(folded = false) {
        const state = { folded, takes: 0, gives: 0 };
        const borrow = makeBorrow({
            available: () => !state.folded,
            take: () => { state.folded = true; state.takes++; },
            give: () => { state.folded = false; state.gives++; },
        });
        return { state, borrow };
    }

    it('takes once and gives back once', () => {
        const { state, borrow } = subject();
        borrow.want(true);
        borrow.want(true);
        expect(state.folded).toBe(true);
        expect(state.takes).toBe(1);
        borrow.want(false);
        expect(state.folded).toBe(false);
        expect(state.gives).toBe(1);
    });

    it('will not give back what it never took', () => {
        // The table rises, the reader folds the panel themselves, the table comes down. Before
        // this contract the table unfolded a panel it had never folded.
        const { state, borrow } = subject(true);
        borrow.want(true);
        expect(borrow.held()).toBe(false);
        expect(state.takes).toBe(0);
        borrow.want(false);
        expect(state.gives).toBe(0);
        expect(state.folded).toBe(true);
    });

    it('release is want(false), and is safe when nothing is held', () => {
        const { state, borrow } = subject();
        borrow.release();
        expect(state.gives).toBe(0);
        borrow.want(true);
        borrow.release();
        expect(state.gives).toBe(1);
        expect(borrow.held()).toBe(false);
    });

    it('can take again after giving back', () => {
        const { state, borrow } = subject();
        borrow.want(true);
        borrow.want(false);
        borrow.want(true);
        expect(state.takes).toBe(2);
        expect(state.folded).toBe(true);
    });
});
