// Calculate previous month relative to system date
const d = new Date();
d.setMonth(d.getMonth() - 1);
const prevM = (d.getMonth() + 1).toString().padStart(2, '0');
const prevY = d.getFullYear().toString();

// State Management
let state = {
    view: 'mensal', // 'anual' or 'mensal' or 'historico'
    year: prevY,
    month: prevM,
    theme: 'dark',
    filterIE: 'E',
    chartTrend: null,
    chartCategory: null,
    data: [], // Raw parsed transactions
    password: null // Encryption password
};

// DOM Elements
const els = {
    navAnual: document.getElementById('nav-anual'),
    navMensal: document.getElementById('nav-mensal'),
    navHistorico: document.getElementById('nav-historico'),
    themeBtn: document.getElementById('theme-btn'),
    viewTitle: document.getElementById('view-title'),
    yearSelect: document.getElementById('year-select'),
    yearGroup: document.getElementById('year-control-group'),
    monthGroup: document.getElementById('month-control-group'),
    monthSelect: document.getElementById('month-select'),
    filterIE: document.getElementById('filter-ie'),
    
    totalReceitas: document.getElementById('total-receitas'),
    totalDespesas: document.getElementById('total-despesas'),
    saldoLiquido: document.getElementById('saldo-liquido'),
    
    dashboardContent: document.getElementById('dashboard-content'),
    loading: document.getElementById('loading'),
    
    trendCtx: document.getElementById('trendChart').getContext('2d'),
    categoryCtx: document.getElementById('categoryChart').getContext('2d'),
    tableBody: document.getElementById('table-body'),
    incomeTableBody: document.getElementById('income-table-body'),
    
    // Modal Elements
    detailsModal: document.getElementById('details-modal'),
    closeModal: document.getElementById('close-modal'),
    modalCategoryTitle: document.getElementById('modal-category-title'),
    detailsTableBody: document.getElementById('details-table-body'),
    
    monthlyTransactions: document.getElementById('monthly-transactions'),
    allTransactionsBody: document.getElementById('all-transactions-body'),
    originFilter: document.getElementById('origin-filter'),
    matrixSection: document.getElementById('annual-matrix-section'),
    matrixTableBody: document.getElementById('matrix-table-body'),
    matrixTableHead: document.getElementById('matrix-table-head'),
    matrixTitle: document.getElementById('matrix-title'),
    
    // Login
    loginModal: document.getElementById('login-modal'),
    loginPassword: document.getElementById('login-password'),
    loginBtn: document.getElementById('login-btn'),
    loginError: document.getElementById('login-error'),
    
    // Sidebar Toggle
    menuToggle: document.getElementById('menu-toggle'),
    sidebar: document.querySelector('.sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    refreshBtn: document.getElementById('refresh-btn'),
    
    // Upload Area
    navUpload: document.getElementById('nav-upload'),
    uploadView: document.getElementById('upload-view'),
    fileInput: document.getElementById('file-input'),
    dropZone: document.getElementById('drop-zone'),
    browseBtn: document.getElementById('browse-btn'),
    selectedFileName: document.getElementById('selected-file-name'),
    classifyBtn: document.getElementById('classify-btn'),
    clearUploadBtn: document.getElementById('clear-upload-btn'),
    uploadLoading: document.getElementById('upload-loading'),
    uploadStatusText: document.getElementById('upload-status-text'),
    reviewArea: document.getElementById('review-area'),
    reviewTableBody: document.getElementById('review-table-body'),
    saveReviewBtn: document.getElementById('save-review-btn')
};

// Colors for Categories
const categoryColors = {
    'Alimentacao': '#f59e0b',
    'Custos fixos': '#3b82f6',
    'Cartao de Credito': '#ef4444',
    'Saude': '#10b981',
    'Transporte': '#6366f1',
    'Carro': '#8b5cf6',
    'Vestuario': '#ec4899',
    'Lazer': '#14b8a6',
    'Pets': '#f97316',
    'Educacao': '#84cc16',
    'Aplicacoes': '#06b6d4',
    'Outros': '#9ca3af'
};

const defaultColors = ['#f59e0b', '#3b82f6', '#ef4444', '#10b981', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#06b6d4', '#9ca3af'];

function getCategoryColor(cat, index) {
    return categoryColors[cat] || defaultColors[index % defaultColors.length];
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    els.yearSelect.value = state.year;
    els.monthSelect.value = state.month;
    els.filterIE.value = state.filterIE;
    
    // Show upload menu only on localhost or local file access
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
        if(els.navUpload) els.navUpload.style.display = 'block';
    }
    
    // Setup UI components and initial state
    changeView(state.view, true);
    
    setupEventListeners();
    // Do not load data until login
    // loadData();
});

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            changeView(e.target.dataset.view);
            // Close sidebar on mobile/desktop after selection
            if (els.sidebar && els.sidebarOverlay) {
                els.sidebar.classList.remove('open');
                els.sidebarOverlay.classList.remove('active');
            }
        });
    });
    
    // Selects
    els.yearSelect.addEventListener('change', (e) => {
        state.year = e.target.value;
        updateViewTitle();
        loadData();
    });
    
    els.monthSelect.addEventListener('change', (e) => {
        state.month = e.target.value;
        updateViewTitle();
        loadData();
    });
    
    els.filterIE.addEventListener('change', (e) => {
        state.filterIE = e.target.value;
        processAndRender();
    });
    
    if (els.originFilter) {
        els.originFilter.addEventListener('change', () => {
            processAndRender();
        });
    }
    
    // Theme
    els.themeBtn.addEventListener('click', toggleTheme);
    
    // Modal
    els.closeModal.addEventListener('click', closeCategoryDetails);
    els.detailsModal.addEventListener('click', (e) => {
        if (e.target === els.detailsModal) closeCategoryDetails();
    });
    
    // Login
    els.loginBtn.addEventListener('click', async () => {
        const pwd = els.loginPassword.value;
        if (!pwd) return;
        
        els.loginBtn.innerText = 'Descriptografando...';
        els.loginBtn.disabled = true;
        els.loginError.style.display = 'none';
        
        try {
            state.password = pwd;
            // Test decryption with data loading
            await loadData();
            // If success, hide modal
            els.loginModal.classList.remove('active');
        } catch (e) {
            console.error(e);
            els.loginError.style.display = 'block';
            state.password = null;
        } finally {
            els.loginBtn.innerText = 'Acessar Dashboard';
            els.loginBtn.disabled = false;
        }
    });
    
    els.loginPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') els.loginBtn.click();
    });
    
    // Sidebar Toggle
    if (els.menuToggle && els.sidebar && els.sidebarOverlay) {
        els.menuToggle.addEventListener('click', () => {
            els.sidebar.classList.add('open');
            els.sidebarOverlay.classList.add('active');
        });

        els.sidebarOverlay.addEventListener('click', () => {
            els.sidebar.classList.remove('open');
            els.sidebarOverlay.classList.remove('active');
        });
    }
    
    // Refresh Button
    if (els.refreshBtn) {
        els.refreshBtn.addEventListener('click', () => {
            window.location.reload(true);
        });
    }
}

