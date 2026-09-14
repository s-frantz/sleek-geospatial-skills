/**
 * layers.js — the map's contents, declared once.
 *
 * Deliberately a hardcoded array rather than a configuration document. A starter app that
 * begins by inventing a config schema teaches you its schema, not the thing you came for. Add
 * an entry here, or replace the array with a fetch, whichever your app actually needs.
 *
 * What IS worth copying is the shape: one record per layer carrying its id, its label, where
 * its data lives, how it paints, and which fields the table shows. Everything else in the app
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
 * @property {string[]} fields the columns the table shows, in order
 * @property {string} key the property that tells one feature from another: how a table row,
 *           a popup and the map agree that they mean the same feature
 */

/** @type {LayerDef[]} */
export const LAYERS = [
    {
        id: 'neighborhoods',
        label: 'Neighborhoods',
        url: 'data/neighborhoods.geojson',
        kind: 'fill',
        type: 'geojson-file',
        visible: true,
        color: '#3f7fd4',
        fields: ['id', 'name', 'coalition', 'area_km2', 'perimeter_km'],
        key: 'id',
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
        key: 'id',
    },
];

/** Loaded feature collections, by layer id. @type {Record<string, any>} */
const _data = {};

/**
 * A filter that matches nothing: the flash layer's resting state.
 *
 * `['literal', false]`, and NOT the obvious `['==', 1, 0]`. MapLibre still accepts the old
 * `["==", key, value]` filter syntax and decides which syntax it is looking at from the second
 * element: a number there reads as a legacy filter with a non-string key, fails validation,
 * and the layer is silently never added. `addLayer` reports that as an `error` event, not a
 * throw, so the flash layers went missing while the app booted as if nothing were wrong.
 */
const NOTHING = ['literal', false];

/**
 * The ink of the selected-feature edge: a near-black neutral, fixed rather than read from the
 * theme, because the basemap underneath it is the same light style in both themes.
 */
const SELECTED_INK = '#2a2b30';

/**
 * Which features have a popup open, per layer, counted: two popups on one feature (Ctrl keeps
 * them) must both close before the feature stops looking selected.
 * @type {Map<string, Map<unknown, number>>}
 */
const _selected = new Map();

/**
 * Mark a feature as being read, or no longer, and redraw its layer's selected edge.
 * @param {string} layerId
 * @param {any} feature
 * @param {boolean} on
 * @returns {void}
 */
export function markSelected(layerId, feature, on) {
    const def = layerById(layerId);
    const value = def ? feature?.properties?.[def.key] : undefined;
    if (!def || value === undefined || value === null || !map.getLayer(`${def.id}-selected`)) return;
    const counts = _selected.get(layerId) ?? new Map();
    _selected.set(layerId, counts);
    const n = (counts.get(value) ?? 0) + (on ? 1 : -1);
    if (n > 0) counts.set(value, n); else counts.delete(value);
    map.setFilter(`${def.id}-selected`,
        counts.size ? ['in', ['get', def.key], ['literal', [...counts.keys()]]] : NOTHING);
}

/**
 * The GL ids of a layer's flash layers: a polygon gets two, a fill and a heavy edge, and a
 * point gets one filled ring.
 * @param {LayerDef} def
 * @returns {string[]}
 */
const flashIds = (def) => (def.kind === 'fill' ? [`${def.id}-flash-fill`, `${def.id}-flash`] : [`${def.id}-flash`]);

/**
 * @param {string} id
 * @returns {LayerDef|undefined}
 */
export function layerById(id) {
    return LAYERS.find((l) => l.id === id);
}

