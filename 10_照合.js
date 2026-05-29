function runUpdateMatch() {
  replaceDataFromLearningSheet_('振込入金リスト一覧');
  replaceDataFromLearningSheet_('銀行データチェック用');
  appendNewCustomersToAliasSheet();

  // 自動消込
  updateBankSheetWithMatchedSalesData();
  updateCashSheetWithMatchedSalesData();

  try {
    crossCheckSalesTotalsWithSourceSheet_();
  } catch (error) {
    console.error('売上クロスチェック失敗: ' + error.message);
  }

  try {
    refreshOperationalPaymentViews_();
  } catch (error) {
    console.error('案件進捗更新失敗: ' + error.message);
  }
}

function runSpecialCasePreparation() {
  replaceDataFromLearningSheet_('振込入金リスト一覧');
  replaceDataFromLearningSheet_('銀行データチェック用');
  appendNewCustomersToAliasSheet();
  applySpecialSalesCaseRules_();
  updateBankCardSettlementKeyWithGemini();
  setCardMatchFormula();
  annotateInsurancePaymentCandidates_();
  try {
    refreshOperationalPaymentViews_();
  } catch (error) {
    console.error('特殊案件反映失敗: ' + error.message);
  }
}

function runFinalizeCardSettlementMatches_() {
  updateBankStatusByCardMatchAmount();
}

function runFinalizeAiAssistMatches_() {
  markMatchedBankAndCashWithSalesByGemini();
  annotateRemainingBankReviewReasons_();
  try {
    refreshOperationalPaymentViews_();
  } catch (error) {
    console.error('案件進捗更新失敗: ' + error.message);
  }
}

function runUpdateAiMatch() {
  runFinalizeCardSettlementMatches_();
  runFinalizeAiAssistMatches_();
}

function syncSalesListFromSourceSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const targetSheet = ss.getSheetByName(SHEET.SALES.NAME);
  if (!targetSheet) {
    throw new Error('案件一覧シートが見つかりません: ' + SHEET.SALES.NAME);
  }

  ensureSalesOperationalHeaders_(targetSheet);
  const sourceSs = SpreadsheetApp.openById(
    typeof getNyukinSourceSpreadsheetId_ === 'function'
      ? getNyukinSourceSpreadsheetId_()
      : RECONCILE_CFG.CROSS_CHECK_SPREADSHEET_ID
  );
  const targetHeaders = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0]
    .map(function(value) { return String(value || '').trim(); });
  const targetHeaderMap = {};
  targetHeaders.forEach(function(header, index) {
    if (header) targetHeaderMap[header] = index;
  });

  const protectedRows = collectProtectedSalesRows_(targetSheet, targetHeaders, targetHeaderMap);
  const generatedRows = [];
  RECONCILE_CFG.SOURCE_SERVICE_SHEETS.forEach(function(sheetName) {
    Array.prototype.push.apply(generatedRows, buildSalesRowsFromServiceSourceSheet_(sourceSs, sheetName, targetHeaders, targetHeaderMap));
  });
  Array.prototype.push.apply(generatedRows, buildSalesRowsFromVehicleSourceSheet_(sourceSs, RECONCILE_CFG.SOURCE_VEHICLE_SHEET, targetHeaders, targetHeaderMap));

  const rows = mergeProtectedSalesRows_(protectedRows, generatedRows, targetHeaderMap);

  rows.sort(function(left, right) {
    const leftDate = parseJsonLikeDate_(left[targetHeaderMap[SHEET.SALES.HEADER.DATE]]) || new Date(0);
    const rightDate = parseJsonLikeDate_(right[targetHeaderMap[SHEET.SALES.HEADER.DATE]]) || new Date(0);
    return rightDate - leftDate;
  });

  if (targetSheet.getLastRow() > 1) {
    targetSheet.getRange(2, 1, targetSheet.getLastRow() - 1, targetSheet.getLastColumn()).clearContent().clearNote();
  }
  if (rows.length) {
    targetSheet.getRange(2, 1, rows.length, targetSheet.getLastColumn()).setValues(rows);
  }
}

function ensureSalesOperationalHeaders_(sheet) {
  const required = [
    SHEET.SALES.HEADER.BIZ_NO,
    SHEET.SALES.HEADER.DATE,
    SHEET.SALES.HEADER.CUST_NAME,
    SHEET.SALES.HEADER.TOTAL,
    SHEET.SALES.HEADER.CUST_NO,
    SHEET.SALES.HEADER.STATUS,
    SHEET.SALES.HEADER.METHOD,
    SHEET.SALES.HEADER.WORK_TYPE,
    SHEET.SALES.HEADER.DUE_DATE,
    SHEET.SALES.HEADER.BILL_TO,
    SHEET.SALES.HEADER.GROSS_PROFIT,
    SHEET.SALES.HEADER.SPECIAL_TYPE,
    SHEET.SALES.HEADER.RECONCILE_AMOUNT,
    SHEET.SALES.HEADER.SPECIAL_MEMO,
    PAYMENT_PROGRESS_HEADERS.SALES_PAID_TOTAL,
    PAYMENT_PROGRESS_HEADERS.SALES_PROGRESS_STATUS,
    PAYMENT_PROGRESS_HEADERS.SALES_MEMO,
    '保護フラグ'
  ];
  ensureSheetHeaders_(sheet, required);
}

function collectProtectedSalesRows_(sheet, headers, headerMap) {
  const protectIdx = headerMap['保護フラグ'];
  if (protectIdx === undefined || sheet.getLastRow() < 2) {
    return [];
  }
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  return values.filter(function(row) {
    return isTruthyFlag_(row[protectIdx]);
  });
}

function mergeProtectedSalesRows_(protectedRows, generatedRows, headerMap) {
  const merged = new Map();

  function addRow(row, preferExisting) {
    const key = buildSalesSyncRowKey_(row, headerMap);
    if (!key) {
      merged.set('row:' + merged.size, row);
      return;
    }
    if (!preferExisting || !merged.has(key)) {
      merged.set(key, row);
    }
  }

  (protectedRows || []).forEach(function(row) { addRow(row, false); });
  (generatedRows || []).forEach(function(row) { addRow(row, true); });
  return Array.from(merged.values());
}

function buildSalesSyncRowKey_(row, headerMap) {
  const bizNo = safeString_(row[headerMap[SHEET.SALES.HEADER.BIZ_NO]]);
  if (bizNo) return 'biz:' + bizNo;
  const customerName = normalizeMatchText_(row[headerMap[SHEET.SALES.HEADER.CUST_NAME]]);
  const dateKey = normalizeSyncDateKey_(row[headerMap[SHEET.SALES.HEADER.DATE]]);
  const amount = toNumber_(row[headerMap[SHEET.SALES.HEADER.TOTAL]]);
  if (!customerName && !dateKey && !amount) return '';
  return ['fallback', customerName, dateKey, amount].join('|');
}

function normalizeSyncDateKey_(value) {
  const date = parseJsonLikeDate_(value);
  if (!date) return '';
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy/MM/dd');
}


const SHEET = {
  BANK: {
    NAME: '銀行データチェック用',
    HEADER: {
      DATE: '日付',
      AMOUNT: '金額',
      OTHER_PARTY: '相手摘要',
      SELF_SUMMARY: '自摘要',
      SUBJECT: '相手科目',
      STATUS: 'ステータス',
      CUST_NO: '顧客No.',
      BIZ_NO: '業務No.',
      PROTECTED: '保護フラグ',
      CARD_SETTLEMENT_KEY: 'カード会社振り込み',
      CARD_MATCH_AMOUNT: 'カード照合額'
    }
  },
  CASH: {
    NAME: 'クレカ・現金',
    HEADER: {
      DATE: '取引日',
      VENDOR: '取引先',
      TOTAL: '合計',
      STATUS: 'ステータス',
      BIZ_NO: '業務No',
      CUST_NO: '顧客No',
      CREDIT_TYPE: 'クレカ種別',
      METHOD: '入金方法'
    }
  },
  SALES: {
    NAME: '振込入金リスト一覧',
    HEADER: {
      BIZ_NO: '業務№',
      DATE: '日付',
      CUST_NAME: '顧客名',
      TOTAL: '売上総計',
      CUST_NO: '顧客№',
      STATUS: 'ステータス',
      METHOD: '入金方法',
      WORK_TYPE: '作業大区分名',
      DUE_DATE: '入金予定日',
      BILL_TO: '請求先名',
      GROSS_PROFIT: '粗利益',
      SPECIAL_TYPE: '特殊案件区分',
      RECONCILE_AMOUNT: '照合基準額',
      SPECIAL_MEMO: '特殊計算メモ',
      PROTECTED: '保護フラグ'
    }
  },
  ALIAS: {
    NAME: '※名義対応表',
    HEADER: {
      CUST_NO: '顧客No.',
      DISPLAY_NAME: '入金データ表示名',
      JOCAR_NAME: 'Jocar登録名'
    }
  }
}

const MATCH_STATUS = {
  AUTO: '自動消込',
  REVIEW: '要確認',
  CARD_MATCH: 'カード入金照合'
};

const RECONCILE_CFG = {
  LEARNING_MASTER_SHEET: '照合学習マスタ',
  RECURRING_BANK_SHEET: '定期入金リスト',
  CROSS_CHECK_SPREADSHEET_ID: '1QNctVAnkattCX9dyT9DBmaPXWF9-nsfmZwEtEp4t1R8',
  CROSS_CHECK_AUDIT_SHEET: '売上クロスチェック',
  SOURCE_SERVICE_SHEETS: ['顧客対応状況（車検）', '顧客対応状況（12点）'],
  SOURCE_VEHICLE_SHEET: '顧客対応状況（車両販売）',
  AUTO_SCORE: 220,
  REVIEW_SCORE: 150,
  SPLIT_AUTO_SCORE: 60,
  SPLIT_REVIEW_SCORE: 45,
  DATE_WINDOW_DAYS: 90,
  SPLIT_MAX_COMBO_SIZE: 3,
  SPLIT_MAX_CANDIDATES: 8
};

const SPECIAL_CASE_CFG = {
  CONQUEST_GROSS_VENDOR: '株式会社コンクエスト　ジャガーランドローバー広島',
  CONQUEST_SUM_VENDOR: '株式会社　コンクエスト　ｼﾞｬｶﾞｰﾗﾝﾄﾞﾛｰﾊﾞｰ営業部門',
  CONQUEST_JLR_VENDOR: '株式会社コンクエスト',
  BOARD_WORK_TYPES: ['板金', '鈑金', '板金塗装', '鈑金・塗装', '保険請求'],
  INSURANCE_HINTS: ['保険', '損保', '共済', 'あいおい', '三井住友海上', '東京海上', '損保ジャパン', 'ソンポ', 'JA共済'],
  LOAN_COMPANY_HINTS: ['オリコ', 'オリエント', 'プレミア', 'ジャックス', 'アプラス', 'セディナ'],
  MICRO_DIFF_MAX: 5000
};

const PAYMENT_PROGRESS_HEADERS = {
  SALES_AMOUNT: '売上総計',
  SALES_BIZ_NO: '業務№',
  SALES_CUST_NO: '顧客№',
  SALES_MATCH_STATUS: 'ステータス',
  SALES_METHOD: '入金方法',
  SALES_PAID_TOTAL: '入金累計',
  SALES_PROGRESS_STATUS: '入金状況',
  SALES_MEMO: '確認メモ',
  BANK_AMOUNT: '金額',
  BANK_STATUS: 'ステータス',
  BANK_BIZ_NO: '業務No.',
  BANK_CUST_NO: '顧客No.',
  CASH_AMOUNT: '合計',
  CASH_STATUS: 'ステータス',
  CASH_BIZ_NO: '業務No',
  CASH_CUST_NO: '顧客No',
  CASH_METHOD: '入金方法',
  INVOICE_SHEET: '請求書発行',
  INVOICE_DATE: '取引日',
  INVOICE_VENDOR: '取引先',
  INVOICE_NO: '伝票番号',
  INVOICE_TOTAL: '合計',
  INVOICE_DUE: '入金予定日',
  INVOICE_PAID_TOTAL: '入金累計',
  INVOICE_PROGRESS_STATUS: '入金状況',
  INVOICE_MEMO: '確認メモ',
  INVOICE_STATUS: 'ステータス'
};


/**
 * 1. 照合と転記のメイン処理
 * ステータスが空、または「自動消込」以外の場合のみ照合を実行します。
 */
function updateBankSheetWithMatchedSalesData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const timezone = Session.getScriptTimeZone();

  const bankSheet = ss.getSheetByName(SHEET.BANK.NAME);
  const salesSheet = ss.getSheetByName(SHEET.SALES.NAME);

  if (!bankSheet || !salesSheet) {
    console.error('必要なシートが見つかりません。');
    return;
  }

  const bankTargetHeaders = [
    SHEET.BANK.HEADER.DATE,
    SHEET.BANK.HEADER.AMOUNT,
    SHEET.BANK.HEADER.OTHER_PARTY,
    SHEET.BANK.HEADER.SELF_SUMMARY,
    SHEET.BANK.HEADER.STATUS,
    SHEET.BANK.HEADER.SUBJECT,
    SHEET.BANK.HEADER.PROTECTED
  ];

  const salesTargetHeaders = [
    SHEET.SALES.HEADER.BIZ_NO,
    SHEET.SALES.HEADER.DATE,
    SHEET.SALES.HEADER.CUST_NAME,
    SHEET.SALES.HEADER.TOTAL,
    SHEET.SALES.HEADER.CUST_NO,
    SHEET.SALES.HEADER.STATUS,
    SHEET.SALES.HEADER.METHOD,
    SHEET.SALES.HEADER.WORK_TYPE,
    SHEET.SALES.HEADER.DUE_DATE,
    SHEET.SALES.HEADER.BILL_TO,
    SHEET.SALES.HEADER.GROSS_PROFIT,
    SHEET.SALES.HEADER.RECONCILE_AMOUNT,
    SHEET.SALES.HEADER.SPECIAL_TYPE,
    SHEET.SALES.HEADER.SPECIAL_MEMO,
    SHEET.SALES.HEADER.PROTECTED
  ];

  const bankData = getSheetDataWithRowIdAndFormatDate_(bankSheet, bankTargetHeaders, timezone);
  let salesData = getSheetDataWithRowIdAndFormatDate_(salesSheet, salesTargetHeaders, timezone);
  salesData = salesData.filter(salesRow => {
    return !isTruthyFlag_(salesRow[SHEET.SALES.HEADER.PROTECTED]);
  });

  const bankHeaders = bankSheet.getRange(1, 1, 1, bankSheet.getLastColumn()).getValues()[0]
    .map(h => h ? String(h).trim() : "");

  const salesHeaders = salesSheet.getRange(1, 1, 1, salesSheet.getLastColumn()).getValues()[0]
    .map(h => h ? String(h).trim() : "");

  const customerNoIdx = bankHeaders.indexOf(SHEET.BANK.HEADER.CUST_NO);
  const businessNoIdx = bankHeaders.indexOf(SHEET.BANK.HEADER.BIZ_NO);
  const statusIdx = bankHeaders.indexOf(SHEET.BANK.HEADER.STATUS);

  const salesStatusIdx = salesHeaders.indexOf(SHEET.SALES.HEADER.STATUS);
  const salesMethodIdx = salesHeaders.indexOf(SHEET.SALES.HEADER.METHOD);

  if (customerNoIdx === -1 || businessNoIdx === -1 || statusIdx === -1) {
    console.error('銀行シートの必要列が見つかりません。');
    return;
  }

  if (salesStatusIdx === -1 || salesMethodIdx === -1) {
    console.error('振込入金リスト一覧シートの必要列が見つかりません。');
    return;
  }

  const bankRange = bankSheet.getRange(1, 1, bankSheet.getLastRow(), bankSheet.getLastColumn());
  const bankValues = bankRange.getValues();

  const salesRange = salesSheet.getRange(1, 1, salesSheet.getLastRow(), salesSheet.getLastColumn());
  const salesValues = salesRange.getValues();

  const bankStatusNotes = bankSheet.getRange(1, statusIdx + 1, bankSheet.getLastRow(), 1).getNotes();
  const salesStatusNotes = salesSheet.getRange(1, salesStatusIdx + 1, salesSheet.getLastRow(), 1).getNotes();

  const learningMaster = loadReconciliationLearningMaster_();
  const recurringRules = loadRecurringBankRules_();
  const aliasCandidates = loadAliasCandidates_();
  const salesContexts = salesData.map(salesRow => buildSalesMatchContext_(salesRow, learningMaster));
  const bankContexts = bankData.map(bankRow => buildBankMatchContext_(bankRow, learningMaster, aliasCandidates));
  const matchedBankRows = new Set();
  const matchedSalesRows = new Set();
  let autoMatchCount = 0;
  let reviewCount = 0;

  bankContexts.forEach(bankCtx => {
    const rowIndex = bankCtx.id - 1;
    const currentStatus = String(bankValues[rowIndex][statusIdx] || "").trim();

    const currentBiz = String(bankValues[rowIndex][businessNoIdx] || '').trim();
    const currentCust = String(bankValues[rowIndex][customerNoIdx] || '').trim();

    if (((currentStatus === MATCH_STATUS.AUTO || currentStatus === '手動消込') && (currentBiz || currentCust)) || bankCtx.protectedFlag) {
      return;
    }

    const recurringMatch = findRecurringBankRuleMatch_(bankCtx, recurringRules);
    if (recurringMatch) {
      bankValues[rowIndex][customerNoIdx] = recurringMatch.custNo || '';
      bankValues[rowIndex][businessNoIdx] = recurringMatch.bizNo || '';
      bankValues[rowIndex][statusIdx] = recurringMatch.status || MATCH_STATUS.AUTO;
      bankStatusNotes[rowIndex][0] = recurringMatch.memo || '定期入金リスト一致';
      autoMatchCount++;
      return;
    }

    const matchResult = findBestSalesMatchForBank_(bankCtx, salesContexts, matchedSalesRows);
    if (!matchResult) {
      return;
    }

    matchedBankRows.add(bankCtx.id);
    matchedSalesRows.add(matchResult.sale.id);

    applyBankSalesMatch_(
      bankCtx,
      matchResult.sale,
      matchResult,
      bankValues,
      salesValues,
      bankStatusNotes,
      salesStatusNotes,
      customerNoIdx,
      businessNoIdx,
      statusIdx,
      salesStatusIdx,
      salesMethodIdx
    );

    if (matchResult.status === MATCH_STATUS.AUTO) {
      autoMatchCount++;
    } else {
      reviewCount++;
    }
  });

  bankContexts.forEach(bankCtx => {
    const rowIndex = bankCtx.id - 1;
    const currentStatus = String(bankValues[rowIndex][statusIdx] || '').trim();
    const currentBiz = String(bankValues[rowIndex][businessNoIdx] || '').trim();
    const currentCust = String(bankValues[rowIndex][customerNoIdx] || '').trim();

    if (['自動消込', '手動消込', '補正適用'].indexOf(currentStatus) === -1) return;
    if (currentBiz || currentCust) return;
    if (bankCtx.protectedFlag || !(bankCtx.amount > 0) || isCardBankContext_(bankCtx) || isConquestBankContext_(bankCtx)) return;

    const matchResult = findBestSalesMatchForBank_(bankCtx, salesContexts, matchedSalesRows);
    if (!matchResult) return;

    matchedBankRows.add(bankCtx.id);
    matchedSalesRows.add(matchResult.sale.id);
    applyBankSalesMatch_(
      bankCtx,
      matchResult.sale,
      { sale: matchResult.sale, score: matchResult.score, reasons: matchResult.reasons, status: currentStatus || matchResult.status },
      bankValues,
      salesValues,
      bankStatusNotes,
      salesStatusNotes,
      customerNoIdx,
      businessNoIdx,
      statusIdx,
      salesStatusIdx,
      salesMethodIdx
    );
    bankValues[rowIndex][statusIdx] = currentStatus || matchResult.status;
  });

  salesContexts.forEach(saleCtx => {
    if (matchedSalesRows.has(saleCtx.id)) return;
    if (String(saleCtx.currentStatus || '').trim() === MATCH_STATUS.AUTO) return;
    if (String(saleCtx.currentStatus || '').trim() === '手動消込') return;
    if (saleCtx.protectedFlag) return;

    const splitResult = findSplitBankMatchesForSale_(saleCtx, bankContexts, matchedBankRows);
    if (!splitResult) return;

    matchedSalesRows.add(saleCtx.id);
    splitResult.banks.forEach(bankCtx => matchedBankRows.add(bankCtx.id));

    applySplitBankSalesMatch_(
      saleCtx,
      splitResult,
      bankValues,
      salesValues,
      bankStatusNotes,
      salesStatusNotes,
      customerNoIdx,
      businessNoIdx,
      statusIdx,
      salesStatusIdx,
      salesMethodIdx
    );

    if (splitResult.status === MATCH_STATUS.AUTO) {
      autoMatchCount += splitResult.banks.length;
    } else {
      reviewCount += splitResult.banks.length;
    }
  });

  if (bankData.length > 0) {
    bankRange.setValues(bankValues);
    salesRange.setValues(salesValues);
    bankSheet.getRange(1, statusIdx + 1, bankSheet.getLastRow(), 1).setNotes(bankStatusNotes);
    salesSheet.getRange(1, salesStatusIdx + 1, salesSheet.getLastRow(), 1).setNotes(salesStatusNotes);

    console.log(`新規 自動消込: ${autoMatchCount}件`);
    console.log(`新規 要確認  : ${reviewCount}件`);
  }
}

