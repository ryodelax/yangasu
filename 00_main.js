/**
 * ============================================================
 * 顧客対応状況CSV 取込スクリプト
 * - CSVヘッダー名を既存シートヘッダーへマッピング
 * - OCR / Gemini を通さず CSV から直接取込
 * - CSV検出ログを強化
 * - 実行中に何件見えているかを明示
 * ============================================================
 */

const CFG = {
  INPUT_FOLDER_ID: '1Lyv3oWFDFItT6PO2MdygdWte8h5eU-4B',
  PDF_FOLDER_ID: '1Lyv3oWFDFItT6PO2MdygdWte8h5eU-4B',
  DONE_FOLDER_ID: '1LYSgwUdjvf9JZGuC7brtvI8C_wdPvhiY',
  ERR_FOLDER_ID: '1vPQ1FTzHxfx1Pm5GSRnC1mqPLWV49c5I',
  SOURCE_SERVICE_SPREADSHEET_ID: '1QNctVAnkattCX9dyT9DBmaPXWF9-nsfmZwEtEp4t1R8',
  MANAGEMENT_SPREADSHEET_ID: '1wX6LR1ssqThgPAIHRyUNeuvROsnXqDMcwFbMCj1PB8M',
  FINAL_MANAGEMENT_SPREADSHEET_ID: '1MlRuk07huFmp6_QhOjXoAX4lOCtZ2JHocoBm8TcaTnk',
  MANAGEMENT_REFRESH_SHEET: '進捗状況',
  MANAGEMENT_REFRESH_CHECKBOX_A1: 'AP1',
  MANAGEMENT_REFRESH_LABEL_A1: 'AN1',
  STAGE1_SHEET: 'OCR生データ',
  STAGE2_SHEET_SYAKEN: '顧客対応状況（車検）',
  STAGE2_SHEET_12TEN: '顧客対応状況（12点）',
  MANAGEMENT_STAGE2_SHEET_SYAKEN: 'AS_車検取込',
  MANAGEMENT_STAGE2_SHEET_12TEN: 'AS_12点取込',
  MANAGEMENT_STAGE2_SUMMARY_SHEET: 'AS_中間集計',
  MANAGEMENT_AFTERSALES_SHEET: 'ｱﾌﾀｰｾｰﾙｽ',
  MANAGEMENT_PROGRESS_SHEET: '進捗状況',
  VEHICLE_SALES_SHEET: '顧客対応状況（車両販売）',
  AUDIT_SHEET: 'OCR取込チェック',
  GEMINI_MODEL: 'gemini-2.5-flash',
  TIMEZONE: 'Asia/Tokyo',
  MAX_RUNTIME_MS: 300000,
  GEMINI_MAX_RETRIES: 3,
  GEMINI_RETRY_WAIT_MS: 65000,
  GEMINI_MAX_OUTPUT_TOKENS: 16384,
  USE_GEMINI_PRIMARY: true,
  USE_GEMINI_FALLBACK: true,
  GEMINI_FALLBACK_MAX_BLOCKS_PER_CALL: 3,
  GEMINI_FALLBACK_MAX_CHARS_PER_CALL: 9000,
  GEMINI_FALLBACK_SINGLE_BLOCK_MAX_CHARS: 7000,
  GEMINI_CALL_SLEEP_MS: 1500,
  MAX_LOG_CHARS: 1200,
  RUNTIME_SAFETY_MARGIN_MS: 45000,
  IMPORT_STATE_PREFIX: 'PDF_IMPORT_STATE_',
  IMPORT_TEMP_FOLDER_NAME: '__pdf_import_state',
  CSV_ENCODINGS: ['UTF-8', 'Shift-JIS', 'CP932'],
  STAGE2_SHAKEN_DATA_START_ROW: 2,
  STAGE2_12TEN_DATA_START_ROW: 2
};

const STAGE1_HEADERS = [
  'ファイル名',
  '読み込み日時',
  '整備No',
  '日付',
  '顧客名',
  '年式',
  '車名',
  '入庫予定日',
  '入庫日',
  '納車予定日',
  '納車日',
  '車検日',
  '作業大区分',
  '整備店舗',
  '営業店舗',
  '管理店舗',
  '整備担当',
  '営業担当',
  '管理担当',
  '作業小区分名',
  '請求先名',
  '状況',
  '売上総計',
  '粗利益'
];

const AUDIT_HEADERS = [
  '確認日時',
  '元シート',
  '整備No',
  'ファイル名',
  '問題',
  '日付',
  '顧客名',
  '整備店舗',
  '作業大区分',
  '状況'
];

function getDefaultStage2Headers_() {
  return [
    '整備ナンバー',
    '状況',
    '法人/個人',
    '入金予定日',
    '日付',
    '顧客名',
    '売上総計',
    '粗利益',
    '整備店舗',
    '車名',
    '年式',
    '見積日',
    '入庫日',
    '入庫予定日',
    '納車予定日',
    '納車日',
    '作業大区分',
    '請求先名',
    '車検日'
  ];
}

function getStage2ExtraColumns_() {
  return ['法人/個人', '入金予定日'];
}

function getDefaultManagementStage2Headers_() {
  return [
    '整備ナンバー',
    '状況',
    '日付',
    '見積日',
    '入金予定日',
    '売上総計',
    '粗利益',
    'ブランド',
    '作業大区分',
    '作業大区分_raw'
  ];
}

function getFinalManagementStage2Headers_() {
  return [
    '整備ナンバー',
    '状況',
    '日付',
    '見積日',
    '売上総計',
    '粗利益',
    'ブランド',
    '作業大区分',
    '作業大区分_raw'
  ];
}

function getFinalManagementVehicleSalesHeaders_() {
  return [
    '進捗',
    '顧客名',
    '販売金額（税込）',
    '想定粗利',
    '確定売上',
    '確定利益',
    '案件発生日',
    '受注日',
    '登録予定日',
    '登録決定日',
    'ブランド'
  ];
}

function onOpenServiceWorkflowLegacy_() {
  const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!activeSpreadsheet || activeSpreadsheet.getId() !== CFG.SOURCE_SERVICE_SPREADSHEET_ID) {
    return;
  }
  try {
    setVehicleSalesDropdown_();
  } catch (error) {
    Logger.log('車両販売プルダウン初期化失敗: ' + error.message);
  }
  buildServiceWorkflowMenu_();
}

function buildServiceWorkflowMenu_() {
  const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!activeSpreadsheet || activeSpreadsheet.getId() !== CFG.SOURCE_SERVICE_SPREADSHEET_ID) {
    return;
  }
  const ui = SpreadsheetApp.getUi();
  const afterSalesImportMenu = ui.createMenu('取り込み')
    .addItem('営業用へCSV取込', 'runDailyImport');

  const afterSalesReflectMenu = ui.createMenu('反映')
    .addItem('管理用へ反映', 'fullResyncServiceSheets');

  const afterSalesSupportMenu = ui.createMenu('補助')
    .addItem('営業用日付補完', 'repairCurrentServiceStage2Dates_')
    .addSeparator()
    .addItem('CSVフォルダ確認', 'debugListPdfFiles')
    .addItem('CSV1件テスト', 'debugSingleFile');

  ui.createMenu('アフターセールス')
    .addSubMenu(afterSalesImportMenu)
    .addSubMenu(afterSalesReflectMenu)
    .addSubMenu(afterSalesSupportMenu)
    .addToUi();

  const vehicleSalesImportMenu = ui.createMenu('取り込み')
    .addItem('入力アプリの案内', 'showVehicleSalesInputGuide_')
    .addItem('入力データ保存先を準備', 'setupVehicleSalesAppFromMenu_')
    .addItem('進捗プルダウンを再設定', 'setVehicleSalesDropdown');

  const vehicleSalesReflectMenu = ui.createMenu('反映')
    .addItem('管理用反映を確認', 'showVehicleSalesReflectGuide_');

  ui.createMenu('車両販売')
    .addSubMenu(vehicleSalesImportMenu)
    .addSubMenu(vehicleSalesReflectMenu)
    .addToUi();
}

function openServiceWorkflowMenu_() {
  const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!activeSpreadsheet || activeSpreadsheet.getId() !== CFG.SOURCE_SERVICE_SPREADSHEET_ID) {
    return;
  }
  try {
    setVehicleSalesDropdown_();
  } catch (error) {
    Logger.log('車両販売プルダウン初期化失敗: ' + error.message);
  }
  buildServiceWorkflowMenu_();
}

function runImportSeibiCsv() {
  return runDailyImport();
}

function importSeibiCsv() {
  return runDailyImport();
}

function installServiceWorkflowOpenTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (
      trigger.getHandlerFunction() === 'openServiceWorkflowMenu_' &&
      trigger.getTriggerSourceId &&
      (
        trigger.getTriggerSourceId() === CFG.SOURCE_SERVICE_SPREADSHEET_ID ||
        trigger.getTriggerSourceId() === CFG.MANAGEMENT_SPREADSHEET_ID ||
        trigger.getTriggerSourceId() === CFG.FINAL_MANAGEMENT_SPREADSHEET_ID
      )
    ) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  [
    CFG.SOURCE_SERVICE_SPREADSHEET_ID
  ].forEach(function(spreadsheetId) {
    ScriptApp.newTrigger('openServiceWorkflowMenu_')
      .forSpreadsheet(spreadsheetId)
      .onOpen()
      .create();
  });
}

function installUnifiedServiceWorkflowTriggers() {
  installServiceWorkflowOpenTrigger();
}

function listUserTriggersForServiceSpreadsheets_() {
  return [
    {
      spreadsheetId: CFG.SOURCE_SERVICE_SPREADSHEET_ID,
      spreadsheetName: '営業用',
      triggers: describeUserTriggersForSpreadsheet_(CFG.SOURCE_SERVICE_SPREADSHEET_ID)
    },
    {
      spreadsheetId: CFG.FINAL_MANAGEMENT_SPREADSHEET_ID,
      spreadsheetName: '管理用',
      triggers: describeUserTriggersForSpreadsheet_(CFG.FINAL_MANAGEMENT_SPREADSHEET_ID)
    }
  ];
}

function cleanupLegacyServiceSpreadsheetTriggers_() {
  const results = [];
  results.push(cleanupLegacyTriggersForSpreadsheet_(CFG.SOURCE_SERVICE_SPREADSHEET_ID, {
    allowedOpenHandlers: ['openServiceWorkflowMenu_'],
    allowedEditHandlers: []
  }));
  results.push(cleanupLegacyTriggersForSpreadsheet_(CFG.FINAL_MANAGEMENT_SPREADSHEET_ID, {
    allowedOpenHandlers: [],
    allowedEditHandlers: []
  }));
  return results;
}

function describeUserTriggersForSpreadsheet_(spreadsheetId) {
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  return ScriptApp.getUserTriggers(spreadsheet).map(function(trigger) {
    return {
      handlerFunction: trigger.getHandlerFunction(),
      eventType: String(trigger.getEventType()),
      triggerSource: String(trigger.getTriggerSource()),
      triggerSourceId: trigger.getTriggerSourceId ? trigger.getTriggerSourceId() : '',
      uniqueId: trigger.getUniqueId ? trigger.getUniqueId() : ''
    };
  });
}

function cleanupLegacyTriggersForSpreadsheet_(spreadsheetId, options) {
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const triggers = ScriptApp.getUserTriggers(spreadsheet);
  const deleted = [];
  const kept = [];

  triggers.forEach(function(trigger) {
    const handler = trigger.getHandlerFunction();
    const eventType = String(trigger.getEventType());
    let shouldDelete = false;

    if (eventType === 'ON_OPEN') {
      shouldDelete = !(options.allowedOpenHandlers || []).includes(handler);
    } else if (eventType === 'ON_EDIT') {
      shouldDelete = !(options.allowedEditHandlers || []).includes(handler);
    }

    if (shouldDelete) {
      ScriptApp.deleteTrigger(trigger);
      deleted.push({
        handlerFunction: handler,
        eventType: eventType,
        triggerSource: String(trigger.getTriggerSource())
      });
      return;
    }

    kept.push({
      handlerFunction: handler,
      eventType: eventType,
      triggerSource: String(trigger.getTriggerSource())
    });
  });

  return {
    spreadsheetId: spreadsheetId,
    deleted: deleted,
    kept: kept
  };
}

function ensureManagementRefreshControl_() {
  disableManagementRefreshControl_();
}

function disableManagementRefreshControl_() {
  const ss = SpreadsheetApp.openById(CFG.FINAL_MANAGEMENT_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CFG.MANAGEMENT_REFRESH_SHEET);
  if (!sheet) return;

  const labelCell = sheet.getRange(CFG.MANAGEMENT_REFRESH_LABEL_A1);
  const checkboxCell = sheet.getRange(CFG.MANAGEMENT_REFRESH_CHECKBOX_A1);

  checkboxCell.clearDataValidations();
  checkboxCell.clearNote();
  checkboxCell.clearContent();
  labelCell.clearNote();
  if (String(labelCell.getValue() || '').trim() === '管理用更新') {
    labelCell.clearContent();
  }
}

function showUiAlertIfAvailable_(message) {
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (error) {
    Logger.log(message);
  }
}

function getSourceServiceSpreadsheet_() {
  return SpreadsheetApp.openById(CFG.SOURCE_SERVICE_SPREADSHEET_ID);
}

function showVehicleSalesInputGuide_() {
  showUiAlertIfAvailable_(
    '車両販売は営業用シートとは別の専用入力アプリで管理します。\n' +
    '案件基本情報、資金移動、収益計上を分けて入力できます。\n' +
    '仕入元と売却先、残債精算、差額受払を営業用と混同せずに整理できます。\n' +
    'Web アプリ URL:\n' + getVehicleSalesAppUsageHint_()
  );
}

function showVehicleSalesReflectGuide_() {
  const status = ensureVehicleSalesManagementImport_({ restoreFormula: true });
  const lines = [
    '車両販売の管理用反映を確認しました。',
    '管理用シート: ' + status.managementSpreadsheetUrl,
    '取込シート: 車両販売_取込'
  ];

  if (status.updated) {
    lines.push('IMPORTRANGE 数式を再設定しました。');
  } else {
    lines.push('IMPORTRANGE 数式は既に有効です。');
  }

  if (!status.ready) {
    lines.push('現在は即時反映を確認できていません。必要なら 管理用 > 車両販売_取込 の IMPORTRANGE アクセス許可を確認してください。');
  }

  showUiAlertIfAvailable_(lines.join('\n'));
}

function ensureVehicleSalesManagementImport_(options) {
  options = options || {};
  const restoreFormula = options.restoreFormula !== false;
  const managementSs = SpreadsheetApp.openById(CFG.FINAL_MANAGEMENT_SPREADSHEET_ID);
  const expectedFormula = buildVehicleSalesManagementImportFormula_();
  const sheet = getOrCreateSheet_(managementSs, '車両販売_取込', getFinalManagementVehicleSalesHeaders_());
  const formulaCell = sheet.getRange('A1');
  const currentFormula = String(formulaCell.getFormula() || '').trim();
  let updated = false;

  if (restoreFormula && currentFormula !== expectedFormula) {
    sheet.clearContents();
    formulaCell.setFormula(expectedFormula);
    updated = true;
    SpreadsheetApp.flush();
  }

  return {
    updated: updated,
    ready: String(formulaCell.getDisplayValue() || '').trim() === '進捗',
    managementSpreadsheetUrl: managementSs.getUrl()
  };
}

function buildVehicleSalesManagementImportFormula_() {
  return '={"進捗","顧客名","販売金額（税込）","想定粗利","確定売上","確定利益","案件発生日","受注日","登録予定日","登録決定日","ブランド";' +
    'QUERY(IMPORTRANGE("' + CFG.SOURCE_SERVICE_SPREADSHEET_ID + '","\'顧客対応状況（車両販売）\'!A2:N"),' +
    '"select Col1,Col2,Col4,Col5,Col6,Col7,Col8,Col9,Col10,Col11,Col14 where Col2 is not null",0)}';
}

function setupVehicleSalesAppFromMenu_() {
  const result = setupVehicleSalesApp();
  showUiAlertIfAvailable_(
    '車両販売入力アプリの保存先を準備しました。\n' +
    '保存先シート:\n' + result.spreadsheetUrl + '\n\n' +
    'アプリURL:\n' + result.usageHint
  );
}

function setVehicleSalesDropdown_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CFG.VEHICLE_SALES_SHEET);

  if (!sheet) {
    Logger.log("シート '顧客対応状況（車両販売）' が見つかりません。");
    return;
  }

  const range = sheet.getRange('A2:A1000');
  const options = [
    'ヒアリング・検討',
    '見積提示',
    '受注',
    '登録見込',
    '登録決定',
    '敗戦',
    '延期'
  ];

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(options, true)
    .setAllowInvalid(true)
    .build();

  range.setDataValidation(rule);
}

