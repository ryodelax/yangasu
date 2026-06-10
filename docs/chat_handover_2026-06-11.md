# Chat Handover 2026-06-11

## 対象

- 作業ディレクトリ: `/Users/hasegawaryou11/Downloads/Cursol`
- GitHub リポジトリ: `https://github.com/ryodelax/yangus`

## この会話で扱った主題

### 1. Google スプレッドシートの経費判定

対象シート:

- `https://docs.google.com/spreadsheets/d/1wZRQb9Kx0-JNb6I9BugTNZRS3XbuzwS3RbjMdLa28Ic/edit?usp=sharing`

ユーザー意図:

- BudgetOrbit のアプリ項目をそのまま表示したい
- その上で各取引を `事業経費` または `プライベート経費` に判定したい
- `月次レポート` に項目別明細を大量表示したいわけではない
- 必要なのは「どの項目かの表示」ではなく「どちらの経費かの判定」

整理した仕様:

- `取引ログ` の `カテゴリ` はアプリ項目名をそのまま使う
- `取引ログ` の `経費区分` 列で `事業経費 / プライベート経費` を判定する
- `月次レポート` は項目別一覧ではなく、判定結果のサマリ表示を基本とする

関連メモ:

- `docs/sheets_classification_notes.md`

### 2. 途中経過の保存先

ユーザーから「途中経過ってどこに保存されてるの？」という質問があった。

回答方針:

- 会話上の途中報告はチャットに残る
- 実際の変更は対象ファイルや対象シートに保存される
- 今後はチャット内容の要点をリポジトリ内の `docs/` に保存していく

### 3. GitHub 保存基盤の作成

ユーザー要望:

- 現在のディレクトリを GitHub 側の作業スペースとして運用したい
- 進捗管理できるようにしたい

実施内容:

- GitHub 上に新規 private repository `ryodelax/yangus` を作成
- ローカルリポジトリの `origin` を `https://github.com/ryodelax/yangus.git` に設定
- `main` ブランチを GitHub へ push

注意:

- GitHub のリポジトリ名は ASCII 制約があるため、希望の `ヤンガス` ではなく `yangus` で作成した

## 現在の運用方針

- このディレクトリを `ryodelax/yangus` の作業ディレクトリとして使う
- 進捗や判断メモは `docs/` に Markdown で残す
- 必要に応じてコミットし、GitHub に push して履歴管理する

## 今後の保存ルール案

- 会話の節目ごとに `docs/chat_handover_YYYY-MM-DD.md` を更新または追加
- シート仕様や業務ルールは個別の恒久メモに分離する
- 実装変更と運用メモは可能なら別コミットにする
