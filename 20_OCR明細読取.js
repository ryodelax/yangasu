const CREDIT_CASH_SHEET_NAME = 'クレカ・現金';

const CREDIT_CASH_HEADERS = {
    DATE: '取引日',
    VENDOR: '取引先',
    SUBTOTAL: '小計',
    TAX: '税金',
    TOTAL: '合計',
    METHOD: '入金方法',
    CARD_BRAND: 'クレカ種別',
    BIZ_NO: '業務No',
    FILE_NAME: 'ファイル名',
    FILE_URL: 'ファイルURL',
    STATUS: 'ステータス'
};

const RECEIPT_FOLDER_ID = {
    INPUT: '1LDQvlXmkXahNnJepkbJbkg6NNEXZ0As_',
    SUCCESS: '1XjbNIMPQzuGA5lT169GoNYkpfBBb9DHV',
    FAILURE: '1PbnaPbNS0a9YZWWqIRLGUk0oXyNI7B_N'
};

const BRIDGE_INVOICE_FOLDER_ID = {
    ROOT: '1V7iCi7CN2IYz8M1PKHbU4aAr-exdvqiZ',
    SUCCESS: '1VNbWipI7h8S2hKf9S0IJmLtbciN8q4So',
    FAILURE: '1MXLglUmS3Ci6gfh88zYNcXDS6UBbDIqR'
};

function runImportReceipts(){
    runImportCreditCashDocuments();
}

function runImportCreditCashDocuments() {
    processReceiptsWithGemini();
    processBridgeInvoicesWithGemini();
    setDepositMonthFormula();
}

function runImportBridgeInvoices() {
    processBridgeInvoicesWithGemini();
    setDepositMonthFormula();
}

/**
 * メイン処理：フォルダ内のレシートを解析してシートに転記（列位置自動判別）
 */