function loadReconciliationLearningMaster_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(RECONCILE_CFG.LEARNING_MASTER_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h || '').trim());
  const index = {};
  headers.forEach((header, idx) => {
    index[header] = idx;
  });

  return values.slice(1).map(row => {
    const rawBankSummary = String(row[index['銀行摘要原文']] || '').trim();
    const normalizedSummary = String(row[index['正規摘要']] || '').trim();
    const customerName = String(row[index['正規顧客名']] || '').trim();
    const aliases = [
      String(row[index['別名1']] || '').trim(),
      String(row[index['別名2']] || '').trim()
    ].filter(Boolean);
    const code = String(row[index['管理番号']] || '').trim();
    const expectedCategory = String(row[index['想定作業大区分']] || '').trim();
    const billingName = String(row[index['想定請求先']] || '').trim();
    const priority = String(row[index['照合優先キー']] || '').trim();
    const autoAllowed = String(row[index['自動消込可否']] || '').trim().toUpperCase() !== 'NO';

    if (!rawBankSummary && !customerName && !aliases.length && !code) return null;

    const matchKeys = [
      rawBankSummary,
      normalizedSummary,
      customerName
    ].concat(aliases).filter(Boolean).map(normalizeMatchText_);

    return {
      rawBankSummary,
      normalizedSummary,
      customerName,
      aliases,
      code,
      expectedCategory,
      billingName,
      priority,
      autoAllowed,
      matchKeys
    };
  }).filter(Boolean);
}

function loadAliasCandidates_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aliasSheet = ss.getSheetByName(SHEET.ALIAS.NAME);
  if (!aliasSheet || aliasSheet.getLastRow() < 2) return [];

  const values = aliasSheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h || '').trim());
  const custNoIdx = headers.indexOf(SHEET.ALIAS.HEADER.CUST_NO);
  const displayIdx = headers.indexOf(SHEET.ALIAS.HEADER.DISPLAY_NAME);
  const jocarIdx = headers.indexOf(SHEET.ALIAS.HEADER.JOCAR_NAME);
  if ([custNoIdx, displayIdx, jocarIdx].includes(-1)) return [];

  const candidates = [];
  values.slice(1).forEach(row => {
    const custNo = String(row[custNoIdx] || '').trim();
    const names = [
      String(row[displayIdx] || '').trim(),
      String(row[jocarIdx] || '').trim()
    ].filter(Boolean);

    names.forEach(name => {
      candidates.push({
        custNo,
        customerName: name,
        normalizedName: normalizeMatchText_(name)
      });
    });
  });

  return candidates;
}

function loadRecurringBankRules_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(RECONCILE_CFG.RECURRING_BANK_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function(value) { return String(value || '').trim(); });
  const index = {};
  headers.forEach(function(header, idx) { index[header] = idx; });

  return values.slice(1).map(function(row) {
    const enabled = String(row[index['有効']] || '').trim().toUpperCase();
    if (enabled && ['TRUE', '1', 'YES', 'Y', '有効'].indexOf(enabled) === -1) return null;
    const summary = safeString_(row[index['摘要']]);
    const amount = toNumber_(row[index['金額']]);
    if (!summary || !amount) return null;
    return {
      normalizedSummary: normalizeMatchText_(summary),
      amount: amount,
      bizNo: safeString_(row[index['業務No.']]),
      custNo: safeString_(row[index['顧客No.']]),
      status: safeString_(row[index['ステータス']]) || MATCH_STATUS.AUTO,
      memo: safeString_(row[index['確認メモ']]) || '定期入金リスト一致'
    };
  }).filter(Boolean);
}

function findRecurringBankRuleMatch_(bankCtx, rules) {
  if (!rules || !rules.length) return null;
  const candidates = [
    normalizeMatchText_(bankCtx.rawName),
    normalizeMatchText_(bankCtx.fallbackName),
    normalizeMatchText_(bankCtx.matchingName)
  ].filter(Boolean);
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (Number(rule.amount) !== Number(bankCtx.amount)) continue;
    if (candidates.some(function(name) { return name === rule.normalizedSummary; })) {
      return rule;
    }
  }
  return null;
}

function buildSalesMatchContext_(salesRow, learningMaster) {
  const bizNo = String(salesRow[SHEET.SALES.HEADER.BIZ_NO] || '').trim();
  const custNo = String(salesRow[SHEET.SALES.HEADER.CUST_NO] || '').trim();
  const rawName = String(salesRow[SHEET.SALES.HEADER.CUST_NAME] || '').trim();
  const learning = findLearningEntryForText_(rawName, learningMaster);
  const reconcileAmount = toNumber_(salesRow[SHEET.SALES.HEADER.RECONCILE_AMOUNT]);
  const totalAmount = toNumber_(salesRow[SHEET.SALES.HEADER.TOTAL]);
  return {
    id: salesRow.id,
    row: salesRow.id,
    bizNo,
    custNo,
    rawName,
    normalizedName: normalizeMatchText_(learning && learning.customerName ? learning.customerName : rawName),
    workType: String(salesRow[SHEET.SALES.HEADER.WORK_TYPE] || '').trim(),
    amount: reconcileAmount > 0 ? reconcileAmount : totalAmount,
    date: parseJsonLikeDate_(salesRow[SHEET.SALES.HEADER.DATE]),
    dueDate: parseJsonLikeDate_(salesRow[SHEET.SALES.HEADER.DUE_DATE]),
    billTo: String(salesRow[SHEET.SALES.HEADER.BILL_TO] || '').trim(),
    specialType: String(salesRow[SHEET.SALES.HEADER.SPECIAL_TYPE] || '').trim(),
    currentStatus: String(salesRow[SHEET.SALES.HEADER.STATUS] || '').trim(),
    currentMethod: String(salesRow[SHEET.SALES.HEADER.METHOD] || '').trim(),
    protectedFlag: isTruthyFlag_(salesRow[SHEET.SALES.HEADER.PROTECTED])
  };
}

function buildBankMatchContext_(bankRow, learningMaster, aliasCandidates) {
  const rawName = String(bankRow[SHEET.BANK.HEADER.SELF_SUMMARY] || bankRow[SHEET.BANK.HEADER.OTHER_PARTY] || '').trim();
  const fallbackName = String(bankRow[SHEET.BANK.HEADER.OTHER_PARTY] || '').trim();
  const learning = findLearningEntryForText_([rawName, fallbackName].filter(Boolean).join(' '), learningMaster);
  const matchingName = deriveBankMatchingName_(rawName, fallbackName);
  const normalizedName = normalizeMatchText_(learning && learning.customerName ? learning.customerName : matchingName);
  const alias = findAliasCandidate_(normalizedName, aliasCandidates);

  return {
    id: bankRow.id,
    row: bankRow.id,
    rawName,
    fallbackName,
    matchingName,
    normalizedName,
    subject: String(bankRow[SHEET.BANK.HEADER.SUBJECT] || '').trim(),
    amount: toNumber_(bankRow[SHEET.BANK.HEADER.AMOUNT]),
    date: parseJsonLikeDate_(bankRow[SHEET.BANK.HEADER.DATE]),
    currentStatus: String(bankRow[SHEET.BANK.HEADER.STATUS] || '').trim(),
    codes: extractMatchCodes_([rawName, fallbackName, learning && learning.code].filter(Boolean).join(' ')),
    numericCodes: extractNumericFallbackCodes_([rawName, fallbackName, String(bankRow[SHEET.BANK.HEADER.SUBJECT] || '')].filter(Boolean).join(' ')),
    mappedCustNo: alias ? alias.custNo : '',
    protectedFlag: isTruthyFlag_(bankRow[SHEET.BANK.HEADER.PROTECTED]),
    learning
  };
}

function normalizedBankJoinedText_(bankCtx) {
  return normalizeMatchText_([bankCtx.rawName, bankCtx.fallbackName, bankCtx.subject].filter(Boolean).join(' '));
}

function isConquestSaleContext_(saleCtx) {
  return normalizeMatchText_(saleCtx.specialType).indexOf(normalizeMatchText_('コンクエスト')) >= 0 ||
    normalizeMatchText_(saleCtx.billTo).indexOf(normalizeMatchText_('コンクエスト')) >= 0;
}

function isConquestBankContext_(bankCtx) {
  return normalizedBankJoinedText_(bankCtx).indexOf(normalizeMatchText_('コンクエスト')) >= 0;
}

function isInsuranceBankContext_(bankCtx) {
  return isInsuranceLikeBankContext_(bankCtx);
}

function isLoanBankContext_(bankCtx) {
  const joined = normalizedBankJoinedText_(bankCtx);
  return SPECIAL_CASE_CFG.LOAN_COMPANY_HINTS.some(function(keyword) {
    return joined.indexOf(normalizeMatchText_(keyword)) >= 0;
  });
}

function isCardBankContext_(bankCtx) {
  const joined = normalizedBankJoinedText_(bankCtx);
  if (bankCtx.codes && bankCtx.codes.length) return false;
  return ['VISA', 'JCB', 'MASTER', 'AMEX', 'AMERICANEXPRESS'].some(function(keyword) {
    return joined.indexOf(normalizeMatchText_(keyword)) >= 0;
  });
}

function allowNormalBankSaleMatch_(bankCtx, saleCtx) {
  const saleIsConquest = isConquestSaleContext_(saleCtx);
  const bankIsConquest = isConquestBankContext_(bankCtx);
  if (saleIsConquest !== bankIsConquest) return false;
  return true;
}

function deriveBankMatchingName_(rawName, fallbackName) {
  const raw = safeString_(rawName);
  const fallback = safeString_(fallbackName);
  const candidate = extractTrailingCustomerLikeText_(fallback || raw);
  return candidate || fallback || raw;
}

function extractTrailingCustomerLikeText_(text) {
  const original = safeString_(text);
  if (!original) return '';

  const codeMatches = original.match(/(?:SB|CH|PC|RA)\s*0*\d{3,8}/ig) || [];
  if (codeMatches.length) {
    const lastCode = codeMatches[codeMatches.length - 1];
    const lastIndex = original.toUpperCase().lastIndexOf(lastCode.toUpperCase());
    if (lastIndex > 0) {
      const beforeCode = original.slice(0, lastIndex).trim();
      const pieces = beforeCode.split(/[　 ]+/).filter(Boolean);
      if (pieces.length >= 1) {
        return pieces.slice(-2).join(' ');
      }
      return beforeCode;
    }
  }

  const normalized = original.normalize ? original.normalize('NFKC') : original;
  const hints = SPECIAL_CASE_CFG.LOAN_COMPANY_HINTS.concat(SPECIAL_CASE_CFG.INSURANCE_HINTS);
  for (let i = 0; i < hints.length; i++) {
    const hint = hints[i];
    const idx = normalized.indexOf(hint);
    if (idx >= 0) {
      const tail = normalized.slice(idx + hint.length).replace(/^[\s　・･/]+/, '').trim();
      if (tail) return tail;
    }
  }

  return original;
}

function findLearningEntryForText_(text, learningMaster) {
  const normalized = normalizeMatchText_(text);
  if (!normalized) return null;

  let best = null;
  let bestLength = 0;
  learningMaster.forEach(entry => {
    entry.matchKeys.forEach(matchKey => {
      if (!matchKey) return;
      if (normalized === matchKey || normalized.indexOf(matchKey) >= 0 || matchKey.indexOf(normalized) >= 0) {
        if (matchKey.length > bestLength) {
          best = entry;
          bestLength = matchKey.length;
        }
      }
    });
  });

  return best;
}

function findAliasCandidate_(normalizedText, aliasCandidates) {
  if (!normalizedText) return null;
  let best = null;
  let bestLength = 0;

  aliasCandidates.forEach(candidate => {
    const aliasName = candidate.normalizedName;
    if (!aliasName) return;
    if (normalizedText === aliasName || normalizedText.indexOf(aliasName) >= 0 || aliasName.indexOf(normalizedText) >= 0) {
      if (aliasName.length > bestLength) {
        best = candidate;
        bestLength = aliasName.length;
      }
    }
  });

  return best;
}

function findBestSalesMatchForBank_(bankCtx, salesContexts, matchedSalesRows) {
  if (!bankCtx.amount || bankCtx.amount <= 0) return null;
  if (bankCtx.protectedFlag) return null;

  const exactAmountSales = salesContexts
    .filter(saleCtx => !matchedSalesRows.has(saleCtx.id))
    .filter(saleCtx => allowNormalBankSaleMatch_(bankCtx, saleCtx))
    .filter(saleCtx => saleCtx.amount === bankCtx.amount)
    .map(saleCtx => {
      const score = scoreBankToSalesMatch_(bankCtx, saleCtx);
      return {
        sale: saleCtx,
        score: score.score,
        reasons: score.reasons,
        status: score.status
      };
    });

  const candidates = exactAmountSales
    .filter(result => result.score >= RECONCILE_CFG.REVIEW_SCORE)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return calcDateDiffDays_(bankCtx.date, a.sale.date) - calcDateDiffDays_(bankCtx.date, b.sale.date);
    });

  if (!candidates.length) {
    if (exactAmountSales.length === 1) {
      const candidate = exactAmountSales[0];
      const dueDiffDays = calcDateDiffDays_(bankCtx.date, candidate.sale.dueDate);
      const diffDays = calcDateDiffDays_(bankCtx.date, candidate.sale.date);
      if ((dueDiffDays !== null && dueDiffDays <= 45) || (diffDays !== null && diffDays <= 45)) {
        const boostedScore = candidate.score + 70;
        const autoAllowed = !bankCtx.learning || bankCtx.learning.autoAllowed !== false;
        return {
          sale: candidate.sale,
          score: boostedScore,
          reasons: [...new Set(candidate.reasons.concat(['金額完全一致の単独候補']))],
          status: (boostedScore >= RECONCILE_CFG.AUTO_SCORE && autoAllowed) ? MATCH_STATUS.AUTO : MATCH_STATUS.REVIEW
        };
      }
    }
    return null;
  }

  if (candidates.length > 1 && Math.abs(candidates[0].score - candidates[1].score) <= 15) {
    candidates[0].status = MATCH_STATUS.REVIEW;
    candidates[0].reasons.push('近似候補が複数あるため確認が必要');
  }

  return candidates[0];
}

function scoreBankToSalesMatch_(bankCtx, saleCtx) {
  let score = 150;
  const reasons = ['金額完全一致'];
  const saleIsConquest = isConquestSaleContext_(saleCtx);
  const bankIsInsurance = isInsuranceBankContext_(bankCtx);
  const bankIsLoan = isLoanBankContext_(bankCtx);

  let bizNoMatched = false;
  if (saleCtx.bizNo && bankCtx.codes.indexOf(saleCtx.bizNo.toUpperCase()) >= 0) {
    score += 80;
    reasons.push('管理番号一致');
    bizNoMatched = true;
  }

  if (bankCtx.learning && bankCtx.learning.code && saleCtx.bizNo && bankCtx.learning.code.toUpperCase() === saleCtx.bizNo.toUpperCase()) {
    score += 80;
    reasons.push('学習マスタの管理番号一致');
    bizNoMatched = true;
  }

  if (!bizNoMatched && saleCtx.bizNo && bankCtx.numericCodes && bankCtx.numericCodes.length) {
    const saleDigits = String(saleCtx.bizNo).replace(/[^0-9]/g, '');
    if (saleDigits && saleDigits.length >= 3) {
      const hit = bankCtx.numericCodes.some(function(n) {
        return n === saleDigits || n.endsWith(saleDigits) || saleDigits.endsWith(n);
      });
      if (hit) {
        score += 60;
        reasons.push('業務No数字一致（摘要フォールバック）');
      }
    }
  }

  const dueDiffDays = calcDateDiffDays_(bankCtx.date, saleCtx.dueDate);
  if (dueDiffDays !== null) {
    if (dueDiffDays === 0) {
      score += 100;
      reasons.push('入金予定日一致');
    } else if (dueDiffDays <= 3) {
      score += 60;
      reasons.push('入金予定日近接');
    }
  }

  if (bankCtx.mappedCustNo && saleCtx.custNo && bankCtx.mappedCustNo === saleCtx.custNo) {
    score += 60;
    reasons.push('顧客No一致');
  }

  if (isStrongNormalizedNameMatch_(bankCtx.normalizedName, saleCtx.normalizedName)) {
    score += 50;
    reasons.push('顧客名一致');
  } else if (isLooseNormalizedNameMatch_(bankCtx.normalizedName, saleCtx.normalizedName)) {
    score += 25;
    reasons.push('顧客名近似');
  }

  const normalizedBillTo = normalizeMatchText_(saleCtx.billTo);
  if (normalizedBillTo && saleIsConquest) {
    if (isStrongNormalizedNameMatch_(bankCtx.normalizedName, normalizedBillTo)) {
      score += 70;
      reasons.push('請求先名一致');
    } else if (isLooseNormalizedNameMatch_(bankCtx.normalizedName, normalizedBillTo)) {
      score += 45;
      reasons.push('請求先名近似');
    }
  } else if (normalizedBillTo && (bankIsInsurance || bankIsLoan)) {
    if (isStrongNormalizedNameMatch_(bankCtx.normalizedName, normalizedBillTo)) {
      score += 20;
      reasons.push('請求先補助一致');
    } else if (isLooseNormalizedNameMatch_(bankCtx.normalizedName, normalizedBillTo)) {
      score += 10;
      reasons.push('請求先補助近似');
    }
  }

  if (bankCtx.learning && bankCtx.learning.expectedCategory && saleCtx.workType && bankCtx.learning.expectedCategory === saleCtx.workType) {
    score += 20;
    reasons.push('想定作業区分一致');
  }

  if (bankIsInsurance && isInsuranceRelatedSalesCase_(saleCtx)) {
    score += 25;
    reasons.push('保険案件傾向一致');
  }

  if (bankIsLoan && ['車販', '車両販売'].indexOf(String(saleCtx.workType || '').trim()) >= 0) {
    score += 20;
    reasons.push('ローン会社案件傾向一致');
  }

  const diffDays = calcDateDiffDays_(bankCtx.date, saleCtx.date);
  if (diffDays !== null) {
    if (diffDays <= 7) {
      score += 30;
      reasons.push('日付近い');
    } else if (diffDays <= 30) {
      score += 10;
      reasons.push('日付許容範囲');
    } else if (diffDays <= RECONCILE_CFG.DATE_WINDOW_DAYS) {
      score += 3;
    }
  }

  if (isReceivableLikeSubject_(bankCtx.subject)) {
    score += 5;
  }

  const autoAllowed = !bankCtx.learning || bankCtx.learning.autoAllowed !== false;
  const status = (score >= RECONCILE_CFG.AUTO_SCORE && autoAllowed) ? MATCH_STATUS.AUTO : MATCH_STATUS.REVIEW;

  return { score, reasons, status };
}

