/**
 * =========================================================
 * キャッシュフロー統合GAS【完全差し替え版 v5】
 * - 小計列(D/M/T)に書かない
 * - カテゴリ枠が満杯なら継続行を自動追加
 * - 継続行には日付・書式・数式・行高を引き継ぐ
 * - 近傍日(+/-1日)の手入力重複を検知して自動取込を抑止
 * - 近傍重複の監査シートを出力
 * - AI読み取り学習用シートの補正を相手摘要/取引先に反映
 * - 自動書き込みセルにメタ情報ノートを付与
 * =========================================================
 */

const CASHFLOW = {
  TIMEZONE: 'Asia/Tokyo',
  TARGET_SPREADSHEET_ID: '1KrtufPs4-1ZsEGPp9j9PCpYpg0knXGW5jMqospmI7UU',

  ACTUAL_SOURCE: {
    SPREADSHEET_ID: '1wX6LR1ssqThgPAIHRyUNeuvROsnXqDMcwFbMCj1PB8M',
    SHEET_NAME: '銀行データチェック用',
    LEARNING_SHEET_NAME: 'AI読み取り学習用',
    RECONCILE_MASTER_SHEET_NAME: '照合学習マスタ'
  },

  RECEIVABLE_SOURCE: {
    SPREADSHEET_ID: '1wX6LR1ssqThgPAIHRyUNeuvROsnXqDMcwFbMCj1PB8M',
    SHEET_NAME: '売掛入金見込み管理'
  },

  PAYMENT_SOURCE: {
    SPREADSHEET_ID: '12Z7hFDO9f8JMTdVYqNCx_1QbgjXmoAqWYJDiUkakuHE',
    SHEET_NAME: '支払い一覧',
    LEARNING_SHEET_NAME: 'AI補正学習'
  },

  TERMS: [
    {
      key: '17',
      start: '2025/06/01',
      end: '2026/05/31',
      incomeSheet: '入金明細【17期】',
      expenseSheet: '出金明細【17期】'
    },
    {
      key: '18',
      start: '2026/06/01',
      end: '2027/05/31',
      incomeSheet: '入金明細【18期】',
      expenseSheet: '出金明細【18期】'
    }
  ],

  SHEETS: {
    CONFIG: 'カテゴリ判定設定',
    RECURRING: '定期予定設定',
    LOG: '修正ログ',
    AUDIT: '近傍重複監査'
  },

  COLORS: {
    ACTUAL_AUTO: '#f6b26b',
    PLANNED_AUTO: '#d9ead3',
    MANUAL_FORECAST: ['#ffff00', '#ff9900', '#ffd966']
  },

  DUPLICATE: {
    NEARBY_DAY_WINDOW: 1
  },

  SLOT_MAP: {
    expense: {
      '金融機関関連': [
        { label: 'E', amount: 'F' },
        { label: 'G', amount: 'H' },
        { label: 'I', amount: 'J' },
        { label: 'K', amount: 'L' }
      ],
      '買掛関連': [
        { label: 'N', amount: 'O' },
        { label: 'P', amount: 'Q' },
        { label: 'R', amount: 'S' },
        { label: 'T', amount: 'U' },
        { label: 'V', amount: 'W' },
        { label: 'X', amount: 'Y' },
        { label: 'Z', amount: 'AA' }
      ],
      '経費関連': [
        { label: 'AE', amount: 'AF' },
        { label: 'AG', amount: 'AH' },
        { label: 'AI', amount: 'AJ' },
        { label: 'AK', amount: 'AL' },
        { label: 'AM', amount: 'AN' },
        { label: 'AO', amount: 'AP' },
        { label: 'AQ', amount: 'AR' },
        { label: 'AS', amount: 'AT' }
      ]
    },
    income: {
      '金融機関関連': [
        { label: 'E', amount: 'F' },
        { label: 'G', amount: 'H' },
        { label: 'I', amount: 'J' },
        { label: 'K', amount: 'L' }
      ],
      '保険関連': [
        { label: 'N', amount: 'O' },
        { label: 'P', amount: 'Q' },
        { label: 'R', amount: 'S' }
      ],
      'お客様関連': [
        { label: 'U', amount: 'V' },
        { label: 'W', amount: 'X' },
        { label: 'Y', amount: 'Z' },
        { label: 'AA', amount: 'AB' },
        { label: 'AC', amount: 'AD' },
        { label: 'AE', amount: 'AF' },
        { label: 'AG', amount: 'AH' },
        { label: 'AI', amount: 'AJ' },
        { label: 'AK', amount: 'AL' },
        { label: 'AM', amount: 'AN' },
        { label: 'AO', amount: 'AP' },
        { label: 'AQ', amount: 'AR' },
        { label: 'AS', amount: 'AT' },
        { label: 'AU', amount: 'AV' },
        { label: 'AW', amount: 'AX' }
      ]
    }
  }
};

function getCashflowTargetSpreadsheet_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active && active.getId && active.getId() === CASHFLOW.TARGET_SPREADSHEET_ID) {
    return active;
  }
  return SpreadsheetApp.openById(CASHFLOW.TARGET_SPREADSHEET_ID);
}

function onOpenCashflowLegacy_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active || active.getId() !== CASHFLOW.TARGET_SPREADSHEET_ID) {
    return;
  }
  SpreadsheetApp.getUi()
    .createMenu('キャッシュフロー')
    .addItem('1. 初期セットアップを実行', 'setupCashflowSystem')
    .addItem('2. 旧データを削除', 'clearAllSyncData')
    .addItem('3. 手書き重複を消し込み', 'clearDuplicateWithManual')
    .addItem('4. 近傍重複を監査', 'auditNearbyDuplicates')
    .addItem('4.1 旧表から17期4月復旧', 'repairAprilSeventeenthTermFromLegacy')
    .addSeparator()
    .addItem('予定反映（支払い一覧から）', 'syncPlannedExpenseFromPaymentList')
    .addItem('予定反映（売掛見込みから）', 'syncPlannedIncomeFromReceivableForecast')
    .addItem('実績反映（銀行データから）', 'syncActualWithAI')
    .addItem('実績で見込み消し込み', 'reconcileForecastWithBankActuals')
    .addItem('定期予定を同期', 'syncRecurringEntries')
    .addToUi();
}

function reconcileForecastWithBankActuals() {
  syncActualWithAI();
}

function repairAprilSeventeenthTermFromLegacy() {
  const LEGACY_SPREADSHEET_ID = '1Zpu3T3Zkml3uZIa66NZ9foXpty99Fe9scPkeJqYraY8';
  const ss = getCashflowTargetSpreadsheet_();
  const legacySs = SpreadsheetApp.openById(LEGACY_SPREADSHEET_ID);

  const targetIncomeSheet = ss.getSheetByName('入金明細【17期】');
  const targetExpenseSheet = ss.getSheetByName('出金明細【17期】');
  const legacyIncomeSheet = legacySs.getSheetByName('入金明細【17期】');
  const legacyExpenseSheet = legacySs.getSheetByName('出金明細【17期】');

  if (!targetIncomeSheet || !targetExpenseSheet || !legacyIncomeSheet || !legacyExpenseSheet) {
    throw new Error('復旧に必要なシートが見つかりません。');
  }

  [358, 357, 356, 355, 347, 335, 334].forEach(function (rowIndex) {
    if (rowIndex <= targetExpenseSheet.getLastRow()) {
      targetExpenseSheet.deleteRow(rowIndex);
    }
  });

  copyRangeAcrossSpreadsheets_(
    legacyIncomeSheet.getRange('N332:BP349'),
    targetIncomeSheet.getRange('N331:BP348')
  );

  copyRangeAcrossSpreadsheets_(
    legacyExpenseSheet.getRange('N343:CB363'),
    targetExpenseSheet.getRange('N331:CB351')
  );

  SpreadsheetApp.getUi().alert('旧表から17期4月ブロックを復旧しました。');
}

function copyRangeAcrossSpreadsheets_(sourceRange, targetRange) {
  const sourceValues = sourceRange.getValues();
  const sourceFormulas = sourceRange.getFormulasR1C1();
  const sourceBackgrounds = sourceRange.getBackgrounds();
  const sourceFontColors = sourceRange.getFontColors();
  const sourceFontFamilies = sourceRange.getFontFamilies();
  const sourceFontSizes = sourceRange.getFontSizes();
  const sourceFontWeights = sourceRange.getFontWeights();
  const sourceNumberFormats = sourceRange.getNumberFormats();
  const sourceHorizontalAlignments = sourceRange.getHorizontalAlignments();
  const sourceVerticalAlignments = sourceRange.getVerticalAlignments();
  const sourceWrapStrategies = sourceRange.getWrapStrategies();
  const sourceNotes = sourceRange.getNotes();

  targetRange.clearContent().clearNote();
  targetRange.setValues(sourceValues);
  targetRange.setBackgrounds(sourceBackgrounds);
  targetRange.setFontColors(sourceFontColors);
  targetRange.setFontFamilies(sourceFontFamilies);
  targetRange.setFontSizes(sourceFontSizes);
  targetRange.setFontWeights(sourceFontWeights);
  targetRange.setNumberFormats(sourceNumberFormats);
  targetRange.setHorizontalAlignments(sourceHorizontalAlignments);
  targetRange.setVerticalAlignments(sourceVerticalAlignments);
  targetRange.setWrapStrategies(sourceWrapStrategies);
  targetRange.setNotes(sourceNotes);

  for (let rowIndex = 0; rowIndex < sourceFormulas.length; rowIndex++) {
    for (let colIndex = 0; colIndex < sourceFormulas[rowIndex].length; colIndex++) {
      const formula = sourceFormulas[rowIndex][colIndex];
      if (!formula) continue;
      targetRange.getCell(rowIndex + 1, colIndex + 1).setFormulaR1C1(formula);
    }
  }
}

