/* Rendu des différentes pages. Chaque fonction écrit dans #app. */
const app=()=>document.getElementById("app");
const LOADING='<p class="loading">'+t("common.loading")+'</p>';
const errHtml=e=>'<p class="error">'+esc(t("common.error",{msg:(e&&e.message)||e}))+'</p>';

/* Favoris (localStorage) */
function getFavs(){ try{return JSON.parse(localStorage.getItem("favs")||"{}");}catch(e){return {};} }
function setFavs(f){ try{localStorage.setItem("favs",JSON.stringify(f));}catch(e){} }
function toggleFav(name,cat){ const f=getFavs(); if(f[name]) delete f[name]; else f[name]={name,cat,target:0}; setFavs(f); return !!f[name]; }

/* Palier de Maîtrise (MR) */
function getMR(){ return parseInt(localStorage.getItem("mr"))||0; }
function setMR(v){ try{localStorage.setItem("mr",String(parseInt(v)||0));}catch(e){} }
function mrBadge(req){
  if(req==null) return "";
  const my=getMR(), lock=my>0&&req>my;
  return `<span class="mrbadge ${my>0?(lock?"lock":"ok"):""}" title="Palier de Maîtrise minimum">${lock?"🔒 ":(my>0?"✓ ":"")}Palier ${req}</span>`;
}

/* Autocomplétion réutilisable (sur /data/items.json).
   CHEMIN ABSOLU, ET C'EST LE POINT. views.js est chargé aussi bien depuis la
   racine (/reliques-ce-soir) que depuis un sous-dossier (/en/relics-tonight) :
   en relatif, « data/items.json » résout vers /en/data/items.json et fait 404.
   Le catch rend alors une liste vide — l'autocomplétion anglaise ne proposait
   plus rien, sans le moindre message. Même piège que le flux RSS de hub.html
   en v74. Les trois fetch de données de ce fichier sont absolus pour ça. */
let _items=null;
async function ensureItems(){ if(!_items){ try{_items=await getJSON("/data/items.json");}catch(e){_items=[];} } return _items; }
function acAttach(inp,ac,onPick){
  const showAc=()=>{
    const q=inp.value.trim().toLowerCase();
    if(q.length<2){ac.classList.add("hide");return;}
    const starts=[],incl=[];
    for(const i of (_items||[])){const n=i.n.toLowerCase();if(n.startsWith(q))starts.push(i);else if(n.includes(q))incl.push(i);if(starts.length>=14)break;}
    const matches=starts.concat(incl).slice(0,14);
    if(!matches.length){ac.classList.add("hide");return;}
    ac.innerHTML=matches.map(m=>`<div class="acitem" data-u="${esc(m.u)}" data-n="${esc(m.n)}">${esc(m.n)}</div>`).join("");
    ac.classList.remove("hide");
    ac.querySelectorAll(".acitem").forEach(d=>d.addEventListener("click",()=>{ac.classList.add("hide");onPick(d.dataset.u,d.dataset.n);}));
  };
  inp.addEventListener("input",showAc);
  document.addEventListener("click",e=>{if(!e.target.closest(".acwrap"))ac.classList.add("hide");});
}
let _priceCache={};
async function itemPrice(u){ if(_priceCache[u]!=null) return _priceCache[u]; try{const s=summarizeStats(await API.marketStats(u));_priceCache[u]=s?Math.round(s.price):0;}catch(e){_priceCache[u]=0;} return _priceCache[u]; }
function copyText(t){ try{ if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(()=>toast("Copié ! Colle-le dans le chat du jeu.","good")).catch(()=>prompt("Copie ce message :",t)); return;} }catch(e){} prompt("Copie ce message :",t); }
function nf(n){return (Math.round(n)||0).toLocaleString("fr-FR");}
function skelCells(n){return Array.from({length:n||18},()=>'<div class="skel" style="aspect-ratio:.82"></div>').join("");}
function skelRank(){const c=`<section class="card pad">${Array.from({length:9},()=>'<div class="skline"></div>').join("")}</section>`;return c+c;}

/* Index nom→image (CDN WarframeStat) construit à la demande depuis warframes/weapons/items.
   Permet d'afficher des vignettes sur les listes basées sur warframe.market (qui n'a pas d'images). */
let _imgIndex=null,_imgPromise=null;
function normImg(name){return String(name||"").toLowerCase().replace(/\bset\b/g," ").replace(/[^a-z0-9]+/g,"");}
function ensureImgIndex(){
  if(_imgIndex) return Promise.resolve(_imgIndex);
  if(_imgPromise) return _imgPromise;
  _imgPromise=(async()=>{
    const idx=new Map();
    const add=it=>{const u=itemImg(it),k=normImg(it&&it.name);if(u&&k&&!idx.has(k))idx.set(k,u);};
    const lists=await Promise.all([API.warframes().catch(()=>[]),API.weapons().catch(()=>[]),API.arcanes().catch(()=>[]),API.items().catch(()=>[])]);
    lists.forEach(l=>(l||[]).forEach(add));
    _imgIndex=idx; return idx;
  })();
  return _imgPromise;
}
function imgForName(name){return _imgIndex?(_imgIndex.get(normImg(name))||""):"";}
/* Remplit les <img data-img="Nom"> d'un conteneur une fois l'index prêt (non bloquant). */
async function fillImages(root){
  try{ await ensureImgIndex(); }catch(e){ return; }
  (root||document).querySelectorAll("img[data-img]").forEach(img=>{
    const u=imgForName(img.getAttribute("data-img"));
    img.removeAttribute("data-img");
    if(u){ img.src=u; img.style.visibility=""; } else { img.remove(); }
  });
}
async function loadFeatured(){
  try{
    const s=await getSnapshot(); let all=[];
    Object.entries(s.categories).forEach(([cat,rows])=>rows.forEach(r=>all.push(Object.assign({},r,{cat}))));
    all.forEach(r=>r.score=(r.price||0)*Math.sqrt(r.vol||0));
    // Meilleur ratio platine/effort ; fallback sur un vrai objet (jamais un nom inventé).
    const top=all.filter(r=>r.price>0&&r.vol>0).sort((a,b)=>b.score-a.score)[0]
            ||all.filter(r=>r.price>0).sort((a,b)=>(b.price||0)-(a.price||0))[0];
    const el=document.getElementById("featured"); if(!top||!top.name||!el) return;
    // translate="no" : les noms d'objets warframe.market sont des noms propres —
    // on empêche la traduction automatique du navigateur (sinon « Melee » → « Modèle » en FR).
    el.innerHTML=`<div class="hero"><img class="heroimg" data-img="${esc(top.name)}" alt="" loading="lazy" style="visibility:hidden"><div class="ht">${esc(t("home.featBadge"))}</div><div class="hn" translate="no">${esc(top.name)}</div>
      <div class="hd">${esc(t("home.featDesc",{price:top.price,vol:top.vol,rec:top.rec}))}</div>
      <div class="hrow"><a class="btn primary" href="https://warframe.market/items/${slug(top.name)}" target="_blank" rel="noopener noreferrer">${esc(t("c.seeMarket"))}</a><a class="btn" href="#/farmer">${esc(t("home.topFarm"))}</a></div></div>`;
    fillImages(el);
  }catch(e){}
}

/* ---------------- Accueil ---------------- */
async function loadBaro(){
  try{
    const w=await API.world(); const t=w.voidTrader; const el=document.getElementById("baroAlert");
    if(!t||!el) return;
    const baroOn=baroActive(t);
    el.innerHTML=baroOn
      ? `<div class="warnbox" style="border-color:var(--good);background:rgba(52,211,153,.1)">🛒 <b>${esc(tr("baro.hereStrong"))}</b> — ${esc(t.location||"")} · ${esc(tr("baro.leavesIn",{t:baroDelay(t,true)}))}. <a href="#/monde">${esc(tr("baro.seeInv"))} →</a></div>`
      : `<div class="warnbox">🛒 ${esc(tr("baro.comingStrong"))} <b>${esc(t.location||"")}</b> ${esc(tr("baro.inDelay",{t:baroDelay(t,false)}))}. <a href="#/monde">${esc(tr("c.details"))} →</a></div>`;
    const c=w.cetusCycle, ce=document.getElementById("cetusAlert");
    if(c&&ce){
      const night = c.isDay===false || /night|nuit/i.test(c.state||"");
      ce.innerHTML = night
        ? `<div class="warnbox" style="border-color:#a5b4fc;background:rgba(99,102,241,.12)">🌙 <b>${esc(tr("cetus.nightStrong"))}</b> — ${esc(tr("cetus.eidolons",{t:c.timeLeft||""}))}</div>`
        : `<div class="warnbox">☀️ ${esc(tr("cetus.dayMsg",{t:c.timeLeft||""}))}</div>`;
    }
  }catch(e){}
}
function renderHome(){
  const SECTIONS=[
    ["home.secTrading",[
      ["#/marche","📊","page.marche","home.d.marche"],["#/favoris","⭐","page.favoris","home.d.favoris"],
      ["#/farmer","🌾","page.farmer","home.d.farmer"],["#/assistant","🧭","page.assistant","home.d.assistant"],
      ["#/foundry","⏳","page.foundry","home.d.foundry"],["#/courses","🛒","page.courses","home.d.courses"],
      ["#/trade","✉️","page.trade","home.d.trade"],["#/estimateur","🔎","page.estimateur","home.d.estimateur"],
      ["#/historique","📈","page.historique","home.d.historique"],["#/digest","🗞️","page.digest","home.d.digest"],
      ["#/bons-plans","🎁","page.bonsPlans","home.d.bonsPlans"],["#/ducats","🪙","page.ducats","home.d.ducats"],
      ["#/endo","♻️","page.endo","home.d.endo"]]],
    ["home.secTools",[
      ["#/rivens","🎲","page.rivens","home.d.rivens"],["#/riven-eval","💹","page.rivenEval","home.d.rivenEval"],
      ["#/comparateur","⚔️","page.comparateur","home.d.comparateur"],["#/reliquecalc","🔮","page.reliquecalc","home.d.reliquecalc"],
      ["#/relic-optim","🌙","page.relicOptim","home.d.relicOptim"],["#/builds","🛠️","page.builds","home.d.builds"],
      ["#/planner","🧪","page.planner","home.d.planner"],["#/codex","📖","page.codex","home.d.codex"]]],
    ["home.secGame",[
      ["#/monde","🌍","page.monde","home.d.monde"],["#/taches","✅","page.taches","home.d.taches"],
      ["#/guide","💎","page.guide","home.d.guide"],["#/actus","📰","page.actus","home.d.actus"],
      ["#/compte","👤","nav.account","home.d.compte"],["#/reglages","⚙️","nav.settings","home.d.reglages"]]],
  ];
  const OVERVIEW=[
    ["💰","home.ov1t","home.ov1d"],["🌾","home.ov2t","home.ov2d"],
    ["⚔️","home.ov3t","home.ov3d"],["📚","home.ov4t","home.ov4d"],
  ];
  app().innerHTML=`
    <h1>VoidRelay — Outils avancés</h1>
    <p class="sub">${esc(t("home.sub"))}</p>
    <div id="featured"></div>
    <div id="baroAlert"></div>
    <div id="cetusAlert"></div>
    <div id="dashboard"></div>
    <h2>${esc(t("home.overTitle"))}</h2>
    <div class="grid feat-grid">${OVERVIEW.map(([ic,tk,dk])=>`<article class="card feat"><div class="feat-h"><span class="feat-ic" aria-hidden="true">${ic}</span><h3>${esc(t(tk))}</h3></div><p>${esc(t(dk))}</p></article>`).join("")}</div>
    ${SECTIONS.map(([titleKey,tiles])=>`<h2>${esc(t(titleKey))}</h2><div class="grid cols-auto">${tiles.map(([h,ic,lk,dk])=>`<a class="card tile" href="${esc(h)}"><div class="t">${ic} ${esc(t(lk))}</div><div class="d">${esc(t(dk))}</div></a>`).join("")}</div>`).join("")}`;
  loadFeatured(); loadBaro(); loadDashboard();
}
/* Tableau de bord agrégé (accueil) : favoris + monde en bref + favoris farmables maintenant. */
async function loadDashboard(){
  const el=document.getElementById("dashboard"); if(!el) return;
  const cards=[]; const favs=getFavs(); const fk=Object.keys(favs);
  if(fk.length){
    let snap={}; try{const s=await getSnapshot();Object.values(s.categories).flat().forEach(r=>snap[r.name]={price:r.price});}catch(e){}
    let total=0,hits=0; const rows=fk.slice(0,6).map(n=>{const p=snap[n]?snap[n].price:0;total+=p;const tgt=favs[n].target||0;const hit=tgt>0&&p>=tgt;if(hit)hits++;return {n,p,hit};});
    cards.push(`<section class="card pad"><h3 style="margin-top:0">${esc(tr("home.favs"))}</h3>${rows.map(r=>`<div class="kv"><span class="k">${esc(r.n)}${r.hit?" 🟢":""}</span><span class="v">${r.p?r.p+" PL":"—"}</span></div>`).join("")}<p class="muted" style="margin-top:8px">${esc(tr("dash.tracked",{n:fk.length}))} · <a href="#/favoris">${esc(tr("c.manage"))} →</a>${hits?` · <b style="color:var(--good)">${esc(tr("dash.toSell",{n:hits}))}</b>`:""}</p></section>`);
  }
  let eraCount={};
  try{
    const w=await API.world(); const t=w.voidTrader, nw=w.nightwave;
    (w.fissures||[]).filter(f=>f.active!==false).forEach(f=>{const e=(f.tier||"").replace(/\s.*/,"");eraCount[e]=(eraCount[e]||0)+1;});
    let html=`<section class="card pad"><h3 style="margin-top:0">${esc(tr("home.brief"))}</h3>`;
    html+=`<div class="kv"><span class="k">${esc(tr("dash.baro"))}</span><span class="v">${t?(baroActive(t)?esc(tr("dash.baroHere",{loc:t.location||""})):esc(tr("dash.baroIn",{t:baroDelay(t,false)||"?"}))):"—"}</span></div>`;
    if(nw&&nw.activeChallenges) html+=`<div class="kv"><span class="k">${esc(tr("dash.nightwave"))}</span><span class="v">${esc(tr("dash.challenges",{n:nw.activeChallenges.length}))}</span></div>`;
    html+=`<div class="kv"><span class="k">${esc(tr("dash.fissures"))}</span><span class="v">${["Lith","Meso","Neo","Axi"].map(e=>e[0]+(eraCount[e]||0)).join(" · ")}</span></div>`;
    [["Cetus",w.cetusCycle],["Vallis",w.vallisCycle]].forEach(([n,c])=>{if(c&&c.state){const st=(n==="Cetus"&&c.isDay===false)?"night":(c.state||"").toLowerCase();html+=`<div class="kv"><span class="k">${n}</span><span class="v">${OW_CYCIC[st]||""} ${esc(owCycLabel(st))}</span></div>`;}});
    html+=`<p class="muted" style="margin-top:8px"><a href="#/monde">${esc(tr("c.details"))} →</a></p></section>`;
    cards.push(html);
  }catch(e){}
  if(fk.length){ try{
    await ensureFarmIndex();
    const activeEras=new Set(Object.keys(eraCount).filter(e=>eraCount[e]));
    const farmable=[];
    fk.forEach(n=>{const hit=farmLookup(n);if(hit&&["warframes","primary","secondary","melee"].includes(hit.cat)&&!hit.it.vaulted){const eras=new Set();(hit.it.components||[]).forEach(c=>(c.drops||[]).forEach(d=>{const m=(cleanRelic(d.location).match(/Lith|Meso|Neo|Axi/i)||[])[0];if(m)eras.add(m);}));if([...eras].some(e=>activeEras.has(e)))farmable.push(n);}});
    if(farmable.length) cards.push(`<section class="card pad"><h3 style="margin-top:0">${esc(tr("home.farmable"))}</h3><p class="muted" style="margin-top:0">${esc(tr("dash.farmableHint"))}</p>${farmable.slice(0,6).map(n=>`<div class="kv"><span class="k">${esc(n)}</span><span class="v"><a class="rlink" href="#/relic-optim">${esc(tr("c.optimize"))} →</a></span></div>`).join("")}</section>`);
  }catch(e){} }
  el.innerHTML=cards.length?`<h2>${esc(tr("home.dash"))}</h2><div class="grid cols-2">${cards.join("")}</div>`:"";
}

/* ---------------- Marché ---------------- */
const prettyName=u=>u.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
let _snapshot=null;
async function getSnapshot(){
  if(_snapshot) return _snapshot;
  const s=await getJSON("/data/market.json");
  // Format canonique (update_warframe_data.py) : {items:[{slug,median,sellOrders,…}],generated}.
  // Les vues historiques attendent {categories:{cat:[{name,vol,price,rec}]}} : on reconstruit
  // via les listes WATCH de data.js (même compat que marche.html, couverture 124/124).
  if(!s.categories&&Array.isArray(s.items)&&typeof WATCH!=="undefined"){
    const by={}; s.items.forEach(it=>{ if(it&&it.slug) by[it.slug]=it; });
    s.categories={};
    Object.entries(WATCH).forEach(([cat,slugs])=>{
      s.categories[cat]=slugs.map(u=>{
        const it=by[u]; if(!it) return null;
        const price=it.median||it.avgTop5||0;
        return {name:prettyName(u),vol:it.sellOrders||0,price,rec:Math.max(1,Math.round(price*0.85))};
      }).filter(Boolean);
    });
  }
  s.categories=s.categories||{};
  _snapshot=s; return _snapshot;
}
function readLive(cat){ try{const r=JSON.parse(localStorage.getItem("mkt_"+cat));if(r&&Date.now()-r.ts<7200000)return r;}catch(e){} return null; }
function writeLive(cat,rows){ try{localStorage.setItem("mkt_"+cat,JSON.stringify({ts:Date.now(),rows}));}catch(e){} }
function ago(ts){const m=Math.round((Date.now()-ts)/60000);return m<1?t("ago.now"):m<60?t("ago.min",{m}):t("ago.h",{h:Math.round(m/60)});}
function rankCol(title,sub,rows,valFn,unit,showSell,cat){
  const favs=getFavs();
  return `<section class="card pad rank"><h3>${title}</h3><p class="meta">${sub}</p>
    <ol style="list-style:none;margin:0;padding:0">${rows.map((r,i)=>`<li class="rrow">
      <span class="rnum">${i+1}</span>
      <button class="star" data-fav="${esc(r.name)}" data-cat="${cat||""}" title="${esc(t("mkt.addFav"))}">${favs[r.name]?"★":"☆"}</button>
      <img class="rimg" data-img="${esc(r.name)}" alt="" loading="lazy" style="visibility:hidden">
      <a class="rname rlink" href="https://warframe.market/items/${slug(r.name)}" target="_blank" rel="noopener noreferrer">${esc(r.name)} ↗</a>
      <span class="rval">${valFn(r)} <span class="u">${esc(unit)}</span>${showSell?`<br><span class="rsell">${esc(t("mkt.sell",{p:r.rec}))}</span>`:""}</span>
    </li>`).join("")||'<li class="muted">—</li>'}</ol></section>`;
}
async function renderMarket(cat){
  cat=cat||"warframes";
  app().innerHTML=`
    <h1>${esc(t("mkt.title"))}</h1>
    <p class="sub">${esc(t("mkt.sub"))}</p>
    <div class="pills" id="mpills">${Object.keys(WATCH).map(k=>`<button class="pill ${k===cat?"active":""}" data-c="${k}">${esc(t("cat."+k))}</button>`).join("")}</div>
    <div class="toolbar"><button class="btn primary" id="mlive">${esc(t("mkt.live"))}</button><span class="count" id="mstatus"></span></div>
    <div class="grid cols-2" id="mlist">${skelRank()}</div>`;
  document.getElementById("mpills").querySelectorAll(".pill").forEach(b=>b.addEventListener("click",()=>location.hash="#/marche/"+b.dataset.c));
  const list=document.getElementById("mlist"), status=document.getElementById("mstatus");
  const draw=(rows,label)=>{
    if(!rows||!rows.length){list.innerHTML='<p class="error">'+esc(t("mkt.noData"))+'</p>';status.textContent="";return;}
    status.textContent=label||"";
    const sold=[...rows].sort((a,b)=>b.vol-a.vol).slice(0,12);
    const exp=[...rows].filter(r=>r.price>0).sort((a,b)=>b.price-a.price).slice(0,12);
    list.innerHTML=
      rankCol(t("mkt.topSold"),t("mkt.topSoldSub"),sold,r=>r.vol,t("mkt.sales"),true,cat)+
      rankCol(t("mkt.priciest"),t("mkt.priciestSub"),exp,r=>Math.round(r.price),"PL",true,cat);
    list.querySelectorAll(".star").forEach(b=>b.addEventListener("click",()=>{const on=toggleFav(b.dataset.fav,b.dataset.cat);b.textContent=on?"★":"☆";toast(on?t("mkt.favAdded"):t("mkt.favRemoved"));}));
    fillImages(list);
  };
  // 1) Affichage INSTANTANÉ : cache live récent, sinon instantané pré-calculé
  try{
    const cached=readLive(cat);
    if(cached){ draw(cached.rows,t("mkt.liveAgo",{ago:ago(cached.ts)})); }
    else{ const s=await getSnapshot(); draw(s.categories[cat]||[],t("mkt.snapshot",{date:s.generated?new Date(s.generated).toLocaleString(getLang()):"—"})); }
  }catch(e){ list.innerHTML=errHtml(e); }
  // 2) Bouton Live : scan temps réel (proxy) + mise en cache 2 h
  document.getElementById("mlive").addEventListener("click",async()=>{
    status.textContent=t("mkt.scanning");
    try{
      const rows=(await mapLimit(WATCH[cat],async u=>{
        await throttle(110); const st=summarizeStats(await API.marketStats(u)); if(!st) return null;
        return {name:prettyName(u),vol:st.vol,price:st.price,rec:sellPrice(st.price)};
      },(d,tot)=>status.textContent=t("mkt.liveProgress",{d,tot}),8)).filter(Boolean);
      if(rows.length){ writeLive(cat,rows); draw(rows,t("mkt.liveNow")); }
      else status.textContent=t("mkt.liveFail");
    }catch(e){ status.textContent=t("mkt.liveErr",{msg:(e.message||e)}); }
  });
}

