// n8n node mode: runOnceForEachItem (this file must return a single {json:{...}} object, not an array)
// Reprend telle quelle la double sécurité anti-crash de La Lignée : le nœud ne doit jamais
// planter même si Claude répond avec du texte non conforme (préambule, balises markdown).
const contentBlocks = $json.content || [];
const textBlocks = contentBlocks.filter(b => b.type === "text");
const raw = textBlocks.length ? textBlocks.map(b => b.text).join("") : undefined;

function tryParse(text) {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch (e) {
    return undefined;
  }
}

let parsed = tryParse(raw);
if (parsed === undefined) {
  const match = raw && raw.match(/\{[\s\S]*\}/);
  parsed = match ? tryParse(match[0]) : undefined;
}
if (parsed === undefined) {
  parsed = { error: "Parsing JSON échoué", raw: raw || JSON.stringify($json) };
}

// Garde-fou éditorial : aucun membre de l'équipe ne doit être nommé dans un contenu publié.
// Cette vérification complète la consigne donnée au modèle et bloque le flux si elle est violée.
const publicationText = JSON.stringify(parsed);
const forbiddenPeople = ["Vanessa", "Eric", "Éric"];
const detectedPerson = forbiddenPeople.find(name =>
  new RegExp(`\\b${name}\\b`, "iu").test(publicationText)
);
if (detectedPerson) {
  throw new Error("Le contenu généré cite un membre de l'équipe. Une nouvelle rédaction non nominative est requise.");
}

if (/centre commercial tera/iu.test(publicationText)) {
  throw new Error("Le contenu généré utilise Centre Commercial TERA comme une marque. La publication doit parler de TERA EVENTS.");
}

// Rend les légendes agréables à lire même lorsque le modèle oublie les sauts de paragraphe.
if (typeof parsed.caption === "string") {
  parsed.caption = parsed.caption.trim();
  if (!/\n\s*\n/u.test(parsed.caption)) {
    const sentences = parsed.caption.match(/[^.!?]+[.!?]+|[^.!?]+$/gu)?.map(s => s.trim()).filter(Boolean) || [];
    if (sentences.length >= 2) {
      const splitAt = Math.ceil(sentences.length / 2);
      parsed.caption = [sentences.slice(0, splitAt).join(" "), sentences.slice(splitAt).join(" ")]
        .filter(Boolean)
        .join("\n\n");
    }
  }

  const contactBlock = "WhatsApp ou appel : +225 05 66 22 10 10\nE-mail : reservations@tera.events";
  const locationBlock = "Localisation : à l'intérieur du Centre Commercial TERA, 7e Tranche, Deux-Plateaux.\nVisites uniquement sur rendez-vous.";
  if (!parsed.caption.includes("+225 05 66 22 10 10")) {
    parsed.caption = `${parsed.caption}\n\n${contactBlock}`;
  }
  const locationBlockCanonical = "Localisation : \u00e0 l'int\u00e9rieur du Centre Commercial TERA, 7e Tranche, Deux-Plateaux.\nVisites uniquement sur rendez-vous.";
  if (!parsed.caption.includes("Centre Commercial TERA") || !/visites? uniquement sur rendez-vous/i.test(parsed.caption)) {
    parsed.caption = `${parsed.caption}\n\n${locationBlockCanonical}`;
  }
}

if (Array.isArray(parsed.hashtags)) {
  parsed.hashtags = parsed.hashtags
    .map(tag => `#${String(tag).trim().replace(/^#+/u, "").replace(/\s+/gu, "")}`)
    .filter(tag => tag.length > 1);
}

const source = $("Préparer le Prompt Claude").item.json;

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
