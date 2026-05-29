const BANK_PDF_IMPORT = {
  spreadsheetId: '1wX6LR1ssqThgPAIHRyUNeuvROsnXqDMcwFbMCj1PB8M',
  bankSheetName: '銀行データチェック用',
  depositSummarySheetName: '★入金一覧',
  salesSheetName: '振込入金リスト一覧',
  aliasSheetName: '※名義対応表',
  correctionSheetName: 'PDF読取補正',
  logSheetName: 'PDF_IMPORT_LOG',
  rawSheetName: 'PDF_OCR_RAW',
  withdrawalSheetName: '銀行出金一覧',
  japaneseOcrSheetName: '日本語OCR用',
  inputFolderId: '1RkJM7UOdQbhMh3IjjMX0Ner4_F4SGg54',
  successFolderId: '1mC5iTSXSeNyZQuXX75Jp8Xe6Bv8WN5_D',
  errorFolderId: '1q6qrZBLIaB6H6ZE5EhsbvP27gowIKvZn',
  moveFailedFilesToErrorFolder: false,
  openAiEndpoint: 'https://api.openai.com/v1/responses',
  openAiModelDefault: 'gpt-4.1',
  openAiPromptVersion: 'bank-pdf-import-v2-2026-04-12',
  importEnabledProperty: 'OPENAI_PDF_IMPORT_ENABLED',
  apiKeyProperty: 'OPENAI_API_KEY',
  modelProperty: 'OPENAI_MODEL',
  rereadQueueProperty: 'BANK_PDF_REREAD_QUEUE',
  statuses: {
    unmatched: '未照合',
    matched: '自動消込',
    review: '要確認',
    corrected: '補正適用'
  },
  visibleSuccessStatuses: ['未照合', '自動消込', '要確認', '補正適用'],
  errorCodes: {
    missingApiKey: 'E001',
    fileReadFailed: 'E101',
    openAiFailed: 'E102',
    noOcrText: 'E103',
    malformedResponse: 'E104',
    noTransactions: 'E105',
    missingDate: 'E201',
    missingAmount: 'E202',
    missingSummary: 'E203',
    ambiguousMatch: 'E204',
    moveFailed: 'E301',
    lockTimeout: 'E401',
    missingPreparedOcr: 'E402'
  }
};

const NYUKIN_SETTINGS_SHEET = 'システム設定';
const NYUKIN_SETTING_KEYS = {
  TARGET_SPREADSHEET_ID: 'NYUKIN_TARGET_SPREADSHEET_ID',
  SOURCE_SPREADSHEET_ID: 'NYUKIN_SOURCE_SPREADSHEET_ID'
};

const BANK_PDF_BANK_HEADERS = [
  '日付', '金額', '相手摘要', '顧客No.', '業務No.', 'ステータス', '入金月', '部門', '科目', '補助科目',
  '取引先', '番号', '証憑/伝番', '自補助', '税区分', '自取引', '相手科目', '相手補助科目', '相手部門', '税区分',
  '相手取引', '消費税', '消費税', 'データ取り込み日', '摘要', '相手', 'OCR元ファイル名', 'OCR元ファイルID',
  'OCR更新日時', '伝票種', '科目コード', '補助科目コード', '取引先コード', '自補助科目コード', '税区分コード',
  '自取引先コード', '相手科目コード', '相手補助科目コード', '相手部門コード', '相手税区分コード', '相手取引コード',
  '自部門コード', '自部門名', '名前'
];

const BANK_PDF_CORRECTION_HEADERS = [
  '有効', '承認状態', '補正キー', 'OCR元ファイルID', 'OCR元ファイル名', '生行', 'AI_日付', 'AI_金額', 'AI_名前',
  'AI_摘要', 'AI_エラーコード', 'AI_エラー詳細', '正_名前', '正_顧客No', '正_業務No', '正_摘要', '正_ステータス',
  '適用メモ', '最終適用日時'
];

const BANK_PDF_LOG_HEADERS = [
  'fileId', 'fileName', 'updatedAt', 'status', 'importedCount', 'skippedNonIncomeCount', 'errorCount', 'message', 'loggedAt'
];

const BANK_PDF_RAW_HEADERS = [
  'fileId', 'fileName', 'loggedAt', 'ocrText', 'openaiPromptVersion'
];

const BANK_PDF_JAPANESE_OCR_HEADERS = [
  'OCR元ファイルID', 'OCR元ファイル名', 'ページ', 'OCR方式', 'OCR本文'
];

const BANK_PDF_WITHDRAWAL_HEADERS = [
  '日付', '相手科目', '相手摘要', '金額', 'OCR元ファイル名', 'OCR元ファイルID', '取込日時'
];

function isNyukinRuntimeSpreadsheet_(spreadsheet) {
  if (!spreadsheet) return false;
  return !!spreadsheet.getSheetByName(BANK_PDF_IMPORT.bankSheetName) ||
    !!spreadsheet.getSheetByName(BANK_PDF_IMPORT.salesSheetName);
}

function getNyukinSettingsSheet_(spreadsheet) {
  if (!spreadsheet) return null;
  return spreadsheet.getSheetByName(NYUKIN_SETTINGS_SHEET);
}

function getNyukinSettingValue_(spreadsheet, key) {
  const sheet = getNyukinSettingsSheet_(spreadsheet);
  if (!sheet || sheet.getLastRow() < 2) return '';

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  for (let i = 0; i < values.length; i += 1) {
    if (String(values[i][0] || '').trim() === key) {
      return String(values[i][1] || '').trim();
    }
  }
  return '';
}

function getNyukinRuntimeSpreadsheet_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (isNyukinRuntimeSpreadsheet_(active)) {
    return active;
  }

  if (active) {
    const overrideId = getNyukinSettingValue_(active, NYUKIN_SETTING_KEYS.TARGET_SPREADSHEET_ID);
    if (overrideId) {
      try {
        const overrideSpreadsheet = SpreadsheetApp.openById(overrideId);
        if (isNyukinRuntimeSpreadsheet_(overrideSpreadsheet)) {
          return overrideSpreadsheet;
        }
      } catch (error) {
        Logger.log('入金一覧 override target open failed: ' + error);
      }
    }
  }

  return SpreadsheetApp.openById(BANK_PDF_IMPORT.spreadsheetId);
}

function getNyukinSourceSpreadsheetId_() {
  const runtimeSpreadsheet = getNyukinRuntimeSpreadsheet_();
  const overrideId = getNyukinSettingValue_(runtimeSpreadsheet, NYUKIN_SETTING_KEYS.SOURCE_SPREADSHEET_ID);
  if (overrideId) {
    return overrideId;
  }

  if (isNyukinCopySpreadsheet_(runtimeSpreadsheet)) {
    const detectedId = findLatestSpreadsheetIdBySheetSignature_(
      "title contains '営業用' and title contains 'コピー' and trashed = false and mimeType = 'application/vnd.google-apps.spreadsheet'",
      ['顧客対応状況（車両販売）', '顧客対応状況（車検）']
    );
    if (detectedId) {
      return detectedId;
    }
  }

  return '1QNctVAnkattCX9dyT9DBmaPXWF9-nsfmZwEtEp4t1R8';
}

function isNyukinCopySpreadsheet_(spreadsheet) {
  if (!spreadsheet) return false;
  return spreadsheet.getId() !== BANK_PDF_IMPORT.spreadsheetId || /コピー/.test(String(spreadsheet.getName() || ''));
}

function hasSheetSignature_(spreadsheet, requiredSheetNames) {
  if (!spreadsheet) return false;
  return requiredSheetNames.every(function(sheetName) {
    return !!spreadsheet.getSheetByName(sheetName);
  });
}

function findLatestSpreadsheetIdBySheetSignature_(query, requiredSheetNames) {
  let latestFile = null;
  const files = DriveApp.searchFiles(query);

  while (files.hasNext()) {
    const file = files.next();
    try {
      const spreadsheet = SpreadsheetApp.openById(file.getId());
      if (!hasSheetSignature_(spreadsheet, requiredSheetNames)) {
        continue;
      }

      if (!latestFile || file.getLastUpdated() > latestFile.getLastUpdated()) {
        latestFile = file;
      }
    } catch (error) {
      Logger.log('テスト用コピー候補の判定失敗: ' + error);
    }
  }

  return latestFile ? latestFile.getId() : '';
}

function onOpen() {
  const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!activeSpreadsheet) {
    return;
  }

  try {
    if (
      typeof CASHFLOW !== 'undefined' &&
      typeof isCashflowRuntimeSpreadsheet_ === 'function' &&
      isCashflowRuntimeSpreadsheet_(activeSpreadsheet) &&
      typeof buildCashflowOperationsMenu_ === 'function'
    ) {
      buildCashflowOperationsMenu_();
    }
  } catch (error) {
    Logger.log('CFメニュー初期化失敗: ' + error.message);
  }

  try {
    if (
      typeof CFG !== 'undefined' &&
      activeSpreadsheet.getId() === CFG.SOURCE_SERVICE_SPREADSHEET_ID
    ) {
      openServiceWorkflowMenu_();
    }
  } catch (error) {
    Logger.log('サービス系メニュー初期化失敗: ' + error.message);
  }

  if (activeSpreadsheet.getId() === BANK_PDF_IMPORT.spreadsheetId || isNyukinRuntimeSpreadsheet_(activeSpreadsheet)) {
    buildUnifiedOperationsMenu_();
  }
}

function onEdit(e) {
  try {
    if (typeof handleOperationalProtectionEdit_ === 'function') {
      handleOperationalProtectionEdit_(e);
    }
  } catch (error) {
    Logger.log('onEdit 保護フラグ処理失敗: ' + error.message);
  }
}

function buildUnifiedOperationsMenu_() {
  // nyukin_main.gs の安全な関数を呼ぶ（他スプレッドシートへの書き込みなし）
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('運用')
    .addItem('① 銀行データ取込',         'menuImportBankCsv')
    .addItem('② 案件一覧更新',           'menuUpdateSalesList')
    .addItem('③ 照合実行',               'menuRunReconcile')
    .addSeparator()
    .addItem('④ データ補正（学習適用）',  'menuApplyCorrections')
    .addToUi();
}

function buildBankPdfMenuLegacy_() {
  const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!activeSpreadsheet || activeSpreadsheet.getId() !== BANK_PDF_IMPORT.spreadsheetId) {
    return;
  }

  SpreadsheetApp.getUi()
    .createMenu('銀行PDF')
    .addItem('選択行を再読込依頼', 'requestBankPdfRereadForSelectedRow')
    .addToUi();
}

function runBankImportPhase_() {
  setupOperationalViews();
  runImportBankCsv();
  runReplace();
  refreshOperationalViewSheets_();
  refreshHomeSnapshot_();
  SpreadsheetApp.getUi().alert('銀行データ取込を実行しました。');
}

function runSalesSourceUpdatePhase_() {
  setupOperationalViews();
  syncSalesListFromSourceSheets_();
  refreshOperationalViewSheets_();
  refreshHomeSnapshot_();
  SpreadsheetApp.getUi().alert('案件一覧更新を実行しました。');
}

function runAutoReconcilePhase_() {
  setupOperationalViews();
  runImportCreditCashDocuments();
  runSpecialCasePreparation();
  runUpdateMatch();
  runFinalizeCardSettlementMatches_();
  runFinalizeAiAssistMatches_();
  refreshReceivableForecastSheet_();
  runCashflowRefresh_({ silent: true });
  runOperationalMaintenance();
  updateAllSummaryFormulas();
  refreshOperationalViewSheets_();
  refreshHomeSnapshot_();
  SpreadsheetApp.getUi().alert('照合実行が完了しました。案件照合とCF反映まで更新済みです。');
}

function runOperationalMaintenance() {
  runReplace();
  runRemoveDuplicate();
  runSort();
}

function setupOperationalViews() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;

  try {
    if (typeof installCashflowWorkflowOpenTrigger_ === 'function') {
      installCashflowWorkflowOpenTrigger_();
    }
  } catch (error) {
    Logger.log('CFメニュー用トリガー初期化失敗: ' + error.message);
  }

  configureSheetVisibility_(ss);
  configureSheetFreeze_(ss, 'ホーム', 1, 1);
  configureSheetFreeze_(ss, '銀行取込一覧', 7, 1);
  configureSheetFreeze_(ss, '銀行一覧', 7, 1);
  configureSheetFreeze_(ss, '案件一覧', 7, 1);
  configureSheetFreeze_(ss, 'コンクエスト管理', 8, 1);
  configureSheetFreeze_(ss, '保険立替管理', 8, 1);
  configureSheetFreeze_(ss, '振込入金リスト一覧', 1, 6);
  configureSheetFreeze_(ss, '銀行データチェック用', 1, 6);
  configureSheetFreeze_(ss, '請求書発行', 1, 7);
  configureSheetFreeze_(ss, 'クレカ・現金', 1, 8);

  const homeSheet = ss.getSheetByName('ホーム');
  if (homeSheet) {
    refreshHomeSnapshot_();
    ss.setActiveSheet(homeSheet);
  }

}

function runDailyOperations() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const startedAt = new Date();
  const summary = {
    bankImport: null,
    rerunImport: null,
    receiptsOk: false,
    matchingOk: false,
    maintenanceOk: false,
    summaryOk: false,
    errors: []
  };

  ss.toast('日次一括実行を開始します', '運用', 5);

  try {
    summary.bankImport = runImportBankCsv();
  } catch (error) {
    summary.errors.push('銀行CSV取込: ' + getErrorMessage_(error));
  }

  try {
    runImportCreditCashDocuments();
    summary.receiptsOk = true;
  } catch (error) {
    summary.errors.push('クレカ・現金・請求書取込: ' + getErrorMessage_(error));
  }

  try {
    runUpdateMatch();
    summary.matchingOk = true;
  } catch (error) {
    summary.errors.push('自動照合: ' + getErrorMessage_(error));
  }

  try {
    runOperationalMaintenance();
    summary.maintenanceOk = true;
  } catch (error) {
    summary.errors.push('補正・整列: ' + getErrorMessage_(error));
  }

  try {
    updateAllSummaryFormulas();
    summary.summaryOk = true;
  } catch (error) {
    summary.errors.push('月次集計更新: ' + getErrorMessage_(error));
  }

  try {
    refreshHomeSnapshot_();
  } catch (error) {
    summary.errors.push('ホーム更新: ' + getErrorMessage_(error));
  }

  const elapsedSec = Math.round((Date.now() - startedAt.getTime()) / 1000);
  const message = buildDailyOperationsMessage_(summary, elapsedSec);
  Logger.log(message.replace(/\n/g, ' / '));
  SpreadsheetApp.getUi().alert(message);
}

function openDataScreeningSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;

  const sheet = ss.getSheetByName('データスクリーニング');
  if (sheet) {
    ss.setActiveSheet(sheet);
    return;
  }

  SpreadsheetApp.getUi().alert('データスクリーニング シートが見つかりません。');
}

function configureSheetVisibility_(ss) {
  const hideNames = [
    'データスクリーニング',
    '銀行要対応',
    '銀行照合済み',
    '銀行要確認メモ',
    '案件要対応',
    '案件照合済み',
    '請求書要対応',
    '取込失敗',
    '振込入金リスト一覧',
    '銀行データチェック用',
    '銀行文字補正学習',
    '照合学習マスタ',
    '銀行入金一覧',
    '銀行出金一覧',
    'シート13',
    '取込履歴',
    '売上クロスチェック',
    '売掛入金見込み管理',
    '※名義対応表',
    'bk_250503_入金一覧',
    'bk_250503_振込案件',
    'bk_250503_銀行照合',
    'bk_250503_請求書',
    'bk_250503_クレカ現金'
  ];
  const showNames = [
    'ホーム',
    '銀行取込一覧',
    '銀行一覧',
    '案件一覧',
    'コンクエスト管理',
    '保険立替管理'
  ];

  hideNames.forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (sheet && !sheet.isSheetHidden()) {
      sheet.hideSheet();
    }
  });

  showNames.forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (sheet && sheet.isSheetHidden()) {
      sheet.showSheet();
    }
  });
}

function configureSheetFreeze_(ss, sheetName, rows, cols) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  sheet.setFrozenRows(rows || 0);
  sheet.setFrozenColumns(cols || 0);
}

function refreshHomeSnapshot_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('ホーム');
  if (!sheet) return;

  const summary = buildHomeStatusSummary_(ss);

  sheet.clearContents();
  sheet.clearFormats();

  sheet.getRange('A1:F1').merge();
  sheet.getRange('A1').setValue('現場で見るのはこの5枚だけ')
    .setFontSize(18)
    .setFontWeight('bold')
    .setBackground('#d9ead3')
    .setHorizontalAlignment('left');

  sheet.getRange('A2').setValue('1. 銀行取込一覧  2. 銀行一覧  3. 案件一覧  4. コンクエスト管理  5. 保険立替管理');
  sheet.getRange('A2:F2').setBackground('#f3f9f1');
  sheet.getRange('A3').setValue('最終更新');
  sheet.getRange('B3').setValue(new Date()).setNumberFormat('yyyy/mm/dd hh:mm:ss');

  sheet.getRange('A5').setValue('まず見る場所').setFontWeight('bold').setBackground('#efefef');
  sheet.getRange('A6:C10').setValues([
    ['銀行取込一覧', 'CSVデータを正しく転記できたか確認', '自摘要を優先に、金額・番号まで確認する原本シート'],
    ['銀行一覧', '実際に入金があったものを確認', '誰から / いつ / いくら入金があったかと照合状況を見る'],
    ['案件一覧', '通常案件の入金予定と実績を確認', 'コンクエスト・保険を除く通常案件の未入金 / 要確認を見る'],
    ['コンクエスト管理', 'コンクエスト案件を別管理', '相殺・集約で管理する案件を通常未入金から切り離して確認'],
    ['保険立替管理', '保険会社立替案件を別管理', '保険会社名義の入金候補と差額を別シートで確認']
  ]);

  sheet.getRange('E5').setValue('件数').setFontWeight('bold').setBackground('#efefef');
  sheet.getRange('E6:F13').setValues([
    ['銀行 要確認', summary.bankReview],
    ['銀行 照合済み', summary.bankMatched],
    ['案件 要確認', summary.salesReview],
    ['案件 未入金', summary.salesUnpaid],
    ['案件 一部入金', summary.salesPartial],
    ['案件 入金済み', summary.salesMatched],
    ['コンクエスト 件数', summary.conquestCases],
    ['保険立替 件数', summary.insuranceCases]
  ]);

  sheet.getRange('A10').setValue('操作順').setFontWeight('bold').setBackground('#efefef');
  sheet.getRange('A11:C14').clearContent();
  sheet.getRange('A11:C13').setValues([
    ['1', '運用 > 1. 銀行データ取込', '銀行CSVを読み込み、入金と支払いへ分離'],
    ['2', '運用 > 2. 案件一覧更新', '営業用元シートから案件一覧を更新'],
    ['3', '運用 > 3. 照合実行', '特殊計算・自動消込・AI補助・CF反映をまとめて実行']
  ]);

  sheet.getRange('E13').setValue('補足').setFontWeight('bold').setBackground('#efefef');
  sheet.getRange('E14:F16').setValues([
    ['hiddenシート', '学習・補正・raw保存用。通常は見なくてよい'],
    ['学習シート', '文字化けや名義ゆれを次回以降に生かすために使う'],
    ['要確認の判断理由', '銀行一覧の確認メモを見る']
  ]);

  setHomeShortcut_(sheet.getRange('E17'), ss.getSheetByName('銀行取込一覧'), '銀行取込一覧を開く');
  setHomeShortcut_(sheet.getRange('E18'), ss.getSheetByName('銀行一覧'), '銀行一覧を開く');
  setHomeShortcut_(sheet.getRange('E19'), ss.getSheetByName('案件一覧'), '案件一覧を開く');
  setHomeShortcut_(sheet.getRange('E20'), ss.getSheetByName('コンクエスト管理'), 'コンクエスト管理を開く');
  setHomeShortcut_(sheet.getRange('E21'), ss.getSheetByName('保険立替管理'), '保険立替管理を開く');

  sheet.getRange('A1:F21').setBorder(true, true, true, true, true, true);
  sheet.autoResizeColumns(1, 6);
  sheet.setFrozenRows(3);
}

function setHomeShortcut_(cell, targetSheet, label) {
  if (!cell) return;
  if (!targetSheet) {
    cell.setValue(label || '');
    return;
  }
  cell.setFormula('=HYPERLINK("#gid=' + targetSheet.getSheetId() + '","' + (label || targetSheet.getName()) + '")');
}

function refreshOperationalViewSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss || ss.getId() !== BANK_PDF_IMPORT.spreadsheetId) {
    return;
  }

  try {
    renderOperationalBankImportView_(ss);
    renderOperationalBankListView_(ss);
    renderOperationalSalesView_(ss);
    renderOperationalConquestView_(ss);
    renderOperationalInsuranceView_(ss);
  } catch (error) {
    Logger.log('運用ビュー更新失敗: ' + getErrorMessage_(error));
  }
}

function renderOperationalBankImportView_(ss) {
  const bankRows = buildOperationalBankViewContexts_(ss);
  const sheet = ensureOperationalViewSheet_(ss, '銀行取込一覧', 13);
  const dataRows = bankRows.map(function(item) {
    return [
      item.date || '',
      item.displaySummary || '',
      item.partnerSummary || '',
      item.selfSummary || '',
      item.counterAccount || '',
      item.signedAmount || '',
      item.direction || '',
      item.status || '',
      item.customerNo || '',
      item.bizNo || '',
      item.depositMonth || '',
      item.number || '',
      item.fileName || ''
    ];
  });

  const rows = [
    ['日付', '表示摘要', '相手摘要', '自摘要', '相手科目', '金額', '区分', 'ステータス', '顧客No', '業務No', '入金月', '番号', '取込ファイル']
  ].concat(dataRows);

  writeOperationalSnapshot_(sheet, rows, 13);
  applyOperationalSheetDecorations_(sheet, {
    title: '銀行取込一覧',
    headerRow: 1,
    dataStartRow: 2,
    dateColumns: [1],
    amountColumns: [6],
    monthColumns: [11],
    statusColumn: 8,
    freezeRows: 1,
    freezeCols: 1
  });
}

function renderOperationalBankListView_(ss) {
  const bankRows = buildOperationalBankViewContexts_(ss).filter(function(item) {
    return item.direction === '入金' && item.signedAmount > 0 && item.status !== '対象外';
  });
  const sheet = ensureOperationalViewSheet_(ss, '銀行一覧', 10);
  const dataRows = bankRows.map(function(item) {
    return [
      item.date || '',
      item.displaySummary || '',
      item.signedAmount || '',
      item.direction || '',
      item.fileName || '',
      item.bizNo || '',
      item.customerNo || '',
      item.status || '',
      item.depositMonth || '',
      item.reviewMemo || ''
    ];
  });

  const rows = [
    ['日付', '摘要', '金額', '区分', '取込ファイル', '業務No', '顧客No', 'ステータス', '入金月', '確認メモ']
  ].concat(dataRows);

  writeOperationalSnapshot_(sheet, rows, 10);
  applyOperationalSheetDecorations_(sheet, {
    title: '銀行一覧',
    headerRow: 1,
    dataStartRow: 2,
    dateColumns: [1],
    amountColumns: [3],
    monthColumns: [9],
    statusColumn: 8,
    freezeRows: 1,
    freezeCols: 1
  });
}

function renderOperationalSalesView_(ss) {
  const salesRows = buildOperationalSalesViewContexts_(ss);
  const sheet = ensureOperationalViewSheet_(ss, '案件一覧', 15);
  const dataRows = salesRows.map(function(item) {
    return [
      item.bizNo || '',
      item.date || '',
      item.customerName || '',
      item.billTo || '',
      item.workType || '',
      item.total || '',
      item.customerNo || '',
      item.matchStatus || '',
      item.method || '',
      item.dueDate || '',
      item.paidTotal || '',
      item.unpaidAmount || '',
      item.progressStatus || '',
      item.alert || '',
      item.memo || ''
    ];
  });

  const rows = [
    ['業務No', '日付', '顧客名', '請求先名', '作業区分', '売上総計', '顧客No', '照合ステータス', '入金方法', '入金予定日', '入金累計', '未入金額', '入金状況', 'アラート', '確認メモ']
  ].concat(dataRows);

  writeOperationalSnapshot_(sheet, rows, 15);
  applyOperationalSheetDecorations_(sheet, {
    title: '案件一覧',
    headerRow: 1,
    dataStartRow: 2,
    dateColumns: [2, 10],
    amountColumns: [6, 11, 12],
    statusColumn: 13,
    alertColumn: 14,
    freezeRows: 1,
    freezeCols: 1
  });
}

function renderOperationalConquestView_(ss) {
  var rows = buildOperationalConquestViewContexts_(ss);
  var sheet = ensureOperationalViewSheet_(ss, 'コンクエスト管理', 10);

  // CFラベルでグループ化
  var labelGroups = {};
  var labelOrder = [];
  rows.forEach(function(item) {
    var key = item.cfLabel || '未分類';
    if (!labelGroups[key]) {
      labelGroups[key] = [];
      labelOrder.push(key);
    }
    labelGroups[key].push(item);
  });

  // ヘッダー行
  var outputRows = [
    ['業務No', '日付', '顧客名', '請求先名', '特殊区分', 'CFラベル', '照合基準額', '入金予定日', '管理状況', '確認メモ']
  ];
  var subtotalRowIndices = [];
  var grandTotal = 0;

  // CFラベルごとにデータ行＋小計行を出力
  labelOrder.forEach(function(label) {
    var group = labelGroups[label];
    var subtotal = 0;
    group.forEach(function(item) {
      outputRows.push([
        item.bizNo || '',
        item.date || '',
        item.customerName || '',
        item.billTo || '',
        item.specialType || '',
        item.cfLabel || '',
        item.expectedAmount || '',
        item.dueDate || '',
        item.managementStatus || '',
        item.memo || ''
      ]);
      subtotal += toNumber_(item.expectedAmount);
    });
    // 小計行
    outputRows.push([
      '', '', '', '', '', '【小計】' + label, subtotal, '', group.length + '件', ''
    ]);
    subtotalRowIndices.push(outputRows.length); // 1-based row number
    grandTotal += subtotal;
  });

  // 合計行
  if (labelOrder.length > 0) {
    outputRows.push([
      '', '', '', '', '', '【合計】', grandTotal, '', rows.length + '件', ''
    ]);
    subtotalRowIndices.push(outputRows.length);
  }

  writeOperationalSnapshot_(sheet, outputRows, 10);
  applyOperationalSheetDecorations_(sheet, {
    title: 'コンクエスト管理',
    headerRow: 1,
    dataStartRow: 2,
    dateColumns: [2, 8],
    amountColumns: [7],
    statusColumn: 9,
    freezeRows: 1,
    freezeCols: 1
  });

  // 小計・合計行に背景色を適用
  subtotalRowIndices.forEach(function(rowIdx) {
    try {
      var range = sheet.getRange(rowIdx, 1, 1, 10);
      range.setBackground('#E8EAF6');
      range.setFontWeight('bold');
    } catch(e) { /* ignore formatting errors */ }
  });
}

function renderOperationalInsuranceView_(ss) {
  const rows = buildOperationalInsuranceViewContexts_(ss);
  const sheet = ensureOperationalViewSheet_(ss, '保険立替管理', 14);
  const dataRows = rows.map(function(item) {
    return [
      item.bizNo || '',
      item.date || '',
      item.customerName || '',
      item.billTo || '',
      item.expectedAmount || '',
      item.dueDate || '',
      item.progressStatus || '',
      item.candidateDate || '',
      item.candidateSummary || '',
      item.candidateAmount || '',
      item.amountDiff === '' ? '' : item.amountDiff,
      item.matchType || '',
      item.candidateStatus || '',
      item.memo || ''
    ];
  });

  const values = [
    ['業務No', '日付', '顧客名', '請求先名', '照合基準額', '入金予定日', '案件状況', '候補入金日', '候補摘要', '候補額', '差額', '候補判定', '銀行状況', '確認メモ']
  ].concat(dataRows);

  writeOperationalSnapshot_(sheet, values, 14);
  applyOperationalSheetDecorations_(sheet, {
    title: '保険立替管理',
    headerRow: 1,
    dataStartRow: 2,
    dateColumns: [2, 6, 8],
    amountColumns: [5, 10, 11],
    statusColumn: 7,
    freezeRows: 1,
    freezeCols: 1
  });
}

