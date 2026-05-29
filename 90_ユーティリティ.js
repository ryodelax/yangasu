function runSort() { // ソート
  sortSheetByHeader_("振込入金リスト一覧", "日付");
  sortSheetByHeader_("銀行データチェック用", "日付");
  sortSheetByHeader_("クレカ・現金", "取引日");
}


function runClearNotes() { // メモ削除
  // clearNotesAndBackgrounds_('振込入金リスト一覧');
  clearNotesAndBackgrounds_('銀行データチェック用');
  // clearNotesAndBackgrounds_('クレカ・現金');
}

function updateAllSummaryFormulas() { // 数式の更新
  // 現金・クレカの設定
  setDepositFormula_(SUMMARY_CONFIG.ROW_LABEL_CASH, "現金");
  setDepositFormula_(SUMMARY_CONFIG.ROW_LABEL_CARD, "クレカ");

  // 振り込みの設定
  setBankTransferFormula_();

  // 売上の設定
  setSalesFormula_();
}


/*====================== ソート ========================*/

/**
 * 指定したシートの指定したヘッダー列を基準に昇順で並べ替える
 */
function sortSheetByHeader_(sheetName, headerName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  // 1. シートの存在チェック
  if (!sheet) {
    console.error(`シート「${sheetName}」が見つかりません。`);
    return;
  }

  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    console.warn("並べ替えるデータがありません（ヘッダーのみ、または空です）。");
    return;
  }

  // 2. ヘッダー行（1行目）を取得して目的の列を探す
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const colIndex = headers.indexOf(headerName) + 1; // 1-based index

  if (colIndex === 0) {
    console.error(`ヘッダー「${headerName}」が見つかりません。`);
    return;
  }

  // 3. データ範囲（2行目以降）を取得して並べ替え
  // getRange(開始行, 開始列, 行数, 列数)
  const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);

  // sort({column: 列番号, ascending: true(昇順) or false(降順)})
  dataRange.sort({ column: colIndex, ascending: true });

  console.log(`シート「${sheetName}」を「${headerName}」列で昇順に並べ替えました。`);
}


/*====================== メモ削除 ========================*/

/**
 * 指定したシートの全セルのメモを削除し、背景色をリセットする
 */
function clearNotesAndBackgrounds_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    console.error(`シート「${sheetName}」が見つかりません。`);
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  // データが2行目以降に存在する場合のみ実行
  if (lastRow >= 2) {
    // getRange(開始行, 開始列, 行数, 列数)
    // 2行目から、全体の行数マイナス1（ヘッダー分）の範囲を指定
    const range = sheet.getRange(2, 1, lastRow - 1, lastCol);

    // メモを一括削除
    range.clearNote();

    // 背景色を一括リセット（nullで塗りつぶしなし）
    range.setBackground(null);

    console.log(`シート「${sheetName}」の2行目以降の処理が完了しました。`);
  } else {
    console.log("処理対象となるデータ（2行目以降）がありません。");
  }
}


/*====================== 数式の更新 ========================*/

/**
 * 定数定義
 */
const SUMMARY_CONFIG = {
  SHEET_NAME: "★入金一覧",
  ROW_LABEL_TRANSFER: "振り込み", // 振り込み行のラベル
  ROW_LABEL_CASH: "現金",
  ROW_LABEL_CARD: "クレカ",
  ROW_LABEL: "売上"
};

const BANK_CONFIG = {
  SHEET_NAME: "銀行データチェック用",
  HEADER_AMOUNT: "金額",
  HEADER_MONTH: "入金月",
  HEADER_STATUS: "ステータス"
};

const CASH_AND_CARD_CONFIG = {
  SHEET_NAME: "クレカ・現金",
  HEADER_TOTAL: "合計",
  HEADER_METHOD: "入金方法",
  HEADER_MONTH: "入金月",
  HEADER_STATUS: "ステータス"
};

const SALES_CONFIG = {
  SHEET_NAME: "振込入金リスト一覧",
  HEADER_TOTAL: "売上総計",
  HEADER_DATE: "日付",
};