function runDailyImport() {
  const startTime = Date.now();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    validateRuntimeConfig_();

    const ss = SpreadsheetApp.getActiveSpreadsheet() || getSourceServiceSpreadsheet_();
    const stage1Sheet = getOrCreateSheet_(ss, CFG.STAGE1_SHEET, STAGE1_HEADERS);
    ensureSheetHeaders_(stage1Sheet, STAGE1_HEADERS);

    const rootFolder = DriveApp.getFolderById(CFG.INPUT_FOLDER_ID);
    const doneFolder = DriveApp.getFolderById(CFG.DONE_FOLDER_ID);
    const errFolder = DriveApp.getFolderById(CFG.ERR_FOLDER_ID);
    const csvFiles = getCsvFilesInFolder_(rootFolder);

    Logger.log('対象フォルダ: ' + rootFolder.getName() + ' / ' + CFG.INPUT_FOLDER_ID);
    Logger.log('検出CSV件数: ' + csvFiles.length);

    if (csvFiles.length === 0) {
      Logger.log('CSVファイルが見つかりませんでした。');
      Logger.log('注意: サブフォルダ内のCSVやショートカットは対象外です。');
      return;
    }

    let processed = 0;
    let failed = 0;
    let interrupted = false;

    for (let i = 0; i < csvFiles.length; i++) {
      if (Date.now() - startTime > CFG.MAX_RUNTIME_MS) {
        Logger.log('実行制限時間が近づいたため途中終了します。残りは次回処理します。');
        interrupted = true;
        break;
      }

      const file = csvFiles[i];

      try {
        Logger.log('処理開始: ' + file.getName() + ' / ' + file.getId());

        const result = processCsvFile_(file);
        const recordCount = (result.records || []).length;
        Logger.log('CSV抽出件数: ' + recordCount);

        if (!recordCount) {
          throw new Error('レコードが0件でした。');
        }

        const now = Utilities.formatDate(new Date(), CFG.TIMEZONE, 'yyyy/MM/dd HH:mm:ss');
        const snapshot = {
          fileName: file.getName(),
          timestamp: now,
          records: result.records || []
        };

        // 1ファイル成功するたびに、OCR生データと振り分けシートを同時更新する。
        replaceStage1WithImportedSnapshots_(stage1Sheet, [snapshot]);
        refreshServiceOutputs_({ syncToManagement: false });
        SpreadsheetApp.flush();

        moveFileToFolderSafely_(file, doneFolder);

        processed += 1;
        try {
          ss.toast(
            '整備CSV取込: ' + processed + '/' + csvFiles.length + ' 件反映済み',
            '整備CSV取込',
            5
          );
        } catch (toastError) {
          Logger.log('toast表示失敗: ' + toastError.message);
        }
        Logger.log('完了: ' + file.getName());
      } catch (error) {
        failed += 1;
        Logger.log('エラー: ' + file.getName() + ' / ' + error.message);

        try {
          clearFileProgressState_(file.getId());
          moveFileToFolderSafely_(file, errFolder);
          Logger.log('ERRフォルダへ移動: ' + file.getName());
        } catch (moveError) {
          Logger.log('ERRフォルダ移動失敗: ' + moveError.message);
        }
      }
    }

    if (processed > 0 && (failed > 0 || interrupted)) {
      Logger.log('一部失敗または途中終了がありましたが、成功ファイル分は反映しました。');
    }

    SpreadsheetApp.flush();
    try {
      ss.toast(
        '整備CSV取込 完了: 成功 ' + processed + ' 件 / 失敗 ' + failed + ' 件',
        '整備CSV取込',
        8
      );
    } catch (toastError) {
      Logger.log('toast表示失敗: ' + toastError.message);
    }
    Logger.log('runDailyImport 完了 / 成功:' + processed + ' 失敗:' + failed);
  } finally {
    lock.releaseLock();
  }
}

function processCsvFile_(file) {
  const csvRows = readCsvFileWithFallback_(file);
  if (!csvRows || csvRows.length < 2) {
    throw new Error('CSVにデータ行がありません。');
  }

  const normalizedHeaderRow = csvRows[0].map(function(header) {
    return normalizeCsvImportHeader_(header);
  });
  const csvHeaderMap = createCsvHeaderMap_(normalizedHeaderRow);
  const matchedHeaders = getMatchedStage1Headers_(csvHeaderMap);

  Logger.log('CSVヘッダー: ' + normalizedHeaderRow.join(' / '));
  Logger.log('STAGE1対応ヘッダー: ' + matchedHeaders.join(' / '));
  Logger.log('CSVデータ行数: ' + (csvRows.length - 1));

  if (!matchedHeaders.length) {
    throw new Error('CSVヘッダーと取込先ヘッダーの対応が見つかりませんでした。');
  }

  return {
    completed: true,
    records: dedupeRecords_(buildStage1RecordsFromCsv_(csvRows.slice(1), csvHeaderMap))
  };
}

function buildStage1RecordsFromCsv_(rows, csvHeaderMap) {
  const records = [];

  (rows || []).forEach(function(row) {
    if (!hasAnyCsvValue_(row)) {
      return;
    }

    const record = buildStage1RecordFromCsvRow_(row, csvHeaderMap);
    if (isStage1RecordEmpty_(record)) {
      return;
    }

    records.push(record);
  });

  return records;
}

function buildStage1RecordFromCsvRow_(row, csvHeaderMap) {
  return {
    '整備No': getCsvValueByAliases_(row, csvHeaderMap, ['整備No', '整備№', '整備ナンバー', '整備番号', '業務№', '業務No', '業務NO']),
    '日付': getCsvValueByAliases_(row, csvHeaderMap, ['日付', '見積日', '受付日', '売上日']),
    '顧客名': getCsvValueByAliases_(row, csvHeaderMap, ['顧客名', '顧客']),
    '年式': getCsvValueByAliases_(row, csvHeaderMap, ['年式', 'モデル年式']),
    '車名': getCsvValueByAliases_(row, csvHeaderMap, ['車名', '車種', '車種名']),
    '入庫予定日': getCsvValueByAliases_(row, csvHeaderMap, ['入庫予定日']),
    '入庫日': getCsvValueByAliases_(row, csvHeaderMap, ['入庫日']),
    '納車予定日': getCsvValueByAliases_(row, csvHeaderMap, ['納車予定日']),
    '納車日': getCsvValueByAliases_(row, csvHeaderMap, ['納車日']),
    '車検日': getCsvValueByAliases_(row, csvHeaderMap, ['車検日', '検査満了日']),
    '作業大区分': getCsvValueByAliases_(row, csvHeaderMap, ['作業大区分', '作業大区分名', '作業区分', '大区分']),
    '整備店舗': getCsvValueByAliases_(row, csvHeaderMap, ['整備店舗', '管理店舗', '営業店舗', '店舗', '店名', '整備担当', '管理担当', '営業担当', '作業小区分名']),
    '営業店舗': getCsvValueByAliases_(row, csvHeaderMap, ['営業店舗']),
    '管理店舗': getCsvValueByAliases_(row, csvHeaderMap, ['管理店舗']),
    '整備担当': getCsvValueByAliases_(row, csvHeaderMap, ['整備担当']),
    '営業担当': getCsvValueByAliases_(row, csvHeaderMap, ['営業担当']),
    '管理担当': getCsvValueByAliases_(row, csvHeaderMap, ['管理担当']),
    '作業小区分名': getCsvValueByAliases_(row, csvHeaderMap, ['作業小区分名']),
    '請求先名': getCsvValueByAliases_(row, csvHeaderMap, ['請求先名', '請求先']),
    '状況': getCsvValueByAliases_(row, csvHeaderMap, ['状況', '進捗', 'ステータス', '業務ステータス']),
    '売上総計': getCsvNumberByAliases_(row, csvHeaderMap, ['売上総計', '売上合計', '売上計']),
    '粗利益': getCsvNumberByAliases_(row, csvHeaderMap, ['粗利益', '粗利'])
  };
}

function getMatchedStage1Headers_(csvHeaderMap) {
  return STAGE1_HEADERS.filter(function(header) {
    if (header === 'ファイル名' || header === '読み込み日時') {
      return false;
    }
    return hasCsvAlias_(csvHeaderMap, getStage1CsvHeaderAliases_()[header] || [header]);
  });
}

function getStage1CsvHeaderAliases_() {
  return {
    '整備No': ['整備No', '整備№', '整備ナンバー', '整備番号', '業務№', '業務No', '業務NO'],
    '日付': ['日付', '見積日', '受付日', '売上日'],
    '顧客名': ['顧客名', '顧客'],
    '年式': ['年式', 'モデル年式'],
    '車名': ['車名', '車種', '車種名'],
    '入庫予定日': ['入庫予定日'],
    '入庫日': ['入庫日'],
    '納車予定日': ['納車予定日'],
    '納車日': ['納車日'],
    '車検日': ['車検日', '検査満了日'],
    '作業大区分': ['作業大区分', '作業大区分名', '作業区分', '大区分'],
    '整備店舗': ['整備店舗', '管理店舗', '営業店舗', '店舗', '店名', '整備担当', '管理担当', '営業担当', '作業小区分名'],
    '営業店舗': ['営業店舗'],
    '管理店舗': ['管理店舗'],
    '整備担当': ['整備担当'],
    '営業担当': ['営業担当'],
    '管理担当': ['管理担当'],
    '作業小区分名': ['作業小区分名'],
    '請求先名': ['請求先名', '請求先'],
    '状況': ['状況', '進捗', 'ステータス', '業務ステータス'],
    '売上総計': ['売上総計', '売上合計', '売上計'],
    '粗利益': ['粗利益', '粗利']
  };
}

function hasCsvAlias_(csvHeaderMap, aliases) {
  return (aliases || []).some(function(alias) {
    return csvHeaderMap[normalizeCsvImportHeader_(alias)] !== undefined;
  });
}

function getCsvValueByAliases_(row, csvHeaderMap, aliases) {
  let fallbackValue = '';

  for (let i = 0; i < (aliases || []).length; i++) {
    const headerKey = normalizeCsvImportHeader_(aliases[i]);
    const index = csvHeaderMap[headerKey];
    if (index !== undefined) {
      const value = normalizeCsvCellValue_(row[index]);
      if (value !== '') {
        return value;
      }
      if (!fallbackValue) {
        fallbackValue = value;
      }
    }
  }
  return fallbackValue;
}

function getCsvNumberByAliases_(row, csvHeaderMap, aliases) {
  const value = getCsvValueByAliases_(row, csvHeaderMap, aliases);
  return value === '' ? 0 : toNum_(value);
}

function createCsvHeaderMap_(headers) {
  const map = {};
  (headers || []).forEach(function(header, index) {
    const key = normalizeCsvImportHeader_(header);
    if (key) {
      map[key] = index;
    }
  });
  return map;
}

function normalizeCsvImportHeader_(value) {
  return applyCsvMojibakeCorrections_(String(value || ''))
    .replace(/^\uFEFF/, '')
    .normalize('NFKC')
    .replace(/[ 　\t\r\n]/g, '')
    .replace(/No\./gi, 'No')
    .replace(/NO/gi, 'No')
    .replace(/No/gi, 'No')
    .trim();
}

function normalizeCsvCellValue_(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return Utilities.formatDate(value, CFG.TIMEZONE, 'yyyy/MM/dd');
  }
  return applyCsvMojibakeCorrections_(String(value)).trim();
}

function applyCsvMojibakeCorrections_(value) {
  let text = String(value || '');
  const replacements = [
    ['業務��', '業務№'],
    ['宮�ｱ　亜希子', '宮﨑　亜希子'],
    ['MTAUTO岡�ｱ', 'MTAUTO岡﨑'],
    ['車台��', '車台№'],
    ['顧客��', '顧客№'],
    ['仕入��', '仕入№'],
    ['�繻ｴ　裕樹', '桒原　裕樹'],
    ['�肝ﾞﾘｯｼﾞ本社', '㈱ﾌﾞﾘｯｼﾞ本社'],
    ['在納点A-�B', '在納点A-③'],
    ['在庫車B-�@', '在庫車B-①'],
    ['新納点A-�@', '新納点A-①'],
    ['-�@', '-①'],
    ['-�A', '-②'],
    ['-�B', '-③'],
    ['川�ｱ裕子', '川﨑裕子'],
    ['宮�ｱ', '宮﨑'],
    ['岡�ｱ', '岡﨑']
  ];

  replacements.forEach(function(pair) {
    text = text.split(pair[0]).join(pair[1]);
  });

  return text;
}

function sanitizeSheetStringValue_(value) {
  if (
    value === null ||
    value === undefined ||
    value instanceof Date ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  return applyCsvMojibakeCorrections_(String(value));
}

function sanitizeRowStringCells_(row) {
  return (row || []).map(function(value) {
    return sanitizeSheetStringValue_(value);
  });
}

function repairSheetStringColumns_(sheet, headerNames, startRow) {
  if (!sheet || !headerNames || !headerNames.length) {
    return false;
  }

  const rowStart = Math.max(2, Number(startRow) || 2);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < rowStart || lastCol < 1) {
    return false;
  }

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(value) { return String(value || '').trim(); });
  const headerMap = createHeaderMap_(headers);
  const targetIndexes = headerNames.map(function(name) {
    return headerMap[name];
  }).filter(function(index) {
    return index !== undefined && index >= 0;
  });

  if (!targetIndexes.length) {
    return false;
  }

  const values = sheet.getRange(rowStart, 1, lastRow - rowStart + 1, lastCol).getValues();
  let changed = false;

  values.forEach(function(row) {
    targetIndexes.forEach(function(index) {
      const original = row[index];
      const sanitized = sanitizeSheetStringValue_(original);
      if (sanitized !== original) {
        row[index] = sanitized;
        changed = true;
      }
    });
  });

  if (changed) {
    sheet.getRange(rowStart, 1, values.length, lastCol).setValues(values);
  }

  return changed;
}

function getServiceStage1SanitizeHeaders_() {
  return [
    '顧客名',
    '請求先名',
    '整備店舗',
    '営業店舗',
    '管理店舗',
    '整備担当',
    '営業担当',
    '管理担当',
    '作業小区分名',
    '作業大区分',
    '車名',
    '年式'
  ];
}

function loadServiceStage1Context_(sourceSheet) {
  if (!sourceSheet) {
    throw new Error('OCR生データシートが見つかりません');
  }

  const lastRow = sourceSheet.getLastRow();
  const lastCol = sourceSheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) {
    return {
      sourceValues: [],
      sourceHeaders: [],
      sourceHeaderMap: {},
      latestMap: new Map(),
      latestRawMap: {}
    };
  }

  const sourceValues = sourceSheet.getRange(1, 1, lastRow, lastCol).getValues();
  const sourceHeaders = sourceValues[0].map(function(value) {
    return String(value || '').trim();
  });
  const sourceHeaderMap = createHeaderMap_(sourceHeaders);
  const targetIndexes = getServiceStage1SanitizeHeaders_().map(function(name) {
    return sourceHeaderMap[name];
  }).filter(function(index) {
    return index !== undefined && index >= 0;
  });
  let sourceChanged = false;

  if (targetIndexes.length && sourceValues.length > 1) {
    for (let rowIndex = 1; rowIndex < sourceValues.length; rowIndex++) {
      const row = sourceValues[rowIndex];
      targetIndexes.forEach(function(index) {
        const original = row[index];
        const sanitized = sanitizeSheetStringValue_(original);
        if (sanitized !== original) {
          row[index] = sanitized;
          sourceChanged = true;
        }
      });
    }
  }

  if (sourceChanged) {
    sourceSheet.getRange(2, 1, sourceValues.length - 1, lastCol).setValues(sourceValues.slice(1));
  }

  const latestMap = new Map();
  for (let i = 1; i < sourceValues.length; i++) {
    const row = sourceValues[i];
    const seibiNo = String(getCellByHeader_(row, sourceHeaderMap, '整備No') || '').trim();

    if (!seibiNo) {
      continue;
    }

    const current = latestMap.get(seibiNo);
    if (!current || isNewerSourceRow_(row, current, sourceHeaderMap)) {
      latestMap.set(seibiNo, row);
    }
  }

  return {
    sourceValues: sourceValues,
    sourceHeaders: sourceHeaders,
    sourceHeaderMap: sourceHeaderMap,
    latestMap: latestMap,
    latestRawMap: buildLatestServiceRawCategoryMapFromContext_(sourceHeaderMap, latestMap)
  };
}

function buildLatestServiceRawCategoryMapFromContext_(sourceHeaderMap, latestMap) {
  const map = {};

  latestMap.forEach(function(row, seibiNo) {
    const sourceDate = pickFirstValidDate_(
      getCellByHeader_(row, sourceHeaderMap, '日付'),
      getCellByHeader_(row, sourceHeaderMap, '入庫日'),
      getCellByHeader_(row, sourceHeaderMap, '入庫予定日')
    );
    map[seibiNo] = {
      rawCategory: sanitizeSheetStringValue_(String(getCellByHeader_(row, sourceHeaderMap, '作業大区分') || '').trim()),
      serviceShop: sanitizeSheetStringValue_(resolveServiceShopFromSourceRow_(row, sourceHeaderMap)),
      sourceDate: sourceDate
    };
  });

  return map;
}

function getElapsedMs_(startedAt) {
  return Date.now() - startedAt;
}

function logElapsedStep_(label, startedAt) {
  Logger.log(label + ': ' + getElapsedMs_(startedAt) + 'ms');
}

function readCsvFileWithFallback_(file) {
  let bestRows = null;
  let bestScore = -1;
  let bestEncoding = '';

  CFG.CSV_ENCODINGS.forEach(function(encoding) {
    try {
      const text = file.getBlob().getDataAsString(encoding).replace(/^\uFEFF/, '');
      const rows = Utilities.parseCsv(text);
      const score = scoreCsvCandidate_(rows);

      if (score > bestScore) {
        bestScore = score;
        bestRows = rows;
        bestEncoding = encoding;
      }
    } catch (error) {
      Logger.log('CSV読込失敗: encoding=' + encoding + ' / ' + error.message);
    }
  });

  if (!bestRows || !bestRows.length) {
    throw new Error('CSVを読み込めませんでした。UTF-8 / Shift-JIS / CP932 を試行済みです。');
  }

  Logger.log('CSV読込エンコーディング: ' + bestEncoding);
  return bestRows;
}

function scoreCsvCandidate_(rows) {
  if (!rows || !rows.length) {
    return -1;
  }

  const headerMap = createCsvHeaderMap_(rows[0]);
  const matchedHeaderCount = getMatchedStage1Headers_(headerMap).length;
  const firstRowWidth = rows[0] ? rows[0].length : 0;

  return matchedHeaderCount * 100 + firstRowWidth;
}

function hasAnyCsvValue_(row) {
  return (row || []).some(function(value) {
    return normalizeCsvCellValue_(value) !== '';
  });
}

function isStage1RecordEmpty_(record) {
  return STAGE1_HEADERS.every(function(header) {
    if (header === 'ファイル名' || header === '読み込み日時') {
      return true;
    }
    const value = record[header];
    return value === '' || value === 0 || value === null || value === undefined;
  });
}

