/******************************************************
 * 集計エンジン（スキーマ耐性・ゆるい一致版）
 *  - 入金台帳をヘッダー名で読む（列順が変わっても壊れない）
 *  - グルーピングは normalizeKey_ で半角/全角・スペース・大小文字を吸収
 *  - 月次ビュー（全期間の件数集計）と ダッシュボード（売上確定日で月次）を再生成
 ******************************************************/

const AGG = {
  TX: '入金台帳',
  MONTHLY: '月次ビュー',
  DASH: 'ダッシュボード',
  // 集計の日付軸：売上確定日 / フィルタ：全件（ステータス不問）
  DATE_FIELD: '売上確定日'
};

// ===== ゆるい一致のためのキー正規化 =====
function normalizeKey_(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  try { s = s.normalize('NFKC'); } catch (e) {}   // 半角全角・記号を統一
  s = s.replace(/\s+/g, ' ').trim().toUpperCase();  // 空白圧縮・前後除去・大文字化
  return s;
}

// ===== 入金台帳をヘッダー名で読み、オブジェクト配列に =====
function readLedger_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(AGG.TX);
  if (!sh) return { headers: [], rows: [] };
  const lr = sh.getLastRow();
  const lc = sh.getLastColumn();
  if (lr < 2) return { headers: [], rows: [] };
  const headers = sh.getRange(1, 1, 1, lc).getValues()[0].map(h => String(h).trim());
  const data = sh.getRange(2, 1, lr - 1, lc).getValues();
  const idx = {};
  headers.forEach((h, i) => { if (idx[h] === undefined) idx[h] = i; });
  const rows = data.map(r => ({
    get: (name) => { const i = idx[name]; return i === undefined ? '' : r[i]; }
  }));
  return { headers, idx, rows };
}

// ===== 日付パース（Date / "yyyy-mm-dd" / "yyyy/mm/dd" 等を許容、不正は null）=====
// 2000年より前の日付は「0001/01/01」等の入力ミス扱いで無効化（グラフの軸汚染を防ぐ）
function toDate_(v) {
  if (v === null || v === undefined || v === '') return null;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return null;
    return v.getFullYear() < 2000 ? null : v;
  }
  const s = String(v).trim().replace(/\./g, '-').replace(/\//g, '-');
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const y = Number(m[1]);
    if (y < 2000) return null;
    const d = new Date(y, Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null; // "2025-1205" のような壊れた値は除外
}

function toNum_(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).replace(/[,\s¥円]/g, ''));
  return isNaN(n) ? 0 : n;
}

// 件数集計：[{key,label,count}] を count降順で返す（ゆるい一致でグルーピング）
function countBy_(rows, fieldName) {
  const map = {};
  rows.forEach(r => {
    const raw = r.get(fieldName);
    if (raw === '' || raw === null || raw === undefined) return;
    const key = normalizeKey_(raw);
    if (!key) return;
    if (!map[key]) map[key] = { label: String(raw).trim(), count: 0 };
    map[key].count++;
  });
  return Object.keys(map).map(k => map[k]).sort((a, b) => b.count - a.count);
}

// ==========================================
//  月次ビュー（全期間・件数集計）の再生成
// ==========================================
function rebuildMonthlyView_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(AGG.MONTHLY);
  if (!sh) return;
  const { rows } = readLedger_();

  // 各ディメンションの (見出し, 入金台帳の列名, 出力開始列)
  const blocks = [
    { title: '物件タイプ',         field: '物件タイプ',     col: 3 },
    { title: '手数料区分',         field: '手数料区分',     col: 6 },
    { title: '入金先（銀行名）',   field: '銀行名',         col: 9 },
    { title: '保証会社',           field: '保証会社',       col: 12 },
    { title: '損害保険会社',       field: '損害保険会社',   col: 15 },
    { title: '営業担当',           field: '担当者',         col: 18 }
  ];

  // 既存の集計エリア（1行目以降）をクリア
  const maxRows = Math.max(sh.getMaxRows(), 2);
  blocks.forEach(b => {
    sh.getRange(1, b.col, maxRows, 2).clearContent();
  });

  blocks.forEach(b => {
    const agg = countBy_(rows, b.field);
    const out = [[b.title, '件数']];
    agg.forEach(a => out.push([a.label, a.count]));
    sh.getRange(1, b.col, out.length, 2).setValues(out);
  });
}

