const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.join(__dirname, file), "utf8").replace(/\r\n/g, "\n");
const workflow = JSON.parse(read("n8n/workflow-structure.json"));
const codeFiles = {
  "Préparer les 3 publications": "code_prepare_pilliers.js",
  "Préparer le Prompt OpenAI": "code_prompt_prep.js",
  "Parser Réponse OpenAI": "code_parse_openai_response.js",
  "Préparer Photo de Fond IA": "code_prepare_image_generation.js",
  "Associer Photo Générée": "code_attach_generated_background.js",
  "Préparer Requêtes Visuel": "code_prepare_visuals.js",
  "Associer les Visuels": "code_attach_visuals.js",
  "Collecter la Semaine Complète": "code_collect_weekly_pack.js",
  "Préparer Pack Figma + Double Validation": "code_prepare_pack.js",
  "Contrôler Accords Texte + Visuels": "code_traiter_validation.js",
  "Préparer Publication Buffer": "code_prepare_buffer.js",
  "Vérifier Réponse Buffer": "code_verify_buffer.js",
  "Préparer Régénération": "code_prepare_regeneration.js"
};

for (const node of workflow.nodes) {
  const file = codeFiles[node.name];
  if (!file) continue;
  node.parameters.jsCode = read(file)
    .replace("\"__TERA_TRAITEUR_CATALOGUE__\"", () => read("knowledge/tera-traiteur.json").trim())
    .replace("\"__TERA_SITE_FACTS__\"", () => read("knowledge/tera-site-facts.json").trim());
}

fs.writeFileSync(path.join(__dirname, "workflow-tera-events.json"), JSON.stringify(workflow, null, 2) + "\n");
