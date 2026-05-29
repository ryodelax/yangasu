// ============================================================
// コンクエスト集約請求・入金管理 Apps Script
// 実行場所: 入金管理スプレッドシート
// 対象シート: 売掛入金見込み管理（既存）に列を追加して管理
// ============================================================

const SS_SHIHARAI = '12Z7hFDO9f8JMTdVYqNCx_1QbgjXmoAqWYJDiUkakuHE';
const SS_CF       = '1MDvEoagoAtI99I2v3zcv3O_KJV1yLGR61OOoCWHMTRc';

// 売掛入金見込み管理の既存列（変更しない）
const COL_URIAGEDUKI  = 1;  // A: 売上月
const COL_NYUKIN_YTD  = 2;  // B: 入金予定月末
const COL_CQ_LABEL    = 3;  // C: コンクエスト請求ラベル
const COL_CQ_AMT      = 4;  // D: コンクエスト請求額
// E〜K: 売掛金関連（触らない）

// 追加する列（L以降）
const COL_INV_NO      = 12; // L: 請求書番号
const COL_INV_AMT     = 13; // M: 請求書金額
const COL_DUE_DATE    = 14; // N: 入金予定日（請求書から）
const COL_MATCH_DATE  = 15; // O: 銀行消込日
const COL_REAL_AMT    = 16; // P: 実入金額
const COL_DIFF        = 17; // Q: 差異（請求書金額 - 実入金額）
const COL_STATUS      = 18; // R: 状態

// ============================================================
// メニュー
// ============================================================
function onOpenConquestManagerLegacy_() {
  SpreadsheetApp.getUi()
    .createMenu('コンクエスト管理')
    .addItem('① 管理列を初期化（初回のみ）', 'initColumns')
    .addSeparator()
    .addItem('② 銀行データを同期', 'syncBankData')
    .addItem('③ 請求書・銀行を照合して状態更新', 'runMatching')
    .addItem('④ CF表（入金明細【17期】）に反映', 'reflectToCF')
    .addSeparator()
    .addItem('🔄 ②〜④ 一括実行', 'runAll')
    .addToUi();
}

function runAll() {
  syncBankData();
  runMatching();
  reflectToCF();
  SpreadsheetApp.getUi().alert('完了しました。');
}

// ============================================================
// 初回: 売掛入金見込み管理にヘッダー列を追加
// ============================================================
function initColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('売掛入金見込み管理');
  if (!sheet) { alert_('売掛入金見込み管理シートが見つかりません'); return; }

  const headers = ['請求書番号', '請求書金額', '入金予定日', '銀行消込日', '実入金額', '差異', '状態'];
  sheet.getRange(1, COL_INV_NO, 1, headers.length).setValues([headers])
    .setBackground('#4a86e8').setFontColor('#ffffff').setFontWeight('bold');

  // 状態列にドロップダウン
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['入金予定', '請求済未入金', '入金実績', '差異・要確認'], true).build();
  sheet.getRange(2, COL_STATUS, 200).setDataValidation(rule);

  SpreadsheetApp.getUi().alert('L〜R列にヘッダーを追加しました。\n次に「② 銀行データを同期」→「③ 照合」の順で実行してください。');
}

