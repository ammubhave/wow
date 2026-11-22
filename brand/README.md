# WOW brand

WOW (Wafflehaüs Organized Workspaces) is the live workspace for puzzle hunt teams, made by Team
Wafflehaüs. This folder codifies the identity WOW already has: the waffle tower on maroon, the
orange accent, Noto Sans, square corners and the decrypting text. The full guidelines, with
everything shown on light and dark, are published as a page:
<https://claude.ai/artifact/L4nGLkDakyedAQA7UWUak5> (private until it's shared).

## Files

| Path                                                       | What it is                                                                                    |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `logo/wafflehaus-mark.svg`                                 | The mark: the waffle tower on its maroon square. A vector trace of `public/wafflehaus.png`.   |
| `logo/wafflehaus-tower.svg`                                | The tower alone, full colour, for dark or maroon grounds.                                     |
| `logo/wafflehaus-tower-mono-{black,white,current}.svg`     | One colour: the waffle's ridges, wells open. `current` uses `currentColor`.                   |
| `logo/wow-wordmark-{light,dark,mono-black,mono-white}.svg` | "WOW" in Noto Sans ExtraBold.                                                                 |
| `logo/wow-lockup-{light,dark,mono-*}.svg`                  | Mark + WOW. The default logo.                                                                 |
| `logo/wow-lockup-full-{light,dark,mono-*}.svg`             | Mark + "Wafflehaüs Organized Workspaces", as in the site header.                              |
| `icons/favicon.ico` (16/32/48), `favicon-{16,32,48}.png`   | Favicons.                                                                                     |
| `icons/favicon.svg`                                        | The mark as an SVG favicon. It's 128 KB (the trace is detailed), so ship `favicon.ico` first. |
| `icons/apple-touch-icon.png`, `icon-{192,512}.png`         | Full-bleed squares; platforms round them.                                                     |
| `icons/icon-maskable-512.png`                              | The tower inside the maskable safe zone.                                                      |
| `icons/site.webmanifest`                                   | A manifest that uses them.                                                                    |
| `social/og-image.{png,svg}`                                | Open Graph / Twitter card, 1200 × 630.                                                        |
| `tokens.css`                                               | Colour, font and radius tokens.                                                               |
| `tools/`                                                   | The trace sources and the scripts that build everything above.                                |

All text in the SVGs is outlined, so they render the same everywhere.

### Rebuilding

```bash
python brand/tools/generate.py
NODE_PATH=node_modules/.pnpm/sharp@0.35.5_@types+node@26.6.6/node_modules node brand/tools/render.mjs
magick brand/icons/favicon-{16,32,48}.png brand/icons/favicon.ico
```

`generate.py` needs `pip install fonttools brotli`, and reads Noto Sans from `node_modules`.

## Logo

- **The mark** is the Wafflehaüs: a waffle standing up as a building, on a maroon square. Use it
  as is; never redraw, recolour or crop into the tower.
- **The lockup** puts the mark beside "WOW" (Noto Sans 800) or the full name (Noto Sans 600), with a
  gap of 0.28 × the mark's height, and the text centred on the mark.
- **Light / dark**: the mark doesn't change. Only the type does: `#18181B` on light, `#FCFCFC` on dark.
- **One colour**: use the ridge lattice and type in a single ink, for print, embossing, stamps or
  photos.
- **Minimum size**: mark 16 px (favicon) and 24 px in UI; full-name lockup 240 px wide (below that the name is under 11 px; use the WOW lockup); one-colour
  lattice 32 px tall, where its thinnest ridges are still visible.
- **Clear space**: one quarter of the mark's height on every side, free of text and edges.

Don't:

