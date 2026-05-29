/**
 * ============================================================
 * 顧客対応状況PDF 取込スクリプト 修正版v2
 * 修正内容:
 * 1. タイムアウト時に自動継続トリガーを設定
 * 2. 途中状態のファイルを優先処理
 * 3. writeImportTempTextFile_のfileID返却バグ修正
 * 4. appendRecordsToProgressFile_のエラー処理強化
 * ============================================================
 */

const CFG = {
  PDF_FOLDER_ID: '1Lyv3oWFDFItT6PO2MdygdWte8h5eU-4B',
  DONE_FOLDER_ID: '1LYSgwUdjvf9JZGuC7brtvI8C_wdPvhiY',
  ERR_FOLDER_ID: '1vPQ1FTzHxfx1Pm5GSRnC1mqPLWV49c5I',
  STAGE1_SHEET: 'OCR生データ',
  STAGE2_SHEET_SYAKEN: '顧客対応状況（車検）',
  STAGE2_SHEET_12TEN: '顧客対応状況（12点）',
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
  CONTINUATION_TRIGGER_DELAY_MS: 90000  // 1.5分後に自動継続
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

function onOpen() {
  setVehicleSalesDropdown_();
  SpreadsheetApp.getUi()
    .createMenu('データ取り込み')
    .addItem('PDFから取り込み', 'runDailyImport')
    .addItem('PDFフォルダ確認', 'debugListPdfFiles')
    .addItem('PDF1件テスト', 'debugSingleFile')
    .addItem('継続トリガー削除', 'clearContinuationTriggers')
    .addToUi();
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

// ============================================================
// 継続トリガー管理
// ============================================================

function scheduleContinuationTrigger_() {
  // 既存の継続トリガーを削除してから新たに設定
  clearContinuationTriggers_();
  ScriptApp.newTrigger('runDailyImport')
    .timeBased()
    .after(CFG.CONTINUATION_TRIGGER_DELAY_MS)
    .create();
  Logger.log('継続トリガーを設定しました（' + Math.round(CFG.CONTINUATION_TRIGGER_DELAY_MS / 1000) + '秒後に再実行）');
}

function clearContinuationTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    // 時間ベースの runDailyImport トリガーを削除（日次トリガーは削除しない）
    if (t.getHandlerFunction() === 'runDailyImport' &&
        t.getEventType() === ScriptApp.EventType.CLOCK) {
      try {
        ScriptApp.deleteTrigger(t);
      } catch (e) {
        Logger.log('トリガー削除失敗: ' + e.message);
      }
    }
  });
}

// メニューから呼び出し可能な公開版
function clearContinuationTriggers() {
  clearContinuationTriggers_();
  Logger.log('継続トリガーを全て削除しました');
}

// ============================================================
// メイン処理
// ============================================================

