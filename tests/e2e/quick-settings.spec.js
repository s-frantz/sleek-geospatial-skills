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

/** WCAG contrast of two computed colours. @param {string} a @param {string} b */
function contrast(a, b) {
    /** @param {string} c */
    const lum = (c) => {
        const [r, g, bl] = rgb(c).map((v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
}

for (const theme of /** @type {const} */ (['light', 'dark'])) {
    test(`the chosen segment is a quiet grey plate, not a hue and not full ink, in ${theme}`, async ({ page }) => {
        await openSettings(page, theme);
        const quick = await page.locator('.sgs-quick').evaluate((el) => {
            const s = getComputedStyle(el);
            return { fg: s.color, bg: s.backgroundColor };
        });
        // The quiet text colour, read where the popover already uses it: its row labels.
        const dim = await page.locator('.sgs-set-label').first().evaluate((el) => getComputedStyle(el).color);
        const chosen = await page.locator('.sgs-seg-btn[aria-checked="true"]').evaluateAll((els) =>
            els.map((el) => ({ bg: getComputedStyle(el).backgroundColor, fg: getComputedStyle(el).color })));
        expect(chosen.length).toBeGreaterThan(0);
        for (const c of chosen) {
            expect(c.bg).toBe(dim);
            expect(c.bg).not.toBe(quick.fg);
            expect(c.fg).toBe(quick.bg);
            expect(contrast(c.fg, c.bg)).toBeGreaterThanOrEqual(4.5);
            // And a grey, not the accent: the dark theme's quiet tone is a slightly cool grey
            // (its channels spread about 25), the accent blue spreads them over 150.
            const [r, g, b] = rgb(c.bg);
            expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(40);
        }
    });
}

test('quick settings stay open through clicks on the map, and close on the gear or Escape', async ({ page }) => {
    await openSettings(page, 'light');
    await page.mouse.click(900, 450);
    await expect(page.locator('.sgs-quick')).toBeVisible();
    await page.locator('button:has(svg[data-glyph="gear"])').click();
    await expect(page.locator('.sgs-quick')).toHaveCount(0);

    await page.locator('button:has(svg[data-glyph="gear"])').click();
    await expect(page.locator('.sgs-quick')).toBeVisible();
    // Escape takes the topmost element; a popup the map click may have opened goes first.
    for (let i = 0; i < 3 && await page.locator('.sgs-quick').count(); i++) await page.keyboard.press('Escape');
    await expect(page.locator('.sgs-quick')).toHaveCount(0);
});

test('the arrows pan the map without clicking it first, the gear focused included', async ({ page }) => {
    await openSettings(page, 'light');
    const lng = () => page.evaluate(() => window.sgsMap.getCenter().lng);
    const bearing = () => page.evaluate(() => window.sgsMap.getBearing());

    // Focus on the gear, which is where pressing it leaves it: MapLibre alone would not hear this.
    let before = await lng();
    await page.keyboard.press('ArrowRight');
    await expect.poll(lng).toBeGreaterThan(before);
    await expect(page.locator('.sgs-quick')).toBeVisible();

    // And with nothing focused at all, as on a fresh load.
    await page.evaluate(() => /** @type {HTMLElement} */ (document.activeElement)?.blur());
    before = await lng();
    await page.keyboard.press('ArrowLeft');
    await expect.poll(lng).toBeLessThan(before);

    // Shift turns it with ←/→ and tilts it with ↑/↓, as the inventory says.
    await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(bearing).not.toBe(0);
    await page.keyboard.press('Shift+ArrowUp');
    await expect.poll(() => page.evaluate(() => window.sgsMap.getPitch())).toBeGreaterThan(0);
    await expect(page.locator('.sgs-shortcut', { hasText: 'Tilt the map' })).toHaveCount(1);
});

test('the nudge line in the shortcut inventory is the short one', async ({ page }) => {
    await openSettings(page, 'light');
    const line = page.locator('.sgs-shortcut', { hasText: 'Nudge the top popup' });
    await expect(line).toHaveCount(1);
    await expect(line).not.toContainText('Shift');
});
