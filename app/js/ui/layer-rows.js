/**
 * layer-rows.js — what the panel has in it.
 *
 * Deliberately thin. A checkbox, a label, and two row actions, built straight from the
 * `LAYERS` array. There is no layer model, no group tree, no reordering, and no symbology
 * here, because the panel's INTERIOR is the part of a map app most likely to be wrong for
 * your data. The parts worth taking are the panel's geometry (panel.js) and its relationship
 * to the camera (visible-area.js), and both of those work whatever you put in here.
 *
 * The one convention worth keeping: row actions are icon buttons at the right end of the row,
 * revealed on hover and focus but always present in the accessibility tree. A control that
 * only exists on hover is a control a keyboard cannot reach.
 */

import { LAYERS, setLayerVisible, zoomToLayer } from '../layers.js';
import { icon } from '../icons.js';

/**
 * @param {HTMLElement} body the panel body to fill
 * @param {(layerId: string) => void} onShowTable
 * @returns {void}
 */
export function renderLayerRows(body, onShowTable) {
    body.textContent = '';

    for (const def of LAYERS) {
        const row = document.createElement('div');
        row.className = 'sgs-row';
        row.dataset.layer = def.id;

        const label = document.createElement('label');
        label.className = 'sgs-row-label';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = def.visible;
        cb.addEventListener('change', () => setLayerVisible(def.id, cb.checked));

        const swatch = document.createElement('span');
        swatch.className = 'sgs-swatch';
        swatch.style.background = def.color;

        const text = document.createElement('span');
        text.className = 'sgs-row-text';
        text.textContent = def.label;

        label.append(cb, swatch, text);

        const actions = document.createElement('span');
        actions.className = 'sgs-row-actions';

        const zoom = document.createElement('button');
        zoom.type = 'button';
        zoom.className = 'sgs-icon-btn';
        zoom.title = `Zoom to ${def.label}`;
        zoom.setAttribute('aria-label', zoom.title);
        zoom.innerHTML = icon('target', 12);
        zoom.addEventListener('click', () => zoomToLayer(def.id));

        const table = document.createElement('button');
        table.type = 'button';
        table.className = 'sgs-icon-btn';
        table.title = `Show ${def.label} in the table`;
        table.setAttribute('aria-label', table.title);
        table.innerHTML = icon('table', 12);
        table.addEventListener('click', () => onShowTable(def.id));

        actions.append(zoom, table);
        row.append(label, actions);
        body.appendChild(row);
    }
}
