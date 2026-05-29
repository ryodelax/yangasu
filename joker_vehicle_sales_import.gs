const JOKER_VEHICLE_SALES = {
  sourceFolderId: '1TVchY_k6L9Adzc0Au5S0MnuHmiJbFFGL',
  doneFolderName: '読み取り済み',
  errorFolderName: 'エラー',
  spreadsheetId: '1lSGYAxzulhv1D1QSiiL70MunkPkqyDGY8bkMLpX8Ypg',
  importSheetName: 'JOKER_商談取込',
  transferSheetName: 'JOKER_管理転記',
  salesListSheetName: 'JOKER_営業案件リスト',
  validationSheetName: 'JOKER_取込検証',
  timezone: 'Asia/Tokyo'
};

const JOKER_IMPORT_HEADERS = [
  'source_file', 'page_no', 'row_no', 'report_date', 'deal_date', 'deal_no', 'purchase_no', 'u_n',
  'progress', 'phase_original', 'customer_name', 'customer_name_short', 'salesperson',
  'address', 'postal_code', 'phone_number', 'store', 'email', 'model_year', 'vehicle_name',
  'body_type', 'displacement', 'grade', 'transmission', 'inspection_date',
  'vehicle_price_tax_in', 'vehicle_sales_total_tax_in', 'vehicle_price_tax_ex', 'raw_block'
];

const JOKER_TRANSFER_HEADERS = [
  '進捗', '顧客名', '販売金額（税込）', '案件発生日', '受注日', '登録決定日',
  '住所', 'TEL', '店舗', '見込み車種　グレード', '年式', '商談No', '仕入No', 'メール'
];

const JOKER_VALIDATION_HEADERS = [
  '実行日時', 'ファイル名', '処理結果', '総件数', '登録決定', '受注', '見積提示', 'その他', 'フェーズ欠落行', '備考'
];

const JOKER_SALES_HEADERS = [
  '進捗', '顧客名', 'U/N', '商談日', '商談No', '仕入No',
  '年式', '車名', '形状', '排気量', 'グレード', 'ミッション', '車検',
  '車価（税込）', '車両販売総額（税込）', '車両販売総額（税抜）',
  '郵便番号', '住所', 'TEL', '店舗', 'メール', '案件キー', '最終取込日時'
];

const JOKER_SALES_VISIBLE_COLUMNS = 21;
const JOKER_SALES_HIDDEN_COLUMNS = [22, 23];
const JOKER_SALES_PROGRESS_ORDER = ['登録決定', '受注', '見積提示', 'ヒアリング・検討', '登録見込', '延期', '敗戦'];

const JOKER_WEBAPP_SECRET = 'jvsi_20260424_exec';

function runJokerVehicleSalesImport() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    validateJokerVehicleSalesConfig_();

    const sourceFolder = DriveApp.getFolderById(JOKER_VEHICLE_SALES.sourceFolderId);
    const doneFolder = findChildFolderByName_(sourceFolder, JOKER_VEHICLE_SALES.doneFolderName);
    const errorFolder = findChildFolderByName_(sourceFolder, JOKER_VEHICLE_SALES.errorFolderName);
    const files = collectPdfFiles_(sourceFolder);

    if (!files.length) {
      Logger.log('JOKER車両販売: 対象PDFはありません。');
      return;
    }

    const successFiles = [];
    const failedFiles = [];
    const validationRows = [];
    const importedAt = Utilities.formatDate(new Date(), JOKER_VEHICLE_SALES.timezone, 'yyyy/MM/dd HH:mm:ss');

    files.forEach(function(file) {
      try {
        const text = extractJokerPdfTextWithDriveOcr_(file);
        const parsed = parseJokerVehicleSalesText_(text, file.getName());
        if (!parsed.records.length) {
          throw new Error('帳票解析結果が0件です。OCR結果または帳票レイアウトを確認してください。');
        }

        successFiles.push({ file: file, records: parsed.records });
        validationRows.push(buildJokerValidationRow_(importedAt, file.getName(), parsed.records, '成功', ''));
      } catch (error) {
        Logger.log('JOKER車両販売 取込失敗: ' + file.getName() + ' / ' + error.message);
        failedFiles.push(file);
        validationRows.push(buildJokerValidationErrorRow_(importedAt, file.getName(), error.message));
      }
    });

    const allRecords = [];
    successFiles.forEach(function(entry) {
      Array.prototype.push.apply(allRecords, entry.records);
    });

    writeJokerVehicleSalesSheets_(allRecords, validationRows, importedAt);

    successFiles.forEach(function(entry) {
      if (doneFolder) {
        entry.file.moveTo(doneFolder);
      }
    });

    failedFiles.forEach(function(file) {
      if (errorFolder) {
        file.moveTo(errorFolder);
      }
    });

    Logger.log('JOKER車両販売 取込完了: 成功' + successFiles.length + '件 / レコード' + allRecords.length + '件 / 失敗' + failedFiles.length + '件');
  } finally {
    lock.releaseLock();
  }
}

function setupJokerVehicleSalesImport() {
  const ss = SpreadsheetApp.openById(JOKER_VEHICLE_SALES.spreadsheetId);
  getOrCreateJokerSheet_(ss, JOKER_VEHICLE_SALES.importSheetName, JOKER_IMPORT_HEADERS);
  getOrCreateJokerSheet_(ss, JOKER_VEHICLE_SALES.transferSheetName, JOKER_TRANSFER_HEADERS);
  const salesSheet = getOrCreateJokerSheet_(ss, JOKER_VEHICLE_SALES.salesListSheetName, JOKER_SALES_HEADERS);
  getOrCreateJokerSheet_(ss, JOKER_VEHICLE_SALES.validationSheetName, JOKER_VALIDATION_HEADERS);
  formatJokerSalesListSheet_(salesSheet);
}

function createJokerVehicleSalesTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'runJokerVehicleSalesImport') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('runJokerVehicleSalesImport').timeBased().everyHours(1).create();
}

function doGet(e) {
  if (isVehicleSalesAppRequest_(e)) {
    return renderVehicleSalesApp_(e);
  }
  if (isBudgetAppRequest_(e)) {
    return renderBudgetApp_(e);
  }
  return handleJokerVehicleSalesWebRequest_(e);
}

