/**
 * Rung 3: popups, and the promises they make.
 *
 * The promises are behavioural, so the assertions are numbers and counts: one popup per
 * plain click, a cascade under Ctrl, a leader line whose far end is the feature, a popup
 * that stays where it was put while the map moves under it.
 */

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('body[data-ready="true"]');
});

test('the popup field table stripes every other row without losing its sunk name column', async ({ page }) => {
    await clickAFeature(page, 0);
    const rows = page.locator('.sgs-popup').last().locator('.sgs-fields tr');
    /** @param {number} n 0-based @param {string} cell */
    const paint = (n, cell) => rows.nth(n).locator(cell).evaluate((el) => {
        const s = getComputedStyle(el);
        return { image: s.backgroundImage, color: s.backgroundColor };
    });
    expect((await paint(0, 'td.sgs-field-type-col')).image).toBe('none');
    expect((await paint(1, 'td.sgs-field-type-col')).image).toContain('gradient');
    // The field-name column keeps its own sunk background under the stripe, which is the
    // reason the stripe is an image over the cell rather than a background on the row.
    const unstriped = await paint(0, 'th');
    const striped = await paint(1, 'th');
    expect(striped.image).toContain('gradient');
    expect(striped.color).toBe(unstriped.color);
});

test('the popup table button finds its feature: the row lit and in view; again, the table goes', async ({ page }) => {
    await clickAFeature(page, 3);
    const popup = page.locator('.sgs-popup').last();
    const title = (await popup.locator('.sgs-popup-title').textContent()) ?? '';
    const find = popup.locator('button[aria-label="Find this feature in the table"]');

    await find.click();
    const hit = page.locator('#sgs-dock tbody tr.sgs-row-hit');
    await expect(hit).toHaveCount(1);
    // Cells run go-to, id, name: the lit row is the popup's own feature, by name.
    await expect(hit.locator('td').nth(2)).toHaveText(title);

    // In view inside the dock's scrolling body, not merely present somewhere in the DOM.
    const r = await hit.boundingBox();
    const b = await page.locator('#sgs-dock .sgs-dock-body').boundingBox();
    if (!r || !b) throw new Error('no geometry');
    expect(r.y).toBeGreaterThanOrEqual(b.y - 1);
    expect(r.y + r.height).toBeLessThanOrEqual(b.y + b.height + 1);

    // Pressed again on the row it already lit: the table goes, as the layer row's button does.
    await find.click();
    await expect(page.locator('#sgs-dock')).toHaveCount(0);
});

/**
 * Click a district polygon, choosing the point by ASKING THE MAP what it has rendered
 * rather than guessing a coordinate.
 *
 * The first version of this helper clicked the centre of the viewport, which happens to
 * fall in a gap between demo polygons, so every popup test failed for a reason that had
 * nothing to do with popups. And a point can be ON a polygon yet UNDER the panel, in which
 * case the click goes to the layer list: `queryRenderedFeatures` answers about the map and
 * knows nothing about the DOM over it, so `elementFromPoint` gets a veto. A test whose
 * setup is a guess reports on the guess.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} [nth] which rendered district to click
 * @param {boolean} [ctrl] hold Ctrl for the click
 */