/**
* 「★入金一覧」の「振り込み」行に専用数式を設定する
*/
function setBankTransferFormula_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summarySheet = ss.getSheetByName(SUMMARY_CONFIG.SHEET_NAME);
  const bankSheet = ss.getSheetByName(BANK_CONFIG.SHEET_NAME); // [cite: 42]

  if (!summarySheet || !bankSheet) {
      console.error("必要なシートが見つかりません");
      return;
  }

  // --- 1. 「銀行データチェック用」シートの列位置を特定 ---
  const bankHeaders = bankSheet.getRange(1, 1, 1, bankSheet.getLastColumn()).getValues()[0];
  const colAmount = columnToLetter_(bankHeaders.indexOf(BANK_CONFIG.HEADER_AMOUNT) + 1);
  const colMonth = columnToLetter_(bankHeaders.indexOf(BANK_CONFIG.HEADER_MONTH) + 1);
  const colStatus = columnToLetter_(bankHeaders.indexOf(BANK_CONFIG.HEADER_STATUS) + 1);

  if (!colAmount || !colMonth || !colStatus) {
      console.error(`「${BANK_CONFIG.SHEET_NAME}」に必要なヘッダーが見つかりません`);
      return;
  }

  // --- 2. 「★入金一覧」シートの「振り込み」行を特定 ---
  const lastRow = summarySheet.getLastRow();
  const aColumnValues = summarySheet.getRange(1, 1, lastRow, 1).getValues();
  let targetRowIndex = -1;

  for (let i = 0; i < aColumnValues.length; i++) {
      if (String(aColumnValues[i][0]).trim() === SUMMARY_CONFIG.ROW_LABEL_TRANSFER) {
          targetRowIndex = i + 1;
          break;
      }
  }

  if (targetRowIndex === -1) {
      console.warn(`A列に「${SUMMARY_CONFIG.ROW_LABEL_TRANSFER}」行が見つかりません`);
      return;
  }

  // --- 3. 数式の生成と設定 ---
  const lastCol = summarySheet.getLastColumn();
  if (lastCol < 2) return;
  const headerValues = summarySheet.getRange(1, 2, 1, lastCol - 1).getValues()[0];

  headerValues.forEach((headerValue, index) => {
      const colIndex = index + 2;
      const currentHeaderLetter = columnToLetter_(colIndex);

      // ヘッダーが日付として認識できる場合のみ数式を作成
      if (headerValue instanceof Date || (headerValue && !isNaN(Date.parse(headerValue)))) {
          // ステータスが「未照合」以外 かつ 「空欄」ではない [cite: 253]
          const formula =
              "=SUMIFS(" +
              "'" + BANK_CONFIG.SHEET_NAME + "'!$" + colAmount + "$2:$" + colAmount + "," +
              "'" + BANK_CONFIG.SHEET_NAME + "'!$" + colAmount + "$2:$" + colAmount + ",\">0\"," +
              "'" + BANK_CONFIG.SHEET_NAME + "'!$" + colStatus + "$2:$" + colStatus + ",\"<>未照合\"," +
              "'" + BANK_CONFIG.SHEET_NAME + "'!$" + colStatus + "$2:$" + colStatus + ",\"<>\"," +
              "ARRAYFORMULA(TEXT('" + BANK_CONFIG.SHEET_NAME + "'!$" + colMonth + "$2:$" + colMonth + ",\"yyyy-mm\"))," +
              "TEXT(" + currentHeaderLetter + "$1,\"yyyy-mm\")" +
              ")";
          summarySheet.getRange(targetRowIndex, colIndex).setFormula(formula);
      }
  });

  console.log(`「${SUMMARY_CONFIG.ROW_LABEL_TRANSFER}」行の数式設定を完了しました`);
}

