#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Générateur de visuels SVG originaux pour VoidRelay (voidrelay.fr / ~/warframe-hub).
0 droit tiers, 0 CDN, 0 dépendance : art vectoriel maison aux couleurs du thème.
Régénérable : python3 assets/gen_visuels.py  (recrée tout sous assets/banners + assets/icons)

Palette (css/style.css :root) :
  bg #080b12  bg2 #0c1018  elev #141b27  border #26324a
  text #eaf1fb  dim #9fb0c9  accent/gold #d4af37  accent2 #e6d0a6
  indigo #818cf8  warn #fbbf24  good #34d399  bad #fb7185
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
BAN = os.path.join(HERE, "banners")
ICO = os.path.join(HERE, "icons")
for d in (BAN, ICO):
    os.makedirs(d, exist_ok=True)

GOLD = "#d4af37"; INDIGO = "#818cf8"; GOOD = "#34d399"; BAD = "#fb7185"
WARN = "#fbbf24"; TEXT = "#eaf1fb"; DIM = "#9fb0c9"; CYAN = "#5fd3e6"


def write(path, svg):
    with open(path, "w", encoding="utf-8") as f:
        f.write(svg.strip() + "\n")
    print(f"  écrit {os.path.relpath(path, HERE)} ({len(svg)}o)")


# ---------------------------------------------------------------------------
# BANNIÈRES DE GUIDES  (1200x360, sans texte -> le HTML pose son propre titre)
# Fond dégradé sombre + grille hexagonale néon discrète + glyphe thématique.
# ---------------------------------------------------------------------------
def hexgrid(opacity=0.10, color=GOLD):
    return f'''
  <pattern id="hex" width="56" height="64" patternUnits="userSpaceOnUse" patternTransform="scale(1)">
    <path d="M28 0 L56 16 L56 48 L28 64 L0 48 L0 16 Z" fill="none"
          stroke="{color}" stroke-width="1" opacity="{opacity}"/>
  </pattern>'''


def banner(name, accent, glyph):
    svg = f'''
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 360" role="img" aria-label="VoidRelay">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a0e16"/>
      <stop offset="0.55" stop-color="#0c1018"/>
      <stop offset="1" stop-color="#070a10"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.78" cy="0.4" r="0.6">
      <stop offset="0" stop-color="{accent}" stop-opacity="0.30"/>
      <stop offset="1" stop-color="{accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="edge" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="{accent}" stop-opacity="0.9"/>
      <stop offset="1" stop-color="{accent}" stop-opacity="0.15"/>
    </linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>{hexgrid(0.10, accent)}
  </defs>
  <rect width="1200" height="360" fill="url(#bg)"/>
  <rect width="1200" height="360" fill="url(#hex)"/>
  <rect width="1200" height="360" fill="url(#halo)"/>
  <rect x="0" y="354" width="1200" height="6" fill="url(#edge)"/>
  <g transform="translate(900,180)" filter="url(#glow)" stroke="{accent}"
     stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round">
    {glyph}
  </g>
</svg>'''
    write(os.path.join(BAN, f"guide-{name}.svg"), svg)


# Glyphes thématiques (centrés sur 0,0, ~ rayon 110)
G_DEBUT = '<circle r="64" opacity="0.5"/><path d="M0 -96 L24 -34 L92 -30 L40 12 L56 86 L0 48 L-56 86 L-40 12 L-92 -30 L-24 -34 Z" fill="{}" fill-opacity="0.12"/>'.format(GOLD)
G_PLAT = '<path d="M0 -100 L86 -50 L86 50 L0 100 L-86 50 L-86 -50 Z" fill="{c}" fill-opacity="0.10"/><path d="M0 -54 L46 -27 L46 27 L0 54 L-46 27 L-46 -27 Z"/>'.format
G_DUCAT = '<circle r="92" fill="{c}" fill-opacity="0.10"/><circle r="92"/><circle r="58"/><path d="M0 -40 V40 M-22 -22 H22 M-22 22 H22"/>'.format
G_EIDO = '<path d="M-96 64 L-30 -72 L0 -20 L34 -86 L96 64 Z" fill="{c}" fill-opacity="0.10"/><circle cx="34" cy="-44" r="10"/>'.format
G_STEEL = '<path d="M-78 -78 L34 34 M34 -78 L-78 34" /><path d="M-78 -78 l30 6 l-24 24 z" fill="{c}"/><path d="M34 -78 l-30 6 l24 24 z" fill="{c}"/><circle cx="-22" cy="-22" r="8" fill="{c}" stroke="none"/>'.format
G_NIGHT = '<path d="M-96 18 q24 -40 48 0 t48 0 t48 0 t48 0" /><path d="M-96 58 q24 -40 48 0 t48 0 t48 0 t48 0" opacity="0.5"/><path d="M62 -64 a40 40 0 1 0 24 70 a52 52 0 1 1 -24 -70 Z" fill="{c}" fill-opacity="0.15"/>'.format
G_TRADE = '<path d="M-90 -34 H70 l-26 -26 M70 -34 l-26 26"/><path d="M90 34 H-70 l26 -26 M-70 34 l26 26"/>'.format
G_MAST = '<path d="M0 -96 L22 -32 L88 -32 L34 8 L54 74 L0 34 L-54 74 L-34 8 L-88 -32 L-22 -32 Z"/><circle r="20"/>'.format
G_BARO = '<path d="M-70 80 V-30 a70 60 0 0 1 140 0 V80 Z" fill="{c}" fill-opacity="0.10"/><path d="M-70 80 V-30 a70 60 0 0 1 140 0 V80"/><circle cx="-28" cy="6" r="12"/><circle cx="28" cy="6" r="12"/><path d="M-18 44 q18 18 36 0"/>'.format
G_RELIC = '<path d="M0 -100 L70 -40 V60 L0 100 L-70 60 V-40 Z" fill="{c}" fill-opacity="0.12"/><path d="M0 -100 L70 -40 V60 L0 100 L-70 60 V-40 Z"/><path d="M0 -54 L38 -22 V40 L0 64 L-38 40 V-22 Z"/>'.format

