/**
 * prefs.js — viewer preferences, one object, localStorage.
 *
 * The distinction worth keeping: a PREFERENCE is where this reader likes their furniture and
 * how they like their popups to open. It belongs to the browser, not to the map. Nothing in
 * here should ever end up in something you hand to someone else, because "the panel is 320px
 * wide and floating at 40,120" is not a fact about the data.
 *
 * Every read and write is wrapped: storage throws outright in some privacy modes, and a map
 * that will not load because it could not remember a checkbox is a bad trade.
 */

const KEY = 'sgs-prefs';

/**
 * @typedef {object} Prefs
 * @property {boolean} [panelFloat]  docked or loose
 * @property {'auto'|'manual-w'|'manual-h'|'float'} [panelPosture] superseded by panelFloat
 *           plus the presence of panelW/panelH; read once on restore for older readers, and
 *           never written again. See the "not four postures" note in panel.js.
 * @property {number} [panelW]
 * @property {number} [panelH]
 * @property {boolean} [panelFull]  the FULL takeover: overrides both size axes without
 *           overwriting either, so releasing it restores the reader's own numbers
 * @property {number} [panelX]
 * @property {number} [panelY]
 * @property {boolean} [dockFloat]  the table loose on the map rather than berthed at the foot
 * @property {boolean} [dockFull]
 * @property {number} [dockH]
 * @property {number} [dockW]   only meaningful while dockFloat; berthed, the dock is full-bleed
 * @property {number} [dockX]
 * @property {number} [dockY]
 * @property {'clean'|'adjacent'} [popupPlacement]
 * @property {boolean} [panelStowed]
 */

/** @type {Prefs|null} */
let _cache = null;

/** @returns {Prefs} */
export function getPrefs() {
    if (_cache) return _cache;
    try {
        _cache = JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch {
        _cache = {};
    }
    return _cache || {};
}

/**
 * Merge a patch into the stored preferences.
 * @param {Prefs} patch
 * @returns {Prefs} the merged result
 */
export function setPrefs(patch) {
    const next = { ...getPrefs(), ...patch };
    _cache = next;
    try {
        localStorage.setItem(KEY, JSON.stringify(next));
    } catch { /* nothing to do: the session still works, it just will not be remembered */ }
    return next;
}
