export const createViewerEngine = ({
    THREE,
    scene,
    renderer,
    camera,
    controls,
    pointerLockControl,
    LCCRender,
    qualityCaps,
    initialQualityMode,
    autoPerfEnabled = true,
    performanceMode = false,
    modeEnum,
    initialMode,
    onModeChanged,
    onFpsUpdated,
    onFovUpdated
} = {}) => {
    let qualityMode = initialQualityMode;
    let renderScale = 1.0;
    let dprCap = qualityCaps[qualityMode] ?? 1.25;
    let autoPerf = !!autoPerfEnabled;
    let perfMode = !!performanceMode;
    let fpsSampleFrames = 0;
    let fpsSampleTime = 0;
    let currentFps = 0;
    let lowFpsTime = 0;
    let highFpsTime = 0;
    let mode = initialMode || modeEnum.ORBIT;
    let cameraTween = null;
    const targetForward = new THREE.Vector3();
    const nextOrbitTarget = new THREE.Vector3();
    let lastOrbitDistance = 8;

    const clamp01 = (value) => Math.max(0, Math.min(1, value));
    const easeOutCubic = (t) => 1 - Math.pow(1 - clamp01(t), 3);

    const notifyFps = () => {
        if (typeof onFpsUpdated === 'function') {
            onFpsUpdated({ currentFps, renderScale, qualityMode, autoPerfEnabled: autoPerf, performanceMode: perfMode });
        }
    };

    const getRuntimeSnapshot = () => ({
        currentFps,
        renderScale,
        qualityMode,
        autoPerfEnabled: autoPerf,
        performanceMode: perfMode,
        mode
    });

    const applyRendererResolution = (width = window.innerWidth, height = window.innerHeight) => {
        dprCap = qualityCaps[qualityMode] ?? 1.25;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, dprCap) * renderScale;
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(width, height);
        notifyFps();
    };

    const updateAutoRenderScale = (deltaTime, width = window.innerWidth, height = window.innerHeight) => {
        if (!autoPerf) {
            lowFpsTime = 0;
            highFpsTime = 0;
            return;
        }
        if (currentFps > 0 && currentFps < 28) {
            lowFpsTime += deltaTime;
            highFpsTime = 0;
        } else if (currentFps > 55) {
            highFpsTime += deltaTime;
            lowFpsTime = 0;
        } else {
            lowFpsTime = 0;
            highFpsTime = 0;
        }

        if (lowFpsTime >= 2 && renderScale > 0.6) {
            renderScale = Math.max(0.6, Number((renderScale - 0.1).toFixed(2)));
            lowFpsTime = 0;
            applyRendererResolution(width, height);
        } else if (highFpsTime >= 5 && renderScale < 1.0) {
            renderScale = Math.min(1.0, Number((renderScale + 0.1).toFixed(2)));
            highFpsTime = 0;
            applyRendererResolution(width, height);
        }
    };

    const setMode = (nextMode) => {
        const prevMode = mode;
        if (prevMode === modeEnum.ORBIT) {
            const d = camera.position.distanceTo(controls.target);
            if (Number.isFinite(d) && d > 0.001) lastOrbitDistance = d;
        }
        mode = nextMode;
        const isOrbit = mode === modeEnum.ORBIT;
        if (!isOrbit && cameraTween?.kind === 'preset') {
            // Dropping into walk should not continue a long camera tween.
            cameraTween = null;
        }
        controls.enabled = isOrbit;
        if (isOrbit) {
            if (prevMode === modeEnum.WALK) {
                camera.getWorldDirection(targetForward);
                const currentDistance = camera.position.distanceTo(controls.target);
                const minDistance = Math.max(1.2, controls.minDistance || 1.2);
                const maxDistance = Math.max(minDistance + 0.1, Math.min(controls.maxDistance || 40, 40));
                let nextDistance = Number.isFinite(lastOrbitDistance) ? lastOrbitDistance : currentDistance;
                if (!Number.isFinite(nextDistance) || nextDistance <= 0.001) nextDistance = 8;
                nextDistance = THREE.MathUtils.clamp(nextDistance, minDistance, maxDistance);
                nextOrbitTarget.copy(camera.position).addScaledVector(targetForward, nextDistance);
                if (controls.target.distanceTo(nextOrbitTarget) > 0.001) {
                    cameraTween = {
                        kind: 'mode-handoff',
                        startTs: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
                        duration: 260,
                        easingFn: easeOutCubic,
                        fromPos: camera.position.clone(),
                        fromTarget: controls.target.clone(),
                        toPos: camera.position.clone(),
                        toTarget: nextOrbitTarget.clone(),
                        fromFov: camera.fov,
                        toFov: camera.fov
                    };
                } else {
                    controls.target.copy(nextOrbitTarget);
                }
            }
            if (pointerLockControl?.isLocked) pointerLockControl.unlock();
            controls.update();
        }
        if (typeof onModeChanged === 'function') onModeChanged({ prevMode, mode, isOrbit });
        return { prevMode, mode, isOrbit };
    };

    const getMode = () => mode;

    const setFov = (fov) => {
        camera.fov = fov;
        camera.updateProjectionMatrix();
        if (typeof onFovUpdated === 'function') onFovUpdated(camera.fov);
    };

    const setQuality = ({ qualityMode: nextQualityMode, autoPerfEnabled: nextAutoPerfEnabled, performanceMode: nextPerformanceMode } = {}) => {
        if (nextQualityMode !== undefined) qualityMode = nextQualityMode;
        if (nextAutoPerfEnabled !== undefined) {
            autoPerf = !!nextAutoPerfEnabled;
            lowFpsTime = 0;
            highFpsTime = 0;
        }
        if (nextPerformanceMode !== undefined) perfMode = !!nextPerformanceMode;
        applyRendererResolution();
        return getRuntimeSnapshot();
    };

    const setCameraTween = (tweenObjOrNull) => {
        cameraTween = tweenObjOrNull;
    };

    const updateCameraTween = (now) => {
        if (!cameraTween) return;
        const t = THREE.MathUtils.clamp((now - cameraTween.startTs) / cameraTween.duration, 0, 1);
        const eased = typeof cameraTween.easingFn === 'function'
            ? clamp01(cameraTween.easingFn(t))
            : (t < 0.5 ? (2 * t * t) : (1 - Math.pow(-2 * t + 2, 2) / 2));
        camera.position.lerpVectors(cameraTween.fromPos, cameraTween.toPos, eased);
        controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, eased);
        if (cameraTween.toFov !== cameraTween.fromFov) {
            camera.fov = THREE.MathUtils.lerp(cameraTween.fromFov, cameraTween.toFov, eased);
            camera.updateProjectionMatrix();
            if (typeof onFovUpdated === 'function') onFovUpdated(camera.fov);
        }
        if (typeof cameraTween.onUpdate === 'function') cameraTween.onUpdate({ t, eased });
        controls.update();
        if (t >= 1) {
            const completedTween = cameraTween;
            cameraTween = null;
            if (typeof completedTween.onComplete === 'function') completedTween.onComplete();
        }
    };

    const updateWalk = (deltaTime, {
        moveKeys,
        getBaseSpeed,
        walkHeightEnabled,
        onWalkHeightSync
    } = {}) => {
        if (mode !== modeEnum.WALK) return;
        const baseSpeed = typeof getBaseSpeed === 'function' ? getBaseSpeed() : 2;
        const boost = moveKeys.has('ShiftLeft') || moveKeys.has('ShiftRight') ? 3 : 1;
        const step = baseSpeed * boost * deltaTime;

        if (moveKeys.has('KeyW')) pointerLockControl.moveForward(step);
        if (moveKeys.has('KeyS')) pointerLockControl.moveForward(-step);
        if (moveKeys.has('KeyA')) pointerLockControl.moveRight(-step);
        if (moveKeys.has('KeyD')) pointerLockControl.moveRight(step);
        if (moveKeys.has('KeyE')) camera.position.addScaledVector(camera.up, step);
        if (moveKeys.has('KeyQ')) camera.position.addScaledVector(camera.up, -step);
        if (moveKeys.has('Space')) camera.position.addScaledVector(camera.up, step);
        if (moveKeys.has('KeyC')) camera.position.addScaledVector(camera.up, -step);
        if (walkHeightEnabled && typeof onWalkHeightSync === 'function') {
            onWalkHeightSync(camera.position.y);
        }
    };

    const resize = (width, height) => {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        applyRendererResolution(width, height);
    };

    const tick = ({
        now,
        delta,
        lccUpdate = true,
        threeRender = true,
        moveKeys,
        getBaseSpeed,
        walkHeightEnabled,
        onWalkHeightSync
    } = {}) => {
        fpsSampleFrames += 1;
        fpsSampleTime += delta;
        if (fpsSampleTime >= 0.5) {
            currentFps = fpsSampleFrames / fpsSampleTime;
            fpsSampleFrames = 0;
            fpsSampleTime = 0;
            notifyFps();
        }
        updateAutoRenderScale(delta);
        updateWalk(delta, { moveKeys, getBaseSpeed, walkHeightEnabled, onWalkHeightSync });
        updateCameraTween(now);
        if (mode === modeEnum.ORBIT) controls.update();
        if (lccUpdate) LCCRender.update();
        if (threeRender) renderer.render(scene, camera);
    };

    return {
        tick,
        resize,
        setMode,
        getMode,
        setFov,
        setQuality,
        applyRendererResolution,
        setCameraTween,
        updateCameraTween,
        updateWalk,
        getRuntimeSnapshot
    };
};
