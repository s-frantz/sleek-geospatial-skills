/**
 * icons.js — the glyph set, and the two corrections every glyph set needs.
 *
 * Every glyph is authored on the same 24 unit viewBox with the same 2 unit stroke, which
 * makes them look like a family. It does not make them look the same SIZE, and it does not
 * make them look CENTRED. Those are two separate problems and each has its own table here.
 *
 *   SIZE. Each glyph fills its viewBox by a different fraction. A gear runs edge to edge; a
 *   chevron uses about half. Render both in an 18px box and the gear draws 18px of ink
 *   against the chevron's 9, so the chevron reads a size smaller while the CSS insists they
 *   match. SIZE_FACTOR scales the art box so the INK matches instead.
 *
 *   CENTRING. `margin: auto` centres the BOX. If the ink sits high inside the art, the glyph
 *   draws high, and no size change will fix it. NUDGE moves the art inside its own viewBox,
 *   in viewBox units, so the ink centre lands on the box centre.
 *
 * BOTH TABLES ARE MEASURED, NEVER GUESSED. Run `npm run icons`: it screenshots each button,
 * finds the ink by pixel difference against the button's own face, and prints the offset. Do
 * not adjust a number here because a screenshot looked better afterwards. See the
 * `ui-icons` skill.
 */

/**
 * Glyph interiors. Stroke geometry only: no fill, no colour, no width or height. The wrapper
 * supplies those, so a glyph inherits `color` from whatever button it sits in.
 * @type {Record<string, string>}
 */
const PATHS = {
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',

    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    minus: '<line x1="5" y1="12" x2="19" y2="12"/>',

    close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',

    /** Pinned: the panel is docked to the left edge and reserves that band. */
    pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/>',
    /** Unpinned: the panel floats, and stops being something the camera has to avoid. */
    'pin-off': '<path d="M12 17v5"/><path d="M15 9.34V6h1a2 2 0 0 0 0-4H7.89"/><path d="m2 2 20 20"/><path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11"/>',

    /** The stack of things a map shows. Doubles as the panel's MARK when the panel stows. */
    layers: '<polygon points="12 2 22 8.5 12 15 2 8.5 12 2"/><polyline points="2 15.5 12 22 22 15.5"/>',

    /** Crosshair: bring this into view. */
    target: '<circle cx="12" cy="12" r="7"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>',

    /** Ruled box: rows and columns, the dock's table. */
    table: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/>',

    /**
     * A popup, drawn so it cannot be confused with the table. Same box, one title rule instead
     * of a grid, and a speech tail. The tail is what a popup has and a table never does, and
     * it sits INSIDE the ink budget rather than being added to it, which is why the box is
     * shorter here than the table's.
     */
    popup: '<path d="M5 3h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-4 4v-4H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><line x1="3" y1="8" x2="21" y2="8"/>',

    /** Diagonal arrows drawn inward, top-left to bottom-right: give the pixels back. */
    tight: '<polyline points="20 14 14 14 14 20"/><polyline points="4 10 10 10 10 4"/><line x1="10" y1="10" x2="3" y2="3"/><line x1="21" y1="21" x2="14" y2="14"/>',

    /**
     * Diagonal arrows drawn outward, bottom-left to top-right: take the room the app can spare.
     * The two sit on OPPOSITE diagonals, so the swap on a press reads as a different glyph at
     * 12px rather than the same one with its arrowheads moved.
     */
    full: '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',

    info: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12" y2="8"/>',

    /**
     * Compass: a hollow notched arrowhead, drawn with its INK CENTRED in the 24 box rather
     * than merely fitted inside it (y 3.95 to 20.05 and x 7.1 to 16.9, both centred on 12).
     * An arrow drawn from y 1.2 to 17.3 has an ink centre of 9.25 in a box centred at 12, so
     * it renders 2.5px high and no amount of sizing fixes it: the single most common way a
     * compass glyph goes wrong.
     */
    // This glyph is the one thing on screen that ROTATES: MapLibre spins the compass button to
    // the map's bearing, about the element's centre, and centred ink is what makes it spin in
    // place rather than swing round a small orbit. An arrowhead, not a two-ended needle: it
    // has ONE end, so it cannot be read backwards, and the end is north. The notch in its base
    // is what tells tip from tail at 17px, where a plain triangle reads as a direction-less
    // wedge. Hollow, in the same stroke as every other glyph in the stack, because a solid
    // shape carries more visual weight than the outlines beside it at the same size.
    compass: '<path d="M12 3.95 L16.9 20.05 L12 16.55 L7.1 20.05 Z"/>',

    /** Crosshair with a centre dot: find my location. */
    // The centre dot paints from its own variable so the geolocate control can colour it
    // independently of the ring. See map-controls.css: dot alone means "following you", the
    // whole glyph means "following you AND the camera is locked on".
    locate: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.6" fill="var(--sgs-locate-dot, currentColor)" stroke="none"/><line x1="12" y1="1.5" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22.5"/><line x1="1.5" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22.5" y2="12"/>',

    /** Disclosure chevron, pointing down. Rotated by CSS for the other three directions. */
    chevron: '<polyline points="6 9 12 15 18 9"/>',

    // The three theme states, as a set. They have to read as ONE choice at 13px, so they
    // share a circle of the same radius and differ only inside it: the sun adds rays, the
    // moon takes a bite, and system fills half. Three unrelated pictures at this size read as
    // three unrelated controls.
    sun: '<circle cx="12" cy="12" r="4.6"/><line x1="12" y1="2.5" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="21.5"/><line x1="2.5" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="21.5" y2="12"/><line x1="5.4" y1="5.4" x2="7.2" y2="7.2"/><line x1="16.8" y1="16.8" x2="18.6" y2="18.6"/><line x1="5.4" y1="18.6" x2="7.2" y2="16.8"/><line x1="16.8" y1="7.2" x2="18.6" y2="5.4"/>',
    moon: '<path d="M20 14.2A8.5 8.5 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2z"/>',
    'half-moon': '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/>',
};

