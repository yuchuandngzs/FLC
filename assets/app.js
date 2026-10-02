/* ==========================================================================
   FLC 启动器 · 宣传网站 交互脚本
   无依赖、无构建，直接双击打开即可运行
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'flc-theme';
  var root = document.documentElement;

  /* ---------- 1. 主题：与启动器一致，支持深色 / 浅色 / 跟随系统 ---------- */
  function systemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light' : 'dark';
  }

  function readPref() {
    try { return localStorage.getItem(KEY) || 'auto'; } catch (e) { return 'auto'; }
  }

  function applyTheme(pref) {
    root.setAttribute('data-theme', pref === 'auto' ? systemTheme() : pref);
    root.setAttribute('data-theme-pref', pref);
  }

  function setPref(pref) {
    try { localStorage.setItem(KEY, pref); } catch (e) { /* 隐私模式：忽略 */ }
    applyTheme(pref);
  }

  // 尽早应用，避免闪烁（脚本置于 head 且非 defer 时生效）
  applyTheme(readPref());

  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: light)');
    var onSys = function () { if (readPref() === 'auto') applyTheme('auto'); };
    if (mq.addEventListener) mq.addEventListener('change', onSys);
    else if (mq.addListener) mq.addListener(onSys);
  }

  /* ---------- 2. DOM 就绪后绑定 ---------- */
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {

    /* 2.1 顶栏主题切换按钮：深色 → 浅色 → 跟随系统 三态循环，与启动器状态栏一致 */
    var themeBtn = document.querySelector('[data-theme-toggle]');
    var label = { dark: '深色', light: '浅色', auto: '跟随系统' };

    function syncThemeBtn() {
      if (!themeBtn) return;
      var pref = readPref();
      var next = pref === 'dark' ? 'light' : pref === 'light' ? 'auto' : 'dark';
      themeBtn.setAttribute('title', '主题：' + label[pref] + '（点击切换到' + label[next] + '）');
      themeBtn.setAttribute('aria-label', '切换主题，当前：' + label[pref]);
    }

    if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        var pref = readPref();
        setPref(pref === 'dark' ? 'light' : pref === 'light' ? 'auto' : 'dark');
        syncThemeBtn();
      });
      syncThemeBtn();
    }

    /* 2.2 移动端菜单 */
    var burger = document.querySelector('[data-burger]');
    var links = document.getElementById('nav-links');
    if (burger && links) {
      burger.addEventListener('click', function () {
        var open = links.classList.toggle('is-open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      links.addEventListener('click', function (e) {
        if (e.target.tagName === 'A') {
          links.classList.remove('is-open');
          burger.setAttribute('aria-expanded', 'false');
        }
      });
    }

    /* 2.3 顶栏滚动阴影 */
    var nav = document.querySelector('.nav');
    if (nav) {
      var onScroll = function () {
        nav.classList.toggle('is-stuck', window.scrollY > 8);
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    /* 2.4 入场动画 */
    var reveals = document.querySelectorAll('.reveal');
    if (reveals.length) {
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            var el = en.target;
            var d = parseInt(el.getAttribute('data-delay') || '0', 10);
            setTimeout(function () { el.classList.add('is-in'); }, d);
            io.unobserve(el);
          });
        }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
        reveals.forEach(function (el) { io.observe(el); });
      } else {
        reveals.forEach(function (el) { el.classList.add('is-in'); });
      }
    }

    /* 2.5 标签页（界面截图切换） */
    document.querySelectorAll('[data-tabs]').forEach(function (group) {
      var tabs = group.querySelectorAll('[role="tab"]');
      var scope = group.getAttribute('data-tabs');
      var panes = document.querySelectorAll('[data-pane-group="' + scope + '"] [role="tabpanel"]');

      function select(name) {
        tabs.forEach(function (t) {
          t.setAttribute('aria-selected', t.getAttribute('data-tab') === name ? 'true' : 'false');
          t.tabIndex = t.getAttribute('data-tab') === name ? 0 : -1;
        });
        panes.forEach(function (p) {
          p.classList.toggle('is-on', p.getAttribute('data-pane') === name);
        });
      }

      tabs.forEach(function (t, i) {
        t.addEventListener('click', function () { select(t.getAttribute('data-tab')); });
        t.addEventListener('keydown', function (e) {
          var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!d) return;
          e.preventDefault();
          var j = (i + d + tabs.length) % tabs.length;
          tabs[j].focus();
          select(tabs[j].getAttribute('data-tab'));
        });
      });

      var first = group.querySelector('[aria-selected="true"]') || tabs[0];
      if (first) select(first.getAttribute('data-tab'));
    });

    /* 2.6 截图灯箱 */
    var zoomables = document.querySelectorAll('.shot--zoom img');
    if (zoomables.length) {
      var box = document.createElement('div');
      box.className = 'lightbox';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', '界面截图放大');
      box.innerHTML = '<button class="lightbox__x" type="button" aria-label="关闭">&#10005;</button><img alt="">';
      document.body.appendChild(box);

      var bigImg = box.querySelector('img');
      var closeBtn = box.querySelector('.lightbox__x');
      var lastFocus = null;

      function open(src, alt) {
        lastFocus = document.activeElement;
        bigImg.src = src;
        bigImg.alt = alt || '';
        box.classList.add('is-on');
        document.body.style.overflow = 'hidden';
        closeBtn.focus();
      }
      function close() {
        box.classList.remove('is-on');
        document.body.style.overflow = '';
        if (lastFocus) lastFocus.focus();
      }

      zoomables.forEach(function (img) {
        img.addEventListener('click', function () { open(img.src, img.alt); });
        img.setAttribute('tabindex', '0');
        img.setAttribute('role', 'button');
        img.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img.src, img.alt); }
        });
      });
      closeBtn.addEventListener('click', close);
      box.addEventListener('click', function (e) { if (e.target === box) close(); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && box.classList.contains('is-on')) close();
      });
    }

    /* 2.7 数字滚动：从 0 数到目标值。
       元素本身始终可见，HTML 里写的就是最终值，所以脚本不执行时也正确。 */
    var counters = document.querySelectorAll('[data-count]');
    if (counters.length) {
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!reduce && 'IntersectionObserver' in window) {
        var cio = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            var el = en.target;
            cio.unobserve(el);
            var target = parseFloat(el.getAttribute('data-count'));
            var dec = (el.getAttribute('data-dec') | 0);
            var t0 = null, dur = 1100;
            function frame(ts) {
              if (t0 === null) t0 = ts;
              var p = Math.min((ts - t0) / dur, 1);
              var eased = 1 - Math.pow(1 - p, 3);
              el.textContent = (target * eased).toFixed(dec);
              if (p < 1) requestAnimationFrame(frame);
              else el.textContent = target.toFixed(dec);
            }
            requestAnimationFrame(frame);
          });
        }, { threshold: .4 });
        counters.forEach(function (el) { cio.observe(el); });
      }
    }

    /* 2.8 页脚年份 */
    document.querySelectorAll('[data-year]').forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  });
})();
