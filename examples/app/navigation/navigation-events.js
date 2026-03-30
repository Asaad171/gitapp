const defaultSink = () => {};

export const createNavigationEvents = ({
    sink = defaultSink
} = {}) => {
    let eventSink = typeof sink === 'function' ? sink : defaultSink;
    const listeners = new Set();

    const emit = (name, payload = {}) => {
        const evt = {
            name: String(name || ''),
            payload: payload && typeof payload === 'object' ? payload : {},
            ts: Date.now()
        };
        listeners.forEach((listener) => {
            try {
                listener(evt);
            } catch {
                // isolate listener errors
            }
        });
        try {
            eventSink(evt);
        } catch {
            // isolate sink errors
        }
        return evt;
    };

    const subscribe = (listener) => {
        if (typeof listener !== 'function') return () => {};
        listeners.add(listener);
        return () => listeners.delete(listener);
    };

    const setSink = (nextSink) => {
        eventSink = typeof nextSink === 'function' ? nextSink : defaultSink;
    };

    return {
        emit,
        subscribe,
        setSink
    };
};
