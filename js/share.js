/* VoidRelay — boutons de partage (rend chaque page propageable).
   X, Reddit, Facebook, copier le lien, et « copier pour Discord » (ligne prix
   prête à coller dans un salon de trade). Aucun tracker, aucune dépendance. */
(function () {
  const enc = encodeURIComponent;
  function flash(b, txt) { const o = b.textContent; b.textContent = txt; setTimeout(() => { b.textContent = o; }, 1500); }
  document.querySelectorAll("[data-share]").forEach(bar => {
    const url = location.href.split("#")[0];
    const title = document.title.replace(/\s*\|\s*VoidRelay.*$/, "");
    bar.querySelectorAll("[data-net]").forEach(b => {
      b.addEventListener("click", e => {
        const net = b.dataset.net;
        if (net === "copy") { e.preventDefault(); navigator.clipboard && navigator.clipboard.writeText(url).then(() => flash(b, "Lien copié ✓")); return; }
        if (net === "discord") {
          e.preventDefault();
          const price = (document.getElementById("px-median") || {}).textContent || "";
          const name = ((document.querySelector("h1") || {}).textContent || title).replace(/\s*—.*$/, "");
          const line = price && price !== "…" ? `${name} : ${price} — ${url}` : `${name} — ${url}`;
          navigator.clipboard && navigator.clipboard.writeText(line).then(() => flash(b, "Copié ✓"));
          return;
        }
        let href = "";
        if (net === "x") href = `https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`;
        else if (net === "reddit") href = `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(title)}`;
        else if (net === "fb") href = `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`;
        if (href) { e.preventDefault(); window.open(href, "_blank", "noopener,noreferrer,width=600,height=520"); }
      });
    });
  });
})();
