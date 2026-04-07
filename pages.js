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

function renderReading({ id, content, created_at }) {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <title>readdy · ${id}</title>
  ${HEAD_COMMON}
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      background: #F4EDE0;
      font-family: "Noto Serif TC", "Source Han Serif", serif;
      color: #3a2f1f;
      font-size: 19px;
      line-height: 1.95;
      letter-spacing: .015em;
      -webkit-font-smoothing: antialiased;
    }
    .reading {
      max-width: 600px;
      margin: 0 auto;
      padding: 80px 32px 48px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .footer {
      max-width: 600px;
      margin: 0 auto;
      padding: 0 32px 64px;
      font-family: "Inter", "Noto Sans TC", sans-serif;
      font-size: 12px;
      color: #a89878;
      letter-spacing: .04em;
    }
    @media (max-width: 600px) {
      .reading { padding: 48px 24px 32px; font-size: 18px; }
      .footer { padding: 0 24px 48px; }
    }
  </style>
</head>
<body>
  <article class="reading">${escapeHtml(content)}</article>
  <div class="footer">${formatChineseDate(created_at)} · readdy</div>
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

module.exports = { escapeHtml, renderHomepage, renderReading, renderNotFound };
