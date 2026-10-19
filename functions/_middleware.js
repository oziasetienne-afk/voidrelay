// VoidRelay — protection par mot de passe DÉSACTIVÉE (site PUBLIC, 04/06/2026, ordre du Chef).
// Ce fichier ÉCRASE volontairement l'ancien Basic Auth à chaque déploiement :
// le bouton « 📦 Déployer VoidRelay » copie sans supprimer, donc un simple retrait
// du fichier ne suffirait pas — l'écrasement, si.
// ↩️ REMETTRE la protection = recopier
//    Automatisations/Warframe/_archive_protection/_middleware.js.OFF
//    ici (functions/_middleware.js) puis re-cliquer « 📦 Déployer VoidRelay ».
// Les variables SITE_USER / SITE_PASSWORD du projet Cloudflare Pages ne sont
// plus lues par personne (supprimables dans le dashboard, sans urgence).
export const onRequest = (context) => context.next();
