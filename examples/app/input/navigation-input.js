import { isEditableTarget } from './editable-target.js';

export const NAVIGATION_MOVEMENT_KEY_CODES = new Set([
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'KeyQ',
    'KeyE',
    'Space',
    'KeyC'
]);

export const isMovementKeyCode = (code, movementKeyCodes = NAVIGATION_MOVEMENT_KEY_CODES) => (
    movementKeyCodes.has(code)
);

export const getKeyInputContext = ({
    event,
    movementKeyCodes = NAVIGATION_MOVEMENT_KEY_CODES
} = {}) => {
    const target = event?.target || null;
    const activeElement = (typeof document !== 'undefined' && document.activeElement)
        ? document.activeElement
        : null;
    const editable = isEditableTarget(target) || isEditableTarget(activeElement);
    return {
        editable,
        hasCommandModifier: !!(event?.ctrlKey || event?.metaKey),
        isMovementKey: isMovementKeyCode(event?.code || '', movementKeyCodes)
    };
};

export const createMoveKeyTracker = ({
    movementKeyCodes = NAVIGATION_MOVEMENT_KEY_CODES
} = {}) => {
    const moveKeys = new Set();

    const keyDown = (code) => {
        const nextCode = String(code || '');
        const already = moveKeys.has(nextCode);
        moveKeys.add(nextCode);
        return {
            added: !already,
            isMovementKey: movementKeyCodes.has(nextCode),
            size: moveKeys.size
        };
    };

    const keyUp = (code) => {
        const nextCode = String(code || '');
        const existed = moveKeys.delete(nextCode);
        const hasMovementIntent = [...moveKeys].some((key) => movementKeyCodes.has(key));
        return {
            removed: existed,
            isMovementKey: movementKeyCodes.has(nextCode),
            size: moveKeys.size,
            hasMovementIntent
        };
    };

    const clear = () => {
        moveKeys.clear();
    };

    return {
        moveKeys,
        keyDown,
        keyUp,
        clear
    };
};