// ============================================================
// ② 銀行データ同期（入金借方 + 支払い貸方 → 全銀行データ隠しシート）
// ============================================================
function syncBankData() {
  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const inBank = ss.getSheetByName('銀行データチェック用');
  if (!inBank) { alert_('銀行データチェック用シートが見つかりません'); return; }

  // 入金SS借方: 日付(A) 相手科目(B) 相手摘要(C) 金額(D) 業務No.(E) 顧客No.(F) ステータス(G) 入金月(H)
  const debitData = inBank.getDataRange().getValues().slice(1).filter(r => r[0]);

  // 支払いSS貸方
  let creditData = [];
  try {
    const outSS = SpreadsheetApp.openById(SS_SHIHARAI);
    const outBank = outSS.getSheetByName('銀行データチェック用');
    if (outBank) creditData = outBank.getDataRange().getValues().slice(1).filter(r => r[0]);
  } catch(e) { Logger.log('支払いSS読み込みエラー: ' + e.message); }

  const merged = [['日付','種別','相手科目','相手摘要','金額','業務No./自摘要','ステータス','入金月']];
  debitData.forEach(r => merged.push([r[0],'借方（入金）', r[1]||'', r[2]||'', r[3]||0, r[4]||'', r[6]||'', r[7]||'']));
  creditData.forEach(r => merged.push([r[0],'貸方（支払い）', r[1]||'', r[2]||'', r[3]||0, r[4]||'', '', '']));

  // 隠しシートへ書き込み（入金SS）
  let hidden = ss.getSheetByName('全銀行データ');
  if (!hidden) { hidden = ss.insertSheet('全銀行データ'); hidden.hideSheet(); }
  hidden.clearContents();
  hidden.getRange(1, 1, merged.length, 8).setValues(merged);

  // 支払いSSにも同期
  try {
    const outSS = SpreadsheetApp.openById(SS_SHIHARAI);
    let hiddenOut = outSS.getSheetByName('全銀行データ');
    if (!hiddenOut) { hiddenOut = outSS.insertSheet('全銀行データ'); hiddenOut.hideSheet(); }
    hiddenOut.clearContents();
    hiddenOut.getRange(1, 1, merged.length, 8).setValues(merged);
  } catch(e) { Logger.log('支払いSSへの同期エラー: ' + e.message); }

  Logger.log('銀行同期完了: 借方' + debitData.length + '件 / 貸方' + creditData.length + '件');
}

