/**
 * control-glyphs.js — make MapLibre's own buttons wear this app's glyphs.
 *
 * MapLibre ships zoom, compass and geolocate as BACKGROUND IMAGES: SVGs baked into the
 * stylesheet in one fixed colour. Next to custom controls stroked with `currentColor` they
 * read as a different family — different weight, different size, and in dark mode they stay
 * black unless you invert them, which is a compromise rather than a result.
 *
 * The usual fix is a mask image: `background-image: none`, then `mask-image` a data URI of
 * your own art so `background-color` tints it. That works, and it costs a URI-encoded copy of
 * every glyph in the stylesheet, kept in sync by hand with the ones in icons.js.
 *
 * This is the cheaper answer. MapLibre's icon is a `<span class="maplibregl-ctrl-icon">`, so
 * we simply put OUR svg inside it and turn its background off. One source of glyph art, real
 * `currentColor` inheritance, and the dark-mode invert disappears — there is nothing baked
 * left to invert.
 *
 * ── Why the reset is INLINE and not in the stylesheet ────────────────────────────────────
 * It was in the stylesheet first, and it half worked. MapLibre writes its icon rules at
 * several different specificities — some two classes, some three, some four — so one rule of
 * ours landed for the zoom buttons and silently lost for the compass and the geolocate,
 * whose baked artwork went on rendering UNDERNEATH our svg. The visible result was a glyph
 * with an extra bar through it; the measured result was `npm run icons` reporting ink 22.5px
 * tall in a 17px box, which is what actually found it.
 *
 * Counting classes against a third-party stylesheet is a bet that its authors will not
 * renumber, and the alternative on offer is `!important`, which wins by shouting and stops
 * the next person reasoning about the cascade at all.
 *
 * So the reset is set INLINE, by the same code that injects the glyph. An inline style beats
 * every stylesheet rule without being `!important`, it is impossible to lose track of (it is
 * two lines below the thing it is undoing), and it applies exactly to the elements we
 * changed and no others. See the `map-control-icons` skill.
 */

import { icon, GLYPH } from '../icons.js';

/**
 * MapLibre button class → the glyph from icons.js that replaces its baked artwork.
 * @type {Array<[string, string]>}
 */
const ADOPT = [
    ['maplibregl-ctrl-zoom-in', 'plus'],
    ['maplibregl-ctrl-zoom-out', 'minus'],
    ['maplibregl-ctrl-compass', 'compass'],
    ['maplibregl-ctrl-geolocate', 'locate'],
];

/**
 * MapLibre names its controls for a generic map: "Find my location", "Drag to rotate map,
 * click to reset north". On a stack this small those read as sentences among single words,
 * so they are renamed to match. Keyed by the aria-label MapLibre ships, which is the stable
 * identifier.
 * @type {Record<string, string>}
 */
const RENAME = {
    'Zoom in': 'Zoom in',
    'Zoom out': 'Zoom out',
    'Reset bearing to north': 'Compass',
    'Drag to rotate map, click to reset north': 'Compass',
    'Find my location': 'My location',
};

/**
 * Adopt every MapLibre control currently mounted in a container. Idempotent: an already
 * adopted span is skipped, so it is safe to call again after adding another control.
 *
 * @param {ParentNode} [root] defaults to the top-right stack
 * @returns {number} how many buttons were adopted
 */
export function adoptControlGlyphs(root) {
    const host = root ?? document.querySelector('.maplibregl-ctrl-top-right');
    if (!host) return 0;
    let n = 0;

    for (const [cls, glyph] of ADOPT) {
        for (const btn of host.querySelectorAll(`.${cls}`)) {
            const span = /** @type {HTMLElement|null} */ (btn.querySelector('.maplibregl-ctrl-icon'));
            if (!span || span.classList.contains('sgs-adopted')) continue;
            span.classList.add('sgs-adopted');
            // Undo MapLibre's baked artwork and centre ours, inline. See the header.
            span.style.backgroundImage = 'none';
            span.style.display = 'grid';
            span.style.placeItems = 'center';
            span.innerHTML = icon(glyph, GLYPH);
            n++;
        }
    }

    // Rename while we are here: the visible label and the accessible name must say the same
    // thing, so both are set from one table.
    for (const btn of host.querySelectorAll('button')) {
        const current = btn.getAttribute('aria-label') || btn.getAttribute('title') || '';
        const renamed = RENAME[current];
        if (!renamed) continue;
        btn.setAttribute('aria-label', renamed);
        btn.setAttribute('title', renamed);
    }
    return n;
}
