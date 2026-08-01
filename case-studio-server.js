#!/usr/bin/env node
/**
 * Case Studio — サーバー版（マルチデバイス対応）
 * Node.js ビルトイン http モジュールで実装
 * 複数デバイスから同じデータにアクセス可能
 * （外部依存ゼロで動作します）
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, '.case-studio-data.json');
const CASE_STUDIO_HTML = path.join(__dirname, 'case-studio.html');

// ========== ストレージ処理 ==========
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('Failed to load data:', e.message);
  }
  return initializeData();
}

function saveData(data) {
  try {
    data.updatedAt = Date.now();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save data:', e.message);
    throw e;
  }
}

function initializeData() {
  const now = Date.now();
  const day = 86400000;
  const c1 = 'c_demo1', c2 = 'c_demo2';
  return {
    version: 1,
    updatedAt: now,
    cases: [
      {
        id: c1, title: 'ブリッジ社 CFダッシュボード改修', client: '株式会社ブリッジ',
        status: 'progress', priority: 'high', progress: 60,
        tags: ['経理', 'GAS', 'Looker'],
        description: 'キャッシュフロー表の自動反映ロジックを刷新。手数料入金の消し込みルールを見直し、Looker連携の再認可も対応する。',
        createdAt: now - day * 12, dueDate: new Date(now + day * 9).toISOString().slice(0, 10),
      },
      {
        id: c2, title: 'コンテンツ壁打ちBot 改善', client: '社内プロジェクト',
        status: 'review', priority: 'mid', progress: 80,
        tags: ['Slack', 'GAS', 'AI'],
        description: 'Slackコマンド追加後の再インストール運用を整備。3秒制約を非同期トリガーで回避する構成に。',
        createdAt: now - day * 30, dueDate: new Date(now + day * 3).toISOString().slice(0, 10),
      },
    ],
    transcripts: [],
    feedbacks: [],
    milestones: [],
  };
}

// ========== リクエストハンドラー ==========
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS ヘッダー設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // API: データ全体を取得
    if (pathname === '/api/data' && req.method === 'GET') {
      const data = loadData();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    // API: データを更新
    if (pathname === '/api/data' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          saveData(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, updatedAt: data.updatedAt }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // API: リセット
    if (pathname === '/api/reset' && req.method === 'POST') {
      const data = initializeData();
      saveData(data);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // ルート：HTML を返す
    if (pathname === '/') {
      const html = fs.readFileSync(CASE_STUDIO_HTML, 'utf8');
      const modifiedHtml = html.replace(
        '</head>',
        `<script>localStorage.setItem('cs-api-base', 'http://' + window.location.host);</script></head>`
      );
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(modifiedHtml);
      return;
    }

    // スタティックファイル：html, js, css など
    const ext = path.extname(pathname);
    if (['.html', '.js', '.css', '.json', '.png', '.jpg', '.gif', '.svg'].includes(ext)) {
      const filePath = path.join(__dirname, pathname);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath);
        const mimeTypes = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        res.end(content);
        return;
      }
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  } catch (e) {
    console.error('Request error:', e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Case Studio サーバーが起動しました！`);
  console.log(`📱 http://localhost:${PORT} でアクセスしてください`);
  console.log(`🖥️  パソコンとスマホから同じ URL でアクセスすると、データが同期されます`);
  console.log(`💾 データは ${DATA_FILE} に保存されています\n`);
});
