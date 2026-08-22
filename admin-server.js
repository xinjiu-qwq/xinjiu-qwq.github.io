#!/usr/bin/env node
/* ============================================================================
 * admin-server.js —— 博客本地管理服务
 * ----------------------------------------------------------------------------
 * 作用:运行一个本地 HTTP 服务:
 *   1. 静态文件服务(admin.html / index.html / style.css / articles/ 等)
 *   2. REST API:读 / 增 / 改 / 删 data/articles.json 里的文章
 *   3. 保存时自动重新生成网站
 *      - articles/XX.html   每篇文章页面
 *      - articles/index.html 文章列表页
 *      - index.html         首页文章卡片(自动同步最新 3 篇)
 *   4. git 提交并推送到远端(GitHub Pages 自动重新构建)
 *
 * 启动:node admin-server.js        → http://localhost:3000/admin.html
 *        PORT=5173 node admin-server.js → 指定端口
 * 依赖:仅 Node 内置模块 + 系统 git(无第三方包)。
 * ========================================================================== */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'articles.json');
const ARTICLES_DIR = path.join(ROOT, 'articles');
const PORT = parseInt(process.env.PORT, 10) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/* ============================================================================
 * 工具
 * ========================================================================== */

/** 执行命令,返回 Promise<{code, stdout, stderr}> */
function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd: ROOT, timeout: 120000 }, (err, stdout, stderr) => {
      resolve({ code: err ? err.code || 1 : 0, stdout, stderr });
    });
  });
}

/** 读取文章数据 */
function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return { site: { title: '我的博客' }, articles: [] };
  }
}

/** 写入文章数据 */
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** HTML 转义 */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 数字补零 */
const pad = (n) => String(n).padStart(2, '0');

/** 生成稳定无歧义的 id:拉丁/数字保留;纯中文或混排时用短哈希+时间戳,
 * 避免中文经 shell/文件系统时产生乱码 */
function slugify(title) {
  const t = String(title || '').trim();
  // 纯拉丁/数字:转小写连字符
  const latin = t
    .toLowerCase()
    .replace(/[a-z0-9]+/g, function (m) { return m; }) // 保留
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (latin.length >= 3) return latin;
  // 含中文等不可安全转拼音的字符 → 稳定短哈希 + 时间戳
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return 'art-' + h.toString(16).padStart(8, '0') + '-' + String(Date.now()).slice(-4);
}

/** 相对日期 YYYY-MM-DD -> 中文显示 */
function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${y}年${pad(m)}月${pad(d)}日`;
}

/* ============================================================================
 * Markdown 简易渲染器
 * 支持:#/##/### 标题、**粗体**、`行内码`、> 引用、- / 1. 列表、
 *       ``` 代码块、--- 分隔线、空行段落。其余按文本输出。
 * ========================================================================== */
function renderMd(src) {
  if (!src) return '<p></p>';
  const lines = String(src).split(/\r?\n/);
  const out = [];
  let inCode = null;     // null=不在代码块
  let list = null;       // 'ul' | 'ol'

  const closeList = () => {
    if (list) { out.push('</' + list + '>'); list = null; }
  };

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];

    // 代码块开关
    if (/^```/.test(ln)) {
      if (inCode !== null) {
        out.push('</code></pre></div>');
        inCode = null;
      } else {
        closeList();
        inCode = ln.replace(/^```\s*/, '') || '';
        out.push('<div class="code-wrap"><pre><code>');
      }
      continue;
    }
    // 代码块内
    if (inCode !== null) { out.push(esc(ln)); continue; }

    // 空行
    if (/^\s*$/.test(ln)) { closeList(); continue; }

    // 标题
    const h = ln.match(/^(#{1,3})\s+(.*)$/);
    if (h) { closeList(); const lv = h[1].length; out.push('<h' + lv + '>' + inline(h[2]) + '</h' + lv + '>'); continue; }

    // 引用
    if (/^>\s?/.test(ln)) { closeList(); out.push('<blockquote><p>' + inline(ln.replace(/^>\s?/, '')) + '</p></blockquote>'); continue; }

    // 无序列表
    const ul = ln.match(/^[-*]\s+(.*)$/);
    if (ul) { if (list !== 'ul') { closeList(); list = 'ul'; out.push('<ul>'); } out.push('<li>' + inline(ul[1]) + '</li>'); continue; }

    // 有序列表
    const ol = ln.match(/^\d+[.)]\s+(.*)$/);
    if (ol) { if (list !== 'ol') { closeList(); list = 'ol'; out.push('<ol>'); } out.push('<li>' + inline(ol[1]) + '</li>'); continue; }

    // 分隔线
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(ln)) { closeList(); out.push('<hr>'); continue; }

    // 普通段落
    closeList();
    out.push('<p>' + inline(ln) + '</p>');
  }
  closeList();
  if (inCode !== null) out.push('</code></pre></div>');
  return out.join('\n');
}

