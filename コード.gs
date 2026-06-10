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
    SHEET_NAME: '売掛入金見込み管理',
    DETAIL_SHEET_NAME: '売掛入金見込み明細'
  },

  PAYMENT_SOURCE: {
    SPREADSHEET_ID: '12Z7hFDO9f8JMTdVYqNCx_1QbgjXmoAqWYJDiUkakuHE',
    DATA_SHEET_NAME: '支払いデータ一覧',
    MASTER_SHEET_NAME: '支払い一覧',
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
    AUDIT: '近傍重複監査',
    SETTINGS: 'システム設定'
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

const CASHFLOW_SETTING_KEYS = {
  TARGET_SPREADSHEET_ID: 'CF_TARGET_SPREADSHEET_ID',
  ACTUAL_SOURCE_SPREADSHEET_ID: 'CF_ACTUAL_SOURCE_SPREADSHEET_ID',
  RECEIVABLE_SOURCE_SPREADSHEET_ID: 'CF_RECEIVABLE_SOURCE_SPREADSHEET_ID',
  PAYMENT_SOURCE_SPREADSHEET_ID: 'CF_PAYMENT_SOURCE_SPREADSHEET_ID',
  TEST_MONTH: 'CF_TEST_MONTH'
};

function getCashflowSettingsSheet_(spreadsheet) {
  if (!spreadsheet) return null;
  return spreadsheet.getSheetByName(CASHFLOW.SHEETS.SETTINGS);
}

function getCashflowSettingValue_(spreadsheet, key) {
  const sheet = getCashflowSettingsSheet_(spreadsheet);
  if (!sheet || sheet.getLastRow() < 2) return '';

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), 2)).getValues();
  for (let i = 0; i < values.length; i++) {
    const currentKey = String(values[i][0] || '').trim();
    if (currentKey === key) {
      return String(values[i][1] || '').trim();
    }
  }
  return '';
}

function getCashflowScriptPropertyValue_(key) {
  try {
    return String(PropertiesService.getScriptProperties().getProperty(key) || '').trim();
  } catch (error) {
    return '';
  }
}

function hasCashflowTermSheets_(spreadsheet) {
  if (!spreadsheet) return false;
  return CASHFLOW.TERMS.some(function(term) {
    return !!spreadsheet.getSheetByName(term.incomeSheet) || !!spreadsheet.getSheetByName(term.expenseSheet);
  });
}

function isCashflowRuntimeSpreadsheet_(spreadsheet) {
  return hasCashflowTermSheets_(spreadsheet);
}

function resolveCashflowTargetSpreadsheetId_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (isCashflowRuntimeSpreadsheet_(active)) {
    return active.getId();
  }

  const activeSetting = getCashflowSettingValue_(active, CASHFLOW_SETTING_KEYS.TARGET_SPREADSHEET_ID);
  if (activeSetting) return activeSetting;

  const propValue = getCashflowScriptPropertyValue_(CASHFLOW_SETTING_KEYS.TARGET_SPREADSHEET_ID);
  if (propValue) return propValue;

  return CASHFLOW.TARGET_SPREADSHEET_ID;
}

function getCashflowTargetSettingsSpreadsheet_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (isCashflowRuntimeSpreadsheet_(active)) {
    return active;
  }
  return SpreadsheetApp.openById(resolveCashflowTargetSpreadsheetId_());
}

function isCashflowCopySpreadsheet_(spreadsheet) {
  if (!spreadsheet) return false;
  return spreadsheet.getId() !== CASHFLOW.TARGET_SPREADSHEET_ID || /コピー/.test(String(spreadsheet.getName() || ''));
}

function hasAllSheets_(spreadsheet, requiredSheetNames) {
  if (!spreadsheet) return false;
  return requiredSheetNames.every(function(sheetName) {
    return !!spreadsheet.getSheetByName(sheetName);
  });
}

function findLatestSpreadsheetIdForCashflowCopy_(query, requiredSheetNames) {
  let latestFile = null;
  const files = DriveApp.searchFiles(query);

  while (files.hasNext()) {
    const file = files.next();
    try {
      const spreadsheet = SpreadsheetApp.openById(file.getId());
      if (!hasAllSheets_(spreadsheet, requiredSheetNames)) {
        continue;
      }

      if (!latestFile || file.getLastUpdated() > latestFile.getLastUpdated()) {
        latestFile = file;
      }
    } catch (error) {
      Logger.log('CFテスト用コピー候補の判定失敗: ' + error);
    }
  }

  return latestFile ? latestFile.getId() : '';
}

function getCashflowAutoDetectedCopySourceId_(settingKey) {
  switch (settingKey) {
    case CASHFLOW_SETTING_KEYS.ACTUAL_SOURCE_SPREADSHEET_ID:
    case CASHFLOW_SETTING_KEYS.RECEIVABLE_SOURCE_SPREADSHEET_ID:
      return findLatestSpreadsheetIdForCashflowCopy_(
        "title contains '入金一覧' and title contains 'コピー' and trashed = false and mimeType = 'application/vnd.google-apps.spreadsheet'",
        ['銀行データチェック用', '振込入金リスト一覧']
      );
    case CASHFLOW_SETTING_KEYS.PAYMENT_SOURCE_SPREADSHEET_ID:
      return findLatestSpreadsheetIdForCashflowCopy_(
        "title contains '支払一覧' and title contains 'コピー' and trashed = false and mimeType = 'application/vnd.google-apps.spreadsheet'",
        ['支払い一覧', '定期支払い']
      );
    default:
      return '';
  }
}

function getCashflowSourceSpreadsheetId_(settingKey, fallbackId) {
  const settingsSpreadsheet = getCashflowTargetSettingsSpreadsheet_();
  const settingValue = getCashflowSettingValue_(settingsSpreadsheet, settingKey);
  if (settingValue) return settingValue;

  if (isCashflowCopySpreadsheet_(settingsSpreadsheet)) {
    const detectedId = getCashflowAutoDetectedCopySourceId_(settingKey);
    if (detectedId) return detectedId;
  }

  const propValue = getCashflowScriptPropertyValue_(settingKey);
  if (propValue) return propValue;

  return fallbackId;
}

function getCashflowTestMonthFilter_() {
  const settingsSpreadsheet = getCashflowTargetSettingsSpreadsheet_();
  const settingValue = getCashflowSettingValue_(settingsSpreadsheet, CASHFLOW_SETTING_KEYS.TEST_MONTH)
    || getCashflowScriptPropertyValue_(CASHFLOW_SETTING_KEYS.TEST_MONTH);
  const match = String(settingValue || '').trim().match(/^(\d{4})[\/-](\d{1,2})$/);
  if (!match) return '';
  return match[1] + '/' + ('0' + Number(match[2])).slice(-2);
}

function formatCashflowMonthKey_(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return Utilities.formatDate(date, getSpreadsheetTimezone_(), 'yyyy/MM');
}

function filterCashflowRecordsByTestMonth_(records) {
  const testMonth = getCashflowTestMonthFilter_();
  if (!testMonth) return records || [];
  return (records || []).filter(function(record) {
    return formatCashflowMonthKey_(record && record.date) === testMonth;
  });
}

function getCashflowTargetSpreadsheet_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (isCashflowRuntimeSpreadsheet_(active)) {
    return active;
  }
  return SpreadsheetApp.openById(resolveCashflowTargetSpreadsheetId_());
}

function onOpenCashflowLegacy_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!isCashflowRuntimeSpreadsheet_(active)) {
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

function buildCashflowOperationsMenu_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!isCashflowRuntimeSpreadsheet_(active)) {
    return;
  }

  SpreadsheetApp.getUi()
    .createMenu('CF反映')
    .addItem('① 支払い予定を反映', 'menuSyncPaymentForecast')
    .addItem('② 入金予定を反映', 'menuSyncIncomeForecast')
    .addItem('③ 銀行実績を反映', 'menuSyncBankActual')
    .addItem('⑤ 接続確認', 'menuInspectCashflowConnections')
    .addSeparator()
    .addItem('④ CF反映を一括実行', 'menuRunCashflowRefresh')
    .addToUi();
}

function openCashflowWorkflowMenu_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!isCashflowRuntimeSpreadsheet_(active)) {
    return;
  }
  buildCashflowOperationsMenu_();
}

function openCashflowWorkflowMenu() {
  openCashflowWorkflowMenu_();
}