function buildOperationalBankViewContexts_(ss) {
  const bankSheet = ss.getSheetByName('銀行データチェック用');
  if (!bankSheet || bankSheet.getLastRow() < 2) {
    return [];
  }

  const headerMap = getHeaderMap_(bankSheet);
  const lastRow = bankSheet.getLastRow();
  const lastCol = bankSheet.getLastColumn();
  const values = bankSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const statusCol = headerMap['ステータス'];
  const notes = statusCol ? bankSheet.getRange(2, statusCol, lastRow - 1, 1).getNotes() : [];

  const rows = values.map(function(row, index) {
    const signedAmount = parseNumber_(getOperationalCellByHeader_(row, headerMap, ['金額']));
    const selfSummary = safeString_(getOperationalCellByHeader_(row, headerMap, ['自摘要']));
    const partnerSummary = safeString_(getOperationalCellByHeader_(row, headerMap, ['相手摘要']));
    const displaySummary = safeString_(getOperationalCellByHeader_(row, headerMap, ['表示摘要'])) || pickBankProcessingSummary_(selfSummary, partnerSummary);
    const dateValue = parseAnySheetDate_(getOperationalCellByHeader_(row, headerMap, ['日付']));
    return {
      rowIndex: index + 2,
      date: dateValue,
      displaySummary: displaySummary,
      partnerSummary: partnerSummary,
      selfSummary: selfSummary,
      counterAccount: safeString_(getOperationalCellByHeader_(row, headerMap, ['相手科目'])),
      signedAmount: signedAmount,
      direction: normalizeBankVoucherType_(getOperationalCellByHeader_(row, headerMap, ['伝票種']), signedAmount),
      status: safeString_(getOperationalCellByHeader_(row, headerMap, ['ステータス'])) || '未照合',
      customerNo: safeString_(getOperationalCellByHeader_(row, headerMap, ['顧客No.', '顧客No'])),
      bizNo: safeString_(getOperationalCellByHeader_(row, headerMap, ['業務No.', '業務No'])),
      depositMonth: parseAnySheetDate_(getOperationalCellByHeader_(row, headerMap, ['入金月'])),
      number: safeString_(getOperationalCellByHeader_(row, headerMap, ['番号'])),
      fileName: safeString_(getOperationalCellByHeader_(row, headerMap, ['取込ファイル名'])),
      reviewMemo: notes[index] ? safeString_(notes[index][0]) : ''
    };
  }).filter(function(item) {
    return item.date || item.displaySummary || item.partnerSummary || item.selfSummary || item.signedAmount;
  });

  rows.sort(function(left, right) {
    const leftTime = left.date ? left.date.getTime() : 0;
    const rightTime = right.date ? right.date.getTime() : 0;
    return rightTime - leftTime;
  });
  return rows;
}

function buildOperationalSalesViewContexts_(ss) {
  return buildOperationalSalesBaseContexts_(ss).filter(function(item) {
    return !item.specialBucket && isOperationalTrackableSale_(item);
  });
}

function buildOperationalSalesBaseContexts_(ss) {
  const salesSheet = ss.getSheetByName('振込入金リスト一覧');
  if (!salesSheet || salesSheet.getLastRow() < 2) {
    return [];
  }

  const headerMap = getHeaderMap_(salesSheet);
  const lastRow = salesSheet.getLastRow();
  const lastCol = salesSheet.getLastColumn();
  const values = salesSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const rows = values.map(function(row) {
    const total = toNumber_(getOperationalCellByHeader_(row, headerMap, ['売上総計']));
    const paidTotal = toNumber_(getOperationalCellByHeader_(row, headerMap, ['入金累計']));
    const explicitUnpaid = getOperationalCellByHeader_(row, headerMap, ['未入金額']);
    const rawMatchStatus = safeString_(getOperationalCellByHeader_(row, headerMap, ['ステータス']));
    const billTo = safeString_(getOperationalCellByHeader_(row, headerMap, ['請求先名']));
    const specialType = safeString_(getOperationalCellByHeader_(row, headerMap, ['特殊案件区分']));
    const reconcileAmount = toNumber_(getOperationalCellByHeader_(row, headerMap, ['照合基準額']));
    const rawDate = parseAnySheetDate_(getOperationalCellByHeader_(row, headerMap, ['日付']));
    const dueDate = parseAnySheetDate_(getOperationalCellByHeader_(row, headerMap, ['入金予定日']));
    const displayDate = rawDate || dueDate;
    const expectedAmount = reconcileAmount > 0 ? reconcileAmount : total;
    const matchStatus = deriveOperationalMatchStatus_(rawMatchStatus, expectedAmount, paidTotal, rawDate, dueDate);
    const progress = safeString_(getOperationalCellByHeader_(row, headerMap, ['入金状況'])) || deriveOperationalProgressStatus_(matchStatus, total, paidTotal);
    const workType = safeString_(getOperationalCellByHeader_(row, headerMap, ['作業大区分名', '作業大区分']));
    const specialBucket = resolveOperationalSpecialBucket_(billTo, specialType, workType);
    return {
      bizNo: safeString_(getOperationalCellByHeader_(row, headerMap, ['業務№', '業務No', '業務No.'])),
      date: displayDate,
      sourceDate: rawDate,
      customerName: safeString_(getOperationalCellByHeader_(row, headerMap, ['顧客名'])),
      billTo: billTo,
      workType: safeString_(getOperationalCellByHeader_(row, headerMap, ['作業大区分名', '作業大区分'])),
      total: total,
      expectedAmount: expectedAmount,
      customerNo: safeString_(getOperationalCellByHeader_(row, headerMap, ['顧客№', '顧客No', '顧客No.'])),
      matchStatus: matchStatus,
      method: safeString_(getOperationalCellByHeader_(row, headerMap, ['入金方法'])),
      dueDate: dueDate,
      paidTotal: paidTotal,
      unpaidAmount: explicitUnpaid === '' || explicitUnpaid === null || explicitUnpaid === undefined
        ? Math.max(total - paidTotal, 0)
        : toNumber_(explicitUnpaid),
      progressStatus: progress,
      alert: safeString_(getOperationalCellByHeader_(row, headerMap, ['アラート'])) || deriveOperationalAlert_(displayDate, dueDate, progress, matchStatus),
      memo: safeString_(getOperationalCellByHeader_(row, headerMap, ['確認メモ'])),
      specialType: specialType,
      specialBucket: specialBucket
    };
  }).filter(function(item) {
    return (item.date || item.dueDate || item.bizNo || item.customerName || item.total || item.expectedAmount || item.paidTotal) &&
      isOperationalTrackableSale_(item);
  });

  rows.sort(function(left, right) {
    const leftTime = left.date ? left.date.getTime() : 0;
    const rightTime = right.date ? right.date.getTime() : 0;
    return rightTime - leftTime;
  });
  return rows;
}

function buildOperationalConquestViewContexts_(ss) {
  return buildOperationalSalesBaseContexts_(ss)
    .filter(function(item) { return item.specialBucket === 'conquest'; })
    .map(function(item) {
      const managementStatus = item.progressStatus === '入金済' ? '入金済' : 'コンクエスト管理';
      return {
        bizNo: item.bizNo,
        date: item.date,
        customerName: item.customerName,
        billTo: item.billTo,
        specialType: item.specialType,
        cfLabel: deriveOperationalConquestLabel_(item),
        expectedAmount: item.expectedAmount,
        dueDate: item.dueDate,
        managementStatus: managementStatus,
        memo: item.memo
      };
    });
}

function buildOperationalConquestRollups_(rows) {
  const labelMap = {};
  let totalAmount = 0;
  rows.forEach(function(item) {
    const key = safeString_(item.cfLabel) || '未設定';
    if (!labelMap[key]) {
      labelMap[key] = true;
    }
    totalAmount += toNumber_(item.expectedAmount);
  });
  return {
    totalAmount: totalAmount,
    labelCount: Object.keys(labelMap).length
  };
}

function buildOperationalInsuranceViewContexts_(ss) {
  const salesRows = buildOperationalSalesBaseContexts_(ss)
    .filter(function(item) { return item.specialBucket === 'insurance'; });
  const bankRows = buildOperationalBankViewContexts_(ss);

  return salesRows.map(function(item) {
    const candidate = findOperationalInsuranceBankCandidate_(item, bankRows);
    const memoParts = [];
    if (item.memo) memoParts.push(item.memo);
    if (candidate && candidate.amountDiff !== null && candidate.amountDiff !== undefined) {
      memoParts.push('候補差額 ' + candidate.amountDiff + '円');
    }
    return {
      bizNo: item.bizNo,
      date: item.date,
      customerName: item.customerName,
      billTo: item.billTo,
      expectedAmount: item.expectedAmount,
      dueDate: item.dueDate,
      progressStatus: item.progressStatus === '未入金' && candidate ? '保険立替管理' : item.progressStatus,
      candidateDate: candidate ? candidate.date : '',
      candidateSummary: candidate ? candidate.displaySummary : '',
      candidateAmount: candidate ? candidate.signedAmount : '',
      amountDiff: candidate ? candidate.amountDiff : '',
      matchType: candidate ? candidate.matchType : '',
      candidateStatus: candidate ? candidate.status : '',
      memo: memoParts.join(' / ')
    };
  });
}

function resolveOperationalSpecialBucket_(billTo, specialType, workType) {
  var normalizedBillTo = normalizeMatchText_(billTo);

  // コンクエスト判定: 請求先に「コンクエスト」「マセラティ」キーワードを含む
  var conquestKeywords = ['コンクエスト', 'マセラティ', 'MASERATI'];
  var isConquest = conquestKeywords.some(function(kw) {
    return normalizedBillTo.indexOf(normalizeMatchText_(kw)) >= 0;
  });
  if (isConquest) return 'conquest';

  // 保険判定:
  //   1) 請求先名に保険関連キーワード（保険, 損保, 共済, あいおい, 東京海上 等）
  //   2) 特殊案件区分に保険関連キーワード
  //   3) 作業大区分が板金系（板金, 鈑金, 保険請求 等）
  var normalizedSpecial = normalizeMatchText_(specialType || '');
  var normalizedWork = normalizeMatchText_(workType || '');
  var isInsurance = SPECIAL_CASE_CFG.INSURANCE_HINTS.some(function(keyword) {
    var nkw = normalizeMatchText_(keyword);
    return normalizedBillTo.indexOf(nkw) >= 0 || normalizedSpecial.indexOf(nkw) >= 0;
  });
  if (!isInsurance) {
    isInsurance = SPECIAL_CASE_CFG.BOARD_WORK_TYPES.some(function(wt) {
      return normalizedWork === normalizeMatchText_(wt);
    });
  }
  return isInsurance ? 'insurance' : '';
}

function deriveOperationalConquestLabel_(item) {
  const normalizedBillTo = normalizeMatchText_(item.billTo);
  const salesDate = item.date instanceof Date ? item.date : parseAnySheetDate_(item.date);
  const month = salesDate ? salesDate.getMonth() + 1 : '';
  if (normalizedBillTo === normalizeMatchText_(SPECIAL_CASE_CFG.CONQUEST_GROSS_VENDOR)) {
    return 'ｺﾝｸｴｽﾄ様ﾏｾﾗﾃｨ' + month + '月分';
  }
  if (normalizedBillTo === normalizeMatchText_(SPECIAL_CASE_CFG.CONQUEST_SUM_VENDOR)) {
    return 'ｺﾝｸｴｽﾄ様J&LR営業部門';
  }
  if (normalizedBillTo === normalizeMatchText_(SPECIAL_CASE_CFG.CONQUEST_JLR_VENDOR)) {
    return 'ｺﾝｸｴｽﾄ様J&LR整備';
  }
  return 'コンクエスト＋' + (item.customerName || item.billTo || item.bizNo || '');
}

function findOperationalInsuranceBankCandidate_(saleItem, bankRows) {
  const normalizedCustomer = normalizeMatchText_(saleItem.customerName);
  const normalizedBillTo = normalizeMatchText_(saleItem.billTo);
  const expectedAmount = Number(saleItem.expectedAmount || 0);
  const saleDate = saleItem.dueDate || saleItem.date;
  const candidates = bankRows
    .filter(function(bankItem) { return bankItem.direction === '入金' && bankItem.signedAmount > 0; })
    .filter(function(bankItem) { return bankItem.status !== '対象外'; })
    .filter(function(bankItem) { return isOperationalInsuranceBankRow_(bankItem); })
    .map(function(bankItem) {
      const amountDiff = Math.abs((bankItem.signedAmount || 0) - expectedAmount);
      const dateDiff = calcDateDiffDays_(bankItem.date, saleDate);
      let score = 0;
      if (bankItem.bizNo && saleItem.bizNo && bankItem.bizNo === saleItem.bizNo) score += 150;
      if (bankItem.customerNo && saleItem.customerNo && bankItem.customerNo === saleItem.customerNo) score += 120;
      if (amountDiff === 0) {
        score += 90;
      } else if (amountDiff <= SPECIAL_CASE_CFG.MICRO_DIFF_MAX) {
        score += Math.max(40, 80 - Math.floor(amountDiff / 100));
      }
      if (dateDiff !== null) {
        if (dateDiff <= 7) score += 25;
        else if (dateDiff <= 45) score += 10;
      }
      const normalizedSummary = normalizeMatchText_(bankItem.displaySummary);
      if (normalizedCustomer && normalizedSummary.indexOf(normalizedCustomer) >= 0) score += 20;
      if (normalizedBillTo && normalizedSummary.indexOf(normalizedBillTo) >= 0) score += 10;
      const matchType = amountDiff === 0
        ? '完全一致候補'
        : (amountDiff <= SPECIAL_CASE_CFG.MICRO_DIFF_MAX ? '近似候補' : '');
      return {
        bankItem: bankItem,
        amountDiff: amountDiff,
        dateDiff: dateDiff,
        score: score,
        matchType: matchType
      };
    })
    .filter(function(item) {
      return item.score > 0 && (item.amountDiff <= SPECIAL_CASE_CFG.MICRO_DIFF_MAX || (item.dateDiff !== null && item.dateDiff <= 45));
    })
    .sort(function(a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (a.amountDiff !== b.amountDiff) return a.amountDiff - b.amountDiff;
      return (a.dateDiff || 9999) - (b.dateDiff || 9999);
    });

  if (!candidates.length) return null;
  return {
    date: candidates[0].bankItem.date,
    displaySummary: candidates[0].bankItem.displaySummary,
    signedAmount: candidates[0].bankItem.signedAmount,
    status: candidates[0].bankItem.status,
    amountDiff: candidates[0].amountDiff,
    matchType: candidates[0].matchType
  };
}