// ============================================================
// ③ 照合（請求書 + 銀行 → 売掛入金見込み管理 L〜R列を更新）
// ============================================================
function runMatching() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const urikake = ss.getSheetByName('売掛入金見込み管理');
  const invSheet = ss.getSheetByName('請求書発行');
  const bankHidden = ss.getSheetByName('全銀行データ');
  const matchMaster = ss.getSheetByName('照合学習マスタ');

  if (!urikake) { alert_('売掛入金見込み管理シートが見つかりません'); return; }

  // --- 請求書発行シートをMap化（取引先×対象月 → 請求書情報）---
  const invMap = {};
  if (invSheet) {
    const invHeaders = invSheet.getRange(1,1,1,invSheet.getLastColumn()).getValues()[0];
    const iDate  = invHeaders.indexOf('取引日');
    const iTori  = invHeaders.indexOf('取引先');
    const iBango = invHeaders.indexOf('伝票番号');
    const iTotal = invHeaders.indexOf('合計');
    const iDue   = invHeaders.indexOf('入金予定日');
    const iURL   = invHeaders.indexOf('ファイルURL');

    invSheet.getDataRange().getValues().slice(1).forEach(r => {
      if (!r[iDate]) return;
      const d = new Date(r[iDate]);
      const ym = ymStr(d);
      const key = ym + '_' + String(r[iTori] || '').trim();
      invMap[key] = {
        bango: r[iBango], total: r[iTotal],
        date:  r[iDate],  due:   r[iDue], url: r[iURL]
      };
    });
  }

  // --- 銀行データをMap化（借方のみ）---
  const bankRows = bankHidden
    ? bankHidden.getDataRange().getValues().slice(1).filter(r => r[1] === '借方（入金）')
    : [];

  // --- 照合学習マスタ: キーワード → 想定請求先 ---
  const matchRules = [];
  if (matchMaster) {
    matchMaster.getDataRange().getValues().slice(1).forEach(r => {
      const keyword = String(r[8] || r[0] || '').trim(); // 照合優先キー or 摘要原文
      const seikyu  = String(r[7] || '').trim();          // 想定請求先
      const auto    = (r[9] === true || r[9] === 'TRUE');
      if (keyword && seikyu && auto) {
        matchRules.push({
          keyword,
          seikyu,
          normalizedKeyword: normalizeConquestText_(keyword),
          normalizedSeikyu: normalizeConquestText_(seikyu)
        });
      }
    });
  }

  // --- 売掛入金見込み管理を行ごとに処理 ---
  const data = urikake.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const sellMonth = row[COL_URIAGEDUKI - 1];   // A: 売上月
    const cqLabel   = String(row[COL_CQ_LABEL - 1] || '').trim(); // C: ラベル
    const cqAmt     = Number(row[COL_CQ_AMT - 1]) || 0;           // D: 請求額

    if (!sellMonth || cqAmt === 0) continue;

    const ym = ymStr(new Date(sellMonth));
    const normalizedLabel = normalizeConquestText_(cqLabel);

    // 請求書照合: ラベルに含まれるキーワードで取引先を推定
    // → 照合学習マスタの「想定請求先」でフォールバック
    const inv = findConquestInvoiceMatch_(ym, cqLabel, cqAmt, invMap);

    // 銀行消し込み: 照合学習マスタのルールで摘要一致
    let matchedBank = null;
    if (matchRules.length > 0) {
      // コンクエスト関連のラベルに合うルールを絞る
      const rules = matchRules.filter(r =>
        !!r.normalizedSeikyu &&
        (
          normalizedLabel.indexOf(r.normalizedSeikyu) >= 0 ||
          r.normalizedSeikyu.indexOf(normalizedLabel) >= 0
        )
      );
      // 入金予定月末の前後2ヶ月で探す
      const dueEnd = row[COL_NYUKIN_YTD - 1] ? new Date(row[COL_NYUKIN_YTD - 1]) : null;
      const searchFrom = dueEnd ? new Date(dueEnd.getFullYear(), dueEnd.getMonth() - 1, 1) : null;
      const searchTo   = dueEnd ? new Date(dueEnd.getFullYear(), dueEnd.getMonth() + 2, 0) : null;

      matchedBank = findConquestBankMatch_(bankRows, rules, searchFrom, searchTo, cqAmt);
    }

    // --- 書き込み（既存の手入力値は上書きしない）---
    const existInvNo = row[COL_INV_NO - 1];

    if (inv && !existInvNo) {
      urikake.getRange(i + 1, COL_INV_NO).setValue(inv.bango);
      urikake.getRange(i + 1, COL_INV_AMT).setValue(inv.total);
      urikake.getRange(i + 1, COL_DUE_DATE).setValue(inv.due);
    }

    if (matchedBank) {
      urikake.getRange(i + 1, COL_MATCH_DATE).setValue(matchedBank[0]);
      urikake.getRange(i + 1, COL_REAL_AMT).setValue(Math.abs(Number(matchedBank[4])));
    }

    // 差異 = 請求書金額 - 実入金額（請求書金額があれば）
    const invAmt  = Number(urikake.getRange(i + 1, COL_INV_AMT).getValue()) || 0;
    const realAmt = Number(urikake.getRange(i + 1, COL_REAL_AMT).getValue()) || 0;
    if (invAmt > 0 && realAmt > 0) {
      urikake.getRange(i + 1, COL_DIFF).setValue(invAmt - realAmt);
    }

    // 状態を自動判定（手動上書きを尊重: 既に「解決済」等が入っていれば変えない）
    const currentStatus = String(row[COL_STATUS - 1] || '');
    if (!currentStatus || currentStatus === '入金予定' || currentStatus === '請求済未入金' || currentStatus === '入金実績' || currentStatus === '差異・要確認') {
      const newStatus = calcStatus(
        urikake.getRange(i + 1, COL_INV_NO).getValue(),
        urikake.getRange(i + 1, COL_REAL_AMT).getValue(),
        urikake.getRange(i + 1, COL_DIFF).getValue()
      );
      const statusCell = urikake.getRange(i + 1, COL_STATUS);
      statusCell.setValue(newStatus);
      statusCell.setBackground(statusColor(newStatus));
    }
  }

  Logger.log('照合完了');
}

