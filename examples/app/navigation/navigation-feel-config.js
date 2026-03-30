export const VIOS_NAV_FEEL_TUNING = Object.freeze({
    startup: {
        defaultMode: 'walk'
    },
    walk: {
        // Approximate standing eye level for a grounded, human-scale walk feel.
        defaultEyeHeight: 1.62
    },
    fly: {
        horizontalForwardEpsilon: 0.000001
    },
    camera: {
        initialNear: 0.05,
        fitNearDivisor: 1000,
        fitNearMin: 0.02,
        fitNearMax: 0.10,
        fitFarMultiplier: 50
    },
    collision: {
        capsule: {
            radius: 0.28,
            height: 1.65,
            headOffset: 0.08,
            correctionEpsilon: 0.0002,
            maxCorrectionPasses: 2,
            maxCorrectionPerFrame: 0.65
        }
    }
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const computeAdaptiveNearPlane = (radiusValue) => {
    const radius = Number(radiusValue);
    if (!Number.isFinite(radius) || radius <= 0) return VIOS_NAV_FEEL_TUNING.camera.initialNear;
    return clamp(
        radius / VIOS_NAV_FEEL_TUNING.camera.fitNearDivisor,
        VIOS_NAV_FEEL_TUNING.camera.fitNearMin,
        VIOS_NAV_FEEL_TUNING.camera.fitNearMax
    );
};

const resolveUpVector = (THREE, camera) => {
    const up = new THREE.Vector3(0, 1, 0);
    if (camera?.up && typeof up.copy === 'function') up.copy(camera.up);
    if (up.lengthSq() <= VIOS_NAV_FEEL_TUNING.fly.horizontalForwardEpsilon) up.set(0, 1, 0);
    return up.normalize();
};

const resolveYawFallbackForward = (THREE, camera) => {
    const yaw = Number.isFinite(Number(camera?.rotation?.y)) ? Number(camera.rotation.y) : 0;
    const fallbackForward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    if (fallbackForward.lengthSq() <= VIOS_NAV_FEEL_TUNING.fly.horizontalForwardEpsilon) {
        fallbackForward.set(0, 0, -1);
    }
    return fallbackForward.normalize();
};

export const resolveFlyMovementBasis = ({
    THREE,
    camera
} = {}) => {
    const up = resolveUpVector(THREE, camera);
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() <= VIOS_NAV_FEEL_TUNING.fly.horizontalForwardEpsilon) {
        forward.copy(resolveYawFallbackForward(THREE, camera));
    } else {
        forward.normalize();
    }

    const right = new THREE.Vector3().crossVectors(forward, up);
    if (right.lengthSq() <= VIOS_NAV_FEEL_TUNING.fly.horizontalForwardEpsilon) {
        right.set(1, 0, 0);
    } else {
        right.normalize();
    }

    return { forward, right, up };
};
