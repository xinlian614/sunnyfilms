const state = {
    categories: [],
    currentItems: [],
    currentPayload: null,
    selectedDetail: null,
    selectedSourceKey: '',
    recentHistory: [],
    providers: [],
    selection: {
        mode: 'auto',
        providerId: '',
        providerName: '',
    },
    providerTouched: false,
    filters: {
        keyword: '',
        field: 'all',
        type: '',
        hours: '',
        area: '',
        year: '',
        source: 'all',
        provider: '',
        page: 1,
    },
};

const elements = {
    categoryChips: document.getElementById('category-chips'),
    featuredGrid: document.getElementById('featured-grid'),
    recentGrid: document.getElementById('recent-grid'),
    movieGrid: document.getElementById('movie-grid'),
    emptyState: document.getElementById('empty-state'),
    summaryText: document.getElementById('summary-text'),
    searchTip: document.getElementById('search-tip'),
    resultMeta: document.getElementById('result-meta'),
    resultsTitle: document.getElementById('results-title'),
    currentProviderName: document.getElementById('current-provider-name'),
    currentProviderMode: document.getElementById('current-provider-mode'),
    currentProviderNote: document.getElementById('current-provider-note'),
    pageIndicator: document.getElementById('page-indicator'),
    prevPage: document.getElementById('prev-page'),
    nextPage: document.getElementById('next-page'),
    detailDrawer: document.getElementById('detail-drawer'),
    detailContent: document.getElementById('detail-content'),
    toast: document.getElementById('toast'),
    activeFilters: document.getElementById('active-filters'),
    typeSelect: document.getElementById('type-select'),
    areaSelect: document.getElementById('area-select'),
    yearSelect: document.getElementById('year-select'),
    sourceSelect: document.getElementById('source-select'),
    providerSelect: document.getElementById('provider-select'),
    fieldSelect: document.getElementById('field-select'),
    hoursSelect: document.getElementById('hours-select'),
    searchInput: document.getElementById('search-input'),
    searchForm: document.getElementById('search-form'),
    refreshButton: document.getElementById('refresh-button'),
    resetButton: document.getElementById('reset-button'),
    headerNav: document.querySelector('.header-nav'),
};

let toastTimer = null;
const RECENT_STORAGE_KEY = 'sunny_recent_history';
const SESSION_STORAGE_KEY = 'sunny_analytics_session_id';
const FALLBACK_POSTER =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 480"><rect width="320" height="480" fill="%230d1729"/><rect x="26" y="26" width="268" height="428" rx="24" fill="%2316263f"/><text x="50%" y="46%" text-anchor="middle" fill="%2367c8ff" font-family="Arial,sans-serif" font-size="28">SUNNY</text><text x="50%" y="54%" text-anchor="middle" fill="%23ffb36c" font-family="Arial,sans-serif" font-size="22">NO POSTER</text></svg>';

function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function buildSkeletonCards(count = 10) {
    return Array.from(
        { length: count },
        () => `
        <article class="skeleton-card">
            <div class="skeleton-poster"></div>
            <div class="skeleton-content">
                <div class="skeleton-line is-long"></div>
                <div class="skeleton-line is-medium"></div>
                <div class="skeleton-line is-short"></div>
            </div>
        </article>
    `
    ).join('');
}

function normalizePoster(url) {
    return url || FALLBACK_POSTER;
}

function bindImageFallback(root = document) {
    root.querySelectorAll('img').forEach((image) => {
        image.addEventListener(
            'error',
            () => {
                if (image.dataset.fallbackApplied === '1') {
                    return;
                }
                image.dataset.fallbackApplied = '1';
                image.src = FALLBACK_POSTER;
            },
            { once: true }
        );
    });
}

function truncate(value, limit = 88) {
    const text = String(value || '').trim();
    if (text.length <= limit) {
        return text;
    }
    return `${text.slice(0, limit)}...`;
}

function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => {
        elements.toast.classList.remove('is-visible');
    }, 2400);
}

