/**
 * Rung 2: the theme is defined in one place.
 *
 * This exists because it was not. Every dark value used to be written twice, once under
 * `@media (prefers-color-scheme: dark)` for the system state and once under
 * `[data-theme="dark"]` for the explicit one, and four component files carried their own pair
 * of blocks with hand-picked dark hexes. Copies drift, and a dark value missing from one of
 * the two blocks shows up only in the one theme state nobody happened to check.
 *
 * Now tokens.css names the three states in three `color-scheme` lines and every colour is a
 * `light-dark()` pair. These assertions keep it that way: they read the stylesheets as text,
 * so they need no browser. The e2e theme spec checks that the result actually paints.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const cssRoot = fileURLToPath(new URL('../../app/css/', import.meta.url));

/** @param {string} dir @returns {string[]} */
const cssFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? cssFiles(join(dir, e.name)) : e.name.endsWith('.css') ? [join(dir, e.name)] : []);

/** Comments removed, so a comment that EXPLAINS the rule does not trip it. @param {string} f */
const code = (f) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const tokens = code(join(cssRoot, 'tokens.css'));

describe('one place for the theme', () => {
    it('no stylesheet but tokens.css mentions a theme state', () => {
        const offenders = cssFiles(cssRoot)
            .filter((f) => !f.endsWith('tokens.css'))
            .filter((f) => /data-theme|prefers-color-scheme/.test(code(f)))
            .map((f) => relative(cssRoot, f));
        expect(offenders).toEqual([]);
    });

    it('tokens.css names the states only to set color-scheme', () => {
        expect(tokens).not.toMatch(/prefers-color-scheme/);
        const stateRules = [...tokens.matchAll(/:root\[data-theme="(\w+)"\]\s*\{([^}]*)\}/g)];
        expect(stateRules.map((m) => m[1]).sort()).toEqual(['dark', 'light']);
        for (const [, , body] of stateRules) {
            expect(body.trim()).toMatch(/^color-scheme:\s*\w+;?$/);
        }
        expect(tokens).toMatch(/:root\s*\{\s*color-scheme:\s*light dark;?\s*\}/);
    });

    it('every colour token carries both halves in one light-dark() pair', () => {
        const decls = [...tokens.matchAll(/(--sgs-[\w-]+)\s*:\s*([^;]+);/g)];
        const colourTokens = decls.filter(([, , v]) => /#[0-9a-f]{3,8}\b|rgba?\(/i.test(v));
        expect(colourTokens.length).toBeGreaterThan(8);
        const single = colourTokens.filter(([, , v]) => !v.includes('light-dark(')).map(([, n]) => n);
        expect(single).toEqual([]);
    });
});
