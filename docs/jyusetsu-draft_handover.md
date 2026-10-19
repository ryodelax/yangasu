# 重説ドラフト(jyusetsu-draft)引き継ぎメモ

作成 2026-10-15。長谷川が運用・修正・管理を引き継ぐための、Claude 向け・自分向けの地図。
**正(一次情報)はリポジトリ側。** ここは「どこを読めば何が分かるか」と「現時点の状態」の要約。

- リポジトリ: https://github.com/kamekamek/jyusetsu-draft (オーナー: kamekamek / 亀ちゃん)
- 本番: https://jusetsu.ec-centric.com (Vercel `kamekameks-projects/jyusetsu-draft`)
- ボード: https://github.com/users/kamekamek/projects/10
- Claude Code で触るとき: セッションに `kamekamek/jyusetsu-draft` を追加すれば、リポジトリの
  `CLAUDE.md`(約300行・非常に詳しい)が自動で読み込まれる。**まずそれに従う。**

## 1. 何をするアプリか

不動産の重要事項説明書(全日の Excel 書式)の下書きを作る。

1. 担当者が PDF 資料(登記・重要事項調査報告書・都市計画図など)をアップロード
2. Gemini が資料の種別を判定(classify)し、全資料を横断して項目を抽出
3. **AI が根拠(資料種別・ページ・引用)を申告した値だけ保存**。申告が無ければ空欄
4. 担当者が画面(Excel そのままのプレビュー)で空欄を埋め、誤りを直す
5. Excel(雛形のまま+値)/ PDF(網掛けを消す+値、重説シートのみ)で出力

製品の芯: **「AIは読むだけ、判断・完成は人間」「空欄は気づけるが、間違った値は気づかれずに客へ渡る → 空欄側に倒す」**。
承認ボタンは 2026-08-30 に廃止(500項目超を押させることになるため)。ダウンロード=承認。

## 2. 技術構成

