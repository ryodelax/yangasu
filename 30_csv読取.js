/** ================================
 * 銀行CSV取込
 * ================================ */

function runImportBankCsv() {
    ensureBankLedgerSupportSheets_();
    const summary = importBankCsvToSheet();
    finalizeBankLedgerUpdate_();
    return summary;
}

function importBankCsvToSheet() {

    const SHEET_NAME = '銀行データチェック用';

    const FOLDER_ID = {
        INPUT: '1RkJM7UOdQbhMh3IjjMX0Ner4_F4SGg54',
        SUCCESS: '1mC5iTSXSeNyZQuXX75Jp8Xe6Bv8WN5_D',
        FAILURE: '1q6qrZBLIaB6H6ZE5EhsbvP27gowIKvZn'
    };

    const BANK_CSV_HEADERS = {
        DATE: '日付',
        AMOUNT: '金額',
        PARTNER_SUMMARY: '相手摘要',
        COUNTER_ACCOUNT: '相手科目',
        STATUS: 'ステータス',
        DEPOSIT_MONTH: '入金月'
    };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const summaryReplaceRules = getBankImportSummaryReplacementRules_(ss);

    if (!sheet) {
        throw new Error(`シート '${SHEET_NAME}' が見つかりません。`);
    }

    ensureBankLedgerHeaders_(sheet);
    const headerMap = getSheetHeaderMap_(sheet);
    validateRequiredHeaders_(headerMap, [
        BANK_CSV_HEADERS.DATE,
        BANK_CSV_HEADERS.AMOUNT,
        BANK_CSV_HEADERS.PARTNER_SUMMARY,
        BANK_CSV_HEADERS.COUNTER_ACCOUNT,
        BANK_CSV_HEADERS.STATUS,
        BANK_CSV_HEADERS.DEPOSIT_MONTH
    ]);

    const existingKeys = loadExistingBankRecordKeys_(sheet, headerMap, BANK_CSV_HEADERS);

    const inputFolder = DriveApp.getFolderById(FOLDER_ID.INPUT);
    const successFolder = DriveApp.getFolderById(FOLDER_ID.SUCCESS);
    const failureFolder = DriveApp.getFolderById(FOLDER_ID.FAILURE);

    const files = inputFolder.getFiles();
    const summary = {
        scannedFiles: 0,
        successFiles: 0,
        failedFiles: 0,
        addedRecords: 0,
        duplicateFiles: 0,
        failureNames: []
    };

    while (files.hasNext()) {

        const file = files.next();

        if (!/\.csv$/i.test(file.getName())) {
            continue;
        }

        summary.scannedFiles += 1;

        const fileUrl = file.getUrl();
        const importedAt = new Date();
        const processId = createImportProcessId_(file, importedAt);

        try {

            Logger.log(`CSV読込開始: ${file.getName()}`);

            const csvRows = readCsvFileWithFallbackEncodings_(file, ['Shift-JIS', 'UTF-8', 'CP932']);

            if (!csvRows || csvRows.length === 0) {
                throw new Error('CSVが空です');
            }

            const csvHeaderMap = getCsvHeaderMap_(csvRows[0]);
            const unsupportedReason = detectUnsupportedBankCsvReason_(csvHeaderMap);
            if (unsupportedReason) {
                throw new Error(unsupportedReason);
            }

            const buildResult = buildImportRecords_(
                csvRows,
                csvHeaderMap,
                BANK_CSV_HEADERS,
                existingKeys,
                summaryReplaceRules
            );

            Logger.log('CSV抽出JSON: ' + JSON.stringify(buildResult.records, null, 2));

            const failureReasons = detectBankImportFailureReasons_(buildResult);
            if (failureReasons.length > 0) {
                appendBankLearningRowsFromMojibake_(
                    buildResult.records,
                    {
                        fileName: file.getName(),
                        fileUrl: fileUrl,
                        targetSheetName: SHEET_NAME
                    }
                );
                throw new Error(failureReasons.join(' / '));
            }

            const startRow = sheet.getLastRow() + 1;
            const recordsWithMeta = attachBankImportMeta_(buildResult.records, {
                processId: processId,
                fileName: file.getName(),
                importedAt: importedAt
            });

            appendRecordsToSheet_(sheet, headerMap, recordsWithMeta);
            applyMojibakeNotes_(sheet, startRow, recordsWithMeta, headerMap);

            moveFileToFolderSafely_(file, successFolder);
            appendImportHistoryRow_({
                processId: processId,
                importedAt: importedAt,
                file: file,
                targetRowCount: buildResult.detectedEntryCount,
                successRowCount: recordsWithMeta.length,
                skipRowCount: buildResult.skippedDuplicateCount,
                failedRowCount: 0,
                result: '成功',
                failureReason: '',
                destination: successFolder.getName(),
                rerunStatus: ''
            });

            summary.successFiles += 1;
            summary.addedRecords += recordsWithMeta.length;
            if (buildResult.skippedDuplicateCount > 0) {
                summary.duplicateFiles += 1;
            }
            Logger.log(`CSV取込成功: ${file.getName()} / 追加件数: ${recordsWithMeta.length} / 重複スキップ: ${buildResult.skippedDuplicateCount}`);
        } catch (e) {
            const logMessage = e.message || '不明なエラー';

            Logger.log(`CSV取込失敗: ${file.getName()} / ${logMessage}`);
            moveFileToFolderSafely_(file, failureFolder);
            appendImportHistoryRow_({
                processId: processId,
                importedAt: importedAt,
                file: file,
                targetRowCount: '',
                successRowCount: 0,
                skipRowCount: '',
                failedRowCount: '',
                result: '失敗',
                failureReason: logMessage,
                destination: failureFolder.getName(),
                rerunStatus: '再実行待ち'
            });
            summary.failedFiles += 1;
            summary.failureNames.push(file.getName());

        }
    }

    return summary;
}


/**
 * CSVデータを取り込み用JSON配列へ変換
 * - 借方金額は入金として正の金額で取り込む
 * - 貸方金額は出金として負の金額で取り込む
 * - 日付/金額/相手摘要 が既存と一致するものは除外
 * - 「�」を含むセルを記録
 */