- Crop the mark to a circle (it clips the tower's foot; the site header does this today).
- Recolour the ground or the waffle, or put the mark on a busy photo.
- Stretch, rotate, outline or add shadows.
- Use the full-colour tower without its square on a light background: the Batter ridges disappear
  (1.45:1 on white). Use the mark, or the one-colour lattice.
- Set the name in another typeface, or drop the umlaut.

## Colour

The mark's own four colours, plus the orange the app runs on.

| Name   | Hex       | Use                                                          | Contrast                                          |
| ------ | --------- | ------------------------------------------------------------ | ------------------------------------------------- |
| Maroon | `#7E0F0F` | The mark's ground, brand surfaces (social, email headers)    | White 10.7:1, cream 9.8:1                         |
| Batter | `#F2D55E` | Ridges; highlights on maroon or dark                         | 7.4:1 on maroon, 12.2:1 on `#18181B`              |
| Golden | `#D99630` | Wells                                                        | 4.3:1 on maroon: large text only                  |
| Crisp  | `#D5763C` | Well shading                                                 | Decorative only                                   |
| Syrup  | `#F49F1E` | Highlight orange: PixelBlast, the social headline            | 5.0:1 on maroon; 2.1:1 on white, never text there |
| Accent | `#DC7701` | The app accent: buttons, links, progress, decrypting letters | 6.5:1 on the dark background; 3.1:1 on white      |
| Crust  | `#A35200` | Orange text on white                                         | 5.6:1                                             |
| Cream  | `#FFF4DC` | Text on maroon                                               | 9.8:1                                             |

App neutrals (unchanged, `src/styles.css`): light background `#F5F5F5`, text `#18181B`, muted
`#727272` (4.4:1, just under AA for small text), border `#DEDEDE`; dark background `#060606`,
surface `#181818`, text `#FCFCFC`, muted `#A0A0A0` (7.8:1), border `#292929`.

Board statuses (row fills; text stays the normal foreground, 14:1 or better in both themes):

| Group      | Statuses                                                              | Light     | Dark      |
| ---------- | --------------------------------------------------------------------- | --------- | --------- |
| Solved     | Solved, Backsolved                                                    | `#DCFCE7` | `#032E15` |
| Warning    | Needs Eyes, Extraction                                                | `#FEF9C2` | `#432004` |
| Stuck      | Stuck, Pending, Very Stuck                                            | `#FFE2E2` | `#460809` |
| Importance | Important = accent soft, Normal = default fill, Obsolete = muted text |           |           |

Status colours carry meaning: keep them apart from the brand oranges and always show the label too.

Contrast note for the app: white text on the accent button is 3.1:1, which passes only for large
text. Dark text (`#18181B`) on the accent is 5.6:1.

## Type

- **Noto Sans** for everything: 400 body, 600 for names and labels, 700 to 800 for headlines,
  tight tracking (−2.5%, Tailwind's `tracking-tight`) at display sizes.
- **Monospace** (the app's `font-mono`: SF Mono, Menlo, Consolas) for answers, guesses and
  formulas, bold and in capitals the way hunts print them: `WAFFLE IRON`.
- The site's `<head>` also loads **Cookie** and **Inconsolata** from Google Fonts, but nothing uses
  them. Either drop the link or adopt Inconsolata as `--font-mono`.

## Motifs

What makes something feel like WOW, beyond the logo:

1. **The waffle grid.** A waffle is a grid, and so is everything a hunt team stares at: the
   blackboard, the spreadsheet, crosswords. Use grids, cells and lattices as structure and texture:
   the progress grid, cell-like tiles, the lattice as a background crop.
2. **Decrypting text.** Headlines and the brand name scramble through random letters, in the
   accent colour, then resolve, like an answer coming out. It plays once, as the page loads, and only on
   brand moments (the header name, the landing headline).
3. **Letters as texture.** The landing hero's glitching field of letters, digits and symbols
   (`A–Z 0–9 ? ! # & * + = < > /`), tinted from the theme's accent and muted colours.
4. **The orange pixel field.** PixelBlast in `#F49F1E` behind the join and invitation pages: the
   moment someone arrives at the team.
5. **Square corners.** The UI's radius is 0: crisp cells, like a grid. Keep cards, buttons and
   images square; the mark is square too.
6. **Celebration.** Solves get confetti (`#F54900` and `#E7000B`), reactions burst, and "Live now"
   gets a shiny sweep. Save the fun for wins and arrivals.
7. **Waffle wordplay.** Wafflehaüs and its umlaut, Eggö the chat bot and its 🧇 Roll button, 🧇 as the house emoji,
   "Buy me a puzzle", award names like Meta Maestro.
8. **Maroon and gold.** The mark's pairing: use it for anything that stands for WOW outside the
   app (social cards, email headers, stickers, slides). Inside the app, the neutral greys and the
   orange accent carry it.

## Voice

WOW writes like a teammate who has run a lot of hunts: plain, quick and specific, with a little
play. People read it mid-hunt, tired and in a hurry, so every line says what happened and what to
do next.

- Say what happened, then what to do.
- Name things the way the UI does, in bold: **Working on this**, **Needs Eyes**, **I helped**.
- Use the hunt's own words: puzzle, round, meta, backsolve, extraction, call in an answer.
- Say plainly what WOW doesn't do: "WOW doesn't assign puzzles."
- Keep the play at the edges (Eggö, celebrations, award names); errors and settings stay straight.
- Sentence case. "WOW" is always capitals. "Wafflehaüs" keeps its umlaut in prose and is
  `wafflehaus` in URLs and addresses (www.wafflehaus.io, noreply@wafflehaus.io).

| Do (from WOW)                                                                 | Don't (also from WOW)                                       | Better                                                                 |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| "Passkey added. Next time, log in with one tap."                              | "Oops! Something went wrong."                               | "Couldn't post the announcement. Check your connection and try again." |
| "Crossword grid ready. Type # or . for a black square."                       | "Puzzle updated successfully"                               | "Puzzle updated"                                                       |
| "Couldn't queue that guess."                                                  | "No action taken -- please select a meta puzzle."           | "Pick a meta first."                                                   |
| "WOW doesn't assign puzzles. Instead, you can see who's on each puzzle live." | "Workspace ID is already taken. Please choose another one." | "That workspace ID is taken. Try another."                             |
| "That's the tour! Take it again any time from Help."                          | "Failed to delete puzzle: [error]"                          | "Couldn't delete the puzzle: [reason]."                                |
| "Solve the hunt, not the logistics."                                          | "Create TanStack App Sample" (the app's manifest name)      | "WOW · Wafflehaüs Organized Workspaces"                                |
