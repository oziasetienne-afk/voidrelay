/* Le service worker prévient quand une donnée vient du cache faute de réseau (sw.js). */
if("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message",e=>{
  if(!e.data||e.data.type!=="vr-donnees-hors-ligne"||document.getElementById("vr-hors-ligne")||!document.body) return;
  const d=document.createElement("div"); d.id="vr-hors-ligne"; d.setAttribute("role","status");
  d.style.cssText="position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:9999;background:#1a1d27;color:#e8eaf0;border:1px solid #f5a623;border-radius:8px;padding:6px 12px;font:13px/1.3 system-ui,sans-serif";
  d.textContent=/^en/i.test(document.documentElement.lang)?"📴 Offline data — may be outdated":"📴 Données hors ligne — peuvent être périmées";
  document.body.appendChild(d);
});