function runDailyImport() {
  const startTime = Date.now();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    validateRuntimeConfig_();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const stage1Sheet = getOrCreateSheet_(ss, CFG.STAGE1_SHEET, STAGE1_HEADERS);

    const rootFolder = DriveApp.getFolderById(CFG.PDF_FOLDER_ID);
    const doneFolder = DriveApp.getFolderById(CFG.DONE_FOLDER_ID);
    const errFolder = DriveApp.getFolderById(CFG.ERR_FOLDER_ID);
    const pdfFiles = getPdfFilesInFolder_(rootFolder);

    Logger.log('対象フォルダ: ' + rootFolder.getName() + ' / ' + CFG.PDF_FOLDER_ID);
    Logger.log('検出PDF件数: ' + pdfFiles.length);

    if (pdfFiles.length === 0) {
      Logger.log('PDFファイルが見つかりませんでした。');
      Logger.log('注意: サブフォルダ内のPDFやショートカットは対象外です。');
      // 継続トリガーが残っていれば削除
      clearContinuationTriggers_();
      return;
    }

    // 【修正1】途中状態のファイルを先頭に並び替え（再開優先）
    const filesWithState = pdfFiles.filter(function(f) {
      return loadFileProgressState_(f.getId()) !== null;
    });
    const filesWithoutState = pdfFiles.filter(function(f) {
      return loadFileProgressState_(f.getId()) === null;
    });
    const sortedFiles = filesWithState.concat(filesWithoutState);

    Logger.log('再開待ちファイル: ' + filesWithState.length + '件 / 新規ファイル: ' + filesWithoutState.length + '件');

    let processed = 0;
    let failed = 0;
    let hasMoreWork = false;

    for (let i = 0; i < sortedFiles.length; i++) {
      if (Date.now() - startTime > CFG.MAX_RUNTIME_MS - CFG.RUNTIME_SAFETY_MARGIN_MS) {
        Logger.log('実行制限時間が近づいたため途中終了します。残りは次回処理します。');
        hasMoreWork = true;
        break;
      }

      const file = sortedFiles[i];

      try {
        Logger.log('処理開始: ' + file.getName() + ' / ' + file.getId());

        const result = processPdfFileWithResume_(file, startTime);

        if (result.completed) {
          const recordCount = (result.records || []).length;
          Logger.log('Gemini抽出件数: ' + recordCount);

          if (!recordCount) {
            throw new Error('レコードが0件でした。');
          }

          const now = Utilities.formatDate(new Date(), CFG.TIMEZONE, 'yyyy/MM/dd HH:mm:ss');
          removeStage1RowsByFile_(stage1Sheet, file.getName());
          appendToStage1_(stage1Sheet, { records: result.records }, file.getName(), now);
          clearFileProgressState_(file.getId());
          moveFileToFolderSafely_(file, doneFolder);

          processed += 1;
          Logger.log('完了: ' + file.getName());
        } else {
          Logger.log('途中保存: ' + file.getName() + ' / 次回は batch=' + (result.nextBatchIndex + 1) + '/' + result.totalBatches + ' から再開します。');
          hasMoreWork = true;
          break;
        }
      } catch (error) {
        failed += 1;
        Logger.log('エラー: ' + file.getName() + ' / ' + error.message);

        if (isTransientGeminiError_(error)) {
          Logger.log('一時エラーのため元フォルダに残します。次回実行で再試行されます。');
          hasMoreWork = true;
        } else {
          try {
            clearFileProgressState_(file.getId());
            moveFileToFolderSafely_(file, errFolder);
            Logger.log('ERRフォルダへ移動: ' + file.getName());
          } catch (moveError) {
            Logger.log('ERRフォルダ移動失敗: ' + moveError.message);
          }
        }
      }
    }

    if (processed > 0) {
      distributeServiceData();
      auditImportedData_();
    }

    SpreadsheetApp.flush();
    Logger.log('runDailyImport 完了 / 成功:' + processed + ' 失敗:' + failed + ' 残り:' + (hasMoreWork ? 'あり' : 'なし'));

    // 【修正2】未処理ファイルが残っていれば継続トリガーを設定
    if (hasMoreWork) {
      scheduleContinuationTrigger_();
    } else {
      clearContinuationTriggers_();
      Logger.log('全PDFの処理が完了しました。');
    }

  } finally {
    lock.releaseLock();
  }
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
    Logger.log('Gemini主抽出: batches=' + batches.length);
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

    // 【修正3】appendRecordsToProgressFile_の戻り値で resultFileId を更新
    const newResultFileId = appendRecordsToProgressFile_(state.resultFileId, records);
    if (newResultFileId && newResultFileId !== state.resultFileId) {
      state.resultFileId = newResultFileId;
    }

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

  const bytes = blob.getBytes();
  Logger.log('PDF取込開始: ' + file.getName() + ' / size=' + bytes.length + ' bytes');

  if (CFG.USE_GEMINI_PRIMARY) {
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY が設定されていません');
    }

    Logger.log('GeminiへPDF直接送信: ' + file.getName());
    const records = extractRecordsFromPdfWithGemini_(apiKey, bytes, file.getName());
    Logger.log('Gemini PDF抽出完了: ' + file.getName() + ' / 件数=' + records.length);
    return {
      records: dedupeRecords_(records)
    };
  }

  // Gemini無効時はDrive OCRフォールバック
  const text = extractPdfTextWithDriveOcr_(file);
  Logger.log('Drive OCRテキスト抽出完了: ' + file.getName() + ' / chars=' + text.length);

  const recordBlocks = splitServiceRecordBlocks_(text);
  Logger.log('整備Noブロック検出件数: ' + recordBlocks.length);

  if (!recordBlocks.length) {
    throw new Error('PDFテキストから整備Noブロックを検出できませんでした。');
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
      Logger.log('Gemini補助抽出開始: batch=' + (i + 1) + '/' + batches.length);
      const records = extractTextBlocksWithAutoSplit_(apiKey, batches[i], file.getName(), String(i + 1), String(batches.length));
      Array.prototype.push.apply(allRecords, records);
      Logger.log('Gemini補助抽出完了: batch=' + (i + 1) + '/' + batches.length + ' / 件数=' + records.length);
      Utilities.sleep(CFG.GEMINI_CALL_SLEEP_MS);
    }
  }

  return {
    records: dedupeRecords_(allRecords)
  };
}

