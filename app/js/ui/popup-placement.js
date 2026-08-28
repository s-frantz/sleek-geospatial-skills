/**
 * popup-placement.js — where a popup opens, and what it refuses to sit on top of.
 *
 * ── Two strategies, one word each ────────────────────────────────────────────────────────
 *   CLEAN     popups stack in a tidy column down one side, out of the map's way. The centre
 *             of the map stays readable and you look to the SIDE for what you clicked.
 *   ADJACENT  the popup opens beside the feature: right of it if it fits, else left, else
 *             below, else above. You look AT what you clicked.
 *
 * Neither is more correct. They trade "keep the map legible" against "keep the answer near the
 * question", and which one a person wants depends on what they are doing. So it is a setting,
 * not an opinion baked into the code.
 *
 * ── What counts as "fits" ────────────────────────────────────────────────────────────────
 * A candidate is rejected if it would leave the visible area OR land on the app's own
 * furniture: the control stack, the panel while it occludes the left edge, an open dock, and
 * any popup already on screen. Those are things a person needs to keep reaching. Everything
 * else, including the map and the feature itself, is fair game.
 *
 * ── The last resort ──────────────────────────────────────────────────────────────────────
 * When nothing fits, the popup goes OVER THE ANCHOR rather than wherever there is room. A
 * popup jammed into a far corner is worse than one sitting on its own feature: at least the
 * second is obviously about the thing underneath it. What is protected is the anchor POINT
 * the leader line comes from, not the geometry, because a large polygon can be covered
 * without much being lost.
 *
 * ── Why the core is pure ─────────────────────────────────────────────────────────────────
 * `choosePlacement` takes the visible area, the furniture and the existing popups as
 * arguments rather than reading them from the document. That is what makes the rung-2 unit
 * tests possible: the decision is arithmetic, and arithmetic can be tested without a browser.
 * `placementFor` is the thin wrapper that goes and gets the real numbers.
 */

import { getPrefs, setPrefs } from '../utils/prefs.js';
import { visibleRect } from '../utils/visible-area.js';

/**
 * @typedef {{left: number, top: number, right: number, bottom: number}} Rect
 * @typedef {{x: number, y: number}} Point
 * @typedef {{w: number, h: number}} Size
 */

export const PLACEMENT = /** @type {const} */ ({ CLEAN: 'clean', ADJACENT: 'adjacent' });

/** Breathing room between a popup and whatever it is dodging. */
const GAP = 14;
/** Vertical rhythm of the CLEAN column. */
const STACK_GAP = 10;

/** @returns {'clean'|'adjacent'} */
export function getPlacementMode() {
    return getPrefs().popupPlacement === PLACEMENT.ADJACENT ? PLACEMENT.ADJACENT : PLACEMENT.CLEAN;
}

/**
 * @param {'clean'|'adjacent'} mode
 * @returns {'clean'|'adjacent'}
 */
export function setPlacementMode(mode) {
    const next = mode === PLACEMENT.ADJACENT ? PLACEMENT.ADJACENT : PLACEMENT.CLEAN;
    setPrefs({ popupPlacement: next });
    return next;
}

/**
 * @param {number} left @param {number} top @param {number} w @param {number} h
 * @returns {Rect}
 */
export const rect = (left, top, w, h) => ({ left, top, right: left + w, bottom: top + h });

/** @param {Rect} a @param {Rect} b @returns {boolean} */
export const overlaps = (a, b) =>
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** @param {Rect} r @param {Rect} within @returns {boolean} */
const inside = (r, within) =>
    r.left >= within.left && r.top >= within.top && r.right <= within.right && r.bottom <= within.bottom;

/**
 * @param {Rect} r
 * @param {Rect} visible
 * @param {Rect[]} blockers
 * @returns {boolean}
 */
function fits(r, visible, blockers) {
    if (!inside(r, visible)) return false;
    return !blockers.some((b) => overlaps(r, b));
}

/**
 * Decide where a popup of a given size goes.
 *
 * @param {object} opts
 * @param {Point} opts.anchor screen position of the feature the popup describes
 * @param {Size} opts.size the popup's measured width and height
 * @param {'clean'|'adjacent'} opts.mode
 * @param {Rect} opts.visible the part of the viewport a person can see the map through
 * @param {Rect[]} [opts.furniture] app chrome the popup must not cover
 * @param {Rect[]} [opts.existing] popups already on screen
 * @returns {{left: number, top: number, strategy: string}}
 */
