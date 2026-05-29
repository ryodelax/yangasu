// =============================================================
// 【最新】入金一覧 — メインスクリプト
// このファイルだけをGASエディタにコピーして使う
// 30_csv読取.js (銀行CSV取込) と合わせて使用
// =============================================================

// ---------- 設定 ----------

// 案件データの元スプレッドシートID（顧客対応状況シートがあるシート）
const SOURCE_SS_ID = '1QNctVAnkattCX9dyT9DBmaPXWF9-nsfmZwEtEp4t1R8';

// 案件データの取り込み元シート名
const SOURCE_SERVICE_SHEETS = ['顧客対応状況（車検）', '顧客対応状況（12点）'];
const SOURCE_VEHICLE_SHEET  = '顧客対応状況（車両販売）';

// このスプレッドシート内のシート名
const SHEET_BANK  = '銀行データチェック用';
const SHEET_SALES = '振込入金リスト一覧';

// 銀行データの列名
const BANK_COL = {
  DATE    : '日付',
  AMOUNT  : '金額',
  PARTNER : '相手摘要',
  SELF    : '自摘要',
  SUBJECT : '相手科目',
  STATUS  : 'ステータス',
  CUST_NO : '顧客No.',
  BIZ_NO  : '業務No.',
  MEMO    : '備考',
  PROTECTED: '保護フラグ'
};

// 案件データの列名
const SALES_COL = {
  BIZ_NO   : '業務№',
  CASE_NO  : '案件番号',      // 車両販売用（追加予定）
  DATE     : '日付',
  NAME     : '顧客名',
  TOTAL    : '売上総計',
  CUST_NO  : '顧客№',
  STATUS   : 'ステータス',
  METHOD   : '入金方法',
  DUE_DATE : '入金予定日',
  PAID_DATE: '入金日',        // 実績入金日（照合後に銀行日付を書き込む）
  WORK_TYPE: '作業大区分名',
  BILL_TO  : '請求先名',      // 保険立替の保険会社名判定に使用
  PROTECTED: '保護フラグ'
};

// 保険会社キーワード（摘要・請求先名に含まれる場合に保険入金と判定）
// カタカナ表記も含める（銀行CSVでは「ミツイスミトモカイジョウ」等のカナ表記が多い）
const INSURANCE_HINTS = [
  '保険', '損保', '共済',
  'あいおい', 'アイオイ',
  '三井住友海上', 'ミツイスミトモカイジョウ',
  '東京海上', 'トウキョウカイジョウ',
  '損保ジャパン', 'ソンポジャパン', 'ソンポ',
  'JA共済', 'ジェイエイ',
  'セコム損保', 'セコムソンポ',
  'チューリッヒ', 'アクサ', 'SBI損保'
];

// 保険立替案件の作業区分
const INSURANCE_WORK_TYPES = ['板金', '鈑金', '板金塗装', '鈑金・塗装', '保険請求'];

// 保険金額差額の許容上限
const INSURANCE_DIFF_MAX = 5000;

// コンクエスト案件キーワード（振込照合から除外し、コンクエスト管理で処理）
const CONQUEST_HINTS = ['コンクエスト', 'ｺﾝｸｴｽﾄ', 'マセラティ', 'ﾏｾﾗﾃｨ', 'Maserati'];

// ローン会社キーワード（摘要に含まれる場合にローン入金と判定）
const LOAN_HINTS = ['オリコ', 'オリエント', 'プレミア', 'ジャックス', 'アプラス', 'セディナ'];

// 自社名キーワード（自社間振替を除外する）
const SELF_COMPANY_HINTS = ['ブリッジ', 'ﾌﾞﾘｯｼﾞ', 'カ)ブリッジ', 'カ)ﾌﾞﾘｯｼﾞ'];

// ステータス値
const STATUS = {
  AUTO  : '自動消込',
  REVIEW: '要確認',
  MANUAL: '手動消込'
};

// 金額誤差の閾値（これ以下の差は手数料の可能性とみなす）
const FEE_TOLERANCE = 1100; // 円


// =============================================================
// メニューバー
// =============================================================
// ※ 既存の bank_pdf_import.gs に onOpen() があるため、
//   ここでは buildNyukinMenu_() として定義する。
//   bank_pdf_import.gs の buildUnifiedOperationsMenu_() から
//   この関数を呼ぶか、あるいは既存 onOpen() を差し替えて使う。
// =============================================================

function buildNyukinMenu_() {
  SpreadsheetApp.getUi()
    .createMenu('運用')
    .addItem('① 銀行データ取込',   'menuImportBankCsv')
    .addItem('② 案件リスト更新',   'menuUpdateSalesList')
    .addItem('③ 照合実行',         'menuRunReconcile')
    .addSeparator()
    .addItem('④ データ補正（学習適用）', 'menuApplyCorrections')
    .addToUi();
}


// =============================================================
// ① 案件リスト更新
// =============================================================