function buildImportRecords_(csvRows, csvHeaderMap, headers, existingKeys, summaryReplaceRules) {

    const dataRows = csvRows.slice(1);
    const records = [];
    let skippedDuplicateCount = 0;
    let detectedEntryCount = 0;

    dataRows.forEach(function (row, index) {
        const dateText = getCsvValue_(row, csvHeaderMap, '日付');
        if (!parseDate_(dateText)) {
            return;
        }
        const partnerSummary = applyBankImportSummaryCorrections_(getCsvValue_(row, csvHeaderMap, '相手摘要'), summaryReplaceRules);
        const counterAccount = getCsvValue_(row, csvHeaderMap, '相手科目');
        const selfSummary = applyBankImportSummaryCorrections_(getCsvValue_(row, csvHeaderMap, '自摘要'), summaryReplaceRules);
        const debitAmount = parseNumber_(getCsvValue_(row, csvHeaderMap, '借方金額'));
        const creditAmount = parseNumber_(getCsvValue_(row, csvHeaderMap, '貸方金額'));

        [
            { amount: debitAmount, voucherType: '入金', signedAmount: debitAmount },
            { amount: creditAmount, voucherType: '出金', signedAmount: creditAmount ? creditAmount * -1 : 0 }
        ].forEach(function (entry) {
            if (!entry.amount) {
                return;
            }
            detectedEntryCount += 1;

            const duplicateKey = buildBankDuplicateKey_(dateText, entry.signedAmount, pickBankProcessingSummary_(selfSummary, partnerSummary));
            if (existingKeys[duplicateKey]) {
                skippedDuplicateCount += 1;
                return;
            }

            existingKeys[duplicateKey] = true;

            const record = {
                source_row_no: index + 2,
                [headers.DATE]: dateText,
                [headers.AMOUNT]: entry.signedAmount,
                [headers.PARTNER_SUMMARY]: partnerSummary,
                [headers.COUNTER_ACCOUNT]: counterAccount,
                [headers.STATUS]: '未照合',
                [headers.DEPOSIT_MONTH]: toDepositMonth_(dateText),
                '取引先': selfSummary || partnerSummary,
                '自摘要': selfSummary,
                '伝票種': entry.voucherType,
                '借方金額': debitAmount || '',
                '貸方金額': creditAmount || '',
                '表示摘要': pickBankProcessingSummary_(selfSummary, partnerSummary)
            };

            record._meta = {
                source_row_no: index + 2,
                mojibake_cells: collectMojibakeCells_(record)
            };

            records.push(record);
        });
    });

    return {
        records: records,
        skippedDuplicateCount: skippedDuplicateCount,
        detectedEntryCount: detectedEntryCount
    };
}


/** ================================
 * 整備CSV取込
 * ================================ */

function runImportSeibiCsvLegacy_() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const startedAt = Date.now();

    ss.toast('整備CSV取込を開始しました。CSVを確認中です...', '整備CSV取込', 30);

    try {
        const summary = importSeibiCsvToSalesSheetLegacy_();

        if (summary.successFiles > 0 || summary.addedRecords > 0) {
            ss.toast('取込後の補正・重複削除・並び替えを実行中です...', '整備CSV取込', 30);
            replaceDataFromLearningSheet_('振込入金リスト一覧');
            removeDuplicateRowsByHeaders_('AI読み取り学習用', ['該当シート', '読取データ']);
            sortSheetByHeader_("振込入金リスト一覧", "日付");
        }

        const durationSec = Math.round((Date.now() - startedAt) / 1000);
        const message = buildSeibiImportSummaryMessage_(summary, durationSec);

        Logger.log(message.replace(/\n/g, ' / '));
        ss.toast('整備CSV取込が完了しました。', '整備CSV取込', 8);
        SpreadsheetApp.getUi().alert(message);
        return summary;
    } catch (e) {
        const message = '整備CSV取込でエラーが発生しました。\n' + (e.message || e);
        Logger.log(message);
        ss.toast('整備CSV取込でエラーが発生しました。', '整備CSV取込', 10);
        SpreadsheetApp.getUi().alert(message);
        throw e;
    }
}

function importSeibiCsvToSalesSheetLegacy_() {
    const SHEET_NAME = '振込入金リスト一覧';

    const FOLDER_ID = {
        INPUT: '1xrzKqT3NMPmBdEesVZ2XYElcuNJt7JW8',
        SUCCESS: '1u_y1NXy0SlDiTbhsKCsVxmpVVz4raMYL',
        FAILURE: '1Awoq9LnIpA71hcmnt9P9CCIDA_XYdX1U'
    };

    const ENCODING = 'Shift-JIS';
    const KEY_HEADER = '業務№';
    const STATUS_HEADER = 'ステータス';

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
        throw new Error(`シート '${SHEET_NAME}' が見つかりません。`);
    }

    const headerMap = getSheetHeaderMap_(sheet);
    if (!headerMap[KEY_HEADER]) {
        throw new Error(`シートにキー項目 '${KEY_HEADER}' がありません。`);
    }

    const existingBusinessNos = loadExistingUniqueValues_(sheet, headerMap[KEY_HEADER]);

    const learningMap = loadLearningReplacementMap_(SHEET_NAME);
    const inputFolder = DriveApp.getFolderById(FOLDER_ID.INPUT);
    const successFolder = DriveApp.getFolderById(FOLDER_ID.SUCCESS);
    const failureFolder = DriveApp.getFolderById(FOLDER_ID.FAILURE);

    const files = listCsvFilesInFolder_(inputFolder);
    const summary = {
        scannedFiles: files.length,
        successFiles: 0,
        failedFiles: 0,
        addedRecords: 0,
        skippedDuplicateCount: 0,
        emptyRecordFiles: 0,
        failureNames: []
    };

    if (!files.length) {
        Logger.log('Seibi CSV対象ファイルはありませんでした。');
        return summary;
    }

    files.forEach(function (file, index) {
        ss.toast(`整備CSV取込中 ${index + 1}/${files.length}: ${file.getName()}`, '整備CSV取込', 15);

        try {
            Logger.log(`Seibi CSV読込開始: ${file.getName()}`);

            const csvRows = readCsvFile_(file, ENCODING);
            if (!csvRows || csvRows.length === 0) {
                throw new Error('CSVが空です');
            }

            const normalizedCsvRows = normalizeCsvHeaderRow_(csvRows);
            const csvHeaderMap = getCsvHeaderMap_(normalizedCsvRows[0]);

            const buildResult = buildSeibiImportRecords_(
                normalizedCsvRows,
                csvHeaderMap,
                file.getName(),
                headerMap,
                existingBusinessNos,
                learningMap,
                STATUS_HEADER
            );

            logImportRecordPreview_('Seibi CSV変換結果', file.getName(), buildResult.records);

            if (buildResult.records.length > 0) {
                const startRow = sheet.getLastRow() + 1;
                appendRecordsToSheet_(sheet, headerMap, buildResult.records);
                applyMojibakeNotes_(sheet, startRow, buildResult.records, headerMap);
                appendBankLearningRowsFromMojibake_(
                    buildResult.records,
                    {
                        fileName: file.getName(),
                        fileUrl: file.getUrl(),
                        targetSheetName: SHEET_NAME
                    }
                );
            } else {
                summary.emptyRecordFiles += 1;
            }

            moveFileToFolderSafely_(file, successFolder);

            summary.successFiles += 1;
            summary.addedRecords += buildResult.records.length;
            summary.skippedDuplicateCount += buildResult.skippedDuplicateCount;
            Logger.log(`Seibi CSV取込成功: ${file.getName()} / 追加 ${buildResult.records.length}件 / 重複スキップ ${buildResult.skippedDuplicateCount}件`);
        } catch (e) {
            Logger.log(`Seibi CSV取込失敗: ${file.getName()} / ${e.message || '不明なエラー'}`);
            summary.failedFiles += 1;
            summary.failureNames.push(file.getName());
            moveFileToFolderSafely_(file, failureFolder);
        }

    });

    return summary;
}


/** ================================
 * 車販CSV取込
 * ================================ */
function runImportShahanCsv() {
    importShahanCsvToSalesSheet();
    replaceDataFromLearningSheet_('振込入金リスト一覧');
    removeDuplicateRowsByHeaders_('AI読み取り学習用', ['該当シート', '読取データ']);
    sortSheetByHeader_("振込入金リスト一覧", "日付");

}

