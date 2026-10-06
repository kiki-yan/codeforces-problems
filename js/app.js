/* =========================================================
 * Codeforces Problems — 静态题库 + 个人进度追踪
 * 数据来源: https://codeforces.com/api/
 * ========================================================= */

const API = {
  problemset: 'https://codeforces.com/api/problemset.problems',
  userStatus: 'https://codeforces.com/api/user.status',
};

const CACHE_KEY = 'cf_problems_cache_v1';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
const PAGE_SIZE = 300; // 单次渲染行数，避免 DOM 卡顿

/* ---------- State ---------- */
let allProblems = [];        // 全量题目
let allTags = new Set();      // 全部标签
let acSet = new Set();        // 已 AC 的 key
let triedSet = new Set();     // 尝试过但未 AC 的 key
let currentHandle = '';
let activeTags = new Set();
let renderedCount = 0;

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const statusBar = $('status-bar');
const tbody = $('problems-body');

/* ---------- Utils ---------- */
const problemKey = (p) => `${p.contestId}-${p.index}`;
const cfProblemUrl = (p) => `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`;
const cfContestUrl = (p) => `https://codeforces.com/contest/${p.contestId}`;

function setStatus(msg, isError = false) {
  statusBar.textContent = msg;
  statusBar.classList.toggle('error', isError);
  statusBar.style.display = msg ? 'block' : 'none';
}

/* 根据 rating 返回对应的 CSS class */
function ratingClass(rating) {
  if (!rating) return 'rating-none';
  const bucket = Math.floor(rating / 100) * 100;
  return `r-${Math.min(bucket, 3000)}`;
}

/* ---------- 数据加载 ---------- */
async function loadProblems() {
  // 1) 尝试读缓存
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { ts, problems } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL && Array.isArray(problems) && problems.length > 0) {
        console.log(`[cache] hit, ${problems.length} problems`);
        return problems;
      }
    }
  } catch (e) { /* 缓存损坏就忽略 */ }

  // 2) 调 API
  setStatus('正在从 Codeforces API 拉取题目列表（约 1 万+ 题，首次加载需要几秒）…');
  const resp = await fetch(API.problemset);
  const data = await resp.json();
  if (data.status !== 'OK') throw new Error(data.comment || 'API 返回错误');
  // 合并 problemStatistics（AC 数等）到 problems 上
  const stats = new Map();
  (data.result.problemStatistics || []).forEach(s => {
    stats.set(`${s.contestId}-${s.index}`, s);
  });
  const problems = data.result.problems.map(p => {
    const s = stats.get(`${p.contestId}-${p.index}`) || {};
    return { ...p, solvedCount: s.solvedCount || 0 };
  });
  localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), problems }));
  return problems;
}

async function loadUserStatus(handle) {
  setStatus(`正在拉取用户 ${handle} 的提交记录…`);
  const resp = await fetch(`${API.userStatus}?handle=${encodeURIComponent(handle)}`);
  const data = await resp.json();
  if (data.status !== 'OK') throw new Error(data.comment || '用户不存在或 API 错误');

  const ac = new Set();
  const tried = new Set();
  for (const sub of data.result) {
    if (!sub.problem) continue;
    const key = `${sub.problem.contestId}-${sub.problem.index}`;
    if (sub.verdict === 'OK') ac.add(key);
    else if (!ac.has(key)) tried.add(key); // 已经 AC 的题不算 tried
  }
  // tried 里去掉其实已 AC 的
  tried.forEach(k => { if (ac.has(k)) tried.delete(k); });
  return { ac, tried };
}

/* ---------- 初始化下拉框 ---------- */
function initRatingSelectors() {
  const ratings = [0, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600,
                   1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500, 2600, 3000, 3500];
  const minSel = $('min-rating');
  const maxSel = $('max-rating');
  ratings.forEach(r => {
    minSel.insertAdjacentHTML('beforeend',
      `<option value="${r}">${r === 0 ? '最低难度: 不限' : `${r}+`}</option>`);
    maxSel.insertAdjacentHTML('beforeend',
      `<option value="${r}">${r === 0 ? '最高难度: 不限' : `≤ ${r}`}</option>`);
  });
  maxSel.value = 5000; // 重新设置"不限"
  maxSel.insertAdjacentHTML('beforeend', '<option value="5000" selected>最高难度: 不限</option>');
}

function renderTags() {
  const list = [...allTags].sort();
  $('tags-list').innerHTML = list.map(t =>
    `<span class="tag-chip" data-tag="${t}">${t}</span>`
  ).join('');
  document.querySelectorAll('.tag-chip').forEach(el => {
    el.addEventListener('click', () => {
      const t = el.dataset.tag;
      if (activeTags.has(t)) { activeTags.delete(t); el.classList.remove('active'); }
      else { activeTags.add(t); el.classList.add('active'); }
      rerender();
    });
  });
}

