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
    let draggingHotspotId = '';
    let draggingPointerId = null;
    let draggingHotspotMoved = false;
    let controlsEnabledBeforeDrag = false;

    const createHotspotTexture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const cx = 64;
        const cy = 64;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Soft warm halo keeps markers legible against varied backgrounds.
        const halo = ctx.createRadialGradient(cx, cy, 8, cx, cy, 56);
        halo.addColorStop(0, 'rgba(217, 197, 178, 0.34)');
        halo.addColorStop(0.5, 'rgba(217, 197, 178, 0.18)');
        halo.addColorStop(1, 'rgba(217, 197, 178, 0)');
        ctx.beginPath();
        ctx.arc(cx, cy, 56, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, 24, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(31, 27, 24, 0.9)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, 24, 0, Math.PI * 2);
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = 'rgba(246, 236, 224, 0.78)';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, 13, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(21, 18, 16, 0.94)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, 5.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(217, 197, 178, 0.95)';
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    };

    const refreshSelectionVisual = (selectedHotspotId = '') => {
        hotspotSprites.forEach((sprite) => {
            const hotspotId = sprite.userData.hotspot?.id || '';
            const isSelected = !!selectedHotspotId && hotspotId === selectedHotspotId;
            const isDragging = !!draggingHotspotId && hotspotId === draggingHotspotId;
            const isHovered = !!hoveredHotspotId && hotspotId === hoveredHotspotId;

            let colorHex = 0xf2ebe2;
            let scale = hotspotScaleWorld;
            let opacity = 0.9;

            if (isHovered) {
                colorHex = 0xe8d8c7;
                scale = hotspotScaleWorld * 1.12;
                opacity = 0.95;
            }
            if (isSelected) {
                colorHex = 0xd9c5b2;
                scale = hotspotScaleWorld * 1.24;
                opacity = 0.98;
            }
            if (isDragging) {
                colorHex = 0xe9ba8f;
                scale = hotspotScaleWorld * 1.42;
                opacity = 1;
            }

            sprite.material.color.setHex(colorHex);
            sprite.material.opacity = opacity;
            sprite.scale.setScalar(scale);
        });
    };

    const setHoveredHotspot = (idOrNull, selectedHotspotId = '') => {
        hoveredHotspotId = idOrNull ? String(idOrNull) : '';
        refreshSelectionVisual(selectedHotspotId);
    };

    const addHotspotSprite = (hotspot, selectedHotspotId = '') => {
        if (!hotspotTexture) hotspotTexture = createHotspotTexture();
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: hotspotTexture,
            transparent: true,
            depthTest: false,
            depthWrite: false
        }));
        sprite.position.set(hotspot.position[0], hotspot.position[1], hotspot.position[2]);
        sprite.scale.setScalar(hotspotScaleWorld);
        sprite.userData.hotspot = hotspot;
        hotspotSprites.push(sprite);
        scene.add(sprite);
        refreshSelectionVisual(selectedHotspotId);
        return sprite;
    };

    const clearHotspots = () => {
        hotspotSprites.forEach((sprite) => {
            scene.remove(sprite);
        });
        hotspotSprites.length = 0;
        hoveredHotspotId = '';
    };

    const setHotspots = (hotspotConfigs, selectedHotspotId = '') => {
        clearHotspots();
        hotspotConfigs.forEach((hotspot) => {
            addHotspotSprite(hotspot, selectedHotspotId);
        });
        refreshSelectionVisual(selectedHotspotId);
    };

    const getSpriteById = (id) => hotspotSprites.find((s) => s.userData.hotspot?.id === id) || null;

    const removeHotspotById = (id, selectedHotspotId = '') => {
        const sprite = getSpriteById(id);
        if (!sprite) return false;
        scene.remove(sprite);
        const idx = hotspotSprites.indexOf(sprite);
        if (idx >= 0) hotspotSprites.splice(idx, 1);
        if (hoveredHotspotId === id) hoveredHotspotId = '';
        refreshSelectionVisual(selectedHotspotId);
        return true;
    };

    const updateHotspotScale = (radius, selectedHotspotId = '') => {
        hotspotScaleWorld = Math.max(1, radius * 0.03);
        refreshSelectionVisual(selectedHotspotId);
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
        return intersects.length ? intersects[0].object.userData.hotspot : null;
    };

    const beginDrag = ({ hotspot, pointerId, editEnabled, selectedHotspotId = '' } = {}) => {
        if (!editEnabled || !hotspot) return false;
        draggingHotspotId = hotspot.id;
        draggingPointerId = pointerId;
        draggingHotspotMoved = false;
        controlsEnabledBeforeDrag = controls.enabled;
        controls.enabled = false;
        refreshSelectionVisual(selectedHotspotId || hotspot.id);
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

    const endDrag = (selectedHotspotId = '') => {
        if (!draggingHotspotId) return { ended: false, moved: false };
        const endedHotspotId = draggingHotspotId;
        const moved = !!draggingHotspotMoved;
        draggingHotspotId = '';
        draggingPointerId = null;
        controls.enabled = controlsEnabledBeforeDrag;
        draggingHotspotMoved = false;
        refreshSelectionVisual(selectedHotspotId);
        return { ended: true, moved, hotspotId: endedHotspotId };
    };

    const getState = () => ({
        draggingHotspotId,
        draggingPointerId,
        draggingHotspotMoved,
        hoveredHotspotId,
        hotspotScaleWorld
    });

    return {
        setHotspots,
        addHotspotSprite,
        removeHotspotById,
        selectHotspot: refreshSelectionVisual,
        refreshSelectionVisual,
        setHoveredHotspot,
        updateHotspotScale,
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
