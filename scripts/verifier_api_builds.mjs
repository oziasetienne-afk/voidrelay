/* ============================================================================
   VoidRelay — GARDE-FOU de la validation de /api/builds.

   POURQUOI un script à part. La bibliothèque de builds ne peut pas être
   essayée ici : elle a besoin d'une liaison D1 que seul le tableau de bord
   Cloudflare peut créer. Mais la partie qui décide de ce qui ENTRE dans la
   base — nettoyage des champs et validation du lien — est du JavaScript pur,
   sans dépendance à D1. C'est aussi la partie qu'il serait le plus coûteux de
   se tromper : elle est la seule barrière entre le public et la base.

   Ce fichier l'exerce, et il tourne partout :
     node scripts/verifier_api_builds.mjs
   Sortie : 0 = tout passe · 1 = au moins un cas échoue.
   ========================================================================== */
import { readFileSync } from "node:fs";
import { nettoie, lienValide, valide, sansPub, SCHEMA, avecSchema, onRequest } from "../functions/api/builds.js";

let echecs = 0;
function ok(nom, condition, detail) {
  console.log((condition ? "  ✓ " : "  ✗ ") + nom + (detail ? " — " + detail : ""));
  if (!condition) echecs++;
}

console.log("🛡️  Validation de /api/builds — ce qui a le droit d'entrer dans la base");

/* --- nettoie() --- */
ok("les chevrons sont retirés (aucun titre de build n'en a besoin)",
  nettoie("<img src=x onerror=alert(1)>Titre", 80) === "img src=x onerror=alert(1)Titre",
  JSON.stringify(nettoie("<img src=x onerror=alert(1)>Titre", 80)));
ok("les caractères de contrôle sont retirés",
  nettoie("a\u0001bc", 80) === "abc", JSON.stringify(nettoie("a\u0001bc", 80)));
ok("la longueur est bornée", nettoie("y".repeat(500), 80).length === 80);
ok("un non-texte devient une chaîne vide",
  nettoie(null, 80) === "" && nettoie({}, 80) === "" && nettoie(42, 80) === "");
ok("les espaces de bord sont retirés", nettoie("  Titre  ", 80) === "Titre");

/* --- lienValide() : la bibliothèque n'est pas un raccourcisseur d'URL --- */
const bon = "https://voidrelay.fr/arsenal#z=ABC";
ok("un lien d'Arsenal avec un build est accepté", lienValide(bon) === true);
ok("la variante anglaise aussi", lienValide("https://voidrelay.fr/en/arsenal#b=ABC") === true);
ok("l'aperçu pages.dev aussi", lienValide("https://x.warframe-hub.pages.dev/arsenal.html#z=A") === true);
ok("un lien SANS build est refusé", lienValide("https://voidrelay.fr/arsenal") === false);
ok("une autre page du site est refusée", lienValide("https://voidrelay.fr/hub#z=A") === false);
ok("un autre domaine est refusé", lienValide("https://exemple.test/arsenal#z=A") === false);
ok("un domaine qui CONTIENT le nôtre est refusé",
  lienValide("https://voidrelay.fr.exemple.test/arsenal#z=A") === false);
ok("javascript: est refusé", lienValide("javascript:alert(1)//arsenal#z=A") === false);
ok("un lien démesuré est refusé", lienValide("https://voidrelay.fr/arsenal#z=" + "A".repeat(9000)) === false);
ok("un non-texte est refusé", lienValide(null) === false && lienValide(12) === false);

/* --- valide() : le corps complet --- */
const base = { arme: "/Lotus/Weapons/Soma", titre: "Soma saignement", auteur: "Tenno", notes: "Notes", lien: bon };
ok("un corps complet passe", valide(base).ok === true);
ok("sans arme, refusé", valide({ ...base, arme: "" }).ok === false);
ok("titre trop court, refusé", valide({ ...base, titre: "ab" }).ok === false);
ok("lien invalide, refusé", valide({ ...base, lien: "https://exemple.test" }).ok === false);
ok("un corps nul ne fait pas tomber la fonction", valide(null).ok === false);
const v = valide({ ...base, titre: "<b>Gras</b> titre", notes: "z".repeat(900) });
ok("les champs ressortent NETTOYÉS, pas seulement validés",
  v.ok && v.valeur.titre === "bGras/b titre" && v.valeur.notes.length === 600,
  v.ok ? v.valeur.titre + " / notes " + v.valeur.notes.length : "refusé");