function findSplitBankMatchesForSale_(saleCtx, bankContexts, matchedBankRows) {
  if (!saleCtx.amount || saleCtx.amount <= 0) return null;
  if (saleCtx.protectedFlag) return null;

  const candidates = bankContexts
    .filter(bankCtx => !matchedBankRows.has(bankCtx.id))
    .filter(bankCtx => !bankCtx.protectedFlag)
    .filter(bankCtx => String(bankCtx.currentStatus || '').trim() !== MATCH_STATUS.AUTO)
    .filter(bankCtx => bankCtx.amount > 0 && bankCtx.amount < saleCtx.amount)
    .map(bankCtx => {
      const evidence = scoreSplitEvidence_(bankCtx, saleCtx);
      return { bank: bankCtx, evidence };
    })
    .filter(item => item.evidence.score >= RECONCILE_CFG.SPLIT_REVIEW_SCORE)
    .sort((a, b) => b.evidence.score - a.evidence.score)
    .slice(0, RECONCILE_CFG.SPLIT_MAX_CANDIDATES);

  if (candidates.length < 2) return null;

  const targetAmount = saleCtx.amount;
  const combos = [];
  const used = [];

  function dfs(startIndex, sum, totalScore, reasons) {
    if (sum === targetAmount && used.length >= 2) {
      combos.push({
        banks: used.slice(),
        score: totalScore,
        reasons: reasons.slice()
      });
      return;
    }
    if (sum >= targetAmount || used.length >= RECONCILE_CFG.SPLIT_MAX_COMBO_SIZE) return;

    for (let i = startIndex; i < candidates.length; i++) {
      const candidate = candidates[i];
      used.push(candidate.bank);
      const nextReasons = reasons.concat(candidate.evidence.reasons);
      dfs(i + 1, sum + candidate.bank.amount, totalScore + candidate.evidence.score, nextReasons);
      used.pop();
    }
  }

  dfs(0, 0, 0, []);

  if (!combos.length) return null;
  combos.sort((a, b) => b.score - a.score);

  if (combos.length > 1 && Math.abs(combos[0].score - combos[1].score) <= 10) {
    return null;
  }

  const best = combos[0];
  const allAutoAllowed = best.banks.every(bankCtx => !bankCtx.learning || bankCtx.learning.autoAllowed !== false);
  const status = (best.score >= RECONCILE_CFG.SPLIT_AUTO_SCORE * best.banks.length && allAutoAllowed)
    ? MATCH_STATUS.AUTO
    : MATCH_STATUS.REVIEW;

  return {
    sale: saleCtx,
    banks: best.banks,
    reasons: [...new Set(best.reasons)].concat(`分割入金 ${best.banks.length}件合算`),
    status
  };
}

function scoreSplitEvidence_(bankCtx, saleCtx) {
  let score = 0;
  const reasons = [];

  if (saleCtx.bizNo && bankCtx.codes.indexOf(saleCtx.bizNo.toUpperCase()) >= 0) {
    score += 120;
    reasons.push('管理番号一致');
  }

  if (bankCtx.learning && bankCtx.learning.code && saleCtx.bizNo && bankCtx.learning.code.toUpperCase() === saleCtx.bizNo.toUpperCase()) {
    score += 120;
    reasons.push('学習管理番号一致');
  }

  const dueDiffDays = calcDateDiffDays_(bankCtx.date, saleCtx.dueDate);
  if (dueDiffDays !== null) {
    if (dueDiffDays === 0) {
      score += 90;
      reasons.push('入金予定日一致');
    } else if (dueDiffDays <= 3) {
      score += 25;
      reasons.push('入金予定日近接');
    }
  }

  if (bankCtx.mappedCustNo && saleCtx.custNo && bankCtx.mappedCustNo === saleCtx.custNo) {
    score += 85;
    reasons.push('顧客No一致');
  }

  if (isStrongNormalizedNameMatch_(bankCtx.normalizedName, saleCtx.normalizedName)) {
    score += 70;
    reasons.push('顧客名一致');
  } else if (isLooseNormalizedNameMatch_(bankCtx.normalizedName, saleCtx.normalizedName)) {
    score += 45;
    reasons.push('顧客名近似');
  }

  const normalizedBillTo = normalizeMatchText_(saleCtx.billTo);
  if (normalizedBillTo) {
    if (isStrongNormalizedNameMatch_(bankCtx.normalizedName, normalizedBillTo)) {
      score += 65;
      reasons.push('請求先名一致');
    } else if (isLooseNormalizedNameMatch_(bankCtx.normalizedName, normalizedBillTo)) {
      score += 40;
      reasons.push('請求先名近似');
    }
  }

  const diffDays = calcDateDiffDays_(bankCtx.date, saleCtx.date);
  if (diffDays !== null && diffDays <= RECONCILE_CFG.DATE_WINDOW_DAYS) {
    score += diffDays <= 30 ? 15 : 5;
    reasons.push('日付許容範囲');
  }

  return { score, reasons };
}

function applyBankSalesMatch_(bankCtx, saleCtx, matchResult, bankValues, salesValues, bankStatusNotes, salesStatusNotes, customerNoIdx, businessNoIdx, statusIdx, salesStatusIdx, salesMethodIdx) {
  const bankRowIndex = bankCtx.id - 1;
  const salesRowIndex = saleCtx.id - 1;
  const note = buildReconcileNote_(matchResult.reasons);

  bankValues[bankRowIndex][customerNoIdx] = saleCtx.custNo;
  bankValues[bankRowIndex][businessNoIdx] = saleCtx.bizNo;
  bankValues[bankRowIndex][statusIdx] = matchResult.status;
  salesValues[salesRowIndex][salesStatusIdx] = matchResult.status;
  salesValues[salesRowIndex][salesMethodIdx] = '振り込み';

  bankStatusNotes[bankRowIndex][0] = note;
  salesStatusNotes[salesRowIndex][0] = note;
}

function applySplitBankSalesMatch_(saleCtx, splitResult, bankValues, salesValues, bankStatusNotes, salesStatusNotes, customerNoIdx, businessNoIdx, statusIdx, salesStatusIdx, salesMethodIdx) {
  const note = buildReconcileNote_(splitResult.reasons);

  splitResult.banks.forEach(bankCtx => {
    const bankRowIndex = bankCtx.id - 1;
    bankValues[bankRowIndex][customerNoIdx] = saleCtx.custNo;
    bankValues[bankRowIndex][businessNoIdx] = saleCtx.bizNo;
    bankValues[bankRowIndex][statusIdx] = splitResult.status;
    bankStatusNotes[bankRowIndex][0] = note;
  });

  const salesRowIndex = saleCtx.id - 1;
  salesValues[salesRowIndex][salesStatusIdx] = splitResult.status;
  salesValues[salesRowIndex][salesMethodIdx] = '振り込み';
  salesStatusNotes[salesRowIndex][0] = note;
}

function buildReconcileNote_(reasons) {
  const uniqueReasons = [...new Set((reasons || []).filter(Boolean))];
  return uniqueReasons.join('\n');
}

function normalizeMatchText_(value) {
  let text = String(value || '');
  if (!text) return '';
  if (text.normalize) {
    text = text.normalize('NFKC');
  }

  const kanjiNumMap = { '〇': '0', '零': '0', '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9', '十': '0' };
  text = text.replace(/[〇零一二三四五六七八九十]/g, function(ch) { return kanjiNumMap[ch] || ch; });

  text = text.replace(/[ｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾊﾋﾌﾍﾎ]ﾞ/g, function(s) {
    return String.fromCharCode(s.charCodeAt(0) + 1);
  }).replace(/[ﾊﾋﾌﾍﾎ]ﾟ/g, function(s) {
    return String.fromCharCode(s.charCodeAt(0) + 2);
  });

  text = text
    .toUpperCase()
    .replace(/該当なし/g, '')
    .replace(/HB|EBフリコミ|EBﾌﾘｺﾐ|振込\d+|フリコミ|ﾌﾘｺﾐ/g, '')
    .replace(/株式会社|有限会社|合同会社|医療法人|社会福祉法人|一般社団法人|公益社団法人|\(株\)|㈱|\(有\)|（株）|（有）|\(医\)|（医）/g, '')
    .replace(/代表取締役社長|代表取締役|理事長|院長|社長|様|御中|殿/g, '')
    .replace(/[ｶﾞｷﾞｸﾞｹﾞｺﾞ]/g, function(s) { return { 'ｶﾞ':'ガ','ｷﾞ':'ギ','ｸﾞ':'グ','ｹﾞ':'ゲ','ｺﾞ':'ゴ' }[s] || s; })
    .replace(/ヶ/g, 'ケ').replace(/ヵ/g, 'カ')
    .replace(/[ 　\t\r\n\-‐‑‒–—―ーｰ・･,，、.．'`"\/\\()（）[\]【】]/g, '');

  return text;
}

function extractNumericFallbackCodes_(text) {
  const src = String(text || '');
  if (!src) return [];
  const normalized = src.normalize ? src.normalize('NFKC') : src;
  const matches = normalized.match(/(?<![A-Za-z0-9])\d{4,10}(?![A-Za-z0-9])/g) || [];
  return [...new Set(matches)];
}

function isTruthyFlag_(value) {
  const text = String(value === true ? 'TRUE' : value || '').trim().toUpperCase();
  return text === 'TRUE' || text === '1' || text === 'YES' || text === 'Y';
}

function extractMatchCodes_(text) {
  const normalized = String(text || '').toUpperCase();
  const matches = normalized.match(/(?:SB|CH|RA|PC)\s*0*\d{3,8}/g) || [];
  return [...new Set(matches.map(function(code) {
    const prefix = code.slice(0, 2);
    const digits = code.replace(/[^0-9]/g, '');
    return prefix + digits.padStart(8, '0');
  }))];
}

function isStrongNormalizedNameMatch_(left, right) {
  if (!left || !right) return false;
  return left === right || (left.length >= 5 && right.length >= 5 && (left.indexOf(right) >= 0 || right.indexOf(left) >= 0));
}

function isLooseNormalizedNameMatch_(left, right) {
  if (!left || !right) return false;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  if (shorter.length < 4) return false;
  return longer.indexOf(shorter) >= 0;
}

function isReceivableLikeSubject_(subject) {
  const text = String(subject || '').trim();
  if (!text) return true;
  return ['売掛金', '諸口', '仮受金', '保険手数料'].indexOf(text) >= 0;
}

function crossCheckSalesTotalsWithSourceSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const targetSheet = ss.getSheetByName(SHEET.SALES.NAME);
  if (!targetSheet) return;

  const sourceSs = SpreadsheetApp.openById(
    typeof getNyukinSourceSpreadsheetId_ === 'function'
      ? getNyukinSourceSpreadsheetId_()
      : RECONCILE_CFG.CROSS_CHECK_SPREADSHEET_ID
  );
  const auditSheet = ensureCrossCheckSheet_(ss, RECONCILE_CFG.CROSS_CHECK_AUDIT_SHEET);
  auditSheet.clearContents();

  const auditHeaders = [
    '種別',
    'キー',
    '顧客名',
    '現行売上',
    '参照元売上',
    '差額',
    '現行ステータス',
    '参照元ステータス',
    '参照元シート',
    '備考'
  ];
  auditSheet.getRange(1, 1, 1, auditHeaders.length).setValues([auditHeaders]).setFontWeight('bold').setBackground('#efefef');

  const targetValues = targetSheet.getDataRange().getValues();
  if (targetValues.length < 2) return;
  const targetHeaders = targetValues[0].map(h => String(h || '').trim());
  const idxBiz = targetHeaders.indexOf(SHEET.SALES.HEADER.BIZ_NO);
  const idxType = targetHeaders.indexOf(SHEET.SALES.HEADER.WORK_TYPE);
  const idxDate = targetHeaders.indexOf(SHEET.SALES.HEADER.DATE);
  const idxName = targetHeaders.indexOf(SHEET.SALES.HEADER.CUST_NAME);
  const idxAmount = targetHeaders.indexOf(SHEET.SALES.HEADER.TOTAL);
  const idxStatus = targetHeaders.indexOf(SHEET.SALES.HEADER.STATUS);

  const serviceSourceMap = loadSourceServiceSalesMap_(sourceSs);
  const vehicleSourceData = loadSourceVehicleSalesMap_(sourceSs);
  const vehicleSourceMap = vehicleSourceData.map;
  const vehicleSourceList = vehicleSourceData.list;
  const auditRows = [];
  const seenBizNos = {};
  const seenVehicleIds = {};

  targetValues.slice(1).forEach(row => {
    const bizNo = idxBiz >= 0 ? String(row[idxBiz] || '').trim() : '';
    const workType = idxType >= 0 ? String(row[idxType] || '').trim() : '';
    const custName = idxName >= 0 ? String(row[idxName] || '').trim() : '';
    const amount = idxAmount >= 0 ? toNumber_(row[idxAmount]) : 0;
    const status = idxStatus >= 0 ? String(row[idxStatus] || '').trim() : '';

    if (bizNo) {
      seenBizNos[bizNo] = true;
      const source = serviceSourceMap[bizNo];
      if (!source) {
        auditRows.push(['現行のみ', bizNo, custName, amount, '', '', status, '', '', '参照元シートに業務Noがありません']);
        return;
      }

      if (amount !== source.amount) {
        auditRows.push(['金額差異', bizNo, custName, amount, source.amount, amount - source.amount, status, source.status, source.sheetName, '業務No一致だが売上が不一致']);
      }
      return;
    }

    if (workType !== '車販') return;
    const vehicleKey = normalizeMatchText_(custName);
    if (!vehicleKey) return;

    let source = vehicleSourceMap[vehicleKey] || null;
    if (!source) {
      source = findVehicleSourceByAmountAndDate_(amount, parseJsonLikeDate_(row[idxDate]), vehicleSourceList, seenVehicleIds);
    }
    if (!source) {
      auditRows.push(['現行のみ', vehicleKey, custName, amount, '', '', status, '', RECONCILE_CFG.SOURCE_VEHICLE_SHEET, '車販参照元に顧客名がありません']);
      return;
    }

    seenVehicleIds[source.id] = true;

    if (amount !== source.amount) {
      auditRows.push(['金額差異', vehicleKey, custName, amount, source.amount, amount - source.amount, status, source.status, source.sheetName, '車販の売上が不一致']);
    }
  });

  Object.keys(serviceSourceMap).forEach(bizNo => {
    if (seenBizNos[bizNo]) return;
    const source = serviceSourceMap[bizNo];
    auditRows.push(['参照元のみ', bizNo, source.customerName, '', source.amount, '', '', source.status, source.sheetName, '現行シートに業務Noがありません']);
  });

  vehicleSourceList.forEach(source => {
    if (seenVehicleIds[source.id]) return;
    auditRows.push(['参照元のみ', normalizeMatchText_(source.customerName), source.customerName, '', source.amount, '', '', source.status, source.sheetName, '現行シートに車販顧客がありません']);
  });

  if (auditRows.length) {
    auditSheet.getRange(2, 1, auditRows.length, auditHeaders.length).setValues(auditRows);
  }
}

function loadSourceServiceSalesMap_(sourceSs) {
  const result = {};

  RECONCILE_CFG.SOURCE_SERVICE_SHEETS.forEach(sheetName => {
    const sheet = sourceSs.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return;

    const values = sheet.getDataRange().getValues();
    const headers = values[0].map(h => String(h || '').trim());
    const bizIdx = headers.indexOf('整備ナンバー');
    const nameIdx = headers.indexOf('顧客名');
    const amountIdx = headers.indexOf('売上総計');
    const statusIdx = headers.indexOf('状況');
    if ([bizIdx, nameIdx, amountIdx, statusIdx].includes(-1)) return;

    values.slice(1).forEach(row => {
      const bizNo = String(row[bizIdx] || '').trim();
      if (!bizNo) return;
      result[bizNo] = {
        amount: toNumber_(row[amountIdx]),
        customerName: String(row[nameIdx] || '').trim(),
        status: String(row[statusIdx] || '').trim(),
        sheetName
      };
    });
  });

  return result;
}

function loadSourceVehicleSalesMap_(sourceSs) {
  const sheet = sourceSs.getSheetByName(RECONCILE_CFG.SOURCE_VEHICLE_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return { map: {}, list: [] };

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h || '').trim());
  const statusIdx = headers.indexOf('進捗');
  const nameIdx = headers.indexOf('顧客名');
  const listAmountIdx = headers.indexOf('販売金額（税込）');
  const fixedAmountIdx = headers.indexOf('確定売上');
  const paymentDateIdx = headers.indexOf('入金予定日');
  const confirmedDateIdx = headers.indexOf('登録決定日');
  const plannedDateIdx = headers.indexOf('登録予定日');
  const orderDateIdx = headers.indexOf('受注日');
  if ([statusIdx, nameIdx, listAmountIdx, fixedAmountIdx].includes(-1)) return { map: {}, list: [] };

  const result = {};
  const list = [];
  values.slice(1).forEach((row, index) => {
    const customerName = String(row[nameIdx] || '').trim();
    if (!customerName) return;

    const normalizedKey = normalizeMatchText_(customerName);
    const fixedAmount = toNumber_(row[fixedAmountIdx]);
    const listedAmount = toNumber_(row[listAmountIdx]);
    const source = {
      id: `vehicle_${index + 2}`,
      amount: fixedAmount || listedAmount,
      customerName,
      status: String(row[statusIdx] || '').trim(),
      date: parseJsonLikeDate_(
        row[paymentDateIdx] ||
        row[confirmedDateIdx] ||
        row[plannedDateIdx] ||
        row[orderDateIdx]
      ),
      sheetName: RECONCILE_CFG.SOURCE_VEHICLE_SHEET
    };
    result[normalizedKey] = source;
    list.push(source);
  });

  return { map: result, list };
}

function findVehicleSourceByAmountAndDate_(amount, targetDate, vehicleSourceList, seenVehicleIds) {
  if (!amount || !vehicleSourceList || !vehicleSourceList.length) return null;

  const candidates = vehicleSourceList
    .filter(source => !seenVehicleIds[source.id])
    .filter(source => source.amount === amount)
    .sort((a, b) => calcDateDiffDays_(targetDate, a.date) - calcDateDiffDays_(targetDate, b.date));

  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];

  const firstDiff = calcDateDiffDays_(targetDate, candidates[0].date);
  const secondDiff = calcDateDiffDays_(targetDate, candidates[1].date);
  if (firstDiff <= 7 && secondDiff > firstDiff) {
    return candidates[0];
  }

  return null;
}

function ensureCrossCheckSheet_(ss, sheetName) {
  return ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
}

/**
 * クレカ・現金シートと売上リストを照合し、ステータスを更新する
 */
