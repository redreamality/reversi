# Reversi 站点（site/）

纯静态站点，没有构建步骤。现在的部署目标是 GitHub Pages 项目页 **https://redreamality.com/reversi/**（子路径 `/reversi/`）。站长的 GitHub 用户站绑了自定义域名 `redreamality.com`，GitHub 默认分配的地址会 301 跳到这里；canonical 等网址一律写 `redreamality.com`。把 `site/` 里的全部内容（包括 `.nojekyll`）放到 `redreamality/reversi` 仓库的发布目录即可。这个 README 不需要部署（放上去也没有影响）。

## 部署到 GitHub Pages（子路径）要注意的事

- **所有站内链接都是相对路径**（`./css/site.css`、首页是 `./`），JS 里的动态 import 和 Worker 用的是 `new URL(..., import.meta.url)`，所以在 `/reversi/` 下和以后换到域名根目录都能用。**不要再写 `href="/..."`**：在项目页上它会指到 `redreamality.com/` 根目录（那是用户站），整站 404。`tools/audit_site.py` 会根据首页 canonical 识别出子路径，把这种链接报成 `broken-link`。
- **404.html**：GitHub Pages 遇到任何不存在的路径（比如 `/reversi/a/b/c`）都会返回仓库里的 `404.html`。页面里相对链接的起点会变，所以 `404.html` 的 `<head>` 里有一行 `<base href="/reversi/">`。这一行由 `tools/apply_config.py` 根据 `base_url` 生成，不要手改。
- **`.nojekyll`**：空文件，让 GitHub Pages 跳过 Jekyll 处理，原样发布所有文件。
- **robots.txt 和 sitemap**：搜索引擎只读域名根目录的 `robots.txt`（`https://redreamality.com/robots.txt`，由站长的用户站（主页）仓库提供），**不会读 `/reversi/robots.txt`**。这个文件留着没有坏处，但里面的 `Sitemap:` 行不会生效。上线后请站长：① 在 Google Search Console（以及 Bing Webmaster Tools）里用已有的 `redreamality.com` 域名资源，或者新建网址前缀资源 `https://redreamality.com/reversi/`，手动提交 `https://redreamality.com/reversi/sitemap.xml`；② 可选：在用户站仓库的根 `robots.txt` 里加一行 `Sitemap: https://redreamality.com/reversi/sitemap.xml`，并确认那份 robots.txt 没有 `Disallow` 掉 `/reversi/`。

## 站点配置 `site.config.json`（项目根目录）

| 键 | 现在的值 | 作用 |
|---|---|---|
| `base_url` | `https://redreamality.com/reversi` | canonical、og:url/og:image、JSON-LD、`sitemap.xml`、`robots.txt`、`llms.txt` 里的网址，以及 404 页的 `<base>` |
| `contact_url` | `https://github.com/redreamality/reversi/issues` | 联系与版权投诉渠道（contact / dmca / privacy / terms / about 页和 `llms.txt`）。站长没有可以公开的邮箱，所以改用 GitHub Issues；页面上写明了 Issues 是公开的，提醒访客不要贴私人信息；dmca 页同时给了 GitHub 官方的 DMCA 投诉流程，那条路不会公开投诉人的信息 |
| `commentsEnabled` | `false` | 评论区开关，见下文 |
| `analyticsSnippet` | `""` | 统计代码，见下文 |

以后换域名（比如买了 `playreversi.com`），或者换联系渠道，用一条命令替换。它会改写 site/ 下的文件、更新 config，再自动跑一次 `apply_config.py`，可以重复运行：

```bash
cd <项目根目录>
uv run tools/set_domain.py --base-url https://playreversi.com --dry-run      # 先预览
uv run tools/set_domain.py --base-url https://playreversi.com                # 子路径也行：https://user.github.io/reversi
uv run tools/set_domain.py --contact-url https://github.com/you/repo/issues
```

改了 `commentsEnabled` 或 `analyticsSnippet` 之后运行 `uv run tools/apply_config.py` 让它生效。`analyticsSnippet` 非空时，隐私政策的 "Visit statistics" 段自动换成 Google Analytics 4 的说明（`tools/partials/privacy-analytics-on.html`），为空时换成"目前不用统计"（`-off.html`）。换别家统计服务时记得改 `-on` 片段。

