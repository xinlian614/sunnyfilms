const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT || 3001);
const PUBLIC_DIR = path.join(__dirname, 'public');
const INDEX_FILE = path.join(PUBLIC_DIR, 'index.html');
const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'resource-apis.json');
const LOG_FILE = path.join(DATA_DIR, 'resource-api-logs.json');
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics-events.json');

const JSON_HEADERS = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
};

const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
};

const CACHE_TTL = {
    browse: 60 * 1000,
    categories: 60 * 60 * 1000,
    detail: 5 * 60 * 1000,
    actorSearch: 5 * 60 * 1000,
};

const MAX_LOG_ENTRIES = 300;
const MAX_ANALYTICS_EVENTS = 20000;
const DEFAULT_TIMEOUT = 12000;
const DEFAULT_PROVIDER_TYPE = 'mac-cms-v10-json';

const DEFAULT_PARSE_RULES = {
    listPath: 'list',
    categoryPath: 'class',
    fields: {
        categoryId: 'type_id',
        categoryName: 'type_name',
        id: ['vod_id', 'id'],
        name: ['vod_name', 'name'],
        subtitle: ['vod_sub', 'vod_subtitle'],
        slug: 'vod_en',
        typeId: ['type_id', 'vod_class_id', 'vod_type_id'],
        typeName: 'type_name',
        className: 'vod_class',
        poster: ['vod_pic', 'vod_pic_thumb', 'pic'],
        actor: ['vod_actor', 'actor'],
        director: ['vod_director', 'director'],
        area: ['vod_area', 'area'],
        year: ['vod_year', 'year'],
        lang: ['vod_lang', 'lang'],
        remarks: ['vod_remarks', 'remarks'],
        score: 'vod_score',
        duration: 'vod_duration',
        pubdate: 'vod_pubdate',
        updateTime: ['vod_time', 'vod_time_add'],
        hits: ['vod_hits', 'hits'],
        content: ['vod_content', 'vod_blurb', 'content'],
        playFrom: 'vod_play_from',
        playUrl: 'vod_play_url',
    },
};

const DEFAULT_HONGNIU_CONFIG = {
    id: 'provider_hongniu_default',
    name: '红牛资源',
    type: DEFAULT_PROVIDER_TYPE,
    enabled: true,
    priority: 100,
    timeout: 12000,
    requestMethod: 'GET',
    requestUrl: 'https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/',
    requestParamsTemplate: {
        common: {
            ac: 'detail',
        },
        home: {
            pg: '{{page}}',
            t: '{{typeId}}',
            h: '{{hours}}',
        },
        categories: {
            pg: 1,
        },
        detail: {
            ids: '{{id}}',
        },
        search: {
            pg: '{{page}}',
            t: '{{typeId}}',
            wd: '{{keyword}}',
        },
        actorSearch: {
            pg: '{{page}}',
            t: '{{typeId}}',
        },
    },
    parseRules: DEFAULT_PARSE_RULES,
    auth: {
        type: 'none',
        token: '',
        headerName: '',
        queryName: '',
        username: '',
        password: '',
    },
    headers: {
        Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
        'User-Agent': 'SunnyFilms/2.0',
    },
    fallbackUrls: ['https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/'],
    notes: '默认红牛资源配置，作为多接口管理模板',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

const DEFAULT_SELECTION_POLICY = {
    mode: 'auto',
    providerId: '',
    updatedAt: new Date().toISOString(),
};

const FALLBACK_CATEGORIES = [
    { type_id: 1, type_name: '电影' },
    { type_id: 2, type_name: '连续剧' },
    { type_id: 3, type_name: '综艺' },
    { type_id: 4, type_name: '动漫' },
    { type_id: 5, type_name: '动作片' },
    { type_id: 6, type_name: '喜剧片' },
    { type_id: 7, type_name: '爱情片' },
    { type_id: 8, type_name: '科幻片' },
    { type_id: 9, type_name: '恐怖片' },
    { type_id: 10, type_name: '剧情片' },
    { type_id: 11, type_name: '战争片' },
    { type_id: 12, type_name: '国产剧' },
    { type_id: 13, type_name: '港台剧' },
    { type_id: 14, type_name: '日剧' },
    { type_id: 15, type_name: '欧美剧' },
    { type_id: 16, type_name: '台剧' },
    { type_id: 17, type_name: '泰剧' },
    { type_id: 18, type_name: '韩剧' },
    { type_id: 19, type_name: '纪录片' },
    { type_id: 20, type_name: '动漫电影' },
    { type_id: 21, type_name: '伦理片' },
    { type_id: 29, type_name: '体育赛事' },
    { type_id: 30, type_name: '短剧' },
    { type_id: 31, type_name: '预告片' },
];

const cacheStore = new Map();

const dataStore = {
    providers: [],
    logs: [],
    analyticsEvents: [],
    selection: {
        mode: 'auto',
        providerId: '',
        updatedAt: '',
    },
};

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, JSON_HEADERS);
    res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, body, contentType = 'text/plain; charset=utf-8') {
    res.writeHead(statusCode, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
    });
    res.end(body);
}

function compactObject(value) {
    return Object.fromEntries(
        Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== '')
    );
}

function ensureArray(value) {
    return Array.isArray(value) ? value : [];
}

function stripHtml(value) {
    return String(value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&ldquo;/gi, '"')
        .replace(/&rdquo;/gi, '"')
        .replace(/&lsquo;/gi, "'")
        .replace(/&rsquo;/gi, "'")
        .replace(/&hellip;/gi, '...')
        .replace(/&mdash;/gi, '-')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

function toNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function splitPlayGroups(value) {
    return String(value || '')
        .split('$$$')
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function parseEpisodes(groupValue) {
    return String(groupValue || '')
        .split('#')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part, index) => {
            const markerIndex = part.indexOf('$');
            if (markerIndex === -1) {
                return {
                    label: `第${index + 1}集`,
                    url: part,
                };
            }

            const label = part.slice(0, markerIndex).trim() || `第${index + 1}集`;
            const url = part.slice(markerIndex + 1).trim();

            return {
                label,
                url,
            };
        })
        .filter((episode) => episode.url);
}

