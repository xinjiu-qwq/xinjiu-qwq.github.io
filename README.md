# 歆九的 Github Pages
Click the link to visit
点击链接即可访问 [访问(Visit)🔗](https://xinjiu-qwq.github.io/)

## 📝 博客管理后台(可视化编辑 + 自动发布)

除了直接改文件,还可以用**管理后台**可视化编辑/新增文章,并一键提交到 git 仓库。

```bash
node admin-server.js       # 启动本地管理服务
# 打开 http://localhost:3000/admin.html
```

**功能:**
- 📝 编辑 / 新增 / 删除文章(支持 Markdown,带实时预览)
- ⚙️ 保存时自动重新生成所有页面(文章页 + 列表页 + 首页卡片)
- 🚀 点「保存并发布」→ 自动 `git commit + push` 到 GitHub Pages

**数据:** 所有文章存在 `data/articles.json`;页面由服务端自动生成到 `articles/`。

> 说明:管理后台需要 Node.js + 本机 git 凭据,是**本地编辑工具**(只在本机运行),
> 不会作为线上网页公开(线上仍是静态 HTML)。发布按钮自动处理 git 的 pull/push 冲突。