function processPdfFileWithResume_(file, startTime) {
  let state = loadFileProgressState_(file.getId());
  let text = '';

  if (!state) {
    const blob = file.getBlob();
    if (!blob || blob.getContentType() !== MimeType.PDF) {
      throw new Error('PDF Blob を取得できませんでした。contentType=' + (blob ? blob.getContentType() : 'null'));
    }

    Logger.log('PDFテキスト抽出開始: ' + file.getName() + ' / size=' + blob.getBytes().length + ' bytes');
    text = extractPdfTextWithDriveOcr_(file);
    Logger.log('PDFテキスト抽出完了: ' + file.getName() + ' / chars=' + text.length);

    const textFileId = createImportTempTextFile_(file.getName(), '_ocr.txt', text);
    const resultFileId = createImportTempTextFile_(file.getName(), '_records.json', '[]');
    const recordBlocks = splitServiceRecordBlocks_(text);

    if (!recordBlocks.length) {
      throw new Error('PDFテキストから整備Noブロックを検出できませんでした。');
    }

    const batches = chunkRecordBlocksForGemini_(recordBlocks);
    state = {
      fileId: file.getId(),
      fileName: file.getName(),
      ocrTextFileId: textFileId,
      resultFileId: resultFileId,
      nextBatchIndex: 0,
      totalBatches: batches.length,
      totalBlocks: recordBlocks.length,
      updatedAt: new Date().toISOString()
    };
    saveFileProgressState_(state);

    Logger.log('整備Noブロック検出件数: ' + recordBlocks.length);
    Logger.log('Gemini主抽出: batches=' + batches.length +
      ' / maxBlocks=' + CFG.GEMINI_FALLBACK_MAX_BLOCKS_PER_CALL +
      ' / maxChars=' + CFG.GEMINI_FALLBACK_MAX_CHARS_PER_CALL);
  } else {
    text = readImportTempTextFile_(state.ocrTextFileId);
    Logger.log('途中再開: ' + file.getName() + ' / batch=' + (state.nextBatchIndex + 1) + '/' + state.totalBatches);
  }

  const recordBlocks = splitServiceRecordBlocks_(text);
  if (!recordBlocks.length) {
    throw new Error('途中再開用OCRテキストから整備Noブロックを検出できませんでした。');
  }

  const batches = chunkRecordBlocksForGemini_(recordBlocks);
  state.totalBatches = batches.length;
  state.totalBlocks = recordBlocks.length;

  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY が設定されていません');
  }

  for (let i = Number(state.nextBatchIndex) || 0; i < batches.length; i++) {
    if (isNearRuntimeLimit_(startTime)) {
      state.nextBatchIndex = i;
      state.updatedAt = new Date().toISOString();
      saveFileProgressState_(state);
      return {
        completed: false,
        nextBatchIndex: i,
        totalBatches: batches.length
      };
    }

    Logger.log('Gemini主抽出開始: batch=' + (i + 1) + '/' + batches.length +
      ' / blocks=' + batches[i].length + ' / chars=' + countBlocksChars_(batches[i]));

    const records = extractTextBlocksWithAutoSplit_(apiKey, batches[i], file.getName(), String(i + 1), String(batches.length));
    state.resultFileId = appendRecordsToProgressFile_(state.resultFileId, records);
    state.nextBatchIndex = i + 1;
    state.updatedAt = new Date().toISOString();
    saveFileProgressState_(state);

    Logger.log('Gemini主抽出完了: batch=' + (i + 1) + '/' + batches.length + ' / 件数=' + records.length);
    Utilities.sleep(CFG.GEMINI_CALL_SLEEP_MS);
  }

  const finalRecords = dedupeRecords_(readRecordsFromProgressFile_(state.resultFileId));
  deleteImportTempFile_(state.ocrTextFileId);
  deleteImportTempFile_(state.resultFileId);

  return {
    completed: true,
    records: finalRecords
  };
}

function extractAllFromPDF_(file) {
  const blob = file.getBlob();
  if (!blob || blob.getContentType() !== MimeType.PDF) {
    throw new Error('PDF Blob を取得できませんでした。contentType=' + (blob ? blob.getContentType() : 'null'));
  }

  Logger.log('PDFテキスト抽出開始: ' + file.getName() + ' / size=' + blob.getBytes().length + ' bytes');

  const text = extractPdfTextWithDriveOcr_(file);
  Logger.log('PDFテキスト抽出完了: ' + file.getName() + ' / chars=' + text.length);

  const recordBlocks = splitServiceRecordBlocks_(text);
  Logger.log('整備Noブロック検出件数: ' + recordBlocks.length);

  if (!recordBlocks.length) {
    throw new Error('PDFテキストから整備Noブロックを検出できませんでした。');
  }

  if (CFG.USE_GEMINI_PRIMARY) {
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY が設定されていません');
    }

    const geminiRecords = [];
    const batches = chunkRecordBlocksForGemini_(recordBlocks);

    Logger.log('Gemini主抽出: batches=' + batches.length +
      ' / maxBlocks=' + CFG.GEMINI_FALLBACK_MAX_BLOCKS_PER_CALL +
      ' / maxChars=' + CFG.GEMINI_FALLBACK_MAX_CHARS_PER_CALL);

    for (let i = 0; i < batches.length; i++) {
      Logger.log('Gemini主抽出開始: batch=' + (i + 1) + '/' + batches.length +
        ' / blocks=' + batches[i].length + ' / chars=' + countBlocksChars_(batches[i]));
      const records = extractTextBlocksWithAutoSplit_(apiKey, batches[i], file.getName(), String(i + 1), String(batches.length));
      Array.prototype.push.apply(geminiRecords, records);
      Logger.log('Gemini主抽出完了: batch=' + (i + 1) + '/' + batches.length + ' / 件数=' + records.length);
      Utilities.sleep(CFG.GEMINI_CALL_SLEEP_MS);
    }

    return {
      records: dedupeRecords_(geminiRecords)
    };
  }

  const allRecords = [];
  const failedBlocks = [];

  for (let i = 0; i < recordBlocks.length; i++) {
    const record = parseServiceRecordBlock_(recordBlocks[i]);
    if (record && record['整備No']) {
      allRecords.push(record);
    } else {
      failedBlocks.push(recordBlocks[i]);
    }
  }

  Logger.log('直接パース完了: 成功=' + allRecords.length + ' / 失敗=' + failedBlocks.length);

  if (failedBlocks.length && CFG.USE_GEMINI_FALLBACK) {
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY が設定されていません');
    }

    const batches = chunkRecordBlocksForGemini_(failedBlocks);
    for (let i = 0; i < batches.length; i++) {
      Logger.log('Gemini補助抽出開始: batch=' + (i + 1) + '/' + batches.length +
        ' / blocks=' + batches[i].length + ' / chars=' + countBlocksChars_(batches[i]));
      const records = extractTextBlocksWithAutoSplit_(apiKey, batches[i], file.getName(), String(i + 1), String(batches.length));
      Array.prototype.push.apply(allRecords, records);
      Logger.log('Gemini補助抽出完了: batch=' + (i + 1) + '/' + batches.length + ' / 件数=' + records.length);
      Utilities.sleep(CFG.GEMINI_CALL_SLEEP_MS);
    }
  } else if (failedBlocks.length) {
    Logger.log('直接パース失敗ブロックはGeminiへ送信しません。先頭失敗ブロック:\n' + failedBlocks[0].substring(0, CFG.MAX_LOG_CHARS));
  }

  return {
    records: dedupeRecords_(allRecords)
  };
}

function extractTextBlocksWithAutoSplit_(apiKey, recordBlocks, fileName, batchLabel, batchTotalLabel) {
  try {
    const extracted = callGeminiForTextBlocks_(apiKey, recordBlocks, fileName, batchLabel, batchTotalLabel);
    return extracted.records || [];
  } catch (error) {
    if (!isGeminiSizeError_(error) || recordBlocks.length <= 1) {
      throw error;
    }

    const mid = Math.ceil(recordBlocks.length / 2);
    const leftBlocks = recordBlocks.slice(0, mid);
    const rightBlocks = recordBlocks.slice(mid);
    Logger.log('MAX_TOKENSのためテキストバッチを分割します: batch=' + batchLabel + '/' + batchTotalLabel +
      ' / ' + recordBlocks.length + '件 -> ' + leftBlocks.length + '件 + ' + rightBlocks.length + '件');

    const leftRecords = extractTextBlocksWithAutoSplit_(apiKey, leftBlocks, fileName, batchLabel + '-1', batchTotalLabel);
    Utilities.sleep(CFG.GEMINI_CALL_SLEEP_MS);
    const rightRecords = extractTextBlocksWithAutoSplit_(apiKey, rightBlocks, fileName, batchLabel + '-2', batchTotalLabel);
    return leftRecords.concat(rightRecords);
  }
}

function callGeminiForTextBlocks_(apiKey, recordBlocks, fileName, batchNo, batchTotal) {
  const safeBlocks = recordBlocks.map(function(block) {
    return compactRecordBlockForGemini_(block);
  });

  const prompt = [
    'あなたは整備管理システムの「整備一覧」PDFから抽出済みテキストをJSON化するエキスパートです。',
    'PDFは毎回同じ帳票形式です。項目の配置場所、列の並び、列見出しの位置は基本的に同じです。',
    '下記テキストはPDFから抽出した一部の整備レコードです。指定されたレコードだけを処理してください。',
    '重要: 顧客名、車名、車台番号、請求先名を混同しないでください。',
    '顧客名には会社名・個人名を入れてください。SAL/WP0/WDB/SAD/W1Nなどで始まる車台番号を顧客名に入れてはいけません。',
    '車名にはレンジローバー、ディフェンダー、ポルシェ911、デミオ等の車種名だけを入れてください。車台番号、請求先名、J・L、輸入車、国産車、カーブリッジを車名に入れてはいけません。',
    '年式には R 04/11 や H 29/06 のような年/月だけを入れてください。',
    '作業大区分は、各レコード内で「日付」「顧客名/年式」「入庫日/納車予定日」の後に出る作業大区分の値を採用してください。',
    '整備店舗、請求先名、担当者名、メーカー名、請求区分を作業大区分に入れないでください。',
    '「カーブリッジ」「輸入車」「J・L」「JLR」「桒原 裕樹」「(株)ブリッジ本社」は作業大区分として扱わないでください。',
    'それらが作業大区分に見えた場合は、近くの別列を誤読している可能性が高いので、作業大区分の位置を再確認してください。',
    '保険請求、損保ﾚﾝ、損保レン、板金、鈑金、一般整備、点検、定期点検、車検、部品、サービスD-2、社用車C-① は作業大区分として抽出対象です。',
    '売上総計と粗利益は帳票内の該当金額を抽出してください。車台番号や登録番号に含まれる数字を金額に使ってはいけません。',
    '以下のルールを厳守し、有効なJSONのみを返してください。',
    '説明文、マークダウン、コードブロックは一切不要です。',
    '返却はJSONのみです。',
    'レコードは「SB」で始まる整備Noを起点に抽出してください。',
    '表に存在しない値は推測せず空文字にしてください。',
    '金額はカンマなしの数値で返してください。',
    '抽出できない場合は {"records":[]} を返してください。',
    'JSON構造は次の形式に厳密に合わせてください。',
    '{"records":[{"整備No":"","日付":"","顧客名":"","年式":"","入庫日":"","車名":"","入庫予定日":"","納車予定日":"","納車日":"","車検日":"","作業大区分":"","整備店舗":"","請求先名":"","状況":"","売上総計":0,"粗利益":0}]}',
    '\n対象ファイル: ' + fileName,
    '対象バッチ: ' + batchNo + '/' + batchTotal,
    '対象ブロック数: ' + safeBlocks.length,
    '対象文字数: ' + countBlocksChars_(safeBlocks),
    '\n--- 抽出済みテキスト ---\n',
    safeBlocks.join('\n\n--- RECORD ---\n\n')
  ].join('\n');

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    CFG.GEMINI_MODEL + ':generateContent?key=' + apiKey;

  const payload = {
    contents: [{
      parts: [
        { text: prompt }
      ]
    }],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0,
      max_output_tokens: CFG.GEMINI_MAX_OUTPUT_TOKENS
    }
  };

  let lastError = null;

  for (let attempt = 1; attempt <= CFG.GEMINI_MAX_RETRIES; attempt++) {
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const rawText = res.getContentText();
    let body = {};
    try {
      body = JSON.parse(rawText);
    } catch (error) {
      throw new Error('GeminiレスポンスがJSONではありません: ' + rawText.substring(0, 500));
    }

    if (res.getResponseCode() === 200) {
      if (!body.candidates || !body.candidates.length) {
        Logger.log('Gemini raw response: ' + rawText.substring(0, 1000));
        throw new Error('candidates が空です。promptFeedback=' + JSON.stringify(body.promptFeedback || {}));
      }

      const candidate = body.candidates[0];
      const finishReason = candidate.finishReason || '';
      if (finishReason && finishReason !== 'STOP') {
        Logger.log('Gemini finishReason: ' + finishReason + ' / batch=' + batchNo + '/' + batchTotal);
      }

      if (finishReason === 'MAX_TOKENS') {
        throw new Error('Gemini MAX_TOKENS: テキストバッチの出力が上限に達しました。batch=' + batchNo + '/' + batchTotal);
      }

      const resultText = candidate.content &&
        candidate.content.parts &&
        candidate.content.parts[0] &&
        candidate.content.parts[0].text;

      if (!resultText) {
        Logger.log('Gemini raw response: ' + rawText.substring(0, 1000));
        throw new Error('レスポンスに text が含まれていません。finishReason=' + finishReason);
      }

      Logger.log('Gemini応答先頭: ' + resultText.substring(0, 200));
      const parsed = parseGeminiJson_(resultText);
      if (!parsed || !Array.isArray(parsed.records)) {
        throw new Error('Gemini JSONに records 配列がありません。batch=' + batchNo + '/' + batchTotal);
      }
      return parsed;
    }

    const message = 'Gemini HTTP Error ' + res.getResponseCode() + ': ' +
      (body.error && body.error.message ? body.error.message : rawText);
    lastError = new Error(message);

    if (!isRetryableGeminiStatus_(res.getResponseCode()) || attempt === CFG.GEMINI_MAX_RETRIES) {
      throw lastError;
    }

    const retryWaitMs = getGeminiRetryWaitMs_(body, rawText, attempt);
    Logger.log('Gemini一時エラー。' + attempt + '/' + CFG.GEMINI_MAX_RETRIES + ' 回目失敗。' +
      Math.ceil(retryWaitMs / 1000) + '秒後に再試行します。');
    Utilities.sleep(retryWaitMs);
  }

  throw lastError || new Error('Gemini呼び出しに失敗しました。');
}

function parseGeminiJson_(resultText) {
  try {
    return JSON.parse(resultText);
  } catch (error) {
  }

  const codeBlock = resultText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try {
      return JSON.parse(codeBlock[1].trim());
    } catch (error) {
    }
  }

  const jsonMatch = resultText.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (error) {
    }
  }

  Logger.log('パース失敗。Gemini実レスポンス:\n' + resultText);
  throw new Error('JSONパース失敗。Geminiの返却形式を確認してください。');
}

function chunkRecordBlocksForGemini_(recordBlocks) {
  const chunks = [];
  let current = [];
  let currentChars = 0;

  (recordBlocks || []).forEach(function(block) {
    const safeBlock = compactRecordBlockForGemini_(block);
    const blockChars = safeBlock.length;
    const wouldExceedCount = current.length >= CFG.GEMINI_FALLBACK_MAX_BLOCKS_PER_CALL;
    const wouldExceedChars = current.length > 0 &&
      currentChars + blockChars > CFG.GEMINI_FALLBACK_MAX_CHARS_PER_CALL;

    if (wouldExceedCount || wouldExceedChars) {
      chunks.push(current);
      current = [];
      currentChars = 0;
    }

    current.push(safeBlock);
    currentChars += blockChars;
  });

  if (current.length) {
    chunks.push(current);
  }

  return chunks;
}

function compactRecordBlockForGemini_(block) {
  const text = String(block || '');
  const limit = CFG.GEMINI_FALLBACK_SINGLE_BLOCK_MAX_CHARS;
  if (text.length <= limit) {
    return text;
  }

  const headLength = Math.floor(limit * 0.7);
  const tailLength = limit - headLength;
  return text.substring(0, headLength) +
    '\n\n... 中略: レコードテキストが長いため圧縮 ...\n\n' +
    text.substring(text.length - tailLength);
}

function countBlocksChars_(blocks) {
  return (blocks || []).reduce(function(total, block) {
    return total + String(block || '').length;
  }, 0);
}

function extractPdfTextWithDriveOcr_(file) {
  if (typeof Drive === 'undefined' || !Drive.Files || !Drive.Files.copy) {
    throw new Error('Drive拡張サービスが有効ではありません。Apps Scriptの「サービス」から Drive API を追加してください。');
  }

  let docFile = null;
  const resource = {
    title: 'tmp_ocr_' + file.getId() + '_' + new Date().getTime(),
    mimeType: MimeType.GOOGLE_DOCS
  };

  try {
    docFile = Drive.Files.copy(resource, file.getId(), {
      ocr: true,
      ocrLanguage: 'ja'
    });

    Utilities.sleep(3000);

    const doc = DocumentApp.openById(docFile.id);
    const text = doc.getBody().getText();

    if (!text || text.indexOf('SB') < 0) {
      throw new Error('Drive OCR後のテキストに整備Noが見つかりません。chars=' + String(text || '').length);
    }

    return text;
  } finally {
    if (docFile && docFile.id) {
      try {
        DriveApp.getFileById(docFile.id).setTrashed(true);
      } catch (error) {
        Logger.log('一時OCRドキュメント削除失敗: ' + error.message);
      }
    }
  }
}

function splitServiceRecordBlocks_(text) {
  const normalized = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const matches = [];
  const pattern = /(?:^|\n)\s*\d+\s+(SB\d{8})\s+/g;
  let match;

  while ((match = pattern.exec(normalized)) !== null) {
    matches.push({
      index: match.index,
      seibiNo: match[1]
    });
  }

  const blocks = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : normalized.length;
    const block = normalized.slice(start, end).trim();
    if (block) {
      blocks.push(block);
    }
  }

  return blocks;
}

