import {
    NAV_MODES,
    NAV_COLLISION_STATUS,
    NAV_MOVEMENT_STATES,
    NAV_TRANSITION_KINDS,
    createBoundaryState,
    createCollisionState,
    createNavigationRuntimeState
} from './navigation-types.js';
import {
    buildAnchorsFromViews,
    resolveLocationState
} from './location-resolver.js';
import { resolveCollisionPolicy } from './collision-policy.js';

const toMode = (value) => (
    Object.values(NAV_MODES).includes(value) ? value : NAV_MODES.WALK
);

const mergeNavigationState = (current = {}, patch = {}) => ({
    ...current,
    ...patch,
    cameraIntent: {
        ...(current.cameraIntent || {}),
        ...(patch.cameraIntent || {})
    },
    transition: {
        ...(current.transition || {}),
        ...(patch.transition || {})
    },
    movement: {
        ...(current.movement || {}),
        ...(patch.movement || {})
    },
    location: {
        ...(current.location || {}),
        ...(patch.location || {})
    },
    collision: {
        ...(current.collision || {}),
        ...(patch.collision || {}),
        viewerModes: {
            ...((current.collision || {}).viewerModes || {}),
            ...((patch.collision || {}).viewerModes || {})
        },
        editorModes: {
            ...((current.collision || {}).editorModes || {}),
            ...((patch.collision || {}).editorModes || {})
        }
    },
    boundaries: {
        ...(current.boundaries || {}),
        ...(patch.boundaries || {}),
        blockers: Array.isArray(patch?.boundaries?.blockers)
            ? patch.boundaries.blockers
            : (Array.isArray(current?.boundaries?.blockers) ? current.boundaries.blockers : [])
    },
    triggerHooks: {
        ...(current.triggerHooks || {}),
        ...(patch.triggerHooks || {})
    }
});

