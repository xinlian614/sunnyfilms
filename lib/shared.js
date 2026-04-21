/**
 * 共享工具函数
 */

export const DEFAULT_HONGNIU_CONFIG = {
  id: 'provider_hongniu_default',
  name: '红牛资源',
  type: 'mac-cms-v10-json',
  enabled: true,
  priority: 100,
  timeout: 12000,
  requestMethod: 'GET',
  requestUrl: 'https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/',
  requestParamsTemplate: {
    common: { ac: 'detail' },
    home: { pg: '{{page}}', t: '{{typeId}}', h: '{{hours}}' },
    categories: { pg: 1 },
    detail: { ids: '{{id}}' },
    search: { pg: '{{page}}', t: '{{typeId}}', wd: '{{keyword}}' },
    actorSearch: { pg: '{{page}}', t: '{{typeId}}' }
  },
  parseRules: {
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
      playUrl: 'vod_play_url'
    }
  },
  auth: { type: 'none', token: '', headerName: '', queryName: '', username: '', password: '' },
  headers: {
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
    'User-Agent': 'SunnyFilms/2.0'
  },
  fallbackUrls: ['https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/'],
  notes: '默认红牛资源配置',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const DEFAULT_SELECTION_POLICY = {
  mode: 'auto',
  providerId: '',
  updatedAt: new Date().toISOString()
};

export const FALLBACK_CATEGORIES = [
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
  { type_id: 31, type_name: '预告片' }
];

export function sendJson(res, statusCode, payload) {
  const JSON_HEADERS = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  };
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: JSON_HEADERS
  });
}

export function sendText(res, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  return new Response(body, {
    status: statusCode,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store'
    }
  });
}

export function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== '')
  );
}

