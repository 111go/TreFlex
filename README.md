# TreFlex

**A hierarchical knowledge map for Obsidian where every node is a real markdown file.**

TreFlex lets you build and navigate a visual topic map directly inside Obsidian. Nodes are not just labels — each one is backed by an actual `.md` file in your vault. Add structure visually, write in the notes, and keep everything in sync.

---

## Features

### 🌳 Node Graph
- **Hierarchical tree layout** — automatic Reingold-Tilford-style positioning with manual override
- **Content-driven node sizing** — nodes are exactly as wide as their name requires (80–210px)
- **Collapse / expand subtrees** — with a badge showing how many nodes are hidden
- **Drag to reposition** — manual positions persist across sessions
- **Pan and zoom** — scroll to zoom toward cursor, drag canvas to pan
- **Fit View** — automatically frames all nodes in the viewport
- **Reset Layout** — clears all manual positions and re-runs auto layout

### ✏️ Inline Editing
- **Type directly on the graph** — no modals or overlays
- Node input grows as you type, up to the maximum width
- Live character counter (amber at 40+, red at 60+) — informational only, no hard cap
- **Enter** to confirm, **Escape** to cancel (new nodes are removed on cancel)
- Validation errors appear as a small tooltip below the node — duplicate names and invalid characters are caught immediately

### 🔗 Edge Labels
- **Double-click any edge** to add or edit a relationship label (e.g. "subset of", "depends on", "leads to")
- Labels render as small pills centered on the bezier curve
- **Edge Labels toggle** in the toolbar — show or hide all labels instantly
- Labels automatically fade out below 0.6× zoom to keep the overview clean
- Default label visibility is configurable in Settings

### 🎨 Colour System
Two modes, switchable in Settings:

**Per level mode**
- Individual colour picker for Root, L1, L2, L3, L4, L5
- Add deeper levels with the **+ Add Level** button — pre-configure as many levels as needed
- Levels beyond the last configured one automatically inherit the last level's colour
- 7 built-in presets: Default, Calm, Sage, Colorblind-safe (Okabe-Ito), Sunset, Slate, Pastel

**Uniform mode**
- Single colour picker — all nodes share one colour
- Per-level pickers are hidden when this mode is active

### 🔍 Search
- Filter nodes by name — matching nodes are highlighted in gold, non-matching nodes dim
- Search bar in the toolbar (top) or sidebar (right)

### 🗺️ Minimap
- Fixed overlay in the corner of the canvas
- Shows all nodes as labelled colour rectangles
- Viewport rectangle shows your current position
- Click anywhere on the minimap to jump to that area
- Automatically repositions based on toolbar location (avoids overlap)

### 🔗 Vault Sync
- **Scan & Sync Edges** — reads `[[wikilinks]]` from all map notes and creates missing connections automatically. Only links to other `.md` files are processed — images, PDFs, attachments, and all other file types are ignored
- **Orphan Notes** — lists vault markdown files not yet on the map, with one-click import as root nodes
- **Auto-backlink** — when adding a child or sibling, optionally appends `[[childName]]` into the parent note

### 📤 Export
- Exports the full map as an indented `[[wikilink]]` outline to `TreFlex Export.md` and opens it in a new tab

### 🧰 Toolbar
- **Top** (default) — horizontal bar, icon + label always visible
- **Right** — vertical sidebar, 152px wide, icon + label rows
- **Minimize** — collapses to icon-only (44px). Hovering any button shows a floating pill with the full icon + label
- Toolbar position and minimized state both persist across sessions

---

## Installation

### Manual (current method)
1. Download the latest release zip
2. Unzip and copy the `TreFlex` folder to:
   ```
   YourVault/.obsidian/plugins/TreFlex/
   ```
3. In Obsidian: **Settings → Community Plugins → disable Safe Mode → enable TreFlex**
4. Click the **workflow icon** in the left ribbon, or use **Cmd/Ctrl+P → Open TreFlex**

### Via BRAT (beta testing)
1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat)
2. Add this repository URL via BRAT
3. Enable TreFlex in Community Plugins

---

## Usage

### Creating your first map
1. Click **Add Root** in the toolbar
2. Type a name inline directly on the graph — press **Enter** to confirm
3. A `.md` file is created automatically in your configured notes folder
4. Hover the node to reveal **+** buttons on each edge:
   - **Top +** → add a parent node
   - **Bottom +** → add a child node
   - **Left / Right +** → add a sibling node