// Update view title dynamically
function updateViewTitle() {
    if (state.view === 'historico') {
        els.viewTitle.innerText = `Visão Desde o Início (Consolidado)`;
    } else if (state.view === 'anual') {
        els.viewTitle.innerText = `Visão Anual - ${state.year}`;
    } else {
        const monthName = els.monthSelect.options[els.monthSelect.selectedIndex].text;
        els.viewTitle.innerText = `Visão Mensal - ${monthName}/${state.year}`;
    }
}

// Update view without reloading data optionally
function changeView(view, skipLoad=false) {
    state.view = view;
    
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`nav-${view}`).classList.add('active');
    
    if (view === 'historico') {
        els.yearGroup.style.display = 'none';
        els.monthGroup.style.display = 'none';
        if(els.monthlyTransactions) els.monthlyTransactions.style.display = 'none';
        if(els.uploadView) els.uploadView.style.display = 'none';
        els.dashboardContent.style.display = 'block';
    } else if (view === 'anual') {
        els.yearGroup.style.display = 'block';
        els.monthGroup.style.display = 'none';
        if(els.monthlyTransactions) els.monthlyTransactions.style.display = 'none';
        if(els.uploadView) els.uploadView.style.display = 'none';
        els.dashboardContent.style.display = 'block';
    } else if (view === 'upload') {
        els.yearGroup.style.display = 'block';
        els.monthGroup.style.display = 'block';
        if(els.monthlyTransactions) els.monthlyTransactions.style.display = 'none';
        els.dashboardContent.style.display = 'none';
        if(els.uploadView) els.uploadView.style.display = 'block';
        els.viewTitle.innerText = `Gerenciar Transações - ${els.monthSelect.options[els.monthSelect.selectedIndex].text}/${state.year}`;
    } else {
        els.yearGroup.style.display = 'block';
        els.monthGroup.style.display = 'block';
        if(els.monthlyTransactions) els.monthlyTransactions.style.display = 'block';
        if(els.uploadView) els.uploadView.style.display = 'none';
        els.dashboardContent.style.display = 'block';
    }
    
    updateViewTitle();
    
    if (!skipLoad && state.password) loadData();
}

function toggleTheme() {
    const html = document.documentElement;
    state.theme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', state.theme);
    
    // Update chart text colors
    updateChartsTheme();
}

function showLoading(show) {
    els.loading.style.display = show ? 'flex' : 'none';
    els.dashboardContent.style.display = show ? 'none' : 'block';
}

// Data Fetching and Parsing
async function loadData() {
    if (!state.password) return; // Wait for login
    els.loading.classList.add('active');
    els.dashboardContent.style.opacity = '0.5';
    state.data = [];
    
    try {
        if (state.view === 'historico') {
            els.viewTitle.innerText = `Visão Desde o Início (Consolidado)`;
            const promises = [];
            const years = ['2022', '2023', '2024', '2025', '2026'];
            years.forEach(y => {
                for (let i = 1; i <= 12; i++) {
                    const monthStr = i.toString().padStart(2, '0');
                    promises.push(fetchTSV(y, monthStr));
                }
            });
            const results = await Promise.allSettled(promises);
            results.forEach(res => {
                if (res.status === 'fulfilled' && res.value) {
                    state.data = state.data.concat(res.value);
                }
            });
        } else if (state.view === 'anual') {
            els.viewTitle.innerText = `Visão Anual - ${state.year}`;
            // Fetch all 12 months
            const promises = [];
            for (let i = 1; i <= 12; i++) {
                const monthStr = i.toString().padStart(2, '0');
                promises.push(fetchTSV(state.year, monthStr));
            }
            
            const results = await Promise.allSettled(promises);
            results.forEach(res => {
                if (res.status === 'fulfilled' && res.value) {
                    state.data = state.data.concat(res.value);
                }
            });
            
        } else {
            const monthName = els.monthSelect.options[els.monthSelect.selectedIndex].text;
            els.viewTitle.innerText = `Visão Mensal - ${monthName}/${state.year}`;
            const data = await fetchTSV(state.year, state.month);
            if (data) state.data = data;
        }
        
        if (state.view === 'upload') {
            populateUploadView();
        } else {
            processAndRender();
        }
        
    } catch (e) {
        console.warn(`Could not load or decrypt data`, e);
        throw e; // Bubble up error to trigger login failure
    } finally {
        els.loading.classList.remove('active');
        els.dashboardContent.style.opacity = '1';
    }
}

// AES-GCM Decryption
async function decryptData(base64Data, password) {
    const rawData = atob(base64Data.trim());
    const bytes = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
        bytes[i] = rawData.charCodeAt(i);
    }
    
    if (bytes.length < 28) throw new Error("Data too short");
    
    const salt = bytes.slice(0, 16);
    const iv = bytes.slice(16, 28);
    const ciphertext = bytes.slice(28);

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        ciphertext
    );
    
    return new TextDecoder().decode(decrypted);
}