function importShahanCsvToSalesSheet() {
    const SHEET_NAME = '振込入金リスト一覧';

    const FOLDER_ID = {
        INPUT: '1TVchY_k6L9Adzc0Au5S0MnuHmiJbFFGL',
        SUCCESS: '1IPnEzZS5vgFXrHrkFoqMdpU_RpvybSf4',
        FAILURE: '1OgDgCK2OoWGb64k-o27y88KZOMqeNe8s'
    };

    const ENCODING = 'Shift-JIS';
    const KEY_HEADER = '業務№';
    const STATUS_HEADER = 'ステータス';

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
        throw new Error(`シート '${SHEET_NAME}' が見つかりません。`);
    }

    const headerMap = getSheetHeaderMap_(sheet);
    if (!headerMap[KEY_HEADER]) {
        throw new Error(`シートにキー項目 '${KEY_HEADER}' がありません。`);
    }

    const existingBusinessNos = loadExistingUniqueValues_(sheet, headerMap[KEY_HEADER]);

    const learningMap = loadLearningReplacementMap_(SHEET_NAME);
    const inputFolder = DriveApp.getFolderById(FOLDER_ID.INPUT);
    const successFolder = DriveApp.getFolderById(FOLDER_ID.SUCCESS);
    const failureFolder = DriveApp.getFolderById(FOLDER_ID.FAILURE);

    const files = inputFolder.getFiles();

    while (files.hasNext()) {
        const file = files.next();

        if (!/\.csv$/i.test(file.getName())) {
            continue;
        }

        try {
            Logger.log(`Shahan CSV読込開始: ${file.getName()}`);

            const csvRows = readCsvFile_(file, ENCODING);
            if (!csvRows || csvRows.length === 0) {
                throw new Error('CSVが空です');
            }

            const normalizedCsvRows = normalizeCsvHeaderRow_(csvRows);
            const csvHeaderMap = getCsvHeaderMap_(normalizedCsvRows[0]);

            const buildResult = buildShahanImportRecords_(
                normalizedCsvRows,
                csvHeaderMap,
                file.getName(),
                headerMap,
                existingBusinessNos,
                learningMap,
                STATUS_HEADER
            );

            Logger.log('変換JSON: ' + JSON.stringify(buildResult.records, null, 2));

            if (buildResult.records.length > 0) {
                const startRow = sheet.getLastRow() + 1;
                appendRecordsToSheet_(sheet, headerMap, buildResult.records);
                applyMojibakeNotes_(sheet, startRow, buildResult.records, headerMap);
                appendBankLearningRowsFromMojibake_(
                    buildResult.records,
                    {
                        fileName: file.getName(),
                        fileUrl: file.getUrl(),
                        targetSheetName: SHEET_NAME
                    }
                );
            }

            file.moveTo(successFolder);

            Logger.log(`Shahan CSV取込成功: ${file.getName()} / 追加 ${buildResult.records.length}件 / 重複スキップ ${buildResult.skippedDuplicateCount}件`);
        } catch (e) {
            Logger.log(`Shahan CSV取込失敗: ${file.getName()} / ${e.message || '不明なエラー'}`);
            file.moveTo(failureFolder);
        }
    }
}


/**
 * Seibi CSVをJSONへ変換する
 * - 固定置換
 * - 学習シート置換
 * - 業務№重複除外
 * - ステータスを未照合で設定
 * - 変換後も「�」が残るセルを記録
 */
function buildSeibiImportRecords_(csvRows, csvHeaderMap, fileName, sheetHeaderMap, existingBusinessNos, learningMap, statusHeaderName) {
    const dataRows = csvRows.slice(1);
    const importedAt = new Date();
    const records = [];
    let skippedDuplicateCount = 0;

    dataRows.forEach(function (row, index) {
        const sourceRowNo = index + 2;
        const rawRecord = buildRecordFromCsvRow_(row, csvHeaderMap);

        rawRecord['データ取り込み日'] = rawRecord['データ取り込み日'] || importedAt;
        rawRecord['OCR元ファイル名'] = rawRecord['OCR元ファイル名'] || fileName;
        rawRecord[statusHeaderName] = '未照合';

        const normalizedRecord = applyMojibakeCorrectionsToRecord_(rawRecord, learningMap);

        normalizeRecordDates_(normalizedRecord);

        const businessNo = safeString_(normalizedRecord['業務№']);
        if (businessNo && existingBusinessNos[businessNo]) {
            skippedDuplicateCount += 1;
            return;
        }

        if (businessNo) {
            existingBusinessNos[businessNo] = true;
        }

        normalizedRecord._meta = {
            source_row_no: sourceRowNo,
            file_name: fileName,
            mojibake_cells: collectMojibakeCells_(normalizedRecord)
        };

        records.push(normalizedRecord);
    });

    return {
        records: records,
        skippedDuplicateCount: skippedDuplicateCount
    };
}


/**
 * CSV行を、補正済みCSVヘッダーをキーにしたJSONへ変換する
 * CSVの全列をJSON化する
 */
function buildRecordFromCsvRow_(csvRow, csvHeaderMap) {
    const record = {};

    Object.keys(csvHeaderMap).forEach(function (headerName) {
        const csvIndex = csvHeaderMap[headerName];
        record[headerName] = csvRow[csvIndex] !== undefined ? csvRow[csvIndex] : '';
    });

    return record;
}


/**
 * レコード内の文字列に固定置換・学習置換を適用する
 */
function applyMojibakeCorrectionsToRecord_(record, learningMap) {
    const corrected = {};

    Object.keys(record).forEach(function (key) {
        const value = record[key];

        if (value instanceof Date || typeof value === 'number') {
            corrected[key] = value;
            return;
        }

        let text = safeString_(value);
        text = applyBuiltInMojibakeCorrections_(text);
        text = applyLearningCorrections_(text, learningMap);

        corrected[key] = text;
    });

    return corrected;
}


/**
 * 固定の文字化け補正
 */
function applyBuiltInMojibakeCorrections_(text) {
    const replacements = [
        ['業務��', '業務№'],
        ['宮�ｱ　亜希子', '宮﨑　亜希子'],
        ['�繻ｴ　裕樹', '桒原　裕樹'],
        ['�肝ﾞﾘｯｼﾞ本社', '㈱ﾌﾞﾘｯｼﾞ本社'],
        ['車台��', '車台№'],
        ['顧客��', '顧客№'],
        ['仕入��', '仕入№'],
        ['在納点A-�B', '在納点A-③'],
        ['在庫車B-�@', '在庫車B-①'],
        ['新納点A-�@', '新納点A-①'],
    ];

    let result = safeString_(text);

    replacements.forEach(function (pair) {
        result = result.split(pair[0]).join(pair[1]);
    });

    return result;
}


/**
 * 学習シートの対象AIデータ → 対象正データ で文字列置換する
 */
function applyLearningCorrections_(text, learningMap) {
    let result = safeString_(text);
    if (!result) return result;

    Object.keys(learningMap).forEach(function (fromText) {
        const toText = learningMap[fromText];
        if (!fromText || !toText) return;
        result = result.split(fromText).join(toText);
    });

    return result;
}


/**
 * AI読み取り学習用シートから
 * 読取データ → 正データ の置換マップを作成する
 * （銀行用の学習シート形式に統一）
 */
