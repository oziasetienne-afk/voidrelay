/* Proxy CORS warframe.market — Vercel Function (19/10/2026).
 * Remplace le Worker Cloudflare : warframe.market renvoie 403 (« Just a moment »)
 * à TOUTES les requêtes sortant de Workers Cloudflare. Vercel sort par d'autres IP.
 * Coût : réponses mises en cache sur le CDN Vercel (s-maxage) -> la fonction ne tourne
 * qu'au premier appel par objet toutes les 5 min.
 */
const ALLOWED_HOST = "api.warframe.market";   // liste blanche stricte, jamais un proxy ouvert
const ALLOWED_PATH = /^\/v[12]\/[A-Za-z0-9_\-\/]*$/;
const TTL = 300;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Platform, Language",
  "X-Content-Type-Options": "nosniff",
};
const json = (obj, status, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS, ...extra } });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Max-Age": "86400" } });
}

export async function GET(request) {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) return json({ error: "Paramètre ?url manquant" }, 400);
  if (target.length > 300) return json({ error: "URL trop longue" }, 400);
  let up;
  try { up = new URL(target); } catch { return json({ error: "URL invalide" }, 400); }
  if (up.protocol !== "https:" || up.hostname !== ALLOWED_HOST || up.port || up.username || up.password)
    return json({ error: "Hôte non autorisé" }, 403);
  if (!ALLOWED_PATH.test(up.pathname)) return json({ error: "Chemin non autorisé (API v1/v2 uniquement)" }, 403);

  let r;
  try {
    r = await fetch(up.toString(), {
      headers: { Accept: "application/json", Platform: "pc", Language: "en", "User-Agent": "voidrelay.fr price proxy" },
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    return json({ error: "Échec amont" }, 502, { "Cache-Control": "no-store" });
  }
  const type = r.headers.get("Content-Type") || "";
  if (!type.includes("json")) return json({ error: "Réponse amont non JSON", status: r.status }, 502, { "Cache-Control": "no-store" });
  const body = await r.text();
  return new Response(body, {
    status: r.status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": r.ok ? `public, max-age=60, s-maxage=${TTL}, stale-while-revalidate=600` : "no-store",
      ...CORS,
    },
  });
}
