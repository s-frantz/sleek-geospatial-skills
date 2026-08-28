/**
 * map.js — the map itself, and nothing else.
 *
 * The basemap is OpenFreeMap Liberty: an OpenStreetMap-derived vector style served without a
 * key, an account, or a rate limit, which is the only kind of default a starter app should
 * have. Anything requiring a token makes "clone it and run it" a lie six months from now when
 * the token expires.
 *
 * `attributionControl: false` here and re-added in main.js is not a way to drop attribution.
 * It is so attribution joins the control stack in a known position instead of racing the
 * other controls for the corner.
 */

export const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

/** Where the demo data is. @type {[number, number]} */
export const INITIAL_CENTER = [-122.64, 45.52];
export const INITIAL_ZOOM = 11.2;

export const map = new maplibregl.Map({
    container: 'map',
    style: BASEMAP_STYLE,
    center: INITIAL_CENTER,
    zoom: INITIAL_ZOOM,
    attributionControl: false,
    // Keep the canvas readable to a screenshot-based measurer: no animated fade between
    // tile loads means a settled frame is genuinely settled.
    fadeDuration: 0,
});

// Exposed so Playwright specs can drive and interrogate the real camera rather than
// re-implementing it. See the `verify-in-the-browser` skill.
window.sgsMap = map;
