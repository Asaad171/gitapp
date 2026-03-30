export const createUiController = ({
    elements,
    store
} = {}) => {
    const {
        settingsDrawer,
        settingsBackdrop,
        settingsBtn,
        settingsCloseBtn,
        compactMenu,
        moreBtn,
        viewsPanel,
        viewsBtn,
        orbitBtn,
        walkBtn,
        flyBtn,
        heightWrap,
        heightSlider,
        heightValue
    } = elements;

    const setViewsOpen = (open) => {
        const isOpen = !!open;
        viewsPanel.hidden = !isOpen;
        viewsBtn.classList.toggle('active', isOpen);
        if (store?.setState) store.setState({ viewsOpen: isOpen });
    };

    const setCompactMenuOpen = (open) => {
        const isOpen = !!open;
        compactMenu.hidden = !isOpen;
        moreBtn.classList.toggle('active', isOpen);
        if (store?.setState) store.setState({ compactMenuOpen: isOpen });
    };

    const setSettingsOpen = (open) => {
        const isOpen = !!open;
        settingsDrawer.classList.toggle('open', isOpen);
        settingsBackdrop.classList.toggle('open', isOpen);
        settingsBtn.classList.toggle('active', isOpen);
        if (store?.setState) store.setState({ settingsOpen: isOpen });
        if (isOpen) setCompactMenuOpen(false);
    };

    const syncModeUi = ({ mode, isOrbit } = {}) => {
        const resolvedMode = typeof mode === 'string'
            ? mode
            : (isOrbit ? 'orbit' : 'walk');
        if (orbitBtn) orbitBtn.classList.toggle('active', resolvedMode === 'orbit');
        if (walkBtn) walkBtn.classList.toggle('active', resolvedMode === 'walk');
        if (flyBtn) flyBtn.classList.toggle('active', resolvedMode === 'fly');
    };

    const syncWalkHeightUi = ({ enabled, yValue }) => {
        const walkEnabled = !!enabled;
        heightSlider.disabled = !walkEnabled;
        heightWrap.classList.toggle('disabled', !walkEnabled);
        if (walkEnabled && typeof yValue === 'number' && Number.isFinite(yValue)) {
            heightSlider.value = yValue.toFixed(2);
            heightValue.textContent = Number(heightSlider.value).toFixed(2);
        }
    };

    const bindOutsideDismiss = ({ documentRef = document } = {}) => {
        const onPointerDown = (event) => {
            if (!viewsPanel.hidden && !viewsPanel.contains(event.target) && !viewsBtn.contains(event.target)) {
                setViewsOpen(false);
            }
            const compactOpen = store?.getState?.().compactMenuOpen ?? false;
            if (compactOpen && !compactMenu.contains(event.target) && !moreBtn.contains(event.target)) {
                setCompactMenuOpen(false);
            }
            const settingsOpen = store?.getState?.().settingsOpen ?? false;
            if (
                settingsOpen &&
                !settingsDrawer.contains(event.target) &&
                !settingsBtn.contains(event.target) &&
                !settingsCloseBtn.contains(event.target)
            ) {
                setSettingsOpen(false);
            }
        };
        documentRef.addEventListener('pointerdown', onPointerDown);
        return () => documentRef.removeEventListener('pointerdown', onPointerDown);
    };

    return {
        setSettingsOpen,
        setCompactMenuOpen,
        setViewsOpen,
        syncModeUi,
        syncWalkHeightUi,
        bindOutsideDismiss
    };
};