function parseServiceRecordBlock_(block) {
  const lines = String(block || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(function(line) { return String(line || '').trim(); })
    .filter(function(line) { return line; });

  if (!lines.length) {
    return null;
  }

  const firstLine = lines[0];
  const firstMatch = firstLine.match(/(?:^|\s)(SB\d{8})\s*(.*)$/);
  if (!firstMatch) {
    return null;
  }

  const seibiNo = firstMatch[1];
  const status = normalizeDirectStatus_(firstMatch[2]);
  const dateInfo = findFirstFullWarekiDate_(lines, 1);
  const dateText = dateInfo ? dateInfo.date : '';
  const dateLineIndex = dateInfo ? dateInfo.index : 1;

  const customerYear = parseCustomerYearLine_(lines[dateLineIndex + 1] || '');
  const dateLineAfterCustomer = lines[dateLineIndex + 2] || '';
  const firstDateGroup = extractFullWarekiDates_(dateLineAfterCustomer);
  const allDates = extractFullWarekiDates_(lines.join('\n'));

  const categoryIndex = findCategoryLineIndex_(lines, dateLineIndex + 2);
  const rawCategory = categoryIndex >= 0 ? canonicalCategoryText_(lines[categoryIndex]) : '';
  const vehicleName = extractVehicleNameFromLines_(lines, categoryIndex);
  const shopName = extractServiceShopFromLines_(lines);
  const billingName = extractBillingNameFromLines_(lines, categoryIndex);
  const salesTotal = extractSalesTotalFromLines_(lines, categoryIndex);
  const grossProfit = extractGrossProfitFromLines_(lines, categoryIndex);

  return {
    '整備No': seibiNo,
    '日付': dateText,
    '顧客名': customerYear.customer,
    '年式': customerYear.year,
    '入庫日': firstDateGroup[0] || '',
    '車名': vehicleName,
    '入庫予定日': pickAdditionalDate_(allDates, [dateText, firstDateGroup[0], firstDateGroup[1]], 0),
    '納車予定日': firstDateGroup[1] || '',
    '納車日': '',
    '車検日': '',
    '作業大区分': rawCategory,
    '整備店舗': shopName,
    '請求先名': billingName,
    '状況': status,
    '売上総計': salesTotal,
    '粗利益': grossProfit
  };
}

function normalizeDirectStatus_(value) {
  const s = normalizeText_(value);
  if (!s) return '';
  if (s.indexOf('売上決定') >= 0) return '売上決定';
  if (s.indexOf('納車済み売上') >= 0) return '売上決定';
  if (s.indexOf('見積') >= 0) return '見積';
  if (s.indexOf('見込') >= 0) return '見込';
  if (s.indexOf('作業中') >= 0) return '作業中';
  if (s.indexOf('予約') >= 0) return '予約(入庫';
  return String(value || '').trim();
}

function parseCustomerYearLine_(line) {
  const s = String(line || '').trim();
  const match = s.match(/^(.*?)([RH]\s*\d{1,2}\/\d{1,2})$/);
  if (!match) {
    return {
      customer: isWarekiYearMonthOnly_(s) ? '' : s,
      year: isWarekiYearMonthOnly_(s) ? s : ''
    };
  }

  return {
    customer: match[1].trim(),
    year: match[2].trim()
  };
}

function findFirstFullWarekiDate_(lines, startIndex) {
  for (let i = Math.max(0, startIndex || 0); i < lines.length; i++) {
    const dates = extractFullWarekiDates_(lines[i]);
    if (dates.length) {
      return {
        index: i,
        date: dates[0]
      };
    }
  }
  return null;
}

function extractFullWarekiDates_(text) {
  const matches = String(text || '').match(/[RH]\s*\d{1,2}\/\d{1,2}\/\d{1,2}/g);
  return matches ? matches.map(function(v) { return v.replace(/\s+/g, ' ').trim(); }) : [];
}

function isWarekiYearMonthOnly_(text) {
  return /^[RH]\s*\d{1,2}\/\d{1,2}$/.test(String(text || '').trim());
}

function pickAdditionalDate_(allDates, usedDates, offset) {
  const used = {};
  (usedDates || []).forEach(function(date) {
    if (date) used[normalizeText_(date)] = true;
  });

  const extra = (allDates || []).filter(function(date) {
    return date && !used[normalizeText_(date)];
  });

  return extra[offset || 0] || '';
}

function findCategoryLineIndex_(lines, startIndex) {
  for (let i = Math.max(0, startIndex || 0); i < lines.length; i++) {
    if (canonicalCategoryText_(lines[i])) {
      return i;
    }
  }
  return -1;
}

function canonicalCategoryText_(value) {
  const s = normalizeText_(value);
  if (!s) return '';

  if (s === '車検' || s.indexOf('車検(') === 0 || s.indexOf('車検（') === 0) return '車検';
  if (s === '一般整備' || s.indexOf('整備(社内') === 0 || s.indexOf('整備（社内') === 0) return '一般整備';
  if (s === '点検' || s === '定期点検' || s.indexOf('点検(') === 0 || s.indexOf('点検（') === 0) return '点検';
  if (s === '板金' || s === '鈑金' || s === '板金塗装' || s === '鈑金・塗装') return '板金';
  if (s === '保険請求') return '保険請求';
  if (s === '損保レン') return '損保レン';
  if (s === '部品') return '部品';
  if (s === 'サービスD-2' || s === 'サービスD-②') return 'サービスD-2';
  if (s === '社用車C-1' || s === '社用車C-①') return '社用車C-1';
  if (s === '加修') return '加修';
  if (s === '新納点A-1' || s === '新納点A-①') return '新納点A-1';
  if (s === '新納コA-2' || s === '新納コA-②') return '新納コA-2';
  if (s === '在納点A-3' || s === '在納点A-③') return '在納点A-3';
  if (s === '在納コA-4' || s === '在納コA-④') return '在納コA-4';

  return '';
}

function extractVehicleNameFromLines_(lines, categoryIndex) {
  if (categoryIndex < 0) return '';

  const stopIndex = findFirstVinLineIndex_(lines, categoryIndex + 1);
  const end = stopIndex >= 0 ? stopIndex : Math.min(lines.length, categoryIndex + 8);

  for (let i = categoryIndex + 1; i < end; i++) {
    const line = String(lines[i] || '').trim();
    if (!line || !isLikelyVehicleNameLine_(line)) {
      continue;
    }
    return line;
  }

  return '';
}

function isLikelyVehicleNameLine_(line) {
  const s = String(line || '').trim();
  if (!s) return false;
  if (extractFullWarekiDates_(s).length) return false;
  if (canonicalCategoryText_(s)) return false;
  if (isLikelyPersonNameLine_(s)) return false;
  if (isLikelyVinLine_(s)) return false;
  if (isLikelyRegistrationLine_(s)) return false;
  if (isNumericOnlyLine_(s)) return false;
  if (normalizeText_(s) === '対象無') return false;
  if (isLikelyBillingOrShopLine_(s)) return false;
  if (isLikelyCustomerNameLine_(s)) return false;
  return true;
}

function isLikelyPersonNameLine_(line) {
  const s = normalizeText_(line);
  return ['桒原裕樹', '鳥越翔太', '但井智哉', '戸田浩之', '対象無'].indexOf(s) >= 0;
}

function isLikelyVinLine_(line) {
  const s = normalizeText_(line);
  return /^[A-Z0-9-]{8,25}$/.test(s) && /[A-Z]/.test(s) && /\d/.test(s);
}

function findFirstVinLineIndex_(lines, startIndex) {
  for (let i = Math.max(0, startIndex || 0); i < lines.length; i++) {
    if (isLikelyVinLine_(lines[i])) {
      return i;
    }
  }
  return -1;
}

function isLikelyRegistrationLine_(line) {
  return /[-－]\s*\d{2,4}|[ぁ-ん]-\s*\d{1,4}/.test(String(line || ''));
}

function isNumericOnlyLine_(line) {
  return /^[-\d,\s]+$/.test(String(line || '').trim());
}

function isLikelyBillingOrShopLine_(line) {
  const s = normalizeText_(line);
  return s.indexOf('J・L') >= 0 ||
    s.indexOf('JL') === 0 ||
    s.indexOf('輸入車') >= 0 ||
    s.indexOf('国産車') >= 0 ||
    s.indexOf('カーブリッジ') >= 0 ||
    s.indexOf('ブリッジ本社') >= 0 ||
    s.indexOf('福山') >= 0 ||
    s.indexOf('広島') >= 0 ||
    s.indexOf('倉敷') >= 0 ||
    s.indexOf('出雲') >= 0;
}

function isLikelyCustomerNameLine_(line) {
  const s = String(line || '');
  return s.indexOf('株式会社') >= 0 ||
    s.indexOf('(株)') >= 0 ||
    s.indexOf('㈱') >= 0 ||
    s.indexOf('有限会社') >= 0 ||
    s.indexOf('(有)') >= 0 ||
    s.indexOf('代表') >= 0 ||
    s.indexOf('保険') >= 0;
}

function extractServiceShopFromLines_(lines) {
  const joined = lines.join('\n');
  if (joined.indexOf('マセラティ広島') >= 0 || joined.indexOf('Maserati広島') >= 0) return 'Maserati広島';
  if (joined.indexOf('倉敷') >= 0) return '倉敷';
  if (joined.indexOf('出雲') >= 0) return '出雲';
  if (joined.indexOf('福山') >= 0) return '福山';
  if (joined.indexOf('広島') >= 0) return '広島';
  return '';
}

function extractBillingNameFromLines_(lines, categoryIndex) {
  const NG = ['J・L', 'J・L（小売', '輸入車', '輸入車（小売', '国産車', '国産車（小売', 'カーブリッジ'];

  for (let i = Math.max(0, categoryIndex + 1); i < lines.length; i++) {
    const line = String(lines[i] || '').trim();
    if (!line) continue;
    if (extractFullWarekiDates_(line).length) continue;
    if (canonicalCategoryText_(line)) continue;
    if (isLikelyVinLine_(line) || isLikelyRegistrationLine_(line) || isNumericOnlyLine_(line)) continue;

    const normalized = normalizeText_(line);
    if (NG.some(function(ng) { return normalized.indexOf(normalizeText_(ng)) === 0; })) continue;

    if (line.indexOf('株式会社') >= 0 || line.indexOf('(株)') >= 0 || line.indexOf('㈱') >= 0 ||
        line.indexOf('有限会社') >= 0 || line.indexOf('(有)') >= 0 || line.indexOf('保険') >= 0) {
      return line.replace(/\s+[\d,]+$/, '').trim();
    }
  }

  return '';
}

function extractSalesTotalFromLines_(lines, categoryIndex) {
  for (let i = Math.max(0, categoryIndex + 1); i < lines.length; i++) {
    const nums = extractNumbersFromLine_(lines[i]);
    if (nums.length === 2) {
      return nums[1];
    }
  }
  return 0;
}

function extractGrossProfitFromLines_(lines, categoryIndex) {
  for (let i = Math.max(0, categoryIndex + 1); i < lines.length; i++) {
    const nums = extractNumbersFromLine_(lines[i]);
    if (nums.length >= 4) {
      for (let j = i - 1; j > categoryIndex; j--) {
        const prevNums = extractNumbersFromLine_(lines[j]);
        if (prevNums.length === 1) {
          return prevNums[0];
        }
      }
    }
  }
  return 0;
}

function extractNumbersFromLine_(line) {
  const matches = String(line || '').match(/-?\d[\d,]*/g);
  if (!matches) return [];

  return matches
    .map(function(v) { return Number(String(v).replace(/,/g, '')); })
    .filter(function(v) { return !isNaN(v); });
}

function chunkArray_(items, size) {
  const chunks = [];
  const chunkSize = Math.max(1, Number(size) || 1);

  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }

  return chunks;
}

function dedupeRecords_(records) {
  const deduped = new Map();

  (records || []).forEach(function(rec) {
    const seibiNo = String(rec && rec['整備No'] || '').trim();
    const key = seibiNo || JSON.stringify(rec);
    const current = deduped.get(key);

    if (!current || shouldReplaceStage1Record_(current, rec)) {
      deduped.set(key, rec);
    }
  });

  return Array.from(deduped.values());
}

function getGeminiRetryWaitMs_(body, rawText, attempt) {
  const text = String(
    body && body.error && body.error.message
      ? body.error.message
      : rawText || ''
  );

  const match = text.match(/Please retry in\s+([\d.]+)s/i);
  if (match) {
    return Math.ceil(Number(match[1]) * 1000) + 5000;
  }

  return CFG.GEMINI_RETRY_WAIT_MS * attempt;
}

function appendToStage1_(sheet, extracted, fileName, timestamp) {
  const records = extracted.records || [];
  if (!records.length) {
    return;
  }

  const rows = buildStage1Rows_(records, fileName, timestamp);

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, STAGE1_HEADERS.length).setValues(rows);
}

function buildStage1Rows_(records, fileName, timestamp) {
  return (records || []).map(function(rec) {
    return [
      fileName,
      timestamp,
      rec['整備No'] || '',
      rec['日付'] || '',
      rec['顧客名'] || '',
      rec['年式'] || '',
      rec['車名'] || '',
      rec['入庫予定日'] || '',
      rec['入庫日'] || '',
      rec['納車予定日'] || '',
      rec['納車日'] || '',
      rec['車検日'] || '',
      rec['作業大区分'] || '',
      rec['整備店舗'] || '',
      rec['営業店舗'] || '',
      rec['管理店舗'] || '',
      rec['整備担当'] || '',
      rec['営業担当'] || '',
      rec['管理担当'] || '',
      rec['作業小区分名'] || '',
      rec['請求先名'] || '',
      rec['状況'] || '',
      toNum_(rec['売上総計']),
      toNum_(rec['粗利益'])
    ];
  });
}

function replaceStage1WithImportedSnapshots_(sheet, importedSnapshots) {
  const normalizedSnapshots = (importedSnapshots || []).filter(function(snapshot) {
    return snapshot && snapshot.records && snapshot.records.length;
  });

  if (!normalizedSnapshots.length) {
    return;
  }

  const mergedRecords = loadStage1RecordsFromSheet_(sheet);
  normalizedSnapshots.forEach(function(snapshot) {
    (snapshot.records || []).forEach(function(record) {
      const seibiNo = String(record && record['整備No'] || '').trim();
      const key = seibiNo || JSON.stringify(record);
      const cloned = Object.assign({}, record, {
        _importFileName: snapshot.fileName || '',
        _importTimestamp: snapshot.timestamp || ''
      });
      const current = mergedRecords.get(key);
      if (!current || shouldReplaceStage1Record_(current, cloned)) {
        mergedRecords.set(key, cloned);
      }
    });
  });

  const dedupedRecords = dedupeRecords_(Array.from(mergedRecords.values()));
  const rows = dedupedRecords.map(function(record) {
    return buildStage1Rows_([record], record._importFileName || '', record._importTimestamp || '')[0];
  });

  clearSheetBody_(sheet, STAGE1_HEADERS.length);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, STAGE1_HEADERS.length).setValues(rows);
  }
}

function shouldReplaceStage1Record_(currentRecord, candidateRecord) {
  const currentDate = toTime_(convertWarekiToDate_(currentRecord && currentRecord['日付']));
  const candidateDate = toTime_(convertWarekiToDate_(candidateRecord && candidateRecord['日付']));

  if (candidateDate && currentDate && candidateDate !== currentDate) {
    return candidateDate > currentDate;
  }
  if (candidateDate && !currentDate) {
    return true;
  }
  if (!candidateDate && currentDate) {
    return false;
  }

  const currentStatusRank = getStage1StatusRank_(currentRecord && currentRecord['状況']);
  const candidateStatusRank = getStage1StatusRank_(candidateRecord && candidateRecord['状況']);
  if (candidateStatusRank !== currentStatusRank) {
    return candidateStatusRank > currentStatusRank;
  }

  const currentImportedAt = parseImportTimestamp_(currentRecord && currentRecord._importTimestamp);
  const candidateImportedAt = parseImportTimestamp_(candidateRecord && candidateRecord._importTimestamp);
  if (candidateImportedAt && currentImportedAt && candidateImportedAt !== currentImportedAt) {
    return candidateImportedAt > currentImportedAt;
  }
  if (candidateImportedAt && !currentImportedAt) {
    return true;
  }

  return countStage1FilledFields_(candidateRecord) >= countStage1FilledFields_(currentRecord);
}

function getStage1StatusRank_(status) {
  const normalized = normalizeStatus_(status, ['売上決定', '納車済み売上'], ['見積', '見積り', '見積り (FK)'], ['作業中', '作業中 (FK)', '予約(入庫']);
  if (normalized === '売上決定') return 3;
  if (normalized === '見込') return 2;
  if (normalized === '見積') return 1;
  return 0;
}

function countStage1FilledFields_(record) {
  return [
    '日付', '顧客名', '年式', '車名', '入庫予定日', '入庫日', '納車予定日', '納車日',
    '車検日', '作業大区分', '整備店舗', '営業店舗', '管理店舗', '整備担当',
    '営業担当', '管理担当', '作業小区分名', '請求先名', '状況'
  ].reduce(function(total, key) {
    return total + (String(record && record[key] || '').trim() ? 1 : 0);
  }, 0);
}

