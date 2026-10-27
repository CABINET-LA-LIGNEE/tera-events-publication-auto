// n8n node mode: runOnceForEachItem.
// Le nom du nœud conserve la mention historique Claude, mais la réponse vient de l'API OpenAI.
const source = $("Préparer le Prompt Claude").item.json;
const output = Array.isArray($json.output) ? $json.output : [];
const raw = $json.output_text || output
  .flatMap(item => Array.isArray(item.content) ? item.content : [])
  .filter(content => content.type === "output_text" && typeof content.text === "string")
  .map(content => content.text)
  .join("");

function tryParse(text) {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

let parsed = tryParse(raw);
if (parsed === undefined) {
  const match = raw && raw.match(/\{[\s\S]*\}/);
  parsed = match ? tryParse(match[0]) : undefined;
}
if (parsed === undefined) parsed = { error: "Parsing JSON échoué", raw: raw || "Réponse OpenAI vide" };

const publicationText = JSON.stringify(parsed);
for (const name of ["Vanessa", "Eric", "Éric"]) {
  if (new RegExp(`\\b${name}\\b`, "iu").test(publicationText)) {
    throw new Error("Le contenu généré cite un membre de l'équipe.");
  }
}

if (
  /centre commercial tera/iu.test(publicationText) &&
  !/localisation|situ[eé]e?|int[eé]rieur/iu.test(publicationText)
) {
  throw new Error("Centre Commercial TERA ne doit être cité que comme localisation.");
}

if (typeof parsed.caption === "string") {
  parsed.caption = parsed.caption.trim();
  if (!/\n\s*\n/u.test(parsed.caption)) {
    const sentences = parsed.caption
      .match(/[^.!?]+[.!?]+|[^.!?]+$/gu)
      ?.map(sentence => sentence.trim())
      .filter(Boolean) || [];
    if (sentences.length >= 2) {
      const middle = Math.ceil(sentences.length / 2);
      parsed.caption = [
        sentences.slice(0, middle).join(" "),
        sentences.slice(middle).join(" ")
      ].filter(Boolean).join("\n\n");
    }
  }

  const contact = "WhatsApp ou appel : +225 05 66 22 10 10\nE-mail : reservations@tera.events";
  const location = "Localisation : à l'intérieur du Centre Commercial TERA, 7e Tranche, Deux-Plateaux.\nVisites uniquement sur rendez-vous.";
  if (!parsed.caption.includes("+225 05 66 22 10 10")) parsed.caption += `\n\n${contact}`;
  if (!parsed.caption.includes("Centre Commercial TERA") || !/visites? uniquement sur rendez-vous/i.test(parsed.caption)) {
    parsed.caption += `\n\n${location}`;
  }
}

if (Array.isArray(parsed.hashtags)) {
  parsed.hashtags = parsed.hashtags
    .map(tag => `#${String(tag).trim().replace(/^#+/u, "").replace(/\s+/gu, "")}`)
    .filter(tag => tag.length > 1);
}

return {
  json: {
    jour: source.jour,
    famille: source.famille,
    variante: source.variante,
    attempt: source.attempt || 1,
    target_due_at: source.target_due_at,
    ...parsed
  }
};