function loadLearningReplacementMap_(targetSheetName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = 'AI読み取り学習用';
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() <= 1) return {};

    const headerMap = getHeaderMap_(sheet);
    const requiredHeaders = [
        '読み取り日付',
        'ファイル名',
        'ファイルURL',
        '該当シート',
        '該当列',
        '読取データ',
        '正データ',
        '判定理由'
    ];

    const missing = requiredHeaders.filter(function (h) {
        return !headerMap[h];
    });
    if (missing.length > 0) {
        throw new Error(`AI読み取り学習用シートの必須ヘッダー不足: ${missing.join(', ')}`);
    }

    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const map = {};

    values.forEach(function (row) {
        const sheetValue = safeString_(row[headerMap['該当シート'] - 1]);
        const fromText = safeString_(row[headerMap['読取データ'] - 1]);
        const toText = safeString_(row[headerMap['正データ'] - 1]);

        if (sheetValue !== targetSheetName) return;
        if (!fromText || !toText) return;

        map[fromText] = toText;
    });

    return map;
}

/**
 * 指定列の既存値を読み込んで重複チェック用マップを作る
 */
function loadExistingUniqueValues_(sheet, columnNumber) {
    const map = {};
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return map;

    const values = sheet.getRange(2, columnNumber, lastRow - 1, 1).getValues();
    values.forEach(function (row) {
        const key = safeString_(row[0]);
        if (key) {
            map[key] = true;
        }
    });

    return map;
}


/** ================================
 * 共通処理
 * ================================ */

/**
 * 「�」が残るセルを収集する
 */
function collectMojibakeCells_(record) {
    const mojibakeCells = [];

    Object.keys(record).forEach(function (headerName) {
        if (headerName === '_meta') return;

        const value = record[headerName];
        if (typeof value === 'string' && value.indexOf('�') >= 0) {
            mojibakeCells.push({
                headerName: headerName,
                value: value
            });
        }
    });

    return mojibakeCells;
}


/**
 * 「�」が残るセルにメモと黄色背景を付与する
 */
function applyMojibakeNotes_(sheet, startRow, records, headerMap) {
    records.forEach(function (record, index) {
        const rowIndex = startRow + index;
        const mojibakeCells = record._meta && record._meta.mojibake_cells ? record._meta.mojibake_cells : [];

        mojibakeCells.forEach(function (item) {
            const colIndex = headerMap[item.headerName];
            if (!colIndex) return;

            const cell = sheet.getRange(rowIndex, colIndex);
            cell.setBackground('#FFF2CC');
            cell.setNote('文字化けの疑いあり');
        });
    });
}


/**
 * JSONレコードをシートへ追記
 */
function appendRecordsToSheet_(sheet, sheetHeaderMap, records) {

    if (!records.length) return;

    const lastColumn = sheet.getLastColumn();

    const outputRows = records.map(function (record) {

        const row = new Array(lastColumn).fill('');

        Object.keys(record).forEach(function (headerName) {

            if (headerName === 'source_row_no' || headerName === '_meta') {
                return;
            }

            const col = sheetHeaderMap[headerName];

            if (col) {
                row[col - 1] = record[headerName];
            }

        });

        return row;

    });

    const startRow = sheet.getLastRow() + 1;

    sheet.getRange(startRow, 1, outputRows.length, lastColumn)
        .setValues(outputRows);
}


/**
 * 旧関数名互換
 */
function appendJsonRecordsToSheet_(sheet, sheetHeaderMap, records) {
    appendRecordsToSheet_(sheet, sheetHeaderMap, records);
}


/**
 * シートヘッダー → 列番号マップ
 */
function getSheetHeaderMap_(sheet) {
    return getHeaderMap_(sheet);
}


/**
 * 1行目のヘッダー名から列番号マップを作る
 */
function getHeaderMap_(sheet) {
    const lastCol = Math.max(sheet.getLastColumn(), 1);
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const map = {};

    headers.forEach(function (header, index) {
        const name = normalizeHeaderKey_(header);
        if (name) {
            map[name] = index + 1;
        }
    });

    return map;
}


/**
 * 必須ヘッダー検証
 */
function validateRequiredHeaders_(sheetHeaderMap, requiredHeaders) {

    const missing = requiredHeaders.filter(function (header) {
        return !sheetHeaderMap[header];
    });

    if (missing.length > 0) {
        throw new Error('シートに必要なヘッダーが不足: ' + missing.join(', '));
    }
}


/**
 * CSVヘッダーマップ作成
 */
function getCsvHeaderMap_(headerRow) {

    const map = {};

    headerRow.forEach(function (header, index) {

        const key = normalizeHeaderKey_(header);

        if (key) {
            map[key] = index;
        }

    });

    return map;
}

function detectUnsupportedBankCsvReason_(csvHeaderMap) {
    const hasStandardLedgerFields =
        !!csvHeaderMap['日付'] &&
        (!!csvHeaderMap['借方金額'] || !!csvHeaderMap['貸方金額']);

    if (hasStandardLedgerFields) {
        return '';
    }

    const looksLikeBalanceSummary =
        !!csvHeaderMap['開始日付'] &&
        !!csvHeaderMap['終了日付'] &&
        (!!csvHeaderMap['勘定科目'] || !!csvHeaderMap['科目コード']) &&
        !!csvHeaderMap['残高'];

    if (looksLikeBalanceSummary) {
        return '銀行明細ではなく、残高一覧・科目残高系のCSVです';
    }

    return '';
}


/**
 * CSV値取得
 */
function getCsvValue_(row, headerMap, headerName) {

    const index = headerMap[headerName];

    if (index === undefined) return '';

    return safeString_(row[index]);
}


/**
 * CSV読込（Shift-JIS）
 */
function readCsvFile_(file, encoding) {

    const blob = file.getBlob();
    const csvText = blob.getDataAsString(encoding || 'UTF-8');
    return Utilities.parseCsv(csvText);
}

