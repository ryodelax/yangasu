/******************************************************
 * 不動産手数料管理プラットフォーム（承認機能・完全版）
 * - フォーム連携による回答ID取得
 * - 二重計上防止ロジック
 * - 管理者メニュー（承認・差戻し）機能搭載
 ******************************************************/

// ===== 設定：担当者メールアドレス =====
const REP_EMAILS = {
  '神谷': 'kamiya@homesupport.jp',
  '葉栗': 'haguri@homesupport.jp',
  '東'  : 'eastocean33@gmail.com',
  '田邊': 'ken@homesupport.jp'
};
const PRESIDENT_EMAIL = 'ken@homesupport.jp';

// ===== シート定義 =====
const TX_SHEET = '入金台帳';
const ID_PREFIX = 'FY25-';

// ==========================================
//  メイン処理
// ==========================================
function onFormSubmit(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tx = ss.getSheetByName(TX_SHEET);
  if (!tx) return;

  // 1. 回答IDを取得する
  let responseId = null;
  let srcSheet, srcRow;

  try {
    if (e && e.range) {
      srcSheet = e.range.getSheet();
      srcRow = e.range.getRow();

      const formUrl = ss.getFormUrl();
      if (formUrl) {
        const form = FormApp.openByUrl(formUrl);
        const allResponses = form.getResponses();
        const index = srcRow - 2;
        if (index >= 0 && index < allResponses.length) {
          responseId = allResponses[index].getId();
        }
      }
    } else {
      // テスト実行用
      srcSheet = ss.getSheetByName('フォームの回答 1') || ss.getSheets()[0];
      srcRow = srcSheet.getLastRow();
      const formUrl = ss.getFormUrl();
      if (formUrl) {
        const form = FormApp.openByUrl(formUrl);
        const all = form.getResponses();
        if (all.length > 0) responseId = all[all.length - 1].getId();
      }
    }
  } catch (err) {
    console.error('ID取得エラー: ' + err);
  }

  // 読み込み準備
  if (!srcSheet || srcRow < 2) return;
  const srcHeaders = srcSheet.getRange(1, 1, 1, srcSheet.getLastColumn()).getValues()[0].map(String);
  const srcVals = srcSheet.getRange(srcRow, 1, 1, srcSheet.getLastColumn()).getValues()[0];

  // 2. 重複データの削除
  if (responseId) {
    deletePreviousRows_(tx, responseId);
  }

  // 3. 転記処理
  processSubmission_(ss, tx, srcHeaders, srcVals, responseId);

  // 4. 集計・ダッシュボード再生成
  try { rebuildAll_(); } catch (err) { console.error('rebuildAll error: ' + err); }
}

// ==========================================
//  ★管理者メニュー（承認・差戻し機能）
// ==========================================
function onOpen() {
  SpreadsheetApp.getUi().createMenu('★管理者メニュー')
    .addItem('1. 承認（選択行）', 'approveSelectedRows')
    .addItem('2. 差戻し（選択行）', 'rejectSelectedRows')
    .addSeparator()
    .addItem('3. 過去データに権限付与', 'addPresidentToAllRows')
    .addItem('4. 権限初期設定(初回のみ)', 'grantPermissions')
    .addSeparator()
    .addItem('5. ダッシュボード更新', 'refreshDashboards')
    .addToUi();
}

function approveSelectedRows() { setStatus_('承認'); }
function rejectSelectedRows() { setStatus_('差戻し'); }

function setStatus_(st) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(TX_SHEET);
  const rng = sh.getActiveRange();

  if (!rng || rng.getRow() < 2) {
    SpreadsheetApp.getUi().alert('データ行を選択してください（ヘッダー以外）。');
    return;
  }

  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const colIdx = headers.indexOf('ステータス') + 1;

  if (colIdx > 0) {
    sh.getRange(rng.getRow(), colIdx, rng.getNumRows(), 1).setValue(st);
  } else {
    SpreadsheetApp.getUi().alert('エラー：「ステータス」列が見つかりません。');
  }
}

