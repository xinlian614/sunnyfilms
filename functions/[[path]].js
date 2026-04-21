/**
 * Cloudflare Pages Functions 入口文件
 * 处理所有 API 请求和静态文件
 */

import {
  DEFAULT_HONGNIU_CONFIG,
  DEFAULT_SELECTION_POLICY,
  sendJson,
  sendText,
  ensureArray,
  toNumber,
  toIsoDate,
  resolvePresetRange,
  groupCountBy,
  round,
  createId,
  cloneJson,
  inferGeoLabel,
  includesKeyword,
  sanitizeProviderConfig,
  sanitizeSelectionPolicy,
  buildDateSeries,
  convertAnalyticsToCsv
} from '../lib/shared.js';

import {
  initDataStore,
  getProviders,
  saveProviders,
  getSelection,
  saveSelection,
  getLogs,
  saveLogs,
  getAnalyticsEvents,
  saveAnalyticsEvents
} from '../lib/kv-storage.js';

import {
  getSortedProviders,
  getProviderCandidates,
  executeProviderOperation,
  searchByActor,
  maskSensitiveConfig,
  requestProvider
} from '../lib/provider-service.js';

let initialized = false;

async function ensureInitialized(env) {
  if (!initialized) {
    await initDataStore(env, {
      providers: [DEFAULT_HONGNIU_CONFIG],
      selection: DEFAULT_SELECTION_POLICY
    });
    initialized = true;
  }
}

