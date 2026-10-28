// "Préparer les 3 publications" — détermine, pour la semaine en cours, la famille/variante de
// gabarit à utiliser sur chacun des 3 créneaux pilotés (lundi, mercredi, vendredi), avec rotation
// hebdomadaire par famille pour respecter "ça doit varier selon le sujet" (au lieu d'une matrice
// unique lundi/vendredi comme envisagé initialement, voir DOCUMENTATION.md).
//
// Chaque créneau a un angle fixe (lundi = Le Déclic, mercredi = Savoir-Faire, vendredi =
// L'Ancrage) mais la variante utilisée à l'intérieur de cet angle tourne semaine après semaine,
// parmi les seules variantes déjà dessinées dans Figma (le pool s'enrichit au fur et à mesure que
// de nouveaux gabarits sont maquettés).

function nextWeekday(targetIsoWeekday, hour) {
  const now = new Date();
  const currentIso = now.getUTCDay() === 0 ? 7 : now.getUTCDay();
  let diff = targetIsoWeekday - currentIso;
  if (diff <= 0) diff += 7;
  const result = new Date(now);
  result.setUTCDate(now.getUTCDate() + diff);
  result.setUTCHours(hour, 0, 0, 0);
  return result.toISOString();
}

// Pools de variantes disponibles par famille — n'y figurent que les gabarits déjà dessinés et
// câblés dans render-service/layouts.js. Ajouter une entrée ici dès qu'une nouvelle variante
// (Décoration, Salle, Savoir-Faire Traiteur...) est maquettée et intégrée.
const POOLS = {
  declic: ["eventplanning", "traiteur"],
  savoirfaire: ["generique", "chiffre", "traiteur"],
  ancrage: ["a", "b"]
};

const SLOTS = [
  { jour: "Lundi", weekday: 1, famille: "declic" },
  { jour: "Mercredi", weekday: 3, famille: "savoirfaire" },
  { jour: "Vendredi", weekday: 5, famille: "ancrage" }
];

// Transition de reprise : le lundi 2 novembre est déjà programmé dans Buffer par le pack validé
// le 28 octobre. Lors de l'exécution du dimanche 1er novembre, ne générer que mercredi et
// vendredi afin d'éviter un doublon. Dès le dimanche suivant, les trois créneaux habituels
// reprennent automatiquement.
const todayUtc = new Date().toISOString().slice(0, 10);
const activeSlots = todayUtc === "2026-11-01"
  ? SLOTS.filter(slot => slot.jour !== "Lundi")
  : SLOTS;

// Données statiques du workflow n8n : un index de rotation par famille, qui persiste d'une
// exécution hebdomadaire à l'autre (équivalent de $getWorkflowStaticData('global') dans un nœud
// Code n8n réel — représenté ici comme un objet passé/retourné pour rester testable hors n8n).
const state = $getWorkflowStaticData("global");
if (!state.rotation) state.rotation = { declic: 0, savoirfaire: 0, ancrage: 0 };

const items = activeSlots.map(slot => {
  const pool = POOLS[slot.famille];
  const idx = state.rotation[slot.famille] % pool.length;
  const variante = pool[idx];
  state.rotation[slot.famille] = idx + 1;
  return {
    json: {
      jour: slot.jour,
      famille: slot.famille,
      variante,
      attempt: 1,
      modification_feedback: "",
      target_due_at: nextWeekday(slot.weekday, 8)
    }
  };
});

return items;