function getSessionId() {
    try {
        const current = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (current) {
            return current;
        }
        const next = `session_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, next);
        return next;
    } catch {
        return `session_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    }
}

async function sendAnalyticsEvent(payload) {
    try {
        await fetch('/api/analytics/collect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                sessionId: getSessionId(),
                referrer: document.referrer,
                ...payload,
            }),
        });
    } catch (error) {
        console.error(error);
    }
}

async function requestJson(endpoint) {
    const response = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
        let message = `请求失败 ${response.status}`;
        try {
            const payload = await response.json();
            message = payload.msg || payload.error || message;
        } catch {
            // ignore
        }
        throw new Error(message);
    }

    return response.json();
}

function getEffectiveProviderId() {
    return state.providerTouched ? state.filters.provider : '';
}

function getEffectiveProviderName() {
    const providerId = getEffectiveProviderId();
    const provider = state.providers.find((item) => item.id === providerId);
    return provider?.name || '';
}

function buildAppUrl(extraParams = {}) {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    params.set('page', String(state.filters.page));

    if (state.filters.keyword) {
        params.set('q', state.filters.keyword);
    } else {
        params.delete('q');
    }

    if (state.filters.field !== 'all') {
        params.set('field', state.filters.field);
    } else {
        params.delete('field');
    }

    if (state.filters.type) {
        params.set('type', state.filters.type);
    } else {
        params.delete('type');
    }

    if (state.filters.hours) {
        params.set('hours', state.filters.hours);
    } else {
        params.delete('hours');
    }

    if (state.filters.area) {
        params.set('area', state.filters.area);
    } else {
        params.delete('area');
    }

    if (state.filters.year) {
        params.set('year', state.filters.year);
    } else {
        params.delete('year');
    }

    if (state.filters.source !== 'all') {
        params.set('source', state.filters.source);
    } else {
        params.delete('source');
    }

    if (state.providerTouched && state.filters.provider) {
        params.set('provider', state.filters.provider);
    } else {
        params.delete('provider');
    }

    Object.entries(extraParams).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
            params.delete(key);
        } else {
            params.set(key, String(value));
        }
    });

    return url;
}

function syncUrl() {
    const detailId = state.selectedDetail?.id || '';
    const url = buildAppUrl({ detail: detailId });

    if (!detailId) {
        url.searchParams.delete('detail');
    }
    url.searchParams.delete('play');
    url.searchParams.delete('episode');

    window.history.replaceState({}, '', url);
}

function hydrateStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    state.filters.keyword = params.get('q') || '';
    state.filters.field = params.get('field') || 'all';
    state.filters.type = params.get('type') || '';
    state.filters.hours = params.get('hours') || '';
    state.filters.area = params.get('area') || '';
    state.filters.year = params.get('year') || '';
    state.filters.source = params.get('source') || 'all';
    state.filters.provider = params.get('provider') || '';
    state.providerTouched = params.has('provider');
    state.filters.page = Math.max(1, Number(params.get('page') || '1'));
}

function loadRecentHistory() {
    try {
        const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
        state.recentHistory = raw ? JSON.parse(raw) : [];
    } catch (error) {
        console.error(error);
        state.recentHistory = [];
    }
}

function persistRecentHistory() {
    try {
        window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(state.recentHistory.slice(0, 12)));
    } catch (error) {
        console.error(error);
    }
}

function pushRecentHistory(item, episodeLabel = '') {
    const entry = {
        id: item.id,
        name: item.name,
        poster: item.poster,
        typeName: item.typeName,
        remarks: item.remarks,
        updateTime: item.updateTime,
        episodeLabel,
        watchedAt: new Date().toISOString(),
    };

    state.recentHistory = [
        entry,
        ...state.recentHistory.filter((history) => !(String(history.id) === String(item.id) && history.episodeLabel === episodeLabel)),
    ].slice(0, 12);

    persistRecentHistory();
    renderRecentHistory();
}