// Fetch and decrypt TSV file
async function fetchTSV(year, month) {
    try {
        const response = await fetch(`data/${year}/${year}${month}.enc`);
        if (!response.ok) return [];
        
        const base64Data = await response.text();
        const text = await decryptData(base64Data, state.password);
        
        return parseTSV(text, month, year);
    } catch (e) {
        return null;
    }
}

function parseTSV(text, monthNum, yearStr) {
    if (!text || text.trim() === '') return [];
    
    const lines = text.trim().split('\n');
    const records = [];
    
    lines.forEach(line => {
        const cols = line.split('\t');
        if (cols.length >= 6) {
            // Data, Descrição, Total, Origem, Categoria, SubCategoria
            // Tratar valor BR para float
            let valStr = cols[2].replace(/\./g, '').replace(',', '.');
            let total = parseFloat(valStr);
            if (isNaN(total)) total = 0;
            
            records.push({
                dateStr: cols[0],
                monthStr: monthNum, // keep track for annual charts
                yearStr: yearStr,
                desc: cols[1],
                total: total,
                origem: cols[3],
                cat: cols[4].trim(),
                subcat: (cols[5] || '').trim(),
                dc: cols.length > 6 ? cols[6].trim() : '-',
                ie: cols.length > 7 ? cols[7].trim() : '-',
                subcatOrig: cols.length > 8 ? cols[8].trim() : '-'
            });
        }
    });
    return records;
}

// Processing and Rendering
function processAndRender() {
    // Determine which data to use based on the I/E filter
    const activeData = state.data.filter(item => {
        if (state.filterIE === 'E') {
            return item.ie === 'E';
        }
        return true;
    });

    let totalIn = 0;
    let totalOut = 0;
    
    let origins = new Set();
    
    const trendsByPeriod = {};
    if (state.view === 'anual') {
        for(let i=1; i<=12; i++) {
            let m = i.toString().padStart(2, '0');
            trendsByPeriod[m] = { inc: 0, exp: 0 };
        }
    } else if (state.view === 'historico') {
        const years = ['2022', '2023', '2024', '2025', '2026'];
        years.forEach(y => { trendsByPeriod[y] = { inc: 0, exp: 0 }; });
    }
    
    // Matrix tracking
    let matrixData = {}; // cat -> { total, subcats: { subcat: { periods: {}, total } }, periods: {} }
    
    // Detailed Table tracking
    let filteredExpByCategory = {}; // cat -> { total, subcats: { subcat: total } }
    let filteredTotalOut = 0;
    
    let incomeByCategory = {}; // cat -> { total, subcats: { subcat: total } }
    let totalIncomeCategories = 0;
    
    const selectedOrigin = els.originFilter ? els.originFilter.value : 'all';

    // Process Data
    activeData.forEach(item => {
        if (item.cat === 'Saldo Inicial (Mes)') return;

        let isIncome = (item.dc === 'C');
        let subcat = item.subcatOrig || 'Não classificado';
        if (!subcat || subcat === '-') subcat = 'Não classificado';
        
        let periodStr = state.view === 'historico' ? item.yearStr : item.monthStr;
        
        if (isIncome) {
            totalIn += item.total;
            
            // Income categories
            if (!incomeByCategory[item.cat]) incomeByCategory[item.cat] = { total: 0, subcats: {} };
            incomeByCategory[item.cat].total += item.total;
            incomeByCategory[item.cat].subcats[subcat] = (incomeByCategory[item.cat].subcats[subcat] || 0) + item.total;
            totalIncomeCategories += item.total;
            
        } else {
            totalOut += item.total;
            if (item.origem) origins.add(item.origem.toUpperCase());
            
            // Expenses categories
            const orgVal = item.origem ? item.origem.toUpperCase() : '';
            if (selectedOrigin === 'all' || selectedOrigin === orgVal) {
                if (!filteredExpByCategory[item.cat]) filteredExpByCategory[item.cat] = { total: 0, subcats: {} };
                filteredExpByCategory[item.cat].total += item.total;
                filteredExpByCategory[item.cat].subcats[subcat] = (filteredExpByCategory[item.cat].subcats[subcat] || 0) + item.total;
                filteredTotalOut += item.total;
            }
            
            // Matrix data (both anual and historico)
            if (state.view === 'anual' || state.view === 'historico') {
                if (!matrixData[item.cat]) matrixData[item.cat] = { total: 0, subcats: {}, periods: {} };
                matrixData[item.cat].total += item.total;
                matrixData[item.cat].periods[periodStr] = (matrixData[item.cat].periods[periodStr] || 0) + item.total;
                
                if (!matrixData[item.cat].subcats[subcat]) matrixData[item.cat].subcats[subcat] = { total: 0, periods: {} };
                matrixData[item.cat].subcats[subcat].total += item.total;
                matrixData[item.cat].subcats[subcat].periods[periodStr] = (matrixData[item.cat].subcats[subcat].periods[periodStr] || 0) + item.total;
            }
        }
        
        // Trends
        if (state.view === 'anual') {
            if (trendsByPeriod[item.monthStr]) {
                if (isIncome) trendsByPeriod[item.monthStr].inc += item.total;
                if (!isIncome) trendsByPeriod[item.monthStr].exp += item.total;
            }
        } else if (state.view === 'historico') {
            if (trendsByPeriod[item.yearStr]) {
                if (isIncome) trendsByPeriod[item.yearStr].inc += item.total;
                if (!isIncome) trendsByPeriod[item.yearStr].exp += item.total;
            }
        } else {
            // Group by Day (DD)
            const parts = item.dateStr.split('/');
            if (parts.length === 3) {
                const day = parts[0];
                if (!trendsByPeriod[day]) trendsByPeriod[day] = { inc: 0, exp: 0 };
                if (isIncome) trendsByPeriod[day].inc += item.total;
                if (!isIncome) trendsByPeriod[day].exp += item.total;
            }
        }
    });
    
    // Render Monthly Transactions List
    if (state.view === 'mensal') {
        els.allTransactionsBody.innerHTML = '';
        // Utilizar state.data para mostrar TODAS as transações (sem filtros de I/E)
        const sortedData = [...state.data].sort((a, b) => {
            const dayA = parseInt(a.dateStr.split('/')[0]) || 0;
            const dayB = parseInt(b.dateStr.split('/')[0]) || 0;
            return dayA - dayB;
        });
        
        sortedData.forEach(item => {
            const tr = document.createElement('tr');
            let dcStyle = item.dc === 'D' ? 'color: var(--danger)' : (item.dc === 'C' ? 'color: var(--success)' : '');
            tr.innerHTML = `<td>${item.dateStr}</td><td>${item.desc}</td><td class="text-right" style="${dcStyle}">${formatMoney(item.total)}</td><td>${item.origem || '-'}</td><td>${item.cat}</td><td>${item.subcatOrig}</td><td style="text-align: center; font-weight: bold; ${dcStyle}">${item.dc}</td><td style="text-align: center;">${item.ie}</td>`;
            els.allTransactionsBody.appendChild(tr);
        });
    }
    
    const saldo = totalIn - totalOut;
    els.totalReceitas.innerText = formatMoney(totalIn);
    els.totalDespesas.innerText = formatMoney(totalOut);
    els.saldoLiquido.innerText = formatMoney(saldo);
    els.saldoLiquido.style.color = saldo >= 0 ? 'var(--success)' : 'var(--danger)';
    
    // Populate Origin Filter
    if (els.originFilter) {
        const currentOrigin = els.originFilter.value;
        els.originFilter.innerHTML = '<option value="all">Todas as Origens</option>';
        Array.from(origins).sort().forEach(org => {
            const opt = document.createElement('option');
            opt.value = org;
            opt.innerText = org;
            if (currentOrigin === org) opt.selected = true;
            els.originFilter.appendChild(opt);
        });
    }
    
    const sortedCats = Object.keys(filteredExpByCategory).sort((a,b) => filteredExpByCategory[b].total - filteredExpByCategory[a].total);
    
    renderTable(filteredExpByCategory, filteredTotalOut);
    renderIncomeTable(incomeByCategory, totalIncomeCategories);
    
    if (state.view === 'anual' || state.view === 'historico') {
        els.matrixSection.style.display = 'block';
        if (els.matrixTitle) {
            els.matrixTitle.innerText = state.view === 'anual' ? 'Acompanhamento Anual por Categoria' : 'Acompanhamento Histórico por Categoria';
        }
        renderAnnualMatrix(matrixData);
    } else {
        els.matrixSection.style.display = 'none';
    }
    
    // Prepare expByCategory for charts (needs flat format)
    let flatExpByCat = {};
    Object.keys(filteredExpByCategory).forEach(c => flatExpByCat[c] = filteredExpByCategory[c].total);
    renderCharts(trendsByPeriod, sortedCats, flatExpByCat, filteredTotalOut);
}