function doPost(e) {
  if (isVehicleSalesAppRequest_(e)) {
    return renderVehicleSalesApp_(e);
  }
  if (isBudgetAppRequest_(e)) {
    return renderBudgetApp_(e);
  }
  return handleJokerVehicleSalesWebRequest_(e);
}

function handleJokerVehicleSalesWebRequest_(e) {
  const params = e && e.parameter ? e.parameter : {};
  const secret = params.secret || '';
  const action = params.action || 'status';

  if (secret !== JOKER_WEBAPP_SECRET) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: 'unauthorized'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    if (action === 'setup') {
      setupJokerVehicleSalesImport();
    } else if (action === 'run') {
      runJokerVehicleSalesImport();
    } else if (action === 'install_service_workflow_triggers') {
      installUnifiedServiceWorkflowTriggers();
    } else if (action === 'list_service_workflow_triggers') {
      return ContentService.createTextOutput(JSON.stringify(listUserTriggersForServiceSpreadsheets_())).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'cleanup_legacy_service_workflow_triggers') {
      return ContentService.createTextOutput(JSON.stringify(cleanupLegacyServiceSpreadsheetTriggers_())).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'reprocess_latest') {
      return ContentService.createTextOutput(JSON.stringify(reprocessLatestJokerVehicleSalesFile_())).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'trigger') {
      createJokerVehicleSalesTrigger();
    } else if (action === 'rebuild_sales_list') {
      return ContentService.createTextOutput(JSON.stringify(rebuildJokerSalesListFromImport_())).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'retry_error') {
      return ContentService.createTextOutput(JSON.stringify(retryJokerVehicleSalesErrorFiles_())).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'retry_bridge_invoice') {
      return ContentService.createTextOutput(JSON.stringify(retryBridgeInvoiceErrorFiles())).setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'debug') {
      return ContentService.createTextOutput(JSON.stringify(debugJokerVehicleSalesFile_())).setMimeType(ContentService.MimeType.JSON);
    } else if (action !== 'status') {
      throw new Error('unknown action: ' + action);
    }

    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      action: action,
      timestamp: Utilities.formatDate(new Date(), JOKER_VEHICLE_SALES.timezone, 'yyyy/MM/dd HH:mm:ss')
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      action: action,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function retryJokerVehicleSalesErrorFiles_() {
  const sourceFolder = DriveApp.getFolderById(JOKER_VEHICLE_SALES.sourceFolderId);
  const errorFolder = findChildFolderByName_(sourceFolder, JOKER_VEHICLE_SALES.errorFolderName);
  if (!errorFolder) {
    return { ok: false, error: 'error folder not found' };
  }

  const files = collectPdfFiles_(errorFolder);
  files.forEach(function(file) {
    file.moveTo(sourceFolder);
  });

  runJokerVehicleSalesImport();

  return {
    ok: true,
    moved: files.length,
    action: 'retry_error',
    timestamp: Utilities.formatDate(new Date(), JOKER_VEHICLE_SALES.timezone, 'yyyy/MM/dd HH:mm:ss')
  };
}

function reprocessLatestJokerVehicleSalesFile_() {
  const sourceFolder = DriveApp.getFolderById(JOKER_VEHICLE_SALES.sourceFolderId);
  const errorFolder = findChildFolderByName_(sourceFolder, JOKER_VEHICLE_SALES.errorFolderName);
  const doneFolder = findChildFolderByName_(sourceFolder, JOKER_VEHICLE_SALES.doneFolderName);
  const candidates = [];

  [sourceFolder, doneFolder, errorFolder].forEach(function(folder) {
    if (!folder) return;
    collectPdfFiles_(folder).forEach(function(file) {
      candidates.push(file);
    });
  });

  if (!candidates.length) {
    return { ok: false, error: 'reprocess target pdf not found' };
  }

  candidates.sort(function(left, right) {
    return right.getLastUpdated() - left.getLastUpdated();
  });

  const file = candidates[0];
  const importedAt = Utilities.formatDate(new Date(), JOKER_VEHICLE_SALES.timezone, 'yyyy/MM/dd HH:mm:ss');
  const text = extractJokerPdfTextWithDriveOcr_(file);
  const parsed = parseJokerVehicleSalesText_(text, file.getName());
  const validationRows = [
    buildJokerValidationRow_(importedAt, file.getName(), parsed.records, '再処理', 'latest pdf reprocessed')
  ];

  writeJokerVehicleSalesSheets_(parsed.records, validationRows, importedAt);
  return { ok: true, action: 'reprocess_latest', fileName: file.getName(), count: parsed.records.length };
}

function rebuildJokerSalesListFromImport_() {
  const ss = SpreadsheetApp.openById(JOKER_VEHICLE_SALES.spreadsheetId);
  const importSheet = getOrCreateJokerSheet_(ss, JOKER_VEHICLE_SALES.importSheetName, JOKER_IMPORT_HEADERS);
  const salesSheet = getOrCreateJokerSheet_(ss, JOKER_VEHICLE_SALES.salesListSheetName, JOKER_SALES_HEADERS);
  const lastRow = importSheet.getLastRow();
  if (lastRow <= 1) {
    formatJokerSalesListSheet_(salesSheet);
    return { ok: true, action: 'rebuild_sales_list', count: 0 };
  }

  const values = importSheet.getRange(2, 1, lastRow - 1, JOKER_IMPORT_HEADERS.length).getValues();
  const records = values.map(function(row) {
    return objectFromHeaders_(JOKER_IMPORT_HEADERS, row);
  });
  writeJokerSalesListSheet_(salesSheet, records, Utilities.formatDate(new Date(), JOKER_VEHICLE_SALES.timezone, 'yyyy/MM/dd HH:mm:ss'));
  return { ok: true, action: 'rebuild_sales_list', count: records.length };
}

function debugJokerVehicleSalesFile_() {
  const sourceFolder = DriveApp.getFolderById(JOKER_VEHICLE_SALES.sourceFolderId);
  const errorFolder = findChildFolderByName_(sourceFolder, JOKER_VEHICLE_SALES.errorFolderName);
  const doneFolder = findChildFolderByName_(sourceFolder, JOKER_VEHICLE_SALES.doneFolderName);
  const candidates = [];

  [sourceFolder, errorFolder, doneFolder].forEach(function(folder) {
    if (!folder) return;
    const files = collectPdfFiles_(folder);
    files.forEach(function(file) {
      candidates.push(file);
    });
  });

  if (!candidates.length) {
    return { ok: false, error: 'debug target pdf not found' };
  }

  const file = candidates[0];
  const text = extractJokerPdfTextWithDriveOcr_(file);
  const pages = splitJokerPages_(text);
  const firstPage = pages[0] || { reportDate: '', text: text };
  const lines = String(firstPage.text || '')
    .split('\n')
    .map(cleanJokerLine_)
    .filter(Boolean);
  const headerIndex = findLastIndex_(lines, function(line) {
    return line === '商談名' || line === '行No' || line.indexOf('商談名') >= 0 || line.indexOf('行No') >= 0;
  });

  let blockCount = 0;
  let parsedCount = 0;
  let parseError = '';

  try {
    blockCount = iterateJokerRecordBlocks_(firstPage).length;
    parsedCount = parseJokerVehicleSalesText_(text, file.getName()).records.length;
  } catch (error) {
    parseError = error.message;
  }

  return {
    ok: true,
    fileName: file.getName(),
    pageCount: pages.length,
    textLength: String(text || '').length,
    reportDate: firstPage.reportDate,
    headerIndex: headerIndex,
    blockCount: blockCount,
    parsedCount: parsedCount,
    parseError: parseError,
    firstLines: lines.slice(0, 80)
  };
}

function parseJokerVehicleSalesText_(text, fileName) {
  const pages = splitJokerPages_(text);
  const records = [];

  pages.forEach(function(page, pageIndex) {
    const blocks = iterateJokerRecordBlocks_(page);
    blocks.forEach(function(block) {
      records.push(parseJokerRecord_(fileName, page.reportDate, pageIndex + 1, block.rowNo, block.lines));
    });
  });

  return { records: records };
}

function splitJokerPages_(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const parts = normalized.split(/＜商談一覧＞\s*\d+\s*／\s*\d+\s*\d{4}年\d{2}月\d{2}日/);
  const footerDates = normalized.match(/\d{4}年\d{2}月\d{2}日/g) || [];
  const pages = [];

  parts.forEach(function(part, index) {
    const cleaned = part.trim();
    if (!cleaned) return;
    pages.push({
      reportDate: footerDates[index] ? footerDates[index].replace(/年|月/g, '-').replace(/日$/, '') : '',
      text: cleaned
    });
  });

  return pages;
}

function iterateJokerRecordBlocks_(page) {
  const lines = String(page.text || '')
    .split('\n')
    .map(cleanJokerLine_)
    .filter(Boolean);

  const headerIndex = findLastIndex_(lines, function(line) {
    return line === '商談名' || line === '行No' || line.indexOf('商談名') >= 0 || line.indexOf('行No') >= 0;
  });
  const body = headerIndex >= 0 ? lines.slice(headerIndex + 1) : lines;
  const blocks = [];

  for (let i = 0; i < body.length; i++) {
    const line = body[i];
    const next = body[i + 1] || '';
    const next2 = body[i + 2] || '';
    const next3 = body[i + 3] || '';

    if (!isJokerRecordStart_(line, next) && !isJokerAltRecordStart_(line, next, next2, next3)) {
      continue;
    }

    const rowNo = Number(line);
    const recordLines = [];
    for (let j = i + 1; j < body.length; j++) {
      const current = body[j];
      const nextCurrent = body[j + 1] || '';
      const nextCurrent2 = body[j + 2] || '';
      const nextCurrent3 = body[j + 3] || '';
      if (current === '合計' || isJokerRecordStart_(current, nextCurrent) || isJokerAltRecordStart_(current, nextCurrent, nextCurrent2, nextCurrent3)) {
        i = j - 1;
        break;
      }
      recordLines.push(current);
      if (j === body.length - 1) {
        i = j;
      }
    }

    if (recordLines.length) {
      blocks.push({ rowNo: rowNo, lines: recordLines });
    }
  }

  return blocks;
}

function parseJokerRecord_(fileName, reportDate, pageNo, rowNo, lines) {
  if (['U', 'N'].indexOf(lines[0]) >= 0) {
    return parseJokerAltRecord_(fileName, reportDate, pageNo, rowNo, lines);
  }

  let index = 0;
  const dealDate = isJokerFullDate_(lines[index]) ? lines[index++] : '';
  const u_n = ['U', 'N'].indexOf(lines[index]) >= 0 ? lines[index++] : '';
  const dealNo = /^CS\d+$/.test(lines[index] || '') ? lines[index++] : '';
  const purchaseNo = /^CH\d+$/.test(lines[index] || '') ? lines[index++] : '';
  const spec = parseJokerSpecLines_(lines.slice(index));
  const tail = lines.slice(index + spec.tailStart);
  const tailInfo = parseJokerTailLines_(tail);

  return {
    source_file: fileName,
    page_no: pageNo,
    row_no: rowNo,
    report_date: reportDate,
    deal_date: dealDate,
    deal_no: dealNo,
    purchase_no: purchaseNo,
    u_n: u_n,
    progress: tailInfo.progress,
    phase_original: tailInfo.phaseOriginal,
    customer_name: tailInfo.customerName,
    customer_name_short: tailInfo.customerNameShort,
    salesperson: '',
    address: tailInfo.address,
    postal_code: tailInfo.postalCode,
    phone_number: tailInfo.phoneNumber,
    store: tailInfo.store,
    email: tailInfo.email,
    model_year: spec.modelYear,
    vehicle_name: spec.vehicleName,
    body_type: spec.bodyType,
    displacement: spec.displacement,
    grade: spec.grade,
    transmission: spec.transmission,
    inspection_date: spec.inspectionDate,
    vehicle_price_tax_in: spec.vehiclePriceTaxIn,
    vehicle_sales_total_tax_in: spec.vehicleSalesTotalTaxIn,
    vehicle_price_tax_ex: tailInfo.vehiclePriceTaxEx,
    raw_block: lines.join('\n')
  };
}

function parseJokerAltRecord_(fileName, reportDate, pageNo, rowNo, lines) {
  const u_n = ['U', 'N'].indexOf(lines[0]) >= 0 ? lines[0] : '';
  const lead = parseJokerAltLead_(lines.slice(1));
  const phaseOriginal = lead.phaseOriginal;
  const progress = normalizeJokerProgress_(phaseOriginal);
  const spec = parseJokerAltSpecLine_(lead.specLine);
  const idsInfo = parseJokerAltIds_(lead.metaLines);
  const tailInfo = parseJokerAltTailLines_(lead.tailLines, idsInfo.remainder);
  const salesTotal = findJokerLargeAmountInLines_(lead.tailLines) || findJokerLargeAmountInLines_(lead.metaLines) || 0;

  return {
    source_file: fileName,
    page_no: pageNo,
    row_no: rowNo,
    report_date: reportDate,
    deal_date: lead.dealDate,
    deal_no: idsInfo.dealNo,
    purchase_no: idsInfo.purchaseNo,
    u_n: u_n,
    progress: progress,
    phase_original: phaseOriginal,
    customer_name: tailInfo.customerName,
    customer_name_short: tailInfo.customerNameShort,
    salesperson: '',
    address: tailInfo.address,
    postal_code: tailInfo.postalCode,
    phone_number: tailInfo.phoneNumber,
    store: tailInfo.store,
    email: tailInfo.email,
    model_year: spec.modelYear,
    vehicle_name: spec.vehicleName,
    body_type: '',
    displacement: spec.displacement,
    grade: spec.grade,
    transmission: spec.transmission,
    inspection_date: spec.inspectionDate,
    vehicle_price_tax_in: spec.vehiclePriceTaxIn,
    vehicle_sales_total_tax_in: salesTotal || spec.vehicleSalesTotalTaxIn,
    vehicle_price_tax_ex: spec.vehiclePriceTaxEx,
    raw_block: lines.join('\n')
  };
}

function parseJokerAltLead_(lines) {
  let index = 0;
  const first = lines[index] || '';
  const merged = splitJokerPhaseAndSpecLine_(first);
  let phaseOriginal = merged.phaseOriginal;
  let specLine = merged.specLine;

  if (phaseOriginal || specLine) {
    index++;
  }

  if (!phaseOriginal && isJokerPhaseLine_(lines[index] || '')) {
    phaseOriginal = extractJokerPhase_(lines[index]);
    index++;
  }

  if (!specLine && lines[index]) {
    specLine = lines[index];
    index++;
  }

  const metaLines = [];
  let dealDate = '';
  for (; index < lines.length; index++) {
    const line = lines[index] || '';
    if (!dealDate && isJokerFullDate_(line)) {
      dealDate = line;
      index++;
      break;
    }
    metaLines.push(line);
  }

  return {
    phaseOriginal: phaseOriginal,
    specLine: specLine,
    metaLines: metaLines,
    dealDate: dealDate,
    tailLines: lines.slice(index)
  };
}

function splitJokerPhaseAndSpecLine_(line) {
  const value = cleanJokerLine_(line);
  for (let i = 0; i < JOKER_PHASES_.length; i++) {
    const phase = JOKER_PHASES_[i];
    if (value === phase) {
      return { phaseOriginal: phase, specLine: '' };
    }
    if (value.indexOf(phase + ' ') === 0) {
      const remainder = value.slice(phase.length).trim();
      if (remainder && /\d[\d,]*$/.test(remainder.replace(/^01\s+/, '').split(' ').slice(-1)[0] || '') === false) {
        return { phaseOriginal: phase, specLine: remainder };
      }
      if (remainder) {
        return { phaseOriginal: phase, specLine: remainder };
      }
    }
  }
  return { phaseOriginal: '', specLine: '' };
}

function parseJokerAltIds_(lines) {
  let dealNo = '';
  let purchaseNo = '';
  let remainder = '';

  lines.forEach(function(line) {
    if (dealNo || String(line || '').indexOf('CS') < 0) {
      return;
    }
    const idsMatch = String(line || '').match(/(CS\d+)(?:\s+(CH\d+))?/);
    if (!idsMatch) return;
    dealNo = idsMatch[1] || '';
    purchaseNo = idsMatch[2] || '';
    remainder = cleanJokerLine_(String(line || '').replace(/CS\d+/, '').replace(/CH\d+/, '').trim());
  });

  return {
    dealNo: dealNo,
    purchaseNo: purchaseNo,
    remainder: remainder
  };
}

function parseJokerAltSpecLine_(line) {
  const cleaned = cleanJokerLine_(line);
  const prefixMatch = cleaned.match(/^\d{2}\s+(\d[\d,]*)\s+(.*)$/);
  const vehiclePriceTaxEx = prefixMatch ? toJokerAmount_(prefixMatch[1]) : 0;
  const rest = prefixMatch ? prefixMatch[2] : cleaned;
  const amountMatch = rest.match(/(\d[\d,]*)$/);
  const vehiclePriceTaxIn = amountMatch ? toJokerAmount_(amountMatch[1]) : 0;
  const beforePrice = amountMatch ? rest.slice(0, amountMatch.index).trim() : rest;
  const modelYearMatch = beforePrice.match(/^([RH]\s*\d{2}(?:\/\d{2})?)/);
  const modelYear = modelYearMatch ? cleanJokerLine_(modelYearMatch[1]) : '';
  const afterModelYear = modelYearMatch ? beforePrice.slice(modelYearMatch[0].length).trim() : beforePrice;
  const inspectionMatch = afterModelYear.match(/([RH]\s*\d{2}\/\d{2}\/\d{2}|[RH]\s*\d{2}\/\d{2})$/);
  const inspectionDate = inspectionMatch && isJokerFullDate_(cleanJokerLine_(inspectionMatch[1])) ? cleanJokerLine_(inspectionMatch[1]) : '';
  const beforeInspection = inspectionMatch ? afterModelYear.slice(0, inspectionMatch.index).trim() : afterModelYear;
  const transmissionMatch = beforeInspection.match(/(?:^|\s)([A-Z0-9.+-]*?(?:AT|CVT|MT|PDK)[A-Z0-9.+-]*)$/);
  const transmission = transmissionMatch ? cleanJokerLine_(transmissionMatch[1]) : '';
  const beforeTransmission = transmissionMatch ? beforeInspection.slice(0, transmissionMatch.index).trim() : beforeInspection;
  const tokens = beforeTransmission ? beforeTransmission.split(/\s+/) : [];
  let displacementIndex = -1;

  for (let i = 0; i < tokens.length; i++) {
    if (/^(\d,\d{3}|\d{3,4})$/.test(tokens[i])) {
      displacementIndex = i;
      break;
    }
  }

  const displacement = displacementIndex >= 0 ? tokens[displacementIndex] : '';
  const vehicleName = displacementIndex >= 0 ? tokens.slice(0, displacementIndex).join(' ').trim() : beforeTransmission;
  const grade = displacementIndex >= 0 ? tokens.slice(displacementIndex + 1).join(' ').trim() : '';

  return {
    modelYear: modelYear,
    vehicleName: vehicleName,
    displacement: displacement,
    grade: grade,
    transmission: transmission,
    inspectionDate: inspectionDate,
    vehiclePriceTaxEx: vehiclePriceTaxEx,
    vehiclePriceTaxIn: vehiclePriceTaxIn,
    vehicleSalesTotalTaxIn: 0
  };
}

function parseJokerAltTailLines_(lines, idsRemainder) {
  let phoneNumber = '';
  let store = '';
  let postalCode = '';
  let address = '';
  let email = '';
  const nameCandidates = [];

  if (isJokerMeaningfulName_(idsRemainder)) {
    nameCandidates.push(normalizeJokerNameCandidate_(idsRemainder));
  }

  lines.forEach(function(line) {
    let working = String(line || '').trim();
    if (!working) return;

    const emailMatch = working.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (emailMatch) {
      email = email || emailMatch[0];
      working = working.replace(emailMatch[0], '').trim();
    }

    if (isJokerAmount_(working) && toJokerAmount_(working) >= 100000) {
      return;
    }

    const phoneMatch = working.match(/(?:^|\s)(0\d{1,4}-\d{1,4}-\d{3,4})(?:\s|$)/);
    if (phoneMatch) {
      phoneNumber = phoneNumber || phoneMatch[1];
      const storeText = cleanJokerLine_(working.replace(phoneMatch[1], '').trim());
      if (looksLikeJokerStore_(storeText)) store = store || stripJokerAmountText_(storeText);
      return;
    }

    if (/^\d{3}-\d{4}$/.test(working)) {
      postalCode = postalCode || working;
      return;
    }

    const namePostalMatch = working.match(/^(.*?)(\d{3}-\d{4})$/);
    if (namePostalMatch) {
      const candidate = normalizeJokerNameCandidate_(namePostalMatch[1]);
      if (candidate) nameCandidates.push(candidate);
      postalCode = postalCode || namePostalMatch[2];
      return;
    }

    if (looksLikeJokerAddress_(working)) {
      address = address || working;
      return;
    }

    if (looksLikeJokerStore_(working)) {
      store = store || stripJokerAmountText_(working);
      return;
    }

    const candidate = normalizeJokerNameCandidate_(working);
    if (candidate) {
      nameCandidates.push(candidate);
    }
  });

  const uniqueCandidates = nameCandidates.filter(function(value, index) {
    return value && nameCandidates.indexOf(value) === index;
  });

  const customerName = pickJokerCustomerName_(uniqueCandidates);
  const customerNameShort = pickJokerCustomerShortName_(customerName, uniqueCandidates);

  return {
    customerName: customerName,
    customerNameShort: customerNameShort,
    phoneNumber: phoneNumber,
    store: store,
    postalCode: postalCode,
    address: address,
    email: email
  };
}

function stripJokerHonorific_(value) {
  return cleanJokerLine_(String(value || '').replace(/(様|御中|さま)$/g, ''));
}

function normalizeJokerNameCandidate_(value) {
  return cleanJokerLine_(stripJokerHonorific_(String(value || '').replace(/(様|御中|さま)/g, ' ')));
}

function isJokerMeaningfulName_(value) {
  const candidate = normalizeJokerNameCandidate_(value);
  if (!candidate) return false;
  if (candidate.length <= 1) return false;
  if (candidate.indexOf('CS') >= 0 || candidate.indexOf('CH') >= 0) return false;
  if (looksLikeJokerStore_(candidate)) return false;
  if (looksLikeJokerAddress_(candidate)) return false;
  if (isJokerAmount_(candidate)) return false;
  return true;
}

function pickJokerCustomerName_(candidates) {
  return candidates
    .map(normalizeJokerNameCandidate_)
    .filter(Boolean)
    .sort(function(left, right) {
      return right.length - left.length;
    })[0] || '';
}

function pickJokerCustomerShortName_(customerName, candidates) {
  const normalizedName = normalizeJokerNameCandidate_(customerName);
  const fallback = deriveJokerCustomerShortName_(normalizedName);
  for (let i = 0; i < candidates.length; i++) {
    const candidate = normalizeJokerNameCandidate_(candidates[i]);
    if (!candidate || candidate === normalizedName) continue;
    if (candidate.length <= normalizedName.length && !looksLikeJokerAddress_(candidate) && candidate.indexOf('代表取締役') < 0 && candidate.indexOf('理事長') < 0 && candidate.indexOf('代表社員') < 0) {
      return candidate;
    }
  }
  return fallback || normalizedName;
}

function deriveJokerCustomerShortName_(value) {
  const normalized = normalizeJokerNameCandidate_(value);
  if (!normalized) return '';
  const corporate = normalized.replace(/\s*(代表取締役|代表社員|理事長|院長|社長|会長).*/, '').trim();
  return corporate || normalized;
}

function normalizeJokerProgress_(phase) {
  return phase === '売却決定' ? '登録決定' : phase;
}

function isJokerPhaseLine_(value) {
  return JOKER_PHASES_.indexOf(extractJokerPhase_(value)) >= 0;
}

function extractJokerPhase_(value) {
  const line = cleanJokerLine_(value);
  for (let i = 0; i < JOKER_PHASES_.length; i++) {
    if (line === JOKER_PHASES_[i] || line.indexOf(JOKER_PHASES_[i] + ' ') === 0) {
      return JOKER_PHASES_[i];
    }
  }
  return '';
}

function looksLikeJokerAddress_(line) {
  const value = cleanJokerLine_(line);
  if (!value) return false;
  if (/^(北海道|東京都|京都府|大阪府|.{2,3}県)/.test(value)) return true;
  return /[都道府県].*[市区町村郡]/.test(value);
}

function stripJokerAmountText_(value) {
  return cleanJokerLine_(String(value || '').replace(/\d[\d,]*$/, ''));
}

function findJokerLargeAmountInLines_(lines) {
  for (let i = 0; i < lines.length; i++) {
    const amount = extractJokerLargeAmount_(lines[i]);
    if (amount >= 100000) {
      return amount;
    }
  }
  return 0;
}

function extractJokerLargeAmount_(value) {
  const matches = String(value || '').match(/\d[\d,]*/g) || [];
  for (let i = matches.length - 1; i >= 0; i--) {
    const amount = toJokerAmount_(matches[i]);
    if (amount >= 100000) {
      return amount;
    }
  }
  return 0;
}

function parseJokerSpecLines_(lines) {
  const amountIndexes = [];
  lines.forEach(function(line, index) {
    if (isJokerAmount_(line) && toJokerAmount_(line) >= 100000) {
      amountIndexes.push(index);
    }
  });

  if (amountIndexes.length < 2) {
    throw new Error('JOKER金額列を2つ検出できません。');
  }

  const amount1Index = amountIndexes[0];
  const amount2Index = amountIndexes[1];
  const detailLines = lines.slice(0, amount1Index);
  let inspectionDate = '';
  let transmission = '';
  let modelYear = '';
  let vehicleName = '';
  let bodyType = '';
  let displacement = '';
  let grade = '';

  if (detailLines.length && isJokerFullDate_(detailLines[detailLines.length - 1])) {
    inspectionDate = detailLines.pop();
  }

  if (detailLines.length && /(AT|CVT|MT|PDK)/.test(detailLines[detailLines.length - 1])) {
    transmission = detailLines.pop();
  }

  if (detailLines.length && isJokerYearMonth_(detailLines[0])) {
    modelYear = detailLines.shift();
  }

  vehicleName = detailLines.length ? detailLines.shift() : '';

  if (detailLines.length && !/\d/.test(detailLines[0]) && detailLines.length >= 2) {
    bodyType = detailLines.shift();
  }

  if (detailLines.length && /\d/.test(detailLines[0])) {
    displacement = detailLines.shift();
  }

  grade = detailLines.join(' ');

  return {
    modelYear: modelYear,
    vehicleName: vehicleName,
    bodyType: bodyType,
    displacement: displacement,
    grade: grade,
    transmission: transmission,
    inspectionDate: inspectionDate,
    vehiclePriceTaxIn: toJokerAmount_(lines[amount1Index]),
    vehicleSalesTotalTaxIn: toJokerAmount_(lines[amount2Index]),
    tailStart: amount2Index + 1
  };
}

function parseJokerTailLines_(lines) {
  let phoneNumber = '';
  let postalCode = '';
  let email = '';
  let storeLines = [];
  let phaseOriginal = '';
  let vehiclePriceTaxEx = 0;
  let phaseIndex = -1;

  lines.forEach(function(line, index) {
    if (!phoneNumber && /^\d{2,4}-\d{2,4}-\d{3,4}$/.test(line)) {
      phoneNumber = line;
    }
    if (!postalCode && /^\d{3}-\d{4}$/.test(line)) {
      postalCode = line;
    }
    if (!email && line.indexOf('@') >= 0) {
      email = line;
    }
    if (looksLikeJokerStore_(line)) {
      storeLines.push(line);
    }
    if (!phaseOriginal && JOKER_PHASES_.indexOf(line) >= 0) {
      phaseOriginal = line;
      phaseIndex = index;
    }
    if (!phaseOriginal) {
      const phaseMatch = line.match(/^(売却決定|受注|見積提示|ヒアリング・検討|登録見込|登録決定|敗戦|延期)\s+\d{2}\s+(\d[\d,]*)$/);
      if (phaseMatch) {
        phaseOriginal = phaseMatch[1];
        vehiclePriceTaxEx = toJokerAmount_(phaseMatch[2]);
        phaseIndex = index;
      }
    }
  });

  if (!vehiclePriceTaxEx) {
    lines.some(function(line) {
      const seqMatch = line.match(/^\d{2}\s+(\d[\d,]*)$/);
      if (seqMatch) {
        vehiclePriceTaxEx = toJokerAmount_(seqMatch[1]);
        return true;
      }
      return false;
    });
  }

  const address = lines.find(function(line) {
    return /[都道府県市区町村]/.test(line) &&
      !/^\d{3}-\d{4}$/.test(line) &&
      !/^\d{2,4}-\d{2,4}-\d{3,4}$/.test(line);
  }) || '';

  const filtered = lines.filter(function(line) {
    return line &&
      line !== address &&
      line !== phoneNumber &&
      line !== postalCode &&
      line !== email &&
      !looksLikeJokerStore_(line) &&
      JOKER_PHASES_.indexOf(line) < 0 &&
      !/^(売却決定|受注|見積提示|ヒアリング・検討|登録見込|登録決定|敗戦|延期)\s+\d{2}\s+(\d[\d,]*)$/.test(line) &&
      !/^\d{2}\s+\d[\d,]*$/.test(line) &&
      !isJokerAmount_(line);
  });

  let customerName = '';
  if (phaseIndex >= 0 && phaseIndex + 1 < lines.length) {
    customerName = lines[phaseIndex + 1];
  } else if (filtered.length) {
    customerName = filtered[filtered.length - 1];
  }

  let customerNameShort = '';
  if (phaseIndex > 0) {
    for (let i = phaseIndex - 1; i >= 0; i--) {
      const line = lines[i];
      if (filtered.indexOf(line) >= 0) {
        customerNameShort = line;
        break;
      }
    }
  }
  if (!customerNameShort && filtered.length) {
    customerNameShort = filtered[0];
  }

  return {
    progress: phaseOriginal === '売却決定' ? '登録決定' : phaseOriginal,
    phaseOriginal: phaseOriginal,
    address: address,
    postalCode: postalCode,
    phoneNumber: phoneNumber,
    store: storeLines.join(' / '),
    email: email,
    vehiclePriceTaxEx: vehiclePriceTaxEx,
    customerName: customerName || customerNameShort,
    customerNameShort: customerNameShort || customerName
  };
}

function writeJokerVehicleSalesSheets_(records, validationRows, importedAt) {
  const ss = SpreadsheetApp.openById(JOKER_VEHICLE_SALES.spreadsheetId);
  const importSheet = getOrCreateJokerSheet_(ss, JOKER_VEHICLE_SALES.importSheetName, JOKER_IMPORT_HEADERS);
  const transferSheet = getOrCreateJokerSheet_(ss, JOKER_VEHICLE_SALES.transferSheetName, JOKER_TRANSFER_HEADERS);
  const salesSheet = getOrCreateJokerSheet_(ss, JOKER_VEHICLE_SALES.salesListSheetName, JOKER_SALES_HEADERS);
  const validationSheet = getOrCreateJokerSheet_(ss, JOKER_VEHICLE_SALES.validationSheetName, JOKER_VALIDATION_HEADERS);

  if (records.length) {
    clearJokerSheetBody_(importSheet, JOKER_IMPORT_HEADERS.length);
    clearJokerSheetBody_(transferSheet, JOKER_TRANSFER_HEADERS.length);

    const importRows = records.map(function(record) {
      return JOKER_IMPORT_HEADERS.map(function(header) { return record[header] || ''; });
    });
    importSheet.getRange(2, 1, importRows.length, JOKER_IMPORT_HEADERS.length).setValues(importRows);

    const transferRows = records.map(function(record) {
      return [
        record.progress || '',
        record.customer_name || '',
        record.vehicle_sales_total_tax_in || '',
        convertJokerWarekiDate_(record.deal_date),
        record.phase_original === '受注' ? convertJokerWarekiDate_(record.deal_date) : '',
        record.progress === '登録決定' ? convertJokerWarekiDate_(record.deal_date) : '',
        record.address || '',
        record.phone_number || '',
        record.store || '',
        [record.vehicle_name, record.grade].filter(Boolean).join(' '),
        record.model_year || '',
        record.deal_no || '',
        record.purchase_no || '',
        record.email || ''
      ];
    });
    transferSheet.getRange(2, 1, transferRows.length, JOKER_TRANSFER_HEADERS.length).setValues(transferRows);

    writeJokerSalesListSheet_(salesSheet, records, importedAt);
  }

  if (validationRows.length) {
    const startRow = Math.max(validationSheet.getLastRow() + 1, 2);
    validationSheet.getRange(startRow, 1, validationRows.length, JOKER_VALIDATION_HEADERS.length).setValues(validationRows);
  }
}

function writeJokerSalesListSheet_(sheet, records, importedAt) {
  const mergedByKey = {};

  records.forEach(function(record) {
    const key = buildJokerSalesKey_(record);
    if (!key) return;
    mergedByKey[key] = mergeJokerSalesRow_(record, mergedByKey[key], importedAt, key);
  });

  const mergedRows = Object.keys(mergedByKey)
    .map(function(key) { return mergedByKey[key]; })
    .sort(compareJokerSalesRows_)
    .map(function(rowObject) {
      return JOKER_SALES_HEADERS.map(function(header) {
        return rowObject[header] !== undefined ? rowObject[header] : '';
      });
    });

  clearJokerSheetBody_(sheet, JOKER_SALES_HEADERS.length);
  if (mergedRows.length) {
    sheet.getRange(2, 1, mergedRows.length, JOKER_SALES_HEADERS.length).setValues(mergedRows);
  }

  formatJokerSalesListSheet_(sheet);
}

function mergeJokerSalesRow_(record, existingRow, importedAt, key) {
  return {
    '進捗': record.progress || '',
    '顧客名': record.customer_name || '',
    'U/N': record.u_n || '',
    '商談日': convertJokerWarekiDate_(record.deal_date),
    '商談No': record.deal_no || '',
    '仕入No': record.purchase_no || '',
    '年式': record.model_year || '',
    '車名': record.vehicle_name || '',
    '形状': record.body_type || '',
    '排気量': record.displacement || '',
    'グレード': record.grade || '',
    'ミッション': record.transmission || '',
    '車検': convertJokerWarekiDate_(record.inspection_date),
    '車価（税込）': firstNonEmpty_(record.vehicle_price_tax_in, ''),
    '車両販売総額（税込）': firstNonEmpty_(record.vehicle_sales_total_tax_in, ''),
    '車両販売総額（税抜）': firstNonEmpty_(record.vehicle_price_tax_ex, ''),
    '郵便番号': record.postal_code || '',
    '住所': record.address || '',
    'TEL': record.phone_number || '',
    '店舗': record.store || '',
    'メール': record.email || '',
    '案件キー': key,
    '最終取込日時': importedAt
  };
}

function formatJokerSalesListSheet_(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, JOKER_SALES_HEADERS.length);
  headerRange
    .setValues([JOKER_SALES_HEADERS])
    .setBackground('#26c6da')
    .setFontColor('#000000')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sheet.setFrozenRows(1);
  [
    90, 240, 55, 95, 110, 110,
    85, 160, 85, 75, 160, 95, 95,
    110, 130, 130,
    90, 240, 110, 110, 220, 10, 135
  ].forEach(function(width, index) {
    sheet.setColumnWidth(index + 1, width);
  });

  JOKER_SALES_HIDDEN_COLUMNS.forEach(function(column) {
    sheet.hideColumns(column);
  });

  const lastRow = Math.max(sheet.getLastRow(), 2);
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, JOKER_SALES_VISIBLE_COLUMNS)
      .setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(2, 10, lastRow - 1, 1).setNumberFormat('#,##0');
    sheet.getRange(2, 14, lastRow - 1, 3).setNumberFormat('#,##0');
    sheet.getRange(2, 4, lastRow - 1, 1).setNumberFormat('yyyy/MM/dd');
    sheet.getRange(2, 13, lastRow - 1, 1).setNumberFormat('yyyy/MM/dd');
  }

  const progressRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(JOKER_PHASES_, true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, 1, Math.max(lastRow - 1, 1), 1).setDataValidation(progressRule);

  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }
  sheet.getRange(1, 1, lastRow, JOKER_SALES_VISIBLE_COLUMNS).createFilter();

  const progressRange = sheet.getRange(2, 1, Math.max(lastRow - 1, 1), 1);
  const rules = [
    ['登録決定', '#ff6b6b'],
    ['受注', '#fff59d'],
    ['見積提示', '#80deea'],
    ['ヒアリング・検討', '#e0e0e0'],
    ['登録見込', '#ffd166'],
    ['延期', '#f6f08b'],
    ['敗戦', '#bdbdbd']
  ].map(function(entry) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(entry[0])
      .setBackground(entry[1])
      .setRanges([progressRange])
      .build();
  });
  sheet.setConditionalFormatRules(rules);
}

