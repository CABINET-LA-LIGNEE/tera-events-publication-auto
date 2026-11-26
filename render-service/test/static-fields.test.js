const assert = require("node:assert/strict");
const { once } = require("node:events");
const { test } = require("node:test");
const { app } = require("../server");

test("Le cartouche fixe est obligatoire sur les cinq slides et ses erreurs renvoient 400", async () => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    for (let slide = 1; slide <= 5; slide++) {
      const url = `http://127.0.0.1:${server.address().port}/render/tera-chiffremercredi-s${slide}?debug=html`;
      for (const [data, expectedLength] of [
        [{}, 0],
        [{ edition_label: "Le chiffre du mercredi !" }, 24],
        [{ edition_label: "Le chiffre\ndu mercredi" }, 22],
        [{ edition_label: "Le chiffre du mercredi" }, null],
      ]) {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data)
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
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