function processReceiptsWithGemini() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CREDIT_CASH_SHEET_NAME);
    if (!sheet) {
        console.error(`シート「${CREDIT_CASH_SHEET_NAME}」が見つかりません。`);
        return;
    }

    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
        console.error('シートにヘッダー行（1行目）が存在しません。');
        return;
    }

    const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
        return String(h || '').trim();
    });

    const inputFolder = DriveApp.getFolderById(RECEIPT_FOLDER_ID.INPUT);
    const successFolder = DriveApp.getFolderById(RECEIPT_FOLDER_ID.SUCCESS);
    const errorFolder = DriveApp.getFolderById(RECEIPT_FOLDER_ID.FAILURE);

    const headerMap = getHeaderMapByRow_(currentHeaders);
    const importedIndex = buildImportedFileIndex_(sheet, headerMap, CREDIT_CASH_HEADERS);
    const files = inputFolder.getFiles();

    while (files.hasNext()) {
        const file = files.next();
        const mimeType = file.getMimeType();

        if (!mimeType.match(/image\/*/) && mimeType !== 'application/pdf') continue;

        let fileUrl = '';
        const fileId = file.getId();
        const duplicateKey = buildImportedFileKey_(fileId, file.getName());

        if (importedIndex[duplicateKey] || importedIndex[buildImportedFileKey_('', file.getName())]) {
            console.log(`取込済みスキップ: ${file.getName()}`);
            continue;
        }

        try {
            console.log(`解析開始: ${file.getName()}`);

            const data = callGeminiReceiptOcr_(file);

            file.moveTo(successFolder);
            fileUrl = file.getUrl();

            const cardBrand = decideCardBrand_(data.payment_method, data.card_brand);

            const mapping = {
                [CREDIT_CASH_HEADERS.DATE]: data.date,
                [CREDIT_CASH_HEADERS.VENDOR]: data.store_name,
                [CREDIT_CASH_HEADERS.SUBTOTAL]: data.subtotal,
                [CREDIT_CASH_HEADERS.TAX]: data.tax,
                [CREDIT_CASH_HEADERS.TOTAL]: data.total_amount,
                [CREDIT_CASH_HEADERS.METHOD]: data.payment_method,
                [CREDIT_CASH_HEADERS.CARD_BRAND]: cardBrand,
                [CREDIT_CASH_HEADERS.BIZ_NO]: data.biz_no || data.receipt_no || '',
                [CREDIT_CASH_HEADERS.FILE_NAME]: file.getName(),
                [CREDIT_CASH_HEADERS.FILE_URL]: fileUrl,
                [CREDIT_CASH_HEADERS.STATUS]: '未照合'
            };

            const rowValues = currentHeaders.map(function (headerName) {
                return mapping[headerName] !== undefined ? mapping[headerName] : '';
            });

            const appendRowIndex = sheet.getLastRow() + 1;
            sheet.appendRow(rowValues);

            applyReceiptAiWarnings_(
                sheet,
                appendRowIndex,
                headerMap,
                CREDIT_CASH_HEADERS,
                data,
                file.getName()
            );

            importedIndex[duplicateKey] = true;
            console.log(`成功: ${file.getName()}`);
        } catch (e) {
            const logMessage = e && e.message ? e.message : '不明なエラー';
            console.error(`エラー: ${file.getName()} - ${logMessage}`);
            try {
                file.moveTo(errorFolder);
            } catch (moveError) {
                console.error(`エラーフォルダ移動失敗: ${file.getName()} - ${moveError.message}`);
            }
            fileUrl = file.getUrl();
        }
    }
}


/**
 * ブリッジ宛請求書を解析して「クレカ・現金」へ転記する
 * 既存の読み取り済み・エラーフォルダ内ファイルも重複回避付きで再取込できるようにする
 */
function processBridgeInvoicesWithGemini() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CREDIT_CASH_SHEET_NAME);
    if (!sheet) {
        throw new Error(`シート「${CREDIT_CASH_SHEET_NAME}」が見つかりません。`);
    }

    const headerMap = getHeaderMap_(sheet);
    validateRequiredHeaders_(headerMap, [
        CREDIT_CASH_HEADERS.DATE,
        CREDIT_CASH_HEADERS.VENDOR,
        CREDIT_CASH_HEADERS.SUBTOTAL,
        CREDIT_CASH_HEADERS.TAX,
        CREDIT_CASH_HEADERS.TOTAL,
        CREDIT_CASH_HEADERS.METHOD,
        CREDIT_CASH_HEADERS.CARD_BRAND,
        CREDIT_CASH_HEADERS.BIZ_NO,
        CREDIT_CASH_HEADERS.FILE_NAME,
        CREDIT_CASH_HEADERS.FILE_URL,
        CREDIT_CASH_HEADERS.STATUS
    ]);

    const rootFolder = DriveApp.getFolderById(BRIDGE_INVOICE_FOLDER_ID.ROOT);
    const successFolder = DriveApp.getFolderById(BRIDGE_INVOICE_FOLDER_ID.SUCCESS);
    const failureFolder = DriveApp.getFolderById(BRIDGE_INVOICE_FOLDER_ID.FAILURE);
    const importedIndex = buildImportedFileIndex_(sheet, headerMap, CREDIT_CASH_HEADERS);
    const files = listBridgeInvoiceImportFiles_([rootFolder, successFolder, failureFolder]);

    files.forEach(function (file) {
        const fileId = file.getId();
        const fileName = file.getName();
        const duplicateKey = buildImportedFileKey_(fileId, fileName);

        if (importedIndex[duplicateKey] || importedIndex[buildImportedFileKey_('', fileName)]) {
            console.log(`ブリッジ請求書 取込済みスキップ: ${fileName}`);
            return;
        }

        try {
            console.log(`ブリッジ請求書 解析開始: ${fileName}`);

            const data = callGeminiBridgeInvoiceOcr_(file);
            const row = buildRowByHeaderMap_(headerMap, {
                [CREDIT_CASH_HEADERS.DATE]: normalizeDateString_(data.date),
                [CREDIT_CASH_HEADERS.VENDOR]: data.vendor_name || extractBridgeInvoiceVendorFromFilename_(fileName),
                [CREDIT_CASH_HEADERS.SUBTOTAL]: toNumberOrBlank_(data.subtotal),
                [CREDIT_CASH_HEADERS.TAX]: toNumberOrBlank_(data.tax),
                [CREDIT_CASH_HEADERS.TOTAL]: toNumberOrBlank_(data.total_amount),
                [CREDIT_CASH_HEADERS.METHOD]: '請求書',
                [CREDIT_CASH_HEADERS.CARD_BRAND]: '',
                [CREDIT_CASH_HEADERS.BIZ_NO]: data.invoice_no || data.reference_no || '',
                [CREDIT_CASH_HEADERS.FILE_NAME]: fileName,
                [CREDIT_CASH_HEADERS.FILE_URL]: file.getUrl(),
                [CREDIT_CASH_HEADERS.STATUS]: '未照合'
            });

            const startRow = sheet.getLastRow() + 1;
            sheet.getRange(startRow, 1, 1, row.length).setValues([row]);
            applyBridgeInvoiceAiWarnings_(sheet, startRow, headerMap, data, fileName);

            importedIndex[duplicateKey] = true;
            tryMoveFileToFolder_(file, successFolder, 'ブリッジ請求書');
            console.log(`ブリッジ請求書 取込成功: ${fileName}`);
        } catch (error) {
            const message = error && error.message ? error.message : '不明なエラー';
            console.error(`ブリッジ請求書 エラー: ${fileName} - ${message}`);
            tryMoveFileToFolder_(file, failureFolder, 'ブリッジ請求書エラー');
        }
    });
}


/**
 * Gemini APIを呼び出してレシートを解析
 * 学習シート（読取カテゴリ: 明細読み取り）をプロンプトへ組み込む
 * ※ biz_no は補正・判断誤りの対象外
 */
function callGeminiReceiptOcr_(file) {
    const geminiApiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!geminiApiKey) {
        throw new Error('スクリプトプロパティ GEMINI_API_KEY が設定されていません。');
    }

    const modelName = 'gemini-2.5-flash';
    const blob = file.getBlob();
    const base64Data = Utilities.base64Encode(blob.getBytes());

    const learningData = loadReceiptLearningData_();
    const learningPromptBlock = buildReceiptLearningPromptBlock_(learningData);

    const prompt = `
あなたは自動車整備会社の領収書・作業伝票解析の専門AIです。
添付された画像またはPDFをOCR解析し、指定の情報を抽出してください。

この書類は以下の特徴があります。
・上部に「加盟店」がありますが、これは取引先ではありません
・取引先は下部の「〇〇様」です
・整備番号は下部に手書きで書かれています

【抽出ルール】

■ date
取引日を抽出してください。
YYYY/MM/DD 形式で返してください。
例: 2026/04/17

■ store_name（重要）
取引先は必ず
「〇〇様」
と書かれている名前です。

注意:
・上部の「加盟店」は取引先ではありません
・「様」が付く名前を優先してください
・手書きの可能性があります

例
山田太郎様
鈴木様

■ subtotal
税抜金額（小計）
数値のみ
不明なら0

■ tax
消費税
数値のみ
不明なら0

■ total_amount
税込合計金額
数値のみ

■ payment_method
支払い方法を推定してください

次のルールで判断してください

カード決済の記載
VISA
MASTER
JCB
AMEX
カード
クレジット

→ 「クレカ」

それ以外
→ 「現金」

判断できない場合
→ 「現金」

■ card_brand
入金方法がカード決済の場合のみ、カード会社名を抽出してください。
次のいずれかを優先してください。
- VISA
- MASTER
- JCB

わからなければ「要確認」を返してください。
現金の場合は "" を返してください。

■ biz_no（重要）
整備番号です

特徴
・SBから始まる
・手書き
・下部に記載

例
SB24427

必ず次の形式にしてください

SB00024427

ルール
・SBの後ろは8桁
・不足分は0で左埋め
・見つからない場合は ""

【誤認防止ルール】

以下は絶対に取引先にしない
加盟店
加盟店番号
加盟店名
カード会社

【ai_warnings】
各項目について、読み取りが怪しい場合だけ理由を書いてください。
問題なければ空文字にしてください。

対象:
date
store_name
subtotal
tax
total_amount
payment_method
card_brand

理由の例:
- 読み取りミスの可能性（手書き文字が不鮮明）
- 取引先名の抽出に自信なし
- 金額欄の判読に自信なし
- 支払い方法の判定に自信なし
- カード会社名の判定に自信なし

※ biz_no は ai_warnings の対象にしないでください。
※ biz_no については警告・補正提案・判断誤り指摘をしないでください。

【出力制約】
出力は必ず純粋なJSONのみ。
説明は禁止。
Markdown禁止。

【JSON形式】
{
  "date": "YYYY/MM/DD",
  "store_name": "",
  "subtotal": 0,
  "tax": 0,
  "total_amount": 0,
  "payment_method": "",
  "card_brand": "",
  "biz_no": "",
  "ai_warnings": {
    "date": "",
    "store_name": "",
    "subtotal": "",
    "tax": "",
    "total_amount": "",
    "payment_method": "",
    "card_brand": ""
  }
}

${learningPromptBlock}
    `.trim();

    const payload = {
        contents: [{
            parts: [
                { text: prompt },
                { inline_data: { mime_type: blob.getContentType(), data: base64Data } }
            ]
        }],
        generationConfig: {
            response_mime_type: 'application/json'
        }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
    const options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);

    if (response.getResponseCode() !== 200) {
        throw new Error('Gemini APIエラー: ' + response.getContentText());
    }

    try {
        const resJson = JSON.parse(response.getContentText());
        const resultText = resJson.candidates[0].content.parts[0].text;
        const parsed = JSON.parse(resultText);

        parsed.ai_warnings = normalizeReceiptWarnings_(parsed.ai_warnings);
        return parsed;
    } catch (e) {
        throw new Error('解析結果のパースに失敗しました。AIの回答がJSON形式ではありません。');
    }
}