function updateCashSheetWithMatchedSalesData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const timezone = Session.getScriptTimeZone();

  const cashSheet = ss.getSheetByName(SHEET.CASH.NAME);
  const salesSheet = ss.getSheetByName(SHEET.SALES.NAME);

  if (!cashSheet || !salesSheet) {
    console.error('必要なシートが見つかりません。');
    return;
  }

  const cashTargetHeaders = [
    SHEET.CASH.HEADER.DATE,
    SHEET.CASH.HEADER.VENDOR,
    SHEET.CASH.HEADER.TOTAL,
    SHEET.CASH.HEADER.STATUS,
    SHEET.CASH.HEADER.CREDIT_TYPE,
    SHEET.CASH.HEADER.METHOD
  ];

  const salesTargetHeaders = [
    SHEET.SALES.HEADER.BIZ_NO,
    SHEET.SALES.HEADER.DATE,
    SHEET.SALES.HEADER.CUST_NAME,
    SHEET.SALES.HEADER.TOTAL,
    SHEET.SALES.HEADER.CUST_NO,
    SHEET.SALES.HEADER.STATUS,
    SHEET.SALES.HEADER.METHOD
  ];

  const cashData = getSheetDataWithRowIdAndFormatDate_(cashSheet, cashTargetHeaders, timezone);
  let salesData = getSheetDataWithRowIdAndFormatDate_(salesSheet, salesTargetHeaders, timezone);

  salesData = salesData.filter(salesRow => {
    return String(salesRow[SHEET.SALES.HEADER.STATUS] || '').trim() !== MATCH_STATUS.AUTO;
  });

  const cashHeaders = cashSheet.getRange(1, 1, 1, cashSheet.getLastColumn()).getValues()[0]
    .map(h => h ? String(h).trim() : "");

  const salesHeaders = salesSheet.getRange(1, 1, 1, salesSheet.getLastColumn()).getValues()[0]
    .map(h => h ? String(h).trim() : "");

  const bizNoIdx = cashHeaders.indexOf(SHEET.CASH.HEADER.BIZ_NO);
  const custNoIdx = cashHeaders.indexOf(SHEET.CASH.HEADER.CUST_NO);
  const statusIdx = cashHeaders.indexOf(SHEET.CASH.HEADER.STATUS);

  const salesStatusIdx = salesHeaders.indexOf(SHEET.SALES.HEADER.STATUS);
  const salesMethodIdx = salesHeaders.indexOf(SHEET.SALES.HEADER.METHOD);

  if (bizNoIdx === -1 || custNoIdx === -1 || statusIdx === -1) {
    console.error('クレカ・現金シートに転記先の列が見つかりません。');
    return;
  }

  if (salesStatusIdx === -1 || salesMethodIdx === -1) {
    console.error('振込入金リスト一覧シートの必要列が見つかりません。');
    return;
  }

  const cashRange = cashSheet.getRange(1, 1, cashSheet.getLastRow(), cashSheet.getLastColumn());
  const cashValues = cashRange.getValues();

  const salesRange = salesSheet.getRange(1, 1, salesSheet.getLastRow(), salesSheet.getLastColumn());
  const salesValues = salesRange.getValues();

  const cashStatusNotes = cashSheet.getRange(1, statusIdx + 1, cashSheet.getLastRow(), 1).getNotes();
  const salesStatusNotes = salesSheet.getRange(1, salesStatusIdx + 1, salesSheet.getLastRow(), 1).getNotes();

  let autoMatchCount = 0;
  let reviewCount = 0;

  cashData.forEach(cashRow => {
    const rowIndex = cashRow.id - 1;

    if (String(cashValues[rowIndex][statusIdx]).trim() === MATCH_STATUS.AUTO) return;

    const cashAmount = Number(cashRow[SHEET.CASH.HEADER.TOTAL]);
    const cashDate = new Date(cashRow[SHEET.CASH.HEADER.DATE]);
    const creditType = String(cashRow[SHEET.CASH.HEADER.CREDIT_TYPE] || '').trim();
    const paymentMethod = String(cashRow[SHEET.CASH.HEADER.METHOD] || '').trim();
    const outputMethod = creditType || paymentMethod;

    const amountMatches = salesData.filter(s => {
      return Number(s[SHEET.SALES.HEADER.TOTAL]) === cashAmount;
    });

    if (amountMatches.length > 0) {
      amountMatches.sort((a, b) => {
        const diffA = Math.abs(cashDate - new Date(a[SHEET.SALES.HEADER.DATE]));
        const diffB = Math.abs(cashDate - new Date(b[SHEET.SALES.HEADER.DATE]));
        return diffA - diffB;
      });

      const target = amountMatches[0];
      const salesRowIndex = target.id - 1;

      cashValues[rowIndex][bizNoIdx] = target[SHEET.SALES.HEADER.BIZ_NO];
      cashValues[rowIndex][custNoIdx] = target[SHEET.SALES.HEADER.CUST_NO];

      // ステータス更新時は既存メモを削除
      cashStatusNotes[rowIndex][0] = '';
      salesStatusNotes[salesRowIndex][0] = '';

      if (amountMatches.length === 1) {
        cashValues[rowIndex][statusIdx] = MATCH_STATUS.AUTO;
        salesValues[salesRowIndex][salesStatusIdx] = MATCH_STATUS.AUTO;
        salesValues[salesRowIndex][salesMethodIdx] = outputMethod;
        autoMatchCount++;
      } else {
        cashValues[rowIndex][statusIdx] = MATCH_STATUS.REVIEW;
        salesValues[salesRowIndex][salesStatusIdx] = MATCH_STATUS.REVIEW;
        salesValues[salesRowIndex][salesMethodIdx] = outputMethod;
        reviewCount++;
      }
    }
  });

  if (cashData.length > 0) {
    cashRange.setValues(cashValues);
    salesRange.setValues(salesValues);
    cashSheet.getRange(1, statusIdx + 1, cashSheet.getLastRow(), 1).setNotes(cashStatusNotes);
    salesSheet.getRange(1, salesStatusIdx + 1, salesSheet.getLastRow(), 1).setNotes(salesStatusNotes);

    console.log(`【クレカ・現金照合完了】 自動消込: ${autoMatchCount}件 / 要確認: ${reviewCount}件`);
  }
}
/**
 * シートからデータを抽出し、行番号ID、日付フォーマット、および銀行シート用の名義照合を適用して返す
 */
function getSheetDataWithRowIdAndFormatDate_(sheet, targetHeaders, timezone) {
  const sheetName = sheet.getName();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  const allValues = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = allValues[0].map(h => (h === null || h === undefined) ? "" : String(h).trim());
  const rows = allValues.slice(1);

  // --- 銀行シートの場合のみ：名義対応表をメモリにロード ---
  let aliasMap = {};
  if (sheetName === SHEET.BANK.NAME || sheetName === SHEET.CASH.NAME) {
    aliasMap = getAliasMap_(); // 下記のサブ関数を呼び出し
  }

  const colMap = {};
  targetHeaders.forEach(target => {
    const index = headers.findIndex(h => {
      if (!h) return false;
      const targetStr = String(target);
      if (h === targetStr) return true;
      const normalize = (s) => s.replace(/No\.|№|NO/i, '番号');
      return normalize(h) === normalize(targetStr);
    });
    if (index !== -1) colMap[target] = index;
  });

  return rows.map((row, index) => {
    const obj = { id: index + 2 };

    targetHeaders.forEach(header => {
      const colIdx = colMap[header];
      let value = colIdx !== undefined ? row[colIdx] : null;

      // 日付変換
      const isDateCol = (header === SHEET.BANK.HEADER.DATE || header === SHEET.SALES.HEADER.DATE);
      if (isDateCol || value instanceof Date) {
        value = convertAnyDateToFormat_(value, timezone);
      }
      obj[header] = value;
    });

    // --- 銀行シートの場合のみ：「該当顧客No」項目を追加 ---
    if (sheetName === SHEET.BANK.NAME) {
      const otherSummary = String(obj[SHEET.BANK.HEADER.OTHER_PARTY] || "").trim();
      // 一致するものがあればその顧客No、なければ空文字
      obj["該当顧客No"] = aliasMap[otherSummary] || "";
    } else if (sheetName === SHEET.CASH.NAME) {
      const vendor = String(obj[SHEET.CASH.HEADER.VENDOR] || "").trim();
      obj["該当顧客No"] = aliasMap[vendor] || "";
    }

    return obj;
  }).filter(item => Object.keys(item).some(key => key !== 'id' && item[key] !== null && item[key] !== ""));
}

/**
 * サブ関数：※名義対応表を読み込んでMap(連想配列)を作成する
 */
function getAliasMap_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aliasSheet = ss.getSheetByName(SHEET.ALIAS.NAME);
  if (!aliasSheet) return {};

  const values = aliasSheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const rows = values.slice(1);

  const nameIdx = headers.indexOf(SHEET.ALIAS.HEADER.DISPLAY_NAME);
  const custNoIdx = headers.indexOf(SHEET.ALIAS.HEADER.CUST_NO);

  if (nameIdx === -1 || custNoIdx === -1) return {};

  const map = {};
  rows.forEach(row => {
    const name = String(row[nameIdx]).trim();
    const custNo = String(row[custNoIdx]).trim();
    if (name) map[name] = custNo;
  });
  return map;
}


/** ================================ ユーティリティ ================================ */

/**
 * 日付変換ロジック
 */
function convertAnyDateToFormat_(value, timezone) {
  if (!value) return null;
  if (value instanceof Date) {
    return Utilities.formatDate(value, timezone, "yyyy/MM/dd");
  }

  const strValue = String(value).trim();

  // 和暦 Rxx/xx/xx
  const rewaMatch = strValue.match(/^R\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/i);
  if (rewaMatch) {
    const year = 2018 + parseInt(rewaMatch[1], 10);
    const date = new Date(year, parseInt(rewaMatch[2], 10) - 1, parseInt(rewaMatch[3], 10));
    return Utilities.formatDate(date, timezone, "yyyy/MM/dd");
  }

  // 西暦 yyyy/mm/dd
  const seirekiMatch = strValue.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (seirekiMatch) {
    const date = new Date(parseInt(seirekiMatch[1], 10), parseInt(seirekiMatch[2], 10) - 1, parseInt(seirekiMatch[3], 10));
    return Utilities.formatDate(date, timezone, "yyyy/MM/dd");
  }

  // シリアル値
  if (typeof value === 'number' && value > 30000) {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return Utilities.formatDate(date, timezone, "yyyy/MM/dd");
  }

  return strValue;
}


/**
 * ※名義対応表シートに、売上リストの新規顧客を追記する
 */
function appendNewCustomersToAliasSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const salesSheet = ss.getSheetByName(SHEET.SALES.NAME);
  const aliasSheet = ss.getSheetByName(SHEET.ALIAS.NAME);

  if (!salesSheet || !aliasSheet) {
    console.error('必要なシートが見つかりません。');
    return;
  }

  // 1. 売上リストからデータを取得（顧客№, 顧客名）
  const salesData = getSheetDataWithRowIdAndFormatDate_(
    salesSheet,
    [SHEET.SALES.HEADER.CUST_NO, SHEET.SALES.HEADER.CUST_NAME],
    Session.getScriptTimeZone()
  );

  // 2. 名義対応表の既存「顧客No.」を収集（重複チェック用）
  const aliasValues = aliasSheet.getDataRange().getValues();
  const aliasHeaders = aliasValues[0].map(h => String(h).trim());
  const aliasCustNoIdx = aliasHeaders.indexOf(SHEET.ALIAS.HEADER.CUST_NO);
  const aliasJocarNameIdx = aliasHeaders.indexOf(SHEET.ALIAS.HEADER.JOCAR_NAME);

  if (aliasCustNoIdx === -1 || aliasJocarNameIdx === -1) {
    console.error('名義対応表のヘッダー（顧客No. / Jocar登録名）が見つかりません。');
    return;
  }

  // 既存の顧客No.をSetに格納（検索を高速化）
  const existingCustNos = new Set(
    aliasValues.slice(1).map(row => String(row[aliasCustNoIdx]).trim())
  );

  // 3. 追記するデータのリストを作成
  const newRows = [];
  const processedInThisRun = new Set(); // 今回の実行内での重複も防ぐ

  salesData.forEach(salesRow => {
    const custNo = String(salesRow[SHEET.SALES.HEADER.CUST_NO] || "").trim();
    const custName = String(salesRow[SHEET.SALES.HEADER.CUST_NAME] || "").trim();

    if (custNo === "") return; // 顧客Noが空ならスキップ

    // 既存にない ＆ 今回のリストにもまだ入っていない場合のみ追加
    if (!existingCustNos.has(custNo) && !processedInThisRun.has(custNo)) {
      // 名義対応表の列構成に合わせて配列を作成
      // [顧客No., 入金データ表示名(空), Jocar登録名]
      const rowToAdd = new Array(aliasHeaders.length).fill("");
      rowToAdd[aliasCustNoIdx] = custNo;
      rowToAdd[aliasJocarNameIdx] = custName;

      newRows.push(rowToAdd);
      processedInThisRun.add(custNo);
    }
  });

  // 4. シートの末尾に一括追記
  if (newRows.length > 0) {
    aliasSheet.getRange(
      aliasSheet.getLastRow() + 1,
      1,
      newRows.length,
      aliasHeaders.length
    ).setValues(newRows);

    console.log(`${newRows.length} 件の新規顧客を名義対応表に追加しました。`);
  } else {
    console.log('新しく追加する顧客データはありませんでした。');
  }
}

/** ================================ デバッグ用 ================================ */

/**
 * デバッグ用：シートデータを表示
 */
function debugSheetData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET.CASH.NAME);
  const targetHeaders = [
    SHEET.CASH.HEADER.DATE,
    SHEET.CASH.HEADER.VENDOR,
    SHEET.CASH.HEADER.TOTAL,
    SHEET.CASH.HEADER.STATUS
  ];

  const sheetData = getSheetDataWithRowIdAndFormatDate_(sheet, targetHeaders, Session.getScriptTimeZone());
  console.log(sheetData);
}

function refreshOperationalPaymentViews_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  updateSalesPaymentProgress_(ss);
  updateInvoicePaymentProgress_(ss);

  try {
    updateAllSummaryFormulas();
  } catch (error) {
    console.error('月次集計更新失敗: ' + error.message);
  }

  try {
    if (typeof refreshOperationalViewSheets_ === 'function') {
      refreshOperationalViewSheets_();
    }
  } catch (error) {
    console.error('運用ビュー更新失敗: ' + error.message);
  }
}

function applySpecialSalesCaseRules_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const salesSheet = ss.getSheetByName(SHEET.SALES.NAME);
  if (!salesSheet || salesSheet.getLastRow() < 2) return;

  ensureSpecialSalesHeaders_(salesSheet);
  const headerMap = getHeaderMap_(salesSheet);
  const values = salesSheet.getRange(2, 1, salesSheet.getLastRow() - 1, salesSheet.getLastColumn()).getValues();

  const typeValues = [];
  const reconcileValues = [];
  const memoValues = [];

  values.forEach(function(row) {
    const billTo = safeString_(getValueByHeaderMap_(row, headerMap, SHEET.SALES.HEADER.BILL_TO));
    const workType = safeString_(getValueByHeaderMap_(row, headerMap, SHEET.SALES.HEADER.WORK_TYPE));
    const customerName = safeString_(getValueByHeaderMap_(row, headerMap, SHEET.SALES.HEADER.CUST_NAME));
    const totalAmount = toNumber_(getValueByHeaderMap_(row, headerMap, SHEET.SALES.HEADER.TOTAL));
    const grossProfit = toNumber_(getValueByHeaderMap_(row, headerMap, SHEET.SALES.HEADER.GROSS_PROFIT));

    const special = resolveSpecialSalesCase_(billTo, totalAmount, grossProfit);
    typeValues.push([special.type]);
    reconcileValues.push([special.reconcileAmount || '']);
    memoValues.push([special.memo]);
  });

  writeColumnValuesByHeader_(salesSheet, headerMap, SHEET.SALES.HEADER.SPECIAL_TYPE, typeValues);
  writeColumnValuesByHeader_(salesSheet, headerMap, SHEET.SALES.HEADER.RECONCILE_AMOUNT, reconcileValues);
  writeColumnValuesByHeader_(salesSheet, headerMap, SHEET.SALES.HEADER.SPECIAL_MEMO, memoValues);
}

function ensureSpecialSalesHeaders_(sheet) {
  const required = [
    SHEET.SALES.HEADER.SPECIAL_TYPE,
    SHEET.SALES.HEADER.RECONCILE_AMOUNT,
    SHEET.SALES.HEADER.SPECIAL_MEMO
  ];
  const existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(value) {
    return String(value || '').trim();
  });
  const missing = required.filter(function(name) {
    return existing.indexOf(name) === -1;
  });
  if (!missing.length) return;
  sheet.getRange(1, sheet.getLastColumn() + 1, 1, missing.length).setValues([missing]);
}

function resolveSpecialSalesCase_(billTo, totalAmount, grossProfit) {
  const normalizedBillTo = normalizeMatchText_(billTo);
  const conquestGrossVendor = normalizeMatchText_(SPECIAL_CASE_CFG.CONQUEST_GROSS_VENDOR);
  const conquestSumVendor = normalizeMatchText_(SPECIAL_CASE_CFG.CONQUEST_SUM_VENDOR);
  const conquestJlrVendor = normalizeMatchText_(SPECIAL_CASE_CFG.CONQUEST_JLR_VENDOR);

  if (normalizedBillTo && normalizedBillTo === conquestGrossVendor) {
    const reconcileAmount = grossProfit > 0 ? Math.round(grossProfit * 1.1) : totalAmount;
    return {
      type: 'コンクエスト粗利税込請求',
      reconcileAmount: reconcileAmount,
      memo: '粗利益 × 1.1 を照合基準額に使用'
    };
  }

  if (normalizedBillTo && normalizedBillTo === conquestSumVendor) {
    return {
      type: 'コンクエスト営業部門集計',
      reconcileAmount: totalAmount,
      memo: '計算は行わず、金額を集計のみ'
    };
  }

  if (normalizedBillTo && normalizedBillTo === conquestJlrVendor) {
    return {
      type: 'コンクエストJ&LR整備',
      reconcileAmount: totalAmount,
      memo: '株式会社コンクエスト向け整備案件として集計'
    };
  }

  if (isMaseratiLikeSalesCase_(billTo)) {
    return {
      type: 'マセラティ系',
      reconcileAmount: totalAmount,
      memo: 'マセラティ系案件として特殊管理'
    };
  }

  return {
    type: '',
    reconcileAmount: totalAmount,
    memo: ''
  };
}

function isMaseratiLikeSalesCase_(billTo) {
  const normalizedBillTo = normalizeMatchText_(billTo);
  return normalizedBillTo.indexOf(normalizeMatchText_('マセラティ')) >= 0 ||
    normalizedBillTo.indexOf(normalizeMatchText_('MASERATI')) >= 0;
}

function buildSalesRowsFromServiceSourceSheet_(sourceSs, sheetName, targetHeaders, targetHeaderMap) {
  const sheet = sourceSs.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function(value) { return String(value || '').trim(); });
  const idxMap = {};
  headers.forEach(function(header, index) {
    idxMap[header] = index;
  });

  return values.slice(1).reduce(function(result, row) {
    const bizNo = safeString_(row[idxMap['整備ナンバー']]);
    const customerName = safeString_(row[idxMap['顧客名']]);
    const amount = toNumber_(row[idxMap['売上総計']]);
    const sourceStatus = safeString_(row[idxMap['状況']]);
    if (!isServiceSalesSourceStatus_(sourceStatus)) {
      return result;
    }
    if (!bizNo && !customerName && !amount) {
      return result;
    }

    result.push(buildSalesTargetRow_(targetHeaders, targetHeaderMap, {
      bizNo: bizNo,
      date: row[idxMap['日付']],
      customerName: customerName,
      total: amount,
      grossProfit: toNumber_(row[idxMap['粗利益']]),
      workType: safeString_(row[idxMap['作業大区分']]),
      serviceShop: safeString_(row[idxMap['整備店舗']]),
      billTo: safeString_(row[idxMap['請求先名']]),
      dueDate: resolveSalesDueDateCandidate_(
        row[idxMap['入金予定日']],
        row[idxMap['納車予定日']],
        row[idxMap['納車日']],
        row[idxMap['日付']]
      ),
      sourceStatus: sourceStatus,
      method: '',
      customerNo: '',
      salesMemo: '',
      sourceSheet: sheetName
    }));
    return result;
  }, []);
}

function buildSalesRowsFromVehicleSourceSheet_(sourceSs, sheetName, targetHeaders, targetHeaderMap) {
  const sheet = sourceSs.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function(value) { return String(value || '').trim(); });
  const idxMap = {};
  headers.forEach(function(header, index) {
    idxMap[header] = index;
  });
  const statusIdx = idxMap['進捗'] !== undefined ? idxMap['進捗'] : 0;

  return values.slice(1).reduce(function(result, row) {
    const customerName = safeString_(getSourceValueByAliases_(row, idxMap, ['顧客名']));
    const listedAmount = toNumber_(getSourceValueByAliases_(row, idxMap, ['販売金額（税込）', '販売金額']));
    const fixedAmount = toNumber_(getSourceValueByAliases_(row, idxMap, ['確定売上（税込）', '確定売上']));
    const amount = fixedAmount || listedAmount;
    const sourceStatus = safeString_(row[statusIdx]);
    if (!isVehicleSalesSourceStatus_(sourceStatus)) {
      return result;
    }
    if (!customerName && !amount) {
      return result;
    }

    const grossProfit = toNumber_(getSourceValueByAliases_(row, idxMap, ['確定利益（税抜）', '想定粗利', '粗利益']));
    const bizNo = safeString_(getSourceValueByAliases_(row, idxMap, ['商談No', '案件No', '業務№', '業務No']));
    const billTo = safeString_(getSourceValueByAliases_(row, idxMap, ['請求先名'])) || customerName;
    const brand = safeString_(getSourceValueByAliases_(row, idxMap, ['ブランド']));
    const baseDate = getSourceValueByAliases_(row, idxMap, ['登録決定日', '受注日', '案件発生日']);

    result.push(buildSalesTargetRow_(targetHeaders, targetHeaderMap, {
      bizNo: bizNo,
      date: baseDate || getSourceValueByAliases_(row, idxMap, ['商談日']),
      customerName: customerName,
      total: amount,
      grossProfit: grossProfit,
      workType: '車販',
      serviceShop: brand || '車販',
      billTo: billTo,
      dueDate: resolveSalesDueDateCandidate_(
        getSourceValueByAliases_(row, idxMap, ['入金予定日']),
        getSourceValueByAliases_(row, idxMap, ['登録予定日']),
        getSourceValueByAliases_(row, idxMap, ['登録決定日']),
        getSourceValueByAliases_(row, idxMap, ['受注日'])
      ),
      sourceStatus: sourceStatus,
      method: '',
      customerNo: '',
      salesMemo: '',
      sourceSheet: sheetName
    }));
    return result;
  }, []);
}

function getSourceValueByAliases_(row, idxMap, aliases) {
  for (let i = 0; i < aliases.length; i++) {
    const index = idxMap[aliases[i]];
    if (index !== undefined) {
      return row[index];
    }
  }
  return '';
}

