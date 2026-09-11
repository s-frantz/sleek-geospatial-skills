/**
 * Rung 3: the three theme states paint the right colours, read as numbers.
 *
 * The unit spec proves the theme is written in one place; this proves that one place works.
 * Each state is reached the way a reader reaches it (an operating-system preference, a stored
 * choice restored before first paint), and every assertion is a computed colour, never a
 * screenshot. See the `ui-theme` skill.
 */

import { test, expect } from '@playwright/test';

/**
 * @param {import('@playwright/test').Page} page
 * @param {'light'|'dark'} os what prefers-color-scheme reports
 * @param {'light'|'dark'|null} stored the reader's saved choice; null is system
 */
async function open(page, os, stored) {
    await page.emulateMedia({ colorScheme: os });
    await page.addInitScript((s) => {
        localStorage.clear();
        if (s) localStorage.setItem('sgs-theme', s);
    }, stored);
    await page.goto('/');
    await page.waitForSelector('body[data-ready="true"]');
}

/**
 * Computed colours come back as `rgb()` for plain values and as `color(srgb ...)` for anything
 * that went through color-mix(), so both are read. Returns 0-255 channels and an alpha.
 * @param {string} css
 */
function parse(css) {
    const n = css.match(/[\d.]+/g)?.map(Number) ?? [];
    if (css.startsWith('color(srgb')) return { rgb: n.slice(0, 3).map((v) => v * 255), a: n[3] ?? 1 };
    return { rgb: n.slice(0, 3), a: n[3] ?? 1 };
}

/** WCAG relative luminance. @param {number[]} rgb */
function luminance(rgb) {
    const [r, g, b] = rgb.map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** @param {number[]} a @param {number[]} b */
const contrast = (a, b) => {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
};

/** @param {import('@playwright/test').Page} page @param {string} sel @param {string} prop */
const read = (page, sel, prop) =>
    page.locator(sel).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

const LIGHT_GROUND = 'rgb(255, 255, 255)';
const DARK_GROUND = 'rgb(42, 45, 52)';

for (const [os, stored, expected] of /** @type {const} */ ([
    ['light', null, LIGHT_GROUND],
    ['dark', null, DARK_GROUND],
    ['dark', 'light', LIGHT_GROUND],
    ['light', 'dark', DARK_GROUND],
])) {
    test(`os ${os}, stored ${stored ?? 'nothing (system)'}: the panel ground is ${expected}`, async ({ page }) => {
        await open(page, os, stored);
        expect(await read(page, '#sgs-panel', 'background-color')).toBe(expected);
        // MapLibre's own control group paints a fixed #fff; it must follow the theme too.
        expect(await read(page, '.maplibregl-ctrl-group', 'background-color')).toBe(expected);
    });
}

test('the panel head is one step off the ground, sunk in light and lifted in dark', async ({ page }) => {
    await open(page, 'light', 'light');
    const lightHead = luminance(parse(await read(page, '.sgs-panel-head', 'background-color')).rgb);
    const lightBody = luminance(parse(await read(page, '#sgs-panel', 'background-color')).rgb);
    expect(lightHead).toBeLessThan(lightBody);

    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    const darkHead = luminance(parse(await read(page, '.sgs-panel-head', 'background-color')).rgb);
    const darkBody = luminance(parse(await read(page, '#sgs-panel', 'background-color')).rgb);
    expect(darkHead).toBeGreaterThan(darkBody);
    // One step, not a different surface: close enough to read as the same card.
    expect(contrast(parse(await read(page, '.sgs-panel-head', 'background-color')).rgb,
        parse(await read(page, '#sgs-panel', 'background-color')).rgb)).toBeLessThan(1.3);
});

test('MapLibre\'s divider between stacked buttons is not a bright line on a dark group', async ({ page }) => {
    await open(page, 'dark', null);
    const divider = parse(await read(page, '.maplibregl-ctrl-group button + button', 'border-top-color')).rgb;
    const ground = parse(DARK_GROUND).rgb;
    // #ddd against the dark ground measures about 9:1. A divider one step off it is barely 1.3.
    expect(contrast(divider, ground)).toBeLessThan(1.6);
});

for (const theme of /** @type {const} */ (['light', 'dark'])) {
    test(`every source pill's text is legible on its own plate in ${theme}`, async ({ page }) => {
        await open(page, theme, theme);
        const pills = await page.locator('.sgs-source-pill').evaluateAll((els) =>
            els.map((el) => ({ fg: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor })));
        expect(pills.length).toBeGreaterThan(0);
        for (const { fg, bg } of pills) {
            expect(contrast(parse(fg).rgb, parse(bg).rgb)).toBeGreaterThanOrEqual(4.5);
        }
    });
}
