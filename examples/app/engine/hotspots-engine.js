const HOTSPOT_VISIBILITY_POLICY = {
    VIEWER: 'viewer',
    EDITOR: 'editor'
};

const HOTSPOT_TYPE_ACCENTS = {
    info: 0xf3ede5,
    link: 0xe8dfd2,
    cta: 0xe0ccb8
};

const HOTSPOT_STATE_STYLE = {
    default: { scale: 1.0, opacity: 0.88, mix: 0.0, pulseAmp: 0.0 },
    hover: { scale: 1.11, opacity: 0.95, mix: 0.12, pulseAmp: 0.0 },
    active: { scale: 1.2, opacity: 0.97, mix: 0.2, pulseAmp: 0.035 },
    selected: { scale: 1.3, opacity: 0.99, mix: 0.3, pulseAmp: 0.0 },
    dragging: { scale: 1.42, opacity: 1.0, mix: 0.45, pulseAmp: 0.0 }
};

const GOLD_HIGHLIGHT_HEX = 0xe8d6c4;
const DRAG_HIGHLIGHT_HEX = 0xe9ba8f;

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const clampLerpAlpha = (deltaSec) => {
    const dt = Number.isFinite(deltaSec) ? deltaSec : 1 / 60;
    return Math.max(0.08, Math.min(0.42, dt * 12));
};

const sanitizePolicy = (policy) => {
    if (policy === HOTSPOT_VISIBILITY_POLICY.EDITOR) return HOTSPOT_VISIBILITY_POLICY.EDITOR;
    return HOTSPOT_VISIBILITY_POLICY.VIEWER;
};

const sanitizeHotspotType = (typeValue) => {
    if (typeValue === 'link' || typeValue === 'cta') return typeValue;
    return 'info';
};

