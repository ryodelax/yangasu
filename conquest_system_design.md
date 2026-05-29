# コンクエスト集約請求・入金管理 システム設計書

作成日: 2026-04-27

---

## 1. 対象スプレッドシート

| 役割 | スプレッドシートID | 主要シート |
|---|---|---|
| 入金管理SS | `1wX6LR1ssqThgPAIHRyUNeuvROsnXqDMcwFbMCj1PB8M` | 振込入金リスト一覧, 売掛入金見込み管理, 銀行データチェック用, 請求書発行 |
| 支払い管理SS | `12Z7hFDO9f8JMTdVYqNCx_1QbgjXmoAqWYJDiUkakuHE` | 銀行データチェック用（貸方） |
| CF表SS | `1MDvEoagoAtI99I2v3zcv3O_KJV1yLGR61OOoCWHMTRc` | 入出金合計表【第17期2025年6月〜】（gid=724009869: 今季） |

---

## 2. データフロー

```
[Jocar CSV]
    ↓ インポート
[振込入金リスト一覧]（入金管理SS）
    ↓ 請求先名マスタでフィルタ
[コンクエスト案件抽出ビュー]
    ↓ 対象月 × 請求先名 × 区分 で集約
[コンクエスト集約管理]（主テーブル）
    ↓ 請求書番号・入金予定日の照合
[請求書発行]（入金管理SS）
    ↓ 実入金の消し込み
[銀行データチェック用 ＋ 全銀行データ（隠し）]
    ↓ 4状態判定
[CF表: お客様関連列 Col G]
```

---

## 3. 新規作成シート一覧

### 入金管理SS に追加

| シート名 | 種別 | 概要 |
|---|---|---|
| `コンクエスト請求先マスタ` | マスタ | 請求先名の登録（ハードコード排除） |
| `コンクエスト区分マスタ` | マスタ | 作業大区分名→区分変換ルール |
| `コンクエスト集約管理` | 主テーブル | 月次集約×4状態管理 |
| `コンクエスト例外管理` | サブ | 差異・未分類・請求書なし案件 |
| `全銀行データ` | 隠しシート | 借方（入金SS）＋貸方（支払いSS）の結合 |

### 支払い管理SS に追加

| シート名 | 種別 | 概要 |
|---|---|---|
| `全銀行データ` | 隠しシート | 入金SSと同じデータを参照（同期） |

---

## 4. シート詳細設計

### 4-1. コンクエスト請求先マスタ

| 列 | 列名 | 内容 | 例 |
|---|---|---|---|
| A | 請求先名（Jocar） | 振込入金リスト一覧の請求先名と完全一致 | `株式会社コンクエスト　ジャガーランドロー...` |
| B | 表示名 | 管理用の短縮名 | `コンクエストJLR` |
| C | 請求先コード | 照合キー（任意） | `CQ-001` |
| D | 請求締め日 | 末日=0, 15日=15 | `0` |
| E | 支払サイト | 翌月末=1, 翌々月末=2 | `1` |
| F | 消費税処理 | 内税/外税 | `外税` |
| G | 有効フラグ | TRUE/FALSE | `TRUE` |
| H | 備考 | メモ | |

### 4-2. コンクエスト区分マスタ

| 列 | 列名 | 内容 |
|---|---|---|
| A | 作業大区分名（Jocar） | 振込入金リスト一覧の「作業大区分名」と完全一致 |
| B | 区分 | 通常/営業部門/納車前整備/部品/保険等 |
| C | 備考 | |

デフォルト区分マッピング例:
```
車検          → 通常
12点          → 通常
一般整備      → 通常
車両販売      → 営業部門
納車前整備    → 納車前整備
部品          → 部品
保険          → 保険等
（未定義）    → 通常（デフォルト）
```

### 4-3. コンクエスト集約管理（主テーブル）

