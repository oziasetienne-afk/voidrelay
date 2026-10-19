/* VoidRelay — bouton burger de la nav principale (mobile ≤900px).
   Chargé en defer sur toutes les pages utilisant le header topnav. */
(function () {
  "use strict";
  var burger = document.getElementById("navburger");
  var nav = document.querySelector(".topnav");
  if (!burger || !nav) return;

  function setOpen(open) {
    nav.classList.toggle("open", open);
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  }

  burger.addEventListener("click", function () {
    setOpen(!nav.classList.contains("open"));
  });

  document.addEventListener("click", function (e) {
    if (nav.classList.contains("open") && !e.target.closest(".topnav") && !e.target.closest("#navburger")) {
      setOpen(false);
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setOpen(false);
  });

  nav.addEventListener("click", function (e) {
    if (e.target.closest("a")) setOpen(false);
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 900) setOpen(false);
  }, { passive: true });
})();
