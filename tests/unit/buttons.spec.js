/**
 * Icon buttons are made in one place. A second hand-built one is where a tooltip and an
 * accessible name start to disagree, so this reads the source rather than a page: it catches
 * the button before anyone has hovered it.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** @param {string} dir @returns {string[]} */
function jsFiles(dir) {
    return readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        return statSync(p).isDirectory() ? jsFiles(p) : p.endsWith('.js') ? [p] : [];
    });
}

/**
 * The buttons with words on them: each has its own role (a tab, a radio segment, a window's
 * footer action), so it is built where it is used. Everything else is an icon button.
 */
const WORDED = ['buttons.js', 'quick-settings.js', 'overlay-window.js', 'about-window.js'];

describe('icon buttons', () => {
    it('are built only by buttons.js; the files left build buttons with words on them', () => {
        const builders = jsFiles('app/js')
            .filter((f) => readFileSync(f, 'utf8').includes("createElement('button')"))
            .map((f) => f.split(/[\\/]/).pop());
        expect(builders.sort()).toEqual([...WORDED].sort());
    });
});