| 列 | 列名 | 数式/入力 |
|---|---|---|
| A | 対象年月 | 手入力 or Apps Script（YYYY/MM形式） |
| B | 請求先コード | 請求先マスタ参照 |
| C | 表示名 | `=VLOOKUP(B, 請求先マスタ, 2, 0)` |
| D | 区分 | 通常/営業部門/納車前整備/部品/保険等 |
| E | Jocar件数 | `=COUNTIFS(振込!日付列, ">="&月初, 振込!日付列, "<"&月末, 振込!請求先列, VLOOKUP(B, マスタ, 1, 0), 振込!区分列, D)` |
| F | Jocar集計金額 | `=SUMIFS(振込!売上総計列, 振込!日付列, ">="&月初, ...)` |
| G | 請求書番号 | 手入力 or 請求書発行シートから自動照合 |
| H | 請求書金額 | `=IFERROR(XLOOKUP(G, 請求書発行!伝票番号, 請求書発行!合計), "")` |
| I | 請求書日付 | `=IFERROR(XLOOKUP(G, 請求書発行!伝票番号, 請求書発行!取引日), "")` |
| J | 入金予定日 | `=IFERROR(XLOOKUP(G, 請求書発行!伝票番号, 請求書発行!入金予定日), "")` |
| K | 銀行消込日 | 銀行データから自動照合（Apps Script） |
| L | 実入金額 | 銀行データから自動照合 |
| M | 差異 | `=IF(L<>"", F-L, "")` |
| N | 状態 | 4状態自動判定（数式） |
| O | ファイルURL | `=IFERROR(XLOOKUP(G, 請求書発行!伝票番号, 請求書発行!ファイルURL), "")` |
| P | 備考 | 手入力 |

**状態判定数式（列N）:**
```
=IF(L<>"",
   IF(ABS(M)>1000, "差異・要確認", "入金実績"),
   IF(G<>"", "請求済未入金",
   "入金予定"))
```

差異の許容額はパラメータセルで管理（デフォルト1,000円）。

### 4-4. 全銀行データ（隠しシート）

**入金管理SSの構成（借方＋貸方の結合）:**

| 列 | 列名 | ソース |
|---|---|---|
| A | 日付 | 借方/貸方共通 |
| B | 種別 | "借方（入金）" or "貸方（支払い）" |
| C | 相手科目 | 共通 |
| D | 相手摘要 | 共通 |
| E | 金額 | 共通 |
| F | 自摘要（貸方のみ） | 支払いSSから取得 |
| G | 業務No. | 借方のみ |
| H | ステータス | 借方のみ |
| I | 入金月 | 借方のみ |

Apps Scriptで支払いSSの「銀行データチェック用」シートを定期取得してマージ。

---

## 5. 銀行消し込みロジック（Apps Script）

```javascript
function matchConquestBankData() {
  const ss = SpreadsheetApp.openById('1wX6LR1ssqThgPAIHRyUNeuvROsnXqDMcwFbMCj1PB8M');
  const masterSheet = ss.getSheetByName('コンクエスト請求先マスタ');
  const aggregateSheet = ss.getSheetByName('コンクエスト集約管理');
  const bankSheet = ss.getSheetByName('銀行データチェック用');
  const matchMaster = ss.getSheetByName('照合学習マスタ');
  
  // 請求先名一覧取得
  const masterData = masterSheet.getDataRange().getValues();
  const conquestNames = masterData.slice(1).filter(r => r[6] === true).map(r => r[0]);
  
  // 銀行データ取得
  const bankData = bankSheet.getDataRange().getValues();
  
  // 集約管理の各行に対して消し込み実行
  const aggData = aggregateSheet.getDataRange().getValues();
  for (let i = 1; i < aggData.length; i++) {
    const row = aggData[i];
    const targetMonth = row[0]; // 対象年月
    const billingName = row[1]; // 請求先コード
    const expectedAmount = row[5]; // Jocar集計金額
    const invoiceNo = row[6]; // 請求書番号
    
    if (!invoiceNo) continue; // 請求書未発行はスキップ
    
    // 銀行データから対応する入金を探す
    // 照合学習マスタの正規摘要でマッチング
    const matchedBank = findBankMatch(bankData, matchMaster, billingName, targetMonth, expectedAmount);
    
    if (matchedBank) {
      aggregateSheet.getRange(i + 1, 12).setValue(matchedBank.date); // 消込日
      aggregateSheet.getRange(i + 1, 13).setValue(matchedBank.amount); // 実入金額
    }
  }
}
```