function getSourceLabel(sourceKey) {
    const normalized = String(sourceKey || '').trim();
    if (normalized === 'hnm3u8') {
        return 'M3U8';
    }
    if (normalized === 'hnyun') {
        return '云播';
    }
    return normalized || '播放源';
}

function parsePlaySources(vodPlayFrom, vodPlayUrl) {
    const sourceKeys = splitPlayGroups(vodPlayFrom);
    const sourceUrls = splitPlayGroups(vodPlayUrl);
    const maxLength = Math.max(sourceKeys.length, sourceUrls.length);
    const groups = [];

    for (let index = 0; index < maxLength; index += 1) {
        const key = sourceKeys[index] || (maxLength === 1 ? 'default' : `source${index + 1}`);
        const episodes = parseEpisodes(sourceUrls[index] || '');

        if (!episodes.length) {
            continue;
        }

        groups.push({
            key,
            label: getSourceLabel(key),
            directStream: episodes.some((episode) => /\.m3u8($|\?)/i.test(episode.url)),
            episodes,
        });
    }

    return groups;
}

function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

function createId(prefix = 'id') {
    return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function pickFirstValue(source, selector) {
    if (Array.isArray(selector)) {
        for (const key of selector) {
            const picked = pickFirstValue(source, key);
            if (picked !== undefined && picked !== null && picked !== '') {
                return picked;
            }
        }
        return undefined;
    }

    if (!selector) {
        return undefined;
    }

    return selector
        .split('.')
        .reduce((current, key) => (current === undefined || current === null ? undefined : current[key]), source);
}

function renderTemplateValue(value, context) {
    if (typeof value !== 'string') {
        return value;
    }

    return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, token) => {
        const resolved = pickFirstValue(context, token);
        return resolved === undefined || resolved === null ? '' : String(resolved);
    });
}

function renderTemplateObject(template, context) {
    const result = {};
    const source = template && typeof template === 'object' ? template : {};

    for (const [key, value] of Object.entries(source)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            result[key] = renderTemplateObject(value, context);
            continue;
        }
        result[key] = renderTemplateValue(value, context);
    }

    return compactObject(result);
}

function clearCacheByPrefix(prefix) {
    for (const key of cacheStore.keys()) {
        if (key.startsWith(prefix)) {
            cacheStore.delete(key);
        }
    }
}

async function getCached(key, ttl, loader) {
    const now = Date.now();
    const cached = cacheStore.get(key);
    if (cached && cached.expiresAt > now) {
        return cached.value;
    }

    const value = await loader();
    cacheStore.set(key, {
        expiresAt: now + ttl,
        value,
    });
    return value;
}

async function readJsonFile(filePath, fallback) {
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return fallback;
        }
        throw error;
    }
}

async function writeJsonFile(filePath, payload) {
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

function sanitizeProviderConfig(input, options = {}) {
    const now = new Date().toISOString();
    const fallback = options.existing || {};
    const config = {
        id: input.id || fallback.id || createId('provider'),
        name: String(input.name || fallback.name || '').trim(),
        type: String(input.type || fallback.type || DEFAULT_PROVIDER_TYPE).trim(),
        enabled: input.enabled !== undefined ? Boolean(input.enabled) : fallback.enabled !== undefined ? Boolean(fallback.enabled) : true,
        priority: toNumber(input.priority ?? fallback.priority, 100),
        timeout: Math.max(1000, toNumber(input.timeout ?? fallback.timeout, DEFAULT_TIMEOUT)),
        requestMethod: String(input.requestMethod || fallback.requestMethod || 'GET').toUpperCase(),
        requestUrl: String(input.requestUrl || fallback.requestUrl || '').trim(),
        requestParamsTemplate: cloneJson(
            input.requestParamsTemplate || fallback.requestParamsTemplate || DEFAULT_HONGNIU_CONFIG.requestParamsTemplate
        ),
        parseRules: cloneJson(input.parseRules || fallback.parseRules || DEFAULT_PARSE_RULES),
        auth: cloneJson(
            input.auth || fallback.auth || {
                type: 'none',
                token: '',
                headerName: '',
                queryName: '',
                username: '',
                password: '',
            }
        ),
        headers: cloneJson(input.headers || fallback.headers || DEFAULT_HONGNIU_CONFIG.headers),
        fallbackUrls: ensureArray(input.fallbackUrls ?? fallback.fallbackUrls).map((item) => String(item).trim()).filter(Boolean),
        notes: String(input.notes ?? fallback.notes ?? '').trim(),
        createdAt: fallback.createdAt || now,
        updatedAt: now,
    };

    if (!config.name) {
        throw new Error('接口名称不能为空');
    }
    if (!config.type) {
        throw new Error('接口类型不能为空');
    }
    if (!config.requestUrl) {
        throw new Error('请求 URL 不能为空');
    }

    return config;
}

function sanitizeSelectionPolicy(input, providers = dataStore.providers) {
    const providerId = String(input?.providerId || '').trim();
    const hasProvider = providers.some((provider) => provider.id === providerId);
    const mode = input?.mode === 'manual' && hasProvider ? 'manual' : 'auto';

    return {
        mode,
        providerId: mode === 'manual' ? providerId : '',
        updatedAt: String(input?.updatedAt || new Date().toISOString()),
    };
}

async function ensureDataFiles() {
    await fs.mkdir(DATA_DIR, { recursive: true });

    const existingConfigs = await readJsonFile(CONFIG_FILE, null);
    if (!existingConfigs) {
        await writeJsonFile(CONFIG_FILE, {
            version: 1,
            exportedAt: new Date().toISOString(),
            providers: [DEFAULT_HONGNIU_CONFIG],
            selection: DEFAULT_SELECTION_POLICY,
        });
    }

    const existingLogs = await readJsonFile(LOG_FILE, null);
    if (!existingLogs) {
        await writeJsonFile(LOG_FILE, {
            version: 1,
            exportedAt: new Date().toISOString(),
            logs: [],
        });
    }

    const existingAnalytics = await readJsonFile(ANALYTICS_FILE, null);
    if (!existingAnalytics) {
        await writeJsonFile(ANALYTICS_FILE, {
            version: 1,
            exportedAt: new Date().toISOString(),
            events: [],
        });
    }
}

async function loadDataStore() {
    await ensureDataFiles();
    const configPayload = await readJsonFile(CONFIG_FILE, { providers: [DEFAULT_HONGNIU_CONFIG] });
    const logPayload = await readJsonFile(LOG_FILE, { logs: [] });
    const analyticsPayload = await readJsonFile(ANALYTICS_FILE, { events: [] });

    dataStore.providers = ensureArray(configPayload.providers).map((item) => sanitizeProviderConfig(item));
    dataStore.selection = sanitizeSelectionPolicy(configPayload.selection || DEFAULT_SELECTION_POLICY, dataStore.providers);
    dataStore.logs = ensureArray(logPayload.logs)
        .slice(-MAX_LOG_ENTRIES)
        .map((entry) => ({
            id: String(entry.id || createId('log')),
            providerId: String(entry.providerId || ''),
            providerName: String(entry.providerName || ''),
            operation: String(entry.operation || ''),
            request: entry.request || {},
            response: entry.response || {},
            durationMs: toNumber(entry.durationMs, 0),
            success: Boolean(entry.success),
            errorMessage: String(entry.errorMessage || ''),
            createdAt: String(entry.createdAt || new Date().toISOString()),
        }));
    dataStore.analyticsEvents = ensureArray(analyticsPayload.events).slice(-MAX_ANALYTICS_EVENTS);
}

async function saveProviders() {
    await writeJsonFile(CONFIG_FILE, {
        version: 1,
        exportedAt: new Date().toISOString(),
        providers: dataStore.providers,
        selection: dataStore.selection,
    });
}

async function saveLogs() {
    await writeJsonFile(LOG_FILE, {
        version: 1,
        exportedAt: new Date().toISOString(),
        logs: dataStore.logs.slice(-MAX_LOG_ENTRIES),
    });
}

async function saveAnalyticsEvents() {
    await writeJsonFile(ANALYTICS_FILE, {
        version: 1,
        exportedAt: new Date().toISOString(),
        events: dataStore.analyticsEvents.slice(-MAX_ANALYTICS_EVENTS),
    });
}

function maskSensitiveConfig(config) {
    const masked = cloneJson(config);
    if (masked.auth?.token) {
        masked.auth.token = '***';
    }
    if (masked.auth?.password) {
        masked.auth.password = '***';
    }
    return masked;
}

function getSortedProviders({ onlyEnabled = false } = {}) {
    return dataStore.providers
        .filter((provider) => (onlyEnabled ? provider.enabled : true))
        .slice()
        .sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name, 'zh-CN'));
}

