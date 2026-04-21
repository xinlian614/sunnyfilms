/**
 * 影视资源服务
 */

import {
  DEFAULT_HONGNIU_CONFIG,
  DEFAULT_SELECTION_POLICY,
  FALLBACK_CATEGORIES,
  compactObject,
  ensureArray,
  toNumber,
  stripHtml,
  splitPlayGroups,
  parsePlaySources,
  cloneJson,
  createId,
  pickFirstValue,
  renderTemplateObject,
  includesKeyword,
  dedupeById,
  sanitizeProviderConfig,
  sanitizeSelectionPolicy
} from './shared.js';

const DEFAULT_TIMEOUT = 12000;
const DEFAULT_PROVIDER_TYPE = 'mac-cms-v10-json';
const MAX_LOG_ENTRIES = 300;

export function getSortedProviders(providers, options = {}) {
  const { onlyEnabled = false } = options;
  return providers
    .filter(provider => (onlyEnabled ? provider.enabled : true))
    .slice()
    .sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name, 'zh-CN'));
}

export function getProviderById(providers, id) {
  return providers.find(provider => provider.id === id) || null;
}

export function getProviderCandidates(providers, selection, requestedProviderId = '') {
  const enabledProviders = getSortedProviders(providers, { onlyEnabled: true });
  if (!enabledProviders.length) {
    throw new Error('没有可用的影视资源接口，请先在管理页启用至少一个接口');
  }

  if (requestedProviderId) {
    const requested = enabledProviders.find(provider => provider.id === requestedProviderId);
    if (!requested) {
      throw new Error('指定的影视资源接口不存在或未启用');
    }
    return {
      mode: 'manual',
      providers: [requested],
      selectedProviderId: requested.id
    };
  }

  if (selection.mode === 'manual') {
    const manualProvider = enabledProviders.find(provider => provider.id === selection.providerId);
    if (!manualProvider) {
      return {
        mode: 'auto',
        providers: enabledProviders,
        selectedProviderId: ''
      };
    }
    return {
      mode: 'manual',
      providers: [manualProvider],
      selectedProviderId: manualProvider.id
    };
  }

  return {
    mode: 'auto',
    providers: enabledProviders,
    selectedProviderId: ''
  };
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
    const base64Value = btoa(`${auth.username}:${auth.password || ''}`);
    headers.Authorization = `Basic ${base64Value}`;
  }
}

function normalizeCategoriesFromPayload(payload, parseRules) {
  const categoryPath = parseRules.categoryPath || 'class';
  const fieldRules = parseRules.fields || {};
  const rawCategories = ensureArray(pickFirstValue(payload, categoryPath));

  if (!rawCategories.length) {
    return FALLBACK_CATEGORIES;
  }

  return rawCategories.map(entry => ({
    type_id: toNumber(pickFirstValue(entry, fieldRules.categoryId || 'type_id'), 0),
    type_name: String(pickFirstValue(entry, fieldRules.categoryName || 'type_name') || '').trim()
  }));
}

function normalizeVodItem(item, categories, parseRules) {
  const fields = parseRules.fields || {};
  const typeId = toNumber(pickFirstValue(item, fields.typeId), 0);
  const matchedCategory = categories.find(entry => entry.type_id === typeId);
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
    sources: parsePlaySources(pickFirstValue(item, fields.playFrom), pickFirstValue(item, fields.playUrl))
  };
}

function normalizeJsonPayload(payload, config, extra = {}) {
  const parseRules = config.parseRules || DEFAULT_HONGNIU_CONFIG.parseRules;
  const categories = normalizeCategoriesFromPayload(payload, parseRules);
  const listPath = parseRules.listPath || 'list';
  const list = ensureArray(pickFirstValue(payload, listPath)).map(item => normalizeVodItem(item, categories, parseRules));

  return {
    code: toNumber(payload.code, 1),
    msg: String(payload.msg || 'ok'),
    page: toNumber(payload.page, 1),
    pagecount: toNumber(payload.pagecount, 1),
    limit: toNumber(payload.limit, list.length || 20),
    total: toNumber(payload.total, list.length),
    class: categories,
    list,
    meta: extra.meta || {}
  };
}

export async function requestProvider(config, operation, params = {}, recordLogFn) {
  const startedAt = Date.now();
  const requestMethod = config.requestMethod || 'GET';
  const endpoints = [config.requestUrl, ...ensureArray(config.fallbackUrls).filter(item => item !== config.requestUrl)];
  const requestTemplates = config.requestParamsTemplate || {};
  const mergedParams = compactObject({
    ...(requestTemplates.common || {}),
    ...(requestTemplates[operation] || {})
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

    try {
      const response = await fetch(endpoint, {
        method: requestMethod,
        headers: finalHeaders,
        signal: AbortSignal.timeout(config.timeout || DEFAULT_TIMEOUT)
      });

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
          endpoint: baseUrl
        }
      });

      if (recordLogFn) {
        await recordLogFn({
          providerId: config.id,
          providerName: config.name,
          operation,
          request: {
            url: endpoint,
            method: requestMethod,
            params: finalParams
          },
          response: {
            code: normalized.code,
            total: normalized.total,
            page: normalized.page,
            pagecount: normalized.pagecount,
            sampleCount: normalized.list.length
          },
          durationMs: Date.now() - startedAt,
          success: true,
          errorMessage: ''
        });
      }

      return normalized;
    } catch (error) {
      lastError = error;
    }
  }

  if (recordLogFn) {
    await recordLogFn({
      providerId: config.id,
      providerName: config.name,
      operation,
      request: {
        url: endpoints[0] || '',
        method: requestMethod,
        params: finalParams
      },
      response: {},
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: lastError ? lastError.message : 'Unknown provider error'
    });
  }

  throw lastError || new Error(`Provider ${config.name} unavailable`);
}

export async function executeProviderOperation(
  providers,
  selection,
  operation,
  params = {},
  options = {},
  recordLogFn
) {
  const providerSelection = getProviderCandidates(providers, selection, options.providerId || '');
  const errors = [];

  for (const provider of providerSelection.providers) {
    try {
      const payload = await requestProvider(provider, operation, params, recordLogFn);
      payload.meta = {
        ...(payload.meta || {}),
        selectionMode: providerSelection.mode,
        requestedProviderId: options.providerId || '',
        fallbackTried: errors.length,
        selectedProviderId: provider.id,
        selectedProviderName: provider.name
      };
      return payload;
    } catch (error) {
      errors.push({
        providerId: provider.id,
        providerName: provider.name,
        message: error.message
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

export async function searchByActor(
  providers,
  selection,
  { keyword, typeId, page, providerId = '' },
  recordLogFn
) {
  const providerSelection = getProviderCandidates(providers, selection, providerId);
  const provider = providerSelection.providers[0];
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
      keyword
    }, recordLogFn);

    categories = normalized.class;
    scannedPages = currentPage;
    totalPages = Number(normalized.pagecount || currentPage);
    matches.push(...normalized.list.filter(item => includesKeyword(item.actor, keyword)));

    if (matches.length >= page * pageSize || currentPage >= totalPages) {
      break;
    }
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
      selectionMode: providerSelection.mode
    }
  };
}

export function maskSensitiveConfig(config) {
  const masked = cloneJson(config);
  if (masked.auth?.token) masked.auth.token = '***';
  if (masked.auth?.password) masked.auth.password = '***';
  return masked;
}

// 重新导出，确保兼容性
export { sanitizeProviderConfig, sanitizeSelectionPolicy } from './shared.js';