banner("debuter", INDIGO, '<circle r="64" opacity="0.5"/><path d="M0 -96 L24 -34 L92 -30 L40 12 L56 86 L0 48 L-56 86 L-40 12 L-92 -30 L-24 -34 Z"/>')
banner("platine", CYAN, G_PLAT(c=CYAN))
banner("ducats", GOLD, G_DUCAT(c=GOLD))
banner("eidolons", GOOD, G_EIDO(c=GOOD))
banner("steel-path", BAD, G_STEEL(c=BAD))
banner("nightwave", INDIGO, G_NIGHT(c=INDIGO))
banner("trading", GOLD, G_TRADE(c=GOLD))
banner("maitrise", WARN, G_MAST(c=WARN))
banner("baro", GOLD, G_BARO(c=GOLD))
banner("reliques", "#e6d0a6", G_RELIC(c="#e6d0a6"))


# ---------------------------------------------------------------------------
# HERO ACCUEIL (1600x520) — ambiance large, sans texte
# ---------------------------------------------------------------------------
hero = f'''
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 520" role="img" aria-label="VoidRelay">
  <defs>
    <radialGradient id="sky" cx="0.5" cy="0.2" r="0.9">
      <stop offset="0" stop-color="#10182a"/>
      <stop offset="0.5" stop-color="#0a0e18"/>
      <stop offset="1" stop-color="#06080e"/>
    </radialGradient>
    <radialGradient id="rift" cx="0.5" cy="0.42" r="0.32">
      <stop offset="0" stop-color="{GOLD}" stop-opacity="0.85"/>
      <stop offset="0.4" stop-color="{INDIGO}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="{INDIGO}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{INDIGO}" stop-opacity="0.25"/>
      <stop offset="1" stop-color="{INDIGO}" stop-opacity="0"/>
    </linearGradient>
    <filter id="gl" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="7" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>{hexgrid(0.08, INDIGO)}
  </defs>
  <rect width="1600" height="520" fill="url(#sky)"/>
  <rect width="1600" height="520" fill="url(#hex)"/>
  <!-- étoiles -->
  <g fill="{TEXT}">
    {''.join(f'<circle cx="{(i*97)%1600}" cy="{(i*53)%300}" r="{1 if i%3 else 1.8}" opacity="{0.2+0.5*((i%4)/4)}"/>' for i in range(60))}
  </g>
  <!-- faille du Vide -->
  <ellipse cx="800" cy="220" rx="520" ry="360" fill="url(#rift)"/>
  <g filter="url(#gl)" fill="none" stroke="{GOLD}" stroke-width="3" stroke-linecap="round">
    <path d="M800 40 C 760 160, 840 260, 800 400" opacity="0.9"/>
    <path d="M740 80 C 720 180, 770 280, 745 380" opacity="0.5"/>
    <path d="M860 80 C 880 180, 830 280, 855 380" opacity="0.5"/>
  </g>
  <!-- horizon / sol néon -->
  <rect x="0" y="380" width="1600" height="140" fill="url(#floor)"/>
  <g stroke="{INDIGO}" stroke-width="1.5" opacity="0.5">
    {''.join(f'<line x1="800" y1="392" x2="{i*200-200}" y2="520"/>' for i in range(11))}
    <line x1="0" y1="392" x2="1600" y2="392" stroke="{GOLD}" stroke-opacity="0.7"/>
  </g>
</svg>'''
write(os.path.join(BAN, "hero-home.svg"), hero)