function getProviderById(id) {
    return dataStore.providers.find((provider) => provider.id === id) || null;
}

function getSelectionSummary() {
    const selectedProvider = getProviderById(dataStore.selection.providerId);
    return {
        ...dataStore.selection,
        providerName: selectedProvider?.name || '',
    };
}

function toIsoDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    return date.toISOString().slice(0, 10);
}

function resolvePresetRange(preset, from, to) {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    function shift(days) {
        const date = new Date(today);
        date.setUTCDate(date.getUTCDate() + days);
        return date.toISOString().slice(0, 10);
    }

    if (preset === 'today') {
        return { from: shift(0), to: shift(0) };
    }
    if (preset === 'yesterday') {
        return { from: shift(-1), to: shift(-1) };
    }
    if (preset === '7d') {
        return { from: shift(-6), to: shift(0) };
    }
    if (preset === '30d') {
        return { from: shift(-29), to: shift(0) };
    }
    return {
        from: toIsoDate(from) || shift(-6),
        to: toIsoDate(to) || shift(0),
    };
}

function inferGeoLabel(country, region, city) {
    return [country, region, city].filter(Boolean).join(' / ') || '未知地区';
}

function sanitizeAnalyticsEvent(input, req) {
    const now = new Date().toISOString();
    const headers = req.headers || {};
    const forwardedFor = headers['x-forwarded-for'];
    const ip = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : String(forwardedFor || req.socket?.remoteAddress || '').split(',')[0].trim();

    return {
        id: createId('evt'),
        eventType: String(input.eventType || 'page_view').trim(),
        pageType: String(input.pageType || 'home').trim(),
        itemId: String(input.itemId || '').trim(),
        itemName: String(input.itemName || '').trim(),
        itemTypeName: String(input.itemTypeName || '').trim(),
        itemTypeId: String(input.itemTypeId || '').trim(),
        providerId: String(input.providerId || '').trim(),
        providerName: String(input.providerName || '').trim(),
        sessionId: String(input.sessionId || '').trim() || createId('session'),
        userId: String(input.userId || '').trim(),
        watchDurationSeconds: Math.max(0, toNumber(input.watchDurationSeconds, 0)),
        completed: Boolean(input.completed),
        completionRate: Math.max(0, Math.min(1, Number(input.completionRate || 0))),
        country: String(input.country || '').trim(),
        region: String(input.region || '').trim(),
        city: String(input.city || '').trim(),
        geoLabel: inferGeoLabel(input.country, input.region, input.city),
        referrer: String(input.referrer || headers.referer || '').trim(),
        userAgent: String(input.userAgent || headers['user-agent'] || '').trim(),
        ip,
        createdAt: String(input.createdAt || now),
    };
}

async function recordAnalyticsEvent(input, req) {
    const event = sanitizeAnalyticsEvent(input, req);
    dataStore.analyticsEvents.push(event);
    dataStore.analyticsEvents = dataStore.analyticsEvents.slice(-MAX_ANALYTICS_EVENTS);
    await saveAnalyticsEvents();
    return event;
}

