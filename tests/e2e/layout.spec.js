/**
 * Rung 3: geometry, measured in a real browser.
 *
 * Every assertion here is a NUMBER read off `getBoundingClientRect`, not an image. When one of
 * these fails it tells you which edge is on the wrong side of which other edge, which is a
 * diagnosis. A screenshot diff would tell you that 12,431 pixels changed, which is not.
 */

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    // A clean slate: postures and popup placement are viewer preferences, and a test that
    // inherits the previous test's preferences is not a test.
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('body[data-ready="true"]');
});

test('the panel is docked at the left and the dock is folded at the foot', async ({ page }) => {
    const panel = await page.locator('#sgs-panel').boundingBox();
    const dock = await page.locator('#sgs-dock').boundingBox();
    const vp = page.viewportSize();
    if (!panel || !dock || !vp) throw new Error('missing furniture');

    expect(panel.x).toBeLessThan(24);
    expect(panel.y).toBeLessThan(24);
    // Docked and automatic: the panel reaches the bottom inset.
    expect(panel.y + panel.height).toBeGreaterThan(vp.height - 24);

    // Folded: the dock is a bar, not a band.
    expect(dock.height).toBeLessThan(60);
    expect(dock.y + dock.height).toBeGreaterThan(vp.height - 24);
});

test('the layer rows drive the map layers', async ({ page }) => {
    const visible = () => page.evaluate(() =>
        window.sgsMap.getLayoutProperty('districts-fill', 'visibility'));

    expect(await visible()).toBe('visible');
    await page.locator('.sgs-row[data-layer="districts"] input[type=checkbox]').uncheck();
    expect(await visible()).toBe('none');
});

test('opening the table opens the dock and its head reports while folded', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="stations"]').hover();
    await page.locator('.sgs-row[data-layer="stations"] button[title^="Show"]').click();

    await expect(page.locator('#sgs-dock-label')).toHaveText('Stations, 24 rows');
    const open = await page.locator('#sgs-dock').boundingBox();
    expect(open?.height).toBeGreaterThan(100);

    // Folding keeps the head, and the head keeps the sentence. This is the test that makes
    // fold the right verb here rather than stow.
    await page.locator('.sgs-fold').click();
    await expect(page.locator('#sgs-dock-label')).toHaveText('Stations, 24 rows');
    const folded = await page.locator('#sgs-dock').boundingBox();
    expect(folded?.height).toBeLessThan(60);
});

test('the panel unpins to float, and re-pins back to docked', async ({ page }) => {
    const pin = page.locator('#sgs-panel-berth button[aria-pressed]').first();
    const docked = await page.locator('#sgs-panel').boundingBox();

    await pin.click();
    await expect(page.locator('#sgs-panel')).toHaveClass(/sgs-panel--float/);
    const floating = await page.locator('#sgs-panel').boundingBox();
    // Floating hugs its content, so it no longer reaches the bottom of the window.
    expect(floating?.height).toBeLessThan((docked?.height ?? 0) - 40);

    await pin.click();
    await expect(page.locator('#sgs-panel')).not.toHaveClass(/sgs-panel--float/);
});

test('zoom to lands the layer clear of the panel and the dock', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="districts"]').hover();
    await page.locator('.sgs-row[data-layer="districts"] button[title^="Show"]').click();
    await page.locator('.sgs-row[data-layer="districts"] button[title^="Zoom"]').click();
    await page.waitForTimeout(900);

    const panel = await page.locator('#sgs-panel').boundingBox();
    const dock = await page.locator('#sgs-dock').boundingBox();
    if (!panel || !dock) throw new Error('missing furniture');

    // Project the layer's own bounding box back to the screen and check it landed in the
    // part of the window a person can actually see.
    const corners = await page.evaluate(async () => {
        const fc = await (await fetch('data/districts.geojson')).json();
        let minX = 180, minY = 90, maxX = -180, maxY = -90;
        for (const f of fc.features) {
            for (const ring of f.geometry.coordinates) {
                for (const [x, y] of ring) {
                    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
                }
            }
        }
        const a = window.sgsMap.project([minX, maxY]);
        const b = window.sgsMap.project([maxX, minY]);
        return { left: a.x, top: a.y, right: b.x, bottom: b.y };
    });

    expect(corners.left).toBeGreaterThan(panel.x + panel.width);
    expect(corners.bottom).toBeLessThan(dock.y);
});

test('a floating panel stops reserving a left band for the camera', async ({ page }) => {
    // The specifier is a variable so the type checker does not try to resolve a browser URL
    // from disk. This import happens in the page, against the same module the app uses.
    const readPad = () => page.evaluate(async () => {
        const src = '/js/utils/visible-area.js';
        const m = await import(src);
        return m.visiblePadding().left;
    });

    const padWhileDocked = await readPad();

    await page.locator('#sgs-panel-berth button[aria-pressed]').first().click();

    const padWhileFloating = await readPad();

    expect(padWhileDocked).toBeGreaterThan(padWhileFloating);
    expect(padWhileFloating).toBe(48);
});
