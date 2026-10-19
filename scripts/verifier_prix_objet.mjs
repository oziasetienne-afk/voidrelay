/* Garde-fou du prix des PAGES OBJET (median(), js/objet.js).

   Troisième calcul de prix du site, et le troisième à devoir être tenu à part :
     · scripts/update_warframe_data.py  → ordres de vente en cours (pipeline)
     · js/api.js summarizeStats         → statistiques d'échanges (estimateur)
     · js/objet.js median               → statistiques LIVE (3838 pages objet)
   Trois questions différentes, trois règles — mais aucune ne doit MÉLANGER LES
   RANGS, et c'est ce que celui-ci faisait.

   Ce qu'il faisait exactement : prendre le DERNIER seau du tableau, sans
   regarder le rang. Pas « le rang max », pas « le plus échangé » — celui que
   l'API renvoie en dernier. Relevé le 04/09/2026 : Arcane Energize affiché à
   9 platine quand son rang 5 en vaut 150.

   node scripts/verifier_prix_objet.mjs
*/
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/objet.js", import.meta.url), "utf8");
// median() est enfermée dans l'IIFE du fichier : on l'extrait par son texte
// plutôt que d'exécuter tout objet.js, qui touche au DOM au chargement.
const debut = src.indexOf("  async function median(s) {");
const fin = src.indexOf("\n  }", src.indexOf("return { med: Math.round(prices[")) + 4;
if (debut < 0 || fin < 4) { console.log("❌ median() introuvable dans js/objet.js"); process.exit(1); }
const corps = src.slice(debut, fin);

let reponses = {};
const fabrique = new Function("reponses", `
  const MK1 = "MK1", MK2 = "MK2";
  const fetchJSON = (u) => Promise.resolve(u.indexOf("orders") >= 0 ? reponses.top : reponses.stats);
  ${corps}
  return median;
`);
const median = fabrique(reponses);

let ok = 0, ko = 0;
const dit = (b, t, d) => { if (b) { ok++; console.log("  ✓ " + t + (d ? " — " + d : "")); }
                           else { ko++; console.log("  ✗ " + t + (d ? " — " + d : "")); } };

const seau = (median, min_price, volume, mod_rank) => ({
  order_type: "sell", median, min_price, volume,
  ...(mod_rank === undefined ? {} : { mod_rank }),
});
const stats = (sells) => ({ payload: { statistics_live: { "48hours": sells } } });

console.log("objets à rangs (statistiques live)");
{
  // Arcane Energize, relevé réel : le rang 0 arrive EN DERNIER dans le tableau.
  reponses.stats = stats([
    seau(140, 130, 90, 5), seau(150, 145, 96, 5),
    seau(8, 7, 260, 0), seau(9, 8, 280, 0),
  ]);
  reponses.top = null;
  const r = await median("arcane_energize");
  dit(r.med === 150 && r.rang === 5,
      "le rang MAX porte le chiffre, plus le dernier seau venu", r.med + " p au rang " + r.rang);
  dit(r.med !== 9, "les 9 platine du rang 0 ne sont plus le prix affiché", "x17 d'écart évité");
  dit(r.vol === 96, "le volume est celui du rang retenu", "96, pas 280 ni 476");
  // Chaque rang porte SA médiane (9 pour le rang 0), pas son prix plancher :
  // le détail doit être comparable au chiffre principal, qui est une médiane.
  dit(r.rangs.length === 2 && r.rangs[0].r === 0 && r.rangs[0].med === 9
      && r.rangs[1].med === 150,
      "le détail par rang donne une MÉDIANE par rang, du plus bas au plus haut",
      r.rangs.map(x => "rang " + x.r + " : " + x.med).join(" · "));
  dit(r.hist.every(v => v >= 140),
      "l'historique de l'étincelle ne mélange PAS les rangs — sinon la courbe ferait des sauts inventés",
      JSON.stringify(r.hist));
}

console.log("objets sans rang");
{
  reponses.stats = stats([seau(70, 65, 30), seau(78, 72, 40)]);
  const r = await median("mesa_prime_set");
  dit(r.med === 78 && r.min === 72, "dernier seau, comme avant", "78 / 72");
  dit(r.rang === null && r.rangs.length === 0, "aucun rang : aucun détail à afficher");
}

console.log("repli v2 (statistiques v1 muettes)");
{
  reponses.stats = stats([]);
  reponses.top = { data: { sell: [
    { platinum: 8, rank: 0 }, { platinum: 9, rank: 0 },
    { platinum: 145, rank: 5 }, { platinum: 150, rank: 5 }, { platinum: 160, rank: 5 },
  ] } };
  const r = await median("arcane_energize");
  dit(r.rang === 5 && r.min === 145,
      "le carnet d'offres est filtré sur le rang lui aussi", "min " + r.min + " au rang " + r.rang);
  dit(r.med === 150, "et la médiane est calculée DANS ce rang", "150");
  dit(r.min !== 8, "le repli ne réintroduit pas le mélange qu'on vient de retirer");
}
{
  reponses.stats = stats([]);
  reponses.top = { data: { sell: [{ platinum: 60 }, { platinum: 64 }, { platinum: 70 }] } };
  const r = await median("mesa_prime_set");
  dit(r.rang === null && r.med === 64 && r.min === 60,
      "un carnet sans rang passe inchangé", "64 / 60");
}
{
  reponses.stats = stats([]);
  reponses.top = { data: { sell: [] } };
  dit((await median("inconnu")) === null, "aucune offre : null, pas un prix à zéro");
}

console.log("comparatif pièces / set : les sets imbriqués");
{
  // data/sets_imbriques.json est produit par scripts/generer_pieces_sets.py à
  // partir de la recette de JEU. Le vérifier ici, c'est vérifier que le seul
  // signal capable d'empêcher un mauvais conseil existe bien et nomme les
  // composants manquants — sans lui, la page objet conclut à tort.
  const j = JSON.parse(readFileSync(new URL("../data/sets_imbriques.json", import.meta.url), "utf8"));
  const S = j.sets || {};
  dit(!!S.akbronco_prime_set && !!S.aklex_prime_set,
      "les deux sets dont warframe.market ignore un composant sont listés",
      Object.keys(S).join(", "));
  const b = S.akbronco_prime_set || [];
  dit(b.length === 1 && b[0].slug === "bronco_prime_set" && b[0].n === 2,
      "Akbronco Prime : DEUX Bronco Prime entières, et la quantité est gardée",
      JSON.stringify(b));
  dit(b[0].nom && b[0].nom !== b[0].slug,
      "un nom lisible est fourni — une page ne peut pas afficher un slug brut", b[0].nom);
  dit(Object.keys(S).length < 10,
      "le fichier reste minuscule : il ne liste QUE les cas imbriqués",
      Object.keys(S).length + " sets");
  // Le piège serait de lister ici tous les sets : la page chargerait alors un
  // fichier inutile sur 3838 pages pour n'en servir que deux.
  const rec = JSON.parse(readFileSync(new URL("../data/set_pieces.json", import.meta.url), "utf8"));
  dit(Object.keys(rec.sets).length > 80 && Object.keys(S).length === 2,
      "la recette complète reste dans set_pieces.json, pas dupliquée ici",
      Object.keys(rec.sets).length + " sets contre " + Object.keys(S).length);
}

console.log("-".repeat(70));
if (ko) { console.log("❌ " + ko + " échec(s) sur " + (ok + ko)); process.exit(1); }
console.log("🛡️  GARDE-FOU : le prix des pages objet tient — " + ok + " vérifications OK.");
