/* VoidRelay — page « Bons plans » : hydrate les meilleurs deals depuis
   /data/summary.json (same-origin). Chaque objet renvoie vers sa page /o/<slug>. */
(function(){
  const $=id=>document.getElementById(id);
  const titleCase=s=>String(s||"").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
  const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  // Nom affiché = celui du catalogue posé par le pipeline (nomFr, sinon nom EN) ; le
  // slug mis en forme n'est qu'un repli (objet hors catalogue), jamais un nom inventé.
  const slugDe=i=>typeof i==="string"?i:i.slug;
  const nomDe=i=>typeof i==="string"?titleCase(i):(i.nomFr||i.nom||titleCase(i.slug));
  const card=(i,right,sub)=>`<a class="card tile" href="/o/${encodeURIComponent(slugDe(i))}" title="${esc(typeof i==="string"?"":(i.nom||""))}"><div class="t">${esc(nomDe(i))}</div><div class="d">${right}${sub?` · <span class="muted">${sub}</span>`:""}</div></a>`;
  const sec=(id,arr)=>{const el=$(id); if(!el)return; el.innerHTML=arr.length?arr.join(""):'<p class="muted">Rien à signaler pour le moment.</p>';};
  const hide=id=>{const e=$(id);if(e)e.closest("section").style.display="none";};

  fetch("/data/summary.json",{cache:"no-store"}).then(r=>r.json()).then(s=>{
    const items=(s.market&&s.market.items)||[];
    const movers=(s.marketMovers||[]);
    // map slug->item pour enrichir les movers
    const bySlug={}; items.forEach(i=>bySlug[i.slug]=i);

    // change24h est en PLATINE, sur la MÉDIANE des 5 offres les plus basses (au même
    // rang) : depuis le 21/10/2026, plus sur l'offre la plus basse seule — Lex Prime Set
    // titrait « −62 % » sur une offre isolée à 3 p. Jusqu'au 20/10/2026 il était affiché
    // suivi d'un « % » ; le pourcentage vient de change24hPct, et un objet sans ce
    // chiffre n'est pas classé. Le prix montré à côté est donc la médiane, celle du %.
    const pl=i=>`${i.change24h>0?"+":""}${i.change24h} PL (${i.change24hPct>0?"+":""}${i.change24hPct} %) / 24 h`;
    const prix=i=>i.median!=null?`${i.median} PL méd.`:`${i.minSellPlat??"?"} PL`;
    const rg=i=>i.rang!=null?` · rang ${i.rang}`:"";
    const okPct=i=>typeof i.change24hPct==="number";

    // 🔥 hausses
    const up=[...items].filter(i=>i.change24h>0&&okPct(i)).sort((a,b)=>b.change24hPct-a.change24hPct)
      .concat(movers.filter(m=>m.change24h>0&&okPct(m)&&!bySlug[m.slug]))
      .slice(0,8).map(i=>card(i,pl(i),`${prix(i)}${rg(i)}`));
    sec("up",up);

    // 💎 ducats/platine
    const duc=[...items].filter(i=>i.ducatsPerPlat).sort((a,b)=>b.ducatsPerPlat-a.ducatsPerPlat)
      .slice(0,8).map(i=>card(i,`${i.ducatsPerPlat.toFixed(2)} ducats/PL`,`${i.ducats||"?"} ducats · ${prix(i)}`));
    sec("duc",duc);

    // 📉 baisses (bon moment pour acheter)
    const down=[...items].filter(i=>i.change24h<0&&okPct(i)).sort((a,b)=>a.change24hPct-b.change24hPct)
      .slice(0,8).map(i=>card(i,pl(i),`${prix(i)}${rg(i)}`));
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
