/* VoidRelay — hero « carte stellaire animée » : nœuds dorés reliés par de fines lignes,
   dérive lente, quelques nœuds qui pulsent, léger parallax souris/scroll.
   100% original (aucun asset Warframe), scène procédurale dessinée en Canvas 2D.
   Chargé en defer, uniquement par index.html. N'affecte aucune autre page.
   Repli image statique : ne s'exécute pas sur mobile (<768px) ni si prefers-reduced-motion —
   dans ces cas, seule l'image de fond (--hero-bg-url) et le voile restent visibles. */
(function () {
  "use strict";
  var hero = document.querySelector(".hero");
  if (!hero) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (window.innerWidth < 768) return;

  var inner = hero.querySelector(".in");
  var canvas = document.createElement("canvas");
  canvas.className = "hero-fx";
  canvas.setAttribute("aria-hidden", "true");
  hero.insertBefore(canvas, inner);

  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var W = 0, H = 0;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    var r = hero.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    layoutNodes();
  }

  /* ---------- Nœuds de la carte stellaire ---------- */
  var N = 30;
  var MAX_DIST = 150; /* distance max (px CSS) pour tracer une ligne entre 2 nœuds */
  var nodes = [];

  function layoutNodes() {
    /* Concentre la carte sur la moitié droite du hero (zone illustrée), évite le texte à gauche. */
    var zoneX = W * 0.42, zoneW = W * 0.56;
    var zoneY = H * 0.06, zoneH = H * 0.88;
    for (var i = 0; i < N; i++) {
      var n = nodes[i] || (nodes[i] = {});
      n.baseX = zoneX + Math.random() * zoneW;
      n.baseY = zoneY + Math.random() * zoneH;
      n.ampX = 6 + Math.random() * 10;
      n.ampY = 6 + Math.random() * 10;
      n.freqX = 0.00025 + Math.random() * 0.0004;
      n.freqY = 0.00022 + Math.random() * 0.00035;
      n.phaseX = Math.random() * Math.PI * 2;
      n.phaseY = Math.random() * Math.PI * 2;
      n.r = 1.1 + Math.random() * 1.4;
      n.pulse = Math.random() < 0.3; /* ~30% des nœuds pulsent doucement */
      n.pulseFreq = 0.0009 + Math.random() * 0.0007;
      n.pulsePhase = Math.random() * Math.PI * 2;
      n.gold = Math.random() < 0.75; /* majorité dorée, minorité bleu-violet (accent nuit) */
      n.x = n.baseX; n.y = n.baseY;
    }
  }

  /* ---------- Parallax (souris + scroll), appliqué via transform CSS uniquement ---------- */
  var mx = 0, my = 0, parallaxScroll = 0;
  hero.addEventListener("mousemove", function (e) {
    var r = hero.getBoundingClientRect();
    mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    my = ((e.clientY - r.top) / r.height - 0.5) * 2;
  }, { passive: true });
  hero.addEventListener("mouseleave", function () { mx = 0; my = 0; }, { passive: true });
  window.addEventListener("scroll", function () {
    var r = hero.getBoundingClientRect();
    parallaxScroll = Math.max(-1, Math.min(1, -r.top / Math.max(1, r.height)));
  }, { passive: true });

  function applyParallax() {
    var px = mx * 7, py = my * 5 + parallaxScroll * 10;
    canvas.style.transform = "translate3d(" + px.toFixed(1) + "px," + py.toFixed(1) + "px,0)";
  }

  var running = false, raf = null, hidden = document.hidden, inView = false;

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    applyParallax();

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.x = n.baseX + Math.sin(t * n.freqX + n.phaseX) * n.ampX;
      n.y = n.baseY + Math.cos(t * n.freqY + n.phaseY) * n.ampY;
    }

    /* Lignes de constellation entre nœuds proches */
    for (var a = 0; a < nodes.length; a++) {
      for (var b = a + 1; b < nodes.length; b++) {
        var na = nodes[a], nb = nodes[b];
        var dx = na.x - nb.x, dy = na.y - nb.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MAX_DIST) {
          var alpha = (1 - dist / MAX_DIST) * 0.22;
          ctx.beginPath();
          ctx.strokeStyle = "rgba(212,175,55," + alpha.toFixed(3) + ")";
          ctx.lineWidth = 1;
          ctx.moveTo(na.x, na.y);
          ctx.lineTo(nb.x, nb.y);
          ctx.stroke();
        }
      }
    }

    /* Nœuds */
    for (var j = 0; j < nodes.length; j++) {
      var nd = nodes[j];
      var pulse = nd.pulse ? 0.5 + 0.5 * Math.sin(t * nd.pulseFreq + nd.pulsePhase) : 0;
      var r = nd.r + (nd.pulse ? pulse * 1.3 : 0);
      var baseAlpha = nd.pulse ? 0.45 + pulse * 0.4 : 0.4;
      var color = nd.gold ? "212,175,55" : "129,140,248";
      ctx.beginPath();
      ctx.fillStyle = "rgba(" + color + "," + baseAlpha.toFixed(3) + ")";
      ctx.shadowColor = "rgba(" + color + ",0.65)";
      ctx.shadowBlur = nd.pulse ? 5 + pulse * 3 : 3;
      ctx.arc(nd.x, nd.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (running) raf = requestAnimationFrame(draw);
  }

  function start() {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(draw);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });

  document.addEventListener("visibilitychange", function () {
    hidden = document.hidden;
    if (hidden) stop(); else if (inView) start();
  });

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (inView && !hidden) start(); else stop();
    }, { threshold: 0.05 });
    io.observe(hero);
  } else {
    start();
  }
})();
