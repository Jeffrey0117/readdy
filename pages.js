'use strict';

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const HEAD_COMMON = `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;500;600&family=Inter:wght@400;500&display=swap" rel="stylesheet">
`;

function renderHomepage() {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <title>readdy</title>
  ${HEAD_COMMON}
  <style>
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      background: #f5f5f5;
      font-family: "Inter", "Noto Sans TC", "PingFang TC", -apple-system, "Segoe UI", sans-serif;
      color: #2a2520;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 56px 20px 24px;
    }
    h1.title {
      font-family: "Noto Serif TC", serif;
      font-size: 30px;
      font-weight: 500;
      margin: 0 0 6px;
      color: #2a2520;
      letter-spacing: .04em;
    }
    .subtitle {
      font-size: 14px;
      color: #888;
      margin: 0 0 24px;
    }
    .card {
      width: 100%;
      max-width: 520px;
      background: #fff;
      border: 1px solid #e3e3e3;
      border-radius: 10px;
      box-shadow: 0 2px 12px rgba(0,0,0,.04);
      padding: 18px;
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 360px;
    }
    textarea {
      flex: 1;
      border: none;
      outline: none;
      resize: none;
      font-family: "Noto Sans TC", "PingFang TC", sans-serif;
      font-size: 14px;
      line-height: 1.7;
      color: #2a2520;
      background: transparent;
      margin-bottom: 12px;
    }
    textarea::placeholder { color: #aaa; }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .err {
      color: #b3261e;
      font-size: 13px;
      flex: 1;
      min-height: 1em;
    }
    button {
      background: #2a2520;
      color: #fff;
      border: none;
      padding: 9px 22px;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      cursor: pointer;
    }
    button:disabled { opacity: .5; cursor: not-allowed; }
  </style>
</head>
<body>
  <h1 class="title">readdy</h1>
  <p class="subtitle">貼上文字，產生一個漂亮的閱讀連結</p>
  <form class="card" id="form">
    <textarea id="content" placeholder="把你想分享的文字貼進這裡…" autofocus></textarea>
    <div class="row">
      <div class="err" id="err"></div>
      <button type="submit" id="submit">產生連結</button>
    </div>
  </form>
  <script>
    const form = document.getElementById('form');
    const ta = document.getElementById('content');
    const btn = document.getElementById('submit');
    const err = document.getElementById('err');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      const content = ta.value;
      if (!content.trim()) { err.textContent = '請先輸入文字'; return; }
      btn.disabled = true;
      btn.textContent = '產生中…';
      try {
        const res = await fetch('/api/paste', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '建立失敗');
        window.location.href = '/' + data.id;
      } catch (e) {
        err.textContent = e.message;
        btn.disabled = false;
        btn.textContent = '產生連結';
      }
    });
  </script>