function getPreferredSource(sources) {
    if (!sources.length) {
        return null;
    }

    if (state.filters.source !== 'all') {
        const matched = sources.find((source) => source.key === state.filters.source);
        if (matched) {
            return matched;
        }
    }

    return sources.find((source) => source.key === 'hnm3u8') || sources[0];
}

function formatMeta(item) {
    return [item.typeName, item.area, item.year].filter(Boolean).join(' / ') || '未分类';
}

function formatUpdate(item) {
    return item.updateTime ? `更新于 ${item.updateTime}` : item.remarks || '资源已收录';
}

function getSelectedTypeName() {
    const category = state.categories.find((entry) => String(entry.type_id) === state.filters.type);
    return category?.type_name || '全部分类';
}

function getFieldLabel(field) {
    if (field === 'name') {
        return '片名';
    }
    if (field === 'actor') {
        return '演员';
    }
    return '综合';
}

function buildCardBadges(item) {
    const badges = [];
    if (item.remarks) {
        badges.push(`<span class="tag">${escapeHtml(item.remarks)}</span>`);
    }
    if ((item.sources || []).some((source) => source.key === 'hnm3u8')) {
        badges.push('<span class="tag">M3U8</span>');
    }
    return badges.join('');
}

function populateSelect(selectElement, values, currentValue, placeholderLabel) {
    const options = [`<option value="">${placeholderLabel}</option>`];
    values.forEach((value) => {
        const normalized = String(value);
        options.push(
            `<option value="${escapeHtml(normalized)}" ${normalized === String(currentValue || '') ? 'selected' : ''}>${escapeHtml(normalized)}</option>`
        );
    });
    selectElement.innerHTML = options.join('');
}

function renderProviderSelect() {
    const options = [
        `<option value="" ${getEffectiveProviderId() === '' ? 'selected' : ''}>跟随后台默认${state.selection.providerName ? `（当前：${escapeHtml(state.selection.providerName)}）` : ''}</option>`,
        ...state.providers.map(
            (provider) =>
                `<option value="${escapeHtml(provider.id)}" ${getEffectiveProviderId() === String(provider.id) ? 'selected' : ''}>${escapeHtml(
                    provider.name
                )}</option>`
        ),
    ];
    elements.providerSelect.innerHTML = options.join('');
}

