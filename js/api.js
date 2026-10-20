/* Couche d'accès aux API (WarframeStat.us + warframe.market) */
const WS="https://api.warframestat.us", MK="https://api.warframe.market/v1", MK2="https://api.warframe.market/v2";
const _cache=new Map();

async function getJSON(url){
  if(_cache.has(url)) return _cache.get(url);
  const r=await fetch(url,{headers:{Accept:"application/json"}});
  if(!r.ok) throw new Error("HTTP "+r.status);
  const d=await r.json(); _cache.set(url,d); return d;
}

/* warframe.market bloque le CORS navigateur : on passe par un proxy (avec secours).
   Proxy perso prioritaire si défini (cf. proxy/worker.js) : soit en dur ci-dessous,
   soit via Réglages (localStorage "wfproxy"). Les proxys publics restent en secours. */
const CUSTOM_PROXY="https://voidrelay-prix.vercel.app"; // proxy Vercel perso (19/10/2026 : warframe.market bloque les Workers Cloudflare) (prioritaire ; surchargeable via Réglages)
function getCustomProxy(){ try{const v=(localStorage.getItem("wfproxy")||CUSTOM_PROXY||"").trim().replace(/\/+$/,""); return /^https:\/\//i.test(v)?v:"";}catch(e){return /^https:\/\//i.test(CUSTOM_PROXY)?CUSTOM_PROXY:"";} }
function proxyChain(){
  const list=[], custom=getCustomProxy();
  if(custom) list.push(u=>`${custom}/?url=${encodeURIComponent(u)}`);
  list.push(u=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`);
  list.push(u=>`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`);
  return list;
}
async function getJSONProxy(target){
  if(_cache.has(target)) return _cache.get(target);
  let err;
  for(const wrap of proxyChain()){
    try{
      const r=await fetch(wrap(target),{headers:{Accept:"application/json"}});
      if(!r.ok) throw new Error("HTTP "+r.status);
      const d=await r.json(); _cache.set(target,d); return d;
    }catch(e){err=e;}
  }
  throw err||new Error("proxy indisponible");
}

/* Points de market_history.json d'UN seul rang : celui du dernier point étiqueté.
   Depuis le 20/10/2026 chaque point d'un objet à rangs porte r ; avant, le rang
   basculait 0 ↔ max d'une passe à l'autre et la série alternait 30 / 90 sur Primed
   Flow. Un point sans r d'un objet à rangs est écarté ; un objet sans rang n'a
   aucun r et garde tout. */
function memeRang(serie){
  const tag=(serie||[]).filter(p=>p.r!==undefined);
  if(!tag.length) return serie||[];
  const r=tag[tag.length-1].r; return tag.filter(p=>p.r===r);
}

const API={
  news:()=>getJSON(`${WS}/pc/news?language=${apiLang()}`),
  world:()=>{const u=`${WS}/pc?language=${apiLang()}`;_cache.delete(u);return getJSON(u);},
  warframes:()=>getJSON(`${WS}/warframes?language=${apiLang()}`),
  weapons:()=>getJSON(`${WS}/weapons?language=${apiLang()}`),
  mods:()=>getJSON(`${WS}/mods?language=${apiLang()}`),
  arcanes:()=>getJSON(`${WS}/arcanes?language=${apiLang()}`),
  items:()=>getJSON(`${WS}/items?language=${apiLang()}`),
  /* Statistiques d'un objet. v1/statistics est la DERNIÈRE dépendance v1 du site et
     warframe.market démonte sa v1 endpoint par endpoint (v1/items et riven : morts le
     16/07/2026). Repli v1-compatible : prix du moment depuis v2 orders/top, courbe 90 j
     depuis data/market_history.json (alimenté 1×/jour par le pipeline hub, 124
     objets suivis). Le repli sert aussi quand un objet n'a AUCUNE vente sur 48 h mais
     des offres en cours (avant : « — », maintenant : le prix du carnet d'offres). */
  marketStats: async (u) => {
    let v1 = null;
    try { v1 = await getJSONProxy(`${MK}/items/${u}/statistics`); } catch (e) {}
    if (v1 && v1.payload && v1.payload.statistics_closed) return v1;
    const key = "stats-fallback:" + u;
    if (_cache.has(key)) return _cache.get(key);
    const top = await getJSONProxy(`${MK2}/orders/item/${encodeURIComponent(u)}/top`);
    const sells = ((top && top.data && top.data.sell) || []).map(o => o.platinum).sort((a, b) => a - b);
    const now = new Date().toISOString();
    const h48 = sells.length ? [{ datetime: now, median: sells[Math.floor(sells.length / 2)], min_price: sells[0], volume: 0, order_type: "sell" }] : [];
    let d90 = [];
    try {
      const hist = await getJSON("/data/market_history.json");
      d90 = memeRang(((hist && hist.items) || hist || {})[u] || []).map(p => ({ datetime: p.d + "T12:00:00Z", median: p.median, volume: 0 }));
    } catch (e) {}
    const res = { payload: { statistics_closed: { "48hours": h48, "90days": d90.concat(h48) }, statistics_live: { "48hours": h48, "90days": d90 } }, _fallback: "v2-top+historique-local" };
    _cache.set(key, res);
    return res;
  },
  /* Compte (lecture seule, sans login) — via API v2 : v1/profile est mort/CF-bloqué,
     v2/orders/user/{slug} fonctionne (cf. tests). v2/items pour mapper itemId→nom/icône. */
  wmUserOrders:(slug)=>getJSONProxy(`${MK2}/orders/user/${encodeURIComponent(slug)}`),
  wmItemsV2:()=>getJSONProxy(`${MK2}/items`),
  /* v1/items (catalogue) et les 3 API riven ont été RETIRÉS par warframe.market
     (constaté 16/07/2026 : 404/404/400) — définitions supprimées, ne pas les recréer. */
};

/* Image d'un objet WarframeStat */
const itemImg=it=>it.imageName?`https://cdn.warframestat.us/img/${it.imageName}`:(it.wikiaThumbnail||"");

/* Régulation du débit warframe.market (~3 req/s) */
let _gate=Promise.resolve();
function throttle(ms=330){const n=_gate.then(()=>new Promise(r=>setTimeout(r,ms)));_gate=n;return n;}

/* Exécute fn sur chaque élément, 3 ouvriers en parallèle, avec progression */
async function mapLimit(arr,fn,onProg,limit=3){
  const res=new Array(arr.length); let i=0,done=0;
  async function worker(){
    while(i<arr.length){const k=i++;try{res[k]=await fn(arr[k]);}catch(e){res[k]=null;}done++;onProg&&onProg(done,arr.length);}
  }
  await Promise.all(Array.from({length:Math.min(limit,arr.length)},worker));
  return res;
}

/* Résume des stats warframe.market : volume 48h + dernier prix médian.

   POUR LES OBJETS À RANGS (mods primés, arcanes), UN SEUL PRIX EST UN MENSONGE.
   Relevé le 04/09/2026 sur les statistiques 48 h réelles :

     Arcane Energize     rang 5 : 136,6 p (196 échangés) · rang 0 :  8,1 p (280)
     Primed Flow         rang 10 :  89,1 p (143)          · rang 0 : 32,3 p (187)
     Primed Continuity   rang 10 : 106,5 p  (83)          · rang 0 : 45,9 p (110)

   Un facteur DIX-SEPT sur l'Arcane Energize, et le rang le plus ÉCHANGÉ est
   à chaque fois le rang 0 — pas celui dont on cite le prix. Aucune des deux
   valeurs n'est fausse : ce sont deux objets différents qui portent le même
   nom. Choisir en silence, c'est tromper la moitié des visiteurs.

   On garde donc le prix du rang MAX comme chiffre principal (c'est celui qu'on
   cite quand on dit « un Flow Primé vaut 89 »), MAIS on rend aussi le détail
   par rang pour que les pages puissent le dire. `rangs` est trié du plus
   échangé au moins échangé. */
function summarizeStats(stats){
  const c=stats&&stats.payload&&stats.payload.statistics_closed; if(!c) return null;
  let h=c["48hours"]||[], d=c["90days"]||[];
  const dernierMedian=(...listes)=>{
    for(const l of listes) for(let k=l.length-1;k>=0;k--) if(l[k].median) return l[k].median;
    return null;
  };
  const ranks=h.concat(d).map(b=>b.mod_rank).filter(r=>typeof r==="number");
  let rang=null, rangs=[];
  if(ranks.length){
    const distincts=[...new Set(ranks)].sort((a,b)=>a-b);
    rangs=distincts.map(r=>{
      const hr=h.filter(b=>b.mod_rank===r), dr=d.filter(b=>b.mod_rank===r);
      return {r, vol:hr.reduce((a,b)=>a+(b.volume||0),0), price:dernierMedian(hr,dr)||0};
    }).filter(x=>x.price>0).sort((a,b)=>b.vol-a.vol);
    rang=Math.max(...distincts);
    h=h.filter(b=>b.mod_rank===rang); d=d.filter(b=>b.mod_rank===rang);
  }
  const vol=h.reduce((a,b)=>a+(b.volume||0),0);
  return {vol, price:dernierMedian(h,d)||0, rang, rangs};
}

/* Historique 90 jours (médiane + volume par jour). warframe.market fournit déjà
   l'historique : pas besoin de backend. Pour les objets à rangs (arcanes/mods),
   on regroupe par jour en gardant la médiane de l'entrée la plus échangée. */
function extractHistory(stats){
  const c=stats&&stats.payload&&stats.payload.statistics_closed; if(!c) return [];
  const rows=c["90days"]||[];
  const byDay=new Map();
  for(const b of rows){
    if(!b||!b.datetime) continue;
    const day=String(b.datetime).slice(0,10);
    const prev=byDay.get(day);
    const vol=b.volume||0;
    if(!prev){ byDay.set(day,{date:day,median:b.median||0,volume:vol,_best:vol}); }
    else{ prev.volume+=vol; if(vol>=prev._best){prev._best=vol;prev.median=b.median||prev.median;} }
  }
  return [...byDay.values()].sort((a,b)=>a.date<b.date?-1:1);
}
