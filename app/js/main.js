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
import { initPanel, onPanelGeometryChange } from './ui/panel.js';
import { renderLayerRows } from './ui/layer-rows.js';
import { initDock, showLayerTable } from './ui/dock.js';
import { makeControl } from './ui/control-stack.js';
import { settingsControl } from './ui/settings-control.js';
import { toggleQuickSettings } from './ui/quick-settings.js';
import { openAboutWindow } from './ui/about-window.js';
import { openPopup, repositionAll } from './ui/popup.js';

// ── 1. Furniture ─────────────────────────────────────────────────────────────────────────
const panelEl = /** @type {HTMLElement} */ (document.getElementById('sgs-panel'));
const dockEl = /** @type {HTMLElement} */ (document.getElementById('sgs-dock'));

initPanel(panelEl);
initDock(dockEl, () => repositionAll());

// Furniture that moves changes where a popup is allowed to be. Nothing else needs to know.
onPanelGeometryChange(() => repositionAll());

// ── 2. Controls ──────────────────────────────────────────────────────────────────────────
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
map.addControl(settingsControl(), 'top-right');
map.addControl(makeControl([{
    glyph: 'info',
    title: 'About this app',
    onClick: () => openAboutWindow(),
}]), 'top-right');
map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

// ── 3. Data ──────────────────────────────────────────────────────────────────────────────
map.on('load', async () => {
    await addAllLayers();
    renderLayerRows(
        /** @type {HTMLElement} */ (document.getElementById('sgs-panel-body')),
        (layerId) => showLayerTable(layerId),
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
            });
        });
        map.on('mouseenter', glId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', glId, () => { map.getCanvas().style.cursor = ''; });
    }

    document.body.dataset.ready = 'true';
});

// One keyboard shortcut wired here because it belongs to the app, not to any panel.
document.addEventListener('keydown', (e) => {
    const t = /** @type {HTMLElement|null} */ (e.target);
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    if (e.key === '?') {
        const gear = /** @type {HTMLElement|null} */ (document.querySelector('[data-glyph="gear"]'));
        if (gear) toggleQuickSettings(gear);
    }
});