/* ---------------- Estimateur (avec autocomplétion en direct) ---------------- */
async function renderEstimator(){
  app().innerHTML=`
    <h1>${esc(t("page.estimateur"))}</h1>
    <p class="sub">${esc(t("est.sub"))}</p>
    <div class="acwrap"><input class="input" id="eq" placeholder="${esc(t("est.placeholder"))}" autocomplete="off"><div class="acbox hide" id="eac"></div></div>
    <div id="eres" style="margin-top:16px"></div>`;
  const res=document.getElementById("eres"), inp=document.getElementById("eq"), ac=document.getElementById("eac");
  await ensureItems();
  const estimate=async(u,name)=>{
    ac.classList.add("hide"); res.innerHTML=LOADING;
    try{
      const stats=await API.marketStats(u);
      const s=summarizeStats(stats), hist=extractHistory(stats);
      if(!s){res.innerHTML='<p class="error">'+esc(t("est.noData"))+'</p>';return;}
      res.innerHTML=`<section class="card pad">
        <div class="tile" style="padding:0;margin-bottom:8px"><div class="t">${esc(name||u)}</div></div>
        <div class="stats">
          <div class="st"><div class="l">${esc(t("est.median"))}</div><div class="vv">${Math.round(s.price)} PL</div></div>
          <div class="st"><div class="l">${esc(t("est.sellFast"))}</div><div class="vv" style="color:var(--good)">${sellPrice(s.price)} PL</div></div>
          <div class="st"><div class="l">${esc(t("est.vol48"))}</div><div class="vv">${s.vol}</div></div>
        </div>
        ${hist.length>=2?`<h3>${esc(t("est.histTitle"))}</h3>${priceChartSVG(hist)}`:""}
        <p class="muted" style="margin-top:12px">${esc(t("est.tip"))}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <button class="btn" id="efav">${getFavs()[name]?esc(t("c.following")):esc(t("c.follow"))}</button>
          ${hist.length>=2?`<button class="btn" id="ehist">${esc(t("est.fullHist"))}</button>`:""}
          <a class="btn" target="_blank" rel="noopener noreferrer" href="https://warframe.market/items/${u}">${esc(t("c.market"))}</a>
        </div>
      </section>`;
      const hb=document.getElementById("ehist");
      if(hb) hb.addEventListener("click",()=>{window._histPrefill=name||u;location.hash="#/historique";});
      const fb=document.getElementById("efav");
      if(fb) fb.addEventListener("click",()=>{const on=toggleFav(name);fb.textContent=on?t("c.following"):t("c.follow");});
    }catch(e){res.innerHTML=errHtml(e);}
  };
  acAttach(inp,ac,(u,n)=>{inp.value=n;estimate(u,n);});
  inp.addEventListener("keydown",e=>{if(e.key==="Enter"){const q=inp.value.trim().toLowerCase();const m=(_items||[]).find(i=>i.n.toLowerCase()===q)||(_items||[]).find(i=>i.n.toLowerCase().includes(q));if(m)estimate(m.u,m.n);}});
  if(window._estPrefill){const q=window._estPrefill;window._estPrefill=null;inp.value=q;const ql=q.toLowerCase();const m=(_items||[]).find(i=>i.n.toLowerCase()===ql)||(_items||[]).find(i=>i.n.toLowerCase().includes(ql));if(m)estimate(m.u,m.n);}
}

/* ---------------- Graphique de prix (SVG pur, sans dépendance) ---------------- */
/* history = [{date:"AAAA-MM-JJ", median, volume}] (cf. extractHistory). */
function priceChartSVG(history,opts){
  opts=opts||{};
  const h=(history||[]).filter(d=>d&&d.median>0);
  if(h.length<2) return '<p class="muted">'+esc(t("hist.noCurve"))+'</p>';
  const W=640,H=240, padL=44,padR=14,padT=16,padB=46, iw=W-padL-padR, ih=H-padT-padB;
  const prices=h.map(d=>d.median), vols=h.map(d=>d.volume||0);
  let pMin=Math.min(...prices), pMax=Math.max(...prices);
  if(pMin===pMax){pMin=Math.max(0,pMin-1);pMax=pMax+1;}
  const pad=(pMax-pMin)*0.12; pMin=Math.max(0,pMin-pad); pMax=pMax+pad;
  const vMax=Math.max(1,...vols);
  const n=h.length;
  const x=i=>padL+(n===1?iw/2:iw*i/(n-1));
  const y=v=>padT+ih-((v-pMin)/(pMax-pMin))*ih;
  const line=h.map((d,i)=>`${i?"L":"M"}${x(i).toFixed(1)} ${y(d.median).toFixed(1)}`).join(" ");
  const area=`${line} L${x(n-1).toFixed(1)} ${(padT+ih).toFixed(1)} L${x(0).toFixed(1)} ${(padT+ih).toFixed(1)} Z`;
  const bw=Math.max(1,iw/n*0.6);
  const bars=h.map((d,i)=>{const bh=(d.volume||0)/vMax*(padB-20);return `<rect x="${(x(i)-bw/2).toFixed(1)}" y="${(H-padB+14).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="var(--accent)" opacity=".22"/>`;}).join("");
  const gy=[pMin,(pMin+pMax)/2,pMax];
  const grid=gy.map(v=>`<line x1="${padL}" y1="${y(v).toFixed(1)}" x2="${W-padR}" y2="${y(v).toFixed(1)}" stroke="var(--border-soft)" stroke-width="1"/><text x="${padL-6}" y="${(y(v)+3).toFixed(1)}" fill="var(--dim)" font-size="10" text-anchor="end">${Math.round(v)}</text>`).join("");
  const fmtD=s=>{const p=String(s).split("-");return p.length===3?`${p[2]}/${p[1]}`:s;};
  const xl=[0,Math.floor((n-1)/2),n-1].map(i=>`<text x="${x(i).toFixed(1)}" y="${H-6}" fill="var(--dim)" font-size="10" text-anchor="middle">${fmtD(h[i].date)}</text>`).join("");
  const last=h[h.length-1], lastY=y(last.median);
  const id="g"+Math.round(pMin*100+pMax*7+n);
  return `<svg class="pchart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Historique du prix sur 90 jours">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--accent)" stop-opacity=".34"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${grid}${bars}
    <path d="${area}" fill="url(#${id})"/>
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(n-1).toFixed(1)}" cy="${lastY.toFixed(1)}" r="4" fill="var(--accent2)"/>
    ${xl}</svg>`;
}
/* Bandeau de stats min / médian actuel / max + variation, sous le graphe */
function historyStats(h){
  const v=(h||[]).filter(d=>d&&d.median>0); if(v.length<2) return "";
  const prices=v.map(d=>d.median), last=prices[prices.length-1], first=prices[0];
  const lo=Math.min(...prices), hi=Math.max(...prices);
  const chg=first>0?Math.round((last-first)/first*100):0;
  const col=chg>0?"var(--good)":chg<0?"var(--bad)":"var(--dim)";
  const totVol=v.reduce((a,d)=>a+(d.volume||0),0);
  return `<div class="stats" style="margin-top:14px">
    <div class="st"><div class="l">${esc(t("hist.curMedian"))}</div><div class="vv">${Math.round(last)} PL</div></div>
    <div class="st"><div class="l">${esc(t("hist.change90"))}</div><div class="vv" style="color:${col}">${chg>0?"+":""}${chg}%</div></div>
    <div class="st"><div class="l">${esc(t("hist.low90"))}</div><div class="vv">${Math.round(lo)} PL</div></div>
    <div class="st"><div class="l">${esc(t("hist.high90"))}</div><div class="vv">${Math.round(hi)} PL</div></div>
    <div class="st"><div class="l">${esc(t("hist.sold90"))}</div><div class="vv">${nf(totVol)}</div></div>
  </div>`;
}

/* ---------------- Historique des prix ---------------- */
async function renderHistory(){
  app().innerHTML=`
    <h1>${esc(t("page.historique"))}</h1>
    <p class="sub">${esc(t("hist.sub"))}</p>
    <div class="acwrap"><input class="input" id="hq" placeholder="${esc(t("hist.placeholder"))}" autocomplete="off"><div class="acbox hide" id="hac"></div></div>
    <div id="hres" style="margin-top:16px"><p class="muted">${esc(t("hist.choose"))}</p></div>`;
  const res=document.getElementById("hres"), inp=document.getElementById("hq"), ac=document.getElementById("hac");
  await ensureItems();
  const draw=async(u,name)=>{
    ac.classList.add("hide"); res.innerHTML=LOADING;
    try{
      const stats=await API.marketStats(u);
      const hist=extractHistory(stats), sum=summarizeStats(stats);
      if(hist.length<2){res.innerHTML='<p class="error">'+esc(t("hist.notEnough"))+'</p>';return;}
      res.innerHTML=`<section class="card pad">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px"><img data-img="${esc(name||u)}" alt="" loading="lazy" style="visibility:hidden;width:52px;height:52px;object-fit:contain;background:#0d1420;border-radius:10px"><div class="t" style="font-weight:700;font-size:1.12rem">${esc(name||u)}</div></div>
        ${priceChartSVG(hist)}
        ${historyStats(hist)}
        <p class="muted" style="margin-top:12px">${esc(t("hist.chartNote"))}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <button class="btn" id="hfav">${getFavs()[name]?esc(t("c.following")):esc(t("c.follow"))}</button>
          <a class="btn" target="_blank" rel="noopener noreferrer" href="https://warframe.market/items/${u}">${esc(t("c.market"))}</a>
          <a class="btn" href="#/estimateur">${esc(t("hist.estimate"))}</a>
        </div></section>`;
      const fb=document.getElementById("hfav");
      if(fb) fb.addEventListener("click",()=>{const on=toggleFav(name);fb.textContent=on?t("c.following"):t("c.follow");});
      fillImages(res);
    }catch(e){res.innerHTML=errHtml(e);}
  };
  acAttach(inp,ac,(u,n)=>{inp.value=n;draw(u,n);});
  inp.addEventListener("keydown",e=>{if(e.key==="Enter"){const q=inp.value.trim().toLowerCase();const m=(_items||[]).find(i=>i.n.toLowerCase()===q)||(_items||[]).find(i=>i.n.toLowerCase().includes(q));if(m)draw(m.u,m.n);}});
  if(window._histPrefill){const q=window._histPrefill;window._histPrefill=null;inp.value=q;const ql=q.toLowerCase();const m=(_items||[]).find(i=>i.n.toLowerCase()===ql)||(_items||[]).find(i=>i.n.toLowerCase().includes(ql));if(m)draw(m.u,m.n);}
}

/* ---------------- Guide ---------------- */
function renderGuide(){
  const sec=s=>`<section class="guide-sec" id="g-${s.id}"><h2 style="margin-top:0">${esc(s.title)}</h2>${
    s.blocks.map(b=>{
      if(b.p) return `<p>${esc(b.p)}</p>`;
      if(b.ul) return `<ul>${b.ul.map(li=>`<li>${esc(li)}</li>`).join("")}</ul>`;
      if(b.warn) return `<div class="warnbox">⚠️ ${esc(b.warn)}</div>`;
      return "";
    }).join("")}</section>`;
  app().innerHTML=`
    <h1>${t("page.guide")}</h1>
    <p class="sub">${t("gd.sub")}</p>
    <div class="guide-toc">${GUIDE.map(s=>`<a href="#g-${s.id}">${esc(s.title.replace(/^\d+\.\s*/,""))}</a>`).join("")}</div>
    ${GUIDE.map(sec).join("")}`;
}

