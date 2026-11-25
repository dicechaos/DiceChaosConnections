## Dice Chaos Connections — `v1.0.1` Studio UI Polish & 4-App Suite Update

Welcome to **`v1.0.1`** of **Dice Chaos Connections** by **[Dice Chaos](https://dicechaos.com)**!

**Dice Chaos Connections** is an offline-first TTRPG campaign mind-map, detective conspiracy board, and spoiler-safe **2nd-Screen Live Player Display** built for Dungeon Masters, Game Masters, worldbuilders, and tabletop groups rolling real **[Dice Chaos](https://dicechaos.com)** polyhedral dice around the table.

> **Part of the Dice Chaos Tabletop Suite:** Pair **Dice Chaos Connections** with **[Dice Chaos Display](https://github.com/dicechaos/DiceChaosDisplay)** (offline 4K/8K battlemap studio, looping video scene player, feathered Fog of War & true 1-inch physical miniature TV calibrator), **[Dice Chaos Maps](https://github.com/dicechaos/DiceChaosMaps)** (free offline TTRPG battlemap & World Atlas cartography studio with multi-story raycast lighting, 3,857 bundled CC0 assets & true 1-inch TV export), and **[Dice Chaos Masters](https://github.com/dicechaos/DiceChaosMasters)** (free offline parametric 3D polyhedral dice master, matched insert blank & MSLA resin support CAD studio)!

---

### Downloads
- **Windows (x64):**
  - **[dice-chaos-connections-1.0.1-setup.exe](https://github.com/dicechaos/DiceChaosConnections/releases/download/v1.0.1/dice-chaos-connections-1.0.1-setup.exe)** *(One-click installer — Recommended)*
  - **[dice-chaos-connections-1.0.1-win-x64-portable.zip](https://github.com/dicechaos/DiceChaosConnections/releases/download/v1.0.1/dice-chaos-connections-1.0.1-win-x64-portable.zip)** *(Self-contained portable `.zip` — extract anywhere and run `DiceChaosConnections.exe`)*
- **macOS:**
  - **[dice-chaos-connections-1.0.1.dmg](https://github.com/dicechaos/DiceChaosConnections/releases/download/v1.0.1/dice-chaos-connections-1.0.1.dmg)** *(Disk image installer)*
- **Linux (x64):**
  - **[dice-chaos-connections-1.0.1.AppImage](https://github.com/dicechaos/DiceChaosConnections/releases/download/v1.0.1/dice-chaos-connections-1.0.1.AppImage)** *(Portable AppImage)* or **[dice-chaos-connections_1.0.1_amd64.deb](https://github.com/dicechaos/DiceChaosConnections/releases/download/v1.0.1/dice-chaos-connections_1.0.1_amd64.deb)**
- **Integrity Verification:** **[SHA256SUMS.txt](https://github.com/dicechaos/DiceChaosConnections/releases/download/v1.0.1/SHA256SUMS.txt)**

> **OS Gatekeeper / SmartScreen Note:** Because builds are not yet signed with commercial code-signing certificates:
> - **Windows:** If *"Windows protected your PC"* appears on first launch, click **More info** -> **Run anyway**.
> - **macOS:** Right-click (or Control-click) the app -> **Open** on first launch.

---

### What's New in `v1.0.1`
- **Docked 3-Row Studio Shell & Single-Row Top Bar:** Replaced the floating top header with a full-width docked `44px` Studio toolbar featuring a **`File ▾`** popover menu (`New`, `Open`, `Save`, `Save As…`, `Share & Export`, `Load Hobbit Starter Map`), 1-click **Save** with dirty-state dot, crisp **Auto-Save** switch, segmented **`DM | Player`** perspective toggle, and zero wrapping down to `1280×720`—with matching shell parity in the **2nd-Screen Player Window**.
- **Midnight-Sapphire Dark & Daylight Light Suite Chrome:** Unified chrome surfaces, borders, scrollbars, `:focus-visible` keyboard focus rings, tactile button press feedback, and smooth `@starting-style` modal/popover transitions across the entire **Dice Chaos Tabletop Suite**.
- **Non-Colliding Docked Session Timeline Tray & Canvas Framing:** Moved the expanded **Session Timeline** into a full-width docked tray between the canvas and footer (eliminating overlap with Zoom Controls and clipping of `Current · Live Map`), fixed startup over-zoom framing, compacted the **Legend** so all filters fit `1280×720` without scrolling, and upgraded **Focus Web** with 1-click **`1 | 2 | 3 | All`** hop pills.
- **Docked Inspectors & 3-Tab Edge Inspector:** Converted Entity, Group, Multi-Select, and Player Inspectors into docked right-hand rails that never overlap the header or footer; upgraded **Edit Connection** into 3 focused tabs (**`Style`** | **`Routing`** | **`Notes`**) with a pinned bottom `Hidden` + `Delete` bar and automatic scroll-to-top on tab/selection switch.
- **Unclipped Connection Points & Improved TTRPG Sheet Inputs:** Fixed expanded Connection Point editor clipping & horizontal overflow inside the `Links` tab (with collapsible `Connection Points` so backlinks surface immediately), stacked `Ancestry / Species` and `Class / Role` full-width, and upgraded `DM Voice / Roleplay Cue` to an auto-sizing multi-line `<textarea>`.
- **Polished Command Palette (`Ctrl+K`) & Scrollability Cues:** Replaced bulky native scrollbars on the `#Tags:` bar, Views strip, and Timeline cards with smooth scroll-driven edge fades, added vertical scroll shadows to panels/modals, and grouped Command Palette results under clean section headers.
- **4-App Dice Chaos Tabletop Suite Links:** Added **[Dice Chaos Maps](https://github.com/dicechaos/DiceChaosMaps)** across project docs, release notes, and the in-app `?` Help modal alongside *Dice Chaos Display*, *Dice Chaos Masters*, and `dicechaos.com`.

---

### Core Feature Highlights
- **Tactile Infinite Conspiracy & Campaign Canvas:** 1-step node & relationship creation, unified editable & customizable perimeter connection points, 360° freeform endpoint dragging, configurable drag grid snap (`Free`–`48px`), manual card resizing (`W × H`), overlap-smart layer stacking, 7 card shapes, custom WCAG-contrasted background colors, 40 status markers, and edge-to-edge ("meta") connections.
- **Connectable Group Regions & Factions (`Ctrl+G`):** Wrap wards, factions, or army hosts with editable perimeter connection points, synchronized member dragging, position locking, custom region tints, crest/banner art, and 1-click **Tidy Grid**.
- **Rich TTRPG Sheets & `[[Wiki-Links]]`:** Built-in + custom categories with structured sheet fields, embedded single-file WebP portraits, separate **Public Lore / DM Secrets / Party Notes**, `[[Aliases]]` & `[[Target|Display]]` autocomplete, automatic rename refactoring, and backlinks.
- **Zero-Spoiler 2nd-Screen Player Window & Home Conspiracy Edition:** Project a sanitized live view to a TV, second monitor, or VTT screen-share with **Spotlight** & **`???` Mystery Portrait** reveals—or export a spoiler-free `.json` handout for players to add **Party Notes & Theory Pins** and merge them non-destructively back into your master map.
- **Session Time Machine & Compendium Exports:** Save session checkpoints with field-level before/after diffs, and export **Obsidian Vaults**, **Markdown (`.md`)**, **PDF Lorebooks (`.pdf`)**, and **High-DPI Map Posters (`1×`–`3×` `.png`)** ready for printing or loading straight into **[Dice Chaos Display](https://github.com/dicechaos/DiceChaosDisplay)**.

---

### Feedback, Companion Tools & Handmade Dice
Running **Dice Chaos Connections** with your campaign group? Let us know how it goes!
- **Report bugs / request features:** [GitHub Issues](https://github.com/dicechaos/DiceChaosConnections/issues)
- **Companion 4K/8K TV battlemap studio:** [Dice Chaos Display](https://github.com/dicechaos/DiceChaosDisplay)
- **Companion battlemap & World Atlas studio:** [Dice Chaos Maps](https://github.com/dicechaos/DiceChaosMaps)
- **Companion 3D dice master CAD studio:** [Dice Chaos Masters](https://github.com/dicechaos/DiceChaosMasters)
- **Handcrafted dice & tabletop tools:** [dicechaos.com](https://dicechaos.com)
