"""Generates the WOW brand SVGs from the traced Wafflehaüs mark.

Usage (from the repo root):  python brand/tools/generate.py
Needs fontTools and brotli (pip install fonttools brotli). Text is set in Noto Sans, read from the
app's own @fontsource-variable/noto-sans package, and outlined, so the SVGs need no fonts installed.
Then run render.mjs for the PNGs, and ImageMagick for favicon.ico (see brand/README.md).

The mark is a vector trace of public/wafflehaus.png (vtracer, colours snapped to the four logo
colours), kept in brand/tools/source/. Its coordinates are a 1000 x 1000 square.
"""
import os
import re

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.dirname(HERE)
REPO = os.path.dirname(BRAND)
NOTO = os.path.join(REPO, "node_modules/@fontsource-variable/noto-sans/files/noto-sans-latin-wght-normal.woff2")

# ---- Palette (the logo's own four colours, plus the app's) -------------------------------------
MAROON = "#7E0F0F"   # the mark's ground
BATTER = "#F2D55E"   # the waffle's ridges
GOLDEN = "#D99630"   # the wells
CRISP = "#D5763C"    # shading in the wells
SYRUP = "#F49F1E"    # highlight orange (PixelBlast, social)
INK = "#18181B"      # app foreground, light
SNOW = "#FCFCFC"     # app foreground, dark
CREAM = "#FFF4DC"    # text on maroon

# ---- The traced mark -------------------------------------------------------------------------
_trace = open(os.path.join(HERE, "source/wafflehaus-trace.svg")).read()
TRACE_PATHS = re.findall(r"<path[^>]*/>", _trace)
assert MAROON in TRACE_PATHS[0], "first traced path should be the maroon ground"
TOWER_PATHS = "".join(TRACE_PATHS[1:])
LATTICE_D = re.search(r'<path d="([^"]+)"[^>]*transform="translate\(([-\d.]+),([-\d.]+)\)"',
                      open(os.path.join(HERE, "source/wafflehaus-lattice.svg")).read())
# The tower's bounding box inside the 1000 square.
TX, TY, TW, TH = 168, 49, 652, 895


def mark(x, y, size):
    """The full mark: tower on its maroon square."""
    k = size / 1000
    return (f'<g transform="translate({x:g} {y:g}) scale({k:.5f})">'
            f'<rect width="1000" height="1000" fill="{MAROON}"/>{TOWER_PATHS}</g>')


def tower(x, y, height):
    """The tower alone, full colour; (x, y) is the top-left of its bounding box."""
    k = height / TH
    return f'<g transform="translate({x - TX * k:.2f} {y - TY * k:.2f}) scale({k:.5f})">{TOWER_PATHS}</g>'


def lattice(x, y, height, color):
    """The tower in one colour: just the ridges, wells open."""
    k = height / TH
    d, dx, dy = LATTICE_D.group(1), LATTICE_D.group(2), LATTICE_D.group(3)
    return (f'<g transform="translate({x - TX * k:.2f} {y - TY * k:.2f}) scale({k:.5f})">'
            f'<path d="{d}" fill="{color}" transform="translate({dx},{dy})"/></g>')


# ---- Noto Sans outlines -----------------------------------------------------------------------
_fonts = {}


def _font(wght):
    if wght not in _fonts:
        _fonts[wght] = instantiateVariableFont(TTFont(NOTO), {"wght": wght})
    return _fonts[wght]


def text(s, x, baseline, size, fill, wght=600, tracking=0.0, anchor="start"):
    f = _font(wght)
    gs, cmap, hmtx, upm = f.getGlyphSet(), f.getBestCmap(), f["hmtx"], f["head"].unitsPerEm
    k = size / upm
    names = [cmap[ord(ch)] for ch in s]
    width = sum(hmtx[n][0] for n in names) * k + tracking * size * (len(names) - 1)
    if anchor == "middle":
        x -= width / 2
    pen = SVGPathPen(gs, ntos=lambda v: ("%.2f" % v).rstrip("0").rstrip("."))
    for n in names:
        gs[n].draw(TransformPen(pen, (k, 0, 0, -k, x, baseline)))
        x += hmtx[n][0] * k + tracking * size
    return f'<path fill="{fill}" d="{pen.getCommands()}"/>', width