/**
* 指定したラベルの行に対して、条件に一致する集計数式を設定する
* 修正点：ステータスが「未照合」または「空欄」のものを除外
*/
function setDepositFormula_(rowLabel, methodKeyword) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summarySheet = ss.getSheetByName(SUMMARY_CONFIG.SHEET_NAME);
  const targetSheet = ss.getSheetByName(CASH_AND_CARD_CONFIG.SHEET_NAME);

  if (!summarySheet || !targetSheet) {
      console.error("必要なシートが見つかりません");
      return;
  }

  // --- 1. 「クレカ・現金」シートの列位置を特定 ---
  const targetHeaders = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0];

  const colTotal = columnToLetter_(targetHeaders.indexOf(CASH_AND_CARD_CONFIG.HEADER_TOTAL) + 1);
  const colMethod = columnToLetter_(targetHeaders.indexOf(CASH_AND_CARD_CONFIG.HEADER_METHOD) + 1);
  const colMonth = columnToLetter_(targetHeaders.indexOf(CASH_AND_CARD_CONFIG.HEADER_MONTH) + 1);
  const colStatus = columnToLetter_(targetHeaders.indexOf(CASH_AND_CARD_CONFIG.HEADER_STATUS) + 1); // 追加

  // ステータス列も含めて必須列の存在チェック
  if (!colTotal || !colMethod || !colMonth || !colStatus) {
      console.error(`「${CASH_AND_CARD_CONFIG.SHEET_NAME}」に必要なヘッダーが見つかりません`);
      return;
  }

  // --- 2. 「★入金一覧」シートの対象行を特定 ---
  const lastRow = summarySheet.getLastRow();
  const aColumnValues = summarySheet.getRange(1, 1, lastRow, 1).getValues();
  let targetRowIndex = -1;

  for (let i = 0; i < aColumnValues.length; i++) {
      if (String(aColumnValues[i][0]).trim() === rowLabel) {
          targetRowIndex = i + 1;
          break;
      }
  }

  if (targetRowIndex === -1) {
      console.warn(`A列に「${rowLabel}」行が見つかりません`);
      return;
  }

  // --- 3. 数式の生成と設定 ---
  const lastCol = summarySheet.getLastColumn();
  if (lastCol < 2) return;
  const headerValues = summarySheet.getRange(1, 2, 1, lastCol - 1).getValues()[0];

  headerValues.forEach((headerValue, index) => {
      const colIndex = index + 2;
      const currentHeaderLetter = columnToLetter_(colIndex);

      if (headerValue instanceof Date || (headerValue && !isNaN(Date.parse(headerValue)))) {
          // 条件追加：ステータス列が "<>未照合" かつ "<>" (空欄以外)
          const formula =
              "=SUMIFS(" +
              "'" + CASH_AND_CARD_CONFIG.SHEET_NAME + "'!$" + colTotal + "$2:$" + colTotal + "," +
              "'" + CASH_AND_CARD_CONFIG.SHEET_NAME + "'!$" + colMethod + "$2:$" + colMethod + ",\"" + methodKeyword + "\"," +
              "'" + CASH_AND_CARD_CONFIG.SHEET_NAME + "'!$" + colStatus + "$2:$" + colStatus + ",\"<>未照合\"," + // 追加
              "'" + CASH_AND_CARD_CONFIG.SHEET_NAME + "'!$" + colStatus + "$2:$" + colStatus + ",\"<>\"," +        // 追加
              "ARRAYFORMULA(TEXT('" + CASH_AND_CARD_CONFIG.SHEET_NAME + "'!$" + colMonth + "$2:$" + colMonth + ",\"yyyy-mm\"))," +
              "TEXT(" + currentHeaderLetter + "$1,\"yyyy-mm\")" +
              ")";
          summarySheet.getRange(targetRowIndex, colIndex).setFormula(formula);
      }
  });

  console.log(`「${rowLabel}」行（キーワード: ${methodKeyword}）の数式設定を完了しました`);
}


