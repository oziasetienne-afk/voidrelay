/* ============================================================================
   VoidRelay — blocage OPTIONNEL des requêtes externes pour les garde-fous
   Playwright (03/09/2026).

   POURQUOI. Dans un conteneur sans egress, chaque page met ~12,7 s à charger,
   dont 12,5 à attendre Google Fonts et AdSense avant qu'ils n'échouent. Les
   garde-fous y deviennent inutilisables : plusieurs heures pour un scan, donc
   aucune vérification possible avant de pousser, donc des allers-retours de
   13 minutes vers le CI pour départager des hypothèses. C'est exactement ce
   qui a coûté le plus cher le 03/09/2026.

   COMPORTEMENT PAR DÉFAUT : INCHANGÉ. Le blocage ne s'active que si
   VR_BLOQUER_EXTERNE=1 est dans l'environnement. Le CI ne définit pas cette
   variable, donc il continue de mesurer les pages telles que les voit un
   visiteur, ressources tierces comprises.

   CE QUE ÇA NE REMPLACE PAS. Un scan local ainsi accéléré ne prouve pas
   l'absence de défaut lié à une ressource tierce — il ne voit ni les polices
   ni la publicité. Il sert à itérer vite ; le CI reste le juge.
   ========================================================================== */

export const BLOCAGE_ACTIF = process.env.VR_BLOQUER_EXTERNE === "1";

/** Coupe toute requête sortant de localhost. À appeler sur chaque page. */
export async function bloquerExterne(page) {
  if (!BLOCAGE_ACTIF) return false;
  await page.route("**", (route) => {
    let hote = "";
    try { hote = new URL(route.request().url()).hostname; } catch { /* data:, blob: */ }
    return (!hote || hote === "localhost" || hote === "127.0.0.1" || hote === "[::1]")
      ? route.continue()
      : route.abort();
  });
  return true;
}

/** Ligne à afficher en tête de scan, pour qu'un résultat local ne soit jamais
    confondu avec un résultat de CI. */
export function noteBlocage() {
  return BLOCAGE_ACTIF
    ? "   ⚡ VR_BLOQUER_EXTERNE=1 : requêtes externes coupées (scan rapide, LOCAL — polices et publicité non chargées, le CI reste le juge)"
    : "";
}