</body>
</html>`;
}

function formatChineseDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

function countChars(content) {
  if (typeof content !== 'string') return 0;
  return content.replace(/\s+/g, '').length;
}

function renderReading({ id, content, created_at, title }) {
  const safeTitle = escapeHtml(title && title.length > 0 ? title : 'readdy');
  const wordCount = countChars(content);
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <title>${safeTitle}</title>
  ${HEAD_COMMON}
  <script>
    (function () {
      try {
        var t = localStorage.getItem('readdy.theme');
        var s = localStorage.getItem('readdy.size');
        var f = localStorage.getItem('readdy.font');
        var h = document.documentElement;
        if (t) h.setAttribute('data-theme', t);
        if (s) h.setAttribute('data-size', s);
        if (f) h.setAttribute('data-font', f);
      } catch (e) {}
    })();
  </script>
  <style>
    :root {
      --bg: #F4EDE0;
      --fg: #3a2f1f;
      --footer-fg: #a89878;
      --toolbar-bg: #ffffff;
      --toolbar-fg: #3a2f1f;
      --toolbar-border: #e3dccb;
      --toolbar-active-bg: #3a2f1f;
      --toolbar-active-fg: #F4EDE0;
      --font-size: 19px;
      --font-family: "Noto Serif TC", "Source Han Serif", serif;
    }
    [data-theme="dark"] {
      --bg: #1a1814;
      --fg: #e8dfcf;
      --footer-fg: #6b6253;
      --toolbar-bg: #2a2520;
      --toolbar-fg: #e8dfcf;
      --toolbar-border: #3a3530;
      --toolbar-active-bg: #e8dfcf;
      --toolbar-active-fg: #1a1814;
    }
    [data-size="small"] { --font-size: 16px; }
    [data-size="large"] { --font-size: 22px; }
    [data-font="sans"] {
      --font-family: "Noto Sans TC", "PingFang TC", -apple-system, sans-serif;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      background: var(--bg);
      font-family: var(--font-family);
      color: var(--fg);
      font-size: var(--font-size);
      line-height: 1.95;
      letter-spacing: .015em;
      -webkit-font-smoothing: antialiased;
      transition: background-color .2s ease, color .2s ease;
    }
    .reading {
      max-width: 720px;
      margin: 0 auto;
      padding: 96px 40px 56px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .footer {
      max-width: 720px;
      margin: 0 auto;
      padding: 0 40px 72px;
      font-family: "Inter", "Noto Sans TC", sans-serif;
      font-size: 12px;
      color: var(--footer-fg);
      letter-spacing: .04em;
    }
    @media (max-width: 600px) {
      :root { --font-size: 16px; }
      .reading { padding: 48px 24px 32px; }
      .footer { padding: 0 24px 48px; }
    }

    /* ─── toolbar ─── */
    #readdy-toolbar {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 100;
      font-family: "Inter", "Noto Sans TC", sans-serif;
    }
    #readdy-toolbar .readdy-toggle {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--toolbar-bg);
      color: var(--toolbar-fg);
      border: 1px solid var(--toolbar-border);
      box-shadow: 0 2px 12px rgba(0,0,0,.12);
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform .15s ease;
    }
    #readdy-toolbar .readdy-toggle:hover { transform: scale(1.05); }
    #readdy-toolbar .readdy-panel {
      position: absolute;
      bottom: 60px;
      right: 0;
      background: var(--toolbar-bg);
      color: var(--toolbar-fg);
      border: 1px solid var(--toolbar-border);
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,.15);
      padding: 14px 16px;
      min-width: 200px;
      display: none;
    }
    #readdy-toolbar.open .readdy-panel { display: block; }
    .readdy-group {
      margin-bottom: 12px;
    }
    .readdy-group:last-child { margin-bottom: 0; }
    .readdy-group-label {
      font-size: 11px;
      color: var(--footer-fg);
      letter-spacing: .08em;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .readdy-options {
      display: flex;
      gap: 6px;
    }
    .readdy-opt {
      flex: 1;
      padding: 6px 10px;
      font-size: 12px;
      background: transparent;
      color: var(--toolbar-fg);
      border: 1px solid var(--toolbar-border);
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
      transition: background-color .15s ease, color .15s ease;
    }
    .readdy-opt:hover { background: var(--toolbar-border); }
    .readdy-opt.active {
      background: var(--toolbar-active-bg);
      color: var(--toolbar-active-fg);
      border-color: var(--toolbar-active-bg);
    }
  </style>
</head>
<body>
  <article class="reading">${escapeHtml(content)}</article>
  <div class="footer">${formatChineseDate(created_at)} · ${wordCount} 字 · readdy</div>

  <div id="readdy-toolbar">
    <div class="readdy-panel">
      <div class="readdy-group">
        <div class="readdy-group-label">字級</div>
        <div class="readdy-options" data-key="size">
          <button class="readdy-opt" data-value="small">小</button>
          <button class="readdy-opt" data-value="">中</button>
          <button class="readdy-opt" data-value="large">大</button>
        </div>
      </div>
      <div class="readdy-group">
        <div class="readdy-group-label">字型</div>
        <div class="readdy-options" data-key="font">
          <button class="readdy-opt" data-value="">明體</button>
          <button class="readdy-opt" data-value="sans">黑體</button>
        </div>
      </div>
      <div class="readdy-group">
        <div class="readdy-group-label">主題</div>
        <div class="readdy-options" data-key="theme">
          <button class="readdy-opt" data-value="">米</button>
          <button class="readdy-opt" data-value="dark">夜</button>
        </div>
      </div>
    </div>
    <button class="readdy-toggle" type="button" aria-label="閱讀設定">Aa</button>
  </div>

  <script>
    (function () {
      var toolbar = document.getElementById('readdy-toolbar');
      var toggle = toolbar.querySelector('.readdy-toggle');
      var html = document.documentElement;

      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        toolbar.classList.toggle('open');
      });
      document.addEventListener('click', function (e) {
        if (!toolbar.contains(e.target)) toolbar.classList.remove('open');
      });

      function markActive() {
        var groups = toolbar.querySelectorAll('.readdy-options');
        groups.forEach(function (g) {
          var key = g.getAttribute('data-key');
          var current = html.getAttribute('data-' + key) || '';
          g.querySelectorAll('.readdy-opt').forEach(function (b) {
            if ((b.getAttribute('data-value') || '') === current) {
              b.classList.add('active');
            } else {
              b.classList.remove('active');
            }
          });
        });
      }

      toolbar.querySelectorAll('.readdy-opt').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var group = btn.closest('.readdy-options');
          var key = group.getAttribute('data-key');
          var value = btn.getAttribute('data-value') || '';
          if (value) {
            html.setAttribute('data-' + key, value);
            try { localStorage.setItem('readdy.' + key, value); } catch (e) {}
          } else {
            html.removeAttribute('data-' + key);
            try { localStorage.removeItem('readdy.' + key); } catch (e) {}
          }
          markActive();
        });
      });

      markActive();
    })();
  </script>
</body>
</html>`;
}

function renderNotFound() {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <title>readdy · 找不到</title>
  ${HEAD_COMMON}
  <style>
    html, body { height: 100%; margin: 0; }
    body {
      background: #F4EDE0;
      font-family: "Noto Serif TC", serif;
      color: #3a2f1f;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 18px;
    }
    p { font-size: 19px; margin: 0; letter-spacing: .015em; }
    a { color: #8a7755; font-size: 14px; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <p>這份文字找不到了。</p>
  <a href="/">← 回首頁</a>
</body>
</html>`;
}

module.exports = { escapeHtml, renderHomepage, renderReading, renderNotFound, countChars };
