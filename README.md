<p align="center">
  <img src="build/icon.svg" width="96" height="96" alt="Dice Chaos Connections D20 Graph Emblem" />
</p>

<h1 align="center">Dice Chaos Connections</h1>

<p align="center">
  <strong>Offline TTRPG Campaign Mind-Map, Conspiracy Board &amp; Zero-Spoiler 2nd-Screen Player Display</strong>
</p>

<p align="center">
  <a href="https://github.com/dicechaos/DiceChaosConnections/releases"><img src="https://img.shields.io/badge/status-Public%20Beta-f59e0b?style=flat-square" alt="Public Beta" /></a>
  <a href="https://github.com/dicechaos/DiceChaosConnections/releases"><img src="https://img.shields.io/github/v/release/dicechaos/DiceChaosConnections?include_prereleases&style=flat-square&label=download" alt="Latest Release" /></a>
  <a href="https://dicechaos.com"><img src="https://img.shields.io/badge/website-dicechaos.com-4f46e5?style=flat-square" alt="dicechaos.com" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/dicechaos/DiceChaosConnections?style=flat-square" alt="MIT License" /></a>
</p>

---

**Dice Chaos Connections** is a local-first desktop studio built for Dungeon Masters, Game Masters, worldbuilders, and tabletop groups. Map out NPCs, factions, locations, clues, secret plots, and edge-to-edge relationships on an infinite canvas—then project a **strictly sanitized, zero-spoiler view** onto a TV, second monitor, or VTT screen-share in real time.

