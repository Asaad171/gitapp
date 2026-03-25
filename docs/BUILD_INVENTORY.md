# BUILD INVENTORY

## 1) Audit Metadata
- **Date:** 2026-03-09
- **Repo root:** `C:\Users\asaad\OneDrive\Desktop\Vios\LCC-Web-0.5.5`
- **Primary truth file:** `examples/three.html`
- **Scope note:** Inventory/classification only. No cleanup or feature proposals in this document.

## 2) Classification Rubric
- **Shipped now:** Referenced by the active runtime path from `examples/three.html` (imports, fetch/data paths, DOM/UI flow), or required to run current local experience/tooling.
- **Prototype-only:** Experimental/alternative samples or diagnostics not required by the primary viewer path.
- **Roadmap:** Clearly missing capabilities relative to current repo state, grouped by required phases.

## 3) Shipped Now
| Item | Path | Role | Evidence | Confidence |
|---|---|---|---|---|
| Primary VIOS viewer shell | `examples/three.html` | Active runtime UI and behavior | DOM/runtime anchors: `#loadingOverlay` (line 827), `#settingsDrawer` (line 880), `#viewsPanel` (line 929), `#editorPanel` (line 930); core functions: `fitCameraToBounds` (1528), `setMode` (2457) | High |
| Tour-based config loading | `examples/three.html` + `tours/penthouse-001/tour.json` | Loads tour config and applies runtime params | `const tourId` (1004), `fetch(configUrl)` (1163), `editEnabled` (1204), `debugEnabled` (1205); config fields in `tour.json`: `tourId`, `modelEntryUrl`, `defaultPresetId`, `cameraPresets`, `hotspots` | High |
| Hotspots + presets authoring | `examples/three.html` | In-browser editing and state mutations | `cameraPresets` state (1221), `hotspotConfigs` state (1237), `createHotspotFromPoint` (2382), `saveCurrentViewPreset` (2401), editor list renderers (2117, 2260) | High |
| Undo/Redo editor history | `examples/three.html` | Snapshot history for editor safety | `HISTORY_LIMIT` (1266), `editorHistory` (1267), `pushEditorHistory` (1703), `undoEditor` (1727), `redoEditor` (1738), buttons `#undoBtn`/`#redoBtn` (934/935) | High |
| Export flow (JSON copy/download) | `examples/three.html` | Produces edited tour config | `buildExportConfig` (2032), `#copyConfigBtn` (975), `#downloadConfigBtn` (976), `markEditorSavedState` use in copy/download (2073, 2092) | High |
| Local analytics hooks (client-side buffer) | `examples/three.html` | Captures interaction events in browser memory | `emitEvent(...)` calls (e.g., 1999, 2108, 2329), `window.__viosEvents` push (1212-1213) | High |
| LCC SDK runtime integration | `examples/three.html` + `sdk/lcc-0.5.5.js` | Scene loading and rendering integration | `import { LCCRender } ...` (996), `LCCRender.load(...)` with `dataPath: MODEL_ENTRY_ABS_URL` (2803), `appKey: null` (2811), SDK file present (`sdk/lcc-0.5.5.js`) | High |
| Current sample tour assets | `assets/PentHouse/*` | Runtime scene payload | `tour.json` points to `/assets/PentHouse/meta.lcc`; folder contains `meta.lcc`, `index.bin`, `data.bin`, `environment.bin`, `shcoef.bin`, `thumb.jpg` | High |
| Local serving tool (COI) | `server_coi.py` | Static server with COOP/COEP/CORP headers and range support | Headers set (`Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`, `Cross-Origin-Resource-Policy`) lines 19-21; `ThreadingHTTPServer` line 129 | High |
| Local QA smoke script | `smoke-playwright.mjs` | Automated browser smoke checks for viewer URL | `TARGET_URL` points to `examples/three.html` (line 5), captures console/page errors and failed requests (lines 17, 28, 166) | High |
| Optional range static server | `range-server.mjs` | Alternative local server with byte-range behavior | HTTP server + range handling (`Content-Range`, `Accept-Ranges`, no-cache) lines 37, 76-78, 87 | Medium |

