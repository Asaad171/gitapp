import { VIOS_NAV_FEEL_TUNING } from '../navigation/navigation-feel-config.js';

const DEFAULT_CAPSULE_CONFIG = Object.freeze({
    ...VIOS_NAV_FEEL_TUNING.collision.capsule
});

const toPositiveNumber = (value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};

const resolveCapsuleConfig = (input = {}) => ({
    radius: toPositiveNumber(input.radius, DEFAULT_CAPSULE_CONFIG.radius),
    height: toPositiveNumber(input.height, DEFAULT_CAPSULE_CONFIG.height),
    headOffset: Number.isFinite(Number(input.headOffset))
        ? Number(input.headOffset)
        : DEFAULT_CAPSULE_CONFIG.headOffset,
    correctionEpsilon: toPositiveNumber(input.correctionEpsilon, DEFAULT_CAPSULE_CONFIG.correctionEpsilon),
    maxCorrectionPasses: Math.max(1, Math.min(2, Math.round(toPositiveNumber(input.maxCorrectionPasses, DEFAULT_CAPSULE_CONFIG.maxCorrectionPasses)))),
    maxCorrectionPerFrame: toPositiveNumber(input.maxCorrectionPerFrame, DEFAULT_CAPSULE_CONFIG.maxCorrectionPerFrame)
});

const sanitizeDeltaVector = (THREE, rawDelta) => {
    const x = Number(rawDelta?.x);
    const y = Number(rawDelta?.y);
    const z = Number(rawDelta?.z);
    return new THREE.Vector3(
        Number.isFinite(x) ? x : 0,
        Number.isFinite(y) ? y : 0,
        Number.isFinite(z) ? z : 0
    );
};

export const applyCollisionCorrection = ({
    THREE,
    camera,
    lccObj,
    capsuleConfig = {}
} = {}) => {
    if (!THREE || !camera?.position || typeof lccObj?.intersectsCapsule !== 'function') {
        return {
            hit: false,
            corrected: false,
            passes: 0,
            delta: { x: 0, y: 0, z: 0 }
        };
    }
    if (typeof lccObj.hasCollision === 'function' && lccObj.hasCollision() !== true) {
        return {
            hit: false,
            corrected: false,
            passes: 0,
            delta: { x: 0, y: 0, z: 0 }
        };
    }

    const cfg = resolveCapsuleConfig(capsuleConfig);
    const up = new THREE.Vector3().copy(camera.up);
    if (up.lengthSq() <= 0.000001) up.set(0, 1, 0);
    else up.normalize();

    const totalDelta = new THREE.Vector3();
    let hit = false;
    let passes = 0;

    // Keep collision correction lightweight and stable:
    // limited passes + per-frame clamp reduce visible snapping.
    for (let pass = 0; pass < cfg.maxCorrectionPasses; pass += 1) {
        const start = new THREE.Vector3().copy(camera.position).addScaledVector(up, cfg.headOffset);
        const end = new THREE.Vector3().copy(start).addScaledVector(up, -cfg.height);
        let response = null;
        try {
            response = lccObj.intersectsCapsule({
                start: { x: start.x, y: start.y, z: start.z },
                end: { x: end.x, y: end.y, z: end.z },
                radius: cfg.radius
            });
        } catch (error) {
            return {
                hit: false,
                corrected: false,
                passes,
                delta: { x: totalDelta.x, y: totalDelta.y, z: totalDelta.z },
                error
            };
        }

        if (!response?.hit) break;
        hit = true;

        const correction = sanitizeDeltaVector(THREE, response.delta);
        const correctionLen = correction.length();
        if (correctionLen <= cfg.correctionEpsilon) break;

        if (correctionLen > cfg.maxCorrectionPerFrame) {
            correction.multiplyScalar(cfg.maxCorrectionPerFrame / correctionLen);
        }

        camera.position.add(correction);
        totalDelta.add(correction);
        passes += 1;

        if (correction.lengthSq() <= cfg.correctionEpsilon * cfg.correctionEpsilon) break;
    }

    return {
        hit,
        corrected: totalDelta.lengthSq() > cfg.correctionEpsilon * cfg.correctionEpsilon,
        passes,
        delta: { x: totalDelta.x, y: totalDelta.y, z: totalDelta.z }
    };
};

const toDeltaVector = (THREE, delta) => new THREE.Vector3(
    Number(delta?.x) || 0,
    Number(delta?.y) || 0,
    Number(delta?.z) || 0
);

export const applyFrameCollisionCorrection = ({
    THREE,
    mode = 'orbit',
    movedThisFrame = false,
    camera,
    controls,
    collisionContext
} = {}) => {
    const collisionState = collisionContext?.collisionState || {};
    if (collisionState.effectiveEnabled !== true) {
        return {
            applied: false,
            corrected: false,
            reason: 'collision_disabled'
        };
    }
    if (movedThisFrame !== true) {
        return {
            applied: false,
            corrected: false,
            reason: 'camera_static'
        };
    }

    const correction = applyCollisionCorrection({
        THREE,
        camera,
        lccObj: collisionContext?.lccObj,
        capsuleConfig: collisionContext?.capsuleConfig
    });
    if (!correction.corrected) {
        return {
            ...correction,
            applied: true,
            reason: correction.hit ? 'collision_hit_no_delta' : 'no_collision_hit'
        };
    }

    const deltaVec = toDeltaVector(THREE, correction.delta);
    // Orbit controls maintain their own spherical state around target.
    // Shift target by the same correction to avoid control jitter when constrained.
    if (mode === 'orbit' && controls?.target && typeof controls.target.add === 'function') {
        controls.target.add(deltaVec);
    }

    return {
        ...correction,
        applied: true,
        reason: 'collision_corrected'
    };
};