function renderCharts(trends, sortedCats, expByCategory, totalExp) {
    const isDark = state.theme === 'dark';
    const textColor = isDark ? '#94a3b8' : '#6b7280';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    
    // TREND CHART
    const trendKeys = Object.keys(trends).sort();
    const incData = trendKeys.map(k => trends[k].inc);
    const expData = trendKeys.map(k => trends[k].exp);
    const labels = state.view === 'anual' ? 
        ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] : 
        trendKeys; // Days/Years
        
    if (state.chartTrend) state.chartTrend.destroy();
    
    state.chartTrend = new Chart(els.trendCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Créditos',
                    data: incData,
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderRadius: 4
                },
                {
                    label: 'Débitos',
                    data: expData,
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: textColor } }
            },
            scales: {
                y: { grid: { color: gridColor }, ticks: { color: textColor } },
                x: { grid: { display: false }, ticks: { color: textColor } }
            }
        }
    });
    
    const topCats = sortedCats.slice(0, 8);
    const topData = topCats.map(c => expByCategory[c]);
    
    if (sortedCats.length > 8) {
        let othersTotal = 0;
        for(let i=8; i<sortedCats.length; i++) othersTotal += expByCategory[sortedCats[i]];
        topCats.push('Outras Despesas');
        topData.push(othersTotal);
    }
    
    const catColors = topCats.map((c, i) => c === 'Outras Despesas' ? '#64748b' : getCategoryColor(c, i));
    
    if (state.chartCategory) state.chartCategory.destroy();
    
    state.chartCategory = new Chart(els.categoryCtx, {
        type: 'doughnut',
        data: {
            labels: topCats,
            datasets: [{
                data: topData,
                backgroundColor: catColors,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: textColor, boxWidth: 12 }
                }
            },
            cutout: '70%'
        }
    });
}

function updateChartsTheme() {
    if(!state.chartTrend || !state.chartCategory) return;
    
    const isDark = state.theme === 'dark';
    const textColor = isDark ? '#94a3b8' : '#6b7280';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    
    state.chartTrend.options.plugins.legend.labels.color = textColor;
    state.chartTrend.options.scales.x.ticks.color = textColor;
    state.chartTrend.options.scales.y.ticks.color = textColor;
    state.chartTrend.options.scales.y.grid.color = gridColor;
    state.chartTrend.update();
    
    state.chartCategory.options.plugins.legend.labels.color = textColor;
    state.chartCategory.update();
}