| 層 | 中身 |
|---|---|
| アプリ | Next.js 16(App Router)+ React 19 + TypeScript strict、Tailwind 4、pnpm、Node 22 |
| AI | Google Gemini(`@google/genai`)。本番モデルは `GEMINI_MODEL=gemini-3.7-flash`(コード既定は 3.5-flash-lite) |
| DB | Supabase Postgres(Free・**米国東部**)。`postgres.js` で直結。Data API は塞いである |
| ファイル | Vercel Blob(公開ストア。URL は API 応答で返さないよう #185 で対処済み) |
| Excel | `xlsx-populate` で雛形コピーへ転記 |
| PDF/プレビュー | LibreOffice(`soffice`)。Vercel 上は Vercel Sandbox |
| 認証 | 自前(cookie セッション)。会社(org)ごとに案件分離、一般利用者は担当案件のみ。他社案件は 404 |
| 品質 | Biome(lint/format)、lefthook(pre-commit)、`node --test`(tests/ 175ファイル)、CI はセルフホストランナー |

## 3. コードの地図(読む順)

| 知りたいこと | ファイル |
|---|---|
| 書式 → 転記定義の対応 | `lib/mapping-registry.ts`(**ファイル名から推測しない**) |
| 項目定義・セル番地 | `config/mapping*.yaml`(9本・計約2.4万行。17-1 売買は約590項目) |
| 定義の型・書式差分(row_offsets 等) | `lib/mapping.ts` |
| 抽出の入口(1段目) | `app/api/cases/[id]/extract/route.ts` → `lib/extract-run.ts` → `lib/gemini.ts` |
| 2段目(資料横断の再探索・売買のみ) | `app/api/cases/[id]/extract/crosssearch/route.ts` → `lib/crosssearch-run.ts` |
| **保存の関門** | `lib/crosssearch-validate.ts`(形式チェックのみ。引用が実在するかは見ていない) |
| 担当者の修正を守る仕組み | `lib/field-upsert-guard.ts`(再抽出は `reviewed_value` に触れない) |
| Excel 生成 | `lib/excel.ts`(和暦・■チェック・結合セル左上・書面に色は付けない) |
| プレビュー | `lib/preview-html.ts`(Excel 生成とは**別経路**) |
| 認証の防御線 | `lib/auth-dal.ts`(`requireUser` / `requireCaseAccess`)。`proxy.ts` は cookie の形だけ |
| 画面本体 | `app/cases/[id]/page.tsx`(約5000行) |
| DB スキーマ | `supabase/migrations/0001〜0020`(本番は 0019 まで適用済み → 0020 の適用状況は要確認) |

主なテーブル: `cases` / `documents` / `document_doc_types` / `fields`(value=AI値, reviewed_value=担当者値, 採用値は `reviewed_value ?? value`)/
`organizations` / `users` / `user_sessions` / `app_settings` / `audit_logs` / `gemini_usage` / `login_ip_attempts`

## 4. 運用ルール(リポジトリで決まっていること)

- **やることは GitHub Issues が正**。1イシュー=1目的=1PR(スカッシュ)。受け入れ基準なしに実装しない
- ブランチ: `main`=本番(**push すると即 Vercel 本番デプロイ**)/ `develop`=統合 / 作業は `<番号>-<名前>` を develop から
- develop 向け PR は CI 緑+差分確認で Claude がマージ可。**main 向けは毎回人が確認**
- マージの証跡(#85): CI run リンク・テスト実数・動作確認・ログ抜粋・未検証と理由
- 課金(`cost:gemini` / `cost:azure`)・本番手作業(`prod`)ラベルのイシューは着手前に確認
- コミットに `.env`・顧客資料・顧客情報入り Workbook を入れない
- バックアップ: Supabase Free に自動バックアップは**無い**。`pnpm run backup` が唯一の命綱

## 5. 現在の状態(2026-10-15 時点で確認)

- 最終更新は **2026-10-06**。main = develop(内容差なし)。最後のリリースは #215(セキュリティ監査 #181 対応・売買の法令欄)
- オープンな PR: なし / オープンなイシュー: 54件
- 大きな流れ:
  - **セキュリティ強化(#181 系)**: 運営者ロール・テナント管理(#184/#202)、招待メール(#182)、管理者2要素(#200)、2段目起動で cookie を送るのをやめる(#191)ほか
  - **移行(#33 系)**: Vercel+Supabase(米国東部)→ Cloud Run(東京)+Supabase Free(東京)+Google Drive。理由は Vercel Hobby の商用禁止・Sandbox 容量超過・Blob が公開ストア。Dockerfile は作成済み、本番切り替え #44 は blocked
  - **抽出コスト**: 1案件 約4分・約110円、**2027-01 から単価2倍**。2段目は費用の約半分なのに回収ほぼ0 → 本番記録で判断(#174)
  - **【優先】** #179 管理画面に Gemini 使用量と概算料金を出す
- 本番利用者: ホームサポート(有)たなべ の4アカウント(org_id=1)

## 6. 長谷川に確認したいこと(未回答)

1. 開発体制: 亀ちゃん(kamekamek)は今後も開発するのか、長谷川側に完全移管か。リポジトリの所有を移す/フォークするか
2. 権限: 長谷川の GitHub アカウントは jyusetsu-draft の書き込み権限を持っているか。Vercel・Supabase・Gemini(Google AI Studio)・Xserver DNS の管理画面に入れるか
3. 進め方: 上記の運用ルール(Issues 正・develop 経由・main は人が確認)をそのまま引き継ぐか
4. 優先順位: 次に手を付けるのは #179(使用量画面)/ セキュリティ(#181系)/ 移行(#44系)/ 顧客FB対応 のどれか
5. 顧客・販売: 有償契約・販売開始の時期(移行計画の期限がこれに依存)

回答をもらったらこのファイルに追記する。

## 7. 決まったこと

- 2026-10-15 長谷川: **管理(所有者)は長谷川、編集・修正は長谷川と亀ちゃんの2人。** 各管理画面にはログインできる
- 2026-10-15 時点の GitHub 権限: kamekamek = admin(所有者)、ryodelax(長谷川)= write。
  個人アカウントのリポジトリは所有者以外を admin にできないため、**リポジトリを ryodelax へ移管**し、
  移管後に kamekamek を write で招待する方針で提案中(移管ボタンは kamekamek にしか押せない)
- 移管で切れるもの(移管後に確認): Vercel の Git 連携、セルフホスト CI ランナー、プロジェクトボード(users/kamekamek/projects/10 は亀ちゃん個人の持ち物のまま)


## 8. 2026-10-19 定例MTG後の状況(会社 → 利用者の階層)

- MTG で「会社(法人)を先に登録 → その下に個人アカウント」(PACT 方式)に合意。担当は亀ちゃん、期限は木曜朝
- **実装は亀ちゃん側の Claude が #202 としてブランチ `202-system-admin`(fa0b498)に push 済み。PR は未作成**
  - 役割を3つに: システム管理者(運営)/ 管理者 / 一般。運営画面 `/system` で会社の作成・自社情報23項目の入力・利用者の招待・停止
  - 運営は各社の案件を見られない(会社の壁はそのまま)
- 2026-10-19 に長谷川側の Claude が手元で検証: lint・build 通過、関係テスト 272/272 合格(実DB込み)、
  実画面で「会社作成 → 自社情報 → 管理者を招待 → 本人がパスワード設定 → ログイン → 自社情報が出る → 会社停止で即締め出し」を確認
- 本番に出す前に残っていること:
  - 招待は**メール必須**(#182 で管理者がパスワードを決める経路を廃止済み)。本番の Vercel に `MAIL_HOST/USER/PASS/FROM`(noreply@ec-centric.com・Xserver)を入れないと、誰もアカウントを作れない
  - マイグレーション 0021・0022 を本番 DB に当てる / 最初のシステム管理者を CLI で作る / 本番の会社の分け直し(#218: ec-centric と ホームサポートが同じ会社に混在)
  - イシューには「本番は二要素認証(#200)が入ってから」とあるが、木曜の期限とぶつかる → 長谷川の判断待ち
  - 一般の利用者も自社情報を編集できる(以前からの仕様)。管理者だけにするか → 判断待ち