# ---------------------------------------------------------------------------
# PICTOS TABLEAU DE BORD (hub.html) — 64x64, line-néon, stroke=currentColor
# Utilisables en <img> (couleur figée gold) — currentColor stylable si inline.
# ---------------------------------------------------------------------------
def picto(name, body, color=GOLD):
    svg = f'''
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"
     stroke="{color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
     role="img" aria-label="{name}">
  {body}
</svg>'''
    write(os.path.join(ICO, f"{name}.svg"), svg)


picto("cycle-jour-nuit",
      '<circle cx="32" cy="32" r="20"/><path d="M32 12 a20 20 0 0 1 0 40 Z" fill="{}" fill-opacity="0.18" stroke="none"/>'
      '<path d="M32 6v4M32 54v4M6 32h4M54 32h4M14 14l3 3M47 47l3 3M50 14l-3 3M17 47l-3 3"/>'.format(GOLD))
picto("fissure-vide",
      '<path d="M32 6 L52 20 V44 L32 58 L12 44 V20 Z"/><path d="M32 16 L44 24 V40 L32 48 L20 40 V24 Z" opacity="0.6"/>'
      '<path d="M32 16 L32 48" stroke-dasharray="3 4"/>', INDIGO)
picto("invasion",
      '<path d="M14 14 L42 42M50 14 L22 42"/><path d="M14 14 l9 1 l-8 8 z" fill="{c}" stroke="none"/>'
      '<path d="M50 14 l-9 1 l8 8 z" fill="{c}" stroke="none"/><path d="M40 44 l8 8M44 40 l8 8M18 52 l6-6"/>'.format(c=BAD), BAD)
picto("baro",
      '<path d="M18 56 V30 a14 12 0 0 1 28 0 V56 Z"/><circle cx="26" cy="38" r="3"/><circle cx="38" cy="38" r="3"/>'
      '<path d="M28 47 q4 4 8 0"/><path d="M24 22 l8 -8 l8 8"/>', GOLD)
picto("alerte",
      '<path d="M32 10 a14 14 0 0 1 14 14 c0 12 4 16 6 20 H12 c2 -4 6 -8 6 -20 a14 14 0 0 1 14 -14 Z"/>'
      '<path d="M27 52 a5 5 0 0 0 10 0"/>', WARN)
picto("platine",
      '<path d="M32 8 L54 21 V43 L32 56 L10 43 V21 Z"/><path d="M32 20 L43 27 V40 L32 47 L21 40 V27 Z" opacity="0.55"/>', CYAN)
picto("ducats",
      '<circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="13"/><path d="M32 19 V45M25 25 H39M25 39 H39"/>', GOLD)
picto("invasions-recompense",
      '<rect x="14" y="24" width="36" height="28" rx="3"/><path d="M14 32 H50"/><path d="M32 24 V52"/>'
      '<path d="M24 24 q-2 -10 8 -10 q10 0 8 10" />', GOOD)
picto("nightwave",
      '<path d="M8 38 q8 -12 16 0 t16 0 t16 0"/><path d="M8 48 q8 -12 16 0 t16 0 t16 0" opacity="0.5"/>'
      '<path d="M46 14 a13 13 0 1 0 8 23 a17 17 0 1 1 -8 -23 Z" fill="{}" fill-opacity="0.18"/>'.format(INDIGO), INDIGO)
picto("relique",
      '<path d="M32 8 L52 22 V42 L32 56 L12 42 V22 Z"/><path d="M32 18 L43 26 V40 L32 48 L21 40 V26 Z"/><circle cx="32" cy="33" r="4"/>', "#e6d0a6")
picto("steel-path",
      '<path d="M20 44 L44 20 M44 20 l-2 8 l8 -2 z" fill="{c}" stroke="none"/><path d="M44 20 l-2 8 l8 -2 z"/>'
      '<path d="M18 46 l-4 4 M14 50 l6 6 M20 56 l4 -4"/><path d="M32 10 l3 7 l7 0 l-5.5 4.5 l2 7 l-6.5 -4 l-6.5 4 l2 -7 l-5.5 -4.5 l7 0 z" opacity="0.55"/>'.format(c=BAD), BAD)
picto("riven",
      '<path d="M32 6 L50 32 L32 58 L14 32 Z"/><path d="M22 32 H42 M32 18 L26 32 M32 18 L38 32"/><path d="M24 44 L40 20" opacity="0.5"/>', INDIGO)

print("OK — visuels générés.")
