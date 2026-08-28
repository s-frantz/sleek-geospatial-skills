/**
 * theme.js — light, dark, and system.
 *
 * Three states, not two. `data-theme="light"` and `data-theme="dark"` are explicit choices;
 * NO attribute is the third state, system, where `prefers-color-scheme` decides. Writing
 * `data-theme="system"` would be a fourth thing to handle in every CSS rule for no gain: the
 * absence of the attribute already says it.
 *
 * The restore happens in a blocking inline script in index.html, not here. By the time this
 * module runs, the page has already painted, so anything this file did to prevent a flash
 * would be too late. All this module owns is CHANGING the theme afterwards.
 */

const KEY = 'sgs-theme';

/** @typedef {'light'|'dark'|'system'} ThemeMode */

/** @returns {ThemeMode} */
export function getTheme() {
    const attr = document.documentElement.getAttribute('data-theme');
    return attr === 'light' || attr === 'dark' ? attr : 'system';
}

/**
 * @param {ThemeMode} mode
 * @returns {ThemeMode} the mode now in force
 */
export function setTheme(mode) {
    if (mode === 'system') {
        document.documentElement.removeAttribute('data-theme');
        try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    } else {
        document.documentElement.setAttribute('data-theme', mode);
        try { localStorage.setItem(KEY, mode); } catch { /* ignore */ }
    }
    return mode;
}

/**
 * What the page is ACTUALLY showing right now, which is not the same question as which mode
 * is selected: in system mode the answer depends on the operating system.
 * @returns {'light'|'dark'}
 */
export function resolvedTheme() {
    const mode = getTheme();
    if (mode !== 'system') return mode;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
