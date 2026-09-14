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
import { iconButton } from './buttons.js';
import { getSourcePill, makeTypePill } from './type-pill.js';
import { buildSymbolSwatch } from './symbology.js';

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

        // Swatch (how it paints), then pill (what it IS), then name. The same three, in
        // the same order, as a popup's title bar and the table's head.
        const text = document.createElement('span');
        text.className = 'sgs-row-text';
        text.textContent = def.label;

        label.append(cb, buildSymbolSwatch(def), makeTypePill(getSourcePill(def.type)), text);

        const actions = document.createElement('span');
        actions.className = 'sgs-row-actions';

        const zoom = iconButton({
            glyph: 'target',
            label: `Zoom to ${def.label}`,
            onClick: () => zoomToLayer(def.id),
        });

        const table = iconButton({
            glyph: 'table',
            label: `Show ${def.label} in the table`,
            // Toggling, not merely opening: pressing it again is the obvious way to put the
            // table away, and a button that ignores its second press reads as broken.
            onClick: () => onShowTable(def.id),
        });

        actions.append(zoom, table);
        row.append(label, actions);
        body.appendChild(row);
    }
}
