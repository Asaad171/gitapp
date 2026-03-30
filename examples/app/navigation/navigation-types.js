export const NAV_MODES = Object.freeze({
    ORBIT: 'orbit',
    WALK: 'walk',
    FLY: 'fly'
});

export const NAV_MOVEMENT_STATES = Object.freeze({
    IDLE: 'idle',
    MOVING: 'moving'
});

export const NAV_TRANSITION_KINDS = Object.freeze({
    NONE: 'none',
    VIEW: 'view',
    RESET: 'reset',
    RECOVERY: 'recovery'
});

export const NAV_COLLISION_STATUS = Object.freeze({
    UNKNOWN: 'unknown',
    AVAILABLE: 'available',
    UNAVAILABLE: 'unavailable',
    ERROR: 'error'
});

export const DEFAULT_COLLISION_MODE_PROFILE = Object.freeze({
    orbit: false,
    walk: true,
    fly: false
});

const normalizeId = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeModeKey = (value) => (
    value === NAV_MODES.ORBIT || value === NAV_MODES.WALK || value === NAV_MODES.FLY
        ? value
        : NAV_MODES.WALK
);

export const createAnchor = (input = {}) => ({
    id: normalizeId(input.id),
    viewId: normalizeId(input.viewId),
    position: Array.isArray(input.position) ? input.position.slice(0, 3).map(Number) : [0, 0, 0],
    lookAt: Array.isArray(input.lookAt) ? input.lookAt.slice(0, 3).map(Number) : [0, 0, 0],
    ...(Number.isFinite(Number(input.fov)) ? { fov: Number(input.fov) } : {}),
    ...(normalizeId(input.zoneId) ? { zoneId: normalizeId(input.zoneId) } : {}),
    ...(input.metadata && typeof input.metadata === 'object' ? { metadata: { ...input.metadata } } : {})
});

export const createZone = (input = {}) => ({
    id: normalizeId(input.id),
    label: normalizeId(input.label) || normalizeId(input.id) || 'Zone',
    type: normalizeId(input.type) || 'generic',
    ...(input.bounds && typeof input.bounds === 'object' ? { bounds: { ...input.bounds } } : {}),
    ...(input.metadata && typeof input.metadata === 'object' ? { metadata: { ...input.metadata } } : {})
});

export const createLane = (input = {}) => ({
    id: normalizeId(input.id),
    label: normalizeId(input.label) || normalizeId(input.id) || 'Lane',
    zoneId: normalizeId(input.zoneId),
    path: Array.isArray(input.path) ? input.path.map((p) => Array.isArray(p) ? p.slice(0, 3).map(Number) : [0, 0, 0]) : [],
    ...(input.metadata && typeof input.metadata === 'object' ? { metadata: { ...input.metadata } } : {})
});

export const createBlockerVolume = (input = {}) => ({
    id: normalizeId(input.id),
    type: normalizeId(input.type) || 'aabb',
    enabled: input.enabled !== false,
    min: Array.isArray(input.min) ? input.min.slice(0, 3).map(Number) : [0, 0, 0],
    max: Array.isArray(input.max) ? input.max.slice(0, 3).map(Number) : [0, 0, 0],
    ...(input.meta && typeof input.meta === 'object' ? { meta: { ...input.meta } } : {})
});

export const createBoundaryState = (input = {}) => ({
    blockers: Array.isArray(input.blockers)
        ? input.blockers
            .map((entry) => createBlockerVolume(entry))
            .filter((entry) => entry.id)
        : []
});

export const createViewDefinition = (input = {}) => ({
    id: normalizeId(input.id),
    label: normalizeId(input.label) || normalizeId(input.id) || 'View',
    anchor: createAnchor({
        id: normalizeId(input.anchor?.id) || `anchor-${normalizeId(input.id) || 'view'}`,
        viewId: normalizeId(input.id),
        position: input.anchor?.position || input.position || [0, 0, 0],
        lookAt: input.anchor?.lookAt || input.target || [0, 0, 0],
        fov: input.anchor?.fov ?? input.fov ?? null,
        zoneId: input.anchor?.zoneId || input.zoneId || ''
    }),
    ...(normalizeId(input.zoneId) ? { zoneId: normalizeId(input.zoneId) } : {})
});

export const createLocationState = (input = {}) => ({
    activeZoneId: normalizeId(input.activeZoneId),
    nearestAnchorId: normalizeId(input.nearestAnchorId),
    lastStableAnchorId: normalizeId(input.lastStableAnchorId),
    nearestAnchorDistance: Number.isFinite(Number(input.nearestAnchorDistance))
        ? Number(input.nearestAnchorDistance)
        : null,
    confidence: Number.isFinite(Number(input.confidence))
        ? Number(input.confidence)
        : 0,
    updatedAt: Number.isFinite(Number(input.updatedAt))
        ? Number(input.updatedAt)
        : 0
});

const cloneCollisionModes = (input = DEFAULT_COLLISION_MODE_PROFILE) => ({
    orbit: input.orbit === true,
    walk: input.walk === true,
    fly: input.fly === true
});