function syncPlannedExpenseFromPaymentList(options) {
  options = options || {};
  const silent = options.silent === true;
  const ss = getCashflowTargetSpreadsheet_();
  const rules = loadCategoryRules_(ss);
  const plannedRecords = fetchPaymentListData_();
  if (plannedRecords.length === 0) {
    if (!silent) {
      SpreadsheetApp.getUi().alert('支払い一覧から新しい予定データが見つかりませんでした。');
    }
    return 0;
  }

  let count = 0;
  plannedRecords.forEach(record => {
    const aiResult = resolveCategoryByAI_(record.rawName + ' ' + (record.summary || ''), 'expense', rules);
    record.category = aiResult.category;
    record.confidence = aiResult.confidence;
    record.sourceType = 'planned_auto';

    const term = findTermByDate_(record.date);
    if (!term) return;
    const targetSheet = ss.getSheetByName(term.expenseSheet);
    if (!targetSheet) return;

    const dKey = formatDateKey_(record.date);
    const baseRow = findRowByDateKey_(targetSheet, dKey);
    if (baseRow <= 0) return;

    if (writeRecordWithOverflow_(targetSheet, baseRow, dKey, record, CASHFLOW.COLORS.PLANNED_AUTO)) {
      count++;
    }
  });

  if (!silent) {
    SpreadsheetApp.getUi().alert('同期完了\n支払い一覧から ' + count + ' 件の予定を反映しました。');
  }
  return count;
}

function syncPlannedIncomeFromReceivableForecast(options) {
  options = options || {};
  const silent = options.silent === true;
  const ss = getCashflowTargetSpreadsheet_();
  const plannedRecords = fetchReceivableForecastData_();
  if (plannedRecords.length === 0) {
    if (!silent) {
      SpreadsheetApp.getUi().alert('売掛入金見込み管理から新しい予定データが見つかりませんでした。');
    }
    return 0;
  }

  const sheetCache = {};
  const valuesCache = {};
  const bColCache = {};
  const bgsCache = {};
  const validForecastKeys = new Set(plannedRecords.map(record => record.forecastKey).filter(Boolean));
  const neededSheets = new Set();

  plannedRecords.forEach(record => {
    const term = findTermByDate_(record.date);
    if (term) neededSheets.add(term.incomeSheet);
  });

  neededSheets.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    sheetCache[name] = sheet;
    refreshSheetCaches_(sheet, valuesCache, bColCache, bgsCache);
  });

  clearStaleReceivableForecasts_(ss, validForecastKeys);
  neededSheets.forEach(name => {
    const sheet = sheetCache[name];
    if (!sheet) return;
    refreshSheetCaches_(sheet, valuesCache, bColCache, bgsCache);
  });

  let count = 0;
  plannedRecords.forEach(record => {
    const term = findTermByDate_(record.date);
    if (!term) return;

    const targetSheet = sheetCache[term.incomeSheet];
    if (!targetSheet) return;

    const dKey = formatDateKey_(record.date);
    const baseRow = findRowByDateKey_(targetSheet, dKey, bColCache[term.incomeSheet]);
    if (baseRow <= 0) {
      appendLog_('SKIP_NO_DATE', targetSheet.getName(), 0, dKey, record.category, record.rawName, record.amount, '', '日付行が見つかりません');
      return;
    }

    if (upsertForecastRecordByKey_(
      targetSheet,
      baseRow,
      dKey,
      record,
      CASHFLOW.COLORS.PLANNED_AUTO,
      valuesCache[term.incomeSheet],
      bColCache[term.incomeSheet]
    )) {
      count++;
      refreshSheetCaches_(targetSheet, valuesCache, bColCache, bgsCache);
      return;
    }

    if (writeRecordWithOverflow_(
      targetSheet,
      baseRow,
      dKey,
      record,
      CASHFLOW.COLORS.PLANNED_AUTO,
      valuesCache[term.incomeSheet],
      bColCache[term.incomeSheet],
      bgsCache[term.incomeSheet]
    )) {
      count++;
      refreshSheetCaches_(targetSheet, valuesCache, bColCache, bgsCache);
    }
  });

  if (!silent) {
    SpreadsheetApp.getUi().alert('同期完了\n売掛見込みから ' + count + ' 件の予定を反映しました。');
  }
  return count;
}

function fetchPaymentListData_() {
  try {
    const sourceSs = SpreadsheetApp.openById(CASHFLOW.PAYMENT_SOURCE.SPREADSHEET_ID);
    const sheet = sourceSs.getSheetByName(CASHFLOW.PAYMENT_SOURCE.SHEET_NAME);
    if (!sheet) return [];

    const values = sheet.getDataRange().getValues();
    if (!values.length) return [];

    const headerRowIndex = values.findIndex(row => row.indexOf('取引先') >= 0);
    if (headerRowIndex < 0) return [];

    const header = values[headerRowIndex];
    const nameIdx = header.indexOf('取引先');
    const summaryIdx = header.indexOf('勘定科目');

    const monthCols = [];
    header.forEach((cell, index) => {
      if (/^20\d{2}\/\d{2}$/.test(String(cell || ''))) {
        monthCols.push({ index, ym: String(cell) });
      }
    });

    const records = [];
    for (let i = headerRowIndex + 1; i < values.length; i++) {
      const row = values[i];
      const rawName = String(row[nameIdx] || '').trim();
      const summary = String(row[summaryIdx] || '').trim();
      if (!rawName) continue;

      monthCols.forEach(monthCol => {
        const amount = Number(row[monthCol.index] || 0);
        if (amount <= 0) return;
        const parts = monthCol.ym.split('/').map(Number);
        const date = new Date(parts[0], parts[1], 0);
        records.push({
          date,
          amount,
          direction: 'expense',
          rawName,
          summary
        });
      });
    }
    return records;
  } catch (error) {
    Logger.log('支払い一覧取得エラー: ' + error);
    return [];
  }
}

function fetchReceivableForecastData_() {
  try {
    const sheet = SpreadsheetApp
      .openById(CASHFLOW.RECEIVABLE_SOURCE.SPREADSHEET_ID)
      .getSheetByName(CASHFLOW.RECEIVABLE_SOURCE.SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) return [];

    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();
    const records = [];

    values.forEach(row => {
      const salesMonth = row[0];
      const dueDate = row[1];
      const conquestLabel = String(row[2] || '').trim();
      const conquestAmount = Number(row[3] || 0);
      const arLabel = String(row[4] || '').trim();
      const arAmount = Number(row[5] || 0);
      if (!dueDate) return;

      const monthKey = salesMonth
        ? Utilities.formatDate(new Date(salesMonth), getSpreadsheetTimezone_(), 'yyyyMM')
        : Utilities.formatDate(new Date(dueDate), getSpreadsheetTimezone_(), 'yyyyMM');

      if (conquestLabel && conquestAmount > 0) {
        const conquestKey = 'receivable:conquest:' + monthKey + ':' + normalizeCompareName_(conquestLabel);
        records.push({
          date: dueDate,
          amount: conquestAmount,
          direction: 'income',
          category: 'お客様関連',
          rawName: conquestLabel,
          sourceType: 'planned_auto',
          forecastKey: conquestKey
        });
      }

      if (arLabel && arAmount > 0) {
        const arKey = 'receivable:ar:' + monthKey + ':' + normalizeCompareName_(arLabel);
        records.push({
          date: dueDate,
          amount: arAmount,
          direction: 'income',
          category: 'お客様関連',
          rawName: arLabel,
          sourceType: 'planned_auto',
          forecastKey: arKey
        });
      }
    });

    return records;
  } catch (error) {
    Logger.log('売掛入金見込み管理 読み込みエラー: ' + error);
    return [];
  }
}