/**
 * Gemini APIでブリッジ宛請求書を解析
 */
function callGeminiBridgeInvoiceOcr_(file) {
    const geminiApiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!geminiApiKey) {
        throw new Error('スクリプトプロパティ GEMINI_API_KEY が設定されていません。');
    }

    const blob = file.getBlob();
    const base64Data = Utilities.base64Encode(blob.getBytes());
    const modelName = 'gemini-2.5-flash';
    const prompt = `
あなたは日本語の車両請求書OCR解析AIです。
入力PDFは「株式会社ブリッジ」宛の請求書です。
本文をOCRし、会計転記用のJSONだけを返してください。

【抽出対象】
- date: 請求日。YYYY/MM/DD
- vendor_name: 請求元の会社名または氏名
- subtotal: 税抜金額。数値のみ。不明なら total_amount - tax を推定
- tax: 消費税額。数値のみ。不明なら 0
- total_amount: 請求合計額。数値のみ
- invoice_no: 請求書番号。不明なら ""
- reference_no: 型式、案件番号、車台番号下4桁など、照合に使える補助番号。不明なら ""

【重要ルール】
- 宛先の「株式会社ブリッジ」「ブリッジ御中」は vendor_name にしない
- vendor_name は請求元を返す
- 「LANDROVER」「RANGE ROVER」「DEFENDER」など車名は vendor_name にしない
- 文字が不鮮明なら filename から推定してよいが、根拠が弱い場合は ai_warnings.vendor_name に書く
- JSON以外の説明は禁止

【ai_warnings】
次の各項目に不安がある場合だけ理由を書く
- date
- vendor_name
- subtotal
- tax
- total_amount
- invoice_no

【返却JSON】
{
  "date": "YYYY/MM/DD",
  "vendor_name": "",
  "subtotal": 0,
  "tax": 0,
  "total_amount": 0,
  "invoice_no": "",
  "reference_no": "",
  "ai_warnings": {
    "date": "",
    "vendor_name": "",
    "subtotal": "",
    "tax": "",
    "total_amount": "",
    "invoice_no": ""
  }
}
    `.trim();

    const payload = {
        contents: [{
            parts: [
                { text: prompt + '\nfilename: ' + file.getName() },
                { inline_data: { mime_type: blob.getContentType(), data: base64Data } }
            ]
        }],
        generationConfig: {
            response_mime_type: 'application/json'
        }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
    const response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
        throw new Error('Gemini APIエラー: ' + response.getContentText());
    }

    try {
        const resJson = JSON.parse(response.getContentText());
        const resultText = resJson.candidates[0].content.parts[0].text;
        const parsed = JSON.parse(resultText);

        parsed.vendor_name = String(parsed.vendor_name || '').trim();
        parsed.date = normalizeDateString_(parsed.date);
        parsed.subtotal = toNumberOrBlank_(parsed.subtotal);
        parsed.tax = toNumberOrBlank_(parsed.tax);
        parsed.total_amount = toNumberOrBlank_(parsed.total_amount);
        parsed.invoice_no = String(parsed.invoice_no || '').trim();
        parsed.reference_no = String(parsed.reference_no || '').trim();
        parsed.ai_warnings = normalizeBridgeInvoiceWarnings_(parsed.ai_warnings);

        if (!parsed.vendor_name) {
            parsed.vendor_name = extractBridgeInvoiceVendorFromFilename_(file.getName());
            if (parsed.vendor_name && !parsed.ai_warnings.vendor_name) {
                parsed.ai_warnings.vendor_name = 'ファイル名から請求元を補完しました。';
            }
        }

        if (!parsed.total_amount && parsed.subtotal !== '' && parsed.tax !== '') {
            parsed.total_amount = toNumberSafe_(parsed.subtotal) + toNumberSafe_(parsed.tax);
        }
        if (parsed.subtotal === '' && parsed.total_amount !== '') {
            parsed.subtotal = Math.max(toNumberSafe_(parsed.total_amount) - toNumberSafe_(parsed.tax), 0);
        }

        if (!parsed.date || !parsed.vendor_name || parsed.total_amount === '') {
            throw new Error('請求日・請求元・合計金額のいずれかを抽出できませんでした。');
        }

        return parsed;
    } catch (e) {
        throw new Error('請求書OCR結果のパースに失敗しました。' + e.message);
    }
}