替换后还要做：`sitemap.xml` 里的 `<lastmod>` 改成发布日期；隐私政策和服务条款里的 "Last updated" 日期按实际情况调整。

## 评论区（上线版关闭）

- **现在关着**（`commentsEnabled: false`）。没有后端时，评论只能存在访客自己浏览器的 `localStorage` 里，别人看不到，会误导访客。关着的时候首页不输出评论区，也不加载 `js/comments.js`；隐私政策里写的是"目前不收集评论"。
- 代码都还在：`js/comments.js`，以及评论区的 HTML 片段 `tools/partials/comments-section.html` 和 `tools/partials/comments-script.html`。首页里只留了 `<!-- comments:section -->` 和 `<!-- comments:script -->` 两对空标记，`apply_config.py` 按开关把片段填进去或者清空。
- **打开之前**：先接好后端（见下面的推荐方案），把 `comments.js` 里的 `store.load()` / `store.save()` 换成接口调用；再改隐私政策的 "What stays on your device" 段和服务条款的 "Comments" 段，写清会收集什么；然后才把 `commentsEnabled` 改成 `true` 并运行 `apply_config.py`。
- `comments.js` 在页面打开之后才生成表单和列表，页面源码里没有任何评论内容。
- 站长回复标记：本地预览时（主机名是 `localhost` / `127.0.0.1`）在网址后面加 `?owner-demo`，发的帖子和回复会带 "Site owner" 徽章。**在正式域名上这个开关完全不起作用**。接后端时把这个开关删掉，改成由服务端判断是不是站长。
- 表单旁边写着 "Messages here are saved on this device only for now."，接好后端后删掉这句。

### 推荐的评论后端（站长决策项，尚未实现）

推荐 **Cloudflare Workers（或 Pages Functions）+ D1**。GitHub Pages 只能放静态文件，跑不了接口，所以后端要单独部署：用一个 Worker 提供 `/api/comments`，并开 CORS 允许 `https://redreamality.com`；如果以后整站搬到 Cloudflare Pages，同一个项目里加 `functions/api/*.js` 就行。D1 是托管的 SQLite，免费额度对评论量足够，不需要自己维护服务器。备选方案是 Supabase（Postgres + 行级权限）。

D1 表结构（最小版）：

```sql
CREATE TABLE comments (
  id         TEXT PRIMARY KEY,           -- 随机 id
  page       TEXT NOT NULL,              -- 例如 "/"
  parent_id  TEXT REFERENCES comments(id), -- 回复时填被回复的评论；只支持一层
  name       TEXT NOT NULL,              -- 最长 40
  body       TEXT NOT NULL,              -- 最长 1000，原样存，前端按纯文本显示
  is_owner   INTEGER NOT NULL DEFAULT 0, -- 只由服务端根据鉴权结果写入
  hidden     INTEGER NOT NULL DEFAULT 0, -- 隐藏而不是删除
  ip_hash    TEXT,                       -- 加盐哈希，只用于限流
  created_at INTEGER NOT NULL
);
CREATE INDEX comments_page ON comments(page, created_at);
```