function syncActualWithAI(options) {
  options = options || {};
  const silent = options.silent === true;
  const ss = getCashflowTargetSpreadsheet_();
  const rules = loadCategoryRules_(ss);
  const learningMap = loadBankLearningMap_();
  const bankData = fetchBankData_(learningMap);
  let count = 0;

  const sheetCache = {};
  const valuesCache = {};
  const bColCache = {};
  const bgsCache = {};

  const neededSheets = new Set();
  bankData.forEach(record => {
    const term = findTermByDate_(record.date);
    if (!term) return;
    neededSheets.add(record.direction === 'income' ? term.incomeSheet : term.expenseSheet);
  });

  neededSheets.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    sheetCache[name] = sheet;
    refreshSheetCaches_(sheet, valuesCache, bColCache, bgsCache);
  });

  bankData.forEach(record => {
    const aiResult = resolveCategoryByAI_(record.rawName, record.direction, rules);
    record.category = aiResult.category;
    record.confidence = aiResult.confidence;
    record.sourceType = 'actual_auto';

    const term = findTermByDate_(record.date);
    if (!term) return;

    const sheetName = record.direction === 'income' ? term.incomeSheet : term.expenseSheet;
    const targetSheet = sheetCache[sheetName];
    if (!targetSheet) return;

    const dKey = formatDateKey_(record.date);
    const baseRow = findRowByDateKey_(targetSheet, dKey, bColCache[sheetName]);
    if (baseRow <= 0) {
      appendLog_('SKIP_NO_DATE', sheetName, 0, dKey, '', record.rawName, record.amount, '', '日付行が見つかりません');
      return;
    }

    const reconciled = reconcileActualAgainstForecast_(
      targetSheet,
      baseRow,
      dKey,
      record,
      CASHFLOW.COLORS.ACTUAL_AUTO,
      valuesCache[sheetName],
      bColCache[sheetName],
      bgsCache[sheetName]
    );
    if (reconciled) {
      count++;
      refreshSheetCaches_(targetSheet, valuesCache, bColCache, bgsCache);
      return;
    }

    if (writeRecordWithOverflow_(
      targetSheet,
      baseRow,
      dKey,
      record,
      CASHFLOW.COLORS.ACTUAL_AUTO,
      valuesCache[sheetName],
      bColCache[sheetName],
      bgsCache[sheetName]
    )) {
      count++;
      refreshSheetCaches_(targetSheet, valuesCache, bColCache, bgsCache);
    }
  });

  if (!silent) {
    SpreadsheetApp.getUi().alert(
      '同期完了\n実績 ' + count + ' 件を反映しました。\n見込みセルのオレンジ消し込みも含みます。\n必要なら「4. 近傍重複を監査」を実行してください。'
    );
  }
  return count;
}

function reconcileActualAgainstForecast_(sheet, baseRow, dKey, record, bgColor, cachedValues, cachedBCol, cachedBgs) {
  if (record.sourceType !== 'actual_auto') return false;

  const candidate = findForecastMatchOnSheet_(sheet, baseRow, dKey, record, cachedValues, cachedBCol, cachedBgs);
  if (!candidate) return false;

  overwriteSlotWithRecord_(sheet, candidate.row, candidate.slot, record, bgColor, {
    previousLabel: candidate.name,
    previousAmount: candidate.amount
  });
  appendLog_(
    'ACTUAL_RECONCILE',
    sheet.getName(),
    candidate.row,
    candidate.dateKey,
    candidate.category,
    record.rawName,
    record.amount,
    candidate.slot.label,
    '既存見込みを銀行実績で消し込み'
  );
  return true;
}

function fetchBankData_(learningMap) {
  try {
    const sheet = SpreadsheetApp
      .openById(CASHFLOW.ACTUAL_SOURCE.SPREADSHEET_ID)
      .getSheetByName(CASHFLOW.ACTUAL_SOURCE.SHEET_NAME);
    if (!sheet) return [];

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return [];

    const header = values[0].map(value => String(value || '').trim());
    const dateIdx = findHeaderIndexByAliases_(header, ['日付']);
    const amountIdx = findHeaderIndexByAliases_(header, ['金額']);
    const displayIdx = findHeaderIndexByAliases_(header, ['表示摘要']);
    const nameIdx = findHeaderIndexByAliases_(header, ['取引先']);
    const summaryIdx = findHeaderIndexByAliases_(header, ['相手摘要']);
    const selfSummaryIdx = findHeaderIndexByAliases_(header, ['自摘要']);
    const counterAccountIdx = findHeaderIndexByAliases_(header, ['相手科目']);
    const statusIdx = findHeaderIndexByAliases_(header, ['ステータス']);
    const voucherTypeIdx = findHeaderIndexByAliases_(header, ['伝票種']);
    const numberIdx = findHeaderIndexByAliases_(header, ['番号']);

    if ([dateIdx, amountIdx, statusIdx].some(index => index < 0)) return [];
    if ([displayIdx, nameIdx, summaryIdx, selfSummaryIdx].every(index => index < 0)) return [];

    const bestByKey = {};
    values.slice(1).forEach(function (row) {
      if (/(除外|不要|済)/.test(String(row[statusIdx] || ''))) return null;
      const amount = Number(row[amountIdx] || 0);
      if (!amount) return null;

      const sourceText = String(
        (displayIdx >= 0 ? row[displayIdx] : '') ||
        (selfSummaryIdx >= 0 ? row[selfSummaryIdx] : '') ||
        (summaryIdx >= 0 ? row[summaryIdx] : '') ||
        (nameIdx >= 0 ? row[nameIdx] : '') ||
        '不明'
      ).trim();
      const counterAccount = counterAccountIdx >= 0 ? String(row[counterAccountIdx] || '').trim() : '';
      const voucherType = voucherTypeIdx >= 0 ? String(row[voucherTypeIdx] || '').trim() : '';
      const number = numberIdx >= 0 ? String(row[numberIdx] || '').trim() : '';
      if (isCashflowExcludedBankRecord_(sourceText, counterAccount, voucherType)) return null;

      const corrected = applyLearnedNameCorrection_(sourceText, learningMap);
      const direction = resolveBankRecordDirection_(amount, voucherType);
      if (!direction) return null;

      const record = {
        date: row[dateIdx],
        amount: Math.abs(amount),
        direction: direction,
        rawName: corrected || sourceText,
        originalRawName: sourceText,
        counterAccount: counterAccount,
        transactionNo: number
      };

      const dedupKey = buildCashflowActualDedupKey_(record);
      if (!dedupKey) return null;

      if (!bestByKey[dedupKey] || scoreBankActualRecord_(record) > scoreBankActualRecord_(bestByKey[dedupKey])) {
        bestByKey[dedupKey] = record;
      }
      return null;
    });

    return Object.keys(bestByKey)
      .map(function (key) { return bestByKey[key]; })
      .sort(function (a, b) {
        const left = new Date(a.date).getTime();
        const right = new Date(b.date).getTime();
        return left - right || a.amount - b.amount || String(a.rawName || '').localeCompare(String(b.rawName || ''));
      });
  } catch (error) {
    Logger.log('銀行データ取得エラー: ' + error);
    return [];
  }
}

function isCashflowExcludedBankRecord_(sourceText, counterAccount, voucherType) {
  const joined = [sourceText, counterAccount, voucherType].join(' ');
  if (!joined.trim()) return true;
  if (/資金移動/.test(joined)) return true;
  if (/前頁残高|繰越残高|前日繰越|当座預金|普通預金/.test(joined)) return true;
  return false;
}

function buildCashflowActualDedupKey_(record) {
  const dateKey = formatDateForActualDedup_(record.date);
  const amount = Number(record.amount || 0);
  const direction = String(record.direction || '').trim();
  if (!dateKey || !amount || !direction) return '';

  const transactionNo = normalizeCompareName_(record.transactionNo || '');
  if (transactionNo) {
    return [dateKey, direction, amount, transactionNo].join('|');
  }

  return [
    dateKey,
    direction,
    amount,
    normalizeCompareName_(record.rawName || ''),
    normalizeCompareName_(record.counterAccount || '')
  ].join('|');
}

function scoreBankActualRecord_(record) {
  const rawName = String(record.rawName || '');
  const originalRawName = String(record.originalRawName || '');
  let score = 0;
  if (record.transactionNo) score += 80;
  if (rawName) score += Math.min(rawName.length, 60);
  score += Math.min(originalRawName.length, 30);
  score -= countReplacementChar_(rawName) * 100;
  score -= countReplacementChar_(originalRawName) * 50;
  return score;
}

function countReplacementChar_(text) {
  const value = String(text || '');
  const match = value.match(/�/g);
  return match ? match.length : 0;
}

function formatDateForActualDedup_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';
  return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd');
}

function findHeaderIndexByAliases_(headerRow, aliases) {
  for (let i = 0; i < aliases.length; i++) {
    const index = headerRow.indexOf(String(aliases[i] || '').trim());
    if (index >= 0) return index;
  }
  return -1;
}

function resolveBankRecordDirection_(amount, voucherType) {
  const type = String(voucherType || '').trim();
  if (type === '入金') return 'income';
  if (type === '出金') return 'expense';
  if (amount > 0) return 'income';
  if (amount < 0) return 'expense';
  return '';
}

