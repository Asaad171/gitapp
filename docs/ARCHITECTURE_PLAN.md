# Architecture Plan - Safe Split of `examples/three.html`

## 1) Purpose / Scope
This document is a safe refactor blueprint, not an implementation.

Primary objective:
- Preserve current behavior while reducing responsibility concentration in `examples/three.html`.

Constraints:
- Keep `examples/three.html` as the composition root during and after migration.
- No React rewrite.
- No behavior changes across migration steps.

Grounding sources:
- `examples/three.html`
- `docs/BUILD_INVENTORY.md`
- `AGENTS.md`
- `docs/TOUR_CONTRACT_V1.md`
- `schema/tour.schema.json`

## 2) [NOW] Current Concentration of Responsibilities
`examples/three.html` currently contains all of these concerns:

### [NOW] Runtime / Engine
- LCC and Three bootstrap (`LCCRender.load`, animation loop)
- Camera fit/startup behavior (`fitCameraToBounds`, `applyStartupViewOnce`, `resetView`)
- Navigation modes (`setMode`, walk/orbit switching)
- Render/perf controls (quality, auto scaling, FPS updates)
- Scene hotspot operations (sprite setup, pick/raycast, drag world updates)

### [NOW] UI
- DOM binding for top bar, settings, help, onboarding, loading overlay, editor drawer
- Loading/error/onboarding presentation (`setLoadingVisual`, `setLoadingErrorState`, `openOnboarding`)
- Button and keyboard wiring

### [NOW] Schema / Config Parsing / Export
- `tour.json` loading/validation gate for required fields
- Defaults, normalization, URL override precedence (`rx/ry/rz/fov/start`)
- Export serializer (`buildExportConfig`)

### [NOW] Analytics
- Client event emission (`emitEvent`)
- In-memory event sink (`window.__viosEvents`)
- Debug-mode console event output

### [NOW] Editor Authoring State
- Hotspot/preset selection and editing
- Undo/redo history (`pushEditorHistory`, `undoEditor`, `redoEditor`)
- Dirty/saved status tracking

## 3) [TARGET] Proposed Folder Tree
This is the intended boundary shape, still ES-module based and composition-root friendly.

```text
LCC-Web-0.5.5/
  examples/
    three.html                        # [NOW+TARGET] composition root
    app/                              # [TARGET] extracted runtime modules
      engine/
        viewer-engine.js
        camera-startup.js
        hotspots-engine.js
      ui/
        ui-controller.js
        loading-ui.js
        onboarding-ui.js
        editor-ui.js
      schema/
        tour-config-runtime.js
      analytics/
        analytics-client.js
      state/
        viewer-store.js               # optional/minimal, introduced in PR3
  docs/
    BUILD_INVENTORY.md
    TOUR_CONTRACT_V1.md
    ARCHITECTURE_PLAN.md
  schema/
    tour.schema.json                  # [NOW] contract/schema artifact
```

Notes:
- `schema/tour.schema.json` remains contract-level schema.
- `examples/app/schema/tour-config-runtime.js` is runtime parsing/default/precedence logic.

## 4) [NOW] -> [TARGET] Mapping
| [NOW] in `examples/three.html` | [TARGET] boundary | Notes |
|---|---|---|
| LCC load/update loop, camera/mode lifecycle, render quality/FPS handling | `examples/app/engine/` | Engine owns runtime and scene operations |
| Startup view resolution and camera preset transitions | `examples/app/engine/camera-startup.js` | Keep existing precedence behavior |
| Hotspot sprite scene objects, pointer pick/raycast, drag world updates | `examples/app/engine/hotspots-engine.js` | UI should only pass intent/events |
| DOM references, panel toggles, loading/onboarding/help rendering | `examples/app/ui/` | UI owns presentation and DOM updates |
| Tour loading, defaults, normalization, URL override resolution, export config build | `examples/app/schema/tour-config-runtime.js` | Must remain aligned with Tour Contract v1 |
| Event emit and local buffer | `examples/app/analytics/analytics-client.js` | Preserve `window.__viosEvents` compatibility |
| Editor selection/dirty/history state orchestration | `examples/app/state/viewer-store.js` + `ui/editor-ui.js` | Introduce shared state in PR3 |

## 5) Public Interface Contracts (UI <-> Engine)
Target engine interface (example contract; same behavior as now):

```js
engine.loadTour({
  modelEntryAbsUrl,
  rotationDeg,
  initialFov,
  performanceOptions,
  onProgress,
  onReady,
  onError
});

engine.setMode('orbit' | 'walk');
engine.resetView();
engine.animateToPreset(preset, { applyFov: true });
engine.screenToWorld(pointerEvent);            // world point or null
engine.pickHotspotFromPointer(pointerEvent);   // hotspot id/info or null
engine.setHotspots(hotspotConfigs);
engine.selectHotspot(hotspotIdOrNull);
engine.resize(width, height);
engine.tick(now, delta);
```

After extraction, UI should not directly own:
- Direct calls into LCC internals
- Scene graph mutation for hotspots
- Camera math/fit/startup precedence resolution

UI should own:
- DOM rendering, user intents, and calling engine/store APIs.

