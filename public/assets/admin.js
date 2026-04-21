const state = {
    providers: [],
    logs: [],
    editingProvider: null,
    selection: {
        mode: 'auto',
        providerId: '',
        providerName: '',
    },
};

const defaultRequestTemplate = {
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
};

const defaultParseRules = {
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

const defaultHeaders = {
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
    'User-Agent': 'SunnyFilms/2.0',
};

const elements = {
    providerList: document.getElementById('provider-list'),
    logList: document.getElementById('log-list'),
    providerSummary: document.getElementById('provider-summary'),
    providerCount: document.getElementById('provider-count'),
    providerEnabledCount: document.getElementById('provider-enabled-count'),
    logCount: document.getElementById('log-count'),
    selectionModeLabel: document.getElementById('selection-mode-label'),
    selectionProviderLabel: document.getElementById('selection-provider-label'),
    setAutoSelectionButton: document.getElementById('set-auto-selection'),
    refreshButton: document.getElementById('refresh-admin'),
    createButton: document.getElementById('create-provider'),
    exportButton: document.getElementById('export-config'),
    importInput: document.getElementById('import-config'),
    modal: document.getElementById('provider-modal'),
    modalTitle: document.getElementById('modal-title'),
    form: document.getElementById('provider-form'),
    toast: document.getElementById('toast'),
    providerId: document.getElementById('provider-id'),
    providerName: document.getElementById('provider-name'),
    providerType: document.getElementById('provider-type'),
    providerMethod: document.getElementById('provider-method'),
    providerPriority: document.getElementById('provider-priority'),
    providerTimeout: document.getElementById('provider-timeout'),
    providerEnabled: document.getElementById('provider-enabled'),
    providerUrl: document.getElementById('provider-url'),
    providerFallbacks: document.getElementById('provider-fallbacks'),
    providerAuthType: document.getElementById('provider-auth-type'),
    providerAuthToken: document.getElementById('provider-auth-token'),
    providerAuthHeader: document.getElementById('provider-auth-header'),
    providerAuthQuery: document.getElementById('provider-auth-query'),
    providerAuthUsername: document.getElementById('provider-auth-username'),
    providerAuthPassword: document.getElementById('provider-auth-password'),
    providerRequestTemplate: document.getElementById('provider-request-template'),
    providerParseRules: document.getElementById('provider-parse-rules'),
    providerHeaders: document.getElementById('provider-headers'),
    providerNotes: document.getElementById('provider-notes'),
    cancelButton: document.getElementById('cancel-provider'),
};

let toastTimer = null;

function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function formatJson(value) {
    return JSON.stringify(value, null, 2);
}

function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => {
        elements.toast.classList.remove('is-visible');
    }, 2400);
}

async function requestJson(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        ...options,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.code === 0) {
        throw new Error(payload.msg || payload.error || `请求失败 ${response.status}`);
    }

    return payload;
}

function buildEmptyProvider() {
    return {
        id: '',
        name: '',
        type: 'mac-cms-v10-json',
        requestMethod: 'GET',
        priority: 100,
        timeout: 12000,
        enabled: true,
        requestUrl: '',
        fallbackUrls: [],
        auth: {
            type: 'none',
            token: '',
            headerName: '',
            queryName: '',
            username: '',
            password: '',
        },
        requestParamsTemplate: structuredClone(defaultRequestTemplate),
        parseRules: structuredClone(defaultParseRules),
        headers: structuredClone(defaultHeaders),
        notes: '',
    };
}

