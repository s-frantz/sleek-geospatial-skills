/**
 * layers.js — the map's contents, declared once.
 *
 * Deliberately a hardcoded array rather than a configuration document. A starter app that
 * begins by inventing a config schema teaches you its schema, not the thing you came for. Add
 * an entry here, or replace the array with a fetch, whichever your app actually needs.
 *
 * What IS worth copying is the shape: one record per layer carrying its id, its label, where
 * its data lives, how it paints, and which fields the dock shows. Everything else in the app
 * reads layers through this array, so there is exactly one place that knows what exists.
 */

import { map } from './map.js';
import { visiblePadding } from './utils/visible-area.js';
import { bboxOf, isDegenerate } from './utils/geo.js';

/**
 * @typedef {object} LayerDef
 * @property {string} id
 * @property {string} label
 * @property {string} url
 * @property {'fill'|'circle'} kind        how it paints
 * @property {string} type                  its SOURCE kind, which drives the type pill
 * @property {boolean} visible whether it starts on
 * @property {string} color
 * @property {string[]} fields the columns the dock shows, in order
 */

/** @type {LayerDef[]} */
export const LAYERS = [
    {
        id: 'districts',
        label: 'Districts',
        url: 'data/districts.geojson',
        kind: 'fill',
        type: 'geojson-file',
        visible: true,
        color: '#3f7fd4',
        fields: ['id', 'name', 'zone', 'households', 'area_km2'],
    },
    {
        id: 'stations',
        label: 'Stations',
        url: 'data/stations.geojson',
        kind: 'circle',
        type: 'geojson-file',
        visible: true,
        color: '#d4703f',
        fields: ['id', 'name', 'kind', 'capacity', 'online'],
    },
];

/** Loaded feature collections, by layer id. @type {Record<string, any>} */
const _data = {};

/**
 * @param {string} id
 * @returns {LayerDef|undefined}
 */
export function layerById(id) {
    return LAYERS.find((l) => l.id === id);
}

/**
 * The raw features of a layer, for the dock's table.
 * @param {string} id
 * @returns {any[]}
 */
export function featuresOf(id) {
    return _data[id]?.features ?? [];
}

/**
 * Fetch every layer and add it to the map. Called once, after `style.load`.
 * @returns {Promise<void>}
 */
export async function addAllLayers() {
    for (const def of LAYERS) {
        const res = await fetch(def.url);
        if (!res.ok) throw new Error(`layers.js: ${def.url} returned ${res.status}`);
        const geojson = await res.json();
        _data[def.id] = geojson;

        map.addSource(def.id, { type: 'geojson', data: geojson });

        if (def.kind === 'fill') {
            map.addLayer({
                id: `${def.id}-fill`, type: 'fill', source: def.id,
                paint: { 'fill-color': def.color, 'fill-opacity': 0.28 },
            });
            map.addLayer({
                id: `${def.id}-line`, type: 'line', source: def.id,
                paint: { 'line-color': def.color, 'line-width': 1.5 },
            });
        } else {
            map.addLayer({
                id: `${def.id}-circle`, type: 'circle', source: def.id,
                paint: {
                    'circle-radius': 6,
                    'circle-color': def.color,
                    'circle-stroke-width': 1.5,
                    'circle-stroke-color': '#fff',
                },
            });
        }
        setLayerVisible(def.id, def.visible);
    }
}

/**
 * Every MapLibre layer id belonging to one of our layers. One `LayerDef` can paint as more
 * than one MapLibre layer, which is exactly why nothing outside this file should be
 * constructing these strings.
 * @param {string} id
 * @returns {string[]}
 */
export function glLayerIds(id) {
    const def = layerById(id);
    if (!def) return [];
    return def.kind === 'fill' ? [`${id}-fill`, `${id}-line`] : [`${id}-circle`];
}

/**
 * The ONE GL layer that answers clicks for a logical layer.
 *
 * A polygon layer paints as a fill and an outline, and both are hit-testable. Bind a click
 * handler to every id from `glLayerIds` and one click near an edge opens two popups for the
 * same feature, which is the kind of bug that gets reported as "sometimes it opens twice".
 * Interaction belongs to the body of the thing, not to its outline.
 * @param {string} id
 * @returns {string}
 */
export function interactiveLayerId(id) {
    const def = layerById(id);
    return def?.kind === 'fill' ? `${id}-fill` : `${id}-circle`;
}

/**
 * @param {string} id
 * @param {boolean} on
 * @returns {void}
 */
export function setLayerVisible(id, on) {
    const def = layerById(id);
    if (!def) return;
    def.visible = on;
    for (const glId of glLayerIds(id)) {
        if (map.getLayer(glId)) map.setLayoutProperty(glId, 'visibility', on ? 'visible' : 'none');
    }
}

/**
 * Bring a layer into view, in the part of the viewport that is actually visible.
 *
 * The padding is the whole point: without it this centres the layer under the panel. See the
 * `chrome-aware-camera` skill.
 * @param {string} id
 * @returns {void}
 */
export function zoomToLayer(id) {
    const bbox = bboxOf(_data[id]);
    if (!bbox) return;
    map.fitBounds(/** @type {any} */ (bbox), { padding: visiblePadding(), duration: 600 });
}

/** Re-exported so callers do not have to know which util file it lives in. */
export { bboxOf };

/**
 * Bring one feature into view, at a sensible scale for a single thing.
 * @param {any} feature
 * @returns {void}
 */
export function zoomToFeature(feature) {
    const bbox = bboxOf(feature);
    if (!bbox) return;
    const pad = visiblePadding();
    if (isDegenerate(bbox)) {
        map.easeTo({ center: [bbox[0], bbox[1]], zoom: Math.max(map.getZoom(), 14), padding: pad, duration: 600 });
        return;
    }
    map.fitBounds(/** @type {any} */ (bbox), { padding: pad, maxZoom: 15, duration: 600 });
}