function writeRecordWithOverflow_(sheet, baseRow, dKey, record, bgColor, cachedValues, cachedBCol, cachedBgs) {
  const slots = CASHFLOW.SLOT_MAP?.[record.direction]?.[record.category];
  if (!slots || !slots.length) {
    appendLog_('SKIP_NO_SLOT', sheet.getName(), baseRow, dKey, record.category, record.rawName, record.amount, '', 'スロット定義なし');
    return false;
  }

  const block = findDateBlock_(sheet, baseRow, dKey, cachedBCol);
  const exactMatch = findMatchingRecordInBlock_(sheet, block.startRow, block.endRow, record, cachedValues, cachedBgs);
  if (exactMatch) {
    if (record.sourceType === 'actual_auto' && exactMatch.origin !== 'actual_auto') {
      overwriteSlotWithRecord_(sheet, exactMatch.row, exactMatch.slot, record, bgColor, { previousLabel: exactMatch.name });
      appendLog_('ACTUAL_CONVERT', sheet.getName(), exactMatch.row, dKey, record.category, record.rawName, record.amount, exactMatch.slot.label, '同日既存見込みを実績へ変換');
      return true;
    }
    appendLog_('SKIP_DUP', sheet.getName(), baseRow, dKey, record.category, record.rawName, record.amount, '', '同日重複のためスキップ');
    return false;
  }

  if (record.sourceType === 'actual_auto') {
    const convertible = findConvertibleForecastInBlock_(sheet, block.startRow, block.endRow, record, cachedValues, cachedBgs);
    if (convertible) {
      overwriteSlotWithRecord_(sheet, convertible.row, convertible.slot, record, bgColor, { previousLabel: convertible.name });
      appendLog_('ACTUAL_CONVERT', sheet.getName(), convertible.row, dKey, record.category, record.rawName, record.amount, convertible.slot.label, '同日手入力見込みを実績へ変換');
      return true;
    }
  }

  const nearby = findNearbyDuplicateOnSheet_(sheet, record, {
    cachedValues,
    cachedBCol,
    cachedBgs,
    excludeStartRow: block.startRow,
    excludeEndRow: block.endRow
  });
  if (shouldSkipForNearbyDuplicate_(record, nearby)) {
    appendLog_(
      'SKIP_NEAR_DUP',
      sheet.getName(),
      nearby.row,
      nearby.dateKey,
      record.category,
      record.rawName,
      record.amount,
      nearby.col,
      '近傍日重複のためスキップ（既存:' + nearby.origin + '）'
    );
    return false;
  }

  if (record.sourceType !== 'actual_auto' && manualAmountExistsInBlock_(sheet, block.startRow, block.endRow, record, cachedValues, cachedBgs)) {
    appendLog_('SKIP_MANUAL_DUP', sheet.getName(), baseRow, dKey, record.category, record.rawName, record.amount, '', '同日同額の手書きがあるためスキップ');
    return false;
  }

  for (let row = block.startRow; row <= block.endRow; row++) {
    const result = tryWriteToCategorySection_(sheet, row, record, bgColor);
    if (result.status === 'written') {
      appendLog_('AUTO_WRITE', sheet.getName(), row, dKey, record.category, record.rawName, record.amount, result.col, '');
      return true;
    }
  }

  appendLog_('OVERFLOW', sheet.getName(), block.endRow, dKey, record.category, record.rawName, record.amount, '', '継続行を追加');
  const newRow = insertContinuationRow_(sheet, block.endRow, block.startRow, dKey, record.direction);
  const result = tryWriteToCategorySection_(sheet, newRow, record, bgColor);
  if (result.status === 'written') {
    appendLog_('AUTO_WRITE', sheet.getName(), newRow, dKey, record.category, record.rawName, record.amount, result.col, '継続行に書き込み');
    return true;
  }
  return false;
}

function tryWriteToCategorySection_(sheet, rowIndex, record, bgColor) {
  const slots = CASHFLOW.SLOT_MAP?.[record.direction]?.[record.category];
  if (!slots || !slots.length) return { status: 'no_slot', col: '' };

  for (const slot of slots) {
    const nameCell = sheet.getRange(slot.label + rowIndex);
    const amountCell = sheet.getRange(slot.amount + rowIndex);
    if (nameCell.isPartOfMerge() || amountCell.isPartOfMerge()) continue;
    if (nameCell.getFormula() || amountCell.getFormula()) continue;

    const nameValue = String(nameCell.getDisplayValue() || '').trim();
    const amountValue = String(amountCell.getDisplayValue() || '').trim();
    if (nameValue || amountValue) continue;

    overwriteSlotWithRecord_(sheet, rowIndex, slot, record, bgColor);
    return { status: 'written', col: slot.label };
  }
  return { status: 'section_full', col: '' };
}

function overwriteSlotWithRecord_(sheet, rowIndex, slot, record, bgColor, options) {
  const previousLabel = options && options.previousLabel ? String(options.previousLabel) : '';
  const previousAmount = options && options.previousAmount ? Number(options.previousAmount) : 0;
  const noteLines = [];
  if (previousLabel) noteLines.push('previousLabel=' + previousLabel);
  if (previousAmount) noteLines.push('previousAmount=' + previousAmount);
  const note = buildAutoWriteNote_(record, noteLines);
  const nameCell = sheet.getRange(slot.label + rowIndex);
  const amountCell = sheet.getRange(slot.amount + rowIndex);

  nameCell.setValue(record.rawName);
  amountCell.setValue(record.amount);
  nameCell.setBackground(bgColor);
  amountCell.setBackground(bgColor);
  nameCell.setFontWeight('normal').setFontColor('#000000');
  amountCell.setFontWeight('normal').setFontColor('#000000');
  nameCell.setNote(note);
  amountCell.setNote(note);
}

function findMatchingRecordInBlock_(sheet, startRow, endRow, record, cachedValues, cachedBgs) {
  const slots = CASHFLOW.SLOT_MAP?.[record.direction]?.[record.category];
  if (!slots || !slots.length) return null;

  const targetName = normalizeCompareName_(record.rawName);
  const targetAmount = Number(record.amount);
  for (let row = startRow; row <= endRow; row++) {
    for (const slot of slots) {
      const name = getCachedCellString_(sheet, row, slot.label, cachedValues);
      const amount = getCachedCellNumber_(sheet, row, slot.amount, cachedValues);
      if (!name || !amount) continue;
      if (normalizeCompareName_(name) === targetName && Number(amount) === targetAmount) {
        return {
          row,
          slot,
          name,
          amount,
          origin: getCachedSlotOrigin_(row, slot, cachedBgs)
        };
      }
    }
  }
  return null;
}

function findConvertibleForecastInBlock_(sheet, startRow, endRow, record, cachedValues, cachedBgs) {
  if (!cachedValues || !cachedBgs) return null;
  const slots = CASHFLOW.SLOT_MAP?.[record.direction]?.[record.category];
  if (!slots || !slots.length) return null;

  const targetAmount = Number(record.amount);
  const targetName = normalizeCompareName_(record.rawName);
  const candidates = [];

  for (let row = startRow; row <= endRow; row++) {
    for (const slot of slots) {
      const name = getCachedCellString_(sheet, row, slot.label, cachedValues);
      const amount = getCachedCellNumber_(sheet, row, slot.amount, cachedValues);
      if (!name || !Number(amount)) continue;

      const origin = getCachedSlotOrigin_(row, slot, cachedBgs);
      if (origin === 'actual_auto') continue;

      const candidateName = normalizeCompareName_(name);
      const nameScore = calculateNameSimilarityScore_(targetName, candidateName);
      const amountScore = calculateAmountClosenessScore_(targetAmount, Number(amount));
      const bgPair = getCachedSlotBackgrounds_(row, slot, cachedBgs);
      const manualForecast = isManualForecastColor_(bgPair.nameBg) || isManualForecastColor_(bgPair.amountBg);
      const plannedAuto = origin === 'planned_auto';

      if (!isForecastReconcileCandidate_(nameScore, amountScore, 0, manualForecast, plannedAuto)) continue;

      candidates.push({
        row,
        slot,
        name,
        amount,
        origin,
        similar: nameScore >= 0.55,
        manualForecast,
        plannedAuto,
        score: Math.round(nameScore * 1000) + Math.round(amountScore * 200) + (manualForecast ? 20 : 0) + (plannedAuto ? 10 : 0)
      });
    }
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => b.score - a.score || a.row - b.row);
  return candidates[0];
}

function findForecastMatchOnSheet_(sheet, baseRow, dKey, record, cachedValues, cachedBCol, cachedBgs) {
  const term = resolveTermBySheetName_(sheet.getName());
  if (!term) return null;

  const targetDate = parseDateKeyWithinTerm_(dKey, term);
  const targetAmount = Number(record.amount);
  const targetName = normalizeCompareName_(record.rawName);
  if (!targetDate || !targetAmount) return null;

  const categories = CASHFLOW.SLOT_MAP?.[record.direction] || {};
  const candidates = [];

  Object.keys(categories).forEach(category => {
    categories[category].forEach(slot => {
      for (let row = 1; row <= (cachedBCol ? cachedBCol.length : sheet.getLastRow()); row++) {
        const rowDateKey = cachedBCol
          ? String(cachedBCol[row - 1] || '').trim()
          : String(sheet.getRange(row, 2).getDisplayValue() || '').trim();
        const rowDate = parseDateKeyWithinTerm_(rowDateKey, term);
        if (!rowDate) continue;

        const dayDiff = Math.abs(daysBetween_(rowDate, targetDate));
        if (dayDiff > CASHFLOW.DUPLICATE.NEARBY_DAY_WINDOW) continue;

        const name = getCachedCellString_(sheet, row, slot.label, cachedValues);
        const amount = getCachedCellNumber_(sheet, row, slot.amount, cachedValues);
        if (!name || !Number(amount)) continue;

        const origin = getCachedSlotOrigin_(row, slot, cachedBgs);
        if (origin === 'actual_auto') continue;

        const bgPair = getCachedSlotBackgrounds_(row, slot, cachedBgs);
        const manualForecast = isManualForecastColor_(bgPair.nameBg) || isManualForecastColor_(bgPair.amountBg);
        const plannedAuto = origin === 'planned_auto';
        const normalizedName = normalizeCompareName_(name);
        const nameScore = calculateNameSimilarityScore_(targetName, normalizedName);
        const amountScore = calculateAmountClosenessScore_(targetAmount, Number(amount));
        const sameDay = dayDiff === 0;

        if (!isForecastReconcileCandidate_(nameScore, amountScore, dayDiff, manualForecast, plannedAuto)) continue;

        candidates.push({
          row,
          slot,
          name,
          amount,
          category,
          dateKey: rowDateKey,
          score:
            (sameDay ? 2000 : 0) +
            Math.round(nameScore * 1000) +
            Math.round(amountScore * 250) +
            (plannedAuto ? 30 : 0) +
            (manualForecast ? 20 : 0) -
            (dayDiff * 50)
        });
      }
    });
  });

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score || a.row - b.row);
  return candidates[0];
}

