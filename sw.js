/* Service worker : coque en cache (stale-while-revalidate), données réseau d'abord. */
const CACHE="wf-hub-v152";
/* Caches à NE PAS purger à l'activation : « wf-alerts » porte la configuration et
   l'historique des alertes des joueurs (écrits par le SW lui-même, voir plus bas). */
const GARDER=[CACHE,"wf-alerts"];
/* Délai avant de se rabattre sur le cache pour /data/*.json (21/10/2026 : un visiteur
   revenu après 2 jours voyait « Données du 19/10 » alors que le réseau en avait de neuves). */
const DELAI_DONNEES=2500;
/* items.json (~198 Ko) n'est PAS pré-caché : il est chargé à la demande (palette de
   recherche) puis mis en cache par le handler fetch ci-dessous. Évite 198 Ko forcés
   à la 1re visite. */
const SHELL=["./","./index.html","./css/style.css","./css/pandaahh.css","./js/i18n.js","./js/data.js","./js/api.js","./js/views.js","./js/outil-page.js","./js/profil.js","./js/profil-classement.js",
  "./manifest.webmanifest","./offline.html"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
/* À l'activation : si un onglet /arsenal est DÉJÀ ouvert (1re visite — la
   navigation n'est pas passée par le SW), pré-cacher l'arsenal tout de suite. */
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>!GARDER.includes(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
  .then(()=>self.clients.matchAll({type:"window",includeUncontrolled:true}))
  .then(cls=>{if(cls.some(c=>/\/(en\/)?arsenal$/.test(new URL(c.url).pathname))) return precacheArsenal();}));});
/* Arsenal HORS-LIGNE (17/07/2026) : à la première visite de /arsenal (FR ou EN),
   on pré-cache en tâche de fond la page jumelle, le moteur et les données cuites
   — le simulateur fonctionne ensuite sans réseau (add() individuels : un échec
   n'empêche pas les autres, contrairement à addAll). */
const ARSENAL=["/arsenal","/en/arsenal","/js/arsenal.js","/data/arsenal/warframes.json",
  "/data/arsenal/armes.json","/data/arsenal/compagnons.json","/data/arsenal/mods.json",
  "/data/arsenal/arcanes.json","/data/arsenal/arcanes_armes.json","/data/arsenal/meta.json",
  "/data/arsenal/postures.json",
  "/data/arsenal_builds.json","/assets/arsenal/orbiter.webp","/js/vendor/lz-string.min.js","/js/vendor/qrcode.js"];
function precacheArsenal(){
  return caches.open(CACHE).then(c=>Promise.all(ARSENAL.map(u=>
    c.match(u).then(hit=>hit?null:c.add(u).catch(()=>null)))));
}
/* Réponse de repli marquée « X-VR-Cache: hors-ligne » + message aux pages (bandeau). */
async function depuisCache(e,hit){
  try{
    const cl=e.clientId&&await self.clients.get(e.clientId);
    (cl?[cl]:await self.clients.matchAll({type:"window"})).forEach(c=>c.postMessage({type:"vr-donnees-hors-ligne"}));
  }catch(_){}
  const h=new Headers(hit.headers); h.set("X-VR-Cache","hors-ligne");
  return new Response(hit.body,{status:hit.status,statusText:hit.statusText,headers:h});
}
async function donnees(e){
  const req=e.request;
  // Le fetch réseau continue après le délai : il met le cache à jour pour la visite suivante.
  const reseau=fetch(req).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c));}return r;});
  e.waitUntil(reseau.catch(()=>null));
  let expire=false;
  try{
    const r=await Promise.race([reseau,new Promise((_,ko)=>setTimeout(()=>{expire=true;ko();},DELAI_DONNEES))]);
    if(r.status<500) return r;
  }catch(_){}
  const hit=await caches.open(CACHE).then(c=>c.match(req));
  if(hit) return depuisCache(e,hit);
  return expire?reseau:Response.error();
}
self.addEventListener("fetch",e=>{
  const req=e.request; if(req.method!=="GET") return;
  const url=new URL(req.url);
  if(req.mode==="navigate"&&/^\/(en\/)?arsenal$/.test(url.pathname)) e.waitUntil(precacheArsenal());
  // Images cross-origin (vignettes de secours sur warframe.market notamment) : passthrough
  // natif AVANT la branche warframestat/warframe.market ci-dessous, qui re-fetch()/cache.put
  // pense pour les appels JSON de prix, pas pour des <img> no-cors. Separation correcte
  // par construction (deja l'intention du commentaire plus bas, jamais appliquee a cette
  // branche precise) ; req.destination identifie une requete image sans ambiguite avec les
  // appels JSON, peu importe l'hote.
  if(req.destination==="image" && url.origin!==location.origin) return;
  if(/warframestat\.us|warframe\.market/.test(url.hostname)){
    e.respondWith(fetch(req).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c));return r;}).catch(()=>caches.match(req)));
    return;
  }
  // Cross-origin (images CDN OSRS/PoE, API tierces de prix, pub) : passthrough natif,
  // le SW ne doit PAS intercepter — sinon images/fetch externes cassent.
  if(url.origin!==location.origin) return;
  // Données (/data/*.json) : RÉSEAU D'ABORD, cache seulement si le réseau échoue ou dépasse
  // le délai. Le stale-while-revalidate ci-dessous servait des prix vieux de 2 jours.
  if(/^\/data\/.+\.json$/.test(url.pathname)){ e.respondWith(donnees(e)); return; }
  // Coque (même origine) : stale-while-revalidate — sert le cache TOUT DE SUITE et
  // rafraîchit en arrière-plan, donc plus jamais bloqué sur une vieille version.
  e.respondWith(caches.match(req).then(hit=>{
    const net=fetch(req).then(r=>{if(r.ok&&url.origin===location.origin){const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c));}return r;}).catch(()=>hit);
    return hit||net.then(r=>{
      // Ni cache ni réseau pour une navigation (page jamais visitée, hors ligne) :
      // page hors-ligne de marque plutôt que l'erreur générique du navigateur.
      if(!r && req.mode==="navigate") return caches.match("./offline.html");
      return r;
    });
  }));
});

