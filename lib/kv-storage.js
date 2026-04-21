/**
 * Cloudflare KV 存储适配
 */

import {
  DEFAULT_HONGNIU_CONFIG,
  DEFAULT_SELECTION_POLICY,
  ensureArray,
  toNumber,
  cloneJson
} from './shared.js';

const KV_KEYS = {
  PROVIDERS: 'providers',
  SELECTION: 'selection',
  LOGS: 'logs',
  ANALYTICS: 'analytics'
};

async function getKV(env, key, defaultValue) {
  try {
    const value = await env.SUNNYFILMS_KV.get(key);
    if (!value) {
      return defaultValue;
    }
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
}

async function putKV(env, key, value) {
  try {
    await env.SUNNYFILMS_KV.put(key, JSON.stringify(value));
  } catch (error) {
    console.error('KV write error:', error);
    throw error;
  }
}

export async function initDataStore(env, options = {}) {
  const existingProviders = await getKV(env, KV_KEYS.PROVIDERS, null);
  if (!existingProviders) {
    await putKV(env, KV_KEYS.PROVIDERS, {
      version: 1,
      exportedAt: new Date().toISOString(),
      providers: [DEFAULT_HONGNIU_CONFIG],
      selection: DEFAULT_SELECTION_POLICY
    });
  }

  const existingLogs = await getKV(env, KV_KEYS.LOGS, null);
  if (!existingLogs) {
    await putKV(env, KV_KEYS.LOGS, {
      version: 1,
      exportedAt: new Date().toISOString(),
      logs: []
    });
  }

  const existingAnalytics = await getKV(env, KV_KEYS.ANALYTICS, null);
  if (!existingAnalytics) {
    await putKV(env, KV_KEYS.ANALYTICS, {
      version: 1,
      exportedAt: new Date().toISOString(),
      events: []
    });
  }
}

export async function getProviders(env) {
  const data = await getKV(env, KV_KEYS.PROVIDERS, {
    providers: [DEFAULT_HONGNIU_CONFIG],
    selection: DEFAULT_SELECTION_POLICY
  });
  return ensureArray(data.providers);
}

export async function saveProviders(env, providers, selection) {
  const data = await getKV(env, KV_KEYS.PROVIDERS, {
    providers: [DEFAULT_HONGNIU_CONFIG],
    selection: DEFAULT_SELECTION_POLICY
  });
  await putKV(env, KV_KEYS.PROVIDERS, {
    version: 1,
    exportedAt: new Date().toISOString(),
    providers: providers,
    selection: selection || data.selection
  });
}

export async function getSelection(env) {
  const data = await getKV(env, KV_KEYS.PROVIDERS, {
    providers: [DEFAULT_HONGNIU_CONFIG],
    selection: DEFAULT_SELECTION_POLICY
  });
  return data.selection || DEFAULT_SELECTION_POLICY;
}

export async function saveSelection(env, selection) {
  const data = await getKV(env, KV_KEYS.PROVIDERS, {
    providers: [DEFAULT_HONGNIU_CONFIG],
    selection: DEFAULT_SELECTION_POLICY
  });
  await putKV(env, KV_KEYS.PROVIDERS, {
    version: 1,
    exportedAt: new Date().toISOString(),
    providers: data.providers,
    selection: selection
  });
}

export async function getLogs(env) {
  const data = await getKV(env, KV_KEYS.LOGS, { logs: [] });
  return ensureArray(data.logs);
}

export async function saveLogs(env, logs) {
  await putKV(env, KV_KEYS.LOGS, {
    version: 1,
    exportedAt: new Date().toISOString(),
    logs: logs.slice(-300)
  });
}

export async function getAnalyticsEvents(env) {
  const data = await getKV(env, KV_KEYS.ANALYTICS, { events: [] });
  return ensureArray(data.events);
}

export async function saveAnalyticsEvents(env, events) {
  await putKV(env, KV_KEYS.ANALYTICS, {
    version: 1,
    exportedAt: new Date().toISOString(),
    events: events.slice(-20000)
  });
}
