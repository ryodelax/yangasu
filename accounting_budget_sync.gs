const ACCOUNTING_BUDGET_SYNC = {
  spreadsheetId: '1wZRQb9Kx0-JNb6I9BugTNZRS3XbuzwS3RbjMdLa28Ic',
  sheets: {
    dailyInput: '日次入力',
    transactionLog: '取引ログ',
    categorySettings: 'カテゴリ設定',
    appLinkage: 'アプリ取引連携'
  },
  importPrefix: 'BudgetOrbit:'
};

function isAccountingBudgetSpreadsheet_(spreadsheet) {
  return !!spreadsheet && spreadsheet.getId() === ACCOUNTING_BUDGET_SYNC.spreadsheetId;
}

function openAccountingBudgetMenu_() {
  const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!isAccountingBudgetSpreadsheet_(activeSpreadsheet)) {
    return;
  }
  buildAccountingBudgetMenu_();
}

function buildAccountingBudgetMenu_() {
  const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!isAccountingBudgetSpreadsheet_(activeSpreadsheet)) {
    return;
  }

  SpreadsheetApp.getUi()
    .createMenu('Budget連携')
    .addItem('アプリ取引を日次入力へ反映', 'syncBudgetOrbitTransactionsToDailyInput')
    .addItem('取引ログの連携式を再設定', 'repairBudgetOrbitTransactionLogFormula')
    .addToUi();
}

function installAccountingBudgetOpenTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (
      trigger.getHandlerFunction &&
      trigger.getHandlerFunction() === 'openAccountingBudgetMenu_' &&
      trigger.getTriggerSourceId &&
      trigger.getTriggerSourceId() === ACCOUNTING_BUDGET_SYNC.spreadsheetId
    ) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('openAccountingBudgetMenu_')
    .forSpreadsheet(ACCOUNTING_BUDGET_SYNC.spreadsheetId)
    .onOpen()
    .create();

  return '経理管理台帳の onOpen トリガーを再設定しました。';
}

function repairBudgetOrbitTransactionLogFormula() {
  const spreadsheet = SpreadsheetApp.openById(ACCOUNTING_BUDGET_SYNC.spreadsheetId);
  ensureBudgetOrbitTransactionLogFormula_(spreadsheet);
  SpreadsheetApp.getUi().alert('取引ログの連携式を再設定しました。');
}

function syncBudgetOrbitTransactionsToDailyInput() {
  const spreadsheet = SpreadsheetApp.openById(ACCOUNTING_BUDGET_SYNC.spreadsheetId);
  const appSheet = spreadsheet.getSheetByName(ACCOUNTING_BUDGET_SYNC.sheets.appLinkage);
  const dailySheet = spreadsheet.getSheetByName(ACCOUNTING_BUDGET_SYNC.sheets.dailyInput);
  const settingsSheet = spreadsheet.getSheetByName(ACCOUNTING_BUDGET_SYNC.sheets.categorySettings);

  if (!appSheet || !dailySheet || !settingsSheet) {
    throw new Error('必要なシートが見つかりません。');
  }

  const appValues = appSheet.getDataRange().getValues();
  if (appValues.length <= 1) {
    SpreadsheetApp.getUi().alert('アプリ取引連携に反映対象がありません。');
    return;
  }

  const categoryMap = buildBudgetAppCategoryMap_(settingsSheet);
  const importedIds = getImportedBudgetOrbitIds_(dailySheet);
  const sourceRows = appValues.slice(1).filter(function(row) {
    const id = String(row[0] || '').trim();
    return id && !importedIds[id];
  });

  if (!sourceRows.length) {
    ensureBudgetOrbitTransactionLogFormula_(spreadsheet);
    SpreadsheetApp.getUi().alert('未反映のアプリ取引はありません。');
    return;
  }

  const startRow = findFirstWritableDailyInputRow_(dailySheet);
  const payload = sourceRows.map(function(row) {
    const id = String(row[0] || '').trim();
    const appDate = normalizeBudgetSyncDate_(row[1]);
    const appType = String(row[2] || '').trim();
    const appCategory = String(row[3] || '').trim();
    const amount = Number(row[4]) || 0;
    const note = String(row[5] || '').trim();
    const linkedCategory = resolveBudgetLinkedCategory_(appType, appCategory, categoryMap);

    return {
      date: appDate,
      category: linkedCategory,
      detail: note || appCategory || 'BudgetOrbit',
      amount: amount,
      memo: ACCOUNTING_BUDGET_SYNC.importPrefix + id
    };
  });

  writeBudgetSyncPayloadToDailyInput_(dailySheet, startRow, payload);
  ensureBudgetOrbitTransactionLogFormula_(spreadsheet);

  SpreadsheetApp.getUi().alert(payload.length + '件を日次入力へ反映しました。');
}