function buildSalesTargetRow_(targetHeaders, targetHeaderMap, payload) {
  const row = new Array(targetHeaders.length).fill('');
  setIfHeaderExists_(row, targetHeaderMap, SHEET.SALES.HEADER.BIZ_NO, payload.bizNo);
  setIfHeaderExists_(row, targetHeaderMap, SHEET.SALES.HEADER.DATE, payload.date);
  setIfHeaderExists_(row, targetHeaderMap, SHEET.SALES.HEADER.CUST_NAME, payload.customerName);
  setIfHeaderExists_(row, targetHeaderMap, SHEET.SALES.HEADER.TOTAL, payload.total);
  setIfHeaderExists_(row, targetHeaderMap, SHEET.SALES.HEADER.CUST_NO, payload.customerNo || '');
  setIfHeaderExists_(row, targetHeaderMap, SHEET.SALES.HEADER.STATUS, '');
  setIfHeaderExists_(row, targetHeaderMap, SHEET.SALES.HEADER.METHOD, payload.method || '');
  setIfHeaderExists_(row, targetHeaderMap, SHEET.SALES.HEADER.WORK_TYPE, payload.workType || '');
  setIfHeaderExists_(row, targetHeaderMap, '整備店舗', payload.serviceShop || '');
  setIfHeaderExists_(row, targetHeaderMap, SHEET.SALES.HEADER.DUE_DATE, payload.dueDate || '');
  setIfHeaderExists_(row, targetHeaderMap, SHEET.SALES.HEADER.BILL_TO, payload.billTo || '');
  setIfHeaderExists_(row, targetHeaderMap, SHEET.SALES.HEADER.GROSS_PROFIT, payload.grossProfit || '');
  setIfHeaderExists_(row, targetHeaderMap, SHEET.SALES.HEADER.PROTECTED, '');
  setIfHeaderExists_(row, targetHeaderMap, PAYMENT_PROGRESS_HEADERS.SALES_PROGRESS_STATUS, '');
  setIfHeaderExists_(row, targetHeaderMap, PAYMENT_PROGRESS_HEADERS.SALES_PAID_TOTAL, '');
  setIfHeaderExists_(row, targetHeaderMap, PAYMENT_PROGRESS_HEADERS.SALES_MEMO, payload.salesMemo || '');
  if (targetHeaderMap['元シート'] !== undefined) {
    row[targetHeaderMap['元シート']] = payload.sourceSheet || '';
  }
  if (targetHeaderMap['元状況'] !== undefined) {
    row[targetHeaderMap['元状況']] = payload.sourceStatus || '';
  }
  if (targetHeaderMap['業務ステータス'] !== undefined) {
    row[targetHeaderMap['業務ステータス']] = payload.sourceStatus || '';
  }
  return row;
}

function setIfHeaderExists_(row, targetHeaderMap, headerName, value) {
  const index = targetHeaderMap[headerName];
  if (index === undefined) return;
  row[index] = value;
}

function handleOperationalProtectionEdit_(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (!sheet) return;
  const sheetName = sheet.getName();
  if ([SHEET.BANK.NAME, SHEET.SALES.NAME].indexOf(sheetName) === -1) {
    return;
  }
  if (e.range.getRow() <= 1) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(value) {
    return String(value || '').trim();
  });
  const headerMap = {};
  headers.forEach(function(header, index) {
    if (header) headerMap[header] = index + 1;
  });

  const protectCol = headerMap['保護フラグ'];
  const statusCol = headerMap['ステータス'];
  if (!protectCol || !statusCol) return;

  const watchedCols = [statusCol];
  if (sheetName === SHEET.BANK.NAME) {
    if (headerMap[SHEET.BANK.HEADER.BIZ_NO]) watchedCols.push(headerMap[SHEET.BANK.HEADER.BIZ_NO]);
    if (headerMap[SHEET.BANK.HEADER.CUST_NO]) watchedCols.push(headerMap[SHEET.BANK.HEADER.CUST_NO]);
  } else {
    if (headerMap[SHEET.SALES.HEADER.BIZ_NO]) watchedCols.push(headerMap[SHEET.SALES.HEADER.BIZ_NO]);
    if (headerMap[SHEET.SALES.HEADER.CUST_NO]) watchedCols.push(headerMap[SHEET.SALES.HEADER.CUST_NO]);
  }

  if (watchedCols.indexOf(e.range.getColumn()) === -1) return;

  const statusValue = safeString_(sheet.getRange(e.range.getRow(), statusCol).getValue());
  if (!statusValue && e.range.getColumn() !== statusCol) return;

  sheet.getRange(e.range.getRow(), protectCol).setValue(true);
}

function isVehicleSalesSourceStatus_(status) {
  return ['登録決定', '受注'].indexOf(safeString_(status)) >= 0;
}

function isServiceSalesSourceStatus_(status) {
  return ['売上決定', '見込'].indexOf(safeString_(status)) >= 0;
}

function resolveSalesDueDateCandidate_() {
  for (let i = 0; i < arguments.length; i++) {
    const date = parseJsonLikeDate_(arguments[i]);
    if (date) {
      return date;
    }
  }
  return '';
}

function refreshReceivableForecastSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const salesSheet = ss.getSheetByName(SHEET.SALES.NAME);
  if (!salesSheet || salesSheet.getLastRow() < 2) return;

  const sheet = ensureSheetWithHeaders_(ss, '売掛入金見込み管理', [
    '売上月',
    '入金予定月末',
    'コンクエスト請求ラベル',
    'コンクエスト請求額',
    '売掛請求ラベル',
    '売掛請求額',
    '保護フラグ'
  ]);
  const detailSheet = ensureSheetWithHeaders_(ss, '売掛入金見込み明細', [
    '売上月',
    '入金予定月末',
    '区分',
    'CFラベル',
    '入金予定額',
    '業務№',
    '顧客№',
    '顧客名',
    '請求先名',
    '特殊案件区分',
    '作業大区分名',
    '整備店舗',
    '照合基準額',
    '照合ステータス',
    '入金状況',
    '予測キー',
    '相殺グループ',
    '明細種別',
    '相殺状態'
  ]);

  const headers = salesSheet.getRange(1, 1, 1, salesSheet.getLastColumn()).getValues()[0].map(function(value) {
    return String(value || '').trim();
  });
  const headerMap = {};
  headers.forEach(function(header, index) {
    if (header) headerMap[header] = index;
  });

  const salesValues = salesSheet.getRange(2, 1, salesSheet.getLastRow() - 1, salesSheet.getLastColumn()).getValues();
  const forecastMap = {};
  const detailEntries = [];
  const detailRows = [];

  salesValues.forEach(function(row) {
    if (isTruthyFlag_(row[headerMap[SHEET.SALES.HEADER.PROTECTED]])) return;
    const progress = safeString_(row[headerMap[PAYMENT_PROGRESS_HEADERS.SALES_PROGRESS_STATUS]]);
    if (progress === '入金済') return;

    const salesDate = parseJsonLikeDate_(row[headerMap[SHEET.SALES.HEADER.DATE]]);
    const dueDate = resolveCashflowDueDateFromSalesRow_(row, headerMap, salesDate);
    if (!salesDate || !dueDate) return;

    const reconcileIdx = headerMap[SHEET.SALES.HEADER.RECONCILE_AMOUNT];
    const totalIdx = headerMap[SHEET.SALES.HEADER.TOTAL];
    const expectedAmount = reconcileIdx !== undefined && toNumber_(row[reconcileIdx]) > 0
      ? toNumber_(row[reconcileIdx])
      : toNumber_(row[totalIdx]);
    if (!(expectedAmount > 0)) return;

    const customerName = safeString_(row[headerMap[SHEET.SALES.HEADER.CUST_NAME]]);
    const billTo = safeString_(row[headerMap[SHEET.SALES.HEADER.BILL_TO]]);
    const specialType = safeString_(row[headerMap[SHEET.SALES.HEADER.SPECIAL_TYPE]]);
    const serviceShop = safeString_(row[headerMap['整備店舗']]);
    const workType = safeString_(row[headerMap[SHEET.SALES.HEADER.WORK_TYPE]]);
    const grossProfit = toNumber_(row[headerMap[SHEET.SALES.HEADER.GROSS_PROFIT]]);
    const bizNo = safeString_(row[headerMap[SHEET.SALES.HEADER.BIZ_NO]]);
    const custNo = safeString_(row[headerMap[SHEET.SALES.HEADER.CUST_NO]]);
    const matchStatus = safeString_(row[headerMap[PAYMENT_PROGRESS_HEADERS.SALES_MATCH_STATUS]]);

    const forecast = resolveReceivableForecastEntry_({
      salesDate: salesDate,
      dueDate: dueDate,
      customerName: customerName,
      billTo: billTo,
      specialType: specialType,
      serviceShop: serviceShop,
      workType: workType,
      grossProfit: grossProfit,
      amount: expectedAmount
    });
    if (!forecast) return;

    const normalizedAmount = Math.round(toNumber_(forecast.amount));
    const detailEntry = {
      salesMonth: firstDayOfMonth_(forecast.salesMonth),
      dueDate: endOfMonth_(forecast.dueDate),
      kind: forecast.kind,
      label: forecast.label,
      amount: normalizedAmount,
      bizNo: bizNo,
      custNo: custNo,
      customerName: customerName,
      billTo: billTo,
      specialType: specialType,
      workType: workType,
      serviceShop: serviceShop,
      reconcileAmount: expectedAmount,
      matchStatus: matchStatus,
      progress: progress,
      forecastKey: buildReceivableForecastDetailKey_({
        kind: forecast.kind,
        salesMonth: forecast.salesMonth,
        dueDate: forecast.dueDate,
        label: forecast.label,
        amount: normalizedAmount,
        bizNo: bizNo,
        custNo: custNo
      }),
      settlementGroup: forecast.settlementGroup || '',
      detailKind: forecast.detailKind || '',
      settlementStatus: forecast.kind === 'conquest' ? '相殺待ち' : ''
    };
    detailEntries.push(detailEntry);
    detailRows.push([
      detailEntry.salesMonth,
      detailEntry.dueDate,
      detailEntry.kind,
      detailEntry.label,
      detailEntry.amount,
      detailEntry.bizNo,
      detailEntry.custNo,
      detailEntry.customerName,
      detailEntry.billTo,
      detailEntry.specialType,
      detailEntry.workType,
      detailEntry.serviceShop,
      detailEntry.reconcileAmount,
      detailEntry.matchStatus,
      detailEntry.progress,
      detailEntry.forecastKey,
      detailEntry.settlementGroup,
      detailEntry.detailKind,
      detailEntry.settlementStatus
    ]);

    const key = [
      Utilities.formatDate(forecast.salesMonth, Session.getScriptTimeZone(), 'yyyy/MM'),
      Utilities.formatDate(forecast.dueDate, Session.getScriptTimeZone(), 'yyyy/MM/dd'),
      forecast.kind,
      normalizeMatchText_(forecast.label)
    ].join('|');

    if (!forecastMap[key]) {
      forecastMap[key] = {
        salesMonth: forecast.salesMonth,
        dueDate: forecast.dueDate,
        kind: forecast.kind,
        label: forecast.label,
        amount: 0
      };
    }
    forecastMap[key].amount += forecast.amount;
  });

  const protectedRows = collectProtectedForecastRows_(sheet);
  const outputRows = Object.keys(forecastMap).map(function(key) {
    const item = forecastMap[key];
    return [
      firstDayOfMonth_(item.salesMonth),
      endOfMonth_(item.dueDate),
      item.kind === 'conquest' ? item.label : '',
      item.kind === 'conquest' ? Math.round(item.amount) : '',
      item.kind === 'ar' ? item.label : '',
      item.kind === 'ar' ? Math.round(item.amount) : '',
      ''
    ];
  });

  const merged = mergeProtectedForecastRows_(protectedRows, outputRows);
  merged.sort(function(left, right) {
    const leftDate = parseJsonLikeDate_(left[1]) || new Date(0);
    const rightDate = parseJsonLikeDate_(right[1]) || new Date(0);
    return leftDate - rightDate || String(left[2] || left[4] || '').localeCompare(String(right[2] || right[4] || ''));
  });

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent().clearNote();
  }
  if (merged.length) {
    sheet.getRange(2, 1, merged.length, 7).setValues(merged);
    sheet.getRange(2, 1, merged.length, 2).setNumberFormat('yyyy/mm/dd');
    sheet.getRange(2, 4, merged.length, 1).setNumberFormat('#,##0');
    sheet.getRange(2, 6, merged.length, 1).setNumberFormat('#,##0');
  }

  detailRows.sort(function(left, right) {
    const leftDate = parseJsonLikeDate_(left[1]) || new Date(0);
    const rightDate = parseJsonLikeDate_(right[1]) || new Date(0);
    return leftDate - rightDate || String(left[3] || '').localeCompare(String(right[3] || ''));
  });
  if (detailSheet.getLastRow() > 1) {
    detailSheet.getRange(2, 1, detailSheet.getLastRow() - 1, detailSheet.getLastColumn()).clearContent().clearNote();
  }
  if (detailRows.length) {
    detailSheet.getRange(2, 1, detailRows.length, 19).setValues(detailRows);
    detailSheet.getRange(2, 1, detailRows.length, 2).setNumberFormat('yyyy/mm/dd');
    detailSheet.getRange(2, 5, detailRows.length, 1).setNumberFormat('#,##0');
    detailSheet.getRange(2, 13, detailRows.length, 1).setNumberFormat('#,##0');
  }

  refreshConquestSettlementSheets_(ss, detailEntries);
}

function resolveReceivableForecastEntry_(payload) {
  const normalizedBillTo = normalizeMatchText_(payload.billTo);
  const normalizedSpecialType = normalizeMatchText_(payload.specialType);
  const normalizedWorkType = normalizeMatchText_(payload.workType);
  const conquestGrossVendor = normalizeMatchText_(SPECIAL_CASE_CFG.CONQUEST_GROSS_VENDOR);
  const conquestJlrVendor = normalizeMatchText_(SPECIAL_CASE_CFG.CONQUEST_JLR_VENDOR);
  const conquestSumVendor = normalizeMatchText_(SPECIAL_CASE_CFG.CONQUEST_SUM_VENDOR);
  const salesMonth = firstDayOfMonth_(payload.salesDate);
  const dueDate = payload.dueDate;
  const settlementGroup = buildConquestSettlementGroup_(dueDate || salesMonth);

  if (normalizeMatchText_(payload.serviceShop).indexOf(normalizeMatchText_('Maserati広島')) >= 0) {
    return {
      kind: 'conquest',
      label: 'ｺﾝｸｴｽﾄ様ﾏｾﾗﾃｨ' + (salesMonth.getMonth() + 1) + '月分',
      amount: payload.grossProfit > 0 ? Math.round(payload.grossProfit * 1.1) : payload.amount,
      salesMonth: salesMonth,
      dueDate: dueDate,
      settlementGroup: settlementGroup,
      detailKind: 'gross_invoice'
    };
  }

  if (normalizedBillTo === conquestGrossVendor || normalizedBillTo === conquestJlrVendor) {
    return {
      kind: 'conquest',
      label: 'ｺﾝｸｴｽﾄ様J&LR整備',
      amount: payload.amount,
      salesMonth: salesMonth,
      dueDate: dueDate,
      settlementGroup: settlementGroup,
      detailKind: 'jlr_detail'
    };
  }

  if (normalizedBillTo === conquestSumVendor) {
    return {
      kind: 'conquest',
      label: 'ｺﾝｸｴｽﾄ様J&LR営業部門',
      amount: payload.amount,
      salesMonth: salesMonth,
      dueDate: dueDate,
      settlementGroup: settlementGroup,
      detailKind: 'sales_dept_invoice'
    };
  }

  if (normalizedBillTo.indexOf(normalizeMatchText_('コンクエスト')) >= 0) {
    return {
      kind: 'conquest',
      label: 'コンクエスト＋' + (payload.customerName || payload.billTo),
      amount: payload.amount,
      salesMonth: salesMonth,
      dueDate: dueDate,
      settlementGroup: settlementGroup,
      detailKind: 'conquest_detail'
    };
  }

  const isInsurance = SPECIAL_CASE_CFG.INSURANCE_HINTS.some(function(keyword) {
    const normalizedKeyword = normalizeMatchText_(keyword);
    return normalizedBillTo.indexOf(normalizedKeyword) >= 0 || normalizedSpecialType.indexOf(normalizedKeyword) >= 0;
  }) || SPECIAL_CASE_CFG.BOARD_WORK_TYPES.some(function(workType) {
    return normalizedWorkType === normalizeMatchText_(workType);
  });

  if (isInsurance) {
    return {
      kind: 'insurance',
      label: payload.billTo || ('保険立替＋' + (payload.customerName || '案件')),
      amount: payload.amount,
      salesMonth: salesMonth,
      dueDate: dueDate,
      detailKind: 'insurance'
    };
  }

  return {
    kind: 'ar',
    label: payload.billTo || payload.customerName || payload.workType || '売掛',
    amount: payload.amount,
    salesMonth: salesMonth,
    dueDate: dueDate,
    detailKind: 'ar'
  };
}

function resolveCashflowDueDateFromSalesRow_(row, headerMap, fallbackDate) {
  const explicitDue = parseJsonLikeDate_(row[headerMap[SHEET.SALES.HEADER.DUE_DATE]]);
  if (explicitDue) return explicitDue;
  if (fallbackDate) {
    return endOfMonth_(fallbackDate);
  }
  return null;
}

function firstDayOfMonth_(dateValue) {
  const date = parseJsonLikeDate_(dateValue);
  return date ? new Date(date.getFullYear(), date.getMonth(), 1) : '';
}

function endOfMonth_(dateValue) {
  const date = parseJsonLikeDate_(dateValue);
  return date ? new Date(date.getFullYear(), date.getMonth() + 1, 0) : '';
}

function buildReceivableForecastDetailKey_(payload) {
  const salesMonth = payload.salesMonth
    ? Utilities.formatDate(new Date(payload.salesMonth), Session.getScriptTimeZone(), 'yyyyMM')
    : '';
  const dueDate = payload.dueDate
    ? Utilities.formatDate(new Date(payload.dueDate), Session.getScriptTimeZone(), 'yyyyMMdd')
    : '';
  const identity = safeString_(payload.bizNo || payload.custNo) || normalizeMatchText_(payload.label);
  return [
    'receivable',
    safeString_(payload.kind),
    salesMonth,
    dueDate,
    identity,
    Math.round(toNumber_(payload.amount))
  ].join(':');
}

function buildConquestSettlementGroup_(dateValue) {
  const date = parseJsonLikeDate_(dateValue);
  if (!date) return '';
  return 'CONQUEST:' + Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM');
}

function findHeaderIndexByAliasesLocal_(headerRow, aliases) {
  for (var i = 0; i < aliases.length; i++) {
    var index = headerRow.indexOf(String(aliases[i] || '').trim());
    if (index >= 0) return index;
  }
  return -1;
}

function loadConquestSettlementActuals_(ss) {
  const bankSheet = ss.getSheetByName(SHEET.BANK.NAME);
  if (!bankSheet || bankSheet.getLastRow() < 2) return [];

  const values = bankSheet.getDataRange().getValues();
  const header = values[0].map(function(value) { return String(value || '').trim(); });
  const dateIdx = findHeaderIndexByAliasesLocal_(header, ['日付']);
  const amountIdx = findHeaderIndexByAliasesLocal_(header, ['金額']);
  const statusIdx = findHeaderIndexByAliasesLocal_(header, ['ステータス']);
  const displayIdx = findHeaderIndexByAliasesLocal_(header, ['表示摘要']);
  const summaryIdx = findHeaderIndexByAliasesLocal_(header, ['相手摘要', '摘要']);
  const selfIdx = findHeaderIndexByAliasesLocal_(header, ['自摘要']);
  const partnerIdx = findHeaderIndexByAliasesLocal_(header, ['取引先', '名前']);
  const voucherIdx = findHeaderIndexByAliasesLocal_(header, ['伝票種']);

  if (dateIdx < 0 || amountIdx < 0) return [];

  return values.slice(1).reduce(function(rows, row) {
    const amount = Math.abs(toNumber_(row[amountIdx]));
    const date = parseJsonLikeDate_(row[dateIdx]);
    if (!date || !(amount > 0)) return rows;

    const status = safeString_(statusIdx >= 0 ? row[statusIdx] : '');
    if (/(除外|不要)/.test(status)) return rows;

    const voucherType = safeString_(voucherIdx >= 0 ? row[voucherIdx] : '');
    if (voucherType && voucherType !== '入金') return rows;

    const rawName = [
      displayIdx >= 0 ? row[displayIdx] : '',
      summaryIdx >= 0 ? row[summaryIdx] : '',
      selfIdx >= 0 ? row[selfIdx] : '',
      partnerIdx >= 0 ? row[partnerIdx] : ''
    ].map(function(value) { return safeString_(value); }).join(' ');

    if (!/コンクエスト|ｺﾝｸｴｽﾄ/i.test(rawName)) return rows;

    rows.push({
      settlementGroup: buildConquestSettlementGroup_(date),
      date: date,
      amount: amount,
      rawName: rawName
    });
    return rows;
  }, []);
}