export function choosePlacement({ anchor, size, mode, visible, furniture = [], existing = [] }) {
    const blockers = [...furniture, ...existing];
    const { w, h } = size;

    if (mode === PLACEMENT.CLEAN) {
        // A column down the right edge of the visible area.
        const left = Math.round(visible.right - w);
        const columnSpan = { left, right: left + w };
        let top = visible.top;

        // Start below anything already occupying the column. The control stack lives at the
        // top right, so without this the first popup lands on it, the strategy is abandoned,
        // and CLEAN quietly stops being clean. Furniture pushes the column DOWN rather than
        // cancelling it.
        for (const b of furniture) {
            if (b.right > columnSpan.left && b.left < columnSpan.right) {
                top = Math.max(top, b.bottom + GAP);
            }
        }
        // Then below the popups already in the column, so a second answer sits under the
        // first instead of on it.
        for (const e of existing) {
            if (e.right > columnSpan.left && e.left < columnSpan.right) {
                top = Math.max(top, e.bottom + STACK_GAP);
            }
        }

        const candidate = rect(left, top, w, h);
        if (fits(candidate, visible, blockers)) {
            return { left: candidate.left, top: candidate.top, strategy: 'clean-column' };
        }
        // The column has run out of room. Fall through to the adjacent search rather than
        // stacking popups on top of each other.
    }

    // ADJACENT, and CLEAN's overflow: try each side of the anchor in order of preference.
    // Each candidate names the side it is on and the axis that side is DEFINED by. A right
    // placement is defined by x, so it may be nudged vertically to make room but never
    // horizontally: slide it on x and it drifts back over the anchor, "fits", and the popup
    // never tries the left side at all. That is not hypothetical; it is what the first
    // version of this function did, and the unit test is what found it.
    /** @type {Array<[string, Rect, 'x'|'y']>} */
    const candidates = [
        ['right', rect(anchor.x + GAP, anchor.y - h / 2, w, h), 'x'],
        ['left', rect(anchor.x - GAP - w, anchor.y - h / 2, w, h), 'x'],
        ['below', rect(anchor.x - w / 2, anchor.y + GAP, w, h), 'y'],
        ['above', rect(anchor.x - w / 2, anchor.y - GAP - h, w, h), 'y'],
    ];
    for (const [name, c, axis] of candidates) {
        const slid = slideCross(c, visible, axis);
        if (fits(slid, visible, blockers)) {
            return { left: Math.round(slid.left), top: Math.round(slid.top), strategy: name };
        }
    }

    // Last resort: over the anchor, clamped into the visible area. Deliberately not "wherever
    // there is room".
    const over = slideInto(rect(anchor.x - w / 2, anchor.y - h / 2, w, h), visible);
    return { left: Math.round(over.left), top: Math.round(over.top), strategy: 'over-anchor' };
}

/**
 * Push a rectangle back inside a container along one axis only, leaving the other alone.
 * @param {Rect} r
 * @param {Rect} within
 * @param {'x'|'y'} fixed the axis the placement is DEFINED by, which must not move
 * @returns {Rect}
 */
function slideCross(r, within, fixed) {
    const w = r.right - r.left;
    const h = r.bottom - r.top;
    let left = r.left;
    let top = r.top;
    if (fixed === 'x') {
        if (top < within.top) top = within.top;
        if (top + h > within.bottom) top = within.bottom - h;
    } else {
        if (left < within.left) left = within.left;
        if (left + w > within.right) left = within.right - w;
    }
    return rect(left, top, w, h);
}

/**
 * Push a rectangle back inside a container on both axes without resizing it. Used only by the
 * last resort, where there is no side left to preserve.
 * @param {Rect} r @param {Rect} within @returns {Rect}
 */
function slideInto(r, within) {
    const w = r.right - r.left;
    const h = r.bottom - r.top;
    let left = r.left;
    let top = r.top;
    if (left < within.left) left = within.left;
    if (left + w > within.right) left = within.right - w;
    if (top < within.top) top = within.top;
    if (top + h > within.bottom) top = within.bottom - h;
    return rect(left, top, w, h);
}

/**
 * The app chrome a popup must not cover, read off the live document.
 *
 * Note what is NOT here: the map, the features, and the basemap attribution, which is small,
 * fixed, and would push popups around for no benefit.
 * @returns {Rect[]}
 */
export function furnitureRects() {
    if (typeof document === 'undefined') return [];
    /** @type {Rect[]} */
    const out = [];
    /** @param {Element|null} el */
    const push = (el) => {
        if (!el || /** @type {HTMLElement} */ (el).offsetParent === null) return;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) out.push(rect(r.left, r.top, r.width, r.height));
    };

    for (const el of document.querySelectorAll('.maplibregl-ctrl-top-right, .maplibregl-ctrl-top-left')) push(el);

    const panel = document.getElementById('sgs-panel');
    if (panel && !panel.classList.contains('sgs-panel--float')) push(panel);

    push(document.getElementById('sgs-dock'));
    return out;
}

/**
 * Where should THIS popup go, given the live page.
 * @param {Point} anchor
 * @param {Size} size
 * @param {Rect[]} [existing]
 * @returns {{left: number, top: number, strategy: string}}
 */
export function placementFor(anchor, size, existing = []) {
    return choosePlacement({
        anchor,
        size,
        mode: getPlacementMode(),
        visible: visibleRect(),
        furniture: furnitureRects(),
        existing,
    });
}