function isOperationalInsuranceBankRow_(bankItem) {
  const joined = normalizeMatchText_([bankItem.displaySummary, bankItem.selfSummary, bankItem.partnerSummary, bankItem.counterAccount].join(' '));
  return SPECIAL_CASE_CFG.INSURANCE_HINTS.some(function(keyword) {
    return joined.indexOf(normalizeMatchText_(keyword)) >= 0;
  });
}

function isOperationalTrackableSale_(item) {
  const expectedAmount = toNumber_(item.expectedAmount);
  const paidTotal = toNumber_(item.paidTotal);
  const unpaidAmount = toNumber_(item.unpaidAmount);
  if (expectedAmount <= 0 && paidTotal <= 0 && unpaidAmount <= 0) {
    return false;
  }
  if (!item.bizNo && !item.customerName && !item.billTo) {
    return false;
  }
  return true;
}

function ensureOperationalViewSheet_(ss, sheetName, columnCount) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  if (sheet.getMaxColumns() < columnCount) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), columnCount - sheet.getMaxColumns());
  }
  sheet.showSheet();
  return sheet;
}

function writeOperationalSnapshot_(sheet, rows, columnCount) {
  const safeRows = (rows || []).map(function(row) {
    return padOperationalRow_(row, columnCount);
  });
  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }
  sheet.clearContents();
  sheet.clearFormats();
  if (sheet.getLastRow() > 0 && sheet.getLastColumn() > 0) {
    sheet.getDataRange().clearNote();
  }
  if (sheet.getMaxRows() < safeRows.length) {
    sheet.insertRowsAfter(sheet.getMaxRows(), safeRows.length - sheet.getMaxRows());
  }
  if (sheet.getRange(1, 1, Math.min(sheet.getMaxRows(), 8), columnCount).isPartOfMerge()) {
    sheet.getRange(1, 1, Math.min(sheet.getMaxRows(), 8), columnCount).breakApart();
  }
  sheet.getRange(1, 1, safeRows.length, columnCount).setValues(safeRows);
}

function padOperationalRow_(row, columnCount) {
  const output = new Array(columnCount).fill('');
  (row || []).slice(0, columnCount).forEach(function(value, index) {
    output[index] = value;
  });
  return output;
}

function applyOperationalSheetDecorations_(sheet, options) {
  const headerRow = options.headerRow;
  const dataStartRow = options.dataStartRow;
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  sheet.getRange(headerRow, 1, 1, lastCol).setFontWeight('bold').setBackground('#d9e2f3');

  (options.dateColumns || []).forEach(function(col) {
    if (lastRow >= dataStartRow) {
      sheet.getRange(dataStartRow, col, lastRow - dataStartRow + 1, 1).setNumberFormat('yyyy/mm/dd');
    }
  });
  (options.monthColumns || []).forEach(function(col) {
    if (lastRow >= dataStartRow) {
      sheet.getRange(dataStartRow, col, lastRow - dataStartRow + 1, 1).setNumberFormat('yyyy/mm');
    }
  });
  (options.amountColumns || []).forEach(function(col) {
    if (lastRow >= dataStartRow) {
      sheet.getRange(dataStartRow, col, lastRow - dataStartRow + 1, 1).setNumberFormat('#,##0;[Red]-#,##0');
    }
  });

  sheet.setFrozenRows(options.freezeRows || headerRow);
  sheet.setFrozenColumns(options.freezeCols || 1);
  sheet.autoResizeColumns(1, lastCol);

  if (lastRow >= dataStartRow) {
    applyOperationalStatusRowColors_(sheet, dataStartRow, lastRow - dataStartRow + 1, lastCol, options.statusColumn, options.alertColumn);
  }
}

function applyOperationalStatusRowColors_(sheet, startRow, rowCount, columnCount, statusColumn, alertColumn) {
  if (!rowCount || rowCount < 1) return;
  const statuses = statusColumn ? sheet.getRange(startRow, statusColumn, rowCount, 1).getValues() : [];
  const alerts = alertColumn ? sheet.getRange(startRow, alertColumn, rowCount, 1).getValues() : [];
  const colors = [];

  for (let i = 0; i < rowCount; i += 1) {
    const status = statuses[i] ? safeString_(statuses[i][0]) : '';
    const alert = alerts[i] ? safeString_(alerts[i][0]) : '';
    const color = resolveOperationalRowColor_(status, alert);
    colors.push(new Array(columnCount).fill(color));
  }

  sheet.getRange(startRow, 1, rowCount, columnCount).setBackgrounds(colors);
}

function resolveOperationalRowColor_(status, alert) {
  if (alert === '案件情報不足') return '#d9d2e9';
  if (alert === '期限超過') return '#f4cccc';
  if (alert === '期限間近') return '#fff2cc';
  if (status === '自動消込' || status === '手動消込' || status === '補正適用' || status === '入金済') return '#d9ead3';
  if (status === '一部入金') return '#d0e0e3';
  if (status === 'コンクエスト管理') return '#d9d2e9';
  if (status === '保険立替管理') return '#d9eaf7';
  if (status === '案件情報不足') return '#d9d2e9';
  if (status === '要確認') return '#fce5cd';
  if (status === '未照合' || status === 'カード入金照合' || status === '未入金') return '#fff2cc';
  if (status === '対象外') return '#eeeeee';
  return '#ffffff';
}

function deriveOperationalMatchStatus_(matchStatus, expectedAmount, paidTotal, displayDate, dueDate) {
  const explicit = safeString_(matchStatus);
  if (explicit) return explicit;
  if (expectedAmount > 0 && paidTotal >= expectedAmount && paidTotal > 0) return '入金済';
  if (paidTotal > 0) return '一部入金';
  if (!displayDate && !dueDate) return '案件情報不足';
  return '未照合';
}

function deriveOperationalProgressStatus_(matchStatus, total, paidTotal) {
  if (matchStatus === '要確認') return '要確認';
  if (matchStatus === '案件情報不足') return '案件情報不足';
  if (total > 0 && paidTotal >= total) return '入金済';
  if (paidTotal > 0) return '一部入金';
  return '未入金';
}

function deriveOperationalAlert_(displayDate, dueDate, progressStatus, matchStatus) {
  if (matchStatus === '案件情報不足') {
    return '案件情報不足';
  }
  if (!dueDate || progressStatus === '入金済') {
    return '';
  }
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffDays = Math.floor((due.getTime() - current.getTime()) / 86400000);
  if (diffDays < 0) return '期限超過';
  if (diffDays <= 3) return '期限間近';
  return '';
}

function getOperationalCellByHeader_(row, headerMap, headerNames) {
  for (let i = 0; i < headerNames.length; i += 1) {
    const col = headerMap[headerNames[i]];
    if (col) {
      return row[col - 1];
    }
  }
  return '';
}

function buildHomeStatusSummary_(ss) {
  const salesRows = buildOperationalSalesViewContexts_(ss);
  return {
    bankReview: countRowsByVisibleValues_(ss, '銀行データチェック用', 'ステータス', ['未照合', '要確認', 'カード入金照合']),
    bankMatched: countRowsByVisibleValues_(ss, '銀行データチェック用', 'ステータス', ['自動消込', '手動消込', '補正適用']),
    salesReview: salesRows.filter(function(item) { return item.progressStatus === '要確認'; }).length,
    salesMatched: salesRows.filter(function(item) { return item.progressStatus === '入金済'; }).length,
    salesPartial: salesRows.filter(function(item) { return item.progressStatus === '一部入金'; }).length,
    salesUnpaid: salesRows.filter(function(item) { return item.progressStatus === '未入金'; }).length,
    salesOverdue: salesRows.filter(function(item) { return item.alert === '期限超過'; }).length,
    conquestCases: buildOperationalConquestViewContexts_(ss).length,
    insuranceCases: buildOperationalInsuranceViewContexts_(ss).length,
    invoiceReview: countRowsByVisibleValues_(ss, '請求書発行', '入金状況', ['要確認']),
    invoiceOverdue: countRowsByVisibleValues_(ss, '請求書発行', 'アラート', ['期限超過'])
  };
}

function countRowsByVisibleValues_(ss, sheetName, headerName, visibleValues) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return 0;

  const headerMap = getHeaderMap_(sheet);
  const col = headerMap[headerName];
  if (!col) return 0;

  const values = sheet.getRange(2, col, sheet.getLastRow() - 1, 1).getValues();
  let count = 0;
  values.forEach(function(row) {
    const value = String(row[0] || '').trim();
    if (visibleValues.indexOf(value) >= 0) {
      count += 1;
    }
  });
  return count;
}

function buildDailyOperationsMessage_(summary, elapsedSec) {
  const bank = summary.bankImport || {};
  const lines = [
    '日次一括実行が完了しました。',
    '処理時間: ' + elapsedSec + '秒',
    '銀行CSV: 成功 ' + (bank.successFiles || 0) + '件 / 失敗 ' + (bank.failedFiles || 0) + '件 / 追加 ' + (bank.addedRecords || 0) + '件',
    'クレカ・現金・請求書取込: ' + (summary.receiptsOk ? 'OK' : '未完'),
    '自動照合: ' + (summary.matchingOk ? 'OK' : '未完'),
    '補正・整列: ' + (summary.maintenanceOk ? 'OK' : '未完'),
    '月次集計更新: ' + (summary.summaryOk ? 'OK' : '未完')
  ];

  if (summary.errors.length) {
    lines.push('エラー:');
    summary.errors.forEach(function(item) {
      lines.push('- ' + item);
    });
  }

  return lines.join('\n');
}

function getErrorMessage_(error) {
  return error && error.message ? error.message : String(error || '不明なエラー');
}

function retryFailedBankCsv() {
  const inputFolder = DriveApp.getFolderById(BANK_PDF_IMPORT.inputFolderId);
  const failureFolder = DriveApp.getFolderById(BANK_PDF_IMPORT.errorFolderId);
  const files = failureFolder.getFiles();
  let count = 0;

  while (files.hasNext()) {
    const file = files.next();
    if (!/\.csv$/i.test(file.getName())) {
      continue;
    }
    moveFileToFolderSafely_(file, inputFolder);
    count += 1;
  }

  Logger.log(count + '件のCSVをエラーフォルダから戻しました');
  return count;
}

function rerunFailedBankCsvImports() {
  const moved = retryFailedBankCsv();
  const summary = runImportBankCsv();
  SpreadsheetApp.getUi().alert([
    'エラーCSV再実行が完了しました。',
    '戻したCSV: ' + moved + '件',
    '成功: ' + (summary ? summary.successFiles : 0) + '件',
    '失敗: ' + (summary ? summary.failedFiles : 0) + '件'
  ].join('\n'));
  return summary;
}

function showAllBankRows() {
  applyBankStatusFilter_([]);
}

function showReviewBankRows() {
  applyBankStatusFilter_(['未照合', '要確認', 'カード入金照合']);
}

function showMatchedBankRows() {
  applyBankStatusFilter_(['自動消込', '手動消込', '補正適用']);
}

function clearBankSheetFilterCriteria() {
  applyBankStatusFilter_(null);
}

function showReviewSalesRows() {
  applySheetStatusFilter_('振込入金リスト一覧', '入金状況', ['要確認']);
}

function showOverdueSalesRows() {
  applySheetStatusFilter_('振込入金リスト一覧', 'アラート', ['期限超過']);
}

function showUnpaidSalesRows() {
  applySheetStatusFilter_('振込入金リスト一覧', '入金状況', ['未入金']);
}

function clearSalesSheetFilterCriteria() {
  clearSheetFilterCriteria_('振込入金リスト一覧', ['入金状況', 'アラート']);
}

function showReviewInvoiceRows() {
  applySheetStatusFilter_('請求書発行', '入金状況', ['要確認']);
}

function showOverdueInvoiceRows() {
  applySheetStatusFilter_('請求書発行', 'アラート', ['期限超過']);
}

function showUnpaidInvoiceRows() {
  applySheetStatusFilter_('請求書発行', '入金状況', ['未入金']);
}

function clearInvoiceSheetFilterCriteria() {
  clearSheetFilterCriteria_('請求書発行', ['入金状況', 'アラート']);
}

function applyBankStatusFilter_(visibleStatuses) {
  if (visibleStatuses === null) {
    clearSheetFilterCriteria_(BANK_PDF_IMPORT.bankSheetName, ['ステータス']);
    return;
  }

  if (!visibleStatuses.length) {
    clearSheetFilterCriteria_(BANK_PDF_IMPORT.bankSheetName, ['ステータス']);
    return;
  }

  applySheetStatusFilter_(BANK_PDF_IMPORT.bankSheetName, 'ステータス', visibleStatuses);
}

function applySheetStatusFilter_(sheetName, headerName, visibleValues) {
  const sheet = getSheetForFilter_(sheetName);
  if (!sheet) return;

  const headerMap = getHeaderMap_(sheet);
  const col = headerMap[headerName];
  if (!col) {
    throw new Error(sheetName + ' の列が見つかりません: ' + headerName);
  }

  const filter = ensureSheetFilter_(sheet);
  if (!filter) return;

  const criteria = SpreadsheetApp.newFilterCriteria()
    .setVisibleValues(visibleValues)
    .build();
  filter.setColumnFilterCriteria(col, criteria);
}

