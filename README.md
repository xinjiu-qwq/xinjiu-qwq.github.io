# 歆九的博客 · Material You 主页

基于 **Material Design 3 (Material You)** 的个人博客主页,核心特性是**动态取色**:
从固定主题色 `#A450A2` 用 Google 官方 HCT 算法生成整套配色,支持亮 / 暗 / 跟随系统三种主题。

## 文件结构

| 文件 | 作用 |
| --- | --- |
| `index.html` | 页面结构(改文字 / 文章 / 链接在这里) |
| `style.css` | M3 设计令牌 + 全部组件样式(改外观在这里) |
| `script.js` | 动态取色、明暗切换、涟漪、滚动交互(改行为在这里) |
| `vendor/mcu-core.js` | Google 官方 `material-color-utilities`(HCT 算法,Apache-2.0),**无需修改** |

> 本页是纯静态页面,没有构建工具,双击 `index.html` 即可打开。
> 唯一联网依赖是 Google Fonts(字体)与 QQ 头像,离线时自动回退系统字体 / 显示占位头像。

## 快速自定义

### 1. 改博客名 / 文章 / 链接
打开 `index.html`:
- 顶栏品牌名、页脚版权:直接搜「歆九的博客」替换
- 新增文章:复制一个 `<article class="article-card">` 卡片,改标签 / 标题 / 摘要 / 日期 / 链接
- 导航 / 社交链接:改 `<a href="#">` 的 `href`
- 头像:改 Hero 区 `<img>` 的 `src`(spec=640 为 QQ 高清尺寸)

### 2. 改主题色与明暗
- **主题色**:改 `script.js` 顶部 `THEME_SEED`(当前 `#A450A2`)。
  注意 `style.css` 里 `:root` 的 `--md-*` 默认值也建议同步改,避免 JS 加载前闪现旧色
- **默认明暗**:改 `CONFIG.defaultTheme`(`'light' | 'dark' | 'system'`)
- **配色风格**(色相偏移、彩度):改 `script.js` 的 `buildScheme()`
- 顶栏 🌙/☀️ 按钮随时切换明暗,选择会记忆在 localStorage(键 `blog1-theme`)

### 3. 改样式
所有颜色、圆角、字体、间距都集中在 `style.css` 顶部的**设计令牌**区:
- 搜「色彩角色」→ `--md-primary` 等 M3 变量
- 搜「形状令牌」→ `--shape-*` 圆角
- 搜「字体令牌」→ `--font-sans` 与字号等级
- 搜「高度(阴影)令牌」→ `--elevation-1~5`

### 4. 改行为
所有交互逻辑在 `script.js`,每个功能区块都有注释说明,按「功能总览」编号查找即可。

## 技术说明

- **动态取色**:种子色 → HCT 色彩空间 → 5 个色调色板(主 / 次 / 强调 / 中性 / 中性变体)→ 按 M3 规范分配到 30+ 个色彩角色(CSS 变量),亮暗各一套,由注入的 `<style id="dynamic-theme">` 生效
- **涟漪**:`script.js` 的 `initRipple()` 用事件委托实现 M3 触摸反馈,颜色由元素 `data-ripple` 属性指定
- **状态层**:CSS `color-mix()` + `--state-hover / --state-pressed` 实现 M3 悬停 / 按压状态
- **无障碍**:支持 `prefers-reduced-motion`;焦点可见性用 `:focus-visible`
- **响应式**:<768px 显示抽屉菜单(隐藏顶栏导航),≥768px 显示顶栏导航(隐藏菜单按钮)

## 许可

页面代码可自由使用;`vendor/mcu-core.js` 来自 Google `material-color-utilities`,Apache License 2.0(文件内保留原始许可头)。