function updateDynamicFilters(items) {
    const areas = [...new Set(items.map((item) => item.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const years = [...new Set(items.map((item) => item.year).filter(Boolean))].sort((a, b) => Number(b) - Number(a));

    if (state.filters.area && !areas.includes(state.filters.area)) {
        state.filters.area = '';
    }
    if (state.filters.year && !years.includes(state.filters.year)) {
        state.filters.year = '';
    }

    populateSelect(elements.areaSelect, areas, state.filters.area, '全部地区');
    populateSelect(elements.yearSelect, years, state.filters.year, '全部年份');
}

function filterItems(items) {
    return items.filter((item) => {
        if (state.filters.area && item.area !== state.filters.area) {
            return false;
        }
        if (state.filters.year && item.year !== state.filters.year) {
            return false;
        }
        if (state.filters.source !== 'all' && !(item.sources || []).some((source) => source.key === state.filters.source)) {
            return false;
        }
        return true;
    });
}

function syncControls() {
    elements.searchInput.value = state.filters.keyword;
    elements.fieldSelect.value = state.filters.field;
    elements.typeSelect.value = state.filters.type;
    elements.hoursSelect.value = state.filters.hours;
    elements.sourceSelect.value = state.filters.source;
}

function renderCategories() {
    const chips = [
        `<button type="button" class="chip ${state.filters.type === '' ? 'is-active' : ''}" data-type="">全部</button>`,
        ...state.categories.map(
            (item) =>
                `<button type="button" class="chip ${state.filters.type === String(item.type_id) ? 'is-active' : ''}" data-type="${item.type_id}">${escapeHtml(item.type_name)}</button>`
        ),
    ];

    elements.categoryChips.innerHTML = chips.join('');
}

function renderProviderStatus() {
    const payloadMeta = state.currentPayload?.meta || {};
    const activeProviderName = payloadMeta.selectedProviderName || getEffectiveProviderName() || state.selection.providerName || '未知接口';
    const isManual = payloadMeta.selectionMode === 'manual' || getEffectiveProviderId();
    const modeText = isManual ? '手动指定' : state.selection.mode === 'manual' ? '跟随后台手动' : '自动切换';
    const noteText = getEffectiveProviderId()
        ? '当前首页已手动锁定接口，只影响本页请求。'
        : state.selection.mode === 'manual'
        ? '当前跟随后台默认接口设置。'
        : '当前由系统按优先级自动选择并在失败时自动切换。';

    elements.currentProviderName.textContent = activeProviderName;
    elements.currentProviderMode.textContent = modeText;
    elements.currentProviderNote.textContent = noteText;
}

function renderFeatured(items) {
    const featuredItems = items.slice(0, 3);
    if (!featuredItems.length) {
        elements.featuredGrid.innerHTML = '';
        return;
    }

    elements.featuredGrid.innerHTML = featuredItems
        .map(
            (item) => `
                <article class="featured-card">
                    <div class="featured-poster">
                        <img src="${escapeHtml(normalizePoster(item.poster))}" alt="${escapeHtml(item.name)}" loading="lazy" referrerpolicy="no-referrer">
                    </div>
                    <div class="featured-content">
                        <div class="meta-line">
                            <span class="tag">${escapeHtml(item.typeName || '未分类')}</span>
                            ${item.year ? `<span class="tag">${escapeHtml(item.year)}</span>` : ''}
                        </div>
                        <h3>${escapeHtml(item.name)}</h3>
                        <div class="meta-line">
                            <span>${escapeHtml(formatMeta(item))}</span>
                            <span>${escapeHtml(formatUpdate(item))}</span>
                        </div>
                        <p class="movie-desc">${escapeHtml(truncate(item.content || item.actor || '暂无简介', 90))}</p>
                        <button type="button" class="primary-button card-button" data-open-detail="${item.id}">查看详情</button>
                    </div>
                </article>
            `
        )
        .join('');

    bindImageFallback(elements.featuredGrid);
}

function renderCards(items) {
    elements.emptyState.classList.toggle('hidden', items.length > 0);

    elements.movieGrid.innerHTML = items
        .map(
            (item) => `
                <article class="movie-card">
                    <div class="movie-poster">
                        <img src="${escapeHtml(normalizePoster(item.poster))}" alt="${escapeHtml(item.name)}" loading="lazy" referrerpolicy="no-referrer">
                        <div class="card-overlay">
                            ${buildCardBadges(item)}
                        </div>
                    </div>
                    <div class="movie-info">
                        <h3>${escapeHtml(item.name)}</h3>
                        <div class="movie-meta">
                            <span>${escapeHtml(formatMeta(item))}</span>
                            <span>${escapeHtml(item.actor || '演员信息待补充')}</span>
                        </div>
                        <p class="movie-desc">${escapeHtml(truncate(item.content || item.actor || '暂无简介'))}</p>
                        <button type="button" class="primary-button card-button" data-open-detail="${item.id}">打开详情</button>
                    </div>
                </article>
            `
        )
        .join('');

    bindImageFallback(elements.movieGrid);
}

function renderRecentHistory() {
    if (!state.recentHistory.length) {
        elements.recentGrid.innerHTML = `
            <div class="empty-state">
                <h3>还没有最近浏览记录</h3>
                <p>打开任意影片详情或进入独立播放页后，这里会自动记录，方便继续调试。</p>
            </div>
        `;
        return;
    }

    elements.recentGrid.innerHTML = state.recentHistory
        .map(
            (item) => `
                <article class="recent-card">
                    <div class="recent-poster">
                        <img src="${escapeHtml(normalizePoster(item.poster))}" alt="${escapeHtml(item.name)}" loading="lazy" referrerpolicy="no-referrer">
                    </div>
                    <div class="recent-body">
                        <div>
                            <h3>${escapeHtml(item.name)}</h3>
                            <div class="recent-meta">
                                <div>${escapeHtml(item.typeName || '未分类')}</div>
                                <div>${escapeHtml(item.episodeLabel || item.remarks || '已打开详情')}</div>
                            </div>
                        </div>
                        <button type="button" class="ghost-button inline-button" data-open-detail="${item.id}">继续查看</button>
                    </div>
                </article>
            `
        )
        .join('');

    bindImageFallback(elements.recentGrid);
}

function renderPagination() {
    const page = state.currentPayload?.page || 1;
    const totalPages = state.currentPayload?.pagecount || 1;
    elements.pageIndicator.textContent = `第 ${page} / ${totalPages} 页`;
    elements.prevPage.disabled = page <= 1;
    elements.nextPage.disabled = page >= totalPages;
}

function renderFilterBadges() {
    const badges = [];
    if (state.filters.keyword) {
        badges.push(`关键词：${state.filters.keyword}`);
    }
    if (state.filters.field !== 'all') {
        badges.push(`搜索维度：${getFieldLabel(state.filters.field)}`);
    }
    if (state.filters.type) {
        badges.push(`分类：${getSelectedTypeName()}`);
    }
    if (state.filters.area) {
        badges.push(`地区：${state.filters.area}`);
    }
    if (state.filters.year) {
        badges.push(`年份：${state.filters.year}`);
    }
    if (state.filters.hours) {
        badges.push(`更新时间：最近 ${state.filters.hours} 小时`);
    }
    if (state.filters.source !== 'all') {
        badges.push(`片源：${state.filters.source}`);
    }
    if (getEffectiveProviderId()) {
        badges.push(`数据接口：${getEffectiveProviderName() || getEffectiveProviderId()}`);
    } else if (state.selection.providerName) {
        badges.push(`后台默认接口：${state.selection.providerName}`);
    }

    elements.activeFilters.innerHTML = badges.map((badge) => `<span class="filter-badge">${escapeHtml(badge)}</span>`).join('');
}

function renderSummary(items) {
    const payload = state.currentPayload;
    const total = payload?.total ?? items.length;
    const typeName = getSelectedTypeName();
    const providerName = payload?.meta?.selectedProviderName || getEffectiveProviderName() || state.selection.providerName || '未知接口';
    const selectionMode = payload?.meta?.selectionMode === 'manual' || getEffectiveProviderId() ? '手动指定' : state.selection.mode === 'manual' ? '跟随后台手动' : '自动切换';
    const searchMode = state.filters.keyword ? `搜索“${state.filters.keyword}”` : '浏览最新资源';
    const partialNote = payload?.meta?.partial ? `，当前只扫描了前 ${payload.meta.scannedPages} 页演员数据` : '';

    elements.summaryText.textContent = `${searchMode}，当前分类 ${typeName}，接口返回 ${total} 条结果。`;
    elements.searchTip.textContent = state.filters.keyword
        ? `支持按片名、演员、分类联合检索${partialNote}。当前接口策略：${selectionMode}。`
        : `当前展示实时接口数据，支持自动故障切换和手动锁定接口。当前接口策略：${selectionMode}。`;
    elements.resultMeta.textContent = `本页显示 ${items.length} 条，接口分页 ${payload?.page || 1} / ${payload?.pagecount || 1}，实际使用：${providerName}`;
    elements.resultsTitle.textContent = state.filters.keyword ? '搜索结果' : '最新片单';
    renderProviderStatus();
}

function renderAll() {
    const filteredItems = filterItems(state.currentItems);
    updateDynamicFilters(state.currentItems);
    renderCategories();
    renderProviderSelect();
    renderFeatured(filteredItems);
    renderCards(filteredItems);
    renderPagination();
    renderFilterBadges();
    renderSummary(filteredItems);
}

function buildCatalogEndpoint() {
    const params = new URLSearchParams();
    params.set('pg', String(state.filters.page));

    if (state.filters.type) {
        params.set('t', state.filters.type);
    }

    const providerId = getEffectiveProviderId();
    if (providerId) {
        params.set('provider', providerId);
    }

    if (state.filters.keyword) {
        params.set('q', state.filters.keyword);
        params.set('field', state.filters.field);
        return `/api/search?${params.toString()}`;
    }

    if (state.filters.hours) {
        params.set('h', state.filters.hours);
    }

    return `/api/home?${params.toString()}`;
}

function buildDetailEndpoint(id) {
    const params = new URLSearchParams({ id: String(id) });
    const providerId = getEffectiveProviderId();
    if (providerId) {
        params.set('provider', providerId);
    }
    return `/api/detail?${params.toString()}`;
}

async function loadSelectionInfo() {
    const payload = await requestJson('/api/admin/selection');
    state.selection = payload.item || { mode: 'auto', providerId: '', providerName: '' };
    state.providers = payload.providers || [];
    renderProviderSelect();
}

async function loadCategories() {
    const providerId = getEffectiveProviderId();
    const endpoint = providerId ? `/api/categories?provider=${encodeURIComponent(providerId)}` : '/api/categories';
    const payload = await requestJson(endpoint);
    state.categories = payload.list || [];
    elements.typeSelect.innerHTML = [
        '<option value="">全部分类</option>',
        ...state.categories.map(
            (item) =>
                `<option value="${item.type_id}" ${state.filters.type === String(item.type_id) ? 'selected' : ''}>${escapeHtml(item.type_name)}</option>`
        ),
    ].join('');
    renderCategories();
}

async function loadCatalog() {
    elements.summaryText.textContent = '正在加载片单...';
    elements.featuredGrid.innerHTML = buildSkeletonCards(3);
    elements.movieGrid.innerHTML = buildSkeletonCards(10);

    const payload = await requestJson(buildCatalogEndpoint());
    state.currentPayload = payload;
    state.currentItems = payload.list || [];
    renderAll();
    syncUrl();
}

function renderDetail() {
    const item = state.selectedDetail;
    if (!item) {
        return;
    }

    const sources = item.sources || [];
    const activeSource = sources.find((source) => source.key === state.selectedSourceKey) || getPreferredSource(sources);
    state.selectedSourceKey = activeSource?.key || '';

    const episodeList = activeSource
        ? activeSource.episodes
              .map(
                  (episode) => `
                    <a class="ghost-button inline-button episode-link" href="/play.html?id=${encodeURIComponent(item.id)}&source=${encodeURIComponent(activeSource.key)}&episode=${encodeURIComponent(episode.label)}">
                        ${escapeHtml(episode.label)}
                    </a>
                `
              )
              .join('')
        : '<span class="summary-text">当前片源暂无可播放剧集。</span>';

    elements.detailContent.innerHTML = `
        <div class="detail-layout">
            <div class="detail-poster">
                <img src="${escapeHtml(normalizePoster(item.poster))}" alt="${escapeHtml(item.name)}" referrerpolicy="no-referrer">
            </div>
            <div class="detail-meta">
                <p class="eyebrow">DETAIL</p>
                <h2>${escapeHtml(item.name)}</h2>
                <div class="meta-line">
                    <span class="tag">${escapeHtml(item.typeName || '未分类')}</span>
                    ${item.year ? `<span class="tag">${escapeHtml(item.year)}</span>` : ''}
                    ${item.remarks ? `<span class="tag">${escapeHtml(item.remarks)}</span>` : ''}
                </div>
                <p class="detail-copy">${escapeHtml(item.content || '暂无简介')}</p>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span>演员</span>
                        <strong>${escapeHtml(item.actor || '暂无')}</strong>
                    </div>
                    <div class="detail-item">
                        <span>导演</span>
                        <strong>${escapeHtml(item.director || '暂无')}</strong>
                    </div>
                    <div class="detail-item">
                        <span>地区 / 语言</span>
                        <strong>${escapeHtml([item.area, item.lang].filter(Boolean).join(' / ') || '暂无')}</strong>
                    </div>
                    <div class="detail-item">
                        <span>时长 / 更新</span>
                        <strong>${escapeHtml([item.duration, item.updateTime].filter(Boolean).join(' / ') || '暂无')}</strong>
                    </div>
                </div>
            </div>
        </div>

        <section class="source-section">
            <p class="eyebrow">PLAY SOURCE</p>
            <div class="source-tabs">
                ${sources
                    .map(
                        (source) => `
                            <button type="button" class="source-tab ${source.key === activeSource?.key ? 'is-active' : ''}" data-source-key="${source.key}">
                                ${escapeHtml(source.label)} · ${source.episodes.length} 集
                            </button>
                        `
                    )
                    .join('')}
            </div>
            <div class="episode-grid">
                ${episodeList}
            </div>
        </section>
    `;

    elements.detailDrawer.classList.add('is-open');
    elements.detailDrawer.setAttribute('aria-hidden', 'false');
    bindImageFallback(elements.detailContent);
}

function closeDetail() {
    elements.detailDrawer.classList.remove('is-open');
    elements.detailDrawer.setAttribute('aria-hidden', 'true');
    state.selectedDetail = null;
    state.selectedSourceKey = '';
    syncUrl();
}

async function openDetail(id) {
    const payload = await requestJson(buildDetailEndpoint(id));
    const [item] = payload.list || [];

    if (!item) {
        showToast('未找到影片详情');
        return;
    }

    state.selectedDetail = item;
    state.selectedSourceKey = getPreferredSource(item.sources || [])?.key || '';
    renderDetail();
    pushRecentHistory(item, '');
    syncUrl();
}

async function restoreDetailStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const detailId = params.get('detail') || '';
    const sourceKey = params.get('source') || '';

    if (!detailId) {
        return;
    }

    const payload = await requestJson(buildDetailEndpoint(detailId));
    const [item] = payload.list || [];
    if (!item) {
        return;
    }

    state.selectedDetail = item;
    state.selectedSourceKey = sourceKey || getPreferredSource(item.sources || [])?.key || '';
    renderDetail();
    syncUrl();
}

function applyNavShortcut(action) {
    const shortcuts = {
        latest: { type: '', hours: '24' },
        movie: { type: '1', hours: '' },
        series: { type: '2', hours: '' },
        anime: { type: '4', hours: '' },
    };

    const next = shortcuts[action];
    if (!next) {
        return;
    }

    state.filters.type = next.type;
    state.filters.hours = next.hours;
    state.filters.page = 1;
    syncControls();
    loadCatalog().catch(handleError);
}

function handleError(error) {
    console.error(error);
    showToast(error.message || '请求失败，请稍后重试');
    elements.summaryText.textContent = '数据加载失败，请检查本地服务或网络连接。';
}

async function init() {
    hydrateStateFromUrl();
    loadRecentHistory();
    renderRecentHistory();
    syncControls();
    await loadSelectionInfo();
    await loadCategories();
    await loadCatalog();
    await restoreDetailStateFromUrl();
    await sendAnalyticsEvent({
        eventType: 'page_view',
        pageType: 'home',
        providerId: state.currentPayload?.meta?.selectedProviderId || '',
        providerName: state.currentPayload?.meta?.selectedProviderName || '',
        country: '中国',
        region: '本地开发',
        city: '浏览器访问',
    });
}

elements.searchForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    state.filters.keyword = elements.searchInput.value.trim();
    state.filters.field = elements.fieldSelect.value;
    state.filters.type = elements.typeSelect.value;
    state.filters.hours = elements.hoursSelect.value;
    state.filters.source = elements.sourceSelect.value;
    state.filters.area = elements.areaSelect.value;
    state.filters.year = elements.yearSelect.value;
    state.filters.page = 1;

    try {
        await loadCategories();
        await loadCatalog();
    } catch (error) {
        handleError(error);
    }
});