/**
 * The raw features of a layer, for the table.
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
        // The SELECTED layer: a quiet neutral edge on every feature with a popup open, so the
        // one being read looks different from the others of its kind while it is read. Neutral
        // ink rather than the layer's colour or the accent, because it marks a state of the
        // reading, not a fact of the data, and it must not compete with the flash that answers
        // "which one?". Below the flash layers, so a flash still draws over it.
        if (def.kind === 'fill') {
            map.addLayer({
                id: `${def.id}-selected`, type: 'line', source: def.id, filter: NOTHING,
                paint: { 'line-color': SELECTED_INK, 'line-width': 2.5, 'line-opacity': 0.6 },
            });
        } else {
            map.addLayer({
                id: `${def.id}-selected`, type: 'circle', source: def.id, filter: NOTHING,
                paint: {
                    // Hugging the point: its dot is 6 with a 1.5 white edge, so its ink ends at
                    // 7.5, and a 2-wide ring centred on 8.5 starts exactly there. No gap.
                    'circle-radius': 8.5,
                    'circle-color': 'rgba(0, 0, 0, 0)',
                    'circle-stroke-width': 2,
                    'circle-stroke-color': SELECTED_INK,
                    'circle-stroke-opacity': 0.6,
                },
            });
        }
        // The flash layers: this layer's own shape HIGHLIGHTED, matching NOTHING until
        // flashFeature() points them at one feature for a moment. A polygon's body is filled as
        // well as its edge drawn heavy, because an edge alone disappeared in practice: a zoom
        // fits the polygon to the screen, so its edge becomes the screen's edge, drawn in the
        // same colour as every neighbour's. Deliberately not in glLayerIds(), so hiding a layer
        // does not hide the answer to "where is the thing I just asked for?", and never bound
        // to a click, so they can never open a second popup.
        if (def.kind === 'fill') {
            map.addLayer({
                id: `${def.id}-flash-fill`, type: 'fill', source: def.id, filter: NOTHING,
                paint: { 'fill-color': def.color, 'fill-opacity': 0.5 },
            });
            map.addLayer({
                id: `${def.id}-flash`, type: 'line', source: def.id, filter: NOTHING,
                paint: { 'line-color': def.color, 'line-width': 4 },
            });
        } else {
            map.addLayer({
                id: `${def.id}-flash`, type: 'circle', source: def.id, filter: NOTHING,
                paint: {
                    'circle-radius': 11,
                    'circle-color': def.color,
                    'circle-opacity': 0.35,
                    'circle-stroke-width': 3,
                    'circle-stroke-color': def.color,
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
 * `map-camera` skill.
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

/** How long the one showing lasts, ms: about the camera's 600ms move, so it rides along. */
export const FLASH_MS = 550;
/** @type {number|undefined} */
let _flashOff;

/**
 * Flash one feature on the map: its shape highlighted once, at once, then gone.
 *
 * It answers "which one is it?" after a row or a popup has pointed at a feature. Zooming alone
 * does not: a fit to one polygon among its neighbours lands on a screen full of polygons. It
 * starts on the press, while the camera is still moving, not once it arrives: a flash that
 * waited for the move read as a second, unrelated event, and the feature sliding into place
 * already lit is what ties the press to the answer. One showing, not a blink, so there is
 * nothing here for reduced motion to calm.
 *
 * @param {string} layerId
 * @param {any} feature
 * @returns {void}
 */
export function flashFeature(layerId, feature) {
    const def = layerById(layerId);
    const value = def ? feature?.properties?.[def.key] : undefined;
    if (!def || value === undefined || value === null) return;
    if (!flashIds(def).every((id) => map.getLayer(id))) return;

    const show = (/** @type {boolean} */ on) => {
        for (const d of LAYERS) {
            for (const id of flashIds(d)) {
                if (!map.getLayer(id)) continue;
                map.setFilter(id, on && d.id === layerId ? ['==', ['get', def.key], value] : NOTHING);
            }
        }
    };
    // A newer flash replaces an older one outright, rather than letting its "off" land early.
    clearTimeout(_flashOff);
    show(true);
    _flashOff = window.setTimeout(() => show(false), FLASH_MS);
}
