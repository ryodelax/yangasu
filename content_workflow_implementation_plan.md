# 思考起点型コンテンツ制作ワークフロー 実装計画書

> 対象設計書: 本リポジトリ内 設計書（Slack壁打ち → NotebookLM → 編集長AI → 投稿支援）
> 本書の役割: 設計書を「動く順番」に落とすための実装計画。コードを書く前の地図。
> 最終更新: 2026-06-08

---

## 0. 結論サマリ（先に読む3行）

1. **既存のキャッシュフローGAS（scriptId `1mxQGp3A0BTyW...`）とは別プロジェクト**として新規GASを切る。コードもSheetsも混ぜない。
2. **最初に固めるのは「制作仕様書の精度」**。Phase1のSlack壁打ち→仕様書生成だけを、徹底的に作り込んでから次に進む。
3. NotebookLMはAPIが無いため**Phase2は半手動運用**を前提に設計する。完全自動化を待たない。

---

## 1. アーキテクチャ方針

### 1-1. なぜ別プロジェクトか
- 既存リポジトリは会計照合（`00_main` / `10_照合` / `20_OCR` …）の本番資産。事故時の影響を分離したい。
- 権限スコープが違う（会計=Sheets/Drive、本ワークフロー=Slack/Drive/Docs/外部AI API）。
- ただし**開発の流儀は踏襲**する: `NN_名前.gs` の連番ファイル分割 + clasp 管理。

### 1-2. システム構成（MVP）
```
Slack (Events API / Slash Command)
        │  webhook
        ▼
GAS Web App (doPost)  ──→  Google Sheets (管理DB)
        │                       │
        │                       ├─ article_requests
        │                       ├─ style_profile
        │                       ├─ source_log
        │                       └─ editorial_scores
        ▼
Google Drive (案件フォルダ自動生成)
        │
        └─ Google Docs (制作仕様書)
```
- **制御**: GAS。Slackからのイベントを `doPost(e)` で受ける Web App としてデプロイ。
- **AI呼び出し（実行時AI）**: 壁打ちの深掘り・仕様書生成は **Gemini API**（`UrlFetchApp` で Generative Language API）。設計書§3-1「記事生成・整理はGemini」に準拠。
  - ※「実行時AI」= 完成後のワークフローがSlack応答や仕様書生成のために裏で叩くAI。コードを書く開発者AI（Claude Code）とは別物。
- **状態管理**: 会話の途中状態（どの質問まで答えたか）は `article_requests` の `status` 列 + 専用の `session` 列に保持。GASはステートレスなのでSheetsを唯一の真実とする。

### 1-3. n8nは入れない（設計書§3-2準拠）
初期はGASのみ。可視化・商品化フェーズで再検討。

---

## 2. フェーズ別実装順序

設計書§17・§20の指示「最初から全機能を作らない／仕様書の精度を最優先」に従う。

### Phase 1 — Slack壁打ち → 制作仕様書（最優先・ここを作り込む）
**ゴール**: Slackでテーマを投げると、壁打ち質問が返り、回答が貯まり、Docsに制作仕様書が生成され、Drive案件フォルダができ、Slackに完了通知が届く。

実装単位:
1. `00_main.gs` — `doPost` ルーター（Slackイベント振り分け、3秒以内ACK）
2. `10_slack.gs` — Slack送受信（署名検証・メッセージ整形・通知）
3. `20_session.gs` — 壁打ち状態機械（§5-3の必須9項目を1問ずつ進行）
4. `30_brief.gs` — 回答→制作仕様書（§6-2の14項目）をDocs生成
5. `40_drive.gs` — 案件フォルダ自動生成（§12-2の `01_brief`〜`09_publish`）
6. `50_sheets.gs` — `article_requests` 読み書き
7. `60_claude.gs` — Claude API ラッパー（深掘り質問の動的生成・仕様書ドラフト）
8. `90_util.gs` — 設定値・ID取得・ログ・エラー通知
9. `config.gs`（または Script Properties）— トークン・ID類

**Phase1完了の判定**: 設計書§6-2の14項目がすべて埋まったDocsが、人手なしで生成されること。かつ§7の長谷川らしさプロファイルが仕様書の「文体」「避けたい方向性」欄に反映されていること。