export const createNavigationController = ({
    store,
    events,
    applyMode,
    getViewDefinitions,
    startViewTransition,
    runResetView,
    getCameraPosition,
    getIsEditorMode,
    nowFn = () => Date.now()
} = {}) => {
    let modeTransitionActive = false;

    const readNavigation = () => {
        const current = store?.getState?.().navigation;
        if (current && typeof current === 'object') return current;
        return createNavigationRuntimeState();
    };

    const writeNavigation = (patch = {}) => {
        if (!store?.setState) return readNavigation();
        let nextNavigation = null;
        store.setState((state) => {
            const current = state?.navigation && typeof state.navigation === 'object'
                ? state.navigation
                : createNavigationRuntimeState();
            nextNavigation = mergeNavigationState(current, patch);
            return {
                ...state,
                navigation: nextNavigation,
                mode: nextNavigation.mode
            };
        });
        return nextNavigation || readNavigation();
    };

    const readIsEditorMode = () => (
        typeof getIsEditorMode === 'function' ? getIsEditorMode() === true : false
    );

    const normalizeCollisionStatus = (statusValue, available) => {
        const candidate = String(statusValue || '').trim();
        if (Object.values(NAV_COLLISION_STATUS).includes(candidate)) return candidate;
        return available ? NAV_COLLISION_STATUS.AVAILABLE : NAV_COLLISION_STATUS.UNAVAILABLE;
    };

    const syncCollisionPolicy = ({ force = false } = {}) => {
        const current = readNavigation();
        const currentCollision = createCollisionState(current.collision || {});
        const resolved = resolveCollisionPolicy({
            navMode: current.mode,
            isEditorMode: readIsEditorMode(),
            editorCollisionEnabled: currentCollision.editorEnabled,
            viewerCollisionModes: currentCollision.viewerModes,
            editorCollisionModes: currentCollision.editorModes,
            collisionProfiles: {
                viewerModes: currentCollision.viewerModes,
                editorModes: currentCollision.editorModes
            },
            collisionAvailable: currentCollision.available,
            status: currentCollision.status
        });
        const nextCollision = createCollisionState({
            ...currentCollision,
            ...resolved,
            updatedAt: nowFn()
        });
        const unchanged = currentCollision.available === nextCollision.available
            && currentCollision.status === nextCollision.status
            && currentCollision.viewerModes?.orbit === nextCollision.viewerModes?.orbit
            && currentCollision.viewerModes?.walk === nextCollision.viewerModes?.walk
            && currentCollision.viewerModes?.fly === nextCollision.viewerModes?.fly
            && currentCollision.editorModes?.orbit === nextCollision.editorModes?.orbit
            && currentCollision.editorModes?.walk === nextCollision.editorModes?.walk
            && currentCollision.editorModes?.fly === nextCollision.editorModes?.fly
            && currentCollision.editorEnabled === nextCollision.editorEnabled
            && currentCollision.requestedMode === nextCollision.requestedMode
            && currentCollision.requestedEnabled === nextCollision.requestedEnabled
            && currentCollision.effectiveEnabled === nextCollision.effectiveEnabled
            && currentCollision.reason === nextCollision.reason
            && currentCollision.lastError === nextCollision.lastError;
        if (!force && unchanged) return current;
        return writeNavigation({ collision: nextCollision });
    };

    const setCollisionAvailability = ({
        available = false,
        status,
        lastError
    } = {}) => {
        const current = readNavigation();
        const currentCollision = createCollisionState(current.collision || {});
        const nextAvailable = available === true;
        const nextStatus = normalizeCollisionStatus(status, nextAvailable);
        const nextCollision = createCollisionState({
            ...currentCollision,
            available: nextAvailable,
            status: nextStatus,
            lastError: String(lastError || '').trim(),
            updatedAt: nowFn()
        });
        writeNavigation({ collision: nextCollision });
        return syncCollisionPolicy({ force: true });
    };

    const setEditorCollisionModes = (modes = {}, options = {}) => {
        const current = readNavigation();
        const currentCollision = createCollisionState(current.collision || {});
        const nextModes = {
            orbit: modes?.orbit === true
                ? true
                : (modes?.orbit === false ? false : currentCollision.editorModes?.orbit === true),
            walk: modes?.walk === true
                ? true
                : (modes?.walk === false ? false : currentCollision.editorModes?.walk === true),
            fly: modes?.fly === true
                ? true
                : (modes?.fly === false ? false : currentCollision.editorModes?.fly === true)
        };
        const unchanged = currentCollision.editorModes?.orbit === nextModes.orbit
            && currentCollision.editorModes?.walk === nextModes.walk
            && currentCollision.editorModes?.fly === nextModes.fly;
        if (!options.force && unchanged) {
            return syncCollisionPolicy();
        }
        writeNavigation({
            collision: createCollisionState({
                ...currentCollision,
                editorModes: nextModes,
                updatedAt: nowFn()
            })
        });
        return syncCollisionPolicy({ force: options.force === true });
    };

    const setViewerCollisionModes = (modes = {}, options = {}) => {
        const current = readNavigation();
        const currentCollision = createCollisionState(current.collision || {});
        const nextModes = {
            orbit: modes?.orbit === true
                ? true
                : (modes?.orbit === false ? false : currentCollision.viewerModes?.orbit === true),
            walk: modes?.walk === true
                ? true
                : (modes?.walk === false ? false : currentCollision.viewerModes?.walk === true),
            fly: modes?.fly === true
                ? true
                : (modes?.fly === false ? false : currentCollision.viewerModes?.fly === true)
        };
        const unchanged = currentCollision.viewerModes?.orbit === nextModes.orbit
            && currentCollision.viewerModes?.walk === nextModes.walk
            && currentCollision.viewerModes?.fly === nextModes.fly;
        if (!options.force && unchanged) {
            return syncCollisionPolicy();
        }
        writeNavigation({
            collision: createCollisionState({
                ...currentCollision,
                viewerModes: nextModes,
                updatedAt: nowFn()
            })
        });
        return syncCollisionPolicy({ force: options.force === true });
    };

    const setCollisionProfiles = (profiles = {}, options = {}) => {
        const current = readNavigation();
        const currentCollision = createCollisionState(current.collision || {});
        const nextViewerModes = {
            orbit: profiles?.viewerModes?.orbit === true
                ? true
                : (profiles?.viewerModes?.orbit === false ? false : currentCollision.viewerModes?.orbit === true),
            walk: profiles?.viewerModes?.walk === true
                ? true
                : (profiles?.viewerModes?.walk === false ? false : currentCollision.viewerModes?.walk === true),
            fly: profiles?.viewerModes?.fly === true
                ? true
                : (profiles?.viewerModes?.fly === false ? false : currentCollision.viewerModes?.fly === true)
        };
        const nextEditorModes = {
            orbit: profiles?.editorModes?.orbit === true
                ? true
                : (profiles?.editorModes?.orbit === false ? false : currentCollision.editorModes?.orbit === true),
            walk: profiles?.editorModes?.walk === true
                ? true
                : (profiles?.editorModes?.walk === false ? false : currentCollision.editorModes?.walk === true),
            fly: profiles?.editorModes?.fly === true
                ? true
                : (profiles?.editorModes?.fly === false ? false : currentCollision.editorModes?.fly === true)
        };
        const unchanged = currentCollision.viewerModes?.orbit === nextViewerModes.orbit
            && currentCollision.viewerModes?.walk === nextViewerModes.walk
            && currentCollision.viewerModes?.fly === nextViewerModes.fly
            && currentCollision.editorModes?.orbit === nextEditorModes.orbit
            && currentCollision.editorModes?.walk === nextEditorModes.walk
            && currentCollision.editorModes?.fly === nextEditorModes.fly;
        if (!options.force && unchanged) {
            return syncCollisionPolicy();
        }
        writeNavigation({
            collision: createCollisionState({
                ...currentCollision,
                viewerModes: nextViewerModes,
                editorModes: nextEditorModes,
                updatedAt: nowFn()
            })
        });
        return syncCollisionPolicy({ force: options.force === true });
    };

    const setCollisionProfileModeEnabled = (profileKey, mode, enabled, options = {}) => {
        const profile = profileKey === 'viewer' ? 'viewer' : 'editor';
        const normalizedMode = toMode(mode);
        const current = readNavigation();
        const currentCollision = createCollisionState(current.collision || {});
        if (profile === 'viewer') {
            const nextModes = {
                ...currentCollision.viewerModes,
                [normalizedMode]: enabled === true
            };
            return setViewerCollisionModes(nextModes, options);
        }
        const nextModes = {
            ...currentCollision.editorModes,
            [normalizedMode]: enabled === true
        };
        return setEditorCollisionModes(nextModes, options);
    };

    const setEditorCollisionModeEnabled = (mode, enabled, options = {}) => {
        return setCollisionProfileModeEnabled('editor', mode, enabled, options);
    };

    // Backward-compat setter kept for older call sites.
    // Legacy semantics map to the editor walk toggle.
    const setEditorCollisionEnabled = (enabled, options = {}) => (
        setEditorCollisionModeEnabled(NAV_MODES.WALK, enabled, options)
    );

    const setBoundaryBlockers = (blockers = [], options = {}) => {
        const current = readNavigation();
        const nextBoundaries = createBoundaryState({
            blockers: Array.isArray(blockers) ? blockers : []
        });
        const currentSerialized = JSON.stringify(current.boundaries?.blockers || []);
        const nextSerialized = JSON.stringify(nextBoundaries.blockers || []);
        if (!options.force && currentSerialized === nextSerialized) return current;
        return writeNavigation({
            boundaries: nextBoundaries
        });
    };

    const markTrigger = (eventName) => {
        writeNavigation({
            triggerHooks: {
                lastEvent: String(eventName || ''),
                lastEventAt: nowFn()
            }
        });
    };

    const beginTransition = ({ kind, targetViewId = '' } = {}) => {
        writeNavigation({
            transition: {
                active: true,
                kind: kind || NAV_TRANSITION_KINDS.NONE,
                targetViewId: String(targetViewId || '').trim(),
                startedAt: nowFn()
            }
        });
    };

    const endTransition = () => {
        writeNavigation({
            transition: {
                active: false,
                kind: NAV_TRANSITION_KINDS.NONE,
                targetViewId: '',
                startedAt: 0
            }
        });
    };

    const setMode = (mode, options = {}) => {
        const requestedMode = toMode(mode);
        const allowNonWalk = options.allowNonWalk === true || readIsEditorMode();
        const nextMode = allowNonWalk ? requestedMode : NAV_MODES.WALK;
        const current = readNavigation();
        if (!options.force && current.mode === nextMode) return current;
        if (!options.force && modeTransitionActive) return current;

        modeTransitionActive = true;
        try {
            const modeResult = typeof applyMode === 'function'
                ? applyMode(nextMode, {
                    ...options,
                    prevMode: current.mode
                })
                : { mode: nextMode };
            const appliedMode = toMode(modeResult?.mode || nextMode);
            const modeSwitchRejected = modeResult?.rejected === true;
            if (modeSwitchRejected) {
                events?.emit?.('nav_mode_change_rejected', {
                    requestedMode,
                    currentMode: current.mode,
                    reason: String(modeResult?.reason || 'mode_transition_rejected'),
                    source: options.source || 'runtime'
                });
                markTrigger('nav_mode_change_rejected');
                syncCollisionPolicy({ force: true });
                return current;
            }

            const next = writeNavigation({
                mode: appliedMode,
                cameraIntent: {
                    type: 'mode_change',
                    source: options.source || 'runtime',
                    targetMode: appliedMode,
                    targetViewId: '',
                    updatedAt: nowFn()
                }
            });
            if (current.movement?.state === NAV_MOVEMENT_STATES.MOVING && appliedMode !== current.mode) {
                stopMovement({ source: options.source || 'mode_change' });
            }
            const synced = syncCollisionPolicy();
            if (!options.silent) {
                events?.emit?.('nav_mode_changed', {
                    mode: appliedMode,
                    prevMode: current.mode,
                    source: options.source || 'runtime'
                });
                markTrigger('nav_mode_changed');
            }
            return synced || next;
        } finally {
            modeTransitionActive = false;
        }
    };

    const goToView = (viewId, options = {}) => {
        const normalizedId = String(viewId || '').trim();
        if (!normalizedId) return false;
        const views = typeof getViewDefinitions === 'function' ? getViewDefinitions() : [];
        const targetView = views.find((view) => String(view?.id || '').trim() === normalizedId);
        if (!targetView) return false;

        setMode(NAV_MODES.WALK, { source: options.source || 'view', silent: options.silentModeChange === true });
        beginTransition({
            kind: NAV_TRANSITION_KINDS.VIEW,
            targetViewId: targetView.id
        });
        writeNavigation({
            activeViewId: targetView.id,
            activeAnchorId: targetView.anchor?.id || '',
            cameraIntent: {
                type: 'view_transition',
                source: options.source || 'runtime',
                targetMode: NAV_MODES.WALK,
                targetViewId: targetView.id,
                updatedAt: nowFn()
            }
        });
        events?.emit?.('view_selected', {
            viewId: targetView.id,
            label: targetView.label || '',
            anchorId: targetView.anchor?.id || '',
            source: options.source || 'runtime'
        });
        markTrigger('view_selected');

        let transitionStarted = false;
        if (typeof startViewTransition === 'function') {
            transitionStarted = !!startViewTransition(targetView, {
                ...options,
                onComplete: () => {
                    endTransition();
                    const state = readNavigation();
                    writeNavigation({
                        location: {
                            ...state.location,
                            lastStableAnchorId: targetView.anchor?.id || state.location?.lastStableAnchorId || ''
                        }
                    });
                    if (typeof options.onComplete === 'function') options.onComplete();
                }
            });
        }
        if (!transitionStarted) {
            endTransition();
            if (typeof options.onComplete === 'function') options.onComplete();
        }
        return true;
    };

    const resetView = (options = {}) => {
        events?.emit?.('reset_triggered', { source: options.source || 'runtime' });
        markTrigger('reset_triggered');
        beginTransition({ kind: NAV_TRANSITION_KINDS.RESET });
        writeNavigation({
            cameraIntent: {
                type: 'reset',
                source: options.source || 'runtime',
                targetMode: NAV_MODES.WALK,
                targetViewId: '',
                updatedAt: nowFn()
            }
        });
        if (!options.keepMode) setMode(NAV_MODES.WALK, { source: options.source || 'reset', silent: true });
        if (typeof runResetView === 'function') runResetView(options);
        endTransition();
        return true;
    };

    const recoverToStableAnchor = (options = {}) => {
        events?.emit?.('recovery_triggered', { source: options.source || 'runtime' });
        markTrigger('recovery_triggered');
        beginTransition({ kind: NAV_TRANSITION_KINDS.RECOVERY });
        writeNavigation({
            cameraIntent: {
                type: 'recovery',
                source: options.source || 'runtime',
                targetMode: NAV_MODES.WALK,
                targetViewId: '',
                updatedAt: nowFn()
            }
        });
        const state = readNavigation();
        const stableAnchorId = String(state.location?.lastStableAnchorId || '').trim();
        if (!stableAnchorId) {
            endTransition();
            return resetView({ ...options, source: options.source || 'recovery' });
        }

        const views = typeof getViewDefinitions === 'function' ? getViewDefinitions() : [];
        const targetView = views.find((view) => String(view?.anchor?.id || '').trim() === stableAnchorId);
        endTransition();
        if (!targetView) {
            return resetView({ ...options, source: options.source || 'recovery' });
        }
        return goToView(targetView.id, { ...options, source: options.source || 'recovery' });
    };

    const startMovement = (inputMeta = {}) => {
        const state = readNavigation();
        if (state.movement?.state === NAV_MOVEMENT_STATES.MOVING) return state;
        const next = writeNavigation({
            movement: {
                state: NAV_MOVEMENT_STATES.MOVING,
                lastStartedAt: nowFn(),
                lastStoppedAt: state.movement?.lastStoppedAt || 0
            }
        });
        events?.emit?.('movement_started', {
            mode: state.mode,
            source: inputMeta.source || 'runtime',
            key: inputMeta.key || ''
        });
        markTrigger('movement_started');
        return next;
    };

    const stopMovement = (inputMeta = {}) => {
        const state = readNavigation();
        if (state.movement?.state !== NAV_MOVEMENT_STATES.MOVING) return state;
        const next = writeNavigation({
            movement: {
                state: NAV_MOVEMENT_STATES.IDLE,
                lastStartedAt: state.movement?.lastStartedAt || 0,
                lastStoppedAt: nowFn()
            }
        });
        events?.emit?.('movement_stopped', {
            mode: state.mode,
            source: inputMeta.source || 'runtime'
        });
        markTrigger('movement_stopped');
        return next;
    };

    const tick = ({ now = nowFn() } = {}) => {
        const current = readNavigation();
        const views = typeof getViewDefinitions === 'function' ? getViewDefinitions() : [];
        const anchors = buildAnchorsFromViews(views);
        if (!anchors.length || typeof getCameraPosition !== 'function') return current;
        const cameraPosition = getCameraPosition();
        const resolved = resolveLocationState({
            prevLocation: current.location,
            anchors,
            cameraPosition,
            activeViewId: current.activeViewId,
            transitionActive: !!current.transition?.active,
            now
        });
        const prevDistance = current.location?.nearestAnchorDistance;
        const nextDistance = resolved.location.nearestAnchorDistance;
        const prevDistanceValid = Number.isFinite(Number(prevDistance));
        const nextDistanceValid = Number.isFinite(Number(nextDistance));
        const distanceChanged = prevDistanceValid !== nextDistanceValid
            || (prevDistanceValid && nextDistanceValid && Math.abs(Number(prevDistance) - Number(nextDistance)) > 0.001);
        const hasMeaningfulChange = resolved.changes.anchorChanged
            || resolved.changes.zoneChanged
            || resolved.changes.stableAnchorChanged
            || distanceChanged;
        if (!hasMeaningfulChange) return current;
        const next = writeNavigation({
            location: resolved.location,
            activeAnchorId: resolved.location.nearestAnchorId || current.activeAnchorId || ''
        });
        if (resolved.changes.anchorChanged) {
            events?.emit?.('anchor_changed', {
                anchorId: resolved.location.nearestAnchorId || '',
                source: 'location_resolver'
            });
            markTrigger('anchor_changed');
        }
        if (resolved.changes.zoneChanged) {
            events?.emit?.('zone_changed', {
                zoneId: resolved.location.activeZoneId || '',
                source: 'location_resolver'
            });
            markTrigger('zone_changed');
        }
        if (resolved.changes.anchorChanged || resolved.changes.zoneChanged || resolved.changes.stableAnchorChanged) {
            events?.emit?.('location_changed', {
                location: resolved.location,
                source: 'location_resolver'
            });
            markTrigger('location_changed');
        }
        return next;
    };

    const isTransitionActive = () => (
        modeTransitionActive || readNavigation().transition?.active === true
    );

    return {
        getState: readNavigation,
        isTransitionActive,
        setMode,
        goToView,
        resetView,
        recoverToStableAnchor,
        setCollisionAvailability,
        setCollisionProfiles,
        setCollisionProfileModeEnabled,
        setViewerCollisionModes,
        setBoundaryBlockers,
        setEditorCollisionModes,
        setEditorCollisionModeEnabled,
        setEditorCollisionEnabled,
        syncCollisionPolicy,
        startMovement,
        stopMovement,
        tick
    };
};