/**
* 「★入金一覧」の「売上」行に数式を設定する
* 文字列形式の数値 ('219800) を数値変換して集計する
*/
function setSalesFormula_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summarySheet = ss.getSheetByName(SUMMARY_CONFIG.SHEET_NAME);
  const salesSheet = ss.getSheetByName(SALES_CONFIG.SHEET_NAME);

  if (!summarySheet || !salesSheet) {
      console.error("必要なシートが見つかりません");
      return;
  }

  // 1. 日付列を和暦から西暦に上書き変換
  overwriteSalesDateToWestern_(salesSheet);

  // 2. 「振込入金リスト一覧」シートの列位置を特定
  const salesHeaders = salesSheet.getRange(1, 1, 1, salesSheet.getLastColumn()).getValues()[0];
  const colTotal = columnToLetter_(salesHeaders.indexOf(SALES_CONFIG.HEADER_TOTAL) + 1);
  const colDate = columnToLetter_(salesHeaders.indexOf(SALES_CONFIG.HEADER_DATE) + 1);

  if (!colTotal || !colDate) {
      console.error("売上総計または日付列の特定に失敗しました");
      return;
  }

  // 3. 「★入金一覧」シートの「売上」行を特定
  const lastRowSummary = summarySheet.getLastRow();
  const aColumnValues = summarySheet.getRange(1, 1, lastRowSummary, 1).getValues();
  let targetRowIndex = -1;
  for (let i = 0; i < aColumnValues.length; i++) {
      if (String(aColumnValues[i][0]).trim() === SUMMARY_CONFIG.ROW_LABEL) {
          targetRowIndex = i + 1;
          break;
      }
  }

  if (targetRowIndex === -1) return;

  // 4. 数式の生成と設定
  const lastCol = summarySheet.getLastColumn();
  const headerValues = summarySheet.getRange(1, 2, 1, lastCol - 1).getValues()[0];

  headerValues.forEach((headerValue, index) => {
      const colIndex = index + 2;
      const currentHeaderLetter = columnToLetter_(colIndex);

      if (headerValue instanceof Date || (headerValue && !isNaN(Date.parse(headerValue)))) {
          /**
           * 数式のロジック修正:
           * 1. SUMPRODUCTを使用し、範囲全体に *1 を掛けることで文字列数値を数値化
           * 2. 日付の比較（yyyy-mm）を行う
           */
          const formula =
              "=SUMPRODUCT(" +
              "('" + SALES_CONFIG.SHEET_NAME + "'!$" + colTotal + "$2:$" + colTotal + "*1)," + // 文字列を数値に強制変換
              "(ARRAYFORMULA(TEXT('" + SALES_CONFIG.SHEET_NAME + "'!$" + colDate + "$2:$" + colDate + ",\"yyyy-mm\"))=" +
              "TEXT(" + currentHeaderLetter + "$1,\"yyyy-mm\"))" +
              ")";

          summarySheet.getRange(targetRowIndex, colIndex).setFormula(formula);
      }
  });

  console.log("売上行の集計数式（数値変換対応）を設定しました");
}


/**
* 「振込入金リスト一覧」シートの「日付」列（和暦）を
* 西暦（yyyy/MM/dd）に変換して、同じ列に上書きする
*/
function overwriteSalesDateToWestern_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const salesSheet = ss.getSheetByName(SALES_CONFIG.SHEET_NAME);

  if (!salesSheet) {
      console.error("シートが見つかりません: " + SALES_CONFIG.SHEET_NAME);
      return;
  }

  // 1. 「日付」列の位置を特定 [cite: 239]
  const headers = salesSheet.getRange(1, 1, 1, salesSheet.getLastColumn()).getValues()[0];
  const colDateIdx = headers.indexOf(SALES_CONFIG.HEADER_DATE);

  if (colDateIdx === -1) {
      console.error("日付ヘッダーが見つかりません: " + SALES_CONFIG.HEADER_DATE);
      return;
  }

  // 2. データの取得と変換
  const lastRow = salesSheet.getLastRow();
  if (lastRow < 2) return; // データ行がない場合は終了 [cite: 238]

  // 日付列の範囲を取得（2行目から最終行まで）
  const dateRange = salesSheet.getRange(2, colDateIdx + 1, lastRow - 1, 1);
  const dateValues = dateRange.getValues();

  // 各行の値を parseJapaneseEraDate_ で変換
  const convertedValues = dateValues.map(row => {
      const rawValue = row[0];

      // すでにDateオブジェクトとして認識されている場合や、西暦になっている場合はスキップ [cite: 271, 274]
      if (rawValue instanceof Date) {
          return [Utilities.formatDate(rawValue, "Asia/Tokyo", "yyyy/MM/dd")];
      }

      const dateObj = parseJapaneseEraDate_(rawValue);

      if (dateObj) {
          // 和暦から変換できた場合は yyyy/MM/dd 文字列を返す
          return [Utilities.formatDate(dateObj, "Asia/Tokyo", "yyyy/MM/dd")];
      } else {
          // 変換できない（空欄や対象外の文字）場合は元の値をそのまま保持
          return [rawValue];
      }
  });

  // 3. 変換後のデータを元の「日付」列へ一括上書き
  dateRange.setValues(convertedValues);

  console.log("日付列の上書き変換が完了しました。対象行数: " + convertedValues.length);
}

