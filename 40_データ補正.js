function runReplace() { // 文字化け補正
    ensureBankLedgerSupportSheets_();
    replaceDataFromLearningSheet_('振込入金リスト一覧');
    replaceDataFromLearningSheet_('銀行データチェック用');
    updateBankLedgerDisplayColumns_();
    syncBankDirectionSheets_();
    // replaceDataFromLearningSheet_('クレカ・現金');
}

function runRemoveDuplicate() { // 重複削除
    removeDuplicateRowsByHeaders_('銀行データチェック用', ['日付','相手摘要','金額']);
    removeDuplicateRowsByHeaders_('AI読み取り学習用', ['該当シート', '読取データ']);
}

/*====================== 関数定義 ======================*/

function replaceDataFromLearningSheet_(targetSheetName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const targetSheet = ss.getSheetByName(targetSheetName);

    if (!targetSheet) return;

    const replaceRules = getTextReplacementRulesForSheet_(ss, targetSheetName);
    if (replaceRules.length === 0) return;
    const replaceRuleIndex = buildReplacementRuleIndex_(replaceRules);

    // 2. 対象シートのデータを一括取得
    const lastRow = targetSheet.getLastRow();
    const lastCol = targetSheet.getLastColumn();
    if (lastRow < 2) return;

    const headerValues = targetSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (value) {
        return safeString_(value);
    });
    const targetRange = targetSheet.getRange(2, 1, lastRow - 1, lastCol);
    const targetValues = targetRange.getValues();
    const targetNotes = targetRange.getNotes();
    const targetBackgrounds = targetRange.getBackgrounds();

    let isChanged = false;

    // 3. メモリ（配列）上で「セル内の文字列」を置換
    for (let r = 0; r < targetValues.length; r++) {
        for (let c = 0; c < targetValues[r].length; c++) {
            const headerName = headerValues[c] || '';
            let cellValue = String(targetValues[r][c]);
            const originalValue = cellValue;
            let cellModified = false;
            const rulesForCell = getReplacementRulesForHeader_(replaceRuleIndex, headerName);
            if (!rulesForCell.length || !cellValue) {
                continue;
            }

            // 各セルに対して、すべての置換ルールをチェック
            for (const rule of rulesForCell) {
                // セルの値に「読取データ」が含まれているかチェック
                if (rule.mode === '完全一致') {
                    if (cellValue !== rule.read) continue;
                    cellValue = rule.correct;
                } else if (cellValue.includes(rule.read)) {
                    // 全て置換（replaceAll）を使用
                    cellValue = cellValue.split(rule.read).join(rule.correct);
                } else {
                    continue;
                }

                if (cellValue !== originalValue) {
                    cellModified = true;
                    isChanged = true;
                }
            }

            // 1つでも置換が発生したセルの後処理
            if (cellModified) {
                targetValues[r][c] = cellValue;
                targetNotes[r][c] = "";     // メモを削除
                targetBackgrounds[r][c] = null; // 背景をリセット
            }
        }
    }

    // 4. 変更があった場合のみ、一括でシートに書き戻す
    if (isChanged) {
        targetRange.setValues(targetValues);
        targetRange.setNotes(targetNotes);
        targetRange.setBackgrounds(targetBackgrounds);
        console.log(`シート「${targetSheetName}」内の文字列置換が完了しました。`);
    }
}

function buildReplacementRuleIndex_(replaceRules) {
    const index = { all: [] };
    replaceRules.forEach(function (rule) {
        const key = rule.targetHeader || '__ALL__';
        if (key === '__ALL__') {
            index.all.push(rule);
            return;
        }
        if (!index[key]) index[key] = [];
        index[key].push(rule);
    });
    return index;
}

function getReplacementRulesForHeader_(replaceRuleIndex, headerName) {
    const scopedRules = replaceRuleIndex[headerName] || [];
    if (!replaceRuleIndex.all.length) return scopedRules;
    return scopedRules.concat(replaceRuleIndex.all);
}

function getTextReplacementRulesForSheet_(ss, targetSheetName) {
    return loadAiLearningReplaceRules_(ss, targetSheetName)
        .concat(loadManualLearningReplaceRules_(ss, targetSheetName));
}

