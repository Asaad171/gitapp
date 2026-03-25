const createSessionId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `sess_${Math.random().toString(36).slice(2)}`;
};

export const createAnalyticsClient = ({
    debugEnabled = false,
    tourId = 'default',
    globalObj = window
} = {}) => {
    const sessionId = createSessionId();

    const emitEvent = (name, props = {}) => {
        const evt = { name, props, ts: Date.now(), tourId: tourId || 'default', sessionId };
        if (!Array.isArray(globalObj.__viosEvents)) globalObj.__viosEvents = [];
        globalObj.__viosEvents.push(evt);
        if (debugEnabled) console.log('[vios:event]', evt);
    };

    return {
        emitEvent,
        getSessionId: () => sessionId
    };
};
