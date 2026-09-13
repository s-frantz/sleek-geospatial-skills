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

/** The GL id of a layer's flash layer. @param {string} id */
const flashId = (id) => `${id}-flash`;

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
        // The flash layer: this layer's own shape drawn heavier, matching NOTHING until
        // flashFeature() points it at one feature for a moment. Deliberately not in
        // glLayerIds(), so hiding a layer does not hide the answer to "where is the thing I
        // just asked for?", and never bound to a click, so it can never open a second popup.
        map.addLayer(def.kind === 'fill'
            ? {
                id: flashId(def.id), type: 'line', source: def.id, filter: NOTHING,
                paint: { 'line-color': def.color, 'line-width': 4 },
            }
            : {
                id: flashId(def.id), type: 'circle', source: def.id, filter: NOTHING,
                paint: {
                    'circle-radius': 11,
                    'circle-color': 'rgba(0, 0, 0, 0)',
                    'circle-stroke-width': 3,
                    'circle-stroke-color': def.color,
                },
            });
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

/** Bumped by every flash, so a flash still waiting for the camera is cancelled by a newer one. */
let _flashRun = 0;
/** @type {number[]} */
let _flashTimers = [];

/**
 * Flash one feature on the map: its shape drawn heavy, twice, then gone.
 *
 * It answers "which one is it?" after a row or a popup has pointed at a feature. Zooming alone
 * does not: a fit to one polygon among its neighbours lands on a screen full of polygons. It
 * waits for the camera to arrive, because a flash on a feature still sliding into view is
 * spent before the eye has anything to settle on. Reduced motion gets one steady showing
 * rather than a blink.
 *
 * @param {string} layerId
 * @param {any} feature
 * @returns {void}
 */
export function flashFeature(layerId, feature) {
    const def = layerById(layerId);
    const value = def ? feature?.properties?.[def.key] : undefined;
    if (!def || value === undefined || value === null || !map.getLayer(flashId(layerId))) return;

    const run = ++_flashRun;
    for (const t of _flashTimers) clearTimeout(t);
    _flashTimers = [];

    const show = (/** @type {boolean} */ on) => {
        for (const d of LAYERS) {
            if (!map.getLayer(flashId(d.id))) continue;
            map.setFilter(flashId(d.id), on && d.id === layerId ? ['==', ['get', def.key], value] : NOTHING);
        }
    };
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    /** @type {Array<[number, boolean]>} */
    const steps = still ? [[0, true], [900, false]] : [[0, true], [260, false], [400, true], [700, false]];
    const start = () => {
        if (run !== _flashRun) return;
        for (const [at, on] of steps) _flashTimers.push(window.setTimeout(() => show(on), at));
    };
    if (map.isMoving()) map.once('moveend', start); else start();
}