function manualAmountExistsInBlock_(sheet, startRow, endRow, record, cachedValues, cachedBgs) {
  if (!cachedBgs) return false;
  const slots = CASHFLOW.SLOT_MAP?.[record.direction]?.[record.category];
  if (!slots || !slots.length) return false;

  const targetAmount = Number(record.amount);
  for (let row = startRow; row <= endRow; row++) {
    const rowIndex = row - 1;
    for (const slot of slots) {
      const amountCol = columnLetterToIndex_(slot.amount) - 1;
      if (!cachedValues[rowIndex] || !cachedBgs[rowIndex]) continue;

      const amount = Number(cachedValues[rowIndex][amountCol] || 0);
      const origin = getCachedSlotOrigin_(row, slot, cachedBgs);
      if (amount === targetAmount && origin !== 'actual_auto') {
        return true;
      }
    }
  }
  return false;
}

function findNearbyDuplicateOnSheet_(sheet, record, options) {
  const cachedValues = options && options.cachedValues;
  const cachedBCol = options && options.cachedBCol;
  const cachedBgs = options && options.cachedBgs;
  const excludeStartRow = options && options.excludeStartRow;
  const excludeEndRow = options && options.excludeEndRow;
  const lastRow = cachedBCol ? cachedBCol.length : sheet.getLastRow();
  if (!lastRow) return null;

  const targetTerm = findTermByDate_(record.date);
  const targetDate = new Date(record.date);
  const targetAmount = Number(record.amount);
  const targetNorm = normalizeCompareName_(record.rawName);
  if (!targetNorm || !targetAmount || !targetTerm) return null;

  const allSlots = getAllSlotsForDirection_(record.direction);
  for (let row = 1; row <= lastRow; row++) {
    if (excludeStartRow && excludeEndRow && row >= excludeStartRow && row <= excludeEndRow) continue;

    const dateKey = cachedBCol
      ? String(cachedBCol[row - 1] || '').trim()
      : String(sheet.getRange(row, 2).getDisplayValue()).trim();
    const rowDate = parseDateKeyWithinTerm_(dateKey, targetTerm);
    if (!rowDate) continue;
    if (Math.abs(daysBetween_(rowDate, targetDate)) > CASHFLOW.DUPLICATE.NEARBY_DAY_WINDOW) continue;

    for (const slot of allSlots) {
      const name = getCachedCellString_(sheet, row, slot.label, cachedValues);
      const amount = getCachedCellNumber_(sheet, row, slot.amount, cachedValues);
      if (!name || Number(amount) !== targetAmount) continue;

      const candidateNorm = normalizeCompareName_(name);
      if (!isSameNormalizedName_(targetNorm, candidateNorm)) continue;

      const bgPair = cachedBgs
        ? getCachedSlotBackgrounds_(row, slot, cachedBgs)
        : String(sheet.getRange(slot.label + row).getBackground() || '').toLowerCase();
      return {
        row,
        dateKey,
        col: slot.label,
        name,
        amount,
        bg: bgPair,
        origin: cachedBgs
          ? classifyOriginByBackgrounds_(bgPair.nameBg, bgPair.amountBg)
          : classifyOriginByBackgrounds_(bgPair, sheet.getRange(slot.amount + row).getBackground())
      };
    }
  }
  return null;
}

function shouldSkipForNearbyDuplicate_(record, nearby) {
  if (!nearby) return false;
  if (record.sourceType === 'actual_auto') {
    return nearby.origin === 'actual_auto';
  }
  if (record.sourceType === 'planned_auto') {
    return nearby.origin === 'manual_or_other' || nearby.origin === 'actual_auto';
  }
  return false;
}

function clearDuplicateWithManual() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '確認',
    'オレンジ背景（実績自動取込）のうち、同名・同額の手入力が同日または前後1日にあるものを削除します。\nよろしいですか？',
    ui.ButtonSet.OK_CANCEL
  );
  if (response !== ui.Button.OK) return;

  const ss = getCashflowTargetSpreadsheet_();
  const targets = [
    '入金明細【17期】', '出金明細【17期】',
    '入金明細【18期】', '出金明細【18期】'
  ];
  let total = 0;

  targets.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    const direction = sheetName.includes('入金') ? 'income' : 'expense';
    const entries = collectEntryRows_(sheet, direction);
    const manualMap = {};
    entries
      .filter(entry => entry.origin === 'manual_or_other')
      .forEach(entry => {
        const key = buildDuplicateKey_(entry.normalizedName, entry.amount);
        if (!manualMap[key]) manualMap[key] = [];
        manualMap[key].push(entry);
      });

    entries
      .filter(entry => entry.origin === 'actual_auto')
      .forEach(entry => {
        const key = buildDuplicateKey_(entry.normalizedName, entry.amount);
        const candidates = manualMap[key] || [];
        const hit = candidates.find(candidate => Math.abs(daysBetween_(candidate.date, entry.date)) <= CASHFLOW.DUPLICATE.NEARBY_DAY_WINDOW);
        if (!hit) return;

        sheet.getRange(entry.row, columnLetterToIndex_(entry.labelCol)).clearContent().setBackground(null).setFontColor('#000000').setFontWeight('normal').setNote('');
        sheet.getRange(entry.row, columnLetterToIndex_(entry.amountCol)).clearContent().setBackground(null).setFontColor('#000000').setFontWeight('normal').setNote('');
        total++;
        appendLog_('CLEAR_NEAR_DUP', sheetName, entry.row, formatDateKey_(entry.date), '', entry.name, entry.amount, entry.labelCol, '近傍日手入力重複を削除');
      });
  });

  ui.alert('完了', '合計 ' + total + ' 件の近傍日重複（自動実績）を削除しました。', ui.ButtonSet.OK);
}

