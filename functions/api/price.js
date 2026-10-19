// VoidRelay — fonction proxy serveur (Cloudflare Pages) vers warframe.market.
// POURQUOI un proxy : (1) warframe.market n'envoie PAS d'en-tête CORS → un fetch
// direct depuis le navigateur est bloqué ; (2) le navigateur n'appelle QUE /api/price
// (MÊME ORIGINE) → la CSP `connect-src 'self'` reste INTACTE (aucun domaine externe
// ajouté côté client). Lecture seule, données publiques. Ne touche jamais au jeu.
//
// GET /api/price?q=<nom d'objet>  →  { ok, slug, lowest, top5, median, ingame }

const WM = "https://api.warframe.market/v2";
const UA = "VoidRelay/1.0 (+https://voidrelay.fr; public read-only price helper)";

function json(obj, status = 200, maxAge = 60) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": `public, max-age=${maxAge}`,
    },
  });
}

// Index nom(EN, minuscule) → slug, mis en cache à l'edge 24 h (poli avec l'API).
async function itemsIndex() {
  const cache = (typeof caches !== "undefined" && caches.default) || null;
  const key = new Request("https://voidrelay.fr/__wm_items_index_v1");
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return hit.json();
  }
  const r = await fetch(`${WM}/items`, { headers: { "User-Agent": UA, Accept: "application/json" } });
  const raw = await r.text();
  if (!raw || !raw.trim()) throw new Error("items: corps vide (API dégradée)");
  const d = JSON.parse(raw);
  const idx = {};
  for (const it of d.data || []) {
    const name = it?.i18n?.en?.name || it.slug;
    if (name && it.slug) idx[name.toLowerCase()] = it.slug;
  }
  if (cache && Object.keys(idx).length) {
    await cache.put(key, new Response(JSON.stringify(idx), {
      headers: { "Content-Type": "application/json", "Cache-Control": "max-age=86400" },
    }));
  }
  return idx;
}

function resolveSlug(idx, q) {
  q = (q || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return null;
  if (idx[q]) return idx[q];
  const words = q.split(" ");
  const cands = Object.entries(idx).filter(([n]) => words.every((w) => n.includes(w)));
  cands.sort((a, b) => a[0].length - b[0].length); // le plus court = le plus proche
  return cands.length ? cands[0][1] : null;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const q = url.searchParams.get("q") || "";
  if (!q.trim()) return json({ ok: false, error: "paramètre q manquant" }, 400);
  try {
    const idx = await itemsIndex();
    const slug = resolveSlug(idx, q);
    if (!slug) return json({ ok: false, error: "objet introuvable", q }, 404);

    const r = await fetch(`${WM}/orders/item/${encodeURIComponent(slug)}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    const raw = await r.text();
    if (!raw || !raw.trim()) throw new Error("orders: corps vide (API dégradée)");
    const d = JSON.parse(raw);
    const orders = d.data || [];
    const sells = orders.filter((o) => o.type === "sell");
    const ingame = sells.filter((o) => o?.user?.status === "ingame");
    const online = sells.filter((o) => o?.user?.status === "online");
    const pool = (ingame.length ? ingame : online.length ? online : sells)
      .slice()
      .sort((a, b) => (a.platinum ?? 1e9) - (b.platinum ?? 1e9));
    const top5 = pool.slice(0, 5).map((o) => o.platinum);
    if (!top5.length) return json({ ok: false, error: "aucune offre de vente", slug }, 200);
    const median = [...top5].sort((a, b) => a - b)[Math.floor(top5.length / 2)];
    return json({
      ok: true,
      slug,
      name: slug.replace(/_/g, " "),
      lowest: top5[0],
      top5,
      median,
      ingame: ingame.length > 0,
      sellers: pool.length,
    });
  } catch (e) {
    return json({ ok: false, error: String(e && e.message ? e.message : e) }, 502);
  }
}