// ============================================================
// ④ CF表（入金明細【17期】）に反映
// ============================================================
function reflectToCF() {
  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const urikake  = ss.getSheetByName('売掛入金見込み管理');
  const cfSS     = SpreadsheetApp.openById(SS_CF);
  const cfSheet  = cfSS.getSheetByName('入金明細【17期】');

  if (!urikake || !cfSheet) {
    alert_('シートが見つかりません（売掛入金見込み管理 または 入金明細【17期】）');
    return;
  }

  // --- コンクエスト列を探す or 作成 ---
  // 小計列: D=4, M=13, T=20 → 書込み禁止
  // お客様グループ (T以降): U=21〜
  // ルール: 2行目のラベル列(奇数)+金額列(偶数)のペア
  const SKIP_COLS = new Set([4, 13, 20]);
  const row2 = cfSheet.getRange(2, 1, 1, Math.max(cfSheet.getLastColumn(), 30)).getValues()[0];

  let cqLabelCol = -1, cqAmtCol = -1;
  for (let c = 20; c < row2.length; c++) { // U列(21)以降を0-basedで探す
    if (SKIP_COLS.has(c + 1)) continue;
    if (String(row2[c]).trim() === 'コンクエスト') {
      cqLabelCol = c + 1;
      cqAmtCol   = c + 2;
      break;
    }
  }

  if (cqLabelCol < 0) {
    // 新規: お客様グループの次の空き列を探す
    let col = 22; // V列から（U=21はお客様関連ラベルで使用中のため）
    while (SKIP_COLS.has(col) || String(row2[col - 1]).trim() !== '') col++;
    cqLabelCol = col;
    cqAmtCol   = col + 1;
    cfSheet.getRange(2, cqLabelCol).setValue('コンクエスト');
    Logger.log('コンクエスト列を新規作成: 列' + cqLabelCol);
  }

  // --- CF表の日付→行番号マップ（B列）---
  const bCol = cfSheet.getRange(1, 2, cfSheet.getLastRow(), 1).getValues();
  const dateRowMap = {};
  bCol.forEach((r, i) => {
    if (r[0] instanceof Date) dateRowMap[fmtDate(r[0])] = i + 1;
  });

  // --- 既存のコンクエスト反映をクリア（再描画）---
  const cfLast = cfSheet.getLastRow();
  if (cfLast >= 3) {
    cfSheet.getRange(3, cqLabelCol, cfLast - 2, 2).clearContent().clearFormat();
  }

  // --- 売掛入金見込み管理の各行を反映 ---
  const data = urikake.getDataRange().getValues().slice(1);
  data.forEach(row => {
    const sellMonth = row[COL_URIAGEDUKI - 1];
    const cqLabel   = String(row[COL_CQ_LABEL - 1] || '').trim();
    const cqAmt     = Number(row[COL_CQ_AMT - 1]) || 0;
    const dueDate   = row[COL_DUE_DATE - 1]  || row[COL_NYUKIN_YTD - 1]; // N列 or B列
    const matchDate = row[COL_MATCH_DATE - 1];
    const realAmt   = Number(row[COL_REAL_AMT - 1]) || 0;
    const status    = String(row[COL_STATUS - 1] || '入金予定');

    if (!sellMonth || cqAmt === 0) return;

    // 書込む日付: 実績なら消込日、それ以外は入金予定日 or 月末
    let targetDate = matchDate && status === '入金実績' ? matchDate : dueDate;
    if (!targetDate) {
      // 月末にフォールバック
      const d = new Date(sellMonth);
      targetDate = new Date(d.getFullYear(), d.getMonth() + 2, 0);
    }

    const rowNum = dateRowMap[fmtDate(new Date(targetDate))];
    if (!rowNum) return;

    const amount = status === '入金実績' ? realAmt : cqAmt;

    // ラベル列（コンクエスト請求ラベルをそのまま使用）
    const existLabel = cfSheet.getRange(rowNum, cqLabelCol).getValue();
    cfSheet.getRange(rowNum, cqLabelCol)
      .setValue(existLabel ? existLabel + ' / ' + cqLabel : cqLabel);

    // 金額列
    const existAmt = Number(cfSheet.getRange(rowNum, cqAmtCol).getValue()) || 0;
    const amtCell  = cfSheet.getRange(rowNum, cqAmtCol);
    amtCell.setValue(existAmt + amount);
    amtCell.setBackground(statusColor(status));
  });

  Logger.log('CF反映完了: 入金明細【17期】 列' + cqLabelCol + ',' + cqAmtCol);
  SpreadsheetApp.getUi().alert('CF表への反映が完了しました。');
}