async function clickAFeature(page, nth = 0, ctrl = false) {
    const pt = await page.evaluate((n) => {
        const m = window.sgsMap;
        const c = m.getCanvas();
        const w = c.clientWidth;
        const h = c.clientHeight;
        /** @type {Map<string, {x: number, y: number}>} */
        const found = new Map();
        for (let y = 40; y < h - 40; y += 12) {
            for (let x = 40; x < w - 40; x += 12) {
                const top = document.elementFromPoint(x, y);
                if (!top || !top.closest('#map')) continue;
                const hit = m.queryRenderedFeatures([x, y], { layers: ['neighborhoods-fill'] });
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
    if (ctrl) await page.keyboard.down('Control');
    await page.mouse.click(pt.x, pt.y);
    if (ctrl) await page.keyboard.up('Control');
    await page.waitForTimeout(120);
    return pt;
}

/** @param {import('@playwright/test').Page} page @param {number} [i] */
async function popupBox(page, i = 0) {
    const b = await page.locator('.sgs-popup').nth(i).boundingBox();
    if (!b) throw new Error('no popup box');
    return b;
}

test('a popup opens with the feature fields in it', async ({ page }) => {
    await clickAFeature(page);
    await expect(page.locator('.sgs-popup')).toHaveCount(1);
    await expect(page.locator('.sgs-popup .sgs-fields tr')).toHaveCount(5);
});

test('a plain click REPLACES the open popup; Ctrl keeps it', async ({ page }) => {
    await clickAFeature(page, 0);
    await clickAFeature(page, 5);
    // Two plain clicks, one popup: browsing does not accumulate.
    await expect(page.locator('.sgs-popup')).toHaveCount(1);

    await clickAFeature(page, 0, true);
    // Ctrl is the deliberate comparison gesture.
    await expect(page.locator('.sgs-popup')).toHaveCount(2);
});

test('clean popups open beside the panel and stacked ones cascade right', async ({ page }) => {
    await clickAFeature(page, 0);
    const panel = await page.locator('#sgs-panel').boundingBox();
    const first = await popupBox(page);
    if (!panel) throw new Error('no panel');

    // The clean home: just right of the occluding panel, at the top, out of the map's way.
    expect(first.x).toBeGreaterThanOrEqual(panel.x + panel.width);
    expect(first.x).toBeLessThan(panel.x + panel.width + 40);
    expect(first.y).toBeLessThan(24);

    await clickAFeature(page, 5, true);
    const second = await popupBox(page, 1);
    // Cascade: one step right, same top, so both title bars stay grabbable.
    expect(Math.round(second.x - first.x)).toBe(40);
    expect(Math.abs(second.y - first.y)).toBeLessThan(2);
});

test('the leader line runs from the clicked feature to the popup', async ({ page }) => {
    const pt = await clickAFeature(page);
    const popup = await popupBox(page);
    const line = await page.locator('.sgs-leader').first().evaluate((el) => ({
        x1: Number(el.getAttribute('x1')), y1: Number(el.getAttribute('y1')),
        x2: Number(el.getAttribute('x2')), y2: Number(el.getAttribute('y2')),
    }));
    // Feature end: where we clicked. Popup end: the popup's centre.
    expect(Math.abs(line.x1 - pt.x)).toBeLessThan(3);
    expect(Math.abs(line.y1 - pt.y)).toBeLessThan(3);
    expect(Math.abs(line.x2 - (popup.x + popup.width / 2))).toBeLessThan(3);
    expect(Math.abs(line.y2 - (popup.y + popup.height / 2))).toBeLessThan(3);
});

test('a popup stays where it was put while the map pans; only its leader tracks', async ({ page }) => {
    await clickAFeature(page);
    const before = await popupBox(page);
    const lineBefore = await page.locator('.sgs-leader').first().evaluate((el) => ({
        x1: Number(el.getAttribute('x1')), y1: Number(el.getAttribute('y1')),
    }));

    await page.evaluate(() => window.sgsMap.panBy([120, 60], { duration: 0 }));
    await page.waitForTimeout(200);

    const after = await popupBox(page);
    const lineAfter = await page.locator('.sgs-leader').first().evaluate((el) => ({
        x1: Number(el.getAttribute('x1')), y1: Number(el.getAttribute('y1')),
    }));

    // The popup is the reader's: it does not chase the camera.
    expect(Math.abs(after.x - before.x)).toBeLessThan(2);
    expect(Math.abs(after.y - before.y)).toBeLessThan(2);
    // The feature moved 120,60 up-left in screen space, and the leader followed it.
    expect(lineAfter.x1 - lineBefore.x1).toBeCloseTo(-120, 0);
    expect(lineAfter.y1 - lineBefore.y1).toBeCloseTo(-60, 0);
});

test('a popup drags by its head, and the leader follows the popup end', async ({ page }) => {
    await clickAFeature(page);
    const before = await popupBox(page);

    const head = await page.locator('.sgs-popup-head').boundingBox();
    if (!head) throw new Error('no head');
    await page.mouse.move(head.x + head.width / 3, head.y + head.height / 2);
    await page.mouse.down();
    await page.mouse.move(head.x + head.width / 3 + 150, head.y + head.height / 2 + 90, { steps: 5 });
    await page.mouse.up();

    const after = await popupBox(page);
    expect(after.x - before.x).toBeCloseTo(150, -1);
    expect(after.y - before.y).toBeCloseTo(90, -1);

    const line = await page.locator('.sgs-leader').first().evaluate((el) => ({
        x2: Number(el.getAttribute('x2')), y2: Number(el.getAttribute('y2')),
    }));
    expect(Math.abs(line.x2 - (after.x + after.width / 2))).toBeLessThan(3);
    expect(Math.abs(line.y2 - (after.y + after.height / 2))).toBeLessThan(3);
});

test('adjacent opens the popup beside the feature instead of at the clean home', async ({ page }) => {
    await page.locator('[data-glyph="gear"]').first().click();
    await page.getByRole('radio', { name: 'Adjacent' }).click();
    await page.keyboard.press('Escape');

    const pt = await clickAFeature(page);
    const popup = await popupBox(page);
    const strategy = await page.locator('.sgs-popup').first().getAttribute('data-strategy');
    expect(strategy).not.toBe('clean');
    // Near the question, not parked at the top of the screen.
    const cx = popup.x + popup.width / 2;
    const cy = popup.y + popup.height / 2;
    expect(Math.hypot(cx - pt.x, cy - pt.y)).toBeLessThan(450);
});

test('escape closes the topmost popup only', async ({ page }) => {
    await clickAFeature(page, 0);
    await clickAFeature(page, 5, true);
    await expect(page.locator('.sgs-popup')).toHaveCount(2);

    await page.keyboard.press('Escape');
    await expect(page.locator('.sgs-popup')).toHaveCount(1);
});

test('a clean popup never covers the panel or the dock', async ({ page }) => {
    await page.locator('.sgs-row[data-layer="neighborhoods"]').hover();
    await page.locator('.sgs-row[data-layer="neighborhoods"] button[aria-label^="Show"]').click();
    await clickAFeature(page);

    const popup = await popupBox(page);
    for (const sel of ['#sgs-panel', '#sgs-dock']) {
        const f = await page.locator(sel).boundingBox();
        if (!f) throw new Error(`no box for ${sel}`);
        const clear = popup.x >= f.x + f.width || popup.x + popup.width <= f.x
            || popup.y >= f.y + f.height || popup.y + popup.height <= f.y;
        expect(clear, `popup overlaps ${sel}`).toBe(true);
    }
});

test('the large window opens over a popup, and escape closes only the top one', async ({ page }) => {
    await clickAFeature(page);
    await page.locator('[data-glyph="info"]').first().click();
    await expect(page.locator('.sgs-window')).toHaveCount(1);

    await page.keyboard.press('Escape');
    await expect(page.locator('.sgs-window')).toHaveCount(0);
    await expect(page.locator('.sgs-popup')).toHaveCount(1);
});