接口（全部返回 JSON，响应头加 `X-Robots-Tag: noindex`，`robots.txt` 加 `Disallow: /api/`）：

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/api/comments?page=/` | 列出未隐藏的评论，最新的在前，每条带 `replies`（旧的在前） |
| POST | `/api/comments` | 发评论：`{page, name, body}`；回复再加 `parentId`。服务端校验长度、按 `ip_hash` 限流（例如每分钟 3 条），可选 Cloudflare Turnstile 人机验证 |
| POST | `/api/comments/:id/hide` | 隐藏或恢复（`{hidden: true/false}`），只有站长能调 |

站长鉴权：最简单的做法是用 Cloudflare Access 保护 `/admin/*` 和 `/api/comments/*/hide`，站长通过邮箱一次性验证码登录；Function 读到 Access 的身份头才把 `is_owner` 设为 1。另一种做法是把一个长随机 token 存在 Pages 的环境变量里，站长在后台页输入后放进 `Authorization` 头。不管用哪种，前端都不能自己说"我是站长"。

前端改动：把 `js/comments.js` 里的 `store.load()` / `store.save()` 换成上面的 fetch 调用，删掉 `?owner-demo` 开关，徽章改用接口返回的 `is_owner`。

## 点赞

只在本机记录（`localStorage` 键名 `reversi:liked`）。按钮上只显示 "Like" 或 "Liked"（心形会填满），表示"你点过没有"，不显示数字，因为现在还没有全站总数。以后如果要显示全站点赞数，也要接后端，从 0 开始真实累计。

## 统计（站长需要提供一段代码）

1. 选一家统计服务，把它给的 `<script>` 代码原样填进项目根目录 `site.config.json` 的 `analyticsSnippet`（JSON 字符串，里面的 `"` 要写成 `\"`）：
   - **Cloudflare Web Analytics**：需要站点 token（`data-cf-beacon='{"token": "..."}'` 那一行）。免费，不用 cookie；但它不支持自定义事件，漏斗事件收不到。
   - **Plausible**：需要在 Plausible 里登记的域名，代码形如 `<script defer data-domain="你的域名" src="https://plausible.io/js/script.js"></script>`。
   - **GA4**：需要测量 ID（`G-XXXXXXX`），用 Google 给的 gtag 代码。用了 GA4，隐私政策里要写明。
2. 运行 `uv run tools/apply_config.py`，它会把代码插进每个页面的 `</head>` 前面（用 `<!-- analytics -->` 包起来，可以重复运行）。`analyticsSnippet` 为空时不插入任何东西，原来插过的也会被删掉。
3. 漏斗事件：页面会调用 `window.trackEvent?.(name)`，没有统计时什么也不做。事件有 `play_start`（点了 Play）、`played_60s`（棋盘出现 60 秒后页面仍在前台）、`fullscreen`（进入全屏）。要收这些事件，在同一段 snippet 里定义 `trackEvent`，例如：
   - Plausible：`<script>window.trackEvent=function(n){window.plausible&&window.plausible(n)}</script>`
   - GA4：`<script>window.trackEvent=function(n){window.gtag&&window.gtag('event',n)}</script>`

## 广告

页面里没有预留广告位。AdSense 自动广告代码由站长加在每个页面的 `<head>` 里（可以和统计代码一起放进 `analyticsSnippet`，或者单独手动加）。广告不要放进游戏区域（`#play`）。

## 目录

```
index.html            首页（游戏 + 正文 + FAQ + 评论）
about.html            关于 + UCThello MIT 许可证全文
privacy.html terms.html contact.html dmca.html 404.html
css/site.css          全站样式（不引入外部字体或 CDN）
js/app.js             首页外壳：封面 → 加载动画 → 棋盘；点赞 / 分享 / 全屏
js/reversi.js         棋盘界面，点击 Play 后才动态 import
js/engine/            UCThello 引擎原文件（MIT），在 Web Worker 里运行，没有改动
js/comments.js        评论区（演示用，见上文）
img/                  我们自己界面的截图（WebP；PNG 只给 og:image 用）
licenses/UCThello-LICENSE.txt
favicon.svg sitemap.xml robots.txt llms.txt
```

## 本地预览

ES module 和 Worker 不能用 `file://` 打开，要用 http 服务：

```bash
cd ../e2e && node server.mjs 4173    # 然后打开 http://127.0.0.1:4173/reversi/（和线上一样挂在子路径下）
```

## 图片许可

UCThello 仓库 `img/` 下的图片是 CC BY-NC-SA（禁止商用），**本站一张都没有用**。棋盘、棋子、封面、加载动画都是 CSS/SVG 自己画的，截图来自本站自己的界面：`cd e2e && node shots.mjs` 生成 PNG，再 `uv run tools/screens_to_webp.py site/img` 转成 WebP。

## 检查

```bash
uv run tools/audit_site.py site --keyword "reversi"
cd e2e && pnpm exec playwright test
```