async function recordProviderLog(env, entry) {
  const logs = await getLogs(env);
  logs.push({
    id: createId('log'),
    providerId: String(entry.providerId || ''),
    providerName: String(entry.providerName || ''),
    operation: String(entry.operation || ''),
    request: entry.request || {},
    response: entry.response || {},
    durationMs: toNumber(entry.durationMs, 0),
    success: Boolean(entry.success),
    errorMessage: String(entry.errorMessage || ''),
    createdAt: new Date().toISOString()
  });
  await saveLogs(env, logs);
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  try {
    await ensureInitialized(env);

    if (pathname === '/api/health' && request.method === 'GET') {
      return handleHealth(env);
    }

    if (pathname === '/api/categories' && request.method === 'GET') {
      return handleCategories(env, url);
    }

    if (pathname === '/api/home' && request.method === 'GET') {
      return handleHome(env, url);
    }

    if (pathname === '/api/detail' && request.method === 'GET') {
      return handleDetail(env, url);
    }

    if (pathname === '/api/search' && request.method === 'GET') {
      return handleSearch(env, url);
    }

    if (pathname === '/api/admin/providers') {
      return handleProviderCollection(request, env);
    }

    if (pathname.startsWith('/api/admin/providers/')) {
      const restPath = pathname.replace('/api/admin/providers/', '');
      const [providerId, action] = restPath.split('/');
      return handleProviderItem(request, env, providerId, action || '');
    }

    if (pathname === '/api/admin/logs' && request.method === 'GET') {
      return handleLogs(env);
    }

    if (pathname === '/api/admin/selection') {
      return handleSelectionPolicy(request, env);
    }

    if (pathname === '/api/analytics/collect') {
      return handleAnalyticsCollect(request, env);
    }

    if (pathname === '/api/admin/analytics/summary') {
      return handleAnalyticsSummary(request, env, url);
    }

    if (pathname === '/api/admin/analytics/export') {
      return handleAnalyticsExport(request, env, url);
    }

    if (pathname === '/api/admin/config/export' && request.method === 'GET') {
      return handleConfigExport(env);
    }

    if (pathname === '/api/admin/config/import' && request.method === 'POST') {
      return handleConfigImport(request, env);
    }

    return env.ASSETS.fetch(request);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ${request.method} ${url.pathname}`, error);
    return sendJson(null, 500, {
      code: 0,
      msg: '服务暂时不可用，请稍后再试',
      error: error.message
    });
  }
}

async function handleHealth(env) {
  const providers = await getProviders(env);
  const enabledCount = providers.filter(p => p.enabled).length;
  return sendJson(null, 200, {
    ok: true,
    providerCount: providers.length,
    enabledProviderCount: enabledCount
  });
}

async function handleCategories(env, url) {
  const providerId = String(url.searchParams.get('provider') || '').trim();
  const providers = await getProviders(env);
  const selection = await getSelection(env);

  const recordLog = entry => recordProviderLog(env, entry);
  const payload = await executeProviderOperation(providers, selection, 'categories', { page: 1 }, { providerId }, recordLog);
  return sendJson(null, 200, payload.class);
}

async function handleHome(env, url) {
  const page = Math.max(1, toNumber(url.searchParams.get('pg') || 1));
  const typeId = String(url.searchParams.get('t') || '').trim();
  const hours = Math.max(1, toNumber(url.searchParams.get('h') || 0));
  const providerId = String(url.searchParams.get('provider') || '').trim();

  const providers = await getProviders(env);
  const selection = await getSelection(env);

  const recordLog = entry => recordProviderLog(env, entry);
  const payload = await executeProviderOperation(providers, selection, 'home', { page, typeId, hours }, { providerId }, recordLog);
  return sendJson(null, 200, payload);
}

async function handleDetail(env, url) {
  const id = String(url.searchParams.get('id') || '').trim();
  if (!id) {
    return sendJson(null, 400, { code: 0, msg: '缺少 id 参数' });
  }

  const providerId = String(url.searchParams.get('provider') || '').trim();
  const providers = await getProviders(env);
  const selection = await getSelection(env);

  const recordLog = entry => recordProviderLog(env, entry);
  const payload = await executeProviderOperation(providers, selection, 'detail', { id }, { providerId }, recordLog);
  return sendJson(null, 200, payload);
}

async function handleSearch(env, url) {
  const keyword = String(url.searchParams.get('q') || '').trim();
  if (!keyword) {
    return sendJson(null, 400, { code: 0, msg: '缺少搜索关键字 q' });
  }

  const field = String(url.searchParams.get('field') || 'name').trim();
  const typeId = String(url.searchParams.get('t') || '').trim();
  const page = Math.max(1, toNumber(url.searchParams.get('pg') || 1));
  const providerId = String(url.searchParams.get('provider') || '').trim();

  const providers = await getProviders(env);
  const selection = await getSelection(env);
  const recordLog = entry => recordProviderLog(env, entry);

  if (field === 'actor') {
    const result = await searchByActor(providers, selection, { keyword, typeId, page, providerId }, recordLog);
    return sendJson(null, 200, result);
  }

  const payload = await executeProviderOperation(providers, selection, 'search', { keyword, field, typeId, page }, { providerId }, recordLog);
  return sendJson(null, 200, {
    ...payload,
    list: field === 'name' ? payload.list.filter(item => includesKeyword(item.name, keyword)) : payload.list
  });
}

async function handleProviderCollection(request, env) {
  if (request.method === 'GET') {
    const providers = await getProviders(env);
    return sendJson(null, 200, {
      code: 1,
      list: getSortedProviders(providers).map(maskSensitiveConfig)
    });
  }

  if (request.method === 'POST') {
    const body = await request.json();
    const providers = await getProviders(env);
    const provider = sanitizeProviderConfig(body);
    providers.push(provider);
    await saveProviders(env, providers);
    return sendJson(null, 201, {
      code: 1,
      msg: '接口配置已创建',
      item: maskSensitiveConfig(provider)
    });
  }

  return sendText(null, 405, 'Method not allowed');
}

async function handleProviderItem(request, env, providerId, action) {
  const providers = await getProviders(env);
  const provider = providers.find(p => p.id === providerId);

  if (!provider) {
    return sendJson(null, 404, { code: 0, msg: '接口不存在' });
  }

  if (!action) {
    if (request.method === 'PUT') {
      const body = await request.json();
      const updated = sanitizeProviderConfig(body, { existing: provider });
      const index = providers.findIndex(item => item.id === provider.id);
      providers[index] = updated;
      await saveProviders(env, providers);
      return sendJson(null, 200, {
        code: 1,
        msg: '接口配置已更新',
        item: maskSensitiveConfig(updated)
      });
    }

    if (request.method === 'DELETE') {
      const newProviders = providers.filter(item => item.id !== provider.id);
      if (!newProviders.length) {
        newProviders.push(sanitizeProviderConfig(DEFAULT_HONGNIU_CONFIG));
      }
      await saveProviders(env, newProviders);
      return sendJson(null, 200, {
        code: 1,
        msg: '接口配置已删除'
      });
    }
  }

  if (action === 'toggle' && request.method === 'POST') {
    provider.enabled = !provider.enabled;
    provider.updatedAt = new Date().toISOString();
    await saveProviders(env, providers);
    return sendJson(null, 200, {
      code: 1,
      msg: provider.enabled ? '接口已启用' : '接口已禁用',
      item: maskSensitiveConfig(provider)
    });
  }

  if (action === 'test' && request.method === 'POST') {
    const recordLog = entry => recordProviderLog(env, entry);
    const payload = await requestProvider(provider, 'home', { page: 1, typeId: '', hours: '' }, recordLog);
    return sendJson(null, 200, {
      code: 1,
      msg: '接口测试成功',
      item: {
        providerId: provider.id,
        providerName: provider.name,
        total: payload.total,
        page: payload.page,
        sampleCount: payload.list.length
      }
    });
  }

  return sendText(null, 405, 'Method not allowed');
}

async function handleLogs(env) {
  const logs = await getLogs(env);
  return sendJson(null, 200, {
    code: 1,
    list: logs.slice(-100).reverse()
  });
}

async function handleSelectionPolicy(request, env) {
  if (request.method === 'GET') {
    const selection = await getSelection(env);
    const providers = await getProviders(env);
    const selectedProvider = providers.find(p => p.id === selection.providerId);
    return sendJson(null, 200, {
      code: 1,
      item: { ...selection, providerName: selectedProvider?.name || '' },
      providers: getSortedProviders(providers, { onlyEnabled: true }).map(p => ({
        id: p.id,
        name: p.name,
        priority: p.priority,
        enabled: p.enabled
      }))
    });
  }

  if (request.method === 'POST') {
    const body = await request.json();
    const providers = await getProviders(env);
    const newSelection = sanitizeSelectionPolicy(body, providers);
    await saveSelection(env, newSelection);
    return sendJson(null, 200, {
      code: 1,
      msg: '选择策略已更新'
    });
  }

  return sendText(null, 405, 'Method not allowed');
}

async function handleAnalyticsCollect(request, env) {
  if (request.method !== 'POST') {
    return sendText(null, 405, 'Method not allowed');
  }

  const body = await request.json();
  const events = await getAnalyticsEvents(env);

  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  const ip = forwardedFor.split(',')[0].trim() || '';

  const event = {
    id: createId('evt'),
    eventType: String(body.eventType || 'page_view').trim(),
    pageType: String(body.pageType || 'home').trim(),
    itemId: String(body.itemId || '').trim(),
    itemName: String(body.itemName || '').trim(),
    itemTypeName: String(body.itemTypeName || '').trim(),
    itemTypeId: String(body.itemTypeId || '').trim(),
    providerId: String(body.providerId || '').trim(),
    providerName: String(body.providerName || '').trim(),
    sessionId: String(body.sessionId || '').trim() || createId('session'),
    userId: String(body.userId || '').trim(),
    watchDurationSeconds: Math.max(0, toNumber(body.watchDurationSeconds, 0)),
    completed: Boolean(body.completed),
    completionRate: Math.max(0, Math.min(1, Number(body.completionRate || 0))),
    country: String(body.country || '').trim(),
    region: String(body.region || '').trim(),
    city: String(body.city || '').trim(),
    geoLabel: inferGeoLabel(body.country, body.region, body.city),
    referrer: String(body.referrer || request.headers.get('referer') || '').trim(),
    userAgent: String(body.userAgent || request.headers.get('user-agent') || '').trim(),
    ip,
    createdAt: String(body.createdAt || new Date().toISOString())
  };

  events.push(event);
  await saveAnalyticsEvents(env, events);

  return sendJson(null, 201, {
    code: 1,
    msg: '统计事件已记录',
    item: {
      id: event.id,
      eventType: event.eventType,
      createdAt: event.createdAt
    }
  });
}

async function handleAnalyticsSummary(request, env, url) {
  if (request.method !== 'GET') {
    return sendText(null, 405, 'Method not allowed');
  }

  const preset = url.searchParams.get('preset') || '7d';
  const from = url.searchParams.get('from') || '';
  const to = url.searchParams.get('to') || '';
  const events = await getAnalyticsEvents(env);

  const summary = buildAnalyticsSummary(events, { preset, from, to });

  return sendJson(null, 200, {
    code: 1,
    ...summary
  });
}

async function handleAnalyticsExport(request, env, url) {
  if (request.method !== 'GET') {
    return sendText(null, 405, 'Method not allowed');
  }

  const preset = url.searchParams.get('preset') || '7d';
  const from = url.searchParams.get('from') || '';
  const to = url.searchParams.get('to') || '';
  const format = (url.searchParams.get('format') || 'json').toLowerCase();
  const events = await getAnalyticsEvents(env);
  const summary = buildAnalyticsSummary(events, { preset, from, to });

  if (format === 'csv') {
    const csv = convertAnalyticsToCsv(summary);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="analytics-${summary.range.from}-${summary.range.to}.csv"`,
        'Cache-Control': 'no-store'
      }
    });
  }

  return sendJson(null, 200, {
    code: 1,
    ...summary
  });
}