---

## 6. CF反映ルール

### 反映先シートと列構造

**書込み先: CF表SS > 入金明細【17期】**

| 列 | 役割 | 記入可否 |
|---|---|---|
| D列 | 金融小計 | **禁止**（自動SUM） |
| E〜L列 | 金融系明細（row2に科目名） | 可 |
| M列 | 保険小計 | **禁止**（自動SUM） |
| N〜S列 | 保険系明細（row2に科目名） | 可 |
| T列 | お客様小計 | **禁止**（自動SUM） |
| U列 | お客様関連ラベル（摘要テキスト） | 使用中 |
| V列 | お客様関連金額（一般顧客） | 使用中 |
| **W列** | **コンクエストラベル**（row2: 「コンクエスト」） | ← 新規追加 |
| **X列** | **コンクエスト金額** | ← 新規追加 |

T列の小計数式は既存の広範囲SUM（=V+X+Z+...）に自動包含される想定。  
※ Apps Script実行前に手動でW2セルに「コンクエスト」、X2セルは空のまま（row2の規約に従う）。

### 状態別の書込みルール

| 状態 | 書込み行（X列） | セル背景色 |
|---|---|---|
| 入金実績 | 実入金日の行 | 緑（#b7e1cd） |
| 請求済未入金 | 入金予定日の行 | 黄（#fff2cc） |
| 入金予定 | 入金予定日の行 | 薄青（#cfe2f3） |
| 差異・要確認 | 実入金日の行 | 赤（#f4cccc） |

### 反映Apps Script（概要）
```javascript
function reflectConquestToCF() {
  const inSS = SpreadsheetApp.openById('1wX6LR1ssqThgPAIHRyUNeuvROsnXqDMcwFbMCj1PB8M');
  const cfSS = SpreadsheetApp.openById('1MDvEoagoAtI99I2v3zcv3O_KJV1yLGR61OOoCWHMTRc');
  
  const aggSheet = inSS.getSheetByName('コンクエスト集約管理');
  const cfSheet = cfSS.getSheetByName('入金明細【17期】');
  
  // 2行目からコンクエスト列(W=23, X=24)を確認・自動検出
  const row2 = cfSheet.getRange(2, 1, 1, cfSheet.getLastColumn()).getValues()[0];
  let conquestLabelCol = row2.indexOf('コンクエスト') + 1;
  if (conquestLabelCol === 0) {
    // 初回: T列(20)の次の空きに追加
    conquestLabelCol = findNextEmptyAfter(cfSheet, 2, 23); // W列=23
    cfSheet.getRange(2, conquestLabelCol).setValue('コンクエスト');
  }
  const conquestAmtCol = conquestLabelCol + 1; // W→X
  
  // 全行の日付マップを構築（B列 = 日付）
  const dateMap = buildDateRowMap(cfSheet);
  
  // 集約管理の各行を書込み
  const agg = aggSheet.getDataRange().getValues().slice(1);
  for (const row of agg) {
    const [month, code, name, category, count, jocarAmt,
           invNo, invAmt, invDate, dueDate, matchDate, realAmt, diff, status] = row;
    
    const targetDate = (status === '入金実績') ? matchDate : dueDate;
    if (!targetDate) continue;
    
    const cfRowNum = dateMap[formatDate(targetDate)];
    if (!cfRowNum) continue;
    
    const amount = (status === '入金実績') ? realAmt : jocarAmt;
    
    // W列（ラベル）にコンクエスト集約ラベルを記入
    const label = `${name}(${category})`;
    const existLabel = cfSheet.getRange(cfRowNum, conquestLabelCol).getValue();
    cfSheet.getRange(cfRowNum, conquestLabelCol)
      .setValue(existLabel ? existLabel + '\n' + label : label);
    
    // X列（金額）に加算
    const existing = cfSheet.getRange(cfRowNum, conquestAmtCol).getValue() || 0;
    const cell = cfSheet.getRange(cfRowNum, conquestAmtCol);
    cell.setValue(existing + amount);
    
    // 状態別背景色
    const colors = {
      '入金実績': '#b7e1cd',
      '請求済未入金': '#fff2cc',
      '入金予定': '#cfe2f3',
      '差異・要確認': '#f4cccc'
    };
    cell.setBackground(colors[status] || null);
  }
}
```