function normalizeBridgeInvoiceWarnings_(warnings) {
    return {
        date: warnings && warnings.date ? String(warnings.date).trim() : '',
        vendor_name: warnings && warnings.vendor_name ? String(warnings.vendor_name).trim() : '',
        subtotal: warnings && warnings.subtotal ? String(warnings.subtotal).trim() : '',
        tax: warnings && warnings.tax ? String(warnings.tax).trim() : '',
        total_amount: warnings && warnings.total_amount ? String(warnings.total_amount).trim() : '',
        invoice_no: warnings && warnings.invoice_no ? String(warnings.invoice_no).trim() : ''
    };
}


function extractBridgeInvoiceVendorFromFilename_(fileName) {
    const name = String(fileName || '').replace(/\.pdf$/i, '');
    const cleaned = name
        .replace(/^請求書[_\-]*/i, '')
        .replace(/(下取|売上|納品書|請求書).*/i, '')
        .replace(/[_\-]/g, ' ')
        .trim();
    return cleaned;
}


/**
 * クレカ種別を決定する
 * 優先: VISA / MASTER / JCB
 * 不明なら 要確認
 * 現金の場合は空欄
 */
function decideCardBrand_(paymentMethod, cardBrand) {
    const method = String(paymentMethod || '').toUpperCase();
    const brand = String(cardBrand || '').toUpperCase();

    if (method !== 'クレカ') {
        return '';
    }

    if (brand.indexOf('VISA') >= 0) return 'VISA';
    if (brand.indexOf('MASTER') >= 0) return 'MASTER';
    if (brand.indexOf('JCB') >= 0) return 'JCB';

    return '要確認';
}


/**
 * ai_warnings を正規化
 * ※ biz_no は対象外
 */
function normalizeReceiptWarnings_(warnings) {
    return {
        date: warnings && warnings.date ? String(warnings.date).trim() : '',
        store_name: warnings && warnings.store_name ? String(warnings.store_name).trim() : '',
        subtotal: warnings && warnings.subtotal ? String(warnings.subtotal).trim() : '',
        tax: warnings && warnings.tax ? String(warnings.tax).trim() : '',
        total_amount: warnings && warnings.total_amount ? String(warnings.total_amount).trim() : '',
        payment_method: warnings && warnings.payment_method ? String(warnings.payment_method).trim() : '',
        card_brand: warnings && warnings.card_brand ? String(warnings.card_brand).trim() : ''
    };
}


/**
 * シートの該当セルへAI警告メモを追加し、学習シートへ記録する
 * ※ biz_no は対象外
 */
function applyReceiptAiWarnings_(sheet, rowIndex, headerMap, HEADERS, data, fileName) {
    const fieldSettings = [
        { warningKey: 'date', headerName: HEADERS.DATE },
        { warningKey: 'store_name', headerName: HEADERS.VENDOR },
        { warningKey: 'subtotal', headerName: HEADERS.SUBTOTAL },
        { warningKey: 'tax', headerName: HEADERS.TAX },
        { warningKey: 'total_amount', headerName: HEADERS.TOTAL },
        { warningKey: 'payment_method', headerName: HEADERS.METHOD },
        { warningKey: 'card_brand', headerName: HEADERS.CARD_BRAND }
    ];

    const warnings = data.ai_warnings || {};
    const learningRows = [];
    const readAt = new Date();

    fieldSettings.forEach(function (setting) {
        const warning = warnings[setting.warningKey] ? String(warnings[setting.warningKey]).trim() : '';
        if (!warning) return;

        const colIndex = headerMap[setting.headerName];
        if (!colIndex) return;

        const cell = sheet.getRange(rowIndex, colIndex);
        cell.setBackground('#FFF2CC');
        cell.setNote(`AI判定：${warning}`);

        learningRows.push({
            readAt: readAt,
            fileName: fileName,
            fileUrl: sheet.getRange(rowIndex, headerMap[HEADERS.FILE_URL]).getValue(),
            sheetName: 'クレカ・現金',
            targetColumn: setting.headerName,
            targetData: getReceiptFieldValue_(data, setting.warningKey),
            reason: warning
        });
    });

    appendReadingLearningRows_(learningRows);
}


/**
 * 明細読み取りの対象値を返す
 */
function getReceiptFieldValue_(data, key) {
    const value = data && data[key] !== undefined && data[key] !== null ? data[key] : '';
    return String(value);
}


/**
 * AI読み取り学習用シートから「明細読み取り」の学習データを取得
 * 対象正データ または 学習指示 がある行のみ使用
 */
function loadReceiptLearningData_() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = 'AI読み取り学習用';

    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() <= 1) return [];

    const headerMap = getHeaderMap_(sheet);
    const requiredHeaders = [
        '読み取り日付',
        'ファイル名',
        'ファイルURL',
        '該当シート',
        '該当列',
        '読取データ',
        '正データ',
        '学習指示',
        '判定理由'
    ];

    const missing = requiredHeaders.filter(function (h) {
        return !headerMap[h];
    });
    if (missing.length > 0) {
        throw new Error(`AI読み取り学習用シートの必須ヘッダー不足: ${missing.join(', ')}`);
    }

    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

    return values.map(function (row) {
        return {
            readAt: row[headerMap['読み取り日付'] - 1] || '',
            fileName: String(row[headerMap['ファイル名'] - 1] || '').trim(),
            fileUrl: String(row[headerMap['ファイルURL'] - 1] || '').trim(),
            sheetName: String(row[headerMap['該当シート'] - 1] || '').trim(),
            targetColumn: String(row[headerMap['該当列'] - 1] || '').trim(),
            targetData: String(row[headerMap['読取データ'] - 1] || '').trim(),
            correctedData: String(row[headerMap['正データ'] - 1] || '').trim(),
            instruction: String(row[headerMap['学習指示'] - 1] || '').trim(),
            reason: String(row[headerMap['判定理由'] - 1] || '').trim()
        };
    }).filter(function (item) {
        return item.sheetName === 'クレカ・現金' && (item.correctedData || item.instruction);
    });
}


