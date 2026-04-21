const state = {
    analytics: null,
    currentPreset: '7d',
    customFrom: '',
    customTo: '',
    charts: {
        visits: null,
        categories: null,
        geo: null
    }
};

const elements = {
    refreshButton: document.getElementById('refresh-analytics'),
    metricsGrid: document.getElementById('metrics-grid'),
    visitsChart: document.getElementById('visits-chart'),
    categoriesChart: document.getElementById('categories-chart'),
    geoChart: document.getElementById('geo-chart'),
    topItemsList: document.getElementById('top-items-list'),
    behaviorGrid: document.getElementById('behavior-grid'),
    timeButtons: document.querySelectorAll('.time-btn'),
    dateFrom: document.getElementById('date-from'),
    dateTo: document.getElementById('date-to'),
    applyCustomRange: document.getElementById('apply-custom-range'),
    exportJson: document.getElementById('export-json'),
    exportCsv: document.getElementById('export-csv'),
    toast: document.getElementById('toast')
};

let toastTimer = null;

/**
 * 显示提示消息
 * @param {string} message - 要显示的消息内容
 */
function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => {
        elements.toast.classList.remove('is-visible');
    }, 2400);
}

/**
 * 发送 JSON 请求
 * @param {string} url - 请求 URL
 * @param {Object} options - 请求选项
 * @returns {Promise<Object>} 返回的 JSON 数据
 */
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

/**
 * 格式化数字，添加千位分隔符
 * @param {number} num - 要格式化的数字
 * @returns {string} 格式化后的字符串
 */
function formatNumber(num) {
    return Number(num || 0).toLocaleString('zh-CN');
}

/**
 * 格式化时长
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时长字符串
 */
function formatDuration(seconds) {
    const secs = Math.max(0, Number(seconds || 0));
    if (secs < 60) {
        return `${secs}秒`;
    }
    if (secs < 3600) {
        const mins = Math.floor(secs / 60);
        const remainingSecs = secs % 60;
        return remainingSecs > 0 ? `${mins}分${remainingSecs}秒` : `${mins}分钟`;
    }
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
}

/**
 * 格式化日期显示
 * @param {string} dateStr - 日期字符串
 * @returns {string} 格式化后的日期
 */
function formatDateLabel(dateStr) {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
}

/**
 * 获取图表颜色
 * @param {number} count - 颜色数量
 * @returns {Array} 颜色数组
 */
function getChartColors(count) {
    const colors = [
        'rgba(255, 147, 79, 0.85)',
        'rgba(103, 200, 255, 0.85)',
        'rgba(134, 239, 172, 0.85)',
        'rgba(251, 191, 36, 0.85)',
        'rgba(167, 139, 250, 0.85)',
        'rgba(248, 113, 113, 0.85)',
        'rgba(96, 165, 250, 0.85)',
        'rgba(74, 222, 128, 0.85)'
    ];
    return colors.slice(0, Math.max(count, colors.length));
}

/**
 * 加载统计数据
 */
async function loadAnalytics() {
    let url = '/api/admin/analytics/summary?';
    const params = new URLSearchParams();

    if (state.currentPreset === 'custom' && state.customFrom && state.customTo) {
        params.set('preset', 'custom');
        params.set('from', state.customFrom);
        params.set('to', state.customTo);
    } else {
        params.set('preset', state.currentPreset);
    }

    url += params.toString();
    const payload = await requestJson(url);
    state.analytics = payload;
    renderAll();
}

/**
 * 渲染所有数据
 */
function renderAll() {
    if (!state.analytics) return;
    
    renderMetrics();
    renderVisitsChart();
    renderCategoriesChart();
    renderGeoChart();
    renderTopItems();
    renderBehavior();
}

/**
 * 渲染核心指标卡片
 */
function renderMetrics() {
    const { overview } = state.analytics;
    
    elements.metricsGrid.innerHTML = `
        <article class="metric-card">
            <div class="metric-icon metric-icon-visits">👁️</div>
            <div class="metric-content">
                <span class="metric-label">访问量</span>
                <strong class="metric-value">${formatNumber(overview.visitCount)}</strong>
            </div>
        </article>
        <article class="metric-card">
            <div class="metric-icon metric-icon-sessions">👥</div>
            <div class="metric-content">
                <span class="metric-label">会话数</span>
                <strong class="metric-value">${formatNumber(overview.sessionCount)}</strong>
            </div>
        </article>
        <article class="metric-card">
            <div class="metric-icon metric-icon-plays">▶️</div>
            <div class="metric-content">
                <span class="metric-label">播放次数</span>
                <strong class="metric-value">${formatNumber(overview.playCount)}</strong>
            </div>
        </article>
        <article class="metric-card">
            <div class="metric-icon metric-icon-duration">⏱️</div>
            <div class="metric-content">
                <span class="metric-label">平均观看时长</span>
                <strong class="metric-value">${formatDuration(overview.avgWatchDuration)}</strong>
            </div>
        </article>
        <article class="metric-card">
            <div class="metric-icon metric-icon-completion">✅</div>
            <div class="metric-content">
                <span class="metric-label">完播率</span>
                <strong class="metric-value">${overview.completionRate}%</strong>
            </div>
        </article>
        <article class="metric-card">
            <div class="metric-icon metric-icon-retention">🔄</div>
            <div class="metric-content">
                <span class="metric-label">用户留存率</span>
                <strong class="metric-value">${overview.retentionRate}%</strong>
            </div>
        </article>
    `;
}

