const CACHE_KEY = "cf_problems_cache";
const CACHE_TTL = 24 * 60 * 60 * 1000;
let allProblems = [];
let userSolved = new Set();
let userTried = new Set();
let sortKey = "id";
let sortDir = 1;

// Tab切换
document.querySelectorAll(".tab").forEach(tab=>{
  tab.onclick = ()=>{
    document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
    tab.classList.add("active");
    const target = tab.dataset.tab;
    document.querySelectorAll(".tab-content").forEach(c=>c.classList.remove("active"));
    document.getElementById(`tab-${target}`).classList.add("active");
  }
})

// 加载题目
async function loadProblems() {
  const cache = localStorage.getItem(CACHE_KEY);
  if(cache) {
    const parsed = JSON.parse(cache);
    if(Date.now() - parsed.time < CACHE_TTL) {
      allProblems = parsed.data;
      renderTable();
      return;
    }
  }
  const res = await fetch("https://codeforces.com/api/problemset.problems");
  const json = await res.json();
  allProblems = json.result.problems.map(p=>({
    id: `${p.contestId}${p.index}`,
    contestId: p.contestId,
    index: p.index,
    name: p.name,
    contest: p.contestId,
    diff: p.rating || 0,
    tags: p.tags,
    url: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`
  }));
  localStorage.setItem(CACHE_KEY, JSON.stringify({time:Date.now(), data:allProblems}));
  renderTable();
}

// 加载用户提交
document.getElementById("loadUserBtn").onclick = async ()=>{
  const handle = document.getElementById("handleInput").value.trim();
  if(!handle) return;
  userSolved.clear();
  userTried.clear();
  const resp = await fetch(`https://codeforces.com/api/user.status?handle=${handle}`);
  const data = await resp.json();
  for(const sub of data.result) {
    const pid = `${sub.problem.contestId}${sub.problem.index}`;
    if(sub.verdict === "OK") {
      userSolved.add(pid);
    } else {
      if(!userSolved.has(pid)) userTried.add(pid);
    }
  }
  updateStats();
  renderTable();
}

function updateStats() {
  let ac = 0, tried=0, untried=0;
  const filtered = getFilteredList();
  for(const p of filtered) {
    const pid = p.id;
    if(userSolved.has(pid)) ac++;
    else if(userTried.has(pid)) tried++;
    else untried++;
  }
  document.getElementById("statAc").textContent = ac;
  document.getElementById("statTried").textContent = tried;
  document.getElementById("statUntried").textContent = untried;
  const total = ac + tried + untried;
  const rate = total ? (ac / total)*100 : 0;
  document.getElementById("progressFill").style.width = rate + "%";
}

// 筛选+难度滑块
function getFilteredList() {
  const filter = document.getElementById("filterInput").value.toLowerCase();
  const minDiff = Number(document.getElementById("diffMin").value);
  const maxDiff = Number(document.getElementById("diffMax").value);
  return allProblems.filter(p=>{
    if(p.diff < minDiff || p.diff > maxDiff) return false;
    if(!filter) return true;
    const text = `${p.id} ${p.name} ${p.tags.join(" ")}`.toLowerCase();
    return text.includes(filter);
  })
}

// 排序
document.querySelectorAll("th[data-sort]").forEach(th=>{
  th.onclick = ()=>{
    const key = th.dataset.sort;
    if(sortKey === key) sortDir *= -1;
    else {sortKey = key; sortDir=1;}
    renderTable();
  }
})

function renderTable() {
  const tbody = document.getElementById("tableBody");
  let list = getFilteredList();
  list.sort((a,b)=>{
    let va = a[sortKey], vb = b[sortKey];
    if(typeof va === "number") return (va - vb)*sortDir;
    return va.localeCompare(vb)*sortDir;
  })
  tbody.innerHTML = "";
  for(const p of list) {
    const pid = p.id;
    let cls = "";
    if(userSolved.has(pid)) cls = "row-ac";
    else if(userTried.has(pid)) cls = "row-tried";
    const tr = document.createElement("tr");
    tr.className = cls;
    tr.innerHTML = `
      <td><a target="_blank" href="${p.url}">${p.id}</a></td>
      <td>${p.name}</td>
      <td>${p.contest}</td>
      <td><span class="diff diff-${p.diff || 0}">${p.diff || "-"}</span></td>
      <td>${p.tags.map(t=>`<span class="tag">${t}</span>`).join("")}</td>
    `
    tbody.appendChild(tr);
  }
  updateStats();
}

// 滑块联动
const minSlider = document.getElementById("diffMin");
const maxSlider = document.getElementById("diffMax");
function updateDiffText() {
  document.getElementById("diffRangeText").textContent = `${minSlider.value} ~ ${maxSlider.value}`;
  renderTable();
}
minSlider.oninput = updateDiffText;
maxSlider.oninput = updateDiffText;
document.getElementById("filterInput").oninput = renderTable;

// 初始化
loadProblems();
