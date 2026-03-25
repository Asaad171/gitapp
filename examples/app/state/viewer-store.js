export const createViewerStore = (initialState = {}) => {
    let state = { ...initialState };
    const listeners = new Set();

    const getState = () => state;

    const setState = (patchOrUpdater) => {
        const nextPatch = typeof patchOrUpdater === 'function'
            ? patchOrUpdater(state)
            : patchOrUpdater;
        if (!nextPatch || typeof nextPatch !== 'object') return state;
        state = { ...state, ...nextPatch };
        listeners.forEach((listener) => {
            try {
                listener(state);
            } catch {
                // isolate listener errors
            }
        });
        return state;
    };

    const subscribe = (listener) => {
        if (typeof listener !== 'function') return () => {};
        listeners.add(listener);
        return () => listeners.delete(listener);
    };

    return {
        getState,
        setState,
        subscribe
    };
};