/**
 * 渲染访问趋势图表
 */
function renderVisitsChart() {
    const { trends } = state.analytics;
    const data = trends.visitsByDay || [];
    
    const labels = data.map(item => formatDateLabel(item.date));
    const values = data.map(item => item.visits);
    
    if (state.charts.visits) {
        state.charts.visits.destroy();
    }
    
    const ctx = elements.visitsChart.getContext('2d');
    state.charts.visits = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: '访问量',
                data: values,
                borderColor: 'rgba(255, 147, 79, 1)',
                backgroundColor: 'rgba(255, 147, 79, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: 'rgba(255, 147, 79, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(148, 173, 212, 0.1)'
                    },
                    ticks: {
                        color: '#9db0ca'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(148, 173, 212, 0.1)'
                    },
                    ticks: {
                        color: '#9db0ca',
                        beginAtZero: true
                    }
                }
            }
        }
    });
}

/**
 * 渲染分类占比图表
 */
function renderCategoriesChart() {
    const { distributions } = state.analytics;
    const data = distributions.categories || [];
    
    const labels = data.map(item => item.name || '未分类');
    const values = data.map(item => item.value);
    const colors = getChartColors(data.length);
    
    if (state.charts.categories) {
        state.charts.categories.destroy();
    }
    
    const ctx = elements.categoriesChart.getContext('2d');
    state.charts.categories = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderColor: 'rgba(12, 23, 41, 0.88)',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#eef3ff',
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

/**
 * 渲染地域分布图表
 */
function renderGeoChart() {
    const { distributions } = state.analytics;
    const data = distributions.geo || [];
    
    const labels = data.map(item => item.name || '未知地区');
    const values = data.map(item => item.value);
    const colors = getChartColors(data.length);
    
    if (state.charts.geo) {
        state.charts.geo.destroy();
    }
    
    const ctx = elements.geoChart.getContext('2d');
    state.charts.geo = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: '访问量',
                data: values,
                backgroundColor: 'rgba(103, 200, 255, 0.7)',
                borderColor: 'rgba(103, 200, 255, 1)',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#9db0ca',
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(148, 173, 212, 0.1)'
                    },
                    ticks: {
                        color: '#9db0ca',
                        beginAtZero: true
                    }
                }
            }
        }
    });
}

/**
 * 渲染热门影片排行
 */
function renderTopItems() {
    const { rankings } = state.analytics;
    const items = rankings.topItems || [];
    
    if (!items.length) {
        elements.topItemsList.innerHTML = `
            <div class="empty-admin-card">
                <h3>暂无数据</h3>
                <p>当前时间段内暂无影片观看记录。</p>
            </div>
        `;
        return;
    }
    
    const maxValue = items[0]?.value || 1;
    
    elements.topItemsList.innerHTML = items.map((item, index) => {
        const percentage = Math.round((item.value / maxValue) * 100);
        const rankClass = index < 3 ? `rank-${index + 1}` : '';
        
        return `
            <article class="top-item-card ${rankClass}">
                <div class="top-item-rank">${index + 1}</div>
                <div class="top-item-info">
                    <h3 class="top-item-name">${escapeHtml(item.name)}</h3>
                    <div class="top-item-bar">
                        <div class="top-item-bar-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
                <div class="top-item-value">${formatNumber(item.value)} 次</div>
            </article>
        `;
    }).join('');
}

/**
 * 渲染用户行为分析
 */