export const createHotspotEngine = ({
    THREE,
    scene,
    camera,
    rendererDom,
    loadingOverlay,
    getLccObj,
    controls
} = {}) => {
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const hotspotSprites = [];
    let hotspotTexture = null;
    let hotspotScaleWorld = 1;
    let hoveredHotspotId = '';
    let activeHotspotId = '';
    let selectedHotspotId = '';
    let draggingHotspotId = '';
    let draggingPointerId = null;
    let draggingHotspotMoved = false;
    let controlsEnabledBeforeDrag = false;
    let visibilityPolicy = HOTSPOT_VISIBILITY_POLICY.VIEWER;
    const rayHitVector = new THREE.Vector3();
    const hotspotDistanceVector = new THREE.Vector3();
    const colorScratchA = new THREE.Color();
    const colorScratchB = new THREE.Color(GOLD_HIGHLIGHT_HEX);

    const createHotspotTexture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 160;
        const ctx = canvas.getContext('2d');
        const cx = 80;
        const cy = 80;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const outerHalo = ctx.createRadialGradient(cx, cy, 8, cx, cy, 72);
        outerHalo.addColorStop(0, 'rgba(217, 197, 178, 0.26)');
        outerHalo.addColorStop(0.56, 'rgba(217, 197, 178, 0.12)');
        outerHalo.addColorStop(1, 'rgba(217, 197, 178, 0)');
        ctx.beginPath();
        ctx.arc(cx, cy, 72, 0, Math.PI * 2);
        ctx.fillStyle = outerHalo;
        ctx.fill();

        const innerRing = ctx.createRadialGradient(cx, cy, 14, cx, cy, 30);
        innerRing.addColorStop(0, 'rgba(248, 240, 232, 0.92)');
        innerRing.addColorStop(0.72, 'rgba(236, 225, 214, 0.56)');
        innerRing.addColorStop(1, 'rgba(236, 225, 214, 0.08)');
        ctx.beginPath();
        ctx.arc(cx, cy, 30, 0, Math.PI * 2);
        ctx.fillStyle = innerRing;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, 23, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(24, 21, 18, 0.9)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, 23, 0, Math.PI * 2);
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = 'rgba(244, 233, 220, 0.72)';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(217, 197, 178, 0.94)';
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    };

    const getSpriteVisual = (sprite) => {
        if (!sprite.userData.visual) {
            const materialColor = sprite.material?.color
                ? sprite.material.color.clone()
                : new THREE.Color(HOTSPOT_TYPE_ACCENTS.info);
            const scale = sprite.scale?.x || hotspotScaleWorld;
            const opacity = Number.isFinite(sprite.material?.opacity) ? sprite.material.opacity : 0.9;
            sprite.userData.visual = {
                currentScale: scale,
                targetScale: scale,
                currentOpacity: opacity,
                targetOpacity: opacity,
                currentColor: materialColor.clone(),
                targetColor: materialColor.clone()
            };
        }
        return sprite.userData.visual;
    };

    const applyMaterialDepthPolicy = () => {
        const depthTestEnabled = visibilityPolicy === HOTSPOT_VISIBILITY_POLICY.VIEWER;
        hotspotSprites.forEach((sprite) => {
            const material = sprite.material;
            if (!material) return;
            if (material.depthTest !== depthTestEnabled) {
                material.depthTest = depthTestEnabled;
                material.needsUpdate = true;
            }
            material.depthWrite = false;
            sprite.renderOrder = depthTestEnabled ? 3 : 35;
        });
    };

    const getDistanceScaleFactor = (sprite) => {
        const distance = camera.position.distanceTo(sprite.position);
        const base = THREE.MathUtils.clamp(0.76 + distance * 0.008, 0.82, 1.34);
        if (visibilityPolicy === HOTSPOT_VISIBILITY_POLICY.EDITOR) return base * 1.08;
        return base;
    };

    const getVisualState = (spriteHotspotId) => {
        if (draggingHotspotId && draggingHotspotId === spriteHotspotId) return 'dragging';
        if (selectedHotspotId && selectedHotspotId === spriteHotspotId) return 'selected';
        if (activeHotspotId && activeHotspotId === spriteHotspotId) return 'active';
        if (hoveredHotspotId && hoveredHotspotId === spriteHotspotId) return 'hover';
        return 'default';
    };

    const computeTargetStyle = ({ hotspot, state, nowMs, sprite }) => {
        const type = sanitizeHotspotType(hotspot?.type);
        const stateStyle = HOTSPOT_STATE_STYLE[state] || HOTSPOT_STATE_STYLE.default;
        const baseAccentHex = HOTSPOT_TYPE_ACCENTS[type] || HOTSPOT_TYPE_ACCENTS.info;
        const targetColor = colorScratchA.setHex(baseAccentHex).clone();

        if (state === 'dragging') {
            targetColor.setHex(DRAG_HIGHLIGHT_HEX);
        } else if (stateStyle.mix > 0) {
            targetColor.lerp(colorScratchB, clamp01(stateStyle.mix));
        }

        const distanceFactor = getDistanceScaleFactor(sprite);
        let pulse = 1;
        if (state === 'active' && stateStyle.pulseAmp > 0) {
            const phase = nowMs * 0.0022;
            pulse += Math.sin(phase) * stateStyle.pulseAmp;
        }

        return {
            targetColor,
            targetScale: hotspotScaleWorld * distanceFactor * stateStyle.scale * pulse,
            targetOpacity: stateStyle.opacity
        };
    };

    const refreshSelectionVisual = (nextSelectedHotspotId = selectedHotspotId) => {
        selectedHotspotId = nextSelectedHotspotId ? String(nextSelectedHotspotId) : '';
        applyMaterialDepthPolicy();
    };

    const setHoveredHotspot = (idOrNull, nextSelectedHotspotId = selectedHotspotId) => {
        hoveredHotspotId = idOrNull ? String(idOrNull) : '';
        refreshSelectionVisual(nextSelectedHotspotId);
    };

    const setActiveHotspot = (idOrNull, nextSelectedHotspotId = selectedHotspotId) => {
        activeHotspotId = idOrNull ? String(idOrNull) : '';
        refreshSelectionVisual(nextSelectedHotspotId);
    };

    const tickVisuals = ({ nowMs = performance.now(), deltaSec = 1 / 60 } = {}) => {
        if (!hotspotSprites.length) return;
        const lerpAlpha = clampLerpAlpha(deltaSec);

        hotspotSprites.forEach((sprite) => {
            const hotspot = sprite.userData.hotspot;
            if (!hotspot) return;
            const visual = getSpriteVisual(sprite);
            const state = getVisualState(hotspot.id);
            const targets = computeTargetStyle({
                hotspot,
                state,
                nowMs,
                sprite
            });
            visual.targetScale = targets.targetScale;
            visual.targetOpacity = targets.targetOpacity;
            visual.targetColor.copy(targets.targetColor);

            visual.currentScale += (visual.targetScale - visual.currentScale) * lerpAlpha;
            visual.currentOpacity += (visual.targetOpacity - visual.currentOpacity) * lerpAlpha;
            visual.currentColor.lerp(visual.targetColor, lerpAlpha);

            sprite.scale.setScalar(visual.currentScale);
            sprite.material.opacity = visual.currentOpacity;
            sprite.material.color.copy(visual.currentColor);
        });
    };

    const addHotspotSprite = (hotspot, nextSelectedHotspotId = selectedHotspotId) => {
        if (!hotspotTexture) hotspotTexture = createHotspotTexture();
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: hotspotTexture,
            transparent: true,
            depthTest: visibilityPolicy === HOTSPOT_VISIBILITY_POLICY.VIEWER,
            depthWrite: false
        }));
        sprite.position.set(hotspot.position[0], hotspot.position[1], hotspot.position[2]);
        sprite.scale.setScalar(hotspotScaleWorld);
        sprite.userData.hotspot = hotspot;
        hotspotSprites.push(sprite);
        scene.add(sprite);
        refreshSelectionVisual(nextSelectedHotspotId);
        tickVisuals({ nowMs: performance.now(), deltaSec: 1 / 60 });
        return sprite;
    };

    const clearHotspots = () => {
        hotspotSprites.forEach((sprite) => {
            scene.remove(sprite);
        });
        hotspotSprites.length = 0;
        hoveredHotspotId = '';
        activeHotspotId = '';
    };

    const setHotspots = (hotspotConfigs, nextSelectedHotspotId = selectedHotspotId) => {
        clearHotspots();
        hotspotConfigs.forEach((hotspot) => {
            addHotspotSprite(hotspot, nextSelectedHotspotId);
        });
        refreshSelectionVisual(nextSelectedHotspotId);
        tickVisuals({ nowMs: performance.now(), deltaSec: 1 / 60 });
    };

    const getSpriteById = (id) => hotspotSprites.find((s) => s.userData.hotspot?.id === id) || null;

    const removeHotspotById = (id, nextSelectedHotspotId = selectedHotspotId) => {
        const sprite = getSpriteById(id);
        if (!sprite) return false;
        scene.remove(sprite);
        const idx = hotspotSprites.indexOf(sprite);
        if (idx >= 0) hotspotSprites.splice(idx, 1);
        if (hoveredHotspotId === id) hoveredHotspotId = '';
        if (activeHotspotId === id) activeHotspotId = '';
        refreshSelectionVisual(nextSelectedHotspotId);
        return true;
    };

    const updateHotspotScale = (radius, nextSelectedHotspotId = selectedHotspotId) => {
        const fallbackScale = Number.isFinite(radius) ? radius * 0.028 : hotspotScaleWorld;
        hotspotScaleWorld = THREE.MathUtils.clamp(Math.max(0.9, fallbackScale), 0.9, 10);
        refreshSelectionVisual(nextSelectedHotspotId);
        return hotspotScaleWorld;
    };

    const screenToWorld = (event) => {
        const lccObj = getLccObj ? getLccObj() : null;
        if (!lccObj || typeof lccObj.raycast !== 'function') {
            return { point: null, reason: 'Raycast unavailable' };
        }
        try {
            const hit = lccObj.raycast({
                evt: { x: event.clientX, y: event.clientY },
                maxDistance: 1e6,
                radius: 0.1
            });
            if (hit && Number.isFinite(hit.x) && Number.isFinite(hit.y) && Number.isFinite(hit.z)) {
                return { point: hit };
            }
        } catch {
            // best effort fallback
        }
        return { point: null, reason: 'Raycast unavailable' };
    };

    const pickFromPointer = (event) => {
        if (!hotspotSprites.length || !loadingOverlay.classList.contains('hidden')) return null;
        const rect = rendererDom.getBoundingClientRect();
        pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointerNdc, camera);
        const intersects = raycaster.intersectObjects(hotspotSprites, false);
        if (!intersects.length) return null;

        if (visibilityPolicy !== HOTSPOT_VISIBILITY_POLICY.VIEWER) {
            return intersects[0].object.userData.hotspot;
        }

        const worldHit = screenToWorld(event);
        let collisionDistance = Infinity;
        if (worldHit.point) {
            rayHitVector.set(worldHit.point.x, worldHit.point.y, worldHit.point.z);
            collisionDistance = camera.position.distanceTo(rayHitVector);
        }

        for (const intersection of intersects) {
            const hotspot = intersection.object?.userData?.hotspot;
            if (!hotspot) continue;
            if (!Number.isFinite(collisionDistance)) return hotspot;
            hotspotDistanceVector.set(
                hotspot.position[0],
                hotspot.position[1],
                hotspot.position[2]
            );
            const hotspotDistance = camera.position.distanceTo(hotspotDistanceVector);
            const occlusionMargin = Math.max(0.08, (intersection.object.scale?.x || hotspotScaleWorld) * 0.28);
            const occluded = collisionDistance + occlusionMargin < hotspotDistance;
            if (!occluded) return hotspot;
        }
        return null;
    };

    const beginDrag = ({ hotspot, pointerId, editEnabled, selectedHotspotId: dragSelectedHotspotId = '' } = {}) => {
        if (!editEnabled || !hotspot) return false;
        draggingHotspotId = hotspot.id;
        draggingPointerId = pointerId;
        draggingHotspotMoved = false;
        controlsEnabledBeforeDrag = controls.enabled;
        controls.enabled = false;
        refreshSelectionVisual(dragSelectedHotspotId || hotspot.id);
        return true;
    };

    const dragFromPointer = (event, { hotspot, applySnapY, setHotspotPosition } = {}) => {
        if (!draggingHotspotId || draggingPointerId !== event.pointerId) return { moved: false };
        if (!hotspot) return { moved: false, missingHotspot: true };
        const hit = screenToWorld(event);
        if (!hit.point) return { moved: false };
        const point = typeof applySnapY === 'function'
            ? applySnapY({ ...hit.point })
            : { ...hit.point };
        if (typeof setHotspotPosition === 'function') setHotspotPosition(hotspot, point);
        draggingHotspotMoved = true;
        return { moved: true };
    };

    const endDrag = (nextSelectedHotspotId = selectedHotspotId) => {
        if (!draggingHotspotId) return { ended: false, moved: false };
        const endedHotspotId = draggingHotspotId;
        const moved = !!draggingHotspotMoved;
        draggingHotspotId = '';
        draggingPointerId = null;
        controls.enabled = controlsEnabledBeforeDrag;
        draggingHotspotMoved = false;
        refreshSelectionVisual(nextSelectedHotspotId);
        return { ended: true, moved, hotspotId: endedHotspotId };
    };

    const setVisibilityPolicy = (policyValue, nextSelectedHotspotId = selectedHotspotId) => {
        visibilityPolicy = sanitizePolicy(policyValue);
        refreshSelectionVisual(nextSelectedHotspotId);
        tickVisuals({ nowMs: performance.now(), deltaSec: 1 / 60 });
    };

    const getState = () => ({
        draggingHotspotId,
        draggingPointerId,
        draggingHotspotMoved,
        hoveredHotspotId,
        activeHotspotId,
        selectedHotspotId,
        hotspotScaleWorld,
        visibilityPolicy
    });

    return {
        setHotspots,
        addHotspotSprite,
        removeHotspotById,
        selectHotspot: refreshSelectionVisual,
        refreshSelectionVisual,
        setHoveredHotspot,
        setActiveHotspot,
        setVisibilityPolicy,
        updateHotspotScale,
        tick: tickVisuals,
        pickFromPointer,
        screenToWorld,
        beginDrag,
        dragFromPointer,
        endDrag,
        getSpriteById,
        getSprites: () => hotspotSprites,
        getState
    };
};
