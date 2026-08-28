/**
 * geo.js — geometry arithmetic, with no map in it.
 *
 * Kept separate from layers.js on purpose. layers.js constructs and touches the live map, so
 * importing it outside a browser is impossible; this file imports nothing, which is what makes
 * the rung-2 unit tests possible. When a function is arithmetic, put it where arithmetic can
 * be tested.
 */

/** @typedef {[number, number, number, number]} BBox west, south, east, north */

/**
 * Bounding box of a GeoJSON geometry, feature, or feature collection.
 * @param {any} node
 * @returns {BBox|null} null when there are no coordinates to bound
 */
export function bboxOf(node) {
    if (!node) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    /** @param {any} coords */
    const walk = (coords) => {
        if (!Array.isArray(coords)) return;
        if (typeof coords[0] === 'number') {
            if (coords[0] < minX) minX = coords[0];
            if (coords[0] > maxX) maxX = coords[0];
            if (coords[1] < minY) minY = coords[1];
            if (coords[1] > maxY) maxY = coords[1];
            return;
        }
        for (const c of coords) walk(c);
    };

    /** @type {any[]} */
    const geoms = node.type === 'FeatureCollection'
        ? node.features.map((/** @type {any} */ f) => f.geometry)
        : node.type === 'Feature' ? [node.geometry] : [node];

    for (const g of geoms) if (g?.coordinates) walk(g.coordinates);
    return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
}

/**
 * Is this bounding box a single point?
 * @param {BBox} b
 * @returns {boolean}
 */
export function isDegenerate(b) {
    return b[0] === b[2] && b[1] === b[3];
}