/**
 * 明細読み取りの学習データをプロンプトへ組み込める形に整形
 */
function buildReceiptLearningPromptBlock_(learningData) {
    if (!learningData || learningData.length === 0) return '';

    const lines = [];
    lines.push('--------------------------------');
    lines.push('■ AI読み取り学習用シートの学習ルール');
    lines.push('以下は過去の読み取り結果に対して、人が確認・補正した学習データです。');
    lines.push('今回の読み取りでは、以下を優先的に参考にしてください。');
    lines.push('');

    learningData.forEach(function (item, index) {
        lines.push(`【学習例 ${index + 1}】`);
        lines.push(`ファイル名: ${item.fileName || ''}`);
        lines.push(`該当シート: ${item.sheetName || ''}`);
        lines.push(`該当列: ${item.targetColumn || ''}`);
        lines.push(`読取データ: ${item.targetData || ''}`);
        lines.push(`正データ: ${item.correctedData || ''}`);
        lines.push(`学習指示: ${item.instruction || ''}`);
        lines.push(`判定理由: ${item.reason || ''}`);
        lines.push('');
    });

    lines.push('学習ルール:');
    lines.push('- 正データがある場合は、その値を優先して採用してください。');
    lines.push('- 学習指示がある場合は、その指示に従って判定してください。');
    lines.push('- ただし、今回の画像/PDF本文と明確に矛盾する場合は、今回の画像/PDF本文を優先してください。');
    lines.push('- 過去例に似ていても、根拠なく機械的に当てはめず、今回の帳票内容を確認してください。');
    lines.push('- biz_no については補正や警告対象にしないでください。');
    lines.push('- クレカ種別は VISA / MASTER / JCB を優先し、不明なら要確認にしてください。');
    lines.push('--------------------------------');

    return lines.join('\n');
}


/**
 * AI読み取り学習用シートに追記
 */
