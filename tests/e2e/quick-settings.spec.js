/**
 * Rung 3: the quick-settings popover, read as computed colours and text.
 */

import { test, expect } from '@playwright/test';

/**
 * @param {import('@playwright/test').Page} page
 * @param {'light'|'dark'} theme
 */
async function openSettings(page, theme) {
    await page.addInitScript((t) => {
        localStorage.clear();
        localStorage.setItem('sgs-theme', t);
    }, theme);
    await page.goto('/');
    await page.waitForSelector('body[data-ready="true"]');
    await page.locator('button:has(svg[data-glyph="gear"])').click();
    await expect(page.locator('.sgs-quick')).toBeVisible();
}

/** @param {string} css @returns {number[]} */
const rgb = (css) => (css.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

for (const theme of /** @type {const} */ (['light', 'dark'])) {
    test(`the chosen segment is ink on paper swapped, not a hue, in ${theme}`, async ({ page }) => {
        await openSettings(page, theme);
        const quick = await page.locator('.sgs-quick').evaluate((el) => {
            const s = getComputedStyle(el);
            return { fg: s.color, bg: s.backgroundColor };
        });
        const chosen = await page.locator('.sgs-seg-btn[aria-checked="true"]').evaluateAll((els) =>
            els.map((el) => ({ bg: getComputedStyle(el).backgroundColor, fg: getComputedStyle(el).color })));
        expect(chosen.length).toBeGreaterThan(0);
        for (const c of chosen) {
            expect(c.bg).toBe(quick.fg);
            expect(c.fg).toBe(quick.bg);
            // And neutral: the warm cast moves the channels a few units apart, a blue plate
            // moves them over a hundred.
            const [r, g, b] = rgb(c.bg);
            expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(16);
        }
    });
}

test('the nudge line in the shortcut inventory is the short one', async ({ page }) => {
    await openSettings(page, 'light');
    const line = page.locator('.sgs-shortcut', { hasText: 'Nudge the top popup' });
    await expect(line).toHaveCount(1);
    await expect(line).not.toContainText('Shift');
});
