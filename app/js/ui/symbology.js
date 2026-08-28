/**
 * symbology.js — the swatch: a tiny drawing of how a layer paints.
 *
 * It appears in two places and must be the SAME element in both: on the layer row, and in
 * the title bar of a popup about a feature from that layer. That pairing is the whole point.
 * A popup opening far from its feature (CLEAN mode) has a leader line saying WHICH feature;
 * the swatch says which LAYER, without spending a word on it, and it matches the row the
 * reader already learned.
 *
 * ── The shape carries the geometry ───────────────────────────────────────────────────────
 * A square is a polygon, a bar is a line, a dot is a point. Using one shape for all three and
 * only changing the colour throws away information the reader can have for free: two blue
 * layers are told apart by their form before their hue.
 *
 * Deliberately small: one colour per layer, no data-driven ramps, no categories. Real
 * symbology is a large subject with answers that depend on your data.
 */

/**
 * @param {{kind: 'fill'|'circle', color: string}} def
 * @returns {HTMLSpanElement}
 */
export function buildSymbolSwatch(def) {
    const swatch = document.createElement('span');
    swatch.className = 'sgs-swatch';
    swatch.classList.add(def.kind === 'circle' ? 'sgs-swatch--circle' : 'sgs-swatch--fill');
    swatch.style.setProperty('--sgs-swatch-color', def.color);
    return swatch;
}
