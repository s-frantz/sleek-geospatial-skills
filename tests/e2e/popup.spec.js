/**
 * Rung 3: popups, and the promise they make.
 *
 * The promise is not "the popup looks nice". It is "the popup does not cover the controls, the
 * panel, or the dock", and that is a claim about rectangles, which is a claim a test can
 * settle.
 */

import { test, expect } from '@playwright/test';

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 */
async function box(page, selector) {
    const b = await page.locator(selector).first().boundingBox();
    if (!b) throw new Error(`no box for ${selector}`);
    return { left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + b.height };
}

/** @param {any} a @param {any} b */
const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('body[data-ready="true"]');
});

/**
 * Click a district polygon, choosing the point by ASKING THE MAP what it has rendered rather
 * than guessing a coordinate.
 *
 * The first version of this helper clicked the centre of the viewport, which happens to land
 * between two demo polygons, so every popup test failed for a reason that had nothing to do
 * with popups. A test whose setup is a guess reports on the guess.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} [nth] which rendered district to click
 */
async function clickAFeature(page, nth = 0) {
    const pt = await page.evaluate((n) => {
        const m = window.sgsMap;
        const c = m.getCanvas();
        const w = c.clientWidth;
        const h = c.clientHeight;

        // Walk a coarse grid and collect one clickable point per district, in scan order.
        //
        // Two conditions, and both are needed. queryRenderedFeatures answers about the MAP and
        // knows nothing about the panel and the dock sitting over it, so a point can be on a
        // polygon and still be a click on the layer list. And hit testing is the only way to
        // be sure of the polygon itself, since a centroid can fall in a hole.
        //
        // Collecting per district rather than demanding a NAMED district matters: with the
        // dock open, some districts have no clickable point at all, and a test that insists on
        // one of those fails for a reason that has nothing to do with what it is testing.
        /** @type {Map<string, {x: number, y: number}>} */
        const found = new Map();
        for (let y = 40; y < h - 40; y += 12) {
            for (let x = 40; x < w - 40; x += 12) {
                const top = document.elementFromPoint(x, y);
                if (!top || !top.closest('#map')) continue;
                const hit = m.queryRenderedFeatures([x, y], { layers: ['districts-fill'] });
                for (const f of hit) {
                    const id = f.properties.id;
                    if (!found.has(id)) found.set(id, { x, y });
                }
            }
        }
        const points = [...found.values()];
        return points.length ? points[n % points.length] : null;
    }, nth);

    if (!pt) throw new Error('no district rendered to click');
    await page.mouse.click(pt.x, pt.y);
    await page.waitForTimeout(120);
    return pt;
}

test('a popup opens with the feature fields in it', async ({ page }) => {
    await clickAFeature(page);
    await expect(page.locator('.sgs-popup')).toHaveCount(1);
    await expect(page.locator('.sgs-popup .sgs-fields tr')).toHaveCount(5);
});

test('a popup never covers the control stack, the panel, or the dock', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="districts"]').hover();
    await page.locator('.sgs-row[data-layer="districts"] button[title^="Show"]').click();
    await clickAFeature(page);

    const popup = await box(page, '.sgs-popup');
    for (const furniture of ['.maplibregl-ctrl-top-right', '#sgs-panel', '#sgs-dock']) {
        expect(overlaps(popup, await box(page, furniture)), `popup overlaps ${furniture}`).toBe(false);
    }
});

test('clean stacks popups down one side without overlapping each other', async ({ page }) => {
    await clickAFeature(page, 0);
    await clickAFeature(page, 5);
    await expect(page.locator('.sgs-popup')).toHaveCount(2);

    const boxes = await page.locator('.sgs-popup').evaluateAll((els) =>
        els.map((el) => {
            const r = el.getBoundingClientRect();
            return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        }));
    expect(overlaps(boxes[0], boxes[1])).toBe(false);
    // Same column: both hard against the right edge.
    expect(Math.abs(boxes[0].right - boxes[1].right)).toBeLessThan(1);
});

test('adjacent opens the popup beside the feature instead', async ({ page }) => {
    await page.locator('[data-glyph="gear"]').first().click();
    await page.getByRole('radio', { name: 'Adjacent' }).click();
    await page.keyboard.press('Escape');

    await clickAFeature(page);
    const popup = await box(page, '.sgs-popup');
    const vp = page.viewportSize();
    if (!vp) throw new Error('no viewport');

    // Beside the click, not parked at the right edge of the window.
    expect(popup.right).toBeLessThan(vp.width - 60);
    expect(await page.locator('.sgs-popup').first().getAttribute('data-strategy'))
        .not.toBe('clean-column');
});

test('escape closes the topmost popup only', async ({ page }) => {
    await clickAFeature(page, 0);
    await clickAFeature(page, 5);
    await expect(page.locator('.sgs-popup')).toHaveCount(2);

    await page.keyboard.press('Escape');
    await expect(page.locator('.sgs-popup')).toHaveCount(1);
});

test('a popup keeps its leader line pointed at its feature while the map moves', async ({ page }) => {
    await clickAFeature(page);
    const before = await page.locator('.sgs-leader').first().evaluate((el) => ({
        x: Number(el.getAttribute('x2')), y: Number(el.getAttribute('y2')),
    }));

    await page.evaluate(() => window.sgsMap.panBy([120, 60], { duration: 0 }));
    await page.waitForTimeout(200);

    const after = await page.locator('.sgs-leader').first().evaluate((el) => ({
        x: Number(el.getAttribute('x2')), y: Number(el.getAttribute('y2')),
    }));

    // panBy moves the CAMERA right and down, so the feature moves left and up on screen by
    // the same amount. The leader's far end must follow it, or the line is pointing at where
    // the feature used to be.
    expect(after.x - before.x).toBeCloseTo(-120, 0);
    expect(after.y - before.y).toBeCloseTo(-60, 0);
});

test('the large window opens, stacks, and escape closes only the top one', async ({ page }) => {
    await clickAFeature(page);
    await page.locator('[data-glyph="info"]').first().click();
    await expect(page.locator('.sgs-window')).toHaveCount(1);

    // The window is on top of the popup, so Escape takes the window first.
    await page.keyboard.press('Escape');
    await expect(page.locator('.sgs-window')).toHaveCount(0);
    await expect(page.locator('.sgs-popup')).toHaveCount(1);
});