function appendReadingLearningRows_(rows) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const SHEET_NAME = 'AI読み取り学習用';
    if (!rows || rows.length === 0) return;

    const requiredHeaders = [
        '読み取り日付',
        'ファイル名',
        'ファイルURL',
        '該当シート',
        '該当列',
        '読取データ',
        '正データ',
        '学習指示',
        '判定理由'
    ];

    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
        sheet = ss.insertSheet(SHEET_NAME);
    }

    const lastCol = Math.max(sheet.getLastColumn(), 1);
    const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(v => String(v || '').trim());

    // ヘッダー初期化 or 追加
    if (sheet.getLastRow() === 0 || currentHeaders.every(v => !v)) {
        sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    } else {
        const existingSet = {};
        currentHeaders.forEach(h => { if (h) existingSet[h] = true; });

        const missingHeaders = requiredHeaders.filter(h => !existingSet[h]);
        if (missingHeaders.length > 0) {
            const startCol = sheet.getLastColumn() + 1;
            sheet.getRange(1, startCol, 1, missingHeaders.length).setValues([missingHeaders]);
        }
    }

    const headerMap = getHeaderMap_(sheet);
    const maxCol = sheet.getLastColumn();

    const outputRows = rows.map(item => {
        const row = Array(maxCol).fill('');

        row[headerMap['読み取り日付'] - 1] = item.readAt;
        row[headerMap['ファイル名'] - 1] = item.fileName;
        row[headerMap['ファイルURL'] - 1] = item.fileUrl;
        row[headerMap['該当シート'] - 1] = item.sheetName;
        row[headerMap['該当列'] - 1] = item.targetColumn;
        row[headerMap['読取データ'] - 1] = item.targetData;
        row[headerMap['正データ'] - 1] = '';
        row[headerMap['学習指示'] - 1] = '';
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


function applyBridgeInvoiceAiWarnings_(sheet, rowIndex, headerMap, data, fileName) {
    const warningSettings = [
        { warningKey: 'date', headerName: CREDIT_CASH_HEADERS.DATE },
        { warningKey: 'vendor_name', headerName: CREDIT_CASH_HEADERS.VENDOR },
        { warningKey: 'subtotal', headerName: CREDIT_CASH_HEADERS.SUBTOTAL },
        { warningKey: 'tax', headerName: CREDIT_CASH_HEADERS.TAX },
        { warningKey: 'total_amount', headerName: CREDIT_CASH_HEADERS.TOTAL },
        { warningKey: 'invoice_no', headerName: CREDIT_CASH_HEADERS.BIZ_NO }
    ];

    const warnings = data.ai_warnings || {};
    const learningRows = [];
    const readAt = new Date();
    const fileUrl = headerMap[CREDIT_CASH_HEADERS.FILE_URL]
        ? sheet.getRange(rowIndex, headerMap[CREDIT_CASH_HEADERS.FILE_URL]).getValue()
        : '';

    warningSettings.forEach(function (setting) {
        const warning = warnings[setting.warningKey] ? String(warnings[setting.warningKey]).trim() : '';
        if (!warning) return;

        const colIndex = headerMap[setting.headerName];
        if (!colIndex) return;

        const cell = sheet.getRange(rowIndex, colIndex);
        cell.setBackground('#FFF2CC');
        cell.setNote(`AI判定：${warning}`);

        learningRows.push({
            readAt: readAt,
            fileName: fileName,
            fileUrl: fileUrl,
            sheetName: CREDIT_CASH_SHEET_NAME,
            targetColumn: setting.headerName,
            targetData: getBridgeInvoiceFieldValue_(data, setting.warningKey),
            reason: warning
        });
    });

    appendReadingLearningRows_(learningRows);
}


function getBridgeInvoiceFieldValue_(data, key) {
    const value = data && data[key] !== undefined && data[key] !== null ? data[key] : '';
    return String(value);
}


function listBridgeInvoiceImportFiles_(folders) {
    const seen = {};
    const files = [];

    folders.forEach(function (folder) {
        const iterator = folder.getFiles();
        while (iterator.hasNext()) {
            const file = iterator.next();
            if (file.getMimeType() !== MimeType.PDF) continue;
            const id = file.getId();
            if (seen[id]) continue;
            if (!isBridgeInvoiceCandidateFileName_(file.getName())) continue;
            seen[id] = true;
            files.push(file);
        }
    });

    return files;
}


function isBridgeInvoiceCandidateFileName_(fileName) {
    const normalized = String(fileName || '').normalize('NFKC');
    return normalized.indexOf('請求書') >= 0 ||
        normalized.indexOf('下取') >= 0 ||
        normalized.indexOf('売上') >= 0;
}


function buildImportedFileIndex_(sheet, headerMap, headers) {
    const fileNameCol = headerMap[headers.FILE_NAME];
    const fileUrlCol = headerMap[headers.FILE_URL];
    const index = {};
    const lastRow = sheet.getLastRow();

    if (lastRow < 2 || !fileNameCol) {
        return index;
    }

    const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    values.forEach(function (row) {
        const fileName = String(row[fileNameCol - 1] || '').trim();
        const fileUrl = fileUrlCol ? String(row[fileUrlCol - 1] || '').trim() : '';
        const fileId = extractDriveFileIdFromUrl_(fileUrl);
        if (!fileName) return;
        index[buildImportedFileKey_(fileId, fileName)] = true;
        index[buildImportedFileKey_('', fileName)] = true;
    });

    return index;
}


function buildImportedFileKey_(fileId, fileName) {
    return `${String(fileId || '').trim()}::${String(fileName || '').trim()}`;
}


function extractDriveFileIdFromUrl_(url) {
    const value = String(url || '').trim();
    if (!value) return '';

    const dMatch = value.match(/\/d\/([a-zA-Z0-9\-_]+)/);
    if (dMatch) return dMatch[1];

    const idMatch = value.match(/[?&]id=([a-zA-Z0-9\-_]+)/);
    return idMatch ? idMatch[1] : '';
}


function tryMoveFileToFolder_(file, folder, label) {
    try {
        const parents = file.getParents();
        while (parents.hasNext()) {
            const parent = parents.next();
            if (parent.getId() === folder.getId()) {
                return true;
            }
        }
        file.moveTo(folder);
        return true;
    } catch (error) {
        console.log(`${label} 移動スキップ: ${file.getName()} / ${error.message}`);
        return false;
    }
}


/**
 * シート1行目の配列からヘッダー名→列番号のマップを作る
 */
function getHeaderMapByRow_(headers) {
    const map = {};
    headers.forEach(function (header, index) {
        const name = String(header || '').trim();
        if (name) {
            map[name] = index + 1;
        }
    });
    return map;
}


/**
 * 「クレカ・現金」シートの「入金月」カラムに数式をセットする
 */
function setDepositMonthFormula() {
    const SHEET_NAME = 'クレカ・現金';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
        console.error(`シート「${SHEET_NAME}」が見つかりません。`);
        return;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
        console.log('データ行が存在しません。');
        return;
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const targetHeaderName = '入金月';
    const dateHeaderName = '取引日';

    const targetColIdx = headers.indexOf(targetHeaderName) + 1;
    const dateColIdx = headers.indexOf(dateHeaderName) + 1;

    if (targetColIdx === 0) {
        console.error(`「${targetHeaderName}」列が見つかりません。`);
        return;
    }
    if (dateColIdx === 0) {
        console.error(`「${dateHeaderName}」列が見つかりません。`);
        return;
    }

    const dateColLetter = columnToLetter_(dateColIdx);
    const formula = `=IF(ISDATE(${dateColLetter}2), IF(DAY(${dateColLetter}2)<15, DATE(YEAR(${dateColLetter}2), MONTH(${dateColLetter}2), 1), DATE(YEAR(${dateColLetter}2), MONTH(${dateColLetter}2)+1, 1)), "")`;

    const targetRange = sheet.getRange(2, targetColIdx, lastRow - 1, 1);
    targetRange.setFormula(formula);

    console.log(`「${targetHeaderName}」列の2行目から${lastRow}行目まで数式をセットしました。`);
}


/**
 * 列番号をアルファベットに変換する補助関数
 */
function columnToLetter_(column) {
    let temp, letter = '';
    while (column > 0) {
        temp = (column - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        column = (column - temp - 1) / 26;
    }
    return letter;
}



/**
 * 銀行PDFをOCRし、「銀行データチェック用」シートへ追記する
 *
 * 想定ヘッダー:
 * 日付 / 金額 / 相手摘要 / 相手科目
 * 追加で存在する場合に書き込むヘッダー:
 * ステータス / 入金月
 */
function processBankPdfsWithGemini() {
    const SHEET_NAME = '銀行データチェック用';

    const FOLDER_ID = {
        INPUT: '1RkJM7UOdQbhMh3IjjMX0Ner4_F4SGg54',
        SUCCESS: '1mC5iTSXSeNyZQuXX75Jp8Xe6Bv8WN5_D',
        FAILURE: '1q6qrZBLIaB6H6ZE5EhsbvP27gowIKvZn'
    };

    const HEADERS = {
        DATE: '日付',
        AMOUNT: '金額',
        PARTNER_SUMMARY: '相手摘要',
        COUNTER_ACCOUNT: '相手科目',
        STATUS: 'ステータス',
        DEPOSIT_MONTH: '入金月'
    };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
        throw new Error(`シート「${SHEET_NAME}」が見つかりません。`);
    }

    const headerMap = getHeaderMap_(sheet);
    validateRequiredHeaders_(headerMap, [
        HEADERS.DATE,
        HEADERS.AMOUNT,
        HEADERS.PARTNER_SUMMARY,
        HEADERS.COUNTER_ACCOUNT,
        HEADERS.STATUS,
        HEADERS.DEPOSIT_MONTH
    ]);

    const inputFolder = DriveApp.getFolderById(FOLDER_ID.INPUT);
    const successFolder = DriveApp.getFolderById(FOLDER_ID.SUCCESS);
    const failureFolder = DriveApp.getFolderById(FOLDER_ID.FAILURE);

    const files = inputFolder.getFiles();

    while (files.hasNext()) {
        const file = files.next();
        const mimeType = file.getMimeType();
        if (mimeType !== MimeType.PDF) continue;

        let fileUrl = '';
        let status = 'SUCCESS';
        let message = '';

        try {
            console.log(`解析開始: ${file.getName()}`);

            const result = callGeminiBankPdfOcr_(file);
            const transactions = Array.isArray(result.transactions) ? result.transactions : [];
            const excludedTransactions = Array.isArray(result.excluded_transactions) ? result.excluded_transactions : [];

            if (transactions.length > 0) {
                const rows = transactions.map(function (tx) {
                    const normalizedDate = normalizeDateString_(tx.date);
                    const depositMonth = normalizedDate ? toMonthFirst_(normalizedDate) : '';

                    return buildRowByHeaderMap_(headerMap, {
                        [HEADERS.DATE]: normalizedDate,
                        [HEADERS.AMOUNT]: toNumberOrBlank_(tx.amount),
                        [HEADERS.PARTNER_SUMMARY]: tx.partner_summary || '',
                        [HEADERS.COUNTER_ACCOUNT]: tx.counter_account || '',
                        [HEADERS.STATUS]: '未照合',
                        [HEADERS.DEPOSIT_MONTH]: depositMonth
                    });
                });

                const startRow = sheet.getLastRow() + 1;
                const numCols = sheet.getLastColumn();

                sheet.getRange(startRow, 1, rows.length, numCols).setValues(rows);
                applyNumberFormats_(sheet, startRow, rows.length, headerMap, HEADERS);
            }

            file.moveTo(successFolder);
            fileUrl = file.getUrl();

            console.log(`成功: ${file.getName()} / 採用 ${transactions.length}件 / 除外 ${excludedTransactions.length}件`);
        } catch (e) {
            status = 'ERROR';
            message = e && e.message ? e.message : '不明なエラー';

            console.error(`エラー: ${file.getName()} - ${message}`);
            file.moveTo(failureFolder);
            fileUrl = file.getUrl();
        }
    }
}


/**
 * Gemini APIで銀行PDFをOCRし、
 * 1) 売上入金として採用した明細
 * 2) 入金だが売上計上しないため除外した明細
 * を返す
 */
function callGeminiBankPdfOcr_(file) {
    const geminiApiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!geminiApiKey) {
        throw new Error('スクリプトプロパティ GEMINI_API_KEY が設定されていません。');
    }

    const modelName = 'gemini-2.5-flash';
    const blob = file.getBlob();
    const base64Data = Utilities.base64Encode(blob.getBytes());

    const prompt = `
あなたは日本語の会計帳票OCR解析AIです。
入力は「普通預金」の銀行元帳PDFです。

この帳票は会計ソフトから出力された銀行元帳です。
表形式で記載されており、1取引が複数行に分かれて表示される場合があります。

目的

銀行に振り込まれた入金を解析し

① 売上入金として採用するもの
② 入金だが売上ではないため除外するもの

を判定してJSONで出力してください。

さらに、採用した transactions のうち、
読み取りミス・振り分けミス・イレギュラーなどが疑われる場合は
項目ごとの警告を ai_warnings に記載してください。

--------------------------------

■帳票構造

入力帳票は「普通預金」の銀行元帳です。

主な列

日付
自摘要
相手科目
相手摘要
借方金額
貸方金額
残高

--------------------------------

■最重要ルール

この帳票では

借方金額 = 入金
貸方金額 = 出金

です。

読取対象は「借方金額に数値がある取引のみ」です。

次の取引は完全に無視してください。

- 借方金額が空欄
- 借方金額が 0
- 借方金額が不明
- 借方金額が存在しない
- 貸方金額のみある取引
- 出金取引

借方金額に数値がある取引だけを解析対象としてください。

これらの無効取引は
transactions にも excluded_transactions にも出力してはいけません。

--------------------------------

■取引単位

1取引 = 1レコードです。

OCRでは1取引が複数行に分かれる場合があります。

次の行が新しい取引の開始です

・日付が表示されている行
・番号が表示されている行

その行から次の「日付行」または「番号行」までを
1取引としてまとめて解析してください。

--------------------------------

■判定方法（重要）

判断は一般簿記の知識に基づいて行ってください。

相手科目は仕訳の相手勘定です。
相手科目を見ることで取引の性質を判断できます。

--------------------------------

■売上入金の判定ルール

次の優先順位で判断してください。

① 相手科目 = 売掛金
この場合は売上入金として扱います。

② 相手科目 = 保険手数料
この場合は売上入金として扱います。

③ 相手科目 = 受取手数料
この場合は売上入金として扱います。

④ 相手科目 = 諸口

この場合は相手摘要から実際の取引内容を判断してください。

以下の内容が含まれる場合は売上入金として扱います

- 顧客名
- 法人名
- 車名
- 案件番号
- 信販会社
- オークション会社
- 売上案件と判断できる情報
- 保険手数料
- 受取手数料

ただし次の内容が含まれる場合は売上入金ではありません

- 借入
- 借入金
- 資金移動
- 利息
- 配当
- 仮受金
- 返金
- 雑収入
- 預り金
- 税金
- 法定費用

⑤ 上記以外

売上入金ではありません。

--------------------------------

■売上ではない入金（除外）

次の科目は売上入金ではありません

受取利息
受取配当金
雑収入
仮受金
短期借入金
長期借入金
資金移動
普通預金(入金)
返金
キックバック
保険金
預り金
自賠責
希望番号
住民税
法定費用

ただしこれらを excluded_transactions に出力するのは
借方金額に値がある入金取引のみです。

--------------------------------

■相手摘要の抽出ルール

partner_summary は必ず
「相手摘要」列の文字を優先して抽出してください。

行全体を要約して作らないでください。

次の情報を混ぜないでください

- 金額
- 残高

相手摘要が空欄の場合のみ
自摘要から相手摘要相当部分を補完してください。

--------------------------------

■ai_warnings のルール

ai_warnings は object で返してください。

疑わしい場合のみ理由を書いてください。
問題がなければ空文字にしてください。

対象項目

date
amount
partner_summary
counter_account

理由の例

- 読み取りミスの可能性（文字が不鮮明）
- 読み取りミスの可能性（日付補完に自信なし）
- 振り分けミスの可能性（諸口のため要確認）
- 相手科目の判定に自信なし

--------------------------------

■出力形式

JSONのみ出力してください。
説明文やMarkdownは禁止です。

{
  "transactions": [
    {
      "date": "YYYY/MM/DD",
      "amount": 0,
      "partner_summary": "",
      "counter_account": ""
    }
  ],
  "excluded_transactions": [
    {
      "date": "YYYY/MM/DD",
      "amount": 0,
      "partner_summary": "",
      "counter_account": "",
      "reason": ""
    }
  ]
}
    `.trim();

    const payload = {
        contents: [
            {
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: blob.getContentType(),
                            data: base64Data
                        }
                    }
                ]
            }
        ],
        generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0
        }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
    const options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
        throw new Error(`Gemini APIエラー: ${responseText}`);
    }

    let parsed;
    try {
        parsed = JSON.parse(responseText);
    } catch (e) {
        throw new Error(`Gemini APIレスポンスのJSONパースに失敗しました: ${e.message}`);
    }

    const resultText =
        parsed &&
        parsed.candidates &&
        parsed.candidates[0] &&
        parsed.candidates[0].content &&
        parsed.candidates[0].content.parts &&
        parsed.candidates[0].content.parts[0] &&
        parsed.candidates[0].content.parts[0].text;

    if (!resultText) {
        throw new Error(`Geminiの応答本文が取得できませんでした: ${responseText}`);
    }

    let resultJson;
    try {
        resultJson = JSON.parse(resultText);
    } catch (e) {
        throw new Error(`Geminiの返却テキストがJSONではありません: ${resultText}`);
    }

    const normalizeList = function (list, withReason) {
        if (!Array.isArray(list)) return [];
        return list.map(function (tx) {
            return {
                date: normalizeBankDateForGeminiResult_(tx.date),
                amount: toNumberSafe_(tx.amount),
                partner_summary: tx.partner_summary ? String(tx.partner_summary).trim() : '',
                counter_account: tx.counter_account ? String(tx.counter_account).trim() : ''
            };
        });
    };

    return {
        transactions: normalizeList(resultJson.transactions, false),
        excluded_transactions: normalizeList(resultJson.excluded_transactions, true),
        ocr_tokens:
            parsed &&
                parsed.usageMetadata &&
                typeof parsed.usageMetadata.totalTokenCount === 'number'
                ? parsed.usageMetadata.totalTokenCount
                : ''
    };
}


