// Réassocie la réponse image au contenu éditorial avant le rendu Figma.
const source = $("Parser Réponse Claude").item.json;

// Le Chiffre du mercredi est un carrousel 100 % graphique. Même si une réponse image existe en
// amont, elle ne doit jamais être transmise aux cinq gabarits de cette série.
if (source.famille === "savoirfaire" && source.variante === "chiffre") {
  const { background_image, background_images, ...withoutBackground } = source;
  return { json: withoutBackground };
}

const imageData = $json.data?.[0]?.b64_json;
if (!imageData) {
  throw new Error("OpenAI n'a retourné aucune image exploitable.");
}

return {
  json: {
    ...source,
    background_image: `data:image/jpeg;base64,${imageData}`
  }
};
