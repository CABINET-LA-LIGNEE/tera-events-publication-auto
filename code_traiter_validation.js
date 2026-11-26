// "Contrôler Accords Texte + Visuels" — répartit les décisions du formulaire de validation
// (une ligne Valider/Modifier/Refuser + commentaire par créneau) vers les branches de routage.

const formData = $("Envoyer Pack de Validation").item.json.data;
const slots = $("Préparer Pack Figma + Double Validation").item.json.slots;
const pilierConfig = $("Préparer les 3 publications").all().map(i => i.json);

const results = [];
slots.forEach(s => {
  const decisionTexte = formData[`${s.jour} — décision texte`];
  const decisionVisuelle = formData[`${s.jour} — décision visuelle`];
  const decisionSources = s.sourceRequired
    ? formData[`${s.jour} — contrôle des sources`]
    : "Sans objet";
  const commentaire = formData[`${s.jour} — Commentaire (requis si Modifier)`] || "";
  if ((decisionTexte === "Modifier" || decisionVisuelle === "Modifier") && !commentaire.trim()) {
    throw new Error(`${s.jour} : un commentaire est requis lorsqu'une modification est demandée.`);
  }
  const decision = decisionTexte === "Refuser" || decisionVisuelle === "Refuser"
    ? "Refuser"
    : decisionTexte === "Valider" && decisionVisuelle === "Valider" && decisionSources !== "Sources à revoir"
      ? "Valider"
      : "Modifier";
  const config = pilierConfig.find(c => c.jour === s.jour) || {};
  results.push({
    json: {
      jour: s.jour,
      famille: s.famille,
      variante: s.variante,
      attempt: config.attempt || 1,
      target_due_at: config.target_due_at,
      decision,
      decisionTexte,
      decisionVisuelle,
      decisionSources,
      commentaire,
      renderItems: s.renderItems
    }
  });
});

return results;