/**
 * 1行目のヘッダー名から列番号マップを作る
 */
function getHeaderMap_(sheet) {
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
        throw new Error('シートにヘッダー行がありません。');
    }

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const map = {};

    headers.forEach(function (header, index) {
        const name = String(header || '').trim();
        if (name) {
            map[name] = index + 1;
        }
    });

    return map;
}


/**
 * 必須ヘッダー存在チェック
 */
function validateRequiredHeaders_(headerMap, requiredHeaders) {
    const missing = requiredHeaders.filter(function (name) {
        return !headerMap[name];
    });
    if (missing.length > 0) {
        throw new Error(`必須ヘッダーが不足しています: ${missing.join(', ')}`);
    }
}


/**
 * ヘッダーマップに合わせて1行配列を作成
 */
function buildRowByHeaderMap_(headerMap, valueMap) {
    const maxCol = Math.max.apply(null, Object.values(headerMap));
    const row = Array(maxCol).fill('');

    Object.keys(headerMap).forEach(function (headerName) {
        const colIndex = headerMap[headerName] - 1;
        row[colIndex] = valueMap[headerName] !== undefined ? valueMap[headerName] : '';
    });

    return row;
}


/**
 * 文字列日付を YYYY/MM/DD に正規化
 */
function normalizeDateString_(value) {
    if (!value) return '';

    const s = String(value).trim();
    const m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (!m) return s;

    const y = m[1];
    const mo = ('0' + Number(m[2])).slice(-2);
    const d = ('0' + Number(m[3])).slice(-2);
    return `${y}/${mo}/${d}`;
}


