export const DEFAULT_MODEL_ENTRY_URL = '/assets/PentHouse/meta.lcc';
export const DEFAULT_FOV = 45;
export const DEFAULT_MODELS_REGISTRY_URL = '/tours/models.registry.json';
export const DEFAULT_TOURS_REGISTRY_URL = '/tours/tours.registry.json';
import { VIOS_NAV_FEEL_TUNING } from '../navigation/navigation-feel-config.js';

const defaultLocationOrigin = () => {
    if (typeof location !== 'undefined' && location.origin) return location.origin;
    return '';
};

export const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

export const parseDeg = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

export const parseNum = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const parseRotationAxis = (value, fallback = 0) => {
    const parsed = parseNum(value);
    return parsed === null ? fallback : parsed;
};

const hasAnyRotationAxis = (rotation) => (
    parseNum(rotation?.rx) !== null
    || parseNum(rotation?.ry) !== null
    || parseNum(rotation?.rz) !== null
);

export const resolveRotationDeg = ({ tourRotation = null, modelDefaultRotation = null } = {}) => {
    const modelFallback = {
        rx: parseRotationAxis(modelDefaultRotation?.rx, 0),
        ry: parseRotationAxis(modelDefaultRotation?.ry, 0),
        rz: parseRotationAxis(modelDefaultRotation?.rz, 0)
    };
    return {
        rx: parseRotationAxis(tourRotation?.rx, modelFallback.rx),
        ry: parseRotationAxis(tourRotation?.ry, modelFallback.ry),
        rz: parseRotationAxis(tourRotation?.rz, modelFallback.rz)
    };
};

export const parseVec3Array = (arr) => (
    Array.isArray(arr) &&
    arr.length === 3 &&
    arr.every((v) => Number.isFinite(Number(v)))
) ? [Number(arr[0]), Number(arr[1]), Number(arr[2])] : null;

export const DEFAULT_COLLISION_MODE_PROFILE = Object.freeze({
    orbit: false,
    walk: true,
    fly: false
});

const cloneCollisionModeProfile = (input = DEFAULT_COLLISION_MODE_PROFILE) => ({
    orbit: input.orbit === true,
    walk: input.walk === true,
    fly: input.fly === true
});

export const createDefaultCollisionProfiles = () => ({
    viewerModes: cloneCollisionModeProfile(DEFAULT_COLLISION_MODE_PROFILE),
    editorModes: cloneCollisionModeProfile(DEFAULT_COLLISION_MODE_PROFILE)
});

const normalizeBooleanMode = (value, fallback) => {
    if (value === true) return true;
    if (value === false) return false;
    return fallback === true;
};

export const normalizeCollisionModeProfile = (
    input = {},
    {
        fallback = DEFAULT_COLLISION_MODE_PROFILE,
        legacyEditorEnabled = false
    } = {}
) => {
    const source = input && typeof input === 'object' ? input : {};
    const normalized = {
        orbit: normalizeBooleanMode(source.orbit, fallback.orbit),
        walk: normalizeBooleanMode(source.walk, fallback.walk),
        fly: normalizeBooleanMode(source.fly, fallback.fly)
    };
    if (legacyEditorEnabled && source.walk === undefined && source.editorEnabled === true) {
        normalized.walk = true;
    }
    return normalized;
};

export const normalizeTourCollisionConfig = (input = {}) => {
    const source = input && typeof input === 'object' ? input : {};
    const defaults = createDefaultCollisionProfiles();
    const sharedModes = source.modes && typeof source.modes === 'object' ? source.modes : null;
    const hasExplicitProfiles = !!(
        source.viewerModes
        || source.editorModes
        || source.viewer
        || source.editor
    );
    const viewerSource = hasExplicitProfiles
        ? (source.viewerModes || source.viewer || sharedModes || {})
        : (sharedModes || {});
    const editorSource = hasExplicitProfiles
        ? (source.editorModes || source.editor || sharedModes || {})
        : source;
    return {
        viewerModes: normalizeCollisionModeProfile(viewerSource, {
            fallback: defaults.viewerModes
        }),
        editorModes: normalizeCollisionModeProfile(editorSource, {
            fallback: defaults.editorModes,
            legacyEditorEnabled: true
        })
    };
};

const normalizeTextValue = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return '';
};