function refreshConquestSettlementSheets_(ss, detailEntries) {
  const conquestEntries = (detailEntries || []).filter(function(entry) {
    return entry.kind === 'conquest' && entry.settlementGroup;
  });

  const detailSheet = ensureSheetWithHeaders_(ss, 'コンクエスト相殺一覧明細', [
    '相殺グループ',
    '売上月',
    '入金予定月末',
    '明細種別',
    'CFラベル',
    '入金予定額',
    '業務№',
    '顧客№',
    '顧客名',
    '請求先名',
    '照合ステータス',
    '入金状況',
    '相殺状態'
  ]);
  const summarySheet = ensureSheetWithHeaders_(ss, 'コンクエスト相殺一覧', [
    '相殺グループ',
    '入金予定月末',
    '予定件数',
    '予定合計',
    '実績件数',
    '実績合計',
    '差額',
    '最終実績日',
    '状態'
  ]);

  const actualRows = loadConquestSettlementActuals_(ss);
  const actualMap = {};
  actualRows.forEach(function(item) {
    if (!actualMap[item.settlementGroup]) {
      actualMap[item.settlementGroup] = {
        count: 0,
        total: 0,
        lastDate: ''
      };
    }
    actualMap[item.settlementGroup].count++;
    actualMap[item.settlementGroup].total += item.amount;
    if (!actualMap[item.settlementGroup].lastDate || item.date > actualMap[item.settlementGroup].lastDate) {
      actualMap[item.settlementGroup].lastDate = item.date;
    }
  });

  const detailRows = conquestEntries.map(function(entry) {
    const actual = actualMap[entry.settlementGroup];
    return [
      entry.settlementGroup,
      entry.salesMonth,
      entry.dueDate,
      entry.detailKind || '',
      entry.label,
      Math.round(entry.amount),
      entry.bizNo,
      entry.custNo,
      entry.customerName,
      entry.billTo,
      entry.matchStatus,
      entry.progress,
      actual && actual.total > 0 ? '相殺済' : '相殺待ち'
    ];
  });

  const summaryMap = {};
  conquestEntries.forEach(function(entry) {
    if (!summaryMap[entry.settlementGroup]) {
      summaryMap[entry.settlementGroup] = {
        settlementGroup: entry.settlementGroup,
        dueDate: entry.dueDate,
        plannedCount: 0,
        plannedTotal: 0
      };
    }
    summaryMap[entry.settlementGroup].plannedCount++;
    summaryMap[entry.settlementGroup].plannedTotal += Number(entry.amount || 0);
    if (entry.dueDate && entry.dueDate > summaryMap[entry.settlementGroup].dueDate) {
      summaryMap[entry.settlementGroup].dueDate = entry.dueDate;
    }
  });

  const summaryRows = Object.keys(summaryMap).sort().map(function(groupKey) {
    var summary = summaryMap[groupKey];
    var actual = actualMap[groupKey] || { count: 0, total: 0, lastDate: '' };
    var diff = Math.round(actual.total - summary.plannedTotal);
    return [
      groupKey,
      summary.dueDate,
      summary.plannedCount,
      Math.round(summary.plannedTotal),
      actual.count,
      Math.round(actual.total),
      diff,
      actual.lastDate || '',
      actual.total > 0 ? '相殺済' : '相殺待ち'
    ];
  });

  if (detailSheet.getLastRow() > 1) {
    detailSheet.getRange(2, 1, detailSheet.getLastRow() - 1, detailSheet.getLastColumn()).clearContent().clearNote();
  }
  if (detailRows.length) {
    detailSheet.getRange(2, 1, detailRows.length, 13).setValues(detailRows);
    detailSheet.getRange(2, 2, detailRows.length, 2).setNumberFormat('yyyy/mm/dd');
    detailSheet.getRange(2, 6, detailRows.length, 1).setNumberFormat('#,##0');
  }

  if (summarySheet.getLastRow() > 1) {
    summarySheet.getRange(2, 1, summarySheet.getLastRow() - 1, summarySheet.getLastColumn()).clearContent().clearNote();
  }
  if (summaryRows.length) {
    summarySheet.getRange(2, 1, summaryRows.length, 9).setValues(summaryRows);
    summarySheet.getRange(2, 2, summaryRows.length, 1).setNumberFormat('yyyy/mm/dd');
    summarySheet.getRange(2, 4, summaryRows.length, 3).setNumberFormat('#,##0');
  }
}

function collectProtectedForecastRows_(sheet) {
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
  return values.filter(function(row) {
    return isTruthyFlag_(row[6]);
  });
}

function mergeProtectedForecastRows_(protectedRows, generatedRows) {
  const merged = new Map();

  function addRow(row, preferExisting) {
    const key = [
      normalizeSyncDateKey_(row[1]),
      normalizeMatchText_(row[2] || row[4]),
      row[2] ? 'conquest' : 'ar'
    ].join('|');
    if (!preferExisting || !merged.has(key)) {
      merged.set(key, row);
    }
  }

  (protectedRows || []).forEach(function(row) { addRow(row, false); });
  (generatedRows || []).forEach(function(row) { addRow(row, true); });
  return Array.from(merged.values());
}

function annotateInsurancePaymentCandidates_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const bankSheet = ss.getSheetByName(SHEET.BANK.NAME);
  const salesSheet = ss.getSheetByName(SHEET.SALES.NAME);
  if (!bankSheet || !salesSheet) return;
  if (bankSheet.getLastRow() < 2 || salesSheet.getLastRow() < 2) return;

  const timezone = Session.getScriptTimeZone();
  const bankHeaders = bankSheet.getRange(1, 1, 1, bankSheet.getLastColumn()).getValues()[0].map(function(v) { return String(v || '').trim(); });
  const salesTargetHeaders = [
    SHEET.SALES.HEADER.BIZ_NO,
    SHEET.SALES.HEADER.CUST_NO,
    SHEET.SALES.HEADER.CUST_NAME,
    SHEET.SALES.HEADER.TOTAL,
    SHEET.SALES.HEADER.DATE,
    SHEET.SALES.HEADER.DUE_DATE,
    SHEET.SALES.HEADER.WORK_TYPE,
    SHEET.SALES.HEADER.RECONCILE_AMOUNT
  ];

  const bankData = getSheetDataWithRowIdAndFormatDate_(
    bankSheet,
    [
      SHEET.BANK.HEADER.DATE,
      SHEET.BANK.HEADER.AMOUNT,
      SHEET.BANK.HEADER.OTHER_PARTY,
      SHEET.BANK.HEADER.SELF_SUMMARY,
      SHEET.BANK.HEADER.SUBJECT,
      SHEET.BANK.HEADER.STATUS
    ],
    timezone
  );
  const salesData = getSheetDataWithRowIdAndFormatDate_(salesSheet, salesTargetHeaders, timezone)
    .map(function(row) { return buildSalesMatchContext_(row, []); });

  const statusIdx = bankHeaders.indexOf(SHEET.BANK.HEADER.STATUS);
  if (statusIdx === -1) return;
  const statusNotes = bankSheet.getRange(1, statusIdx + 1, bankSheet.getLastRow(), 1).getNotes();
  const statusValues = bankSheet.getRange(1, statusIdx + 1, bankSheet.getLastRow(), 1).getValues();
  const reviewMemoRows = [];

  bankData.forEach(function(bankRow) {
    const ctx = buildBankMatchContext_(bankRow, [], []);
    if (ctx.protectedFlag) return;
    if (!isInsuranceLikeBankContext_(ctx)) return;
    if (!(ctx.amount > 0)) return;

    const candidates = salesData
      .filter(function(saleCtx) { return isInsuranceRelatedSalesCase_(saleCtx); })
      .map(function(saleCtx) {
        return {
          sale: saleCtx,
          amountDiff: Math.abs((saleCtx.amount || 0) - ctx.amount),
          dateDiff: calcDateDiffDays_(ctx.date, saleCtx.dueDate || saleCtx.date)
        };
      })
      .filter(function(item) {
        return item.amountDiff <= SPECIAL_CASE_CFG.MICRO_DIFF_MAX || (item.dateDiff !== null && item.dateDiff <= 45);
      })
      .sort(function(a, b) {
        if (a.amountDiff !== b.amountDiff) return a.amountDiff - b.amountDiff;
        return (a.dateDiff || 9999) - (b.dateDiff || 9999);
      })
      .slice(0, 3);

    if (!candidates.length) return;

    const note = '保険会社入金候補\n' + candidates.map(function(item) {
      return [
        item.sale.bizNo || '(業務Noなし)',
        item.sale.rawName || '',
        '差額 ' + item.amountDiff + '円',
        item.dateDiff === null ? '' : '日付差 ' + item.dateDiff + '日'
      ].filter(Boolean).join(' / ');
    }).join('\n');

    const rowIndex = ctx.id - 1;
    statusNotes[rowIndex][0] = mergeReasonNotes_(statusNotes[rowIndex][0], note);
    if (!safeString_(statusValues[rowIndex][0])) {
      statusValues[rowIndex][0] = MATCH_STATUS.REVIEW;
    } else if (safeString_(statusValues[rowIndex][0]) === '未照合') {
      statusValues[rowIndex][0] = MATCH_STATUS.REVIEW;
    }

    reviewMemoRows.push([
      convertAnyDateToFormat_(ctx.date, timezone),
      ctx.rawName || ctx.fallbackName,
      ctx.amount,
      '要確認',
      candidates[0].sale.bizNo || '',
      note
    ]);
  });

  bankSheet.getRange(1, statusIdx + 1, statusValues.length, 1).setValues(statusValues);
  bankSheet.getRange(1, statusIdx + 1, statusNotes.length, 1).setNotes(statusNotes);
  appendBankReviewMemoRows_(reviewMemoRows);
}

function annotateRemainingBankReviewReasons_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const bankSheet = ss.getSheetByName(SHEET.BANK.NAME);
  const salesSheet = ss.getSheetByName(SHEET.SALES.NAME);
  if (!bankSheet || !salesSheet) return;
  if (bankSheet.getLastRow() < 2) return;

  const timezone = Session.getScriptTimeZone();
  const bankValues = bankSheet.getRange(1, 1, bankSheet.getLastRow(), bankSheet.getLastColumn()).getValues();
  const bankHeaders = bankValues[0].map(function(v) { return String(v || '').trim(); });
  const bankHeaderMap = {};
  bankHeaders.forEach(function(header, index) { bankHeaderMap[header] = index; });
  const statusIdx = bankHeaderMap[SHEET.BANK.HEADER.STATUS];
  if (statusIdx === undefined) return;
  const statusValues = bankSheet.getRange(1, statusIdx + 1, bankSheet.getLastRow(), 1).getValues();

  const salesData = getSheetDataWithRowIdAndFormatDate_(
    salesSheet,
    [
      SHEET.SALES.HEADER.BIZ_NO,
      SHEET.SALES.HEADER.CUST_NO,
      SHEET.SALES.HEADER.CUST_NAME,
      SHEET.SALES.HEADER.TOTAL,
      SHEET.SALES.HEADER.DATE,
      SHEET.SALES.HEADER.DUE_DATE,
      SHEET.SALES.HEADER.RECONCILE_AMOUNT
    ],
    timezone
  ).map(function(row) { return buildSalesMatchContext_(row, []); });

  const statusNotes = bankSheet.getRange(1, statusIdx + 1, bankSheet.getLastRow(), 1).getNotes();
  const duplicateMap = buildBankSameDayAmountMap_(bankValues, bankHeaderMap);
  const reviewMemoRows = [];

  for (let r = 1; r < bankValues.length; r++) {
    const status = safeString_(bankValues[r][statusIdx]);
    if (status !== MATCH_STATUS.REVIEW && status !== '未照合' && status !== MATCH_STATUS.CARD_MATCH) {
      continue;
    }

    const rowObj = {};
    Object.keys(bankHeaderMap).forEach(function(header) {
      rowObj[header] = bankValues[r][bankHeaderMap[header]];
    });
    rowObj.id = r + 1;
    const bankCtx = buildBankMatchContext_(rowObj, [], []);
    if (bankCtx.protectedFlag) {
      continue;
    }
    const reasons = [];

    if (bankCtx.codes.length && !safeString_(rowObj[SHEET.BANK.HEADER.BIZ_NO])) {
      reasons.push('案件未登録の可能性（番号候補: ' + bankCtx.codes.join(', ') + '）');
    }

    const duplicateKey = buildBankDuplicateAmountKey_(bankCtx);
    if (duplicateKey && duplicateMap[duplicateKey] > 1) {
      reasons.push('同日同額の重複入金の疑い');
    }

    const nearAmount = findNearAmountSalesCandidate_(bankCtx, salesData);
    if (nearAmount) {
      reasons.push('金額微差（手数料疑い: 差額 ' + nearAmount.diff + '円 / 候補 ' + (nearAmount.sale.bizNo || nearAmount.sale.rawName) + '）');
    }

    if (reasons.length) {
      statusNotes[r][0] = mergeReasonNotes_(statusNotes[r][0], reasons.join('\n'));
      if (status === '未照合') {
        statusValues[r][0] = MATCH_STATUS.REVIEW;
      }
      reviewMemoRows.push([
        convertAnyDateToFormat_(bankCtx.date, timezone),
        bankCtx.rawName || bankCtx.fallbackName,
        bankCtx.amount,
        statusValues[r][0] || status,
        nearAmount ? (nearAmount.sale.bizNo || '') : '',
        reasons.join('\n')
      ]);
    }
  }

  bankSheet.getRange(1, statusIdx + 1, statusValues.length, 1).setValues(statusValues);
  bankSheet.getRange(1, statusIdx + 1, statusNotes.length, 1).setNotes(statusNotes);
  appendBankReviewMemoRows_(reviewMemoRows);
}

function isInsuranceLikeBankContext_(bankCtx) {
  const joined = normalizeMatchText_([bankCtx.rawName, bankCtx.fallbackName, bankCtx.subject].join(' '));
  return SPECIAL_CASE_CFG.INSURANCE_HINTS.some(function(keyword) {
    return joined.indexOf(normalizeMatchText_(keyword)) >= 0;
  });
}

function isInsuranceRelatedSalesCase_(saleCtx) {
  const workType = normalizeMatchText_(saleCtx.workType);
  return SPECIAL_CASE_CFG.BOARD_WORK_TYPES.some(function(type) {
    return workType.indexOf(normalizeMatchText_(type)) >= 0;
  });
}