function auditNearbyDuplicates() {
  const ss = getCashflowTargetSpreadsheet_();
  const sheet = ensureAuditSheet_(ss);
  sheet.clearContents();
  const headers = [
    '対象シート', '方向', '比較キー', '既存日付', '既存行', '既存取引先', '既存金額', '既存種別',
    '重複日付', '重複行', '重複取引先', '重複金額', '重複種別', '日差'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setBackground('#efefef').setFontWeight('bold');
  sheet.setFrozenRows(1);

  const targetSheets = [
    { name: '入金明細【17期】', direction: 'income' },
    { name: '出金明細【17期】', direction: 'expense' },
    { name: '入金明細【18期】', direction: 'income' },
    { name: '出金明細【18期】', direction: 'expense' }
  ];

  const rows = [];
  targetSheets.forEach(target => {
    const targetSheet = ss.getSheetByName(target.name);
    if (!targetSheet) return;
    const entries = collectEntryRows_(targetSheet, target.direction);
    const groups = {};
    entries.forEach(entry => {
      const key = buildDuplicateKey_(entry.normalizedName, entry.amount);
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    });

    Object.keys(groups).forEach(key => {
      const list = groups[key].sort((a, b) => a.date - b.date || a.row - b.row);
      for (let i = 0; i < list.length - 1; i++) {
        const left = list[i];
        const right = list[i + 1];
        const diff = Math.abs(daysBetween_(left.date, right.date));
        if (diff > CASHFLOW.DUPLICATE.NEARBY_DAY_WINDOW) continue;
        rows.push([
          target.name,
          target.direction,
          key,
          formatDateKey_(left.date),
          left.row,
          left.name,
          left.amount,
          left.origin,
          formatDateKey_(right.date),
          right.row,
          right.name,
          right.amount,
          right.origin,
          diff
        ]);
      }
    });
  });

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  SpreadsheetApp.getUi().alert('近傍重複監査を作成しました。\n検出件数: ' + rows.length);
}

function findDateBlock_(sheet, anchorRow, dKey, cachedBCol) {
  const lastRow = cachedBCol ? cachedBCol.length : sheet.getLastRow();
  let startRow = anchorRow;
  let endRow = anchorRow;

  while (startRow > 1) {
    const value = cachedBCol
      ? String(cachedBCol[startRow - 2] || '').trim()
      : String(sheet.getRange(startRow - 1, 2).getDisplayValue()).trim();
    if (value !== dKey) break;
    startRow--;
  }

  while (endRow < lastRow) {
    const value = cachedBCol
      ? String(cachedBCol[endRow] || '').trim()
      : String(sheet.getRange(endRow + 1, 2).getDisplayValue()).trim();
    if (value !== dKey) break;
    endRow++;
  }

  return { startRow, endRow };
}

function insertContinuationRow_(sheet, afterRow, templateRow, dKey, direction) {
  sheet.insertRowsAfter(afterRow, 1);
  const newRow = afterRow + 1;
  const lastCol = sheet.getLastColumn();
  const sourceRange = sheet.getRange(templateRow, 1, 1, lastCol);
  const targetRange = sheet.getRange(newRow, 1, 1, lastCol);
  sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  sourceRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
  sheet.setRowHeight(newRow, sheet.getRowHeight(templateRow));
  clearEntrySlotsOnRow_(sheet, newRow, direction);
  sheet.getRange(newRow, 2).setValue(dKey);
  return newRow;
}

function clearEntrySlotsOnRow_(sheet, rowIndex, direction) {
  getAllSlotsForDirection_(direction).forEach(slot => {
    const nameCell = sheet.getRange(slot.label + rowIndex);
    const amountCell = sheet.getRange(slot.amount + rowIndex);
    if (!nameCell.getFormula()) {
      nameCell.clearContent().setBackground(null).setFontWeight('normal').setFontColor('#000000').setNote('');
    }
    if (!amountCell.getFormula()) {
      amountCell.clearContent().setBackground(null).setFontWeight('normal').setFontColor('#000000').setNote('');
    }
  });
}

function getAllSlotsForDirection_(direction) {
  const categories = CASHFLOW.SLOT_MAP?.[direction] || {};
  return Object.keys(categories).flatMap(category => categories[category]);
}

function findRowByDateKey_(sheet, dKey, cachedBCol) {
  if (cachedBCol) {
    const index = cachedBCol.findIndex(value => String(value || '').trim() === dKey);
    return index >= 0 ? index + 1 : 0;
  }
  const lastRow = sheet.getLastRow();
  if (lastRow <= 0) return 0;
  const dateValues = sheet.getRange(1, 2, lastRow, 1).getDisplayValues();
  const index = dateValues.findIndex(row => String(row[0]).trim() === dKey);
  return index >= 0 ? index + 1 : 0;
}

function resolveCategoryByAI_(rawName, direction, rules) {
  const raw = String(rawName || '');
  const norm = normalize_(raw);

  for (const rule of rules) {
    if (rule.direction === direction && normalize_(rule.keyword) === norm) {
      return { category: rule.category, confidence: 'HIGH' };
    }
  }
  for (const rule of rules) {
    if (rule.direction === direction && norm.includes(normalize_(rule.keyword))) {
      return { category: rule.category, confidence: 'MEDIUM' };
    }
  }

  if (direction === 'income') {
    if (norm.includes('保険') || norm.includes('損保') || norm.includes('共済')) {
      return { category: '保険関連', confidence: 'LOW' };
    }
    if (
      norm.includes('銀行') || norm.includes('信用金庫') || norm.includes('信金') ||
      norm.includes('信組') || norm.includes('信用組合') || norm.includes('農協') ||
      norm.includes('農業協同組合') || norm.includes('利息')
    ) {
      return { category: '金融機関関連', confidence: 'LOW' };
    }
    return { category: 'お客様関連', confidence: 'LOW' };
  }

  if (
    norm.includes('銀行') || norm.includes('信用金庫') || norm.includes('信金') ||
    norm.includes('信組') || norm.includes('信用組合') || norm.includes('農協') ||
    norm.includes('農業協同組合') || norm.includes('利息') || norm.includes('手数料')
  ) {
    return { category: '金融機関関連', confidence: 'LOW' };
  }
  if (norm.includes('仕入') || norm.includes('部品') || norm.includes('買掛') || norm.includes('外注')) {
    return { category: '買掛関連', confidence: 'LOW' };
  }
  return { category: '経費関連', confidence: 'LOW' };
}

function normalize_(text) {
  let normalized = String(text || '').trim();
  if (normalized.normalize) normalized = normalized.normalize('NFKC');
  return normalized
    .toLowerCase()
    .replace(/(株式会社|有限会社|合同会社|（株）|\(株\)|㈱|（有）|\(有\)|㈲|様|さま|御中)/g, '')
    .replace(/\s+/g, '')
    .replace(/[‐\u002D–—ｰー]/g, '')
    .replace(/[()（）【】\[\]「」『』]/g, '');
}

function normalizeCompareName_(text) {
  return normalize_(text)
    .replace(/^(広|笠|も|中銀|cb)/g, '')
    .replace(/(該当なし|振込\d*|振込|入金|売内\d+|対象外|本社|支店|その他|整備|車両|キックバック|ｷｯｸﾊﾞｯｸ)/g, '')
    .replace(/(\d+月分|月会費|支払手数料|手数料|ｺﾋﾟｰ機|コピー機|コピ機|会員費|会費)/g, '')
    .replace(/[\/.,]/g, '');
}

function loadCategoryRules_(ss) {
  const sheet = ss.getSheetByName(CASHFLOW.SHEETS.CONFIG);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getDataRange().getValues().slice(1)
    .map(row => ({
      enabled: String(row[0]).toUpperCase() === 'Y',
      priority: Number(row[1] || 0),
      direction: row[2] === '入金' ? 'income' : 'expense',
      keyword: String(row[3] || ''),
      category: String(row[4] || '')
    }))
    .filter(rule => rule.enabled && rule.keyword && rule.category)
    .sort((a, b) => b.priority - a.priority);
}

function appendLog_(type, sheetName, row, dKey, category, rawName, amount, col, memo) {
  try {
    const ss = getCashflowTargetSpreadsheet_();
    let logSheet = ss.getSheetByName(CASHFLOW.SHEETS.LOG);
    if (!logSheet) {
      logSheet = ss.insertSheet(CASHFLOW.SHEETS.LOG);
      logSheet.getRange(1, 1, 1, 10).setValues([[
        '記録日時', '種別', '対象シート', '行', '日付',
        'カテゴリ', '取引先', '金額', '書き込み列', 'メモ'
      ]]);
      logSheet.getRange(1, 1, 1, 10).setBackground('#efefef').setFontWeight('bold');
      logSheet.setFrozenRows(1);
    }
    const now = Utilities.formatDate(new Date(), getSpreadsheetTimezone_(), 'yyyy/MM/dd HH:mm:ss');
    logSheet.appendRow([now, type, sheetName, row, dKey, category, rawName, amount, col, memo || '']);
  } catch (error) {
    Logger.log('[LOG ERROR] ' + error);
  }
}

function setupCashflowSystem() {
  const ss = getCashflowTargetSpreadsheet_();
  ensureSheet_(ss, CASHFLOW.SHEETS.CONFIG, ['有効', '優先度', '入出金', 'キーワード', 'カテゴリ', 'メモ']);
  ensureSheet_(ss, CASHFLOW.SHEETS.RECURRING, [
    '有効', '入出金', 'カテゴリ', '名前', '摘要', '金額', '開始日', '終了日',
    '頻度', '月指定', '日指定', '営業日補正', '未来のみ', 'メモ'
  ]);
  ensureSheet_(ss, CASHFLOW.SHEETS.LOG, ['記録日時', '種別', '対象シート', '行', '日付', 'カテゴリ', '取引先', '金額', '書き込み列', 'メモ']);
  ensureSheet_(ss, CASHFLOW.SHEETS.AUDIT, ['対象シート', '方向', '比較キー', '既存日付', '既存行', '既存取引先', '既存金額', '既存種別', '重複日付', '重複行', '重複取引先', '重複金額', '重複種別', '日差']);
  SpreadsheetApp.getUi().alert('セットアップ完了\n修正ログ・近傍重複監査シートを初期化しました。');
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setBackground('#efefef').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

function ensureAuditSheet_(ss) {
  let sheet = ss.getSheetByName(CASHFLOW.SHEETS.AUDIT);
  if (!sheet) sheet = ss.insertSheet(CASHFLOW.SHEETS.AUDIT);
  return sheet;
}

function syncRecurringEntries(options) {
  options = options || {};
  const silent = options.silent === true;
  const ss = getCashflowTargetSpreadsheet_();
  const sheet = ss.getSheetByName(CASHFLOW.SHEETS.RECURRING);
  if (!sheet || sheet.getLastRow() < 2) return;

  const rules = sheet.getDataRange().getValues().slice(1)
    .map(row => ({
      enabled: String(row[0]).toUpperCase() === 'Y',
      dir: row[1] === '入金' ? 'income' : 'expense',
      cat: String(row[2] || ''),
      name: String(row[3] || ''),
      summary: String(row[4] || ''),
      amt: Number(row[5] || 0),
      startDate: row[6],
      endDate: row[7],
      months: String(row[9] || ''),
      day: row[10],
      biz: row[11]
    }))
    .filter(rule => rule.enabled && rule.cat && rule.name && rule.amt > 0);

  CASHFLOW.TERMS.forEach(term => {
    ['incomeSheet', 'expenseSheet'].forEach(sheetType => {
      const targetSheet = ss.getSheetByName(term[sheetType]);
      if (!targetSheet) return;
      const currentDir = sheetType === 'incomeSheet' ? 'income' : 'expense';

      rules.filter(rule => rule.dir === currentDir).forEach(rule => {
        generateDates_(rule, term.start, term.end).forEach(dKey => {
          const baseRow = findRowByDateKey_(targetSheet, dKey);
          if (baseRow <= 0) return;
          writeRecordWithOverflow_(targetSheet, baseRow, dKey, {
            direction: rule.dir,
            category: rule.cat,
            rawName: rule.name,
            amount: rule.amt,
            summary: rule.summary,
            sourceType: 'planned_auto'
          }, CASHFLOW.COLORS.PLANNED_AUTO);
        });
      });
    });
  });

  if (!silent) {
    SpreadsheetApp.getUi().alert('定期予定の同期完了');
  }
}

function runCashflowRefresh_(options) {
  options = options || {};
  const silent = options.silent === true;
  const plannedExpenseCount = syncPlannedExpenseFromPaymentList({ silent: true });
  const plannedIncomeCount = syncPlannedIncomeFromReceivableForecast({ silent: true });
  const actualCount = syncActualWithAI({ silent: true });
  syncRecurringEntries({ silent: true });
  if (!silent) {
    SpreadsheetApp.getUi().alert(
      'CF反映が完了しました。\n' +
      '支払い予定: ' + plannedExpenseCount + '件\n' +
      '入金予定: ' + plannedIncomeCount + '件\n' +
      '銀行実績: ' + actualCount + '件'
    );
  }
  return {
    plannedExpenseCount: plannedExpenseCount,
    plannedIncomeCount: plannedIncomeCount,
    actualCount: actualCount
  };
}

function generateDates_(rule, startStr, endStr) {
  const start = rule.startDate ? new Date(rule.startDate) : new Date(startStr);
  const end = rule.endDate ? new Date(rule.endDate) : new Date(endStr);
  const dates = [];
  const monthFilter = (rule.months === '*' || !rule.months)
    ? []
    : rule.months.split(',').map(Number).filter(Boolean);

  let current = new Date(start.getFullYear(), start.getMonth(), 1);
  while (current <= end) {
    if (!monthFilter.length || monthFilter.includes(current.getMonth() + 1)) {
      const date = new Date(current.getFullYear(), current.getMonth(), Math.min(Number(rule.day || 1), 28));
      if (rule.biz === 'PREV_WEEKDAY') {
        while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() - 1);
      }
      if (date >= start && date <= end) dates.push(formatDateKey_(date));
    }
    current.setMonth(current.getMonth() + 1);
  }
  return dates;
}

function findTermByDate_(dateValue) {
  const date = new Date(dateValue);
  return CASHFLOW.TERMS.find(term => date >= new Date(term.start) && date <= new Date(term.end));
}

function formatDateKey_(dateValue) {
  return Utilities.formatDate(new Date(dateValue), getSpreadsheetTimezone_(), 'M/d');
}

function clearAllSyncData() {
  const ss = getCashflowTargetSpreadsheet_();
  const ui = SpreadsheetApp.getUi();
  const targets = [
    ...CASHFLOW.TERMS.map(term => ({ name: term.incomeSheet, dir: 'income' })),
    ...CASHFLOW.TERMS.map(term => ({ name: term.expenseSheet, dir: 'expense' }))
  ];

  const confirm = ui.alert(
    '確認',
    'syncActualWithAI で書き込んだオレンジ背景（' + CASHFLOW.COLORS.ACTUAL_AUTO + '）のデータを全削除します。\nよろしいですか？',
    ui.ButtonSet.OK_CANCEL
  );
  if (confirm !== ui.Button.OK) return;

  let total = 0;
  targets.forEach(target => {
    const sheet = ss.getSheetByName(target.name);
    if (!sheet || sheet.getLastRow() < 3) return;

    const rowCount = sheet.getLastRow() - 1;
    const colCount = sheet.getLastColumn();
    const backgrounds = sheet.getRange(2, 1, rowCount, colCount).getBackgrounds();
    const formulas = sheet.getRange(2, 1, rowCount, colCount).getFormulas();
    const allSlots = getAllSlotsForDirection_(target.dir);
    const colSet = {};
    allSlots.forEach(slot => {
      colSet[columnLetterToIndex_(slot.label) - 1] = true;
      colSet[columnLetterToIndex_(slot.amount) - 1] = true;
    });

    for (let row = 0; row < rowCount; row++) {
      Object.keys(colSet).forEach(colStr => {
        const col = Number(colStr);
        if (formulas[row][col]) return;
        if (String(backgrounds[row][col] || '').toLowerCase() !== CASHFLOW.COLORS.ACTUAL_AUTO) return;
        sheet.getRange(row + 2, col + 1).clearContent().setBackground(null).setFontColor('#000000').setFontWeight('normal').setNote('');
        total++;
      });
    }
  });

  ui.alert('完了\n合計 ' + total + ' 件のスロットを消去しました。');
}

function columnLetterToIndex_(col) {
  let result = 0;
  for (let i = 0; i < col.length; i++) {
    result = result * 26 + (col.charCodeAt(i) - 64);
  }
  return result;
}

function loadBankLearningMap_() {
  try {
    const ss = SpreadsheetApp.openById(CASHFLOW.ACTUAL_SOURCE.SPREADSHEET_ID);
    const map = {};

    const sheet = ss.getSheetByName(CASHFLOW.ACTUAL_SOURCE.LEARNING_SHEET_NAME);
    if (sheet && sheet.getLastRow() >= 2) {
      const values = sheet.getDataRange().getValues();
      const header = values[0].map(h => String(h || '').trim());
      const columnIdx = header.indexOf('該当列');
      const aiIdx = header.indexOf('読取データ');
      const correctedIdx = header.indexOf('正データ');
      if (![columnIdx, aiIdx, correctedIdx].some(index => index < 0)) {
        values.slice(1).forEach(row => {
          const columnName = String(row[columnIdx] || '').trim();
          const aiValue = String(row[aiIdx] || '').trim();
          const corrected = String(row[correctedIdx] || '').trim();
          if (!aiValue || !corrected) return;
          if (columnName && ['相手摘要', '自摘要', '取引先', '表示摘要'].indexOf(columnName) < 0) return;
          map[normalizeCompareName_(aiValue)] = corrected;
        });
      }
    }

    // AI読み取り学習用シートから手動補正ルール（有効列が設定済み）を読み込む
    const manualSheet = ss.getSheetByName('AI読み取り学習用');
    if (manualSheet && manualSheet.getLastRow() >= 2) {
      const values = manualSheet.getDataRange().getValues();
      const headers = values[0].map(h => String(h || '').trim());
      const enabledIdx = headers.indexOf('有効');
      const targetSheetIdx = headers.indexOf('該当シート');
      const targetColumnIdx = headers.indexOf('該当列');
      const wrongIdx = headers.indexOf('読取データ');
      const correctIdx = headers.indexOf('正データ');
      if ([wrongIdx, correctIdx].every(index => index >= 0)) {
        values.slice(1).forEach(row => {
          const enabled = enabledIdx >= 0 ? String(row[enabledIdx] || '').trim().toUpperCase() : 'Y';
          const targetSheet = targetSheetIdx >= 0 ? String(row[targetSheetIdx] || '').trim() : '';
          const targetColumn = targetColumnIdx >= 0 ? String(row[targetColumnIdx] || '').trim() : '';
          const wrong = String(row[wrongIdx] || '').trim();
          const correct = String(row[correctIdx] || '').trim();

          if (!wrong || !correct) return;
          if (enabled === 'N' || enabled === 'FALSE') return;
          if (targetSheet && targetSheet !== CASHFLOW.ACTUAL_SOURCE.SHEET_NAME) return;
          if (targetColumn && ['相手摘要', '自摘要', '取引先', '表示摘要'].indexOf(targetColumn) < 0) return;

          map[normalizeCompareName_(wrong)] = correct;
        });
      }
    }

    const reconcileSheet = ss.getSheetByName(CASHFLOW.ACTUAL_SOURCE.RECONCILE_MASTER_SHEET_NAME);
    if (reconcileSheet && reconcileSheet.getLastRow() >= 2) {
      const values = reconcileSheet.getDataRange().getValues();
      const headers = values[0].map(h => String(h || '').trim());
      const rawIdx = headers.indexOf('銀行摘要原文');
      const summaryIdx = headers.indexOf('正規摘要');
      const customerIdx = headers.indexOf('正規顧客名');
      const alias1Idx = headers.indexOf('別名1');
      const alias2Idx = headers.indexOf('別名2');

      values.slice(1).forEach(row => {
        const corrected = String(row[customerIdx] || row[summaryIdx] || '').trim();
        if (!corrected) return;

        [
          String(row[rawIdx] || '').trim(),
          String(row[summaryIdx] || '').trim(),
          String(row[alias1Idx] || '').trim(),
          String(row[alias2Idx] || '').trim()
        ].filter(Boolean).forEach(sourceText => {
          map[normalizeCompareName_(sourceText)] = corrected;
        });
      });
    }

    return map;
  } catch (error) {
    Logger.log('AI読み取り学習用 読み込みエラー: ' + error);
    return {};
  }
}

function applyLearnedNameCorrection_(rawName, learningMap) {
  const text = String(rawName || '').trim();
  if (!text) return text;
  const normalized = normalizeCompareName_(text);
  return learningMap[normalized] || text;
}

function buildAutoWriteNote_(record, extraLines) {
  const lines = [
    'source=' + String(record.sourceType || ''),
    'category=' + String(record.category || ''),
    'name=' + String(record.rawName || ''),
    'normalized=' + normalizeCompareName_(record.rawName),
    'amount=' + String(record.amount || 0),
    'writtenAt=' + Utilities.formatDate(new Date(), getSpreadsheetTimezone_(), 'yyyy/MM/dd HH:mm:ss')
  ];
  if (record.originalRawName && record.originalRawName !== record.rawName) {
    lines.push('original=' + record.originalRawName);
  }
  if (record.forecastKey) {
    lines.push('forecastKey=' + record.forecastKey);
  }
  (extraLines || []).forEach(line => {
    if (line) lines.push(String(line));
  });
  return lines.join('\n');
}

function refreshSheetCaches_(sheet, valuesCache, bColCache, bgsCache) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return;
  valuesCache[sheet.getName()] = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  bColCache[sheet.getName()] = sheet.getRange(1, 2, lastRow, 1).getDisplayValues().map(row => row[0]);
  bgsCache[sheet.getName()] = sheet.getRange(1, 1, lastRow, lastCol).getBackgrounds();
}