function installCashflowWorkflowOpenTrigger_() {
  const spreadsheet = getCashflowTargetSpreadsheet_();
  const spreadsheetId = spreadsheet.getId();
  let hasCurrentTrigger = false;

  ScriptApp.getUserTriggers(spreadsheet).forEach(function(trigger) {
    const handler = trigger.getHandlerFunction();
    const eventType = String(trigger.getEventType());

    if (eventType !== 'ON_OPEN') {
      return;
    }

    if (handler === 'onOpen') {
      hasCurrentTrigger = true;
      return;
    }

    if (handler === 'openCashflowWorkflowMenu_' || handler === 'onOpenCashflowLegacy_') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  if (!hasCurrentTrigger) {
    ScriptApp.newTrigger('onOpen')
      .forSpreadsheet(spreadsheetId)
      .onOpen()
      .create();
  }
}

function installCashflowWorkflowOpenTrigger() {
  installCashflowWorkflowOpenTrigger_();
}

function ensureCashflowSupportSheets_() {
  const ss = getCashflowTargetSpreadsheet_();
  ensureSheet_(ss, CASHFLOW.SHEETS.CONFIG, ['有効', '優先度', '入出金', 'キーワード', 'カテゴリ', 'メモ']);
  ensureSheet_(ss, CASHFLOW.SHEETS.RECURRING, [
    '有効', '入出金', 'カテゴリ', '名前', '摘要', '金額', '開始日', '終了日',
    '頻度', '月指定', '日指定', '営業日補正', '未来のみ', 'メモ'
  ]);
  ensureSheet_(ss, CASHFLOW.SHEETS.LOG, ['記録日時', '種別', '対象シート', '行', '日付', 'カテゴリ', '取引先', '金額', '書き込み列', 'メモ']);
  ensureSheet_(ss, CASHFLOW.SHEETS.AUDIT, ['対象シート', '方向', '比較キー', '既存日付', '既存行', '既存取引先', '既存金額', '既存種別', '重複日付', '重複行', '重複取引先', '重複金額', '重複種別', '日差']);
  ensureSheet_(ss, CASHFLOW.SHEETS.SETTINGS, ['キー', '値', 'メモ']);
}

function validateCashflowTargetLayout_() {
  const ss = getCashflowTargetSpreadsheet_();
  const missing = [];

  CASHFLOW.TERMS.forEach(function(term) {
    if (!ss.getSheetByName(term.incomeSheet)) {
      missing.push(term.incomeSheet);
    }
    if (!ss.getSheetByName(term.expenseSheet)) {
      missing.push(term.expenseSheet);
    }
  });

  if (missing.length) {
    throw new Error('キャッシュフロー表に必要なシートがありません: ' + missing.join(', '));
  }
}

function ensureCashflowWorkflowReady_() {
  validateCashflowTargetLayout_();
  ensureCashflowSupportSheets_();
}

function menuRunCashflowRefresh() {
  ensureCashflowWorkflowReady_();
  return runCashflowRefresh_({ silent: false });
}

function menuSyncPaymentForecast() {
  ensureCashflowWorkflowReady_();
  return syncPlannedExpenseFromPaymentList({ silent: false });
}

function menuSyncIncomeForecast() {
  ensureCashflowWorkflowReady_();
  return syncPlannedIncomeFromReceivableForecast({ silent: false });
}

function menuSyncBankActual() {
  ensureCashflowWorkflowReady_();
  const contIdx = PropertiesService.getScriptProperties().getProperty('SYNC_ACTUAL_CONTINUATION_INDEX');
  if (contIdx) {
    var ui = SpreadsheetApp.getUi();
    var resp = ui.alert(
      '銀行実績同期が途中から再開されます（' + contIdx + '件目～）。\n最初からやり直す場合は「いいえ」を選択してください。',
      ui.ButtonSet.YES_NO
    );
    if (resp === ui.Button.NO) {
      PropertiesService.getScriptProperties().deleteProperty('SYNC_ACTUAL_CONTINUATION_INDEX');
      PropertiesService.getScriptProperties().deleteProperty('SYNC_ACTUAL_CONTINUATION_COUNT');
      clearSyncActualContinuationTrigger_();
    }
  }
  return syncActualWithAI({ silent: false });
}

function menuInspectCashflowConnections() {
  ensureCashflowWorkflowReady_();
  const snapshot = inspectCashflowConnections_();
  const lines = [
    'CF接続確認',
    '',
    '対象CF: ' + snapshot.target.name + ' (' + snapshot.target.id + ')',
    '入金/実績ソース: ' + snapshot.actual.name + ' (' + snapshot.actual.id + ')',
    '支払いソース: ' + snapshot.payment.name + ' (' + snapshot.payment.id + ')',
    '',
    '入金見込み件数: ' + snapshot.receivable.count + '件',
    '支払い見込み件数: ' + snapshot.paymentForecast.count + '件',
    '銀行実績件数: ' + snapshot.actualRows.count + '件'
  ];

  if (snapshot.receivable.sample.length) {
    lines.push('', '入金見込みサンプル:');
    snapshot.receivable.sample.forEach(function(sample) {
      lines.push('・' + sample);
    });
  }

  if (snapshot.paymentForecast.sample.length) {
    lines.push('', '支払い見込みサンプル:');
    snapshot.paymentForecast.sample.forEach(function(sample) {
      lines.push('・' + sample);
    });
  }

  SpreadsheetApp.getUi().alert(lines.join('\n'));
  return snapshot;
}

function inspectCashflowConnections_() {
  const targetSpreadsheet = getCashflowTargetSpreadsheet_();
  const actualSourceId = getCashflowSourceSpreadsheetId_(
    CASHFLOW_SETTING_KEYS.ACTUAL_SOURCE_SPREADSHEET_ID,
    CASHFLOW.ACTUAL_SOURCE.SPREADSHEET_ID
  );
  const receivableSourceId = getCashflowSourceSpreadsheetId_(
    CASHFLOW_SETTING_KEYS.RECEIVABLE_SOURCE_SPREADSHEET_ID,
    CASHFLOW.RECEIVABLE_SOURCE.SPREADSHEET_ID
  );
  const paymentSourceId = getCashflowSourceSpreadsheetId_(
    CASHFLOW_SETTING_KEYS.PAYMENT_SOURCE_SPREADSHEET_ID,
    CASHFLOW.PAYMENT_SOURCE.SPREADSHEET_ID
  );
  const actualSpreadsheet = SpreadsheetApp.openById(actualSourceId);
  const receivableSpreadsheet = SpreadsheetApp.openById(receivableSourceId);
  const paymentSpreadsheet = SpreadsheetApp.openById(paymentSourceId);
  const receivableRecords = fetchReceivableForecastData_();
  const paymentRecords = fetchPaymentListData_();
  const actualRows = fetchBankData_(loadBankLearningMap_());

  return {
    target: {
      id: targetSpreadsheet.getId(),
      name: targetSpreadsheet.getName()
    },
    actual: {
      id: actualSpreadsheet.getId(),
      name: actualSpreadsheet.getName()
    },
    receivable: {
      id: receivableSpreadsheet.getId(),
      name: receivableSpreadsheet.getName(),
      count: receivableRecords.length,
      sample: receivableRecords.slice(0, 5).map(function(record) {
        return formatDateKey_(record.date) + ' / ' + record.rawName + ' / ' + record.amount;
      })
    },
    payment: {
      id: paymentSpreadsheet.getId(),
      name: paymentSpreadsheet.getName()
    },
    paymentForecast: {
      count: paymentRecords.length,
      sample: paymentRecords.slice(0, 5).map(function(record) {
        return Utilities.formatDate(new Date(record.date), getSpreadsheetTimezone_(), 'yyyy/MM/dd') +
          ' / ' + record.rawName + ' / ' + record.amount;
      })
    },
    actualRows: {
      count: actualRows.length
    }
  };
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
      try { SpreadsheetApp.getUi().alert('支払い一覧から新しい予定データが見つかりませんでした。'); } catch(e) { Logger.log(e.message); }
    }
    return 0;
  }

  const sheetCache = {};
  const valuesCache = {};
  const bColCache = {};
  const bgsCache = {};
  const notesCache = {};
  const validForecastKeys = new Set(plannedRecords.map(record => record.forecastKey).filter(Boolean));
  const neededSheets = new Set();

  plannedRecords.forEach(record => {
    const term = findTermByDate_(record.date);
    if (term) neededSheets.add(term.expenseSheet);
  });

  neededSheets.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    sheetCache[name] = sheet;
    refreshSheetCaches_(sheet, valuesCache, bColCache, bgsCache, notesCache);
  });

  clearStalePaymentForecasts_(ss, validForecastKeys);
  neededSheets.forEach(name => {
    const sheet = sheetCache[name];
    if (!sheet) return;
    refreshSheetCaches_(sheet, valuesCache, bColCache, bgsCache, notesCache);
  });

  let count = 0;
  const dirtySheets = new Set();
  plannedRecords.forEach(record => {
    const aiResult = resolveCategoryByAI_(
      [record.categoryLabel, record.summary, record.rawName].filter(Boolean).join(' '),
      'expense',
      rules
    );
    record.category = aiResult.category;
    record.confidence = aiResult.confidence;
    record.sourceType = 'planned_auto';
    record.upsertMemo = '支払い見込みを更新';
    record.allowLabelUpsertFallback = false;

    const term = findTermByDate_(record.date);
    if (!term) return;
    const targetSheet = sheetCache[term.expenseSheet];
    if (!targetSheet) return;

    const dKey = formatDateKey_(record.date);
    const baseRow = findRowByDateKey_(targetSheet, dKey, bColCache[term.expenseSheet]);
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
      valuesCache[term.expenseSheet],
      bColCache[term.expenseSheet],
      notesCache[term.expenseSheet]
    )) {
      count++;
      dirtySheets.add(term.expenseSheet);
      return;
    }

    if (writeRecordWithOverflow_(
      targetSheet,
      baseRow,
      dKey,
      record,
      CASHFLOW.COLORS.PLANNED_AUTO,
      valuesCache[term.expenseSheet],
      bColCache[term.expenseSheet],
      bgsCache[term.expenseSheet]
    )) {
      count++;
      dirtySheets.add(term.expenseSheet);
    }
  });

  dirtySheets.forEach(name => {
    const sheet = sheetCache[name];
    if (sheet) refreshSheetCaches_(sheet, valuesCache, bColCache, bgsCache, notesCache);
  });

  if (!silent) {
    try { SpreadsheetApp.getUi().alert('同期完了\n支払い一覧から ' + count + ' 件の予定を反映しました。'); } catch(e) { Logger.log(e.message); }
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
      try { SpreadsheetApp.getUi().alert('売掛入金見込み管理から新しい予定データが見つかりませんでした。'); } catch(e) { Logger.log(e.message); }
    }
    return 0;
  }

  const sheetCache = {};
  const valuesCache = {};
  const bColCache = {};
  const bgsCache = {};
  const notesCache = {};
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
    refreshSheetCaches_(sheet, valuesCache, bColCache, bgsCache, notesCache);
  });

  if (!getCashflowTestMonthFilter_()) {
    clearStaleReceivableForecasts_(ss, validForecastKeys);
  }
  neededSheets.forEach(name => {
    const sheet = sheetCache[name];
    if (!sheet) return;
    refreshSheetCaches_(sheet, valuesCache, bColCache, bgsCache, notesCache);
  });

  let count = 0;
  const dirtySheets = new Set();
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
      bColCache[term.incomeSheet],
      notesCache[term.incomeSheet]
    )) {
      count++;
      dirtySheets.add(term.incomeSheet);
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
      dirtySheets.add(term.incomeSheet);
    }
  });

  dirtySheets.forEach(name => {
    const sheet = sheetCache[name];
    if (sheet) refreshSheetCaches_(sheet, valuesCache, bColCache, bgsCache, notesCache);
  });

  if (!silent) {
    try { SpreadsheetApp.getUi().alert('同期完了\n売掛見込みから ' + count + ' 件の予定を反映しました。'); } catch(e) { Logger.log(e.message); }
  }
  return count;
}