/**
 * Per glyph art-box scale, so equal `size` arguments produce equal INK.
 * 1 means the glyph already fills its viewBox. Measured with `npm run icons`.
 * @type {Record<string, number>}
 */
const SIZE_FACTOR = {
    // A glyph appears here once it has been MEASURED. Anything absent is treated as 1, which
    // is not a claim that it is correct: it is a claim that nobody has measured it yet. Adding
    // a guess would be worse than the omission, because a guess reads like a result.
    //
    // The four below are on screen from first paint, so `npm run icons` sees them.
    gear: 1,
    // The info circle stops well short of the viewBox edge while the gear runs up to it: at
    // factor 1.1 it drew 15.50 against the gear's 17.00, so 1.1 * 17 / 15.5 = 1.21.
    info: 1.21,
    // The pin's ink is taller than it is wide, and its long axis measured 12.00 against a
    // requested 13: 13 / 12 = 1.083.
    pin: 1.083,
    'pin-off': 1.083,
    // The inward arrows sit well inside the viewBox: 11.00 measured against 13 requested,
    // so 13 / 11 = 1.18.
    tight: 1.18,
    // `full` is `tight` mirrored. Measured at factor 1 it drew 10.00 of ink against the 12
    // requested; 12 / 10 = 1.2, which measures back at 12.50 — inside the 1px size tolerance,
    // and the honest number rather than one trimmed to land on 12.00 exactly.
    full: 1.2,

    // The MapLibre controls we adopt. Plus and minus measured 11.00 of ink at factor 1, and
    // their TARGET is deliberately smaller than the stack's 17 — see icon-targets.json for
    // why a plus must not be matched to a gear by the ruler. 14.5 / 11 = 1.318.
    plus: 1.318,
    minus: 1.318,
    // The arrowhead is narrow and its long axis is tip to tail, which at the needle's old
    // factor of 1.376 measured 17.50 against the 17 requested. The proportional correction,
    // 1.376 * 17 / 17.50 = 1.337, was tried and FAILED the centre check (dy 0.75): it asks for
    // a 22.73px art box, and a fractional box leaves a half-pixel margin the rasteriser cannot
    // split evenly. So the factor is chosen for an EVEN art box instead, 22 / 17 = 1.294.
    compass: 1.294,
    // 17 / 16.00 measured.
    locate: 1.0625,
};

/**
 * Per glyph translation inside the viewBox, in viewBox units, so the INK centre lands on the
 * box centre. Measured with `npm run icons`. A positive `y` moves the glyph DOWN.
 * @type {Record<string, {x: number, y: number}>}
 */
const NUDGE = {
    // Same rule as SIZE_FACTOR: an entry here is a measured correction, never a nudge that
    // made a screenshot look better. Empty means every measured glyph is already centred.
};

/** The one nominal ink size for a control-stack glyph, in CSS pixels. */
export const GLYPH = 17;

/**
 * @param {keyof typeof PATHS | string} name
 * @param {number} [size] target INK size in CSS pixels, before the per-glyph factor
 * @returns {string} an `<svg>` element as markup
 */
export function icon(name, size = GLYPH) {
    const inner = PATHS[name];
    if (!inner) throw new Error(`icons.js: no glyph named "${name}"`);
    const box = Math.round(size * (SIZE_FACTOR[name] ?? 1) * 100) / 100;
    const n = NUDGE[name];
    const body = n ? `<g transform="translate(${n.x} ${n.y})">${inner}</g>` : inner;
    // data-ink records the INTENDED ink size, so the measurer can check every glyph against
    // what its caller asked for rather than against one global number. It is the only reason
    // a 13px row glyph and a 17px control glyph can be measured by the same script.
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${box}" height="${box}"`
        + ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"'
        + ` stroke-linejoin="round" aria-hidden="true" data-glyph="${name}" data-ink="${size}">${body}</svg>`;
}

/** Every glyph name, for the measurer and for tests. @returns {string[]} */
export function glyphNames() {
    return Object.keys(PATHS);
}