/**
* 列番号を列アルファベットに変換する補助関数
*/
function columnToLetter_(column) {
  if (column <= 0) return null;
  let temp, letter = '';
  while (column > 0) {
      temp = (column - 1) % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      column = (column - temp - 1) / 26;
  }
  return letter;
}

/**
* 和暦文字列 (例: "R 08/03/05") を Date オブジェクトに変換する
* @param {string} value - 和暦の文字列
* @return {Date|null} 変換後の Date オブジェクト、失敗時は null
*/
function parseJapaneseEraDate_(value) {
  const text = String(value).trim();
  if (!text) return null;

  // 正規表現で「R」または「r」に続く「年/月/日」をキャプチャする 
  // R 08/03/05 や r8/3/5 などの表記に対応
  const match = text.match(/^R\s*(\d{1,2})\/(\d{1,2})\/(\d{1,2})$/i);

  if (match) {
      // 令和の開始年(2018年)に数値を足して西暦を算出 
      // 令和8年 (08) + 2018 = 2026年 
      const year = 2018 + Number(match[1]);
      const month = Number(match[2]) - 1; // JSの月は 0-11 なので -1 する 
      const day = Number(match[3]);

      return new Date(year, month, day);
  }

  // 和暦形式に一致しない場合は null を返す [cite: 275]
  return null;
}


function checkAndAddMonthlyHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SUMMARY_CONFIG.SHEET_NAME);

  if (!sheet) {
      SpreadsheetApp.getUi().alert(`「${SUMMARY_CONFIG.SHEET_NAME}」が見つかりません。`);
      return;
  }

  // 1. 対象となる3ヶ月分（当月、翌月、翌々月）の日付オブジェクトを作成
  const today = new Date();
  const targetMonths = [];
  for (let i = 0; i < 3; i++) {
      // 各月の1日を設定
      targetMonths.push(new Date(today.getFullYear(), today.getMonth() + i, 1));
  }

  // 2. 現在のヘッダー情報を取得
  const lastCol = sheet.getLastColumn();
  let headerValues = [];
  if (lastCol > 0) {
      headerValues = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  }

  // 日付の重複チェック用（時間のズレを無視して比較するために文字列化）
  const headerStrings = headerValues.map(cell => {
      return cell instanceof Date ? Utilities.formatDate(cell, "JST", "yyyy/MM/dd") : cell.toString();
  });

  // 3. 不足している月を特定して追加
  targetMonths.forEach(date => {
      const dateStr = Utilities.formatDate(date, "JST", "yyyy/MM/dd");

      // ヘッダーに存在しない場合のみ追加
      if (!headerStrings.includes(dateStr)) {
          const nextCol = sheet.getLastColumn() + 1;
          const targetCell = sheet.getRange(1, nextCol);

          // 値（Date型）をセットし、表示形式を設定
          targetCell.setValue(date);
          targetCell.setNumberFormat('yyyy/mm');

          console.log(`${dateStr} を追加しました。`);
      }
  });
}