// ==========================================
//  ダッシュボード（売上確定日で当月／全件）の再生成
// ==========================================
function rebuildDashboard_(opt) {
  opt = opt || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(AGG.DASH);
  if (!sh) return;
  const { rows } = readLedger_();

  // 対象月（C2）を取得。空・データ無しの場合は最新のデータがある月にフォールバック
  let monthStart = monthFromCell_(sh.getRange('C2').getValue());

  const inMonth = (start) => {
    if (!start) return [];
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return rows.filter(r => {
      const d = toDate_(r.get(AGG.DATE_FIELD));
      return d && d >= start && d < end;
    });
  };

  let target = inMonth(monthStart);

  // データが無ければ、売上確定日がある最新月に自動設定
  if ((!monthStart || target.length === 0) && opt.autoPickMonth !== false) {
    const latest = latestDataMonth_(rows);
    if (latest) {
      monthStart = latest;
      sh.getRange('C2').setValue(latest); // セルも更新（=対象年月を表示）
      target = inMonth(monthStart);
    }
  }

  // --- スカラー指標 ---
  const totalCount = target.length;
  const totalSales = target.reduce((s, r) => s + toNum_(r.get('売上(利益)')), 0);
  // 承認待ち＝当月のうち「承認」でも空でもない（入力/差戻し）件数
  const pending = target.filter(r => {
    const st = String(r.get('ステータス')).trim();
    return st !== '' && st !== '承認';
  }).length;

  sh.getRange('B5').setValue(totalCount);
  sh.getRange('D5').setValue(totalSales);
  sh.getRange('F5').setValue(pending);

  // 見出しを実態（全件集計）に合わせて上書き
  sh.getRange('B4').setValue('今月件数合計');
  sh.getRange('F4').setValue('うち承認待ち件数');
  sh.getRange('B8').setValue('担当別ランキング (売上確定月/全件)');
  sh.getRange('F8').setValue('区分別内訳 (売上確定月/全件)');

  // --- 担当別ランキング（B10見出し / B11〜） ---
  const repMap = {};
  target.forEach(r => {
    const raw = r.get('担当者');
    const key = normalizeKey_(raw);
    if (!key) return;
    if (!repMap[key]) repMap[key] = { label: String(raw).trim(), count: 0, sales: 0 };
    repMap[key].count++;
    repMap[key].sales += toNum_(r.get('売上(利益)'));
  });
  const reps = Object.keys(repMap).map(k => repMap[k]).sort((a, b) => b.sales - a.sales);
  const repRows = Math.max(sh.getMaxRows() - 10, 1);
  sh.getRange(11, 2, repRows, 3).clearContent();
  if (reps.length) {
    sh.getRange(11, 2, reps.length, 3).setValues(reps.map(x => [x.label, x.count, x.sales]));
  }

  // --- 区分別内訳（F10見出し / F11〜） ---
  const catMap = {};
  target.forEach(r => {
    const raw = r.get('手数料区分');
    const key = normalizeKey_(raw);
    if (!key) return;
    if (!catMap[key]) catMap[key] = { label: String(raw).trim(), sales: 0 };
    catMap[key].sales += toNum_(r.get('売上(利益)'));
  });
  const cats = Object.keys(catMap).map(k => catMap[k]).sort((a, b) => b.sales - a.sales);
  const catRows = Math.max(sh.getMaxRows() - 10, 1);
  sh.getRange(11, 6, catRows, 2).clearContent();
  if (cats.length) {
    sh.getRange(11, 6, cats.length, 2).setValues(cats.map(x => [x.label, x.sales]));
  }
}

