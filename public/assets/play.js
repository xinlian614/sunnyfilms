const FALLBACK_POSTER =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 480"><rect width="320" height="480" fill="%230d1729"/><rect x="26" y="26" width="268" height="428" rx="24" fill="%2316263f"/><text x="50%" y="46%" text-anchor="middle" fill="%2367c8ff" font-family="Arial,sans-serif" font-size="28">SUNNY</text><text x="50%" y="54%" text-anchor="middle" fill="%23ffb36c" font-family="Arial,sans-serif" font-size="22">NO POSTER</text></svg>';
const RECENT_STORAGE_KEY = 'sunny_recent_history';
const SESSION_STORAGE_KEY = 'sunny_analytics_session_id';

const elements = {
    playTitle: document.getElementById('play-title'),
    playMeta: document.getElementById('play-meta'),
    playVideo: document.getElementById('play-video'),
    playIframe: document.getElementById('play-iframe'),
    playMessage: document.getElementById('play-message'),
    prevEpisode: document.getElementById('prev-episode'),
    nextEpisode: document.getElementById('next-episode'),
    playDetail: document.getElementById('play-detail'),
    playEpisodeGrid: document.getElementById('play-episode-grid'),
    relatedGrid: document.getElementById('related-grid'),
    copyPlayerLink: document.getElementById('copy-player-link'),
    toast: document.getElementById('play-toast'),
};

let toastTimer = null;
let hlsInstance = null;
let currentItem = null;
let currentSourceKey = '';
let currentEpisodeLabel = '';
let playbackStartedAt = 0;
let latestWatchDuration = 0;

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

function applyVideoAspectRatio(videoElement, containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) {
        return;
    }

    const width = Number(videoElement.videoWidth || 0);
    const height = Number(videoElement.videoHeight || 0);
    if (width > 0 && height > 0) {
        container.style.aspectRatio = `${width} / ${height}`;
        container.style.height = 'auto';
    } else {
        container.style.removeProperty('aspect-ratio');
        container.style.removeProperty('height');
    }
}

function resetVideoAspectRatio(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) {
        return;
    }
    container.style.removeProperty('aspect-ratio');
    container.style.removeProperty('height');
}

