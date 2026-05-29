const BRIDGE_INVOICE_RETRY = {
  rootFolderId: '1V7iCi7CN2IYz8M1PKHbU4aAr-exdvqiZ',
  successFolderId: '1VNbWipI7h8S2hKf9S0IJmLtbciN8q4So',
  errorFolderId: '1MXLglUmS3Ci6gfh88zYNcXDS6UBbDIqR',
  geminiModel: 'gemini-2.5-flash',
  minTextLength: 500,
  requiredKeywordGroups: [
    ['請求書', '車両請求書'],
    ['株式会社ブリッジ', 'ブリッジ御中', 'ブリッジ様'],
    ['車両価格', 'リサイクル料', '請求日', '請求書番号', 'LANDROVER', 'RANGE ROVER', 'DEFENDER']
  ]
};

function retryBridgeInvoiceErrorFiles() {
  validateBridgeInvoiceRetryConfig_();

  const rootFolder = DriveApp.getFolderById(BRIDGE_INVOICE_RETRY.rootFolderId);
  const successFolder = DriveApp.getFolderById(BRIDGE_INVOICE_RETRY.successFolderId);
  const errorFolder = DriveApp.getFolderById(BRIDGE_INVOICE_RETRY.errorFolderId);
  const files = listBridgeInvoiceRetryTargetFiles_(rootFolder, errorFolder);
  const result = {
    ok: true,
    checked: files.length,
    moved: 0,
    readable: 0,
    skipped: []
  };

  files.forEach(function(file) {
    try {
      const text = extractBridgeInvoicePdfTextWithGemini_(file);
      if (!isLikelyBridgeInvoiceReadable_(text, file.getName())) {
        throw new Error('OCRテキストは取得できましたが、請求書判定キーワードが不足しています。');
      }

      result.readable += 1;
      try {
        file.moveTo(successFolder);
        result.moved += 1;
        Logger.log('Bridge請求書再処理成功: ' + file.getName());
      } catch (moveError) {
        Logger.log('Bridge請求書OCR成功(移動スキップ): ' + file.getName() + ' / ' + moveError.message);
      }
    } catch (error) {
      const message = error && error.message ? error.message : '不明なエラー';
      result.skipped.push({
        fileName: file.getName(),
        fileId: file.getId(),
        reason: message
      });
      Logger.log('Bridge請求書再処理スキップ: ' + file.getName() + ' / ' + message);
    }
  });

  Logger.log('Bridge請求書再処理完了: checked=' + result.checked + ' readable=' + result.readable + ' moved=' + result.moved + ' skipped=' + result.skipped.length);
  return result;
}

function validateBridgeInvoiceRetryConfig_() {
  DriveApp.getFolderById(BRIDGE_INVOICE_RETRY.rootFolderId);
  DriveApp.getFolderById(BRIDGE_INVOICE_RETRY.successFolderId);
  DriveApp.getFolderById(BRIDGE_INVOICE_RETRY.errorFolderId);

  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY が設定されていません。');
  }
}

function listBridgeInvoicePdfFiles_(folder) {
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

function listBridgeInvoiceRetryTargetFiles_(rootFolder, errorFolder) {
  const seen = {};
  const files = [];
  [rootFolder, errorFolder].forEach(function(folder) {
    listBridgeInvoicePdfFiles_(folder).forEach(function(file) {
      const key = file.getId();
      if (seen[key]) return;
      const normalizedName = normalizeBridgeInvoiceText_(file.getName());
      if (normalizedName.indexOf('請求書') < 0 &&
          normalizedName.indexOf('下取') < 0 &&
          normalizedName.indexOf('売上') < 0) {
        return;
      }
      seen[key] = true;
      files.push(file);
    });
  });
  return files;
}

function extractBridgeInvoicePdfTextWithGemini_(file) {
  const geminiApiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const blob = file.getBlob();
  const base64Data = Utilities.base64Encode(blob.getBytes());
  const prompt = [
    'あなたは日本語の車両請求書OCRアシスタントです。',
    '入力PDFから本文テキストだけをできるだけ忠実に抽出してください。',
    '要約や説明は不要です。',
    'JSONやMarkdownは不要です。',
    '請求書に見える文字列をそのままテキストで返してください。',
    '特に次の語があれば落とさず含めてください: 請求書, 車両請求書, 株式会社ブリッジ, リサイクル料, 請求日, 請求書番号, LANDROVER, RANGE ROVER, DEFENDER'
  ].join('\n');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    BRIDGE_INVOICE_RETRY.geminiModel + ':generateContent?key=' + geminiApiKey;
  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: blob.getContentType(), data: base64Data } }
      ]
    }],
    generationConfig: {
      temperature: 0,
      max_output_tokens: 8192
    }
  };
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  const bodyText = response.getContentText();
  if (status !== 200) {
    throw new Error('Gemini APIエラー: ' + status + ' ' + bodyText);
  }

  let parsed;
  try {
    parsed = JSON.parse(bodyText);
  } catch (error) {
    throw new Error('GeminiレスポンスJSON解析失敗: ' + error.message);
  }

  const text = parsed &&
    parsed.candidates &&
    parsed.candidates[0] &&
    parsed.candidates[0].content &&
    parsed.candidates[0].content.parts &&
    parsed.candidates[0].content.parts[0] &&
    parsed.candidates[0].content.parts[0].text;
  if (!text) {
    throw new Error('Gemini OCR結果の本文テキストを取得できませんでした。');
  }
  return text;
}

function isLikelyBridgeInvoiceReadable_(text, fileName) {
  const raw = String(text || '');
  const normalized = normalizeBridgeInvoiceText_(raw);
  if (!normalized || normalized.length < BRIDGE_INVOICE_RETRY.minTextLength) {
    return false;
  }

  const fileNameNormalized = normalizeBridgeInvoiceText_(fileName);
  const hasInvoiceLikeName = fileNameNormalized.indexOf('請求書') >= 0 ||
    fileNameNormalized.indexOf('下取') >= 0 ||
    fileNameNormalized.indexOf('売上') >= 0;

  const matchedGroups = BRIDGE_INVOICE_RETRY.requiredKeywordGroups.filter(function(group) {
    return group.some(function(keyword) {
      return normalized.indexOf(normalizeBridgeInvoiceText_(keyword)) >= 0;
    });
  }).length;

  return hasInvoiceLikeName && matchedGroups >= 3;
}

function normalizeBridgeInvoiceText_(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .trim();
}