function readCsvFileWithFallbackEncodings_(file, encodings) {
    const candidates = (encodings && encodings.length) ? encodings : ['UTF-8'];
    let lastError = null;

    for (let i = 0; i < candidates.length; i++) {
        const encoding = candidates[i];
        try {
            const rows = readCsvFile_(file, encoding);
            if (rows && rows.length) {
                return rows;
            }
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('CSVを読み込めませんでした。');
}

function listCsvFilesInFolder_(folder) {
    const files = [];
    const iterator = folder.getFiles();

    while (iterator.hasNext()) {
        const file = iterator.next();
        if (/\.csv$/i.test(file.getName())) {
            files.push(file);
        }
    }

    files.sort(function (a, b) {
        return String(a.getName()).localeCompare(String(b.getName()), 'ja');
    });

    return files;
}

function logImportRecordPreview_(label, fileName, records) {
    const preview = (records || []).slice(0, 3).map(function (record) {
        return {
            '業務№': record['業務№'] || '',
            '入金日': record['日付'] || '',
            '金額': record['金額'] || '',
            '顧客名': record['顧客名'] || '',
            'OCR元ファイル名': record['OCR元ファイル名'] || fileName
        };
    });

    Logger.log(label + ': file=' + fileName + ' / records=' + (records || []).length + ' / preview=' + JSON.stringify(preview));
}

function buildSeibiImportSummaryMessage_(summary, durationSec) {
    const lines = [
        '整備CSV取込が完了しました。',
        '処理時間: ' + durationSec + '秒',
        '対象CSV: ' + summary.scannedFiles + '件',
        '成功: ' + summary.successFiles + '件',
        '失敗: ' + summary.failedFiles + '件',
        '追加レコード: ' + summary.addedRecords + '件',
        '重複スキップ: ' + summary.skippedDuplicateCount + '件',
        '追加なしCSV: ' + summary.emptyRecordFiles + '件'
    ];

    if (summary.failureNames && summary.failureNames.length) {
        lines.push('失敗ファイル: ' + summary.failureNames.join(', '));
    }

    return lines.join('\n');
}

function moveFileToFolderSafely_(file, targetFolder) {
    if (!file || !targetFolder) return;

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

    parents.forEach(function (parent) {
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


/**
 * 数値変換
 */
function parseNumber_(value) {

    const text = safeString_(value).replace(/,/g, '');

    if (!text) return 0;

    const num = Number(text);

    return isNaN(num) ? 0 : num;
}


/**
 * 入金月生成
 */
function toDepositMonth_(dateText) {

    const date = parseDate_(dateText);

    if (!date) return '';

    return new Date(date.getFullYear(), date.getMonth(), 1);
}


/**
 * 日付文字列 → Date
 */
function parseDate_(value) {

    const text = safeString_(value);

    if (!text) return null;

    const m = text.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);

    if (!m) return null;

    return new Date(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3])
    );
}


/**
 * 既存シートから重複判定キーを作成する
 * キー: 日付|金額|主摘要（自摘要優先）
 */
function loadExistingBankRecordKeys_(sheet, headerMap, headers) {
    const map = {};
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
        return map;
    }

    const lastCol = sheet.getLastColumn();
    const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    values.forEach(function (row) {
        const dateValue = row[headerMap[headers.DATE] - 1];
        const amountValue = row[headerMap[headers.AMOUNT] - 1];
        const partnerSummaryValue = row[headerMap[headers.PARTNER_SUMMARY] - 1];
        const selfSummaryValue = headerMap['自摘要'] ? row[headerMap['自摘要'] - 1] : '';

        const key = buildBankDuplicateKey_(dateValue, amountValue, pickBankProcessingSummary_(selfSummaryValue, partnerSummaryValue));
        if (key) {
            map[key] = true;
        }
    });

    return map;
}


/**
 * 重複判定用キー生成
 */
function buildBankDuplicateKey_(dateValue, amountValue, primarySummaryValue) {
    const dateText = normalizeDuplicateDate_(dateValue);
    const amount = parseNumber_(amountValue);
    const primarySummary = safeString_(primarySummaryValue);

    return [dateText, amount, primarySummary].join('|');
}


/**
 * 重複判定用の日付正規化
 */
function normalizeDuplicateDate_(value) {
    if (value instanceof Date) {
        return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy/MM/dd');
    }

    const text = safeString_(value);
    if (!text) {
        return '';
    }

    return text.replace(/-/g, '/');
}


/**
 * null/undefined対策つき文字列化
 */
function safeString_(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}


/** ================================
 * 銀行用 学習シート出力
 * ================================ */

/**
 * 文字化け疑いをAI読み取り学習用シートへ追記する（銀行用）
 */
function appendBankLearningRowsFromMojibake_(records, options) {
    const rows = [];
    const readAt = new Date();

    records.forEach(function (record) {
        const mojibakeCells = record._meta && record._meta.mojibake_cells ? record._meta.mojibake_cells : [];
        if (mojibakeCells.length === 0) return;

        mojibakeCells.forEach(function (item) {
            rows.push({
                readAt: readAt,
                fileName: options.fileName || '',
                fileUrl: options.fileUrl || '',
                targetSheetName: options.targetSheetName || '',
                targetHeader: item.headerName,
                readData: item.value,
                reason: '文字化けの疑いあり'
            });
        });
    });

    appendBankReadingLearningRows_(rows);
}

function createImportProcessId_(file, importedAt) {
    const stamp = Utilities.formatDate(importedAt || new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const fileId = file && file.getId ? file.getId().slice(0, 8) : 'manual';
    return 'BANK_' + stamp + '_' + fileId;
}

function detectBankImportFailureReasons_(buildResult) {
    const reasons = [];
    const detectedCount = Number(buildResult.detectedEntryCount || 0);
    const recordCount = (buildResult.records || []).length;
    const duplicateCount = Number(buildResult.skippedDuplicateCount || 0);
    const mojibakeCount = countBankImportMojibakeRecords_(buildResult.records);

    if (detectedCount === 0) {
        reasons.push('有効な入出金行を検出できませんでした');
    }
    if (recordCount === 0 && duplicateCount > 0) {
        reasons.push('重複取込の疑い');
    }
    if (mojibakeCount > 0) {
        reasons.push('文字化け検出');
    }

    return reasons;
}

function countBankImportMojibakeRecords_(records) {
    return (records || []).filter(function (record) {
        const mojibakeCells = record && record._meta && record._meta.mojibake_cells ? record._meta.mojibake_cells : [];
        return mojibakeCells.length > 0;
    }).length;
}

function attachBankImportMeta_(records, options) {
    return (records || []).map(function (record) {
        record['取込処理ID'] = options.processId || '';
        record['取込ファイル名'] = options.fileName || '';
        record['取込日時'] = options.importedAt || '';
        return record;
    });
}

function ensureImportHistorySheet_() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ensureSheetWithHeaders_(ss, '取込履歴', [
        '処理ID',
        '取込日時',
        'ファイル名',
        'fileId',
        '対象行数',
        '成功行数',
        'スキップ行数',
        '失敗行数',
        '結果',
        '失敗理由',
        '移動先',
        '再実行状況'
    ]);
    if (!sheet.isSheetHidden()) {
        sheet.hideSheet();
    }
    return sheet;
}

function appendImportHistoryRow_(item) {
    const sheet = ensureImportHistorySheet_();
    const row = [[
        item.processId || '',
        item.importedAt || '',
        item.file && item.file.getName ? item.file.getName() : '',
        item.file && item.file.getId ? item.file.getId() : '',
        item.targetRowCount || '',
        item.successRowCount || '',
        item.skipRowCount || '',
        item.failedRowCount || '',
        item.result || '',
        item.failureReason || '',
        item.destination || '',
        item.rerunStatus || ''
    ]];
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, row[0].length).setValues(row);
    sheet.getRange(sheet.getLastRow(), 2).setNumberFormat('yyyy/mm/dd hh:mm:ss');
}


/**
 * AI読み取り学習用シートに追記（銀行用）
 */
function appendBankReadingLearningRows_(rows) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const LEARNING_SHEET_NAME = 'AI読み取り学習用';
    if (!rows || rows.length === 0) return;

    const requiredHeaders = [
        '読み取り日付',
        'ファイル名',
        'ファイルURL',
        '該当シート',
        '該当列',
        '読取データ',
        '判定理由'
    ];

    let sheet = ss.getSheetByName(LEARNING_SHEET_NAME);
    if (!sheet) {
        sheet = ss.insertSheet(LEARNING_SHEET_NAME);
    }

    const lastColBefore = Math.max(sheet.getLastColumn(), 1);
    const currentHeaders = sheet.getRange(1, 1, 1, lastColBefore).getValues()[0].map(function (v) {
        return safeString_(v);
    });

    if (sheet.getLastRow() === 0 || currentHeaders.every(function (v) { return !v; })) {
        sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    } else {
        const existingSet = {};
        currentHeaders.forEach(function (h) {
            if (h) existingSet[h] = true;
        });

        const missingHeaders = requiredHeaders.filter(function (h) {
            return !existingSet[h];
        });
        if (missingHeaders.length > 0) {
            const appendStartCol = sheet.getLastColumn() + 1;
            sheet.getRange(1, appendStartCol, 1, missingHeaders.length).setValues([missingHeaders]);
        }
    }

    const headerMap = getHeaderMap_(sheet);
    const maxCol = sheet.getLastColumn();

    const outputRows = rows.map(function (item) {
        const row = Array(maxCol).fill('');
        row[headerMap['読み取り日付'] - 1] = item.readAt;
        row[headerMap['ファイル名'] - 1] = item.fileName;
        row[headerMap['ファイルURL'] - 1] = item.fileUrl;
        row[headerMap['該当シート'] - 1] = item.targetSheetName;
        row[headerMap['該当列'] - 1] = item.targetHeader;
        row[headerMap['読取データ'] - 1] = item.readData;
        row[headerMap['判定理由'] - 1] = item.reason;
        return row;
    });

    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, outputRows.length, maxCol).setValues(outputRows);

    if (headerMap['読み取り日付']) {
        sheet.getRange(startRow, headerMap['読み取り日付'], outputRows.length, 1)
            .setNumberFormat('yyyy/mm/dd hh:mm:ss');
    }
}