function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function truncate(value, limit = 120) {
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

function requestJson(endpoint) {
    return fetch(endpoint, {
        headers: { Accept: 'application/json' },
    }).then((response) => {
        if (!response.ok) {
            throw new Error(`请求失败 ${response.status}`);
        }
        return response.json();
    });
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

function getPreferredSource(sources) {
    return sources.find((source) => source.key === 'hnm3u8') || sources[0] || null;
}

function updateEpisodeNavigation(item) {
    const sources = item.sources || [];
    const activeSource = sources.find((source) => source.key === currentSourceKey) || getPreferredSource(sources);
    const episodes = activeSource?.episodes || [];
    const currentIndex = episodes.findIndex((entry) => entry.label === currentEpisodeLabel);

    elements.prevEpisode.disabled = currentIndex <= 0;
    elements.nextEpisode.disabled = currentIndex === -1 || currentIndex >= episodes.length - 1;
}

function destroyPlayer() {
    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }

    elements.playVideo.pause();
    elements.playVideo.removeAttribute('src');
    elements.playIframe.removeAttribute('src');
    elements.playVideo.classList.add('hidden');
    elements.playIframe.classList.add('hidden');
    elements.playMessage.classList.remove('hidden');
    elements.playVideo.controls = true;
    resetVideoAspectRatio('.standalone-player-frame');
}

function buildPlayUrl(id, source, episode) {
    const url = new URL(window.location.href);
    url.searchParams.set('id', String(id));
    if (source) {
        url.searchParams.set('source', source);
    } else {
        url.searchParams.delete('source');
    }
    if (episode) {
        url.searchParams.set('episode', episode);
    } else {
        url.searchParams.delete('episode');
    }
    return url;
}

function syncPlayUrl() {
    if (!currentItem) {
        return;
    }

    const url = buildPlayUrl(currentItem.id, currentSourceKey, currentEpisodeLabel);
    window.history.replaceState({}, '', url);
}

function pushRecentHistory(item, episodeLabel = '') {
    try {
        const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
        const current = raw ? JSON.parse(raw) : [];
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
        const next = [
            entry,
            ...current.filter((history) => !(String(history.id) === String(item.id) && history.episodeLabel === episodeLabel)),
        ].slice(0, 12);
        window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
        console.error(error);
    }
}

function renderDetail(item) {
    elements.playDetail.innerHTML = `
        <div class="play-detail-card">
            <div class="play-detail-poster">
                <img src="${escapeHtml(normalizePoster(item.poster))}" alt="${escapeHtml(item.name)}" referrerpolicy="no-referrer">
            </div>
            <div class="play-detail-meta">
                <h3>${escapeHtml(item.name)}</h3>
                <p>${escapeHtml([item.typeName, item.area, item.year].filter(Boolean).join(' / ') || '未分类')}</p>
                <p>${escapeHtml(item.actor || '暂无演员信息')}</p>
                <p>${escapeHtml(truncate(item.content || '暂无简介'))}</p>
            </div>
        </div>
    `;
    bindImageFallback(elements.playDetail);
}

function renderEpisodes(item) {
    const sources = item.sources || [];
    const activeSource = sources.find((source) => source.key === currentSourceKey) || getPreferredSource(sources);
    currentSourceKey = activeSource?.key || '';

    const sourceTabs = sources
        .map(
            (source) => `
                <button type="button" class="source-tab ${source.key === currentSourceKey ? 'is-active' : ''}" data-source-key="${source.key}">
                    ${escapeHtml(source.label)} · ${source.episodes.length} 集
                </button>
            `
        )
        .join('');

    const episodeButtons = activeSource
        ? activeSource.episodes
              .map(
                  (episode) => `
                    <button type="button" class="episode-button ${episode.label === currentEpisodeLabel ? 'is-active' : ''}" data-episode-label="${escapeHtml(episode.label)}">
                        ${escapeHtml(episode.label)}
                    </button>
                `
              )
              .join('')
        : '<span class="summary-text">当前片源暂无可播放剧集。</span>';

    elements.playEpisodeGrid.innerHTML = `
        <div class="source-tabs">${sourceTabs}</div>
        <div class="episode-grid play-episodes">${episodeButtons}</div>
    `;
    updateEpisodeNavigation(item);
}

function renderRelatedItems(items) {
    if (!items.length) {
        elements.relatedGrid.innerHTML = `
            <div class="empty-state">
                <h3>暂无相关推荐</h3>
                <p>当前分类下还没有更多可推荐内容。</p>
            </div>
        `;
        return;
    }

    elements.relatedGrid.innerHTML = items
        .map(
            (item) => `
                <article class="related-card">
                    <div class="related-poster">
                        <img src="${escapeHtml(normalizePoster(item.poster))}" alt="${escapeHtml(item.name)}" loading="lazy" referrerpolicy="no-referrer">
                    </div>
                    <div class="related-body">
                        <h3>${escapeHtml(item.name)}</h3>
                        <p>${escapeHtml([item.typeName, item.year, item.remarks].filter(Boolean).join(' / ') || '未分类')}</p>
                        <a class="ghost-button inline-button" href="/play.html?id=${encodeURIComponent(item.id)}">立即播放</a>
                    </div>
                </article>
            `
        )
        .join('');

    bindImageFallback(elements.relatedGrid);
}

async function loadRelatedItems(item) {
    if (!item?.typeId) {
        renderRelatedItems([]);
        return;
    }

    const payload = await requestJson(`/api/home?pg=1&t=${encodeURIComponent(item.typeId)}`);
    const related = (payload.list || [])
        .filter((entry) => String(entry.id) !== String(item.id))
        .slice(0, 6);
    renderRelatedItems(related);
}

function trackPlaybackProgress(forceCompleted = false) {
    if (!currentItem || !playbackStartedAt) {
        return;
    }

    const duration = Math.max(latestWatchDuration, Math.round((Date.now() - playbackStartedAt) / 1000));
    latestWatchDuration = duration;
    const videoDuration = Number(elements.playVideo.duration || 0);
    const completionRate = videoDuration > 0 ? Math.min(1, elements.playVideo.currentTime / videoDuration) : 0;

    sendAnalyticsEvent({
        eventType: 'play_progress',
        pageType: 'play',
        itemId: currentItem.id,
        itemName: currentItem.name,
        itemTypeName: currentItem.typeName,
        itemTypeId: currentItem.typeId,
        watchDurationSeconds: duration,
        completionRate,
        completed: forceCompleted || completionRate >= 0.95,
    });
}

function openEpisode(item, sourceKey, episodeLabel) {
    const sources = item.sources || [];
    const activeSource = sources.find((source) => source.key === sourceKey) || getPreferredSource(sources);
    if (!activeSource) {
        throw new Error('未找到可用播放源');
    }

    const episode = activeSource.episodes.find((entry) => entry.label === episodeLabel) || activeSource.episodes[0];
    if (!episode) {
        throw new Error('当前播放源没有剧集数据');
    }

    currentSourceKey = activeSource.key;
    currentEpisodeLabel = episode.label;
    playbackStartedAt = Date.now();
    latestWatchDuration = 0;
    elements.playTitle.textContent = `${item.name} · ${episode.label}`;
    elements.playMeta.textContent = [item.typeName, item.area, item.year, item.updateTime].filter(Boolean).join(' / ');

    destroyPlayer();
    syncPlayUrl();
    renderEpisodes(item);
    pushRecentHistory(item, episode.label);

    sendAnalyticsEvent({
        eventType: 'play_start',
        pageType: 'play',
        itemId: item.id,
        itemName: item.name,
        itemTypeName: item.typeName,
        itemTypeId: item.typeId,
    });

    if (/\.m3u8($|\?)/i.test(episode.url)) {
        elements.playVideo.classList.remove('hidden');
        elements.playMessage.classList.add('hidden');
        elements.playVideo.controls = true;

        if (elements.playVideo.canPlayType('application/vnd.apple.mpegurl')) {
            elements.playVideo.src = episode.url;
        } else if (window.Hls && window.Hls.isSupported()) {
            hlsInstance = new window.Hls({
                enableWorker: true,
                lowLatencyMode: true,
            });
            hlsInstance.loadSource(episode.url);
            hlsInstance.attachMedia(elements.playVideo);
        } else {
            elements.playVideo.classList.add('hidden');
            elements.playMessage.classList.remove('hidden');
            elements.playMessage.textContent =
                '当前浏览器不支持 M3U8 原生播放，且 Hls.js 初始化失败，因此无法显示标准控制栏。建议换用 Chrome 或 Edge。';
            return;
        }

        elements.playVideo.play().catch(() => {});
        return;
    }

    elements.playIframe.classList.remove('hidden');
    elements.playIframe.src = episode.url;
    elements.playMessage.classList.add('hidden');
}

async function copyCurrentLink() {
    if (!currentItem || !currentEpisodeLabel) {
        showToast('当前没有可复制的播放链接');
        return;
    }

    const url = buildPlayUrl(currentItem.id, currentSourceKey, currentEpisodeLabel);
    try {
        await navigator.clipboard.writeText(url.toString());
        showToast('播放页链接已复制');
    } catch (error) {
        console.error(error);
        showToast('复制失败，请检查浏览器权限');
    }
}

async function init() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id') || '';
    const source = params.get('source') || '';
    const episode = params.get('episode') || '';

    if (!id) {
        throw new Error('缺少影片 id 参数');
    }

    const payload = await requestJson(`/api/detail?id=${id}`);
    const [item] = payload.list || [];
    if (!item) {
        throw new Error('未找到影片详情');
    }

    currentItem = item;
    renderDetail(item);
    await loadRelatedItems(item);
    await sendAnalyticsEvent({
        eventType: 'page_view',
        pageType: 'play',
        itemId: item.id,
        itemName: item.name,
        itemTypeName: item.typeName,
        itemTypeId: item.typeId,
    });
    openEpisode(item, source, episode);
}