function openModal(provider = null) {
    const current = provider ? structuredClone(provider) : buildEmptyProvider();
    state.editingProvider = current;
    elements.modalTitle.textContent = provider ? `编辑接口配置：${provider.name}` : '新增接口配置';
    elements.providerId.value = current.id || '';
    elements.providerName.value = current.name || '';
    elements.providerType.value = current.type || 'mac-cms-v10-json';
    elements.providerMethod.value = current.requestMethod || 'GET';
    elements.providerPriority.value = Number(current.priority || 100);
    elements.providerTimeout.value = Number(current.timeout || 12000);
    elements.providerEnabled.checked = current.enabled !== false;
    elements.providerUrl.value = current.requestUrl || '';
    elements.providerFallbacks.value = (current.fallbackUrls || []).join('\n');
    elements.providerAuthType.value = current.auth?.type || 'none';
    elements.providerAuthToken.value = current.auth?.token && current.auth.token !== '***' ? current.auth.token : '';
    elements.providerAuthHeader.value = current.auth?.headerName || '';
    elements.providerAuthQuery.value = current.auth?.queryName || '';
    elements.providerAuthUsername.value = current.auth?.username || '';
    elements.providerAuthPassword.value = current.auth?.password && current.auth.password !== '***' ? current.auth.password : '';
    elements.providerRequestTemplate.value = formatJson(current.requestParamsTemplate || defaultRequestTemplate);
    elements.providerParseRules.value = formatJson(current.parseRules || defaultParseRules);
    elements.providerHeaders.value = formatJson(current.headers || defaultHeaders);
    elements.providerNotes.value = current.notes || '';
    elements.modal.classList.add('is-open');
    elements.modal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
    elements.modal.classList.remove('is-open');
    elements.modal.setAttribute('aria-hidden', 'true');
    state.editingProvider = null;
}

function renderProviderList() {
    elements.providerCount.textContent = String(state.providers.length);
    elements.providerEnabledCount.textContent = String(state.providers.filter((item) => item.enabled).length);
    elements.providerSummary.textContent =
        state.providers.length > 0
            ? `当前共管理 ${state.providers.length} 个接口配置，按优先级自动选择最高且启用的接口对外提供服务。`
            : '当前还没有接口配置，请先新增一个。';

    if (!state.providers.length) {
        elements.providerList.innerHTML = `
            <div class="empty-admin-card">
                <h3>暂无接口配置</h3>
                <p>点击“新增接口”即可按红牛资源模板创建新的影视资源接口。</p>
            </div>
        `;
        return;
    }

    elements.providerList.innerHTML = state.providers
        .map(
            (provider) => `
            <article class="provider-card">
                <div class="provider-card-head">
                    <div>
                        <div class="provider-title-row">
                            <h3>${escapeHtml(provider.name)}</h3>
                            <span class="status-badge ${provider.enabled ? 'is-online' : 'is-offline'}">
                                ${provider.enabled ? '已启用' : '已禁用'}
                            </span>
                        </div>
                        <p class="provider-meta">
                            类型：${escapeHtml(provider.type)} · 方法：${escapeHtml(provider.requestMethod)} · 优先级：${Number(
                                provider.priority || 0
                            )} · 超时：${Number(provider.timeout || 0)}ms
                        </p>
                    </div>
                    <div class="provider-actions">
                        <button type="button" class="ghost-button" data-action="test" data-id="${provider.id}">测试</button>
                        <button type="button" class="ghost-button" data-action="manual" data-id="${provider.id}">设为手动</button>
                        <button type="button" class="ghost-button" data-action="toggle" data-id="${provider.id}">
                            ${provider.enabled ? '禁用' : '启用'}
                        </button>
                        <button type="button" class="ghost-button" data-action="edit" data-id="${provider.id}">编辑</button>
                        <button type="button" class="ghost-button is-danger" data-action="delete" data-id="${provider.id}">删除</button>
                    </div>
                </div>

                <div class="provider-detail-grid">
                    <div class="provider-detail-card">
                        <span>请求 URL</span>
                        <code>${escapeHtml(provider.requestUrl)}</code>
                    </div>
                    <div class="provider-detail-card">
                        <span>认证方式</span>
                        <strong>${escapeHtml(provider.auth?.type || 'none')}</strong>
                    </div>
                    <div class="provider-detail-card">
                        <span>备用地址数量</span>
                        <strong>${(provider.fallbackUrls || []).length}</strong>
                    </div>
                    <div class="provider-detail-card">
                        <span>更新时间</span>
                        <strong>${escapeHtml(new Date(provider.updatedAt).toLocaleString('zh-CN'))}</strong>
                    </div>
                </div>

                <details class="provider-json-block">
                    <summary>查看模板与解析规则</summary>
                    <div class="provider-json-grid">
                        <div>
                            <h4>请求参数模板</h4>
                            <pre>${escapeHtml(formatJson(provider.requestParamsTemplate || {}))}</pre>
                        </div>
                        <div>
                            <h4>响应解析规则</h4>
                            <pre>${escapeHtml(formatJson(provider.parseRules || {}))}</pre>
                        </div>
                    </div>
                </details>
            </article>
        `
        )
        .join('');
}