function finalizeBankLedgerUpdate_() {
    replaceDataFromLearningSheet_('銀行データチェック用');
    updateBankLedgerDisplayColumns_();
    dedupeBankLedgerRows_();
    removeDuplicateRowsByHeaders_('AI読み取り学習用', ['該当シート', '読取データ']);
    sortSheetByHeader_("銀行データチェック用", "日付");
    syncBankDirectionSheets_();
    syncWithdrawalLedgerToPaymentSpreadsheet_();
}

function ensureBankLedgerSupportSheets_() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureImportHistorySheet_();
    // AI読み取り学習用に手動補正用の列を追加（銀行文字補正学習を統合済み）
    ensureSheetHeaders_(ss.getSheetByName('AI読み取り学習用') || ss.insertSheet('AI読み取り学習用'), [
        '読み取り日付', 'ファイル名', 'ファイルURL', '該当シート', '該当列',
        '読取データ', '正データ', '判定理由', '有効', '置換方法', 'メモ'
    ]);
    ensureSheetWithHeaders_(ss, '定期入金リスト', [
        '有効',
        '摘要',
        '金額',
        '業務No.',
        '顧客No.',
        'ステータス',
        '確認メモ'
    ]);
    ensureSheetWithHeaders_(ss, '銀行入金一覧', [
        '日付',
        '表示摘要',
        '自摘要',
        '相手摘要',
        '相手科目',
        '借方金額',
        '金額',
        'ステータス',
        '顧客No.',
        '業務No.',
        '入金月',
        '伝票種',
        '番号'
    ]);
    ensureSheetWithHeaders_(ss, '銀行出金一覧', [
        '日付',
        '表示摘要',
        '自摘要',
        '相手摘要',
        '相手科目',
        '貸方金額',
        '金額',
        'ステータス',
        '顧客No.',
        '業務No.',
        '入金月',
        '伝票種',
        '番号'
    ]);
}

function ensureBankLedgerHeaders_(sheet) {
    ensureSheetHeaders_(sheet, [
        '日付',
        '相手科目',
        '相手摘要',
        '金額',
        '業務No.',
        '顧客No.',
        'ステータス',
        '保護フラグ',
        '入金月',
        'カード会社振り込み',
        'カード照合額',
        '自摘要',
        '番号',
        '伝票種',
        '取引先',
        '表示摘要',
        '借方金額',
        '貸方金額',
        '取込処理ID',
        '取込ファイル名',
        '取込日時'
    ]);
}

function ensureSheetWithHeaders_(ss, sheetName, headers) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
        sheet = ss.insertSheet(sheetName);
    }
    ensureSheetHeaders_(sheet, headers);
    return sheet;
}

function ensureSheetHeaders_(sheet, headers) {
    const currentLastCol = Math.max(sheet.getLastColumn(), 1);
    const currentHeaders = sheet.getRange(1, 1, 1, currentLastCol).getValues()[0].map(function (value) {
        return safeString_(value);
    });

    if (sheet.getLastRow() === 0 || currentHeaders.every(function (value) { return !value; })) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        return;
    }

    const existingSet = {};
    currentHeaders.forEach(function (header) {
        if (header) existingSet[header] = true;
    });

    const missingHeaders = headers.filter(function (header) {
        return !existingSet[header];
    });

    if (missingHeaders.length > 0) {
        const appendStartCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, appendStartCol, 1, missingHeaders.length).setValues([missingHeaders]);
    }
}

function updateBankLedgerDisplayColumns_() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('銀行データチェック用');
    if (!sheet || sheet.getLastRow() <= 1) return;

    ensureBankLedgerHeaders_(sheet);
    const headerMap = getSheetHeaderMap_(sheet);
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const range = sheet.getRange(2, 1, lastRow - 1, lastCol);
    const values = range.getValues();

    values.forEach(function (row) {
        const selfSummary = safeString_(row[headerMap['自摘要'] - 1]);
        const partnerSummary = safeString_(row[headerMap['相手摘要'] - 1]);
        const signedAmount = parseNumber_(row[headerMap['金額'] - 1]);
        const displaySummary = pickBankProcessingSummary_(selfSummary, partnerSummary);
        if (headerMap['表示摘要']) {
            row[headerMap['表示摘要'] - 1] = displaySummary;
        }
        if (headerMap['取引先']) {
            row[headerMap['取引先'] - 1] = displaySummary;
        }
        if (headerMap['伝票種']) {
            row[headerMap['伝票種'] - 1] = normalizeBankVoucherType_(row[headerMap['伝票種'] - 1], signedAmount);
        }
    });

    range.setValues(values);
}

function dedupeBankLedgerRows_() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('銀行データチェック用');
    if (!sheet || sheet.getLastRow() <= 2) return;

    ensureBankLedgerHeaders_(sheet);
    const headerMap = getSheetHeaderMap_(sheet);
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    const keptRows = [];
    const keyIndexMap = {};

    values.forEach(function (row) {
        const key = buildBankLedgerRowDedupKey_(row, headerMap);
        if (!key) {
            keptRows.push(row);
            return;
        }

        const existingIndex = keyIndexMap[key];
        if (existingIndex === undefined) {
            keyIndexMap[key] = keptRows.length;
            keptRows.push(row);
            return;
        }

        const currentScore = scoreBankLedgerRowForKeep_(row, headerMap);
        const existingScore = scoreBankLedgerRowForKeep_(keptRows[existingIndex], headerMap);
        if (currentScore > existingScore) {
            keptRows[existingIndex] = row;
        }
    });

    if (keptRows.length === values.length) {
        return;
    }

    sheet.getRange(2, 1, keptRows.length, lastCol).setValues(keptRows);

    const removeCount = values.length - keptRows.length;
    if (removeCount > 0) {
        sheet.deleteRows(keptRows.length + 2, removeCount);
    }
}

function buildBankLedgerRowDedupKey_(row, headerMap) {
    const dateText = normalizeDuplicateDate_(row[headerMap['日付'] - 1]);
    const signedAmount = parseNumber_(row[headerMap['金額'] - 1]);
    if (!dateText || !signedAmount) return '';

    const voucherType = normalizeBankVoucherType_(row[headerMap['伝票種'] - 1], signedAmount);
    const displaySummary = normalizeBankLedgerText_(
        row[headerMap['表示摘要'] - 1] ||
        pickBankProcessingSummary_(row[headerMap['自摘要'] - 1], row[headerMap['相手摘要'] - 1])
    );
    const number = normalizeBankLedgerManagementNumber_(row[headerMap['番号'] - 1]);
    const counterAccount = normalizeBankLedgerText_(row[headerMap['相手科目'] - 1]);

    if (number) {
        return [dateText, voucherType, Math.abs(signedAmount), number].join('|');
    }

    return [dateText, voucherType, Math.abs(signedAmount), displaySummary, counterAccount].join('|');
}

