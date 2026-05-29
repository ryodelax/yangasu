# ブリッジ案件 再開用プロンプト

以下を次回のAIセッション冒頭で使ってください。

```text
このフォルダのブリッジ案件を引き継いで作業してください。
直近の主題は、キャッシュフロー表に直接出る `CF反映` メニューを復旧し、見込・実績の反映導線を安定化することです。

最初に次のファイルを読んで状況を把握してください。
- /Users/hasegawaryou11/Downloads/Cursol/docs/bridge-handover/handover.md
- /Users/hasegawaryou11/Downloads/Cursol/docs/bridge-handover/decisions.md

その上で以下を実施してください。
1. `cashflow_integration_v5.gs` と `bank_pdf_import.gs` の live 再開地点を確認する
2. CFブック `1KrtufPs4-1ZsEGPp9j9PCpYpg0knXGW5jMqospmI7UU` に対する menu / trigger / 書き込み先を切り分ける
3. `onOpen` の installable trigger が CFブック向けに live 存在するか確認する
4. 3月分の反映と、手入力重複の上書き・色付け要件を確認する
5. 必要なら `handover.md` を更新する

前提:
- `.clasp.json` は Apps Script project `1mxQGp3A0BTyW1qpynSPYfleMkaBCF9lQa1Loj2lMqV9hPgC_OhR3WOt9` を向いている
- `clasp push` は再認証問題で失敗する可能性がある
- Google Apps Script、JavaScript、Python、Google Spreadsheet連携が混在している
- URL直書きや本番シート直更新の可能性があるため、安全性を優先する
```