function renderBehavior() {
    const { behavior } = state.analytics;
    
    elements.behaviorGrid.innerHTML = `
        <article class="behavior-card">
            <div class="behavior-icon">⏱️</div>
            <div class="behavior-content">
                <span class="behavior-label">总观看时长</span>
                <strong class="behavior-value">${formatDuration(behavior.totalWatchDurationSeconds)}</strong>
            </div>
        </article>
        <article class="behavior-card">
            <div class="behavior-icon">📊</div>
            <div class="behavior-content">
                <span class="behavior-label">平均观看时长</span>
                <strong class="behavior-value">${formatDuration(behavior.averageWatchDurationSeconds)}</strong>
            </div>
        </article>
        <article class="behavior-card">
            <div class="behavior-icon">✅</div>
            <div class="behavior-content">
                <span class="behavior-label">完播率</span>
                <strong class="behavior-value">${behavior.completionRate}%</strong>
            </div>
        </article>
        <article class="behavior-card">
            <div class="behavior-icon">🔄</div>
            <div class="behavior-content">
                <span class="behavior-label">用户留存率</span>
                <strong class="behavior-value">${behavior.retentionRate}%</strong>
            </div>
        </article>
    `;
}

/**
 * HTML 转义
 * @param {string} value - 要转义的字符串
 * @returns {string} 转义后的字符串
 */
function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

/**
 * 下载 JSON 文件
 */
async function exportToJson() {
    let url = '/api/admin/analytics/export?format=json&';
    const params = new URLSearchParams();

    if (state.currentPreset === 'custom' && state.customFrom && state.customTo) {
        params.set('preset', 'custom');
        params.set('from', state.customFrom);
        params.set('to', state.customTo);
    } else {
        params.set('preset', state.currentPreset);
    }

    url += params.toString();
    const payload = await requestJson(url);
    
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const urlObj = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = urlObj;
    anchor.download = `analytics-${payload.range.from}-${payload.range.to}.json`;
    anchor.click();
    URL.revokeObjectURL(urlObj);
    showToast('数据已导出为 JSON');
}

/**
 * 导出 CSV 文件
 */
async function exportToCsv() {
    let url = '/api/admin/analytics/export?format=csv&';
    const params = new URLSearchParams();

    if (state.currentPreset === 'custom' && state.customFrom && state.customTo) {
        params.set('preset', 'custom');
        params.set('from', state.customFrom);
        params.set('to', state.customTo);
    } else {
        params.set('preset', state.currentPreset);
    }

    url += params.toString();
    
    const response = await fetch(url);
    const blob = await response.blob();
    const urlObj = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = urlObj;
    const contentDisposition = response.headers.get('Content-Disposition');
    const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
    anchor.download = filenameMatch ? filenameMatch[1] : 'analytics-export.csv';
    anchor.click();
    URL.revokeObjectURL(urlObj);
    showToast('数据已导出为 CSV');
}

/**
 * 设置时间预设
 * @param {string} preset - 时间预设
 */
function setPreset(preset) {
    state.currentPreset = preset;
    
    elements.timeButtons.forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.preset === preset);
    });
    
    loadAnalytics().catch(error => {
        console.error(error);
        showToast(error.message || '加载数据失败');
    });
}

/**
 * 应用自定义日期范围
 */
function applyCustomRange() {
    const from = elements.dateFrom.value;
    const to = elements.dateTo.value;
    
    if (!from || !to) {
        showToast('请选择开始和结束日期');
        return;
    }
    
    if (new Date(from) > new Date(to)) {
        showToast('开始日期不能晚于结束日期');
        return;
    }
    
    state.customFrom = from;
    state.customTo = to;
    state.currentPreset = 'custom';
    
    elements.timeButtons.forEach(btn => {
        btn.classList.remove('is-active');
    });
    
    loadAnalytics().catch(error => {
        console.error(error);
        showToast(error.message || '加载数据失败');
    });
}

/**
 * 绑定事件
 */
function bindEvents() {
    elements.refreshButton.addEventListener('click', async () => {
        try {
            await loadAnalytics();
            showToast('数据已刷新');
        } catch (error) {
            console.error(error);
            showToast(error.message || '刷新数据失败');
        }
    });
    
    elements.timeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            setPreset(btn.dataset.preset);
        });
    });
    
    elements.applyCustomRange.addEventListener('click', applyCustomRange);
    
    elements.exportJson.addEventListener('click', async () => {
        try {
            await exportToJson();
        } catch (error) {
            console.error(error);
            showToast(error.message || '导出失败');
        }
    });
    
    elements.exportCsv.addEventListener('click', async () => {
        try {
            await exportToCsv();
        } catch (error) {
            console.error(error);
            showToast(error.message || '导出失败');
        }
    });
}

/**
 * 初始化
 */
async function bootstrap() {
    bindEvents();
    
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 6);
    
    elements.dateFrom.value = weekAgo.toISOString().slice(0, 10);
    elements.dateTo.value = today.toISOString().slice(0, 10);
    
    try {
        await loadAnalytics();
    } catch (error) {
        console.error(error);
        showToast(error.message || '初始化失败');
    }
}

bootstrap().catch((error) => {
    console.error(error);
    showToast(error.message || '统计分析页初始化失败');
});
