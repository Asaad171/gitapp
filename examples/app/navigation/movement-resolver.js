import { NAV_MODES } from './navigation-types.js';
import { resolveFlyMovementBasis } from './navigation-feel-config.js';

const hasMovementIntent = (moveKeys, movementKeyCodes) => {
    if (!(moveKeys instanceof Set) || !moveKeys.size) return false;
    if (!movementKeyCodes?.has) return false;
    for (const key of moveKeys) {
        if (movementKeyCodes.has(key)) return true;
    }
    return false;
};

export const applyMovementStep = ({
    THREE,
    mode,
    deltaTime,
    camera,
    pointerLockControl,
    moveKeys,
    movementKeyCodes,
    getBaseSpeed,
    walkHeightEnabled,
    onWalkHeightSync,
    collisionContext
} = {}) => {
    if (mode !== NAV_MODES.WALK && mode !== NAV_MODES.FLY) {
        return {
            moved: false,
            hasIntent: false
        };
    }

    const baseSpeed = typeof getBaseSpeed === 'function' ? getBaseSpeed() : 2;
    const boost = moveKeys.has('ShiftLeft') || moveKeys.has('ShiftRight') ? 3 : 1;
    const step = baseSpeed * boost * deltaTime;
    const hasIntent = hasMovementIntent(moveKeys, movementKeyCodes);
    let moved = false;

    if (mode === NAV_MODES.WALK) {
        if (moveKeys.has('KeyW')) { pointerLockControl.moveForward(step); moved = true; }
        if (moveKeys.has('KeyS')) { pointerLockControl.moveForward(-step); moved = true; }
        if (moveKeys.has('KeyA')) { pointerLockControl.moveRight(-step); moved = true; }
        if (moveKeys.has('KeyD')) { pointerLockControl.moveRight(step); moved = true; }
    } else if (mode === NAV_MODES.FLY) {
        const { forward, right, up } = resolveFlyMovementBasis({
            THREE,
            camera
        });
        if (moveKeys.has('KeyW')) { camera.position.addScaledVector(forward, step); moved = true; }
        if (moveKeys.has('KeyS')) { camera.position.addScaledVector(forward, -step); moved = true; }
        if (moveKeys.has('KeyA')) { camera.position.addScaledVector(right, -step); moved = true; }
        if (moveKeys.has('KeyD')) { camera.position.addScaledVector(right, step); moved = true; }
        if (moveKeys.has('KeyE')) { camera.position.addScaledVector(up, step); moved = true; }
        if (moveKeys.has('KeyQ')) { camera.position.addScaledVector(up, -step); moved = true; }
        if (moveKeys.has('Space')) { camera.position.addScaledVector(up, step); moved = true; }
        if (moveKeys.has('KeyC')) { camera.position.addScaledVector(up, -step); moved = true; }
    }

    if (walkHeightEnabled && typeof onWalkHeightSync === 'function') {
        onWalkHeightSync(camera.position.y);
    }

    resolveBoundaryConstraint({
        mode,
        camera,
        collisionContext
    });

    return {
        moved,
        hasIntent
    };
};

export const resolveBoundaryConstraint = ({
    mode = NAV_MODES.ORBIT,
    camera,
    collisionContext
} = {}) => {
    const blockers = collisionContext?.boundaries?.blockers;
    if (!Array.isArray(blockers) || !blockers.length || !camera?.position) {
        return {
            constrained: false,
            reason: 'no_blockers'
        };
    }
    // Placeholder hook for future invisible access boundaries.
    // This pass intentionally keeps blocker volumes inert for safe rollout.
    return {
        constrained: false,
        reason: `${mode}_blockers_pending`
    };
};