// ============================================================
// ユーティリティ
// ============================================================
function calcStatus(invNo, realAmt, diff) {
  if (realAmt > 0 && Math.abs(diff) > 1000) return '差異・要確認';
  if (realAmt > 0) return '入金実績';
  if (invNo)       return '請求済未入金';
  return '入金予定';
}

function statusColor(status) {
  return {
    '入金実績':     '#b7e1cd',
    '請求済未入金': '#fff2cc',
    '入金予定':     '#cfe2f3',
    '差異・要確認': '#f4cccc'
  }[status] || null;
}

function ymStr(d) {
  return d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0');
}

function normalizeConquestText_(value) {
  let text = String(value || '').trim();
  if (!text) return '';
  if (text.normalize) text = text.normalize('NFKC');
  return text
    .toUpperCase()
    .replace(/株式会社|有限会社|合同会社|\(株\)|㈱|\(有\)|（株）|（有）/g, '')
    .replace(/御中|様|代表取締役|社長|理事長|院長/g, '')
    .replace(/[ 　\t\r\n\-‐‑‒–—―ーｰ・･,，、.．'`"\/\\()（）[\]【】]/g, '');
}

function findConquestInvoiceMatch_(ym, cqLabel, cqAmt, invMap) {
  const normalizedLabel = normalizeConquestText_(cqLabel);
  const monthly = Object.keys(invMap)
    .filter(key => key.startsWith(ym))
    .map(key => {
      const vendor = key.split('_')[1] || '';
      const invoice = invMap[key];
      const normalizedVendor = normalizeConquestText_(vendor);
      let score = 0;

      if (normalizedLabel && normalizedVendor) {
        if (normalizedLabel === normalizedVendor) {
          score += 120;
        } else if (normalizedLabel.indexOf(normalizedVendor) >= 0 || normalizedVendor.indexOf(normalizedLabel) >= 0) {
          score += 90;
        } else if (normalizedVendor.length >= 4 && normalizedLabel.indexOf(normalizedVendor.slice(0, 4)) >= 0) {
          score += 60;
        }
      }

      if (cqAmt > 0 && Number(invoice.total) === cqAmt) {
        score += 30;
      }

      return { invoice, score };
    })
    .sort((a, b) => b.score - a.score);

  if (!monthly.length) return null;
  if (monthly[0].score > 0) return monthly[0].invoice;
  return monthly.length === 1 ? monthly[0].invoice : null;
}

function findConquestBankMatch_(bankRows, rules, searchFrom, searchTo, cqAmt) {
  if (!rules || !rules.length) return null;

  const candidates = bankRows.filter(bank => {
    const bd = new Date(bank[0]);
    if (searchFrom && bd < searchFrom) return false;
    if (searchTo && bd > searchTo) return false;
    const summary = normalizeConquestText_(bank[3] || '');
    return rules.some(rule => summary.indexOf(rule.normalizedKeyword) >= 0);
  }).map(bank => {
    const amount = Math.abs(Number(bank[4])) || 0;
    let score = 0;
    if (cqAmt > 0 && amount === cqAmt) score += 120;
    else if (cqAmt > 0 && amount > 0 && amount < cqAmt) score += 20;
    return { bank, score };
  }).sort((a, b) => b.score - a.score);

  if (!candidates.length) return null;
  return candidates[0].bank;
}

function fmtDate(d) {
  return d.getFullYear() + '/' +
    String(d.getMonth() + 1).padStart(2, '0') + '/' +
    String(d.getDate()).padStart(2, '0');
}

function alert_(msg) {
  SpreadsheetApp.getUi().alert(msg);
}