async function handleConfigExport(env) {
  const providers = await getProviders(env);
  return sendJson(null, 200, {
    code: 1,
    exportedAt: new Date().toISOString(),
    providers: getSortedProviders(providers).map(item => cloneJson(item))
  });
}

async function handleConfigImport(request, env) {
  const body = await request.json();
  const rawProviders = ensureArray(body.providers);
  if (!rawProviders.length) {
    return sendJson(null, 400, { code: 0, msg: '导入数据缺少 providers 数组' });
  }

  const providers = rawProviders.map(item => sanitizeProviderConfig(item));
  const oldProviders = await getProviders(env);
  const oldSelection = await getSelection(env);
  const newSelection = sanitizeSelectionPolicy(body.selection || oldSelection, providers);

  await saveProviders(env, providers, newSelection);

  return sendJson(null, 200, {
    code: 1,
    msg: '接口配置导入成功',
    count: providers.length
  });
}

function buildAnalyticsSummary(events, { preset, from, to }) {
  const range = resolvePresetRange(preset, from, to);
  const filteredEvents = events.filter(event => {
    const date = toIsoDate(event.createdAt);
    return date >= range.from && date <= range.to;
  });

  const pageViews = filteredEvents.filter(e => e.eventType === 'page_view');
  const playStarts = filteredEvents.filter(e => e.eventType === 'play_start');
  const playProgress = filteredEvents.filter(e => e.eventType === 'play_progress');
  const uniqueSessions = new Set(filteredEvents.map(e => e.sessionId).filter(Boolean));
  const yesterdayRange = resolvePresetRange('yesterday');
  const yesterdaySessions = new Set(events.filter(event => {
    const date = toIsoDate(event.createdAt);
    return date >= yesterdayRange.from && date <= yesterdayRange.to;
  }).map(e => e.sessionId).filter(Boolean));
  const retainedSessions = [...uniqueSessions].filter(sessionId => yesterdaySessions.has(sessionId));

  const watchDurations = playProgress.map(e => e.watchDurationSeconds).filter(v => v > 0);
  const totalWatchDuration = watchDurations.reduce((sum, v) => sum + v, 0);
  const avgWatchDuration = watchDurations.length ? round(totalWatchDuration / watchDurations.length, 1) : 0;
  const completedCount = playProgress.filter(e => e.completed).length;
  const completionRate = playProgress.length ? round((completedCount / playProgress.length) * 100, 1) : 0;
  const retentionRate = uniqueSessions.size ? round((retainedSessions.length / uniqueSessions.size) * 100, 1) : 0;

  const topItems = groupCountBy(playStarts, e => e.itemName || e.itemId || '未知影片')
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  const categoryDistribution = groupCountBy(playStarts, e => e.itemTypeName || '未分类')
    .sort((a, b) => b.value - a.value);
  const geoDistribution = groupCountBy(pageViews, e => e.geoLabel || '未知地区')
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return {
    range,
    overview: {
      visitCount: pageViews.length,
      sessionCount: uniqueSessions.size,
      playCount: playStarts.length,
      avgWatchDuration,
      completionRate,
      retentionRate
    },
    trends: {
      visitsByDay: buildDateSeries(filteredEvents, range.from, range.to),
      visitByWeek: groupCountBy(pageViews, event => {
        const date = new Date(event.createdAt);
        const year = date.getUTCFullYear();
        const firstDay = new Date(Date.UTC(year, 0, 1));
        const diffDays = Math.floor((date - firstDay) / 86400000);
        const week = Math.floor(diffDays / 7) + 1;
        return `${year}-W${String(week).padStart(2, '0')}`;
      }).sort((a, b) => a.name.localeCompare(b.name)),
      visitByMonth: groupCountBy(pageViews, event => String(event.createdAt || '').slice(0, 7))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
    distributions: {
      geo: geoDistribution,
      categories: categoryDistribution
    },
    rankings: {
      topItems
    },
    behavior: {
      averageWatchDurationSeconds: avgWatchDuration,
      completionRate,
      retentionRate,
      totalWatchDurationSeconds: totalWatchDuration
    }
  };
}