/* ---------- Notifications & alertes ---------- */
const ICON="assets/icon-192.png";

/* Clic sur une notification : focalise un onglet existant ou en ouvre un. */
self.addEventListener("notificationclick",e=>{
  e.notification.close();
  const url=(e.notification.data&&e.notification.data.url)||"./";
  e.waitUntil((async()=>{
    const cls=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for(const c of cls){ if("focus" in c){ try{ if(url&&url!=="./"&&"navigate" in c) await c.navigate(url);}catch(_){} return c.focus(); } }
    if(self.clients.openWindow) return self.clients.openWindow(url);
  })());
});

/* Push serveur (si un backend VAPID est ajouté plus tard) : affiche la notification. */
self.addEventListener("push",e=>{
  let d={}; try{ d=e.data?e.data.json():{}; }catch(_){ d={body:e.data&&e.data.text()}; }
  e.waitUntil(self.registration.showNotification(d.title||"VoidRelay",
    {body:d.body||"",tag:d.tag||"wf-push",icon:ICON,badge:ICON,data:{url:d.url||"./"}}));
});

/* Vérif en arrière-plan (best-effort, Chrome/PWA) : Baro, Nuit Cetus, prix cibles. */
self.addEventListener("periodicsync",e=>{ if(e.tag==="wf-alerts") e.waitUntil(checkAlertsBg()); });

async function readJSONCache(key){ try{const r=await (await caches.open("wf-alerts")).match(key); return r?await r.json():null;}catch(_){return null;} }
async function writeJSONCache(key,obj){ try{await (await caches.open("wf-alerts")).put(key,new Response(JSON.stringify(obj),{headers:{"Content-Type":"application/json"}}));}catch(_){} }

async function checkAlertsBg(){
  const cfg=await readJSONCache("/__alerts_config"); if(!cfg||!cfg.enabled) return;
  const fired=(await readJSONCache("/__alerts_fired"))||{};
  const cut=Date.now()-7*864e5; for(const k in fired){ if(fired[k]<cut) delete fired[k]; }
  const fire=async(key,title,body,url)=>{ if(fired[key]) return; fired[key]=Date.now(); await writeJSONCache("/__alerts_fired",fired);
    await self.registration.showNotification(title,{body,tag:key,icon:ICON,badge:ICON,data:{url:url||"./"}}); };
  try{
    if(cfg.baro||cfg.cetus){
      const w=await fetch("https://api.warframestat.us/pc?language=fr").then(r=>r.json());
      if(cfg.baro&&w.voidTrader&&w.voidTrader.active){ const t=w.voidTrader;
        await fire("baro-"+(t.activation||t.location||"now"),"🛒 Baro Ki'Teer est là",(t.location||"")+" — repart dans "+(t.endString||"")+".","/hub"); }
      if(cfg.cetus&&w.cetusCycle){ const c=w.cetusCycle, night=c.isDay===false||/night|nuit/i.test(c.state||"");
        if(night) await fire("cetus-"+(c.expiry||c.timeLeft||""),"🌙 Nuit sur Cetus","C'est l'heure des Eidolons ! Reste "+(c.timeLeft||"")+".","/hub"); }
    }
    if(cfg.favs&&cfg.targets){
      const mk=await fetch("./data/market.json").then(r=>r.json());
      const prices={}; Object.values(mk.categories||{}).flat().forEach(r=>prices[r.name]=r.price);
      const day=new Date().toISOString().slice(0,10);
      for(const n in cfg.targets){ const p=prices[n], tg=cfg.targets[n].t;
        if(p&&p>=tg) await fire("fav-"+n+"-"+tg+"-"+day,"🎯 Prix cible atteint",n+" est à "+p+" PL (cible "+tg+" PL).","/favoris"); }
    }
    if(Array.isArray(cfg.foundry)){
      for(const f of cfg.foundry){ if(f&&f.finishAt&&f.finishAt<=Date.now()) await fire("foundry-"+f.name+"-"+f.finishAt,"⏳ Fabrication prête",f.name+" est prêt à la Foundry.","/fonderie"); }
    }
  }catch(_){}
}
