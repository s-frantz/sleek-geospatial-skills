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
 * @property {'auto'|'manual-w'|'manual-h'|'float'} [panelPosture]
 * @property {number} [panelW]
 * @property {number} [panelH]
 * @property {number} [panelX]
 * @property {number} [panelY]
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