// ==========================================
//  転記ロジック
// ==========================================
function processSubmission_(ss, tx, srcHeaders, srcVals, responseId) {
  // 同名ヘッダーが複数ある場合は「右側の非空」を優先
  const pick = (patterns, numberChar = null) => {
    let lastAny;
    let lastNonEmpty;
    let hasNonEmpty = false;

    for (let i = 0; i < srcHeaders.length; i++) {
      const header = String(srcHeaders[i]).trim();
      for (let p of patterns) {
        if (!p.test(header)) continue;

        if (numberChar) {
          const endsWith =
            header.endsWith(numberChar) ||
            header.endsWith(`(${numberChar})`) ||
            header.endsWith(`（${numberChar}）`);
          if (!header.startsWith(numberChar) && !endsWith) continue;
        }

        const v = srcVals[i];
        lastAny = v;
        if (v !== '' && v !== null && v !== undefined) {
          lastNonEmpty = v;
          hasNonEmpty = true;
        }
      }
    }

    return hasNonEmpty ? lastNonEmpty : (lastAny ?? '');
  };

  const base = {
    created_at: pick([/タイムスタンプ|送信日時/]),
    customer: pick([/お客様氏名|顧客名|氏名/]),
    address: pick([/物件所在地|住所/]),
    prop_name: pick([/物件名称|物件名/]),
    prop_type: pick([/物件タイプ/]),
    contract_date: pick([/契約日/]),
    rent: toNumber_(pick([/賃料/])),
    sales_rep: String(pick([/営業担当/]) || '').trim(),
    rep_email: '',
    guarantor: pick([/保証会社/]),
    insurer: pick([/損害保険会社/]),
    evidence: pick([/エビデンス|資料/]),
    total_sales: toNumber_(pick([/案件総売上/])),
    note: pick([/備考/])
  };

  let emails = [];
  if (REP_EMAILS[base.sales_rep]) emails.push(REP_EMAILS[base.sales_rep]);
  if (PRESIDENT_EMAIL && !emails.includes(PRESIDENT_EMAIL)) emails.push(PRESIDENT_EMAIL);
  base.rep_email = emails.join(',');

  const transactions = [];
  const suffixes = { 1: ['1','１','①'], 2: ['2','２','②'], 3: ['3','３','③'], 4: ['4','４','④'], 5: ['5','５','⑤'] };

  for (let i = 1; i <= 5; i++) {
    const numChars = suffixes[i];
    let actualDep = '', profit = '', feeCat = '', depDateRaw = '', salesDateRaw = '', bank = '';

    for (const char of numChars) {
      if (!actualDep) actualDep = toNumber_(pick([new RegExp(`実入金額.*${char}`), new RegExp(`入金額.*${char}`)], char));
      if (!profit)    profit    = toNumber_(pick([new RegExp(`売上確定額.*${char}`), new RegExp(`売上額.*${char}`), new RegExp(`売上.*利益.*${char}`)], char));
      if (!feeCat)    feeCat    = pick([new RegExp(`手数料区分.*${char}`), new RegExp(`区分.*${char}`)], char);
      if (!depDateRaw) depDateRaw = pick([new RegExp(`入金日.*${char}`), new RegExp(`実入金日.*${char}`)], char);
      if (!salesDateRaw) salesDateRaw = pick([new RegExp(`売上確定日.*${char}`), new RegExp(`確定日.*${char}`)], char);
      if (!bank)      bank      = pick([new RegExp(`入金先口座.*${char}`), new RegExp(`入金先.*${char}`), new RegExp(`口座.*${char}`)], char);
    }

    if (actualDep === '' && profit === '') continue;

    const txData = { ...base };
    txData.actual_deposit = actualDep;
    txData.profit = profit;
    txData.fee_cat = feeCat;
    txData.dep_date = isoToDate_(depDateRaw);
    txData.sales_date = salesDateRaw ? isoToDate_(salesDateRaw) : txData.dep_date;
    txData.bank = bank;
    txData.note = (txData.note ? txData.note + '\n' : '') + `[明細${i}]`;
    transactions.push(txData);
  }

  if (transactions.length === 0) return;

  const currentHeaders = tx.getRange(1, 1, 1, tx.getLastColumn()).getValues()[0].map(h => String(h).trim());
  let targetRow = tx.getLastRow() + 1;

  transactions.forEach(rec => {
    const set = (hName, val, format) => {
      const colIdx = currentHeaders.indexOf(hName) + 1;
      if (colIdx > 0) {
        const cell = tx.getRange(targetRow, colIdx);
        cell.setValue(val);
        if (format) cell.setNumberFormat(format);
      }
    };

    set('管理番号', nextTxId_(ss));
    set('作成日', new Date(rec.created_at || new Date()));
    set('担当者', rec.sales_rep);
    set('担当者Email', rec.rep_email);
    set('顧客名', rec.customer);
    set('住所', rec.address);
    set('物件名', rec.prop_name);
    set('物件タイプ', rec.prop_type);
    set('契約日', isoToDate_(rec.contract_date));
    set('賃料', rec.rent, '#,##0');
    set('手数料区分', rec.fee_cat);
    set('実入金額', rec.actual_deposit, '#,##0');
    set('売上(利益)', rec.profit, '#,##0');
    set('入金日', rec.dep_date, 'yyyy-mm-dd');
    set('売上確定日', rec.sales_date, 'yyyy-mm-dd');
    set('銀行名', rec.bank);
    set('保証会社', rec.guarantor);
    set('損害保険会社', rec.insurer);
    set('エビデンス資料', rec.evidence);
    set('案件総売上', rec.total_sales, '#,##0');
    set('備考欄', rec.note);
    if (responseId) set('回答ID', responseId);

    // ★ステータスは「入力」でセット（＝承認フローは残す）
    set('ステータス', '入力');
    set('入力者', Session.getActiveUser().getEmail());
    set('入力日時', new Date());

    targetRow++;
  });
}