function clearSheetFilterCriteria_(sheetName, headerNames) {
  const sheet = getSheetForFilter_(sheetName);
  if (!sheet) return;

  const filter = ensureSheetFilter_(sheet);
  if (!filter) return;

  const headerMap = getHeaderMap_(sheet);
  (headerNames || []).forEach(function(headerName) {
    const col = headerMap[headerName];
    if (col) {
      filter.removeColumnFilterCriteria(col);
    }
  });
}

function getSheetForFilter_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return null;
  return sheet;
}

function ensureSheetFilter_(sheet) {
  let filter = sheet.getFilter();
  if (!filter) {
    sheet.getDataRange().createFilter();
    filter = sheet.getFilter();
  }
  return filter;
}

function importBankCsvFilesToSheet() {
  return importBankPdfFilesToSheet();
}

function setupBankPdfImportTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'importBankPdfFilesToSheet') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('importBankPdfFilesToSheet').timeBased().everyMinutes(5).create();
}

function requestBankPdfRereadForSelectedRow() {
  const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!activeSpreadsheet) {
    SpreadsheetApp.getUi().alert('アクティブなスプレッドシートを取得できません。');
    return;
  }
  if (activeSpreadsheet.getId() !== BANK_PDF_IMPORT.spreadsheetId) {
    SpreadsheetApp.getUi().alert('対象のスプレッドシートで実行してください。');
    return;
  }

  const sheet = activeSpreadsheet.getActiveSheet();
  if (!sheet || sheet.getName() !== BANK_PDF_IMPORT.bankSheetName) {
    SpreadsheetApp.getUi().alert('「銀行データチェック用」シートで対象行を選択してください。');
    return;
  }

  const range = sheet.getActiveRange();
  if (!range) {
    SpreadsheetApp.getUi().alert('再読込したい行を選択してください。');
    return;
  }

  const headerMap = getHeaderMap_(sheet);
  const fileIdCol = headerMap['OCR元ファイルID'];
  if (!fileIdCol) {
    SpreadsheetApp.getUi().alert('OCR元ファイルID 列が見つかりません。');
    return;
  }

  const values = sheet.getRange(range.getRow(), fileIdCol, range.getNumRows(), 1).getValues();
  const queued = loadRereadQueue_();
  let count = 0;
  values.forEach(function(row) {
    const fileId = safeString_(row[0]);
    if (fileId) {
      queued[fileId] = true;
      count += 1;
    }
  });

  if (!count) {
    SpreadsheetApp.getUi().alert('選択範囲に再読込できるファイルIDがありません。');
    return;
  }

  PropertiesService.getScriptProperties().setProperty(
    BANK_PDF_IMPORT.rereadQueueProperty,
    JSON.stringify(Object.keys(queued))
  );
  SpreadsheetApp.getUi().alert(count + ' 件の再読込依頼を登録しました。');
}

function importBankPdfFilesToSheet() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    writeImportLog_('', '', new Date(), 'SKIPPED', 0, 0, 0, buildErrorMessage_(BANK_PDF_IMPORT.errorCodes.lockTimeout, '前回実行が継続中のため今回の実行をスキップしました。'));
    return;
  }
  try {
    const props = PropertiesService.getScriptProperties();
    const enabled = props.getProperty(BANK_PDF_IMPORT.importEnabledProperty);
    if (enabled && enabled !== 'Y') {
      writeImportLog_('', '', new Date(), 'SKIPPED', 0, 0, 0, 'OPENAI_PDF_IMPORT_ENABLED が Y ではありません。');
      return;
    }

    const apiKey = props.getProperty(BANK_PDF_IMPORT.apiKeyProperty);

    const spreadsheet = getNyukinRuntimeSpreadsheet_();
    const bankSheet = ensureBankSheet_(spreadsheet);
    const correctionSheet = ensureCorrectionSheet_(spreadsheet);
    const logSheet = ensureLogSheet_(spreadsheet);
    const rawSheet = ensureRawSheet_(spreadsheet);
    const japaneseOcrSheet = ensureJapaneseOcrSheet_(spreadsheet);
    const withdrawalSheet = ensureWithdrawalSheet_(spreadsheet);
    hideSheetIfVisible_(logSheet);
    hideSheetIfVisible_(rawSheet);
    hideSheetIfVisible_(withdrawalSheet);

    const correctionMap = loadApprovedCorrections_(correctionSheet);
    let existingRows = loadExistingBankRows_(bankSheet);
    const salesMaster = loadSalesMaster_(spreadsheet);
    const aliasMap = loadAliasMap_(spreadsheet);
    const japaneseOcrMap = loadJapaneseOcrDataMap_(japaneseOcrSheet);
    const files = collectTargetFiles_(Object.keys(japaneseOcrMap));
    if (!files.length) {
      writeImportLog_('', '', new Date(), 'NO_FILES', 0, 0, 0, '対象PDFはありません。');
      syncMonthlySummary_(spreadsheet, bankSheet);
      return;
    }
    const processedQueuedIds = {};
    const allWithdrawalRows = [];

    files.forEach(function(file) {
      const fileId = file.getId();
      const fileName = file.getName();
      const updatedAt = file.getLastUpdated();
      let importedCount = 0;
      let skippedNonIncomeCount = 0;
      let errorCount = 0;

      try {
        const ocrData = japaneseOcrMap[fileId];
        const ocrText = ocrData ? ocrData.ocrText : '';
        const structuredRows = ocrData ? ocrData.structuredRows : [];
        let extraction;
        if (structuredRows && structuredRows.length) {
          extraction = buildExtractionFromNormalizedRows_(structuredRows, ocrText, fileName);
        } else {
          writeImportLog_(
            fileId,
            fileName,
            updatedAt,
            'SKIPPED',
            0,
            0,
            0,
            buildErrorMessage_(BANK_PDF_IMPORT.errorCodes.missingPreparedOcr, '日本語OCR用 に normalized_rows が未準備のため処理をスキップしました。')
          );
          return;
        }
        if (!safeString_(extraction.ocr_text)) {
          throw new Error(buildErrorMessage_(BANK_PDF_IMPORT.errorCodes.noOcrText, 'OpenAI からOCR本文を取得できませんでした。'));
        }

        writeRawLog_(rawSheet, fileId, fileName, extraction.ocr_text);

        const upserts = [];
        const correctionCandidates = [];
        const bankName = safeString_(extraction.bank_name);

        if (!(extraction.transactions || []).length) {
          const emptyNormalized = buildDocumentLevelErrorRow_(file, bankName, BANK_PDF_IMPORT.errorCodes.noTransactions, '取引行を抽出できませんでした。', extraction.ocr_text);
          upserts.push(buildBankRowFromExtraction_(emptyNormalized));
          correctionCandidates.push(buildCorrectionCandidateRow_(emptyNormalized, upserts[0]));
        }

        (extraction.transactions || []).forEach(function(tx, index) {
          const normalized = normalizeExtractedTransaction_(tx, bankName, file, index + 1);
          if (!normalized.isIncome && !normalized.errorCode) {
            skippedNonIncomeCount += 1;
            // 出金データを収集（支払一覧連携用）
            if (normalized.amount && normalized.dateText) {
              allWithdrawalRows.push([
                normalized.dateText,
                normalized.sourceAccount || '',
                normalized.counterpartySummary || normalized.partnerName || '',
                Math.abs(normalized.amount),
                normalized.fileName || '',
                normalized.fileId || '',
                new Date()
              ]);
            }
            return;
          }

          const correction = correctionMap[normalized.correctionKey];
          const bankRow = correction ? buildCorrectedBankRow_(normalized, correction) : buildBankRowFromExtraction_(normalized);
          if (!correction) {
            applyMatchResult_(bankRow, reconcileBankRow_(bankRow, normalized, salesMaster, aliasMap));
          }

          if (bankRow.status === BANK_PDF_IMPORT.statuses.review ||
              bankRow.status.indexOf('OCRエラー:') === 0 ||
              bankRow.status.indexOf('抽出エラー:') === 0) {
            correctionCandidates.push(buildCorrectionCandidateRow_(normalized, bankRow));
          }

          upserts.push(bankRow);
        });

        const hasExplicitNormalizedRows = structuredRows.some(function(row) {
          return row && row.sourceType === 'normalized_rows';
        });
        if (hasExplicitNormalizedRows) {
          pruneBankRowsForFileExceptKeys_(bankSheet, fileId, upserts.map(function(row) { return row.importKey; }));
          existingRows = loadExistingBankRows_(bankSheet);
        }
        upsertBankRows_(bankSheet, existingRows, upserts);
        existingRows = loadExistingBankRows_(bankSheet);
        appendCorrectionCandidates_(correctionSheet, correctionCandidates);
        syncMonthlySummary_(spreadsheet, bankSheet);

        moveFileToFolder_(file, BANK_PDF_IMPORT.successFolderId);
        importedCount = upserts.length;
        errorCount = correctionCandidates.filter(function(row) { return safeString_(row[10]); }).length;
        writeImportLog_(fileId, fileName, updatedAt, 'SUCCESS', importedCount, skippedNonIncomeCount, errorCount, '取込完了');
        processedQueuedIds[fileId] = true;
      } catch (error) {
        if (BANK_PDF_IMPORT.moveFailedFilesToErrorFolder) {
          moveFileToFolder_(file, BANK_PDF_IMPORT.errorFolderId);
        }
        writeImportLog_(fileId, fileName, updatedAt, 'ERROR', importedCount, skippedNonIncomeCount, 1, safeString_(error && error.message) || '不明なエラー');
      }
    });

    removeProcessedQueueIds_(processedQueuedIds);
    syncMonthlySummary_(spreadsheet, bankSheet);

    // 出金データを銀行出金一覧シートに追記
    if (allWithdrawalRows.length) {
      appendWithdrawalRows_(withdrawalSheet, allWithdrawalRows);
    }
  } finally {
    try {
      lock.releaseLock();
    } catch (error) {
    }
  }
}

function ensureBankSheet_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(BANK_PDF_IMPORT.bankSheetName);
  if (!sheet) {
    throw new Error('銀行データチェック用 シートが見つかりません。');
  }
  ensureHeaders_(sheet, BANK_PDF_BANK_HEADERS);
  return sheet;
}

function ensureCorrectionSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(BANK_PDF_IMPORT.correctionSheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(BANK_PDF_IMPORT.correctionSheetName);
  }
  ensureHeaders_(sheet, BANK_PDF_CORRECTION_HEADERS);
  if (sheet.getFrozenRows() !== 1) {
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureLogSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(BANK_PDF_IMPORT.logSheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(BANK_PDF_IMPORT.logSheetName);
  }
  ensureHeaders_(sheet, BANK_PDF_LOG_HEADERS);
  return sheet;
}

function ensureRawSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(BANK_PDF_IMPORT.rawSheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(BANK_PDF_IMPORT.rawSheetName);
  }
  ensureHeaders_(sheet, BANK_PDF_RAW_HEADERS);
  return sheet;
}

function ensureWithdrawalSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(BANK_PDF_IMPORT.withdrawalSheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(BANK_PDF_IMPORT.withdrawalSheetName);
    sheet.hideSheet();
  }
  ensureHeaders_(sheet, BANK_PDF_WITHDRAWAL_HEADERS);
  if (sheet.getFrozenRows() !== 1) {
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function appendWithdrawalRows_(sheet, rows) {
  if (!rows || !rows.length) return;
  const existingKeys = {};
  if (sheet.getLastRow() > 1) {
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, BANK_PDF_WITHDRAWAL_HEADERS.length).getValues();
    data.forEach(function(row) {
      var key = safeString_(row[0]) + '|' + safeString_(row[2]) + '|' + String(row[3]) + '|' + safeString_(row[5]);
      existingKeys[key] = true;
    });
  }
  var newRows = rows.filter(function(row) {
    var key = safeString_(row[0]) + '|' + safeString_(row[2]) + '|' + String(row[3]) + '|' + safeString_(row[5]);
    return !existingKeys[key];
  });
  if (newRows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, BANK_PDF_WITHDRAWAL_HEADERS.length).setValues(newRows);
  }
}

function ensureJapaneseOcrSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(BANK_PDF_IMPORT.japaneseOcrSheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(BANK_PDF_IMPORT.japaneseOcrSheetName);
  }
  ensureHeaders_(sheet, BANK_PDF_JAPANESE_OCR_HEADERS);
  if (sheet.getFrozenRows() !== 1) {
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  const existing = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const needsUpdate = headers.some(function(header, index) {
    return safeString_(existing[index]) !== header;
  });
  if (needsUpdate) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function hideSheetIfVisible_(sheet) {
  if (!sheet.isSheetHidden()) {
    sheet.hideSheet();
  }
}

function collectTargetFiles_(preparedFileIds) {
  const filesById = {};
  const iterator = DriveApp.getFolderById(BANK_PDF_IMPORT.inputFolderId).getFiles();
  while (iterator.hasNext()) {
    const file = iterator.next();
    if (isPdfFile_(file)) {
      filesById[file.getId()] = file;
    }
  }

  (preparedFileIds || []).forEach(function(fileId) {
    if (!fileId || filesById[fileId]) {
      return;
    }
    try {
      filesById[fileId] = DriveApp.getFileById(fileId);
    } catch (error) {
      writeImportLog_(fileId, '', new Date(), 'SKIPPED', 0, 0, 0, buildErrorMessage_(BANK_PDF_IMPORT.errorCodes.fileReadFailed, '日本語OCR用 の対象ファイルを取得できませんでした。'));
    }
  });

  Object.keys(loadRereadQueue_()).forEach(function(fileId) {
    try {
      filesById[fileId] = DriveApp.getFileById(fileId);
    } catch (error) {
      writeImportLog_(fileId, '', new Date(), 'ERROR', 0, 0, 1, buildErrorMessage_(BANK_PDF_IMPORT.errorCodes.fileReadFailed, '再読込対象ファイルを取得できませんでした。'));
    }
  });

  return Object.keys(filesById).map(function(id) { return filesById[id]; });
}

function loadRereadQueue_() {
  const raw = PropertiesService.getScriptProperties().getProperty(BANK_PDF_IMPORT.rereadQueueProperty);
  const map = {};
  if (!raw) {
    return map;
  }
  try {
    JSON.parse(raw).forEach(function(fileId) { map[fileId] = true; });
  } catch (error) {
    return {};
  }
  return map;
}

function removeProcessedQueueIds_(processedMap) {
  const queued = loadRereadQueue_();
  Object.keys(processedMap).forEach(function(fileId) { delete queued[fileId]; });
  PropertiesService.getScriptProperties().setProperty(BANK_PDF_IMPORT.rereadQueueProperty, JSON.stringify(Object.keys(queued)));
}

function loadJapaneseOcrDataMap_(sheet) {
  const map = {};
  if (!sheet || sheet.getLastRow() <= 1) {
    return map;
  }
  sheet.getRange(2, 1, sheet.getLastRow() - 1, BANK_PDF_JAPANESE_OCR_HEADERS.length).getValues().forEach(function(row) {
    const fileId = safeString_(row[0]);
    const pageNo = parseInteger_(row[2]);
    const ocrMethod = safeString_(row[3]);
    const ocrText = safeString_(row[4]).replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
    if (!fileId || !ocrText) {
      return;
    }
    if (!map[fileId]) {
      map[fileId] = { ocrPages: [], structuredRows: [] };
    }
    if (ocrMethod === 'normalized_rows') {
      const normalizedRow = parseNormalizedOcrRow_(ocrText);
      if (normalizedRow) {
        map[fileId].structuredRows.push(normalizedRow);
      }
      return;
    }
    map[fileId].ocrPages.push({
      pageNo: pageNo || map[fileId].ocrPages.length + 1,
      text: ocrText
    });
  });

  Object.keys(map).forEach(function(fileId) {
    if (!map[fileId].structuredRows.length && map[fileId].ocrPages.length) {
      map[fileId].structuredRows = buildStructuredRowsFromJapaneseOcrPages_(map[fileId].ocrPages)
        .concat(map[fileId].structuredRows);
    }
    const dedupedRows = {};
    map[fileId].structuredRows.forEach(function(row) {
      if (row && row.rowNo) {
        dedupedRows[String(row.rowNo)] = row;
      }
    });
    map[fileId].structuredRows = Object.keys(dedupedRows)
      .map(function(key) { return dedupedRows[key]; })
      .sort(function(a, b) { return a.rowNo - b.rowNo; });
    map[fileId].ocrText = map[fileId].ocrPages
      .sort(function(a, b) { return a.pageNo - b.pageNo; })
      .map(function(item) { return item.text; })
      .join('\n\n');
  });
  return map;
}

function parseNormalizedOcrRow_(text) {
  const raw = safeString_(text);
  if (!raw) {
    return null;
  }
  if (raw.slice(0, 1) === '{') {
    try {
      const parsed = JSON.parse(raw);
      const summary = chooseNormalizedSummary_(
        safeString_(parsed.summary),
        safeString_(parsed.account),
        safeString_(parsed.raw_text)
      );
      const account = normalizeNormalizedAccount_(safeString_(parsed.account));
      return {
        sourceType: 'normalized_rows',
        importTarget: safeString_(parsed.import_target || parsed.importTarget || 'Y').toUpperCase(),
        internalTransfer: safeString_(parsed.internal_transfer || parsed.internalTransfer).toUpperCase(),
        columnSide: safeString_(parsed.column_side || parsed.columnSide).toLowerCase(),
        date: safeString_(parsed.date),
        amount: parseNumber_(parsed.amount),
        summary: summary,
        otherParty: safeString_(parsed.other_party),
        account: account,
        rowNo: parseInteger_(parsed.row_no),
        rawLine: safeString_(parsed.raw_text) || raw
      };
    } catch (error) {
    }
  }
  const parts = raw.split('\t');
  if (parts.length < 5) {
    return null;
  }
  return {
    sourceType: 'normalized_rows',
    importTarget: 'Y',
    internalTransfer: '',
    columnSide: '',
    date: safeString_(parts[0]),
    amount: parseNumber_(parts[1]),
    summary: safeString_(parts[2]),
    otherParty: safeString_(parts[3]),
    account: '',
    rowNo: parseInteger_(parts[4]),
    rawLine: safeString_(text)
  };
}

function chooseNormalizedSummary_(summary, account, rawText) {
  const cleanedSummary = safeString_(summary);
  if (looksMeaningfulSummary_(cleanedSummary)) {
    return cleanedSummary;
  }
  const fallback = buildSummaryFromAccount_(account, rawText);
  return fallback || cleanedSummary;
}

function looksMeaningfulSummary_(value) {
  const text = safeString_(value);
  if (!text) {
    return false;
  }
  return /[A-Za-zＡ-Ｚａ-ｚぁ-んァ-ヶ一-龠㈱]/.test(text);
}

function buildSummaryFromAccount_(account, rawText) {
  const source = safeString_(rawText) || safeString_(account);
  const rawLines = source.split('/').map(function(part) { return safeString_(part); }).filter(function(part) { return part; });
  const deduped = [];
  rawLines.forEach(function(line) {
    if (!deduped.length || deduped[deduped.length - 1] !== line) {
      deduped.push(line);
    }
  });
  const filtered = deduped.filter(function(line) {
    if (/^\d{2}\/\d{2}$/.test(line)) {
      return false;
    }
    return ['売掛金', '買掛金', '仮受金', '仮払金', '雑収入', '保険手数料', '短期借入金', '受取利息', '受取配当金', '受取手数料', '未収入金', '立替金', '前受金', '支払保険料', '諸口'].indexOf(line) === -1;
  });
  if (!filtered.length) {
    return safeString_(account);
  }
  return normalizeWhitespace_(filtered[0]);
}

function normalizeWhitespace_(value) {
  return safeString_(value).replace(/\s+/g, ' ').trim();
}

function normalizeNormalizedAccount_(account) {
  const text = normalizeWhitespace_(account);
  if (!text) {
    return '';
  }
  const knownAccounts = ['売掛金', '買掛金', '仮受金', '仮払金', '雑収入', '保険手数料', '長期借入金', '短期借入金', '受取利息', '受取配当金', '受取手数料', '未収入金', '立替金', '預り金', '前受金', '支払利息', '支払保険料', '諸口', '普通預金'];
  let matched = '';
  knownAccounts.forEach(function(name) {
    if (text.indexOf(name) >= 0) {
      matched = name;
    }
  });
  return matched || text;
}

function buildExtractionFromNormalizedRows_(rows, ocrText, fileName) {
  const transactions = rows.filter(function(row) {
    return safeString_(row.importTarget || 'Y') === 'Y';
  }).map(function(row) {
    return {
      date: row.date,
      row_no: row.rowNo,
      own_summary: row.account || '',
      counterparty_summary: row.summary,
      partner_name: row.otherParty,
      debit_amount: row.amount,
      credit_amount: 0,
      balance: '',
      confidence: 1,
      error_code: '',
      error_message: '',
      raw_line: row.rawLine
    };
  });
  return {
    bank_name: '普通預金（株式会社ブリッジ）',
    ocr_text: ocrText || ('normalized_rows:' + safeString_(fileName)),
    transactions: transactions
  };
}

function pruneBankRowsForFileExceptKeys_(sheet, fileId, keepKeys) {
  if (!sheet || !fileId) {
    return;
  }
  const keepMap = {};
  (keepKeys || []).forEach(function(key) {
    keepMap[safeString_(key)] = true;
  });
  if (sheet.getLastRow() <= 1) {
    return;
  }
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, BANK_PDF_BANK_HEADERS.length).getValues();
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const row = values[index];
    if (safeString_(row[27]) !== fileId) {
      continue;
    }
    const importKey = buildImportKeyFromSheetRow_(row);
    if (!keepMap[importKey]) {
      sheet.deleteRow(index + 2);
    }
  }
}

function buildStructuredRowsFromJapaneseOcrPages_(ocrPages) {
  const sortedPages = (ocrPages || []).slice().sort(function(a, b) {
    return a.pageNo - b.pageNo;
  });
  const ocrText = sortedPages.map(function(page) { return safeString_(page.text); }).join('\n\n');
  if (!ocrText) {
    return [];
  }

  const period = parseStatementPeriod_(ocrText);
  const lines = ocrText.split(/\r?\n/).map(function(line) {
    return safeString_(line);
  });
  const rows = [];
  let currentDate = '';
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line) {
      index += 1;
      continue;
    }
    if (isMonthDayText_(line)) {
      currentDate = resolveStatementDate_(line, period);
      index += 1;
      continue;
    }
    if (isIgnorableOcrLine_(line)) {
      index += 1;
      continue;
    }

    const amountIndex = findNextMeaningfulLine_(lines, index + 1);
    if (!currentDate || amountIndex < 0 || !isAmountText_(lines[amountIndex])) {
      index += 1;
      continue;
    }

    const subject = line;
    const amount = parseNumber_(lines[amountIndex]);
    let cursor = amountIndex + 1;
    const summaryLines = [];
    while (cursor < lines.length) {
      const value = safeString_(lines[cursor]);
      if (!value) {
        cursor += 1;
        continue;
      }
      if (isMonthDayText_(value) || isAmountText_(value)) {
        break;
      }
      if (!isIgnorableOcrLine_(value)) {
        summaryLines.push(value);
      }
      cursor += 1;
    }

    if (cursor >= lines.length || !isAmountText_(lines[cursor])) {
      index += 1;
      continue;
    }

    cursor += 1;
    const otherPartyLines = [];
    while (cursor < lines.length) {
      const value = safeString_(lines[cursor]);
      if (!value) {
        cursor += 1;
        continue;
      }
      if (isMonthDayText_(value) || isRowNumberText_(value)) {
        break;
      }
      if (!isIgnorableOcrLine_(value)) {
        otherPartyLines.push(value);
      }
      cursor += 1;
    }

    const rowNo = cursor < lines.length && isRowNumberText_(lines[cursor]) ? parseInteger_(lines[cursor]) : 0;
    if (rowNo) {
      cursor += 1;
    }

    const summary = joinUniqueOcrLines_(summaryLines) || subject;
    const otherParty = joinUniqueOcrLines_(otherPartyLines);
    if (currentDate && amount && summary) {
      rows.push({
        date: currentDate,
        amount: amount,
        summary: summary,
        otherParty: otherParty,
        rowNo: rowNo || rows.length + 1,
        rawLine: [subject, formatNumberForRawLine_(amount)].concat(summaryLines).concat(otherPartyLines).join(' / ')
      });
    }
    index = cursor;
  }

  return rows;
}

function parseStatementPeriod_(ocrText) {
  const match = safeString_(ocrText).match(/(\d{4})年(\d{2})月\d{2}日[～~](\d{4})年(\d{2})月\d{2}日/);
  if (!match) {
    return null;
  }
  return {
    startYear: Number(match[1]),
    startMonth: Number(match[2]),
    endYear: Number(match[3]),
    endMonth: Number(match[4])
  };
}

function resolveStatementDate_(monthDayText, period) {
  const match = safeString_(monthDayText).match(/^(\d{2})\/(\d{2})$/);
  if (!match) {
    return '';
  }
  const month = Number(match[1]);
  const day = Number(match[2]);
  let year = new Date().getFullYear();
  if (period) {
    year = month >= period.startMonth ? period.startYear : period.endYear;
  }
  return Utilities.formatDate(new Date(year, month - 1, day), 'Asia/Tokyo', 'yyyy-MM-dd');
}

function isMonthDayText_(value) {
  return /^(\d{2})\/(\d{2})$/.test(safeString_(value));
}

function isAmountText_(value) {
  const normalized = safeString_(value).replace(/,/g, '').replace(/\s+/g, '');
  return /^-?\d{3,}$/.test(normalized);
}

function isRowNumberText_(value) {
  return /^\d{1,4}$/.test(safeString_(value));
}

function isIgnorableOcrLine_(value) {
  const text = safeString_(value);
  if (!text) {
    return true;
  }
  if ([
    '相手科目', '日付', '自', '摘', '要', '残高', '番号', '税区分', '相手補助科目', '相手部門',
    '借方金額', '貸方金額', '自補助', '普通預金', '株式会社ブリッジ', '前頁残高', '繰越残高',
    '普', '通', '預', '金', 'CB', '会'
  ].indexOf(text) >= 0) {
    return true;
  }
  return text.indexOf('株式会社ブリッジ') >= 0 || /年\d{2}月\d{2}日[～~]\d{4}年\d{2}月\d{2}日/.test(text);
}

function findNextMeaningfulLine_(lines, startIndex) {
  let index = startIndex;
  while (index < lines.length) {
    const value = safeString_(lines[index]);
    if (value) {
      return index;
    }
    index += 1;
  }
  return -1;
}

function joinUniqueOcrLines_(lines) {
  const unique = [];
  (lines || []).forEach(function(line) {
    const value = safeString_(line);
    if (!value) {
      return;
    }
    if (!unique.length || unique[unique.length - 1] !== value) {
      unique.push(value);
    }
  });
  return unique.join(' ');
}

function formatNumberForRawLine_(value) {
  return parseNumber_(value).toLocaleString('en-US');
}

function isPdfFile_(file) {
  const mimeType = safeString_(file.getMimeType()).toLowerCase();
  return mimeType === MimeType.PDF.toLowerCase() || safeString_(file.getName()).toLowerCase().slice(-4) === '.pdf';
}