### Phase 2 — NotebookLM素材生成（半手動）
NotebookLMは公開APIが無い。よって:
- GASは「NotebookLMへの投入パック」（§8-2の9資料を1フォルダに集約＋投入手順書）を自動生成するところまで。
- 生成（Report/Audio/Video/Infographic等）は**人手でNotebookLM操作**。
- 生成物を `03_notebooklm/` に置くと、ファイル検知 → `status=編集長AI待ち` に更新するトリガを用意。
- 将来、computer-use / Chrome MCP でのNotebookLM半自動操作を別途検討（本計画外）。

### Phase 3 — 編集長AI
- `70_editor.gs` — `03_notebooklm/` の生成物 + 仕様書 + 長谷川プロファイル + NG/OKリストをClaudeに投入。
- 出力: `editorial_report.md`（§14-1の10項目）/ `media_manifest.json`（§14-2）/ `cut_list.csv`（§14-3）を `04_editorial_judge/` に保存。
- §9-5の8軸スコアを `editorial_scores` シートに記録、A/B/C/D判定。
- 完了でSlackに§15-2形式の通知。

### Phase 4 — メディア別投稿支援
- `80_pack.gs` — note/YouTube/音声/SNS の成果物（§10各節のファイル群）をClaudeで生成し各フォルダへ。
- §16の投稿前チェックリストを `09_publish/final_checklist.md` に同梱。

### Phase 5 — 拡張（将来）
自社HP/RSS連携、投稿後の成果記録、Search Console / YouTube Analytics / SNS反応分析。本計画ではスコープ外。

---

## 3. Google Sheets スキーマ（Phase1で作る）

設計書§13に準拠。Phase1で必要なのは `article_requests` と `style_profile`。

### article_requests（§13-1 + 運用列を追加）
| 列 | 用途 | 備考 |
|---|---|---|
| content_id | コンテンツID | `YYYY-MM-DD_スラッグ` |
| created_at | 作成日時 | |
| status | 進捗 | 壁打ち中/仕様書作成済/NotebookLM中/編集長AI中/投稿待ち/投稿済 |
| **session_step**（追加） | 壁打ちの現在質問番号 | 状態機械用 |
| **slack_channel**（追加） | 返信先チャンネル/スレッド | |
| theme | テーマ | |
| core_discomfort | 違和感 | |
| target_reader | 想定読者 | |
| main_claim | 主張 | |
| business_goal | 事業導線 | |
| primary_channel | メイン媒体 | |
| secondary_channels | 展開先 | |
| brief_doc_url | 仕様書URL | |
| drive_folder_url | Driveフォルダ | |
| note_draft_url / youtube_asset_url / audio_asset_url | 各素材 | Phase3以降 |
| published_*_url | 公開URL | Phase4以降 |

### style_profile（§13-2）
§7の長谷川らしさを行データ化（category / item / detail / examples）。**Phase1で§7-2〜7-5を手入力で初期投入**。これが全AI呼び出しのコンテキスト源になる。

### source_log / editorial_scores
Phase3で作成（§13-3, §13-4）。

---

## 4. Drive / Docs 構成（§12準拠）

ルート `content-production/` 配下に `style-profile / articles / templates / published`。
案件フォルダは §12-2 の `01_brief`〜`09_publish` を `40_drive.gs` が自動生成。
制作仕様書は Google Docs（人もAIも読みやすい・§3-1）で `01_brief/制作仕様書` に出力。

---

## 5. 必要な認証情報・ID（← ここを長谷川さんに依頼）

実装着手時に以下をください。**Script Properties に格納し、コードに直書きしません。**

### 5-1. Slack（Phase1必須）
- [x] Slack開発者アプリ **作成・インストール済み**
  - アプリ名: コンテンツ壁打ちBot / Bot表示名: `kabeuchi-bot`
  - App ID: `A0B91MJDQSV`
  - Team ID: `T09K2RH2UUA`（ワークスペース: ㈱エキセントリック社内）
  - 設定済みスコープ: `chat:write`, `commands`（マニフェストで付与）
- [x] **Bot User OAuth Token**（`xoxb-...`）発行済み — OAuth & Permissionsページに表示。値はScript Propertiesへ本人が貼付
- [ ] **Signing Secret** — Basic Information → App Credentials からコピーしてScript Propertiesへ（`doPost`署名検証用）
- [x] 壁打ちチャンネルID = `C0B8T5M20PM`
- [ ] **Botをチャンネルに招待**（Slackで `/invite @kabeuchi-bot`）※public無招待投稿が必要なら`chat:write.public`追加も可
- [ ] 起動方式: Slash Command `/記事作成`（Request URLはGASデプロイ後に設定）