function renderSelection() {
    const isManual = state.selection.mode === 'manual';
    elements.selectionModeLabel.textContent = isManual ? '手动指定' : '自动选择';
    elements.selectionProviderLabel.textContent = state.selection.providerName || '按优先级自动切换';
}

function renderLogs() {
    elements.logCount.textContent = String(state.logs.length);

    if (!state.logs.length) {
        elements.logList.innerHTML = `
            <div class="empty-admin-card">
                <h3>暂无调用日志</h3>
                <p>当首页或测试接口发起请求后，这里会出现最近的调用记录。</p>
            </div>
        `;
        return;
    }

    elements.logList.innerHTML = state.logs
        .map(
            (log) => `
            <article class="log-card">
                <div class="log-card-head">
                    <div>
                        <div class="provider-title-row">
                            <h3>${escapeHtml(log.providerName || '未知接口')}</h3>
                            <span class="status-badge ${log.success ? 'is-online' : 'is-offline'}">
                                ${log.success ? '成功' : '失败'}
                            </span>
                        </div>
                        <p class="provider-meta">
                            操作：${escapeHtml(log.operation)} · 耗时：${Number(log.durationMs || 0)}ms · 时间：${escapeHtml(
                                new Date(log.createdAt).toLocaleString('zh-CN')
                            )}
                        </p>
                    </div>
                </div>
                <div class="provider-json-grid">
                    <div>
                        <h4>请求</h4>
                        <pre>${escapeHtml(formatJson(log.request || {}))}</pre>
                    </div>
                    <div>
                        <h4>响应</h4>
                        <pre>${escapeHtml(formatJson(log.response || {}))}</pre>
                    </div>
                </div>
                ${
                    log.errorMessage
                        ? `<p class="log-error">错误信息：${escapeHtml(log.errorMessage)}</p>`
                        : ''
                }
            </article>
        `
        )
        .join('');
}

async function loadProviders() {
    const payload = await requestJson('/api/admin/providers');
    state.providers = payload.list || [];
    renderProviderList();
}

async function loadSelection() {
    const payload = await requestJson('/api/admin/selection');
    state.selection = payload.item || { mode: 'auto', providerId: '', providerName: '' };
    renderSelection();
}

async function loadLogs() {
    const payload = await requestJson('/api/admin/logs');
    state.logs = payload.list || [];
    renderLogs();
}

async function refreshAll() {
    await Promise.all([loadProviders(), loadLogs(), loadSelection()]);
}

function getProviderById(id) {
    return state.providers.find((provider) => provider.id === id) || null;
}

function parseTextareaJson(text, fieldName) {
    try {
        return text.trim() ? JSON.parse(text) : {};
    } catch (error) {
        throw new Error(`${fieldName} 不是合法的 JSON`);
    }
}

function collectFormData() {
    return {
        id: elements.providerId.value.trim(),
        name: elements.providerName.value.trim(),
        type: elements.providerType.value.trim(),
        requestMethod: elements.providerMethod.value.trim().toUpperCase(),
        priority: Number(elements.providerPriority.value || '100'),
        timeout: Number(elements.providerTimeout.value || '12000'),
        enabled: elements.providerEnabled.checked,
        requestUrl: elements.providerUrl.value.trim(),
        fallbackUrls: elements.providerFallbacks.value
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean),
        auth: {
            type: elements.providerAuthType.value,
            token: elements.providerAuthToken.value.trim(),
            headerName: elements.providerAuthHeader.value.trim(),
            queryName: elements.providerAuthQuery.value.trim(),
            username: elements.providerAuthUsername.value.trim(),
            password: elements.providerAuthPassword.value,
        },
        requestParamsTemplate: parseTextareaJson(elements.providerRequestTemplate.value, '请求参数模板'),
        parseRules: parseTextareaJson(elements.providerParseRules.value, '响应解析规则'),
        headers: parseTextareaJson(elements.providerHeaders.value, '默认请求头'),
        notes: elements.providerNotes.value.trim(),
    };
}