function scoreBankLedgerRowForKeep_(row, headerMap) {
    const displaySummary = safeString_(
        row[headerMap['表示摘要'] - 1] ||
        pickBankProcessingSummary_(row[headerMap['自摘要'] - 1], row[headerMap['相手摘要'] - 1])
    );
    const selfSummary = safeString_(row[headerMap['自摘要'] - 1]);
    const partnerSummary = safeString_(row[headerMap['相手摘要'] - 1]);
    const number = safeString_(row[headerMap['番号'] - 1]);
    const counterAccount = safeString_(row[headerMap['相手科目'] - 1]);

    let score = 0;
    if (number) score += 80;
    if (selfSummary) score += 30;
    if (partnerSummary) score += 10;
    if (counterAccount) score += 5;
    score += Math.min(displaySummary.length, 60);
    score -= countMojibakeChars_(displaySummary) * 100;
    score -= countMojibakeChars_(selfSummary) * 60;
    score -= countMojibakeChars_(partnerSummary) * 40;
    return score;
}

function normalizeBankLedgerText_(value) {
    return safeString_(value)
        .normalize('NFKC')
        .replace(/\s+/g, '')
        .replace(/[‐‑‒–—―ーｰ]/g, '-')
        .toLowerCase();
}

function normalizeBankVoucherType_(rawVoucherType, signedAmount) {
    const text = safeString_(rawVoucherType);
    if (text === '入金' || text === '出金') {
        return text;
    }
    if (signedAmount > 0) {
        return '入金';
    }
    if (signedAmount < 0) {
        return '出金';
    }
    return '';
}

function getBankImportSummaryReplacementRules_(ss) {
    if (typeof loadManualLearningReplaceRules_ !== 'function') {
        return [];
    }
    return loadManualLearningReplaceRules_(ss, '銀行データチェック用').filter(function(rule) {
        const header = safeString_(rule.targetHeader);
        return !header || header === '自摘要' || header === '相手摘要' || header === '表示摘要';
    });
}

function applyBankImportSummaryCorrections_(value, rules) {
    let text = safeString_(value);
    if (!text || !rules || !rules.length) {
        return text;
    }
    rules.forEach(function(rule) {
        if (!rule || !rule.read) return;
        if (rule.mode === '完全一致') {
            if (text === rule.read) {
                text = rule.correct;
            }
            return;
        }
        if (text.indexOf(rule.read) >= 0) {
            text = text.split(rule.read).join(rule.correct);
        }
    });
    return text;
}

function pickBankProcessingSummary_(selfSummary, partnerSummary) {
    const self = safeString_(selfSummary);
    const partner = safeString_(partnerSummary);
    return self || partner;
}

function countMojibakeChars_(text) {
    const value = safeString_(text);
    if (!value) return 0;
    const match = value.match(/�/g);
    return match ? match.length : 0;
}

function syncBankDirectionSheets_() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = ss.getSheetByName('銀行データチェック用');
    if (!sourceSheet) return;

    ensureBankLedgerSupportSheets_();

    const headerMap = getSheetHeaderMap_(sourceSheet);
    const rows = sourceSheet.getLastRow() > 1
        ? sourceSheet.getRange(2, 1, sourceSheet.getLastRow() - 1, sourceSheet.getLastColumn()).getValues()
        : [];

    const depositRows = [];
    const withdrawalRows = [];
    const seenOutputKeys = {};

    rows.forEach(function (row) {
        const signedAmount = parseNumber_(row[headerMap['金額'] - 1]);
        const voucherType = normalizeBankVoucherType_(row[headerMap['伝票種'] - 1], signedAmount);
        const direction = voucherType || (signedAmount > 0 ? '入金' : signedAmount < 0 ? '出金' : '');
        if (!direction) return;
        const displaySummary = row[headerMap['表示摘要'] - 1] || pickBankProcessingSummary_(row[headerMap['自摘要'] - 1], row[headerMap['相手摘要'] - 1]);
        const selfSummary = row[headerMap['自摘要'] - 1] || '';
        const partnerSummary = row[headerMap['相手摘要'] - 1] || '';
        const counterAccount = row[headerMap['相手科目'] - 1] || '';
        if (shouldExcludeBankDirectionRow_(String(displaySummary || selfSummary || partnerSummary || ''), String(counterAccount || ''), String(voucherType || ''))) {
            return;
        }

        const outputRow = [
            row[headerMap['日付'] - 1],
            displaySummary,
            selfSummary,
            partnerSummary,
            counterAccount,
            direction === '入金' ? (row[headerMap['借方金額'] - 1] || Math.abs(signedAmount)) : (row[headerMap['貸方金額'] - 1] || Math.abs(signedAmount)),
            Math.abs(signedAmount),
            row[headerMap['ステータス'] - 1] || '',
            getOptionalCellValue_(row, headerMap, '顧客No.') || getOptionalCellValue_(row, headerMap, '顧客No') || '',
            getOptionalCellValue_(row, headerMap, '業務No.') || getOptionalCellValue_(row, headerMap, '業務No') || '',
            row[headerMap['入金月'] - 1] || '',
            direction,
            row[headerMap['番号'] - 1] || ''
        ];

        const outputKey = buildBankDirectionOutputDedupKey_(outputRow);
        if (outputKey && seenOutputKeys[outputKey]) {
            return;
        }
        if (outputKey) {
            seenOutputKeys[outputKey] = true;
        }

        if (direction === '入金' || signedAmount > 0) {
            depositRows.push(outputRow);
        } else if (direction === '出金' || signedAmount < 0) {
            withdrawalRows.push(outputRow);
        }
    });

    writeBankDirectionSheet_(ss.getSheetByName('銀行入金一覧'), depositRows);
    writeBankDirectionSheet_(ss.getSheetByName('銀行出金一覧'), withdrawalRows);
}

function writeBankDirectionSheet_(sheet, rows) {
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
    }
    if (!rows.length) return;

    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    if (rows[0].length >= 1) {
        sheet.getRange(2, 1, rows.length, 1).setNumberFormat('yyyy/mm/dd');
    }
    sheet.getRange(2, 6, rows.length, 2).setNumberFormat('#,##0;[Red]-#,##0');
}