function renderTable(expByCategory, totalExp) {
    els.tableBody.innerHTML = '';
    
    const sortedCats = Object.keys(expByCategory).sort((a,b) => expByCategory[b].total - expByCategory[a].total);
    
    if (sortedCats.length === 0) {
        els.tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center">Nenhuma despesa no período.</td></tr>';
        return;
    }
    
    sortedCats.forEach((cat, index) => {
        const catData = expByCategory[cat];
        const amount = catData.total;
        const pct = totalExp > 0 ? ((amount / totalExp) * 100).toFixed(1) : 0;
        const color = getCategoryColor(cat, index);
        const subCatsKeys = Object.keys(catData.subcats).sort((a,b) => catData.subcats[b] - catData.subcats[a]);
        
        const tr = document.createElement('tr');
        tr.className = 'clickable-row cat-row';
        const hasSubcats = subCatsKeys.length > 0;
        
        tr.innerHTML = `
            <td>
                <div class="category-name">
                    ${hasSubcats ? '<span class="expand-icon">▶</span>' : '<span class="expand-icon" style="opacity:0">▶</span>'}
                    <div class="category-color" style="background-color: ${color}"></div>
                    <span>${cat}</span>
                    <button class="details-icon-btn" title="Ver Detalhes" onclick="event.stopPropagation(); openCategoryDetails('${cat}')">🔍</button>
                </div>
            </td>
            <td class="text-right">${formatMoney(amount)}</td>
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="flex:1; height:6px; background:rgba(0,0,0,0.1); border-radius:3px; overflow:hidden;">
                        <div style="height:100%; width:${pct}%; background:${color}"></div>
                    </div>
                    <span style="font-size:12px; min-width:40px;">${pct}%</span>
                </div>
            </td>
        `;
        
        const subcatRows = [];
        subCatsKeys.forEach(sub => {
            const subAmt = catData.subcats[sub];
            const subPct = amount > 0 ? ((subAmt / amount) * 100).toFixed(1) : 0;
            const subTr = document.createElement('tr');
            subTr.className = 'subcat-row collapsed';
            subTr.innerHTML = `
                <td style="padding-left: 48px;">
                    <div class="category-name" style="font-size: 0.9em; opacity: 0.8;">
                        <button class="details-icon-btn" title="Ver Detalhes" onclick="event.stopPropagation(); openCategoryDetails('${cat}', '${sub}')">🔍</button>
                        ↳ ${sub}
                    </div>
                </td>
                <td class="text-right" style="font-size: 0.9em; opacity: 0.8;">${formatMoney(subAmt)}</td>
                <td style="font-size: 0.9em; opacity: 0.8;">${subPct}% da cat.</td>
            `;
            subcatRows.push(subTr);
        });
        
        tr.onclick = () => {
            const icon = tr.querySelector('.expand-icon');
            if (icon) {
                const isExpanded = icon.classList.contains('expanded');
                if (isExpanded) {
                    icon.classList.remove('expanded');
                    icon.innerText = '▶';
                    subcatRows.forEach(sr => sr.classList.add('collapsed'));
                } else {
                    icon.classList.add('expanded');
                    icon.innerText = '▼';
                    subcatRows.forEach(sr => sr.classList.remove('collapsed'));
                }
            }
        };
        
        els.tableBody.appendChild(tr);
        subcatRows.forEach(sr => els.tableBody.appendChild(sr));
    });
}

function renderIncomeTable(incomeByCategory, totalInc) {
    if (!els.incomeTableBody) return;
    els.incomeTableBody.innerHTML = '';
    
    const sortedCats = Object.keys(incomeByCategory).sort((a,b) => incomeByCategory[b].total - incomeByCategory[a].total);
    
    if (sortedCats.length === 0) {
        els.incomeTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center">Nenhuma receita no período.</td></tr>';
        return;
    }
    
    sortedCats.forEach((cat, index) => {
        const catData = incomeByCategory[cat];
        const amount = catData.total;
        const pct = totalInc > 0 ? ((amount / totalInc) * 100).toFixed(1) : 0;
        const color = getCategoryColor(cat, index);
        const subCatsKeys = Object.keys(catData.subcats).sort((a,b) => catData.subcats[b] - catData.subcats[a]);
        
        const tr = document.createElement('tr');
        tr.className = 'clickable-row cat-row';
        const hasSubcats = subCatsKeys.length > 0;
        
        tr.innerHTML = `
            <td>
                <div class="category-name">
                    ${hasSubcats ? '<span class="expand-icon">▶</span>' : '<span class="expand-icon" style="opacity:0">▶</span>'}
                    <div class="category-color" style="background-color: ${color}"></div>
                    <span>${cat}</span>
                    <button class="details-icon-btn" title="Ver Detalhes" onclick="event.stopPropagation(); openCategoryDetails('${cat}')">🔍</button>
                </div>
            </td>
            <td class="text-right">${formatMoney(amount)}</td>
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="flex:1; height:6px; background:rgba(0,0,0,0.1); border-radius:3px; overflow:hidden;">
                        <div style="height:100%; width:${pct}%; background:${color}"></div>
                    </div>
                    <span style="font-size:12px; min-width:40px;">${pct}%</span>
                </div>
            </td>
        `;
        
        const subcatRows = [];
        subCatsKeys.forEach(sub => {
            const subAmt = catData.subcats[sub];
            const subPct = amount > 0 ? ((subAmt / amount) * 100).toFixed(1) : 0;
            const subTr = document.createElement('tr');
            subTr.className = 'subcat-row collapsed';
            subTr.innerHTML = `
                <td style="padding-left: 48px;">
                    <div class="category-name" style="font-size: 0.9em; opacity: 0.8;">
                        <button class="details-icon-btn" title="Ver Detalhes" onclick="event.stopPropagation(); openCategoryDetails('${cat}', '${sub}')">🔍</button>
                        ↳ ${sub}
                    </div>
                </td>
                <td class="text-right" style="font-size: 0.9em; opacity: 0.8;">${formatMoney(subAmt)}</td>
                <td style="font-size: 0.9em; opacity: 0.8;">${subPct}% da cat.</td>
            `;
            subcatRows.push(subTr);
        });
        
        tr.onclick = () => {
            const icon = tr.querySelector('.expand-icon');
            if (icon) {
                const isExpanded = icon.classList.contains('expanded');
                if (isExpanded) {
                    icon.classList.remove('expanded');
                    icon.innerText = '▶';
                    subcatRows.forEach(sr => sr.classList.add('collapsed'));
                } else {
                    icon.classList.add('expanded');
                    icon.innerText = '▼';
                    subcatRows.forEach(sr => sr.classList.remove('collapsed'));
                }
            }
        };
        
        els.incomeTableBody.appendChild(tr);
        subcatRows.forEach(sr => els.incomeTableBody.appendChild(sr));
    });
}

