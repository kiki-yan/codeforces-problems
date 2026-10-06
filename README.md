# Codeforces Problems

一个轻量的 Codeforces 题库浏览器与个人刷题进度追踪工具，灵感来自 [AtCoder Problems (kenkoooo.com/atcoder)](https://kenkoooo.com/atcoder/)。

## ✨ 功能

- 📋 **全量题目浏览**：自动从 [Codeforces Public API](https://codeforces.com/apiHelp) 拉取所有题目（约 11000+ 题），包含题号、题目名、难度分（rating）、算法标签、来源比赛。
- 🎨 **难度配色**：按照 Codeforces 官方标准着色（800 灰 → 3000 深红），一眼判断题目难度。
- 🏷️ **标签筛选**：点击标签（如 `dp`、`graphs`、`greedy`）组合筛选题目。
- 🔍 **关键词搜索**：按题目名称或题号模糊搜索。
- 📊 **个人进度追踪**：输入你的 Codeforces 用户名，自动拉取你的全部提交记录：
  - 🟩 绿色行 = 已 AC
  - 🟨 黄色行 = 尝试过但未 AC
  - ⬜ 白色行 = 未做
- 📈 **统计面板**：总题数 / 已 AC / 尝试中 / 完成率。
- 💾 **本地缓存**：题目数据缓存 24 小时，二次打开秒开。

## 🚀 部署（GitHub Pages）

本项目是纯静态站点（HTML + CSS + 原生 JS），无需后端、无需数据库。

1. 把本仓库推到你的 GitHub。
2. 仓库 **Settings → Pages**。
3. **Source** 选择 `Deploy from a branch`，分支选 `main`，目录选 `/ (root)`。
4. 保存后等待 1 分钟，访问 `https://<你的用户名>.github.io/<仓库名>/`。

## 🛠️ 本地开发

```bash
cd codeforces-problems
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

> 注意：直接双击 `index.html` 用 `file://` 协议打开也能工作，但部分浏览器会限制 `localStorage` 或 fetch，建议用本地 HTTP 服务器。

## 📁 项目结构

```
codeforces-problems/
├── index.html        # 主页面
├── css/
│   └── style.css     # 样式（含 Codeforces 难度配色）
├── js/
│   └── app.js        # 核心逻辑：API 调用、筛选、渲染
└── README.md
```

## 📡 使用的 Codeforces API

| 端点 | 用途 |
| --- | --- |
| `/api/problemset.problems` | 拉取全量题目与 AC 统计 |
| `/api/user.status?handle=xxx` | 拉取指定用户的全部提交记录 |

## 📝 License

MIT
