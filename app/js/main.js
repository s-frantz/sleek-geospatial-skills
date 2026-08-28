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
import { addAllLayers, LAYERS, layerById, interactiveLayerId } from './layers.js';
import { initPanel } from './ui/panel.js';
import { renderLayerRows } from './ui/layer-rows.js';
import { initDock, toggleLayerTable } from './ui/dock.js';
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
initDock();

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
                onOpenTable: toggleLayerTable,
            });
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
});