function buildBankSameDayAmountMap_(bankValues, bankHeaderMap) {
  const counts = {};
  for (let r = 1; r < bankValues.length; r++) {
    const rowObj = {};
    Object.keys(bankHeaderMap).forEach(function(header) {
      rowObj[header] = bankValues[r][bankHeaderMap[header]];
    });
    rowObj.id = r + 1;
    const key = buildBankDuplicateAmountKey_(buildBankMatchContext_(rowObj, [], []));
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function buildBankDuplicateAmountKey_(bankCtx) {
  if (!bankCtx || !bankCtx.date || !(bankCtx.amount > 0)) return '';
  return Utilities.formatDate(bankCtx.date, Session.getScriptTimeZone(), 'yyyy/MM/dd') + '|' + bankCtx.amount;
}

function findNearAmountSalesCandidate_(bankCtx, salesData) {
  let best = null;
  salesData.forEach(function(saleCtx) {
    const diff = Math.abs((saleCtx.amount || 0) - (bankCtx.amount || 0));
    if (!diff || diff > SPECIAL_CASE_CFG.MICRO_DIFF_MAX) return;
    const nameMatch = isLooseNormalizedNameMatch_(bankCtx.normalizedName, saleCtx.normalizedName);
    const codeMatch = saleCtx.bizNo && bankCtx.codes.indexOf(saleCtx.bizNo.toUpperCase()) >= 0;
    if (!nameMatch && !codeMatch) return;
    if (!best || diff < best.diff) {
      best = { sale: saleCtx, diff: diff };
    }
  });
  return best;
}

function mergeReasonNotes_(existing, next) {
  const lines = (safeString_(existing) ? safeString_(existing).split('\n') : []).concat(safeString_(next).split('\n'));
  return lines.filter(Boolean).filter(function(line, index, array) {
    return array.indexOf(line) === index;
  }).join('\n');
}

function appendBankReviewMemoRows_(rows) {
  if (!rows || !rows.length) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('銀行要確認メモ');
  if (!sheet) {
    sheet = ss.insertSheet('銀行要確認メモ');
  }
  const headers = ['日付', '摘要', '金額', '状態', '候補案件', '確認メモ'];
  const existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0].map(function(v) {
    return String(v || '').trim();
  });
  if (!existingHeaders[0]) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  const existingValues = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues() : [];
  const index = {};
  existingValues.forEach(function(row, i) {
    index[
      safeString_(row[0]) + '|' + safeString_(row[1]) + '|' + safeString_(row[2])
    ] = i + 2;
  });

  rows.forEach(function(row) {
    const key = safeString_(row[0]) + '|' + safeString_(row[1]) + '|' + safeString_(row[2]);
    const targetRow = index[key];
    if (targetRow) {
      sheet.getRange(targetRow, 1, 1, headers.length).setValues([row]);
      return;
    }
    sheet.appendRow(row);
  });
}

function getValueByHeaderMap_(row, headerMap, headerName) {
  const index = headerMap[headerName];
  if (!index) return '';
  return row[index - 1];
}

function updateSalesPaymentProgress_(ss) {
  const salesSheet = ss.getSheetByName(SHEET.SALES.NAME);
  const bankSheet = ss.getSheetByName(SHEET.BANK.NAME);
  const cashSheet = ss.getSheetByName(SHEET.CASH.NAME);
  if (!salesSheet || !bankSheet || !cashSheet) return;
  if (salesSheet.getLastRow() < 2) return;

  const salesHeaderMap = getHeaderMap_(salesSheet);
  const bankHeaderMap = getHeaderMap_(bankSheet);
  const cashHeaderMap = getHeaderMap_(cashSheet);

  const requiredSales = [
    PAYMENT_PROGRESS_HEADERS.SALES_BIZ_NO,
    PAYMENT_PROGRESS_HEADERS.SALES_CUST_NO,
    PAYMENT_PROGRESS_HEADERS.SALES_AMOUNT,
    PAYMENT_PROGRESS_HEADERS.SALES_MATCH_STATUS,
    PAYMENT_PROGRESS_HEADERS.SALES_PAID_TOTAL,
    PAYMENT_PROGRESS_HEADERS.SALES_PROGRESS_STATUS,
    PAYMENT_PROGRESS_HEADERS.SALES_MEMO
  ];
  const missingSales = requiredSales.filter(function(header) { return !salesHeaderMap[header]; });
  if (missingSales.length) {
    throw new Error('振込入金リスト一覧の必要列不足: ' + missingSales.join(', '));
  }

  const paymentMap = buildSalesPaymentAggregation_(bankSheet, bankHeaderMap, cashSheet, cashHeaderMap);
  const salesLastRow = salesSheet.getLastRow();
  const salesValues = salesSheet.getRange(2, 1, salesLastRow - 1, salesSheet.getLastColumn()).getValues();

  const paidTotals = [];
  const progressStatuses = [];
  const memos = [];

  salesValues.forEach(function(row) {
    const bizNo = safeString_(row[salesHeaderMap[PAYMENT_PROGRESS_HEADERS.SALES_BIZ_NO] - 1]);
    const custNo = safeString_(row[salesHeaderMap[PAYMENT_PROGRESS_HEADERS.SALES_CUST_NO] - 1]);
    const total = getSalesExpectedAmountFromRow_(row, salesHeaderMap);
    const matchStatus = safeString_(row[salesHeaderMap[PAYMENT_PROGRESS_HEADERS.SALES_MATCH_STATUS] - 1]);
    const payment = resolveSalesPaymentAggregation_(paymentMap, bizNo, custNo);

    const paidTotal = payment ? payment.totalAmount : 0;
    const hasReview = payment ? payment.hasReview : false;
    const memo = payment ? buildSalesPaymentMemo_(payment) : '';

    let progressStatus = '未入金';
    if (matchStatus === MATCH_STATUS.REVIEW || hasReview) {
      progressStatus = '要確認';
    } else if (paidTotal >= total && total > 0) {
      progressStatus = '入金済';
    } else if (paidTotal > 0) {
      progressStatus = '一部入金';
    }

    paidTotals.push([paidTotal || '']);
    progressStatuses.push([progressStatus]);
    memos.push([memo]);
  });

  writeColumnValuesByHeader_(salesSheet, salesHeaderMap, PAYMENT_PROGRESS_HEADERS.SALES_PAID_TOTAL, paidTotals);
  writeColumnValuesByHeader_(salesSheet, salesHeaderMap, PAYMENT_PROGRESS_HEADERS.SALES_PROGRESS_STATUS, progressStatuses);
  writeColumnValuesByHeader_(salesSheet, salesHeaderMap, PAYMENT_PROGRESS_HEADERS.SALES_MEMO, memos);
}

function getSalesExpectedAmountFromRow_(row, salesHeaderMap) {
  const reconcileIdx = salesHeaderMap[SHEET.SALES.HEADER.RECONCILE_AMOUNT];
  if (reconcileIdx) {
    const reconcileAmount = toNumber_(row[reconcileIdx - 1]);
    if (reconcileAmount > 0) {
      return reconcileAmount;
    }
  }
  return toNumber_(row[salesHeaderMap[PAYMENT_PROGRESS_HEADERS.SALES_AMOUNT] - 1]);
}

function buildSalesPaymentAggregation_(bankSheet, bankHeaderMap, cashSheet, cashHeaderMap) {
  const aggregation = {
    biz: {},
    cust: {}
  };

  appendPaymentAggregationFromSheet_(
    aggregation,
    bankSheet,
    bankHeaderMap,
    PAYMENT_PROGRESS_HEADERS.BANK_AMOUNT,
    PAYMENT_PROGRESS_HEADERS.BANK_STATUS,
    PAYMENT_PROGRESS_HEADERS.BANK_BIZ_NO,
    PAYMENT_PROGRESS_HEADERS.BANK_CUST_NO,
    '銀行',
    '振り込み'
  );

  appendPaymentAggregationFromSheet_(
    aggregation,
    cashSheet,
    cashHeaderMap,
    PAYMENT_PROGRESS_HEADERS.CASH_AMOUNT,
    PAYMENT_PROGRESS_HEADERS.CASH_STATUS,
    PAYMENT_PROGRESS_HEADERS.CASH_BIZ_NO,
    PAYMENT_PROGRESS_HEADERS.CASH_CUST_NO,
    'クレカ・現金',
    null
  );

  return aggregation;
}

function appendPaymentAggregationFromSheet_(aggregation, sheet, headerMap, amountHeader, statusHeader, bizNoHeader, custNoHeader, sourceLabel, fixedMethod) {
  if (!headerMap[amountHeader] || !headerMap[statusHeader]) return;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  values.forEach(function(row) {
    const status = safeString_(row[headerMap[statusHeader] - 1]);
    if (!shouldCountPaymentStatus_(status)) return;

    const amount = toNumber_(row[headerMap[amountHeader] - 1]);
    if (!(amount > 0)) return;

    const method = fixedMethod || (headerMap[PAYMENT_PROGRESS_HEADERS.CASH_METHOD] ? safeString_(row[headerMap[PAYMENT_PROGRESS_HEADERS.CASH_METHOD] - 1]) : '');
    if (sourceLabel === 'クレカ・現金' && method === '請求書') {
      return;
    }

    const bizNo = headerMap[bizNoHeader] ? safeString_(row[headerMap[bizNoHeader] - 1]) : '';
    const custNo = headerMap[custNoHeader] ? safeString_(row[headerMap[custNoHeader] - 1]) : '';

    const payload = {
      amount: amount,
      status: status,
      sourceLabel: sourceLabel,
      method: method || fixedMethod || ''
    };

    if (bizNo) {
      addPaymentAggregationEntry_(aggregation.biz, bizNo, payload);
    } else if (custNo) {
      addPaymentAggregationEntry_(aggregation.cust, custNo, payload);
    }
  });
}

function addPaymentAggregationEntry_(bucket, key, payload) {
  if (!bucket[key]) {
    bucket[key] = {
      totalAmount: 0,
      hasReview: false,
      sourceCounts: {},
      methods: {}
    };
  }

  const target = bucket[key];
  target.totalAmount += payload.amount;
  if (payload.status === MATCH_STATUS.REVIEW) {
    target.hasReview = true;
  }
  target.sourceCounts[payload.sourceLabel] = (target.sourceCounts[payload.sourceLabel] || 0) + 1;
  if (payload.method) {
    target.methods[payload.method] = true;
  }
}

function resolveSalesPaymentAggregation_(aggregation, bizNo, custNo) {
  if (bizNo && aggregation.biz[bizNo]) {
    return aggregation.biz[bizNo];
  }
  if (custNo && aggregation.cust[custNo]) {
    return aggregation.cust[custNo];
  }
  return null;
}

function shouldCountPaymentStatus_(status) {
  const value = safeString_(status);
  return !!value && value !== '未照合';
}

function buildSalesPaymentMemo_(payment) {
  const parts = [];
  Object.keys(payment.sourceCounts).forEach(function(label) {
    parts.push(label + ':' + payment.sourceCounts[label] + '件');
  });

  const methods = Object.keys(payment.methods);
  if (methods.length) {
    parts.push('方法:' + methods.join('/'));
  }
  if (payment.hasReview) {
    parts.push('要確認あり');
  }

  return parts.join(' / ');
}

function writeColumnValuesByHeader_(sheet, headerMap, headerName, values) {
  const col = headerMap[headerName];
  if (!col || !values || !values.length) return;
  sheet.getRange(2, col, values.length, 1).setValues(values);
}

function updateInvoicePaymentProgress_(ss) {
  const invoiceSheet = ss.getSheetByName(PAYMENT_PROGRESS_HEADERS.INVOICE_SHEET);
  const bankSheet = ss.getSheetByName(SHEET.BANK.NAME);
  if (!invoiceSheet || !bankSheet) return;
  if (invoiceSheet.getLastRow() < 2 || bankSheet.getLastRow() < 2) return;

  const invoiceHeaderMap = getHeaderMap_(invoiceSheet);
  const bankHeaderMap = getHeaderMap_(bankSheet);
  const requiredHeaders = [
    PAYMENT_PROGRESS_HEADERS.INVOICE_VENDOR,
    PAYMENT_PROGRESS_HEADERS.INVOICE_TOTAL,
    PAYMENT_PROGRESS_HEADERS.INVOICE_DATE,
    PAYMENT_PROGRESS_HEADERS.INVOICE_DUE,
    PAYMENT_PROGRESS_HEADERS.INVOICE_PAID_TOTAL,
    PAYMENT_PROGRESS_HEADERS.INVOICE_PROGRESS_STATUS,
    PAYMENT_PROGRESS_HEADERS.INVOICE_MEMO
  ];
  const missing = requiredHeaders.filter(function(header) { return !invoiceHeaderMap[header]; });
  if (missing.length) {
    throw new Error('請求書発行の必要列不足: ' + missing.join(', '));
  }

  const invoiceValues = invoiceSheet.getRange(2, 1, invoiceSheet.getLastRow() - 1, invoiceSheet.getLastColumn()).getValues();
  const bankEntries = loadInvoiceBankEntries_(bankSheet, bankHeaderMap);
  const usedBankRowIds = {};

  const paidTotals = [];
  const progressStatuses = [];
  const memos = [];

  invoiceValues.forEach(function(row) {
    const invoice = {
      vendor: safeString_(row[invoiceHeaderMap[PAYMENT_PROGRESS_HEADERS.INVOICE_VENDOR] - 1]),
      invoiceNo: invoiceHeaderMap[PAYMENT_PROGRESS_HEADERS.INVOICE_NO] ? safeString_(row[invoiceHeaderMap[PAYMENT_PROGRESS_HEADERS.INVOICE_NO] - 1]) : '',
      total: toNumber_(row[invoiceHeaderMap[PAYMENT_PROGRESS_HEADERS.INVOICE_TOTAL] - 1]),
      issuedDate: parseJsonLikeDate_(row[invoiceHeaderMap[PAYMENT_PROGRESS_HEADERS.INVOICE_DATE] - 1]),
      dueDate: parseJsonLikeDate_(row[invoiceHeaderMap[PAYMENT_PROGRESS_HEADERS.INVOICE_DUE] - 1]),
      rawStatus: invoiceHeaderMap[PAYMENT_PROGRESS_HEADERS.INVOICE_STATUS] ? safeString_(row[invoiceHeaderMap[PAYMENT_PROGRESS_HEADERS.INVOICE_STATUS] - 1]) : ''
    };

    const result = reconcileInvoicePayment_(invoice, bankEntries, usedBankRowIds);
    paidTotals.push([result.paidTotal || '']);
    progressStatuses.push([result.status]);
    memos.push([result.memo]);
  });

  writeColumnValuesByHeader_(invoiceSheet, invoiceHeaderMap, PAYMENT_PROGRESS_HEADERS.INVOICE_PAID_TOTAL, paidTotals);
  writeColumnValuesByHeader_(invoiceSheet, invoiceHeaderMap, PAYMENT_PROGRESS_HEADERS.INVOICE_PROGRESS_STATUS, progressStatuses);
  writeColumnValuesByHeader_(invoiceSheet, invoiceHeaderMap, PAYMENT_PROGRESS_HEADERS.INVOICE_MEMO, memos);
}

function loadInvoiceBankEntries_(bankSheet, bankHeaderMap) {
  const values = bankSheet.getRange(2, 1, bankSheet.getLastRow() - 1, bankSheet.getLastColumn()).getValues();
  return values.map(function(row, index) {
    return {
      rowId: index + 2,
      amount: toNumber_(row[bankHeaderMap[PAYMENT_PROGRESS_HEADERS.BANK_AMOUNT] - 1]),
      status: safeString_(row[bankHeaderMap[PAYMENT_PROGRESS_HEADERS.BANK_STATUS] - 1]),
      bizNo: bankHeaderMap[PAYMENT_PROGRESS_HEADERS.BANK_BIZ_NO] ? safeString_(row[bankHeaderMap[PAYMENT_PROGRESS_HEADERS.BANK_BIZ_NO] - 1]) : '',
      custNo: bankHeaderMap[PAYMENT_PROGRESS_HEADERS.BANK_CUST_NO] ? safeString_(row[bankHeaderMap[PAYMENT_PROGRESS_HEADERS.BANK_CUST_NO] - 1]) : '',
      summary: safeString_(row[bankHeaderMap[SHEET.BANK.HEADER.OTHER_PARTY] - 1]),
      subject: bankHeaderMap[SHEET.BANK.HEADER.SUBJECT] ? safeString_(row[bankHeaderMap[SHEET.BANK.HEADER.SUBJECT] - 1]) : '',
      date: parseJsonLikeDate_(row[bankHeaderMap[SHEET.BANK.HEADER.DATE] - 1])
    };
  }).filter(function(entry) {
    return entry.amount > 0 && shouldCountPaymentStatus_(entry.status);
  }).map(function(entry) {
    entry.normalizedSummary = normalizeMatchText_(entry.summary);
    return entry;
  });
}

function reconcileInvoicePayment_(invoice, bankEntries, usedBankRowIds) {
  if (!(invoice.total > 0) || !invoice.vendor) {
    return { paidTotal: '', status: '未入金', memo: '' };
  }

  const normalizedVendor = normalizeMatchText_(invoice.vendor);
  const normalizedInvoiceNo = normalizeMatchText_(invoice.invoiceNo);
  const dueBase = invoice.dueDate || invoice.issuedDate || null;

  const candidates = bankEntries
    .filter(function(entry) { return !usedBankRowIds[entry.rowId]; })
    .map(function(entry) {
      const score = scoreInvoiceBankMatch_(invoice, normalizedVendor, normalizedInvoiceNo, dueBase, entry);
      return {
        entry: entry,
        score: score.score,
        reasons: score.reasons
      };
    })
    .filter(function(item) { return item.score >= 45; })
    .sort(function(a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return calcDateDiffDays_(dueBase, a.entry.date) - calcDateDiffDays_(dueBase, b.entry.date);
    });

  if (!candidates.length) {
    return { paidTotal: '', status: '未入金', memo: '' };
  }

  const exactCandidates = candidates.filter(function(item) {
    return item.entry.amount === invoice.total;
  });

  if (exactCandidates.length === 1 && exactCandidates[0].score >= 70) {
    usedBankRowIds[exactCandidates[0].entry.rowId] = true;
    return {
      paidTotal: exactCandidates[0].entry.amount,
      status: exactCandidates[0].entry.status === MATCH_STATUS.REVIEW ? '要確認' : '入金済',
      memo: buildInvoicePaymentMemo_(exactCandidates[0].reasons, [exactCandidates[0].entry])
    };
  }

  if (exactCandidates.length >= 2) {
    return {
      paidTotal: invoice.total,
      status: '要確認',
      memo: '同額候補が複数あります'
    };
  }

  const splitCandidates = candidates.filter(function(item) {
    return item.entry.amount < invoice.total && item.score >= 60;
  });
  const splitResult = pickInvoiceSplitCandidates_(splitCandidates, invoice.total);
  if (splitResult) {
    splitResult.entries.forEach(function(entry) {
      usedBankRowIds[entry.rowId] = true;
    });
    return {
      paidTotal: splitResult.total,
      status: splitResult.total >= invoice.total ? '要確認' : '一部入金',
      memo: buildInvoicePaymentMemo_(splitResult.reasons.concat('請求書分割入金候補'), splitResult.entries)
    };
  }

  const best = candidates[0];
  return {
    paidTotal: best.entry.amount,
    status: best.entry.status === MATCH_STATUS.REVIEW ? '要確認' : '一部入金',
    memo: buildInvoicePaymentMemo_(best.reasons, [best.entry])
  };
}

function scoreInvoiceBankMatch_(invoice, normalizedVendor, normalizedInvoiceNo, dueBase, entry) {
  let score = 0;
  const reasons = [];

  if (normalizedInvoiceNo && entry.normalizedSummary.indexOf(normalizedInvoiceNo) >= 0) {
    score += 120;
    reasons.push('伝票番号一致');
  }

  if (isStrongNormalizedNameMatch_(entry.normalizedSummary, normalizedVendor)) {
    score += 85;
    reasons.push('取引先名一致');
  } else if (isLooseNormalizedNameMatch_(entry.normalizedSummary, normalizedVendor)) {
    score += 60;
    reasons.push('取引先名近似');
  }

  if (entry.amount === invoice.total) {
    score += 60;
    reasons.push('金額一致');
  } else if (entry.amount < invoice.total) {
    score += 20;
    reasons.push('金額部分一致');
  }

  const diffDays = calcDateDiffDays_(dueBase, entry.date);
  if (diffDays !== null) {
    if (diffDays <= 7) {
      score += 25;
      reasons.push('入金期限近傍');
    } else if (diffDays <= 30) {
      score += 12;
      reasons.push('入金期限許容');
    } else if (diffDays <= 120) {
      score += 4;
    } else {
      score -= 20;
    }
  }

  return { score: score, reasons: reasons };
}

function pickInvoiceSplitCandidates_(candidates, targetAmount) {
  if (!candidates.length) return null;

  const picked = [];
  let total = 0;
  for (let i = 0; i < candidates.length && picked.length < 3; i++) {
    const candidate = candidates[i];
    picked.push(candidate);
    total += candidate.entry.amount;
    if (total >= targetAmount) break;
  }

  if (!picked.length) return null;
  return {
    entries: picked.map(function(item) { return item.entry; }),
    reasons: picked.reduce(function(acc, item) { return acc.concat(item.reasons); }, []),
    total: total
  };
}

function buildInvoicePaymentMemo_(reasons, entries) {
  const parts = [...new Set((reasons || []).filter(Boolean))];
  const labels = (entries || []).map(function(entry) {
    const dateText = entry.date ? Utilities.formatDate(new Date(entry.date), Session.getScriptTimeZone(), 'yyyy/MM/dd') : '';
    return (dateText ? dateText + ' ' : '') + entry.summary + ' ' + entry.amount;
  });
  if (labels.length) {
    parts.push(labels.join(' / '));
  }
  return parts.join(' | ');
}


/**
 * getAliasMap_ の戻り値をログ出力して確認するテスト関数
 */
function testAliasMapLog() {
  const result = getAliasMap_();

  if (Object.keys(result).length === 0) {
    console.warn("マップが空です。シート名やヘッダー名、データが入力されているか確認してください。");
  } else {
    console.log("名義対応表の読み込み結果:");
    console.log(JSON.stringify(result, null, 2));
  }
}

/** ================================ カード会社 ================================ */

function updateBankCardSettlementKeyWithGemini() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const timezone = Session.getScriptTimeZone();

  const bankSheet = ss.getSheetByName(SHEET.BANK.NAME);
  if (!bankSheet) {
    console.error('銀行データチェック用シートが見つかりません。');
    return;
  }

  const lastRow = bankSheet.getLastRow();
  const lastCol = bankSheet.getLastColumn();
  if (lastRow < 2) return;

  const headers = bankSheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(h => h ? String(h).trim() : '');

  const dateIdx = headers.indexOf(SHEET.BANK.HEADER.DATE);
  const otherPartyIdx = headers.indexOf(SHEET.BANK.HEADER.OTHER_PARTY);
  const outputIdx = headers.indexOf(SHEET.BANK.HEADER.CARD_SETTLEMENT_KEY);

  if (dateIdx === -1 || otherPartyIdx === -1 || outputIdx === -1) {
    console.error('銀行データチェック用シートの必要列が見つかりません。');
    return;
  }

  const range = bankSheet.getRange(1, 1, lastRow, lastCol);
  const values = range.getValues();

  const candidates = [];
  for (let r = 1; r < values.length; r++) {
    const dateStr = convertAnyDateToFormat_(values[r][dateIdx], timezone);
    const otherParty = String(values[r][otherPartyIdx] || '').trim();

    if (!dateStr || !otherParty) continue;

    candidates.push({
      rowId: r + 1,
      date: dateStr,
      otherParty: otherParty
    });
  }

  if (candidates.length === 0) {
    console.log('カード会社一括入金判定対象なし');
    return;
  }

  const aiResults = classifyBankCardSettlementKeysWithGemini_(candidates);

  const resultMap = {};
  aiResults.forEach(item => {
    resultMap[item.rowId] = item;
  });

  let updatedCount = 0;

  for (let r = 1; r < values.length; r++) {
    const rowId = r + 1;
    const result = resultMap[rowId];

    if (!result) {
      values[r][outputIdx] = '';
      continue;
    }

    if (result.isCardSettlement && result.cardType) {
      values[r][outputIdx] = result.cardType;
      updatedCount++;
    } else {
      values[r][outputIdx] = '';
    }
  }

  range.setValues(values);
  console.log(`カード会社振り込みキー更新完了: ${updatedCount}件`);
}

