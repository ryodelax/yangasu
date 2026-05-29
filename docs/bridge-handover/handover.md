# ブリッジ案件 引き継ぎメモ

最終更新日: 2026-05-29
担当:
ステータス: 進行中

## 1. 案件の目的

- ブリッジ案件で扱うデータ連携、OCR、請求書処理、入金管理まわりの運用を安定化する
- 再開時に「今どこまで終わっているか」をすぐ判断できる状態にする
- 直近の主題は、キャッシュフロー表へ見込・実績を反映する導線を安定化すること

## 2. 今回の対象範囲

- Google Apps Script
- OCR関連スクリプト
- 同期・補助スクリプト
- Google Spreadsheet前提の運用

今回の正本候補ファイル:

- `cashflow_integration_v5.gs`
- `bank_pdf_import.gs`
- `.clasp.json`

関連だが今回の主対象ではない候補ファイル:

- `00_main.gs`
- `20_OCR明細読取.js`
- `bridge_invoice_retry.gs`
- `bridge_invoice_retry.js`
- `bridge_sync_offline.py`
- `bridge_live_refresh.py`
- `nyukin_main.gs`
- `nyukin_main.js`

## 3. 実IDとデータ導線

- `clasp` project:
  `1mxQGp3A0BTyW1qpynSPYfleMkaBCF9lQa1Loj2lMqV9hPgC_OhR3WOt9`
- CF反映先:
  `1KrtufPs4-1ZsEGPp9j9PCpYpg0knXGW5jMqospmI7UU`
- 銀行実績ソース:
  `1wX6LR1ssqThgPAIHRyUNeuvROsnXqDMcwFbMCj1PB8M`
  シート `銀行データチェック用`
- 売掛見込みソース:
  `1wX6LR1ssqThgPAIHRyUNeuvROsnXqDMcwFbMCj1PB8M`
  シート `売掛入金見込み管理`
- 支払い見込みソース:
  `12Z7hFDO9f8JMTdVYqNCx_1QbgjXmoAqWYJDiUkakuHE`
  シート `支払い一覧`

## 4. 現状サマリ

- この作業ディレクトリ全体はGit管理されていない
- `clasp` は本番Apps Scriptプロジェクトを向いている
- GAS版とローカル実行用JS/Python版が混在している
- Google SpreadsheetのURLを直接参照する補助スクリプトが存在する
- CF反映ロジック本体より、`CF表から直接押せる入口` と `その入口を次回以降も維持する仕組み` が未完だった
- `clasp push` は再認証問題で不安定で、live 反映に失敗することがある

## 5. 今回の実装意図

- `cashflow_integration_v5.gs`
  に `CF反映 > ① CF反映を実行` メニューを追加
- CFブック用の open trigger は、現在のローカル正本では public `onOpen` を使う
- `onOpen()` から、開いているブックが CF対象なら `buildCashflowOperationsMenu_()` を出す
- main 側の `運用` 実行時に、CFブックの open trigger を自動で仕込む
- `runCashflowRefresh_()` 実行前に、CFブックの必須シート存在確認と補助シート初期化を必ず通す
- 目的は、main 側を一度動かせば、その後は CFブックを開くだけで `CF反映` メニューが出る状態にすること

## 6. 今わかっている主要論点

- 書き込み先のCFブックは
  `1KrtufPs4-1ZsEGPp9j9PCpYpg0knXGW5jMqospmI7UU`
  で合っている
- 値の反映先と、メニューを出す対象は別問題
- 問題の本丸は
  `CF表向け installable onOpen trigger が live で未作成`
  または
  `作成に失敗`
  している点
- `setupCashflowSystem()` は trigger 作成と補助シート初期化を担うが、実行経路によっては UI 依存で落ちる
- Apps Script editor 直実行と、スプレッドシートからの実行で挙動が分かれる

## 7. 直近で確認された事実

- `cashflow_integration_v5.gs` には以下がある
  - `buildCashflowOperationsMenu_()`
  - `openCashflowWorkflowMenu_()`
  - `installCashflowWorkflowOpenTrigger_()`
  - `ensureCashflowWorkflowReady_()`
  - `setupCashflowSystem()`
- `bank_pdf_import.gs` の `setupOperationalViews()` から
  `installCashflowWorkflowOpenTrigger_()`
  を呼ぶ実装が入っている
- `runAutoReconcilePhase()` は最後に
  `runCashflowRefresh_({ silent: true })`
  まで流す
- CFブック側には 17期/18期の `入金明細` `出金明細` が必須
- 以前の live 確認では、シート名不整合や手入力重複が存在していた

## 8. 直近の未完タスク

- CFブックに `CF反映` メニューを live 表示させる
- 3月分の反映を、正しいCFブックに対して再実行し、重複セルは上書きと色付けで明示する
- live の project trigger 一覧で
  `onOpen`
  が CFブック向け `ON_OPEN`
  で存在するか確認する
- `setupCashflowSystem()` が UI なし実行でも最後まで通るようにする

## 9. 次に確認すべきこと

- Apps Script の trigger 一覧に
  `onOpen`
  が CFブック向けにあるか
- CFブックを再読込したときに
  `CF反映 > ① CF反映を実行`
  が出るか
- 3月分の live 行で、手入力見込みと銀行実績の重複がどこに残っているか
- `clasp push` が今の端末状態で再度使えるか
- editor 直実行で落ちる箇所が
  `SpreadsheetApp.getUi()`
  だけか

## 10. 注意点

- URL直書きのスクリプトがあるため、別環境へ持っていくと動作保証がない
- シート連携は本番データを壊しやすいので、検証先シートを分けるまで一括更新を避ける
- OCRや請求書処理は同名ファイルや再取込で二重計上のリスクがある
- menu 表示不良は、書き込み先誤りではなく trigger 未作成の可能性が高い
- `Google Apps Script` の browser editor 上で未保存の壊れた差分を残すと、関数一覧や実行結果の切り分けが難しくなる

## 11. 引き継ぎ時に最低限伝えること

- 正本は少なくとも
  `cashflow_integration_v5.gs`
  と
  `bank_pdf_import.gs`
  であること
- 書き込み先CFブックID
- main 側の実行で trigger を仕込む設計であること
- live の未完はメニュー導線であって、CF反映ロジック本体ではないこと
- `clasp` 再認証問題があること

## 12. メモ

- ここに作業ごとの短い進捗ログを追記する
- 2026-05-29: 引き継ぎ用テンプレートを新規作成
- 2026-05-29: ブリッジ関連ファイル候補を抽出
- 2026-05-29: `clasp` 対象が本番 project `1mxQGp3A0BTyW1qpynSPYfleMkaBCF9lQa1Loj2lMqV9hPgC_OhR3WOt9` であることを確認
- 2026-05-29: CF書き込み先は `1KrtufPs4-1ZsEGPp9j9PCpYpg0knXGW5jMqospmI7UU` であることを確認
- 2026-05-29: main 側から CFブック用 open trigger を仕込む実装がローカルに存在することを確認
- 2026-05-29: 未完は `CF反映` メニューの live 表示と、3月分の再反映確認
- 2026-05-29: ローカル正本で CFブック用 trigger の handler を `onOpen` に寄せ、`bank_pdf_import.gs` の `onOpen()` から CFメニューも出せるように補強