elements.refreshButton.addEventListener('click', async () => {
    try {
        await loadSelectionInfo();
        await loadCategories();
        await loadCatalog();
        showToast('片单已刷新');
    } catch (error) {
        handleError(error);
    }
});

elements.resetButton.addEventListener('click', async () => {
    state.filters = {
        keyword: '',
        field: 'all',
        type: '',
        hours: '',
        area: '',
        year: '',
        source: 'all',
        provider: '',
        page: 1,
    };
    state.providerTouched = false;
    syncControls();

    try {
        await loadSelectionInfo();
        await loadCategories();
        await loadCatalog();
    } catch (error) {
        handleError(error);
    }
});

elements.typeSelect.addEventListener('change', async () => {
    state.filters.type = elements.typeSelect.value;
    state.filters.page = 1;

    try {
        await loadCatalog();
    } catch (error) {
        handleError(error);
    }
});

elements.hoursSelect.addEventListener('change', async () => {
    state.filters.hours = elements.hoursSelect.value;
    state.filters.page = 1;

    try {
        await loadCatalog();
    } catch (error) {
        handleError(error);
    }
});

elements.providerSelect.addEventListener('change', async () => {
    state.filters.provider = elements.providerSelect.value;
    state.providerTouched = true;
    state.filters.page = 1;
    state.filters.area = '';
    state.filters.year = '';

    try {
        await loadCategories();
        await loadCatalog();
    } catch (error) {
        handleError(error);
    }
});

