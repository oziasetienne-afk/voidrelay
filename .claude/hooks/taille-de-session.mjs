#!/usr/bin/env node
/** Hook « taille de session » (UserPromptSubmit), règle reprise du projet Application (04/10/2026) (VoidRelay : voidrelay/TAILLE_DES_CHATS.md dans le Project claude.ai).
 *  À chaque message, mesure combien de jetons la session relit à chaque étape et prévient quand elle grossit trop :
 *    - moins de 250 000 jetons ajoutés depuis le début de la session : rien ne s'affiche ;
 *    - 250 000 à 350 000 : « PRÉVENIR » (finir la tâche en cours, ne pas en commencer une grosse) ;
 *    - plus de 350 000 : « CHANGER DE SESSION » (écrire la passation à la fin de l'étape en cours).
 *  On compte ce qui a été AJOUTÉ depuis la première réponse : la base fixe (consignes, outils) est relue dans toute
 *  session neuve, changer de session ne la fait pas baisser (mesuré le 04/10 : ~362 000 jetons dans un chat du Project).
 *  Ne bloque jamais : en cas de souci (fichier absent, ligne illisible), il se tait et sort avec le code 0.
 *  Aucun effet sur le site : rien ne charge ce fichier côté navigateur. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const SEUIL_PREVENIR = 250_000;
export const SEUIL_CHANGER = 350_000;

/** Jetons relus à chaque étape pour une ligne « usage » d'une réponse, ou null si la ligne n'en a pas. */
function jetons(usage) {
  if (!usage || usage.cache_read_input_tokens == null) return null;
  return (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
}

/** Lit un journal de session (JSONL) : base = première réponse mesurée, actuel = dernière. */
export function mesurer(texte) {
  let base = null;
  let actuel = null;
  for (const ligne of texte.split("\n")) {
    if (!ligne.trim()) continue;
    let r;
    try { r = JSON.parse(ligne); } catch { continue; }
    if (r?.type !== "assistant") continue;
    const t = jetons(r.message?.usage);
    if (t == null) continue;
    if (base == null) base = t;
    actuel = t;
  }
  if (actuel == null) return null;
  return { base, actuel, ajoute: actuel - base };
}

export function verdict(ajoute) {
  if (ajoute < SEUIL_PREVENIR) return "OK";
  if (ajoute < SEUIL_CHANGER) return "PREVENIR";
  return "CHANGER";
}

const fmt = (n) => n.toLocaleString("fr-FR").replace(/ | /g, " ");

/** Message à afficher, ou null quand tout va bien. */
export function message(m) {
  if (!m) return null;
  const v = verdict(m.ajoute);
  const chiffres = `${fmt(m.actuel)} jetons relus à chaque étape, dont ${fmt(m.ajoute)} ajoutés depuis le début de la session`;
  if (v === "PREVENIR") return `Taille de session : PRÉVENIR (${chiffres}). Finir la tâche en cours, ne pas en commencer une grosse.`;
  if (v === "CHANGER") return `Taille de session : CHANGER DE SESSION (${chiffres}). À la fin de l'étape en cours (jamais au milieu d'une mise en production ou d'une migration), écrire la passation dans docs/PASSATION.md, puis dire à l'admin d'ouvrir une nouvelle session.`;
  return null;
}

/** Repli si le hook ne reçoit pas le chemin du journal : le plus récent des journaux de sessions. */
function dernierJournal() {
  const racine = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "projects");
  let meilleur = null;
  for (const dossier of readdirSync(racine)) {
    let fichiers;
    try { fichiers = readdirSync(join(racine, dossier)); } catch { continue; }
    for (const f of fichiers) {
      if (!f.endsWith(".jsonl")) continue;
      const chemin = join(racine, dossier, f);
      const m = statSync(chemin).mtimeMs;
      if (!meilleur || m > meilleur.m) meilleur = { chemin, m };
    }
  }
  return meilleur?.chemin ?? null;
}

async function main() {
  let entree = "";
  for await (const morceau of process.stdin) entree += morceau;
  let chemin = null;
  try { chemin = JSON.parse(entree || "{}").transcript_path ?? null; } catch { /* entrée illisible : repli */ }
  if (!chemin) chemin = dernierJournal();
  if (!chemin) return;
  const texte = message(mesurer(readFileSync(chemin, "utf8")));
  if (!texte) return;
  // systemMessage : affiché à l'admin ; additionalContext : lu par la session, qui écrit alors la passation.
  process.stdout.write(JSON.stringify({
    systemMessage: texte,
    hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: texte },
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(() => {}).finally(() => process.exit(0));
}
