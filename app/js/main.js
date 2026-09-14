/**
 * main.js — boot and wiring, and nothing else.
 *
 * The entry point's job is to say in what ORDER things come up and WHO tells whom. When it
 * starts containing decisions, every module below it becomes hard to test, because the only
 * way to reach them is through a running page.
 *
 * The order that matters:
 *   1. furniture first, because the camera's padding is measured off it;
 *   2. controls;
 *   3. data, once the style has loaded, because a layer cannot be added to a style that is
 *      not there yet;
 *   4. interactions last, once there is something to interact with.
 */

import { map } from './map.js';
import { addAllLayers, LAYERS, layerById, interactiveLayerId, markSelected } from './layers.js';
import { initPanel } from './ui/panel.js';
import { renderLayerRows } from './ui/layer-rows.js';
import {
    initTable, toggleLayerTable, toggleFeatureInTable, featureTableState, FEATURE_TABLE_LABELS,
    releaseFeatureRow,
} from './ui/table.js';
import { makeControl } from './ui/control-stack.js';
import { settingsControl } from './ui/settings-control.js';
import { toggleQuickSettings } from './ui/quick-settings.js';
import { openAboutWindow } from './ui/about-window.js';
import { openPopup } from './ui/popup.js';
import { installTooltips } from './ui/tooltip.js';
import { adoptControlGlyphs } from './ui/control-glyphs.js';

// One themed tooltip app-wide: every `title=` becomes the shared rounded bubble, clamped to
// the viewport. Delegated, so nothing below needs to know it exists.
installTooltips();

// ── 1. Furniture ─────────────────────────────────────────────────────────────────────────
initPanel(/** @type {HTMLElement} */ (document.getElementById('sgs-panel')));
initTable();

// ── 2. Controls ──────────────────────────────────────────────────────────────────────────
map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
// The scale bar is USEFUL, so it sits with the attribution rather than being decoration:
// added after it, which places it just above the pill.
map.addControl(new maplibregl.ScaleControl({ maxWidth: 96, unit: 'metric' }), 'bottom-right');
map.addControl(settingsControl(), 'top-right');
map.addControl(new maplibregl.NavigationControl(), 'top-right');
map.addControl(new maplibregl.GeolocateControl({}), 'top-right');
map.addControl(makeControl([{
    glyph: 'info',
    title: 'About this app',
    onClick: () => openAboutWindow(),
}]), 'top-right');

// MapLibre's zoom, compass and geolocate ship as baked background images in one fixed colour.
// Replace them with this app's own glyphs so the whole stack is one family and inherits
// `color`. Runs after every control is mounted; see control-glyphs.js.
adoptControlGlyphs();

// ── 3. Data ──────────────────────────────────────────────────────────────────────────────
map.on('load', async () => {
    await addAllLayers();
    renderLayerRows(
        /** @type {HTMLElement} */ (document.getElementById('sgs-panel-body')),
        (layerId) => toggleLayerTable(layerId),
    );

    // ── 4. Interactions ──────────────────────────────────────────────────────────────────
    for (const def of LAYERS) {
        // One handler per logical layer, on its body rather than on every GL layer it paints
        // as. See interactiveLayerId.
        const glId = interactiveLayerId(def.id);
        map.on('click', glId, (/** @type {any} */ e) => {
            const feature = e.features?.[0];
            if (!feature) return;
            const layer = layerById(def.id);
            if (!layer) return;
            openPopup({
                lngLat: [e.lngLat.lng, e.lngLat.lat],
                title: String(feature.properties?.name ?? layer.label),
                rows: layer.fields.map((f) => /** @type {[string, unknown]} */ ([f, feature.properties?.[f]])),
                accent: layer.color,
                // A plain click replaces the open popup; Ctrl keeps it, for comparing.
                ctrlKey: !!e.originalEvent?.ctrlKey,
                layer,
                // A popup is one feature, so its table button finds that feature's row, then
                // clears it, then closes the table, and shows pressed while its row is lit.
                onOpenTable: () => toggleFeatureInTable(def.id, feature.properties?.[layer.key]),
                tableButtonState: () => {
                    const s = featureTableState(def.id, feature.properties?.[layer.key]);
                    return { pressed: s === 'lit', label: FEATURE_TABLE_LABELS[s] };
                },
                // The feature looks selected for as long as its popup is open, and a row its
                // table button lit goes dark with it.
                onClose: () => {
                    markSelected(def.id, feature, false);
                    releaseFeatureRow(def.id, feature.properties?.[layer.key]);
                },
            });
            markSelected(def.id, feature, true);
        });
        map.on('mouseenter', glId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', glId, () => { map.getCanvas().style.cursor = ''; });
    }

    document.body.dataset.ready = 'true';
});

// ── App-level keys ───────────────────────────────────────────────────────────────────────
// Everything bound here must appear in quick-settings' SHORTCUTS inventory, and vice versa.

/** True when the event target is a place the user is typing. @param {EventTarget|null} el */
function isTypingTarget(el) {
    const t = /** @type {HTMLElement|null} */ (el);
    if (!t) return false;
    const tag = (t.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
}

document.addEventListener('keydown', (e) => {
    if (isTypingTarget(e.target) || e.ctrlKey || e.altKey || e.metaKey) return;

    if (e.key === '?') {
        const gear = /** @type {HTMLElement|null} */ (document.querySelector('[data-glyph="gear"]'));
        if (gear) toggleQuickSettings(gear);
        return;
    }

    // 1 / 2 zoom out / in — reachable without a modifier and without the mouse, unlike the
    // + / - the map only hears while its canvas has focus. Shifted (! / @) takes two steps.
    if (['1', '!', '2', '@'].includes(e.key)) {
        const zoomOut = e.key === '1' || e.key === '!';
        const step = (e.key === '!' || e.key === '@') ? 2 : 1;
        map.zoomTo(map.getZoom() + (zoomOut ? -step : step));
    }

    // Arrows pan, Shift + ←/→ rotates: the steps MapLibre's own keyboard handler takes (100px,
    // 15°), for the times it cannot hear them. It listens on its canvas alone, so the arrows did
    // nothing on a fresh load, or after pressing any control (the gear, a layer toggle) until
    // the reader thought to click the map first. When the canvas has focus it handles the key
    // itself, so this steps aside; so it does inside the table, whose rows the arrows scroll.
    const dir = ARROWS[e.key];
    if (dir && !e.defaultPrevented && !isMapOrScroller(e.target)) {
        if (e.shiftKey) {
            // Shift turns the map with ←/→ and tilts it with ↑/↓, 15° and 10° a press, MapLibre's
            // own steps, so the keys behave the same whether or not its canvas has focus.
            if (dir[0]) map.easeTo({ bearing: map.getBearing() + dir[0] * 15 });
            else map.easeTo({ pitch: map.getPitch() - dir[1] * 10 });
        } else {
            map.panBy([dir[0] * 100, dir[1] * 100]);
        }
        e.preventDefault();
    }
});

/** @type {Record<string, [number, number]>} */
const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/**
 * Where the arrows already mean something: the map's canvas (MapLibre handles them there) and
 * the table's scrolling body.
 * @param {EventTarget|null} el
 */
function isMapOrScroller(el) {
    return el instanceof Element && !!el.closest('.maplibregl-canvas, .sgs-table-body');
}
