/**
 * End-to-end coverage (§18 + Phase 5): home, archive, explained entry (017),
 * fallback entry, field page, about. Static preview server (see playwright.config).
 */
import { expect, test } from '@playwright/test';

test('home shows 372 map cells, stats and field deep-links', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.fields .cell')).toHaveCount(372);
  const stats = await page.locator('.stats .stat .n').allTextContents();
  expect(stats.map((s) => s.trim().split('/')[0])).toEqual(['719', '372', '172', '17']);
  const href = await page.locator('.fc-t a').first().getAttribute('href');
  expect(href).toContain('/science/mathematics/');
  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveCount(1);
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toContain('/og/home.png');
});

test('archive has 372 rows in 17 groups with search, filters and URL sync', async ({ page }) => {
  await page.goto('archive/');
  await expect(page.locator('#groups .res')).toHaveCount(372);
  await expect(page.locator('#groups section.group')).toHaveCount(17);

  await page.locator('#q').fill('pi');
  await expect(page.locator('#groups .res:not([hidden])')).not.toHaveCount(372);
  await expect(page.locator('#groups .res:not([hidden])', { hasText: '017' })).toHaveCount(1);
  expect(page.url()).toContain('q=pi');

  await page.locator('#q').fill('');
  await page.locator('#seg button[data-v="formal"]').click();
  await expect(page.locator('#groups .res:not([hidden])')).toHaveCount(135);
  expect(page.url()).toContain('trust=formal');

  await page.locator('#reset').click();
  await expect(page.locator('#groups .res:not([hidden])')).toHaveCount(372);

  await page.goto('archive/?field=number-theory');
  await expect(page.locator('#groups .res:not([hidden])')).toHaveCount(31);
  await expect(page.locator('#count')).toContainText('31 of 372 results');
});

test('archive keyboard: / focuses search, j/k move between rows', async ({ page }) => {
  await page.goto('archive/');
  await page.keyboard.press('/');
  await expect(page.locator('#q')).toBeFocused();
  await page.keyboard.press('Escape');
  await page.keyboard.press('j');
  const first = page.locator('#groups .res a').first();
  await expect(first).toBeFocused();
  await page.keyboard.press('k');
});

test('explained entry 017 shows scorecard, chart, hype check, sources, notice', async ({
  page,
}) => {
  await page.goto('e/openai-math-2026-017/');
  await expect(page.locator('.score')).toContainText('First step');
  await expect(page.locator('.bars .bar-col')).toHaveCount(4);
  await expect(page.locator('#hype-check')).toBeVisible();
  await expect(page.locator('section[aria-labelledby="sources"] li')).not.toHaveCount(0);
  await expect(page.locator('.notice')).toContainText('not been reviewed by a person');
  await expect(page.locator('.side a[href*="x.com/intent"]')).toHaveCount(1);
  const report = await page.locator('a[href*="github.com"][href*="issues/new"]').first().getAttribute('href');
  expect(report).toContain('017');
});

test('fallback entry shows the paper card and share link', async ({ page }) => {
  await page.goto('e/openai-math-2026-003/');
  await expect(page.getByText('What the paper claims, in its own words')).toBeVisible();
  await expect(page.getByText('The plain-language explainer for this entry is still coming')).toBeVisible();
  await expect(page.locator('.side a[href*="x.com/intent"]')).toHaveCount(1);
});

test('field page filters to its subject with its own OG card', async ({ page }) => {
  await page.goto('science/mathematics/number-theory/');
  await expect(page.locator('h1')).toContainText('Number theory');
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toContain('/og/field-number-theory.png');
  const rows = await page.locator('#groups .res').count();
  expect(rows).toBeGreaterThan(0);
});

test('about documents trust labels', async ({ page }) => {
  await page.goto('about/');
  await expect(page.locator('dl.tl dt', { hasText: 'Formal proof listed' })).toBeVisible();
  await expect(page.locator('h2', { hasText: 'How entries are made' })).toBeVisible();
});

test('production domain on feed and og:image', async ({ page, request }) => {
  const feed = await (await request.get('feed.xml')).text();
  expect(feed).toContain('<link>https://nishachay.github.io/closed-form/</link>');
  await page.goto('e/openai-math-2026-017/');
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og?.startsWith('https://nishachay.github.io/closed-form/')).toBe(true);
  const share = await page.locator('.side a[href*="x.com/intent"]').getAttribute('href');
  expect(share).toContain(encodeURIComponent('https://nishachay.github.io/closed-form/e/openai-math-2026-017/'));
});

test('no horizontal scroll at 390x844 and 320x640', async ({ page }) => {
  for (const [w, h] of [[390, 844], [320, 640]] as const) {
    await page.setViewportSize({ width: w, height: h });
    for (const url of ['./', 'archive/', 'e/openai-math-2026-017/']) {
      await page.goto(url);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${url} at ${w}px`).toBeLessThanOrEqual(1);
    }
  }
});

test('archive sort menu works by mouse and keyboard', async ({ page }) => {
  await page.goto('archive/');
  await page.locator('#sort-btn').click();
  await expect(page.locator('#sort-list')).toBeVisible();
  await page.locator('#sort-list [data-v="trust"]').click();
  await expect(page.locator('#sort-list')).toBeHidden();
  await expect(page.locator('#sort-lbl')).toHaveText('Most trusted first');
  await expect(page).toHaveURL(/sort=trust/);
  await page.locator('#sort-btn').focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(page.locator('#sort-lbl')).toHaveText('By field');
});

test('entry 032 shows its withdrawn papers without counting them', async ({ page }) => {
  await page.goto('e/openai-math-2026-032/');
  await expect(page.locator('.wd-note')).toContainText('withdrew 3 papers');
  await expect(page.locator('.withdrawn li')).toHaveCount(3);
  await expect(page.locator('.orig li')).toHaveCount(5);
});
