// n8n node mode: runOnceForAllItems
// Les appels externes peuvent livrer les rendus en plusieurs vagues. Ce collecteur n'émet rien
// tant que les trois jours et toutes les slides attendues ne sont pas présents.
const state = $getWorkflowStaticData("global");
if (!state.weeklyPackAccumulator) state.weeklyPackAccumulator = {};

const executionKey = String($execution.id);
const existing = Array.isArray(state.weeklyPackAccumulator[executionKey])
  ? state.weeklyPackAccumulator[executionKey]
  : [];

const incoming = $input.all().map(item => item.json);
const merged = [...existing, ...incoming];
const unique = new Map();

for (const item of merged) {
  const key = `${item.post_id || item.jour}:${item.slide_index || 1}`;
  unique.set(key, item);
}

const collected = [...unique.values()];
state.weeklyPackAccumulator[executionKey] = collected;

// Le dimanche 1er novembre constitue une transition : le lundi 2 est déjà programmé. Le pack
// de ce soir-là attend donc seulement mercredi et vendredi. Le cycle normal à trois jours reprend
// automatiquement dès l'exécution hebdomadaire suivante.
const todayUtc = new Date().toISOString().slice(0, 10);
const requiredDays = todayUtc === "2026-11-01"
  ? ["Mercredi", "Vendredi"]
  : ["Lundi", "Mercredi", "Vendredi"];
const complete = requiredDays.every(jour => {
  const slides = collected.filter(item => item.jour === jour);
  if (!slides.length) return false;
  const expected = Number(slides[0].slide_count || 1);
  return slides.length >= expected;
});

if (!complete) return [];

delete state.weeklyPackAccumulator[executionKey];
return collected.map(json => ({ json }));
