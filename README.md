# 歆九的博客

基于 [Hexo](https://hexo.io/) 的静态博客，采用 [Firefly](https://github.com/LKDenchin/hexo-theme-firefly) 主题，部署在 GitHub Pages。

- 在线访问：**https://xinjiu-qwq.github.io**
- 后台管理（Decap CMS）：**https://xinjiu-qwq.github.io/admin/**

## 技术栈

| 组件 | 说明 |
|---|---|
| Hexo 8 | 静态博客框架 |
| Firefly 主题 | 清新现代，含 Live2D/Spine 看板娘（未启用） |
| Decap CMS | 网页后台，GitHub 登录，在线写文章/传图 |
| GitHub Actions | 自动构建部署（push source → 构建 → 发布 main） |
| Cloudflare Worker | OAuth 登录代理（decap-proxy） |

## 分支说明

- **`source`**：Hexo 源码（本地与后台共同编辑的对象）
- **`main`**：构建后的静态网站（GitHub Pages 服务，由 CI 自动发布）

## 目录结构

```
source/
├── _posts/       文章（.md）
├── categories/   分类页
├── tags/         标签页
├── about/        关于页
├── friends/      友链页
├── _data/        站点数据（friends.yml 友链等）
├── img/          ★ 上传的图片（后台传图 + 站点图片）
├── music/        （备用放 mp3，自托管音乐用）
└── admin/        Decap 后台文件（index.html / config.yml）
themes/firefly/   主题（_config.yml 主题配置、layout 模板、source 资源）
.github/          工作流（自动部署）
```

## 本地运行

```bash
pnpm install
npx hexo clean && npx hexo generate
npx hexo server        # http://localhost:4000
```

## 撰写/发布

- **网页后台**：https://xinjiu-qwq.github.io/admin/ （GitHub 登录，保存后自动部署）
- **本地**：`npx hexo new "标题"` → 编辑 `source/_posts/*.md` → 提交并 `git push`（触发 CI 自动部署）

> ⚠️ 请勿使用 `npx hexo deploy`（会绕过 CI 直接推 main，与 CI 部署冲突）；发布统一走 `git push`。

## 常用配置

- 站点标题/URL/部署：`_config.yml`
- 主题色/导航/头像/音乐/评论：`themes/firefly/_config.yml`
- 后台登录 OAuth / 图片路径：`source/admin/config.yml`
- 友链：`source/_data/friends.yml`

## 相关文档

- `ADMIN_SETUP.md`：后台使用说明
- `CF_DEPLOY.md`：Cloudflare 认证部署说明
- `目录说明.md`（工作区）：详细目录注释

## License

MIT（主题与本站内容按各自协议）