function extractRecordsFromPdfWithGemini_(apiKey, pdfBytes, fileName) {
  const base64Pdf = Utilities.base64Encode(pdfBytes);
  const CHUNK_SIZE = 3 * 1024 * 1024; // 3MBずつ分割（Gemini inline data 上限対策）

  // PDFが大きい場合は複数回に分けてテキスト抽出してから統合
  // 通常は1回で処理
  const prompt = [
    'あなたは整備管理システムの「整備一覧」PDFから全データを抽出するエキスパートです。',
    'このPDFには複数の整備レコードが含まれています。',
    '以下のルールに従い、全ての整備レコードをJSONとして返してください。',
    '重要: 顧客名、車名、車台番号、請求先名を混同しないでください。',
    '顧客名には会社名・個人名を入れてください。SAL/WP0/WDB/SAD/W1Nなどで始まる車台番号を顧客名に入れてはいけません。',
    '車名にはレンジローバー、ディフェンダー、ポルシェ911、デミオ等の車種名だけを入れてください。',
    '年式には R 04/11 や H 29/06 のような年/月だけを入れてください。',
    '作業大区分は各レコードで整備種別を示す値（車検、一般整備、板金、保険請求等）を抽出してください。',
    '「カーブリッジ」「輸入車」「J・L」「JLR」「桒原 裕樹」「(株)ブリッジ本社」は作業大区分として扱わないでください。',
    '保険請求、損保ﾚﾝ、損保レン、板金、鈑金、一般整備、点検、定期点検、車検、部品、サービスD-2、社用車C-① は作業大区分として抽出対象です。',
    '売上総計と粗利益は帳票内の該当金額を抽出してください。',
    '以下のルールを厳守し、有効なJSONのみを返してください。',
    '説明文、マークダウン、コードブロックは一切不要です。',
    '返却はJSONのみです。',
    'レコードは「SB」で始まる整備Noを起点に抽出してください。',
    '表に存在しない値は推測せず空文字にしてください。',
    '金額はカンマなしの数値で返してください。',
    '抽出できない場合は {"records":[]} を返してください。',
    'JSON構造は次の形式に厳密に合わせてください。',
    '{"records":[{"整備No":"","日付":"","顧客名":"","年式":"","入庫日":"","車名":"","入庫予定日":"","納車予定日":"","納車日":"","車検日":"","作業大区分":"","整備店舗":"","請求先名":"","状況":"","売上総計":0,"粗利益":0}]}',
    '\n対象ファイル: ' + fileName
  ].join('\n');

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    CFG.GEMINI_MODEL + ':generateContent?key=' + apiKey;

  const payload = {
    contents: [{
      parts: [
        {
          inline_data: {
            mime_type: 'application/pdf',
            data: base64Pdf
          }
        },
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
    try {
      const res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      const rawText = res.getContentText();
      if (res.getResponseCode() !== 200) {
        const errBody = JSON.parse(rawText);
        const errMsg = (errBody.error && errBody.error.message) || rawText.substring(0, 200);
        if (res.getResponseCode() === 429 && attempt < CFG.GEMINI_MAX_RETRIES) {
          Logger.log('Gemini 429 RESOURCE_EXHAUSTED: ' + attempt + '回目。' + (CFG.GEMINI_RETRY_WAIT_MS/1000) + '秒後にリトライします。');
          Utilities.sleep(CFG.GEMINI_RETRY_WAIT_MS);
          continue;
        }
        throw new Error('Gemini HTTP ' + res.getResponseCode() + ': ' + errMsg);
      }

      const body = JSON.parse(rawText);
      if (!body.candidates || !body.candidates.length) {
        throw new Error('Gemini candidates が空です。');
      }

      const candidate = body.candidates[0];
      const finishReason = candidate.finishReason || '';
      if (finishReason === 'MAX_TOKENS') {
        throw new Error('Gemini MAX_TOKENS: PDF全体の出力が上限に達しました。ファイル=' + fileName);
      }

      const resultText = candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text;
      if (!resultText) {
        throw new Error('Gemini レスポンスに text がありません。finishReason=' + finishReason);
      }

      Logger.log('Gemini PDF応答先頭: ' + resultText.substring(0, 200));
      const parsed = parseGeminiJson_(resultText);
      if (!parsed || !Array.isArray(parsed.records)) {
        throw new Error('Gemini JSON に records 配列がありません。');
      }

      return parsed.records.filter(function(r) { return r && r['整備No']; });
    } catch (e) {
      lastError = e;
      if (attempt < CFG.GEMINI_MAX_RETRIES) {
        Logger.log('GeminiPDF抽出エラー attempt=' + attempt + ': ' + e.message + ' リトライします。');
        Utilities.sleep(CFG.GEMINI_RETRY_WAIT_MS);
      }
    }
  }
  throw lastError || new Error('GeminiによるPDF抽出に失敗しました。');
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
    Logger.log('MAX_TOKENSのためテキストバッチを分割します: ' + recordBlocks.length + '件 -> ' + leftBlocks.length + '件 + ' + rightBlocks.length + '件');

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
  const seen = {};
  const output = [];

  (records || []).forEach(function(rec) {
    const seibiNo = String(rec && rec['整備No'] || '').trim();
    const key = seibiNo || JSON.stringify(rec);

    if (!seen[key]) {
      seen[key] = true;
      output.push(rec);
    }
  });

  return output;
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

  const rows = records.map(function(rec) {
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
      rec['請求先名'] || '',
      rec['状況'] || '',
      toNum_(rec['売上総計']),
      toNum_(rec['粗利益'])
    ];
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, STAGE1_HEADERS.length).setValues(rows);
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

function distributeServiceData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

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

  const sheetSyaken = getOrCreateSheet_(ss, CFG.STAGE2_SHEET_SYAKEN, getDefaultStage2Headers_());
  const sheet12ten = getOrCreateSheet_(ss, CFG.STAGE2_SHEET_12TEN, getDefaultStage2Headers_());
  const headersSyaken = getSheetHeaders_(sheetSyaken);
  const headers12ten = getSheetHeaders_(sheet12ten);
  const sourceValues = sourceSheet.getDataRange().getValues();

  if (sourceValues.length < 2) {
    clearSheetBody_(sheetSyaken, headersSyaken.length);
    clearSheetBody_(sheet12ten, headers12ten.length);
    return;
  }

  const sourceHeaders = sourceValues[0].map(function(h) { return String(h).trim(); });
  const sourceHeaderMap = createHeaderMap_(sourceHeaders);
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
    const valueMap = {
      '整備ナンバー': seibiNo,
      '整備No': seibiNo,
      '整備№': seibiNo,
      '状況': normalizeStatus_(
        getCellByHeader_(row, sourceHeaderMap, '状況'),
        STATUS_SALES,
        STATUS_ESTIMATE,
        STATUS_PROSPECT
      ),
      '日付': baseDate,
      '顧客名': getCellByHeader_(row, sourceHeaderMap, '顧客名'),
      '売上総計': toNum_(getCellByHeader_(row, sourceHeaderMap, '売上総計')),
      '売上合計': toNum_(getCellByHeader_(row, sourceHeaderMap, '売上総計')),
      '売上': toNum_(getCellByHeader_(row, sourceHeaderMap, '売上総計')),
      '粗利益': toNum_(getCellByHeader_(row, sourceHeaderMap, '粗利益')),
      '整備店舗': resolveServiceShopFromSourceRow_(row, sourceHeaderMap),
      '店舗': resolveServiceShopFromSourceRow_(row, sourceHeaderMap),
      '車名': getCellByHeader_(row, sourceHeaderMap, '車名'),
      '年式': getCellByHeader_(row, sourceHeaderMap, '年式'),
      '見積日': baseDate,
      '入庫日': getCellByHeader_(row, sourceHeaderMap, '入庫日'),
      '入庫予定日': getCellByHeader_(row, sourceHeaderMap, '入庫予定日'),
      '納車予定日': getCellByHeader_(row, sourceHeaderMap, '納車予定日'),
      '納車日': getCellByHeader_(row, sourceHeaderMap, '納車日'),
      '作業大区分': convertedCategory,
      '請求先名': getCellByHeader_(row, sourceHeaderMap, '請求先名'),
      '請求先': getCellByHeader_(row, sourceHeaderMap, '請求先名'),
      '車検日': getCellByHeader_(row, sourceHeaderMap, '車検日')
    };

    if (convertedCategory === CATEGORY_MAP.SHAKEN) {
      rowsSyaken.push(buildRowFromHeaders_(headersSyaken, valueMap));
    } else {
      rows12ten.push(buildRowFromHeaders_(headers12ten, valueMap));
    }
  });

  clearSheetBody_(sheetSyaken, headersSyaken.length);
  clearSheetBody_(sheet12ten, headers12ten.length);

  if (rowsSyaken.length) {
    sheetSyaken.getRange(2, 1, rowsSyaken.length, headersSyaken.length).setValues(rowsSyaken);
    applyDateFormats_(sheetSyaken, headersSyaken, rowsSyaken.length);
    sortSheetByDateColumn_(sheetSyaken, headersSyaken, '日付');
  }

  if (rows12ten.length) {
    sheet12ten.getRange(2, 1, rows12ten.length, headers12ten.length).setValues(rows12ten);
    applyDateFormats_(sheet12ten, headers12ten, rows12ten.length);
    sortSheetByDateColumn_(sheet12ten, headers12ten, '日付');
  }
}

function normalizeCategory_(rawCategory, CATEGORY_MAP, CATEGORY_SHAKEN, CATEGORY_IPPAN, CATEGORY_TENKEN, CATEGORY_BANKIN, CATEGORY_HOKEN) {
  const s = normalizeText_(rawCategory);
  if (!s) return CATEGORY_MAP.OTHER;

  if (matchesAnyCategory_(s, CATEGORY_SHAKEN)) return CATEGORY_MAP.SHAKEN;
  if (matchesAnyCategory_(s, CATEGORY_BANKIN)) return CATEGORY_MAP.BANKIN;
  if (matchesAnyCategory_(s, CATEGORY_HOKEN)) return CATEGORY_MAP.HOKEN;
  if (matchesAnyCategory_(s, CATEGORY_IPPAN)) return CATEGORY_MAP.IPPAN;
  if (matchesAnyCategory_(s, CATEGORY_TENKEN)) return CATEGORY_MAP.TENKEN;

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
    s.indexOf(normalizeText_('Maserati広島 福山ｴﾘｱ')) >= 0 ||
    s.indexOf(normalizeText_('Maserati広島 福山エリア')) >= 0 ||
    s.indexOf(normalizeText_('ﾏｾﾗﾃｨ広島 福山POCC')) >= 0 ||
    s.indexOf(normalizeText_('福山POCC')) >= 0 ||
    s.indexOf(normalizeText_('福山ｴﾘｱ')) >= 0 ||
    s.indexOf(normalizeText_('福山エリア')) >= 0 ||
    s.indexOf(normalizeText_('高田浩史')) >= 0 ||
    s === normalizeText_('マセラティ') ||
    s === normalizeText_('ﾏｾﾗﾃｨ');
}

function resolveServiceShopFromSourceRow_(row, headerMap) {
  const candidates = [
    getCellByHeader_(row, headerMap, '整備店舗'),
    getCellByHeader_(row, headerMap, '管理店舗'),
    getCellByHeader_(row, headerMap, '営業店舗'),
    getCellByHeader_(row, headerMap, '店舗'),
    getCellByHeader_(row, headerMap, '店名'),
    getCellByHeader_(row, headerMap, '作業小区分名')
  ];

  for (let i = 0; i < candidates.length; i++) {
    if (isMaseratiServiceHint_(candidates[i])) {
      return 'Maserati広島';
    }
  }

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
  return String(value || '')
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
  const s = String(dateStr || '').trim();
  if (!s) return '';

  const match = s.match(/([RH])\s*(\d+)\/(\d+)\/(\d+)/);
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
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, width).clearContent();
  }
}