// Modal Logic
function openCategoryDetails(category, subcategory = null) {
    els.modalCategoryTitle.innerText = subcategory ? `Detalhes: ${category} - ${subcategory}` : `Detalhes: ${category}`;
    els.detailsTableBody.innerHTML = '';
    
    const filtered = state.data.filter(item => {
        if (item.cat !== category) return false;
        if (subcategory) {
            let itemSub = item.subcatOrig || 'Não classificado';
            if (itemSub === '-' || !itemSub) itemSub = 'Não classificado';
            return itemSub === subcategory;
        }
        return true;
    });
    
    if (filtered.length === 0) {
        els.detailsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center">Nenhuma transação encontrada.</td></tr>';
    } else {
        filtered.forEach(item => {
            const tr = document.createElement('tr');
            
            let dcStyle = item.dc === 'D' ? 'color: var(--danger)' : (item.dc === 'C' ? 'color: var(--success)' : '');
            
            tr.innerHTML = `
                <td>${item.dateStr}</td>
                <td>${item.desc}</td>
                <td class="text-right" style="${dcStyle}">${formatMoney(item.total)}</td>
                <td>${item.origem || '-'}</td>
                <td>${item.subcatOrig}</td>
                <td style="text-align: center; font-weight: bold; ${dcStyle}">${item.dc}</td>
                <td style="text-align: center;">${item.ie}</td>
            `;
            els.detailsTableBody.appendChild(tr);
        });
    }
    
    els.detailsModal.classList.add('active');
}

function closeCategoryDetails() {
    els.detailsModal.classList.remove('active');
}

function renderAnnualMatrix(matrixData) {
    els.matrixTableBody.innerHTML = '';
    
    const periods = state.view === 'historico' ? ['2022', '2023', '2024', '2025', '2026'] : 
                    ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const periodLabels = state.view === 'historico' ? periods : 
                         ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    // Header
    if (els.matrixTableHead) {
        let theadHtml = `<tr><th style="text-align: left; padding: 12px; border-bottom: 1px solid var(--glass-border);">Categoria</th>`;
        periodLabels.forEach(p => {
            theadHtml += `<th class="text-right" style="padding: 12px; border-bottom: 1px solid var(--glass-border);">${p}</th>`;
        });
        theadHtml += `<th class="text-right" style="padding: 12px; border-bottom: 1px solid var(--glass-border);">Total</th></tr>`;
        els.matrixTableHead.innerHTML = theadHtml;
    }
    
    const cats = Object.keys(matrixData).sort();
    if (cats.length === 0) {
        els.matrixTableBody.innerHTML = `<tr><td colspan="${periods.length + 2}" style="text-align:center">Sem dados.</td></tr>`;
        return;
    }
    
    cats.forEach(cat => {
        const catData = matrixData[cat];
        const subCatsKeys = Object.keys(catData.subcats).sort();
        const hasSubcats = subCatsKeys.length > 0;
        
        const tr = document.createElement('tr');
        tr.className = 'clickable-row cat-row';
        
        let rowHtml = `<td>
            <div class="category-name">
                ${hasSubcats ? '<span class="expand-icon">▶</span>' : '<span class="expand-icon" style="opacity:0">▶</span>'}
                <span>${cat}</span>
                <button class="details-icon-btn" title="Ver Detalhes" onclick="event.stopPropagation(); openCategoryDetails('${cat}')">🔍</button>
            </div>
        </td>`;
        
        periods.forEach(p => {
            let val = catData.periods[p] || 0;
            rowHtml += `<td class="text-right">${val > 0 ? formatMoney(val) : '-'}</td>`;
        });
        
        rowHtml += `<td class="text-right" style="font-weight:bold;">${formatMoney(catData.total)}</td>`;
        tr.innerHTML = rowHtml;
        
        const subcatRows = [];
        subCatsKeys.forEach(sub => {
            const subData = catData.subcats[sub];
            const subTr = document.createElement('tr');
            subTr.className = 'subcat-row collapsed';
            
            let subHtml = `<td style="padding-left: 36px;">
                <div class="category-name" style="font-size: 0.9em; opacity: 0.8;">
                    <button class="details-icon-btn" title="Ver Detalhes" onclick="event.stopPropagation(); openCategoryDetails('${cat}', '${sub}')">🔍</button>
                    ↳ ${sub}
                </div>
            </td>`;
            
            periods.forEach(p => {
                let val = subData.periods[p] || 0;
                subHtml += `<td class="text-right" style="font-size: 0.9em; opacity: 0.8;">${val > 0 ? formatMoney(val) : '-'}</td>`;
            });
            subHtml += `<td class="text-right" style="font-size: 0.9em; opacity: 0.8;">${formatMoney(subData.total)}</td>`;
            subTr.innerHTML = subHtml;
            subcatRows.push(subTr);
        });
        
        tr.onclick = () => {
            const icon = tr.querySelector('.expand-icon');
            if (icon) {
                const isExpanded = icon.classList.contains('expanded');
                if (isExpanded) {
                    icon.classList.remove('expanded');
                    icon.innerText = '▶';
                    subcatRows.forEach(sr => sr.classList.add('collapsed'));
                } else {
                    icon.classList.add('expanded');
                    icon.innerText = '▼';
                    subcatRows.forEach(sr => sr.classList.remove('collapsed'));
                }
            }
        };
        
        els.matrixTableBody.appendChild(tr);
        subcatRows.forEach(sr => els.matrixTableBody.appendChild(sr));
    });
}