/** 行内格式:粗体 / 行内码 */
function inline(s) {
  const t = esc(s);
  // 行内码
  return t
    .replace(/`([^`]+)`/g, function (_, c) { return '<code>' + c + '</code>'; })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/* ============================================================================
 * 2. 站点生成
 *    - articlePageHtml(a, all) : 生成单篇文章页
 *    - renderArticleIndex(all) : 生成文章列表页
 *    - syncHome(articles)      : 重写首页 index.html 的文章卡片区
 * ========================================================================== */

const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='24' fill='%23A450A2'/%3E%3Ctext x='50' y='70' font-size='58' text-anchor='middle' fill='white' font-family='sans-serif'%3E%E6%AD%86%3C/text%3E%3C/svg%3E";

/** 生成单篇文章页 HTML */
function articlePageHtml(a, all) {
    const idx = all.findIndex(function (x) { return x.id === a.id; });
    const prev = idx > 0 ? all[idx - 1] : null;
    const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;

    const tags = (a.tags || []).map(function (t) { return '<span class="chip chip--assist">' + esc(t) + '</span>'; }).join('\n      ');

    const prevBlock = prev
        ? '<span class="article-foot__label">← 上一篇</span><a class="article-foot__link" href="' + esc(prev.id) + '.html">' + esc(prev.title) + '</a>'
        : '<span class="article-foot__label">← 上一篇</span><span class="article-foot__link article-foot__link--disabled">没有更早的文章了</span>';
    const nextBlock = next
        ? '<span class="article-foot__label">下一篇 →</span><a class="article-foot__link" href="' + esc(next.id) + '.html">' + esc(next.title) + '</a>'
        : '<span class="article-foot__label">下一篇 →</span><span class="article-foot__link article-foot__link--disabled">没有更新的文章了</span>';

    const head = ''
        + '<!DOCTYPE html>\n<html lang="zh-CN" data-theme="light">\n<head>\n'
        + '    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        + '    <title>' + esc(a.title) + ' - 歆九的博客</title>\n'
        + '    <meta name="description" content="' + esc(a.excerpt || '') + '">\n'
        + '    <meta name="theme-color" content="#A450A2">\n'
        + '    <link rel="icon" href="' + FAVICON + '">\n'
        + '    <link rel="preconnect" href="https://fonts.googleapis.com">\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        + '    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">\n'
        + '    <link rel="stylesheet" href="../style.css">\n    <link rel="stylesheet" href="../article.css">\n</head>\n<body>\n';

    const bar = ''
        + '    <header class="app-bar" id="appBar">\n        <div class="app-bar__inner">\n'
        + '            <a class="app-bar__brand" href="/"><span class="brand-icon">歆</span><span class="brand-title">歆九的博客</span></a>\n'
        + '            <nav class="app-bar__nav" id="navLinks">\n'
        + '                <a href="/" class="nav-link ripple">首页</a>\n                <a href="/#about" class="nav-link ripple">关于</a>\n'
        + '                <a href="/articles/" class="nav-link ripple active">文章</a>\n            </nav>\n'
        + '            <div class="app-bar__actions"><button class="icon-btn ripple" id="themeBtn" aria-label="切换明暗主题" data-ripple="on-surface-variant">🌙</button></div>\n'
        + '        </div>\n    </header>\n\n';

    const body = ''
        + '    <main>\n        <article class="article-page">\n            <div class="article-card--page reveal">\n'
        + '                <header class="article-head">\n                    <div class="article-head__tags">\n      ' + tags + '\n                    </div>\n'
        + '                    <h1 class="article-head__title">' + esc(a.title) + '</h1>\n'
        + '                    <div class="article-head__meta">\n'
        + '                        <span>@DATE@</span>\n                        <span>阅读 @MIN@ 分钟</span>\n'
        + '                    </div>\n                </header>\n'
        + '                <div class="article-body">\n@BODY@\n                </div>\n'
        + '                <footer class="article-foot">\n'
        + '                    <div class="article-foot__nav">' + prevBlock + '</div>\n'
        + '                    <div class="article-foot__nav" style="text-align:right">' + nextBlock + '</div>\n'
        + '                </footer>\n'
        + '                <div class="article-foot__home"><a href="/" class="btn btn--filled ripple" data-ripple="on-primary">🏠 返回首页</a></div>\n'
        + '            </div>\n        </article>\n    </main>\n\n';

    const foot = ''
        + '    <button class="fab ripple" id="fab" aria-label="回到顶部" data-ripple="on-primary-container"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/></svg></button>\n'
        + '    <footer class="footer"><p class="footer-text">© <span id="year">2026</span> 歆九的博客 · Crafted with 💙 and Material You</p></footer>\n'
        + '    <script src="../vendor/mcu-core.js"></script>\n    <script src="../script.js"></script>\n</body>\n</html>\n';

    let page = head + bar + body + foot;
    page = page.replace('@DATE@', formatDate(a.date));
    page = page.replace('@MIN@', esc(String(a.read_minutes || 0)));
    page = page.replace('@BODY@', renderMd(a.body));
    return page;
}

/** 生成单张首页/列表卡片 */
function cardHtml(a) {
    const tags = (a.tags || []).map(function (t) { return '<span class="chip chip--assist">' + esc(t) + '</span>'; }).join('\n      ');
    return ''
        + '                <article class="article-card elevated-card reveal">\n'
        + '                    <div class="card-tags">\n      ' + tags + '\n                    </div>\n'
        + '                    <h3 class="card-title">' + esc(a.title) + '</h3>\n'
        + '                    <p class="card-excerpt">' + esc(a.excerpt || '') + '</p>\n'
        + '                    <div class="card-meta">\n'
        + '                        <span class="meta-date">' + formatDate(a.date) + '</span>\n'
        + '                        <span class="meta-read"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg> 阅读 ' + esc(String(a.read_minutes || 0)) + ' 分钟</span>\n'
        + '                    </div>\n'
        + '                    <a href="/articles/' + esc(a.id) + '.html" class="text-btn text-btn--small ripple" data-ripple="primary">阅读全文\n'
        + '                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>\n'
        + '                    </a>\n'
        + '                </article>';
}

/** 生成所有文章卡片(用于列表页) */
function allCards(articles) {
    return articles.map(cardHtml).join('\n');
}

/** 生成首页最新 N 篇卡片 */
function homeCards(articles, n) {
    return articles.slice(0, n).map(cardHtml).join('\n');
}

/** 生成文章列表页 articles/index.html */
function renderArticleIndex(articles) {
    return ''
        + '<!DOCTYPE html>\n<html lang="zh-CN" data-theme="light">\n<head>\n'
        + '    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        + '    <title>全部文章 - 歆九的博客</title>\n'
        + '    <meta name="theme-color" content="#A450A2">\n'
        + '    <link rel="icon" href="' + FAVICON + '">\n'
        + '    <link rel="preconnect" href="https://fonts.googleapis.com">\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        + '    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">\n'
        + '    <link rel="stylesheet" href="../style.css">\n    <link rel="stylesheet" href="../article.css">\n</head>\n<body>\n'
        + '    <header class="app-bar" id="appBar">\n        <div class="app-bar__inner">\n'
        + '            <a class="app-bar__brand" href="/"><span class="brand-icon">歆</span><span class="brand-title">歆九的博客</span></a>\n'
        + '            <nav class="app-bar__nav" id="navLinks">\n'
        + '                <a href="/" class="nav-link ripple">首页</a>\n                <a href="/#about" class="nav-link ripple">关于</a>\n'
        + '                <a href="/articles/" class="nav-link ripple active">文章</a>\n            </nav>\n'
        + '            <div class="app-bar__actions"><button class="icon-btn ripple" id="themeBtn" aria-label="切换明暗主题" data-ripple="on-surface-variant">🌙</button></div>\n'
        + '        </div>\n    </header>\n\n'
        + '    <main>\n        <div class="section" style="padding-top: calc(var(--appbar-height) + 32px);">\n'
        + '            <h1 class="article-list-title reveal">全部文章</h1>\n'
        + '            <div class="article-grid">\n' + allCards(articles) + '\n            </div>\n'
        + '            <div style="text-align:center; margin-top: 48px; margin-bottom: 48px;" class="reveal"><a href="/" class="btn btn--tonal ripple" data-ripple="on-secondary-container">🏠 返回首页</a></div>\n'
        + '        </div>\n    </main>\n\n'
        + '    <button class="fab ripple" id="fab" aria-label="回到顶部" data-ripple="on-primary-container"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/></svg></button>\n'
        + '    <footer class="footer"><p class="footer-text">© <span id="year">2026</span> 歆九的博客 · Crafted with 💙 and Material You</p></footer>\n'
        + '    <script src="../vendor/mcu-core.js"></script>\n    <script src="../script.js"></script>\n</body>\n</html>\n';
}

/**
 * 重写首页 index.html 的文章卡片区:
 * 用 <!-- AUTO_CARDS_START --> ... <!-- AUTO_CARDS_END --> 标记之间的内容
 * 替换为最新 N 篇文章卡片。若标记不存在则不动(用户手写版首页不受影响)。
 */
function syncHome(articles, n) {
    const homeFile = path.join(ROOT, 'index.html');
    let html = fs.readFileSync(homeFile, 'utf8');
    const startMark = '<!-- AUTO_CARDS_START -->';
    const endMark = '<!-- AUTO_CARDS_END -->';
    const si = html.indexOf(startMark);
    const ei = html.indexOf(endMark);
    if (si === -1 || ei === -1 || ei < si) return { ok: false, reason: 'index.html 缺少自动卡片标记' };
    const cards = homeCards(articles, n);
    const block = startMark + '\n' + cards + '\n                ' + endMark;
    html = html.slice(0, si) + block + html.slice(ei + endMark.length);
    fs.writeFileSync(homeFile, html, 'utf8');
    return { ok: true };
}

/** 重新生成整个站点:文章页 + 列表页 + 首页卡片 */
function regenerateSite() {
    const data = readData();
    const articles = data.articles || [];

    // 1. 生成每篇文章页
    if (!fs.existsSync(ARTICLES_DIR)) fs.mkdirSync(ARTICLES_DIR, { recursive: true });
    articles.forEach(function (a) {
        fs.writeFileSync(path.join(ARTICLES_DIR, a.id + '.html'), articlePageHtml(a, articles), 'utf8');
    });

    // 2. 删除数据中已不存在的文章页面
    try {
        const files = fs.readdirSync(ARTICLES_DIR);
        const ids = new Set(articles.map(function (a) { return a.id; }));
        files.forEach(function (f) {
            if (f === 'index.html' || !f.endsWith('.html')) return;
            const id = f.slice(0, -5);
            if (!ids.has(id)) fs.unlinkSync(path.join(ARTICLES_DIR, f));
        });
    } catch (e) { /* 忽略目录读取错误 */ }

    // 3. 生成列表页
    fs.writeFileSync(path.join(ARTICLES_DIR, 'index.html'), renderArticleIndex(articles), 'utf8');

    // 4. 重写首页卡片(若存在标记)
    const home = syncHome(articles, 3);
    return { ok: true, articleCount: articles.length, homeSynced: home.ok };
}

/* ============================================================================
 * 3. HTTP 静态文件服务 + REST API
 * ========================================================================== */

/** 统一响应 */
function send(res, code, data, mime) {
    const body = typeof data === 'string' ? data : JSON.stringify(data || {});
    res.writeHead(code, { 'Content-Type': mime || 'application/json; charset=utf-8' });
    res.end(body);
}

/** 收集请求体 */
function readBody(req) {
    return new Promise(function (resolve, reject) {
        let data = '';
        req.on('data', function (c) { data += c; if (data.length > 5e6) { data = ''; req.destroy(); reject(new Error('请求体过大')); } });
        req.on('end', function () { resolve(data); });
        req.on('error', reject);
    });
}

const server = http.createServer(function (req, res) {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;

    /* ------- API 区(带 /api/ 前缀) ------- */
    if (p.startsWith('/api/')) {
        // GET /api/articles —— 读取全部文章
        if (p === '/api/articles' && req.method === 'GET') {
            return send(res, 200, readData());
        }

        // POST /api/articles —— 新增
        if (p === '/api/articles' && req.method === 'POST') {
            return readBody(req).then(function (body) {
                const a = JSON.parse(body || '{}');
                if (!a.title) return send(res, 400, { error: '缺少标题 title' });
                const data = readData();
                if (!Array.isArray(data.articles)) data.articles = [];
                if (!a.id) a.id = slugify(a.title);
                if (data.articles.some(function (x) { return x.id === a.id; })) return send(res, 400, { error: '文章 id 已存在: ' + a.id });
                data.articles.unshift(a); // 新的放最前
                writeData(data);
                const r = regenerateSite();
                send(res, 200, { ok: true, id: a.id, generated: r });
            }).catch(function (e) { send(res, 400, { error: e.message }); });
        }

        // PUT /api/articles/:id —— 更新
        const putMatch = p.match(/^\/api\/articles\/([^/]+)$/);
        if (putMatch && req.method === 'PUT') {
            const id = decodeURIComponent(putMatch[1]);
            return readBody(req).then(function (body) {
                const a = JSON.parse(body || '{}');
                const data = readData();
                const i = data.articles.findIndex(function (x) { return x.id === id; });
                if (i < 0) return send(res, 404, { error: '文章不存在: ' + id });
                // 保留 id,其余字段更新
                data.articles[i] = Object.assign({}, data.articles[i], a, { id: id });
                writeData(data);
                const r = regenerateSite();
                send(res, 200, { ok: true, id: id, generated: r });
            }).catch(function (e) { send(res, 400, { error: e.message }); });
        }

        // DELETE /api/articles/:id —— 删除
        if (putMatch && req.method === 'DELETE') {
            const id = decodeURIComponent(putMatch[1]);
            const data = readData();
            const before = (data.articles || []).length;
            data.articles = (data.articles || []).filter(function (x) { return x.id !== id; });
            if (data.articles.length !== before) {
                writeData(data);
                const r = regenerateSite();
                return send(res, 200, { ok: true, generated: r });
            }
            return send(res, 404, { error: '文章不存在: ' + id });
        }

        // POST /api/publish —— git 提交并推送
        if (p === '/api/publish' && req.method === 'POST') {
            return readBody(req).then(function (body) {
                let msg = 'blog: 更新文章';
                try { const b = JSON.parse(body); if (b.msg) msg = b.msg; } catch (e) {}
                gitCommitPush(msg).then(function (r) { send(res, r.ok ? 200 : 500, r); });
            }).catch(function (e) { send(res, 400, { error: e.message }); });
        }

        return send(res, 404, { error: '接口不存在' });
    }

    /* ------- 静态文件区 ------- */
    let fp = path.join(ROOT, p === '/' ? 'index.html' : decodeURIComponent(p));
    try {
        const st = fs.statSync(fp);
        if (st.isDirectory()) { fp = path.join(fp, 'index.html'); if (!fs.existsSync(fp)) return send(res, 404, 'Not Found', 'text/plain'); }
        const data = fs.readFileSync(fp);
        const mime = MIME[path.extname(fp)] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
        res.end(data);
    } catch (e) {
        send(res, 404, 'Not Found', 'text/plain');
    }
});

/* ============================================================================
 * 4. Git 提交与推送
 *    使用系统 git + 本机 Git Credential Manager 凭据。
 * ========================================================================== */
async function gitCommitPush(msg) {
    const add = await run('git', ['add', '-A']);
    if (add.code !== 0) return { ok: false, error: 'git add 失败: ' + add.stderr };

    // 判断是否有改动
    const diff = await run('git', ['diff', '--cached', '--quiet']);
    let committed = false;
    if (diff.code !== 0) {
        const commit = await run('git', ['commit', '-m', msg]);
        if (commit.code !== 0) return { ok: false, error: 'git commit 失败: ' + commit.stderr };
        committed = true;
    }

    // 推送(加上 --no-revoke 以绕过 Windows 证书吊销检查问题)
    const push = await run('git', ['-c', 'http.schannelCheckRevoke=false', 'push']);
    if (push.code !== 0) return { ok: false, error: 'git push 失败: ' + push.stderr };

    return { ok: true, committed: committed, message: committed ? msg : '无改动可提交' };
}

/* 单次提交推送(供手动触发) */
if (process.argv[2] === 'git-commit') {
    const msg = process.argv[3] || 'blog: 更新文章';
    gitCommitPush(msg).then(function (r) {
        console.log(JSON.stringify(r, null, 2));
        process.exit(r.ok ? 0 : 1);
    });
    return;
}

/* ============================================================================
 * 5. 启动服务
 * ========================================================================== */
server.listen(PORT, function () {
    console.log('');
    console.log('========================================');
    console.log('  博客管理服务已启动');
    console.log('  后台:  http://localhost:' + PORT + '/admin.html');
    console.log('  站点:  http://localhost:' + PORT + '/');
    console.log('  数据:  data/articles.json');
    console.log('  用法:  在后台编辑文章后点“保存并发布”→ 自动 git 提交+推送');
    console.log('========================================');
});
