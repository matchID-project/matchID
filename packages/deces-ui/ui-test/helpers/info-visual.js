// @ts-check
// Screenshot assertions for the "info" zone visual regression specs.
//
// Baselines cannot be produced locally (the stack needs the Elasticsearch
// snapshot from S3). They are generated on CI, in the Playwright container,
// with:
//   npx playwright test specs/info-visual.spec.js --update-snapshots
// and then committed next to the spec (specs/info-visual.spec.js-snapshots/).
// Until a baseline exists, a regular run (`npx playwright test`, default
// updateSnapshots: 'missing') would write it and fail the test; the helper
// skips the test instead, so the suite stays green before the first update.
const fs = require('fs');
const { test, expect } = require('@playwright/test');

/**
 * Skip the current test while one of its baselines is missing, unless the
 * run updates snapshots.
 * @param {string[]} names screenshot file names used by the test
 */
function requireBaselines(...names) {
  const info = test.info();
  const updating = ['all', 'changed'].includes(info.config.updateSnapshots);
  const missing = names.filter(name => !fs.existsSync(info.snapshotPath(name, { kind: 'screenshot' })));
  test.skip(!updating && missing.length > 0,
    `missing screenshot baseline(s) ${missing.join(', ')}: generate them with --update-snapshots`);
}

/**
 * @param {import('@playwright/test').Page | import('@playwright/test').Locator} target
 * @param {string} name
 * @param {object} [options]
 */
async function expectScreenshot(target, name, options = {}) {
  await expect(target).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
    ...options
  });
}

module.exports = { requireBaselines, expectScreenshot };
