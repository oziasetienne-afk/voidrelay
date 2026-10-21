// Harnais du service worker (21/10/2026) : charge sw.js dans un vm avec un faux
// environnement (caches, fetch, horloge) et écrit un JSON {label, ok, extra} par ligne.
// Lancé par test_sw_robustesse.py. Aucun navigateur : les défauts visés (hôte non ancré,
// respondWith(undefined), put non attendu, minuteur, alerte marquée avant envoi) ne se
// voient pas depuis une page.
import fs from "node:fs";
import vm from "node:vm";

const SRC = fs.readFileSync(new URL("../../sw.js", import.meta.url), "utf8");
const sortie = [];
const noter = (label, ok, extra = "") => sortie.push({ label, ok: !!ok, extra: String(extra) });
const rejetsNonGeres = [];
process.on("unhandledRejection", r => rejetsNonGeres.push(String(r)));
const pause = ms => new Promise(r => setTimeout(r, ms));

function monde({ reseau, quotaPlein = false, showNotification } = {}) {
  const magasins = new Map(), ecouteurs = {}, minuteurs = new Set(), notifs = [];
  const cle = k => (typeof k === "string" ? k : k.url);
  const ouvrir = nom => {
    if (!magasins.has(nom)) magasins.set(nom, new Map());
    const m = magasins.get(nom);
    return {
      match: async k => { const r = m.get(cle(k)); return r ? r.clone() : undefined; },
      put: async (k, v) => { await pause(15); if (quotaPlein && nom.startsWith("wf-hub")) throw new Error("QuotaExceededError"); m.set(cle(k), v); },
      add: async () => {}, addAll: async () => {}, keys: async () => [...m.keys()].map(url => ({ url })),
    };
  };
  const caches = {
    open: async nom => ouvrir(nom),
    match: async k => { for (const [, m] of magasins) { const r = m.get(cle(k)); if (r) return r.clone(); } },
    keys: async () => [...magasins.keys()], delete: async () => true,
  };
  const timers = {
    setTimeout: (f, ms) => { const t = setTimeout(() => { minuteurs.delete(t); f(); }, ms); minuteurs.add(t); t._ms = ms; return t; },
    clearTimeout: t => { minuteurs.delete(t); clearTimeout(t); },
  };
  const self = {
    addEventListener: (t, f) => { ecouteurs[t] = f; },
    clients: { get: async () => null, matchAll: async () => [], claim: async () => {} },
    registration: { showNotification: showNotification || (async (t, o) => { notifs.push({ t, o }); }) },
    skipWaiting() {},
  };
  const ctx = vm.createContext({
    self, caches, Response, Headers, URL, Promise, Date, JSON, Array, Object, Error, console,
    fetch: (req, ...a) => reseau(typeof req === "string" ? req : req.url, req),
    location: { origin: "https://voidrelay.test" }, ...timers,
  });
  vm.runInContext(SRC, ctx);
  const evt = req => {
    const e = { request: { method: "GET", mode: "cors", destination: "", ...req }, attente: [], reponse: undefined, repondu: false };
    e.respondWith = p => { e.repondu = true; e.reponse = Promise.resolve(p); };
    e.waitUntil = p => { e.attente.push(Promise.resolve(p)); };
    return e;
  };
  const lancer = async req => { const e = evt(req); ecouteurs.fetch(e); return e; };
  const finir = async e => { await Promise.allSettled(e.attente); };
  return { magasins, minuteurs, notifs, ecouteurs, evt, lancer, finir, ouvrir };
}
const rep = (corps, status = 200) => new Response(corps, { status });
const ORI = "https://voidrelay.test";