function formatMoney(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// ==========================================
// UPLOAD & CLASSIFICATION LOGIC
// ==========================================
let uploadedFile = null;
let classificationResults = [];

// Allowed categories from SKILL.md
const allowedCategories = [
    'Academia', 'Alimentacao', 'Aplicacoes', 'Assinaturas', 'Bebidas', 'Carro',
    'Cartao de Credito', 'Combustivel', 'Custos fixos', 'Doacoes', 'Domesticos',
    'Educacao', 'Eletronicos', 'Estetica', 'Farmacia', 'Imoveis', 'Impostos',
    'Investimentos', 'Lazer', 'Mateus', 'Outros', 'Pagamento Cartao', 'Pessoais',
    'Pets', 'Presentes', 'Recebimentos', 'Reembolsos', 'Rendimentos', 'Resgates',
    'Restaurante', 'Salario', 'Saldo Inicial (Mes)', 'Salinense', 'Saques',
    'Saude', 'Servicos', 'Taxas', 'Transferencias', 'Transporte', 'Vestuario', 'Viagens'
];

// Mapping to enforce strict D/C and I/E based on Category
const categoryRules = {
    'Academia': { dc: 'D', ie: 'E' },
    'Alimentacao': { dc: 'D', ie: 'E' },
    'Aplicacoes': { dc: 'D', ie: 'I' },
    'Assinaturas': { dc: 'D', ie: 'E' },
    'Bebidas': { dc: 'D', ie: 'E' },
    'Carro': { dc: 'D', ie: 'E' },
    'Cartao de Credito': { dc: 'C', ie: 'I' },
    'Combustivel': { dc: 'D', ie: 'E' },
    'Custos fixos': { dc: 'D', ie: 'E' },
    'Doacoes': { dc: 'D', ie: 'E' },
    'Domesticos': { dc: 'D', ie: 'E' },
    'Educacao': { dc: 'D', ie: 'E' },
    'Eletronicos': { dc: 'D', ie: 'E' },
    'Estetica': { dc: 'D', ie: 'E' },
    'Farmacia': { dc: 'D', ie: 'E' },
    'Imoveis': { dc: 'D', ie: 'E' },
    'Impostos': { dc: 'D', ie: 'E' },
    'Investimentos': { dc: 'D', ie: 'I' },
    'Lazer': { dc: 'D', ie: 'E' },
    'Mateus': { dc: 'D', ie: 'E' },
    'Outros': { dc: 'D', ie: 'E' },
    'Pagamento Cartao': { dc: 'D', ie: 'I' },
    'Pessoais': { dc: 'D', ie: 'E' },
    'Pets': { dc: 'D', ie: 'E' },
    'Presentes': { dc: 'D', ie: 'E' },
    'Recebimentos': { dc: 'C', ie: 'E' },
    'Reembolsos': { dc: 'C', ie: 'E' },
    'Rendimentos': { dc: 'C', ie: 'E' },
    'Resgates': { dc: 'C', ie: 'I' },
    'Restaurante': { dc: 'D', ie: 'E' },
    'Salario': { dc: 'C', ie: 'E' },
    'Saldo Inicial (Mes)': { dc: 'C', ie: 'I' },
    'Salinense': { dc: 'D', ie: 'E' },
    'Saques': { dc: 'D', ie: 'E' },
    'Saude': { dc: 'D', ie: 'E' },
    'Servicos': { dc: 'D', ie: 'E' },
    'Taxas': { dc: 'D', ie: 'E' },
    'Transferencias': { dc: 'D', ie: 'E' },
    'Transporte': { dc: 'D', ie: 'E' },
    'Vestuario': { dc: 'D', ie: 'E' },
    'Viagens': { dc: 'D', ie: 'E' }
};

const allowedSubcategories = [
    'Supermercado',
    'Farmacia',
    'Restaurante',
    'Combustivel',
    'Servicos',
    'Pets',
    'Vestuario',
    'Impostos',
    'Investimentos',
    'Saude',
    'CasaEstoril',
    'ContaEnergia',
    'ContaInternet',
    'CondominioAptoJdAmerica',
    'LoteEstoril',
    'AptoJardimAmerica',
    'ReformaAptoJdAmerica',
    'MateusEscola',
    'MateusRoupas',
    'MateusSaude',
    'Aluguel'
];

if (els.dropZone) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        els.dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        els.dropZone.addEventListener(eventName, () => els.dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        els.dropZone.addEventListener(eventName, () => els.dropZone.classList.remove('dragover'), false);
    });

    els.dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }, false);

    els.browseBtn.addEventListener('click', () => els.fileInput.click());
    els.fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });
    
    els.clearUploadBtn.addEventListener('click', clearUpload);
    els.classifyBtn.addEventListener('click', startClassification);
    els.saveReviewBtn.addEventListener('click', saveToRepository);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleFiles(files) {
    if (files.length > 0) {
        uploadedFile = files[0];
        els.selectedFileName.innerText = `Arquivo selecionado: ${uploadedFile.name}`;
        els.classifyBtn.disabled = false;
    }
}

function clearUpload() {
    uploadedFile = null;
    els.selectedFileName.innerText = '';
    els.fileInput.value = '';
    els.classifyBtn.disabled = true;
    els.uploadLoading.style.display = 'none';
    populateUploadView();
}

function populateUploadView() {
    classificationResults = JSON.parse(JSON.stringify(state.data)); // Cópia profunda do estado atual (repositório local)
    if (classificationResults.length > 0) {
        els.reviewArea.style.display = 'block';
        renderReviewTable();
        els.saveReviewBtn.disabled = false; // Permite salvar mesmo sem upload (apenas correções manuais)
    } else {
        els.reviewArea.style.display = 'none';
        classificationResults = [];
    }
}

