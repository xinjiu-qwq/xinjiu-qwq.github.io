# 后台管理（Decap CMS）使用方法

后台地址: **https://xinjiu-qwq.github.io/admin/**

## 原理

```
写文章/编辑 → GitHub OAuth 登录（Cloudflare Worker 代理认证）
→ 保存 = 提交到 source 分支
→ GitHub Actions 自动构建 → 部署到 main → 网站更新（约 1-2 分钟）
```

## 现状

- ✅ OAuth 认证代理已部署在 Cloudflare Worker: **https://decap-proxy.xinjiu-qwq.workers.dev**
- ✅ 博客后台配置已指向该 Worker（`source/admin/config.yml` 的 `base_url`）
- ✅ GitHub OAuth 应用已创建（回调地址 = `https://decap-proxy.xinjiu-qwq.workers.dev/callback`）
- 无需本地运行任何服务，任意设备可登录编辑

## 使用

1. 打开 https://xinjiu-qwq.github.io/admin/
2. 点 **Login with GitHub** → 浏览器跳到 Worker → GitHub 授权 → 自动跳回后台
3. 浏览/新建/编辑/删除文章（Markdown 正文，可上传图片到 source/img）
4. 保存后 1-2 分钟网站自动更新

## 如果登录失效

- 检查 Worker 是否还在运行（浏览器打开 https://decap-proxy.xinjiu-qwq.workers.dev 应显示 Hello 👋）
- 检查 GitHub OAuth 应用回调地址是否仍是 `https://decap-proxy.xinjiu-qwq.workers.dev/callback`（https://github.com/settings/developers → Edit）
- 确认 GitHub 账号对仓库有写权限

## 架构备忘

- `source` 分支：Hexo 源码（后台编辑的对象）
- `main` 分支：构建后的静态网站（GitHub Pages 服务）
- `.github/workflows/deploy.yml`：自动构建部署工作流
- Cloudflare Worker：OAuth 认证代理（源码在 `C:\Users\ADMIN\Desktop\decap-proxy`，用 wrangler 管理）
- 旧的本地方案目录 `oauth-server/` 已不再需要，可删除

## 可选：绑定自定义域名给 Worker

Cloudflare 控制台 → Workers & Pages → decap-proxy → Settings → Domains & Routes → Add，
绑定如 `auth.你的域名.com`，然后把 GitHub OAuth 回调地址和 `config.yml` 的 `base_url` 同步改为该域名。
