/**
 * quick-settings.js — the small window the gear opens.
 *
 * Two settings and a list of shortcuts. That is the point: this is the SHIPPED surface, the
 * handful of things a reader of the map might reasonably want to change, and it should stay
 * small enough to read at a glance. A full settings page, if the app grows one, goes behind a
 * quiet link at the bottom rather than being merged into this list.
 *
 * It is a popover anchored under its control, not a modal. A modal for two toggles is a
 * ceremony, and it takes the map away from you while you adjust how the map behaves. Escape
 * and an outside click both close it, and both are wired here rather than being left to the
 * caller.
 */

import { getTheme, setTheme } from './theme.js';
import { PLACEMENT, getPlacementMode, setPlacementMode } from './popup-placement.js';
import { repositionAll } from './popup.js';
import { pushDismissible } from './dismiss-stack.js';

/** @type {HTMLElement|null} */
let _panel = null;
/** @type {(() => void)|null} */
let _cleanup = null;

/** @returns {boolean} */
export function isQuickSettingsOpen() { return !!_panel; }

/** @returns {void} */
export function closeQuickSettings() {
    _panel?.remove();
    _panel = null;
    _cleanup?.();
    _cleanup = null;
}

/**
 * A labelled row of mutually exclusive choices, rendered as a segmented control.
 * @param {string} label
 * @param {Array<[string, string]>} choices value and text
 * @param {string} current
 * @param {(value: string) => void} onPick
 * @returns {HTMLElement}
 */
function segmentRow(label, choices, current, onPick) {
    const row = document.createElement('div');
    row.className = 'sgs-set-row';

    const name = document.createElement('span');
    name.className = 'sgs-set-label';
    name.textContent = label;

    const seg = document.createElement('div');
    seg.className = 'sgs-seg';
    seg.setAttribute('role', 'radiogroup');
    seg.setAttribute('aria-label', label);

    for (const [value, text] of choices) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'sgs-seg-btn';
        b.textContent = text;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(value === current));
        b.addEventListener('click', () => {
            onPick(value);
            for (const sib of seg.querySelectorAll('.sgs-seg-btn')) {
                sib.setAttribute('aria-checked', String(sib === b));
            }
        });
        seg.appendChild(b);
    }

    row.append(name, seg);
    return row;
}

/** The one shortcut inventory. Rendered here, and nowhere else. */
const SHORTCUTS = /** @type {Array<[string, string]>} */ ([
    ['Esc', 'Close the topmost window or popup'],
    ['?', 'Open these settings'],
    ['+ / -', 'Zoom in and out'],
]);

/**
 * @param {HTMLElement} anchor the control the popover hangs from
 * @returns {void}
 */
export function toggleQuickSettings(anchor) {
    if (_panel) { closeQuickSettings(); return; }

    const panel = document.createElement('div');
    panel.className = 'sgs-quick';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Quick settings');

    panel.appendChild(segmentRow(
        'Theme',
        [['light', 'Light'], ['dark', 'Dark'], ['system', 'System']],
        getTheme(),
        (v) => setTheme(/** @type {'light'|'dark'|'system'} */ (v)),
    ));

    panel.appendChild(segmentRow(
        'Popups',
        [[PLACEMENT.CLEAN, 'Clean'], [PLACEMENT.ADJACENT, 'Adjacent']],
        getPlacementMode(),
        (v) => {
            setPlacementMode(/** @type {'clean'|'adjacent'} */ (v));
            // Apply immediately to what is already open. A placement setting that only takes
            // effect on the next click cannot be evaluated by the person changing it.
            repositionAll();
        },
    ));

    const list = document.createElement('div');
    list.className = 'sgs-shortcuts';
    for (const [key, desc] of SHORTCUTS) {
        const row = document.createElement('div');
        row.className = 'sgs-shortcut';
        const kbd = document.createElement('kbd');
        kbd.textContent = key;
        const text = document.createElement('span');
        text.textContent = desc;
        row.append(kbd, text);
        list.appendChild(row);
    }
    panel.appendChild(list);

    document.body.appendChild(panel);

    // Anchor under the control, right-aligned to it, clamped to the viewport.
    const a = anchor.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    panel.style.top = `${Math.round(a.bottom + 8)}px`;
    panel.style.left = `${Math.round(Math.max(8, a.right - p.width))}px`;

    /** @param {MouseEvent} e */
    const onDocDown = (e) => {
        const t = /** @type {Node} */ (e.target);
        if (panel.contains(t) || anchor.contains(t)) return;
        closeQuickSettings();
    };
    document.addEventListener('pointerdown', onDocDown);
    const unregister = pushDismissible(closeQuickSettings);
    _cleanup = () => {
        document.removeEventListener('pointerdown', onDocDown);
        unregister();
    };
    _panel = panel;
}
