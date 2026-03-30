const toNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const toVec3 = (input, fallback = [0, 0, 0]) => {
    if (!Array.isArray(input) || input.length < 3) return fallback.slice(0, 3);
    return [toNumber(input[0]), toNumber(input[1]), toNumber(input[2])];
};

const sqrDistance = (a, b) => {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    return (dx * dx) + (dy * dy) + (dz * dz);
};

export const buildViewDefinitionsFromPresets = (cameraPresets = [], {
    defaultZoneId = 'zone-primary'
} = {}) => {
    if (!Array.isArray(cameraPresets)) return [];
    return cameraPresets
        .filter((preset) => preset && typeof preset === 'object')
        .map((preset) => {
            const id = String(preset.id || '').trim();
            if (!id) return null;
            const label = String(preset.label || id).trim() || id;
            return {
                id,
                label,
                anchor: {
                    id: `anchor-${id}`,
                    viewId: id,
                    position: toVec3(preset.position),
                    lookAt: toVec3(preset.target),
                    ...(Number.isFinite(Number(preset.fov)) ? { fov: Number(preset.fov) } : {}),
                    zoneId: defaultZoneId
                },
                zoneId: defaultZoneId
            };
        })
        .filter(Boolean);
};

export const buildAnchorsFromViews = (viewDefinitions = []) => (
    Array.isArray(viewDefinitions)
        ? viewDefinitions
            .filter((view) => view?.anchor && typeof view.anchor === 'object')
            .map((view) => ({
                ...view.anchor,
                id: String(view.anchor.id || '').trim() || `anchor-${String(view.id || '').trim()}`,
                viewId: String(view.id || '').trim(),
                position: toVec3(view.anchor.position),
                lookAt: toVec3(view.anchor.lookAt),
                zoneId: String(view.anchor.zoneId || view.zoneId || '').trim()
            }))
            .filter((anchor) => anchor.id)
        : []
);

export const findNearestAnchor = ({
    anchors = [],
    cameraPosition = [0, 0, 0]
} = {}) => {
    if (!Array.isArray(anchors) || !anchors.length) {
        return {
            anchor: null,
            distance: null
        };
    }
    const from = toVec3(cameraPosition);
    let nearest = null;
    let nearestSq = Infinity;
    anchors.forEach((anchor) => {
        if (!anchor || !Array.isArray(anchor.position)) return;
        const distSq = sqrDistance(from, toVec3(anchor.position));
        if (distSq < nearestSq) {
            nearestSq = distSq;
            nearest = anchor;
        }
    });
    if (!nearest) {
        return {
            anchor: null,
            distance: null
        };
    }
    return {
        anchor: nearest,
        distance: Math.sqrt(nearestSq)
    };
};

export const resolveLocationState = ({
    prevLocation = {},
    anchors = [],
    cameraPosition = [0, 0, 0],
    activeViewId = '',
    transitionActive = false,
    stableDistanceThreshold = 2.4,
    now = Date.now()
} = {}) => {
    const prev = prevLocation && typeof prevLocation === 'object' ? prevLocation : {};
    const nearest = findNearestAnchor({ anchors, cameraPosition });
    const nearestAnchorId = nearest.anchor?.id || '';
    const nearestAnchorDistance = Number.isFinite(nearest.distance) ? Number(nearest.distance) : null;
    const nearestZoneId = nearest.anchor?.zoneId || '';
    const activeZoneId = nearestZoneId || String(prev.activeZoneId || '').trim();
    const nextStableAnchorId = (!transitionActive && nearestAnchorId && nearestAnchorDistance !== null && nearestAnchorDistance <= stableDistanceThreshold)
        ? nearestAnchorId
        : String(prev.lastStableAnchorId || '').trim();

    const location = {
        activeZoneId,
        nearestAnchorId,
        lastStableAnchorId: nextStableAnchorId,
        nearestAnchorDistance,
        confidence: nearestAnchorId ? 1 : 0,
        updatedAt: Number.isFinite(Number(now)) ? Number(now) : Date.now(),
        activeViewId: String(activeViewId || '').trim()
    };

    return {
        location,
        changes: {
            anchorChanged: String(prev.nearestAnchorId || '').trim() !== location.nearestAnchorId,
            zoneChanged: String(prev.activeZoneId || '').trim() !== location.activeZoneId,
            stableAnchorChanged: String(prev.lastStableAnchorId || '').trim() !== location.lastStableAnchorId
        }
    };
};