function loadAiLearningReplaceRules_(ss, targetSheetName) {
    const learningSheet = ss.getSheetByName('AI読み取り学習用');
    if (!learningSheet || learningSheet.getLastRow() <= 1) return [];

    const learningData = learningSheet.getDataRange().getValues();
    const learningHeader = learningData[0];
    const colIdxSheet = learningHeader.indexOf('該当シート');
    const colIdxRead = learningHeader.indexOf('読取データ');
    const colIdxCorrect = learningHeader.indexOf('正データ');
    const colIdxColumn = learningHeader.indexOf('該当列');
    if ([colIdxSheet, colIdxRead, colIdxCorrect].some(function (index) { return index < 0; })) {
        return [];
    }

    const replaceRules = [];
    for (let i = 1; i < learningData.length; i++) {
        const row = learningData[i];
        if (row[colIdxSheet] !== targetSheetName) continue;
        if (row[colIdxRead] === "" || row[colIdxCorrect] === "") continue;

        replaceRules.push({
            read: String(row[colIdxRead]),
            correct: String(row[colIdxCorrect]),
            targetHeader: colIdxColumn >= 0 ? safeString_(row[colIdxColumn]) : '',
            mode: '部分一致'
        });
    }
    return replaceRules;
}

function loadManualLearningReplaceRules_(ss, targetSheetName) {
    // AI読み取り学習用シートから手動補正ルール（有効列が設定済み）を読み込む
    const sheet = ss.getSheetByName('AI読み取り学習用');
    if (!sheet || sheet.getLastRow() <= 1) return [];

    const headerMap = getHeaderMap_(sheet);
    const requiredHeaders = ['該当シート', '該当列', '読取データ', '正データ'];
    const missing = requiredHeaders.filter(function (header) { return !headerMap[header]; });
    if (missing.length) return [];

    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    return values.map(function (row) {
        const enabled = safeString_(row[(headerMap['有効'] || 1) - 1]).toUpperCase();
        if (!enabled) return null; // 有効列が空 = AI自動生成行 → スキップ
        const sheetValue = safeString_(row[headerMap['該当シート'] - 1]);
        const targetHeader = safeString_(row[headerMap['該当列'] - 1]);
        const read = safeString_(row[headerMap['読取データ'] - 1]);
        const correct = safeString_(row[headerMap['正データ'] - 1]);
        const mode = safeString_(row[(headerMap['置換方法'] || 1) - 1]) || '部分一致';

        if (enabled === 'N' || enabled === 'FALSE') return null;
        if (sheetValue && sheetValue !== targetSheetName) return null;
        if (!read || !correct) return null;

        return {
            read: read,
            correct: correct,
            targetHeader: targetHeader,
            mode: mode
        };
    }).filter(Boolean);
}

/**
 * 指定シートの指定ヘッダー列をキーに重複行を削除
 * ・1行目はヘッダー
 * ・2行目以降が対象
 * ・最初の行を残して下の重複を削除
 *
 * @param {string} sheetName
 * @param {string[]} targetHeaders 例 ['取引先'] / ['日付','取引先']
 */
function removeDuplicateRowsByHeaders_(sheetName, targetHeaders) {

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) throw new Error(`シートが見つかりません: ${sheetName}`);
    if (!Array.isArray(targetHeaders) || targetHeaders.length === 0) {
        throw new Error("targetHeadersを指定してください");
    }

    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();

    if (lastRow < 2) return;

    // ヘッダー取得
    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

    // ヘッダー→index変換
    const targetIndexes = targetHeaders.map(header => {
        const index = headers.indexOf(header);
        if (index === -1) {
            throw new Error(`ヘッダーが見つかりません: ${header}`);
        }
        return index;
    });

    // データ取得
    const data = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();

    const seen = new Set();
    const rowsToDelete = [];

    data.forEach((row, i) => {

        const key = targetIndexes
            .map(index => normalizeCellValue_(row[index]))
            .join("||");

        const rowNumber = i + 2;

        if (seen.has(key)) {
            rowsToDelete.push(rowNumber);
        } else {
            seen.add(key);
        }

    });

    if (rowsToDelete.length === 0) {
        Logger.log("重複なし");
        return;
    }

    // 下から削除
    rowsToDelete.reverse().forEach(row => sheet.deleteRow(row));

    Logger.log(`${rowsToDelete.length}行削除しました`);
}


/**
 * セル値正規化
 */
function normalizeCellValue_(value) {

    if (value instanceof Date) {
        return Utilities.formatDate(
            value,
            Session.getScriptTimeZone(),
            "yyyy-MM-dd HH:mm:ss"
        );
    }

    return String(value).trim();
}