function classifyBankCardSettlementKeysWithGemini_(rows) {
  const GEMINI_MODEL = 'gemini-2.5-flash';
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY が未設定です。');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const prompt = `
あなたは会計システムの入金判定AIです。
銀行データチェック用シートの各行について、「カード会社からの一括入金か」を判定してください。

【入力項目】
- rowId
- date
- otherParty

【カード会社からの一括入金と判定する条件】
- 相手摘要にカード会社名（VISA, JCB, MASTER, AMEX など）が含まれている
- かつ、「〇〇様」のような人名が含まれていない
- かつ、「SB12345」のような業務Noが含まれていない
- 日付は月末または月の中頃（15日前後）である
- ただし、日付条件は強い参考情報だが絶対条件ではなく、総合的に判定すること

【出力ルール】
- isCardSettlement: true / false
- cardType: VISA / JCB / MASTER / AMEX / UNKNOWN
- 一括入金と明確に判断できる場合のみ true
- 人名や業務Noが含まれる場合は false 寄りで判定
- 判断に迷う場合は false
- 各行について必ず1件返す

【出力形式】
JSONのみを返してください。
{
  "results": [
    {
      "rowId": 2,
      "isCardSettlement": true,
      "cardType": "VISA",
      "reason": "カード会社名があり、人名・業務Noがなく、日付も入金サイクルに合致"
    }
  ]
}

【入力データ】
${JSON.stringify(rows, null, 2)}
`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  };

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const text = res.getContentText();
  if (res.getResponseCode() >= 400) {
    throw new Error(`Gemini APIエラー(カード会社振り込み判定): ${text}`);
  }

  const json = JSON.parse(text);
  const outputText =
    json.candidates &&
      json.candidates[0] &&
      json.candidates[0].content &&
      json.candidates[0].content.parts &&
      json.candidates[0].content.parts[0] &&
      json.candidates[0].content.parts[0].text
      ? json.candidates[0].content.parts[0].text
      : '';

  const parsed = parseJsonFromText_(outputText);

  if (!parsed || !Array.isArray(parsed.results)) {
    throw new Error('Geminiの判定結果を解釈できませんでした。');
  }

  return parsed.results.map(item => ({
    rowId: Number(item.rowId),
    isCardSettlement: item.isCardSettlement === true,
    cardType: normalizeCardTypeAi_(item.cardType),
    reason: String(item.reason || '')
  }));
}

function normalizeCardTypeAi_(value) {
  const CARD_TYPE = {
    VISA: 'VISA',
    JCB: 'JCB',
    MASTER: 'MASTER',
    AMEX: 'AMEX'
  };

  const text = String(value || '').trim().toUpperCase();

  if (text === CARD_TYPE.VISA) return CARD_TYPE.VISA;
  if (text === CARD_TYPE.JCB) return CARD_TYPE.JCB;
  if (text === CARD_TYPE.MASTER || text === 'MASTERCARD') return CARD_TYPE.MASTER;
  if (text === CARD_TYPE.AMEX || text === 'AMERICAN EXPRESS') return CARD_TYPE.AMEX;

  return '';
}

function parseJsonFromText_(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Geminiの応答が空です。');

  try {
    return JSON.parse(raw);
  } catch (e) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`JSON解析失敗: ${raw}`);
  }
}

function setCardMatchFormula() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const bankSheet = ss.getSheetByName(SHEET.BANK.NAME);
  const salesSheet = ss.getSheetByName(SHEET.SALES.NAME);

  if (!bankSheet || !salesSheet) {
    console.error('必要なシートが見つかりません。');
    return;
  }

  const bankLastRow = bankSheet.getLastRow();
  const bankLastCol = bankSheet.getLastColumn();
  const salesLastCol = salesSheet.getLastColumn();

  if (bankLastRow < 2) return;

  const bankHeaders = bankSheet.getRange(1, 1, 1, bankLastCol).getValues()[0]
    .map(h => String(h || '').trim());
  const salesHeaders = salesSheet.getRange(1, 1, 1, salesLastCol).getValues()[0]
    .map(h => String(h || '').trim());

  const bankDateIdx = bankHeaders.indexOf(SHEET.BANK.HEADER.DATE);
  const bankKeyIdx = bankHeaders.indexOf(SHEET.BANK.HEADER.CARD_SETTLEMENT_KEY);
  const bankOutputIdx = bankHeaders.indexOf(SHEET.BANK.HEADER.CARD_MATCH_AMOUNT);

  const salesTotalIdx = salesHeaders.indexOf(SHEET.SALES.HEADER.TOTAL);
  const salesKeyIdx = salesHeaders.indexOf(SHEET.SALES.HEADER.METHOD);
  const salesDateIdx = salesHeaders.indexOf(SHEET.SALES.HEADER.DATE);

  if ([bankDateIdx, bankKeyIdx, bankOutputIdx, salesTotalIdx, salesKeyIdx, salesDateIdx].includes(-1)) {
    console.error('必要なヘッダーが見つかりません。');
    return;
  }

  const bankValues = bankSheet.getRange(2, 1, bankLastRow - 1, bankLastCol).getValues();

  const bankDateCol = columnToLetter_(bankDateIdx + 1);
  const bankKeyCol = columnToLetter_(bankKeyIdx + 1);

  const salesTotalCol = columnToLetter_(salesTotalIdx + 1);
  const salesKeyCol = columnToLetter_(salesKeyIdx + 1);
  const salesDateCol = columnToLetter_(salesDateIdx + 1);

  for (let i = 0; i < bankValues.length; i++) {
    const rowIndex = i + 2;
    const key = bankValues[i][bankKeyIdx];

    if (!key) {
      bankSheet.getRange(rowIndex, bankOutputIdx + 1).clearContent();
      continue;
    }

    const formula = `
=IF(
  AND(DAY($${bankDateCol}${rowIndex})>=12,DAY($${bankDateCol}${rowIndex})<=18),
  SUMIFS(
    '${SHEET.SALES.NAME}'!$${salesTotalCol}:$${salesTotalCol},
    '${SHEET.SALES.NAME}'!$${salesKeyCol}:$${salesKeyCol},$${bankKeyCol}${rowIndex},
    '${SHEET.SALES.NAME}'!$${salesDateCol}:$${salesDateCol},">="&DATE(YEAR(EDATE($${bankDateCol}${rowIndex},-1)),MONTH(EDATE($${bankDateCol}${rowIndex},-1)),16),
    '${SHEET.SALES.NAME}'!$${salesDateCol}:$${salesDateCol},"<="&EOMONTH(EDATE($${bankDateCol}${rowIndex},-1),0)
  ),
  IF(
    DAY($${bankDateCol}${rowIndex})>=25,
    SUMIFS(
      '${SHEET.SALES.NAME}'!$${salesTotalCol}:$${salesTotalCol},
      '${SHEET.SALES.NAME}'!$${salesKeyCol}:$${salesKeyCol},$${bankKeyCol}${rowIndex},
      '${SHEET.SALES.NAME}'!$${salesDateCol}:$${salesDateCol},">="&DATE(YEAR($${bankDateCol}${rowIndex}),MONTH($${bankDateCol}${rowIndex}),1),
      '${SHEET.SALES.NAME}'!$${salesDateCol}:$${salesDateCol},"<="&DATE(YEAR($${bankDateCol}${rowIndex}),MONTH($${bankDateCol}${rowIndex}),15)
    ),
    0
  )
)`.trim();

    bankSheet.getRange(rowIndex, bankOutputIdx + 1).setFormula(formula);
  }

  console.log('カード照合額の数式設定完了');
}

function columnToLetter_(column) {
  let temp = '';
  let letter = '';

  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }

  return letter;
}

function updateBankStatusByCardMatchAmount() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const bankSheet = ss.getSheetByName(SHEET.BANK.NAME);

  if (!bankSheet) {
    console.error('銀行データチェック用シートが見つかりません。');
    return;
  }

  const lastRow = bankSheet.getLastRow();
  const lastCol = bankSheet.getLastColumn();
  if (lastRow < 2) return;

  const headers = bankSheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(h => String(h || '').trim());

  const dateIdx = headers.indexOf(SHEET.BANK.HEADER.DATE);
  const amountIdx = headers.indexOf(SHEET.BANK.HEADER.AMOUNT);
  const statusIdx = headers.indexOf(SHEET.BANK.HEADER.STATUS);
  const cardKeyIdx = headers.indexOf(SHEET.BANK.HEADER.CARD_SETTLEMENT_KEY);
  const cardMatchAmountIdx = headers.indexOf(SHEET.BANK.HEADER.CARD_MATCH_AMOUNT);

  if ([dateIdx, amountIdx, statusIdx, cardKeyIdx, cardMatchAmountIdx].includes(-1)) {
    console.error('必要なヘッダーが見つかりません。');
    return;
  }

  const range = bankSheet.getRange(1, 1, lastRow, lastCol);
  const values = range.getValues();

  const statusNoteRange = bankSheet.getRange(1, statusIdx + 1, lastRow, 1);
  const statusNotes = statusNoteRange.getNotes();

  let autoCount = 0;
  let reviewCount = 0;

  for (let r = 1; r < values.length; r++) {
    const cardKey = String(values[r][cardKeyIdx] || '').trim();

    if (!cardKey) {
      continue;
    }

    const amount = toNumber_(values[r][amountIdx]);
    const cardMatchAmount = toNumber_(values[r][cardMatchAmountIdx]);
    const dateValue = values[r][dateIdx];

    // ステータス更新時は既存メモを削除
    statusNotes[r][0] = '';

    if (amount === cardMatchAmount) {
      values[r][statusIdx] = MATCH_STATUS.AUTO;
      autoCount++;
    } else {
      values[r][statusIdx] = MATCH_STATUS.REVIEW;
      statusNotes[r][0] = buildCardReviewNote_(dateValue, cardKey, cardMatchAmount);
      reviewCount++;
    }
  }

  range.setValues(values);
  statusNoteRange.setNotes(statusNotes);

  console.log(`カード照合による更新完了: 自動消込 ${autoCount}件 / 要確認 ${reviewCount}件`);
}

function buildCardReviewNote_(dateValue, cardType, cardMatchAmount) {
  const closingLabel = getCardClosingLabel_(dateValue);

  return [
    `カード種別: ${cardType || ''}`,
    `期間: ${closingLabel}`,
    `照合額: ${formatNumberWithComma_(cardMatchAmount)}`
  ].join('\n');
}

function getCardClosingLabel_(dateValue) {
  const date = parseAnyDate_(dateValue);
  if (!date) return '';

  const day = date.getDate();

  // 中旬入金（12-18日想定） -> 前月 月末〆
  if (day >= 12 && day <= 18) {
    const prevMonth = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    return `${prevMonth.getFullYear()}/${pad2_(prevMonth.getMonth() + 1)} 月末〆`;
  }

  // 月末入金（25日以降想定） -> 当月 15日〆
  if (day >= 25) {
    return `${date.getFullYear()}/${pad2_(date.getMonth() + 1)} 15日〆`;
  }

  return '';
}

function parseAnyDate_(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'number' && value > 30000) {
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }

  const strValue = String(value).trim();

  const rewaMatch = strValue.match(/^R\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/i);
  if (rewaMatch) {
    const year = 2018 + parseInt(rewaMatch[1], 10);
    return new Date(
      year,
      parseInt(rewaMatch[2], 10) - 1,
      parseInt(rewaMatch[3], 10)
    );
  }

  const seirekiMatch = strValue.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (seirekiMatch) {
    return new Date(
      parseInt(seirekiMatch[1], 10),
      parseInt(seirekiMatch[2], 10) - 1,
      parseInt(seirekiMatch[3], 10)
    );
  }

  return null;
}

function toNumber_(value) {
  if (typeof value === 'number') return value;

  const normalized = String(value || '')
    .replace(/,/g, '')
    .trim();

  const num = Number(normalized);
  return isNaN(num) ? 0 : num;
}

function formatNumberWithComma_(value) {
  const num = toNumber_(value);
  return num.toLocaleString('ja-JP');
}

function pad2_(num) {
  return ('0' + num).slice(-2);
}


/** ================================ 一部入金 ================================ */

function exportMatchingTargetJson_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const result = {
    bankAndCash: [
      ...extractSheetAsJson_(ss.getSheetByName(SHEET.BANK.NAME), {
        date: SHEET.BANK.HEADER.DATE,
        name: SHEET.BANK.HEADER.OTHER_PARTY,
        amount: SHEET.BANK.HEADER.AMOUNT,
        status: SHEET.BANK.HEADER.STATUS
      }),
      ...extractSheetAsJson_(ss.getSheetByName(SHEET.CASH.NAME), {
        date: SHEET.CASH.HEADER.DATE,
        name: SHEET.CASH.HEADER.VENDOR,
        amount: SHEET.CASH.HEADER.TOTAL,
        status: SHEET.CASH.HEADER.STATUS
      })
    ],
    sales: extractSheetAsJson_(ss.getSheetByName(SHEET.SALES.NAME), {
      date: SHEET.SALES.HEADER.DATE,
      name: SHEET.SALES.HEADER.CUST_NAME,
      amount: SHEET.SALES.HEADER.TOTAL,
      status: SHEET.SALES.HEADER.STATUS,
      bizNo: SHEET.SALES.HEADER.BIZ_NO,
      custNo: SHEET.SALES.HEADER.CUST_NO
    })
  };

  const jsonText = JSON.stringify(result, null, 2);
  return jsonText;
}

function extractSheetAsJson_(sheet, headerMap) {
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(h => String(h || '').trim());
  const rows = values.slice(1);

  const dateIdx = headers.indexOf(headerMap.date);
  const nameIdx = headers.indexOf(headerMap.name);
  const amountIdx = headers.indexOf(headerMap.amount);
  const statusIdx = headers.indexOf(headerMap.status);

  const bizNoIdx = headerMap.bizNo ? headers.indexOf(headerMap.bizNo) : -1;
  const custNoIdx = headerMap.custNo ? headers.indexOf(headerMap.custNo) : -1;

  if ([dateIdx, nameIdx, amountIdx, statusIdx].includes(-1)) {
    throw new Error(`必要なヘッダーが見つかりません: ${sheet.getName()}`);
  }

  return rows
    .map((row, index) => {
      const item = {
        sourceSheet: sheet.getName(),
        sourceRow: index + 2,
        date: formatJsonDate_(row[dateIdx]),
        name: String(row[nameIdx] || '').trim(),
        amount: toJsonNumber_(row[amountIdx]),
        status: String(row[statusIdx] || '').trim()
      };

      if (bizNoIdx !== -1) {
        item.bizNo = String(row[bizNoIdx] || '').trim();
      }

      if (custNoIdx !== -1) {
        item.custNo = String(row[custNoIdx] || '').trim();
      }

      return item;
    })
    .filter(item => item.status !== MATCH_STATUS.AUTO);
}

function formatJsonDate_(value) {
  if (!value) return '';

  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy/MM/dd');
  }

  return String(value).trim();
}

function toJsonNumber_(value) {
  if (typeof value === 'number') return value;

  const normalized = String(value || '')
    .replace(/,/g, '')
    .trim();

  const num = Number(normalized);
  return isNaN(num) ? 0 : num;
}

function markMatchedBankAndCashWithSalesByGemini() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const jsonText = exportMatchingTargetJson_();
  const data = JSON.parse(jsonText);

  const bankAndCash = data.bankAndCash || [];
  const sales = data.sales || [];

  if (bankAndCash.length === 0 || sales.length === 0) {
    console.log('照合対象データがありません。');
    return [];
  }

  const aiResult = matchNamesWithGemini_(bankAndCash, sales);

  if (!aiResult || !Array.isArray(aiResult.matches)) {
    throw new Error('Geminiの照合結果を解釈できませんでした。');
  }

  const matchedLogs = [];
  const groupedUpdates = {};

  aiResult.matches.forEach(match => {
    const bank = bankAndCash[Number(match.bankIndex)];
    const sale = sales[Number(match.salesIndex)];

    if (!bank || !sale) return;

    const diffDays = calcDateDiffDays_(bank.date, sale.date);
    if (diffDays === null || diffDays > 5) return;

    const reason = String(match.reason || '');

    matchedLogs.push({
      bankAndCash: bank,
      sales: sale,
      diffDays,
      reason
    });

    // bankAndCash 側
    queueStatusUpdate_(groupedUpdates, bank.sourceSheet, bank.sourceRow, reason, {
      bizNo: sale.bizNo || '',
      custNo: sale.custNo || ''
    });

    // sales 側
    queueStatusUpdate_(groupedUpdates, sale.sourceSheet, sale.sourceRow, reason);
  });

  applyQueuedStatusUpdates_(ss, groupedUpdates);

  console.log(JSON.stringify(matchedLogs, null, 2));
  return matchedLogs;
}

function matchNamesWithGemini_(bankAndCash, sales) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY が未設定です。');

  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const bankPayload = bankAndCash.map((item, index) => ({
    index,
    date: item.date,
    name: item.name,
    amount: item.amount,
    status: item.status
  }));

  const salesPayload = sales.map((item, index) => ({
    index,
    date: item.date,
    name: item.name,
    amount: item.amount,
    status: item.status
  }));

  const prompt = `
あなたは会計データの名寄せAIです。
bankAndCash と sales の名前を比較し、同一人物・同一企業・同一取引先と思われる組み合わせを抽出してください。

【重要ルール】
- 主に name を見て同一性を判定してください
- 株式会社/(株)/有限会社/合同会社、空白、記号、全角半角差、表記ゆれは吸収してください
- 明らかに別名なら一致させないでください
- amount は参考情報として見てよいですが、必須条件ではありません
- date は参考情報として見てよいですが、必須条件ではありません
- 1つの bankAndCash に対して、同一と思われる sales がある場合のみ返してください
- 自信が低いものは返さないでください

【出力形式】
JSONのみを返してください。
{
  "matches": [
    {
      "bankIndex": 0,
      "salesIndex": 3,
      "reason": "会社名の表記ゆれを除くと同一と判断できる"
    }
  ]
}

【bankAndCash】
${JSON.stringify(bankPayload, null, 2)}

【sales】
${JSON.stringify(salesPayload, null, 2)}
`;

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const text = response.getContentText();
  if (response.getResponseCode() >= 400) {
    throw new Error(`Gemini APIエラー: ${text}`);
  }

  const json = JSON.parse(text);
  const outputText =
    json.candidates &&
      json.candidates[0] &&
      json.candidates[0].content &&
      json.candidates[0].content.parts &&
      json.candidates[0].content.parts[0] &&
      json.candidates[0].content.parts[0].text
      ? json.candidates[0].content.parts[0].text
      : '';

  return parseJsonFromText_(outputText);
}

function calcDateDiffDays_(date1, date2) {
  const d1 = parseJsonLikeDate_(date1);
  const d2 = parseJsonLikeDate_(date2);

  if (!d1 || !d2) return null;

  const t1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate()).getTime();
  const t2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate()).getTime();

  return Math.abs((t1 - t2) / (1000 * 60 * 60 * 24));
}

function parseJsonLikeDate_(value) {
  if (!value) return null;

  if (value instanceof Date) return value;

  const str = String(value).trim();

  const seirekiMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (seirekiMatch) {
    return new Date(
      parseInt(seirekiMatch[1], 10),
      parseInt(seirekiMatch[2], 10) - 1,
      parseInt(seirekiMatch[3], 10)
    );
  }

  const reiwaMatch = str.match(/^R\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/i);
  if (reiwaMatch) {
    return new Date(
      2018 + parseInt(reiwaMatch[1], 10),
      parseInt(reiwaMatch[2], 10) - 1,
      parseInt(reiwaMatch[3], 10)
    );
  }

  return null;
}

function parseJsonFromText_(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Geminiの応答が空です。');

  try {
    return JSON.parse(raw);
  } catch (e) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`JSON解析失敗: ${raw}`);
  }
}

function queueStatusUpdate_(groupedUpdates, sheetName, rowNumber, reason, extraInfo) {
  const key = `${sheetName}__${rowNumber}`;

  if (!groupedUpdates[key]) {
    groupedUpdates[key] = {
      sheetName,
      rowNumber,
      reasons: [],
      extraInfo: []
    };
  }

  if (reason) {
    groupedUpdates[key].reasons.push(reason);
  }

  if (extraInfo) {
    groupedUpdates[key].extraInfo.push(extraInfo);
  }
}

function applyQueuedStatusUpdates_(ss, groupedUpdates) {
  const updates = Object.values(groupedUpdates);
  if (updates.length === 0) return;

  const sheetCache = {};

  updates.forEach(update => {
    const sheet = sheetCache[update.sheetName] || ss.getSheetByName(update.sheetName);
    if (!sheet) return;
    sheetCache[update.sheetName] = sheet;

    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
      .map(h => String(h || '').trim());

    const statusIdx = headers.indexOf('ステータス');
    if (statusIdx === -1) {
      throw new Error(`ステータス列が見つかりません: ${update.sheetName}`);
    }

    const statusCell = sheet.getRange(update.rowNumber, statusIdx + 1);

    statusCell.setValue(MATCH_STATUS.REVIEW);

    const uniqueReasons = [...new Set(update.reasons.filter(Boolean))];
    const noteLines = [];

    if (uniqueReasons.length > 0) {
      noteLines.push(`AI判定理由: ${uniqueReasons.join(' / ')}`);
    }

    // bankAndCash 側だけ業務No・顧客Noを追加したい
    const validExtraInfo = update.extraInfo.filter(Boolean);
    if (validExtraInfo.length > 0) {
      const bizNos = [...new Set(validExtraInfo.map(x => x.bizNo).filter(Boolean))];
      const custNos = [...new Set(validExtraInfo.map(x => x.custNo).filter(Boolean))];

      if (bizNos.length > 0) {
        noteLines.push(`業務No: ${bizNos.join(', ')}`);
      }
      if (custNos.length > 0) {
        noteLines.push(`顧客No: ${custNos.join(', ')}`);
      }
    }

    statusCell.setNote(noteLines.join('\n'));
  });
}