function syncWithdrawalLedgerToPaymentSpreadsheet_() {
    const PAYMENT_SPREADSHEET_ID = '12Z7hFDO9f8JMTdVYqNCx_1QbgjXmoAqWYJDiUkakuHE';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = ss.getSheetByName('銀行データチェック用');
    if (!sourceSheet || sourceSheet.getLastRow() < 2) {
        return;
    }

    const paymentSs = SpreadsheetApp.openById(PAYMENT_SPREADSHEET_ID);
    const targetSheet = ensureSheetWithHeaders_(paymentSs, '銀行データチェック用', [
        '日付',
        '相手科目',
        '相手摘要',
        '金額',
        '業務No.',
        '顧客No.',
        'ステータス',
        '保護フラグ',
        '入金月',
        'カード会社振り込み',
        'カード照合額',
        '自摘要',
        '番号',
        '伝票種',
        '取引先',
        '表示摘要',
        '借方金額',
        '貸方金額',
        '取込処理ID',
        '取込ファイル名',
        '取込日時'
    ]);

    const headerMap = getSheetHeaderMap_(sourceSheet);
    const values = sourceSheet.getRange(2, 1, sourceSheet.getLastRow() - 1, sourceSheet.getLastColumn()).getValues();
    const outputRows = values.filter(function(row) {
        const protectedFlag = headerMap['保護フラグ'] ? row[headerMap['保護フラグ'] - 1] : '';
        const signedAmount = parseNumber_(row[headerMap['金額'] - 1]);
        const voucherType = normalizeBankVoucherType_(row[headerMap['伝票種'] - 1], signedAmount);
        return !isTruthyLikeBankFlag_(protectedFlag) && (voucherType === '出金' || signedAmount < 0);
    });

    const targetLastRow = targetSheet.getLastRow();
    if (targetLastRow > 1) {
        targetSheet.getRange(2, 1, targetLastRow - 1, targetSheet.getLastColumn()).clearContent();
    }
    if (!outputRows.length) {
        return;
    }

    targetSheet.getRange(2, 1, outputRows.length, targetSheet.getLastColumn()).setValues(outputRows);
}

function isTruthyLikeBankFlag_(value) {
    const text = String(value === true ? 'TRUE' : value || '').trim().toUpperCase();
    return text === 'TRUE' || text === '1' || text === 'YES' || text === 'Y';
}

function buildBankDirectionOutputDedupKey_(row) {
    const dateText = normalizeDuplicateDate_(row[0]);
    const displaySummary = normalizeBankLedgerText_(row[1]);
    const amount = parseNumber_(row[6]);
    const direction = safeString_(row[11]);
    const number = normalizeBankLedgerManagementNumber_(row[12]);
    if (!dateText || !amount || !direction) return '';
    if (number) return [dateText, direction, amount, number].join('|');
    return [dateText, direction, amount, displaySummary].join('|');
}

function normalizeBankLedgerManagementNumber_(value) {
    const text = String(value || '').toUpperCase();
    const match = text.match(/(SB|CH|PC|RA)\s*0*(\d{3,8})/);
    if (!match) return '';
    return match[1] + match[2].padStart(8, '0');
}

function shouldExcludeBankDirectionRow_(sourceText, counterAccount, voucherType) {
    const joined = [sourceText, counterAccount, voucherType].join(' ');
    if (!safeString_(joined)) return true;
    if (/資金移動/.test(joined)) return true;
    if (/前頁残高|繰越残高|前日繰越|当座預金|普通預金/.test(joined)) return true;
    return false;
}

function getOptionalCellValue_(row, headerMap, headerName) {
    const col = headerMap[headerName];
    if (!col) return '';
    return row[col - 1];
}

function hasSheet_(sheetName) {
    return !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
}


/** ================================
 * ヘッダー / 日付正規化
 * ================================ */

/**
 * CSVのヘッダー行を補正した2次元配列を返す
 * 1行目のみ補正し、データ行はそのまま維持する
 */
function normalizeCsvHeaderRow_(csvRows) {
    if (!csvRows || csvRows.length === 0) {
        return csvRows;
    }

    const cloned = csvRows.map(function (row) {
        return row.slice();
    });

    cloned[0] = cloned[0].map(function (header) {
        return normalizeHeaderKey_(header);
    });

    return cloned;
}


/**
 * ヘッダー名を補正・正規化する
 */
function normalizeHeaderKey_(value) {
    let text = safeString_(value);

    text = applyBuiltInMojibakeCorrections_(text);
    text = text.replace(/[ 　\t\r\n]/g, '');
    text = text
        .replace(/No\./gi, '№')
        .replace(/No/gi, '№')
        .replace(/NO/gi, '№');

    return text;
}


/**
 * 和暦(R xx/xx/xx)を西暦 yyyy/MM/dd に変換
 * 例: R 08/03/05 → 2026/03/05
 */
function normalizeWarekiDate_(value) {
    const text = safeString_(value);
    if (!text) return text;

    const match = text.match(/R\s*(\d{1,2})[\/／](\d{1,2})[\/／](\d{1,2})/);
    if (!match) return text;

    const year = 2018 + Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const yyyy = year;
    const mm = ('0' + month).slice(-2);
    const dd = ('0' + day).slice(-2);

    return `${yyyy}/${mm}/${dd}`;
}


/**
 * レコード内の日付列を西暦に正規化
 */
function normalizeRecordDates_(record) {
    Object.keys(record).forEach(function (key) {
        if (key === '_meta') return;

        const value = record[key];
        if (typeof value !== 'string') return;

        const normalized = normalizeWarekiDate_(value);
        record[key] = normalized;
    });

    return record;
}

/** ================================
 * 車販CSV取込用関数
 * ================================ */
function buildShahanRecordFromCsvRow_(csvRow, csvHeaderMap) {
    const shiireNoHeader = csvHeaderMap['仕入��'] !== undefined ? '仕入��' : '仕入№';

    return {
        '業務№': csvRow[csvHeaderMap[shiireNoHeader]] !== undefined ? csvRow[csvHeaderMap[shiireNoHeader]] : '',
        '日付': csvRow[csvHeaderMap['売却日']] !== undefined ? csvRow[csvHeaderMap['売却日']] : '',
        '顧客名': csvRow[csvHeaderMap['売却先(顧客)']] !== undefined ? csvRow[csvHeaderMap['売却先(顧客)']] : '',
        '売上総計': csvRow[csvHeaderMap['売上計']] !== undefined ? csvRow[csvHeaderMap['売上計']] : ''
    };
}

/**
 * 社販CSVをJSONへ変換する
 * - 指定ヘッダーのみ変換して出力
 * - 学習シート置換
 * - 業務№重複除外
 * - ステータスを未照合で設定
 * - 変換後も「�」が残るセルを記録
 */
function buildShahanImportRecords_(csvRows, csvHeaderMap, fileName, sheetHeaderMap, existingBusinessNos, learningMap, statusHeaderName) {
    const dataRows = csvRows.slice(1);
    const importedAt = new Date();
    const records = [];
    let skippedDuplicateCount = 0;

    dataRows.forEach(function (row, index) {
        const sourceRowNo = index + 2;
        const rawRecord = buildShahanRecordFromCsvRow_(row, csvHeaderMap);

        rawRecord['データ取り込み日'] = rawRecord['データ取り込み日'] || importedAt;
        rawRecord['OCR元ファイル名'] = rawRecord['OCR元ファイル名'] || fileName;
        rawRecord[statusHeaderName] = '未照合';

        const normalizedRecord = applyMojibakeCorrectionsToRecord_(rawRecord, learningMap);

        normalizeRecordDates_(normalizedRecord);

        const businessNo = safeString_(normalizedRecord['業務№']);
        if (businessNo && existingBusinessNos[businessNo]) {
            skippedDuplicateCount += 1;
            return;
        }

        if (businessNo) {
            existingBusinessNos[businessNo] = true;
        }

        normalizedRecord._meta = {
            source_row_no: sourceRowNo,
            file_name: fileName,
            mojibake_cells: collectMojibakeCells_(normalizedRecord)
        };

        records.push(normalizedRecord);
    });

    return {
        records: records,
        skippedDuplicateCount: skippedDuplicateCount
    };
}