---

## 7. 例外管理シート（コンクエスト例外管理）

| 列 | 内容 |
|---|---|
| A | 発生日 |
| B | 例外種別 | 「日付ずれ」「未分類案件」「請求書なし」「金額差異」「銀行未照合」 |
| C | 対象年月 |
| D | 請求先名 |
| E | 内容 |
| F | Jocar金額 |
| G | 請求書金額 |
| H | 実入金額 |
| I | 差異 |
| J | 対応状況 | 未対応/確認中/解決済 |
| K | 担当メモ |

---

## 8. 全銀行データ同期（Apps Script）

```javascript
function syncAllBankData() {
  const inSS = SpreadsheetApp.openById('1wX6LR1ssqThgPAIHRyUNeuvROsnXqDMcwFbMCj1PB8M');
  const outSS = SpreadsheetApp.openById('12Z7hFDO9f8JMTdVYqNCx_1QbgjXmoAqWYJDiUkakuHE');
  
  // 入金SS: 借方データ（入金側）
  const debitData = inSS.getSheetByName('銀行データチェック用').getDataRange().getValues();
  
  // 支払いSS: 貸方データ（支払い側）
  const creditData = outSS.getSheetByName('銀行データチェック用').getDataRange().getValues();
  
  // 結合（借方に "借方" タグ、貸方に "貸方" タグを付与）
  const merged = [
    ['日付', '種別', '相手科目', '相手摘要', '金額', '自摘要', '業務No.', 'ステータス', '入金月'],
    ...debitData.slice(1).map(r => [r[0], '借方（入金）', r[1], r[2], r[3], '', r[4], r[6], r[7]]),
    ...creditData.slice(1).map(r => [r[0], '貸方（支払い）', r[1], r[2], r[3], r[4], '', '', ''])
  ];
  
  // 入金SSの隠しシートに書き込み
  let allBankIn = inSS.getSheetByName('全銀行データ');
  if (!allBankIn) allBankIn = inSS.insertSheet('全銀行データ');
  allBankIn.clearContents();
  allBankIn.getRange(1, 1, merged.length, merged[0].length).setValues(merged);
  allBankIn.hideSheet();
  
  // 支払いSSの隠しシートにも同じデータを書き込み
  let allBankOut = outSS.getSheetByName('全銀行データ');
  if (!allBankOut) allBankOut = outSS.insertSheet('全銀行データ');
  allBankOut.clearContents();
  allBankOut.getRange(1, 1, merged.length, merged[0].length).setValues(merged);
  allBankOut.hideSheet();
}
```

---

## 9. 実装フェーズ

| フェーズ | 作業 | 場所 |
|---|---|---|
| Phase 1 | 請求先マスタ・区分マスタシートを作成 | 入金管理SS |
| Phase 2 | コンクエスト集約管理シートを作成（数式ベース） | 入金管理SS |
| Phase 3 | 全銀行データ隠しシートの同期スクリプト | Apps Script |
| Phase 4 | 銀行消し込みスクリプト | Apps Script |
| Phase 5 | CF反映スクリプト | Apps Script |
| Phase 6 | コンクエスト例外管理シートを作成 | 入金管理SS |
| Phase 7 | 定期実行トリガー設定 | Apps Script |

---

## 10. 優先判定ルール（ユーザー仕様準拠）

1. **日付ずれ対応**: 月末締めの場合、請求対象月は Jocar の作業完了日（日付列）で判定。入金日ではなく完了日ベースで月次集約。
2. **未分類案件**: 区分マスタに存在しない作業大区分名は「通常」に分類し、例外管理シートにも記録。
3. **請求書なし**: Jocar集計金額 > 0 かつ 請求書番号が空の行は「入金予定」状態に留まり、例外管理へ自動登録。
4. **銀行未照合**: 請求書発行済みで入金予定日を超過しているのに消し込みなし → 状態「請求済未入金」+例外登録。
5. **照合優先キー**: 照合学習マスタの「照合優先キー」を使い、相手摘要との部分一致でコンクエスト入金を特定。
