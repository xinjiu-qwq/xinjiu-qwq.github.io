/* ============================================================================
 * script.js —— Material You 博客主页交互逻辑
 * ----------------------------------------------------------------------------
 * 功能总览:
 *   1. 动态取色:基于 Google 官方 HCT 算法(vendor/mcu-core.js),
 *      从固定主题色实时生成整套 Material 3 配色并写入 CSS 变量
 *   2. 主题系统:亮色 / 暗色切换(顶栏 🌙/☀️ 按钮),localStorage 记忆
 *   3. 涟漪反馈:还原 M3 的触摸涟漪效果
 *   4. 滚动行为:顶栏投影、回到顶部 FAB、区块入场动画、导航高亮
 *   5. 移动端抽屉菜单
 * ----------------------------------------------------------------------------
 * 如何修改:
 *   - 换主题色:改下方 THEME_SEED(注意:style.css 里 :root 的
 *     --md-* 默认值也要同步改,否则 JS 加载前会闪一下旧色)
 *   - 换默认明暗:改 CONFIG.defaultTheme
 *   - 调整配色风格:改 buildScheme() 里的色相偏移与彩度参数
 * ========================================================================== */

'use strict';

/* ============================================================================
 * 配置区(个性化在这里改)
 * ========================================================================== */

/** 主题种子色:整套配色的来源(Material You 动态取色) */
const THEME_SEED = '#a450a2';

const CONFIG = {
    /** 默认明暗模式:'light' | 'dark' | 'system' */
    defaultTheme: 'system',
    /** localStorage 键名 */
    storage: { theme: 'blog1-theme' },
};

/* ============================================================================
 * 工具函数
 * ========================================================================== */

/** 读取 localStorage,失败(隐私模式等)时返回默认值 */
function storageGet(key, fallback) {
    try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : v;
    } catch { return fallback; }
}

function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch { /* 忽略写入失败 */ }
}

/** 判断系统当前是否为暗色 */
function systemPrefersDark() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/* ============================================================================
 * 1. 动态取色 —— M3 色彩方案生成
 * ----------------------------------------------------------------------------
 * 原理(Material You 核心):
 *   把种子色放进 Google 的 HCT 色彩空间(色相 Hue / 彩度 Chroma / 明度 Tone),
 *   用"色调色板 TonalPalette"固定色相与彩度、逐级取明度,
 *   再按 M3 规范把不同明度档位分配给 primary / surface 等色彩角色。
 * 所有算法来自 vendor/mcu-core.js(官方 material-color-utilities,Apache-2.0)。
 * ========================================================================== */
const MCU = window.MaterialColorUtilities; // 官方库全局对象

/**
 * 根据种子色生成亮/暗两套 M3 配色方案。
 * @param {string} seedHex 种子色,如 '#a450a2'
 * @returns {{light: object, dark: object}} 每套都是 {角色名: 颜色} 映射
 */
function buildScheme(seedHex) {
    const seedArgb = MCU.argbFromHex(seedHex);
    const seedHct  = MCU.Hct.fromInt(seedArgb);
    const hue = seedHct.hue;

    /* 四个色调色板(M3 规范参数):
       - primary   主色:直接用种子色(保持原彩度)
       - secondary 次色:同色相、彩度压到 16
       - tertiary  强调色:色相 +60°、彩度 24
       - neutral   中性色:同色相、彩度 4(用于表面色) */
    const primary   = MCU.TonalPalette.fromInt(seedArgb);
    const secondary = MCU.TonalPalette.fromHueAndChroma(hue, 16);
    const tertiary  = MCU.TonalPalette.fromHueAndChroma(hue + 60, 24);
    const neutral   = MCU.TonalPalette.fromHueAndChroma(hue, 4);
    const neutralV  = MCU.TonalPalette.fromHueAndChroma(hue, 8);

    const t = (pal, tone) => MCU.hexFromArgb(pal.tone(tone)); // 取色板某明度档

    /* 错误色:Material 3 规范固定值,不随种子色变化 */
    const ERROR_LIGHT = { error: '#b3261e', onError: '#ffffff', errorContainer: '#f9dedc', onErrorContainer: '#410e0b' };
    const ERROR_DARK  = { error: '#f2b8b5', onError: '#601410', errorContainer: '#8c1d18', onErrorContainer: '#f9dedc' };

    /* 亮色方案:主色取 40 档,表面取 98 档(M3 规范) */
    const light = {
        primary: t(primary, 40), onPrimary: t(primary, 100),
        primaryContainer: t(primary, 90), onPrimaryContainer: t(primary, 10),
        secondary: t(secondary, 40), onSecondary: t(secondary, 100),
        secondaryContainer: t(secondary, 90), onSecondaryContainer: t(secondary, 10),
        tertiary: t(tertiary, 40), onTertiary: t(tertiary, 100),
        tertiaryContainer: t(tertiary, 90), onTertiaryContainer: t(tertiary, 10),
        surface: t(neutral, 98), surfaceDim: t(neutral, 87), surfaceBright: t(neutral, 98),
        onSurface: t(neutral, 10), onSurfaceVariant: t(neutralV, 30),
        surfaceContainerLowest: t(neutral, 100), surfaceContainerLow: t(neutral, 96),
        surfaceContainer: t(neutral, 94), surfaceContainerHigh: t(neutral, 92),
        surfaceContainerHighest: t(neutral, 90),
        outline: t(neutralV, 50), outlineVariant: t(neutralV, 80),
        inverseSurface: t(neutral, 20), inverseOnSurface: t(neutral, 95), inversePrimary: t(primary, 80),
        shadow: '#000000',
        ...ERROR_LIGHT,
    };

    /* 暗色方案:主色取 80 档,表面取 6 档 */
    const dark = {
        primary: t(primary, 80), onPrimary: t(primary, 20),
        primaryContainer: t(primary, 30), onPrimaryContainer: t(primary, 90),
        secondary: t(secondary, 80), onSecondary: t(secondary, 20),
        secondaryContainer: t(secondary, 30), onSecondaryContainer: t(secondary, 90),
        tertiary: t(tertiary, 80), onTertiary: t(tertiary, 20),
        tertiaryContainer: t(tertiary, 30), onTertiaryContainer: t(tertiary, 90),
        surface: t(neutral, 6), surfaceDim: t(neutral, 6), surfaceBright: t(neutral, 24),
        onSurface: t(neutral, 90), onSurfaceVariant: t(neutralV, 80),
        surfaceContainerLowest: t(neutral, 4), surfaceContainerLow: t(neutral, 10),
        surfaceContainer: t(neutral, 12), surfaceContainerHigh: t(neutral, 17),
        surfaceContainerHighest: t(neutral, 22),
        outline: t(neutralV, 60), outlineVariant: t(neutralV, 30),
        inverseSurface: t(neutral, 90), inverseOnSurface: t(neutral, 20), inversePrimary: t(primary, 40),
        shadow: '#000000',
        ...ERROR_DARK,
    };

    return { light, dark };
}

