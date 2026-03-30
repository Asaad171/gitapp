const isEditableElement = (element) => {
    if (!element || typeof element !== 'object') return false;
    if (typeof element.closest === 'function' && element.closest('[contenteditable="true"]')) return true;
    const tagName = typeof element.tagName === 'string' ? element.tagName.toUpperCase() : '';
    if (tagName === 'TEXTAREA' || tagName === 'SELECT') return true;
    if (tagName === 'INPUT') {
        const inputType = String(element.type || 'text').toLowerCase();
        const nonTextTypes = new Set([
            'button',
            'checkbox',
            'color',
            'file',
            'hidden',
            'image',
            'radio',
            'range',
            'reset',
            'submit'
        ]);
        return !nonTextTypes.has(inputType);
    }
    if (element.isContentEditable === true) return true;
    return false;
};

export const isEditableTarget = (target) => isEditableElement(target);
