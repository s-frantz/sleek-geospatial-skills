/**
 * popup-placement.js — where a popup opens, and what it refuses to sit on top of.
 *
 * ── Two strategies, one word each ────────────────────────────────────────────────────────
 *   CLEAN     the popup opens at a fixed home: top of the screen, just right of the panel,
 *             out of the map's way. Stacked popups CASCADE, each 40px further right, like
 *             windows on a desk. A leader line runs from the popup back to the feature, and
 *             that line is what makes the distance work: you look to the side for the
 *             answer, and the line tells you which question it answers.
 *   ADJACENT  the popup opens beside the feature: right of it if it fits, else left, else
 *             below, else above. You look AT what you clicked.
 *
 * Neither is more correct. They trade "keep the map legible" against "keep the answer near
 * the question", so it is a setting, not an opinion baked into the code.
 *
 * ── Popups are placed ONCE ───────────────────────────────────────────────────────────────
 * A popup is positioned when it opens and then stays where it is, in screen space. It does
 * not chase the map: panning under an open popup only redraws its leader line. Popups are
 * also draggable, and a thing the user can move is a thing the app must stop moving — the
 * moment the code re-places popups on every camera move, dragging one becomes an argument
 * with the machine.
 *
 * ── What counts as furniture ─────────────────────────────────────────────────────────────
 * ADJACENT candidates are rejected if they land on anything marked `data-sgs-furniture` WHILE
 * it occludes an edge (a geometric question — see furniture.js). Furniture parked away from
 * every edge is NOT furniture any more: it is something the user chose to put there and can
 * move again, so a popup may land on it — the popup is information they just asked for, and
 * is easily dismissed. This file has no list of ids to keep in sync; it asks the DOM.
 *
 * ── The last resort ──────────────────────────────────────────────────────────────────────
 * When nothing fits, the popup sits ON the anchor rather than in a far corner. A popup
 * jammed somewhere distant is worse than one covering its own feature: at least the second
 * is obviously about the thing underneath it.
 */

import { getPrefs, setPrefs } from '../utils/prefs.js';
import { edgeFurniture, edgeCover } from '../utils/furniture.js';

/**
 * @typedef {{left: number, top: number, right: number, bottom: number}} Rect
 * @typedef {{x: number, y: number}} Point
 * @typedef {{w: number, h: number}} Size
 */

export const PLACEMENT = /** @type {const} */ ({ CLEAN: 'clean', ADJACENT: 'adjacent' });

/** Breathing room between a popup and whatever it is dodging. */
const GAP = 14;
/** Margin the popup keeps from the viewport edge. */
const EDGE = 10;
/** How far each stacked CLEAN popup steps right, so its title bar stays reachable. */
export const CASCADE_STEP = 40;

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

/**
 * The viewport minus its edge margin.
 * @returns {Rect}
 */
export function safeArea() {
    const w = typeof window === 'undefined' ? 1280 : window.innerWidth;
    const h = typeof window === 'undefined' ? 800 : window.innerHeight;
    return rect(EDGE, EDGE, w - EDGE * 2, h - EDGE * 2);
}

/**
 * Every element marked `data-sgs-furniture` WHILE it occludes an edge, as screen rects an
 * ADJACENT popup must not cover. Nothing here names a specific piece of chrome — an app that
 * adds a third panel or an inspector on the right needs to change nothing in this file for
 * its popups to route around it too.
 * @returns {Rect[]}
 */
export function obstacles() {
    return edgeFurniture().map((f) => rect(f.rect.left, f.rect.top, f.rect.width, f.rect.height));
}

/**
 * Where a CLEAN popup's column starts: right of whatever furniture occludes the left edge,
 * the viewport edge otherwise. Recomputed per open, so the answer tracks live geometry rather
 * than a value remembered from an older layout.
 * @returns {number}
 */
export function cleanBaseLeft() {
    const cover = edgeCover();
    return cover.left > 0 ? cover.left + EDGE : EDGE;
}

/**
 * The cascade: where the Nth stacked popup goes, and the offset the (N+1)th should use.
 * Pure arithmetic, so the wrap-around is testable without a browser.
 *
 * @param {number} baseLeft   the column's home, from cleanBaseLeft()
 * @param {number} offset     the running cascade offset (0 for the first popup)
 * @param {number} popupW     the popup's width
 * @param {number} viewportW
 * @returns {{left: number, nextOffset: number}}
 */
export function cascadeSlot(baseLeft, offset, popupW, viewportW) {
    let left = baseLeft + offset;
    // Off the right edge: the cascade wraps back to its home rather than pushing popups
    // off screen one by one.
    if (left + popupW > viewportW - EDGE) {
        left = baseLeft;
        offset = 0;
    }
    return { left, nextOffset: offset + CASCADE_STEP };
}

/**
 * Choose a rect for a popup opening next to its feature.
 *
 * Each candidate commits to ONE axis — a `right` placement is defined by x — and is clamped
 * on the other, so "almost fits vertically" becomes "fits" instead of jumping the popup to
 * the opposite side of the feature for the sake of a few pixels. Only the committed axis can
 * disqualify a candidate.
 *
 * @param {Point} anchor        the leader line's origin, in screen px
 * @param {Size} size
 * @param {Rect[]} [blocked]    obstacle rects (defaults to the live furniture)
 * @param {Rect} [safe]         the area to stay inside (defaults to the live viewport)
 * @returns {{left: number, top: number, side: string}} `side` names the winner, or 'over'
 */
export function adjacentPlacement(anchor, size, blocked = obstacles(), safe = safeArea()) {
    const { w, h } = size;

    /** @param {number} x */
    const clampX = (x) => Math.max(safe.left, Math.min(x, safe.right - w));
    /** @param {number} y */
    const clampY = (y) => Math.max(safe.top, Math.min(y, safe.bottom - h));

    const candidates = [
        { side: 'right', left: anchor.x + GAP, top: clampY(anchor.y - h / 2) },
        { side: 'left', left: anchor.x - GAP - w, top: clampY(anchor.y - h / 2) },
        { side: 'below', left: clampX(anchor.x - w / 2), top: anchor.y + GAP },
        { side: 'above', left: clampX(anchor.x - w / 2), top: anchor.y - GAP - h },
    ];

    for (const c of candidates) {
        const r = rect(c.left, c.top, w, h);
        if (r.left < safe.left || r.right > safe.right) continue;
        if (r.top < safe.top || r.bottom > safe.bottom) continue;
        if (blocked.some((b) => overlaps(r, b))) continue;
        return { left: Math.round(c.left), top: Math.round(c.top), side: c.side };
    }

    // Nothing fits: sit ON the anchor, clamped, because "over the point" must still mean
    // "on screen".
    return {
        left: Math.round(clampX(anchor.x - w / 2)),
        top: Math.round(clampY(anchor.y - h / 2)),
        side: 'over',
    };
}

/**
 * The screen position of a lngLat, in viewport coordinates.
 * @param {any} map
 * @param {[number, number] | {lng: number, lat: number}} lngLat
 * @returns {Point|null} null while the camera is mid-flight and cannot answer
 */
export function anchorPoint(map, lngLat) {
    if (!map || !lngLat || typeof map.project !== 'function') return null;
    try {
        const p = map.project(lngLat);
        const host = map.getContainer?.();
        const r = host ? host.getBoundingClientRect() : { left: 0, top: 0 };
        return { x: r.left + p.x, y: r.top + p.y };
    } catch {
        return null;
    }
}
