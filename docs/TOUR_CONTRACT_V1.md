# Tour Contract v1

## 1) Purpose / Scope
This document defines the current Tour Contract v1 for the VIOS viewer, based on shipped runtime behavior.

Scope:
- Tour configuration shape used by `examples/three.html`
- Runtime defaults and precedence
- JSON schema alignment (`schema/tour.schema.json`)

Out of scope:
- Application code refactors
- New runtime features beyond current behavior

## 2) Current Source of Truth
Contract behavior in this document is grounded in:
- `examples/three.html`
- `tours/penthouse-001/tour.json`
- `docs/BUILD_INVENTORY.md`
- `AGENTS.md`

If any older docs conflict with runtime behavior, treat `examples/three.html` as canonical.

## 3) Required Top-Level Fields
These fields are required for a tour config loaded through `?tour=<id>`:

| Field | Type | Notes |
|---|---|---|
| `tourId` | string | Stable tour identifier |
| `title` | string | Displayed in viewer UI |
| `modelEntryUrl` | string | Scene entry URL (relative or absolute) |

## 4) Optional Top-Level Fields
| Field | Type | Notes |
|---|---|---|
| `modelId` | string | Optional link to model registry entry |
| `slug` | string | Optional operator slug metadata (lowercase letters/numbers/hyphen) |
| `status` | `"draft"` or `"published"` | Optional lifecycle metadata (editor defaults to `draft`) |
| `address` | string or number | Optional property card address |
| `price` | string or number | Optional property card price |
| `rooms` | string or number | Optional property card room count |
| `area` | string or number | Optional property card area |
| `property` | object | Optional compatibility object for property card content |
| `rotation` | object | `{ rx, ry, rz }` in degrees |
| `fov` | number | Camera FOV base value |
| `startMode` | `"orbit"` or `"walk"` | Initial control mode |
| `cta` | object | `{ label, url }` |
| `cameraPresets` | array | List of saved views |
| `hotspots` | array | List of interactive markers |
| `defaultPresetId` | string | Startup preset if valid and no URL view override |
| `configVersion` | string | Optional non-breaking metadata |
| `updatedAt` | string (`date-time`) | Optional non-breaking metadata |
| `updatedBy` | string | Optional non-breaking metadata |

## 5) Runtime Defaults
When `?tour` is absent, the internal default config is used:
- `tourId: "default"`
- `title`: derived from default model URL path
- `modelEntryUrl: "/assets/PentHouse/meta.lcc"`
- `rotation: { rx: 0, ry: 0, rz: 0 }`
- `fov: 45`
- `startMode: "orbit"`
- `cta: { label: "CTA" }`

When optional fields are missing in a loaded tour:
- `rotation.rx/ry/rz` fallback to `0` per axis
- `fov` falls back to `45`
- `startMode` falls back to `"orbit"`
- `cta.label` falls back to `"CTA"`
- `cta.url` falls back to empty
- `cameraPresets` and `hotspots` fallback to empty arrays if absent/non-array
- `defaultPresetId` ignored unless it matches an existing preset id
- property card address/price/rooms/area fields are optional and hidden when missing

Item-level runtime normalization:
- Preset missing `id` -> generated as `preset-N`
- Preset missing `label` -> generated as `View N`
- Hotspot missing `id` -> generated as `hotspot-N`
- Hotspot missing `label` -> generated as `Hotspot N`
- Hotspot `type` defaults to `"info"` unless explicitly `"link"` or `"cta"`
- Invalid preset/hotspot vector data is ignored (item dropped)

## 6) URL Override Precedence
Base rotation resolution before URL overrides:
- `tour.rotation` per-axis value, if present
- otherwise model-level default rotation (when supplied by runtime/model registry)
- otherwise `0` per axis

After loading config and applying defaults:
- `rx`, `ry`, `rz` query params override corresponding rotation axes
- `fov` query param overrides configured/default FOV

These are per-request runtime overrides and do not mutate the source `tour.json` unless exported manually through editor flow.

## 7) Startup Behavior Precedence
Startup view resolution order:
1. If `start=home` -> fit-to-bounds home view (`resetView`)
2. Else if `start=preset:<id>` and preset exists -> animate to that preset
3. Else if no URL view override (`rx/ry/rz/fov`) and valid `defaultPresetId` -> animate to default preset
4. Else -> fit-to-bounds home view

`startMode` (`orbit`/`walk`) controls initial control mode independently from the startup view choice above.

## 8) Viewer Settings (Config-Relevant)
Tour contract fields affecting initial viewer behavior:
- `rotation` -> model transform before scene usage
- `fov` -> initial camera FOV before interactive changes
- `startMode` -> initial navigation mode
- `defaultPresetId` + URL `start` param -> startup camera target path
- `cta` -> CTA label and click action URL

## 9) Preset and Hotspot Item Structure
### `cameraPresets[]` item
| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | No | Stable preset id |
| `label` | string | No | UI label |
| `position` | `[number, number, number]` | Yes | Camera position |
| `target` | `[number, number, number]` | Yes | Orbit target |
| `fov` | number | No | Preset-specific FOV |