function applyDateFormats_(sheet, headers, rowCount) {
  if (rowCount <= 0) return;

  ['日付', '見積日'].forEach(function(name) {
    const idx = headers.indexOf(name);
    if (idx >= 0) {
      sheet.getRange(2, idx + 1, rowCount, 1).setNumberFormat('yyyy/mm/dd');
    }
  });
}

function sortSheetByDateColumn_(sheet, headers, headerName) {
  const idx = headers.indexOf(headerName);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (idx < 0 || lastRow <= 2) {
    return;
  }

  sheet.getRange(2, 1, lastRow - 1, lastColumn).sort([
    { column: idx + 1, ascending: true },
    { column: 1, ascending: true }
  ]);
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

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  getOrCreateSheet_(ss, CFG.STAGE1_SHEET, STAGE1_HEADERS);
  getOrCreateSheet_(ss, CFG.STAGE2_SHEET_SYAKEN, getDefaultStage2Headers_());
  getOrCreateSheet_(ss, CFG.STAGE2_SHEET_12TEN, getDefaultStage2Headers_());
  getOrCreateSheet_(ss, CFG.AUDIT_SHEET, AUDIT_HEADERS);
  Logger.log('準備完了');
}

function createDailyTrigger() {
  // 既存の日次トリガーを削除
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'runDailyImport') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // 日次トリガーを設定
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
  try {
    distributeServiceData();
    auditImportedData_();
    Logger.log('OCR生データ → 車検 / 12点 を再同期しました');
  } finally {
    lock.releaseLock();
  }
}