function fetchPaymentListData_() {
  try {
    const sourceSs = SpreadsheetApp.openById(
      getCashflowSourceSpreadsheetId_(
        CASHFLOW_SETTING_KEYS.PAYMENT_SOURCE_SPREADSHEET_ID,
        CASHFLOW.PAYMENT_SOURCE.SPREADSHEET_ID
      )
    );
    const sheet = sourceSs.getSheetByName(CASHFLOW.PAYMENT_SOURCE.MASTER_SHEET_NAME || CASHFLOW.PAYMENT_SOURCE.DATA_SHEET_NAME);
    if (!sheet) return [];

    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const displayValues = dataRange.getDisplayValues();
    if (!values.length) return [];

    const headerRowIndex = displayValues.findIndex(row => row.indexOf('取引先') >= 0);
    if (headerRowIndex < 0) return [];

    const header = displayValues[headerRowIndex];
    const nameIdx = header.indexOf('取引先');
    const summaryIdx = header.indexOf('勘定科目');
    const categoryIdx = header.indexOf('区分');

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
      const categoryLabel = String(row[categoryIdx] || '').trim();
      if (!rawName) continue;

      monthCols.forEach(monthCol => {
        const amount = parseAmountValue_(row[monthCol.index]);
        if (!(amount > 0)) return;
        const parts = monthCol.ym.split('/').map(Number);
        const date = new Date(parts[0], parts[1], 0);
        const rec = {
          date,
          amount,
          direction: 'expense',
          rawName,
          summary,
          categoryLabel,
          sourceType: 'planned_auto',
          forecastKey: [
            'payment',
            monthCol.ym.replace('/', ''),
            normalizeCompareName_(rawName),
            normalizeCompareName_(summary || categoryLabel || '')
          ].join(':')
        };
        tagConquestPlannedRecord_(rec);
        records.push(rec);
      });
    }
    return filterCashflowRecordsByTestMonth_(records);
  } catch (error) {
    Logger.log('支払い一覧取得エラー: ' + error);
    return [];
  }
}

function fetchReceivableForecastData_() {
  try {
    const sourceSs = SpreadsheetApp.openById(
      getCashflowSourceSpreadsheetId_(
        CASHFLOW_SETTING_KEYS.RECEIVABLE_SOURCE_SPREADSHEET_ID,
        CASHFLOW.RECEIVABLE_SOURCE.SPREADSHEET_ID
      )
    );
    const detailSheet = sourceSs.getSheetByName(CASHFLOW.RECEIVABLE_SOURCE.DETAIL_SHEET_NAME);
    if (detailSheet && detailSheet.getLastRow() >= 2) {
      return fetchReceivableForecastDetailData_(detailSheet);
    }

    const sheet = sourceSs.getSheetByName(CASHFLOW.RECEIVABLE_SOURCE.SHEET_NAME);
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
        const conquestRec = {
          date: dueDate,
          amount: conquestAmount,
          direction: 'income',
          category: 'お客様関連',
          rawName: conquestLabel,
          sourceType: 'planned_auto',
          forecastKey: conquestKey
        };
        tagConquestPlannedRecord_(conquestRec);
        records.push(conquestRec);
      }

      if (arLabel && arAmount > 0) {
        const arKey = 'receivable:ar:' + monthKey + ':' + normalizeCompareName_(arLabel);
        const arRec = {
          date: dueDate,
          amount: arAmount,
          direction: 'income',
          category: 'お客様関連',
          rawName: arLabel,
          sourceType: 'planned_auto',
          forecastKey: arKey
        };
        tagConquestPlannedRecord_(arRec);
        records.push(arRec);
      }
    });

    return filterCashflowRecordsByTestMonth_(records);
  } catch (error) {
    Logger.log('売掛入金見込み管理 読み込みエラー: ' + error);
    return [];
  }
}

