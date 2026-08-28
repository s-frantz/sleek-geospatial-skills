/**
 * dock.js — the bottom dock: a band across the foot of the map that FOLDS rather than stows.
 *
 * Why fold and not stow: the dock's head goes on saying something useful while shut. "Stations,
 * 24 rows" is a fact you want while you are looking at the map, and it is exactly what a fold
 * preserves and a stow throws away. Apply the same test to anything you add here. See the
 * `stow` skill.
 *
 * There is no convention in this file about what goes IN the table, on purpose. Rows come from
 * whatever the caller hands over, columns from the layer's `fields`. Sorting, paging, editing,
 * selection models and virtualisation are all things a real table needs and all things whose
 * right answer depends on your data. What is worth taking is the band: where it sits, how it
 * folds, how it reports while folded, and that the camera knows it is there.
 */

import { featuresOf, layerById, zoomToFeature } from '../layers.js';
import { makeFoldable } from './stow.js';

/** @type {ReturnType<typeof makeFoldable>|null} */
let _fold = null;
/** @type {HTMLElement} */
let _label;
/** @type {HTMLElement} */
let _body;

/**
 * @param {HTMLElement} dock
 * @param {() => void} [onChange] fires when the dock's height changes, so the camera can
 *        re-pad and open popups can re-place
 * @returns {void}
 */
export function initDock(dock, onChange) {
    const control = /** @type {HTMLButtonElement} */ (dock.querySelector('.sgs-fold'));
    _label = /** @type {HTMLElement} */ (dock.querySelector('#sgs-dock-label'));
    _body = /** @type {HTMLElement} */ (dock.querySelector('#sgs-dock-body'));

    _fold = makeFoldable({
        section: dock,
        control,
        body: _body,
        folded: true,
        onChange: () => onChange?.(),
    });
}

/**
 * Fill the dock with one layer's rows and open it.
 * @param {string} layerId
 * @returns {void}
 */
export function showLayerTable(layerId) {
    const def = layerById(layerId);
    if (!def) return;
    const features = featuresOf(layerId);

    // The head keeps reporting while folded. This is the sentence that makes a fold the right
    // verb here rather than a stow.
    _label.textContent = `${def.label}, ${features.length} rows`;

    _body.textContent = '';
    const table = document.createElement('table');
    table.className = 'sgs-table';

    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    for (const f of def.fields) {
        const th = document.createElement('th');
        th.textContent = f;
        hr.appendChild(th);
    }
    thead.appendChild(hr);

    const tbody = document.createElement('tbody');
    for (const feat of features) {
        const tr = document.createElement('tr');
        tr.tabIndex = 0;
        for (const f of def.fields) {
            const td = document.createElement('td');
            const v = feat.properties?.[f];
            td.textContent = v === null || v === undefined ? '' : String(v);
            tr.appendChild(td);
        }
        // Row to map. The camera pads for the dock itself, so the feature does not land
        // underneath the row you clicked to find it.
        const go = () => zoomToFeature(feat);
        tr.addEventListener('dblclick', go);
        tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
        tbody.appendChild(tr);
    }

    table.append(thead, tbody);
    _body.appendChild(table);
    _fold?.unfold();
}