function filterAnalyticsEvents({ from, to }) {
    const range = resolvePresetRange('custom', from, to);
    return dataStore.analyticsEvents.filter((event) => {
        const date = toIsoDate(event.createdAt);
        return date >= range.from && date <= range.to;
    });
}

function groupCountBy(items, iteratee) {
    const bucket = new Map();
    items.forEach((item) => {
        const key = iteratee(item);
        bucket.set(key, (bucket.get(key) || 0) + 1);
    });
    return [...bucket.entries()].map(([name, value]) => ({ name, value }));
}

function round(value, digits = 2) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function buildDateSeries(events, from, to) {
    const points = [];
    const counts = new Map(groupCountBy(events.filter((event) => event.eventType === 'page_view'), (event) => toIsoDate(event.createdAt)).map((entry) => [entry.name, entry.value]));
    const start = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T00:00:00.000Z`);

    for (let date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
        const label = date.toISOString().slice(0, 10);
        points.push({
            date: label,
            visits: counts.get(label) || 0,
        });
    }

    return points;
}

function buildAnalyticsSummary({ preset, from, to }) {
    const range = resolvePresetRange(preset, from, to);
    const events = filterAnalyticsEvents(range);
    const pageViews = events.filter((event) => event.eventType === 'page_view');
    const playStarts = events.filter((event) => event.eventType === 'play_start');
    const playProgress = events.filter((event) => event.eventType === 'play_progress');
    const uniqueSessions = new Set(events.map((event) => event.sessionId).filter(Boolean));
    const yesterdayRange = resolvePresetRange('yesterday');
    const yesterdaySessions = new Set(filterAnalyticsEvents(yesterdayRange).map((event) => event.sessionId).filter(Boolean));
    const retainedSessions = [...uniqueSessions].filter((sessionId) => yesterdaySessions.has(sessionId));

    const watchDurations = playProgress.map((event) => event.watchDurationSeconds).filter((value) => value > 0);
    const totalWatchDuration = watchDurations.reduce((sum, value) => sum + value, 0);
    const avgWatchDuration = watchDurations.length ? round(totalWatchDuration / watchDurations.length, 1) : 0;
    const completedCount = playProgress.filter((event) => event.completed).length;
    const completionRate = playProgress.length ? round((completedCount / playProgress.length) * 100, 1) : 0;
    const retentionRate = uniqueSessions.size ? round((retainedSessions.length / uniqueSessions.size) * 100, 1) : 0;

    const topItems = groupCountBy(playStarts, (event) => event.itemName || event.itemId || '未知影片')
        .sort((left, right) => right.value - left.value)
        .slice(0, 10);
    const categoryDistribution = groupCountBy(playStarts, (event) => event.itemTypeName || '未分类')
        .sort((left, right) => right.value - left.value);
    const geoDistribution = groupCountBy(pageViews, (event) => event.geoLabel || '未知地区')
        .sort((left, right) => right.value - left.value)
        .slice(0, 10);
    const weekSummary = buildDateSeries(events, range.from, range.to);

    return {
        range,
        overview: {
            visitCount: pageViews.length,
            sessionCount: uniqueSessions.size,
            playCount: playStarts.length,
            avgWatchDuration,
            completionRate,
            retentionRate,
        },
        trends: {
            visitsByDay: weekSummary,
            visitByWeek: groupCountBy(pageViews, (event) => {
                const date = new Date(event.createdAt);
                const year = date.getUTCFullYear();
                const firstDay = new Date(Date.UTC(year, 0, 1));
                const diffDays = Math.floor((date - firstDay) / 86400000);
                const week = Math.floor(diffDays / 7) + 1;
                return `${year}-W${String(week).padStart(2, '0')}`;
            }).sort((left, right) => left.name.localeCompare(right.name)),
            visitByMonth: groupCountBy(pageViews, (event) => String(event.createdAt || '').slice(0, 7)).sort((left, right) => left.name.localeCompare(right.name)),
        },
        distributions: {
            geo: geoDistribution,
            categories: categoryDistribution,
        },
        rankings: {
            topItems,
        },
        behavior: {
            averageWatchDurationSeconds: avgWatchDuration,
            completionRate,
            retentionRate,
            totalWatchDurationSeconds: totalWatchDuration,
        },
        events,
    };
}

async function recordProviderLog(entry) {
    dataStore.logs.push({
        id: createId('log'),
        providerId: String(entry.providerId || ''),
        providerName: String(entry.providerName || ''),
        operation: String(entry.operation || ''),
        request: entry.request || {},
        response: entry.response || {},
        durationMs: toNumber(entry.durationMs, 0),
        success: Boolean(entry.success),
        errorMessage: String(entry.errorMessage || ''),
        createdAt: new Date().toISOString(),
    });

    dataStore.logs = dataStore.logs.slice(-MAX_LOG_ENTRIES);
    await saveLogs();
}

function buildAuth(config, searchParams, headers) {
    const auth = config.auth || {};
    const type = String(auth.type || 'none').toLowerCase();

    if (type === 'bearer' && auth.token) {
        headers.Authorization = `Bearer ${auth.token}`;
    }

    if (type === 'header-key' && auth.token && auth.headerName) {
        headers[auth.headerName] = auth.token;
    }

    if (type === 'query-key' && auth.token && auth.queryName) {
        searchParams.set(auth.queryName, auth.token);
    }

    if (type === 'basic' && auth.username) {
        const base64Value = Buffer.from(`${auth.username}:${auth.password || ''}`).toString('base64');
        headers.Authorization = `Basic ${base64Value}`;
    }
}

function normalizeCategoriesFromPayload(payload, parseRules = DEFAULT_PARSE_RULES) {
    const categoryPath = parseRules.categoryPath || 'class';
    const fieldRules = parseRules.fields || DEFAULT_PARSE_RULES.fields;
    const rawCategories = ensureArray(pickFirstValue(payload, categoryPath));

    if (!rawCategories.length) {
        return FALLBACK_CATEGORIES;
    }

    return rawCategories.map((entry) => ({
        type_id: toNumber(pickFirstValue(entry, fieldRules.categoryId || 'type_id'), 0),
        type_name: String(pickFirstValue(entry, fieldRules.categoryName || 'type_name') || '').trim(),
    }));
}

function normalizeVodItem(item, categories, parseRules = DEFAULT_PARSE_RULES) {
    const fields = parseRules.fields || DEFAULT_PARSE_RULES.fields;
    const typeId = toNumber(pickFirstValue(item, fields.typeId), 0);
    const matchedCategory = categories.find((entry) => entry.type_id === typeId);
    const typeName = String(pickFirstValue(item, fields.typeName) || matchedCategory?.type_name || '未分类').trim();

    return {
        id: toNumber(pickFirstValue(item, fields.id), 0),
        name: String(pickFirstValue(item, fields.name) || '未命名影片').trim(),
        subtitle: String(pickFirstValue(item, fields.subtitle) || '').trim(),
        slug: String(pickFirstValue(item, fields.slug) || '').trim(),
        typeId,
        typeName,
        className: String(pickFirstValue(item, fields.className) || typeName).trim(),
        poster: String(pickFirstValue(item, fields.poster) || '').trim(),
        actor: String(pickFirstValue(item, fields.actor) || '').trim(),
        director: String(pickFirstValue(item, fields.director) || '').trim(),
        area: String(pickFirstValue(item, fields.area) || '').trim(),
        year: String(pickFirstValue(item, fields.year) || '').trim(),
        lang: String(pickFirstValue(item, fields.lang) || '').trim(),
        remarks: String(pickFirstValue(item, fields.remarks) || '').trim(),
        score: String(pickFirstValue(item, fields.score) || '').trim(),
        duration: String(pickFirstValue(item, fields.duration) || '').trim(),
        pubdate: String(pickFirstValue(item, fields.pubdate) || '').trim(),
        updateTime: String(pickFirstValue(item, fields.updateTime) || '').trim(),
        hits: toNumber(pickFirstValue(item, fields.hits), 0),
        content: stripHtml(pickFirstValue(item, fields.content) || ''),
        sources: parsePlaySources(pickFirstValue(item, fields.playFrom), pickFirstValue(item, fields.playUrl)),
    };
}

function normalizeJsonPayload(payload, config, extra = {}) {
    const parseRules = config.parseRules || DEFAULT_PARSE_RULES;
    const categories = normalizeCategoriesFromPayload(payload, parseRules);
    const listPath = parseRules.listPath || 'list';
    const list = ensureArray(pickFirstValue(payload, listPath)).map((item) => normalizeVodItem(item, categories, parseRules));

    return {
        code: toNumber(payload.code, 1),
        msg: String(payload.msg || 'ok'),
        page: toNumber(payload.page, 1),
        pagecount: toNumber(payload.pagecount, 1),
        limit: toNumber(payload.limit, list.length || 20),
        total: toNumber(payload.total, list.length),
        class: categories,
        list,
        meta: extra.meta || {},
    };
}

async function requestProvider(config, operation, params = {}) {
    const startedAt = Date.now();
    const requestMethod = config.requestMethod || 'GET';
    const endpoints = [config.requestUrl, ...ensureArray(config.fallbackUrls).filter((item) => item !== config.requestUrl)];
    const requestTemplates = config.requestParamsTemplate || {};
    const mergedParams = compactObject({
        ...(requestTemplates.common || {}),
        ...(requestTemplates[operation] || {}),
    });
    const finalParams = renderTemplateObject(mergedParams, params);
    const finalHeaders = cloneJson(config.headers || {});

    let lastError = null;

    for (const baseUrl of endpoints) {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(compactObject(finalParams))) {
            searchParams.set(key, String(value));
        }

        buildAuth(config, searchParams, finalHeaders);

        const endpoint = searchParams.size ? `${baseUrl}?${searchParams.toString()}` : baseUrl;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), config.timeout || DEFAULT_TIMEOUT);

        try {
            const response = await fetch(endpoint, {
                method: requestMethod,
                headers: finalHeaders,
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                lastError = new Error(`Provider ${config.name} returned ${response.status}`);
                continue;
            }

            const json = await response.json();
            const normalized = normalizeJsonPayload(json, config, {
                meta: {
                    providerId: config.id,
                    providerName: config.name,
                    providerType: config.type,
                    operation,
                    endpoint: baseUrl,
                },
            });

            await recordProviderLog({
                providerId: config.id,
                providerName: config.name,
                operation,
                request: {
                    url: endpoint,
                    method: requestMethod,
                    params: finalParams,
                },
                response: {
                    code: normalized.code,
                    total: normalized.total,
                    page: normalized.page,
                    pagecount: normalized.pagecount,
                    sampleCount: normalized.list.length,
                },
                durationMs: Date.now() - startedAt,
                success: true,
                errorMessage: '',
            });

            return normalized;
        } catch (error) {
            clearTimeout(timeout);
            lastError = error;
        }
    }

    await recordProviderLog({
        providerId: config.id,
        providerName: config.name,
        operation,
        request: {
            url: endpoints[0] || '',
            method: requestMethod,
            params: finalParams,
        },
        response: {},
        durationMs: Date.now() - startedAt,
        success: false,
        errorMessage: lastError ? lastError.message : 'Unknown provider error',
    });

    throw lastError || new Error(`Provider ${config.name} unavailable`);
}

function includesKeyword(sourceText, keyword) {
    return String(sourceText || '').toLowerCase().includes(String(keyword || '').toLowerCase());
}

function dedupeById(items) {
    const seen = new Set();
    return items.filter((item) => {
        if (seen.has(item.id)) {
            return false;
        }
        seen.add(item.id);
        return true;
    });
}

function getProviderCandidates(requestedProviderId = '') {
    const enabledProviders = getSortedProviders({ onlyEnabled: true });
    if (!enabledProviders.length) {
        throw new Error('没有可用的影视资源接口，请先在管理页启用至少一个接口');
    }

    if (requestedProviderId) {
        const requested = enabledProviders.find((provider) => provider.id === requestedProviderId);
        if (!requested) {
            throw new Error('指定的影视资源接口不存在或未启用');
        }
        return {
            mode: 'manual',
            providers: [requested],
            selectedProviderId: requested.id,
        };
    }

    if (dataStore.selection.mode === 'manual') {
        const manualProvider = enabledProviders.find((provider) => provider.id === dataStore.selection.providerId);
        if (!manualProvider) {
            dataStore.selection = sanitizeSelectionPolicy({ mode: 'auto', providerId: '' }, dataStore.providers);
            return {
                mode: 'auto',
                providers: enabledProviders,
                selectedProviderId: '',
            };
        }
        return {
            mode: 'manual',
            providers: [manualProvider],
            selectedProviderId: manualProvider.id,
        };
    }

    return {
        mode: 'auto',
        providers: enabledProviders,
        selectedProviderId: '',
    };
}

async function executeProviderOperation(operation, params = {}, options = {}) {
    const providerSelection = getProviderCandidates(options.providerId || '');
    const errors = [];

    for (const provider of providerSelection.providers) {
        try {
            const payload = await requestProvider(provider, operation, params);
            payload.meta = {
                ...(payload.meta || {}),
                selectionMode: providerSelection.mode,
                requestedProviderId: options.providerId || '',
                fallbackTried: errors.length,
                selectedProviderId: provider.id,
                selectedProviderName: provider.name,
            };
            return payload;
        } catch (error) {
            errors.push({
                providerId: provider.id,
                providerName: provider.name,
                message: error.message,
            });
        }
    }

    const reason =
        providerSelection.mode === 'manual'
            ? '指定接口调用失败'
            : `自动切换失败，已尝试 ${providerSelection.providers.length} 个接口`;
    const lastError = errors[errors.length - 1];
    throw new Error(`${reason}${lastError ? `：${lastError.providerName} - ${lastError.message}` : ''}`);
}

async function getCategories({ providerId = '' } = {}) {
    const cacheKey = `categories:${providerId || dataStore.selection.mode}:${providerId || dataStore.selection.providerId || 'auto'}`;
    return getCached(cacheKey, CACHE_TTL.categories, async () => {
        const payload = await executeProviderOperation('categories', { page: 1 }, { providerId });
        return payload.class;
    });
}

async function getHomeData({ page, typeId, hours, providerId = '' }) {
    const cacheKey = `home:${providerId || dataStore.selection.mode}:${providerId || dataStore.selection.providerId || 'auto'}:${page}:${typeId || 'all'}:${hours || 'all'}`;
    return getCached(cacheKey, CACHE_TTL.browse, async () => {
        return executeProviderOperation('home', {
            page,
            typeId,
            hours,
        }, { providerId });
    });
}

async function getDetailData(id, { providerId = '' } = {}) {
    const cacheKey = `detail:${providerId || dataStore.selection.mode}:${providerId || dataStore.selection.providerId || 'auto'}:${id}`;
    return getCached(cacheKey, CACHE_TTL.detail, async () => {
        return executeProviderOperation('detail', {
            id,
        }, { providerId });
    });
}

async function searchByActor({ keyword, typeId, page, providerId = '' }) {
    const selection = getProviderCandidates(providerId);
    const provider = selection.providers[0];
    const scanLimit = Math.min(Math.max(page * 12, 12), 60);
    const pageSize = 20;
    const matches = [];
    let scannedPages = 0;
    let totalPages = scanLimit;
    let categories = FALLBACK_CATEGORIES;

    for (let currentPage = 1; currentPage <= scanLimit; currentPage += 1) {
        const normalized = await requestProvider(provider, 'actorSearch', {
            page: currentPage,
            typeId,
            keyword,
        });

        categories = normalized.class;
        scannedPages = currentPage;
        totalPages = Number(normalized.pagecount || currentPage);
        matches.push(...normalized.list.filter((item) => includesKeyword(item.actor, keyword)));

        if (matches.length >= page * pageSize || currentPage >= totalPages) {
            break;
        }

        await delay(20);
    }

    const deduped = dedupeById(matches);
    const startIndex = (page - 1) * pageSize;

    return {
        code: 1,
        msg: 'ok',
        page,
        pagecount: Math.max(1, Math.ceil(deduped.length / pageSize)),
        limit: pageSize,
        total: deduped.length,
        class: categories,
        list: deduped.slice(startIndex, startIndex + pageSize),
        meta: {
            partial: scannedPages < totalPages,
            scannedPages,
            providerId: provider.id,
            providerName: provider.name,
            selectionMode: selection.mode,
        },
    };
}

async function searchCatalog({ keyword, field, typeId, page, providerId = '' }) {
    const cacheKey = `search:${providerId || dataStore.selection.mode}:${providerId || dataStore.selection.providerId || 'auto'}:${field}:${keyword}:${typeId || 'all'}:${page}`;
    const ttl = field === 'actor' ? CACHE_TTL.actorSearch : CACHE_TTL.browse;

    return getCached(cacheKey, ttl, async () => {
        if (field === 'actor') {
            return searchByActor({ keyword, typeId, page, providerId });
        }

        const normalized = await executeProviderOperation('search', {
            keyword,
            field,
            typeId,
            page,
        }, { providerId });

        return {
            ...normalized,
            list:
                field === 'name'
                    ? normalized.list.filter((item) => includesKeyword(item.name, keyword))
                    : normalized.list,
        };
    });
}

function trimLogSummary(limit = 50) {
    return dataStore.logs
        .slice(-limit)
        .reverse()
        .map((entry) => ({
            ...entry,
            request: entry.request,
            response: entry.response,
        }));
}

async function readRequestBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    if (!raw) {
        return {};
    }
    return JSON.parse(raw);
}

async function handleProviderCollection(req, res) {
    if (req.method === 'GET') {
        sendJson(res, 200, {
            code: 1,
            list: getSortedProviders().map(maskSensitiveConfig),
        });
        return;
    }

    if (req.method === 'POST') {
        const body = await readRequestBody(req);
        const provider = sanitizeProviderConfig(body);
        dataStore.providers.push(provider);
        await saveProviders();
        clearCacheByPrefix('');
        sendJson(res, 201, {
            code: 1,
            msg: '接口配置已创建',
            item: maskSensitiveConfig(provider),
        });
        return;
    }

    sendText(res, 405, 'Method not allowed');
}

async function handleProviderItem(req, res, providerId, action) {
    const provider = getProviderById(providerId);
    if (!provider) {
        sendJson(res, 404, { code: 0, msg: '接口配置不存在' });
        return;
    }

    if (!action) {
        if (req.method === 'PUT') {
            const body = await readRequestBody(req);
            const updated = sanitizeProviderConfig(
                {
                    ...provider,
                    ...body,
                    id: provider.id,
                },
                { existing: provider }
            );
            const index = dataStore.providers.findIndex((item) => item.id === provider.id);
            dataStore.providers[index] = updated;
            await saveProviders();
            clearCacheByPrefix('');
            sendJson(res, 200, {
                code: 1,
                msg: '接口配置已更新',
                item: maskSensitiveConfig(updated),
            });
            return;
        }

        if (req.method === 'DELETE') {
            dataStore.providers = dataStore.providers.filter((item) => item.id !== provider.id);
            if (!dataStore.providers.length) {
                dataStore.providers = [sanitizeProviderConfig(DEFAULT_HONGNIU_CONFIG)];
            }
            await saveProviders();
            clearCacheByPrefix('');
            sendJson(res, 200, {
                code: 1,
                msg: '接口配置已删除',
            });
            return;
        }
    }

    if (action === 'toggle' && req.method === 'POST') {
        provider.enabled = !provider.enabled;
        provider.updatedAt = new Date().toISOString();
        await saveProviders();
        clearCacheByPrefix('');
        sendJson(res, 200, {
            code: 1,
            msg: provider.enabled ? '接口已启用' : '接口已禁用',
            item: maskSensitiveConfig(provider),
        });
        return;
    }

    if (action === 'test' && req.method === 'POST') {
        const payload = await requestProvider(provider, 'home', { page: 1, typeId: '', hours: '' });
        sendJson(res, 200, {
            code: 1,
            msg: '接口测试成功',
            item: {
                providerId: provider.id,
                providerName: provider.name,
                total: payload.total,
                page: payload.page,
                sampleCount: payload.list.length,
            },
        });
        return;
    }

    sendText(res, 405, 'Method not allowed');
}

async function handleConfigExport(res) {
    sendJson(res, 200, {
        code: 1,
        exportedAt: new Date().toISOString(),
        providers: getSortedProviders().map((item) => cloneJson(item)),
    });
}

async function handleConfigImport(req, res) {
    const body = await readRequestBody(req);
    const rawProviders = ensureArray(body.providers);
    if (!rawProviders.length) {
        sendJson(res, 400, { code: 0, msg: '导入数据缺少 providers 数组' });
        return;
    }

    dataStore.providers = rawProviders.map((item) => sanitizeProviderConfig(item));
    dataStore.selection = sanitizeSelectionPolicy(body.selection || dataStore.selection, dataStore.providers);
    await saveProviders();
    clearCacheByPrefix('');
    sendJson(res, 200, {
        code: 1,
        msg: '接口配置导入成功',
        count: dataStore.providers.length,
    });
}

async function handleSelectionPolicy(req, res) {
    if (req.method === 'GET') {
        sendJson(res, 200, {
            code: 1,
            item: getSelectionSummary(),
            providers: getSortedProviders({ onlyEnabled: true }).map((provider) => ({
                id: provider.id,
                name: provider.name,
                priority: provider.priority,
                enabled: provider.enabled,
            })),
        });
        return;
    }

    if (req.method === 'POST') {
        const body = await readRequestBody(req);
        const nextSelection = sanitizeSelectionPolicy(
            {
                mode: body.mode,
                providerId: body.providerId,
                updatedAt: new Date().toISOString(),
            },
            dataStore.providers
        );

        if (body.mode === 'manual' && !nextSelection.providerId) {
            sendJson(res, 400, { code: 0, msg: '手动指定模式需要提供一个已启用的接口' });
            return;
        }

        dataStore.selection = nextSelection;
        await saveProviders();
        clearCacheByPrefix('');
        sendJson(res, 200, {
            code: 1,
            msg: nextSelection.mode === 'manual' ? '已切换为手动指定接口' : '已切换为自动选择接口',
            item: getSelectionSummary(),
        });
        return;
    }

    sendText(res, 405, 'Method not allowed');
}

async function handleAnalyticsCollect(req, res) {
    if (req.method !== 'POST') {
        sendText(res, 405, 'Method not allowed');
        return;
    }

    const body = await readRequestBody(req);
    const event = await recordAnalyticsEvent(body, req);
    sendJson(res, 201, {
        code: 1,
        msg: '统计事件已记录',
        item: {
            id: event.id,
            eventType: event.eventType,
            createdAt: event.createdAt,
        },
    });
}

async function handleAnalyticsSummary(req, res, requestUrl) {
    if (req.method !== 'GET') {
        sendText(res, 405, 'Method not allowed');
        return;
    }

    const preset = String(requestUrl.searchParams.get('preset') || '7d').trim();
    const from = String(requestUrl.searchParams.get('from') || '').trim();
    const to = String(requestUrl.searchParams.get('to') || '').trim();
    const payload = buildAnalyticsSummary({ preset, from, to });

    sendJson(res, 200, {
        code: 1,
        ...payload,
    });
}

function convertAnalyticsToCsv(summary) {
    const lines = [
        ['Metric', 'Value'],
        ['Visit Count', summary.overview.visitCount],
        ['Session Count', summary.overview.sessionCount],
        ['Play Count', summary.overview.playCount],
        ['Average Watch Duration Seconds', summary.overview.avgWatchDuration],
        ['Completion Rate', `${summary.overview.completionRate}%`],
        ['Retention Rate', `${summary.overview.retentionRate}%`],
        [],
        ['Top Item', 'Plays'],
        ...summary.rankings.topItems.map((item) => [item.name, item.value]),
    ];

    return lines
        .map((row) =>
            row
                .map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`)
                .join(',')
        )
        .join('\n');
}

