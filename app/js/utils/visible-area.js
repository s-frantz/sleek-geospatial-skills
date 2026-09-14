/**
 * visible-area.js — where on screen the map is actually VISIBLE.
 *
 * An app with furniture has a viewport and a smaller, differently shaped region a person can
 * actually see into. `fitBounds` knows about the first one. Left to itself it centres a
 * feature in the middle of the canvas, which in an app with a docked panel is a spot half
 * covered by it, and half covered by an open table besides.
 *
 * So every camera move goes through `visiblePadding()`. It is not a cosmetic margin: the
 * numbers are read off whatever is currently marked `data-sgs-furniture` (see furniture.js),
 * because this file has no idea how many panels an app built on it will end up with, or which
 * edges they sit on.
 *
 * ── Occlusion is a question about WHERE FURNITURE IS, not what state it is in ────────────
 * The geometric contract this file relies on — edgeOf() in furniture.js — exists because an
 * earlier version of this file asked whether the panel carried the undocked class and gave up
 * the moment it did. Consequence: undocking the panel WITHOUT MOVING IT ONE PIXEL sent every
 * popup back to the far left, underneath it, and stopped the camera reserving the band it
 * plainly still covered. An undocked panel parked at home occludes exactly as much as a docked panel,
 * and that has to be true for ANY piece of furniture an app adds, not just the one this
 * repo ships — which is the whole reason the check moved into a shared, DOM-agnostic
 * function instead of staying a fact this file knew about one element.
 */

import { edgeCover } from './furniture.js';

/**
 * A MapLibre padding object that keeps fitted geometry inside the visible part of the
 * viewport, on every edge that furniture currently occupies.
 *
 * Clamped, because MapLibre requires the padding to leave a positive drawing area, and enough
 * furniture on opposing edges can otherwise ask for more padding than there is screen. When
 * the clamp bites, the camera is merely imperfect; without it, `fitBounds` throws and the
 * button appears broken.
 *
 * @param {number} [base] padding on unobstructed edges, in pixels
 * @returns {{top: number, right: number, bottom: number, left: number}}
 */
export function visiblePadding(base = 48) {
    /** @type {{top: number, right: number, bottom: number, left: number}} */
    const pad = { top: base, right: base, bottom: base, left: base };
    if (typeof document === 'undefined' || typeof window === 'undefined') return pad;

    const cover = edgeCover();
    if (cover.left > 0) pad.left = Math.max(pad.left, Math.round(cover.left + 16));
    if (cover.right > 0) pad.right = Math.max(pad.right, Math.round(cover.right + 16));
    if (cover.top > 0) pad.top = Math.max(pad.top, Math.round(cover.top + 16));
    if (cover.bottom > 0) pad.bottom = Math.max(pad.bottom, Math.round(cover.bottom + 16));

    const w = window.innerWidth;
    const h = window.innerHeight;
    if (pad.left + pad.right > w * 0.8) {
        const scale = (w * 0.8) / (pad.left + pad.right);
        pad.left = Math.floor(pad.left * scale);
        pad.right = Math.floor(pad.right * scale);
    }
    if (pad.top + pad.bottom > h * 0.8) {
        const scale = (h * 0.8) / (pad.top + pad.bottom);
        pad.top = Math.floor(pad.top * scale);
        pad.bottom = Math.floor(pad.bottom * scale);
    }
    return pad;
}

/**
 * The rectangle of the viewport a person can actually see the map through, in client
 * coordinates. Popup placement uses this; so does anything else that needs to land something
 * where it will be looked at.
 * @param {number} [edge] margin to keep from the viewport edge
 * @returns {{left: number, top: number, right: number, bottom: number, width: number, height: number}}
 */
export function visibleRect(edge = 10) {
    const w = typeof window === 'undefined' ? 1280 : window.innerWidth;
    const h = typeof window === 'undefined' ? 800 : window.innerHeight;
    const cover = typeof window === 'undefined'
        ? { left: 0, right: 0, top: 0, bottom: 0 }
        : edgeCover();
    const left = Math.max(edge, cover.left + (cover.left > 0 ? 12 : 0));
    const top = Math.max(edge, cover.top + (cover.top > 0 ? 12 : 0));
    const right = w - Math.max(edge, cover.right + (cover.right > 0 ? 12 : 0));
    const bottom = h - Math.max(edge, cover.bottom + (cover.bottom > 0 ? 12 : 0));
    return {
        left,
        top,
        right,
        bottom,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
    };
}