function loadStage1RecordsFromSheet_(sheet) {
  const map = new Map();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return map;
  }

  const width = Math.min(sheet.getLastColumn(), STAGE1_HEADERS.length);
  const values = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  values.forEach(function(row) {
    const record = {
      '整備No': row[2] || '',
      '日付': row[3] || '',
      '顧客名': row[4] || '',
      '年式': row[5] || '',
      '車名': row[6] || '',
      '入庫予定日': row[7] || '',
      '入庫日': row[8] || '',
      '納車予定日': row[9] || '',
      '納車日': row[10] || '',
      '車検日': row[11] || '',
      '作業大区分': row[12] || '',
      '整備店舗': row[13] || '',
      '営業店舗': row[14] || '',
      '管理店舗': row[15] || '',
      '整備担当': row[16] || '',
      '営業担当': row[17] || '',
      '管理担当': row[18] || '',
      '作業小区分名': row[19] || '',
      '請求先名': row[20] || '',
      '状況': row[21] || '',
      '売上総計': row[22] || 0,
      '粗利益': row[23] || 0,
      _importFileName: row[0] || '',
      _importTimestamp: row[1] || ''
    };

    const seibiNo = String(record['整備No'] || '').trim();
    if (!seibiNo) {
      return;
    }

    map.set(seibiNo, record);
  });

  return map;
}

function removeStage1RowsByFile_(sheet, fileName) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return;
  }

  const range = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  const values = range.getValues();
  const headerMap = createHeaderMap_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  const fileIndex = headerMap['ファイル名'];

  if (fileIndex === undefined) {
    return;
  }

  const filtered = values.filter(function(row) {
    return String(row[fileIndex] || '').trim() !== String(fileName || '').trim();
  });

  range.clearContent();
  if (filtered.length) {
    sheet.getRange(2, 1, filtered.length, sheet.getLastColumn()).setValues(filtered);
  }
}

function distributeServiceData(ss, sourceContext) {
  ss = ss || getSourceServiceSpreadsheet_();

  const CATEGORY_MAP = {
    SHAKEN: '車検',
    IPPAN: '一般整備',
    TENKEN: '定期点検',
    BANKIN: '鈑金',
    HOKEN: '保険',
    OTHER: 'その他'
  };

  const CATEGORY_SHAKEN = ['車検', '車検（MJ請', '車検（社内'];
  const CATEGORY_TENKEN = ['点検', '定期点検', '点検（MJ請', '点検（社内', '新納点A-①', '在納点A-③'];
  const CATEGORY_IPPAN = ['一般整備', '整備（社内', '加修', '新納ｺA-②', '在納ｺA-④', '部品', 'サービスD-2', '社用車C-①'];
  const CATEGORY_BANKIN = ['板金', '鈑金', '板金塗装', '鈑金・塗装', '保険請求'];
  const CATEGORY_HOKEN = ['損保ﾚﾝ', '損保レン'];

  const STATUS_SALES = ['売上決定', '納車済み売上'];
  const STATUS_ESTIMATE = ['見積', '見積り', '見積り (FK)'];
  const STATUS_PROSPECT = ['作業中', '作業中 (FK)', '予約(入庫'];

  const sourceSheet = ss.getSheetByName(CFG.STAGE1_SHEET);
  if (!sourceSheet) {
    throw new Error('OCR生データシートが見つかりません');
  }
  sourceContext = sourceContext || loadServiceStage1Context_(sourceSheet);

  const sheetSyaken = getOrCreateSheet_(ss, CFG.STAGE2_SHEET_SYAKEN, getDefaultStage2Headers_());
  const sheet12ten = getOrCreateSheet_(ss, CFG.STAGE2_SHEET_12TEN, getDefaultStage2Headers_());
  normalizeStage2Headers_(sheetSyaken, getDefaultStage2Headers_());
  normalizeStage2Headers_(sheet12ten, getDefaultStage2Headers_());
  const headersSyaken = getSheetHeaders_(sheetSyaken);
  const headers12ten = getSheetHeaders_(sheet12ten);
  const shakenStartRow = CFG.STAGE2_SHAKEN_DATA_START_ROW || 2;
  const twelveStartRow = CFG.STAGE2_12TEN_DATA_START_ROW || 2;
  const entityTypeMap = new Map();
  getExistingEntityTypeMap_(sheetSyaken, headersSyaken, shakenStartRow).forEach(function(v, k) {
    entityTypeMap.set(k, v);
  });
  getExistingEntityTypeMap_(sheet12ten, headers12ten, twelveStartRow).forEach(function(v, k) {
    entityTypeMap.set(k, v);
  });
  const sourceValues = sourceContext.sourceValues || [];

  if (sourceValues.length < 2) {
    clearSheetBodyFromRow_(sheetSyaken, headersSyaken.length, shakenStartRow);
    clearSheetBodyFromRow_(sheet12ten, headers12ten.length, twelveStartRow);
    return;
  }

  const sourceHeaderMap = sourceContext.sourceHeaderMap;
  const latestMap = sourceContext.latestMap;

  const rowsSyaken = [];
  const rows12ten = [];

  latestMap.forEach(function(row) {
    const seibiNo = String(getCellByHeader_(row, sourceHeaderMap, '整備No') || '').trim();
    if (!seibiNo) {
      return;
    }

    const convertedCategory = normalizeCategory_(
      getCellByHeader_(row, sourceHeaderMap, '作業大区分'),
      CATEGORY_MAP,
      CATEGORY_SHAKEN,
      CATEGORY_IPPAN,
      CATEGORY_TENKEN,
      CATEGORY_BANKIN,
      CATEGORY_HOKEN
    );

    const baseDate = convertWarekiToDate_(getCellByHeader_(row, sourceHeaderMap, '日付'));
    const normalizedStatus = normalizeStatus_(
      getCellByHeader_(row, sourceHeaderMap, '状況'),
      STATUS_SALES,
      STATUS_ESTIMATE,
      STATUS_PROSPECT
    );
    const customerName = sanitizeSheetStringValue_(getCellByHeader_(row, sourceHeaderMap, '顧客名'));
    const billingName = sanitizeSheetStringValue_(getCellByHeader_(row, sourceHeaderMap, '請求先名'));
    const serviceShop = sanitizeSheetStringValue_(resolveServiceShopFromSourceRow_(row, sourceHeaderMap));
    // 手入力で上書きされた法人/個人を優先し、無ければ顧客名・請求先名から自動判定
    const entityType = entityTypeMap.get(seibiNo) ||
      classifyEntityType_(customerName, billingName);
    const valueMap = {
      '整備ナンバー': seibiNo,
      '整備No': seibiNo,
      '整備№': seibiNo,
      '状況': normalizedStatus,
      '日付': baseDate,
      '顧客名': customerName,
      '売上総計': toNum_(getCellByHeader_(row, sourceHeaderMap, '売上総計')),
      '売上合計': toNum_(getCellByHeader_(row, sourceHeaderMap, '売上総計')),
      '売上': toNum_(getCellByHeader_(row, sourceHeaderMap, '売上総計')),
      '粗利益': toNum_(getCellByHeader_(row, sourceHeaderMap, '粗利益')),
      '整備店舗': serviceShop,
      '店舗': serviceShop,
      '車名': sanitizeSheetStringValue_(getCellByHeader_(row, sourceHeaderMap, '車名')),
      '年式': sanitizeSheetStringValue_(getCellByHeader_(row, sourceHeaderMap, '年式')),
      '見積日': baseDate,
      '入庫日': getCellByHeader_(row, sourceHeaderMap, '入庫日'),
      '入庫予定日': getCellByHeader_(row, sourceHeaderMap, '入庫予定日'),
      '納車予定日': getCellByHeader_(row, sourceHeaderMap, '納車予定日'),
      '納車日': getCellByHeader_(row, sourceHeaderMap, '納車日'),
      '作業大区分': convertedCategory,
      '請求先名': billingName,
      '請求先': billingName,
      '車検日': getCellByHeader_(row, sourceHeaderMap, '車検日'),
      '法人/個人': entityType,
      '入金予定日': computePaymentDueDate_(baseDate, entityType, normalizedStatus)
    };

    if (convertedCategory === CATEGORY_MAP.SHAKEN) {
      const outputRow = buildRowFromHeaders_(headersSyaken, valueMap);
      rowsSyaken.push(outputRow);
    } else {
      const outputRow = buildRowFromHeaders_(headers12ten, valueMap);
      rows12ten.push(outputRow);
    }
  });

  const protectedShakenRows = getProtectedStage2Rows_(sheetSyaken, headersSyaken, shakenStartRow);
  const protected12tenRows = getProtectedStage2Rows_(sheet12ten, headers12ten, twelveStartRow);
  const finalShakenRows = backfillStage2DatesFromSourceMap_(
    mergeStage2Rows_(protectedShakenRows, rowsSyaken, headersSyaken),
    headersSyaken,
    sourceHeaderMap,
    latestMap
  );
  const final12tenRows = backfillStage2DatesFromSourceMap_(
    mergeStage2Rows_(protected12tenRows, rows12ten, headers12ten),
    headers12ten,
    sourceHeaderMap,
    latestMap
  );

  clearSheetBodyFromRow_(sheetSyaken, headersSyaken.length, shakenStartRow);
  clearSheetBodyFromRow_(sheet12ten, headers12ten.length, twelveStartRow);

  if (finalShakenRows.length) {
    sheetSyaken.getRange(shakenStartRow, 1, finalShakenRows.length, headersSyaken.length).setValues(finalShakenRows);
    applyDateFormats_(sheetSyaken, headersSyaken, finalShakenRows.length, shakenStartRow);
    applyAmountFormats_(sheetSyaken, headersSyaken, finalShakenRows.length, shakenStartRow);
    applyEntityTypeValidation_(sheetSyaken, headersSyaken, finalShakenRows.length, shakenStartRow);
    sortSheetByDateColumn_(sheetSyaken, headersSyaken, '日付', shakenStartRow);
    applyStage2StatusColors_(sheetSyaken, headersSyaken, shakenStartRow);
    applyStage2StatusConditionalFormatting_(sheetSyaken, headersSyaken, shakenStartRow);
    normalizeStage2SheetVisibility_(sheetSyaken, headersSyaken, shakenStartRow);
  }

  if (final12tenRows.length) {
    sheet12ten.getRange(twelveStartRow, 1, final12tenRows.length, headers12ten.length).setValues(final12tenRows);
    applyDateFormats_(sheet12ten, headers12ten, final12tenRows.length, twelveStartRow);
    applyAmountFormats_(sheet12ten, headers12ten, final12tenRows.length, twelveStartRow);
    applyEntityTypeValidation_(sheet12ten, headers12ten, final12tenRows.length, twelveStartRow);
    sortSheetByDateColumn_(sheet12ten, headers12ten, '日付', twelveStartRow);
    applyStage2StatusColors_(sheet12ten, headers12ten, twelveStartRow);
    applyStage2StatusConditionalFormatting_(sheet12ten, headers12ten, twelveStartRow);
    normalizeStage2SheetVisibility_(sheet12ten, headers12ten, twelveStartRow);
  }
}

function getProtectedStage2Rows_(sheet, headers, startRow) {
  const row = Math.max(2, Number(startRow) || 2);
  const lastRow = sheet.getLastRow();
  if (lastRow < row) {
    return [];
  }

  const values = sheet.getRange(row, 1, lastRow - row + 1, headers.length).getValues();
  return values.filter(function(dataRow) {
    return isProtectedStage2Row_(dataRow, headers);
  });
}

function mergeStage2Rows_(protectedRows, generatedRows, headers) {
  const keyIndex = headers.indexOf('整備ナンバー');
  // 自動計算列：protected行でも空なら generated の値で補完する
  const fillFromGenerated = getStage2ExtraColumns_().map(function(col) {
    return headers.indexOf(col);
  }).filter(function(idx) { return idx >= 0; });

  // generated 行を key→row のマップに収める
  const generatedMap = new Map();
  (generatedRows || []).forEach(function(row) {
    const sanitizedRow = sanitizeRowStringCells_(row);
    const key = keyIndex >= 0 ? String(sanitizedRow[keyIndex] || '').trim() : '';
    const mapKey = key || JSON.stringify(row);
    generatedMap.set(mapKey, sanitizedRow);
  });

  const merged = new Map();

  const customerIdx = headers.indexOf('顧客名');
  const billingIdx = headers.indexOf('請求先名');
  const entityIdx = headers.indexOf('法人/個人');

  // protected 行を優先して登録し、自動計算列が空なら generated の値 or 行自身のデータで補完
  (protectedRows || []).forEach(function(row) {
    const sanitizedRow = sanitizeRowStringCells_(row);
    const key = keyIndex >= 0 ? String(sanitizedRow[keyIndex] || '').trim() : '';
    const mapKey = key || JSON.stringify(row);
    const genRow = generatedMap.get(mapKey);
    const patched = sanitizedRow.slice();

    fillFromGenerated.forEach(function(idx) {
      if (idx < 0 || String(patched[idx] || '').trim() !== '') return;
      if (genRow && String(genRow[idx] || '').trim() !== '') {
        patched[idx] = genRow[idx];
      } else if (idx === entityIdx) {
        const cn = customerIdx >= 0 ? String(sanitizedRow[customerIdx] || '') : '';
        const bn = billingIdx >= 0 ? String(sanitizedRow[billingIdx] || '') : '';
        const computed = classifyEntityType_(cn, bn);
        if (computed) patched[idx] = computed;
      }
    });

    merged.set(mapKey, patched);
  });

  // generated 行のうち protected に無いものを追加
  generatedMap.forEach(function(row, mapKey) {
    if (!merged.has(mapKey)) {
      merged.set(mapKey, row);
    }
  });

  return Array.from(merged.values());
}

function backfillStage2DatesFromSourceMap_(rows, headers, sourceHeaderMap, latestMap) {
  const keyIndex = headers.indexOf('整備ナンバー');
  const dateIndex = headers.indexOf('日付');
  const estimateDateIndex = headers.indexOf('見積日');

  if (keyIndex < 0 || (dateIndex < 0 && estimateDateIndex < 0)) {
    return rows;
  }

  return (rows || []).map(function(row) {
    const seibiNo = String(row[keyIndex] || '').trim();
    if (!seibiNo) {
      return row;
    }

    const nextRow = row.slice();
    const sourceRow = latestMap.get(seibiNo);
    const sourceDate = sourceRow ? pickFirstValidDate_(
      getCellByHeader_(sourceRow, sourceHeaderMap, '日付'),
      getCellByHeader_(sourceRow, sourceHeaderMap, '入庫日'),
      getCellByHeader_(sourceRow, sourceHeaderMap, '入庫予定日')
    ) : '';

    const fallbackDate = pickStage2RepairDate_(
      row,
      dateIndex,
      estimateDateIndex,
      sourceDate
    );

    if (fallbackDate) {
      const currentDate = dateIndex >= 0 ? convertWarekiToDate_(row[dateIndex]) : '';
      const currentEstimateDate = estimateDateIndex >= 0 ? convertWarekiToDate_(row[estimateDateIndex]) : '';
      if (!currentDate && dateIndex >= 0) {
        nextRow[dateIndex] = fallbackDate;
      }
      if (!currentEstimateDate && estimateDateIndex >= 0) {
        nextRow[estimateDateIndex] = fallbackDate;
      }
    }

    refreshPaymentDueDateOnRow_(nextRow, headers);
    return nextRow;
  });
}

function repairStage2DatesFromSourceMap_(sheet, headers, startRow, sourceHeaderMap, latestMap) {
  const rowStart = Math.max(2, Number(startRow) || 2);
  const lastRow = sheet.getLastRow();
  if (lastRow < rowStart) {
    return;
  }

  const keyIndex = headers.indexOf('整備ナンバー');
  const dateIndex = headers.indexOf('日付');
  const estimateDateIndex = headers.indexOf('見積日');
  if (keyIndex < 0 || (dateIndex < 0 && estimateDateIndex < 0)) {
    return;
  }

  const rowCount = lastRow - rowStart + 1;
  const values = sheet.getRange(rowStart, 1, rowCount, headers.length).getValues();
  let touched = false;

  values.forEach(function(row) {
    const seibiNo = String(row[keyIndex] || '').trim();
    if (!seibiNo) {
      return;
    }

    const sourceRow = latestMap.get(seibiNo);
    const sourceDate = sourceRow ? pickFirstValidDate_(
      getCellByHeader_(sourceRow, sourceHeaderMap, '日付'),
      getCellByHeader_(sourceRow, sourceHeaderMap, '入庫日'),
      getCellByHeader_(sourceRow, sourceHeaderMap, '入庫予定日')
    ) : '';
    const fallbackDate = pickStage2RepairDate_(
      row,
      dateIndex,
      estimateDateIndex,
      sourceDate
    );
    if (!fallbackDate) {
      return;
    }

    const currentDate = dateIndex >= 0 ? convertWarekiToDate_(row[dateIndex]) : '';
    const currentEstimateDate = estimateDateIndex >= 0 ? convertWarekiToDate_(row[estimateDateIndex]) : '';
    if (!currentDate && dateIndex >= 0) {
      row[dateIndex] = fallbackDate;
      touched = true;
    }
    if (!currentEstimateDate && estimateDateIndex >= 0) {
      row[estimateDateIndex] = fallbackDate;
      touched = true;
    }
    if (refreshPaymentDueDateOnRow_(row, headers)) {
      touched = true;
    }
  });

  if (touched) {
    sheet.getRange(rowStart, 1, rowCount, headers.length).setValues(values);
    applyDateFormats_(sheet, headers, rowCount, rowStart);
  }
}

function pickStage2RepairDate_(row, dateIndex, estimateDateIndex, sourceDate) {
  return pickFirstValidDate_(
    dateIndex >= 0 ? row[dateIndex] : '',
    estimateDateIndex >= 0 ? row[estimateDateIndex] : '',
    sourceDate
  );
}

function isProtectedStage2Row_(row, headers) {
  const statusIndex = headers.indexOf('状況');
  const dateIndex = headers.indexOf('日付');
  const statusValue = statusIndex >= 0 ? row[statusIndex] : '';
  const dateValue = dateIndex >= 0 ? row[dateIndex] : '';
  return isProtectedMarch2026SoldRow_(dateValue, statusValue);
}

function isProtectedMarch2026SoldRow_(dateValue, statusValue) {
  const normalizedStatus = normalizeStatus_(
    statusValue,
    ['売上決定', '納車済み売上'],
    ['見積', '見積り', '見積り (FK)'],
    ['作業中', '作業中 (FK)', '予約(入庫']
  );
  if (normalizedStatus !== '売上決定') {
    return false;
  }

  const date = convertWarekiToDate_(dateValue);
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return false;
  }

  return date.getFullYear() === 2026 && date.getMonth() === 2;
}

