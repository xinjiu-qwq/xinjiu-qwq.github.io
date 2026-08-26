# 部署到 Cloudflare（全线上后台，摆脱 localhost）

部署后效果：任意设备打开 **https://xinjiu-qwq.github.io/admin/** 均可登录编辑，无需本机运行任何服务。

```
浏览器(/admin/) → Cloudflare Worker OAuth 代理 → GitHub 授权 → 令牌回传 → 编辑提交到 source 分支 → Actions 自动构建部署
```

## 第 1 步：部署 OAuth Worker（一次性，约 10 分钟）

准备工作已替你完成（仓库已克隆到 `C:\Users\ADMIN\Desktop\decap-proxy`，`wrangler.toml` 已生成）。

在 PowerShell 中执行：

```powershell
cd C:\Users\ADMIN\Desktop\decap-proxy
npx wrangler login          # 会打开浏览器，登录你的 Cloudflare 账号授权
npx wrangler secret put GITHUB_OAUTH_ID       # 提示输入时粘贴 OAuth App 的 Client ID（第 2 步创建）
npx wrangler secret put GITHUB_OAUTH_SECRET   # 粘贴 Client Secret
npx wrangler deploy
```

部署完成会显示 Worker 地址，形如：
`https://decap-proxy.<你的cloudflare账号>.workers.dev`

浏览器打开该地址，看到 **"Hello 👋"** 即部署成功。

> 如果 wrangler 网络连接失败（国内网络问题），先执行：
> `$env:HTTPS_PROXY="http://127.0.0.1:7897"; $env:HTTP_PROXY="http://127.0.0.1:7897"`
> 再重试上面的命令。
>
> 如果 workers.dev 域名无法访问，可在 Cloudflare 控制台给 Worker 绑定你自己的域名。

## 第 2 步：创建 / 修改 GitHub OAuth 应用

- **还没创建过**：打开 https://github.com/settings/applications/new
  - Application name: `Decap CMS`（随意）
  - Homepage URL: `https://decap-proxy.<你的cloudflare账号>.workers.dev`（Worker 地址）
  - Authorization callback URL: `https://decap-proxy.<你的cloudflare账号>.workers.dev/callback`
  - 注册后记下 **Client ID**，生成并复制 **Client Secret**
- **已创建过**（之前按 localhost 教程创建的）：打开 https://github.com/settings/developers → 找到该应用 → **Edit** → 把 "Authorization callback URL" 改成上面的 `/callback` 地址，保存。Client ID / Secret 不变。

## 第 3 步：更新博客后台配置（一行）

编辑 `source/admin/config.yml`，把 `base_url` 从 `http://localhost:8080` 改成你的 Worker 地址：

```yaml
backend:
  name: github
  repo: xinjiu-qwq/xinjiu-qwq.github.io
  branch: source
  base_url: https://decap-proxy.<你的cloudflare账号>.workers.dev
  auth_endpoint: auth
```

保存后推送到仓库：

```powershell
cd C:\Users\ADMIN\Desktop\1
git add source/admin/config.yml
git commit -m "切换 OAuth 到 Cloudflare Worker"
git push
```

（也可以把 Worker 地址告诉我，我帮你改并推送。）

## 第 4 步：验证

1. 等 1-2 分钟（Actions 构建 + Pages 发布）
2. 打开 **https://xinjiu-qwq.github.io/admin/** → 点 **Login with GitHub**
3. 浏览器跳到你的 Worker 地址 → GitHub 授权 → 自动跳回后台 → 完成！

---

## 常见问题

- **登录后报错 / 一直转圈**：确认 OAuth App 的回调地址与 Worker 的 `/callback` 完全一致（无多余斜杠）。
- **想用自定义域名**：Cloudflare 控制台 → Workers → 你的 Worker → Settings → Domains & Routes → Add 绑定 `auth.你的域名.com`，并把 OAuth App 回调地址和 config.yml 的 base_url 同步改为 `https://auth.你的域名.com`。
- **后台能登录但保存失败**：确认 GitHub 账号对该仓库有写权限（OAuth 登录用户必须是仓库成员/owner）。
- **不再需要本地方案**：`C:\Users\ADMIN\Desktop\1\oauth-server` 目录可以删除。