/**
 * Gemini返却日付の正規化
 */
function normalizeBankDateForGeminiResult_(value) {
    if (!value) return '';

    const s = String(value).trim().replace(/[.\-]/g, '/');
    const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m) return s;

    const y = m[1];
    const mo = ('0' + Number(m[2])).slice(-2);
    const d = ('0' + Number(m[3])).slice(-2);
    return `${y}/${mo}/${d}`;
}


/**
 * YYYY/MM/DD -> YYYY/MM/01
 */
function toMonthFirst_(dateStr) {
    const m = String(dateStr).match(/^(\d{4})\/(\d{2})\/\d{2}$/);
    if (!m) return '';
    return `${m[1]}/${m[2]}/01`;
}


/**
 * 数値化。失敗したら空欄
 */
function toNumberOrBlank_(value) {
    if (value === null || value === undefined || value === '') return '';
    const num = Number(String(value).replace(/,/g, '').trim());
    return isNaN(num) ? '' : num;
}


/**
 * 数値を安全に number 化
 */
function toNumberSafe_(value) {
    if (value === null || value === undefined || value === '') return 0;

    const num = Number(String(value).replace(/,/g, '').trim());
    return isNaN(num) ? 0 : num;
}


/**
 * 表示形式設定
 */
function applyNumberFormats_(sheet, startRow, rowCount, headerMap, HEADERS) {
    if (rowCount <= 0) return;

    if (headerMap[HEADERS.DATE]) {
        sheet.getRange(startRow, headerMap[HEADERS.DATE], rowCount, 1).setNumberFormat('yyyy/mm/dd');
    }
    if (headerMap[HEADERS.DEPOSIT_MONTH]) {
        sheet.getRange(startRow, headerMap[HEADERS.DEPOSIT_MONTH], rowCount, 1).setNumberFormat('yyyy/mm');
    }
    if (headerMap[HEADERS.AMOUNT]) {
        sheet.getRange(startRow, headerMap[HEADERS.AMOUNT], rowCount, 1).setNumberFormat('#,##0');
    }
}
