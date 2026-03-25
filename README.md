# VIOS Deploy Package

## Runtime entrypoint
- Root URL `/` redirects to `/examples/three.html` (query/hash preserved).
- Canonical runtime page remains `/examples/three.html`.

## Runtime-critical folders
- `examples/` : viewer app (`three.html`) + runtime modules + Three.js engine files
- `sdk/` : `lcc-0.5.5.js`
- `tours/` : tour configs at `/tours/<tour-id>/tour.json`
- `assets/` : local model payload + UI media (self-contained local runtime)
- `schema/` + `docs/` : operator workflow/contract reference

## Path conventions
- Tour config URL: `/tours/<tour-id>/tour.json`
- Model payload path comes from `tour.json -> modelEntryUrl`
  - Current local sample: `/assets/PentHouse/meta.lcc`
- Intro media path in viewer: `/assets/ui/vios-intro.mp4`

## Local run (range-capable static serving)
From this deploy root:

```powershell
node range-server.mjs
```

Then open:
- `http://127.0.0.1:8080/`
- `http://127.0.0.1:8080/examples/three.html?tour=penthouse-001`
- `http://127.0.0.1:8080/examples/three.html?tour=penthouse-001&edit=1&debug=1`
- `http://127.0.0.1:8080/examples/three.html?edit=1&new=1&model=penthouse-model`

## Split hosting (future-ready)
- Keep local default: `tours/penthouse-001/tour.json`
- Remote template: `tours/penthouse-001/tour.remote.example.json`
- To move heavy assets remote later, promote remote template in deployment pipeline.

R2/custom asset host requirements:
- CORS allow the app origin
- Byte-range support (`Accept-Ranges`) for large binaries
- Keep sibling payload names unchanged under `PentHouse/`