const TOUR_STATUS_VALUES = new Set(['draft', 'published']);
const TOUR_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const normalizeTourStatus = (value, { fallback = 'draft' } = {}) => {
    const normalized = normalizeTextValue(value).toLowerCase();
    if (TOUR_STATUS_VALUES.has(normalized)) return normalized;
    if (fallback === '') return '';
    return fallback === 'published' ? 'published' : 'draft';
};

export const normalizeTourSlug = (value, { slugify = false } = {}) => {
    let normalized = normalizeTextValue(value).toLowerCase();
    if (!normalized) return '';
    if (slugify) {
        normalized = normalized
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/(^-|-$)/g, '');
    }
    return normalized;
};

export const isValidTourSlug = (value) => {
    const normalized = normalizeTourSlug(value, { slugify: false });
    return !normalized || TOUR_SLUG_PATTERN.test(normalized);
};

export const buildViewerUrl = ({ tourId, locationHref = '' } = {}) => {
    const normalizedTourId = normalizeTextValue(tourId);
    if (!normalizedTourId) return '';
    if (!isNonEmptyString(locationHref)) {
        return `?tour=${encodeURIComponent(normalizedTourId)}`;
    }
    try {
        const next = new URL(locationHref);
        next.search = '';
        next.hash = '';
        next.searchParams.set('tour', normalizedTourId);
        return `${next.origin}${next.pathname}?${next.searchParams.toString()}`;
    } catch {
        return `?tour=${encodeURIComponent(normalizedTourId)}`;
    }
};

export const upsertTourRegistryEntry = ({ tours = [], entry = {} } = {}) => {
    const tourId = normalizeTextValue(entry?.tourId);
    if (!tourId) return Array.isArray(tours) ? tours.slice() : [];

    const title = normalizeTextValue(entry?.title) || tourId;
    const modelId = normalizeTextValue(entry?.modelId);
    const slug = normalizeTourSlug(entry?.slug, { slugify: false });
    const status = normalizeTourStatus(entry?.status, { fallback: 'draft' });

    const nextEntry = {
        tourId,
        ...(modelId ? { modelId } : {}),
        title,
        ...(slug ? { slug } : {}),
        ...(status ? { status } : {})
    };

    const sourceTours = Array.isArray(tours)
        ? tours.filter((item) => item && typeof item === 'object')
        : [];
    let replaced = false;
    const nextTours = sourceTours.map((item) => {
        if (normalizeTextValue(item.tourId) !== tourId) return { ...item };
        replaced = true;
        return { ...item, ...nextEntry };
    });
    if (!replaced) nextTours.push(nextEntry);
    return nextTours;
};

export const buildToursRegistryPayload = ({ tours = [], entry = {} } = {}) => ({
    tours: upsertTourRegistryEntry({ tours, entry })
});

const normalizeModelsRegistry = (input) => {
    if (!Array.isArray(input)) return [];
    return input
        .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const modelId = normalizeTextValue(entry.modelId);
            if (!modelId) return null;
            const name = normalizeTextValue(entry.name) || modelId;
            const modelEntryUrl = normalizeTextValue(entry.modelEntryUrl);
            if (!modelEntryUrl) return null;
            const thumbUrl = normalizeTextValue(entry.thumbUrl);
            const hasRotation = hasAnyRotationAxis(entry.rotation);
            return {
                modelId,
                name,
                modelEntryUrl,
                ...(thumbUrl ? { thumbUrl } : {}),
                ...(hasRotation ? { rotation: resolveRotationDeg({ tourRotation: entry.rotation }) } : {})
            };
        })
        .filter(Boolean);
};

const normalizeToursRegistry = (input) => {
    if (!Array.isArray(input)) return [];
    return input
        .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const tourId = normalizeTextValue(entry.tourId);
            if (!tourId) return null;
            const modelId = normalizeTextValue(entry.modelId);
            const title = normalizeTextValue(entry.title) || tourId;
            const slug = normalizeTourSlug(entry.slug, { slugify: false });
            const status = normalizeTourStatus(entry.status, { fallback: '' });
            return {
                tourId,
                ...(modelId ? { modelId } : {}),
                title,
                ...(slug ? { slug } : {}),
                ...(status ? { status } : {})
            };
        })
        .filter(Boolean);
};