async function startClassification() {
    if (!uploadedFile) return;
    
    els.uploadLoading.style.display = 'flex';
    els.classifyBtn.disabled = true;
    els.reviewArea.style.display = 'none';
    els.uploadStatusText.innerText = 'Enviando arquivo para o servidor local...';
    
    const formData = new FormData();
    formData.append('file', uploadedFile);
    
    try {
        const response = await fetch('http://127.0.0.1:5000/api/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Erro no servidor');
        }
        
        const newResults = await response.json();
        
        // Merge & Desduplicação Inteligente
        newResults.forEach(newItem => {
            const exists = classificationResults.some(existing => 
                existing.dateStr === newItem.dateStr && 
                existing.desc === newItem.desc && 
                existing.total === newItem.total
            );
            if (!exists) {
                classificationResults.push(newItem);
            }
        });
        
        // Ordenação cronológica para facilitar revisão (pelo dia)
        classificationResults.sort((a, b) => {
            const dayA = parseInt(a.dateStr.split('/')[0]) || 0;
            const dayB = parseInt(b.dateStr.split('/')[0]) || 0;
            return dayA - dayB;
        });

        renderReviewTable();
        
    } catch (error) {
        alert(`Erro na classificação: ${error.message}`);
        els.classifyBtn.disabled = false;
    } finally {
        els.uploadLoading.style.display = 'none';
    }
}

function renderReviewTable() {
    els.reviewTableBody.innerHTML = '';
    
    classificationResults.forEach((item, index) => {
        const tr = document.createElement('tr');
        
        // Category Select
        let catOptions = allowedCategories.map(c => `<option value="${c}" ${item.cat === c ? 'selected' : ''}>${c}</option>`).join('');
        let subcatOptions = `<option value="">-</option>` + allowedSubcategories.map(c => `<option value="${c}" ${item.subcat === c ? 'selected' : ''}>${c}</option>`).join('');
        
        // Origin Select
        const allowedOrigins = ['Conta Conjunta', 'Cartao'];
        let originOptions = allowedOrigins.map(o => `<option value="${o}" ${item.origem === o ? 'selected' : ''}>${o}</option>`).join('');
        
        tr.innerHTML = `
            <td style="padding: 4px;">${item.dateStr}</td>
            <td style="padding: 4px;">${item.desc}</td>
            <td class="text-right" style="padding: 4px;">${formatMoney(item.total)}</td>
            <td>
                <select class="rev-select-origem" data-idx="${index}" style="width: 120px; background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); color: inherit; padding: 4px; border-radius: 4px;">
                    ${originOptions}
                </select>
            </td>
            <td>
                <select class="rev-select-cat" data-idx="${index}" style="width: 150px; background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); color: inherit; padding: 4px; border-radius: 4px;">
                    ${catOptions}
                </select>
            </td>
            <td>
                <select class="rev-select-subcat" data-idx="${index}" style="width: 150px; background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); color: inherit; padding: 4px; border-radius: 4px;">
                    ${subcatOptions}
                </select>
            </td>
            <!-- D/C and I/E kept in data model but hidden from UI for better UX -->
            <td style="text-align: center;">
                <button class="remove-row-btn" data-idx="${index}" style="background:transparent; border:none; color:var(--danger); cursor:pointer; font-size: 1.2rem;">&times;</button>
            </td>
        `;
        els.reviewTableBody.appendChild(tr);
    });
    
    // Add event listeners for dynamic updates
    document.querySelectorAll('.rev-input').forEach(el => {
        el.addEventListener('change', (e) => {
            const idx = e.target.getAttribute('data-idx');
            const field = e.target.getAttribute('data-field');
            let val = e.target.value;
            if (field === 'total') val = parseFloat(val) || 0;
            classificationResults[idx][field] = val;
        });
    });
    
    document.querySelectorAll('.rev-select-origem').forEach(el => {
        el.addEventListener('change', (e) => {
            const idx = e.target.getAttribute('data-idx');
            classificationResults[idx].origem = e.target.value;
        });
    });
    
    document.querySelectorAll('.rev-select-cat').forEach(el => {
        el.addEventListener('change', (e) => {
            const idx = e.target.getAttribute('data-idx');
            const newCat = e.target.value;
            classificationResults[idx].cat = newCat;
            
            // Enforce rules silently (data model only, not UI)
            if (categoryRules[newCat]) {
                classificationResults[idx].dc = categoryRules[newCat].dc;
                classificationResults[idx].ie = categoryRules[newCat].ie;
            }
        });
    });
    
    document.querySelectorAll('.rev-select-subcat').forEach(el => {
        el.addEventListener('change', (e) => {
            const idx = e.target.getAttribute('data-idx');
            classificationResults[idx].subcat = e.target.value;
        });
    });
    
    document.querySelectorAll('.remove-row-btn').forEach(el => {
        el.addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-idx'));
            classificationResults.splice(idx, 1);
            renderReviewTable(); // Re-render entirely
        });
    });
    
    els.reviewArea.style.display = 'block';
}

async function saveToRepository() {
    els.uploadLoading.style.display = 'flex';
    els.uploadStatusText.innerText = 'Salvando e publicando (pode levar alguns segundos)...';
    els.saveReviewBtn.disabled = true;
    
    try {
        const payload = {
            year: state.year,
            month: state.month,
            password: state.password, // Send password to encrypt the new TSV
            data: classificationResults
        };
        
        const response = await fetch('http://127.0.0.1:5000/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Erro ao salvar');
        }
        
        alert('Transações salvas e sincronizadas com sucesso! O Dashboard foi atualizado.');
        clearUpload();
        
        // Reload data and go back to monthly view
        changeView('mensal');
        
    } catch (error) {
        alert(`Erro ao salvar: ${error.message}`);
    } finally {
        els.uploadLoading.style.display = 'none';
        els.saveReviewBtn.disabled = false;
    }
}