function buildJokerSalesKey_(record) {
  return record.deal_no ||
    record.purchase_no ||
    [record.customer_name, record.vehicle_name, record.deal_date].filter(Boolean).join('|');
}

function compareJokerSalesRows_(left, right) {
  const leftRank = rankJokerProgress_(left['進捗']);
  const rightRank = rankJokerProgress_(right['進捗']);
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  const leftTime = extractComparableTime_(left['商談日']) || extractComparableTime_(left['車検']);
  const rightTime = extractComparableTime_(right['商談日']) || extractComparableTime_(right['車検']);
  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return String(left['顧客名'] || '').localeCompare(String(right['顧客名'] || ''), 'ja');
}

function rankJokerProgress_(progress) {
  const index = JOKER_SALES_PROGRESS_ORDER.indexOf(progress || '');
  return index >= 0 ? index : 999;
}

function extractComparableTime_(value) {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (!value) {
    return 0;
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function objectFromHeaders_(headers, row) {
  const result = {};
  headers.forEach(function(header, index) {
    result[header] = row[index];
  });
  return result;
}

function firstNonEmpty_() {
  for (let i = 0; i < arguments.length; i++) {
    const value = arguments[i];
    if (value !== '' && value !== null && value !== undefined) {
      return value;
    }
  }
  return '';
}

function buildJokerValidationRow_(importedAt, fileName, records, status, note) {
  const counts = { '登録決定': 0, '受注': 0, '見積提示': 0, other: 0 };
  const missing = [];

  records.forEach(function(record) {
    if (!record.phase_original) {
      missing.push(record.row_no);
    }
    if (record.progress === '登録決定') counts['登録決定'] += 1;
    else if (record.progress === '受注') counts['受注'] += 1;
    else if (record.progress === '見積提示') counts['見積提示'] += 1;
    else counts.other += 1;
  });

  return [
    importedAt,
    fileName,
    status,
    records.length,
    counts['登録決定'],
    counts['受注'],
    counts['見積提示'],
    counts.other,
    missing.join(','),
    note
  ];
}

function buildJokerValidationErrorRow_(importedAt, fileName, message) {
  return [
    importedAt,
    fileName,
    '失敗',
    0,
    0,
    0,
    0,
    0,
    '',
    String(message || '')
  ];
}

function extractJokerPdfTextWithDriveOcr_(file) {
  if (typeof Drive === 'undefined' || !Drive.Files || !Drive.Files.copy) {
    throw new Error('Drive拡張サービスが有効ではありません。');
  }

  let docFile = null;
  try {
    docFile = Drive.Files.copy({
      title: 'tmp_joker_ocr_' + file.getId() + '_' + Date.now(),
      mimeType: MimeType.GOOGLE_DOCS
    }, file.getId(), {
      ocr: true,
      ocrLanguage: 'ja'
    });

    Utilities.sleep(3000);
    return DocumentApp.openById(docFile.id).getBody().getText();
  } finally {
    if (docFile && docFile.id) {
      DriveApp.getFileById(docFile.id).setTrashed(true);
    }
  }
}

function validateJokerVehicleSalesConfig_() {
  DriveApp.getFolderById(JOKER_VEHICLE_SALES.sourceFolderId);
  SpreadsheetApp.openById(JOKER_VEHICLE_SALES.spreadsheetId);
}

function collectPdfFiles_(folder) {
  const files = [];
  const iterator = folder.getFiles();
  while (iterator.hasNext()) {
    const file = iterator.next();
    if (file.getMimeType() === MimeType.PDF) {
      files.push(file);
    }
  }
  return files;
}

function findChildFolderByName_(folder, name) {
  const iterator = folder.getFoldersByName(name);
  return iterator.hasNext() ? iterator.next() : null;
}

function getOrCreateJokerSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#2f5f8f').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function clearJokerSheetBody_(sheet, width) {
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, width).clearContent();
  }
}