function extractPdfWithOpenAi_(file, apiKey, modelName) {
  const base64 = Utilities.base64Encode(file.getBlob().getBytes());
  const payload = {
    model: modelName || BANK_PDF_IMPORT.openAiModelDefault,
    input: [{
      role: 'user',
      content: [
        { type: 'input_file', filename: file.getName(), file_data: base64 },
        {
          type: 'input_text',
          text: [
            'あなたは銀行PDFの転記アシスタントです。',
            '必ずPDFの内容だけを根拠にJSONを返してください。',
            'この帳票では「入金」という文字はありません。借方金額を入金として扱い、貸方金額は入金ではありません。',
            '摘要欄には「相手摘要」を入れてください。',
            '各取引は次のフィールドで返してください: date, row_no, own_summary, counterparty_summary, partner_name, debit_amount, credit_amount, balance, confidence, error_code, error_message, raw_line。',
            '抽出できない項目は空文字か 0 を入れ、error_code と error_message に理由を入れてください。',
            'ocr_text にはPDF内の読めた本文を可能な限り残してください。',
            'date は YYYY-MM-DD 形式で返してください。'
          ].join('\n')
        }
      ]
    }],
    text: {
      format: {
        type: 'json_schema',
        name: 'bank_pdf_statement',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['bank_name', 'ocr_text', 'transactions'],
          properties: {
            bank_name: { type: 'string' },
            ocr_text: { type: 'string' },
            transactions: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['date', 'row_no', 'own_summary', 'counterparty_summary', 'partner_name', 'debit_amount', 'credit_amount', 'balance', 'confidence', 'error_code', 'error_message', 'raw_line'],
                properties: {
                  date: { type: 'string' },
                  row_no: { type: 'integer' },
                  own_summary: { type: 'string' },
                  counterparty_summary: { type: 'string' },
                  partner_name: { type: 'string' },
                  debit_amount: { type: 'number' },
                  credit_amount: { type: 'number' },
                  balance: { type: 'string' },
                  confidence: { type: 'number' },
                  error_code: { type: 'string' },
                  error_message: { type: 'string' },
                  raw_line: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    max_output_tokens: 8000
  };

  const response = UrlFetchApp.fetch(BANK_PDF_IMPORT.openAiEndpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    muteHttpExceptions: true,
    payload: JSON.stringify(payload)
  });

  const statusCode = response.getResponseCode();
  const body = response.getContentText();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(buildErrorMessage_(BANK_PDF_IMPORT.errorCodes.openAiFailed, 'OpenAI API エラー: ' + statusCode + ' ' + body));
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    throw new Error(buildErrorMessage_(BANK_PDF_IMPORT.errorCodes.malformedResponse, 'OpenAIレスポンスをJSONとして解釈できません。'));
  }

  const outputText = extractOutputText_(parsed);
  if (!outputText) {
    throw new Error(buildErrorMessage_(BANK_PDF_IMPORT.errorCodes.noOcrText, 'OpenAIレスポンス本文が空です。'));
  }

  try {
    return JSON.parse(outputText);
  } catch (error) {
    throw new Error(buildErrorMessage_(BANK_PDF_IMPORT.errorCodes.malformedResponse, 'Structured Outputs のJSON解析に失敗しました。'));
  }
}

function extractTransactionsFromOcrTextWithOpenAi_(ocrText, fileName, apiKey, modelName) {
  if (!apiKey) {
    throw new Error(buildErrorMessage_(BANK_PDF_IMPORT.errorCodes.missingApiKey, 'OPENAI_API_KEY が未設定です。'));
  }
  const payload = {
    model: modelName || BANK_PDF_IMPORT.openAiModelDefault,
    input: [{
      role: 'user',
      content: [{
        type: 'input_text',
        text: [
          'あなたは銀行PDFの転記アシスタントです。',
          'これから渡すのは、日本語OCR済みの銀行帳票本文です。OCR本文だけを根拠にJSONを返してください。',
          'この帳票では「入金」という文字はありません。借方金額を入金として扱い、貸方金額は入金ではありません。',
          '摘要欄には「相手摘要」を入れてください。',
          '各取引は次のフィールドで返してください: date, row_no, own_summary, counterparty_summary, partner_name, debit_amount, credit_amount, balance, confidence, error_code, error_message, raw_line。',
          '抽出できない項目は空文字か 0 を入れ、error_code と error_message に理由を入れてください。',
          'ocr_text には渡した本文を可能な限り残してください。',
          'date は YYYY-MM-DD 形式で返してください。',
          'ファイル名: ' + safeString_(fileName),
          'OCR本文:',
          safeString_(ocrText)
        ].join('\n')
      }]
    }],
    text: {
      format: {
        type: 'json_schema',
        name: 'bank_pdf_statement',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['bank_name', 'ocr_text', 'transactions'],
          properties: {
            bank_name: { type: 'string' },
            ocr_text: { type: 'string' },
            transactions: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['date', 'row_no', 'own_summary', 'counterparty_summary', 'partner_name', 'debit_amount', 'credit_amount', 'balance', 'confidence', 'error_code', 'error_message', 'raw_line'],
                properties: {
                  date: { type: 'string' },
                  row_no: { type: 'integer' },
                  own_summary: { type: 'string' },
                  counterparty_summary: { type: 'string' },
                  partner_name: { type: 'string' },
                  debit_amount: { type: 'number' },
                  credit_amount: { type: 'number' },
                  balance: { type: 'string' },
                  confidence: { type: 'number' },
                  error_code: { type: 'string' },
                  error_message: { type: 'string' },
                  raw_line: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    max_output_tokens: 8000
  };

  return callOpenAiForStructuredExtraction_(payload, apiKey);
}

function callOpenAiForStructuredExtraction_(payload, apiKey) {
  const response = UrlFetchApp.fetch(BANK_PDF_IMPORT.openAiEndpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    muteHttpExceptions: true,
    payload: JSON.stringify(payload)
  });

  const statusCode = response.getResponseCode();
  const body = response.getContentText();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(buildErrorMessage_(BANK_PDF_IMPORT.errorCodes.openAiFailed, 'OpenAI API エラー: ' + statusCode + ' ' + body));
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    throw new Error(buildErrorMessage_(BANK_PDF_IMPORT.errorCodes.malformedResponse, 'OpenAIレスポンスをJSONとして解釈できません。'));
  }

  const outputText = extractOutputText_(parsed);
  if (!outputText) {
    throw new Error(buildErrorMessage_(BANK_PDF_IMPORT.errorCodes.noOcrText, 'OpenAIレスポンス本文が空です。'));
  }

  try {
    return JSON.parse(outputText);
  } catch (error) {
    throw new Error(buildErrorMessage_(BANK_PDF_IMPORT.errorCodes.malformedResponse, 'Structured Outputs のJSON解析に失敗しました。'));
  }
}

function extractOutputText_(responseJson) {
  if (safeString_(responseJson.output_text)) {
    return responseJson.output_text;
  }
  const texts = [];
  (responseJson.output || []).forEach(function(item) {
    if (item.type === 'message' && item.content) {
      item.content.forEach(function(content) {
        if (content.type === 'output_text' && safeString_(content.text)) {
          texts.push(content.text);
        }
      });
    }
  });
  return texts.join('\n');
}

function normalizeExtractedTransaction_(tx, bankName, file, fallbackRowNo) {
  const rowNo = parseInteger_(tx.row_no) || fallbackRowNo;
  const date = parseIsoDate_(tx.date);
  const amount = parseNumber_(tx.debit_amount);
  const summary = safeString_(tx.counterparty_summary) || safeString_(tx.own_summary);
  const partnerName = safeString_(tx.partner_name);
  const rawLine = safeString_(tx.raw_line) || summary || partnerName;
  const isTransfer = isInternalTransferSummary_([summary, partnerName, rawLine].join(' '));
  const dateText = date ? Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd') : '';
  let errorCode = safeString_(tx.error_code);
  let errorMessage = safeString_(tx.error_message);

  if (!date) {
    errorCode = errorCode || BANK_PDF_IMPORT.errorCodes.missingDate;
    errorMessage = errorMessage || '日付を抽出できませんでした。';
  } else if (!amount) {
    errorCode = errorCode || BANK_PDF_IMPORT.errorCodes.missingAmount;
    errorMessage = errorMessage || '借方金額を抽出できませんでした。';
  } else if (!summary) {
    errorCode = errorCode || BANK_PDF_IMPORT.errorCodes.missingSummary;
    errorMessage = errorMessage || '相手摘要を抽出できませんでした。';
  }

  return {
    bankName: bankName,
    fileId: file.getId(),
    fileName: file.getName(),
    updatedAt: file.getLastUpdated(),
    date: date,
    dateText: dateText,
    rowNo: rowNo,
    counterpartySummary: summary,
    partnerName: partnerName,
    sourceAccount: safeString_(tx.own_summary),
    amount: amount,
    errorCode: errorCode,
    errorMessage: errorMessage,
    rawLine: rawLine,
    correctionKey: buildCorrectionKey_(bankName, rawLine, dateText, amount),
    isIncome: amount > 0 && !isTransfer
  };
}

function buildDocumentLevelErrorRow_(file, bankName, errorCode, errorMessage, ocrText) {
  return {
    bankName: bankName,
    fileId: file.getId(),
    fileName: file.getName(),
    updatedAt: file.getLastUpdated(),
    date: null,
    dateText: '',
    rowNo: 0,
    counterpartySummary: safeString_(ocrText).slice(0, 200) || '該当なし',
    partnerName: '該当なし',
    amount: 0,
    errorCode: errorCode,
    errorMessage: errorMessage,
    rawLine: safeString_(ocrText).slice(0, 500),
    correctionKey: buildCorrectionKey_(bankName, safeString_(ocrText).slice(0, 500), '', 0),
    isIncome: false
  };
}

function buildBankRowFromExtraction_(normalized) {
  const row = {
    importKey: buildImportKey_(normalized),
    date: normalized.date,
    amount: normalized.amount,
    summary: normalized.counterpartySummary || '該当なし',
    partnerName: normalized.partnerName || '該当なし',
    customerNo: '',
    businessNo: '',
    status: BANK_PDF_IMPORT.statuses.unmatched,
    monthValue: normalized.date ? new Date(normalized.date.getFullYear(), normalized.date.getMonth(), 1) : '',
    subject: '普通預金',
    counterSubject: normalized.sourceAccount || '諸口',
    rowNo: normalized.rowNo,
    dataImportedAt: new Date(),
    otherParty: normalized.bankName,
    fileName: normalized.fileName,
    fileId: normalized.fileId,
    updatedAt: normalized.updatedAt,
    voucherType: '入金',
    name: normalized.partnerName || normalized.counterpartySummary || '該当なし'
  };

  if (normalized.errorCode) {
    row.status = (normalized.date || normalized.amount) ? '抽出エラー:' + normalized.errorCode : 'OCRエラー:' + normalized.errorCode;
    row.summary = prefixErrorSummary_(normalized.errorCode, normalized.counterpartySummary || '該当なし');
    row.partnerName = normalized.partnerName || '該当なし';
    row.name = row.partnerName;
  }

  return row;
}

function buildCorrectedBankRow_(normalized, correction) {
  const row = buildBankRowFromExtraction_(normalized);
  row.partnerName = safeString_(correction.correctedName) || row.partnerName;
  row.customerNo = safeString_(correction.customerNo);
  row.businessNo = safeString_(correction.businessNo);
  row.summary = safeString_(correction.summary) || row.summary;
  row.name = row.partnerName;
  row.status = safeString_(correction.status) || BANK_PDF_IMPORT.statuses.corrected;
  return row;
}

function reconcileBankRow_(bankRow, normalized, salesMaster, aliasMap) {
  if (bankRow.status.indexOf('OCRエラー:') === 0 || bankRow.status.indexOf('抽出エラー:') === 0) {
    return { status: bankRow.status };
  }

  const targetDateKey = normalized.date ? Utilities.formatDate(normalized.date, 'Asia/Tokyo', 'yyyy-MM-dd') : '';
  const targetAmount = bankRow.amount;
  const targetName = normalizeText_(bankRow.partnerName || bankRow.summary);
  const extractedBusinessNo = extractBusinessNo_(normalized.counterpartySummary + ' ' + normalized.partnerName + ' ' + normalized.rawLine);

  const direct = salesMaster.filter(function(item) {
    if (item.dateKey !== targetDateKey || item.amount !== targetAmount) {
      return false;
    }
    if (extractedBusinessNo && item.businessNo === extractedBusinessNo) {
      return true;
    }
    if (!targetName) {
      return false;
    }
    if (item.matchTokens.indexOf(targetName) >= 0) {
      return true;
    }
    return item.matchTokens.some(function(token) {
      return token && (targetName.indexOf(token) >= 0 || token.indexOf(targetName) >= 0);
    });
  });

  if (direct.length === 1) {
    return buildMatchedResult_(direct[0]);
  }
  if (direct.length > 1) {
    return { status: BANK_PDF_IMPORT.statuses.review, errorCode: BANK_PDF_IMPORT.errorCodes.ambiguousMatch };
  }

  const aliasHits = salesMaster.filter(function(item) {
    if (item.dateKey !== targetDateKey || item.amount !== targetAmount) {
      return false;
    }
    return (aliasMap[item.customerNo] || []).some(function(alias) {
      const token = normalizeText_(alias);
      return token && (targetName.indexOf(token) >= 0 || token.indexOf(targetName) >= 0);
    });
  });

  if (aliasHits.length === 1) {
    return buildMatchedResult_(aliasHits[0]);
  }
  if (aliasHits.length > 1) {
    return { status: BANK_PDF_IMPORT.statuses.review, errorCode: BANK_PDF_IMPORT.errorCodes.ambiguousMatch };
  }

  return { status: BANK_PDF_IMPORT.statuses.unmatched };
}

function buildMatchedResult_(candidate) {
  return {
    status: BANK_PDF_IMPORT.statuses.matched,
    customerNo: candidate.customerNo,
    businessNo: candidate.businessNo,
    partnerName: candidate.matchedName,
    counterSubject: '売掛金'
  };
}

function applyMatchResult_(bankRow, result) {
  if (!result) {
    return;
  }
  if (result.customerNo) {
    bankRow.customerNo = result.customerNo;
  }
  if (result.businessNo) {
    bankRow.businessNo = result.businessNo;
  }
  if (result.partnerName) {
    bankRow.partnerName = result.partnerName;
    bankRow.name = result.partnerName;
  }
  if (result.subject) {
    bankRow.subject = result.subject;
  }
  if (result.counterSubject) {
    bankRow.counterSubject = result.counterSubject;
  }
  if (result.status) {
    bankRow.status = result.status;
  }
  if (result.errorCode) {
    bankRow.summary = prefixErrorSummary_(result.errorCode, bankRow.summary || '該当なし');
  }
}

function loadApprovedCorrections_(sheet) {
  const map = {};
  if (sheet.getLastRow() <= 1) {
    return map;
  }
  sheet.getRange(2, 1, sheet.getLastRow() - 1, BANK_PDF_CORRECTION_HEADERS.length).getValues().forEach(function(row) {
    const enabled = safeString_(row[0]).toUpperCase() === 'Y';
    const approved = safeString_(row[1]) === '承認';
    const key = safeString_(row[2]);
    if (!enabled || !approved || !key) {
      return;
    }
    map[key] = {
      correctedName: safeString_(row[12]),
      customerNo: safeString_(row[13]),
      businessNo: safeString_(row[14]),
      summary: safeString_(row[15]),
      status: safeString_(row[16]) || BANK_PDF_IMPORT.statuses.corrected
    };
  });
  return map;
}

function appendCorrectionCandidates_(sheet, rows) {
  if (!rows.length) {
    return;
  }
  const existingKeys = {};
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 3, sheet.getLastRow() - 1, 1).getValues().forEach(function(row) {
      existingKeys[safeString_(row[0])] = true;
    });
  }
  const filtered = rows.filter(function(row) {
    const key = safeString_(row[2]);
    if (!key || existingKeys[key]) {
      return false;
    }
    existingKeys[key] = true;
    return true;
  });
  if (filtered.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, filtered.length, filtered[0].length).setValues(filtered);
  }
}

function buildCorrectionCandidateRow_(normalized, bankRow) {
  return [
    'Y', '', normalized.correctionKey, normalized.fileId, normalized.fileName, normalized.rawLine, normalized.dateText, normalized.amount,
    normalized.partnerName, bankRow.summary, normalized.errorCode, normalized.errorMessage, '', '', '', '', '', '', ''
  ];
}

function loadExistingBankRows_(sheet) {
  const map = {};
  if (sheet.getLastRow() <= 1) {
    return map;
  }
  sheet.getRange(2, 1, sheet.getLastRow() - 1, BANK_PDF_BANK_HEADERS.length).getValues().forEach(function(row, index) {
    map[buildImportKeyFromSheetRow_(row)] = index + 2;
  });
  return map;
}

/**
 * OCR行のスコアを計算する。
 * 加点: 日付あり, 金額あり, 摘要が「該当なし」でない, 名前が「該当なし」でない,
 *       業務Noあり, ステータスが自動消込/補正適用, エラーなし
 * 減点: OCRエラー/抽出エラーステータス, 主要項目が「該当なし」, 金額0
 */
function calcOcrScore_(row) {
  let score = 0;
  const date = row[0];
  const amount = parseFloat(row[1]) || 0;
  const summary = safeString_(row[2]);
  const businessNo = safeString_(row[4]);
  const status = safeString_(row[5]);
  const name = safeString_(row[43]);

  if (date && date !== '') score += 10;
  if (amount > 0) score += 10;
  if (summary && summary !== '該当なし' && summary.indexOf('OCRエラー') === -1 && summary.indexOf('抽出エラー') === -1) score += 5;
  if (name && name !== '該当なし') score += 5;
  if (businessNo) score += 5;
  if (status === BANK_PDF_IMPORT.statuses.matched) score += 10;
  if (status === BANK_PDF_IMPORT.statuses.corrected) score += 8;
  if (status.indexOf('OCRエラー:') === 0) score -= 15;
  if (status.indexOf('抽出エラー:') === 0) score -= 8;
  if (summary === '該当なし') score -= 3;
  if (name === '該当なし') score -= 3;
  if (amount === 0) score -= 5;

  return score;
}

function upsertBankRows_(sheet, existingRows, bankRows) {
  const newRows = [];
  bankRows.forEach(function(bankRow) {
    const values = convertBankRowToSheetRow_(bankRow);
    const rowIndex = existingRows[bankRow.importKey];
    if (rowIndex) {
      // 既存行と新OCR結果を比較し、スコアが改善する場合のみ上書き
      const existingValues = sheet.getRange(rowIndex, 1, 1, BANK_PDF_BANK_HEADERS.length).getValues()[0];
      const existingScore = calcOcrScore_(existingValues);
      const newScore = calcOcrScore_(values);
      if (newScore > existingScore) {
        sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
      }
      // 新スコアが同等以下の場合は既存を保持（何もしない）
    } else {
      newRows.push(values);
      existingRows[bankRow.importKey] = sheet.getLastRow() + newRows.length;
    }
  });
  if (newRows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
  }
}

function convertBankRowToSheetRow_(bankRow) {
  const row = new Array(BANK_PDF_BANK_HEADERS.length).fill('');
  row[0] = bankRow.date || '';
  row[1] = bankRow.amount || '';
  row[2] = bankRow.summary || '該当なし';
  row[3] = bankRow.customerNo || '';
  row[4] = bankRow.businessNo || '';
  row[5] = bankRow.status || BANK_PDF_IMPORT.statuses.unmatched;
  row[6] = bankRow.monthValue || '';
  row[8] = bankRow.subject || '諸口';
  row[10] = bankRow.partnerName || '該当なし';
  row[11] = bankRow.rowNo || '';
  row[12] = bankRow.rowNo || '';
  row[16] = bankRow.counterSubject || '諸口';
  row[23] = bankRow.dataImportedAt || new Date();
  row[24] = bankRow.summary || '該当なし';
  row[25] = bankRow.otherParty || '';
  row[26] = bankRow.fileName || '';
  row[27] = bankRow.fileId || '';
  row[28] = bankRow.updatedAt || '';
  row[29] = bankRow.voucherType || '入金';
  row[43] = bankRow.name || bankRow.partnerName || '該当なし';
  return row;
}

function buildImportKeyFromSheetRow_(row) {
  const dateKey = row[0] instanceof Date ? Utilities.formatDate(row[0], 'Asia/Tokyo', 'yyyy-MM-dd') : normalizeDateText_(row[0]);
  return [dateKey, parseNumber_(row[1]), safeString_(row[27]), safeString_(row[11])].join('|');
}

function buildImportKey_(normalized) {
  return [normalized.dateText, normalized.amount, normalized.fileId, normalized.rowNo].join('|');
}

function buildCorrectionKey_(bankName, rawLine, dateText, amount) {
  return [normalizeText_(bankName), normalizeText_(rawLine), dateText, amount].join('|');
}

function loadSalesMaster_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(BANK_PDF_IMPORT.salesSheetName);
  if (!sheet) {
    return [];
  }
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return [];
  }
  const headers = values[0];
  const businessIdx = findHeaderIndex_(headers, ['業務№', '業務No', '業務NO', '業務No.']);
  const dateIdx = findHeaderIndex_(headers, ['日付']);
  const customerIdx = findHeaderIndex_(headers, ['顧客名']);
  const billToIdx = findHeaderIndex_(headers, ['請求先名']);
  const amountIdx = 37;

  return values.slice(1).map(function(row) {
    const customerNo = extractCustomerNoFromRow_(row, headers);
    const businessNo = businessIdx >= 0 ? safeString_(row[businessIdx]) : '';
    const rowDate = dateIdx >= 0 ? parseAnySheetDate_(row[dateIdx]) : null;
    const amount = parseNumber_(row[amountIdx]);
    const customerName = customerIdx >= 0 ? safeString_(row[customerIdx]) : '';
    const billToName = billToIdx >= 0 ? safeString_(row[billToIdx]) : '';
    return {
      customerNo: customerNo,
      businessNo: businessNo,
      dateKey: rowDate ? Utilities.formatDate(rowDate, 'Asia/Tokyo', 'yyyy-MM-dd') : '',
      amount: amount,
      matchedName: billToName || customerName,
      matchTokens: compact_([normalizeText_(businessNo), normalizeText_(customerName), normalizeText_(billToName)])
    };
  }).filter(function(item) {
    return item.dateKey && item.amount;
  });
}