/* ---------------- Builds (couverture complète : tous frames + armes) ---------------- */
const HAND={}; [...BUILDS.frames,...BUILDS.weapons].forEach(b=>{HAND[(b.name||"").toLowerCase()]=b;});
const BCAT={warframes:t("ccat.warframes"),primary:t("ccat.primary"),secondary:t("ccat.secondary"),melee:t("ccat.melee")};
const _bs={cat:"warframes",idx:0,sit:0};
const _bItems={};
/* Liens directs vers la fiche/build de l'item sur chaque site */
function pandaSlug(n){return n.toLowerCase().replace(/['’]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
function buildLinks(name){
  const wiki=name.replace(/ /g,"_");
  return `<section class="card pad linkbox">
    <h3 style="margin-top:0">${t("bld.linksTitle",{name:esc(name)})}</h3>
    <p class="muted" style="margin:0 0 12px">${t("bld.linksNote")}</p>
    <div class="linkrow">
      <a class="btn primary" href="${PANDAAHH}fr/builds/${pandaSlug(name)}" target="_blank" rel="noopener noreferrer">PandaaHH (FR) ↗</a>
      <a class="btn" href="https://wiki.warframe.com/w/${encodeURIComponent(wiki)}" target="_blank" rel="noopener noreferrer">${t("bld.wikiOfficial")}</a>
      <a class="btn" href="https://overframe.gg/search/?q=${encodeURIComponent(name)}" target="_blank" rel="noopener noreferrer">Overframe ↗</a>
    </div>
  </section>`;
}
async function renderBuilds(){
  const st=_bs;
  app().innerHTML=`
    <h1>${t("page.builds")}</h1>
    <p class="sub">${t("bld.sub")}</p>
    <div class="pills" id="bcats">${Object.entries(BCAT).map(([k,v])=>`<button class="pill ${k===st.cat?"active":""}" data-bc="${k}">${v}</button>`).join("")}</div>
    <div class="toolbar"><select class="input" id="bsel" style="max-width:380px"><option>${t("common.loading")}</option></select></div>
    <div id="bbody">${LOADING}</div>`;
  document.getElementById("bcats").querySelectorAll(".pill").forEach(b=>b.addEventListener("click",()=>{st.cat=b.dataset.bc;st.idx=0;st.sit=0;renderBuilds();}));
  let list;
  try{ list=_bItems[st.cat]||(_bItems[st.cat]=await fetchCodex(st.cat)); }
  catch(e){ document.getElementById("bbody").innerHTML=errHtml(e); return; }
  if(st.idx>=list.length) st.idx=0;
  const sel=document.getElementById("bsel");
  sel.innerHTML=list.map((x,i)=>`<option value="${i}" ${i===st.idx?"selected":""}>${esc(x.name)}${HAND[(x.name||"").toLowerCase()]?" ★":""}</option>`).join("");
  sel.addEventListener("change",e=>{st.idx=+e.target.value;st.sit=0;drawBuild();});
  drawBuild();

  function drawBuild(){
    const it=list[st.idx], hand=HAND[(it.name||"").toLowerCase()];
    const body=document.getElementById("bbody");
    const chips=arr=>arr.map(m=>`<span class="chip">${esc(m)}</span>`).join("");
    const links=buildLinks(it.name);
    const bimg=itemImg(it);
    const bimgTag=bimg?`<img src="${esc(bimg)}" alt="" loading="lazy" style="width:54px;height:54px;flex:none;object-fit:contain;background:radial-gradient(circle at 50% 30%,#16202f,#0c121b);border-radius:10px;padding:4px">`:"";
    if(hand){
      if(st.sit>=hand.builds.length) st.sit=0;
      const bd=hand.builds[st.sit];
      body.innerHTML=`
        <div class="pills" id="bsits">${hand.builds.map((x,i)=>`<button class="pill ${i===st.sit?"active":""}" data-bsi="${i}">${esc(x.situ)}</button>`).join("")}</div>
        <section class="card pad">
          <span class="tag up">${t("bld.tagDetail")}</span> ${mrBadge(it.masteryReq)}
          <div style="display:flex;align-items:center;gap:12px;margin-top:8px">${bimgTag}<h2 style="margin:0">${esc(hand.name)} <span class="muted" style="font-size:.85rem">— ${esc(bd.situ)}</span></h2></div>
          <p class="muted">${esc(hand.role)}</p>
          <h3>${t("bld.mods")}</h3><div class="chips">${chips(bd.mods)}</div>
          ${bd.arcanes&&bd.arcanes[0]&&bd.arcanes[0]!=="—"?`<h3>${t("bld.arcanes")}</h3><div class="chips">${chips(bd.arcanes)}</div>`:""}
          ${bd.shards&&bd.shards!=="—"?`<h3>${t("bld.shards")}</h3><p>${esc(bd.shards)}</p>`:""}
          <p style="margin-top:12px">${esc(bd.note)}</p>
          <div class="warnbox">💡 ${esc(hand.tip)}</div>
        </section>${links}`;
      body.querySelectorAll("[data-bsi]").forEach(x=>x.addEventListener("click",()=>{st.sit=+x.dataset.bsi;drawBuild();}));
    }else{
      let gen,ctx="";
      if(st.cat==="warframes"){
        gen=GEN_FRAME;
        if(it.passiveDescription) ctx+=`<h3>${t("bld.passive")}</h3><p class="muted">${esc(it.passiveDescription)}</p>`;
        if(Array.isArray(it.abilities)&&it.abilities.length) ctx+=`<h3>${t("bld.abilities")}</h3><ul>${it.abilities.map(a=>`<li><b>${esc(a.name)}</b> — ${esc(a.description||"")}</li>`).join("")}</ul>`;
      }else{
        gen=GEN_WEAPON[st.cat];
        const s=[];
        if(it.criticalChance!=null) s.push(t("bld.statCrit",{v:Math.round(it.criticalChance*100)}));
        if(it.procChance!=null) s.push(t("bld.statStatus",{v:Math.round(it.procChance*100)}));
        if(it.disposition!=null) s.push(t("bld.statDispo",{v:it.disposition}));
        if(s.length) ctx+=`<p class="muted">${s.join(" · ")}</p>`;
      }
      body.innerHTML=`
        <section class="card pad">
          <span class="tag">${t("bld.tagBase")}</span> ${mrBadge(it.masteryReq)}
          <div style="display:flex;align-items:center;gap:12px;margin-top:8px">${bimgTag}<h2 style="margin:0">${esc(it.name)}</h2></div>
          <p class="muted">${esc(it.type||"")}</p>
          ${ctx}
          <h3>${t("bld.startBuild")}</h3><div class="chips">${chips(gen.mods)}</div>
          <h3>${t("bld.recArcanes")}</h3><div class="chips">${chips(gen.arcanes)}</div>
          <p style="margin-top:12px">${esc(gen.note)}</p>
        </section>${links}`;
    }
  }
}

/* ---------------- Build planner (stats réelles) ---------------- */
const _plan={mode:"frame",idx:0,mods:[]};
const _planData={};
async function planList(mode){
  if(_planData[mode]) return _planData[mode];
  const r=mode==="frame"?await fetchCodex("warframes"):await fetchCodex("primary");
  return (_planData[mode]=r);
}
/* Somme des effets des mods équipés. */
function planSum(){
  const lib=PLANNER_MODS[_plan.mode==="frame"?"frame":"rifle"];
  const s={str:0,dur:0,range:0,eff:0,health:0,shield:0,armor:0,dmg:0,ms:0,cc:0,cd:0,status:0,elem:0,fr:0};
  _plan.mods.forEach(n=>{const m=lib.find(x=>x.n===n);if(m)for(const k in m.e)s[k]=(s[k]||0)+m.e[k];});
  return s;
}
function planFrameStats(it){
  const s=planSum();
  const pct=v=>Math.round((1+v)*100);
  const eff=Math.min(1.75,1+s.eff); // efficacité plafonnée à 175%
  const health=(it.health||0)*(1+s.health), shield=(it.shield||0)*(1+s.shield), armor=(it.armor||0)*(1+s.armor);
  const dr=armor/(armor+300);
  const ehp=Math.round(health/(1-dr)+shield);
  return [
   [t("stat.strength"),pct(s.str)+"%"],
   [t("stat.duration"),pct(s.dur)+"%"],
   [t("stat.range"),pct(s.range)+"%"],
   [t("stat.efficiency"),Math.round(eff*100)+"%"+(1+s.eff>1.75?t("pl.effCap"):"")],
   [t("stat.health"),Math.round(health)],
   [t("stat.shield"),Math.round(shield)],
   [t("stat.armor"),Math.round(armor)+" ("+t("pl.armorRed",{p:Math.round(dr*100)})+")"],
   [t("stat.ehp"),nf(ehp)],
  ];
}
function planWeaponStats(it){
  const s=planSum();
  const base=it.totalDamage||0;
  const dmg=base*(1+s.dmg+s.elem);            // dégâts/tir (physique modifié + éléments ajoutés)
  const ms=1+s.ms;
  const cc=Math.max(0,(it.criticalChance||0)*(1+s.cc));
  const cd=(it.criticalMultiplier||0)*(1+s.cd);
  const status=Math.max(0,(it.procChance||0)*(1+s.status));
  const fr=(it.fireRate||0)*(1+s.fr);
  const avgCrit=1+cc*(Math.max(0,cd-1));      // CC>100% = tiers de crit supérieurs (modèle moyen)
  const dps=dmg*ms*fr*avgCrit;
  return [
   [t("stat.dmgPerShot"),nf(Math.round(dmg))],
   [t("stat.multishot"),ms.toFixed(2)+"×"],
   [t("stat.critChance"),Math.round(cc*100)+"%"],
   [t("stat.critMult"),cd.toFixed(2)+"×"],
   [t("stat.status"),Math.round(status*100)+"%"],
   [t("stat.firerate"),fr.toFixed(1)+"/s"],
   [t("stat.dps"),nf(Math.round(dps))],
  ];
}
async function renderPlanner(param){
  // Build partagé via URL : #/planner/<base64url({m,i,d})>
  if(param){ try{const o=JSON.parse(b64d(param)); if(o&&o.m){ _plan.mode=o.m==="r"?"rifle":"frame"; _plan._pending={i:o.i,d:Array.isArray(o.d)?o.d:[]}; } }catch(e){} }
  app().innerHTML=`<h1>${t("page.planner")}</h1>
    <p class="sub">${t("pl.sub")}</p>
    <div class="pills" id="plmode">
      <button class="pill ${_plan.mode==="frame"?"active":""}" data-pm="frame">${t("pl.modeFrame")}</button>
      <button class="pill ${_plan.mode==="rifle"?"active":""}" data-pm="rifle">${t("pl.modeRifle")}</button></div>
    <div class="toolbar"><select class="input" id="plsel" style="max-width:340px"><option>${t("common.loading")}</option></select></div>
    <div class="grid cols-2" id="plbody">${LOADING}</div>`;
  document.getElementById("plmode").querySelectorAll(".pill").forEach(b=>b.addEventListener("click",()=>{if(_plan.mode!==b.dataset.pm){_plan.mode=b.dataset.pm;_plan.idx=0;_plan.mods=[];renderPlanner();}}));
  let list;
  try{ list=await planList(_plan.mode); }catch(e){ document.getElementById("plbody").innerHTML=errHtml(e); return; }
  if(!list.length){ document.getElementById("plbody").innerHTML=`<p class="empty">${t("pl.noItem")}</p>`; return; }
  if(_plan._pending){ const p=_plan._pending; _plan._pending=null;
    const i=list.findIndex(x=>x.name===p.i); if(i>=0)_plan.idx=i;
    const lib=PLANNER_MODS[_plan.mode==="frame"?"frame":"rifle"]; _plan.mods=(p.d||[]).filter(n=>lib.some(m=>m.n===n)).slice(0,PLANNER_SLOTS);
  }
  if(_plan.idx>=list.length)_plan.idx=0;
  const sel=document.getElementById("plsel");
  sel.innerHTML=list.map((x,i)=>`<option value="${i}" ${i===_plan.idx?"selected":""}>${esc(x.name)}</option>`).join("");
  sel.addEventListener("change",e=>{_plan.idx=+e.target.value;draw();});
  draw();
  function draw(){
    const it=list[_plan.idx], lib=PLANNER_MODS[_plan.mode==="frame"?"frame":"rifle"];
    const im=itemImg(it);
    const stats=(_plan.mode==="frame"?planFrameStats(it):planWeaponStats(it));
    const equipped=_plan.mods;
    const full=equipped.length>=PLANNER_SLOTS;
    const body=document.getElementById("plbody");
    body.innerHTML=`
      <section class="card pad">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
          ${im&&safeUrl(im)?`<img src="${esc(safeUrl(im))}" alt="" loading="lazy" style="width:56px;height:56px;object-fit:contain;background:radial-gradient(circle at 50% 30%,#16202f,#0c121b);border-radius:10px;padding:4px">`:""}
          <div><h2 style="margin:0">${esc(it.name)}</h2><span class="mt">${esc(_plan.mode==="frame"?t("pl.modeFrame"):(it.type||t("pl.weapon")))} · ${equipped.length}/${PLANNER_SLOTS} mods</span></div>
        </div>
        <div class="stats">${stats.map(([l,v])=>`<div class="st"><div class="l">${esc(l)}</div><div class="vv">${esc(String(v))}</div></div>`).join("")}</div>
        <div class="warnbox" style="margin-top:12px">${t("pl.modelNote")}</div>
      </section>
      <section class="card pad">
        <h3 style="margin-top:0">${t("pl.availMods")} ${full?`<span class="muted">${t("pl.full")}</span>`:""}</h3>
        <div class="chips" id="plmods">${lib.map(m=>{const on=equipped.includes(m.n);const dis=!on&&full;
          return `<button class="chip plchip ${on?"on":""}" data-mod="${esc(m.n)}" ${dis?"disabled":""} title="${esc(modTip(m))}">${esc(m.n)}</button>`;}).join("")}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn" id="plshare">${t("pl.copyLink")}</button>${equipped.length?`<button class="btn" id="plclear">${t("pl.clearAll")}</button>`:""}</div>
      </section>`;
    const sh=document.getElementById("plshare");
    if(sh) sh.addEventListener("click",()=>{const enc=b64e(JSON.stringify({m:_plan.mode==="frame"?"f":"r",i:it.name,d:_plan.mods}));copyText(location.origin+location.pathname+"#/planner/"+enc);});
    body.querySelectorAll("[data-mod]").forEach(b=>b.addEventListener("click",()=>{
      const n=b.dataset.mod, i=_plan.mods.indexOf(n);
      if(i>=0)_plan.mods.splice(i,1); else if(_plan.mods.length<PLANNER_SLOTS)_plan.mods.push(n);
      draw();
    }));
    const clr=document.getElementById("plclear"); if(clr)clr.addEventListener("click",()=>{_plan.mods=[];draw();});
  }
}
function modTip(m){
  const parts=[];const L={str:t("mtip.str"),dur:t("mtip.dur"),range:t("mtip.range"),eff:t("mtip.eff"),health:t("mtip.health"),shield:t("mtip.shield"),armor:t("mtip.armor"),dmg:t("mtip.dmg"),ms:t("mtip.ms"),cc:t("mtip.cc"),cd:t("mtip.cd"),status:t("mtip.status"),elem:t("mtip.elem"),fr:t("mtip.fr")};
  for(const k in m.e){const v=m.e[k];parts.push((v>=0?"+":"")+Math.round(v*100)+"% "+(L[k]||k));}
  if(m.el)parts.push("("+m.el+")");
  if(m.note)parts.push("— "+m.note);
  return parts.join(" · ");
}

/* drops / où farmer pour le Codex */
const cleanRelic=loc=>String(loc).replace(/\s*\((Radiant|Flawless|Exceptional|Intact)\)/,"");
function dropsHtml(it,cat){
  if(["warframes","primary","secondary","melee"].includes(cat)){
    const comps=(it.components||[]).filter(c=>c.drops&&c.drops.length);
    if(!comps.length) return "";
    const rows=comps.map(c=>{const rel=[...new Set(c.drops.map(d=>cleanRelic(d.location)))].slice(0,8);const ci=itemImg(c);
      return `<div class="kv"><span class="k" style="display:flex;align-items:center;gap:8px">${ci?`<img src="${esc(ci)}" alt="" loading="lazy" style="width:26px;height:26px;object-fit:contain;flex:none">`:""}${esc(c.name)}</span><span class="v">${esc(rel.join(", "))}</span></div>`;}).join("");
    return `<h3>${t("cx.whereRelics")}</h3>${rows}<div class="warnbox">${t("cx.relicTip")}</div>`;
  }
  if(cat==="mods"){
    const dr=(it.drops||[]).slice(0,8);
    if(!dr.length) return "";
    return `<h3>${t("cx.whereFarm")}</h3>${dr.map(d=>`<div class="kv"><span class="k">${esc(d.location||"?")}</span><span class="v">${d.chance!=null?d.chance+"%":""}</span></div>`).join("")}`;
  }
  if(cat==="relics"){
    const rw=it.rewards||[];
    if(rw.length){
      const sorted=[...rw].sort((a,b)=>(b.chance||0)-(a.chance||0));
      const dec=getLang()==="en"?".":",";
      const tier=i=> i<3?{l:t("rar.common"),intact:"25"+dec+"33",rad:"16"+dec+"67"} : i<5?{l:t("rar.uncommon"),intact:"11",rad:"20"} : {l:t("rar.rare"),intact:"2",rad:"10"};
      return `<h3>${t("cx.loot")}</h3>
        <div class="muted" style="margin-bottom:6px">${t("cx.lootNote")}</div>
        ${sorted.map((r,i)=>{const t=tier(i);const nm=(r.item&&r.item.name)||r.name||"?";
          return `<div class="kv"><span class="k">${esc(nm)} <span class="muted" style="font-size:.76rem">${t.l}</span></span><span class="v">${t.intact}% → <b style="color:var(--accent2)">${t.rad}%</b></span></div>`;}).join("")}`;
    }
  }
  return "";
}

/* Infos essentielles supplémentaires (passif, polarités, maîtrise, riven…) */
function codexExtra(it,cat){
  const kvline=(k,v)=>`<div class="kv"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`;
  let h="";
  if(cat==="warframes"){
    if(it.passiveDescription) h+=`<h3>${t("bld.passive")}</h3><p class="muted">${esc(it.passiveDescription)}</p>`;
    const kv=[];
    if(it.aura) kv.push([t("cx.auraPolarity"),it.aura]);
    if(it.exilus) kv.push([t("cx.exilusPolarity"),it.exilus]);
    if((it.polarities||[]).length) kv.push([t("cx.polarities"),it.polarities.join(", ")]);
    if(it.masteryReq!=null) kv.push([t("cx.minMr"),it.masteryReq]);
    if(/prime/i.test(it.name)&&it.vaulted!=null) kv.push([t("cx.availability"),it.vaulted?t("cx.vaulted"):t("cx.notVaulted")]);
    if(kv.length) h+=`<h3>${t("cx.infos")}</h3>${kv.map(x=>kvline(x[0],x[1])).join("")}`;
  }else if(["primary","secondary","melee"].includes(cat)){
    const kv=[];
    if(it.disposition!=null) kv.push([t("stat.dispo"),`${it.disposition}/5`]);
    if(it.masteryReq!=null) kv.push([t("cx.minMr"),it.masteryReq]);
    if((it.polarities||[]).length) kv.push([t("cx.polarities"),it.polarities.join(", ")]);
    if(it.rivenType) kv.push([t("cx.rivenType"),it.rivenType]);
    if(kv.length) h+=`<h3>${t("cx.infos")}</h3>${kv.map(x=>kvline(x[0],x[1])).join("")}`;
  }else if(cat==="mods"){
    const kv=[];
    if(it.baseDrain!=null) kv.push([t("cx.baseDrain"),it.baseDrain]);
    if(it.fusionLimit!=null) kv.push([t("cx.maxRank"),it.fusionLimit]);
    if(it.compatName) kv.push([t("stat.compat"),it.compatName]);
    if(it.masteryReq) kv.push([t("cx.minMr"),it.masteryReq]);
    if(kv.length) h+=`<h3>${t("cx.infos")}</h3>${kv.map(x=>kvline(x[0],x[1])).join("")}`;
    if(Array.isArray(it.levelStats)&&it.levelStats.length){
      const mx=it.levelStats[it.levelStats.length-1];
      if(mx.stats&&mx.stats.length) h+=`<h3>${t("cx.maxEffect")}</h3><ul>${mx.stats.map(s=>`<li>${esc(s)}</li>`).join("")}</ul>`;
    }
  }
  return h;
}

/* Idées de fashion frame pour un Warframe (gère Prime/Umbra → frame de base). */
function fashionFor(name){
  const base=String(name||"").replace(/\s+(Prime|Umbra)$/i,"").trim();
  return (typeof FASHION!=="undefined"&&FASHION[base])||(typeof FASHION_GENERIC!=="undefined"?FASHION_GENERIC:[]);
}
function fashionHtml(it){
  const ideas=fashionFor(it.name); if(!ideas.length) return "";
  const isPrime=/prime/i.test(it.name||"");
  return `<h3>${t("cx.fashionTitle")}</h3>
    <ul class="fashion">${ideas.map(s=>`<li>${esc(s)}</li>`).join("")}${isPrime?`<li class="muted">${t("cx.fashionPrime")}</li>`:""}</ul>
    <p class="muted" style="font-size:.8rem;margin:6px 0 0">${t("cx.fashionNote")}</p>`;
}

/* ---------------- Codex ---------------- */
const CODEX_LABEL={warframes:t("ccat.warframes"),primary:t("ccat.primary"),secondary:t("ccat.secondary"),melee:t("ccat.melee"),relics:t("ccat.relics"),mods:t("ccat.mods")};
const _codexCache={};
async function fetchCodex(cat){
  if(_codexCache[cat]) return _codexCache[cat];
  let r;
  if(cat==="warframes") r=(await API.warframes()||[]).filter(it=>it.type==="Warframe");
  else if(cat==="mods") r=await API.mods();
  else if(cat==="relics") r=(await API.items()||[]).filter(it=>(it.category||"")==="Relics"||/relic/i.test(it.type||""));
  else r=(await API.weapons()||[]).filter(w=>(w.category||"").toLowerCase()===cat);
  r=(r||[]).sort((a,b)=>(a.name||"").localeCompare(b.name||"","fr"));
  _codexCache[cat]=r; return r;
}
function codexMeta(it,cat){
  if(cat==="warframes") return it.type||t("cx.meta.warframe");
  if(cat==="mods") return [it.rarity,it.polarity].filter(Boolean).join(" • ")||t("cx.meta.mod");
  if(cat==="relics") return it.type||t("cx.meta.relic");
  return [it.type,it.trigger].filter(Boolean).join(" • ")||t("cx.meta.weapon");
}
function codexDetail(it,cat){
  const stat=(l,v)=>(v==null||v==="")?"":`<div class="st"><div class="l">${l}</div><div class="vv">${esc(v)}</div></div>`;
  let stats="";
  if(cat==="warframes") stats=[stat(t("stat.health"),it.health),stat(t("stat.shield"),it.shield),stat(t("stat.armor"),it.armor),stat(t("stat.energy"),it.power),stat(t("stat.speed"),it.sprintSpeed)].join("");
  else if(cat==="mods") stats=[stat(t("stat.rarity"),it.rarity),stat(t("stat.polarity"),it.polarity),stat(t("stat.compat"),it.compatName)].join("");
  else if(cat==="relics") stats=[stat(t("stat.type"),it.type)].join("");
  else stats=[stat(t("stat.damage"),it.totalDamage),stat(t("stat.firerate"),it.fireRate),stat(t("stat.crit"),it.criticalChance!=null?Math.round(it.criticalChance*100)+" %":null),stat(t("stat.mr"),it.masteryReq)].join("");
  const im=itemImg(it);
  openModal(`<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
    ${im?`<img style="width:110px;height:110px;object-fit:contain;background:#0d1420;border-radius:10px" src="${esc(im)}">`:""}
    <div><h2 style="margin:0">${esc(it.name||"?")}</h2><span class="mt">${esc(codexMeta(it,cat))}</span></div></div>
    ${it.description?`<p class="muted">${esc(it.description)}</p>`:""}<div class="stats">${stats}</div>
    ${cat==="warframes"&&Array.isArray(it.abilities)?`<h3>${t("cx.abilities")}</h3><ul>${it.abilities.map(a=>`<li><b>${esc(a.name)}</b> — ${esc(a.description||"")}</li>`).join("")}</ul>`:""}
    ${codexExtra(it,cat)}
    ${dropsHtml(it,cat)}
    ${cat==="warframes"?fashionHtml(it):""}
    ${(["warframes","primary","secondary","melee"].includes(cat)&&/prime/i.test(it.name||""))?`<button class="btn primary" id="codexPrice" data-q="${esc((it.name||"")+" Set")}" style="margin-top:14px">${t("cx.seePrice")}</button>`:""}`);
  const pb=document.getElementById("codexPrice");
  if(pb) pb.addEventListener("click",()=>{closeModal();location.href="/estimateur?q="+encodeURIComponent(pb.dataset.q);});
}
async function renderCodex(cat){
  cat=cat||"warframes";
  let fFilter="all";
  const mrCat=["warframes","primary","secondary","melee"].includes(cat);
  const filterBar=cat==="warframes"?`<div class="pills" id="cfilter">
      <button class="pill active" data-f="all">${t("cx.filterAll")}</button>
      <button class="pill" data-f="prime">${t("cx.filterPrime")}</button>
      <button class="pill" data-f="std">${t("cx.filterStd")}</button></div>`
    :cat==="relics"?`<div class="pills" id="cfilter">
      <button class="pill active" data-f="all">${t("cx.filterAllF")}</button>
      <button class="pill" data-f="dispo">${t("cx.filterDispo")}</button>
      <button class="pill" data-f="vault">${t("cx.filterVault")}</button></div>`:"";
  app().innerHTML=`
    <h1>${t("page.codex")}</h1><p class="sub">${t("cx.sub")}</p>
    <div class="pills" id="cpills">${Object.keys(CODEX_LABEL).map(k=>`<button class="pill ${k===cat?"active":""}" data-c="${k}">${CODEX_LABEL[k]}</button>`).join("")}</div>
    ${filterBar}
    <div class="toolbar"><input class="input" id="cq" placeholder="${esc(t("cx.searchPh"))}" style="max-width:280px">
      ${mrCat?`<label class="muted" style="display:flex;align-items:center;gap:6px">${t("cx.myMr")} <input class="input" id="cmr" type="number" inputmode="numeric" style="max-width:78px" value="${getMR()||""}" placeholder="MR"></label>
      <label class="muted chk" style="border:none;padding:0"><input type="checkbox" id="conly"> ${t("cx.onlyUsable")}</label>`:""}
      <span class="count" id="ccount"></span></div>
    <div class="grid codex-grid" id="clist">${skelCells(18)}</div>`;
  document.getElementById("cpills").querySelectorAll(".pill").forEach(b=>b.addEventListener("click",()=>location.hash="#/codex/"+b.dataset.c));
  const list=document.getElementById("clist"),count=document.getElementById("ccount"),MAX=300; let items=[];
  const draw=()=>{
    const q=document.getElementById("cq").value.toLowerCase().trim();
    let f=items;
    if(cat==="warframes"&&fFilter!=="all") f=f.filter(it=>{const p=/prime/i.test(it.name||"");return fFilter==="prime"?p:!p;});
    if(cat==="relics"&&fFilter!=="all") f=f.filter(it=>fFilter==="vault"?it.vaulted:!it.vaulted);
    const only=document.getElementById("conly");
    if(mrCat&&only&&only.checked&&getMR()>0) f=f.filter(it=>it.masteryReq==null||it.masteryReq<=getMR());
    if(q) f=f.filter(i=>(i.name||"").toLowerCase().includes(q));
    const shown=f.slice(0,MAX);
    count.textContent=f.length>MAX?t("cx.countMax",{max:MAX,n:f.length}):t("cx.count",{n:f.length});
    list.innerHTML=shown.map((it,i)=>{const im=itemImg(it);
      const mr=(mrCat&&it.masteryReq!=null)?mrBadge(it.masteryReq):"";
      const rar=(cat==="mods"&&it.rarity)?` ic-rar-${String(it.rarity).toLowerCase().replace(/[^a-z]/g,"")}`:"";
      return `<article class="card ic${rar}" data-i="${i}"><img loading="lazy" src="${esc(im)}"><div class="info"><p class="nm">${esc(it.name||"?")}</p><span class="mt">${esc(codexMeta(it,cat))}</span>${mr}</div></article>`;
    }).join("")||`<p class="empty">${t("common.empty")}</p>`;
    list.querySelectorAll(".ic").forEach(c=>c.addEventListener("click",()=>codexDetail(shown[+c.dataset.i],cat)));
  };
  if(filterBar) document.getElementById("cfilter").querySelectorAll(".pill").forEach(b=>b.addEventListener("click",()=>{
    fFilter=b.dataset.f; document.getElementById("cfilter").querySelectorAll(".pill").forEach(x=>x.classList.toggle("active",x===b)); draw();
  }));
  if(mrCat){
    const mrIn=document.getElementById("cmr"), only=document.getElementById("conly");
    if(mrIn) mrIn.addEventListener("input",()=>{setMR(mrIn.value);draw();});
    if(only) only.addEventListener("change",draw);
  }
  try{items=await fetchCodex(cat);draw();document.getElementById("cq").addEventListener("input",draw);}catch(e){list.innerHTML=errHtml(e);}
}

/* ---------------- Monde ---------------- */
let _fiss={era:"all",hard:false}, _lastWorld=null;
async function renderWorld(){
  app().innerHTML=`<h1>${esc(t("page.monde"))}</h1><p class="sub">${esc(t("world.sub"))}</p>
    <div class="toolbar"><button class="btn" id="wr">${esc(t("world.refresh"))}</button><span class="count" id="wu"></span></div>
    <div class="pills" id="fpills">${[["all",t("world.fAll")],["Lith","Lith"],["Meso","Meso"],["Neo","Neo"],["Axi","Axi"]].map(([k,v])=>`<button class="pill ${_fiss.era===k?"active":""}" data-fe="${k}">${esc(v)}</button>`).join("")}<label class="chk" style="border:none;padding:4px 10px"><input type="checkbox" id="fhard" ${_fiss.hard?"checked":""}> ${esc(t("world.fHard"))}</label></div>
    <div class="grid cols-2" id="wlist">${LOADING}</div>`;
  document.getElementById("fpills").querySelectorAll("[data-fe]").forEach(b=>b.addEventListener("click",()=>{_fiss.era=b.dataset.fe;document.getElementById("fpills").querySelectorAll("[data-fe]").forEach(x=>x.classList.toggle("active",x===b));if(_lastWorld)draw(_lastWorld);}));
  document.getElementById("fhard").addEventListener("change",e=>{_fiss.hard=e.target.checked;if(_lastWorld)draw(_lastWorld);});
  const sec=(title,inner)=>inner?`<section class="card wc"><h3>${esc(title)}</h3><div class="body">${inner}</div></section>`:"";
  const kv=(k,v)=>(v==null||v==="")?"":`<div class="kv"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`;
  const draw=w=>{
    _lastWorld=w;
    const cyc=[["Cetus",w.cetusCycle],["Vallis",w.vallisCycle],["Cambion",w.cambionCycle],[t("cyc.Earth"),w.earthCycle],["Zariman",w.zarimanCycle],["Duviri",w.duviriCycle]].filter(c=>c[1]);
    const cycHtml=cyc.length?sec(t("world.cycles"),`<div class="cyc">${cyc.map(([n,c])=>`<div class="cy"><div class="n">${esc(n)}</div><span class="badge">${esc(c.state||"?")}</span><div class="muted cd" data-exp="${esc(c.expiry||"")}">${esc(c.timeLeft||"")}</div></div>`).join("")}</div>`):"";
    let fs=(w.fissures||[]).filter(f=>f.active!==false);
    if(_fiss.era!=="all") fs=fs.filter(f=>(f.tier||"").startsWith(_fiss.era));
    if(_fiss.hard) fs=fs.filter(f=>f.isHard);
    fs.sort((a,b)=>(a.tierNum||0)-(b.tierNum||0));
    const fis=fs.length?sec(`${t("world.fissures")} (${fs.length})`,fs.map(f=>kv(`${esc(f.tier)} — ${esc(f.missionType)}`,`${esc(f.node)} ${f.isHard?"⚔️":""}${f.isStorm?"🌀":""}`)).join("")):sec(t("world.fissures"),"<p class='muted'>"+esc(t("world.noFissure"))+"</p>");
    let sortie="";const s=w.sortie;
    if(s) sortie=sec(t("world.sortie"),kv(t("world.boss"),s.boss)+kv(t("world.faction"),s.faction)+kv(t("world.expires"),s.eta)+(s.variants||[]).map(v=>kv(v.missionType,v.node)).join(""));
    let baro="";const vt=w.voidTrader;
    if(vt) baro=baroActive(vt)?sec(`Baro — ${esc(vt.location||"")}`,kv(t("world.leavesIn"),baroDelay(vt,true))+(vt.inventory||[]).slice(0,12).map(i=>kv(i.item,`${i.ducats||0} d / ${i.credits||0} cr`)).join("")):sec("Baro Ki'Teer",kv(t("world.next"),vt.location)+kv(t("world.arrives"),baroDelay(vt,false)));
    const inv=(w.invasions||[]).filter(i=>!i.completed);
    const invs=inv.length?sec(`${t("world.invasions")} (${inv.length})`,inv.map(i=>kv(i.node,`${i.attackingFaction||""} vs ${i.defendingFaction||""} — ${Math.round(i.completion||0)}%`)).join("")):"";
    let archon="";const ah=w.archonHunt;
    if(ah&&ah.missions&&ah.missions.length) archon=sec(t("world.archon"),kv(t("world.boss"),ah.boss)+kv(t("world.faction"),ah.faction)+ah.missions.map(m=>kv(m.type,m.node)).join(""));
    let arb="";const a=w.arbitration;
    if(a&&a.node) arb=sec(t("world.arbitration"),kv(t("world.node"),a.node)+kv(t("world.type"),a.type)+kv(t("world.enemy"),a.enemy));
    let steel="";const sp=w.steelPath;
    if(sp&&sp.currentReward) steel=sec(t("world.steel"),kv(t("world.reward"),sp.currentReward.name)+kv(t("world.changesIn"),sp.remaining));
    let darvo="";const dd=(w.dailyDeals||[])[0];
    if(dd) darvo=sec(t("world.darvo"),kv(t("world.item"),dd.item)+kv(t("world.price"),`${dd.salePrice} PL (-${dd.discount}%)`)+kv(t("world.remaining"),`${dd.total-dd.sold} / ${dd.total}`)+kv(t("world.expires"),dd.eta));
    let sent="";const so=w.sentientOutposts;
    if(so&&so.active) sent=sec(t("world.sentient"),kv(t("world.node"),so.node)+kv(t("world.mission"),so.mission&&so.mission.type));
    let nw="";const n=w.nightwave;
    if(n&&n.activeChallenges&&n.activeChallenges.length) nw=sec(t("world.nightwaveT"),n.activeChallenges.map(c=>kv(c.title,(c.standing||0)+" pts")).join(""));
    let ev="";const events=(w.events||[]);
    if(events.length) ev=sec(t("world.events"),events.map(e=>kv(e.description||e.tooltip||t("world.event"),e.eta||"")).join(""));
    document.getElementById("wlist").innerHTML=[cycHtml,fis,sortie,archon,arb,steel,darvo,nw,sent,invs,ev].filter(Boolean).join("")||'<p class="empty">'+esc(t("world.noData"))+'</p>';
    document.getElementById("wu").textContent=t("world.updated",{t:new Date().toLocaleTimeString(getLang())});
    startCountdowns();
  };
  const load=async()=>{document.getElementById("wlist").innerHTML=LOADING;try{draw(await API.world());}catch(e){document.getElementById("wlist").innerHTML=errHtml(e);}};
  document.getElementById("wr").addEventListener("click",load); load();
}

/* ---------------- Actus ---------------- */
async function renderNews(){
  app().innerHTML=`<h1>${t("page.actus")}</h1><p class="sub">${t("news.sub")}</p>
    <div class="toolbar"><input class="input" id="nq" placeholder="${esc(t("news.filter"))}" style="max-width:360px"></div>
    <div class="grid cols-auto" id="nlist">${LOADING}</div>`;
  const _loc=getLang()==="en"?"en-US":"fr-FR";
  let data=[];
  const draw=()=>{
    const q=document.getElementById("nq").value.toLowerCase().trim();
    const items=q?data.filter(n=>(n.message||"").toLowerCase().includes(q)):data;
    document.getElementById("nlist").innerHTML=items.map(n=>{const up=/update|hotfix|mise à jour|patch/i.test(n.message||"");
      return `<article class="card news">${n.imageLink?`<img loading="lazy" src="${esc(safeUrl(n.imageLink))}" alt="">`:""}<div class="body">
        <span class="tag ${up?"up":""}">${up?t("news.tagUpdate"):t("news.tagNews")}</span>
        <p class="muted" style="margin:6px 0 4px">${n.date?new Date(n.date).toLocaleDateString(_loc):""}</p>
        <p style="margin:0 0 8px">${esc(n.message||"")}</p>
        ${n.link&&safeUrl(n.link)?`<a href="${esc(safeUrl(n.link))}" target="_blank" rel="noopener noreferrer">${t("news.read")}</a>`:""}</div></article>`;
    }).join("")||`<p class="empty">${t("news.empty")}</p>`;
  };
  try{data=(await API.news()||[]).sort((a,b)=>new Date(b.date)-new Date(a.date));draw();document.getElementById("nq").addEventListener("input",draw);}
  catch(e){document.getElementById("nlist").innerHTML=errHtml(e);}
}

/* ---------------- Compte warframe.market (liaison par pseudo, lecture seule) ---------------- */
function getWmUser(){ try{return JSON.parse(localStorage.getItem("wmuser")||"null");}catch(e){return null;} }
function setWmUser(u){ try{ u?localStorage.setItem("wmuser",JSON.stringify(u)):localStorage.removeItem("wmuser"); }catch(e){} }
const WM_REGISTER="https://warframe.market/";
/* Map itemId → {nom, slug, icône} depuis l'API v2 (pour nommer les ordres d'un utilisateur). */
let _v2map=null,_v2mapP=null;
function ensureV2ItemMap(){
  if(_v2map) return Promise.resolve(_v2map);
  if(_v2mapP) return _v2mapP;
  _v2mapP=(async()=>{ const m=new Map(); try{const r=await API.wmItemsV2(); ((r&&r.data)||[]).forEach(x=>{const en=(x.i18n&&x.i18n.en)||{}; m.set(x.id,{name:en.name||x.slug,slug:x.slug,icon:en.icon});}); }catch(e){} _v2map=m; return m; })();
  return _v2mapP;
}
const wmAsset=p=>p?("https://warframe.market/static/assets/"+p):"";

async function renderAccount(){
  const u=getWmUser();
  const secNote=`<div class="warnbox">🔒 <b>Sécurité</b> — ${esc(t("acc.security"))}</div>`;
  if(!u){
    app().innerHTML=`<h1>${esc(t("nav.account"))} · warframe.market</h1>
      <p class="sub">${esc(t("acc.subUnlinked"))}</p>
      ${secNote}
      <section class="card pad" style="max-width:560px">
        <h3 style="margin-top:0">${esc(t("acc.createTitle"))}</h3>
        <p class="muted">${esc(t("acc.createHint"))}</p>
        <a class="btn primary" href="${WM_REGISTER}" target="_blank" rel="noopener noreferrer">${esc(t("acc.createBtn"))}</a>
        <h3>${esc(t("acc.linkTitle"))}</h3>
        <div class="acwrap" style="max-width:none"><input class="input" id="wmname" placeholder="${esc(t("acc.linkPh"))}" autocomplete="off"></div>
        <div style="margin-top:8px"><button class="btn primary" id="wmlink">${esc(t("acc.linkBtn"))}</button></div>
        <p class="muted" style="margin-top:10px;font-size:.82rem">${esc(t("acc.linkNote"))}</p>
      </section>`;
    const go=()=>{const v=document.getElementById("wmname").value.trim().replace(/^@/,"");if(!v){toast(t("acc.enterPseudo"),"bad");return;}setWmUser({name:v});toast(t("acc.linked",{n:v}),"good");location.hash="#/compte";renderAccount();};
    document.getElementById("wmlink").addEventListener("click",go);
    document.getElementById("wmname").addEventListener("keydown",e=>{if(e.key==="Enter")go();});
    return;
  }
  const profUrl="https://warframe.market/profile/"+encodeURIComponent(u.name);
  app().innerHTML=`<h1>${esc(t("nav.account"))}</h1>
    <p class="sub">${esc(t("acc.linkedTo",{n:u.name}))}</p>
    <div class="toolbar"><a class="btn" href="${profUrl}" target="_blank" rel="noopener noreferrer">${esc(t("acc.viewProfile"))}</a><a class="btn" href="${profUrl}" target="_blank" rel="noopener noreferrer">${esc(t("acc.myOrders"))}</a><button class="btn" id="wmout" style="border-color:var(--bad);color:var(--bad)">${esc(t("acc.logout"))}</button></div>
    <div id="accProfile">${LOADING}</div>
    <h2>${esc(t("acc.favsTitle"))}</h2>
    <div id="accFavs"></div>`;
  document.getElementById("wmout").addEventListener("click",()=>{setWmUser(null);toast(t("acc.unlinked"));location.hash="#/compte";renderAccount();});
  // Favoris → workflow de vente (toujours dispo, sans API)
  (function(){
    const favs=getFavs(); const ks=Object.keys(favs); const el=document.getElementById("accFavs");
    el.innerHTML=ks.length?`<section class="card pad"><p class="muted" style="margin-top:0">${esc(t("acc.favsHint"))}</p>
      <ol style="list-style:none;margin:0;padding:0">${ks.map(n=>{const url=(favs[n].url)||slug(n);return `<li class="rrow"><img class="rimg" data-img="${esc(n)}" alt="" loading="lazy" style="visibility:hidden"><span class="rname">${esc(n)}${favs[n].target?` <span class="muted" style="font-size:.78rem">cible ${favs[n].target} PL</span>`:""}</span><a class="btn" style="padding:6px 12px" href="https://warframe.market/items/${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t("acc.postSee"))}</a></li>`;}).join("")}</ol></section>`
      :'<p class="muted">'+esc(t("acc.favsEmpty"))+'</p>';
    fillImages(el);
  })();
  // Ordres publics (lecture seule) via API v2 — v1/profile est mort/CF-bloqué ; v2/orders/user marche.
  (async function(){
    const el=document.getElementById("accProfile");
    const uslug=u.name.trim().toLowerCase().replace(/\s+/g,"_");
    try{
      const r=await API.wmUserOrders(uslug);
      const orders=(r&&r.data)||[];
      if(!Array.isArray(r&&r.data)) throw new Error("pseudo introuvable");
      const map=await ensureV2ItemMap(); const favs=getFavs();
      const row=o=>{const it=map.get(o.itemId)||{};const nm=it.name||o.itemId;const sl=it.slug||slug(nm);const ic=wmAsset(it.icon);const isFav=!!favs[nm];
        return `<li class="rrow"><button class="star" data-accfav="${esc(nm)}">${isFav?"★":"☆"}</button>${ic&&safeUrl(ic)?`<img class="rimg" src="${esc(safeUrl(ic))}" alt="" loading="lazy">`:""}<a class="rname rlink" href="https://warframe.market/items/${esc(sl)}" target="_blank" rel="noopener noreferrer">${esc(nm)} ↗</a><span class="rval">${o.platinum||0} PL<span class="u"> ×${o.quantity||1}</span></span></li>`;};
      const sells=orders.filter(o=>o.type==="sell"&&o.visible!==false).sort((a,b)=>(a.platinum||0)-(b.platinum||0));
      const buys=orders.filter(o=>o.type==="buy"&&o.visible!==false).sort((a,b)=>(b.platinum||0)-(a.platinum||0));
      el.innerHTML=`<section class="card pad">
        <div style="margin-bottom:6px"><h2 style="margin:0">${esc(u.name)}</h2><span class="mt">${esc(t("acc.publicOrders",{n:orders.length}))} · <a class="rlink" href="${profUrl}" target="_blank" rel="noopener noreferrer">${esc(t("acc.profileLink"))}</a></span></div>
        ${sells.length?`<h3>${esc(t("acc.sells",{n:sells.length}))}</h3><ol style="list-style:none;margin:0;padding:0">${sells.slice(0,20).map(row).join("")}</ol>`:'<p class="muted">'+esc(t("acc.noSells"))+'</p>'}
        ${buys.length?`<h3>${esc(t("acc.buys",{n:buys.length}))}</h3><ol style="list-style:none;margin:0;padding:0">${buys.slice(0,10).map(row).join("")}</ol>`:""}
        <p class="muted" style="margin-top:8px">${esc(t("acc.ordersNote"))}</p></section>`;
      el.querySelectorAll("[data-accfav]").forEach(b=>b.addEventListener("click",()=>{const on=toggleFav(b.dataset.accfav);b.textContent=on?"★":"☆";toast(on?t("acc.added"):t("acc.removed"));}));
    }catch(e){
      el.innerHTML=`<section class="card pad"><div class="warnbox">⚠️ ${esc(t("acc.ordersFail",{n:u.name}))}</div>
        <p class="muted">${esc(t("acc.stillLinked"))}</p></section>`;
    }
  })();
}

/* ---------------- Bons plans (deals) ---------------- */
/* Liens promo/affiliation PERSO de l'utilisateur (aucun lien fabriqué par le site). */
function getDealLinks(){ try{return JSON.parse(localStorage.getItem("deals_links")||"[]");}catch(e){return [];} }
function setDealLinks(a){ try{localStorage.setItem("deals_links",JSON.stringify(a));}catch(e){} }

/* Loot gratuit / offres RÉCURRENTES officielles (liens officiels vérifiables uniquement). */
function officialDeals(){ return [
 {ic:"🟣",t:t("dl.pg.t"),d:t("dl.pg.d"),u:"https://gaming.amazon.com/loot/warframe",cta:t("dl.pg.cta")},
 {ic:"📺",t:t("dl.tw.t"),d:t("dl.tw.d"),u:"https://www.twitch.tv/warframe",cta:t("dl.tw.cta")},
 {ic:"♻️",t:t("dl.pr.t"),d:t("dl.pr.d"),u:"https://www.warframe.com/prime-resurgence",cta:t("dl.pr.cta")},
 {ic:"🎁",t:t("dl.daily.t"),d:t("dl.daily.d"),u:null,note:t("dl.daily.note")},
 {ic:"📰",t:t("dl.codes.t"),d:t("dl.codes.d"),u:"https://www.warframe.com/news",cta:t("dl.codes.cta")},
];}
function dealCard(o){
  return `<article class="card pad deal">
    <div class="deal-h"><span class="deal-ic">${o.ic||"🎯"}</span><h3>${esc(o.t)}</h3></div>
    <p class="deal-d">${esc(o.d)}</p>
    ${o.sub?`<p class="deal-sub">${o.sub}</p>`:""}
    ${o.u&&safeUrl(o.u)?`<a class="btn primary" href="${esc(safeUrl(o.u))}" target="_blank" rel="noopener noreferrer">${esc(o.cta||t("dl.open"))}</a>`
      :o.href&&safeUrl(o.href)?`<a class="btn" href="${esc(safeUrl(o.href))}">${esc(o.cta||t("dl.see"))}</a>`
      :o.note?`<span class="deal-note">${esc(o.note)}</span>`:""}
  </article>`;
}
async function loadDealsLive(){
  const el=document.getElementById("dealsLive"); if(!el) return;
  try{
    const w=await API.world(); const cards=[];
    const dd=(w.dailyDeals||[])[0];
    if(dd) cards.push(dealCard({ic:"🏷️",t:tr("dl.darvo.t"),d:tr("dl.darvo.d",{item:dd.item,price:dd.salePrice,disc:dd.discount}),sub:tr("dl.darvo.sub",{rem:Math.max(0,(dd.total||0)-(dd.sold||0)),tot:dd.total||0,eta:esc(dd.eta||"?")}),href:"#/monde",cta:tr("dl.darvo.cta")}));
    const vt=w.voidTrader;
    if(vt&&baroActive(vt)) cards.push(dealCard({ic:"🛒",t:tr("dl.baroHere.t"),d:tr("dl.baroHere.d",{loc:vt.location||"",end:esc(baroDelay(vt,true)||"?")}),href:"#/monde",cta:tr("dl.baroHere.cta")}));
    else if(vt) cards.push(dealCard({ic:"🛒",t:tr("dl.baroSoon.t"),d:tr("dl.baroSoon.d",{loc:vt.location||"?",start:esc(baroDelay(vt,false)||"?")}),href:"#/monde",cta:tr("dl.baroSoon.cta")}));
    const nw=w.nightwave;
    if(nw&&nw.activeChallenges&&nw.activeChallenges.length) cards.push(dealCard({ic:"🌙",t:tr("dl.nw.t"),d:tr("dl.nw.d",{n:nw.activeChallenges.length}),href:"#/monde",cta:tr("dl.nw.cta")}));
    el.innerHTML=cards.length?`<div class="grid cols-auto">${cards.join("")}</div>`:`<p class="muted">${tr("dl.liveEmpty")}</p>`;
  }catch(e){ el.innerHTML=`<p class="muted">${tr("dl.worldUnavail")}</p>`; }
}
async function loadDealsMarket(){
  const el=document.getElementById("dealsMarket"); if(!el) return;
  try{
    const s=await getSnapshot(); let all=[];
    Object.entries(s.categories).forEach(([cat,rows])=>rows.forEach(r=>all.push(Object.assign({},r,{cat}))));
    all.forEach(r=>r.score=(r.price||0)*Math.sqrt(r.vol||0));
    const top=all.filter(r=>r.price>0&&r.vol>0).sort((a,b)=>b.score-a.score).slice(0,8);
    el.innerHTML=`<section class="card pad"><p class="meta" style="color:var(--dim);font-size:.84rem;margin:0 0 10px">${t("dl.marketMeta")}</p>
      <ol style="list-style:none;margin:0;padding:0">${top.map((r,i)=>`<li class="rrow"><span class="rnum">${i+1}</span><img class="rimg" data-img="${esc(r.name)}" alt="" loading="lazy" style="visibility:hidden"><a class="rname rlink" href="https://warframe.market/items/${slug(r.name)}" target="_blank" rel="noopener noreferrer">${esc(r.name)} ↗</a><span class="rval">${r.price} PL · ${r.vol} ${t("mkt.sales")}<br><span class="rsell">${t("mkt.sell",{p:r.rec})}</span></span></li>`).join("")}</ol>
      <div style="margin-top:10px"><a class="btn" href="#/marche">${t("dl.allMarket")}</a> <a class="btn" href="#/farmer">${t("dl.whatFarm")}</a></div></section>`;
    fillImages(el);
  }catch(e){ el.innerHTML=`<p class="muted">${t("dl.snapUnavail")}</p>`; }
}
function drawDealsMine(){
  const el=document.getElementById("dealsMine"); if(!el) return;
  const links=getDealLinks();
  if(!links.length){ el.innerHTML=`<div class="card pad"><p class="muted" style="margin-top:0">${t("dl.mineEmpty")}</p><a class="btn" href="#/reglages">${t("dl.goSettings")}</a></div>`; return; }
  el.innerHTML=`<div class="grid cols-auto">${links.map(l=>dealCard({ic:"🔗",t:l.label||l.url,d:t("dl.mineYourLink"),u:/^https?:\/\//.test(l.url||"")?l.url:("https://"+(l.url||"")),cta:t("dl.open")})).join("")}</div>
    <p class="muted" style="margin-top:8px">${t("dl.mineNote")}</p>`;
}
async function renderDeals(){
  app().innerHTML=`<h1>${t("page.bonsPlans")}</h1>
    <p class="sub">${t("dl.sub")}</p>
    <div class="warnbox">${t("dl.disclaimer")}</div>
    <h2>${t("dl.secLive")}</h2>
    <div id="dealsLive">${LOADING}</div>
    <h2>${t("dl.secOfficial")}</h2>
    <div class="grid cols-auto" id="dealsOfficial">${officialDeals().map(dealCard).join("")}</div>
    <h2>${t("dl.secMarket")}</h2>
    <div id="dealsMarket">${LOADING}</div>
    <h2>${t("dl.secMine")}</h2>
    <div id="dealsMine"></div>`;
  loadDealsLive(); loadDealsMarket(); drawDealsMine();
}

/* ---------------- Digest hebdo « ce qui a changé » ---------------- */
let _histFile=null;
async function getHistoryFile(){
  if(_histFile)return _histFile;
  // market_history.json (pipeline hub, 90 j) : {slug:[{d,median,min}]} — normalisé en
  // {items:{slug:[{d,p}]}}, le contrat qu'attendaient change7d & co (ex-history.json, retiré 16/07/2026).
  try{
    const h=await getJSON("/data/market_history.json");
    const raw=(h&&h.items)||h||{}; const items={};
    for(const k in raw){ if(Array.isArray(raw[k])) items[k]=raw[k].map(pt=>({d:pt.d,p:(pt.p!=null?pt.p:pt.median)})); }
    _histFile={items};
  }catch(e){_histFile={items:{}};}
  return _histFile;
}
function change7d(series){
  if(!series||series.length<2) return null;
  const last=series[series.length-1]; if(!last.p) return null;
  const cut=Date.now()-7*864e5; let old=series[0];
  for(const s of series){ if(new Date(s.d).getTime()>=cut){old=s;break;} }
  if(!old||!old.p) return null;
  return {from:old.p,to:last.p,pct:Math.round((last.p-old.p)/old.p*100),days:Math.round((new Date(last.d)-new Date(old.d))/864e5)};
}
function getVaultSeen(){ try{return JSON.parse(localStorage.getItem("vaultSeen")||"{}");}catch(e){return {};} }
function setVaultSeen(o){ try{localStorage.setItem("vaultSeen",JSON.stringify(o));}catch(e){} }
async function renderDigest(){
  app().innerHTML=`<h1>${t("dg.title")}</h1>
    <p class="sub">${t("dg.sub")}</p>
    <div id="dgbody">${LOADING}</div>`;
  const body=document.getElementById("dgbody");
  const favs=getFavs(), fk=Object.keys(favs);
  const cards=[];
  // 1) Prix favoris 7 j (history.json, fallback API)
  if(fk.length){
    const hist=await getHistoryFile(); const items=(hist&&hist.items)||{};
    const rows=[];
    for(const n of fk){
      const sl=n.toLowerCase().replace(/ /g,"_"); let ch=change7d(items[sl]);
      if(!ch){ try{ const h=extractHistory(await API.marketStats(favs[n].url||sl)); ch=change7d(h&&h.map(d=>({d:d.date,p:d.median}))); }catch(e){} }
      rows.push({n,ch});
    }
    const withCh=rows.filter(r=>r.ch);
    cards.push(`<section class="card pad"><h3 style="margin-top:0">${t("dg.favPrices")}</h3>${
      withCh.length?withCh.sort((a,b)=>Math.abs(b.ch.pct)-Math.abs(a.ch.pct)).map(r=>{const c=r.ch.pct>0?"var(--good)":r.ch.pct<0?"var(--bad)":"var(--dim)";const ar=r.ch.pct>0?"▲":r.ch.pct<0?"▼":"=";
        return `<div class="kv"><span class="k">${esc(r.n)}</span><span class="v">${r.ch.from}→${r.ch.to} PL <b style="color:${c}">${ar} ${r.ch.pct>0?"+":""}${r.ch.pct}%</b></span></div>`;}).join("")
      :`<p class="muted" style="margin:0">${t("dg.thinHist")}</p>`}</section>`);
  }
  // 2) Vault / unvault depuis la dernière visite (parmi les favoris)
  if(fk.length){ try{
    await ensureFarmIndex();
    const seen=getVaultSeen(); const changes=[]; const cur={};
    fk.forEach(n=>{const hit=farmLookup(n);if(hit&&/prime/i.test(hit.it.name||"")&&hit.it.vaulted!=null){const v=!!hit.it.vaulted;cur[n]=v;if(seen[n]!==undefined&&seen[n]!==v)changes.push({n,vaulted:v});}});
    // mémorise l'état courant
    const merged=Object.assign({},seen,cur); setVaultSeen(merged);
    cards.push(`<section class="card pad"><h3 style="margin-top:0">${t("dg.vault")}</h3>${
      changes.length?changes.map(c=>`<div class="kv"><span class="k">${esc(c.n)}</span><span class="v" style="color:${c.vaulted?"var(--warn)":"var(--good)"}">${c.vaulted?t("dg.vaultLocked"):t("dg.vaultUnlocked")}</span></div>`).join("")
      :`<p class="muted" style="margin:0">${t("dg.noVaultChange")}</p>`}
      <p class="muted" style="margin-top:8px">${t("dg.vaultCount",{n:Object.keys(cur).filter(n=>cur[n]).length})}</p></section>`);
  }catch(e){} }
  if(!fk.length) cards.push(`<section class="card pad"><p class="muted" style="margin:0">${t("dg.addFavs")}</p></section>`);
  // 3) Événements & temps forts
  try{
    const w=await API.world(); const ev=[];
    (w.events||[]).forEach(e=>ev.push(e.description||e.tooltip||t("dg.event")));
    if(w.voidTrader&&w.voidTrader.active) ev.push(t("dg.baroHere",{loc:w.voidTrader.location||""}));
    if(w.nightwave&&w.nightwave.activeChallenges&&w.nightwave.activeChallenges.length) ev.push(t("dg.nightwave",{n:w.nightwave.activeChallenges.length}));
    const c=w.cetusCycle; if(c&&(c.isDay===false||/night|nuit/i.test(c.state||""))) ev.push(t("dg.cetusNight"));
    cards.push(`<section class="card pad"><h3 style="margin-top:0">${t("dg.highlights")}</h3>${ev.length?`<ul>${ev.map(e=>`<li>${esc(e)}</li>`).join("")}</ul>`:`<p class="muted" style="margin:0">${t("dg.nothingSpecial")}</p>`}<p class="muted" style="margin-top:6px"><a href="#/actus">${t("dg.fullNews")}</a> · <a href="#/monde">${t("dg.world")}</a></p></section>`);
  }catch(e){}
  body.innerHTML=`<div class="grid cols-2">${cards.join("")}</div>`;
}

/* ---------------- Favoris ---------------- */
async function renderFavoris(){
  app().innerHTML=`<h1>${t("fv.title")}</h1><p class="sub">${t("fv.sub")}</p>
    <div class="acwrap"><input class="input" id="faddq" placeholder="${esc(t("fv.addPh"))}" autocomplete="off"><div class="acbox hide" id="fac"></div></div>
    <div id="favbody" style="margin-top:16px">${LOADING}</div>`;
  await ensureItems();
  const snap={};
  try{const s=await getSnapshot(); Object.values(s.categories).flat().forEach(r=>snap[r.name]={price:r.price,rec:r.rec});}catch(e){}
  const body=document.getElementById("favbody");
  const priceFor=async(name,fav)=>{ if(snap[name]) return snap[name]; if(fav&&fav.url){const p=await itemPrice(fav.url);return {price:p,rec:sellPrice(p)};} return {}; };
  const render=async()=>{
    const f=getFavs(); const ks=Object.keys(f);
    if(!ks.length){body.innerHTML=`<p class="empty">${t("fv.empty")}</p>`;return;}
    body.innerHTML=LOADING;
    const prices={}; for(const n of ks){ prices[n]=await priceFor(n,f[n]); }
    let total=0;
    body.innerHTML=`<div class="grid cols-auto">${ks.map(n=>{
      const p=prices[n]||{}; const cur=p.price||0; total+=cur;
      const tgt=f[n].target||0; const hit=tgt>0&&cur>=tgt;
      return `<section class="card pad ${hit?"fav-hit":""}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="display:flex;align-items:center;gap:10px;min-width:0"><img class="rimg" data-img="${esc(n)}" alt="" loading="lazy" style="visibility:hidden;width:36px;height:36px"><a class="rlink" style="font-weight:700" href="https://warframe.market/items/${(f[n]&&f[n].url)||slug(n)}" target="_blank" rel="noopener noreferrer">${esc(n)} ↗</a></span><button class="star on" data-rm="${esc(n)}" title="${esc(t("fv.remove"))}">★</button></div>
        <div class="stats" style="margin-top:8px">
          <div class="st"><div class="l">${t("fv.curPrice")}</div><div class="vv">${cur?cur+" PL":"—"}</div></div>
          <div class="st"><div class="l">${t("fv.sellAt")}</div><div class="vv" style="color:var(--good)">${p.rec?p.rec+" PL":"—"}</div></div></div>
        <div class="toolbar" style="margin:10px 0 0"><span class="muted">${t("fv.target")}</span><input class="input" style="max-width:110px" type="number" inputmode="numeric" data-tgt="${esc(n)}" value="${tgt||""}" placeholder="PL"></div>
        ${hit?`<p class="rsell" style="margin:8px 0 0">${t("fv.hit")}</p>`:""}
      </section>`;}).join("")}</div>
      <p class="muted" style="margin-top:14px">${t("fv.totalValue",{v:nf(total)})}</p>
      <button class="btn" id="favwts">${t("fv.copyWts")}</button>`;
    document.getElementById("favwts").addEventListener("click",()=>{
      const msg="WTS "+ks.map(n=>{const p=prices[n]||{};const pr=f[n].target||p.rec||p.price||0;return `[${n}] ${pr}p`;}).join(" ");
      copyText(msg);
    });
    body.querySelectorAll("[data-rm]").forEach(b=>b.addEventListener("click",()=>{const f2=getFavs();delete f2[b.dataset.rm];setFavs(f2);render();}));
    body.querySelectorAll("[data-tgt]").forEach(inp=>inp.addEventListener("change",()=>{const f2=getFavs();if(f2[inp.dataset.tgt]){f2[inp.dataset.tgt].target=+inp.value||0;setFavs(f2);render();}}));
    fillImages(body);
  };
  acAttach(document.getElementById("faddq"),document.getElementById("fac"),(u,n)=>{const f=getFavs();if(!f[n])f[n]={name:n,url:u,cat:"",target:0};setFavs(f);document.getElementById("faddq").value="";render();});
  render();
}

/* ---------------- Tâches ---------------- */
function isoWeekKey(){const d=new Date();const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return d.toISOString().slice(0,10);}
function renderTaches(){
  const today=new Date().toISOString().slice(0,10), wk=isoWeekKey();
  let st; try{st=JSON.parse(localStorage.getItem("tasks")||"{}");}catch(e){st={};}
  if(st.date!==today){st.date=today;st.daily={};}
  if(st.week!==wk){st.week=wk;st.weekly={};}
  st.daily=st.daily||{}; st.weekly=st.weekly||{};
  localStorage.setItem("tasks",JSON.stringify(st));
  const taskLabel=(key,i,fallback)=>{const k="tasks."+key+"."+i;const v=tr(k);return v===k?fallback:v;};
  const sec=(title,arr,key,sub)=>`<section class="card pad"><h2 style="margin-top:0">${title}</h2><p class="muted">${sub}</p>
    ${arr.map((task,i)=>`<label class="chk"><input type="checkbox" data-k="${key}" data-i="${i}" ${st[key][i]?"checked":""}><span>${esc(taskLabel(key,i,task))}</span></label>`).join("")}</section>`;
  app().innerHTML=`<h1>${t("page.taches")}</h1><p class="sub">${t("tk.sub")}</p>
    <div class="grid cols-2">${sec(t("tk.daily"),TASKS.daily,"daily",t("tk.dailySub"))+sec(t("tk.weekly"),TASKS.weekly,"weekly",t("tk.weeklySub"))}</div>`;
  app().querySelectorAll("input[type=checkbox]").forEach(c=>c.addEventListener("change",()=>{
    let s; try{s=JSON.parse(localStorage.getItem("tasks")||"{}");}catch(e){s={};}
    s[c.dataset.k]=s[c.dataset.k]||{}; s[c.dataset.k][c.dataset.i]=c.checked; localStorage.setItem("tasks",JSON.stringify(s));
  }));
}

/* Rivens : vues supprimées le 16/07/2026 — warframe.market a retiré ses API riven
   (v1/riven/items et v1/riven/attributes 404, v1/auctions/search 400) ; les routes
   #/rivens et #/riven-eval redirigent vers /outils (js/warframe-redirect.js). */

/* ---------------- Timers de cycles (compte à rebours en direct) ---------------- */
let _cdTimer=null;
function fmtDur(ms){ if(ms<0) ms=0; let s=Math.floor(ms/1000); const d=Math.floor(s/86400); s-=d*86400; const h=Math.floor(s/3600); s-=h*3600; const m=Math.floor(s/60); s-=m*60; if(d>0) return d+"j "+h+"h"; return (h?h+"h ":"")+((m||h)?m+"m ":"")+s+"s"; }
/* Baro : warframestat (FR) ne fournit pas active/startString/endString → on calcule depuis activation/expiry. */
function baroActive(vt){ if(!vt) return false; if(vt.active===true) return true; const now=Date.now(), a=vt.activation?+new Date(vt.activation):0, e=vt.expiry?+new Date(vt.expiry):0; return !!(a&&e&&now>=a&&now<e); }
function baroDelay(vt,active){ if(!vt) return ""; const iso=active?vt.expiry:vt.activation; if(!iso) return ""; return fmtDur(new Date(iso)-Date.now()); }
function startCountdowns(){
  if(_cdTimer) clearInterval(_cdTimer);
  const tick=()=>{
    const els=document.querySelectorAll(".cd[data-exp]");
    if(!els.length){ clearInterval(_cdTimer); _cdTimer=null; return; }
    els.forEach(el=>{ const exp=el.dataset.exp; if(!exp) return; const ms=new Date(exp)-Date.now(); el.textContent=ms>0?fmtDur(ms):t("cd.soon"); });
  };
  tick(); _cdTimer=setInterval(tick,1000);
}

/* ---------------- Que farmer cette semaine ---------------- */
async function renderFarmer(){
  app().innerHTML=`<h1>${t("page.farmer")}</h1><p class="sub">${t("farm.sub")}</p><div id="farmbody">${LOADING}</div>`;
  const LBL={warframes:t("farm.lbl.warframes"),primary:t("farm.lbl.primary"),secondary:t("farm.lbl.secondary"),melee:t("farm.lbl.melee"),arcanes:t("farm.lbl.arcanes")};
  try{
    const s=await getSnapshot();
    let all=[];
    Object.entries(s.categories).forEach(([cat,rows])=>rows.forEach(r=>all.push(Object.assign({},r,{cat}))));
    all.forEach(r=>r.score=Math.round((r.price||0)*Math.sqrt(r.vol||0)));
    const top=all.filter(r=>r.price>0&&r.vol>0).sort((a,b)=>b.score-a.score).slice(0,15);
    document.getElementById("farmbody").innerHTML=`<section class="card pad"><ol style="list-style:none;margin:0;padding:0">${top.map((r,i)=>`<li class="rrow"><span class="rnum">${i+1}</span><img class="rimg" data-img="${esc(r.name)}" alt="" loading="lazy" style="visibility:hidden"><span class="rname"><a class="rlink" href="https://warframe.market/items/${slug(r.name)}" target="_blank" rel="noopener noreferrer">${esc(r.name)} ↗</a> <span class="muted" style="font-size:.78rem">${esc(LBL[r.cat]||"")}</span></span><span class="rval">${r.price} PL · ${r.vol} ${t("mkt.sales")}<br><span class="rsell">${t("mkt.sell",{p:r.rec})}</span></span></li>`).join("")}</ol></section>
      <p class="muted" style="margin-top:10px">${t("farm.note")}</p>`;
    fillImages(document.getElementById("farmbody"));
  }catch(e){document.getElementById("farmbody").innerHTML=errHtml(e);}
}

/* ---------------- Assistant de farm « Que veux-tu farm ? » ---------------- */
/* Index nom→{item,catégorie} depuis WarframeStat pour retrouver les drops réels. */
let _farmIndex=null,_farmPromise=null;
function normFarm(name){return String(name||"").toLowerCase().replace(/[^a-z0-9]+/g,"");}
function ensureFarmIndex(){
  if(_farmIndex) return Promise.resolve(_farmIndex);
  if(_farmPromise) return _farmPromise;
  _farmPromise=(async()=>{
    const idx=new Map();
    const add=(it,cat)=>{const k=normFarm(it&&it.name);if(k&&!idx.has(k))idx.set(k,{it,cat});};
    // Données en ANGLAIS : les noms collent à la saisie utilisateur et à warframe.market
    // (les mods/reliques diffèrent en FR ; les drops/composants restent corrects).
    const [wf,wp,md,it]=await Promise.all([
      getJSON(`${WS}/warframes?language=en`).catch(()=>[]),
      getJSON(`${WS}/weapons?language=en`).catch(()=>[]),
      getJSON(`${WS}/mods?language=en`).catch(()=>[]),
      getJSON(`${WS}/items?language=en`).catch(()=>[]),
    ]);
    (wf||[]).filter(x=>x.type==="Warframe").forEach(x=>add(x,"warframes"));
    (wp||[]).forEach(x=>{const c=(x.category||"").toLowerCase();if(["primary","secondary","melee"].includes(c))add(x,c);});
    (md||[]).forEach(x=>add(x,"mods"));
    (it||[]).filter(x=>(x.category||"")==="Relics"||/relic/i.test(x.type||"")).forEach(x=>add(x,"relics"));
    _farmIndex=idx; return idx;
  })();
  return _farmPromise;
}
function farmLookup(name){
  if(!_farmIndex) return null;
  const tries=[name,String(name||"").replace(/\s+set$/i,"")];
  for(const t of tries){const hit=_farmIndex.get(normFarm(t));if(hit) return hit;}
  return null;
}
/* Cibles d'autocomplétion = items warframe.market + ressources (non échangeables). */
let _farmTargets=null;
async function ensureFarmTargets(){
  if(_farmTargets) return _farmTargets;
  await ensureItems();
  const arr=(_items||[]).map(i=>({n:i.n,u:i.u}));
  if(typeof RESOURCE_SPOTS!=="undefined") Object.keys(RESOURCE_SPOTS).forEach(k=>arr.push({n:k,res:k}));
  _farmTargets=arr; return arr;
}
const wikiSearch=q=>`https://wiki.warframe.com/w/Special:Search?search=${encodeURIComponent(q)}`;

/* Génère le plan de farm pour un item WarframeStat trouvé dans l'index. */
function farmPlanHtml(it,cat){
  const img=itemImg(it), isBuildable=["warframes","primary","secondary","melee"].includes(cat);
  const isPrime=/prime/i.test(it.name||"");
  const catLbl={warframes:t("fp.cat.warframes"),primary:t("fp.cat.primary"),secondary:t("fp.cat.secondary"),melee:t("fp.cat.melee"),mods:t("fp.cat.mods"),relics:t("fp.cat.relics")}[cat]||t("fp.cat.item");
  const kv=(k,v)=>`<div class="kv"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`;
  let h=`<section class="card pad farmplan">
    <div class="fp-head">
      ${img&&safeUrl(img)?`<img class="fp-ava" src="${esc(safeUrl(img))}" alt="" loading="lazy">`:""}
      <div><h2 style="margin:0">${esc(it.name)}</h2><span class="mt">${esc(catLbl)}${it.masteryReq!=null?` · ${t("fp.tier")} ${it.masteryReq}`:""}</span></div>
    </div>`;
  if(isBuildable){
    if(isPrime&&it.vaulted){
      h+=`<div class="warnbox" style="border-color:var(--warn)">${t("fp.vaulted")}</div>`;
    }
    const comps=(it.components||[]).filter(c=>c.drops&&c.drops.length);
    if(comps.length){
      h+=`<h3>${t("fp.step1")}</h3>`;
      comps.forEach(c=>{const locs=[...new Set(c.drops.map(d=>cleanRelic(d.location)))].slice(0,8);const ci=itemImg(c);
        h+=`<div class="kv"><span class="k" style="display:flex;align-items:center;gap:8px">${ci?`<img src="${esc(ci)}" alt="" loading="lazy" style="width:26px;height:26px;object-fit:contain;flex:none">`:""}${esc(c.name)}</span><span class="v">${esc(locs.join(", ")||"—")}</span></div>`;});
      const viaRelics=comps.some(c=>c.drops.some(d=>/relic|lith|meso|neo|axi/i.test(d.location||"")));
      if(viaRelics) h+=`<div class="warnbox">${t("fp.radshareNote")}</div>
        <h3>${t("fp.step2")}</h3><p>${t("fp.openFissures")} <a href="#/monde">${t("fp.seeFissures")}</a> · <a href="#/reliquecalc">${t("fp.calcOdds")}</a></p>`;
    }else{
      h+=`<div class="warnbox">${t("fp.noComps")} <a href="${wikiSearch(it.name)}" target="_blank" rel="noopener noreferrer">${t("fp.wiki")}</a>.</div>`;
    }
    const setName=isPrime?(it.name+" Set"):it.name;
    h+=`<h3>${t("fp.market")}</h3><p>${isPrime?`${t("fp.compareVsBuy")} `:""}<a href="https://warframe.market/items/${slug(setName)}" target="_blank" rel="noopener noreferrer">${t("fp.viewSet",{n:esc(setName)})}</a> · <button class="btn" id="farmEst" data-q="${esc(setName)}" style="padding:6px 12px;margin-left:4px">${t("fp.estPrice")}</button></p>`;
  }else if(cat==="mods"){
    const dr=(it.drops||[]).slice(0,12);
    h+=`<h3>${t("fp.whereFarmMod")}</h3>`;
    h+=dr.length?dr.map(d=>kv(d.location||"?",d.chance!=null?d.chance+"%":"")).join(""):`<div class="warnbox">${t("fp.noDropTable")} <a href="${wikiSearch(it.name)}" target="_blank" rel="noopener noreferrer">${t("fp.wiki")}</a>.</div>`;
    h+=`<h3>${t("fp.market")}</h3><p><a href="https://warframe.market/items/${slug(it.name)}" target="_blank" rel="noopener noreferrer">${t("rve.seeWM")}</a></p>`;
  }else if(cat==="relics"){
    const rw=[...(it.rewards||[])].sort((a,b)=>(b.chance||0)-(a.chance||0));
    h+=`<h3>${t("fp.relicRewards")}</h3>`;
    h+=rw.length?rw.map(r=>kv((r.item&&r.item.name)||r.name||"?",r.chance!=null?r.chance+"%":"")).join(""):`<div class="warnbox">${t("fp.noRewards")}</div>`;
    h+=`<div class="warnbox">${t("fp.radshareRare")} <a href="#/monde">${t("fp.fissuresNow")}</a></div>`;
  }
  h+=`</section>`;
  return h;
}
function resourcePlanHtml(key){
  const spots=(typeof RESOURCE_SPOTS!=="undefined"&&RESOURCE_SPOTS[key])||null;
  if(!spots) return null;
  return `<section class="card pad farmplan">
    <div class="fp-head"><span class="fp-ava fp-ava-res">⛏️</span><div><h2 style="margin:0">${esc(key)}</h2><span class="mt">${t("rp.resource")}</span></div></div>
    <h3>${t("rp.bestSpots")}</h3>
    <ul class="fp-spots">${spots.map(s=>`<li>${esc(s)}</li>`).join("")}</ul>
    <div class="warnbox">${t("rp.boosterNote")} <a href="${wikiSearch(key)}" target="_blank" rel="noopener noreferrer">${t("fp.wiki")}</a>.</div>
  </section>`;
}
async function renderAssistant(){
  const QUICK=["Khora Prime Set","Mesa Prime Set","Kuva","Endo","Serration","Forma","Revenant Prime Set"];
  app().innerHTML=`<h1>${t("page.assistant")}</h1>
    <p class="sub">${t("as.sub")}</p>
    <div class="acwrap" style="max-width:520px"><input class="input" id="aq" placeholder="${esc(t("as.placeholder"))}" autocomplete="off"><div class="acbox hide" id="aac"></div></div>
    <div class="pills" id="aquick" style="margin-top:12px">${QUICK.map(q=>`<button class="pill" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>
    <div id="aplan" style="margin-top:16px"><p class="muted">${t("as.choose")}</p></div>`;
  const inp=document.getElementById("aq"),ac=document.getElementById("aac"),body=document.getElementById("aplan");
  await ensureFarmTargets();
  const plan=async(name)=>{
    ac.classList.add("hide"); inp.value=name; body.innerHTML=LOADING;
    try{
      const resKey=(typeof RESOURCE_SPOTS!=="undefined")&&Object.keys(RESOURCE_SPOTS).find(k=>normFarm(k)===normFarm(name)||(normFarm(name).length>3&&normFarm(k).includes(normFarm(name))));
      if(resKey){ const rh=resourcePlanHtml(resKey); if(rh){body.innerHTML=rh; wireEst(); return;} }
      await ensureFarmIndex();
      const hit=farmLookup(name);
      if(hit){ body.innerHTML=farmPlanHtml(hit.it,hit.cat); wireEst(); return; }
      body.innerHTML=`<section class="card pad farmplan"><h2 style="margin:0 0 6px">${esc(name)}</h2>
        <div class="warnbox">${t("as.noData")}</div>
        <p><a href="https://warframe.market/items/${slug(name)}" target="_blank" rel="noopener noreferrer">${t("as.searchWM")}</a> · <a href="${wikiSearch(name)}" target="_blank" rel="noopener noreferrer">${t("as.searchWiki")}</a></p></section>`;
    }catch(e){ body.innerHTML=errHtml(e); }
  };
  const wireEst=()=>{ const b=document.getElementById("farmEst"); if(b) b.addEventListener("click",()=>{location.href="/estimateur?q="+encodeURIComponent(b.dataset.q);}); fillImages(body); };
  const showAc=()=>{
    const q=inp.value.trim().toLowerCase(); if(q.length<2){ac.classList.add("hide");return;}
    const starts=[],incl=[];
    for(const i of _farmTargets){const n=i.n.toLowerCase();if(n.startsWith(q))starts.push(i);else if(n.includes(q))incl.push(i);if(starts.length>=14)break;}
    const m=starts.concat(incl).slice(0,14);
    if(!m.length){ac.classList.add("hide");return;}
    ac.innerHTML=m.map(x=>`<div class="acitem" data-n="${esc(x.n)}">${esc(x.n)}${x.res?` <span class="muted" style="font-size:.75rem">· ${t("as.resource")}</span>`:""}</div>`).join("");
    ac.classList.remove("hide");
    ac.querySelectorAll(".acitem").forEach(d=>d.addEventListener("click",()=>plan(d.dataset.n)));
  };
  inp.addEventListener("input",showAc);
  document.addEventListener("click",e=>{if(!e.target.closest(".acwrap"))ac.classList.add("hide");});
  inp.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();plan(inp.value.trim());}});
  document.getElementById("aquick").querySelectorAll(".pill").forEach(b=>b.addEventListener("click",()=>plan(b.dataset.q)));
  if(window._farmPrefill){const q=window._farmPrefill;window._farmPrefill=null;plan(q);}
}

/* ---------------- Convertisseur de ducats ---------------- */
function renderDucats(){
  const rows=[[t("duc.common"),15,"c"],[t("duc.uncommon"),45,"u"],[t("duc.rare"),100,"r"]];
  const unit=t("duc.unit"),overCap=t("duc.overCap");
  app().innerHTML=`<h1>${t("duc.title")}</h1>
    <p class="sub">${t("duc.sub")}</p>
    <section class="card pad">
      <div class="grid cols-auto">${rows.map(([l,v,k])=>`
        <div class="st"><div class="l">${l}</div><div class="vv">${v} ${unit}</div>
          <input class="input" type="number" inputmode="numeric" min="0" data-d="${k}" data-val="${v}" placeholder="${esc(t("duc.howMany"))}" style="margin-top:8px"></div>`).join("")}</div>
      <h2 style="margin:16px 0 0">${t("duc.total")} <span id="dtotal" style="color:var(--accent2)">0</span> ${unit}</h2>
      <p class="muted" style="margin-top:10px">${t("duc.tip")}</p>
    </section>`;
  const upd=()=>{let tot=0;app().querySelectorAll("[data-d]").forEach(i=>{tot+=(+i.value||0)*(+i.dataset.val);});
    document.getElementById("dtotal").innerHTML=nf(tot)+(tot>5000?` <span style="color:var(--warn);font-size:.7em">${overCap}</span>`:"");};
  app().querySelectorAll("[data-d]").forEach(i=>i.addEventListener("input",upd));
}

/* ---------------- Comparateur d'armes ---------------- */
let _cmpA=0,_cmpB=1,_cmpMode="weapons",_cmpData={};
const CMP_ROWS={
  weapons:[["stat.type","category"],["stat.mr","masteryReq"],["stat.totalDamage","totalDamage"],["cmp.critPct","criticalChance",1],["stat.critMult","criticalMultiplier","x"],["cmp.statusPct","procChance",1],["stat.firerate","fireRate"],["stat.magazine","magazineSize"],["stat.dispo","disposition","/5"]],
  frames:[["stat.mr","masteryReq"],["stat.health","health"],["stat.shield","shield"],["stat.armor","armor"],["stat.energy","power"],["stat.speed","sprintSpeed"],["stat.auraPol","aura"]],
};
async function renderComparateur(){
  app().innerHTML=`<h1>${t("page.comparateur")}</h1><p class="sub">${t("cmp.sub")}</p>
    <div class="pills" id="cmppills"><button class="pill ${_cmpMode==="weapons"?"active":""}" data-m="weapons">${t("cmp.weapons")}</button><button class="pill ${_cmpMode==="frames"?"active":""}" data-m="frames">${t("cmp.frames")}</button></div>
    <div id="cmpbody">${LOADING}</div>`;
  document.getElementById("cmppills").querySelectorAll(".pill").forEach(b=>b.addEventListener("click",()=>{_cmpMode=b.dataset.m;_cmpA=0;_cmpB=1;renderComparateur();}));
  try{
    if(!_cmpData[_cmpMode]){
      _cmpData[_cmpMode]=_cmpMode==="weapons"
        ? (await API.weapons()||[]).filter(w=>["Primary","Secondary","Melee"].includes(w.category)).sort((a,b)=>(a.name||"").localeCompare(b.name||"","fr"))
        : (await API.warframes()||[]).filter(w=>w.type==="Warframe").sort((a,b)=>(a.name||"").localeCompare(b.name||"","fr"));
    }
  }catch(e){ document.getElementById("cmpbody").innerHTML=errHtml(e); return; }
  const list=_cmpData[_cmpMode], ROWS=CMP_ROWS[_cmpMode];
  if(_cmpA>=list.length)_cmpA=0; if(_cmpB>=list.length)_cmpB=1;
  const val=(w,k,fmt)=>{let v=w[k]; if(v==null||v==="")return "—"; if(fmt===1)return Math.round(v*100)+" %"; if(fmt==="x")return v+"x"; if(fmt==="/5")return v+"/5"; if(typeof v==="number")return Math.round(v*100)/100; return v;};
  const draw=()=>{
    const A=list[_cmpA],B=list[_cmpB];
    const sel=(id,cur)=>`<select class="input" id="${id}">${list.map((w,i)=>`<option value="${i}" ${i===cur?"selected":""}>${esc(w.name)}</option>`).join("")}</select>`;
    document.getElementById("cmpbody").innerHTML=`
      <div class="grid cols-2" style="margin-bottom:14px"><div>${sel("cmpA",_cmpA)}</div><div>${sel("cmpB",_cmpB)}</div></div>
      <section class="card pad" style="overflow-x:auto"><table class="cmp">
        <thead><tr><th></th><th>${esc(A.name)}</th><th>${esc(B.name)}</th></tr></thead>
        <tbody>${ROWS.map(([l,k,f])=>{const a=val(A,k,f),b=val(B,k,f);
          const na=parseFloat(a),nb=parseFloat(b);const aw=(!isNaN(na)&&!isNaN(nb)&&na>nb),bw=(!isNaN(na)&&!isNaN(nb)&&nb>na);
          return `<tr><td class="muted">${esc(t(l))}</td><td class="${aw?"win":""}">${esc(a)}</td><td class="${bw?"win":""}">${esc(b)}</td></tr>`;}).join("")}</tbody>
      </table></section>
      <p class="muted" style="margin-top:8px">${t("cmp.note")}</p>`;
    document.getElementById("cmpA").addEventListener("change",e=>{_cmpA=+e.target.value;draw();});
    document.getElementById("cmpB").addEventListener("change",e=>{_cmpB=+e.target.value;draw();});
  };
  draw();
}

/* ---------------- Liste de courses ---------------- */
function getCart(){try{return JSON.parse(localStorage.getItem("cart")||"{}");}catch(e){return{};}}
function setCart(c){try{localStorage.setItem("cart",JSON.stringify(c));}catch(e){}}
async function renderCourses(){
  app().innerHTML=`<h1>${t("page.courses")}</h1><p class="sub">${t("cr.sub")}</p>
    <div class="acwrap"><input class="input" id="caddq" placeholder="${esc(t("cr.addPh"))}" autocomplete="off"><div class="acbox hide" id="cac"></div></div>
    <div id="cbody" style="margin-top:16px">${LOADING}</div>`;
  await ensureItems();
  const body=document.getElementById("cbody");
  const render=async()=>{
    const c=getCart(), ks=Object.keys(c);
    if(!ks.length){body.innerHTML=`<p class="empty">${t("cr.empty")}</p>`;return;}
    body.innerHTML=LOADING;
    await Promise.all(ks.map(u=>_priceCache[u]==null?itemPrice(u):Promise.resolve()));
    let total=0;
    body.innerHTML=`<section class="card pad"><ol style="list-style:none;margin:0;padding:0">${ks.map(u=>{const it=typeof c[u]==="object"?c[u]:{n:u,q:c[u]};const pr=_priceCache[u]||0,q=it.q||1,lt=pr*q;total+=lt;
      return `<li class="rrow"><span class="rname"><a class="rlink" href="https://warframe.market/items/${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(it.n)} ↗</a></span><span class="rval">${pr?pr+" PL":"—"} × <input class="input" type="number" min="1" data-q="${esc(u)}" value="${q}" style="width:54px;padding:6px;margin:0 4px"> = <b>${lt} PL</b> <button class="star on" data-rm="${esc(u)}" title="${esc(t("cr.remove"))}" style="color:var(--bad)">✕</button></span></li>`;}).join("")}</ol>
      <h2 style="margin:14px 0 0">${t("cr.total")} <span style="color:var(--accent2)">${nf(total)} PL</span></h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn" id="cwtb">${t("cr.copyWtb")}</button><button class="btn" id="cclear">${t("cr.clear")}</button></div></section>`;
    document.getElementById("cwtb").addEventListener("click",()=>{const c2=getCart();const msg="WTB "+Object.keys(c2).map(u=>{const it=typeof c2[u]==="object"?c2[u]:{n:u};return `[${it.n}]`;}).join(" ");copyText(msg);});
    body.querySelectorAll("[data-q]").forEach(i=>i.addEventListener("input",()=>{const c2=getCart();if(c2[i.dataset.q]&&typeof c2[i.dataset.q]==="object"){c2[i.dataset.q].q=Math.max(1,+i.value||1);setCart(c2);render();}}));
    body.querySelectorAll("[data-rm]").forEach(b=>b.addEventListener("click",()=>{const c2=getCart();delete c2[b.dataset.rm];setCart(c2);render();}));
    document.getElementById("cclear").addEventListener("click",()=>{setCart({});render();});
  };
  acAttach(document.getElementById("caddq"),document.getElementById("cac"),(u,n)=>{const c=getCart();if(!c[u]||typeof c[u]!=="object")c[u]={n,q:1};else c[u].q++;setCart(c);document.getElementById("caddq").value="";render();});
  render();
}

/* ---------------- Générateur de message de trade (WTS/WTB) ---------------- */
const _trade={type:"sell",items:[],extra:""};
async function tradePrice(name,u){
  // prix du moment : instantané d'abord, sinon live via proxy
  try{const s=await getSnapshot();const row=Object.values(s.categories).flat().find(r=>r.name===name);if(row)return {price:row.price,rec:row.rec};}catch(e){}
  if(u){const p=await itemPrice(u);return {price:p,rec:sellPrice(p)};}
  return {price:0,rec:0};
}
function tradeMsg(){
  const verb=_trade.type==="sell"?"WTS":"WTB";
  const parts=_trade.items.filter(it=>it.n).map(it=>{
    const p=_trade.type==="sell"?(it.price||0):(it.price||0);
    return `[${it.n}]${p>0?" "+p+"p":""}`;
  });
  let msg=parts.length?(verb+" "+parts.join(" ")):"";
  const extra=(_trade.extra||"").trim();
  if(extra) msg=(msg?msg+" ":verb+" ")+extra;
  return msg;
}
async function renderTradeMsg(){
  app().innerHTML=`<h1>${t("page.trade")}</h1>
    <p class="sub">${t("trd.sub")}</p>
    <div class="pills" id="trtype">
      <button class="pill ${_trade.type==="sell"?"active":""}" data-tt="sell">${t("trd.sell")}</button>
      <button class="pill ${_trade.type==="buy"?"active":""}" data-tt="buy">${t("trd.buy")}</button></div>
    <div class="toolbar">
      <div class="acwrap"><input class="input" id="tradd" placeholder="${esc(t("trd.addPh"))}" autocomplete="off"><div class="acbox hide" id="trac"></div></div>
      <button class="btn" id="trfav">${t("trd.myFavs")}</button><button class="btn" id="trcart">${t("trd.myCart")}</button></div>
    <div id="trbody">${LOADING}</div>`;
  await ensureItems();
  document.getElementById("trtype").querySelectorAll(".pill").forEach(b=>b.addEventListener("click",()=>{
    if(_trade.type!==b.dataset.tt){_trade.type=b.dataset.tt;_trade.items.forEach(setDefaultPrice);renderTradeMsg();}}));
  function setDefaultPrice(it){ it.price=_trade.type==="sell"?(it._rec||it.price||0):(it._med||it.price||0); }
  const addItem=async(u,n)=>{
    if(_trade.items.some(x=>x.n===n)) return;
    const it={n,u,price:0,_med:0,_rec:0}; _trade.items.push(it); draw();
    const pr=await tradePrice(n,u); it._med=pr.price; it._rec=pr.rec; setDefaultPrice(it); draw();
  };
  acAttach(document.getElementById("tradd"),document.getElementById("trac"),(u,n)=>{document.getElementById("tradd").value="";addItem(u,n);});
  document.getElementById("trfav").addEventListener("click",async()=>{const f=getFavs();for(const n of Object.keys(f))await addItem(f[n].url||slug(n),n);});
  document.getElementById("trcart").addEventListener("click",async()=>{const c=getCart();for(const u of Object.keys(c)){const it=typeof c[u]==="object"?c[u]:{n:u};await addItem(u,it.n||u);}});
  function draw(){
    const body=document.getElementById("trbody"); if(!body) return;
    const rows=_trade.items.map((it,i)=>`<li class="rrow">
      <img class="rimg" data-img="${esc(it.n)}" alt="" loading="lazy" style="visibility:hidden"><span class="rname">${esc(it.n)}</span>
      <span class="rval">${_trade.type==="sell"?t("trd.verbSell"):t("trd.verbBuy")} <input class="input" type="number" min="0" inputmode="numeric" data-trp="${i}" value="${it.price||0}" style="width:74px;padding:6px;margin:0 4px">p
      <button class="star on" data-trrm="${i}" title="${esc(t("trd.clearBtn"))}" style="color:var(--bad)">✕</button></span></li>`).join("");
    const msg=tradeMsg();
    body.innerHTML=`<section class="card pad">
      ${_trade.items.length?`<ol style="list-style:none;margin:0;padding:0">${rows}</ol>`:`<p class="muted" style="margin:0 0 10px">${t("trd.emptyHint")}</p>`}
      <h3>${t("trd.freeText")}</h3>
      <textarea class="input" id="trextra" rows="2" placeholder="${esc(t("trd.freeTextPh"))}" style="resize:vertical">${esc(_trade.extra)}</textarea>
      <h3>${t("trd.msgToCopy")}</h3>
      <textarea class="input" id="trout" rows="3" readonly style="font-family:ui-monospace,monospace">${esc(msg)}</textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button class="btn primary" id="trcopy" ${msg?"":"disabled"}>${t("trd.copyBtn")}</button>
        <button class="btn" id="trclear">${t("trd.clearBtn")}</button></div>
      <p class="muted" style="margin-top:8px">${t("trd.priceNote",{mode:_trade.type==="sell"?t("trd.modeSell"):t("trd.modeBuy")})}</p>
    </section>`;
    fillImages(body);
    body.querySelectorAll("[data-trp]").forEach(inp=>inp.addEventListener("input",()=>{const it=_trade.items[+inp.dataset.trp];if(it){it.price=Math.max(0,+inp.value||0);document.getElementById("trout").value=tradeMsg();}}));
    body.querySelectorAll("[data-trrm]").forEach(b=>b.addEventListener("click",()=>{_trade.items.splice(+b.dataset.trrm,1);draw();}));
    const ex=document.getElementById("trextra"); if(ex)ex.addEventListener("input",()=>{_trade.extra=ex.value;document.getElementById("trout").value=tradeMsg();});
    const cp=document.getElementById("trcopy"); if(cp)cp.addEventListener("click",()=>{const m=tradeMsg();if(m)copyText(m);});
    const cl=document.getElementById("trclear"); if(cl)cl.addEventListener("click",()=>{_trade.items=[];_trade.extra="";draw();});
  }
  draw();
}

/* ---------------- Endo / Ayatan ---------------- */
function renderEndo(){
  const rows=[[t("endo.cyan"),50,"cy"],[t("endo.amber"),150,"am"],[t("endo.anasa"),3450,"an"],[t("endo.commonSculpt"),1500,"sc"]];
  const unit=t("endo.unit");
  app().innerHTML=`<h1>${t("endo.title")}</h1><p class="sub">${t("endo.sub")}</p>
    <section class="card pad"><div class="grid cols-auto">${rows.map(([l,v,k])=>`<div class="st"><div class="l">${l}</div><div class="vv">${v} ${unit}</div><input class="input" type="number" min="0" data-e="${k}" data-val="${v}" placeholder="${esc(t("duc.howMany"))}" style="margin-top:8px"></div>`).join("")}</div>
      <h2 style="margin:16px 0 0">${t("endo.total")} <span id="etotal" style="color:var(--accent2)">0</span> ${unit}</h2>
      <p class="muted" style="margin-top:10px">${t("endo.tip")}</p></section>`;
  const upd=()=>{let tot=0;app().querySelectorAll("[data-e]").forEach(i=>{tot+=(+i.value||0)*(+i.dataset.val);});document.getElementById("etotal").textContent=nf(tot);};
  app().querySelectorAll("[data-e]").forEach(i=>i.addEventListener("input",upd));
}

/* ---------------- Réglages ---------------- */
function renderReglages(){
  app().innerHTML=`<h1>${esc(t("nav.settings"))}</h1><p class="sub">${esc(t("set.sub"))}</p>
    <section class="card pad">
      <h3 style="margin-top:0">${esc(t("set.lang"))}</h3>
      <p class="muted" style="margin:0 0 8px">${esc(t("set.langHint"))}</p>
      <div class="chips" id="slang">${Object.keys(LANGS).map(l=>`<button class="chip accent-chip ${getLang()===l?"on":""}" data-lang="${esc(l)}">${esc(LANGS[l])}</button>`).join("")}</div>
      <h3>${esc(t("set.mr"))}</h3>
      <div class="toolbar"><input class="input" id="smr" type="number" inputmode="numeric" style="max-width:120px" value="${getMR()||""}" placeholder="MR"><span class="muted">${esc(t("set.mrHint"))}</span></div>
      <h3>${esc(t("set.theme"))}</h3>
      <button class="btn" id="stheme">${esc(t("set.themeBtn"))}</button>
      <h3>${esc(t("set.accent"))}</h3>
      <p class="muted" style="margin:0 0 8px">${esc(t("set.accentHint"))}</p>
      <div class="chips" id="saccent">${Object.keys(ACCENTS).map(k=>`<button class="chip accent-chip ${(localStorage.getItem("accent")||"tenno")===k?"on":""}" data-acc="${esc(k)}"><span class="accent-dot" style="background:${esc(ACCENTS[k][1])}"></span>${esc(ACCENTS[k][0])}</button>`).join("")}</div>
      <h3>${esc(t("set.alerts"))}</h3>
      <p class="muted" style="margin:0 0 10px">${t("set.alertsHint")}</p>
      <div id="alertbox"></div>
      <h3>${esc(t("set.proxy"))}</h3>
      <p class="muted" style="margin:0 0 8px">${t("set.proxyHint")}</p>
      <div class="acwrap" style="max-width:none"><input class="input" id="sproxy" placeholder="https://wf-market.xxx.workers.dev" autocomplete="off" value="${esc(getCustomProxy())}"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <button class="btn primary" id="sproxytest">${t("set.proxyTest")}</button>
        <button class="btn" id="sproxyclear">${t("set.proxyClear")}</button>
      </div>
      <p class="muted" id="sproxystatus" style="margin-top:8px"></p>
      <h3>${esc(t("set.dealLinks"))}</h3>
      <p class="muted" style="margin:0 0 8px">${t("set.dealLinksHint")}</p>
      <div id="dealLinksBox"></div>
      <div class="toolbar" style="margin:10px 0 0">
        <input class="input" id="dlLabel" placeholder="${esc(t("set.dlLabelPh"))}" style="max-width:220px">
        <input class="input" id="dlUrl" placeholder="${esc(t("set.dlUrlPh"))}" style="max-width:260px">
        <button class="btn" id="dlAdd">${t("set.dlAdd")}</button>
      </div>
      <h3>${esc(t("set.data"))}</h3>
      <p class="muted">${esc(t("set.dataHint"))}</p>
      <button class="btn" id="sclear" style="border-color:var(--bad);color:var(--bad)">${esc(t("set.clear"))}</button>
      <h3>${esc(t("set.install"))}</h3>
      <p class="muted">${esc(t("set.installHint"))}</p>
      <button class="btn primary" id="sinstall">${esc(t("set.installBtn"))}</button>
      <p class="muted" style="margin-top:8px">${t("set.iosInstall")}</p>
    </section>`;
  document.getElementById("sinstall").addEventListener("click",async()=>{
    if(window._deferredPrompt){ window._deferredPrompt.prompt(); try{await window._deferredPrompt.userChoice;}catch(e){} window._deferredPrompt=null; }
    else alert(t("set.iosAlert"));
  });
  document.getElementById("smr").addEventListener("input",e=>setMR(e.target.value));
  document.getElementById("stheme").addEventListener("click",()=>{document.body.classList.toggle("light");localStorage.setItem("theme",document.body.classList.contains("light")?"light":"dark");if(typeof applyAccent==="function")applyAccent(localStorage.getItem("accent")||"tenno");});
  const accBox=document.getElementById("saccent");
  if(accBox) accBox.querySelectorAll("[data-acc]").forEach(b=>b.addEventListener("click",()=>{
    localStorage.setItem("accent",b.dataset.acc); if(typeof applyAccent==="function")applyAccent(b.dataset.acc);
    accBox.querySelectorAll("[data-acc]").forEach(x=>x.classList.toggle("on",x===b));
  }));
  // sélecteur de langue (Réglages) : la bascule est gérée par le handler DÉLÉGUÉ
  // global de app.js (clic sur [data-lang] → setLang + reload). Rien à câbler ici.
  drawAlertBox();
  // Proxy perso warframe.market
  const pin=document.getElementById("sproxy"), pst=document.getElementById("sproxystatus");
  document.getElementById("sproxytest").addEventListener("click",async()=>{
    const url=(pin.value||"").trim().replace(/\/+$/,"");
    if(!url){ pst.textContent=t("set.proxyNeedUrl"); return; }
    if(!/^https:\/\//.test(url)){ pst.innerHTML=`<span style="color:var(--bad)">${esc(t("set.proxyHttps"))}</span>`; return; }
    pst.textContent=t("set.proxyTesting");
    try{
      const test="https://api.warframe.market/v1/items/ash_prime_set/statistics";
      const r=await fetch(`${url}/?url=${encodeURIComponent(test)}`,{headers:{Accept:"application/json"}});
      if(!r.ok) throw new Error("HTTP "+r.status);
      const d=await r.json(); if(!(d&&d.payload)) throw new Error(t("set.proxyUnexpected"));
      localStorage.setItem("wfproxy",url); _cache.clear&&_cache.clear();
      pst.innerHTML=`<span style="color:var(--good)">${esc(t("set.proxyValid"))}</span>`;
      toast(t("set.proxySaved"),"good");
    }catch(e){ pst.innerHTML=`<span style="color:var(--bad)">${esc(t("set.proxyFail",{msg:e.message||e}))}</span>`; }
  });
  document.getElementById("sproxyclear").addEventListener("click",()=>{ localStorage.removeItem("wfproxy"); pin.value=CUSTOM_PROXY||""; pst.textContent=t("set.proxyClearedStatus"); toast(t("set.proxyClearedToast")); });
  // Mes liens promo / affiliation
  const drawDealLinksBox=()=>{
    const box=document.getElementById("dealLinksBox"); if(!box) return;
    const links=getDealLinks();
    box.innerHTML=links.length?`<ol style="list-style:none;margin:0;padding:0">${links.map((l,i)=>`<li class="rrow"><span class="rname">${esc(l.label||l.url)} <span class="muted" style="font-size:.78rem">${esc(l.url)}</span></span><button class="star on" data-dlrm="${i}" title="${esc(t("set.dlRemove"))}" style="color:var(--bad)">✕</button></li>`).join("")}</ol>`:`<p class="muted" style="margin:0">${t("set.dlNone")}</p>`;
    box.querySelectorAll("[data-dlrm]").forEach(b=>b.addEventListener("click",()=>{const a=getDealLinks();a.splice(+b.dataset.dlrm,1);setDealLinks(a);drawDealLinksBox();}));
  };
  drawDealLinksBox();
  document.getElementById("dlAdd").addEventListener("click",()=>{
    const lab=document.getElementById("dlLabel"),url=document.getElementById("dlUrl");
    let u=(url.value||"").trim(); const label=(lab.value||"").trim();
    if(!u){toast(t("set.dlNeedUrl"),"bad");return;}
    if(!/^https?:\/\//.test(u)) u="https://"+u;
    const a=getDealLinks(); a.push({label:label||u,url:u}); setDealLinks(a);
    lab.value="";url.value=""; drawDealLinksBox(); toast(t("set.dlAdded"),"good");
  });
  document.getElementById("sclear").addEventListener("click",()=>{if(confirm(t("set.clearConfirm"))){["favs","cart","tasks","mr"].forEach(k=>localStorage.removeItem(k));toast(t("set.cleared"),"good");location.hash="#/accueil";}});
}

/* Section Notifications dans les Réglages */
function drawAlertBox(){
  const box=document.getElementById("alertbox"); if(!box) return;
  if(typeof getAlerts!=="function"){ box.innerHTML=`<p class="muted">${t("set.aleUnavail")}</p>`; return; }
  const supported=("Notification" in window);
  const perm=supported?Notification.permission:"unsupported";
  const a=getAlerts();
  if(!supported){ box.innerHTML=`<div class="warnbox">${t("set.aleNoSupport")}</div>`; return; }
  if(perm==="denied"){ box.innerHTML=`<div class="warnbox">${t("set.aleDenied")}</div>`; return; }
  if(!a.enabled||perm!=="granted"){
    box.innerHTML=`<button class="btn primary" id="aleOn">${t("set.aleEnable")}</button>
      <p class="muted" style="margin-top:8px">${t("set.aleEnableHint")}</p>`;
    document.getElementById("aleOn").addEventListener("click",async()=>{ if(await enableAlerts()) drawAlertBox(); });
    return;
  }
  const row=(k,label,desc)=>`<label class="chk"><input type="checkbox" data-ale="${k}" ${a[k]?"checked":""}><span>${label}<br><span class="muted">${desc}</span></span></label>`;
  box.innerHTML=`<p class="rsell" style="margin:0 0 8px">${t("set.aleOn")}</p>
    ${row("baro",t("set.aleBaro"),t("set.aleBaroD"))}
    ${row("cetus",t("set.aleCetus"),t("set.aleCetusD"))}
    ${row("favs",t("set.aleFavs"),t("set.aleFavsD"))}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button class="btn" id="aleTest">${t("set.aleTest")}</button>
      <button class="btn" id="aleOff" style="border-color:var(--bad);color:var(--bad)">${t("set.aleOff")}</button>
    </div>
    <p class="muted" style="margin-top:8px">${t("set.aleBgNote")}</p>`;
  box.querySelectorAll("[data-ale]").forEach(c=>c.addEventListener("change",()=>{const al=getAlerts();al[c.dataset.ale]=c.checked;setAlerts(al);if(typeof writeAlertConfigToCache==="function")writeAlertConfigToCache(al);}));
  document.getElementById("aleTest").addEventListener("click",()=>alertNotify(t("set.aleTestTitle"),t("set.aleTestBody"),"wf-test","#/reglages"));
  document.getElementById("aleOff").addEventListener("click",()=>{disableAlerts();drawAlertBox();});
}

/* ---------------- Optimiseur de reliques « ce soir » ---------------- */
const RELIC_ERAS=["Lith","Meso","Neo","Axi"];
async function renderRelicOptim(){
  app().innerHTML=`<h1>${t("page.relicOptim")}</h1>
    <p class="sub">${t("ro.sub")}</p>
    <div class="acwrap" style="max-width:520px"><input class="input" id="roq" placeholder="${esc(t("ro.placeholder"))}" autocomplete="off"><div class="acbox hide" id="roac"></div></div>
    <div id="robody" style="margin-top:16px"><p class="muted">${t("ro.choose")}</p></div>`;
  const inp=document.getElementById("roq"),ac=document.getElementById("roac"),body=document.getElementById("robody");
  await ensureItems();
  acAttach(inp,ac,(u,n)=>{inp.value=n;optim(n);});
  inp.addEventListener("keydown",e=>{if(e.key==="Enter"){const q=inp.value.trim().toLowerCase();const m=(_items||[]).find(i=>i.n.toLowerCase()===q)||(_items||[]).find(i=>i.n.toLowerCase().includes(q));if(m)optim(m.n);}});
  async function optim(name){
    ac.classList.add("hide"); body.innerHTML=LOADING;
    try{
      await ensureFarmIndex();
      const hit=farmLookup(name);
      if(!hit||!["warframes","primary","secondary","melee"].includes(hit.cat)){
        body.innerHTML=`<div class="warnbox">${t("ro.noRelics")} <a href="#/assistant">${t("ro.assistant")}</a></div>`; return;
      }
      const it=hit.it;
      // reliques par pièce + par ère
      const comps=(it.components||[]).filter(c=>c.drops&&c.drops.length);
      const relicsByEra={}; const compRelics=[];
      comps.forEach(c=>{
        const rels=[...new Set(c.drops.map(d=>cleanRelic(d.location)).filter(l=>/lith|meso|neo|axi/i.test(l)))];
        compRelics.push({name:c.name,rels});
        rels.forEach(r=>{const era=(r.match(/Lith|Meso|Neo|Axi/i)||[""])[0];if(era){(relicsByEra[era]=relicsByEra[era]||new Set()).add(r);}});
      });
      // fissures actives maintenant
      let fissures=[];
      try{const w=await API.world();fissures=(w.fissures||[]).filter(f=>f.active!==false);}catch(e){}
      const activeByEra={};
      fissures.forEach(f=>{const era=(f.tier||"").replace(/\s.*/,"");if(RELIC_ERAS.includes(era))(activeByEra[era]=activeByEra[era]||[]).push(f);});
      const neededEras=Object.keys(relicsByEra).filter(e=>relicsByEra[e].size);
      const tonight=neededEras.filter(e=>activeByEra[e]&&activeByEra[e].length);
      const isVault=/prime/i.test(it.name||"")&&it.vaulted;
      const kv=(k,v)=>`<div class="kv"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`;
      body.innerHTML=`<section class="card pad farmplan">
        <div class="fp-head">${itemImg(it)&&safeUrl(itemImg(it))?`<img class="fp-ava" src="${esc(safeUrl(itemImg(it)))}" alt="" loading="lazy">`:""}<div><h2 style="margin:0">${esc(it.name)}</h2><span class="mt">${esc({warframes:t("fp.cat.warframes"),primary:t("fp.cat.primary"),secondary:t("fp.cat.secondary"),melee:t("farm.lbl.melee")}[hit.cat]||"")}</span></div></div>
        ${isVault?`<div class="warnbox" style="border-color:var(--warn)">${t("ro.vaulted")}</div>`:""}
        <h3>${t("ro.nowTitle")} ${tonight.length?`<span class="muted">${t("ro.activeEras",{n:tonight.length})}</span>`:""}</h3>
        ${tonight.length?tonight.map(era=>{const fs=activeByEra[era].sort((a,b)=>(a.isHard?1:0)-(b.isHard?1:0));const f=fs[0];
          return `<div class="kv"><span class="k"><b style="color:var(--good)">${esc(era)}</b> → ${esc((f.missionType||""))} </span><span class="v">${esc(f.node||"")} ${f.isHard?"⚔️":""}${fs.length>1?` <span class="muted">+${fs.length-1}</span>`:""}</span></div>`;
        }).join(""):`<p class="muted">${t("ro.noActive")} <a href="#/monde">${t("ro.allFissures")}</a>.</p>`}
        <h3>${t("ro.relicsByPart")}</h3>
        ${compRelics.map(c=>kv(c.name,c.rels.length?c.rels.map(r=>r.replace(/ Relic$/i,"")).join(", "):"—")).join("")}
        <h3>${t("ro.erasNeeded")}</h3>
        <div class="chips">${neededEras.map(e=>`<span class="chip" style="${activeByEra[e]&&activeByEra[e].length?"border-color:var(--good);color:var(--good)":""}">${esc(e)} ${activeByEra[e]&&activeByEra[e].length?t("ro.active"):"⏳"}</span>`).join("")||'<span class="muted">—</span>'}</div>
        <div class="warnbox" style="margin-top:12px">${t("ro.radshare")} <a href="#/reliquecalc">${t("ro.calc")}</a> · <a href="#/monde">${t("ro.fissuresDetail")}</a></div>
      </section>`;
      fillImages(body);
    }catch(e){ body.innerHTML=errHtml(e); }
  }
  if(window._relicPrefill){const q=window._relicPrefill;window._relicPrefill=null;inp.value=q;optim(q);}
}

/* ---------------- Planificateur de craft / foundry ---------------- */
function getFoundry(){ try{return JSON.parse(localStorage.getItem("foundry")||"[]");}catch(e){return [];} }
function setFoundry(a){ try{localStorage.setItem("foundry",JSON.stringify(a));}catch(e){} }
/* Durées de fabrication standards (secondes). Le 72h des Warframes est confirmé par
   l'API ; les composants (12h) et autres sont les valeurs connues du jeu. */
const FOUNDRY_PRESETS=[
  ["Pièce de Warframe",43200,"12 h"],["Warframe (assemblage)",259200,"72 h"],
  ["Arme",43200,"12 h"],["Arme (longue)",86400,"24 h"],
  ["Forma",86400,"24 h"],["Réacteur / Catalyseur Orokin",86400,"24 h"],
  ["Personnalisé…",0,""],
];
let _foundryTimer=null;
function startFoundryTimer(){
  if(_foundryTimer)clearInterval(_foundryTimer);
  const tick=()=>{
    const els=document.querySelectorAll(".fcd[data-fexp]");
    if(!els.length){clearInterval(_foundryTimer);_foundryTimer=null;return;}
    els.forEach(el=>{const ms=+el.dataset.fexp-Date.now();el.textContent=ms>0?fmtDur(ms):t("fd.ready");el.classList.toggle("ready",ms<=0);});
  };
  tick();_foundryTimer=setInterval(tick,1000);
}
async function renderFoundry(){
  const FD_KEYS=["fd.preset.framePart","fd.preset.frame","fd.preset.weapon","fd.preset.weaponLong","fd.preset.forma","fd.preset.reactor","fd.preset.custom"];
  app().innerHTML=`<h1>${esc(t("page.foundry"))}</h1>
    <p class="sub">${esc(t("fd.sub"))}</p>
    <section class="card pad">
      <div class="acwrap" style="max-width:none"><input class="input" id="fdq" placeholder="${esc(t("fd.namePh"))}" autocomplete="off"><div class="acbox hide" id="fdac"></div></div>
      <div class="toolbar" style="margin-top:8px">
        <select class="input" id="fdpreset" style="max-width:260px">${FOUNDRY_PRESETS.map((p,i)=>`<option value="${i}">${esc(t(FD_KEYS[i]||p[0]))}${p[2]?" — "+p[2]:""}</option>`).join("")}</select>
        <input class="input" id="fdhours" type="number" min="0" step="0.5" placeholder="${esc(t("fd.hoursPh"))}" style="max-width:110px;display:none">
        <button class="btn primary" id="fdadd">${esc(t("fd.start"))}</button>
      </div>
    </section>
    <div id="fdbody" style="margin-top:16px"></div>`;
  await ensureItems();
  const inp=document.getElementById("fdq"),ac=document.getElementById("fdac");
  acAttach(inp,ac,(u,n)=>{inp.value=n;});
  const preset=document.getElementById("fdpreset"),hours=document.getElementById("fdhours");
  preset.addEventListener("change",()=>{hours.style.display=FOUNDRY_PRESETS[+preset.value][1]===0?"":"none";});
  document.getElementById("fdadd").addEventListener("click",()=>{
    const name=(inp.value||"").trim(); if(!name){toast(t("fd.needName"),"bad");return;}
    const p=FOUNDRY_PRESETS[+preset.value]; let dur=p[1];
    if(dur===0){ dur=Math.round((parseFloat(hours.value)||0)*3600); if(dur<=0){toast(t("fd.needDur"),"bad");return;} }
    const list=getFoundry(); list.push({name,finishAt:Date.now()+dur*1000,notified:false}); setFoundry(list);
    inp.value=""; toast(t("fd.started"),"good"); draw();
  });
  function draw(){
    const body=document.getElementById("fdbody"); const list=getFoundry().sort((a,b)=>a.finishAt-b.finishAt);
    if(!list.length){ body.innerHTML='<p class="empty">'+esc(t("fd.empty"))+'</p>'; return; }
    body.innerHTML=`<section class="card pad"><ol style="list-style:none;margin:0;padding:0">${list.map((f,i)=>`<li class="rrow">
      <img class="rimg" data-img="${esc(f.name)}" alt="" loading="lazy" style="visibility:hidden">
      <span class="rname">${esc(f.name)} <a class="rlink muted" style="font-size:.78rem" href="#/assistant" data-fdfarm="${esc(f.name)}">${esc(t("fd.whereFarm"))}</a></span>
      <span class="rval"><span class="fcd" data-fexp="${f.finishAt}"></span> <button class="star on" data-fdrm="${i}" title="✕" style="color:var(--bad)">✕</button></span></li>`).join("")}</ol>
      <p class="muted" style="margin-top:10px">${esc(t("fd.durNote"))}</p></section>`;
    fillImages(body);
    body.querySelectorAll("[data-fdrm]").forEach(b=>b.addEventListener("click",()=>{const l=getFoundry();l.splice(+b.dataset.fdrm,1);setFoundry(l);draw();}));
    body.querySelectorAll("[data-fdfarm]").forEach(a=>a.addEventListener("click",()=>{window._farmPrefill=a.dataset.fdfarm;}));
    if(typeof writeAlertConfigToCache==="function"&&typeof getAlerts==="function")writeAlertConfigToCache(getAlerts());
    startFoundryTimer();
  }
  draw();
}

/* ---------------- Calculateur de reliques ---------------- */
function renderRelicCalc(){
  const TBL={"Commune":{Intacte:25.33,Exceptionnelle:23.33,Impeccable:20,Radieuse:16.67},
             "Peu commune":{Intacte:11,Exceptionnelle:13,Impeccable:17,Radieuse:20},
             "Rare":{Intacte:2,Exceptionnelle:4,Impeccable:6,Radieuse:10}};
  const rarities=Object.keys(TBL), refs=["Intacte","Exceptionnelle","Impeccable","Radieuse"];
  const rarLbl={"Commune":t("rar.common"),"Peu commune":t("rar.uncommon"),"Rare":t("rar.rare")};
  const refLbl={"Intacte":t("ref.intact"),"Exceptionnelle":t("ref.exceptional"),"Impeccable":t("ref.flawless"),"Radieuse":t("ref.radiant")};
  app().innerHTML=`<h1>${t("page.reliquecalc")}</h1><p class="sub">${t("rc.sub")}</p>
    <section class="card pad">
      <div class="grid cols-auto">
        <label class="muted">${t("rc.rarity")}<select class="input" id="rcrar" style="margin-top:6px">${rarities.map(r=>`<option value="${esc(r)}">${esc(rarLbl[r]||r)}</option>`).join("")}</select></label>
        <label class="muted">${t("rc.refine")}<select class="input" id="rcref" style="margin-top:6px">${refs.map(r=>`<option value="${esc(r)}" ${r==="Radieuse"?"selected":""}>${esc(refLbl[r]||r)}</option>`).join("")}</select></label>
        <label class="muted">${t("rc.squad")}<select class="input" id="rcsq" style="margin-top:6px"><option value="1">${t("rc.solo")}</option><option value="4" selected>${t("rc.radshare")}</option></select></label>
      </div>
      <div id="rcout" class="stats" style="margin-top:14px"></div>
      <p class="muted" style="margin-top:10px">${t("rc.note")}</p>
    </section>`;
  const upd=()=>{
    const rar=document.getElementById("rcrar").value, ref=document.getElementById("rcref").value, sq=+document.getElementById("rcsq").value;
    const p=(TBL[rar][ref]||0)/100, perRun=1-Math.pow(1-p,sq);
    const runs90=perRun>0?Math.ceil(Math.log(0.1)/Math.log(1-perRun)):"∞";
    document.getElementById("rcout").innerHTML=
      `<div class="st"><div class="l">${t("rc.perReward")}</div><div class="vv">${(p*100).toFixed(2)}%</div></div>
       <div class="st"><div class="l">${t("rc.perRun")}</div><div class="vv" style="color:var(--good)">${(perRun*100).toFixed(1)}%</div></div>
       <div class="st"><div class="l">${t("rc.runs90")}</div><div class="vv">${runs90}</div></div>`;
  };
  ["rcrar","rcref","rcsq"].forEach(id=>document.getElementById(id).addEventListener("change",upd));
  upd();
}

/* ---------------- Mondes ouverts (open worlds) — v2 interactif ---------------- */
let _owSel="plains", _owTab="map", _owLayer="all", _owRar="all", _owPoi=-1;
let _owZ={s:1,x:0,y:0};
const OW_ZTYPE={hub:["🏛️","var(--accent)"],eidolon:["🌙","#a78bfa"],combat:["⚔️","#fb7185"],
  cave:["🕳️","#94a3b8"],mine:["⛏️","#f59e0b"],toroid:["🟡","#eab308"],boss:["💀","#f43f5e"],
  vault:["🔒","#22d3ee"],fish:["🎣","#38bdf8"],open:["·","#64748b"]};
/* Catégorie de calque par type de zone */
const OW_ZCAT={hub:"hub",combat:"missions",vault:"missions",mine:"mining",cave:"resources",toroid:"resources",boss:"boss",eidolon:"boss",fish:"fishing",open:"all"};
/* Zones de la carte = zones de base + POI pêche/minage (OW_FISHMINE). */
function owZones(w){ const ex=(typeof OW_FISHMINE!=="undefined"&&OW_FISHMINE[w.id]&&OW_FISHMINE[w.id].zones)||[]; return (w.zones||[]).concat(ex); }
const owWiki=n=>"https://wiki.warframe.com/w/"+encodeURIComponent(String(n||"").replace(/ /g,"_"));
/* Cycle live (champ warframestat) par monde */
const OW_CYCLE={plains:"cetusCycle",vallis:"vallisCycle",deimos:"cambionCycle",duviri:"duviriCycle"};
const OW_CYCIC={day:"☀️",night:"🌙",warm:"🔥",cold:"❄️",fass:"🟧",vome:"🟦",joy:"😊",anger:"😠",envy:"💚",sorrow:"😢",fear:"😱"};
function owCycLabel(st){const k="ow.cyc."+st,v=t(k);return v===k?(st?st.charAt(0).toUpperCase()+st.slice(1):"—"):v;}

function owMapSvg(w){
  const dots=owZones(w).map((z,i)=>{const c=(OW_ZTYPE[z.t]||OW_ZTYPE.open)[1],ic=(OW_ZTYPE[z.t]||OW_ZTYPE.open)[0];
    const X=Math.round(z.x*10),Y=Math.round(z.y*5.6),cat=OW_ZCAT[z.t]||"all";
    return `<g class="ow-poi" data-i="${i}" data-cat="${cat}" tabindex="0" role="button" aria-label="${esc(z.l)}">`
      +`<circle cx="${X}" cy="${Y}" r="30" fill="${c}" fill-opacity="0.20" stroke="${c}" stroke-width="2"/>`
      +`<text x="${X}" y="${Y+9}" text-anchor="middle" font-size="28">${ic}</text>`
      +`<text class="ow-zlbl" x="${X}" y="${Y+46}" text-anchor="middle" font-size="20" translate="no">${esc(z.l)}</text></g>`;}).join("");
  return `<div class="ow-mapwrap">
    <div class="ow-zoomctl">
      <button class="ow-zbtn" data-owz="in" aria-label="${esc(t("ow.zoomIn"))}" title="${esc(t("ow.zoomIn"))}">+</button>
      <button class="ow-zbtn" data-owz="out" aria-label="${esc(t("ow.zoomOut"))}" title="${esc(t("ow.zoomOut"))}">−</button>
      <button class="ow-zbtn" data-owz="reset" aria-label="${esc(t("ow.zoomReset"))}" title="${esc(t("ow.zoomReset"))}">⟲</button>
    </div>
    <svg class="ow-svg" id="owsvg" viewBox="0 0 1000 560" role="img" aria-label="${esc(w.name)} — ${esc(t("ow.mapNote"))}" preserveAspectRatio="xMidYMid meet">
      <defs><radialGradient id="owbg" cx="50%" cy="38%" r="75%"><stop offset="0%" stop-color="#16202f"/><stop offset="100%" stop-color="#0b1018"/></radialGradient></defs>
      <g id="owmapg">
        <rect x="8" y="8" width="984" height="544" rx="26" fill="url(#owbg)" stroke="var(--border-soft)" stroke-width="2"/>
        ${dots}
      </g>
    </svg></div>`;
}
function owLayersBar(){
  const L=[["all","ow.layer.all"],["missions","ow.layer.missions"],["mining","ow.layer.mining"],["fishing","ow.layer.fishing"],["resources","ow.layer.resources"],["boss","ow.layer.boss"]];
  return `<div class="ow-layers" id="owlayers"><span class="muted">${t("ow.layers")} :</span>${
    L.map(([k,key])=>`<button class="chip ow-layer ${k===_owLayer?"on":""}" data-owl="${k}">${t(key)}</button>`).join("")}</div>`;
}
function owLegend(){
  return `<div class="ow-legend"><span class="muted">${t("ow.legend")} :</span>${
    Object.entries(OW_ZTYPE).map(([k,v])=>`<span class="ow-leg"><span class="ow-leg-dot" style="background:${v[1]}"></span>${v[0]}</span>`).join("")}
    <span class="muted ow-mapnote">${t("ow.mapNote")}</span></div>`;
}
/* Carte d'un point d'intérêt sélectionné : type + ressources liées (réutilise w.resources). */
function owPoiCardHtml(w){
  const lang=getLang(),pick=o=>(o&&(o[lang]||o.fr))||"";
  const Z=owZones(w);
  if(_owPoi<0||!Z[_owPoi]) return `<p class="muted ow-poihint">${t("ow.poiHint")}</p>`;
  const z=Z[_owPoi], ztLbl=t("ow.zt."+(z.t||"open"));
  const here=(w.resources||[]).filter(r=>{const wh=pick(r.where).toLowerCase();return wh.includes((z.l||"").toLowerCase())&&(z.l||"").length>2;});
  const ic=(OW_ZTYPE[z.t]||OW_ZTYPE.open)[0];
  return `<div class="ow-poicard-in"><h3 style="margin:0 0 4px"><span translate="no">${ic} ${esc(z.l)}</span> <span class="muted" style="font-weight:500;font-size:.82rem">· ${esc(ztLbl)}</span></h3>
    ${here.length?`<p class="muted" style="margin:0 0 6px">${t("ow.poiResources")} :</p><ul class="ow-poires">${here.map(r=>`<li><span translate="no">${esc(r.n)}</span> <span class="ow-rar ow-rar-${({guaranteed:"good",rare:"bad",uncommon:"warn",common:"dim"})[r.rar]||"dim"}">${esc(pick(r.chance))}</span></li>`).join("")}</ul>`
      :`<p class="muted" style="margin:0">${t("ow.poiNoRes")}</p>`}</div>`;
}
/* Encart « Quoi farmer maintenant » : conseil réactif au cycle + bouton Assistant. */
function owNowHtml(w,st){
  let tip;
  if(w.id==="plains") tip=(st==="night")?t("ow.now.eidolon"):t("ow.now.cetusDay");
  else if(w.id==="vallis") tip=(st==="cold")?t("ow.now.vallisCold"):t("ow.now.vallisWarm");
  else if(w.id==="deimos") tip=(st==="fass")?t("ow.now.fass"):(st==="vome")?t("ow.now.vome"):t("ow.now.generic");
  else if(w.id==="duviri"){
    const lang=getLang(), moods=(typeof OW_DETAIL!=="undefined"&&OW_DETAIL.duviri&&OW_DETAIL.duviri.moods)||[];
    const m=moods.find(x=>x.key===st);
    tip=(m?`${t("ow.cyc."+st)} — ${t("ow.mood.enemies")} ${esc((m.dmg[lang]||m.dmg.fr))} · `:"")+t("ow.now.duviri");
  }
  else tip=t("ow.now.generic");
  return `<span class="ow-now-t">⚡ ${t("ow.now.title")}</span> <span class="ow-now-tip">${tip}</span> <a class="btn ow-now-btn" href="#/assistant">🌾 ${t("ow.now.assistant")}</a>`;
}
/* Table des humeurs Duviri (effet gameplay). */
function owMoodsTable(d){
  const lang=getLang(),pick=o=>(o&&(o[lang]||o.fr))||"";
  return `<h3>🎭 ${t("ow.moodsTitle")}</h3><div class="ow-moods">
    <div class="ow-mrow ow-mhead"><span>${t("ow.mood.col")}</span><span>${t("ow.mood.dmg")}</span><span>${t("ow.mood.sky")}</span></div>
    ${(d.moods||[]).map(m=>`<div class="ow-mrow"><span class="ow-mname">${OW_CYCIC[m.key]||"🎭"} ${esc(t("ow.cyc."+m.key))}</span><span>${esc(pick(m.dmg))}</span><span class="muted">${esc(pick(m.sky))}</span></div>`).join("")}
  </div><p class="muted" style="margin-top:8px">${t("ow.mood.note")}</p>`;
}
async function owLoadCycle(w){
  const el=document.getElementById("owcycle"), now=document.getElementById("ownow");
  const field=OW_CYCLE[w.id];
  const setNow=st=>{ if(now) now.innerHTML=owNowHtml(w,st); };
  if(!field){ if(el)el.innerHTML=`<span class="muted">🕓 ${t("ow.cycle.none")}</span>`; setNow(""); return; }
  try{
    const world=await API.world(); const c=world&&world[field];
    if(!c||!c.expiry){ if(el)el.innerHTML=`<span class="muted">🕓 ${t("ow.cycle.none")}</span>`; setNow(""); return; }
    const st=(c.state||"").toLowerCase();
    const night=w.id==="plains"&&(c.isDay===false||st==="night"), effSt=night?"night":st;
    let tip="";
    if(w.id==="plains") tip=night?t("ow.tip.eidolonNight"):t("ow.tip.eidolonDay");
    if(el)el.innerHTML=`<span class="ow-cyc-state ow-cyc-${esc(effSt)}">${OW_CYCIC[effSt]||"🕓"} ${esc(owCycLabel(effSt))}</span>`
      +` <span class="muted">${t("ow.cycle.changesIn")} <span class="cd" data-exp="${esc(c.expiry)}">…</span></span>`
      +(tip?` <span class="ow-cyc-tip">${tip}</span>`:"");
    setNow(effSt);
    if(typeof startCountdowns==="function") startCountdowns();
  }catch(e){ if(el)el.innerHTML=`<span class="muted">🕓 ${t("ow.cycle.unavail")}</span>`; setNow(""); }
}
/* Interactions carte : zoom (+/−/molette), pan (glisser), POI cliquables, calques. */
function owWireMap(w){
  const svg=document.getElementById("owsvg"), g=document.getElementById("owmapg");
  if(!svg||!g) return;
  const apply=()=>{ g.setAttribute("transform",`translate(${_owZ.x} ${_owZ.y}) scale(${_owZ.s})`); };
  apply();
  const clampZoom=v=>Math.max(1,Math.min(3,v));
  document.querySelectorAll("#owlayers .ow-layer").forEach(b=>b.addEventListener("click",()=>{_owLayer=b.dataset.owl;owApplyLayer();document.querySelectorAll("#owlayers .ow-layer").forEach(x=>x.classList.toggle("on",x===b));}));
  document.querySelectorAll(".ow-zbtn").forEach(b=>b.addEventListener("click",()=>{const a=b.dataset.owz;
    if(a==="in")_owZ.s=clampZoom(_owZ.s*1.3);else if(a==="out")_owZ.s=clampZoom(_owZ.s/1.3);else{_owZ={s:1,x:0,y:0};}apply();}));
  svg.addEventListener("wheel",e=>{e.preventDefault();_owZ.s=clampZoom(_owZ.s*(e.deltaY<0?1.12:0.9));apply();},{passive:false});
  let drag=null;
  svg.addEventListener("pointerdown",e=>{if(e.target.closest(".ow-poi"))return;drag={x:e.clientX,y:e.clientY};svg.setPointerCapture&&svg.setPointerCapture(e.pointerId);svg.classList.add("ow-grabbing");});
  svg.addEventListener("pointermove",e=>{if(!drag)return;const r=svg.getBoundingClientRect(),f=1000/(r.width||1000);_owZ.x+=(e.clientX-drag.x)*f;_owZ.y+=(e.clientY-drag.y)*f;drag={x:e.clientX,y:e.clientY};apply();});
  const endDrag=()=>{drag=null;svg.classList.remove("ow-grabbing");};
  svg.addEventListener("pointerup",endDrag);svg.addEventListener("pointerleave",endDrag);
  const selPoi=el=>{_owPoi=+el.dataset.i;document.querySelectorAll(".ow-poi").forEach(p=>p.classList.toggle("sel",p===el));const card=document.getElementById("owpoicard");if(card)card.innerHTML=owPoiCardHtml(w);};
  document.querySelectorAll(".ow-poi").forEach(el=>{el.addEventListener("click",()=>selPoi(el));el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selPoi(el);}});});
  owApplyLayer();
}
function owApplyLayer(){
  document.querySelectorAll("#owsvg .ow-poi").forEach(p=>{const cat=p.dataset.cat;const show=_owLayer==="all"||cat===_owLayer||cat==="hub";p.style.display=show?"":"none";});
}
function renderOpenWorlds(param){
  const worlds=(typeof OPEN_WORLDS!=="undefined")?OPEN_WORLDS:[];
  if(param&&worlds.some(x=>x.id===param)) _owSel=param;
  const w=worlds.find(x=>x.id===_owSel)||worlds[0];
  const lang=getLang(), pick=o=>(o&&(o[lang]||o.fr))||"";
  if(!w){ app().innerHTML=`<h1>${t("page.openWorlds")}</h1><p class="empty">${t("common.empty")}</p>`; return; }
  const rarCls={guaranteed:"good",rare:"bad",uncommon:"warn",common:"dim"};
  const rarLbl={guaranteed:t("ow.rar.guaranteed"),rare:t("ow.rar.rare"),uncommon:t("ow.rar.uncommon"),common:t("ow.rar.common")};
  const d=(typeof OW_DETAIL!=="undefined"&&OW_DETAIL[w.id])||null;
  if(_owTab==="guide"&&!d)_owTab="map";
  let body="";
  if(_owTab==="guide"){
    body=`<section class="card pad ow-guide"><p class="ow-guide-intro">${esc(pick(d.intro))}</p>${d.sections.map(s=>`<div class="ow-gsec"><h3>${s.ic} ${esc(pick(s.title))}</h3><p class="muted">${esc(pick(s.body))}</p>${s.list?`<ul class="ow-glist">${s.list.map(li=>`<li>${pick(li)}</li>`).join("")}</ul>`:""}</div>`).join("")}${d.moods?owMoodsTable(d):""}</section>`;
  }else if(_owTab==="map"){
    body=`<section class="card pad ow-map">${owLayersBar()}${owMapSvg(w)}<div class="ow-poicard" id="owpoicard">${owPoiCardHtml(w)}</div>${owLegend()}</section>`;
  }else if(_owTab==="missions"){
    body=`<section class="card pad"><div class="ow-missions">${(w.missions||[]).map(m=>
      `<div class="ow-mission"><h3 translate="no">${esc(m.n)}</h3><p class="muted">${esc(pick(m.d))}</p></div>`).join("")}</div></section>`;
  }else{
    const rars=["all","guaranteed","rare","uncommon","common"];
    const rows=(w.resources||[]).filter(r=>_owRar==="all"||r.rar===_owRar);
    const fm=(typeof OW_FISHMINE!=="undefined"&&OW_FISHMINE[w.id])||null;
    const wlink=n=>`<a class="ow-wiki" href="${esc(safeUrl(owWiki(n)))}" target="_blank" rel="noopener noreferrer" title="wiki ↗" aria-label="wiki">↗</a>`;
    const fishHtml=fm&&fm.fish&&fm.fish.length?`<h3>${t("ow.fishing")}</h3>${fm.note?`<p class="muted" style="margin:0 0 8px">${esc(pick(fm.note))}</p>`:""}<div class="ow-fmlist">${fm.fish.map(f=>`<div class="ow-fm"><span class="ow-fm-n" translate="no">${esc(f.n)} ${wlink(f.n)}</span><span class="muted">${esc(pick(f.where))}${f.bait?` · ${t("ow.bait")} : <span translate="no">${esc(f.bait)}</span>`:""}</span></div>`).join("")}</div>`:"";
    const mineHtml=fm&&fm.mine&&fm.mine.length?`<h3>${t("ow.mining")}</h3><div class="ow-fmlist">${fm.mine.map(m=>`<div class="ow-fm"><span class="ow-fm-n" translate="no">${m.kind==="gem"?"💎":"⛏️"} ${esc(m.n)} ${wlink(m.n)}</span><span class="muted">${esc(pick(m.where))}</span></div>`).join("")}</div>`:"";
    body=`<section class="card pad">
      <div class="ow-rarfilter" id="owrar"><span class="muted">${t("ow.rarFilter")} :</span>${rars.map(k=>`<button class="chip ow-rarc ${k===_owRar?"on":""}" data-owr="${k}">${k==="all"?t("ow.rar.all"):rarLbl[k]}</button>`).join("")}</div>
      <div class="ow-restable">
      <div class="ow-rrow ow-rhead"><span>${t("ow.colResource")}</span><span>${t("ow.colWhere")}</span><span>${t("ow.colChance")}</span></div>
      ${rows.map(r=>`<div class="ow-rrow" title="${esc(pick(r.where))} — ${esc(pick(r.chance))}"><span class="ow-rn" translate="no">${esc(r.n)} ${wlink(r.n)}</span><span class="muted">${esc(pick(r.where))}</span><span><span class="ow-rar ow-rar-${rarCls[r.rar]||"dim"}">${esc(rarLbl[r.rar]||r.rar)}</span> <span class="muted" style="font-size:.8rem">${esc(pick(r.chance))}</span></span></div>`).join("")||`<p class="muted" style="padding:10px 2px">${t("common.empty")}</p>`}
    </div>${fishHtml}${mineHtml}</section>`;
  }
  app().innerHTML=`<h1>${t("page.openWorlds")}</h1><p class="sub">${t("ow.sub")}</p>
    <div class="pills" id="owpills">${worlds.map(x=>`<button class="pill ${x.id===w.id?"active":""}" data-ow="${esc(x.id)}" translate="no">${esc(x.name)}</button>`).join("")}</div>
    <section class="card pad ow-head">
      <h2 style="margin:0 0 4px" translate="no">${esc(w.name)}</h2>
      <p class="mt" style="margin:0 0 8px">${esc(pick(w.desc))}</p>
      <div class="ow-cycle" id="owcycle"><span class="muted">${LOADING}</span></div>
      <div class="ow-now" id="ownow"></div>
      <div class="ow-meta" style="margin-top:10px">
        <div class="kv"><span class="k">${t("ow.planet")}</span><span class="v" translate="no">${esc(w.planet)}</span></div>
        <div class="kv"><span class="k">${t("ow.hub")}</span><span class="v" translate="no">${esc(w.hub)}</span></div>
        <div class="kv"><span class="k">${t("ow.faction")}</span><span class="v" translate="no">${esc(w.faction)}</span></div>
        <div class="kv"><span class="k">${t("ow.vehicle")}</span><span class="v">${esc(w.vehicle)}</span></div>
      </div>
    </section>
    <div class="pills" id="owtabs">
      <button class="pill ${_owTab==="map"?"active":""}" data-owt="map">${t("ow.tabMap")}</button>
      <button class="pill ${_owTab==="missions"?"active":""}" data-owt="missions">${t("ow.tabMissions")}</button>
      <button class="pill ${_owTab==="resources"?"active":""}" data-owt="resources">${t("ow.tabResources")}</button>
      ${d?`<button class="pill ${_owTab==="guide"?"active":""}" data-owt="guide">${t("ow.tabGuide")}</button>`:""}
    </div>
    <div id="owbody">${body}</div>
    <p class="muted" style="margin-top:12px">${t("ow.sources")} : ${(w.src||[]).map(u=>`<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener noreferrer">${esc(u.replace(/^https?:\/\//,"").replace(/\/w\/.*/,""))} ↗</a>`).join(" · ")} · warframestat.us</p>`;
  document.getElementById("owpills").querySelectorAll(".pill").forEach(b=>b.addEventListener("click",()=>{_owSel=b.dataset.ow;_owPoi=-1;_owZ={s:1,x:0,y:0};renderOpenWorlds();}));
  document.getElementById("owtabs").querySelectorAll(".pill").forEach(b=>b.addEventListener("click",()=>{_owTab=b.dataset.owt;renderOpenWorlds();}));
  const rf=document.getElementById("owrar"); if(rf) rf.querySelectorAll(".ow-rarc").forEach(b=>b.addEventListener("click",()=>{_owRar=b.dataset.owr;renderOpenWorlds();}));
  if(_owTab==="map") owWireMap(w);
  owLoadCycle(w);
}