export function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export function stripHtml(value) {
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

export function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function splitPlayGroups(value) {
  return String(value || '')
    .split('$$$')
    .map(entry => entry.trim())
    .filter(Boolean);
}

export function parseEpisodes(groupValue) {
  return String(groupValue || '')
    .split('#')
    .map(part => part.trim())
    .filter(Boolean)
    .map((part, index) => {
      const markerIndex = part.indexOf('$');
      if (markerIndex === -1) {
        return { label: `第${index + 1}集`, url: part };
      }
      const label = part.slice(0, markerIndex).trim() || `第${index + 1}集`;
      const url = part.slice(markerIndex + 1).trim();
      return { label, url };
    })
    .filter(episode => episode.url);
}

export function getSourceLabel(sourceKey) {
  const normalized = String(sourceKey || '').trim();
  if (normalized === 'hnm3u8') return 'M3U8';
  if (normalized === 'hnyun') return '云播';
  return normalized || '播放源';
}

export function parsePlaySources(vodPlayFrom, vodPlayUrl) {
  const sourceKeys = splitPlayGroups(vodPlayFrom);
  const sourceUrls = splitPlayGroups(vodPlayUrl);
  const maxLength = Math.max(sourceKeys.length, sourceUrls.length);
  const groups = [];

  for (let index = 0; index < maxLength; index += 1) {
    const key = sourceKeys[index] || (maxLength === 1 ? 'default' : `source${index + 1}`);
    const episodes = parseEpisodes(sourceUrls[index] || '');
    if (!episodes.length) continue;
    groups.push({
      key,
      label: getSourceLabel(key),
      directStream: episodes.some(episode => /\.m3u8($|\?)/i.test(episode.url)),
      episodes
    });
  }
  return groups;
}

export function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createId(prefix = 'id') {
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  return `${prefix}_${Array.from(arr, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function pickFirstValue(source, selector) {
  if (Array.isArray(selector)) {
    for (const key of selector) {
      const picked = pickFirstValue(source, key);
      if (picked !== undefined && picked !== null && picked !== '') {
        return picked;
      }
    }
    return undefined;
  }
  if (!selector) return undefined;
  return selector
    .split('.')
    .reduce((current, key) => (current === undefined || current === null ? undefined : current[key]), source);
}

export function renderTemplateValue(value, context) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, token) => {
    const resolved = pickFirstValue(context, token);
    return resolved === undefined || resolved === null ? '' : String(resolved);
  });
}

export function renderTemplateObject(template, context) {
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

export function includesKeyword(sourceText, keyword) {
  return String(sourceText || '').toLowerCase().includes(String(keyword || '').toLowerCase());
}

export function dedupeById(items) {
  const seen = new Set();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function toIsoDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function resolvePresetRange(preset, from, to) {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  function shift(days) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
  if (preset === 'today') return { from: shift(0), to: shift(0) };
  if (preset === 'yesterday') return { from: shift(-1), to: shift(-1) };
  if (preset === '7d') return { from: shift(-6), to: shift(0) };
  if (preset === '30d') return { from: shift(-29), to: shift(0) };
  return {
    from: toIsoDate(from) || shift(-6),
    to: toIsoDate(to) || shift(0)
  };
}

export function inferGeoLabel(country, region, city) {
  return [country, region, city].filter(Boolean).join(' / ') || '未知地区';
}

export function groupCountBy(items, iteratee) {
  const bucket = new Map();
  items.forEach(item => {
    const key = iteratee(item);
    bucket.set(key, (bucket.get(key) || 0) + 1);
  });
  return [...bucket.entries()].map(([name, value]) => ({ name, value }));
}

export function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function buildDateSeries(events, from, to) {
  const points = [];
  const counts = new Map(
    groupCountBy(
      events.filter(event => event.eventType === 'page_view'),
      event => toIsoDate(event.createdAt)
    ).map(entry => [entry.name, entry.value])
  );
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);

  for (let date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    const label = date.toISOString().slice(0, 10);
    points.push({
      date: label,
      visits: counts.get(label) || 0
    });
  }
  return points;
}

export function convertAnalyticsToCsv(summary) {
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
    ...summary.rankings.topItems.map(item => [item.name, item.value])
  ];
  return lines
    .map(row => row.map(value => `"${String(value || '').replaceAll('"', '""')}"`).join(','))
    .join('\n');
}

export function sanitizeProviderConfig(input, options = {}) {
  const now = new Date().toISOString();
  const fallback = options.existing || {};
  const config = {
    id: input.id || fallback.id || createId('provider'),
    name: String(input.name || fallback.name || '').trim(),
    type: String(input.type || fallback.type || DEFAULT_PROVIDER_TYPE).trim(),
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : fallback.enabled !== undefined ? Boolean(fallback.enabled) : true,
    priority: toNumber(input.priority ?? fallback.priority, 100),
    timeout: Math.max(1000, toNumber(input.timeout ?? fallback.timeout, 12000)),
    requestMethod: String(input.requestMethod || fallback.requestMethod || 'GET').toUpperCase(),
    requestUrl: String(input.requestUrl || fallback.requestUrl || '').trim(),
    requestParamsTemplate: cloneJson(input.requestParamsTemplate || fallback.requestParamsTemplate || DEFAULT_HONGNIU_CONFIG.requestParamsTemplate),
    parseRules: cloneJson(input.parseRules || fallback.parseRules || DEFAULT_HONGNIU_CONFIG.parseRules),
    auth: cloneJson(input.auth || fallback.auth || { type: 'none', token: '', headerName: '', queryName: '', username: '', password: '' }),
    headers: cloneJson(input.headers || fallback.headers || DEFAULT_HONGNIU_CONFIG.headers),
    fallbackUrls: ensureArray(input.fallbackUrls ?? fallback.fallbackUrls).map(item => String(item).trim()).filter(Boolean),
    notes: String(input.notes ?? fallback.notes ?? '').trim(),
    createdAt: fallback.createdAt || now,
    updatedAt: now
  };

  if (!config.name) throw new Error('接口名称不能为空');
  if (!config.type) throw new Error('接口类型不能为空');
  if (!config.requestUrl) throw new Error('请求 URL 不能为空');

  return config;
}

export function sanitizeSelectionPolicy(input, providers) {
  const providerId = String(input?.providerId || '').trim();
  const hasProvider = providers.some(provider => provider.id === providerId);
  const mode = input?.mode === 'manual' && hasProvider ? 'manual' : 'auto';

  return {
    mode,
    providerId: mode === 'manual' ? providerId : '',
    updatedAt: String(input?.updatedAt || new Date().toISOString())
  };
}