function extractCustomerNoFromRow_(row, headers) {
  const headerIndex = findHeaderIndex_(headers, ['顧客No.', '顧客No', '顧客番号']);
  if (headerIndex >= 0 && safeString_(row[headerIndex])) {
    return safeString_(row[headerIndex]);
  }
  const match = row.map(function(value) { return safeString_(value); }).join(' ').match(/KK\d{8}/i);
  return match ? match[0].toUpperCase() : '';
}

function loadAliasMap_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(BANK_PDF_IMPORT.aliasSheetName);
  if (!sheet) {
    return {};
  }
  const map = {};
  const values = sheet.getDataRange().getValues();
  values.slice(1).forEach(function(row) {
    const customerNo = safeString_(row[0]);
    if (!customerNo) {
      return;
    }
    if (!map[customerNo]) {
      map[customerNo] = [];
    }
    compact_([row[1], row[2]]).forEach(function(value) {
      if (map[customerNo].indexOf(value) === -1) {
        map[customerNo].push(value);
      }
    });
  });
  return map;
}

function syncMonthlySummary_(spreadsheet, bankSheet) {
  const summarySheet = spreadsheet.getSheetByName(BANK_PDF_IMPORT.depositSummarySheetName);
  if (!summarySheet) {
    return;
  }

  const labels = summarySheet.getRange(1, 1, summarySheet.getLastRow(), 1).getValues();
  let summaryRow = -1;
  labels.forEach(function(row, index) {
    if (safeString_(row[0]) === '振り込み') {
      summaryRow = index + 1;
    }
  });
  if (summaryRow < 1) {
    return;
  }

  const months = summarySheet.getRange(1, 2, 1, summarySheet.getLastColumn() - 1).getValues()[0];
  const totals = {};
  const bankRows = bankSheet.getLastRow() > 1 ? bankSheet.getRange(2, 1, bankSheet.getLastRow() - 1, BANK_PDF_BANK_HEADERS.length).getValues() : [];
  bankRows.forEach(function(row) {
    const status = safeString_(row[5]);
    if (BANK_PDF_IMPORT.visibleSuccessStatuses.indexOf(status) === -1) {
      return;
    }
    const monthValue = row[6] instanceof Date ? row[6] : parseAnySheetDate_(row[6]);
    if (!monthValue) {
      return;
    }
    const key = Utilities.formatDate(monthValue, 'Asia/Tokyo', 'yyyy-MM');
    totals[key] = (totals[key] || 0) + parseNumber_(row[1]);
  });

  const output = months.map(function(month) {
    const monthDate = month instanceof Date ? month : parseAnySheetDate_(month);
    if (!monthDate) {
      return '';
    }
    return totals[Utilities.formatDate(monthDate, 'Asia/Tokyo', 'yyyy-MM')] || 0;
  });
  summarySheet.getRange(summaryRow, 2, 1, output.length).setValues([output]);
}

function moveFileToFolder_(file, folderId) {
  if (!file || !folderId) {
    return;
  }

  try {
    file.moveTo(DriveApp.getFolderById(folderId));
  } catch (error) {
    writeImportLog_(
      file.getId(),
      file.getName(),
      file.getLastUpdated(),
      'MOVE_ERROR',
      0,
      0,
      1,
      buildErrorMessage_(BANK_PDF_IMPORT.errorCodes.moveFailed, 'ファイル移動に失敗: ' + safeString_(error && error.message))
    );
  }
}

function writeRawLog_(sheet, fileId, fileName, ocrText) {
  sheet.appendRow([fileId, fileName, new Date(), ocrText, BANK_PDF_IMPORT.openAiPromptVersion]);
}

function writeImportLog_(fileId, fileName, updatedAt, status, importedCount, skippedNonIncomeCount, errorCount, message) {
  const spreadsheet = getNyukinRuntimeSpreadsheet_();
  const sheet = ensureLogSheet_(spreadsheet);
  sheet.appendRow([fileId, fileName, updatedAt, status, importedCount, skippedNonIncomeCount, errorCount, message, new Date()]);
  hideSheetIfVisible_(sheet);
}

function getHeaderMap_(sheet) {
  const map = {};
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].forEach(function(header, index) {
    map[safeString_(header)] = index + 1;
  });
  return map;
}

function findHeaderIndex_(headers, candidates) {
  for (let i = 0; i < headers.length; i += 1) {
    if (candidates.indexOf(safeString_(headers[i])) >= 0) {
      return i;
    }
  }
  return -1;
}

function extractBusinessNo_(text) {
  const match = safeString_(text).match(/SB\d{8}/i);
  return match ? match[0].toUpperCase() : '';
}

function prefixErrorSummary_(errorCode, summary) {
  return '[ERR:' + errorCode + '] ' + (safeString_(summary) || '該当なし');
}

function buildErrorMessage_(errorCode, message) {
  return '[ERR:' + errorCode + '] ' + message;
}

function isInternalTransferSummary_(value) {
  const raw = safeString_(value);
  const normalized = normalizeText_(raw);
  return /[资資]金移動/.test(raw) || /[资資]金移動/.test(normalized);
}

function normalizeText_(value) {
  return safeString_(value)
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(char) { return String.fromCharCode(char.charCodeAt(0) - 65248); })
    .replace(/[‐‑‒–—―ーｰ]/g, '-')
    .replace(/\s+/g, '')
    .replace(/[()（）「」『』［］\[\]<>＜＞.,、。・\/]/g, '')
    .toUpperCase();
}

function normalizeDateText_(value) {
  const date = parseAnySheetDate_(value);
  return date ? Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd') : safeString_(value);
}

function parseIsoDate_(value) {
  const text = safeString_(value);
  if (!text) {
    return null;
  }
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : parseAnySheetDate_(text);
}

function parseAnySheetDate_(value) {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if (typeof value === 'number' && value > 30000) {
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }
  const text = safeString_(value);
  if (!text) {
    return null;
  }
  let match = text.match(/^R\s*(\d{1,2})\/(\d{1,2})\/(\d{1,2})$/i);
  if (match) {
    return new Date(2018 + Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  match = text.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return null;
}

function parseNumber_(value) {
  if (typeof value === 'number') {
    return value;
  }
  const text = safeString_(value).replace(/,/g, '').replace(/[^\d.-]/g, '');
  return text ? Number(text) : 0;
}

function parseInteger_(value) {
  if (typeof value === 'number') {
    return Math.floor(value);
  }
  const text = safeString_(value).replace(/[^\d-]/g, '');
  return text ? Number(text) : 0;
}

function safeString_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function compact_(values) {
  return values.filter(function(value) { return safeString_(value); });
}
