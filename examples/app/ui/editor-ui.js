const formatVec3 = (arr) => `${arr[0].toFixed(3)}, ${arr[1].toFixed(3)}, ${arr[2].toFixed(3)}`;

export const createEditorUi = ({
    elements,
    store
} = {}) => {
    const {
        editorHotspotList,
        editorPresetList,
        hotspotEditorHint,
        presetEditorHint,
        editorDirty,
        editorStatus,
        selectedHotspotPos,
        undoBtn,
        redoBtn,
        snapYValue
    } = elements;

    const setStatus = (text) => {
        editorStatus.textContent = text || '';
        if (store?.setState) store.setState({ editorStatus: text || '' });
    };

    const setDirty = (isDirty) => {
        const dirty = !!isDirty;
        editorDirty.textContent = dirty ? 'Dirty' : 'Saved';
        editorDirty.style.color = dirty ? '#ffd08a' : '#a5d2ff';
        if (store?.setState) store.setState({ editorDirty: dirty });
    };

    const setHistoryButtons = ({ canUndo, canRedo }) => {
        undoBtn.disabled = !canUndo;
        redoBtn.disabled = !canRedo;
    };

    const updateSelectedHotspotPos = (hotspotOrNull) => {
        if (!hotspotOrNull) {
            selectedHotspotPos.textContent = 'Selected XYZ: --';
            return;
        }
        selectedHotspotPos.textContent = `Selected XYZ: ${formatVec3(hotspotOrNull.position)}`;
    };

    const focusSelectedHotspotLabel = () => {
        requestAnimationFrame(() => {
            const input = editorHotspotList.querySelector('.editorItem.selected .hotspotLabelInput');
            if (input) {
                input.focus();
                input.select();
            }
        });
    };

    const focusSelectedPresetLabel = () => {
        requestAnimationFrame(() => {
            const input = editorPresetList.querySelector('.editorItem.selected .presetLabelInput');
            if (input) {
                input.focus();
                input.select();
            }
        });
    };

    const renderHotspotList = ({
        editEnabled,
        hotspots,
        selectedHotspotId,
        handlers = {}
    }) => {
        if (!editEnabled) return;
        editorHotspotList.innerHTML = '';
        hotspotEditorHint.textContent = selectedHotspotId
            ? 'Editing selected hotspot'
            : 'Select a hotspot to edit';
        hotspots.forEach((hotspot) => {
            const item = document.createElement('div');
            item.className = 'editorItem';
            const isSelected = hotspot.id === selectedHotspotId;
            if (isSelected) item.classList.add('selected');

            const top = document.createElement('div');
            top.className = 'editorItemTop';
            const title = document.createElement('strong');
            title.textContent = hotspot.id;
            top.appendChild(title);
            item.appendChild(top);

            if (isSelected) {
                const labelInput = document.createElement('input');
                labelInput.className = 'hotspotLabelInput';
                labelInput.value = hotspot.label;
                labelInput.placeholder = 'Label';
                let committedLabel = hotspot.label;
                labelInput.addEventListener('input', () => {
                    hotspot.label = labelInput.value;
                    if (typeof handlers.touchEditor === 'function') handlers.touchEditor();
                });
                labelInput.addEventListener('change', () => {
                    const normalized = labelInput.value.trim() || 'Hotspot';
                    const changed = normalized !== committedLabel;
                    labelInput.value = normalized;
                    hotspot.label = normalized;
                    if (changed) {
                        committedLabel = normalized;
                        if (typeof handlers.touchEditor === 'function') handlers.touchEditor();
                        if (typeof handlers.pushHistory === 'function') handlers.pushHistory('hotspot renamed');
                    }
                });
                item.appendChild(labelInput);

                const typeSelect = document.createElement('select');
                let committedType = hotspot.type;
                ['info', 'link', 'cta'].forEach((t) => {
                    const opt = document.createElement('option');
                    opt.value = t;
                    opt.textContent = t;
                    if (hotspot.type === t) opt.selected = true;
                    typeSelect.appendChild(opt);
                });
                item.appendChild(typeSelect);

                const urlInput = document.createElement('input');
                urlInput.value = hotspot.actionUrl || '';
                urlInput.placeholder = 'Action URL (optional)';
                item.appendChild(urlInput);

                const updateUrlState = () => {
                    const needsUrl = hotspot.type === 'link' || hotspot.type === 'cta';
                    urlInput.disabled = !needsUrl;
                    urlInput.style.display = needsUrl ? '' : 'none';
                };

                typeSelect.addEventListener('change', () => {
                    hotspot.type = typeSelect.value;
                    if (typeof handlers.touchEditor === 'function') handlers.touchEditor();
                    if (hotspot.type !== committedType) {
                        committedType = hotspot.type;
                        if (typeof handlers.pushHistory === 'function') handlers.pushHistory('hotspot type changed');
                    }
                    updateUrlState();
                });
                let committedUrl = hotspot.actionUrl || '';
                urlInput.addEventListener('input', () => {
                    hotspot.actionUrl = urlInput.value.trim();
                    if (typeof handlers.touchEditor === 'function') handlers.touchEditor();
                });
                urlInput.addEventListener('change', () => {
                    const normalizedUrl = urlInput.value.trim();
                    const changed = normalizedUrl !== committedUrl;
                    hotspot.actionUrl = normalizedUrl;
                    urlInput.value = normalizedUrl;
                    if (changed) {
                        committedUrl = normalizedUrl;
                        if (typeof handlers.touchEditor === 'function') handlers.touchEditor();
                        if (typeof handlers.pushHistory === 'function') handlers.pushHistory('hotspot url changed');
                    }
                });
                updateUrlState();

                const ensureCard = () => {
                    if (!hotspot.card || typeof hotspot.card !== 'object') hotspot.card = {};
                    return hotspot.card;
                };
                const card = ensureCard();
                const cardHint = document.createElement('div');
                cardHint.className = 'editorHint';
                cardHint.textContent = 'Viewer card content (optional)';
                item.appendChild(cardHint);

                const createCardInput = ({ placeholder, field, historyLabel }) => {
                    const input = document.createElement('input');
                    input.className = `hotspotCard${field.charAt(0).toUpperCase()}${field.slice(1)}Input`;
                    input.placeholder = placeholder;
                    input.value = typeof card[field] === 'string' ? card[field] : '';
                    let committed = input.value;
                    input.addEventListener('input', () => {
                        ensureCard()[field] = input.value;
                        if (typeof handlers.touchEditor === 'function') handlers.touchEditor();
                    });
                    input.addEventListener('change', () => {
                        const normalized = input.value.trim();
                        const changed = normalized !== committed;
                        ensureCard()[field] = normalized;
                        input.value = normalized;
                        if (changed) {
                            committed = normalized;
                            if (typeof handlers.touchEditor === 'function') handlers.touchEditor();
                            if (typeof handlers.pushHistory === 'function') handlers.pushHistory(historyLabel);
                        }
                    });
                    item.appendChild(input);
                };

                createCardInput({
                    placeholder: 'Card eyebrow (optional)',
                    field: 'eyebrow',
                    historyLabel: 'hotspot card eyebrow changed'
                });
                createCardInput({
                    placeholder: 'Card title (optional)',
                    field: 'title',
                    historyLabel: 'hotspot card title changed'
                });
                createCardInput({
                    placeholder: 'Card description (optional)',
                    field: 'description',
                    historyLabel: 'hotspot card description changed'
                });
                createCardInput({
                    placeholder: 'Card CTA label (optional)',
                    field: 'ctaLabel',
                    historyLabel: 'hotspot card cta label changed'
                });
                createCardInput({
                    placeholder: 'Card CTA URL (optional)',
                    field: 'ctaUrl',
                    historyLabel: 'hotspot card cta url changed'
                });
            } else {
                const meta = document.createElement('div');
                meta.className = 'editorHint';
                meta.textContent = `${hotspot.label || 'Untitled hotspot'} - ${hotspot.type}`;
                item.appendChild(meta);
            }

            const actions = document.createElement('div');
            actions.className = 'editorItemActions';

            const selectBtn = document.createElement('button');
            selectBtn.type = 'button';
            selectBtn.textContent = isSelected ? 'Selected' : 'Select';
            selectBtn.disabled = isSelected;
            selectBtn.addEventListener('click', () => {
                if (typeof handlers.onSelectHotspot === 'function') handlers.onSelectHotspot(hotspot);
            });
            actions.appendChild(selectBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => {
                if (typeof handlers.onDeleteHotspot === 'function') handlers.onDeleteHotspot(hotspot);
            });
            actions.appendChild(deleteBtn);

            item.appendChild(actions);
            editorHotspotList.appendChild(item);
        });
        if (!hotspots.length) {
            editorHotspotList.textContent = 'No hotspots yet.';
            hotspotEditorHint.textContent = 'Add a hotspot, then select it to edit';
        }
    };

    const renderPresetList = ({
        editEnabled,
        presets,
        selectedPresetId,
        defaultPresetId,
        handlers = {}
    }) => {
        if (!editEnabled) return;
        editorPresetList.innerHTML = '';
        presetEditorHint.textContent = selectedPresetId
            ? 'Editing selected view'
            : 'Select a view to rename or set default';
        presets.forEach((preset) => {
            const item = document.createElement('div');
            item.className = 'editorItem';
            const isSelected = preset.id === selectedPresetId;
            if (isSelected) item.classList.add('selected');

            const top = document.createElement('div');
            top.className = 'editorItemTop';
            const title = document.createElement('strong');
            title.textContent = preset.id + (defaultPresetId === preset.id ? ' (default)' : '');
            top.appendChild(title);
            item.appendChild(top);

            if (isSelected) {
                const labelInput = document.createElement('input');
                labelInput.className = 'presetLabelInput';
                labelInput.value = preset.label;
                labelInput.placeholder = 'Label';
                let committedLabel = preset.label;
                labelInput.addEventListener('input', () => {
                    preset.label = labelInput.value;
                    if (typeof handlers.touchEditor === 'function') handlers.touchEditor();
                    if (typeof handlers.onPresetLabelInput === 'function') handlers.onPresetLabelInput(preset);
                });
                labelInput.addEventListener('change', () => {
                    const normalized = labelInput.value.trim() || 'View';
                    const changed = normalized !== committedLabel;
                    labelInput.value = normalized;
                    preset.label = normalized;
                    if (changed) {
                        committedLabel = normalized;
                        if (typeof handlers.touchEditor === 'function') handlers.touchEditor();
                        if (typeof handlers.onPresetLabelCommit === 'function') handlers.onPresetLabelCommit(preset);
                        if (typeof handlers.pushHistory === 'function') handlers.pushHistory('preset renamed');
                    }
                });
                item.appendChild(labelInput);
            } else {
                const meta = document.createElement('div');
                meta.className = 'editorHint';
                meta.textContent = preset.label || 'Untitled view';
                item.appendChild(meta);
            }

            const actions = document.createElement('div');
            actions.className = 'editorItemActions';

            const selectBtn = document.createElement('button');
            selectBtn.type = 'button';
            selectBtn.textContent = isSelected ? 'Selected' : 'Select';
            selectBtn.disabled = isSelected;
            selectBtn.addEventListener('click', () => {
                if (typeof handlers.onSelectPreset === 'function') handlers.onSelectPreset(preset);
            });
            actions.appendChild(selectBtn);

            const jumpBtn = document.createElement('button');
            jumpBtn.type = 'button';
            jumpBtn.textContent = 'Jump';
            jumpBtn.addEventListener('click', () => {
                if (typeof handlers.onJumpPreset === 'function') handlers.onJumpPreset(preset);
            });
            actions.appendChild(jumpBtn);

            const defaultBtn = document.createElement('button');
            defaultBtn.type = 'button';
            defaultBtn.textContent = 'Set Default';
            defaultBtn.addEventListener('click', () => {
                if (typeof handlers.onSetDefaultPreset === 'function') handlers.onSetDefaultPreset(preset);
            });
            actions.appendChild(defaultBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => {
                if (typeof handlers.onDeletePreset === 'function') handlers.onDeletePreset(preset);
            });
            actions.appendChild(deleteBtn);

            item.appendChild(actions);
            editorPresetList.appendChild(item);
        });
        if (!presets.length) {
            editorPresetList.textContent = 'No presets yet.';
            presetEditorHint.textContent = 'Save a view, then select it to rename or set default';
        }
    };

    const refresh = ({
        editEnabled,
        hotspots,
        presets,
        selectedHotspotId,
        selectedPresetId,
        defaultPresetId,
        selectedHotspot,
        canUndo,
        canRedo,
        dirty,
        snapYEnabled,
        handlers = {}
    }) => {
        if (!editEnabled) return;
        snapYValue.disabled = !snapYEnabled;
        renderHotspotList({
            editEnabled,
            hotspots,
            selectedHotspotId,
            handlers
        });
        renderPresetList({
            editEnabled,
            presets,
            selectedPresetId,
            defaultPresetId,
            handlers
        });
        setDirty(dirty);
        updateSelectedHotspotPos(selectedHotspot);
        setHistoryButtons({ canUndo, canRedo });
    };

    return {
        setStatus,
        setDirty,
        setHistoryButtons,
        updateSelectedHotspotPos,
        focusSelectedHotspotLabel,
        focusSelectedPresetLabel,
        renderHotspotList,
        renderPresetList,
        refresh
    };
};