/**
 * 把配色方案写进 CSS:注入一段 <style id="dynamic-theme">,
 * 里面分别定义 :root(亮色) 与 html[data-theme="dark"](暗色) 两组变量。
 * 用注入样式而不是行内样式,是为了让暗色规则保持正常的层叠优先级。
 * @param {object} light 亮色角色映射
 * @param {object} dark  暗色角色映射
 */
function applyScheme(light, dark) {
    const toCss = (scheme) =>
        Object.entries(scheme).map(([role, color]) => `--md-${role}: ${color};`).join('\n');

    let style = document.getElementById('dynamic-theme');
    if (!style) {
        style = document.createElement('style');
        style.id = 'dynamic-theme';
        document.head.appendChild(style);
    }
    style.textContent = `:root {\n${toCss(light)}\n}\nhtml[data-theme="dark"] {\n${toCss(dark)}\n}`;

    /* 同步浏览器地址栏颜色(移动端) */
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolveTheme() === 'dark' ? dark.surface : light.surface);
}

/* ============================================================================
 * 2. 主题系统(亮 / 暗 切换)
 * ========================================================================== */
let currentTheme = CONFIG.defaultTheme; // 用户选择(首次为 'system' 则跟随系统)

/** 解析出实际生效的明暗:'system' -> 系统偏好 */
function resolveTheme() {
    if (currentTheme === 'system') return systemPrefersDark() ? 'dark' : 'light';
    return currentTheme;
}

/**
 * 应用主题:设置 <html data-theme> 并刷新按钮 emoji / 地址栏色。
 * 配色变量在 applySeed 时已生成,这里只切换明暗。
 */
function applyTheme() {
    const resolved = resolveTheme();
    document.documentElement.setAttribute('data-theme', resolved);

    /* 切换按钮 emoji:当前亮色显示 🌙(点按切暗),当前暗色显示 ☀️(点按切亮) */
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.textContent = resolved === 'dark' ? '☀️' : '🌙';
}

/** 设置明暗模式并记忆 */
function setTheme(mode) {
    currentTheme = mode;
    storageSet(CONFIG.storage.theme, mode);
    applyTheme();
}

/** 顶栏按钮:在亮 / 暗之间切换(退出"跟随系统") */
function toggleTheme() {
    setTheme(resolveTheme() === 'dark' ? 'light' : 'dark');
}

/* ============================================================================
 * 3. 主题色应用(固定种子色,启动时执行一次)
 * ========================================================================== */
function applySeed() {
    const { light, dark } = buildScheme(THEME_SEED);
    applyScheme(light, dark);
}

/* ============================================================================
 * 4. 涟漪(Ripple)反馈 —— M3 触摸反馈
 * ----------------------------------------------------------------------------
 * 点击带 .ripple 的元素时,在点击位置生成一个扩散圆点。
 * 涟漪颜色由元素 data-ripple 属性指定(CSS 变量名),
 * 例如 data-ripple="on-primary" -> --ripple-color: var(--md-on-primary)。
 * ========================================================================== */