### `hotspots[]` item
| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | No | Stable hotspot id |
| `label` | string | No | UI label |
| `position` | `[number, number, number]` | Yes | World-space position |
| `type` | `"info"` \| `"link"` \| `"cta"` | No | Defaults to `"info"` |
| `action.url` | string | No | Used for `link`/`cta` actions |
| `card` | object | No | Optional rich viewer card content |
| `card.eyebrow` | string | No | Optional micro-label |
| `card.title` | string | No | Optional title (fallback: `label`) |
| `card.description` | string | No | Optional body copy |
| `card.ctaLabel` | string | No | Optional CTA label |
| `card.ctaUrl` | string | No | Optional CTA URL (fallback from/to `action.url` where relevant) |

### Optional property card compatibility fields
Supported as optional compatibility paths:
- Top-level: `address`, `price`, `rooms`, `area`
- Nested compatibility: `property.address`, `property.price`, `property.rooms`, `property.area`
- Existing equivalents remain accepted: `room`, `bedrooms`, `floorArea`, `areaSqm`, `size` (top-level or under `property`)

## 10) Metadata / Versioning (Non-Breaking)
Optional metadata fields introduced in v1:
- `configVersion` (string)
- `updatedAt` (RFC3339 date-time string)
- `updatedBy` (string)

These are documentation/schema-level additions only. Runtime currently does not require them.

## 11) Backward Compatibility Notes
- Top-level required fields remain: `tourId`, `title`, `modelEntryUrl`.
- Additional unknown top-level fields are allowed by schema for compatibility.
- Existing tours without metadata fields remain valid.
- Export logic in current runtime preserves unknown top-level fields by cloning source config before writing known fields.
- Runtime now supports optional property-card and hotspot-card fields without requiring them.

## 12) Minimal Valid Example
```json
{
  "tourId": "example-001",
  "title": "Example Listing",
  "modelEntryUrl": "/assets/PentHouse/meta.lcc"
}
```

## 13) Full Example
```json
{
  "configVersion": "1.0",
  "updatedAt": "2026-03-09T12:00:00Z",
  "updatedBy": "author@example.com",
  "tourId": "penthouse-001",
  "title": "Penthouse - South Yarra",
  "address": "South Yarra, VIC 3141",
  "price": "From $3.15M",
  "rooms": "4",
  "area": "312 sqm",
  "modelEntryUrl": "/assets/PentHouse/meta.lcc",
  "rotation": { "rx": -90, "ry": 0, "rz": 0 },
  "fov": 60,
  "startMode": "orbit",
  "defaultPresetId": "living",
  "cta": { "label": "Contact agent", "url": "tel:+61..." },
  "cameraPresets": [
    {
      "id": "living",
      "label": "Living",
      "position": [38, 14, -20],
      "target": [56, 12, -12],
      "fov": 58
    },
    {
      "id": "balcony-view",
      "label": "Balcony",
      "position": [84, 18, -26],
      "target": [68, 14, -18],
      "fov": 62
    }
  ],
  "hotspots": [
    {
      "id": "hotspot-balcony",
      "label": "Balcony",
      "position": [72, 14, -20],
      "type": "info",
      "card": {
        "eyebrow": "Outdoor Living",
        "title": "Skyline Balcony",
        "description": "Panoramic city outlook with sheltered dining and sunset-facing seating.",
        "ctaLabel": "Request brochure",
        "ctaUrl": "https://example.com/penthouse-brochure"
      }
    }
  ]
}
```

## 14) Registry Conventions (Multi-Model / Multi-Tour Foundation)
- `tours/models.registry.json` contains available model definitions: `modelId`, `name`, `modelEntryUrl`, optional `thumbUrl`.
- `tours/tours.registry.json` contains available tour definitions: `tourId`, `modelId`, `title`, optional `slug`, optional `status`.
- Existing ?tour=<tourId> remains the primary runtime loading path; registries are foundational metadata for editor entry and future operations.

## 15) Editor Draft Bootstrap URL (Foundation Only)
- New optional editor bootstrap URL form: ?edit=1&new=1&model=<modelId>.
- When used without ?tour=..., runtime creates a local draft config seeded from the selected model's modelEntryUrl and sets modelId in draft/export output.
- This is a navigation/bootstrap flow only (no backend persistence in v1).

## 16) Draft / Publish Workflow Foundation (File-Based)
- Canonical runtime viewer route remains `?tour=<tourId>` (non-breaking).
- `slug` is optional operator metadata for shareability/readiness; routing still resolves by `tourId`.
- `status` is lifecycle metadata with values `draft` or `published`.
- Editor publish-prep action is file-based:
1. mark current draft as publish-ready (`status=published`),
2. generate updated `tour.json`,
3. generate an upserted `tours.registry.json` payload by `tourId`,
4. operator copies/downloads artifacts for manual commit or pipeline handoff.
- Operator publish bundle helper (file-based) downloads a single ZIP with:
1. `tours/<tourId>/tour.json` (forced `status=published` in bundle output),
2. `tours/tours.registry.json` (upserted payload),
3. `publish-manifest.json` (bundle metadata for handoff clarity).

Editor metadata controls include `rx`, `ry`, `rz` (degrees) and export those values into `tour.json.rotation`.