function fetchReceivableForecastDetailData_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const header = values[0].map(value => String(value || '').trim());
  const dueDateIdx = findHeaderIndexByAliases_(header, ['入金予定月末']);
  const kindIdx = findHeaderIndexByAliases_(header, ['区分']);
  const labelIdx = findHeaderIndexByAliases_(header, ['CFラベル']);
  const amountIdx = findHeaderIndexByAliases_(header, ['入金予定額']);
  const bizNoIdx = findHeaderIndexByAliases_(header, ['業務№', '業務No']);
  const custNoIdx = findHeaderIndexByAliases_(header, ['顧客№', '顧客No']);
  const billToIdx = findHeaderIndexByAliases_(header, ['請求先名']);
  const keyIdx = findHeaderIndexByAliases_(header, ['予測キー']);
  const settlementGroupIdx = findHeaderIndexByAliases_(header, ['相殺グループ']);
  const detailKindIdx = findHeaderIndexByAliases_(header, ['明細種別']);

  if ([dueDateIdx, kindIdx, labelIdx, amountIdx].some(index => index < 0)) return [];

  const records = values.slice(1).reduce(function(records, row) {
    const dueDate = row[dueDateIdx];
    const kind = String(row[kindIdx] || '').trim();
    const label = String(row[labelIdx] || '').trim();
    const amount = Number(row[amountIdx] || 0);
    if (!dueDate || !kind || !label || !(amount > 0)) return records;

    const rec = {
      date: dueDate,
      amount: amount,
      direction: 'income',
      category: kind === 'insurance' ? '保険関連' : 'お客様関連',
      rawName: label,
      sourceType: 'planned_auto',
      forecastKey: String(keyIdx >= 0 ? row[keyIdx] || '' : '').trim() || buildCashflowReceivableForecastDetailKey_({
        kind: kind,
        salesMonth: row[0],
        dueDate: dueDate,
        label: label,
        amount: amount,
        bizNo: bizNoIdx >= 0 ? row[bizNoIdx] : '',
        custNo: custNoIdx >= 0 ? row[custNoIdx] : ''
      }),
      reconcileBizNo: bizNoIdx >= 0 ? row[bizNoIdx] : '',
      reconcileCustNo: custNoIdx >= 0 ? row[custNoIdx] : '',
      reconcileBucket: kind,
      reconcileBillTo: billToIdx >= 0 ? row[billToIdx] : '',
      settlementGroup: settlementGroupIdx >= 0 ? String(row[settlementGroupIdx] || '').trim() : '',
      detailKind: detailKindIdx >= 0 ? String(row[detailKindIdx] || '').trim() : ''
    };
    tagConquestPlannedRecord_(rec);
    records.push(rec);
    return records;
  }, []);
  return filterCashflowRecordsByTestMonth_(records);
}

function isConquestActualRecord_(record) {
  if (!record || record.direction !== 'income') return false;
  const raw = [
    String(record.rawName || ''),
    String(record.originalRawName || ''),
    String(record.counterAccount || '')
  ].join(' ');
  return /コンクエスト|ｺﾝｸｴｽﾄ/i.test(raw);
}

function isConquestPlannedHay_(record) {
  if (!record) return false;
  const hay = [
    record.rawName,
    record.summary,
    record.reconcileBillTo,
    record.categoryLabel
  ].filter(Boolean).map(String).join(' ');
  return /コンクエスト|ｺﾝｸｴｽﾄ/i.test(hay);
}

function inferConquestDetailKind_(record) {
  const name = String((record && record.rawName) || '');
  if (/分割|返済|デモカー|466712/i.test(name)) return 'recurring';
  if (/紹介料/.test(name)) return 'referral_fee';
  if (/経費/.test(name)) return 'expense_invoice';
  if (/下取/.test(name)) return 'tradein_purchase';
  if (/営業部門/.test(name)) return 'sales_dept_invoice';
  if (/広島|JLR.*請求/i.test(name)) return 'jlr_invoice';
  if (/粗利|月分/.test(name)) return 'gross_invoice';
  if (/様/.test(name)) return 'jlr_detail';
  return 'conquest_misc';
}

function tagConquestPlannedRecord_(record) {
  if (!record) return record;
  if (record.settlementGroup) {
    if (!record.detailKind) record.detailKind = inferConquestDetailKind_(record);
    return record;
  }
  if (!isConquestPlannedHay_(record)) return record;
  const group = buildConquestSettlementGroupKey_(record.date);
  if (!group) return record;
  record.settlementGroup = group;
  if (!record.detailKind) record.detailKind = inferConquestDetailKind_(record);
  return record;
}

function markForecastEntriesBySettlementGroup_(sheet, direction, settlementGroup, settledKey, cachedNotes) {
  if (!sheet || !settlementGroup || sheet.getLastRow() < 2) {
    return { markedCount: 0, markedAmount: 0 };
  }
  const slots = getAllSlotsForDirection_(direction);
  if (!slots || !slots.length) return { markedCount: 0, markedAmount: 0 };

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const notesMatrix = cachedNotes || sheet.getRange(1, 1, lastRow, lastCol).getNotes();
  const stampedAt = Utilities.formatDate(new Date(), getSpreadsheetTimezone_(), 'yyyy/MM/dd HH:mm:ss');

  const targets = [];
  for (let row = 2; row <= lastRow; row++) {
    slots.forEach(function(slot) {
      const labelCol = columnLetterToIndex_(slot.label) - 1;
      const amountCol = columnLetterToIndex_(slot.amount) - 1;
      const rowNotes = notesMatrix[row - 1] || [];
      const note = String(rowNotes[labelCol] || rowNotes[amountCol] || '').trim();
      if (!note) return;

      const source = extractNoteValue_(note, 'source');
      const noteSettlementGroup = extractNoteValue_(note, 'settlementGroup');
      if (source !== 'planned_auto' || noteSettlementGroup !== settlementGroup) return;
      if (extractNoteValue_(note, 'settledKey') === settledKey) return;

      targets.push({ row: row, slot: slot, note: note, amountCol: amountCol });
    });
  }

  if (!targets.length) return { markedCount: 0, markedAmount: 0 };

  let markedAmount = 0;
  const strikeRanges = [];
  const noteUpdates = [];

  targets.forEach(function(t) {
    const labelA1 = t.slot.label + t.row;
    const amountA1 = t.slot.amount + t.row;
    strikeRanges.push(labelA1, amountA1);

    const amount = Number(sheet.getRange(amountA1).getValue() || 0);
    markedAmount += amount;

    const newNote = t.note + '\nsettled=' + stampedAt + '\nsettledKey=' + settledKey;
    noteUpdates.push({ range: labelA1, note: newNote });
    noteUpdates.push({ range: amountA1, note: newNote });
  });

  sheet.getRangeList(strikeRanges).setFontLine('line-through');

  noteUpdates.forEach(function(u) {
    sheet.getRange(u.range).setNote(u.note);
  });

  return {
    markedCount: targets.length,
    markedAmount: Math.round(markedAmount)
  };
}

function applyConquestSettlementActual_(sheet, record, cachedValues, cachedBCol, cachedBgs, cachedNotes) {
  if (!isConquestActualRecord_(record)) return false;

  const settlementGroup = buildConquestSettlementGroupKey_(record.date);
  if (!settlementGroup) return false;

  const dateKey = formatDateKey_(record.date);
  const baseRow = findRowByDateKey_(sheet, dateKey, cachedBCol);
  if (baseRow <= 0) {
    appendLog_('SKIP_NO_DATE', sheet.getName(), 0, dateKey, 'お客様関連', record.rawName, record.amount, '', 'コンクエスト相殺の日付行が見つかりません');
    return true;
  }

  const settledKey = settlementGroup + '/' + dateKey + '/' + Math.round(Number(record.amount || 0));
  const term = resolveTermBySheetName_(sheet.getName());
  let totalMarked = 0;
  let totalMarkedAmount = 0;

  if (term) {
    const ss = sheet.getParent();
    [
      { name: term.incomeSheet, dir: 'income' },
      { name: term.expenseSheet, dir: 'expense' }
    ].forEach(function(spec) {
      const target = spec.name === sheet.getName() ? sheet : ss.getSheetByName(spec.name);
      if (!target) return;
      const notes = spec.name === sheet.getName() ? cachedNotes : null;
      const marked = markForecastEntriesBySettlementGroup_(target, spec.dir, settlementGroup, settledKey, notes);
      totalMarked += marked.markedCount;
      totalMarkedAmount += marked.markedAmount;
    });
  } else {
    const marked = markForecastEntriesBySettlementGroup_(sheet, 'income', settlementGroup, settledKey, cachedNotes);
    totalMarked = marked.markedCount;
    totalMarkedAmount = marked.markedAmount;
  }

  const actualRecord = {
    date: record.date,
    amount: record.amount,
    direction: 'income',
    category: 'お客様関連',
    rawName: 'コンクエスト相殺 ' + Utilities.formatDate(new Date(record.date), getSpreadsheetTimezone_(), 'yyyy/MM'),
    originalRawName: record.rawName,
    sourceType: 'actual_auto',
    settlementGroup: settlementGroup,
    detailKind: 'settlement_actual',
    settledKey: settledKey,
    forecastKey: 'conquest_settlement_actual:' + settledKey,
    isConquestSettlement: true
  };

  const block = findDateBlock_(sheet, baseRow, dateKey, cachedBCol);
  const exactMatch = findMatchingRecordInBlock_(sheet, block.startRow, block.endRow, actualRecord, cachedValues, cachedBgs);
  if (exactMatch && exactMatch.origin === 'actual_auto') {
    appendLog_(
      'CONQUEST_SETTLEMENT_SKIP',
      sheet.getName(),
      exactMatch.row,
      dateKey,
      actualRecord.category,
      actualRecord.rawName,
      actualRecord.amount,
      exactMatch.slot.label,
      'コンクエスト相殺実績は既に反映済み'
    );
    return true;
  }

  const written = writeRecordWithOverflow_(
    sheet,
    baseRow,
    dateKey,
    actualRecord,
    CASHFLOW.COLORS.ACTUAL_AUTO,
    cachedValues,
    cachedBCol,
    cachedBgs
  );

  appendLog_(
    'CONQUEST_SETTLEMENT',
    sheet.getName(),
    baseRow,
    dateKey,
    actualRecord.category,
    actualRecord.rawName,
    actualRecord.amount,
    '',
    '相殺グループ=' + settlementGroup + ' / 予定マーク=' + totalMarked + '件 / 予定合計=' + totalMarkedAmount
  );

  return written || cleared.clearedCount > 0;
}

