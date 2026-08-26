// Decap CMS 本地 OAuth 认证服务
// 用法:
//   1. 在 GitHub 创建 OAuth App (回调地址 http://localhost:8080/callback)
//   2. 设置环境变量 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
//   3. npm install && npm start
// 然后打开 https://xinjiu-qwq.github.io/admin/ 用 GitHub 登录
const http = require('http');
const { createHandlers } = require('netlify-cms-oauth-provider-node');

const PORT = process.env.PORT || 8080;

const handlers = createHandlers({
  origin: 'https://xinjiu-qwq.github.io',
  completeUrl: `http://localhost:${PORT}/callback`,
  oauthClientID: process.env.GITHUB_CLIENT_ID,
  oauthClientSecret: process.env.GITHUB_CLIENT_SECRET,
  oauthProvider: 'github',
  adminPanelUrl: 'https://xinjiu-qwq.github.io/admin/',
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname === '/auth') {
      const redirectUrl = await handlers.begin();
      res.writeHead(302, { Location: redirectUrl });
      res.end();
    } else if (url.pathname === '/callback') {
      const params = Object.fromEntries(url.searchParams.entries());
      const html = await handlers.complete(params.code || '', params);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 - 仅支持 /auth 和 /callback');
    }
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('OAuth 处理失败: ' + e.message);
  }
});

server.listen(PORT, () => {
  console.log(`Decap CMS OAuth 服务已启动: http://localhost:${PORT}`);
  console.log('请确认已设置 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET 环境变量');
});
