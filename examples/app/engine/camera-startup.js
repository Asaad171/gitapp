export const fitCameraToBoundsState = ({
    THREE,
    bounds,
    camera,
    controls,
    fitDirection,
    onHeightRange,
    onHotspotScale
} = {}) => {
    if (!bounds?.min || !bounds?.max) return null;
    const min = new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z);
    const max = new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z);
    const center = min.clone().add(max).multiplyScalar(0.5);
    const size = max.clone().sub(min);
    let radius = size.length() * 0.5;
    if (!Number.isFinite(radius) || radius <= 0) radius = 1;

    controls.target.copy(center);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.6;
    controls.zoomSpeed = 0.8;
    controls.panSpeed = 0.6;
    controls.minDistance = radius * 0.05;
    controls.maxDistance = radius * 8;

    camera.position.copy(center).addScaledVector(fitDirection, radius * 2.2);
    camera.near = Math.max(0.01, radius / 200);
    camera.far = radius * 50;
    camera.updateProjectionMatrix();
    camera.lookAt(center);
    controls.update();

    if (typeof onHeightRange === 'function') {
        onHeightRange({
            minY: bounds.min.y - radius,
            maxY: bounds.max.y + radius,
            step: Math.max(0.01, radius / 300),
            valueY: camera.position.y
        });
    }
    if (typeof onHotspotScale === 'function') onHotspotScale(radius);
    return { min, max, center, size, radius };
};

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const cameraEasingFns = {
    linear: (t) => clamp01(t),
    easeInOutQuad: (t) => {
        const c = clamp01(t);
        return c < 0.5 ? (2 * c * c) : (1 - Math.pow(-2 * c + 2, 2) / 2);
    },
    cinematic: (t) => {
        const c = clamp01(t);
        // Smoothstep with a soft ease-out tail for less abrupt arrival.
        const smooth = c * c * (3 - 2 * c);
        return 1 - Math.pow(1 - smooth, 1.18);
    }
};

export const resolveCameraEasingFn = (easing = 'cinematic') => {
    if (typeof easing === 'function') return easing;
    if (typeof easing === 'string' && cameraEasingFns[easing]) return cameraEasingFns[easing];
    return cameraEasingFns.cinematic;
};

export const createCameraTransitionState = ({
    THREE,
    camera,
    controls,
    toPos,
    toTarget,
    fromFov,
    toFov,
    durationMs = 900,
    nowMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    easing = 'cinematic',
    kind = 'generic'
} = {}) => ({
    kind,
    startTs: nowMs,
    duration: Math.max(180, Number(durationMs) || 900),
    easingFn: resolveCameraEasingFn(easing),
    fromPos: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPos: toPos ? toPos.clone() : camera.position.clone(),
    toTarget: toTarget ? toTarget.clone() : controls.target.clone(),
    fromFov: Number.isFinite(fromFov) ? fromFov : camera.fov,
    toFov: Number.isFinite(toFov) ? toFov : camera.fov
});

export const animateCameraToPreset = ({
    THREE,
    camera,
    controls,
    preset,
    currentFov,
    applyPresetFov = false,
    durationMs,
    nowMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    easing = 'cinematic'
} = {}) => {
    const toPos = new THREE.Vector3(preset.position[0], preset.position[1], preset.position[2]);
    const toTarget = new THREE.Vector3(preset.target[0], preset.target[1], preset.target[2]);
    const moveDistance = camera.position.distanceTo(toPos);
    const targetShift = controls.target.distanceTo(toTarget);
    const autoDuration = THREE.MathUtils.clamp(760 + (moveDistance * 3.2) + (targetShift * 2.4), 760, 1500);
    return createCameraTransitionState({
        THREE,
        camera,
        controls,
        toPos,
        toTarget,
        fromFov: currentFov,
        toFov: (applyPresetFov && preset.fov !== null) ? THREE.MathUtils.clamp(preset.fov, 35, 90) : currentFov,
        durationMs: Number.isFinite(durationMs) ? durationMs : autoDuration,
        nowMs,
        easing,
        kind: 'preset'
    });
};

export const applyStartupViewOnceState = ({
    startupApplied = false,
    startupInputs,
    findPresetById,
    startPresetAnimation,
    resetView,
    applyFovFromQuery = true
} = {}) => {
    if (startupApplied) return { startupAppliedNext: true, applied: 'skipped' };
    const startupPlan = startupInputs.resolveStartupPlan({
        startParamRaw: startupInputs.startParamRaw,
        hasUrlViewOverrides: startupInputs.hasUrlViewOverrides,
        requestedStartPresetId: startupInputs.requestedStartPresetId,
        defaultStartPresetId: startupInputs.defaultStartPresetId
    });

    if (startupPlan.startType === 'preset') {
        const preset = findPresetById(startupPlan.presetId);
        if (preset) {
            startPresetAnimation(preset, { applyFov: applyFovFromQuery });
            return { startupAppliedNext: true, applied: 'preset' };
        }
    }
    resetView();
    return { startupAppliedNext: true, applied: 'home' };
};