/* ---------- 过滤 + 排序 ---------- */
function getFiltered() {
  const kw = $('search-input').value.trim().toLowerCase();
  const minR = parseInt($('min-rating').value, 10) || 0;
  const maxR = parseInt($('max-rating').value, 10) || 5000;
  const statusF = $('status-filter').value;
  const sortBy = $('sort-by').value;

  let list = allProblems.filter(p => {
    const key = problemKey(p);
    // 状态过滤
    if (statusF === 'ac' && !acSet.has(key)) return false;
    if (statusF === 'tried' && !triedSet.has(key)) return false;
    if (statusF === 'unsolved' && (acSet.has(key) || triedSet.has(key))) return false;
    // 难度
    const r = p.rating || 0;
    if (r < minR) return false;
    if (r > maxR) return false;
    // 标签
    if (activeTags.size > 0) {
      const tags = p.tags || [];
      for (const t of activeTags) if (!tags.includes(t)) return false;
    }
    // 关键词
    if (kw) {
      const hay = `${p.contestId}${p.index} ${p.name}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });

  // 排序
  const cmp = {
    'rating-asc':  (a, b) => (a.rating||0) - (b.rating||0) || a.contestId - b.contestId,
    'rating-desc': (a, b) => (b.rating||0) - (a.rating||0) || a.contestId - b.contestId,
    'contest-desc':(a, b) => b.contestId - a.contestId || a.index.localeCompare(b.index),
    'contest-asc': (a, b) => a.contestId - b.contestId || a.index.localeCompare(b.index),
    'name':        (a, b) => a.name.localeCompare(b.name),
  }[sortBy];
  list.sort(cmp);
  return list;
}

/* ---------- 渲染表格 ---------- */
function rowStatus(p) {
  const key = problemKey(p);
  if (acSet.has(key)) return { cls: 'row-ac', dot: '✅' };
  if (triedSet.has(key)) return { cls: 'row-tried', dot: '🟡' };
  return { cls: 'row-unsolved', dot: '' };
}

function renderTable(list) {
  renderedCount = Math.min(list.length, PAGE_SIZE);
  const slice = list.slice(0, renderedCount);
  if (slice.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="center muted">没有符合条件的题目</td></tr>';
    return;
  }
  tbody.innerHTML = slice.map(p => {
    const { cls, dot } = rowStatus(p);
    const rCls = ratingClass(p.rating);
    const ratingTxt = p.rating ? p.rating : '—';
    const tags = (p.tags || []).map(t =>
      `<span class="mini-tag" data-tag="${t}">${t}</span>`).join('');
    return `<tr class="${cls}">
      <td class="col-status status-dot">${dot}</td>
      <td class="col-id">${p.contestId}${p.index}</td>
      <td class="col-name problem-name">
        <a href="${cfProblemUrl(p)}" target="_blank" rel="noopener">${escapeHtml(p.name)}</a>
        ${p.solvedCount ? `<span class="muted" style="font-size:11px"> · ${p.solvedCount}人AC</span>` : ''}
      </td>
      <td class="col-rating ${rCls}">${ratingTxt}</td>
      <td class="col-tags">${tags}</td>
      <td class="col-contest"><a href="${cfContestUrl(p)}" target="_blank" rel="noopener">比赛 ${p.contestId}</a></td>
    </tr>`;
  }).join('') + (list.length > PAGE_SIZE
    ? `<tr><td colspan="6" class="center muted">仅显示前 ${PAGE_SIZE} 条 / 共 ${list.length} 条，请缩小筛选范围…</td></tr>`
    : '');

  // 行内 mini-tag 点击也触发筛选
  tbody.querySelectorAll('.mini-tag').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      const t = el.dataset.tag;
      if (!activeTags.has(t)) {
        activeTags.add(t);
        document.querySelectorAll('.tag-chip').forEach(c => {
          if (c.dataset.tag === t) c.classList.add('active');
        });
        rerender();
      }
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

/* ---------- 统计 ---------- */
function renderStats() {
  $('stats-bar').hidden = false;
  $('stat-total').textContent = allProblems.length;
  $('stat-ac').textContent = acSet.size;
  $('stat-tried').textContent = triedSet.size;
  $('stat-rate').textContent = allProblems.length
    ? `${((acSet.size / allProblems.length) * 100).toFixed(1)}%` : '0%';
}

/* ---------- 重渲染入口 ---------- */
function rerender() {
  const list = getFiltered();
  renderTable(list);
}

/* ---------- 事件绑定 ---------- */
function bindEvents() {
  $('load-user-btn').addEventListener('click', onLoadUser);
  $('handle-input').addEventListener('keydown', e => { if (e.key === 'Enter') onLoadUser(); });
  $('reset-btn').addEventListener('click', () => {
    acSet.clear(); triedSet.clear(); currentHandle = '';
    $('handle-input').value = '';
    $('stats-bar').hidden = true;
    setStatus('已清除用户数据。');
    rerender();
  });
  ['search-input','min-rating','max-rating','sort-by','status-filter'].forEach(id => {
    $(id).addEventListener('input', rerender);
    $(id).addEventListener('change', rerender);
  });
}

async function onLoadUser() {
  const handle = $('handle-input').value.trim();
  if (!handle) { setStatus('请输入 Codeforces 用户名', true); return; }
  try {
    const { ac, tried } = await loadUserStatus(handle);
    acSet = ac; triedSet = tried; currentHandle = handle;
    setStatus(`✅ 已加载 ${handle} 的进度：AC ${ac.size} 题，尝试 ${tried.size} 题。`);
    renderStats();
    rerender();
  } catch (e) {
    setStatus('❌ 加载失败：' + e.message, true);
  }
}

/* ---------- 启动 ---------- */
(async function init() {
  bindEvents();
  initRatingSelectors();
  try {
    allProblems = await loadProblems();
    allProblems.forEach(p => (p.tags || []).forEach(t => allTags.add(t)));
    renderTags();
    renderStats();
    setStatus('');
    rerender();
  } catch (e) {
    setStatus('❌ 题目数据加载失败：' + e.message, true);
    tbody.innerHTML = '<tr><td colspan="6" class="center muted">加载失败，请刷新重试</td></tr>';
  }
})();