function deletePreviousRows_(sheet, responseId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const colIdx = headers.indexOf('回答ID') + 1;
  if (colIdx === 0) return;

  const ids = sheet.getRange(2, colIdx, lastRow - 1, 1).getValues().flat();
  for (let i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i]) === String(responseId)) {
      sheet.deleteRow(i + 2);
    }
  }
}

function addPresidentToAllRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(TX_SHEET);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return;
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const colIdx = headers.indexOf('担当者Email') + 1;
  if (colIdx === 0) return;

  const range = sh.getRange(2, colIdx, lastRow - 1, 1);
  const values = range.getValues();
  const newValues = values.map(row => {
    let current = String(row[0]);
    if (current && !current.includes(PRESIDENT_EMAIL)) return [current + ',' + PRESIDENT_EMAIL];
    return [current];
  });
  range.setValues(newValues);
  SpreadsheetApp.getUi().alert('閲覧権限を更新しました。');
}

function grantPermissions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const url = ss.getFormUrl();
  if (url) {
    FormApp.openByUrl(url);
    SpreadsheetApp.getUi().alert('権限の確認が完了しました。');
  } else {
    SpreadsheetApp.getUi().alert('フォームが紐付いていません。');
  }
}

function nextTxId_(ss) {
  const sh = ss.getSheetByName(TX_SHEET);
  const last = sh.getLastRow();
  if (last < 2) return ID_PREFIX + '000001';
  const data = sh.getRange(2, 1, last - 1, 1).getValues().flat();
  let max = 0;
  data.forEach(v => {
    const m = String(v).match(/(\d{6})$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return ID_PREFIX + ('000000' + (max + 1)).slice(-6);
}

function toNumber_(v) {
  if (v == null || v === '') return '';
  const n = Number(String(v).replace(/[,\s¥円]/g, ''));
  return isNaN(n) ? '' : n;
}

function isoToDate_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return v;
  const s = String(v).replace(/\s/g, '');
  if (s.match(/^\d{4}-\d{2}-\d{2}$/)) return new Date(s);
  return v;
}