5. Repeat to build your hierarchy

### Keyboard shortcuts while naming a node
| Key | Action |
|-----|--------|
| `Enter` | Confirm name and create note |
| `Escape` | Cancel (deletes node if newly created) |

### Node interactions
| Action | Result |
|--------|--------|
| Hover | Reveals + buttons and animates connected edges |
| Drag | Repositions node (saved automatically) |
| Double-click | Opens the linked note in a new tab |
| Right-click | Full context menu (add, rename, delete, collapse, reset position) |

### Edge interactions
| Action | Result |
|--------|--------|
| Double-click edge | Opens inline label editor |
| Enter in label editor | Saves the label |
| Escape in label editor | Cancels edit |
| Click away | Saves the label |

### Context menu options
- Add Child / Parent / Sibling Node
- Expand / Collapse Children
- Open Note
- Rename (inline, on the graph)
- Reset Position
- Delete Node
- Delete Node + Subtree

---

## Settings

Open via **Settings → Community Plugins → TreFlex**

| Setting | Description |
|---------|-------------|
| Toolbar position | `Top` (horizontal) or `Right` (vertical sidebar) |
| Show edge labels by default | Whether labels are visible on map open |
| Notes folder | Where new `.md` files are created. Leave blank for vault root |
| Auto-backlink | Appends `[[childName]]` to parent note on node creation |
| Colour mode | `Per level` or `Uniform` |
| Preset palette | Apply a built-in colour scheme to all levels |
| Per-level colour pickers | Individual colour for each depth level |
| Add Level | Pre-configure colour for levels deeper than L5 |

---

## Data Storage

TreFlex stores map data (nodes, edges, positions, collapse state) in Obsidian's plugin data file:
```
YourVault/.obsidian/plugins/TreFlex/data.json
```

Plugin settings (toolbar position, colours, folder config) are stored in the same file under a separate key and will not be overwritten if you import a map from another vault.

---

## Compatibility

| Platform | Status |
|----------|--------|
| Obsidian Desktop (Windows, macOS, Linux) | ✅ Full support |
| Obsidian Mobile (iOS, Android) | ⚠️ Loads but not optimised — hover, right-click, and drag interactions require a pointing device |

**Minimum Obsidian version:** 0.15.0

---

## Known Limitations

- Mobile interaction model is not yet designed for touch (hover-based UI, no long-press support)
- Very large maps (500+ nodes) may experience layout performance degradation
- Edge labels are not shown in the minimap (intentional — too small to be readable)

---

## Roadmap

This plugin is the foundation for a larger standalone application. Development happens in two phases.

### Phase 1 — Obsidian Plugin (current)

The plugin serves as a live prototype — building out the feature set, validating UX decisions, and refining the data model in a real daily workflow before committing to a full build.

**Planned plugin improvements:**
- [ ] Undo / redo
- [ ] Multi-select and bulk operations
- [ ] Node content preview on hover (first line of the linked note)
- [ ] Custom edge colours
- [ ] Touch / mobile interaction model (long-press for context menu, tap to select)
- [ ] Performance optimisation for large maps (incremental layout, off-screen culling)
- [ ] Multiple maps support within the plugin
- [ ] Node tagging and filtering by tag
- [ ] Export to image (PNG / SVG)

### Phase 2 — Standalone Application (end goal)

TreFlex is being built toward a **dedicated desktop and web application** — not tied to Obsidian or any specific note-taking tool. The standalone app will be a first-class knowledge mapping and thinking tool in its own right.

**Planned standalone features:**
- Full graph engine rewritten from scratch — purpose-built for performance at scale
- Real-time collaboration — multiple people editing the same map simultaneously
- Bi-directional sync with Obsidian, Notion, Logseq, and plain markdown vaults
- Rich node content — inline writing, embeds, and attachments directly on the node
- Multiple map views — tree, force-directed graph, radial, timeline
- AI-assisted mapping — suggest connections, auto-generate subtopics, summarise branches
- Mobile-first touch interaction model
- Offline-first with cloud sync

The Obsidian plugin and the standalone app share the same core data format — maps built today will be fully portable when the standalone app launches.

---

## License

MIT