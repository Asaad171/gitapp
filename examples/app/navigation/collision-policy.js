import {
    NAV_COLLISION_STATUS,
    NAV_MODES,
    createCollisionProfiles
} from './navigation-types.js';

const normalizeMode = (mode) => {
    if (mode === NAV_MODES.WALK || mode === NAV_MODES.FLY || mode === NAV_MODES.ORBIT) return mode;
    return NAV_MODES.WALK;
};

export const resolveCollisionPolicy = ({
    navMode = NAV_MODES.WALK,
    isEditorMode = false,
    editorCollisionEnabled = false,
    viewerCollisionModes = null,
    editorCollisionModes = null,
    collisionProfiles = null,
    collisionAvailable = false,
    status = ''
} = {}) => {
    const mode = normalizeMode(navMode);
    const available = collisionAvailable === true;
    const normalizedStatus = status || (available ? NAV_COLLISION_STATUS.AVAILABLE : NAV_COLLISION_STATUS.UNAVAILABLE);
    const normalizedProfiles = createCollisionProfiles(
        collisionProfiles && typeof collisionProfiles === 'object'
            ? collisionProfiles
            : {
                viewerModes: viewerCollisionModes || undefined,
                editorModes: editorCollisionModes || {
                    walk: editorCollisionEnabled === true
                }
            }
    );
    // Final contract:
    // - Viewer runtime is deterministic: Walk may collide, Orbit/Fly remain off.
    // - Editor runtime follows authored per-mode editor profile.
    const viewerRequestedByMode = mode === NAV_MODES.WALK;
    const requestedByMode = isEditorMode
        ? normalizedProfiles.editorModes?.[mode] === true
        : viewerRequestedByMode;
    const basePayload = {
        available,
        status: normalizedStatus,
        editorEnabled: normalizedProfiles.editorModes.walk,
        viewerModes: normalizedProfiles.viewerModes,
        editorModes: normalizedProfiles.editorModes,
        requestedMode: mode,
        requestedEnabled: requestedByMode
    };

    if (!available) {
        return {
            ...basePayload,
            available: false,
            status: normalizedStatus || NAV_COLLISION_STATUS.UNAVAILABLE,
            effectiveEnabled: false,
            reason: normalizedStatus === NAV_COLLISION_STATUS.ERROR
                ? 'collision_unavailable_error'
                : 'collision_unavailable'
        };
    }
    return {
        ...basePayload,
        available: true,
        status: normalizedStatus || NAV_COLLISION_STATUS.AVAILABLE,
        requestedEnabled: requestedByMode,
        effectiveEnabled: requestedByMode === true,
        reason: isEditorMode
            ? (requestedByMode ? `editor_${mode}_enabled` : `editor_${mode}_disabled`)
            : (viewerRequestedByMode ? 'viewer_walk_enforced' : `viewer_${mode}_disabled`)
    };
};