function buildBudgetAppCategoryMap_(settingsSheet) {
  const values = settingsSheet.getRange(2, 10, Math.max(settingsSheet.getLastRow() - 1, 0), 4).getValues();
  const map = {};

  values.forEach(function(row) {
    const appCategory = String(row[0] || '').trim();
    const linkedCategory = String(row[3] || '').trim();
    if (appCategory) {
      map[appCategory] = linkedCategory || appCategory;
    }
  });

  return map;
}

function getImportedBudgetOrbitIds_(dailySheet) {
  const lastRow = dailySheet.getMaxRows();
  const remarks = dailySheet.getRange(2, 11, Math.max(lastRow - 1, 0), 1).getDisplayValues();
  const ids = {};

  remarks.forEach(function(row) {
    const value = String(row[0] || '').trim();
    if (value.indexOf(ACCOUNTING_BUDGET_SYNC.importPrefix) === 0) {
      ids[value.slice(ACCOUNTING_BUDGET_SYNC.importPrefix.length)] = true;
    }
  });

  return ids;
}

function findFirstWritableDailyInputRow_(dailySheet) {
  const values = dailySheet.getRange(2, 1, dailySheet.getMaxRows() - 1, 11).getDisplayValues();

  for (var index = 0; index < values.length; index += 1) {
    var row = values[index];
    if (!row[0] && !row[3] && !row[4] && !row[5] && !row[10]) {
      return index + 2;
    }
  }

  throw new Error('日次入力の空き行が見つかりません。');
}

function normalizeBudgetSyncDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return value;
  }

  if (typeof value === 'string' && value) {
    var parts = value.split(/[-/]/).map(function(item) { return Number(item); });
    if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
  }

  throw new Error('アプリ取引連携の日付が不正です。');
}

function resolveBudgetLinkedCategory_(appType, appCategory, categoryMap) {
  if (appType === 'income') {
    return categoryMap[appCategory] || '事業売上';
  }

  return categoryMap[appCategory] || '要確認';
}

function writeBudgetSyncPayloadToDailyInput_(dailySheet, startRow, payload) {
  dailySheet.getRange(startRow, 1, payload.length, 1).setValues(payload.map(function(item) { return [item.date]; }));
  dailySheet.getRange(startRow, 4, payload.length, 1).setValues(payload.map(function(item) { return [item.category]; }));
  dailySheet.getRange(startRow, 5, payload.length, 1).setValues(payload.map(function(item) { return [item.detail]; }));
  dailySheet.getRange(startRow, 6, payload.length, 1).setValues(payload.map(function(item) { return [item.amount]; }));
  dailySheet.getRange(startRow, 11, payload.length, 1).setValues(payload.map(function(item) { return [item.memo]; }));
}

function ensureBudgetOrbitTransactionLogFormula_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(ACCOUNTING_BUDGET_SYNC.sheets.transactionLog);
  if (!sheet) {
    throw new Error('取引ログシートが見つかりません。');
  }

  sheet.getRange('A2').setFormula(buildBudgetOrbitTransactionLogFormula_());
  sheet.getRange('J2').setFormula('=ARRAYFORMULA(IF(A2:A="","",IF(B2:B="BudgetOrbit",IF(D2:D="収入","収入",IFNA(VLOOKUP(E2:E,\'カテゴリ設定\'!K:L,2,FALSE),"要確認")),IF(D2:D="収入","収入",IF(D2:D="支出","事業経費","")))))');
  sheet.getRange('K2').setFormula('=ARRAYFORMULA(IF(A2:A="","",IF(B2:B="BudgetOrbit",IFNA(VLOOKUP(E2:E,\'カテゴリ設定\'!J:M,4,FALSE),E2:E),E2:E)))');
}

