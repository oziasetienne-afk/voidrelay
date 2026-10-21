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
          // Fiches /o/ FR : le H1 porte le nom FR puis le nom EN en petit (<span class="en">) ; on ne
          // copie que le nom principal, sans dupliquer l'anglais dans la ligne Discord.
          const h1 = document.querySelector("h1"), h1c = h1 && h1.cloneNode(true);
          if (h1c) h1c.querySelectorAll(".en").forEach(e => e.remove());
          const name = ((h1c || {}).textContent || title).replace(/\s*—.*$/, "").trim();
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