## 6) State Model
A minimal central store is justified in PR3 to prevent state drift across engine/UI/editor/history.

Proposed minimal shape:

```js
{
  config: {
    sourceTourConfig,
    tourId,
    title,
    modelEntryUrl,
    rotationDeg,
    initialFov,
    startMode,
    cta
  },
  runtime: {
    sceneReady,
    mode,                     // orbit|walk
    loadingPercent,
    loadingStatus,
    error,
    fps,
    qualityMode,
    autoPerfEnabled,
    performanceMode
  },
  data: {
    cameraPresets,
    hotspots,
    defaultPresetId
  },
  editor: {
    enabled,
    dirty,
    status,
    selectedPresetId,
    selectedHotspotId,
    hotspotPlacementMode,
    snapY,
    history: { stack, index, savedHash }
  },
  ui: {
    settingsOpen,
    compactMenuOpen,
    onboardingOpen,
    onboardingStep,
    loadingVisible
  },
  analytics: {
    sessionId,
    debugEnabled
  }
}
```

Store API can stay minimal:
- `getState()`
- `setState(partialOrUpdater)`
- `subscribe(selector, listener)`

## 7) Migration Plan (Exactly 3 Small PRs)

### PR1 - Runtime Schema Helpers + Analytics Extraction (No UI/Engine Behavior Change)
Files to create/edit:
- Create `examples/app/schema/tour-config-runtime.js`
- Create `examples/app/analytics/analytics-client.js`
- Edit `examples/three.html` only to import/use these modules

Responsibilities moved:
- Pure parse/default/normalize/precedence helpers
- Tour config loading helper and runtime normalization helpers
- Analytics emitter + local buffer helper

Must remain unchanged:
- Load behavior, URL override behavior, startup behavior, UI behavior
- Event names and payload shape in `window.__viosEvents`

Manual QA checklist:
- `.../examples/three.html`
- `.../examples/three.html?tour=penthouse-001`
- `.../examples/three.html?tour=penthouse-001&rx=-90&fov=60`
- `.../examples/three.html?tour=penthouse-001&start=home`
- `.../examples/three.html?tour=penthouse-001&start=preset:balcony-view`
- Confirm same console behavior and no new errors.

### PR2 - Engine/Runtime Extraction (Keep DOM Wiring in `three.html`)
Files to create/edit:
- Create `examples/app/engine/viewer-engine.js`
- Create `examples/app/engine/camera-startup.js`
- Create `examples/app/engine/hotspots-engine.js`
- Edit `examples/three.html` to delegate to engine modules

Responsibilities moved:
- LCC/Three runtime orchestration
- Camera fit/startup and mode transitions
- Render quality/perf logic
- Scene hotspot sprite/pick/drag world logic

Must remain unchanged:
- All UI layout, events, text, and editor flows
- Same runtime output and controls behavior

Manual QA checklist:
- Orbit/Walk/Home/Reset/FOV/quality all behave same
- Hotspot hover/click/drag behavior unchanged in `?edit=1`
- No startup precedence regressions
- No new uncaught exceptions

### PR3 - UI Controllers + Store Wiring (Keep `three.html` as Composition Root)
Files to create/edit:
- Create `examples/app/ui/ui-controller.js`
- Create `examples/app/ui/loading-ui.js`
- Create `examples/app/ui/onboarding-ui.js`
- Create `examples/app/ui/editor-ui.js`
- Create `examples/app/state/viewer-store.js`
- Edit `examples/three.html` to compose modules and wire dependencies

Responsibilities moved:
- DOM render/update helpers and event wiring
- Editor UI rendering and form/status interactions
- Shared state orchestration moved to store

Must remain unchanged:
- Visual/interaction behavior
- Export format from editor flow
- Existing debug/global compatibility behavior

Manual QA checklist:
- Viewer mode URLs still render and navigate correctly
- Editor mode (`?edit=1`) add/edit/drag/delete hotspots still works
- Presets, default preset, undo/redo, export copy/download unchanged
- Loading/onboarding/settings/help/CTA behavior unchanged

## 8) Risks / Edge Cases During Split
- Startup ordering races (loading overlay, bounds-ready, startup view apply order)
- Startup precedence regression (`start`, URL overrides, `defaultPresetId`)
- Drag vs camera control conflicts in edit mode
- Undo/redo state drift if engine/UI mutate state independently
- Hotspot scene sync mismatches after list/history restore
- Breakage of current debug/global compatibility (`window.__viosEvents`, global helpers)
- Hidden coupling between UI text/state and runtime callbacks

Mitigation:
- Keep each PR behavior-preserving with targeted regression checklist.
- Preserve existing event names/payloads and startup decision logic verbatim.

## 9) Definition of Success
After PR1-PR3:
- Same observable behavior as current `examples/three.html` (viewer + editor)
- Clear module boundaries across engine/ui/schema/analytics
- `examples/three.html` remains a simple composition root and shippable single-page output
- Safer, smaller prompts/PRs with lower regression risk
- Tour contract behavior remains aligned with:
  - `docs/TOUR_CONTRACT_V1.md`
  - `schema/tour.schema.json`