## 4) Prototype-only
| Item | Path | Reason not considered shipped | Evidence | Confidence |
|---|---|---|---|---|
| Cesium sample page | `examples/cesium.html` | Alternate SDK demo, not the primary VIOS viewer path | Separate entrypoint and setup (`Cesium.Viewer`, `LCCRender.load`) lines 36, 71; no linkage from `three.html` runtime path | High |
| Archived engine bundle | `examples/engine.zip` | Packaged artifact, not used by runtime imports | `three.html` import map points to `examples/engine/...`, not `engine.zip` | High |
| README screenshots | `doc/examples_1.jpg`, `doc/examples_2.jpg` | Documentation illustration only | Referenced by README “Run examples” section, not runtime imports | High |

## 5) Roadmap (Clearly Missing in Current Repo State)

### Authoring
- **No in-app remote persistence path for edits**  
  Evidence: editing state exports via `buildExportConfig` + copy/download only (`copyCurrentConfigJson`, `downloadCurrentConfigJson`), no save API call for editor commits.  
  Confidence: High.

### Trust
- **Primary viewer runs without configured app identity key**  
  Evidence: `appKey: null` in `LCCRender.load(...)` (`examples/three.html`, line 2811).  
  Confidence: High.

### Buyer UX
- **No dedicated buyer portal/routes in this repo beyond sample entry pages**  
  Evidence: top-level runtime pages under `examples/` are `three.html` and `cesium.html`; no additional app routing structure found.  
  Confidence: Medium.

### Analytics
- **No server-side analytics transport in primary flow**  
  Evidence: events stored in `window.__viosEvents` via `emitEvent`; no POST/beacon sink found in `three.html`.  
  Confidence: High.

### Ops
- **No CI/CD config present in repo root snapshot**  
  Evidence: root directories include `.vscode`, `assets`, `doc`, `examples`, `sdk`, `tours`; no `.github`/pipeline manifests found in inspected tree.  
  Confidence: Medium.

### Post-scan structuring
- **No post-scan structuring pipeline scripts in this repo snapshot**  
  Evidence: runtime consumes prebuilt `meta.lcc` + `.bin` assets; no conversion/structuring scripts found in inspected scope.  
  Confidence: Medium.

### AI
- **No AI-specific runtime/service integration found in primary implementation**  
  Evidence: no AI model/service integration references in inspected runtime/tooling files; viewer logic remains deterministic scene UX + editor operations.  
  Confidence: Medium.

## 6) Dependency Graph Summary (Primary Runtime Path)
- Browser opens `examples/three.html`
- `three.html` imports Three.js addons (`examples/engine/...`) and `sdk/lcc-0.5.5.js`
- `three.html` resolves `?tour=` and fetches `/tours/<tourId>/tour.json`
- `tour.json` provides `modelEntryUrl` (current sample: `/assets/PentHouse/meta.lcc`)
- `LCCRender.load(...)` consumes `MODEL_ENTRY_ABS_URL` and fetches scene payload (`meta.lcc` + dependent `.bin` files)
- Viewer/editor UI runs in-page (`#viewsPanel`, `#settingsDrawer`, `#editorPanel`) with in-memory state
- Export path outputs JSON via copy/download (no backend persistence path in current flow)

## 7) Open Questions / Uncertain Items
- Whether `examples/cesium.html` should be treated as “official shipped sample” vs “prototype-only for VIOS product surface” depends on product boundary definition.
- Whether `range-server.mjs` is still actively used in team workflow vs retained fallback script requires maintainer confirmation.
- CI/CD and deployment automation may exist outside this repository; current classification is limited to repo-local evidence.

## Excluded from this Inventory by Rule
- `node_modules/`
- server logs (`.server*.log`)
- screenshots/temp artifacts (e.g., `smoke-shot.png`)
