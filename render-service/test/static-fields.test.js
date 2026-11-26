const assert = require("node:assert/strict");
const { once } = require("node:events");
const { test } = require("node:test");
const { app, closeBrowser } = require("../server");
const { templates } = require("../template-specs.json");

test("Le cartouche fixe est obligatoire sur les cinq slides et ses erreurs renvoient 400", async () => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    for (let slide = 1; slide <= 5; slide++) {
      const url = `http://127.0.0.1:${server.address().port}/render/tera-chiffremercredi-s${slide}?debug=html`;
      const fields = Object.keys(templates[`tera-chiffremercredi-s${slide}`].fields)
        .filter(field => field !== "edition_label");
      const fixture = Object.fromEntries(fields.map(field => [field, "1"]));
      for (const [data, expectedLength] of [
        [{}, 0],
        [{ edition_label: "Le chiffre du mercredi !" }, 24],
        [{ edition_label: "Le chiffre\ndu mercredi" }, 22],
        [{ edition_label: "Le chiffre du mercredi" }, null],
      ]) {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...fixture, ...data })
        });
        if (expectedLength === null) {
          assert.equal(response.status, 200);
          assert.match(await response.text(), /Le chiffre du mercredi/);
        } else {
          assert.equal(response.status, 400);
          assert.deepEqual(await response.json(), {
            error: "invalid_static_field", field: "edition_label", length: expectedLength, maxChars: 22
          });
        }
      }
    }
    const base = `http://127.0.0.1:${server.address().port}`;
    const specs = await fetch(base + "/specs");
    assert.deepEqual((await specs.json()).templates, templates);
    const overflow = await fetch(base + "/render/tera-ancragevendredi-b?debug=html", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ headline: "A".repeat(91), body: "Un exemple." })
    });
    assert.equal(overflow.status, 422);
    assert.equal((await overflow.json()).fields[0].field, "headline");
    const measured = await fetch(base + "/render/tera-ancragevendredi-b", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ headline: "Une idée", body: "Un\nDeux\nTrois" })
    });
    assert.equal(measured.status, 422);
    const { fields: diagnostics } = await measured.json();
    const body = diagnostics.find(issue => issue.field === "body" && issue.reason === "lines");
    assert.equal(body.size, templates["tera-ancragevendredi-b"].fields.body.minSize);
  } finally {
    await closeBrowser();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