function getCachedCellString_(sheet, row, colLetter, cachedValues) {
  if (cachedValues) {
    return String((cachedValues[row - 1] || [])[columnLetterToIndex_(colLetter) - 1] || '').trim();
  }
  return String(sheet.getRange(colLetter + row).getDisplayValue() || '').trim();
}

function getCachedCellNumber_(sheet, row, colLetter, cachedValues) {
  if (cachedValues) {
    return Number((cachedValues[row - 1] || [])[columnLetterToIndex_(colLetter) - 1] || 0);
  }
  return Number(sheet.getRange(colLetter + row).getValue() || 0);
}

function classifyOriginByBackgrounds_(nameBg, amountBg) {
  const nameColor = String(nameBg || '').toLowerCase();
  const amountColor = String(amountBg || '').toLowerCase();
  if (nameColor === CASHFLOW.COLORS.ACTUAL_AUTO || amountColor === CASHFLOW.COLORS.ACTUAL_AUTO) return 'actual_auto';
  if (nameColor === CASHFLOW.COLORS.PLANNED_AUTO || amountColor === CASHFLOW.COLORS.PLANNED_AUTO) return 'planned_auto';
  return 'manual_or_other';
}

function parseDateKeyWithinTerm_(dKey, term) {
  const match = String(dKey || '').trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match || !term) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const startYear = new Date(term.start).getFullYear();
  const endYear = new Date(term.end).getFullYear();
  const year = month >= 6 ? startYear : endYear;
  const date = new Date(year, month - 1, day);
  return isNaN(date.getTime()) ? null : date;
}