// 1) hôte ancré
{
  const w = monde({ reseau: async () => rep("{}") });
  for (const [h, attendu] of [["warframe.market.exemple.com", false], ["api.warframestat.us.evil.io", false],
                              ["evilwarframe.market", false], ["api.warframe.market", true], ["warframe.market", true],
                              ["api.warframestat.us", true]]) {
    const e = await w.lancer({ url: `https://${h}/v1/x` });
    noter(`hôte ${h} ${attendu ? "intercepté" : "laissé au navigateur"}`, e.repondu === attendu, `repondu=${e.repondu}`);
    await w.finir(e); if (e.reponse) await e.reponse.catch(() => {});
  }
}
// 1b) seules les réponses ok sont mises en cache
for (const [status, cache] of [[404, false], [500, false], [200, true]]) {
  const w = monde({ reseau: async () => rep("{}", status) });
  const e = await w.lancer({ url: "https://api.warframe.market/v1/items" });
  await e.reponse; await w.finir(e);
  const present = !!(await (await w.ouvrir("wf-hub-v153")).match("https://api.warframe.market/v1/items"))
    || [...w.magasins.values()].some(m => m.has("https://api.warframe.market/v1/items"));
  noter(`warframe.market ${status} ${cache ? "mis" : "jamais mis"} en cache`, present === cache, `en cache=${present}`);
}
// 2) coque : jamais respondWith(undefined)
{
  const w = monde({ reseau: async () => { throw new TypeError("hors ligne"); } });
  const e = await w.lancer({ url: ORI + "/css/inconnu.css" });
  const r = await e.reponse;
  noter("coque hors ligne sans cache : Response.error(), pas undefined", r instanceof Response && r.type === "error", String(r));
  const off = await w.ouvrir("wf-hub-v153"); await off.put("./offline.html", rep("hors ligne"));
  const n = await w.lancer({ url: ORI + "/jamais-vue", mode: "navigate" });
  const rn = await n.reponse;
  noter("navigation hors ligne sans cache : offline.html", rn instanceof Response && (await rn.text()) === "hors ligne");
}
// 3) put attendu + protégé (quota plein)
{
  const w = monde({ reseau: async () => rep('{"a":1}') });
  const e = await w.lancer({ url: ORI + "/data/summary.json" });
  const r = await e.reponse; await w.finir(e);
  const stocke = [...w.magasins.values()].some(m => m.has(ORI + "/data/summary.json"));
  noter("données : cache.put terminé avant la fin de l'événement (waitUntil)", stocke && r.ok);
  const c = monde({ reseau: async () => rep("body{}") });
  const ec = await c.lancer({ url: ORI + "/css/x.css" });
  await ec.reponse; await c.finir(ec);
  noter("coque : cache.put terminé avant la fin de l'événement (waitUntil)", [...c.magasins.values()].some(m => m.has(ORI + "/css/x.css")));
  rejetsNonGeres.length = 0;
  for (const url of [ORI + "/data/summary.json", ORI + "/css/y.css", "https://api.warframe.market/v1/z"]) {
    const q = monde({ reseau: async () => rep("ok"), quotaPlein: true });
    const eq = await q.lancer({ url });
    const rq = await eq.reponse.catch(x => "KO:" + x);
    const fin = await Promise.allSettled(eq.attente);
    noter(`quota plein (${url.replace(/^https:\/\/[^/]+/, "")}) : réponse servie`, rq instanceof Response && rq.ok, String(rq));
    noter(`quota plein (${url.replace(/^https:\/\/[^/]+/, "")}) : waitUntil sans rejet`, fin.every(f => f.status === "fulfilled"));
  }
  await pause(50);
  noter("quota plein : aucune promesse rejetée non gérée", rejetsNonGeres.length === 0, rejetsNonGeres.join("|"));
}
// 4) minuteur du délai annulé
{
  const w = monde({ reseau: async () => rep("{}") });
  const e = await w.lancer({ url: ORI + "/data/summary.json" });
  await e.reponse; await w.finir(e);
  noter("délai des données : minuteur annulé quand le réseau répond", w.minuteurs.size === 0, `restants=${w.minuteurs.size}`);
}
// 5) alertes en arrière-plan
const config = { enabled: true, baro: true, cetus: false, favs: true, targets: { Nova: { t: 10 } },
                 foundry: [{ name: "Forma", finishAt: 1 }] };
async function alertes({ reseau, showNotification }) {
  const w = monde({ reseau, showNotification });
  await (await w.ouvrir("wf-alerts")).put("/__alerts_config", rep(JSON.stringify(config)));
  const e = w.evt({}); e.tag = "wf-alerts"; w.ecouteurs.periodicsync(e);
  await Promise.allSettled(e.attente);
  const fired = await (await w.ouvrir("wf-alerts")).match("/__alerts_fired");
  return { w, fired: fired ? await fired.json() : {} };
}
const marche = JSON.stringify({ categories: { mods: [{ name: "Nova", price: 50 }] } });
const baroOk = JSON.stringify({ voidTrader: { active: true, activation: "A1", location: "Relais", endString: "2j" } });
{
  const { fired, w } = await alertes({ reseau: async u => rep(u.includes("market.json") ? marche : baroOk),
    showNotification: async () => { throw new Error("permission refusée"); } });
  noter("showNotification en échec : aucune alerte marquée « envoyée »", Object.keys(fired).length === 0, JSON.stringify(fired));
}
{
  const { fired, w } = await alertes({ reseau: async u => rep(u.includes("market.json") ? marche : baroOk) });
  noter("showNotification réussi : alertes marquées", Object.keys(fired).length === 3 && w.notifs.length === 3, `${Object.keys(fired).length} marquées, ${w.notifs.length} envoyées`);
}
{
  const { w } = await alertes({ reseau: async u => { if (u.includes("warframestat")) throw new TypeError("réseau"); return rep(marche); } });
  noter("warframestat en échec : prix cibles et Foundry notifiés quand même", w.notifs.length === 2, w.notifs.map(n => n.t).join("|"));
}
{
  const { w } = await alertes({ reseau: async u => u.includes("market.json") ? rep("<html>erreur</html>", 500) : rep(baroOk) });
  noter("market.json en 500 : Baro et Foundry notifiés quand même", w.notifs.length === 2, w.notifs.map(n => n.t).join("|"));
}
{
  let appelsJson = 0;
  const r500 = { ok: false, status: 500, json: async () => { appelsJson++; return {}; } };
  await alertes({ reseau: async u => u.includes("market.json") ? r500 : rep(baroOk) });
  noter("market.json : r.ok contrôlé avant r.json()", appelsJson === 0, `json() appelé ${appelsJson} fois`);
}
for (const l of sortie) console.log(JSON.stringify(l));