/* --- sansPub() : ce qui rend la publication AUTOMATIQUE tenable ---------------
   Depuis le 05/09/2026 il n'y a plus de file de relecture. La seule chose qui
   retire au spam son intérêt, c'est l'impossibilité d'envoyer le lecteur
   ailleurs. Si ces cas cessent de passer, le site publie des publicités sans
   que personne ne s'en aperçoive — d'où leur place ici, pas dans un test. */
ok("une URL complète est retirée du texte",
  sansPub("Super build https://monsite.fr/promo à voir") === "Super build à voir",
  JSON.stringify(sansPub("Super build https://monsite.fr/promo à voir")));
ok("un www. est retiré", sansPub("va sur www.spam.net maintenant") === "va sur maintenant");
ok("un domaine nu est retiré", sansPub("rejoins discord.gg/abcd1234") === "rejoins");
ok("un domaine collé à de la ponctuation part aussi",
  sansPub("(monsite.com/x)") === "(", JSON.stringify(sansPub("(monsite.com/x)")));
ok("un texte de build normal n'est PAS abîmé",
  sansPub("Build crit 60/60 Steel Path, 2 forma") === "Build crit 60/60 Steel Path, 2 forma",
  JSON.stringify(sansPub("Build crit 60/60 Steel Path, 2 forma")));
ok("un nombre décimal n'est pas confondu avec un domaine",
  sansPub("multiplicateur 3.5 en mêlée") === "multiplicateur 3.5 en mêlée");
ok("sansPub survit à null", sansPub(null) === "");

const pub = valide({ ...base, titre: "Build sur monsite.fr", notes: "voir www.spam.net" });
ok("valide() applique sansPub AVANT d'enregistrer",
  pub.ok && !/monsite|spam/.test(pub.valeur.titre + pub.valeur.notes),
  pub.ok ? JSON.stringify(pub.valeur.titre) + " / " + JSON.stringify(pub.valeur.notes) : "refusé");

/* --- le filet à insultes : court, donc au moins il doit attraper l'évident --- */
ok("une insulte grossière dans le titre est refusée",
  valide({ ...base, titre: "salope de build" }).ok === false);
ok("une insulte dans les notes est refusée aussi",
  valide({ ...base, notes: "nique tout" }).ok === false);
ok("un titre innocent qui CONTIENT une sous-chaîne anodine passe",
  valide({ ...base, titre: "Build Nikana connu" }).ok === true,
  JSON.stringify(valide({ ...base, titre: "Build Nikana connu" })));


/* --- LE SCHÉMA SE POSE TOUT SEUL -------------------------------------------
   Le 05/09/2026, la table « signalements » a été ajoutée au schéma sans que
   personne ne puisse la créer : seul le Chef a accès à la console SQL de D1.
   Le bouton de signalement — la CINQUIÈME barrière de la publication
   automatique, celle qui remplace la relecture — répondait donc 500 en
   silence. Ces cas exercent la réparation automatique sur une fausse base D1
   à qui il manque exactement cette table. */

/* Fausse base D1 : elle ne connaît que les tables qu'on lui donne, et se
   plaint comme SQLite pour les autres. */
function fausseD1(tablesPresentes) {
  const tables = new Set(tablesPresentes);
  const etat = { manquantes: 0, creees: [] };
  const nomTable = (sql) => {
    const m = /(?:FROM|INTO|UPDATE)\s+([a-z_]+)/i.exec(sql);
    return m ? m[1] : null;
  };
  const executer = (sql) => {
    const creation = /CREATE TABLE IF NOT EXISTS\s+([a-z_]+)/i.exec(sql);
    if (creation) { tables.add(creation[1]); etat.creees.push(creation[1]); return { results: [], meta: { changes: 0 } }; }
    if (/^\s*CREATE INDEX/i.test(sql)) {
      const surTable = /ON\s+([a-z_]+)/i.exec(sql);
      if (surTable && !tables.has(surTable[1])) { etat.manquantes++; throw new Error("D1_ERROR: no such table: " + surTable[1]); }
      return { results: [], meta: { changes: 0 } };
    }
    const t = nomTable(sql);
    if (t && !tables.has(t)) { etat.manquantes++; throw new Error("D1_ERROR: no such table: " + t); }
    return { results: [], meta: { changes: 1, last_row_id: 1 } };
  };
  const base = {
    etat,
    prepare(sql) {
      return {
        bind() { return this; },
        async run() { return executer(sql); },
        async all() { return executer(sql); },
        async first() { const r = executer(sql); return /COUNT\(\*\)/i.test(sql) ? { n: 1 } : { votes: 0 }; },
      };
    },
  };
  return base;
}