> **Public Beta Notice:** Dice Chaos Connections is currently in active **Public Beta**. Your campaigns are stored 100% locally as human-readable `.json` files (with crash-safe atomic saves and toggleable Auto-Save). Found a bug or have a feature request? [Open an issue on GitHub](https://github.com/dicechaos/DiceChaosConnections/issues) or visit **[dicechaos.com](https://dicechaos.com)**.

---

## Download & Install (Public Beta)

1. Grab the latest installer (`dice-chaos-connections-1.0.0-beta.1-setup.exe` or portable `.zip`) from **[GitHub Releases](https://github.com/dicechaos/DiceChaosConnections/releases)**.
2. Launch the app—it opens out of the box with an interactive 36-node ***The Hobbit: Eve of Five Armies*** showcase campaign and an opt-in **5-Step Feature Tour** (`Tour` button in the top bar).

> **Windows SmartScreen Note:** Because Public Beta builds are not yet signed with a commercial EV certificate, Windows may display *"Windows protected your PC"* on first launch. Click **More info** -> **Run anyway** to install.

---

## Key Features

### Tactile Mind-Map & Conspiracy Canvas
- **1-Step Creation:** Double-click empty canvas to spawn an entity, or drag any connection handle into empty space to create and link a new card in one motion.
- **Manual Card Resizing & Presets:** Drag corners/edges (`140×52 px` to `640×520 px`), enter exact `W × H` dimensions, or batch-match widths/sizes across selected cards.
- **Layer Stacking (`[` / `]`):** Step overlapping cards *Forward*, *Backward*, *To Front* (`Ctrl+]`), or *To Back* (`Ctrl+[`) across a strict 5-band z-index pipeline so connection lines never sink behind group backgrounds.
- **7 Shapes, Custom Colors & 40 Status Icons:** Customize shapes (*Rounded*, *Box*, *Sticky*, *Pill*, *Leaf*, *Arch*, *Oval*), background colors with automatic WCAG light/dark text contrast, and 40 TTRPG status markers (`Skull`, `Crown`, `Flame`, `Swords`, `Lock`, etc.).
- **Edge-to-Edge ("Conspiracy") Links:** Connect entities *directly to another relationship pill* (e.g., linking an informant to a secret alliance line), with directional/bidirectional arrowheads (`→`, `←`, `↔`), draggable spline waypoints, and movable labels.

### Connectable Group Regions & Factions
- **True Connectable Containers (`Ctrl+G`):** Group cities, factions, dungeon wards, or army hosts with their own 8 perimeter connection ports, synchronized member + waypoint dragging, and position locking.
- **Rich Region Styling:** 7 tabletop region tints + custom hex colors & opacity (`8%–50%`), crest badges or top banners, status markers, and 1-click **Tidy Grid** / **Fit Bounds** / **Select All**.

### TTRPG Sheets, Portraits & `[[Wiki-Links]]`
- **Built-In + Custom Categories:** Ships with *PC*, *NPC*, *Location*, *Item*, *Organization*, and *Event*, plus unlimited custom categories mapped to 5 structured sheet archetypes (Party Standing, Ancestry, Class/Role, AC/HP, Voice Cue, Rarity, Attunement, Danger Tier, Quest Status, etc.).
- **3-Tier Notes:** Separate **Public Lore**, **DM Secret Notes** (never exposed to players), and collaborative **Party Notes**.
- **Self-Contained WebP Portraits:** Embedded directly inside your `.json` file (*Circular Token*, *Full-Bleed Card Banner*, or *Handout Only*) so campaigns stay single-file portable with zero broken image paths.
- **Obsidian-Style `[[Wiki-Links]]` & Backlinks:** Type `[[` in any note for live autocomplete supporting `[[Aliases]]` and `[[Target|Display Text]]`, automatic rename refactoring across the entire graph, and an automatic **Mentioned-In Backlinks** panel.

### Zero-Spoiler 2nd-Screen Player Window & Home Conspiracy Edition
- **Pop-Out Player Screen:** Dedicated secondary window for table TVs, projectors, or Discord/OBS screen-sharing. Hidden items and DM secrets are stripped *before* leaving the GM state.
- **Live Table Controls:** Pause/resume live sync while making secret edits, sync the players' camera to your view, pop up cinematic **Spotlight Cards**, or tease **`???` Mystery Portraits** with 1-click *Reveal True Identity*.
- **Two-Way Party Conspiracy Workflow:** Export a **Spoiler-Free Player Handout `.json`** for players to explore at home, add **Party Notes**, and pin **`Theory` Cards/Links**—then non-destructively **Merge Party Notes** back into your master DM file.

### Campaign Timeline ("Session Time Machine")
- **Session Checkpoints & Visual Diffs:** Save snapshots after each session, preview past sessions safely in read-only mode, compare any two checkpoints with `+ New`, `~ Changed` (field-by-field before/after diffs), and `Removed` highlights, or restore a checkpoint to live.

### Dossier Exports, Obsidian Vaults & High-DPI Posters
- Export in either **Player-Safe** or **Full DM** scope:
  - **Obsidian Vault Folder:** Markdown notes sorted by category with YAML frontmatter, native `[[Wiki-Links]]`, and extracted `assets/` art ready for Obsidian's Graph View.
  - **Markdown Compendium (`.md`)** & **Print-Styled Lorebook (`.pdf`)**.
  - **High-DPI Map Poster (`.png`):** Auto-fitted full map or current screen at `1×`–`3×` resolution with optional theme-matched Title & Legend stamps.

### 4 Tabletop Themes & Local-First Reliability
- Switch canvas themes per campaign (**Modern Studio**, **Dark Arcane**, **Parchment & Ink**, **Detective Corkboard**) alongside Light/Dark UI chrome.
- **Smart Toggleable Auto-Save:** Crash-safe atomic file writes, toggleable **Auto-Save** switch in the header & `Ctrl+K`, instant `Ctrl+S` (`Save`), and `Ctrl+Shift+S` (`Save As…`).

---

## Quick Shortcuts

| Shortcut / Gesture | Action |
| :--- | :--- |
| **Double-Click Empty Canvas** | Create new entity at cursor |
| **Drag Handle to Empty Space** | Quick-create & auto-connect new entity |
| **Drag Card Corner / Edge** | Resize selected unlocked entity card (`W × H`) |
| **`Ctrl+G` / `Ctrl+Shift+G`** | Group selected entities / Ungroup (keeping entities) |
| **`[` / `]` · `Ctrl+[` / `Ctrl+]`** | Step Backward / Forward · Send to Back / Bring to Front |
| **`[[` inside Lore / Notes** | Autocomplete clickable `[[Entity]]` or `[[Entity\|Text]]` wiki-link |
| **`Ctrl+K` / `Ctrl+F`** | Open unified Search, `#Tags` & Command Palette |
| **`Alt+1` … `Alt+9`** | Fly camera to saved View Bookmark `1`–`9` |
| **`M`** | Toggle corner MiniMap radar |
| **`Ctrl+S` / `Ctrl+Shift+S`** | Save active `.json` / Save Campaign As new `.json` |
| **`Ctrl+Z` / `Ctrl+Y`** | Undo / Redo (50 steps) |
| **`Ctrl+C` / `Ctrl+V` / `Ctrl+D`** | Copy, Paste, or Duplicate selection with internal links |
| **`?`** | Open Studio Shortcuts, Tour & Starter Demo loader |

---

## Development & Building From Source

Requires **Node.js 20+** and **npm**.

```bash
# Install dependencies
npm install

# Start hot-reloading Electron + Vite dev studio
npm run dev

# Run TypeScript checks & production bundle
npm run build

# Package OS installers (outputs to dist/)
npm run build:win     # Windows (.exe NSIS installer)
npm run build:mac     # macOS (.dmg)
npm run build:linux   # Linux (.AppImage, .deb, .snap)
```

---

## Links & Feedback

- **Website:** [dicechaos.com](https://dicechaos.com)
- **Bug Reports & Feature Requests:** [GitHub Issues](https://github.com/dicechaos/DiceChaosConnections/issues)
- **License:** MIT License — Copyright © 2026 dicechaos (Gus). See [LICENSE](./LICENSE).