function debugSingleFile() {
  validateRuntimeConfig_();

  const folder = DriveApp.getFolderById(CFG.PDF_FOLDER_ID);
  const files = getPdfFilesInFolder_(folder);

  if (!files.length) {
    Logger.log('PDFファイルが見つかりません');
    return;
  }

  const file = files[0];
  Logger.log('テスト対象: ' + file.getName() + ' / ' + file.getId());

  try {
    const result = processPdfFileWithResume_(file, Date.now());
    if (result.completed) {
      Logger.log('抽出レコード数: ' + ((result.records || []).length));
      Logger.log('先頭レコード: ' + JSON.stringify((result.records || [])[0] || {}));
      clearFileProgressState_(file.getId());
    } else {
      Logger.log('途中保存: 次回は batch=' + (result.nextBatchIndex + 1) + '/' + result.totalBatches + ' から再開します。');
    }
  } catch (error) {
    Logger.log('エラー: ' + error.message);
    throw error;
  }
}

function debugListPdfFiles() {
  validateRuntimeConfig_();

  const folder = DriveApp.getFolderById(CFG.PDF_FOLDER_ID);
  const pdfFiles = getPdfFilesInFolder_(folder);
  Logger.log('フォルダ名: ' + folder.getName());
  Logger.log('フォルダID: ' + folder.getId());
  Logger.log('PDF件数: ' + pdfFiles.length);

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

function auditImportedData_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(CFG.STAGE1_SHEET);
  if (!sourceSheet || sourceSheet.getLastRow() <= 1) {
    return;
  }

  const auditSheet = getOrCreateSheet_(ss, CFG.AUDIT_SHEET, AUDIT_HEADERS);
  const values = sourceSheet.getDataRange().getValues();
  const headers = values[0].map(function(h) { return String(h).trim(); });
  const headerMap = createHeaderMap_(headers);
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

// 【修正4】Drive.Files.update の代わりに trash+recreate で確実に更新する
function writeImportTempTextFile_(fileId, content) {
  if (!fileId) {
    throw new Error('一時ファイルIDがありません');
  }

  try {
    const oldFile = DriveApp.getFileById(fileId);
    const name = oldFile.getName();
    const folderIterator = oldFile.getParents();
    const folder = folderIterator.hasNext() ? folderIterator.next() : null;

    if (!folder) {
      throw new Error('一時ファイルの親フォルダを取得できません: ' + fileId);
    }

    oldFile.setTrashed(true);
    const newFile = folder.createFile(name, String(content || ''), MimeType.PLAIN_TEXT);
    return newFile.getId();
  } catch (error) {
    throw new Error('一時ファイル更新失敗 (id=' + fileId + '): ' + error.message);
  }
}

// 【修正5】appendRecordsToProgressFile_ を厳密な戻り値チェックに変更
function appendRecordsToProgressFile_(fileId, records) {
  const current = readRecordsFromProgressFile_(fileId);
  Array.prototype.push.apply(current, records || []);
  const newFileId = writeImportTempTextFile_(fileId, JSON.stringify(current));
  if (!newFileId) {
    throw new Error('一時ファイルの更新後にファイルIDを取得できませんでした');
  }
  return newFileId;
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
  DriveApp.getFolderById(CFG.PDF_FOLDER_ID);
  DriveApp.getFolderById(CFG.DONE_FOLDER_ID);
  DriveApp.getFolderById(CFG.ERR_FOLDER_ID);

  // Drive Advanced Serviceは USE_GEMINI_PRIMARY=true の場合不要（GeminiがPDFを直接処理）
  if (!CFG.USE_GEMINI_PRIMARY && (typeof Drive === 'undefined' || !Drive.Files || !Drive.Files.copy)) {
    throw new Error('Drive拡張サービスが有効ではありません。Apps Scriptの「サービス」から Drive API を追加してください。');
  }

  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if ((CFG.USE_GEMINI_PRIMARY || CFG.USE_GEMINI_FALLBACK) && !apiKey) {
    throw new Error('GEMINI_API_KEY が設定されていません');
  }
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