CAP = 0.714  # Noto Sans cap height, in ems


def svg(w, h, body, label, bg=None):
    ground = f'<rect width="{w:g}" height="{h:g}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" width="{w:g}" height="{h:g}" '
            f'role="img" aria-label="{label}"><title>{label}</title>{ground}{body}</svg>\n')


def write(name, content):
    path = os.path.join(BRAND, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        fh.write(content)


NAME = "Wafflehaüs Organized Workspaces"

VARIANTS = {
    # name: (text colour, use the full-colour mark?)
    "light": (INK, True),
    "dark": (SNOW, True),
    "mono-black": ("#000000", False),
    "mono-white": ("#FFFFFF", False),
}


def lockup(variant, words, size, wght, tracking):
    ink, full = VARIANTS[variant]
    H = 96
    if full:
        sym, sym_w = mark(0, 0, H), H
    else:
        sym_w = H * TW / TH
        sym = lattice(0, 0, H, ink)
    gap = H * 0.28
    t, tw = text(words, sym_w + gap, H / 2 + size * CAP / 2, size, ink, wght=wght, tracking=tracking)
    return svg(sym_w + gap + tw, H, sym + t, f"WOW, {NAME}" if words == NAME else "WOW")


def main():
    # Mark
    write("logo/wafflehaus-mark.svg", svg(1000, 1000, mark(0, 0, 1000), "Wafflehaüs"))
    write("logo/wafflehaus-tower.svg", svg(TW, TH, tower(0, 0, TH), "Wafflehaüs"))
    for v, c in {"black": "#000000", "white": "#FFFFFF", "current": "currentColor"}.items():
        write(f"logo/wafflehaus-tower-mono-{v}.svg", svg(TW, TH, lattice(0, 0, TH, c), "Wafflehaüs"))

    # Wordmarks
    for v, (ink, _) in VARIANTS.items():
        t, tw = text("WOW", 0, 100 * CAP, 100, ink, wght=800, tracking=-0.01)
        write(f"logo/wow-wordmark-{v}.svg", svg(tw, 100 * CAP, t, "WOW"))
        write(f"logo/wow-lockup-{v}.svg", lockup(v, "WOW", 64, 800, -0.01))
        write(f"logo/wow-lockup-full-{v}.svg", lockup(v, NAME, 34, 600, 0))

    # Icons. The mark is already a full-bleed square: platforms round it themselves.
    write("icons/favicon.svg", svg(1000, 1000, mark(0, 0, 1000), "WOW"))
    # Maskable: the tower kept inside the central 80% circle.
    th = 512 * 0.62
    tw = th * TW / TH
    write("icons/src/maskable-512.svg", svg(512, 512, tower((512 - tw) / 2, (512 - th) / 2, th), "WOW", bg=MAROON))

    write("social/og-image.svg", og())


def og():
    W, H = 1200, 630
    b = ""
    # The tower, large, standing on the bottom edge at the right.
    th = 640
    b += tower(1200 - th * TW / TH + 50, H - th + 50, th)
    b += mark(80, 72, 56)
    t, _ = text("WOW", 80 + 56 + 18, 72 + 28 + 30 * CAP / 2, 30, CREAM, wght=800)
    b += t
    l1, _ = text("Solve the hunt,", 76, 318, 84, CREAM, wght=800, tracking=-0.025)
    l2, _ = text("not the logistics.", 76, 412, 84, SYRUP, wght=800, tracking=-0.025)
    sub, _ = text("The live workspace for puzzle hunt teams", 80, 486, 28, "#F0C9B8", wght=500)
    url, _ = text("www.wafflehaus.io", 80, 552, 24, "#E3A98F", wght=600, tracking=0.02)
    return svg(W, H, b + l1 + l2 + sub + url, "WOW: Solve the hunt, not the logistics.", bg=MAROON)


if __name__ == "__main__":
    main()
