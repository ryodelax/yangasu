/* ============================================================
   art.js — オリジナルSVG挿絵（フラットイラスト）
   ブランドグラデーション基調。ライト/ダーク両対応。
   currentColor を使い、線は半透明でテーマに馴染ませる。
   ============================================================ */

const Art = (() => {
  // 共通グラデーション定義（id衝突を避けるため呼び出しごとにユニーク化）
  let n = 0;
  function defs(id) {
    return `
      <defs>
        <linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#6c5ce7"/>
          <stop offset=".55" stop-color="#a29bfe"/>
          <stop offset="1" stop-color="#00cec9"/>
        </linearGradient>
        <linearGradient id="g${id}b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#00cec9"/>
          <stop offset="1" stop-color="#6c5ce7"/>
        </linearGradient>
      </defs>`;
  }
  const wrap = (vb, inner) => {
    const id = ++n;
    return `<svg class="art" viewBox="${vb}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">${defs(id)}${inner(id)}</svg>`;
  };

  // 半透明の下地・線（currentColorでテーマ追従）
  const SOFT = 'rgba(127,127,160,.16)';
  const LINE = 'currentColor';

  /* 案件・プロジェクト（積み重なったカード＋星） */
  function cases() {
    return wrap("0 0 240 180", (id) => `
      <ellipse cx="120" cy="158" rx="92" ry="12" fill="${SOFT}"/>
      <rect x="48" y="44" width="120" height="86" rx="14" fill="${SOFT}"/>
      <rect x="60" y="32" width="120" height="86" rx="14" fill="url(#g${id})"/>
      <rect x="74" y="50" width="92" height="10" rx="5" fill="#fff" opacity=".9"/>
      <rect x="74" y="68" width="64" height="8" rx="4" fill="#fff" opacity=".6"/>
      <rect x="74" y="84" width="78" height="8" rx="4" fill="#fff" opacity=".4"/>
      <circle cx="178" cy="112" r="20" fill="url(#g${id}b)" stroke="rgba(255,255,255,.5)" stroke-width="3"/>
      <path d="M178 104v16M170 112h16" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
      <circle cx="44" cy="40" r="5" fill="#00cec9" opacity=".8"/>
      <circle cx="196" cy="56" r="4" fill="#6c5ce7" opacity=".7"/>
    `);
  }

  /* 文字起こし（書類＋音声波形＋吹き出し） */
  function transcripts() {
    return wrap("0 0 240 180", (id) => `
      <ellipse cx="120" cy="158" rx="88" ry="12" fill="${SOFT}"/>
      <rect x="58" y="30" width="104" height="120" rx="12" fill="${SOFT}"/>
      <rect x="68" y="24" width="104" height="120" rx="12" fill="var(--surface-strong)" stroke="${LINE}" stroke-opacity=".18" stroke-width="2"/>
      <rect x="84" y="48" width="72" height="7" rx="3.5" fill="${LINE}" opacity=".35"/>
      <rect x="84" y="64" width="56" height="7" rx="3.5" fill="${LINE}" opacity=".22"/>
      <rect x="84" y="80" width="64" height="7" rx="3.5" fill="${LINE}" opacity=".22"/>
      <g stroke="url(#g${id})" stroke-width="5" stroke-linecap="round">
        <path d="M92 112v10"/><path d="M104 104v26"/><path d="M116 96v42"/>
        <path d="M128 108v18"/><path d="M140 100v34"/><path d="M152 110v14"/>
      </g>
      <circle cx="178" cy="44" r="22" fill="url(#g${id}b)"/>
      <path d="M170 40h16M170 48h10" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
      <path d="M164 60l-4 10 12-6z" fill="url(#g${id}b)"/>
    `);
  }

  /* フィードバック（吹き出し＋星評価） */
  function feedback() {
    return wrap("0 0 240 180", (id) => `
      <ellipse cx="120" cy="158" rx="86" ry="12" fill="${SOFT}"/>
      <path d="M52 44h120a16 16 0 0 1 16 16v44a16 16 0 0 1-16 16H96l-22 20v-20H52a16 16 0 0 1-16-16V60a16 16 0 0 1 16-16z" fill="url(#g${id})"/>
      <g fill="#fff">
        <path d="M84 70l4.5 9.2 10.2 1.5-7.3 7.2 1.7 10.1L84 103l-9.1 4.8 1.7-10.1-7.3-7.2 10.2-1.5z" opacity=".95"/>
      </g>
      <rect x="108" y="74" width="58" height="8" rx="4" fill="#fff" opacity=".75"/>
      <rect x="108" y="90" width="40" height="8" rx="4" fill="#fff" opacity=".5"/>
      <circle cx="196" cy="120" r="16" fill="var(--surface-strong)" stroke="${LINE}" stroke-opacity=".18" stroke-width="2"/>
      <path d="M190 120l4 4 8-9" stroke="#00cec9" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    `);
  }

  /* ワークフロー（カンバン3列） */
  function board() {
    return wrap("0 0 260 180", (id) => `
      <ellipse cx="130" cy="160" rx="104" ry="12" fill="${SOFT}"/>
      <g>
        <rect x="34" y="30" width="58" height="118" rx="12" fill="${SOFT}"/>
        <rect x="42" y="44" width="42" height="26" rx="7" fill="url(#g${id})"/>
        <rect x="42" y="76" width="42" height="26" rx="7" fill="var(--surface-strong)" stroke="${LINE}" stroke-opacity=".18" stroke-width="2"/>
      </g>
      <g>
        <rect x="101" y="30" width="58" height="118" rx="12" fill="${SOFT}"/>
        <rect x="109" y="44" width="42" height="26" rx="7" fill="url(#g${id}b)"/>
        <rect x="109" y="76" width="42" height="26" rx="7" fill="url(#g${id})"/>
      </g>
      <g>
        <rect x="168" y="30" width="58" height="118" rx="12" fill="${SOFT}"/>
        <rect x="176" y="44" width="42" height="26" rx="7" fill="var(--surface-strong)" stroke="${LINE}" stroke-opacity=".18" stroke-width="2"/>
      </g>
      <path d="M86 57h26" stroke="url(#g${id}b)" stroke-width="3" stroke-dasharray="3 4" stroke-linecap="round"/>
      <path d="M153 89h24" stroke="url(#g${id}b)" stroke-width="3" stroke-dasharray="3 4" stroke-linecap="round"/>
      <circle cx="130" cy="57" r="4" fill="#00cec9"/>
      <circle cx="197" cy="89" r="4" fill="#6c5ce7"/>
    `);
  }

  /* 検索なし */
  function search() {
    return wrap("0 0 240 180", (id) => `
      <ellipse cx="120" cy="158" rx="80" ry="12" fill="${SOFT}"/>
      <circle cx="108" cy="84" r="48" fill="${SOFT}"/>
      <circle cx="108" cy="84" r="38" fill="none" stroke="url(#g${id})" stroke-width="8"/>
      <path d="M138 114l28 28" stroke="url(#g${id})" stroke-width="10" stroke-linecap="round"/>
      <path d="M92 84h32M108 68v32" stroke="${LINE}" stroke-opacity=".3" stroke-width="4" stroke-linecap="round"/>
    `);
  }

  /* ダッシュボードのヒーロー（成長グラフ＋人） */
  function hero() {
    return wrap("0 0 320 180", (id) => `
      <rect x="20" y="24" width="200" height="132" rx="16" fill="var(--surface-strong)" stroke="${LINE}" stroke-opacity=".14" stroke-width="2"/>
      <path d="M40 120 L78 96 L110 108 L150 64 L196 40" fill="none" stroke="url(#g${id})" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M40 120 L78 96 L110 108 L150 64 L196 40 V140 H40 Z" fill="url(#g${id})" opacity=".12"/>
      <g fill="url(#g${id})">
        <circle cx="78" cy="96" r="5"/><circle cx="150" cy="64" r="5"/><circle cx="196" cy="40" r="6"/>
      </g>
      <rect x="40" y="40" width="40" height="8" rx="4" fill="${LINE}" opacity=".22"/>
      <circle cx="262" cy="92" r="30" fill="url(#g${id}b)"/>
      <circle cx="262" cy="82" r="11" fill="#fff" opacity=".95"/>
      <path d="M244 120a18 18 0 0 1 36 0z" fill="#fff" opacity=".95"/>
      <circle cx="296" cy="48" r="6" fill="#00cec9" opacity=".8"/>
      <circle cx="240" cy="40" r="4" fill="#6c5ce7" opacity=".7"/>
    `);
  }

  return { cases, transcripts, feedback, board, search, hero };
})();