function daysBetween_(a, b) {
  const left = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const right = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((left - right) / 86400000);
}

function isSameNormalizedName_(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 4 && right.includes(left)) return true;
  if (right.length >= 4 && left.includes(right)) return true;
  return false;
}

function calculateNameSimilarityScore_(left, right) {
  const a = String(left || '').trim();
  const b = String(right || '').trim();
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length >= 3 && b.includes(a)) return 0.96;
  if (b.length >= 3 && a.includes(b)) return 0.96;

  const aBigrams = buildNameBigrams_(a);
  const bBigrams = buildNameBigrams_(b);
  if (!aBigrams.length || !bBigrams.length) return 0;

  const setB = {};
  bBigrams.forEach(function (item) { setB[item] = true; });
  let overlap = 0;
  aBigrams.forEach(function (item) {
    if (setB[item]) overlap++;
  });

  const union = new Set(aBigrams.concat(bBigrams)).size || 1;
  return overlap / union;
}

function buildNameBigrams_(text) {
  const normalized = String(text || '').trim();
  if (!normalized) return [];
  if (normalized.length < 2) return [normalized];

  const grams = [];
  for (let i = 0; i < normalized.length - 1; i++) {
    grams.push(normalized.substring(i, i + 2));
  }
  return grams;
}

function calculateAmountClosenessScore_(left, right) {
  const a = Math.abs(Number(left) || 0);
  const b = Math.abs(Number(right) || 0);
  if (!a || !b) return 0;
  if (a === b) return 1;
  return Math.min(a, b) / Math.max(a, b);
}

function isForecastReconcileCandidate_(nameScore, amountScore, dayDiff, manualForecast, plannedAuto) {
  if (nameScore >= 0.95) return true;
  if (dayDiff === 0 && nameScore >= 0.6) return true;
  if (dayDiff === 0 && nameScore >= 0.18 && amountScore >= 0.6 && (manualForecast || plannedAuto)) return true;
  if (dayDiff <= CASHFLOW.DUPLICATE.NEARBY_DAY_WINDOW && nameScore >= 0.45 && amountScore >= 0.8) return true;
  return false;
}

function collectEntryRows_(sheet, direction) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 2) return [];

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const bgs = sheet.getRange(1, 1, lastRow, lastCol).getBackgrounds();
  const dateKeys = sheet.getRange(1, 2, lastRow, 1).getDisplayValues().map(row => row[0]);
  const term = resolveTermBySheetName_(sheet.getName());
  const slots = getAllSlotsForDirection_(direction);
  const rows = [];

  for (let row = 1; row <= lastRow; row++) {
    const date = parseDateKeyWithinTerm_(dateKeys[row - 1], term);
    if (!date) continue;
    slots.forEach(slot => {
      const nameCol = columnLetterToIndex_(slot.label) - 1;
      const amountCol = columnLetterToIndex_(slot.amount) - 1;
      const name = String((values[row - 1] || [])[nameCol] || '').trim();
      const amount = Number((values[row - 1] || [])[amountCol] || 0);
      if (!name || !amount) return;
      rows.push({
        row,
        date,
        name,
        amount,
        normalizedName: normalizeCompareName_(name),
        labelCol: slot.label,
        amountCol: slot.amount,
        origin: classifyOriginByBackgrounds_(
          String((bgs[row - 1] || [])[nameCol] || '').toLowerCase(),
          String((bgs[row - 1] || [])[amountCol] || '').toLowerCase()
        )
      });
    });
  }
  return rows;
}

function buildDuplicateKey_(normalizedName, amount) {
  return [normalizedName, Number(amount)].join('|');
}

function resolveTermBySheetName_(sheetName) {
  return CASHFLOW.TERMS.find(term => term.incomeSheet === sheetName || term.expenseSheet === sheetName) || null;
}

function getSpreadsheetTimezone_() {
  try {
    return Session.getScriptTimeZone() || CASHFLOW.TIMEZONE;
  } catch (error) {
    return CASHFLOW.TIMEZONE;
  }
}

function upsertForecastRecordByKey_(sheet, baseRow, dKey, record, bgColor, cachedValues, cachedBCol) {
  const block = findDateBlock_(sheet, baseRow, dKey, cachedBCol);
  const slots = CASHFLOW.SLOT_MAP?.[record.direction]?.[record.category] || [];
  const targetKey = String(record.forecastKey || '').trim();
  const targetName = normalizeCompareName_(record.rawName);

  for (let row = block.startRow; row <= block.endRow; row++) {
    for (const slot of slots) {
      const note = String(sheet.getRange(slot.label + row).getNote() || sheet.getRange(slot.amount + row).getNote() || '');
      const existingName = getCachedCellString_(sheet, row, slot.label, cachedValues);
      if (!note && !existingName) continue;

      const existingKey = extractNoteValue_(note, 'forecastKey');
      const source = extractNoteValue_(note, 'source');
      const samePlannedLabel = source === 'planned_auto' && normalizeCompareName_(existingName) === targetName;
      if (existingKey !== targetKey && !samePlannedLabel) continue;

      overwriteSlotWithRecord_(sheet, row, slot, record, bgColor);
      appendLog_('PLAN_UPSERT', sheet.getName(), row, dKey, record.category, record.rawName, record.amount, slot.label, '売掛見込みを更新');
      return true;
    }
  }

  return false;
}

function clearStaleReceivableForecasts_(ss, validForecastKeys) {
  const validSet = validForecastKeys instanceof Set ? validForecastKeys : new Set(validForecastKeys || []);
  CASHFLOW.TERMS.forEach(term => {
    const sheet = ss.getSheetByName(term.incomeSheet);
    if (!sheet || sheet.getLastRow() < 2) return;

    const slots = getAllSlotsForDirection_('income');
    for (let row = 2; row <= sheet.getLastRow(); row++) {
      slots.forEach(slot => {
        const labelCell = sheet.getRange(slot.label + row);
        const amountCell = sheet.getRange(slot.amount + row);
        const note = String(labelCell.getNote() || amountCell.getNote() || '');
        const forecastKey = extractNoteValue_(note, 'forecastKey');
        if (!forecastKey || forecastKey.indexOf('receivable:') !== 0) return;
        if (validSet.has(forecastKey)) return;

        labelCell.clearContent().setBackground(null).setFontWeight('normal').setFontColor('#000000').setNote('');
        amountCell.clearContent().setBackground(null).setFontWeight('normal').setFontColor('#000000').setNote('');
      });
    }
  });
}

function extractNoteValue_(note, key) {
  const prefix = String(key || '') + '=';
  const line = String(note || '').split('\n').find(item => item.indexOf(prefix) === 0);
  return line ? line.slice(prefix.length).trim() : '';
}

function getCachedSlotBackgrounds_(row, slot, cachedBgs) {
  const rowData = cachedBgs[row - 1] || [];
  return {
    nameBg: String(rowData[columnLetterToIndex_(slot.label) - 1] || '').toLowerCase(),
    amountBg: String(rowData[columnLetterToIndex_(slot.amount) - 1] || '').toLowerCase()
  };
}

function getCachedSlotOrigin_(row, slot, cachedBgs) {
  const bgPair = getCachedSlotBackgrounds_(row, slot, cachedBgs);
  return classifyOriginByBackgrounds_(bgPair.nameBg, bgPair.amountBg);
}

function isManualForecastColor_(color) {
  const normalized = String(color || '').toLowerCase();
  return CASHFLOW.COLORS.MANUAL_FORECAST.indexOf(normalized) >= 0;
}