const baseSansSignalements = fausseD1(["builds", "votes"]);
const reponse = await onRequest({
  request: new Request("https://voidrelay.fr/api/builds?a=signaler", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.7" },
    body: JSON.stringify({ id: 1 }),
  }),
  env: { BUILDS: baseSansSignalements, VR_SEL_IP: "sel" },
});
const corpsReponse = await reponse.json();
ok("un signalement PASSE alors que la table « signalements » n'existe pas encore",
  reponse.status === 200 && corpsReponse.ok === true,
  reponse.status + " " + JSON.stringify(corpsReponse));
ok("…parce que D1 s'est bien plaint d'une table absente (le cas est réellement exercé)",
  baseSansSignalements.etat.manquantes >= 1, "plaintes : " + baseSansSignalements.etat.manquantes);
ok("…et que la table a été posée au passage",
  baseSansSignalements.etat.creees.includes("signalements"),
  baseSansSignalements.etat.creees.join(", ") || "aucune");

/* Une base VIDE doit se remplir toute seule : c'est le cas d'un projet
   Cloudflare tout neuf où personne n'a collé le schéma. */
const baseVide = fausseD1([]);
const reponseVide = await onRequest({
  request: new Request("https://voidrelay.fr/api/builds", { headers: { "CF-Connecting-IP": "203.0.113.8" } }),
  env: { BUILDS: baseVide, VR_SEL_IP: "sel" },
});
ok("une base D1 VIDE se remplit seule au premier appel (rien à coller à la main)",
  reponseVide.status === 200, reponseVide.status + " ; tables créées : " + baseVide.etat.creees.join(", "));

/* Une erreur qui n'est PAS un schéma en retard doit remonter, pas être
   avalée par une deuxième tentative silencieuse. */
let essais = 0;
let remontee = null;
try {
  await avecSchema(fausseD1([]), async () => { essais++; throw new Error("D1_ERROR: UNIQUE constraint failed"); });
} catch (e) { remontee = e; }
ok("une erreur étrangère au schéma remonte, sans deuxième tentative",
  remontee !== null && essais === 1, "essais : " + essais);

/* --- le schéma posé et le fichier .sql ne peuvent pas diverger ------------- */
const normalise = (sql) => sql
  .replace(/--[^\n]*/g, " ")
  .replace(/\s+/g, " ")
  .replace(/\s*([(),])\s*/g, "$1")
  .trim();
const fichierSql = readFileSync(new URL("../functions/api/builds.schema.sql", import.meta.url), "utf8");
const ordresDuFichier = new Set(fichierSql.split(";").map(normalise).filter(Boolean));
const absents = SCHEMA.filter((o) => !ordresDuFichier.has(normalise(o)));
ok("chaque ordre posé automatiquement est écrit à l'identique dans builds.schema.sql",
  absents.length === 0, absents.join(" | ") || "les " + SCHEMA.length + " ordres correspondent");

/* Et surtout : AUCUNE table lue par le code ne doit manquer au schéma posé —
   c'est exactement l'oubli du 05/09/2026, cette fois attrapé ici. */
const sourceApi = ["../functions/api/builds.js", "../functions/api/sync.js"]
  .map((f) => readFileSync(new URL(f, import.meta.url), "utf8")).join("\n");
const tablesLues = new Set();
for (const motif of [/FROM\s+([a-z_]+)/gi, /INSERT\s+(?:OR\s+\w+\s+)?INTO\s+([a-z_]+)/gi, /UPDATE\s+([a-z_]+)\s+SET/gi]) {
  for (const m of sourceApi.matchAll(motif)) tablesLues.add(m[1].toLowerCase());
}
const tablesPosees = new Set(SCHEMA.map((o) => (/CREATE TABLE IF NOT EXISTS\s+([a-z_]+)/i.exec(o) || [])[1]).filter(Boolean));
const oubliees = [...tablesLues].filter((t) => !tablesPosees.has(t));
ok("toutes les tables interrogées par le code sont posées par le schéma automatique",
  oubliees.length === 0, oubliees.join(", ") || [...tablesLues].sort().join(", "));

console.log("----------------------------------------------------------------------");
if (echecs) { console.log("💥 GARDE-FOU : " + echecs + " cas en échec."); process.exit(1); }
console.log("🛡️  GARDE-FOU : la validation de /api/builds tient — OK.");
process.exit(0);