const RIPPLE_COLORS = {
    'on-surface':        'var(--md-on-surface)',
    'on-surface-variant': 'var(--md-on-surface-variant)',
    'on-primary':        'var(--md-on-primary)',
    'on-secondary-container': 'var(--md-on-secondary-container)',
    'primary':           'var(--md-primary)',
};

/** 初始化全局涟漪:事件委托到 document,动态添加的元素也有效 */
function initRipple() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; // 无障碍:减少动效

    document.addEventListener('pointerdown', (e) => {
        const host = e.target.closest('.ripple');
        if (!host || host.classList.contains('ripple-ink')) return;

        /* 解析涟漪颜色(取 data-ripple 映射,缺省用当前文字色) */
        const colorVar = RIPPLE_COLORS[host.dataset.ripple] || 'currentColor';
        host.style.setProperty('--ripple-color', colorVar);

        /* 在点击位置放一个圆形 span,并让它扩散消失 */
        const rect = host.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 1.1;
        const ink = document.createElement('span');
        ink.className = 'ripple-ink';
        ink.style.width = ink.style.height = `${size}px`;
        ink.style.left = `${e.clientX - rect.left - size / 2}px`;
        ink.style.top = `${e.clientY - rect.top - size / 2}px`;
        host.appendChild(ink);
        ink.addEventListener('animationend', () => ink.remove());
    });
}

/* ============================================================================
 * 5. 滚动行为:顶栏投影 / 回到顶部 FAB / 入场动画 / 导航高亮
 * ========================================================================== */

/** 滚动监听:滚动量 > 4px 时顶栏加投影;超过一屏显示 FAB */
function initScrollEffects() {
    const appBar = document.getElementById('appBar');
    const fab = document.getElementById('fab');
    if (!appBar || !fab) return; // 文章页等无顶栏/FAB 的页面直接跳过

    const onScroll = () => {
        const y = window.scrollY;
        appBar.classList.toggle('is-scrolled', y > 4);
        fab.classList.toggle('is-visible', y > window.innerHeight * 0.6);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // 初始化一次

    fab.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/** 区块入场动画:IntersectionObserver 进入视口时加 .visible */
function initReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
        els.forEach(el => el.classList.add('visible')); // 老浏览器直接显示
        return;
    }
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                io.unobserve(entry.target); // 只播一次
            }
        });
    }, { threshold: 0.12 });
    els.forEach(el => io.observe(el));
}

/** 滚动监听:高亮当前所在区块对应的导航项(滚动监听 + 防抖) */
function initScrollSpy() {
    const sections = document.querySelectorAll('main section[id]');
    const navLinks = document.querySelectorAll('.nav-link, .drawer-link');
    if (!sections.length) return;

    let ticking = false;
    const update = () => {
        ticking = false;
        let currentId = '';
        const probe = window.innerHeight * 0.35; // 视口 35% 处的区块视为当前
        sections.forEach(sec => {
            if (sec.getBoundingClientRect().top <= probe) currentId = sec.id;
        });
        navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${currentId}`);
        });
    };
    window.addEventListener('scroll', () => {
        if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
}

/* ============================================================================
 * 6. 移动端抽屉菜单
 * ========================================================================== */

/** 锁定 / 解锁页面滚动(抽屉打开时) */
function lockScroll(lock) {
    document.body.style.overflow = lock ? 'hidden' : '';
}

/** 抽屉开关控制(文章页没有抽屉,缺失时跳过) */
function initOverlays() {
    const drawer = document.getElementById('drawer');
    const menuBtn = document.getElementById('menuBtn');
    const scrim = document.getElementById('scrim');
    if (!drawer || !menuBtn || !scrim) return;

    document.getElementById('menuBtn').addEventListener('click', () => {
        drawer.classList.add('is-open');
        scrim.classList.add('is-visible');
        lockScroll(true);
    });
    const closeDrawer = () => {
        drawer.classList.remove('is-open');
        scrim.classList.remove('is-visible');
        lockScroll(false);
    };
    scrim.addEventListener('click', closeDrawer);
    /* 点击抽屉里的链接后自动收起 */
    drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', closeDrawer));

    /* Esc 键关闭抽屉 */
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDrawer();
    });
}

/* ============================================================================
 * 7. 初始化
 * ========================================================================== */
function init() {
    /* 读取用户记忆的主题(首次访问用默认值) */
    currentTheme = storageGet(CONFIG.storage.theme, CONFIG.defaultTheme);
    if (!['light', 'dark', 'system'].includes(currentTheme)) currentTheme = CONFIG.defaultTheme;

    applySeed();     // 生成整套配色
    applyTheme();    // 应用明暗

    initRipple();
    initScrollEffects();
    initReveal();
    initScrollSpy();
    initOverlays();

    /* 页脚年份自动更新(页面无 #year 时跳过) */
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    /* 顶栏明暗切换按钮 */
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    /* 跟随系统时,系统主题变化自动切换 */
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (currentTheme === 'system') applyTheme();
    });
}

/* DOM 就绪后启动(脚本位于 body 末尾,直接执行亦可,这里双保险) */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