// C2の値（Date / "2026/03" / "2026-03" 等）から当月1日のDateを得る
function monthFromCell_(v) {
  if (v === null || v === undefined || v === '') return null;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return new Date(v.getFullYear(), v.getMonth(), 1);
  }
  const s = String(v).trim().replace(/\./g, '-').replace(/\//g, '-');
  const m = s.match(/^(\d{4})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return null;
}

// 売上確定日が入っている最新の月（1日）を返す
function latestDataMonth_(rows) {
  let latest = null;
  rows.forEach(r => {
    const d = toDate_(r.get(AGG.DATE_FIELD));
    if (d && (!latest || d > latest)) latest = d;
  });
  return latest ? new Date(latest.getFullYear(), latest.getMonth(), 1) : null;
}

// ==========================================
//  個人成績データ（フラット表）の再生成
//   - 入金台帳から「1行=1案件」の平らな表を作成（Looker接続用）
//   - 既存レポートのフィールド名に合わせた列名
// ==========================================
const FLAT_SHEET = '個人成績データ';
function rebuildFlatTable_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const { rows } = readLedger_();
  let sh = ss.getSheetByName(FLAT_SHEET);
  if (!sh) sh = ss.insertSheet(FLAT_SHEET);

  const header = [
    '管理番号', '日付', '売上確定日', '入金日', '担当者', '担当者Email', '顧客名', '物件名',
    '物件タイプ', '手数料区分', '売上', '実入金額', '銀行名', '保証会社',
    '損害保険会社', '売上計上月', 'ステータス', '備考'
  ];

  // 担当者名→メール（行レベルセキュリティ用）。REP_EMAILS は コード.js のグローバル定義
  // [一時テスト] 下記マップにある担当者はテスト用メールに上書き（テスト後は {} に戻す）
  const TEST_EMAIL_OVERRIDE = {};
  const repEmail = (name) => {
    const n = String(name || '').trim();
    if (TEST_EMAIL_OVERRIDE[n]) return TEST_EMAIL_OVERRIDE[n];
    return (typeof REP_EMAILS !== 'undefined' && REP_EMAILS[n]) ? REP_EMAILS[n] : '';
  };

  const data = rows.map(r => {
    const kakutei = toDate_(r.get('売上確定日'));
    const nyukin = toDate_(r.get('入金日'));
    const hizuke = kakutei || nyukin || ''; // 売上確定日優先、無ければ入金日
    const rep = String(r.get('担当者') || '').trim();
    return [
      r.get('管理番号'),
      hizuke,
      kakutei || '',
      nyukin || '',
      rep,
      repEmail(rep),
      r.get('顧客名'),
      r.get('物件名'),
      r.get('物件タイプ'),
      r.get('手数料区分'),
      toNum_(r.get('売上(利益)')),
      toNum_(r.get('実入金額')),
      r.get('銀行名'),
      r.get('保証会社'),
      r.get('損害保険会社'),
      r.get('売上計上月'),
      String(r.get('ステータス') || '').trim(),
      r.get('備考欄')
    ];
  });

  // 既存内容をクリアして書き直し（行数が減っても残骸が出ないように）
  sh.clearContents();
  sh.getRange(1, 1, 1, header.length).setValues([header]);
  if (data.length) {
    sh.getRange(2, 1, data.length, header.length).setValues(data);
  }
  // 日付列の表示形式
  if (data.length) {
    sh.getRange(2, 2, data.length, 3).setNumberFormat('yyyy-mm-dd'); // 日付/売上確定日/入金日
    sh.getRange(2, 10, data.length, 2).setNumberFormat('#,##0');      // 売上/実入金額
  }
}

// ==========================================
//  まとめて再生成
// ==========================================
function rebuildAll_() {
  rebuildMonthlyView_();
  rebuildDashboard_();
  rebuildFlatTable_();
}

// メニュー / 手動実行用
function refreshDashboards() {
  rebuildAll_();
  try { SpreadsheetApp.getActiveSpreadsheet().toast('集計を更新しました', 'ダッシュボード', 5); } catch (e) {}
}

// 編集時の自動更新（簡易トリガー）：C2変更 or 入金台帳の編集で再生成
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sh = e.range.getSheet();
    const name = sh.getName();
    if (name === AGG.TX) {
      rebuildAll_();
    } else if (name === AGG.DASH && e.range.getA1Notation() === 'C2') {
      rebuildDashboard_({ autoPickMonth: false }); // ユーザーが選んだ月を尊重
    }
  } catch (err) {
    console.error('onEdit rebuild error: ' + err);
  }
}