function menuUpdateSalesList() {
  try {
    const count = syncSalesListFromSource_();
    SpreadsheetApp.getUi().alert('案件リスト更新完了', count + '件を更新しました。', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('エラー', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function syncSalesListFromSource_() {
  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const sheet    = ss.getSheetByName(SHEET_SALES);
  if (!sheet) throw new Error('シートが見つかりません: ' + SHEET_SALES);

  const sourceSs = SpreadsheetApp.openById(
    typeof getNyukinSourceSpreadsheetId_ === 'function' ? getNyukinSourceSpreadsheetId_() : SOURCE_SS_ID
  );
  const rows     = [];

  SOURCE_SERVICE_SHEETS.forEach(function(name) {
    loadServiceRows_(sourceSs, name).forEach(function(r) { rows.push(r); });
  });
  loadVehicleRows_(sourceSs, SOURCE_VEHICLE_SHEET).forEach(function(r) { rows.push(r); });

  // 日付降順に並べる
  rows.sort(function(a, b) {
    return (b.date || new Date(0)) - (a.date || new Date(0));
  });

  // 保護フラグ付き行は残す
  const protectedRows = getProtectedRows_(sheet);

  // シートに書き込む
  const headers = getOrCreateSalesHeaders_(sheet);
  const all     = mergeWithProtected_(rows, protectedRows, headers);

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  if (all.length) {
    const output = all.map(function(r) { return rowToArray_(r, headers); });
    sheet.getRange(2, 1, output.length, headers.length).setValues(output);
  }

  return all.length;
}

function loadServiceRows_(sourceSs, sheetName) {
  const sheet = sourceSs.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values  = sheet.getDataRange().getValues();
  const headers = values[0].map(function(h) { return String(h || '').trim(); });
  const idx     = makeIdxMap_(headers);
  const rows    = [];

  values.slice(1).forEach(function(row) {
    const status = String(row[idx['状況']] || '').trim();
    if (!isActiveServiceStatus_(status)) return;

    const bizNo = String(row[idx['整備ナンバー']] || '').trim();
    const name  = String(row[idx['顧客名']]       || '').trim();
    const total = toNum_(row[idx['売上総計']]);
    if (!bizNo && !name && !total) return;

    rows.push({
      bizNo    : bizNo,
      date     : parseDate_(row[idx['日付']]),
      name     : name,
      total    : total,
      custNo   : '',
      workType : String(row[idx['作業大区分']] || '').trim(),
      billTo   : String(row[idx['請求先名']] || row[idx['請求先']] || '').trim(),
      dueDate  : parseDate_(row[idx['入金予定日']] || row[idx['納車予定日']] || row[idx['日付']]),
      status   : '',
      method   : '',
      protected: false
    });
  });
  return rows;
}

function loadVehicleRows_(sourceSs, sheetName) {
  const sheet = sourceSs.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values  = sheet.getDataRange().getValues();
  const headers = values[0].map(function(h) { return String(h || '').trim(); });
  const idx     = makeIdxMap_(headers);
  const rows    = [];

  values.slice(1).forEach(function(row) {
    const statusCol = idx['進捗'] !== undefined ? idx['進捗'] : 0;
    const status    = String(row[statusCol] || '').trim();
    if (!isActiveVehicleStatus_(status)) return;

    const name  = String(row[idx['顧客名']] || '').trim();
    const total = toNum_(row[idx['確定売上（税込）']]) || toNum_(row[idx['販売金額（税込）']]) || toNum_(row[idx['販売金額']]);
    if (!name && !total) return;

    // 業務No：「案件番号」列を最優先（追加予定）、なければ既存列を順に参照
    const bizNo = String(
      row[idx['案件番号']] || row[idx['商談No']] || row[idx['案件No']] || row[idx['業務№']] || row[idx['業務No']] || ''
    ).trim();

    // 入金予定日：「入金予定日」列を最優先（追加予定）、なければ登録・受注日を順に参照
    const dueDate = parseDate_(
      row[idx['入金予定日']] || row[idx['登録予定日']] || row[idx['登録決定日']] || row[idx['受注日']]
    );

    rows.push({
      bizNo    : bizNo,
      date     : parseDate_(row[idx['登録決定日']] || row[idx['受注日']] || row[idx['案件発生日']] || row[idx['商談日']]),
      name     : name,
      total    : total,
      custNo   : '',
      workType : '車販',
      billTo   : String(row[idx['請求先名']] || row[idx['請求先']] || '').trim(),
      dueDate  : dueDate,
      status   : '',
      method   : '',
      protected: false
    });
  });
  return rows;
}

function isActiveServiceStatus_(s) {
  return s === '売上決定';
}

function isActiveVehicleStatus_(s) {
  return ['登録決定', '受注'].indexOf(s) >= 0;
}


// =============================================================
// ② 銀行データ取込
// runImportBankCsv() は内部で他スプレッドシートに書き込む
// syncWithdrawalLedgerToPaymentSpreadsheet_() を呼ぶので使わない。
// このスプレッドシート内だけで完結する処理のみ呼ぶ。
// =============================================================

function menuImportBankCsv() {
  try {
    // CSVを読んで銀行データチェック用シートに追記（このSSのみに書く）
    ensureBankLedgerSupportSheets_();        // 補助シート作成（このSSのみ）
    const summary = importBankCsvToSheet();  // CSV → 銀行データシートへ書込
    // 後処理：このSSのみへの書き込みに限定（他SS書込の syncWithdrawalLedger は呼ばない）
    replaceDataFromLearningSheet_('銀行データチェック用');
    updateBankLedgerDisplayColumns_();
    dedupeBankLedgerRows_();
    sortSheetByHeader_('銀行データチェック用', '日付');
    syncBankDirectionSheets_();             // 銀行入金一覧・出金一覧（このSS内）
    cleanupBankListSheet_();               // 不要列削除・幅調整

    const msg = summary
      ? '取込完了\n処理ファイル: ' + summary.scannedFiles + '\n追加行数: ' + summary.addedRecords
      : '取込完了';
    SpreadsheetApp.getUi().alert('銀行データ取込', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('エラー', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}


// =============================================================
// ③ 照合実行
// =============================================================

function menuRunReconcile() {
  try {
    // 振込照合（銀行データ ↔ 案件一覧）
    const result = runReconcile_();

    // クレカ・現金照合
    const cardResult = runCashReconcile_();

    // 保険立替照合
    const insResult = runInsuranceReconcile_();

    // 管理ビュー更新（このSS内のシートのみ）
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    try { renderOperationalBankListView_(ss);  } catch(e) { Logger.log('銀行一覧更新エラー: '       + e.message); }
    try { renderOperationalSalesView_(ss);     } catch(e) { Logger.log('案件一覧ビュー更新エラー: '  + e.message); }
    try { renderOperationalConquestView_(ss);  } catch(e) { Logger.log('コンクエスト管理更新エラー: ' + e.message); }
    try { renderOperationalInsuranceView_(ss); } catch(e) { Logger.log('保険立替管理更新エラー: '   + e.message); }
    try { refreshReceivableForecastSheet_();   } catch(e) { Logger.log('売掛見込み更新エラー: '     + e.message); }

    // 列幅調整
    ['銀行一覧', '案件一覧', 'コンクエスト管理', '保険立替管理'].forEach(function(name) {
      const sh = ss.getSheetByName(name);
      if (sh) autoResizeSheet_(sh);
    });

    const msg =
      '【振込照合】\n'       + '自動消込: ' + result.auto      + '件 / 要確認: ' + result.review     + '件 / 未照合: ' + result.unmatched + '件\n\n' +
      '【クレカ・現金照合】\n' + '自動消込: ' + cardResult.auto  + '件 / 要確認: ' + cardResult.review + '件\n\n' +
      '【保険立替照合】\n'    + '自動消込: ' + insResult.auto   + '件 / 要確認: ' + insResult.review  + '件\n\n' +
      '銀行一覧・案件一覧・コンクエスト管理・保険立替管理・売掛見込みを更新しました。';
    SpreadsheetApp.getUi().alert('照合結果', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('エラー', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function runReconcile_() {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const bankSheet = ss.getSheetByName(SHEET_BANK);
  const salesSheet= ss.getSheetByName(SHEET_SALES);
  if (!bankSheet)  throw new Error('シートが見つかりません: ' + SHEET_BANK);
  if (!salesSheet) throw new Error('シートが見つかりません: ' + SHEET_SALES);

  const bankHdrs  = getHeaderIdx_(bankSheet);
  const salesHdrs = getHeaderIdx_(salesSheet);
  const bankVals  = bankSheet.getDataRange().getValues();
  const salesVals = salesSheet.getDataRange().getValues();

  // 必要列のインデックス確認
  const bIdx = {
    date     : bankHdrs[BANK_COL.DATE],
    amount   : bankHdrs[BANK_COL.AMOUNT],
    partner  : bankHdrs[BANK_COL.PARTNER],
    self     : bankHdrs[BANK_COL.SELF],
    subject  : bankHdrs[BANK_COL.SUBJECT],
    status   : bankHdrs[BANK_COL.STATUS],
    custNo   : bankHdrs[BANK_COL.CUST_NO],
    bizNo    : bankHdrs[BANK_COL.BIZ_NO],
    memo     : bankHdrs[BANK_COL.MEMO],
    protected: bankHdrs[BANK_COL.PROTECTED]
  };
  const sIdx = {
    bizNo    : salesHdrs[SALES_COL.BIZ_NO],
    caseNo   : salesHdrs[SALES_COL.CASE_NO],   // 車両販売用（列がなければ undefined）
    date     : salesHdrs[SALES_COL.DATE],
    name     : salesHdrs[SALES_COL.NAME],
    total    : salesHdrs[SALES_COL.TOTAL],
    custNo   : salesHdrs[SALES_COL.CUST_NO],
    status   : salesHdrs[SALES_COL.STATUS],
    method   : salesHdrs[SALES_COL.METHOD],
    dueDate  : salesHdrs[SALES_COL.DUE_DATE],
    paidDate : salesHdrs[SALES_COL.PAID_DATE],  // 実績入金日（列がなければ undefined）
    protected: salesHdrs[SALES_COL.PROTECTED]
  };

  // 案件データをロード（照合済み・保護以外を対象）
  const salesRows = [];
  for (let r = 1; r < salesVals.length; r++) {
    const row = salesVals[r];
    if (sIdx.protected !== undefined && isTruthy_(row[sIdx.protected])) continue;
    const st = String(row[sIdx.status] || '').trim();
    if (st === STATUS.AUTO || st === STATUS.MANUAL) continue;
    // 要確認はそのままスキップ（手動対応）

    const bizNo  = sIdx.bizNo  !== undefined ? String(row[sIdx.bizNo]  || '').trim().toUpperCase() : '';
    const caseNo = sIdx.caseNo !== undefined ? String(row[sIdx.caseNo] || '').trim().toUpperCase() : '';

    salesRows.push({
      rowIndex : r,
      bizNo    : bizNo,
      caseNo   : caseNo,
      matchKey : bizNo || caseNo,  // どちらか有効な方をキーとして使う
      name     : normalizeText_(row[sIdx.name]),
      total    : toNum_(row[sIdx.total]),
      custNo   : String(row[sIdx.custNo] || '').trim(),
      dueDate  : parseDate_(sIdx.dueDate !== undefined ? row[sIdx.dueDate] : null),
      date     : parseDate_(sIdx.date    !== undefined ? row[sIdx.date]    : null)
    });
  }

  // 業務No・案件番号の両方でインデックスを作成（高速ルックアップ）
  const salesByNo = {};
  salesRows.forEach(function(s) {
    if (s.matchKey) {
      if (!salesByNo[s.matchKey]) salesByNo[s.matchKey] = [];
      salesByNo[s.matchKey].push(s);
    }
  });

  // 名義対応表をロード（顧客No自動入力に使用）
  const aliasTable = loadAliasTable_(ss);

  const matchedSalesRows = new Set();
  const result = { auto: 0, review: 0, unmatched: 0 };

  // 銀行データを1行ずつ処理
  for (let r = 1; r < bankVals.length; r++) {
    const row = bankVals[r];

    // 保護フラグ or 照合済みはスキップ
    if (bIdx.protected !== undefined && isTruthy_(row[bIdx.protected])) continue;
    const st = String(row[bIdx.status] || '').trim();
    if (st === STATUS.AUTO || st === STATUS.MANUAL) continue;
    if (st === STATUS.REVIEW) continue; // 要確認は手動対応

    const bankAmount  = toNum_(row[bIdx.amount]);
    if (!bankAmount || bankAmount <= 0) continue;

    // 銀行摘要から業務Noを抽出
    const partnerText = String(row[bIdx.partner] || '');
    const selfText    = String(row[bIdx.self]    || '');
    const combined    = partnerText + ' ' + selfText;
    const combinedUpper = combined.normalize('NFKC').toUpperCase();

    // --- 振込照合の対象外を除外（保険・コンクエスト・自社振替はそれぞれ専用処理で扱う） ---
    if (isHintMatch_(combinedUpper, INSURANCE_HINTS))  continue;  // → runInsuranceReconcile_() で処理
    if (isHintMatch_(combinedUpper, CONQUEST_HINTS))    continue;  // → コンクエスト管理で処理
    if (isHintMatch_(combinedUpper, SELF_COMPANY_HINTS)) continue; // 自社間振替は照合対象外

    const extractedNos = extractBizNos_(combined);

    let matched = null;

    // --------- Step 1: 業務No・案件番号 一致（最優先） ---------
    for (let i = 0; i < extractedNos.length; i++) {
      const no = extractedNos[i];
      const candidates = salesByNo[no];
      if (!candidates || !candidates.length) continue;

      const sale = candidates.find(function(s) { return !matchedSalesRows.has(s.rowIndex); });
      if (!sale) continue;

      const diff = Math.abs(bankAmount - sale.total);
      const keyLabel = sale.caseNo && sale.caseNo === no ? '案件番号' : '業務No';

      if (diff === 0) {
        matched = { sale: sale, status: STATUS.AUTO,   memo: keyLabel + '一致・金額一致' };
      } else if (diff <= FEE_TOLERANCE) {
        matched = { sale: sale, status: STATUS.AUTO,   memo: keyLabel + '一致・差額' + diff + '円（手数料の可能性）' };
      } else {
        matched = { sale: sale, status: STATUS.REVIEW, memo: keyLabel + '一致・差額' + diff + '円 → 分割入金または確認が必要' };
      }
      break;
    }

        // --------- Step 2: 業務Noなし → 金額完全一致 + 名前補助 ---------
    if (!matched) {
      const bankName = normalizeText_(partnerText + ' ' + selfText);

      // 名義対応表で顧客Noを引く
      const mappedCustNo = lookupCustNo_(bankName, aliasTable);

      // 顧客Noが一致する案件を優先
      let amountMatches = salesRows.filter(function(s) {
        return !matchedSalesRows.has(s.rowIndex) && s.total === bankAmount;
      });

      if (mappedCustNo) {
        const custNoHits = amountMatches.filter(function(s) { return s.custNo === mappedCustNo; });
        if (custNoHits.length === 1) {
          matched = { sale: custNoHits[0], status: STATUS.AUTO, memo: '金額一致・顧客No一致', custNo: mappedCustNo };
        } else if (custNoHits.length > 1) {
          matched = {
            sale  : custNoHits[0],
            status: STATUS.REVIEW,
            memo  : '同額同顧客が' + custNoHits.length + '件あり・要確認: ' + custNoHits.map(function(s) { return s.bizNo || s.name; }).join(', '),
            custNo: mappedCustNo
          };
        }
      }

      if (!matched && amountMatches.length === 1) {
        const sale = amountMatches[0];
        const nameHit = sale.name && bankName && nameMatch_(bankName, sale.name);
        matched = {
          sale  : sale,
          status: nameHit ? STATUS.AUTO : STATUS.REVIEW,
          memo  : nameHit ? '金額一致・顧客名一致' : '金額一致（顧客名要確認）',
          custNo: mappedCustNo || sale.custNo
        };
      } else if (!matched && amountMatches.length > 1) {
        const nameHits = amountMatches.filter(function(s) {
          return s.name && bankName && nameMatch_(bankName, s.name);
        });
        if (nameHits.length === 1) {
          matched = { sale: nameHits[0], status: STATUS.AUTO,   memo: '金額一致・顧客名一致（複数候補から絞込）', custNo: mappedCustNo || nameHits[0].custNo };
        } else {
          const pool = nameHits.length > 1 ? nameHits : amountMatches;
          matched = {
            sale  : pool[0],
            status: STATUS.REVIEW,
            memo  : '同額案件が' + amountMatches.length + '件あり・要確認: ' + amountMatches.map(function(s) { return s.bizNo || s.name; }).join(', '),
            custNo: mappedCustNo || pool[0].custNo
          };
        }
      }
    }

    // --------- 差額の取引を銀行入金一覧・出金一覧から検索してメモに追記 ---------
    if (matched && matched.status === STATUS.REVIEW && matched.sale) {
      const diff = Math.abs(bankAmount - matched.sale.total);
      if (diff > 0) {
        const bankDate = bIdx.date !== undefined ? parseDate_(row[bIdx.date]) : null;
        const diffNote = searchDiffTransaction_(diff, bankDate, ss);
        if (diffNote) matched.memo += '\n' + diffNote;
      }
    }

    // --------- 結果を書き込む ---------
    if (matched) {
      matchedSalesRows.add(matched.sale.rowIndex);

      const bankDate = bIdx.date !== undefined ? row[bIdx.date] : null;
      const resolvedCustNo = matched.custNo || matched.sale.custNo || '';

      // 銀行シート更新
      if (bIdx.status !== undefined) bankVals[r][bIdx.status] = matched.status;
      if (bIdx.custNo !== undefined) bankVals[r][bIdx.custNo] = resolvedCustNo;
      if (bIdx.bizNo  !== undefined) bankVals[r][bIdx.bizNo]  = matched.sale.matchKey || '';
      if (bIdx.memo   !== undefined) bankVals[r][bIdx.memo]   = matched.memo;

      // 案件シート更新
      if (sIdx.status   !== undefined) salesVals[matched.sale.rowIndex][sIdx.status]   = matched.status;
      if (sIdx.custNo   !== undefined && resolvedCustNo) salesVals[matched.sale.rowIndex][sIdx.custNo] = resolvedCustNo;
      if (sIdx.paidDate !== undefined && matched.status === STATUS.AUTO && bankDate) {
        salesVals[matched.sale.rowIndex][sIdx.paidDate] = bankDate;
      }
      if (sIdx.method !== undefined && matched.status === STATUS.AUTO) {
        salesVals[matched.sale.rowIndex][sIdx.method] = '振り込み';
      }

      if (matched.status === STATUS.AUTO) result.auto++;
      else                                result.review++;
    } else {
      // 未照合の場合、ローン会社入金かチェックしてメモを残す
      if (isHintMatch_(combinedUpper, LOAN_HINTS)) {
        if (bIdx.status !== undefined) bankVals[r][bIdx.status] = STATUS.REVIEW;
        if (bIdx.memo   !== undefined) bankVals[r][bIdx.memo]   = 'ローン会社入金（車両販売の可能性）→ 案件一覧に該当案件がないか確認';
        result.review++;
      } else {
        result.unmatched++;
      }
    }
  }

  // 一括書き込み
  bankSheet.getRange(1, 1, bankVals.length,  bankSheet.getLastColumn()).setValues(bankVals);
  salesSheet.getRange(1, 1, salesVals.length, salesSheet.getLastColumn()).setValues(salesVals);

  // 列幅を内容に合わせて自動調整
  autoResizeSheet_(salesSheet);
  autoResizeSheet_(bankSheet);

  return result;
}

// =============================================================
// クレカ・現金照合
// シート「クレカ・現金」↔「案件一覧」
// =============================================================

function runCashReconcile_() {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const cashSheet = ss.getSheetByName('クレカ・現金');
  const salesSheet= ss.getSheetByName(SHEET_SALES);
  if (!cashSheet || !salesSheet) return { auto: 0, review: 0 };

  const cashHdrs  = getHeaderIdx_(cashSheet);
  const salesHdrs = getHeaderIdx_(salesSheet);
  const cashVals  = cashSheet.getDataRange().getValues();
  const salesVals = salesSheet.getDataRange().getValues();

  // クレカ・現金シートの列
  const cIdx = {
    date    : cashHdrs['取引日'],
    vendor  : cashHdrs['取引先'],
    amount  : cashHdrs['合計'],
    status  : cashHdrs['ステータス'],
    bizNo   : cashHdrs['業務No'],
    custNo  : cashHdrs['顧客No'],
    method  : cashHdrs['入金方法'],
    credit  : cashHdrs['クレカ種別']
  };

  // 案件一覧の列
  const sIdx = {
    bizNo   : salesHdrs[SALES_COL.BIZ_NO],
    caseNo  : salesHdrs[SALES_COL.CASE_NO],
    name    : salesHdrs[SALES_COL.NAME],
    total   : salesHdrs[SALES_COL.TOTAL],
    custNo  : salesHdrs[SALES_COL.CUST_NO],
    status  : salesHdrs[SALES_COL.STATUS],
    method  : salesHdrs[SALES_COL.METHOD],
    paidDate: salesHdrs[SALES_COL.PAID_DATE]
  };

  if (cIdx.status === undefined || cIdx.amount === undefined) return { auto: 0, review: 0 };

  // 照合済み案件の重複防止
  const matchedSalesRows = new Set();
  const aliasTable = loadAliasTable_(ss);
  const result = { auto: 0, review: 0 };

  for (let r = 1; r < cashVals.length; r++) {
    const crow = cashVals[r];
    const st   = String(crow[cIdx.status] || '').trim();
    if (st === STATUS.AUTO || st === STATUS.MANUAL) continue;

    const cashAmount = toNum_(crow[cIdx.amount]);
    if (!cashAmount || cashAmount <= 0) continue;

    const vendorRaw  = cIdx.vendor !== undefined ? String(crow[cIdx.vendor] || '') : '';
    const vendorNorm = normalizeText_(vendorRaw);
    const cashDate   = cIdx.date !== undefined ? parseDate_(crow[cIdx.date]) : null;
    const creditType = cIdx.credit !== undefined ? String(crow[cIdx.credit] || '').trim() : '';
    const payMethod  = cIdx.method !== undefined ? String(crow[cIdx.method] || '').trim() : '';
    const outputMethod = creditType || payMethod || 'クレカ';

    // 未照合の案件から金額一致 or 近似一致を探す
    const salesRows = [];
    for (let s = 1; s < salesVals.length; s++) {
      const srow = salesVals[s];
      const sst  = String(sIdx.status !== undefined ? srow[sIdx.status] : '').trim();
      if (sst === STATUS.AUTO || sst === STATUS.MANUAL || matchedSalesRows.has(s)) continue;
      const total = toNum_(sIdx.total !== undefined ? srow[sIdx.total] : 0);
      const diff  = Math.abs(total - cashAmount);
      if (diff > FEE_TOLERANCE) continue;  // 手数料許容範囲内まで候補に含める

      const bizNo  = sIdx.bizNo  !== undefined ? String(srow[sIdx.bizNo]  || '').trim().toUpperCase() : '';
      const caseNo = sIdx.caseNo !== undefined ? String(srow[sIdx.caseNo] || '').trim().toUpperCase() : '';
      salesRows.push({
        rowIndex: s,
        bizNo   : bizNo,
        caseNo  : caseNo,
        matchKey: bizNo || caseNo,
        name    : normalizeText_(sIdx.name !== undefined ? srow[sIdx.name] : ''),
        custNo  : sIdx.custNo !== undefined ? String(srow[sIdx.custNo] || '').trim() : '',
        total   : total,
        diff    : diff,
        date    : parseDate_(srow[1]) // 日付列は通常2列目
      });
    }

    if (!salesRows.length) continue;

    let matched = null;

    // 完全一致候補と近似候補を分離
    const exactRows = salesRows.filter(function(s) { return s.diff === 0; });
    const nearRows  = salesRows.filter(function(s) { return s.diff > 0; });

    // 差額メモ生成用ヘルパー
    function buildCashDiffMemo_(base, sale) {
      if (sale.diff === 0) return base;
      return base + '・差額' + sale.diff + '円（手数料の可能性）';
    }

    // ① 取引先名から業務No抽出 → 案件と照合
    const extractedNos = extractBizNos_(vendorRaw);
    for (let i = 0; i < extractedNos.length; i++) {
      const no  = extractedNos[i];
      const hit = salesRows.find(function(s) { return s.matchKey === no; });
      if (hit) {
        matched = { sale: hit, status: STATUS.AUTO, memo: buildCashDiffMemo_('業務No一致（クレカ）', hit), custNo: hit.custNo };
        break;
      }
    }

    // ② 名義対応表で顧客No → 案件照合（完全一致を優先）
    if (!matched) {
      const mappedCustNo = lookupCustNo_(vendorNorm, aliasTable);
      if (mappedCustNo) {
        const pool = exactRows.filter(function(s) { return s.custNo === mappedCustNo; });
        const poolNear = pool.length ? pool : nearRows.filter(function(s) { return s.custNo === mappedCustNo; });
        if (poolNear.length === 1) {
          matched = { sale: poolNear[0], status: STATUS.AUTO, memo: buildCashDiffMemo_('顧客No一致（クレカ）', poolNear[0]), custNo: mappedCustNo };
        } else if (poolNear.length > 1) {
          matched = { sale: poolNear[0], status: STATUS.REVIEW, memo: '顧客No一致・複数候補あり・要確認', custNo: mappedCustNo };
        }
      }
    }

    // ③ 取引先名の正規化一致（完全一致を優先）
    if (!matched) {
      const exactNameHits = exactRows.filter(function(s) { return s.name && nameMatch_(vendorNorm, s.name); });
      const allNameHits   = exactNameHits.length ? exactNameHits : salesRows.filter(function(s) { return s.name && nameMatch_(vendorNorm, s.name); });
      if (allNameHits.length === 1) {
        matched = { sale: allNameHits[0], status: STATUS.AUTO, memo: buildCashDiffMemo_('取引先名一致（クレカ）', allNameHits[0]), custNo: allNameHits[0].custNo };
      } else if (allNameHits.length > 1) {
        matched = { sale: allNameHits[0], status: STATUS.REVIEW, memo: '同名複数あり・要確認: ' + allNameHits.map(function(s) { return s.bizNo || s.name; }).join(', '), custNo: allNameHits[0].custNo };
      }
    }

    // ④ 金額一致のみ（完全一致優先）
    if (!matched) {
      const pool = exactRows.length ? exactRows : nearRows;
      if (pool.length === 1) {
        matched = { sale: pool[0], status: STATUS.REVIEW, memo: buildCashDiffMemo_('金額一致（取引先名要確認・クレカ）', pool[0]), custNo: pool[0].custNo };
      } else if (pool.length > 1) {
        matched = { sale: pool[0], status: STATUS.REVIEW, memo: '同額案件が' + pool.length + '件あり・要確認: ' + pool.map(function(s) { return s.bizNo || s.name; }).join(', '), custNo: pool[0].custNo };
      }
    }

    if (matched) {
      matchedSalesRows.add(matched.sale.rowIndex);
      const resolvedCustNo = matched.custNo || matched.sale.custNo || '';

      // クレカシート更新
      cashVals[r][cIdx.status] = matched.status;
      if (cIdx.bizNo  !== undefined) cashVals[r][cIdx.bizNo]  = matched.sale.matchKey || '';
      if (cIdx.custNo !== undefined) cashVals[r][cIdx.custNo] = resolvedCustNo;

      // 案件シート更新
      const si = matched.sale.rowIndex;
      if (sIdx.status   !== undefined) salesVals[si][sIdx.status]   = matched.status;
      if (sIdx.method   !== undefined && matched.status === STATUS.AUTO) salesVals[si][sIdx.method]   = outputMethod;
      if (sIdx.paidDate !== undefined && matched.status === STATUS.AUTO && cashDate) salesVals[si][sIdx.paidDate] = cashDate;
      if (sIdx.custNo   !== undefined && resolvedCustNo) salesVals[si][sIdx.custNo] = resolvedCustNo;

      if (matched.status === STATUS.AUTO) result.auto++;
      else                                result.review++;
    }
  }

  // 一括書き込み
  cashSheet.getRange(1, 1, cashVals.length,  cashSheet.getLastColumn()).setValues(cashVals);
  salesSheet.getRange(1, 1, salesVals.length, salesSheet.getLastColumn()).setValues(salesVals);
  autoResizeSheet_(cashSheet);

  return result;
}

// =============================================================
// 保険立替照合
// 銀行データ（保険会社からの入金）↔ 案件一覧（板金・保険請求系）
// =============================================================

function runInsuranceReconcile_() {
  const ss        = SpreadsheetApp.getActiveSpreadsheet();
  const bankSheet = ss.getSheetByName(SHEET_BANK);
  const salesSheet= ss.getSheetByName(SHEET_SALES);
  if (!bankSheet || !salesSheet) return { auto: 0, review: 0 };

  const bankHdrs  = getHeaderIdx_(bankSheet);
  const salesHdrs = getHeaderIdx_(salesSheet);
  const bankVals  = bankSheet.getDataRange().getValues();
  const salesVals = salesSheet.getDataRange().getValues();

  const bIdx = {
    date     : bankHdrs[BANK_COL.DATE],
    amount   : bankHdrs[BANK_COL.AMOUNT],
    partner  : bankHdrs[BANK_COL.PARTNER],
    self     : bankHdrs[BANK_COL.SELF],
    status   : bankHdrs[BANK_COL.STATUS],
    custNo   : bankHdrs[BANK_COL.CUST_NO],
    bizNo    : bankHdrs[BANK_COL.BIZ_NO],
    memo     : bankHdrs[BANK_COL.MEMO],
    protected: bankHdrs[BANK_COL.PROTECTED]
  };

  const sIdx = {
    bizNo    : salesHdrs[SALES_COL.BIZ_NO],
    name     : salesHdrs[SALES_COL.NAME],
    total    : salesHdrs[SALES_COL.TOTAL],
    custNo   : salesHdrs[SALES_COL.CUST_NO],
    status   : salesHdrs[SALES_COL.STATUS],
    method   : salesHdrs[SALES_COL.METHOD],
    workType : salesHdrs[SALES_COL.WORK_TYPE],
    billTo   : salesHdrs[SALES_COL.BILL_TO],
    dueDate  : salesHdrs[SALES_COL.DUE_DATE],
    paidDate : salesHdrs[SALES_COL.PAID_DATE],
    protected: salesHdrs[SALES_COL.PROTECTED]
  };

  if (bIdx.status === undefined) return { auto: 0, review: 0 };

  // 保険立替案件を抽出（未照合のみ）
  const insuranceSales = [];
  for (let r = 1; r < salesVals.length; r++) {
    const row = salesVals[r];
    if (sIdx.protected !== undefined && isTruthy_(row[sIdx.protected])) continue;
    const st = String(sIdx.status !== undefined ? row[sIdx.status] : '').trim();
    if (st === STATUS.AUTO || st === STATUS.MANUAL) continue;

    const workType = String(sIdx.workType !== undefined ? row[sIdx.workType] : '').trim();
    const billTo   = String(sIdx.billTo   !== undefined ? row[sIdx.billTo]   : '').trim();

    const isInsuranceCase =
      INSURANCE_WORK_TYPES.indexOf(workType) >= 0 ||
      INSURANCE_HINTS.some(function(kw) { return billTo.indexOf(kw) >= 0; });

    if (!isInsuranceCase) continue;

    insuranceSales.push({
      rowIndex: r,
      bizNo   : sIdx.bizNo !== undefined ? String(row[sIdx.bizNo] || '').trim().toUpperCase() : '',
      name    : normalizeText_(sIdx.name !== undefined ? row[sIdx.name] : ''),
      custNo  : sIdx.custNo !== undefined ? String(row[sIdx.custNo] || '').trim() : '',
      total   : toNum_(sIdx.total !== undefined ? row[sIdx.total] : 0),
      billTo  : normalizeText_(billTo),
      dueDate : parseDate_(sIdx.dueDate !== undefined ? row[sIdx.dueDate] : null)
    });
  }

  if (!insuranceSales.length) return { auto: 0, review: 0 };

  const matchedSalesRows = new Set();
  const aliasTable = loadAliasTable_(ss);  // 顧客No照合用
  const result = { auto: 0, review: 0 };

  for (let r = 1; r < bankVals.length; r++) {
    const row = bankVals[r];
    if (bIdx.protected !== undefined && isTruthy_(row[bIdx.protected])) continue;
    const st = String(bIdx.status !== undefined ? row[bIdx.status] : '').trim();
    if (st === STATUS.AUTO || st === STATUS.MANUAL) continue;

    const bankAmount  = toNum_(bIdx.amount !== undefined ? row[bIdx.amount] : 0);
    if (!bankAmount || bankAmount <= 0) continue;

    // 保険会社からの入金かチェック
    const partnerText = String(bIdx.partner !== undefined ? row[bIdx.partner] : '');
    const selfText    = String(bIdx.self    !== undefined ? row[bIdx.self]    : '');
    const combined    = (partnerText + ' ' + selfText).normalize('NFKC').toUpperCase();
    const isInsuranceBank = isHintMatch_(combined, INSURANCE_HINTS);
    if (!isInsuranceBank) continue;

    const bankDate     = bIdx.date !== undefined ? parseDate_(row[bIdx.date]) : null;
    // 名義対応表で顧客Noを引く（保険会社名ではなく依頼人名が摘要にある場合に有効）
    const bankNormalized = normalizeText_(partnerText + ' ' + selfText);
    const mappedCustNo   = lookupCustNo_(bankNormalized, aliasTable);

    // スコアリングで最良案件を探す
    const scored = insuranceSales
      .filter(function(s) { return !matchedSalesRows.has(s.rowIndex); })
      .map(function(s) {
        let score = 0;
        const diff = Math.abs(bankAmount - s.total);

        // 業務No一致（最優先）
        const extractedNos = extractBizNos_(combined);
        if (s.bizNo && extractedNos.indexOf(s.bizNo) >= 0) score += 150;

        // 顧客No一致（名義対応表経由）
        if (mappedCustNo && s.custNo && mappedCustNo === s.custNo) score += 120;

        // 金額
        if (diff === 0) {
          score += 90;
        } else if (diff <= INSURANCE_DIFF_MAX) {
          score += Math.max(40, 80 - Math.floor(diff / 100));
        }

        // 日付近接
        if (bankDate && s.dueDate) {
          const dayDiff = Math.abs((bankDate - s.dueDate) / 86400000);
          if (dayDiff <= 7)  score += 25;
          else if (dayDiff <= 45) score += 10;
        }

        // 顧客名・請求先名が摘要に含まれるか
        if (s.name   && combined.indexOf(s.name)   >= 0) score += 20;
        if (s.billTo && combined.indexOf(s.billTo)  >= 0) score += 10;

        return { sale: s, score: score, diff: diff };
      })
      .filter(function(item) { return item.score >= 50; })  // 最低スコア50未満は候補から除外
      .sort(function(a, b) { return b.score - a.score; });

    if (!scored.length) continue;

    const best = scored[0];
    // スコア差が15以下で複数候補 → 要確認
    const isAmbiguous = scored.length > 1 && (scored[0].score - scored[1].score) <= 15;

    let status, memo;
    if (isAmbiguous) {
      status = STATUS.REVIEW;
      memo   = '保険案件・複数候補あり・要確認: ' + scored.slice(0, 3).map(function(i) { return i.sale.bizNo || i.sale.name; }).join(', ');
    } else if (best.diff === 0) {
      status = STATUS.AUTO;
      memo   = '保険入金・金額完全一致';
    } else if (best.diff <= INSURANCE_DIFF_MAX) {
      status = STATUS.AUTO;
      memo   = '保険入金・差額' + best.diff + '円（調整額の可能性）';
    } else {
      status = STATUS.REVIEW;
      memo   = '保険入金・差額' + best.diff + '円 → 一部入金または確認が必要';
    }

    matchedSalesRows.add(best.sale.rowIndex);

    // 銀行シート更新
    if (bIdx.status !== undefined) bankVals[r][bIdx.status] = status;
    if (bIdx.bizNo  !== undefined) bankVals[r][bIdx.bizNo]  = best.sale.bizNo || '';
    if (bIdx.custNo !== undefined) bankVals[r][bIdx.custNo] = best.sale.custNo || '';
    if (bIdx.memo   !== undefined) bankVals[r][bIdx.memo]   = memo;

    // 案件シート更新
    const si = best.sale.rowIndex;
    if (sIdx.status   !== undefined) salesVals[si][sIdx.status]   = status;
    if (sIdx.method   !== undefined && status === STATUS.AUTO) salesVals[si][sIdx.method]   = '保険振込';
    if (sIdx.paidDate !== undefined && status === STATUS.AUTO && bankDate) salesVals[si][sIdx.paidDate] = bankDate;

    if (status === STATUS.AUTO) result.auto++;
    else                        result.review++;
  }

  bankSheet.getRange(1, 1, bankVals.length,  bankSheet.getLastColumn()).setValues(bankVals);
  salesSheet.getRange(1, 1, salesVals.length, salesSheet.getLastColumn()).setValues(salesVals);

  return result;
}

// =============================================================
// ④ データ補正（学習適用）
// AI読み取り学習用シートの内容を
// 銀行データチェック用シートに反映し、重複削除・並び替えを実行
// =============================================================

function menuApplyCorrections() {
  try {
    // 学習シートの補正ルールを適用
    replaceDataFromLearningSheet_('銀行データチェック用');

    // 重複行の削除（既存の完全一致キー方式）
    dedupeBankLedgerRows_();

    // 摘要違い同一取引の重複検出・削除（日付+金額一致で摘要が類似する場合）
    const fuzzyRemoved = dedupFuzzyBankRows_();

    // 日付順に並び替え
    sortSheetByHeader_('銀行データチェック用', '日付');

    // 入金一覧・出金一覧を同期
    syncBankDirectionSheets_();

    // 不要列削除・列幅調整
    cleanupBankListSheet_();

    // 案件一覧の列幅も調整
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const salesSheet = ss.getSheetByName(SHEET_SALES);
    if (salesSheet) autoResizeSheet_(salesSheet);

    const fuzzyMsg = fuzzyRemoved > 0 ? '\n摘要違い重複: ' + fuzzyRemoved + '件を削除' : '';
    SpreadsheetApp.getUi().alert('データ補正完了', '学習シートの補正を適用し、重複削除・並び替えを行いました。' + fuzzyMsg + '\n照合結果をリセットする場合は対象行のステータスを空欄にしてから③照合実行を再実行してください。', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('エラー', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}


// =============================================================
// ユーティリティ
// =============================================================

function getHeaderIdx_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach(function(h, i) {
    if (h) map[String(h).trim()] = i;
  });
  return map;
}

function getOrCreateSalesHeaders_(sheet) {
  const required = [
    SALES_COL.BIZ_NO, SALES_COL.DATE, SALES_COL.NAME, SALES_COL.TOTAL,
    SALES_COL.CUST_NO, SALES_COL.STATUS, SALES_COL.METHOD,
    SALES_COL.WORK_TYPE, SALES_COL.BILL_TO, SALES_COL.DUE_DATE, SALES_COL.PROTECTED
  ];
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, required.length).setValues([required]);
    return required;
  }
  const lastCol = sheet.getLastColumn();
  const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(h) { return String(h || '').trim(); });
  // 実際のヘッダーとして認識できるもの（required に含まれるもの）がいくつあるか
  var matchCount = 0;
  existing.forEach(function(h) { if (h && required.indexOf(h) >= 0) matchCount++; });
  // ヘッダーが半分以上不足していたら、行1をタイトル行と見なしてリセットする
  if (matchCount < required.length / 2) {
    // 行1を全クリアしてヘッダーを書き直す
    sheet.getRange(1, 1, 1, lastCol).clearContent();
    sheet.getRange(1, 1, 1, required.length).setValues([required]);
    // 余分な列にデータがあれば削除（タイトル行の残骸）
    if (lastCol > required.length) {
      sheet.deleteColumns(required.length + 1, lastCol - required.length);
    }
    return required;
  }
  // 不足ヘッダーを末尾に追加
  const missing = required.filter(function(h) { return existing.indexOf(h) < 0; });
  if (missing.length) {
    const startCol = existing.length + 1;
    sheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
    return existing.concat(missing);
  }
  return existing;
}

function getProtectedRows_(sheet) {
  if (sheet.getLastRow() < 2) return [];
  const values  = sheet.getDataRange().getValues();
  const headers = values[0].map(function(h) { return String(h || '').trim(); });
  const protIdx = headers.indexOf(SALES_COL.PROTECTED);
  if (protIdx < 0) return [];
  return values.slice(1).filter(function(row) { return isTruthy_(row[protIdx]); });
}

function mergeWithProtected_(newRows, protectedRawRows, headers) {
  const result = newRows.map(function(r) { return r; });
  // 保護行をそのまま末尾に追加（bizNoが重複しないもの）
  const existingBizNos = {};
  result.forEach(function(r) { if (r.bizNo) existingBizNos[r.bizNo] = true; });
  protectedRawRows.forEach(function(raw) {
    const bizNoIdx = headers.indexOf(SALES_COL.BIZ_NO);
    const bizNo = bizNoIdx >= 0 ? String(raw[bizNoIdx] || '').trim().toUpperCase() : '';
    if (bizNo && existingBizNos[bizNo]) return; // 新データ側にある → 新データ優先
    result.push({ _raw: raw });
  });
  return result;
}

function rowToArray_(r, headers) {
  if (r._raw) return r._raw; // 保護行はそのまま
  return headers.map(function(h) {
    switch (h) {
      case SALES_COL.BIZ_NO:    return r.bizNo    || '';
      case SALES_COL.DATE:      return r.date      || '';
      case SALES_COL.NAME:      return r.name      || '';
      case SALES_COL.TOTAL:     return r.total     || '';
      case SALES_COL.CUST_NO:   return r.custNo    || '';
      case SALES_COL.STATUS:    return r.status    || '';
      case SALES_COL.METHOD:    return r.method    || '';
      case SALES_COL.WORK_TYPE: return r.workType  || '';
      case SALES_COL.BILL_TO:   return r.billTo    || '';
      case SALES_COL.DUE_DATE:  return r.dueDate   || '';
      case SALES_COL.PROTECTED: return r.protected ? 'TRUE' : '';
      default: return '';
    }
  });
}

function makeIdxMap_(headers) {
  const map = {};
  headers.forEach(function(h, i) { map[h] = i; });
  return map;
}

// 銀行摘要から業務Noを抽出
// 優先: SB/CH/PC/RA + 数字 → なければ摘要中の独立した数字列（フォールバック）
function extractBizNos_(text) {
  const upper = String(text || '').toUpperCase().normalize('NFKC');
  const prefixed = upper.match(/(?:SB|CH|PC|RA)\s*0*(\d{3,8})/g) || [];
  if (prefixed.length) {
    return prefixed.map(function(m) {
      const prefix = m.slice(0, 2);
      const digits = m.replace(/[^0-9]/g, '');
      return prefix + digits.padStart(8, '0');
    });
  }
  // フォールバック: 英字に挟まれていない4〜10桁の数字
  const nums = upper.match(/(?<![A-Z0-9])\d{4,10}(?![A-Z0-9])/g) || [];
  return nums;
}

function normalizeText_(value) {
  let t = String(value || '');
  if (!t) return '';
  if (t.normalize) t = t.normalize('NFKC');

  // 漢数字 → アラビア数字
  const kanjiMap = { '〇':'0','零':'0','一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9','十':'0' };
  t = t.replace(/[〇零一二三四五六七八九十]/g, function(c) { return kanjiMap[c] || c; });

  t = t.toUpperCase()
    // 銀行CSV特有の前置詞を除去
    .replace(/該当なし|ガイトウナシ/g, '')
    // 法人名の略称・敬称を除去
    .replace(/株式会社|有限会社|合同会社|医療法人|社会福祉法人|\(株\)|㈱|\(有\)|（株）|（有）|\(医\)|（医）/g, '')
    .replace(/代表取締役社長|代表取締役|理事長|院長|社長|様|御中|殿/g, '')
    // 振込関連の定型文を除去
    .replace(/HB|EBフリコミ|EBﾌﾘｺﾐ|振込\d+|フリコミ|ﾌﾘｺﾐ/g, '')
    .replace(/ヶ/g, 'ケ').replace(/ヵ/g, 'カ')
    .replace(/[ 　\t\r\n\-‐–—ーｰ・･,，、.．'"`\/\\()（）[\]【】]/g, '');

  return t;
}

// キーワードリスト内のいずれかが対象文字列に含まれるかチェック
function isHintMatch_(upperText, hints) {
  return hints.some(function(kw) {
    return upperText.indexOf(kw.normalize('NFKC').toUpperCase()) >= 0;
  });
}

function toNum_(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/[,，￥¥\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseDate_(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function isTruthy_(v) {
  const s = String(v === true ? 'TRUE' : v || '').trim().toUpperCase();
  return s === 'TRUE' || s === '1' || s === 'YES';
}

// =============================================================
// 名義対応表 — 顧客No自動入力
// =============================================================

// シート「※名義対応表」を読んで { 正規化済み表示名 → 顧客No } のマップを返す
function loadAliasTable_(ss) {
  const sheet = ss.getSheetByName('※名義対応表');
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values  = sheet.getDataRange().getValues();
  const headers = values[0].map(function(h) { return String(h || '').trim(); });
  const custIdx    = headers.indexOf('顧客No.');
  const displayIdx = headers.indexOf('銀行CSV登録名');
  const jocarIdx   = headers.indexOf('Jocar登録名');
  if (custIdx < 0) return [];

  const table = [];
  values.slice(1).forEach(function(row) {
    const custNo = String(row[custIdx] || '').trim();
    if (!custNo) return;
    const names = [];
    if (displayIdx >= 0 && row[displayIdx]) names.push(String(row[displayIdx]));
    if (jocarIdx   >= 0 && row[jocarIdx])   names.push(String(row[jocarIdx]));
    names.forEach(function(n) {
      const normalized = normalizeText_(n);
      if (normalized) table.push({ normalized: normalized, custNo: custNo });
    });
  });
  return table;
}

// 正規化済み銀行名から顧客Noを引く（部分一致）
function lookupCustNo_(normalizedBankName, aliasTable) {
  if (!normalizedBankName || !aliasTable.length) return '';
  let best = null;
  let bestLen = 0;
  aliasTable.forEach(function(entry) {
    const a = entry.normalized;
    if (!a) return;
    if (normalizedBankName === a ||
        (a.length >= 4 && normalizedBankName.indexOf(a) >= 0) ||
        (normalizedBankName.length >= 4 && a.indexOf(normalizedBankName) >= 0)) {
      if (a.length > bestLen) {
        best = entry.custNo;
        bestLen = a.length;
      }
    }
  });
  return best || '';
}

// 顧客名の一致判定（正規化済みテキスト同士）
function nameMatch_(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer  = a.length >  b.length ? a : b;
  return shorter.length >= 4 && longer.indexOf(shorter) >= 0;
}

// =============================================================
// 差額の取引を銀行入金一覧・出金一覧から検索
// =============================================================

function searchDiffTransaction_(diff, bankDate, ss) {
  const SEARCH_SHEETS = ['銀行入金一覧', '銀行出金一覧'];
  const DATE_WINDOW   = 5; // ±5日以内で探す

  for (let si = 0; si < SEARCH_SHEETS.length; si++) {
    const sheet = ss.getSheetByName(SEARCH_SHEETS[si]);
    if (!sheet || sheet.getLastRow() < 2) continue;

    const values  = sheet.getDataRange().getValues();
    const headers = values[0].map(function(h) { return String(h || '').trim(); });
    const amtIdx  = headers.indexOf('金額');
    const dateIdx = headers.indexOf('日付');
    const descIdx = headers.indexOf('相手摘要');
    if (amtIdx < 0) continue;

    for (let r = 1; r < values.length; r++) {
      const row    = values[r];
      const amount = Math.abs(toNum_(row[amtIdx]));
      if (amount !== diff) continue;

      if (bankDate && dateIdx >= 0) {
        const txDate = parseDate_(row[dateIdx]);
        if (txDate) {
          const dayDiff = Math.abs((txDate - bankDate) / 86400000);
          if (dayDiff > DATE_WINDOW) continue;
        }
      }

      const desc = descIdx >= 0 ? String(row[descIdx] || '').trim() : '';
      const dateStr = (dateIdx >= 0 && row[dateIdx]) ? Utilities.formatDate(parseDate_(row[dateIdx]), Session.getScriptTimeZone(), 'M/d') : '';
      return '差額' + diff + '円の取引あり（' + SEARCH_SHEETS[si] + ' ' + dateStr + ' ' + desc + '）';
    }
  }
  return '';
}

// =============================================================
// 摘要違い同一取引の重複削除
// 同日・同額・同方向の取引で、摘要テキストに共通部分がある場合に
// データ品質の高い方（ステータス・業務No等が入っている方）を残す
// =============================================================

function dedupFuzzyBankRows_() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_BANK);
  if (!sheet || sheet.getLastRow() < 3) return 0;

  const hdrs = getHeaderIdx_(sheet);
  const dateCol    = hdrs[BANK_COL.DATE];
  const amountCol  = hdrs[BANK_COL.AMOUNT];
  const partnerCol = hdrs[BANK_COL.PARTNER];
  const selfCol    = hdrs[BANK_COL.SELF];
  const statusCol  = hdrs[BANK_COL.STATUS];
  const bizNoCol   = hdrs[BANK_COL.BIZ_NO];
  const custNoCol  = hdrs[BANK_COL.CUST_NO];
  const protCol    = hdrs[BANK_COL.PROTECTED];
  if (dateCol === undefined || amountCol === undefined) return 0;

  const values = sheet.getDataRange().getValues();

  // 日付+金額 でグルーピング（ヘッダー行をスキップ）
  const groups = {};
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const d   = parseDate_(row[dateCol]);
    const amt = toNum_(row[amountCol]);
    if (!d || !amt) continue;

    const key = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') + '|' + amt;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  // 2件以上ある組だけチェック
  const rowsToDelete = new Set();
  Object.keys(groups).forEach(function(key) {
    const rows = groups[key];
    if (rows.length < 2) return;

    // 保護フラグ付きは除外
    const candidates = rows.filter(function(r) {
      return !(protCol !== undefined && isTruthy_(values[r][protCol]));
    });
    if (candidates.length < 2) return;

    // 摘要の類似チェック: 正規化後に共通部分文字列（4文字以上）があるかを確認
    for (let i = 0; i < candidates.length; i++) {
      if (rowsToDelete.has(candidates[i])) continue;
      for (let j = i + 1; j < candidates.length; j++) {
        if (rowsToDelete.has(candidates[j])) continue;

        const textA = normalizeText_(
          String(partnerCol !== undefined ? values[candidates[i]][partnerCol] : '') + ' ' +
          String(selfCol    !== undefined ? values[candidates[i]][selfCol]    : '')
        );
        const textB = normalizeText_(
          String(partnerCol !== undefined ? values[candidates[j]][partnerCol] : '') + ' ' +
          String(selfCol    !== undefined ? values[candidates[j]][selfCol]    : '')
        );

        if (!hasSimilarSubstring_(textA, textB, 4)) continue;

        // 類似 → データ品質の高い方を残す
        const scoreI = fuzzyRowScore_(values[candidates[i]], statusCol, bizNoCol, custNoCol, partnerCol, selfCol);
        const scoreJ = fuzzyRowScore_(values[candidates[j]], statusCol, bizNoCol, custNoCol, partnerCol, selfCol);

        if (scoreI >= scoreJ) {
          rowsToDelete.add(candidates[j]);
        } else {
          rowsToDelete.add(candidates[i]);
        }
      }
    }
  });

  if (rowsToDelete.size === 0) return 0;

  // 下から削除（行番号がずれないように）
  const deleteRows = Array.from(rowsToDelete).sort(function(a, b) { return b - a; });
  deleteRows.forEach(function(r) {
    sheet.deleteRow(r + 1); // +1 because values array is 0-based, sheet is 1-based
  });

  return deleteRows.length;
}

// 4文字以上の共通部分文字列があるかチェック
function hasSimilarSubstring_(a, b, minLen) {
  if (!a || !b) return false;
  const shorter = a.length <= b.length ? a : b;
  const longer  = a.length >  b.length ? a : b;
  for (let len = Math.min(shorter.length, 10); len >= minLen; len--) {
    for (let start = 0; start <= shorter.length - len; start++) {
      if (longer.indexOf(shorter.substring(start, start + len)) >= 0) return true;
    }
  }
  return false;
}

// 行のデータ品質スコア（高い方を残す）
function fuzzyRowScore_(row, statusCol, bizNoCol, custNoCol, partnerCol, selfCol) {
  let score = 0;
  if (statusCol !== undefined && row[statusCol]) score += 100; // ステータスが入っている行を優先
  if (bizNoCol  !== undefined && row[bizNoCol])  score += 80;
  if (custNoCol !== undefined && row[custNoCol]) score += 60;
  // 摘要が「該当なし」で始まらない方を優先
  const partner = String(partnerCol !== undefined ? row[partnerCol] : '');
  if (partner && partner.indexOf('該当なし') < 0) score += 40;
  // 自摘要が入っている方を優先
  if (selfCol !== undefined && row[selfCol]) score += 20;
  // 摘要の文字数が多い方を優先
  score += Math.min(partner.length, 30);
  return score;
}

// =============================================================
// シート整備
// =============================================================

// 列幅を内容に合わせて自動調整
function autoResizeSheet_(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) return;
  sheet.autoResizeColumns(1, sheet.getLastColumn());
}

// 指定列名の列を削除
function removeColumnByName_(sheet, colName) {
  if (!sheet || sheet.getLastRow() < 1) return;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  for (let i = headers.length - 1; i >= 0; i--) {
    if (String(headers[i] || '').trim() === colName) {
      sheet.deleteColumn(i + 1);
    }
  }
}

// 銀行一覧の不要列を削除して列幅調整（取込後に実行）
function cleanupBankListSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ['銀行入金一覧', '銀行出金一覧', '銀行一覧'].forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    removeColumnByName_(sheet, '取込ファイル');
    removeColumnByName_(sheet, '取込ファイル名');
    autoResizeSheet_(sheet);
  });
}

// =============================================================
// 銀行文字補正学習 → AI読み取り学習用 データ移行
// =============================================================
function migrateBankCorrectionToLearning_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const oldSheet = ss.getSheetByName('銀行文字補正学習');
  if (!oldSheet || oldSheet.getLastRow() <= 1) return 0;

  // AI読み取り学習用シートを確保（有効・置換方法・メモ列含む）
  var learningSheet = ss.getSheetByName('AI読み取り学習用');
  if (!learningSheet) {
    learningSheet = ss.insertSheet('AI読み取り学習用');
  }

  // ヘッダー確保
  var lastCol = Math.max(learningSheet.getLastColumn(), 1);
  var existingHeaders = learningSheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(h) { return String(h || '').trim(); });

  var requiredHeaders = ['読み取り日付', 'ファイル名', 'ファイルURL', '該当シート', '該当列',
                         '読取データ', '正データ', '判定理由', '有効', '置換方法', 'メモ'];
  if (existingHeaders.every(function(h) { return !h; })) {
    learningSheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    existingHeaders = requiredHeaders;
  } else {
    var missingHeaders = requiredHeaders.filter(function(h) { return existingHeaders.indexOf(h) < 0; });
    if (missingHeaders.length) {
      var startCol = learningSheet.getLastColumn() + 1;
      learningSheet.getRange(1, startCol, 1, missingHeaders.length).setValues([missingHeaders]);
      existingHeaders = existingHeaders.concat(missingHeaders);
    }
  }

  // ヘッダーマップ再取得
  var headerMap = {};
  existingHeaders.forEach(function(h, i) { if (h) headerMap[h] = i; });

  // 旧シートからデータ読み込み
  var oldHeaderMap = {};
  var oldHeaders = oldSheet.getRange(1, 1, 1, oldSheet.getLastColumn()).getValues()[0];
  oldHeaders.forEach(function(h, i) { oldHeaderMap[String(h || '').trim()] = i; });

  var oldData = oldSheet.getRange(2, 1, oldSheet.getLastRow() - 1, oldSheet.getLastColumn()).getValues();
  var migrated = 0;

  var newRows = oldData.map(function(row) {
    var fromText = String(row[oldHeaderMap['誤読文字']] || '').trim();
    var toText = String(row[oldHeaderMap['正しい文字']] || '').trim();
    if (!fromText) return null;

    var newRow = new Array(existingHeaders.length).fill('');
    newRow[headerMap['該当シート']] = String(row[oldHeaderMap['対象シート']] || '').trim();
    newRow[headerMap['該当列']] = String(row[oldHeaderMap['対象列']] || '').trim();
    newRow[headerMap['読取データ']] = fromText;
    newRow[headerMap['正データ']] = toText;
    newRow[headerMap['有効']] = String(row[oldHeaderMap['有効']] || 'Y').trim() || 'Y';
    if (headerMap['置換方法'] !== undefined) {
      newRow[headerMap['置換方法']] = String(row[oldHeaderMap['置換方法']] || '').trim();
    }
    if (headerMap['メモ'] !== undefined) {
      newRow[headerMap['メモ']] = String(row[oldHeaderMap['メモ']] || '').trim();
    }
    if (headerMap['判定理由'] !== undefined) {
      newRow[headerMap['判定理由']] = '銀行文字補正学習から移行';
    }
    migrated++;
    return newRow;
  }).filter(Boolean);

  if (newRows.length) {
    var startRow = learningSheet.getLastRow() + 1;
    learningSheet.getRange(startRow, 1, newRows.length, existingHeaders.length).setValues(newRows);
  }

  // 旧シートを非表示
  try { oldSheet.hideSheet(); } catch(e) { /* 非表示にできない場合は無視 */ }

  return migrated;
}

// =============================================================
// コンクエスト/保険データ診断
// =============================================================
function diagnoseSalesSpecialBuckets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var salesSheet = ss.getSheetByName('振込入金リスト一覧');
  if (!salesSheet || salesSheet.getLastRow() < 2) return '振込入金リスト一覧にデータがありません';

  var headerMap = {};
  var headers = salesSheet.getRange(1, 1, 1, salesSheet.getLastColumn()).getValues()[0];
  headers.forEach(function(h, i) { if (h) headerMap[String(h).trim()] = i; });

  var data = salesSheet.getRange(2, 1, salesSheet.getLastRow() - 1, salesSheet.getLastColumn()).getValues();
  var conquest = 0, insurance = 0, normal = 0;
  var conquestExamples = [], insuranceExamples = [];

  data.forEach(function(row) {
    var billTo = String(row[headerMap['請求先名']] || '').trim();
    var specialType = String(row[headerMap['特殊案件区分']] || '').trim();
    var bizNo = String(row[headerMap['業務№'] || headerMap['業務No'] || headerMap['業務No.']] || '').trim();

    if (specialType.indexOf('コンクエスト') >= 0 || billTo.indexOf('コンクエスト') >= 0) {
      conquest++;
      if (conquestExamples.length < 3) conquestExamples.push(bizNo + ': ' + billTo);
    } else if (['保険', '損保', '共済', 'あいおい', '三井住友海上', '東京海上', '損保ジャパン', 'ソンポ', 'JA共済'].some(function(k) { return billTo.indexOf(k) >= 0; })) {
      insurance++;
      if (insuranceExamples.length < 3) insuranceExamples.push(bizNo + ': ' + billTo);
    } else {
      normal++;
    }
  });

  return '全件: ' + data.length +
    '\nコンクエスト: ' + conquest + '件' + (conquestExamples.length ? ' (' + conquestExamples.join(', ') + ')' : '') +
    '\n保険: ' + insurance + '件' + (insuranceExamples.length ? ' (' + insuranceExamples.join(', ') + ')' : '') +
    '\n通常: ' + normal + '件';
}

// =============================================================
// GASエディタ直接実行用ラッパー（getUi不使用）
// =============================================================

/** 照合＋ビュー更新（UI通知なし） */
function runReconcileNoUi() {
  var result = runReconcile_();
  var cardResult = runCashReconcile_();
  var insResult = runInsuranceReconcile_();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try { renderOperationalBankListView_(ss);  } catch(e) { Logger.log('銀行一覧更新エラー: ' + e.message); }
  try { renderOperationalSalesView_(ss);     } catch(e) { Logger.log('案件一覧ビュー更新エラー: ' + e.message); }
  try { renderOperationalConquestView_(ss);  } catch(e) { Logger.log('コンクエスト管理更新エラー: ' + e.message); }
  try { renderOperationalInsuranceView_(ss); } catch(e) { Logger.log('保険立替管理更新エラー: ' + e.message); }

  ['銀行一覧', '案件一覧', 'コンクエスト管理', '保険立替管理'].forEach(function(name) {
    var sh = ss.getSheetByName(name);
    if (sh) autoResizeSheet_(sh);
  });

  Logger.log('振込: 自動' + result.auto + ' 要確認' + result.review + ' 未照合' + result.unmatched);
  Logger.log('クレカ: 自動' + cardResult.auto + ' 要確認' + cardResult.review);
  Logger.log('保険: 自動' + insResult.auto + ' 要確認' + insResult.review);
}

/** データ移行実行 */
function runMigration() {
  var count = migrateBankCorrectionToLearning_();
  Logger.log('移行件数: ' + count);
}

/** 案件リスト更新＋コンクエスト/保険診断＋ビュー更新 */
function runDiagnose() {
  var diagResult = diagnoseSalesSpecialBuckets_();
  Logger.log(diagResult);
}

/** 案件リスト更新（UI通知なし） */
function runUpdateSalesListNoUi() {
  var count = syncSalesListFromSource_();
  Logger.log('案件リスト更新: ' + count + '件');
}