const fetchRegistryItems = async ({
    fetchFn,
    url,
    key,
    normalize,
    onRegistryError
}) => {
    try {
        const response = await fetchFn(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const parsed = await response.json();
        const normalizedItems = normalize(parsed?.[key]);
        return {
            items: normalizedItems,
            error: ''
        };
    } catch (error) {
        const detail = error?.message || String(error);
        if (typeof onRegistryError === 'function') {
            onRegistryError({ url, key, detail });
        }
        return {
            items: [],
            error: detail
        };
    }
};

export const loadContentRegistries = async ({
    fetchFn = fetch,
    modelsRegistryUrl = DEFAULT_MODELS_REGISTRY_URL,
    toursRegistryUrl = DEFAULT_TOURS_REGISTRY_URL,
    onRegistryError
} = {}) => {
    const [modelsResult, toursResult] = await Promise.all([
        fetchRegistryItems({
            fetchFn,
            url: modelsRegistryUrl,
            key: 'models',
            normalize: normalizeModelsRegistry,
            onRegistryError
        }),
        fetchRegistryItems({
            fetchFn,
            url: toursRegistryUrl,
            key: 'tours',
            normalize: normalizeToursRegistry,
            onRegistryError
        })
    ]);

    return {
        models: modelsResult.items,
        tours: toursResult.items,
        errors: {
            models: modelsResult.error,
            tours: toursResult.error
        }
    };
};

export const deriveTitleFromModelUrl = (modelEntryUrl, locationOrigin = defaultLocationOrigin()) => {
    try {
        const u = new URL(modelEntryUrl, locationOrigin);
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length >= 2) return parts[parts.length - 2];
        return parts[0] || 'Tour';
    } catch {
        return 'Tour';
    }
};

export const deriveThumbUrl = (modelEntryUrl, locationOrigin = defaultLocationOrigin()) => {
    try {
        const u = new URL(modelEntryUrl, locationOrigin);
        const idx = u.pathname.lastIndexOf('/');
        const dirPath = idx >= 0 ? u.pathname.slice(0, idx) : '';
        return `${u.origin}${dirPath}/thumb.jpg`;
    } catch {
        return '';
    }
};

export const toAbsoluteUrl = (urlValue, locationOrigin = defaultLocationOrigin()) => {
    try {
        return new URL(urlValue, locationOrigin).href;
    } catch {
        return null;
    }
};

export const createDefaultTourConfig = ({
    defaultModelEntryUrl = DEFAULT_MODEL_ENTRY_URL,
    defaultModelId = '',
    defaultRotation = null,
    defaultTitle = '',
    defaultFov = DEFAULT_FOV,
    locationOrigin = defaultLocationOrigin()
} = {}) => {
    const next = {
        tourId: 'default',
        title: isNonEmptyString(defaultTitle)
            ? String(defaultTitle).trim()
            : deriveTitleFromModelUrl(defaultModelEntryUrl, locationOrigin),
        modelEntryUrl: defaultModelEntryUrl,
        rotation: resolveRotationDeg({ tourRotation: defaultRotation }),
        fov: defaultFov,
        startMode: VIOS_NAV_FEEL_TUNING.startup.defaultMode,
        cta: { label: 'CTA' }
    };
    if (isNonEmptyString(defaultModelId)) next.modelId = String(defaultModelId).trim();
    return next;
};