elements.sourceSelect.addEventListener('change', () => {
    state.filters.source = elements.sourceSelect.value;
    renderAll();
    syncUrl();
});

elements.areaSelect.addEventListener('change', () => {
    state.filters.area = elements.areaSelect.value;
    renderAll();
    syncUrl();
});

elements.yearSelect.addEventListener('change', () => {
    state.filters.year = elements.yearSelect.value;
    renderAll();
    syncUrl();
});

elements.categoryChips.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-type]');
    if (!button) {
        return;
    }

    state.filters.type = button.dataset.type || '';
    state.filters.page = 1;
    elements.typeSelect.value = state.filters.type;

    try {
        await loadCatalog();
    } catch (error) {
        handleError(error);
    }
});

elements.headerNav.addEventListener('click', (event) => {
    const button = event.target.closest('[data-nav-action]');
    if (!button) {
        return;
    }

    elements.headerNav.querySelectorAll('[data-nav-action]').forEach((entry) => entry.classList.remove('is-active'));
    button.classList.add('is-active');
    applyNavShortcut(button.dataset.navAction);
});

elements.featuredGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-detail]');
    if (!button) {
        return;
    }
    openDetail(button.dataset.openDetail).catch(handleError);
});

elements.movieGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-detail]');
    if (!button) {
        return;
    }
    openDetail(button.dataset.openDetail).catch(handleError);
});

elements.recentGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-detail]');
    if (!button) {
        return;
    }
    openDetail(button.dataset.openDetail).catch(handleError);
});

elements.prevPage.addEventListener('click', async () => {
    if ((state.currentPayload?.page || 1) <= 1) {
        return;
    }

    state.filters.page -= 1;
    try {
        await loadCatalog();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        handleError(error);
    }
});

elements.nextPage.addEventListener('click', async () => {
    if ((state.currentPayload?.page || 1) >= (state.currentPayload?.pagecount || 1)) {
        return;
    }

    state.filters.page += 1;
    try {
        await loadCatalog();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        handleError(error);
    }
});

elements.detailContent.addEventListener('click', (event) => {
    const sourceButton = event.target.closest('[data-source-key]');
    if (!sourceButton) {
        return;
    }
    state.selectedSourceKey = sourceButton.dataset.sourceKey || '';
    renderDetail();
});

document.querySelectorAll('[data-close-detail]').forEach((element) => {
    element.addEventListener('click', closeDetail);
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.selectedDetail) {
        closeDetail();
    }
});

init().catch(handleError);