function normalizeCategory_(rawCategory, CATEGORY_MAP, CATEGORY_SHAKEN, CATEGORY_IPPAN, CATEGORY_TENKEN, CATEGORY_BANKIN, CATEGORY_HOKEN) {
  const s = normalizeText_(rawCategory);
  if (!s) return CATEGORY_MAP.OTHER;

  if (matchesAnyCategory_(s, CATEGORY_SHAKEN)) return CATEGORY_MAP.SHAKEN;
  if (matchesAnyCategory_(s, CATEGORY_BANKIN)) return CATEGORY_MAP.BANKIN;
  if (matchesAnyCategory_(s, CATEGORY_HOKEN)) return CATEGORY_MAP.HOKEN;
  if (matchesAnyCategory_(s, CATEGORY_IPPAN)) return CATEGORY_MAP.IPPAN;
  if (matchesAnyCategory_(s, CATEGORY_TENKEN)) return CATEGORY_MAP.TENKEN;

  if (s === 'カーブリッジ' || s === '輸入車' || s === 'JL' || s === 'JLR') {
    return CATEGORY_MAP.OTHER;
  }

  return CATEGORY_MAP.OTHER;
}

function normalizeStatus_(status, SALES, ESTIMATE, PROSPECT) {
  const raw = String(status || '').trim();
  const s = normalizeText_(raw);
  if (!s) return '';
  if (hasNormalizedStatusMatch_(s, SALES) || s.indexOf('売上決定') >= 0 || s.indexOf('納車済み売上') >= 0) return '売上決定';
  if (hasNormalizedStatusMatch_(s, ESTIMATE) || s.indexOf('見積') >= 0) return '見積';
  if (hasNormalizedStatusMatch_(s, PROSPECT) || s.indexOf('見込') >= 0 || s.indexOf('作業中') >= 0 || s.indexOf('予約') >= 0) return '見込';
  return raw;
}

/**
 * 顧客名・請求先名から法人/個人を自動判定する。
 * 法人を示す語が含まれれば「法人」、なければ「個人」。判定材料が無ければ ''。
 */
function classifyEntityType_(customerName, billingName) {
  const corporateKeywords = [
    '株式会社', '(株)', '有限会社', '(有)', '合同会社', '合資会社', '合名会社',
    '一般社団法人', '一般財団法人', '公益社団法人', '公益財団法人',
    '社団法人', '財団法人', '医療法人', '学校法人', '宗教法人',
    '特定非営利活動法人', 'NPO法人', '協同組合', '事業協同組合',
    '法人', '組合', 'Co.,Ltd', 'Co.Ltd', 'CO.,LTD', 'LTD', 'INC', 'CORP', 'LLC', 'K.K'
  ].map(function(k) { return normalizeText_(k).toUpperCase(); });

  const combined = normalizeText_(String(customerName || '') + String(billingName || '')).toUpperCase();
  if (!combined) {
    return '';
  }
  for (let i = 0; i < corporateKeywords.length; i++) {
    if (corporateKeywords[i] && combined.indexOf(corporateKeywords[i]) >= 0) {
      return '法人';
    }
  }
  return '個人';
}

/**
 * 入金予定日を算出する。状況が「売上決定」のときのみ値を返す。
 * - 個人：売上決定日（日付）の2日後
 * - 法人：売上決定日の翌月末
 */
function computePaymentDueDate_(baseDateValue, entityType, normalizedStatus) {
  if (normalizedStatus !== '売上決定') {
    return '';
  }
  const base = convertWarekiToDate_(baseDateValue);
  if (!(base instanceof Date) || isNaN(base.getTime())) {
    return '';
  }
  const normalizedEntity = String(entityType || '').trim();
  if (!normalizedEntity) {
    return ''; // 法人/個人未設定の場合は入金予定日を空にする
  }
  if (normalizedEntity === '法人') {
    // 翌月末（1ヶ月後の月末）
    return new Date(base.getFullYear(), base.getMonth() + 2, 0);
  }
  // 個人：2日後
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + 2);
}

/**
 * 行データ（headers配列順）の入金予定日を、現在の日付・法人/個人・状況から再計算する。
 * 値が変化した場合は true を返す。
 */
function refreshPaymentDueDateOnRow_(row, headers) {
  const dateIndex = headers.indexOf('日付');
  const statusIndex = headers.indexOf('状況');
  const entityIndex = headers.indexOf('法人/個人');
  const dueIndex = headers.indexOf('入金予定日');
  if (dueIndex < 0 || dateIndex < 0 || statusIndex < 0) {
    return false;
  }

  const normalizedStatus = normalizeStatus_(
    row[statusIndex],
    ['売上決定', '納車済み売上'],
    ['見積', '見積り', '見積り (FK)'],
    ['作業中', '作業中 (FK)', '予約(入庫']
  );
  const entityType = entityIndex >= 0 ? String(row[entityIndex] || '').trim() : '';
  const due = computePaymentDueDate_(row[dateIndex], entityType, normalizedStatus);

  const before = row[dueIndex];
  const beforeKey = (before instanceof Date) ? before.getTime() : String(before || '');
  const afterKey = (due instanceof Date) ? due.getTime() : String(due || '');
  if (beforeKey === afterKey) {
    return false;
  }

  row[dueIndex] = due;
  return true;
}

/**
 * シートの列構成を desiredHeaders の順序・内容に揃える。
 * 不足列の追加・列順の入れ替えをデータ保持したまま行う。
 */
function normalizeStage2Headers_(sheet, desiredHeaders) {
  const lastCol = Math.max(1, sheet.getLastColumn());
  const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function(h) { return String(h).trim(); });

  const alreadyCorrect =
    currentHeaders.length === desiredHeaders.length &&
    desiredHeaders.every(function(h, i) { return h === currentHeaders[i]; });
  if (alreadyCorrect) {
    return;
  }

  // 必要な列数を確保
  if (sheet.getMaxColumns() < desiredHeaders.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(),
      desiredHeaders.length - sheet.getMaxColumns());
  }

  const lastRow = sheet.getLastRow();
  const readCols = Math.max(currentHeaders.length, desiredHeaders.length);

  if (lastRow >= 2) {
    // 既存データを旧ヘッダー順で読み取り、新ヘッダー順に並べ直す
    const dataValues = sheet.getRange(2, 1, lastRow - 1, readCols).getValues();
    const oldMap = {};
    currentHeaders.forEach(function(h, i) { oldMap[h] = i; });

    const remapped = dataValues.map(function(row) {
      return desiredHeaders.map(function(header) {
        const idx = oldMap[header];
        return idx !== undefined ? row[idx] : '';
      });
    });

    // 旧データをクリアしてから書き直す
    sheet.getRange(2, 1, lastRow - 1, readCols).clearContent();
    sheet.getRange(2, 1, remapped.length, desiredHeaders.length).setValues(remapped);
  }

  // ヘッダー行を更新して書式を整える
  sheet.getRange(1, 1, 1, desiredHeaders.length).setValues([desiredHeaders]);
  sheet.getRange(1, 1, 1, desiredHeaders.length)
    .setBackground('#4a90d9')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
}

/**
 * 既存シートから整備ナンバー→法人/個人 の対応表を作成する（手入力上書きの保持用）。
 */
function getExistingEntityTypeMap_(sheet, headers, startRow) {
  const map = new Map();
  const keyIndex = headers.indexOf('整備ナンバー');
  const entityIndex = headers.indexOf('法人/個人');
  if (keyIndex < 0 || entityIndex < 0) {
    return map;
  }
  const row = Math.max(2, Number(startRow) || 2);
  const lastRow = sheet.getLastRow();
  if (lastRow < row) {
    return map;
  }
  const values = sheet.getRange(row, 1, lastRow - row + 1, headers.length).getValues();
  values.forEach(function(dataRow) {
    const key = String(dataRow[keyIndex] || '').trim();
    const entity = String(dataRow[entityIndex] || '').trim();
    if (key && entity) {
      map.set(key, entity);
    }
  });
  return map;
}

function normalizeServiceShop_(shopName) {
  const s = String(shopName || '').trim();
  if (!s) return '';
  if (isMaseratiServiceHint_(s)) return 'Maserati広島';
  if (s.indexOf('J・L') >= 0) return 'J・L（小売）';
  return s;
}

function isMaseratiServiceHint_(value) {
  const s = normalizeText_(value);
  if (!s) return false;
  return s.indexOf(normalizeText_('Maserati広島')) >= 0 ||
    s.indexOf(normalizeText_('マセラティ広島')) >= 0 ||
    s.indexOf(normalizeText_('ﾏｾﾗﾃｨ広島')) >= 0 ||
    s.indexOf(normalizeText_('高田浩史')) >= 0 ||
    s === normalizeText_('マセラティ') ||
    s === normalizeText_('ﾏｾﾗﾃｨ');
}

function isMaseratiSupportLocationHint_(value) {
  const s = normalizeText_(value);
  if (!s) return false;
  return s.indexOf(normalizeText_('Maserati広島 福山ｴﾘｱ')) >= 0 ||
    s.indexOf(normalizeText_('Maserati広島 福山エリア')) >= 0 ||
    s.indexOf(normalizeText_('ﾏｾﾗﾃｨ広島 福山POCC')) >= 0 ||
    s.indexOf(normalizeText_('福山POCC')) >= 0 ||
    s.indexOf(normalizeText_('福山ｴﾘｱ')) >= 0 ||
    s.indexOf(normalizeText_('福山エリア')) >= 0;
}

function resolveServiceShopFromSourceRow_(row, headerMap) {
  const actualShop = getCellByHeader_(row, headerMap, '整備店舗') ||
    getCellByHeader_(row, headerMap, '店舗') ||
    getCellByHeader_(row, headerMap, '店名');
  const salesShop = getCellByHeader_(row, headerMap, '営業店舗');

  if (actualShop) {
    return normalizeServiceShop_(actualShop);
  }

  const candidates = [
    salesShop,
    getCellByHeader_(row, headerMap, '整備担当'),
    getCellByHeader_(row, headerMap, '営業担当'),
    getCellByHeader_(row, headerMap, '管理担当'),
    getCellByHeader_(row, headerMap, '作業小区分名')
  ];

  for (let i = 0; i < candidates.length; i++) {
    const normalized = normalizeServiceShop_(candidates[i]);
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function isNewerSourceRow_(candidateRow, currentRow, headerMap) {
  const candidateImportedAt = parseImportTimestamp_(getCellByHeader_(candidateRow, headerMap, '読み込み日時'));
  const currentImportedAt = parseImportTimestamp_(getCellByHeader_(currentRow, headerMap, '読み込み日時'));

  if (candidateImportedAt && currentImportedAt && candidateImportedAt !== currentImportedAt) {
    return candidateImportedAt > currentImportedAt;
  }

  const candidateDate = toTime_(convertWarekiToDate_(getCellByHeader_(candidateRow, headerMap, '日付')));
  const currentDate = toTime_(convertWarekiToDate_(getCellByHeader_(currentRow, headerMap, '日付')));

  if (candidateDate && currentDate && candidateDate !== currentDate) {
    return candidateDate > currentDate;
  }

  return true;
}

function parseImportTimestamp_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.getTime();
  }

  const s = String(value || '').trim();
  const match = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/);

  if (!match) {
    return 0;
  }

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6])
  ).getTime();
}

function toTime_(value) {
  return value instanceof Date && !isNaN(value.getTime()) ? value.getTime() : 0;
}

function normalizeText_(value) {
  return applyCsvMojibakeCorrections_(String(value || ''))
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .trim();
}

function matchesAnyCategory_(value, patterns) {
  return patterns.some(function(pattern) {
    const normalizedPattern = normalizeText_(pattern);
    return value === normalizedPattern || value.indexOf(normalizedPattern) >= 0;
  });
}

function hasNormalizedStatusMatch_(value, patterns) {
  return (patterns || []).some(function(pattern) {
    const normalizedPattern = normalizeText_(pattern);
    return normalizedPattern && (value === normalizedPattern || value.indexOf(normalizedPattern) >= 0);
  });
}

function convertWarekiToDate_(dateStr) {
  if (dateStr instanceof Date && !isNaN(dateStr.getTime())) {
    return dateStr;
  }

  if (typeof dateStr === 'number' && !isNaN(dateStr)) {
    const days = Math.floor(dateStr);
    const millis = Math.round((dateStr - days) * 86400000);
    const base = new Date(1899, 11, 30);
    base.setDate(base.getDate() + days);
    base.setTime(base.getTime() + millis);
    return base;
  }

  const s = normalizeDateText_(dateStr);
  if (!s) return '';

  const seirekiMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?$/);
  if (seirekiMatch) {
    return new Date(
      Number(seirekiMatch[1]),
      Number(seirekiMatch[2]) - 1,
      Number(seirekiMatch[3])
    );
  }

  const match = s.match(/([RH])\s*(\d+)[\/／](\d+)[\/／](\d+)/);
  if (!match) return '';

  const era = match[1];
  const year = Number(match[2]);
  const month = Number(match[3]);
  const day = Number(match[4]);

  let seireki = '';
  if (era === 'R') {
    seireki = 2018 + year;
  } else if (era === 'H') {
    seireki = 1988 + year;
  } else {
    return '';
  }

  return new Date(seireki, month - 1, day);
}

function normalizeDateText_(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/^'+/, '')
    .replace(/[　]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function createHeaderMap_(headers) {
  const map = {};
  headers.forEach(function(h, i) {
    map[String(h).trim()] = i;
  });
  return map;
}

function getCellByHeader_(row, headerMap, name) {
  const index = headerMap[name];
  return index === undefined ? '' : row[index];
}

function getSheetHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) {
    return String(h).trim();
  });
}

function buildRowFromHeaders_(headers, valueMap) {
  return headers.map(function(header) {
    const normalizedHeader = normalizeHeaderName_(header);
    if (Object.prototype.hasOwnProperty.call(valueMap, header)) {
      return valueMap[header];
    }
    if (Object.prototype.hasOwnProperty.call(valueMap, normalizedHeader)) {
      return valueMap[normalizedHeader];
    }
    return '';
  });
}

function normalizeHeaderName_(header) {
  const s = String(header || '').trim();
  const normalized = normalizeText_(s);

  const aliases = {
    '整備ナンバー': '整備ナンバー',
    '整備No': '整備ナンバー',
    '整備NO': '整備ナンバー',
    '整備№': '整備ナンバー',
    '売上合計': '売上総計',
    '売上': '売上総計',
    '店舗': '整備店舗',
    '請求先': '請求先名'
  };

  if (Object.prototype.hasOwnProperty.call(aliases, s)) {
    return aliases[s];
  }
  if (Object.prototype.hasOwnProperty.call(aliases, normalized)) {
    return aliases[normalized];
  }

  return s;
}

function clearSheetBody_(sheet, width) {
  clearSheetBodyFromRow_(sheet, width, 2);
}

function clearSheetBodyFromRow_(sheet, width, startRow) {
  const lastRow = sheet.getLastRow();
  const row = Math.max(2, Number(startRow) || 2);
  if (lastRow >= row) {
    sheet.getRange(row, 1, lastRow - row + 1, width).clearContent();
  }
}

function applyDateFormats_(sheet, headers, rowCount, startRow) {
  if (rowCount <= 0) return;
  const row = Math.max(2, Number(startRow) || 2);

  ['日付', '見積日', '入金予定日'].forEach(function(name) {
    const idx = headers.indexOf(name);
    if (idx >= 0) {
      sheet.getRange(row, idx + 1, rowCount, 1).setNumberFormat('yyyy/mm/dd');
    }
  });
}

/**
 * 法人/個人列にプルダウン（法人 / 個人）を設定する。
 */
function applyEntityTypeValidation_(sheet, headers, rowCount, startRow) {
  if (rowCount <= 0) return;
  const idx = headers.indexOf('法人/個人');
  if (idx < 0) return;
  const row = Math.max(2, Number(startRow) || 2);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['法人', '個人'], true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(row, idx + 1, rowCount, 1).setDataValidation(rule);
}

function applyStage2StatusColors_(sheet, headers, startRow) {
  const statusIndex = headers.indexOf('状況');
  if (statusIndex < 0) return;

  const row = Math.max(2, Number(startRow) || 2);
  const lastRow = sheet.getLastRow();
  if (lastRow < row) return;

  const rowCount = lastRow - row + 1;
  const range = sheet.getRange(row, statusIndex + 1, rowCount, 1);
  const values = range.getValues();
  const backgrounds = values.map(function(dataRow) {
    return [resolveStage2StatusColor_(dataRow[0])];
  });
  range.setBackgrounds(backgrounds);
}

function resolveStage2StatusColor_(status) {
  const normalized = normalizeStatus_(
    status,
    ['売上決定', '納車済み売上'],
    ['見積', '見積り', '見積り (FK)'],
    ['作業中', '作業中 (FK)', '予約(入庫']
  );
  if (normalized === '売上決定') return '#e6b8af';
  if (normalized === '見積') return '#f4f4a5';
  if (normalized === '見込') return '#76a5af';
  return '#ffffff';
}

