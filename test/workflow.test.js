const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const production = require("../n8n/export-prod.json");
const generated = require("../workflow-tera-events.json");

test("Le build reproduit le graphe de production, avec le correctif de ponctuation T00", () => {
  const expected = structuredClone(production);
  for (const node of expected.nodes) {
    delete node.credentials;
    if (node.name === "Préparer Requêtes Visuel") {
      const corrected = node.parameters.jsCode.replace(/\|o[^|]{1,2}\|combien\)\\b/u, "|où|combien)(?![\\p{L}\\p{N}_])").replace("/i.test(text)", "/iu.test(text)");
      assert.notEqual(corrected, node.parameters.jsCode);
      node.parameters.jsCode = corrected
        .replace("a \uFFFDt\uFFFD produite", "a été produite")
        .replace("unit\uFFFD", "unité")
        .replace("m\uFFFDme", "même")
        .replace("mod\uFFFDle", "modèle");
    }
  }
  assert.deepEqual(generated, expected);
  const code = readFileSync("code_prepare_visuals.js", "utf8");
  const expression = code.match(/if \(!\/(.+)\/iu\.test\(text\)\)/)[1];
  const questions = new RegExp(expression, "iu");
  assert.equal(questions.test("Où se retrouver"), true);
  assert.equal(questions.test("Quiétude"), false);
});