elements.copyPlayerLink.addEventListener('click', () => {
    copyCurrentLink().catch((error) => {
        console.error(error);
        showToast('复制失败，请稍后重试');
    });
});

elements.playEpisodeGrid.addEventListener('click', (event) => {
    const sourceButton = event.target.closest('[data-source-key]');
    if (sourceButton && currentItem) {
        const nextSource = sourceButton.dataset.sourceKey || '';
        openEpisode(currentItem, nextSource, '');
        return;
    }

    const episodeButton = event.target.closest('[data-episode-label]');
    if (episodeButton && currentItem) {
        openEpisode(currentItem, currentSourceKey, episodeButton.dataset.episodeLabel || '');
    }
});

elements.prevEpisode.addEventListener('click', () => {
    if (!currentItem) {
        return;
    }

    const sources = currentItem.sources || [];
    const activeSource = sources.find((source) => source.key === currentSourceKey) || getPreferredSource(sources);
    const episodes = activeSource?.episodes || [];
    const currentIndex = episodes.findIndex((entry) => entry.label === currentEpisodeLabel);
    if (currentIndex > 0) {
        openEpisode(currentItem, currentSourceKey, episodes[currentIndex - 1].label);
    }
});

elements.nextEpisode.addEventListener('click', () => {
    if (!currentItem) {
        return;
    }

    const sources = currentItem.sources || [];
    const activeSource = sources.find((source) => source.key === currentSourceKey) || getPreferredSource(sources);
    const episodes = activeSource?.episodes || [];
    const currentIndex = episodes.findIndex((entry) => entry.label === currentEpisodeLabel);
    if (currentIndex >= 0 && currentIndex < episodes.length - 1) {
        openEpisode(currentItem, currentSourceKey, episodes[currentIndex + 1].label);
    }
});

window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'c' && (event.ctrlKey || event.metaKey)) {
        copyCurrentLink().catch(() => {});
    }
});

elements.playVideo.addEventListener('loadedmetadata', () => {
    applyVideoAspectRatio(elements.playVideo, '.standalone-player-frame');
});

elements.playVideo.addEventListener('timeupdate', () => {
    latestWatchDuration = Math.max(latestWatchDuration, Math.floor(elements.playVideo.currentTime || 0));
});

elements.playVideo.addEventListener('ended', () => {
    trackPlaybackProgress(true);
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        trackPlaybackProgress(false);
    }
});

window.addEventListener('beforeunload', () => {
    trackPlaybackProgress(false);
});

init().catch((error) => {
    console.error(error);
    elements.playTitle.textContent = '播放页加载失败';
    elements.playMeta.textContent = error.message || '请返回首页重新选择影片';
    elements.playMessage.textContent = '暂时无法载入播放资源，请检查本地服务或参数是否正确。';
});