function applyStage2StatusConditionalFormatting_(sheet, headers, startRow) {
  const statusIndex = headers.indexOf('状況');
  if (statusIndex < 0) return;

  const row = Math.max(2, Number(startRow) || 2);
  const targetRange = sheet.getRange(row, statusIndex + 1, sheet.getMaxRows() - row + 1, 1);
  const existingRules = sheet.getConditionalFormatRules().filter(function(rule) {
    const ranges = rule.getRanges();
    return !ranges.some(function(range) {
      return range.getSheet().getSheetId() === sheet.getSheetId() &&
        range.getColumn() === statusIndex + 1 &&
        range.getNumColumns() === 1 &&
        range.getRow() === row;
    });
  });

  const rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('売上決定')
      .setBackground('#e6b8af')
      .setRanges([targetRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('見積')
      .setBackground('#f4f4a5')
      .setRanges([targetRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('見込')
      .setBackground('#76a5af')
      .setRanges([targetRange])
      .build()
  ];

  sheet.setConditionalFormatRules(existingRules.concat(rules));
}

/**
 * 法人/個人列を手動変更したとき入金予定日を自動更新するトリガー。
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  if (sheetName !== CFG.STAGE2_SHEET_SYAKEN && sheetName !== CFG.STAGE2_SHEET_12TEN) return;

  const headers = getSheetHeaders_(sheet);
  const entityIndex = headers.indexOf('法人/個人');
  const dueIndex = headers.indexOf('入金予定日');
  if (entityIndex < 0 || dueIndex < 0) return;

  // 編集されたのが法人/個人列かチェック（列番号は1始まり）
  if (e.range.getColumn() !== entityIndex + 1) return;

  const editStartRow = e.range.getRow();
  const numRows = e.range.getNumRows();
  if (editStartRow < 2) return;

  const allValues = sheet.getRange(editStartRow, 1, numRows, headers.length).getValues();
  let changed = false;
  allValues.forEach(function(row) {
    if (refreshPaymentDueDateOnRow_(row, headers)) {
      changed = true;
    }
  });

  if (!changed) return;
  sheet.getRange(editStartRow, 1, numRows, headers.length).setValues(allValues);
  sheet.getRange(editStartRow, dueIndex + 1, numRows, 1).setNumberFormat('yyyy/mm/dd');
}

function applyAmountFormats_(sheet, headers, rowCount, startRow) {
  if (rowCount <= 0) return;
  const row = Math.max(2, Number(startRow) || 2);

  ['売上総計', '粗利益'].forEach(function(name) {
    const idx = headers.indexOf(name);
    if (idx >= 0) {
      sheet.getRange(row, idx + 1, rowCount, 1).setNumberFormat('#,##0');
    }
  });
}

function sortSheetByDateColumn_(sheet, headers, headerName, startRow) {
  const idx = headers.indexOf(headerName);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const row = Math.max(2, Number(startRow) || 2);
  if (idx < 0 || lastRow < row) {
    return;
  }
  const rowCount = lastRow - row + 1;
  if (rowCount <= 1) {
    return;
  }

  sheet.getRange(row, 1, rowCount, lastColumn).sort([
    { column: idx + 1, ascending: true },
    { column: 1, ascending: true }
  ]);
}

function normalizeStage2SheetVisibility_(sheet, headers, startRow) {
  const row = Math.max(2, Number(startRow) || 2);
  const lastRow = sheet.getLastRow();
  const lastColumn = Math.max(headers.length, sheet.getLastColumn());
  const targetRowCount = Math.max(lastRow, 1);

  if (lastRow >= row) {
    sheet.showRows(row, lastRow - row + 1);
  }

  const filter = sheet.getFilter();
  if (lastColumn > 0) {
    const targetRange = sheet.getRange(1, 1, targetRowCount, lastColumn);
    if (!filter) {
      targetRange.createFilter();
      return;
    }

    const filterRange = filter.getRange();
    const shouldRebuildFilter =
      filterRange.getSheet().getSheetId() !== sheet.getSheetId() ||
      filterRange.getRow() !== 1 ||
      filterRange.getColumn() !== 1 ||
      filterRange.getNumRows() !== targetRowCount ||
      filterRange.getNumColumns() !== lastColumn;

    if (shouldRebuildFilter) {
      filter.remove();
      targetRange.createFilter();
    }
  }
}

function toNum_(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;

  const parts = String(val).replace(/,/g, '').trim().split(/\s+/);
  const num = parseFloat(parts[parts.length - 1]);
  return isNaN(num) ? 0 : num;
}

function getOrCreateSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#4a90d9')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function ensureSheetHeaders_(sheet, headers) {
  const requiredColumns = headers.length;
  if (sheet.getMaxColumns() < requiredColumns) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), requiredColumns - sheet.getMaxColumns());
  }

  const currentHeaders = sheet.getRange(1, 1, 1, requiredColumns).getValues()[0];
  let needsUpdate = currentHeaders.length !== headers.length;

  if (!needsUpdate) {
    for (let i = 0; i < headers.length; i++) {
      if (String(currentHeaders[i] || '').trim() !== String(headers[i] || '').trim()) {
        needsUpdate = true;
        break;
      }
    }
  }

  if (needsUpdate) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  getOrCreateSheet_(ss, CFG.STAGE1_SHEET, STAGE1_HEADERS);
  getOrCreateSheet_(ss, CFG.STAGE2_SHEET_SYAKEN, getDefaultStage2Headers_());
  getOrCreateSheet_(ss, CFG.STAGE2_SHEET_12TEN, getDefaultStage2Headers_());
  getOrCreateSheet_(ss, CFG.AUDIT_SHEET, AUDIT_HEADERS);
  Logger.log('準備完了');
}

function createDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'runDailyImport') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('runDailyImport')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();

  Logger.log('runDailyImport の日次トリガーを設定しました');
}

function listProjectTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    Logger.log([
      'handler=' + t.getHandlerFunction(),
      'event=' + t.getEventType(),
      'id=' + t.getUniqueId()
    ].join(' / '));
  });
}

function fullResyncServiceSheets() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  const startedAt = Date.now();
  try {
    refreshServiceOutputs_({ syncToManagement: true });
    // 管理用スプレッドシートのｱﾌﾀｰｾｰﾙｽシートAE1に更新日時を記録
    try {
      const kanriSs = SpreadsheetApp.openById(CFG.FINAL_MANAGEMENT_SPREADSHEET_ID);
      const afSheet = kanriSs.getSheetByName('ｱﾌﾀｰｾｰﾙｽ');
      if (afSheet) {
        afSheet.getRange('AE1').setValue(
          Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M月d日H:mm') + '更新'
        );
      }
    } catch (e) {
      Logger.log('管理用AE1更新エラー: ' + e.message);
    }
    showUiAlertIfAvailable_('データ更新が完了しました。\n営業用の振り分け結果を管理用へ反映し、ｱﾌﾀｰｾｰﾙｽ と 進捗状況 まで更新しています。');
    logElapsedStep_('fullResyncServiceSheets total', startedAt);
    Logger.log('営業用の振り分け結果を管理用へ反映し、ｱﾌﾀｰｾｰﾙｽ / 進捗状況 まで更新しました');
  } finally {
    lock.releaseLock();
  }
}

function installManagementRefreshEditTrigger() {
  removeManagementRefreshEditTriggers();
  disableManagementRefreshControl_();
  showUiAlertIfAvailable_('管理用更新チェック起動は廃止済みです。営業用メニューから実行してください。');
}

function removeManagementRefreshEditTriggers() {
  const spreadsheetIds = [
    CFG.FINAL_MANAGEMENT_SPREADSHEET_ID,
    CFG.MANAGEMENT_SPREADSHEET_ID
  ];

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (
      trigger.getHandlerFunction() === 'handleManagementRefreshEdit_' &&
      trigger.getTriggerSourceId &&
      spreadsheetIds.indexOf(trigger.getTriggerSourceId()) >= 0
    ) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function handleManagementRefreshEdit_(e) {
  if (!e || !e.range || !e.source) return;

  const sheet = e.range.getSheet();
  if (!sheet || sheet.getName() !== CFG.MANAGEMENT_REFRESH_SHEET) return;
  if (e.range.getA1Notation() !== CFG.MANAGEMENT_REFRESH_CHECKBOX_A1) return;
  if (String(e.value || '').toUpperCase() !== 'TRUE') return;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    e.range.setValue(false);
    return;
  }

  try {
    e.source.toast('営業用・管理用を再同期しています...', '管理用更新', 20);
    refreshServiceOutputs_({ syncToManagement: true });
    SpreadsheetApp.flush();
    e.range.setValue(false);
    e.source.toast('営業用・管理用の再同期が完了しました。', '管理用更新', 8);
  } catch (error) {
    e.range.setValue(false);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function refreshServiceOutputs_(options) {
  options = options || {};
  const syncToManagement = options.syncToManagement === true;
  const startedAt = Date.now();
  const sourceSs = getSourceServiceSpreadsheet_();
  const sourceSheet = sourceSs.getSheetByName(CFG.STAGE1_SHEET);
  const loadStartedAt = Date.now();
  const sourceContext = loadServiceStage1Context_(sourceSheet);
  logElapsedStep_('refreshServiceOutputs loadServiceStage1Context_', loadStartedAt);

  const distributeStartedAt = Date.now();
  distributeServiceData(sourceSs, sourceContext);
  logElapsedStep_('refreshServiceOutputs distributeServiceData', distributeStartedAt);

  const auditStartedAt = Date.now();
  auditImportedData_(sourceSs, sourceContext);
  logElapsedStep_('refreshServiceOutputs auditImportedData_', auditStartedAt);

  if (syncToManagement) {
    const syncStartedAt = Date.now();
    syncServiceDataToFinalManagement_(sourceSs, sourceContext.latestRawMap);
    logElapsedStep_('refreshServiceOutputs syncServiceDataToFinalManagement_', syncStartedAt);

    const vehicleSalesStartedAt = Date.now();
    ensureVehicleSalesManagementImport_({ restoreFormula: true });
    logElapsedStep_('refreshServiceOutputs ensureVehicleSalesManagementImport_', vehicleSalesStartedAt);
  }

  logElapsedStep_('refreshServiceOutputs total', startedAt);
}

function repairCurrentServiceStage2Dates_() {
  const sourceSs = getSourceServiceSpreadsheet_();
  const sourceSheet = sourceSs.getSheetByName(CFG.STAGE1_SHEET);
  if (!sourceSheet) {
    throw new Error('OCR生データシートが見つかりません');
  }

  const sourceContext = loadServiceStage1Context_(sourceSheet);
  if ((sourceContext.sourceValues || []).length < 2) {
    return;
  }
  const sourceHeaderMap = sourceContext.sourceHeaderMap;
  const latestMap = sourceContext.latestMap;

  const targets = [
    {
      sheet: sourceSs.getSheetByName(CFG.STAGE2_SHEET_SYAKEN),
      startRow: CFG.STAGE2_SHAKEN_DATA_START_ROW
    },
    {
      sheet: sourceSs.getSheetByName(CFG.STAGE2_SHEET_12TEN),
      startRow: CFG.STAGE2_12TEN_DATA_START_ROW
    }
  ];

  targets.forEach(function(target) {
    if (!target.sheet) return;
    const headers = getSheetHeaders_(target.sheet);
    repairStage2DatesFromSourceMap_(target.sheet, headers, target.startRow, sourceHeaderMap, latestMap);
    normalizeStage2SheetVisibility_(target.sheet, headers, target.startRow);
  });

  SpreadsheetApp.flush();
}

function syncServiceDataToManagement_(sourceSs, latestRawMap) {
  sourceSs = sourceSs || getSourceServiceSpreadsheet_();
  const managementSs = SpreadsheetApp.openById(CFG.MANAGEMENT_SPREADSHEET_ID);
  const managementHeaders = getDefaultManagementStage2Headers_();
  latestRawMap = latestRawMap || buildLatestServiceRawCategoryMap_(sourceSs);

  const jobs = [
    {
      sourceSheetName: CFG.STAGE2_SHEET_SYAKEN,
      targetSheetName: CFG.MANAGEMENT_STAGE2_SHEET_SYAKEN
    },
    {
      sourceSheetName: CFG.STAGE2_SHEET_12TEN,
      targetSheetName: CFG.MANAGEMENT_STAGE2_SHEET_12TEN
    }
  ];

  jobs.forEach(function(job) {
    const sourceSheet = sourceSs.getSheetByName(job.sourceSheetName);
    if (!sourceSheet) {
      throw new Error('同期元シートが見つかりません: ' + job.sourceSheetName);
    }

    const targetSheet = getOrCreateSheet_(managementSs, job.targetSheetName, managementHeaders);
    targetSheet.hideSheet();
    overwriteManagementStage2Sheet_(sourceSheet, targetSheet, managementHeaders, latestRawMap);
  });

  SpreadsheetApp.flush();
  finalizeManagementSummaryRefresh_(managementSs);
  Logger.log('管理用取込シートを最新版へ更新しました');
}

function syncServiceDataToFinalManagement_(sourceSs, latestRawMap) {
  sourceSs = sourceSs || getSourceServiceSpreadsheet_();
  const managementSs = SpreadsheetApp.openById(CFG.FINAL_MANAGEMENT_SPREADSHEET_ID);
  const managementHeaders = getFinalManagementStage2Headers_();
  latestRawMap = latestRawMap || buildLatestServiceRawCategoryMap_(sourceSs);

  const jobs = [
    {
      sourceSheetName: CFG.STAGE2_SHEET_SYAKEN,
      targetSheetName: 'AS_車検取込'
    },
    {
      sourceSheetName: CFG.STAGE2_SHEET_12TEN,
      targetSheetName: 'AS_12点取込'
    }
  ];

  jobs.forEach(function(job) {
    const sourceSheet = sourceSs.getSheetByName(job.sourceSheetName);
    if (!sourceSheet) {
      throw new Error('同期元シートが見つかりません: ' + job.sourceSheetName);
    }

    const targetSheet = getOrCreateSheet_(managementSs, job.targetSheetName, managementHeaders);
    targetSheet.hideSheet();
    overwriteFinalManagementStage2Sheet_(sourceSheet, targetSheet, managementHeaders, latestRawMap);
  });

  SpreadsheetApp.flush();
  finalizeManagementSummaryRefresh_(managementSs);
  Logger.log('最終管理用取込シートを最新版へ更新しました');
}

function finalizeManagementSummaryRefresh_(managementSs) {
  const summarySheet = managementSs.getSheetByName(CFG.MANAGEMENT_STAGE2_SUMMARY_SHEET);
  const aftersalesSheet = managementSs.getSheetByName(CFG.MANAGEMENT_AFTERSALES_SHEET);
  const progressSheet = managementSs.getSheetByName(CFG.MANAGEMENT_PROGRESS_SHEET);

  SpreadsheetApp.flush();

  if (summarySheet) {
    summarySheet.getRange(1, 1, Math.min(summarySheet.getLastRow() || 1, 5), Math.min(summarySheet.getLastColumn() || 1, 5)).getDisplayValues();
  }
  if (aftersalesSheet) {
    aftersalesSheet.getRange(1, 1, Math.min(aftersalesSheet.getLastRow() || 1, 5), Math.min(aftersalesSheet.getLastColumn() || 1, 5)).getDisplayValues();
  }
  if (progressSheet) {
    progressSheet.getRange(1, 1, Math.min(progressSheet.getLastRow() || 1, 5), Math.min(progressSheet.getLastColumn() || 1, 5)).getDisplayValues();
  }

  SpreadsheetApp.flush();
}

function buildLatestServiceRawCategoryMap_(ss) {
  const sourceSheet = ss.getSheetByName(CFG.STAGE1_SHEET);
  return loadServiceStage1Context_(sourceSheet).latestRawMap;
}

function overwriteManagementStage2Sheet_(sourceSheet, targetSheet, headers, latestRawMap) {
  const sourceLastRow = sourceSheet.getLastRow();
  const sourceLastColumn = sourceSheet.getLastColumn();
  const targetLastRow = targetSheet.getLastRow();

  targetSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (sourceLastRow <= 1 || sourceLastColumn <= 0) {
    if (targetLastRow > 1) {
      targetSheet.getRange(2, 1, targetLastRow - 1, headers.length).clearContent();
    }
    return;
  }

  const sourceHeaders = getSheetHeaders_(sourceSheet);
  const sourceHeaderMap = createHeaderMap_(sourceHeaders);
  const sourceValues = sourceSheet.getRange(2, 1, sourceLastRow - 1, sourceLastColumn).getValues();
  const outputRows = sourceValues
    .filter(function(row) {
      return String(getCellByHeader_(row, sourceHeaderMap, '整備ナンバー') || '').trim() !== '';
    })
    .map(function(row) {
      return buildManagementStage2Row_(row, sourceHeaderMap, latestRawMap);
    });

  if (!outputRows.length) {
    if (targetLastRow > 1) {
      targetSheet.getRange(2, 1, targetLastRow - 1, headers.length).clearContent();
    }
    return;
  }

  targetSheet.getRange(2, 1, outputRows.length, headers.length).setValues(outputRows);
  if (targetLastRow > outputRows.length + 1) {
    targetSheet.getRange(outputRows.length + 2, 1, targetLastRow - outputRows.length - 1, headers.length).clearContent();
  }
  applyDateFormats_(targetSheet, headers, outputRows.length);
  applyAmountFormats_(targetSheet, headers, outputRows.length);
  sortSheetByDateColumn_(targetSheet, headers, '日付');
}

function overwriteFinalManagementStage2Sheet_(sourceSheet, targetSheet, headers, latestRawMap) {
  const sourceLastRow = sourceSheet.getLastRow();
  const sourceLastColumn = sourceSheet.getLastColumn();
  const targetLastRow = targetSheet.getLastRow();

  targetSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (sourceLastRow <= 1 || sourceLastColumn <= 0) {
    if (targetLastRow > 1) {
      targetSheet.getRange(2, 1, targetLastRow - 1, headers.length).clearContent();
    }
    return;
  }

  const sourceHeaders = getSheetHeaders_(sourceSheet);
  const sourceHeaderMap = createHeaderMap_(sourceHeaders);
  const sourceValues = sourceSheet.getRange(2, 1, sourceLastRow - 1, sourceLastColumn).getValues();
  const outputRows = sourceValues
    .filter(function(row) {
      return String(getCellByHeader_(row, sourceHeaderMap, '整備ナンバー') || '').trim() !== '';
    })
    .map(function(row) {
      return buildFinalManagementStage2Row_(row, sourceHeaderMap, latestRawMap);
    });

  if (!outputRows.length) {
    if (targetLastRow > 1) {
      targetSheet.getRange(2, 1, targetLastRow - 1, headers.length).clearContent();
    }
    return;
  }

  targetSheet.getRange(2, 1, outputRows.length, headers.length).setValues(outputRows);
  if (targetLastRow > outputRows.length + 1) {
    targetSheet.getRange(outputRows.length + 2, 1, targetLastRow - outputRows.length - 1, headers.length).clearContent();
  }
  applyDateFormats_(targetSheet, headers, outputRows.length);
  applyAmountFormats_(targetSheet, headers, outputRows.length);
  sortSheetByDateColumn_(targetSheet, headers, '日付');
}

function buildManagementStage2Row_(row, headerMap, latestRawMap) {
  const seibiNo = String(getCellByHeader_(row, headerMap, '整備ナンバー') || '').trim();
  const normalizedCategory = sanitizeSheetStringValue_(String(getCellByHeader_(row, headerMap, '作業大区分') || '').trim());
  const sourceMeta = latestRawMap[seibiNo] || {};
  const rawCategory = sanitizeSheetStringValue_(sourceMeta.rawCategory || normalizedCategory);
  const serviceShop = sanitizeSheetStringValue_(sourceMeta.serviceShop || String(getCellByHeader_(row, headerMap, '整備店舗') || '').trim());
  const managementCategory = deriveManagementCategory_(serviceShop, normalizedCategory, rawCategory);
  const baseDate = pickFirstValidDate_(
    getCellByHeader_(row, headerMap, '日付'),
    sourceMeta.sourceDate
  );
  const estimateDate = pickFirstValidDate_(
    getCellByHeader_(row, headerMap, '見積日'),
    baseDate,
    sourceMeta.sourceDate
  );

  return [
    seibiNo,
    sanitizeSheetStringValue_(getCellByHeader_(row, headerMap, '状況')),
    baseDate,
    estimateDate,
    getCellByHeader_(row, headerMap, '入金予定日') || '',
    toNum_(getCellByHeader_(row, headerMap, '売上総計')),
    toNum_(getCellByHeader_(row, headerMap, '粗利益')),
    deriveManagementBrand_(serviceShop, normalizedCategory, rawCategory),
    managementCategory,
    rawCategory
  ];
}

function buildFinalManagementStage2Row_(row, headerMap, latestRawMap) {
  const seibiNo = String(getCellByHeader_(row, headerMap, '整備ナンバー') || '').trim();
  const normalizedCategory = sanitizeSheetStringValue_(String(getCellByHeader_(row, headerMap, '作業大区分') || '').trim());
  const sourceMeta = latestRawMap[seibiNo] || {};
  const rawCategory = sanitizeSheetStringValue_(sourceMeta.rawCategory || normalizedCategory);
  const serviceShop = sanitizeSheetStringValue_(sourceMeta.serviceShop || String(getCellByHeader_(row, headerMap, '整備店舗') || '').trim());
  const managementCategory = deriveManagementCategory_(serviceShop, normalizedCategory, rawCategory);
  const baseDate = pickFirstValidDate_(
    getCellByHeader_(row, headerMap, '日付'),
    sourceMeta.sourceDate
  );
  const estimateDate = pickFirstValidDate_(
    getCellByHeader_(row, headerMap, '見積日'),
    baseDate,
    sourceMeta.sourceDate
  );

  return [
    seibiNo,
    sanitizeSheetStringValue_(getCellByHeader_(row, headerMap, '状況')),
    baseDate,
    estimateDate,
    toNum_(getCellByHeader_(row, headerMap, '売上総計')),
    toNum_(getCellByHeader_(row, headerMap, '粗利益')),
    deriveManagementBrand_(serviceShop, normalizedCategory, rawCategory),
    managementCategory,
    rawCategory
  ];
}

function deriveManagementCategory_(serviceShop, normalizedCategory, rawCategory) {
  const category = sanitizeSheetStringValue_(normalizedCategory);
  const raw = normalizeText_(rawCategory);

  if (isMaseratiServiceHint_(serviceShop) &&
    (normalizeText_(category) === normalizeText_('保険') ||
      raw.indexOf(normalizeText_('損保ﾚﾝ')) >= 0 ||
      raw.indexOf(normalizeText_('損保レン')) >= 0)) {
    return 'その他';
  }

  return category;
}

function deriveManagementBrand_(serviceShop, normalizedCategory, rawCategory) {
  const shop = normalizeText_(serviceShop);
  const category = normalizeText_(normalizedCategory);
  const raw = normalizeText_(rawCategory);

  if (isMaseratiServiceHint_(serviceShop)) {
    return 'ﾏｾﾗﾃｨ';
  }

  if (category === normalizeText_('保険') || raw.indexOf(normalizeText_('損保ﾚﾝ')) >= 0 || raw.indexOf(normalizeText_('損保レン')) >= 0) {
    return 'ﾚﾝﾀｼｪｱ';
  }

  if (isMaseratiSupportLocationHint_(serviceShop)) {
    return '他社';
  }

  if (shop.indexOf(normalizeText_('J・L')) >= 0 || shop.indexOf(normalizeText_('JLR')) >= 0) {
    return 'JLR';
  }

  return '他社';
}

function pickFirstValidDate_() {
  for (let i = 0; i < arguments.length; i++) {
    const parsed = convertWarekiToDate_(arguments[i]);
    if (parsed instanceof Date && !isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return '';
}

function debugSingleFile() {
  validateRuntimeConfig_();

  const folder = DriveApp.getFolderById(CFG.INPUT_FOLDER_ID);
  const files = getCsvFilesInFolder_(folder);

  if (!files.length) {
    Logger.log('CSVファイルが見つかりません');
    return;
  }

  const file = files[0];
  Logger.log('テスト対象: ' + file.getName() + ' / ' + file.getId());

  try {
    const result = processCsvFile_(file);
    Logger.log('抽出レコード数: ' + ((result.records || []).length));
    Logger.log('先頭レコード: ' + JSON.stringify((result.records || [])[0] || {}));
  } catch (error) {
    Logger.log('エラー: ' + error.message);
    throw error;
  }
}

function debugListPdfFiles() {
  validateRuntimeConfig_();

  const folder = DriveApp.getFolderById(CFG.INPUT_FOLDER_ID);
  const pdfFiles = getCsvFilesInFolder_(folder);
  Logger.log('フォルダ名: ' + folder.getName());
  Logger.log('フォルダID: ' + folder.getId());
  Logger.log('CSV件数: ' + pdfFiles.length);

  pdfFiles.slice(0, 20).forEach(function(file, index) {
    Logger.log([
      '#' + (index + 1),
      file.getName(),
      'id=' + file.getId(),
      'mime=' + file.getMimeType()
    ].join(' / '));
  });
}

function listAvailableModels() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    Logger.log('GEMINI_API_KEY が設定されていません');
    return;
  }

  const res = UrlFetchApp.fetch(
    'https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey,
    { muteHttpExceptions: true }
  );

  const body = JSON.parse(res.getContentText());
  if (res.getResponseCode() !== 200) {
    Logger.log('エラー: ' + res.getContentText());
    return;
  }

  const models = (body.models || [])
    .filter(function(m) {
      return (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0;
    })
    .map(function(m) {
      return m.name.replace('models/', '');
    });

  Logger.log('=== generateContent対応モデル一覧 ===');
  models.forEach(function(name) { Logger.log(name); });
}

function setVehicleSalesDropdown() {
  setVehicleSalesDropdown_();
}

function clearConditionalFormatsFromSheet() {
  const sheetName = CFG.STAGE2_SHEET_SYAKEN;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('シート「' + sheetName + '」が見つかりません');
  }

  sheet.setConditionalFormatRules([]);
}

function auditImportedData_(ss, sourceContext) {
  ss = ss || getSourceServiceSpreadsheet_();
  const sourceSheet = ss.getSheetByName(CFG.STAGE1_SHEET);
  if (!sourceSheet || sourceSheet.getLastRow() <= 1) {
    return;
  }

  const auditSheet = getOrCreateSheet_(ss, CFG.AUDIT_SHEET, AUDIT_HEADERS);
  sourceContext = sourceContext || loadServiceStage1Context_(sourceSheet);
  const values = sourceContext.sourceValues || [];
  if (values.length < 2) {
    clearSheetBody_(auditSheet, AUDIT_HEADERS.length);
    return;
  }

  const headerMap = sourceContext.sourceHeaderMap || {};
  const now = Utilities.formatDate(new Date(), CFG.TIMEZONE, 'yyyy/MM/dd HH:mm:ss');
  const issues = [];
  const seenSeibiNos = {};

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const seibiNo = String(getCellByHeader_(row, headerMap, '整備No') || '').trim();
    const dateText = String(getCellByHeader_(row, headerMap, '日付') || '').trim();
    const customer = String(getCellByHeader_(row, headerMap, '顧客名') || '').trim();
    const shop = String(getCellByHeader_(row, headerMap, '整備店舗') || '').trim();
    const category = String(getCellByHeader_(row, headerMap, '作業大区分') || '').trim();
    const status = String(getCellByHeader_(row, headerMap, '状況') || '').trim();
    const fileName = String(getCellByHeader_(row, headerMap, 'ファイル名') || '').trim();

    pushAuditIssue_(issues, now, 'OCR生データ', seibiNo, fileName, !seibiNo, '整備Noなし', dateText, customer, shop, category, status);
    pushAuditIssue_(issues, now, 'OCR生データ', seibiNo, fileName, !!dateText && !convertWarekiToDate_(dateText), '日付変換不可', dateText, customer, shop, category, status);
    pushAuditIssue_(issues, now, 'OCR生データ', seibiNo, fileName, !status, '状況なし', dateText, customer, shop, category, status);
    pushAuditIssue_(issues, now, 'OCR生データ', seibiNo, fileName, !category, '作業大区分なし', dateText, customer, shop, category, status);
    pushAuditIssue_(issues, now, 'OCR生データ', seibiNo, fileName, !shop, '整備店舗なし', dateText, customer, shop, category, status);

    if (seibiNo) {
      if (seenSeibiNos[seibiNo]) {
        pushAuditIssue_(issues, now, 'OCR生データ', seibiNo, fileName, true, '整備No重複', dateText, customer, shop, category, status);
      }
      seenSeibiNos[seibiNo] = true;
    }
  }

  clearSheetBody_(auditSheet, AUDIT_HEADERS.length);
  if (issues.length) {
    auditSheet.getRange(2, 1, issues.length, AUDIT_HEADERS.length).setValues(issues);
  }

  Logger.log('OCR取込チェック件数: ' + issues.length);
}

function pushAuditIssue_(bucket, timestamp, sheetName, seibiNo, fileName, condition, issue, dateText, customer, shop, category, status) {
  if (!condition) {
    return;
  }
  bucket.push([
    timestamp,
    sheetName,
    seibiNo,
    fileName,
    issue,
    dateText,
    customer,
    shop,
    category,
    status
  ]);
}

function isNearRuntimeLimit_(startTime) {
  return Date.now() - startTime >= (CFG.MAX_RUNTIME_MS - CFG.RUNTIME_SAFETY_MARGIN_MS);
}

function getImportStateKey_(fileId) {
  return CFG.IMPORT_STATE_PREFIX + String(fileId || '');
}

function loadFileProgressState_(fileId) {
  const raw = PropertiesService.getScriptProperties().getProperty(getImportStateKey_(fileId));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    Logger.log('進捗状態JSON読込失敗: ' + error.message);
    return null;
  }
}

function saveFileProgressState_(state) {
  PropertiesService.getScriptProperties().setProperty(
    getImportStateKey_(state.fileId),
    JSON.stringify(state)
  );
}

function clearFileProgressState_(fileId) {
  const state = loadFileProgressState_(fileId);
  if (state) {
    deleteImportTempFile_(state.ocrTextFileId);
    deleteImportTempFile_(state.resultFileId);
  }
  PropertiesService.getScriptProperties().deleteProperty(getImportStateKey_(fileId));
}

function getOrCreateImportTempFolder_() {
  const rootFolder = DriveApp.getFolderById(CFG.PDF_FOLDER_ID);
  const folders = rootFolder.getFoldersByName(CFG.IMPORT_TEMP_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return rootFolder.createFolder(CFG.IMPORT_TEMP_FOLDER_NAME);
}

function createImportTempTextFile_(fileName, suffix, content) {
  const folder = getOrCreateImportTempFolder_();
  const safeName = String(fileName || 'import').replace(/[\\/:*?"<>|]/g, '_');
  const file = folder.createFile(safeName + suffix, String(content || ''), MimeType.PLAIN_TEXT);
  return file.getId();
}

function readImportTempTextFile_(fileId) {
  if (!fileId) {
    return '';
  }
  return DriveApp.getFileById(fileId).getBlob().getDataAsString('UTF-8');
}

function writeImportTempTextFile_(fileId, content) {
  if (!fileId) {
    throw new Error('一時ファイルIDがありません');
  }

  const blob = Utilities.newBlob(String(content || ''), MimeType.PLAIN_TEXT, 'state.txt');
  if (typeof Drive !== 'undefined' && Drive.Files && Drive.Files.update) {
    Drive.Files.update({}, fileId, blob);
    return;
  }

  const file = DriveApp.getFileById(fileId);
  const folderIterator = file.getParents();
  const folder = folderIterator.hasNext() ? folderIterator.next() : null;
  const name = file.getName();
  file.setTrashed(true);
  if (!folder) {
    throw new Error('一時ファイル更新に必要な親フォルダを取得できません');
  }
  const newFile = folder.createFile(name, String(content || ''), MimeType.PLAIN_TEXT);
  return newFile.getId();
}

function appendRecordsToProgressFile_(fileId, records) {
  const current = readRecordsFromProgressFile_(fileId);
  Array.prototype.push.apply(current, records || []);
  return writeImportTempTextFile_(fileId, JSON.stringify(current)) || fileId;
}

function readRecordsFromProgressFile_(fileId) {
  const text = readImportTempTextFile_(fileId);
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    Logger.log('進捗レコードJSON読込失敗: ' + error.message);
    return [];
  }
}

function deleteImportTempFile_(fileId) {
  if (!fileId) {
    return;
  }
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch (error) {
    Logger.log('一時ファイル削除失敗: ' + error.message);
  }
}

function validateRuntimeConfig_() {
  DriveApp.getFolderById(CFG.INPUT_FOLDER_ID);
  DriveApp.getFolderById(CFG.DONE_FOLDER_ID);
  DriveApp.getFolderById(CFG.ERR_FOLDER_ID);
}

function getPdfFilesInFolder_(folder) {
  const folderId = folder.getId();
  const files = [];

  if (typeof Drive !== 'undefined' && Drive.Files && Drive.Files.list) {
    try {
      let pageToken = null;
      do {
        const res = Drive.Files.list({
          q: "'" + folderId + "' in parents and trashed = false and mimeType = 'application/pdf'",
          pageSize: 100,
          pageToken: pageToken,
          fields: 'files(id,name,mimeType),nextPageToken'
        });

        (res.files || []).forEach(function(item) {
          try {
            files.push(DriveApp.getFileById(item.id));
          } catch (error) {
            Logger.log('PDF取得失敗: ' + (item.name || '') + ' / ' + item.id + ' / ' + error.message);
          }
        });

        pageToken = res.nextPageToken;
      } while (pageToken);

      return files;
    } catch (error) {
      Logger.log('Drive API v3 PDF検索失敗。DriveAppへフォールバックします: ' + error.message);
    }
  }

  const iterator = folder.getFilesByType(MimeType.PDF);
  while (iterator.hasNext()) {
    files.push(iterator.next());
  }

  return files;
}

function getCsvFilesInFolder_(folder) {
  const files = [];
  const iterator = folder.getFiles();

  while (iterator.hasNext()) {
    const file = iterator.next();
    const name = String(file.getName() || '');
    const mimeType = String(file.getMimeType() || '');

    if (/\.csv$/i.test(name) || mimeType === MimeType.CSV || mimeType === 'text/csv' || mimeType === 'application/vnd.ms-excel') {
      files.push(file);
    }
  }

  files.sort(function(a, b) {
    const updatedCompare = a.getLastUpdated().getTime() - b.getLastUpdated().getTime();
    if (updatedCompare !== 0) {
      return updatedCompare;
    }
    return String(a.getName()).localeCompare(String(b.getName()), 'ja');
  });

  return files;
}

function moveFileToFolderSafely_(file, targetFolder) {
  if (!file || !targetFolder) {
    return;
  }

  const targetFolderId = targetFolder.getId();
  if (isFileInFolder_(file, targetFolderId)) {
    return;
  }

  try {
    file.moveTo(targetFolder);
  } catch (error) {
    Logger.log('DriveApp.moveTo 失敗。add/remove へフォールバックします: ' + error.message);
  }

  if (isFileInFolder_(file, targetFolderId)) {
    return;
  }

  targetFolder.addFile(file);

  const parents = [];
  const parentIterator = file.getParents();
  while (parentIterator.hasNext()) {
    parents.push(parentIterator.next());
  }

  parents.forEach(function(parent) {
    if (parent.getId() !== targetFolderId) {
      parent.removeFile(file);
    }
  });

  if (!isFileInFolder_(file, targetFolderId)) {
    throw new Error('ファイルを移動できませんでした: ' + file.getName());
  }
}

function isFileInFolder_(file, folderId) {
  const parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === folderId) {
      return true;
    }
  }
  return false;
}

function isRetryableGeminiStatus_(statusCode) {
  return statusCode === 429 || statusCode === 500 || statusCode === 503 || statusCode === 504;
}

function isMaxTokensError_(error) {
  const message = String(error && error.message || '');
  return message.indexOf('Gemini MAX_TOKENS') >= 0;
}

function isGeminiSizeError_(error) {
  const message = String(error && error.message || '');
  return isMaxTokensError_(error) ||
    message.indexOf('Bandwidth quota exceeded') >= 0 ||
    message.indexOf('rate of data transfer') >= 0 ||
    /Gemini HTTP Error 413\b/.test(message);
}

function isTransientGeminiError_(error) {
  const message = String(error && error.message || '');
  return /Gemini HTTP Error (429|500|503|504)\b/.test(message) ||
    isGeminiSizeError_(error);
}