export const loadTourConfigFromLocation = async ({
    search = '',
    fetchFn = fetch,
    defaultTourConfig = createDefaultTourConfig(),
    onConfigFetchError
} = {}) => {
    const searchParams = new URLSearchParams(search || '');
    const tourId = searchParams.get('tour');
    const introEnabled = searchParams.get('intro') !== '0';
    const editEnabled = searchParams.get('edit') === '1';
    const debugEnabled = searchParams.get('debug') === '1';

    if (!tourId) {
        return {
            ok: true,
            tourConfig: defaultTourConfig,
            searchParams,
            tourId,
            introEnabled,
            editEnabled,
            debugEnabled
        };
    }

    const configUrl = `/tours/${encodeURIComponent(tourId)}/tour.json`;
    try {
        const response = await fetchFn(configUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const parsed = await response.json();
        if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON object');
        if (!isNonEmptyString(parsed.tourId)) throw new Error('Missing required field: tourId');
        if (!isNonEmptyString(parsed.title)) throw new Error('Missing required field: title');
        if (!isNonEmptyString(parsed.modelEntryUrl)) throw new Error('Missing required field: modelEntryUrl');
        return {
            ok: true,
            tourConfig: parsed,
            searchParams,
            tourId,
            introEnabled,
            editEnabled,
            debugEnabled
        };
    } catch (error) {
        const detail = error?.message || String(error);
        if (typeof onConfigFetchError === 'function') onConfigFetchError(configUrl, detail);
        return {
            ok: false,
            reason: 'load_failed',
            fetchUrl: configUrl,
            detail,
            searchParams,
            tourId,
            introEnabled,
            editEnabled,
            debugEnabled
        };
    }
};

export const normalizeRuntimeTourConfig = ({
    tourConfig,
    search = '',
    locationOrigin = defaultLocationOrigin(),
    defaultFov = DEFAULT_FOV,
    modelDefaultRotation = null
} = {}) => {
    const searchParams = new URLSearchParams(search || '');
    const MODEL_ENTRY_URL = String(tourConfig.modelEntryUrl).trim();
    const MODEL_ENTRY_ABS_URL = toAbsoluteUrl(MODEL_ENTRY_URL, locationOrigin);
    const THUMB_URL = deriveThumbUrl(MODEL_ENTRY_URL, locationOrigin);
    const TOUR_TITLE = isNonEmptyString(tourConfig.title)
        ? tourConfig.title.trim()
        : deriveTitleFromModelUrl(MODEL_ENTRY_URL, locationOrigin);
    const modelId = isNonEmptyString(tourConfig.modelId) ? tourConfig.modelId.trim() : '';
    const slug = normalizeTourSlug(tourConfig.slug, { slugify: false });
    const status = normalizeTourStatus(tourConfig.status, { fallback: '' });
    const baseRotation = resolveRotationDeg({
        tourRotation: tourConfig.rotation,
        modelDefaultRotation
    });
    const rotationDeg = {
        rx: searchParams.has('rx') ? parseDeg(searchParams.get('rx')) : baseRotation.rx,
        ry: searchParams.has('ry') ? parseDeg(searchParams.get('ry')) : baseRotation.ry,
        rz: searchParams.has('rz') ? parseDeg(searchParams.get('rz')) : baseRotation.rz
    };
    const configFov = parseNum(tourConfig.fov);
    const queryFov = parseNum(searchParams.get('fov'));
    const initialFov = queryFov !== null ? queryFov : (configFov !== null ? configFov : defaultFov);
    // Startup defaults to walk for both viewer and editor runtimes.
    // Legacy startMode values are tolerated on load, but walk-first is the default.
    const startModeConfig = VIOS_NAV_FEEL_TUNING.startup.defaultMode;
    const collisionConfig = normalizeTourCollisionConfig(tourConfig?.navigation?.collision);
    const ctaLabel = isNonEmptyString(tourConfig.cta?.label) ? tourConfig.cta.label.trim() : 'CTA';
    const ctaUrl = isNonEmptyString(tourConfig.cta?.url) ? tourConfig.cta.url.trim() : '';
    const propertyConfig = tourConfig.property && typeof tourConfig.property === 'object'
        ? tourConfig.property
        : {};
    const propertyCard = {
        eyebrow: normalizeTextValue(propertyConfig.eyebrow),
        title: normalizeTextValue(propertyConfig.title) || TOUR_TITLE,
        address: normalizeTextValue(tourConfig.address)
            || normalizeTextValue(propertyConfig.address),
        price: normalizeTextValue(tourConfig.price)
            || normalizeTextValue(propertyConfig.price),
        rooms: normalizeTextValue(tourConfig.rooms)
            || normalizeTextValue(tourConfig.room)
            || normalizeTextValue(tourConfig.bedrooms)
            || normalizeTextValue(propertyConfig.rooms)
            || normalizeTextValue(propertyConfig.room)
            || normalizeTextValue(propertyConfig.bedrooms),
        area: normalizeTextValue(tourConfig.area)
            || normalizeTextValue(tourConfig.floorArea)
            || normalizeTextValue(tourConfig.areaSqm)
            || normalizeTextValue(tourConfig.size)
            || normalizeTextValue(propertyConfig.area)
            || normalizeTextValue(propertyConfig.floorArea)
            || normalizeTextValue(propertyConfig.areaSqm)
            || normalizeTextValue(propertyConfig.size)
    };
    const cameraPresets = Array.isArray(tourConfig.cameraPresets)
        ? tourConfig.cameraPresets
            .map((preset, idx) => {
                const position = parseVec3Array(preset?.position);
                const target = parseVec3Array(preset?.target);
                if (!position || !target) return null;
                return {
                    id: isNonEmptyString(preset?.id) ? preset.id.trim() : `preset-${idx + 1}`,
                    label: isNonEmptyString(preset?.label) ? preset.label.trim() : `View ${idx + 1}`,
                    position,
                    target,
                    fov: parseNum(preset?.fov)
                };
            })
            .filter(Boolean)
        : [];
    const hotspotConfigs = Array.isArray(tourConfig.hotspots)
        ? tourConfig.hotspots
            .map((hotspot, idx) => {
                const position = parseVec3Array(hotspot?.position);
                if (!position) return null;
                const type = hotspot?.type === 'link' || hotspot?.type === 'cta' ? hotspot.type : 'info';
                const rawCard = hotspot?.card && typeof hotspot.card === 'object'
                    ? hotspot.card
                    : null;
                const cardCtaUrl = normalizeTextValue(rawCard?.ctaUrl);
                const actionUrl = isNonEmptyString(hotspot?.action?.url)
                    ? hotspot.action.url.trim()
                    : cardCtaUrl;
                const card = rawCard ? {
                    eyebrow: normalizeTextValue(rawCard.eyebrow),
                    title: normalizeTextValue(rawCard.title),
                    description: normalizeTextValue(rawCard.description),
                    ctaLabel: normalizeTextValue(rawCard.ctaLabel),
                    ctaUrl: cardCtaUrl
                } : null;
                const hasCardContent = card && Object.values(card).some((value) => value.length > 0);
                return {
                    id: isNonEmptyString(hotspot?.id) ? hotspot.id.trim() : `hotspot-${idx + 1}`,
                    label: isNonEmptyString(hotspot?.label) ? hotspot.label.trim() : `Hotspot ${idx + 1}`,
                    position,
                    type,
                    actionUrl,
                    ...(hasCardContent ? { card } : {})
                };
            })
            .filter(Boolean)
        : [];
    const defaultPresetId = isNonEmptyString(tourConfig.defaultPresetId) ? tourConfig.defaultPresetId.trim() : '';
    const startParamRaw = (searchParams.get('start') || '').trim();
    const hasStartOverrideParam = startParamRaw.length > 0;
    const hasUrlViewOverrides = searchParams.has('rx') || searchParams.has('ry') || searchParams.has('rz') || searchParams.has('fov');
    const startPresetMatch = /^preset:(.+)$/i.exec(startParamRaw);
    const requestedStartPresetId = startPresetMatch ? startPresetMatch[1].trim() : '';
    const defaultStartPresetId = defaultPresetId && cameraPresets.some((p) => p.id === defaultPresetId) ? defaultPresetId : '';

    return {
        searchParams,
        MODEL_ENTRY_URL,
        MODEL_ENTRY_ABS_URL,
        THUMB_URL,
        TOUR_TITLE,
        modelId,
        slug,
        status,
        baseRotation,
        rotationDeg,
        configFov,
        queryFov,
        initialFov,
        startModeConfig,
        collisionConfig,
        ctaLabel,
        ctaUrl,
        propertyCard,
        cameraPresets,
        hotspotConfigs,
        defaultPresetId,
        startParamRaw,
        hasStartOverrideParam,
        hasUrlViewOverrides,
        requestedStartPresetId,
        defaultStartPresetId
    };
};

export const resolveStartupPlan = ({
    startParamRaw = '',
    hasUrlViewOverrides = false,
    requestedStartPresetId = '',
    defaultStartPresetId = ''
} = {}) => {
    let startType = 'home';
    let presetId = '';
    const hasStartOverrideParam = (startParamRaw || '').length > 0;
    if (hasStartOverrideParam) {
        if (startParamRaw.toLowerCase() === 'home') {
            startType = 'home';
        } else if (requestedStartPresetId) {
            startType = 'preset';
            presetId = requestedStartPresetId;
        }
    } else if (!hasUrlViewOverrides && defaultStartPresetId) {
        startType = 'preset';
        presetId = defaultStartPresetId;
    }
    return { startType, presetId };
};

