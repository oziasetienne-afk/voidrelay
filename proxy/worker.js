/* Proxy CORS pour warframe.market — Cloudflare Worker (gratuit, 100 000 req/jour).
 *
 * warframe.market bloque le CORS côté navigateur ; ce Worker relaie les requêtes
 * en ajoutant les en-têtes CORS et un cache court. Plus rapide et plus fiable que
 * les proxys publics partagés (allorigins/codetabs).
 *
 * Déploiement : voir proxy/README.md.
 * Usage : https://TON-worker.workers.dev/?url=https%3A%2F%2Fapi.warframe.market%2Fv1%2Fitems%2Fash_prime_set%2Fstatistics
 */

const ALLOWED_HOSTS = ["api.warframe.market"]; // liste blanche stricte — jamais un proxy ouvert
const ALLOWED_PATH = /^\/v[12]\//;            // uniquement l'API publique v1/v2 (lecture)
const CACHE_TTL = 300;                          // secondes

const CORS = {
  "X-Content-Type-Options": "nosniff",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Platform, Language",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (request.method !== "GET")
      return json({ error: "Méthode non autorisée" }, 405);

    const target = new URL(request.url).searchParams.get("url");
    if (!target) return json({ error: "Paramètre ?url manquant" }, 400);

    let upstream;
    try {
      upstream = new URL(target);
    } catch (_) {
      return json({ error: "URL invalide" }, 400);
    }
    if (upstream.protocol !== "https:")
      return json({ error: "HTTPS requis" }, 400);
    if (!ALLOWED_HOSTS.includes(upstream.hostname))
      return json({ error: "Hôte non autorisé : " + upstream.hostname }, 403);
    if (!ALLOWED_PATH.test(upstream.pathname))
      return json({ error: "Chemin non autorisé (API v1/v2 uniquement)" }, 403);

    // Cache Cloudflare (clé = URL cible normalisée).
    const cache = caches.default;
    const cacheKey = new Request("https://proxy.cache/" + encodeURIComponent(upstream.toString()));
    let res = await cache.match(cacheKey);
    if (res) return withCors(res);

    let r;
    try {
      r = await fetch(upstream.toString(), {
        headers: { Accept: "application/json", Platform: "pc", Language: "en", "User-Agent": "warframe-hub-proxy/1.0" },
        cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
      });
    } catch (e) {
      return json({ error: "Échec amont : " + (e && e.message) }, 502);
    }

    const body = await r.text();
    res = new Response(body, {
      status: r.status,
      headers: {
        "Content-Type": r.headers.get("Content-Type") || "application/json",
        "Cache-Control": "public, max-age=" + CACHE_TTL,
        ...CORS,
      },
    });
    if (r.ok) await cache.put(cacheKey, res.clone());
    return res;
  },
};

function withCors(res) {
  const h = new Headers(res.headers);
  for (const k in CORS) h.set(k, CORS[k]);
  return new Response(res.body, { status: res.status, headers: h });
}
function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
