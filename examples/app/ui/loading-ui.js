const clampPercent = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n));
};

const inferLoadingPhase = (statusText = '', { error = false } = {}) => {
    if (error) return 'Needs Attention';
    const normalized = String(statusText || '').toLowerCase();
    if (!normalized) return 'Preparing Experience';
    if (normalized.includes('ready')) return 'Experience Ready';
    if (normalized.includes('finaliz')) return 'Finalizing Scene';
    if (normalized.includes('load')) return 'Loading 3D Data';
    if (normalized.includes('prepar')) return 'Preparing Experience';
    return 'Preparing Experience';
};

const inferLoadingHint = (statusText = '') => {
    const normalized = String(statusText || '').toLowerCase();
    if (!normalized) return 'Preparing scene runtime...';
    if (normalized.includes('ready')) return 'Opening controls...';
    if (normalized.includes('finaliz')) return 'Applying final scene polish...';
    if (normalized.includes('load')) return 'Streaming model data...';
    if (normalized.includes('prepar')) return 'Preparing scene runtime...';
    return 'Preparing scene runtime...';
};

export const createLoadingUi = ({
    elements,
    store,
    onReload,
    onLoadDefault,
    onConfigError
} = {}) => {
    const {
        loadingOverlay,
        loadingTitle,
        loadingStatus,
        loadingProgressBar,
        loadingPercent,
        loadingPhase,
        loadingHint,
        loadingErrorHint,
        loadingErrorActions,
        loadDefaultBtn,
        reloadBtn,
        introVideo,
        introPlayBtn
    } = elements;

    let displayedPercent = 0;
    let targetPercent = 0;
    let progressRafId = 0;

    const renderProgressNow = (value, { hidePercent = false } = {}) => {
        const clamped = clampPercent(value);
        loadingProgressBar.style.width = `${clamped.toFixed(1)}%`;
        loadingPercent.textContent = hidePercent ? '' : `${Math.round(clamped)}%`;
    };

    const animateProgress = () => {
        const delta = targetPercent - displayedPercent;
        if (Math.abs(delta) < 0.06) {
            displayedPercent = targetPercent;
            renderProgressNow(displayedPercent);
            progressRafId = 0;
            return;
        }
        const step = Math.max(0.18, Math.abs(delta) * 0.18);
        displayedPercent += Math.sign(delta) * Math.min(Math.abs(delta), step);
        renderProgressNow(displayedPercent);
        progressRafId = requestAnimationFrame(animateProgress);
    };

    const queueProgressRender = (value) => {
        targetPercent = clampPercent(value);
        if (!progressRafId) {
            progressRafId = requestAnimationFrame(animateProgress);
        }
    };

    const setPhase = (statusText = '', options = {}) => {
        if (!loadingPhase) return;
        loadingPhase.textContent = inferLoadingPhase(statusText, options);
    };

    const setProgress = (percent, statusText) => {
        const clamped = clampPercent(percent);
        const prevMax = store?.getState?.().loadingMaxPercent ?? 0;
        const nextMax = Math.max(prevMax, clamped);
        if (store?.setState) store.setState({ loadingMaxPercent: nextMax });
        queueProgressRender(nextMax);
        if (statusText) {
            loadingStatus.textContent = statusText;
            setPhase(statusText);
            if (loadingHint) loadingHint.textContent = inferLoadingHint(statusText);
        }
        loadingOverlay.classList.remove('has-error');
        loadingErrorActions.hidden = true;
        if (loadingErrorHint) {
            loadingErrorHint.hidden = true;
            loadingErrorHint.textContent = '';
        }
    };

    const hideIntro = () => {
        if (store?.getState?.().introHidden) return;
        if (store?.setState) store.setState({ introHidden: true });
        loadingOverlay.classList.remove('intro-active');
        loadingOverlay.classList.add('intro-finished');
        try {
            introVideo.pause();
        } catch {
            // best-effort pause
        }
        introVideo.classList.add('hidden');
        introPlayBtn.hidden = true;
    };

    const hideOverlay = () => {
        loadingOverlay.classList.add('is-ready');
        loadingOverlay.classList.add('hidden');
        if (store?.setState) store.setState({ loadingOverlayHidden: true });
    };

    const setError = (message) => {
        const maxPercent = store?.getState?.().loadingMaxPercent ?? 0;
        loadingTitle.textContent = 'Load issue';
        setProgress(Math.max(maxPercent, 3), 'Unable to load this experience.');
        loadingStatus.textContent = message || 'The tour could not be loaded. Please try again.';
        setPhase(loadingStatus.textContent, { error: true });
        loadingOverlay.classList.add('has-error');
        loadingErrorActions.hidden = false;
        if (loadingHint) loadingHint.textContent = 'Reload to retry loading this experience.';
        if (loadingErrorHint) {
            loadingErrorHint.hidden = false;
            loadingErrorHint.textContent = loadDefaultBtn.hidden
                ? 'You can reload to retry loading this tour.'
                : 'Reload to retry, or load the default tour.';
        }
        hideIntro();
        loadingOverlay.classList.remove('intro-active');
    };

    const setReady = () => {
        setProgress(100, 'Experience ready');
        loadingOverlay.classList.remove('has-error');
        setPhase('Experience ready');
    };

    const showTourConfigError = (fetchUrl, detailMessage) => {
        loadingTitle.textContent = 'Tour unavailable';
        loadingStatus.textContent = `Could not load config from ${fetchUrl}`;
        displayedPercent = 0;
        targetPercent = 0;
        if (progressRafId) {
            cancelAnimationFrame(progressRafId);
            progressRafId = 0;
        }
        renderProgressNow(0, { hidePercent: true });
        setPhase(loadingStatus.textContent, { error: true });
        loadingOverlay.classList.add('has-error');
        if (loadingHint) loadingHint.textContent = 'Check tour configuration and try again.';
        loadingErrorActions.hidden = false;
        loadDefaultBtn.hidden = false;
        if (loadingErrorHint) {
            loadingErrorHint.hidden = false;
            loadingErrorHint.textContent = 'Try reloading, or open the default tour to continue.';
        }
        hideIntro();
        loadingOverlay.classList.remove('intro-active');
        if (detailMessage && typeof onConfigError === 'function') onConfigError(detailMessage);
    };

    const tryPlayIntro = (introEnabled) => {
        if (!introEnabled) {
            hideIntro();
            introVideo.pause();
            introVideo.removeAttribute('src');
            introVideo.load();
            return;
        }
        loadingOverlay.classList.add('intro-active');
        const playPromise = introVideo.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {
                introPlayBtn.hidden = false;
            });
        }
    };

    if (typeof onReload === 'function') reloadBtn.addEventListener('click', onReload);
    if (typeof onLoadDefault === 'function') loadDefaultBtn.addEventListener('click', onLoadDefault);
    introVideo.addEventListener('ended', hideIntro);
    introVideo.addEventListener('error', hideIntro);
    introPlayBtn.addEventListener('click', () => {
        introPlayBtn.hidden = true;
        loadingOverlay.classList.add('intro-active');
        const playPromise = introVideo.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {
                introPlayBtn.hidden = false;
            });
        }
    });

    return {
        showTourConfigError,
        setProgress,
        setError,
        setReady,
        hideOverlay,
        hideIntro,
        tryPlayIntro
    };
};
