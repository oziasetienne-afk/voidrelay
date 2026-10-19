/* ============================================================================
   VoidRelay — GARDE-FOU de la synchronisation par code.

   Comme pour /api/builds, la base D1 n'existe pas ici. Mais TOUT ce qui décide
   de la sûreté du dispositif est du JavaScript pur, et c'est justement la
   partie qu'il serait le plus coûteux de rater :
     • la LISTE BLANCHE — le stockage local contient un compte warframe.market
       et une URL de proxy, qui ne doivent JAMAIS partir sur un serveur ;
     • le CHIFFREMENT — le serveur ne doit jamais pouvoir lire ;
     • la VALIDATION côté serveur de l'identifiant et du paquet.

   node scripts/verifier_sync.mjs   ·   0 = tout passe, 1 = au moins un échec.
   ========================================================================== */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { idValide, paquetValide } from "../functions/api/sync.js";

const ici = path.dirname(fileURLToPath(import.meta.url));

// js/sync.js s'accroche à un global et utilise localStorage : on lui en fournit
// un faux, ce qui permet d'exercer le vrai fichier plutôt qu'une copie.
const mem = {};
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
};
globalThis.window = globalThis;
new Function(fs.readFileSync(path.join(ici, "../js/sync.js"), "utf8"))();
const S = globalThis.VRSync;

let echecs = 0;
function ok(nom, condition, detail) {
  console.log((condition ? "  ✓ " : "  ✗ ") + nom + (detail ? " — " + detail : ""));
  if (!condition) echecs++;
}

console.log("🛡️  Synchronisation par code — liste blanche, chiffrement, validation");

/* --- 1. LA LISTE BLANCHE, le point le plus important --- */
ok("« wmuser » (compte warframe.market) n'est PAS synchronisé",
  S.CLEFS.indexOf("wmuser") === -1);
ok("« wfproxy » (URL de proxy personnelle) n'est PAS synchronisé",
  S.CLEFS.indexOf("wfproxy") === -1);
ok("les builds de l'Arsenal, eux, le sont",
  S.CLEFS.indexOf("vr-arsenal-v1") !== -1 && S.CLEFS.indexOf("vr-arsenal-builds") !== -1);

mem["vr-arsenal-v1"] = '{"sel":"frame"}';
mem["tasks"] = '{"a":1}';
mem["wmuser"] = '{"nom":"secret"}';
mem["wfproxy"] = "https://proxy.perso";
const lu = S.litLocal();
ok("litLocal() ne remonte QUE les clefs de la liste blanche",
  !("wmuser" in lu) && !("wfproxy" in lu) && lu["tasks"] === '{"a":1}',
  Object.keys(lu).join(", "));

/* --- 2. LE CODE --- */
const code = S.genereCode();
ok("un code fait 20 caractères, en 4 groupes lisibles",
  /^[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(code), code);
ok("il ne contient ni I, ni L, ni O, ni 0, ni 1 (recopie à la main)",
  !/[ILO01]/.test(code), code);
ok("deux codes tirés de suite diffèrent", S.genereCode() !== S.genereCode());
ok("un code se relit en minuscules et sans tirets",
  S.codeValide(code.toLowerCase().replace(/-/g, "")) === true);
ok("un code trop court est refusé", S.codeValide("ABCDE") === false);
ok("un code avec une lettre interdite est refusé",
  S.codeValide("IIIII-IIIII-IIIII-IIIII") === false);

/* --- 3. LE CHIFFREMENT : le serveur ne doit jamais pouvoir lire --- */
const donnees = { "tasks": '{"a":1}', "vr-arsenal-v1": '{"sel":"frame"}' };
const paquet = await S.chiffre(code, donnees);
ok("le paquet a la forme attendue <vecteur>.<contenu>", paquetValide(paquet), paquet.slice(0, 28) + "…");
ok("le contenu en clair n'apparaît NULLE PART dans le paquet",
  paquet.indexOf("tasks") === -1 && paquet.indexOf("frame") === -1);
const relu = await S.dechiffre(code, paquet);
ok("le bon code redonne exactement les données",
  JSON.stringify(relu) === JSON.stringify(donnees), JSON.stringify(relu));
let refuse = false;
await S.dechiffre(S.genereCode(), paquet).catch(() => { refuse = true; });
ok("un AUTRE code ne déchiffre pas", refuse);
ok("deux chiffrements du même contenu diffèrent (vecteur aléatoire)",
  (await S.chiffre(code, donnees)) !== paquet);

/* --- 4. L'IDENTIFIANT envoyé au serveur ne révèle pas le code --- */
const id = await S.identifiant(code);
ok("l'identifiant est une empreinte hexadécimale de 32 signes", idValide(id), id);
ok("il ne contient pas le code", id.indexOf(S.normalise(code).slice(0, 8)) === -1);
ok("le même code redonne le même identifiant", (await S.identifiant(code)) === id);

/* --- 5. LA VALIDATION CÔTÉ SERVEUR --- */
ok("un identifiant non hexadécimal est refusé", idValide("ZZZ") === false && idValide("'; DROP TABLE sync;--") === false);
ok("un paquet mal formé est refusé", paquetValide("nimportequoi") === false);
ok("un paquet démesuré est refusé", paquetValide("A".repeat(300000) + ".B") === false);
ok("un non-texte est refusé", idValide(null) === false && paquetValide(null) === false);

console.log("----------------------------------------------------------------------");
if (echecs) { console.log("💥 GARDE-FOU : " + echecs + " cas en échec."); process.exit(1); }
console.log("🛡️  GARDE-FOU : la synchronisation tient — OK.");
process.exit(0);
