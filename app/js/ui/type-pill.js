/**
 * type-pill.js — the small "pillbox" badge naming a layer's SOURCE KIND.
 *
 * `{GEO}`, `VTL`, `CSV`. It answers a question a colour swatch cannot: not what this layer
 * looks like, but what it IS — where the bytes come from and therefore what the app can do
 * with it. A GeoJSON file can be read whole and put in a table; a vector tile layer cannot.
 *
 * Two rules make the vocabulary work:
 *
 *   ONE PILL PER KIND, EVERYWHERE. The same badge appears on the layer row, in the popup's
 *   title bar, and in any table that lists layers. A reader learns `{GEO}` once. The moment
 *   two surfaces render the same kind differently, the badge stops being a word and becomes
 *   decoration.
 *
 *   THE FULL NAME IS ALWAYS ONE HOVER AWAY. The pill is an abbreviation, and an abbreviation
 *   nobody can expand is a puzzle. Every pill carries its long name as a tooltip.
 *
 * The map below is deliberately larger than this demo needs: only `geojson-file` is used
 * here. The rest is the vocabulary, kept so that adding a real loader means adding a loader
 * rather than inventing a badge under time pressure.
 *
 * @typedef {{text: string, cls: string, tip: string}} PillInfo
 */

/** @type {Record<string, PillInfo>} */
export const SOURCE_PILL_MAP = {
    'geojson-file': { text: '{GEO}', cls: 'json', tip: 'GeoJSON' },
    'geojson': { text: 'FS', cls: 'fs', tip: 'Feature Service' },
    'vector-tile': { text: 'VTL', cls: 'vtl', tip: 'Vector Tile Layer' },
    'xyz-tiles': { text: 'TILE', cls: 'xyz', tip: 'Raster Tiles' },
    'wms': { text: 'WMS', cls: 'wms', tip: 'Web Map Service' },
    'csv': { text: 'CSV', cls: 'csv', tip: 'Uploaded CSV' },
};

/**
 * Uppercase abbreviation for an unmapped kind: initials when it is several words, else a
 * prefix. Never returns nothing, because a layer with no badge reads as a layer with no
 * source, which is worse than an imperfect abbreviation.
 * @param {string} type
 * @returns {string}
 */
function abbrev(type) {
    const s = String(type || '').trim();
    if (!s) return '?';
    const words = s.split(/[\s_-]+/).filter(Boolean);
    if (words.length >= 2) return words.map((w) => w[0]).join('').toUpperCase().slice(0, 4);
    return s.slice(0, 4).toUpperCase();
}

/**
 * @param {string} type
 * @returns {PillInfo}
 */
export function getSourcePill(type) {
    return SOURCE_PILL_MAP[type] ?? { text: abbrev(type), cls: 'other', tip: type || 'Other' };
}

/**
 * @param {PillInfo} info
 * @returns {HTMLSpanElement}
 */
export function makeTypePill(info) {
    const pill = document.createElement('span');
    pill.className = `sgs-source-pill sgs-source-pill--${info.cls}`;
    pill.textContent = info.text;
    pill.title = info.tip;
    return pill;
}