function buildBudgetOrbitTransactionLogFormula_() {
  return '=ARRAYFORMULA(QUERY({' +
    '{' +
      'IF((\'日次入力\'!A2:A="")+(' +
      '\'日次入力\'!K2:K="既存データ移行"),"",ROW(\'日次入力\'!A2:A)+100000),' +
      'IF((\'日次入力\'!A2:A="")+(' +
      '\'日次入力\'!K2:K="既存データ移行"),"","Daily_Input"),' +
      'IF((\'日次入力\'!A2:A="")+(' +
      '\'日次入力\'!K2:K="既存データ移行"),"",\'日次入力\'!A2:A),' +
      'IF((\'日次入力\'!A2:A="")+(' +
      '\'日次入力\'!K2:K="既存データ移行"),"",\'日次入力\'!C2:C),' +
      'IF((\'日次入力\'!A2:A="")+(' +
      '\'日次入力\'!K2:K="既存データ移行"),"",\'日次入力\'!D2:D),' +
      'IF((\'日次入力\'!A2:A="")+(' +
      '\'日次入力\'!K2:K="既存データ移行"),"",\'日次入力\'!E2:E),' +
      'IF((\'日次入力\'!A2:A="")+(' +
      '\'日次入力\'!K2:K="既存データ移行"),"",\'日次入力\'!J2:J),' +
      'IF((\'日次入力\'!A2:A="")+(' +
      '\'日次入力\'!K2:K="既存データ移行"),"",""),' +
      'IF((\'日次入力\'!A2:A="")+(' +
      '\'日次入力\'!K2:K="既存データ移行"),"",DATE(YEAR(\'日次入力\'!A2:A),MONTH(\'日次入力\'!A2:A),1))' +
    '};' +
    '{' +
      'IF(\'アプリ取引連携\'!A2:A="","",IF(COUNTIF(\'日次入力\'!K2:K,"BudgetOrbit:"&\'アプリ取引連携\'!A2:A)>0,"",\'アプリ取引連携\'!A2:A)),' +
      'IF(\'アプリ取引連携\'!A2:A="","",IF(COUNTIF(\'日次入力\'!K2:K,"BudgetOrbit:"&\'アプリ取引連携\'!A2:A)>0,"","BudgetOrbit")),' +
      'IF(\'アプリ取引連携\'!A2:A="","",IF(COUNTIF(\'日次入力\'!K2:K,"BudgetOrbit:"&\'アプリ取引連携\'!A2:A)>0,"",\'アプリ取引連携\'!B2:B)),' +
      'IF(\'アプリ取引連携\'!A2:A="","",IF(COUNTIF(\'日次入力\'!K2:K,"BudgetOrbit:"&\'アプリ取引連携\'!A2:A)>0,"",IF(\'アプリ取引連携\'!C2:C="income","収入","支出"))),' +
      'IF(\'アプリ取引連携\'!A2:A="","",IF(COUNTIF(\'日次入力\'!K2:K,"BudgetOrbit:"&\'アプリ取引連携\'!A2:A)>0,"",IFNA(VLOOKUP(\'アプリ取引連携\'!D2:D,\'カテゴリ設定\'!J:M,2,FALSE),\'アプリ取引連携\'!D2:D))),'+
      'IF(\'アプリ取引連携\'!A2:A="","",IF(COUNTIF(\'日次入力\'!K2:K,"BudgetOrbit:"&\'アプリ取引連携\'!A2:A)>0,"",\'アプリ取引連携\'!F2:F)),' +
      'IF(\'アプリ取引連携\'!A2:A="","",IF(COUNTIF(\'日次入力\'!K2:K,"BudgetOrbit:"&\'アプリ取引連携\'!A2:A)>0,"",IF(\'アプリ取引連携\'!C2:C="income",\'アプリ取引連携\'!E2:E-ROUND(\'アプリ取引連携\'!E2:E/11,0),IF(REGEXMATCH(IFNA(VLOOKUP(\'アプリ取引連携\'!D2:D,\'カテゴリ設定\'!J:M,4,FALSE),\'アプリ取引連携\'!D2:D),"^(基本給・諸手当（総支給）|厚生年金（会社負担分）|健康保険（会社負担分）|所得税/住民税（預り金納付分）|プライベート)$"),\'アプリ取引連携\'!E2:E,\'アプリ取引連携\'!E2:E-ROUND(\'アプリ取引連携\'!E2:E/11,0))))),' +
      'IF(\'アプリ取引連携\'!A2:A="","",IF(COUNTIF(\'日次入力\'!K2:K,"BudgetOrbit:"&\'アプリ取引連携\'!A2:A)>0,"","")),' +
      'IF(\'アプリ取引連携\'!B2:B="","",IF(COUNTIF(\'日次入力\'!K2:K,"BudgetOrbit:"&\'アプリ取引連携\'!A2:A)>0,"",DATE(YEAR(\'アプリ取引連携\'!B2:B),MONTH(\'アプリ取引連携\'!B2:B),1)))' +
    '}' +
  '},"select Col1,Col2,Col3,Col4,Col5,Col6,Col7,Col8,Col9 where Col3 is not null",0))';
}
