# コンテンツ壁打ちBot — Phase1（Slack壁打ち → 制作仕様書）

設計書の Phase1（§17-1）を実装したGASプロジェクト。
**既存のキャッシュフローGASとは別プロジェクト**。絶対にあのscriptIdへpushしないこと。

```
Slack /記事作成 <テーマ>
  → 9つの壁打ち質問（スレッドで1問ずつ）
  → 回答をスプレッドシートに保存
  → Geminiで制作仕様書(14項目)を生成 → Google Docs
  → Drive案件フォルダ(01_brief〜09_publish)を自動生成
  → Slackに完了通知（仕様書URL・フォルダURL）
```

## ファイル構成
| ファイル | 役割 |
|---|---|
| `00_main.gs`   | Web App入口。Slackルーター（スラッシュ/Events）・認証・再送デデュープ |
| `10_slack.gs`  | Slack送受信（postMessage / auth.test / ACK） |
| `20_session.gs`| 壁打ち状態機械（9問を1問ずつ進行） |
| `30_brief.gs`  | 完了→仕様書生成→フォルダ生成→完了通知 |
| `40_drive.gs`  | 案件フォルダ生成 + Markdown→Docs出力 |
| `50_sheets.gs` | article_requests / style_profile の読み書き |
| `60_gemini.gs` | Gemini APIラッパー + 制作仕様書プロンプト |
| `90_util.gs`   | 設定取得・共通定数・ログ・エラー通知 |
| `99_setup.gs`  | `setup()`（初回）/ `selftest()`（疎通確認） |

---

## セットアップ手順（順番どおりに）

### 1. GASプロジェクトを作る
- https://script.google.com で新規プロジェクトを作成（**新規**。既存とは別）。
- clasp派なら: このフォルダで `clasp create --type standalone --title "コンテンツ壁打ちBot"` →
  生成された scriptId を `.clasp.json` に入れて `clasp push`。
- 手動派なら: 各 `*.gs` の中身と `appsscript.json`（マニフェスト表示をON）をコピペ。

### 2. Script Properties に値を貼る（プロジェクトの設定 → スクリプト プロパティ）
**本人が貼る。コード／Gitには書かない。**

| キー | 値 | 備考 |
|---|---|---|
| `SLACK_BOT_TOKEN` | `xoxb-...` | OAuth & Permissions の Bot Token |
| `GEMINI_API_KEY`  | AI Studioのキー | https://aistudio.google.com/apikey で無料発行 |

※ `SHEET_ID` / `DRIVE_ROOT_ID` / `SLACK_CHANNEL_ID` / `GEMINI_MODEL` / `WEBAPP_SECRET` は
次の `setup()` が自動で入れる（既知ID＋自動生成）。

### 3. `setup()` を1回実行
- エディタで関数 `setup` を選んで実行 → 権限承認。
- 実行ログに出る **`WEBAPP_SECRET`** を控える（次で使う）。
- これで `article_requests` の列補完と `style_profile`（§7 長谷川らしさ）初期投入が完了。

### 4. ウェブアプリとしてデプロイ
- デプロイ → 新しいデプロイ → 種類「ウェブアプリ」。
- 実行ユーザー: 自分 / アクセス: **全員（匿名含む）**。
- 発行された **ウェブアプリURL** を控える。

### 5. Slack側の設定（api.slack.com → 該当アプリ）
Request URLには必ず `?key=WEBAPP_SECRET` を付ける（GASは署名検証できないため）。

- **Slash Commands**: `/記事作成` を作成
  - Request URL = `https://script.google.com/.../exec?key=＜WEBAPP_SECRET＞`
  - ※Slackが日本語コマンドを拒否する場合は `/kiji` 等の英字に変更（`20_session.gs`の起動はコマンド名に依存しないのでそのままでOK）。
- **Event Subscriptions**: ON
  - Request URL = 上と同じ（`?key=` 付き）。"Verified" になればOK。
  - Subscribe to bot events: **`message.channels`** を追加。
- **OAuth & Permissions** → Scopes（Bot Token Scopes）に以下を確認/追加し、**再インストール**:
  - `chat:write`（済）, `commands`（済）, **`channels:history`（追加が必要）**
- 壁打ちチャンネル `C0B8T5M20PM` に Bot を招待: `/invite @kabeuchi-bot`

### 6. 動作確認
- （任意）エディタで `selftest()` を実行し、Sheet/Drive/Bot/Gemini の疎通を確認。
- Slackで `/記事作成 中小企業のAI導入はなぜ失敗するのか` を送信。
- スレッドの9問に1問ずつ返信 → 最後に仕様書URL付きの完了通知が来れば成功。

---

## 設計上の注意（GASの制約）
- **署名検証なし**: GASの`doPost`はHTTPヘッダーを読めない。代わりにURL秘密`?key=`で保護。
  `SLACK_SIGNING_SECRET`はScript Propertiesに保管しておくが現状コードでは未使用（将来の中継サーバ用）。
- **再送対策**: `event_id`をCacheServiceで10分デデュープ。仕様書生成が3秒を超えてもSlack再送で重複しない。
- **状態はSheetが真実**: 壁打ちの途中状態は`session_step`/`session_data`に永続化。メモリに持たない。

## 次フェーズ（未実装）
- Phase2: NotebookLM投入パック生成＋取込検知（半手動）
- Phase3: 編集長AI（`70_editor.gs`）
- Phase4: メディア別投稿支援（`80_pack.gs`）
