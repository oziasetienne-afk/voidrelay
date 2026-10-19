/* VoidRelay — page « Bons plans » : hydrate les meilleurs deals depuis
   /data/summary.json (same-origin). Chaque objet renvoie vers sa page /o/<slug>. */
(function(){
  const $=id=>document.getElementById(id);
  const titleCase=s=>String(s||"").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
  const card=(slug,right,sub)=>`<a class="card tile" href="/o/${encodeURIComponent(slug)}"><div class="t">${titleCase(slug)}</div><div class="d">${right}${sub?` · <span class="muted">${sub}</span>`:""}</div></a>`;
  const sec=(id,arr)=>{const el=$(id); if(!el)return; el.innerHTML=arr.length?arr.join(""):'<p class="muted">Rien à signaler pour le moment.</p>';};
  const hide=id=>{const e=$(id);if(e)e.closest("section").style.display="none";};

  fetch("/data/summary.json",{cache:"no-store"}).then(r=>r.json()).then(s=>{
    const items=(s.market&&s.market.items)||[];
    const movers=(s.marketMovers||[]);
    // map slug->item pour enrichir les movers
    const bySlug={}; items.forEach(i=>bySlug[i.slug]=i);

    // 🔥 hausses
    const up=[...items].filter(i=>i.change24h>0).sort((a,b)=>b.change24h-a.change24h)
      .concat(movers.filter(m=>m.change24h>0&&!bySlug[m.slug]))
      .slice(0,8).map(i=>card(i.slug,`+${i.change24h}% / 24 h`,`${i.minSellPlat||i.median||"?"} PL`));
    sec("up",up);

    // 💎 ducats/platine
    const duc=[...items].filter(i=>i.ducatsPerPlat).sort((a,b)=>b.ducatsPerPlat-a.ducatsPerPlat)
      .slice(0,8).map(i=>card(i.slug,`${i.ducatsPerPlat.toFixed(2)} ducats/PL`,`${i.ducats||"?"} ducats · ${i.minSellPlat||i.median} PL`));
    sec("duc",duc);

    // 📉 baisses (bon moment pour acheter)
    const down=[...items].filter(i=>i.change24h<0).sort((a,b)=>a.change24h-b.change24h)
      .slice(0,8).map(i=>card(i.slug,`${i.change24h}% / 24 h`,`${i.minSellPlat||i.median} PL`));
    down.length?sec("down",down):hide("down");

    // 🔄 Prime Resurgence (Varzia)
    const r=s.resurgence||{};
    if(r.active&&(r.featured||[]).length){
      sec("resu",(r.featured||[]).slice(0,8).map(n=>{const slug=n.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/_+$/,"")+"_set";return card(slug,n,"obtenable chez Varzia");}));
      const loc=$("resu-loc"); if(loc&&r.location) loc.textContent=" — "+r.location;
    } else hide("resu");

    // 🏷️ Darvo
    const d=s.darvo||{};
    if(d.active&&d.item&&(d.stockLeft==null||d.stockLeft>0)){
      $("darvo").innerHTML=`<div class="card pad"><b>${d.item}</b> — <span style="color:var(--bad)">-${d.discount}%</span> : <b>${d.salePlat} PL</b> <span class="muted">au lieu de ${d.originalPlat} PL${d.stockLeft?` · ${d.stockLeft} en stock`:""}</span></div>`;
    } else hide("darvo");

    // 🛒 Baro
    const b=s.baro||{};
    if(b.active){ $("baro").innerHTML=`<div class="card pad">🛒 <b>Baro Ki'Teer est là</b> — ${b.location||""}. <a href="/hub">Voir son inventaire →</a></div>`; }
    else hide("baro");

    const u=$("dealsupd"); if(u) u.textContent="Mis à jour : "+new Date().toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
  }).catch(()=>{ const m=$("dealsupd"); if(m) m.textContent="Données momentanément indisponibles."; });
})();