async function saveProvider(event) {
    event.preventDefault();

    const payload = collectFormData();
    const isEdit = Boolean(payload.id);
    const endpoint = isEdit ? `/api/admin/providers/${payload.id}` : '/api/admin/providers';
    const method = isEdit ? 'PUT' : 'POST';

    await requestJson(endpoint, {
        method,
        body: JSON.stringify(payload),
    });

    closeModal();
    await refreshAll();
    showToast(isEdit ? '接口配置已更新' : '接口配置已创建');
}

async function deleteProvider(id) {
    const provider = getProviderById(id);
    if (!provider) {
        return;
    }

    const confirmed = window.confirm(`确定删除接口配置“${provider.name}”吗？`);
    if (!confirmed) {
        return;
    }

    await requestJson(`/api/admin/providers/${id}`, {
        method: 'DELETE',
    });
    await refreshAll();
    showToast('接口配置已删除');
}

async function toggleProvider(id) {
    await requestJson(`/api/admin/providers/${id}/toggle`, {
        method: 'POST',
    });
    await refreshAll();
    showToast('接口状态已更新');
}

async function testProvider(id) {
    const payload = await requestJson(`/api/admin/providers/${id}/test`, {
        method: 'POST',
    });
    await loadLogs();
    showToast(`${payload.item.providerName} 测试成功，共返回 ${payload.item.sampleCount} 条样例`);
}

async function setSelection(mode, providerId = '') {
    await requestJson('/api/admin/selection', {
        method: 'POST',
        body: JSON.stringify({
            mode,
            providerId,
        }),
    });
    await loadSelection();
    showToast(mode === 'manual' ? '已切换为手动指定接口' : '已切换为自动选择接口');
}

function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

async function exportConfig() {
    const payload = await requestJson('/api/admin/config/export');
    const fileName = `resource-apis-export-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.json`;
    downloadJson(fileName, payload);
    showToast('接口配置已导出');
}

async function importConfig(file) {
    const text = await file.text();
    const payload = JSON.parse(text);
    await requestJson('/api/admin/config/import', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    await refreshAll();
    showToast('接口配置导入成功');
}

function bindEvents() {
    elements.refreshButton.addEventListener('click', async () => {
        await refreshAll();
        showToast('数据已刷新');
    });

    elements.createButton.addEventListener('click', () => {
        openModal();
    });

    elements.cancelButton.addEventListener('click', closeModal);
    elements.form.addEventListener('submit', async (event) => {
        try {
            await saveProvider(event);
        } catch (error) {
            console.error(error);
            showToast(error.message);
        }
    });

    elements.providerList.addEventListener('click', async (event) => {
        const actionButton = event.target.closest('[data-action]');
        if (!actionButton) {
            return;
        }

        const { action, id } = actionButton.dataset;
        try {
            if (action === 'edit') {
                const provider = getProviderById(id);
                openModal(provider);
                return;
            }
            if (action === 'delete') {
                await deleteProvider(id);
                return;
            }
            if (action === 'toggle') {
                await toggleProvider(id);
                return;
            }
            if (action === 'manual') {
                await setSelection('manual', id);
                return;
            }
            if (action === 'test') {
                await testProvider(id);
            }
        } catch (error) {
            console.error(error);
            showToast(error.message);
        }
    });

    elements.exportButton.addEventListener('click', async () => {
        try {
            await exportConfig();
        } catch (error) {
            console.error(error);
            showToast(error.message);
        }
    });

    elements.setAutoSelectionButton.addEventListener('click', async () => {
        try {
            await setSelection('auto');
        } catch (error) {
            console.error(error);
            showToast(error.message);
        }
    });

    elements.importInput.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        try {
            await importConfig(file);
        } catch (error) {
            console.error(error);
            showToast(error.message);
        } finally {
            elements.importInput.value = '';
        }
    });

    document.querySelectorAll('[data-close-modal]').forEach((element) => {
        element.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeModal();
        }
    });
}

async function bootstrap() {
    elements.providerRequestTemplate.value = formatJson(defaultRequestTemplate);
    elements.providerParseRules.value = formatJson(defaultParseRules);
    elements.providerHeaders.value = formatJson(defaultHeaders);
    bindEvents();
    await refreshAll();
}

bootstrap().catch((error) => {
    console.error(error);
    showToast(error.message || '管理页初始化失败');
});
