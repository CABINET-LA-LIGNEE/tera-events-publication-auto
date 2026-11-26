// "Préparer Requêtes Visuel" — transforme le JSON rédigé par Claude (slides + caption +
// hashtags) en une liste d'appels au render-service, un par slide/gabarit. Injecte ici les
// éléments de marque fixes (tags de catégorie, coordonnées, CTA visuel statique) que Claude ne
// génère jamais, pour ne courir aucun risque d'erreur sur une donnée de marque.
//
// IMPORTANT : les noms de champs ci-dessous doivent correspondre exactement à ceux attendus par
// render-service/layouts.js. Toute évolution d'un gabarit doit être répercutée aux deux endroits.

const TEMPLATE_MAP = {
  "declic:traiteur": ["tera-declic-traiteur"],
  "declic:eventplanning": [
    "tera-declic-eventplanning-s1",
    "tera-declic-eventplanning-s2",
    "tera-declic-eventplanning-s3",
    "tera-declic-eventplanning-s4",
    "tera-declic-eventplanning-s5"
  ],
  "savoirfaire:generique": [
    "tera-savoirfairemercredi-s1",
    "tera-savoirfairemercredi-s2",
    "tera-savoirfairemercredi-s3",
    "tera-savoirfairemercredi-s4"
  ],
  "savoirfaire:chiffre": [
    "tera-chiffremercredi-s1",
    "tera-chiffremercredi-s2",
    "tera-chiffremercredi-s3",
    "tera-chiffremercredi-s4",
    "tera-chiffremercredi-s5"
  ],
  "savoirfaire:traiteur": [
    "tera-savoirfairetraiteur-s1",
    "tera-savoirfairetraiteur-s2",
    "tera-savoirfairetraiteur-s3",
    "tera-savoirfairetraiteur-s4",
    "tera-savoirfairetraiteur-s5"
  ],
  "ancrage:a": ["tera-ancragevendredi-a"],
  "ancrage:b": ["tera-ancragevendredi-b"]
};

// Champs de marque fixes, injectés à chaque appel de la famille/variante correspondante — jamais
// laissés à la charge de Claude.
const STATIC_FIELDS = {
  "declic:traiteur": { tag: "LE DÉCLIC · TRAITEUR", devise: "FCFA" },
  "declic:eventplanning": { tag: "LE DÉCLIC · EVENT PLANNING" },
  "savoirfaire:generique": {},
  "savoirfaire:chiffre": { edition_label: "Le chiffre du mercredi" },
  "savoirfaire:traiteur": {},
  "ancrage:a": { tag: "L'ANCRAGE DU VENDREDI" },
  "ancrage:b": { tag: "L'ANCRAGE DU VENDREDI", cta_label: "Demander un devis →" }
};

function buildVisualRequests(d) {
  const key = `${d.famille}:${d.variante}`;
  const isChiffreDuMercredi = key === "savoirfaire:chiffre";
  const templates = TEMPLATE_MAP[key];
  if (!templates) {
    throw new Error(`Aucun gabarit défini pour famille="${d.famille}" variante="${d.variante}".`);
  }

  const slides = Array.isArray(d.slides) ? d.slides : [];
  const hashtagsText = Array.isArray(d.hashtags) ? d.hashtags.join(" ") : (d.hashtags || "");
  const caption = [d.caption, hashtagsText].filter(Boolean).join("\n\n");
  const postId = $execution.id + "-" + d.jour;
  const backgroundImages = Array.isArray(d.background_images) ? d.background_images : [];

  // La grande valeur de la slide 2 doit rester aussi courte que dans le gabarit Figma.
  // Si une phrase a été produite, reprendre le chiffre et l'unité de la couverture.
  if (isChiffreDuMercredi && slides[1] && String(slides[1].statistique || "").length > 14) {
    const chiffre = String(slides[0]?.chiffre || "").trim();
    const unite = String(slides[0]?.unite || "").trim();
    slides[1] = { ...slides[1], statistique: [chiffre, unite].filter(Boolean).join(" ") };
  }

  // Les formulations interrogatives doivent toujours porter leur ponctuation, même si le
  // modèle l'a omise. Cette normalisation s'applique au titre et aux trois questions de la slide 3.
  if (isChiffreDuMercredi && slides[2]) {
    const withQuestionMark = (value) => {
      const text = String(value || "").trim();
      if (!/^(pourquoi|comment|qui|que|quel|quelle|quels|quelles|quand|où|combien)(?![\p{L}\p{N}_])/iu.test(text)) return text;
      return text.replace(/[.!?…]+$/u, "").trim() + " ?";
    };
    slides[2] = {
      ...slides[2],
      titre: withQuestionMark(slides[2].titre),
      conseil1_titre: withQuestionMark(slides[2].conseil1_titre),
      conseil2_titre: withQuestionMark(slides[2].conseil2_titre),
      conseil3_titre: withQuestionMark(slides[2].conseil3_titre)
    };
  }

  return templates.map((template, idx) => {
    const slideFields = slides[idx] || {};
    // L'image est choisie en amont dans la banque média, indépendamment de la rédaction Claude.
    // Une image propre à la slide est prioritaire, puis celle de la liste du carrousel, puis le
    // fond commun de la publication. Sans image fournie, le fond Figma canonique reste le fallback.
    const backgroundImage = isChiffreDuMercredi
      ? undefined
      : (slideFields.background_image || backgroundImages[idx] || d.background_image);
    const backgroundPosition = isChiffreDuMercredi
      ? undefined
      : (slideFields.background_position || d.background_position);
    return {
      json: {
        post_id: postId,
        jour: d.jour,
        famille: d.famille,
        variante: d.variante,
        template,
        slide_index: idx + 1,
        slide_count: templates.length,
        target_due_at: d.target_due_at,
        render_body: {
          ...STATIC_FIELDS[key],
          ...slideFields,
          ...(backgroundImage ? { background_image: backgroundImage } : {}),
          ...(backgroundPosition ? { background_position: backgroundPosition } : {})
        },
        caption
      }
    };
  });
}

return $input.all().flatMap(item => buildVisualRequests(item.json));