function cleanJokerLine_(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isJokerRecordStart_(line, nextLine) {
  return /^\d+$/.test(line || '') && isJokerFullDate_(nextLine || '');
}

function isJokerAltRecordStart_(line, nextLine, thirdLine, fourthLine) {
  return /^\d+$/.test(line || '') &&
    ['U', 'N'].indexOf(String(nextLine || '').trim()) >= 0 &&
    !!String(thirdLine || '').trim() &&
    !!String(fourthLine || '').trim();
}

function isJokerFullDate_(value) {
  return /^[RH]\s*\d{2}\/\d{2}\/\d{2}$/.test(String(value || '').trim());
}

function isJokerYearMonth_(value) {
  return /^[RH]\s*\d{2}(?:\/\d{2})?$/.test(String(value || '').trim());
}

function isJokerAmount_(value) {
  return /^\d[\d,]*$/.test(String(value || '').trim());
}

function toJokerAmount_(value) {
  return Number(String(value || '').replace(/,/g, ''));
}

function looksLikeJokerStore_(line) {
  const value = String(line || '');
  return value.indexOf('㈱ﾌﾞﾘｯｼﾞ本社') >= 0 ||
    value.indexOf('J・L') >= 0 ||
    value.indexOf('小売') >= 0 ||
    value.indexOf('輸入車') >= 0 ||
    value.indexOf('国産車') >= 0;
}

function convertJokerWarekiDate_(value) {
  const match = String(value || '').match(/^([RH])\s*(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!match) return '';
  const year = match[1] === 'R' ? 2018 + Number(match[2]) : 1988 + Number(match[2]);
  return new Date(year, Number(match[3]) - 1, Number(match[4]));
}

function findLastIndex_(items, predicate) {
  for (let i = items.length - 1; i >= 0; i--) {
    if (predicate(items[i], i)) {
      return i;
    }
  }
  return -1;
}

const JOKER_PHASES_ = ['売却決定', '受注', '見積提示', 'ヒアリング・検討', '登録見込', '登録決定', '敗戦', '延期'];
