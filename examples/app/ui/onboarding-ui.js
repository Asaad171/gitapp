const clampIndex = (value, min, max) => Math.max(min, Math.min(max, value));

export const createOnboardingUi = ({
    elements,
    walkBtn,
    helpEl,
    steps = [],
    storageKey = 'vios_onboarded_v1',
    store
} = {}) => {
    const {
        onboardingModal,
        onboardingTitle,
        onboardingBody,
        onboardPrev,
        onboardNext,
        onboardDone
    } = elements;
    let infoMessageTimer = 0;

    const isOnboarded = () => {
        try {
            return localStorage.getItem(storageKey) === '1';
        } catch {
            return false;
        }
    };

    const markOnboarded = () => {
        try {
            localStorage.setItem(storageKey, '1');
        } catch {
            // no-op when storage is unavailable
        }
    };

    const getStepIndex = () => store?.getState?.().onboardingStepIndex ?? 0;
    const setStepIndex = (nextIndex) => {
        if (store?.setState) store.setState({ onboardingStepIndex: nextIndex });
    };

    const renderStep = () => {
        if (!steps.length) return;
        const stepIndex = clampIndex(getStepIndex(), 0, steps.length - 1);
        const step = steps[stepIndex];
        onboardingTitle.textContent = step.title;
        onboardingBody.textContent = step.body;
        onboardPrev.hidden = stepIndex === 0;
        onboardNext.hidden = stepIndex >= steps.length - 1;
        onboardDone.hidden = stepIndex < steps.length - 1;
        walkBtn.classList.toggle('walkPulse', stepIndex === 1 && !onboardingModal.classList.contains('hidden'));
    };

    const open = (stepIndex = 0) => {
        const next = clampIndex(stepIndex, 0, Math.max(0, steps.length - 1));
        setStepIndex(next);
        if (store?.setState) store.setState({ onboardingOpen: true });
        onboardingModal.classList.remove('hidden');
        renderStep();
    };

    const close = (mark = false) => {
        onboardingModal.classList.add('hidden');
        walkBtn.classList.remove('walkPulse');
        if (store?.setState) store.setState({ onboardingOpen: false });
        if (mark) markOnboarded();
    };

    const toggle = () => {
        if (onboardingModal.classList.contains('hidden')) open(0);
        else close(false);
    };

    const showHint = (text, durationMs = 4000) => {
        if (infoMessageTimer) clearTimeout(infoMessageTimer);
        helpEl.textContent = text;
        helpEl.classList.add('show');
        if (durationMs > 0) {
            infoMessageTimer = window.setTimeout(() => {
                infoMessageTimer = 0;
                helpEl.classList.remove('show');
            }, durationMs);
        }
    };

    const showInfo = (text, durationMs = 2000) => {
        showHint(text, durationMs);
    };

    onboardPrev.addEventListener('click', () => {
        const next = Math.max(0, getStepIndex() - 1);
        setStepIndex(next);
        renderStep();
    });
    onboardNext.addEventListener('click', () => {
        const next = Math.min(Math.max(0, steps.length - 1), getStepIndex() + 1);
        setStepIndex(next);
        renderStep();
    });
    onboardDone.addEventListener('click', () => close(true));
    onboardingModal.addEventListener('click', (event) => {
        if (event.target === onboardingModal) close(false);
    });

    return {
        isOnboarded,
        markOnboarded,
        open,
        close,
        toggle,
        renderStep,
        showHint,
        showInfo
    };
};