async function handleAnalyticsExport(req, res, requestUrl) {
    if (req.method !== 'GET') {
        sendText(res, 405, 'Method not allowed');
        return;
    }

    const preset = String(requestUrl.searchParams.get('preset') || '7d').trim();
    const from = String(requestUrl.searchParams.get('from') || '').trim();
    const to = String(requestUrl.searchParams.get('to') || '').trim();
    const format = String(requestUrl.searchParams.get('format') || 'json').trim().toLowerCase();
    const summary = buildAnalyticsSummary({ preset, from, to });

    if (format === 'csv') {
        const csv = convertAnalyticsToCsv(summary);
        res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="analytics-${summary.range.from}-${summary.range.to}.csv"`,
            'Cache-Control': 'no-store',
        });
        res.end(csv);
        return;
    }

    sendJson(res, 200, {
        code: 1,
        ...summary,
    });
}

async function serveStaticFile(res, pathname) {
    const decodedPath = decodeURIComponent(pathname);
    const relativePath = decodedPath === '/' ? '/index.html' : decodedPath;
    const filePath = path.normalize(path.join(PUBLIC_DIR, relativePath));

    if (!filePath.startsWith(PUBLIC_DIR)) {
        sendText(res, 403, 'Forbidden');
        return;
    }

    try {
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
            const html = await fs.readFile(INDEX_FILE);
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store',
            });
            res.end(html);
            return;
        }

        const content = await fs.readFile(filePath);
        res.writeHead(200, {
            'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': path.extname(filePath) ? 'public, max-age=86400' : 'no-store',
        });
        res.end(content);
    } catch (error) {
        if (path.extname(filePath)) {
            sendText(res, 404, 'Not found');
            return;
        }

        const html = await fs.readFile(INDEX_FILE);
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        });
        res.end(html);
    }
}

const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = requestUrl.pathname;

    try {
        if (pathname === '/api/health' && req.method === 'GET') {
            sendJson(res, 200, {
                ok: true,
                uptime: process.uptime(),
                providerCount: dataStore.providers.length,
                enabledProviderCount: getSortedProviders({ onlyEnabled: true }).length,
            });
            return;
        }

        if (pathname === '/api/categories' && req.method === 'GET') {
            const providerId = String(requestUrl.searchParams.get('provider') || '').trim();
            const categories = await getCategories({ providerId });
            sendJson(res, 200, {
                code: 1,
                list: categories,
                meta: {
                    selection: getSelectionSummary(),
                    requestedProviderId: providerId,
                },
            });
            return;
        }

        if (pathname === '/api/home' && req.method === 'GET') {
            const page = Math.max(1, Number(requestUrl.searchParams.get('pg') || '1'));
            const typeId = requestUrl.searchParams.get('t') || '';
            const hours = requestUrl.searchParams.get('h') || '';
            const providerId = String(requestUrl.searchParams.get('provider') || '').trim();
            const payload = await getHomeData({ page, typeId, hours, providerId });
            sendJson(res, 200, payload);
            return;
        }

        if (pathname === '/api/search' && req.method === 'GET') {
            const keyword = String(requestUrl.searchParams.get('q') || '').trim();
            const field = String(requestUrl.searchParams.get('field') || 'all').trim();
            const typeId = requestUrl.searchParams.get('t') || '';
            const page = Math.max(1, Number(requestUrl.searchParams.get('pg') || '1'));
            const providerId = String(requestUrl.searchParams.get('provider') || '').trim();

            if (!keyword) {
                const payload = await getHomeData({ page, typeId, hours: '', providerId });
                sendJson(res, 200, payload);
                return;
            }

            const payload = await searchCatalog({ keyword, field, typeId, page, providerId });
            sendJson(res, 200, payload);
            return;
        }

        if (pathname === '/api/detail' && req.method === 'GET') {
            const id = String(requestUrl.searchParams.get('id') || '').trim();
            const providerId = String(requestUrl.searchParams.get('provider') || '').trim();
            if (!id) {
                sendJson(res, 400, { code: 0, msg: 'Missing id parameter' });
                return;
            }

            const payload = await getDetailData(id, { providerId });
            sendJson(res, 200, payload);
            return;
        }

        if (pathname === '/api/admin/providers') {
            await handleProviderCollection(req, res);
            return;
        }

        if (pathname.startsWith('/api/admin/providers/')) {
            const restPath = pathname.replace('/api/admin/providers/', '');
            const [providerId, action] = restPath.split('/');
            await handleProviderItem(req, res, providerId, action || '');
            return;
        }

        if (pathname === '/api/admin/logs' && req.method === 'GET') {
            sendJson(res, 200, {
                code: 1,
                list: trimLogSummary(100),
            });
            return;
        }

        if (pathname === '/api/admin/selection') {
            await handleSelectionPolicy(req, res);
            return;
        }

        if (pathname === '/api/analytics/collect') {
            await handleAnalyticsCollect(req, res);
            return;
        }

        if (pathname === '/api/admin/analytics/summary') {
            await handleAnalyticsSummary(req, res, requestUrl);
            return;
        }

        if (pathname === '/api/admin/analytics/export') {
            await handleAnalyticsExport(req, res, requestUrl);
            return;
        }

        if (pathname === '/api/admin/config/export' && req.method === 'GET') {
            await handleConfigExport(res);
            return;
        }

        if (pathname === '/api/admin/config/import' && req.method === 'POST') {
            await handleConfigImport(req, res);
            return;
        }

        await serveStaticFile(res, pathname);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] ${req.method} ${pathname}`, error);
        sendJson(res, 500, {
            code: 0,
            msg: '服务暂时不可用，请稍后再试',
            error: error.message,
        });
    }
});

loadDataStore()
    .then(() => {
        server.listen(PORT, HOST, () => {
            console.log(`Sunny影视已启动: http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error('初始化数据失败', error);
        process.exitCode = 1;
    });