function syncActualWithAI(options) {
  options = options || {};
  const silent = options.silent === true;
  const startTime = Date.now();
  const TIME_LIMIT_MS = 5 * 60 * 1000;
  const CONTINUATION_KEY = 'SYNC_ACTUAL_CONTINUATION_INDEX';
  const CONTINUATION_COUNT_KEY = 'SYNC_ACTUAL_CONTINUATION_COUNT';
  const props = PropertiesService.getScriptProperties();

  const startIndex = Number(props.getProperty(CONTINUATION_KEY) || 0);
  let count = Number(props.getProperty(CONTINUATION_COUNT_KEY) || 0);
  const isContinuation = startIndex > 0;

  const ss = getCashflowTargetSpreadsheet_();
  const rules = loadCategoryRules_(ss);
  const learningMap = loadBankLearningMap_();
  const bankData = fetchBankData_(learningMap);

  const sheetCache = {};
  const valuesCache = {};
  const bColCache = {};
  const bgsCache = {};
  const notesCache = {};

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
    refreshSheetCaches_(sheet, valuesCache, bColCache, bgsCache, notesCache);
  });

  let timedOut = false;
  for (let i = startIndex; i < bankData.length; i++) {
    if (i > startIndex && i % 5 === 0 && (Date.now() - startTime) > TIME_LIMIT_MS) {
      props.setProperty(CONTINUATION_KEY, String(i));
      props.setProperty(CONTINUATION_COUNT_KEY, String(count));
      scheduleSyncActualContinuation_();
      timedOut = true;
      Logger.log('時間制限到達: ' + i + '/' + bankData.length + '件処理済み (累計' + count + '件反映)。自動継続をスケジュール。');
      break;
    }

    const record = bankData[i];
    const term = findTermByDate_(record.date);
    if (!term) continue;

    const sheetName = record.direction === 'income' ? term.incomeSheet : term.expenseSheet;
    const targetSheet = sheetCache[sheetName];
    if (!targetSheet) continue;

    if (applyConquestSettlementActual_(
      targetSheet,
      record,
      valuesCache[sheetName],
      bColCache[sheetName],
      bgsCache[sheetName],
      notesCache[sheetName]
    )) {
      count++;
      refreshSheetCaches_(targetSheet, valuesCache, bColCache, bgsCache, notesCache);
      const conquestTerm = resolveTermBySheetName_(sheetName);
      if (conquestTerm) {
        const expenseSheet = sheetCache[conquestTerm.expenseSheet] || ss.getSheetByName(conquestTerm.expenseSheet);
        if (expenseSheet) {
          sheetCache[conquestTerm.expenseSheet] = expenseSheet;
          refreshSheetCaches_(expenseSheet, valuesCache, bColCache, bgsCache, notesCache);
        }
      }
      continue;
    }

    const aiResult = resolveCategoryByAI_(record.rawName, record.direction, rules);
    record.category = aiResult.category;
    record.confidence = aiResult.confidence;
    record.sourceType = 'actual_auto';

    const dKey = formatDateKey_(record.date);
    const baseRow = findRowByDateKey_(targetSheet, dKey, bColCache[sheetName]);
    if (baseRow <= 0) {
      appendLog_('SKIP_NO_DATE', sheetName, 0, dKey, '', record.rawName, record.amount, '', '日付行が見つかりません');
      continue;
    }

    const reconciled = reconcileActualAgainstForecast_(
      targetSheet,
      baseRow,
      dKey,
      record,
      CASHFLOW.COLORS.ACTUAL_AUTO,
      valuesCache[sheetName],
      bColCache[sheetName],
      bgsCache[sheetName],
      notesCache[sheetName]
    );
    if (reconciled) {
      count++;
      continue;
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
    }
  }

  if (!timedOut) {
    props.deleteProperty(CONTINUATION_KEY);
    props.deleteProperty(CONTINUATION_COUNT_KEY);
    clearSyncActualContinuationTrigger_();

    if (!silent) {
      try { SpreadsheetApp.getUi().alert(
        '同期完了\n実績 ' + count + ' 件を反映しました。\n見込みセルのオレンジ消し込みも含みます。\n必要なら「4. 近傍重複を監査」を実行してください。'
      ); } catch(e) { Logger.log(e.message); }
    }
  }
  return count;
}

function syncActualWithAIContinuation_() {
  syncActualWithAI({ silent: true });
}

function scheduleSyncActualContinuation_() {
  clearSyncActualContinuationTrigger_();
  ScriptApp.newTrigger('syncActualWithAIContinuation_')
    .timeBased()
    .after(10 * 1000)
    .create();
}

function clearSyncActualContinuationTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'syncActualWithAIContinuation_') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function reconcileActualAgainstForecast_(sheet, baseRow, dKey, record, bgColor, cachedValues, cachedBCol, cachedBgs, cachedNotes) {
  if (record.sourceType !== 'actual_auto') return false;

  const candidate = findForecastMatchOnSheet_(sheet, baseRow, dKey, record, cachedValues, cachedBCol, cachedBgs, cachedNotes);
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
      .openById(
        getCashflowSourceSpreadsheetId_(
          CASHFLOW_SETTING_KEYS.ACTUAL_SOURCE_SPREADSHEET_ID,
          CASHFLOW.ACTUAL_SOURCE.SPREADSHEET_ID
        )
      )
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
    const bizNoIdx = findHeaderIndexByAliases_(header, ['業務No.', '業務No', '業務№']);
    const custNoIdx = findHeaderIndexByAliases_(header, ['顧客No.', '顧客No', '顧客№']);

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
        transactionNo: number,
        bizNo: bizNoIdx >= 0 ? String(row[bizNoIdx] || '').trim() : '',
        custNo: custNoIdx >= 0 ? String(row[custNoIdx] || '').trim() : ''
      };

      const dedupKey = buildCashflowActualDedupKey_(record);
      if (!dedupKey) return null;

      if (!bestByKey[dedupKey] || scoreBankActualRecord_(record) > scoreBankActualRecord_(bestByKey[dedupKey])) {
        bestByKey[dedupKey] = record;
      }
      return null;
    });

    const records = Object.keys(bestByKey)
      .map(function (key) { return bestByKey[key]; })
      .sort(function (a, b) {
        const left = new Date(a.date).getTime();
        const right = new Date(b.date).getTime();
        return left - right || a.amount - b.amount || String(a.rawName || '').localeCompare(String(b.rawName || ''));
      });
    return filterCashflowRecordsByTestMonth_(records);
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
    if (record.isConquestSettlement) {
      if (exactMatch.origin === 'actual_auto') {
        appendLog_('SKIP_DUP', sheet.getName(), baseRow, dKey, record.category, record.rawName, record.amount, '', 'コンクエスト相殺実績は既に反映済み');
        return false;
      }
    } else if (record.sourceType === 'actual_auto' && exactMatch.origin !== 'actual_auto') {
      overwriteSlotWithRecord_(sheet, exactMatch.row, exactMatch.slot, record, bgColor, { previousLabel: exactMatch.name });
      appendLog_('ACTUAL_CONVERT', sheet.getName(), exactMatch.row, dKey, record.category, record.rawName, record.amount, exactMatch.slot.label, '同日既存見込みを実績へ変換');
      return true;
    } else {
      appendLog_('SKIP_DUP', sheet.getName(), baseRow, dKey, record.category, record.rawName, record.amount, '', '同日重複のためスキップ');
      return false;
    }
  }

  if (record.sourceType === 'actual_auto' && !record.isConquestSettlement) {
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
  if (record.sourceType === 'actual_auto' && nearby && nearby.origin === 'manual_or_other') {
    overwriteSlotWithRecord_(sheet, nearby.row, nearby.slot, record, bgColor, {
      previousLabel: nearby.name,
      appendNote: '近傍日手入力を実績へ変換'
    });
    appendLog_(
      'ACTUAL_NEAR_CONVERT',
      sheet.getName(),
      nearby.row,
      nearby.dateKey,
      record.category,
      record.rawName,
      record.amount,
      nearby.slot.label,
      '近傍日手入力を実績へ変換'
    );
    return true;
  }
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

function tryWriteToCategorySection_(sheet, rowIndex, record, bgColor, cacheRefs) {
  const slots = CASHFLOW.SLOT_MAP?.[record.direction]?.[record.category];
  if (!slots || !slots.length) return { status: 'no_slot', col: '' };

  const cachedValues = cacheRefs && cacheRefs.valuesCache ? cacheRefs.valuesCache[sheet.getName()] : null;

  for (const slot of slots) {
    if (cachedValues && cachedValues[rowIndex - 1]) {
      const labelIdx = columnLetterToIndex_(slot.label) - 1;
      const amountIdx = columnLetterToIndex_(slot.amount) - 1;
      const nameValue = String(cachedValues[rowIndex - 1][labelIdx] || '').trim();
      const amountValue = String(cachedValues[rowIndex - 1][amountIdx] || '').trim();
      if (nameValue || amountValue) continue;
    } else {
      const nameCell = sheet.getRange(slot.label + rowIndex);
      const amountCell = sheet.getRange(slot.amount + rowIndex);
      if (nameCell.isPartOfMerge() || amountCell.isPartOfMerge()) continue;
      if (nameCell.getFormula() || amountCell.getFormula()) continue;
      const nameValue = String(nameCell.getDisplayValue() || '').trim();
      const amountValue = String(amountCell.getDisplayValue() || '').trim();
      if (nameValue || amountValue) continue;
    }

    overwriteSlotWithRecord_(sheet, rowIndex, slot, record, bgColor, null, cacheRefs);
    return { status: 'written', col: slot.label };
  }
  return { status: 'section_full', col: '' };
}

function overwriteSlotWithRecord_(sheet, rowIndex, slot, record, bgColor, options, cacheRefs) {
  const previousLabel = options && options.previousLabel ? String(options.previousLabel) : '';
  const previousAmount = options && options.previousAmount ? Number(options.previousAmount) : 0;
  const noteLines = [];
  if (previousLabel) noteLines.push('previousLabel=' + previousLabel);
  if (previousAmount) noteLines.push('previousAmount=' + previousAmount);
  const note = buildAutoWriteNote_(record, noteLines);

  const labelCol = columnLetterToIndex_(slot.label);
  const amountCol = columnLetterToIndex_(slot.amount);
  const numCols = amountCol - labelCol + 1;
  const batchRange = sheet.getRange(rowIndex, labelCol, 1, numCols);

  const vals = new Array(numCols).fill('');
  vals[0] = record.rawName;
  vals[numCols - 1] = record.amount;
  batchRange.setValues([vals]);

  const bgs = new Array(numCols).fill(bgColor);
  batchRange.setBackgrounds([bgs]);

  const notes = new Array(numCols).fill('');
  notes[0] = note;
  notes[numCols - 1] = note;
  batchRange.setNotes([notes]);

  batchRange.setFontWeight('normal').setFontColor('#000000');

  if (cacheRefs) {
    updateCacheAfterSlotWrite_(
      sheet.getName(), rowIndex, slot, record, bgColor, note,
      cacheRefs.valuesCache, cacheRefs.bgsCache, cacheRefs.notesCache
    );
  }
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

function findForecastMatchOnSheet_(sheet, baseRow, dKey, record, cachedValues, cachedBCol, cachedBgs, cachedNotes) {
  const term = resolveTermBySheetName_(sheet.getName());
  if (!term) return null;

  const targetDate = parseDateKeyWithinTerm_(dKey, term);
  const targetAmount = Number(record.amount);
  const targetName = normalizeCompareName_(record.rawName);
  const targetBizNo = normalizeIdentifier_(record.bizNo);
  const targetCustNo = normalizeIdentifier_(record.custNo);
  if (!targetDate || !targetAmount) return null;

  const categories = CASHFLOW.SLOT_MAP?.[record.direction] || {};
  const candidates = [];
  const nearbyDateKeys = buildNearbyDateKeySet_(targetDate);
  const candidateRows = [];
  const lastRow = cachedBCol ? cachedBCol.length : sheet.getLastRow();

  for (let row = 1; row <= lastRow; row++) {
    const rowDateKey = cachedBCol
      ? String(cachedBCol[row - 1] || '').trim()
      : String(sheet.getRange(row, 2).getDisplayValue() || '').trim();
    if (!nearbyDateKeys.has(rowDateKey)) continue;
    candidateRows.push({ row: row, dateKey: rowDateKey });
  }

  Object.keys(categories).forEach(category => {
    categories[category].forEach(slot => {
      candidateRows.forEach(function(candidateRow) {
        const row = candidateRow.row;
        const rowDateKey = candidateRow.dateKey;
        const rowDate = parseDateKeyWithinTerm_(rowDateKey, term);
        if (!rowDate) return;

        const dayDiff = Math.abs(daysBetween_(rowDate, targetDate));
        if (dayDiff > CASHFLOW.DUPLICATE.NEARBY_DAY_WINDOW) return;

        const name = getCachedCellString_(sheet, row, slot.label, cachedValues);
        const amount = getCachedCellNumber_(sheet, row, slot.amount, cachedValues);
        if (!name || !Number(amount)) return;

        const origin = getCachedSlotOrigin_(row, slot, cachedBgs);
        if (origin === 'actual_auto') return;

        const bgPair = getCachedSlotBackgrounds_(row, slot, cachedBgs);
        const manualForecast = isManualForecastColor_(bgPair.nameBg) || isManualForecastColor_(bgPair.amountBg);
        const plannedAuto = origin === 'planned_auto';
        const normalizedName = normalizeCompareName_(name);
        const nameScore = calculateNameSimilarityScore_(targetName, normalizedName);
        const amountScore = calculateAmountClosenessScore_(targetAmount, Number(amount));
        const sameDay = dayDiff === 0;
        const note = getCachedSlotNote_(row, slot, cachedNotes);
        const candidateBizNo = normalizeIdentifier_(extractNoteValue_(note, 'bizNo'));
        const candidateCustNo = normalizeIdentifier_(extractNoteValue_(note, 'custNo'));
        let identifierBoost = 0;

        if (targetBizNo && candidateBizNo) {
          if (targetBizNo !== candidateBizNo) return;
          identifierBoost += 5000;
        } else if (targetCustNo && candidateCustNo) {
          if (targetCustNo !== candidateCustNo) return;
          identifierBoost += 2500;
        }

        if (!isForecastReconcileCandidate_(nameScore, amountScore, dayDiff, manualForecast, plannedAuto)) return;

        candidates.push({
          row,
          slot,
          name,
          amount,
          category,
          dateKey: rowDateKey,
          score:
            identifierBoost +
            (sameDay ? 2000 : 0) +
            Math.round(nameScore * 1000) +
            Math.round(amountScore * 250) +
            (plannedAuto ? 30 : 0) +
            (manualForecast ? 20 : 0) -
            (dayDiff * 50)
        });
      });
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
  const nearbyDateKeys = buildNearbyDateKeySet_(targetDate);
  for (let row = 1; row <= lastRow; row++) {
    if (excludeStartRow && excludeEndRow && row >= excludeStartRow && row <= excludeEndRow) continue;

    const dateKey = cachedBCol
      ? String(cachedBCol[row - 1] || '').trim()
      : String(sheet.getRange(row, 2).getDisplayValue()).trim();
    if (!nearbyDateKeys.has(dateKey)) continue;
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
        slot: slot,
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

function buildNearbyDateKeySet_(dateValue) {
  const baseDate = new Date(dateValue);
  const keys = new Set();
  [-1, 0, 1].forEach(function(offset) {
    const cursor = new Date(baseDate);
    cursor.setDate(cursor.getDate() + offset);
    keys.add(formatDateKey_(cursor));
  });
  return keys;
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

function normalizeIdentifier_(text) {
  let value = String(text || '').trim();
  if (!value) return '';
  if (value.normalize) value = value.normalize('NFKC');
  return value.toUpperCase().replace(/\s+/g, '');
}

function buildCashflowReceivableForecastDetailKey_(payload) {
  const salesMonth = payload.salesMonth
    ? Utilities.formatDate(new Date(payload.salesMonth), getSpreadsheetTimezone_(), 'yyyyMM')
    : '';
  const dueKey = payload.dueDate
    ? Utilities.formatDate(new Date(payload.dueDate), getSpreadsheetTimezone_(), 'yyyyMMdd')
    : '';
  const identity = normalizeIdentifier_(payload.bizNo || payload.custNo || '') || normalizeCompareName_(payload.label || '');
  return [
    'receivable',
    String(payload.kind || '').trim(),
    salesMonth,
    dueKey,
    identity,
    Math.round(Number(payload.amount || 0))
  ].join(':');
}

function buildConquestSettlementGroupKey_(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (isNaN(date.getTime())) return '';
  return 'CONQUEST:' + Utilities.formatDate(date, getSpreadsheetTimezone_(), 'yyyy-MM');
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
  installCashflowWorkflowOpenTrigger_();
  ensureCashflowWorkflowReady_();
  Logger.log('セットアップ完了: 修正ログ・近傍重複監査シートを初期化しました。');
}

const CONQUEST_MARCH_TEST_SOURCES = {
  sales: { name: '営業用', id: '1QNctVAnkattCX9dyT9DBmaPXWF9-nsfmZwEtEp4t1R8' },
  intake: { name: '【最新】入金一覧', id: '1wX6LR1ssqThgPAIHRyUNeuvROsnXqDMcwFbMCj1PB8M' },
  payments: { name: '支払一覧', id: '12Z7hFDO9f8JMTdVYqNCx_1QbgjXmoAqWYJDiUkakuHE' },
  cashflow: { name: 'キャッシュフロー表0515', id: '1KrtufPs4-1ZsEGPp9j9PCpYpg0knXGW5jMqospmI7UU' }
};

function setupConquestMarchTestCopies_() {
  const tag = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  const prefix = '[TEST_2026-03_' + tag + '] ';
  const copied = {};

  const copyKeys = ['intake', 'payments', 'cashflow'];
  copyKeys.forEach(function(key) {
    const source = CONQUEST_MARCH_TEST_SOURCES[key];
    const file = DriveApp.getFileById(source.id);
    const copy = file.makeCopy(prefix + source.name);
    copied[key] = {
      key: key,
      name: source.name,
      id: copy.getId(),
      url: 'https://docs.google.com/spreadsheets/d/' + copy.getId() + '/edit'
    };
  });

  const props = PropertiesService.getScriptProperties();
  props.setProperty(CASHFLOW_SETTING_KEYS.TARGET_SPREADSHEET_ID, copied.cashflow.id);
  props.setProperty(CASHFLOW_SETTING_KEYS.ACTUAL_SOURCE_SPREADSHEET_ID, copied.intake.id);
  props.setProperty(CASHFLOW_SETTING_KEYS.RECEIVABLE_SOURCE_SPREADSHEET_ID, copied.intake.id);
  props.setProperty(CASHFLOW_SETTING_KEYS.PAYMENT_SOURCE_SPREADSHEET_ID, copied.payments.id);
  props.setProperty(CASHFLOW_SETTING_KEYS.TEST_MONTH, '2026/03');

  writeConquestMarchTestSettings_(copied);
  writeConquestMarchTestManifest_(copied, prefix);

  const report = [
    'ステップ1完了: 複製作成 + ScriptProperty設定済み',
    'タグ: ' + prefix,
    '複製CF: ' + copied.cashflow.url,
    '複製入金一覧: ' + copied.intake.url,
    '複製支払一覧: ' + copied.payments.url,
    '次: setupConquestMarchTestRefresh を実行してください'
  ].join('\n');
  Logger.log(report);
  return { tag: prefix, copied: copied };
}

function setupConquestMarchTestRefresh_() {
  ensureCashflowWorkflowReady_();
  const result = runCashflowRefresh_({ silent: true });
  const cfId = PropertiesService.getScriptProperties().getProperty(CASHFLOW_SETTING_KEYS.TARGET_SPREADSHEET_ID) || '';
  const cfUrl = cfId ? 'https://docs.google.com/spreadsheets/d/' + cfId + '/edit' : '(ID不明)';
  const report = [
    'ステップ2完了: CF反映実行',
    '対象CF: ' + cfUrl,
    '支払い予定=' + result.plannedExpenseCount + '件',
    '入金予定=' + result.plannedIncomeCount + '件',
    '銀行実績=' + result.actualCount + '件',
    '確認後: clearConquestMarchTestScriptProperties を実行して本番に戻す'
  ].join('\n');
  Logger.log(report);
  return result;
}

function setupConquestMarchTestCopies() {
  return setupConquestMarchTestCopies_();
}

function setupConquestMarchTestRefresh() {
  return setupConquestMarchTestRefresh_();
}

function setupConquestMarchTest_() {
  setupConquestMarchTestCopies_();
  setupConquestMarchTestRefresh_();
}

function setupConquestMarchTest() {
  PropertiesService.getScriptProperties().setProperty(CASHFLOW_SETTING_KEYS.TEST_MONTH, '2026/03');
  ensureCashflowWorkflowReady_();
  const count = syncPlannedIncomeFromReceivableForecast({ silent: true });
  Logger.log('入金予定反映完了: ' + count + '件（2026/03 のみ）');
  return count;
}

function clearConquestMarchTestScriptProperties() {
  const props = PropertiesService.getScriptProperties();
  [
    CASHFLOW_SETTING_KEYS.TARGET_SPREADSHEET_ID,
    CASHFLOW_SETTING_KEYS.ACTUAL_SOURCE_SPREADSHEET_ID,
    CASHFLOW_SETTING_KEYS.RECEIVABLE_SOURCE_SPREADSHEET_ID,
    CASHFLOW_SETTING_KEYS.PAYMENT_SOURCE_SPREADSHEET_ID,
    CASHFLOW_SETTING_KEYS.TEST_MONTH
  ].forEach(function(key) { props.deleteProperty(key); });
  Logger.log('テスト用ScriptPropertyを削除しました。本番ターゲットに戻ります。');
}

function writeConquestMarchTestSettings_(copied) {
  const ss = SpreadsheetApp.openById(copied.cashflow.id);
  let sheet = ss.getSheetByName(CASHFLOW.SHEETS.SETTINGS);
  if (!sheet) sheet = ss.insertSheet(CASHFLOW.SHEETS.SETTINGS);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 3).setValues([['キー', '値', 'メモ']]).setBackground('#efefef').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  const rowMap = {};
  if (sheet.getLastRow() >= 2) {
    const existing = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    existing.forEach(function(row, idx) {
      const key = String(row[0] || '').trim();
      if (key) rowMap[key] = idx + 2;
    });
  }

  const settings = [
    [CASHFLOW_SETTING_KEYS.TARGET_SPREADSHEET_ID, copied.cashflow.id, 'CF反映先（テスト複製）'],
    [CASHFLOW_SETTING_KEYS.ACTUAL_SOURCE_SPREADSHEET_ID, copied.intake.id, '銀行実績ソース（テスト複製）'],
    [CASHFLOW_SETTING_KEYS.RECEIVABLE_SOURCE_SPREADSHEET_ID, copied.intake.id, '売掛見込みソース（テスト複製）'],
    [CASHFLOW_SETTING_KEYS.PAYMENT_SOURCE_SPREADSHEET_ID, copied.payments.id, '支払い予定ソース（テスト複製）'],
    [CASHFLOW_SETTING_KEYS.TEST_MONTH, '2026/03', '月絞り（YYYY/MM）']
  ];

  settings.forEach(function(row) {
    const rowNumber = rowMap[row[0]];
    if (rowNumber) {
      sheet.getRange(rowNumber, 1, 1, 3).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
  });
}

function writeConquestMarchTestManifest_(copied, prefix) {
  const ss = SpreadsheetApp.openById(copied.cashflow.id);
  let sheet = ss.getSheetByName('テスト環境情報');
  if (!sheet) sheet = ss.insertSheet('テスト環境情報');
  else sheet.clearContents();

  const cols = 4;
  const rows = [
    ['作成タグ', prefix, '', ''],
    ['種別', '元ファイル名', '複製ID', '複製URL']
  ];
  Object.keys(copied).forEach(function(key) {
    const item = copied[key];
    rows.push([key, item.name, item.id, item.url]);
  });
  sheet.getRange(1, 1, rows.length, cols).setValues(rows);
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
          const recurringRecord = {
            direction: rule.dir,
            category: rule.cat,
            rawName: rule.name,
            amount: rule.amt,
            summary: rule.summary,
            sourceType: 'planned_auto',
            date: parseDateKeyWithinTerm_(dKey, term) || new Date(),
            forecastKey: [
              'recurring',
              term.key,
              dKey,
              normalizeCompareName_(rule.name),
              Math.round(Number(rule.amt || 0))
            ].join(':')
          };
          tagConquestPlannedRecord_(recurringRecord);
          writeRecordWithOverflow_(targetSheet, baseRow, dKey, recurringRecord, CASHFLOW.COLORS.PLANNED_AUTO);
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
  ensureCashflowWorkflowReady_();
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
    const ss = SpreadsheetApp.openById(
      getCashflowSourceSpreadsheetId_(
        CASHFLOW_SETTING_KEYS.ACTUAL_SOURCE_SPREADSHEET_ID,
        CASHFLOW.ACTUAL_SOURCE.SPREADSHEET_ID
      )
    );
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
  if (record.reconcileBizNo) {
    lines.push('bizNo=' + String(record.reconcileBizNo));
  }
  if (record.reconcileCustNo) {
    lines.push('custNo=' + String(record.reconcileCustNo));
  }
  if (record.reconcileBucket) {
    lines.push('bucket=' + String(record.reconcileBucket));
  }
  if (record.reconcileBillTo) {
    lines.push('billTo=' + String(record.reconcileBillTo));
  }
  if (record.settlementGroup) {
    lines.push('settlementGroup=' + String(record.settlementGroup));
  }
  if (record.detailKind) {
    lines.push('detailKind=' + String(record.detailKind));
  }
  (extraLines || []).forEach(line => {
    if (line) lines.push(String(line));
  });
  return lines.join('\n');
}

function refreshSheetCaches_(sheet, valuesCache, bColCache, bgsCache, notesCache) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return;
  valuesCache[sheet.getName()] = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  bColCache[sheet.getName()] = sheet.getRange(1, 2, lastRow, 1).getDisplayValues().map(row => row[0]);
  bgsCache[sheet.getName()] = sheet.getRange(1, 1, lastRow, lastCol).getBackgrounds();
  if (notesCache) {
    notesCache[sheet.getName()] = sheet.getRange(1, 1, lastRow, lastCol).getNotes();
  }
}

function updateCacheAfterSlotWrite_(sheetName, rowIndex, slot, record, bgColor, note, valuesCache, bgsCache, notesCache) {
  const labelIdx = columnLetterToIndex_(slot.label) - 1;
  const amountIdx = columnLetterToIndex_(slot.amount) - 1;
  const rowIdx = rowIndex - 1;

  if (valuesCache && valuesCache[sheetName] && valuesCache[sheetName][rowIdx]) {
    valuesCache[sheetName][rowIdx][labelIdx] = record.rawName;
    valuesCache[sheetName][rowIdx][amountIdx] = record.amount;
  }
  if (bgsCache && bgsCache[sheetName] && bgsCache[sheetName][rowIdx]) {
    bgsCache[sheetName][rowIdx][labelIdx] = bgColor;
    bgsCache[sheetName][rowIdx][amountIdx] = bgColor;
  }
  if (notesCache && notesCache[sheetName] && notesCache[sheetName][rowIdx]) {
    notesCache[sheetName][rowIdx][labelIdx] = note;
    notesCache[sheetName][rowIdx][amountIdx] = note;
  }
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

function getCachedSlotNote_(row, slot, cachedNotes) {
  if (!cachedNotes) return '';
  const rowNotes = cachedNotes[row - 1] || [];
  const labelNote = String(rowNotes[columnLetterToIndex_(slot.label) - 1] || '').trim();
  if (labelNote) return labelNote;
  return String(rowNotes[columnLetterToIndex_(slot.amount) - 1] || '').trim();
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

function parseAmountValue_(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = String(value == null ? '' : value).trim();
  if (!raw) return 0;

  const normalized = raw
    .replace(/[¥,]/g, '')
    .replace(/\s+/g, '')
    .replace(/[△▲]/g, '-')
    .replace(/[()]/g, function(token) {
      return token === '(' ? '-' : '';
    });
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function upsertForecastRecordByKey_(sheet, baseRow, dKey, record, bgColor, cachedValues, cachedBCol, cachedNotes) {
  const block = findDateBlock_(sheet, baseRow, dKey, cachedBCol);
  const slots = CASHFLOW.SLOT_MAP?.[record.direction]?.[record.category] || [];
  const targetKey = String(record.forecastKey || '').trim();
  const targetName = normalizeCompareName_(record.rawName);

  for (let row = block.startRow; row <= block.endRow; row++) {
    for (const slot of slots) {
      const note = getCachedSlotNote_(row, slot, cachedNotes);
      const existingName = getCachedCellString_(sheet, row, slot.label, cachedValues);
      if (!note && !existingName) continue;

      const existingKey = extractNoteValue_(note, 'forecastKey');
      const source = extractNoteValue_(note, 'source');
      const samePlannedLabel = record.allowLabelUpsertFallback !== false &&
        source === 'planned_auto' &&
        normalizeCompareName_(existingName) === targetName;
      if (existingKey !== targetKey && !samePlannedLabel) continue;

      overwriteSlotWithRecord_(sheet, row, slot, record, bgColor);
      appendLog_('PLAN_UPSERT', sheet.getName(), row, dKey, record.category, record.rawName, record.amount, slot.label, record.upsertMemo || '見込みを更新');
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
    clearStaleForecastCellsOnSheet_(sheet, getAllSlotsForDirection_('income'), validSet, 'receivable:');
  });
}

function clearStalePaymentForecasts_(ss, validForecastKeys) {
  const validSet = validForecastKeys instanceof Set ? validForecastKeys : new Set(validForecastKeys || []);
  CASHFLOW.TERMS.forEach(term => {
    const sheet = ss.getSheetByName(term.expenseSheet);
    if (!sheet || sheet.getLastRow() < 2) return;
    clearStaleForecastCellsOnSheet_(sheet, getAllSlotsForDirection_('expense'), validSet, 'payment:');
  });
}

function clearStaleForecastCellsOnSheet_(sheet, slots, validSet, prefix) {
  if (!sheet || !slots || !slots.length) return;

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return;

  const notes = sheet.getRange(1, 1, lastRow, lastCol).getNotes();
  const targets = [];

  for (let row = 2; row <= lastRow; row++) {
    for (const slot of slots) {
      const labelCol = columnLetterToIndex_(slot.label) - 1;
      const amountCol = columnLetterToIndex_(slot.amount) - 1;
      const note = String((notes[row - 1] || [])[labelCol] || (notes[row - 1] || [])[amountCol] || '');
      const forecastKey = extractNoteValue_(note, 'forecastKey');
      if (!forecastKey || forecastKey.indexOf(prefix) !== 0) continue;
      if (validSet.has(forecastKey)) continue;
      targets.push({ row, slot });
    }
  }

  targets.forEach(target => {
    const labelCell = sheet.getRange(target.slot.label + target.row);
    const amountCell = sheet.getRange(target.slot.amount + target.row);
    labelCell.clearContent().setBackground(null).setFontWeight('normal').setFontColor('#000000').setFontLine('none').setNote('');
    amountCell.clearContent().setBackground(null).setFontWeight('normal').setFontColor('#000000').setFontLine('none').setNote('');
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
