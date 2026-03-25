const clampPercent = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n));
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
        loadingErrorActions,
        loadDefaultBtn,
        reloadBtn,
        introVideo,
        introPlayBtn
    } = elements;

    const setProgress = (percent, statusText) => {
        const clamped = clampPercent(percent);
        const prevMax = store?.getState?.().loadingMaxPercent ?? 0;
        const nextMax = Math.max(prevMax, clamped);
        if (store?.setState) store.setState({ loadingMaxPercent: nextMax });
        loadingProgressBar.style.width = `${clamped.toFixed(1)}%`;
        loadingPercent.textContent = `${Math.round(clamped)}%`;
        if (statusText) loadingStatus.textContent = statusText;
    };

    const hideIntro = () => {
        if (store?.getState?.().introHidden) return;
        if (store?.setState) store.setState({ introHidden: true });
        introVideo.classList.add('hidden');
        introPlayBtn.hidden = true;
    };

    const hideOverlay = () => {
        loadingOverlay.classList.add('hidden');
        if (store?.setState) store.setState({ loadingOverlayHidden: true });
    };

    const setError = (message) => {
        const maxPercent = store?.getState?.().loadingMaxPercent ?? 0;
        setProgress(maxPercent, 'Unable to load this tour.');
        loadingStatus.textContent = message || 'Something went wrong. Please try reloading.';
        loadingErrorActions.hidden = false;
        hideIntro();
        loadingOverlay.classList.remove('intro-active');
    };

    const setReady = () => {
        setProgress(100, 'Ready');
    };

    const showTourConfigError = (fetchUrl, detailMessage) => {
        loadingTitle.textContent = 'Tour not found';
        loadingStatus.textContent = `Could not load ${fetchUrl}`;
        loadingProgressBar.style.width = '0%';
        loadingPercent.textContent = '';
        loadingErrorActions.hidden = false;
        loadDefaultBtn.hidden = false;
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