### 5-2. Google（Phase1必須）
- [ ] **新規GASプロジェクトを作る権限**（このGoogleアカウントでOKか）
- [x] `content-production` を置く **DriveルートフォルダID** → `10xsP4L9op1HKacCzChAzqYS2bwZA0pEw`（受領済）
- [x] 管理用 **スプレッドシートID** → `1rQ9yuLttQXgm6HeSaQ__x5mOSfYIbs_9sEgppLZ1yc4`（作成済・`article_requests`ヘッダー入り。`style_profile`はGAS setupで投入）

### 5-2b. 認証情報の格納先（流出防止）
すべて **GAS の Script Properties** に長谷川さん本人が貼り付ける。コード／Gitには絶対に書かない。
- `GEMINI_API_KEY`
- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `SHEET_ID` = `1rQ9yuLttQXgm6HeSaQ__x5mOSfYIbs_9sEgppLZ1yc4`
- `DRIVE_ROOT_ID` = `10xsP4L9op1HKacCzChAzqYS2bwZA0pEw`
- `SLACK_CHANNEL_ID` = `C0B8T5M20PM`
コードは `PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY')` で読むだけ。

### 5-3. 実行時AI = Gemini（Phase1の深掘り・仕様書生成で使用）
- [ ] **Gemini API Key** — Google AI Studio（https://aistudio.google.com/apikey）で**無料発行可**
- [ ] 想定モデル: `gemini-2.x` 系（生成・整理用）
- ※設計書§3-1の「文体チェックはClaude」は Phase3 の編集長AIで再検討（Phase1はGemini単独）

### 5-4. Phase2以降（今は不要）
- NotebookLM: API無し → 手動運用（ログイン情報は不要、操作は人手）
- note / YouTube / Podcast / X / Threads の投稿API・トークンは Phase4/5 で個別に依頼

---

## 6. リスク・判断ポイント

| 項目 | リスク | 対応 |
|---|---|---|
| NotebookLM自動化 | API無し。完全自動は不可 | Phase2は半手動。投入パック生成＋取込検知までを自動化 |
| 長谷川らしさの劣化 | AIが一般論を出す（設計書§19の最重要懸念） | `style_profile`＋NG/OKリストを**全プロンプトに常時注入**。編集長AIを必ず通す |
| GASのステートレス性 | 壁打ち途中で状態消失 | 会話状態は必ずSheetsに永続化。メモリに持たない |
| Slack 3秒タイムアウト | 同期でClaude呼ぶと間に合わない | 即ACK→時間処理は `trigger` か非同期で。まず即時返信、深掘りは追って投稿 |
| 別プロジェクト運用 | clasp設定の取り違え | 新ディレクトリ＋新 `.clasp.json`。既存scriptIdに**絶対pushしない** |

---

## 7. 次アクション（着手時）

進捗（2026-06-09 更新）:
- [x] 新GASプロジェクト用ディレクトリ `content-workflow/` と `.clasp.json`（scriptId未設定の雛形）を用意
- [x] Phase1コード一式を実装（`00_main`〜`99_setup` ＋ `appsscript.json` ＋ `README.md`）。9ファイル構文チェック済
- [x] `setup()` で `article_requests` 列補完・`style_profile`（§7）自動投入を実装
- [ ] **長谷川さん作業**: GASプロジェクト作成 → Script Properties に `SLACK_BOT_TOKEN`/`GEMINI_API_KEY` を貼付 → `setup()` 実行 → ウェブアプリデプロイ
- [ ] **長谷川さん作業**: Slack側設定（Slash Command `/記事作成`、Event Subscriptions `message.channels`、`channels:history` 追加で再インストール、Botをチャンネル招待）。手順は `content-workflow/README.md`
- [ ] 制作仕様書の出力品質を長谷川さん本人レビュー（§18の成功条件「自分の感覚に近い」を満たすまで `60_gemini.gs` のプロンプトを反復調整）

> 実装メモ: GASの`doPost`はHTTPヘッダーを読めず Slack署名検証は不可。代替としてRequest URLの秘密クエリ `?key=WEBAPP_SECRET` で保護し、`event_id` をCacheServiceでデデュープして3秒制約と再送を吸収する設計にした。実行時AIはPhase1ではGemini単独（`60_gemini.gs`）。

> 重要（設計書§20）: Phase1のうちは機能拡張より**壁打ち質問設計と仕様書の精度**に時間を割く。ここが甘いと後工程が全部一般論になる。
