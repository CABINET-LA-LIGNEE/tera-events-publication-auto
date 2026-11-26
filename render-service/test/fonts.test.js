const assert = require("node:assert/strict");
const { test } = require("node:test");
const { chromium } = require("playwright");
const { buildHtml } = require("../server");
const { layouts } = require("../layouts");
const { faces } = require("../prepare-fonts");

test("Les polices du rendu sont chargées sans réseau", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ offline: true });
    const externalRequests = [];
    await page.route(/^https?:/, route => {
      externalRequests.push(route.request().url());
      return route.abort();
    });
    await page.setContent(buildHtml(Object.keys(layouts)[0], {}));
    const loaded = await page.evaluate(async fonts => {
      const result = [];
      for (const { family, style, weight } of fonts) {
        const query = `${style} ${weight} 32px "${family}"`;
        const sample = "À Abidjan, l’équipe reçoit déjà les invités.";
        const matches = await document.fonts.load(query, sample);
        result.push(matches.length > 0 && document.fonts.check(query, sample));
      }
      return result;
    }, faces);
    assert.deepEqual(loaded, faces.map(() => true));
    assert.deepEqual(externalRequests, []);
  } finally {
    await browser.close();
  }
});