const normalizeModeFlag = (value, fallback) => {
    if (value === true) return true;
    if (value === false) return false;
    return fallback === true;
};

export const createCollisionModeProfile = (
    input = {},
    {
        fallback = DEFAULT_COLLISION_MODE_PROFILE,
        legacyEditorEnabled = false
    } = {}
) => {
    const source = input && typeof input === 'object' ? input : {};
    const normalized = {
        orbit: normalizeModeFlag(source.orbit, fallback.orbit),
        walk: normalizeModeFlag(source.walk, fallback.walk),
        fly: normalizeModeFlag(source.fly, fallback.fly)
    };
    if (legacyEditorEnabled && source.walk === undefined && source.editorEnabled === true) {
        normalized.walk = true;
    }
    return normalized;
};

export const createCollisionProfiles = (input = {}) => {
    const source = input && typeof input === 'object' ? input : {};
    const defaults = {
        viewerModes: cloneCollisionModes(DEFAULT_COLLISION_MODE_PROFILE),
        editorModes: cloneCollisionModes(DEFAULT_COLLISION_MODE_PROFILE)
    };
    const sharedModes = source.modes && typeof source.modes === 'object' ? source.modes : null;
    const hasExplicitProfiles = !!(
        source.viewerModes
        || source.editorModes
        || source.viewer
        || source.editor
    );
    const viewerSource = hasExplicitProfiles
        ? (source.viewerModes || source.viewer || sharedModes || {})
        : (sharedModes || {});
    const editorSource = hasExplicitProfiles
        ? (source.editorModes || source.editor || sharedModes || {})
        : source;
    return {
        viewerModes: createCollisionModeProfile(viewerSource, {
            fallback: defaults.viewerModes
        }),
        editorModes: createCollisionModeProfile(editorSource, {
            fallback: defaults.editorModes,
            legacyEditorEnabled: true
        })
    };
};

export const createCollisionEditorModes = (input = {}) => (
    createCollisionProfiles(input).editorModes
);

export const createCollisionState = (input = {}) => {
    const statusValue = normalizeId(input.status) || NAV_COLLISION_STATUS.UNKNOWN;
    const validStatus = Object.values(NAV_COLLISION_STATUS).includes(statusValue)
        ? statusValue
        : NAV_COLLISION_STATUS.UNKNOWN;
    const profiles = createCollisionProfiles(input);
    const requestedMode = normalizeModeKey(input.requestedMode);
    return {
        available: input.available === true,
        status: validStatus,
        editorEnabled: profiles.editorModes.walk,
        viewerModes: profiles.viewerModes,
        editorModes: profiles.editorModes,
        requestedMode,
        requestedEnabled: input.requestedEnabled === true,
        effectiveEnabled: input.effectiveEnabled === true,
        reason: normalizeId(input.reason) || 'uninitialized',
        updatedAt: Number.isFinite(Number(input.updatedAt))
            ? Number(input.updatedAt)
            : 0,
        lastError: normalizeId(input.lastError)
    };
};

export const createNavigationRuntimeState = ({
    mode = NAV_MODES.WALK,
    activeViewId = '',
    activeAnchorId = '',
    currentLaneId = '',
    cameraIntent = {},
    transition = {},
    movement = {},
    location = {},
    collision = {},
    boundaries = {},
    triggerHooks = {}
} = {}) => ({
    mode: Object.values(NAV_MODES).includes(mode) ? mode : NAV_MODES.WALK,
    activeViewId: normalizeId(activeViewId),
    activeAnchorId: normalizeId(activeAnchorId),
    currentLaneId: normalizeId(currentLaneId),
    cameraIntent: {
        type: normalizeId(cameraIntent.type) || 'idle',
        source: normalizeId(cameraIntent.source),
        targetMode: normalizeId(cameraIntent.targetMode),
        targetViewId: normalizeId(cameraIntent.targetViewId),
        updatedAt: Number.isFinite(Number(cameraIntent.updatedAt)) ? Number(cameraIntent.updatedAt) : 0
    },
    transition: {
        active: !!transition.active,
        kind: normalizeId(transition.kind) || NAV_TRANSITION_KINDS.NONE,
        targetViewId: normalizeId(transition.targetViewId),
        startedAt: Number.isFinite(Number(transition.startedAt)) ? Number(transition.startedAt) : 0
    },
    movement: {
        state: movement.state === NAV_MOVEMENT_STATES.MOVING
            ? NAV_MOVEMENT_STATES.MOVING
            : NAV_MOVEMENT_STATES.IDLE,
        lastStartedAt: Number.isFinite(Number(movement.lastStartedAt)) ? Number(movement.lastStartedAt) : 0,
        lastStoppedAt: Number.isFinite(Number(movement.lastStoppedAt)) ? Number(movement.lastStoppedAt) : 0
    },
    location: createLocationState(location),
    collision: createCollisionState(collision),
    boundaries: createBoundaryState(boundaries),
    triggerHooks: {
        lastEvent: normalizeId(triggerHooks.lastEvent),
        lastEventAt: Number.isFinite(Number(triggerHooks.lastEventAt)) ? Number(triggerHooks.lastEventAt) : 0
    }
});
