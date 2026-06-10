# NotebookLM Deep Research Workflow

## Goal

複数の AI 調査ツールで同一テーマを深掘りし、内容を比較・統合したうえで、NotebookLM に取り込みやすい形へ正規化する。

---

## Recommended Stack

- Divergent research:
  - ChatGPT Deep Research
  - Perplexity Deep Research
  - Gemini Deep Research
  - Claude Research
- Normalization:
  - 1つの統合用ドキュメントに変換
- Final knowledge base:
  - NotebookLM

---

## Core Design

NotebookLM はアップロード時点の静的コピーを保持する前提で使う。
そのため、各 AI の出力をそのまま大量投入するより、以下の 3 層で管理する。

1. Raw reports
2. Normalized synthesis
3. NotebookLM-ready master doc

---

## Folder Structure

```text
research/
  01_raw/
    topic-name/
      chatgpt.md
      perplexity.md
      gemini.md
      claude.md
  02_normalized/
    topic-name/
      comparison.md
      evidence-table.md
      synthesis.md
  03_notebooklm/
    topic-name/
      master-brief.md
      questions.md
      glossary.md
```

---

## Workflow

### 1. Define the research brief

最初に、全ツールへ同じ調査仕様を渡す。

含める項目:

- 調査テーマ
- 調査目的
- 評価観点
- 除外条件
- 必須出力形式
- 必須ソース条件

テンプレート:

```text
あなたはリサーチアナリストです。
次のテーマを深掘りしてください。

テーマ:
[ここにテーマ]

目的:
[意思決定 / 学習 / 比較検討 / 企画立案 など]

調べる観点:
1. 全体像
2. 主要論点
3. 賛成意見と反対意見
4. 有力な選択肢またはプレイヤー
5. リスク・未確定事項
6. 今後 6〜24 か月の変化要因

制約:
- 一次情報を優先
- できるだけ具体的な日付を明記
- 推測と事実を分ける
- 重要な主張には出典を付ける

出力形式:
- エグゼクティブサマリー
- 詳細分析
- 反証・異論
- 重要データ一覧
- ソース一覧
```

### 2. Run parallel research

4 ツールを同時に回す。
目的は「正解を 1 つ取ること」ではなく、「観点の漏れを減らすこと」。

役割分担の推奨:

- ChatGPT Deep Research:
  - 構造化された包括レポート
- Perplexity Deep Research:
  - 速報性とソース探索
- Gemini Deep Research:
  - Google 系ソースや広い俯瞰
- Claude Research:
  - 論点整理と反証観点

### 3. Normalize outputs

各レポートを同じ見出し構造にそろえる。

統一見出し:

```text
# Topic
## Executive Summary
## Key Findings
## Evidence
## Counterarguments
## Open Questions
## Source List
```

### 4. Build an evidence table

主張単位で比較する。

最低限の列:

- Claim
- ChatGPT
- Perplexity
- Gemini
- Claude
- Consensus level
- Best source
- Notes

判定基準:

- High: 3 つ以上のツールが一致し、一次情報あり
- Medium: 2 つ一致、または一次情報が弱い
- Low: 1 つだけ主張、または推測が強い

### 5. Write the master brief

NotebookLM に入れる本体。分量より構造を優先する。

推奨構成:

```text
# [Topic Name]
## 1. Conclusion First
## 2. What Is Well Supported
## 3. What Is Contested
## 4. Key Data Points
## 5. Risks And Unknowns
## 6. Monitoring Checklist
## 7. Sources
```

ルール:

- 1段落1論点
- 日付を明記
- 出典の強さを明記
- 推測は `Inference:` と書いて分離

### 6. Import into NotebookLM

投入順:

1. `master-brief.md`
2. `evidence-table.md`
3. 必要なら各 raw report

NotebookLM では以下を実施:

- `このテーマの論点マップを作成`
- `合意済みの内容と争点を分けて整理`
- `重要な未解決質問を 10 個出す`
- `次回の追跡調査項目を作る`

### 7. Turn NotebookLM into a working notebook

NotebookLM 側で作ると有効なもの:

- Briefing note
- FAQ
- Timeline
- Glossary
- Next questions

---

## Best Practice

- 生の AI 出力をそのまま信じない
- NotebookLM には「比較済み・整形済み」の文書を先に入れる
- URL 単位より、比較済み master doc を中心にする
- 争点と確定情報を分ける
- 同じテーマを繰り返し更新するなら Google Docs を中間フォーマットにする

---

## Practical Operating Modes

### Mode A: Fast manual

- 各 AI で調査
- Markdown に貼る
- master brief を作る
- NotebookLM に投入

向いている用途:

- 個人調査
- 意思決定メモ
- 学習テーマの深掘り

### Mode B: Semi-automated

- 各 AI の出力をコピペで `01_raw/` に保存
- 比較テンプレートに沿って統合
- 最終版を Google Docs か Markdown にする
- NotebookLM に読み込ませる

向いている用途:

- 毎週の定点調査
- 複数テーマの比較運用
- チーム共有

### Mode C: Full automation except NotebookLM import

- AI/API で raw report 収集
- スクリプトで見出し統一
- evidence table 自動生成
- master brief 自動下書き
- 最終チェック後に NotebookLM へ投入

注意:

NotebookLM は静的コピー前提なので、完全自動同期より、Google Docs を中間成果物にするほうが運用しやすい。

---

## Recommended Prompts

### Cross-tool research prompt

```text
次のテーマについて、一次情報を優先してディープリサーチしてください。
主張ごとに、事実・推測・未確定情報を分けてください。
重要な日付、数値、固有名詞は必ず明記してください。
最後に、結論、争点、追加調査が必要な点を分けてまとめてください。

テーマ:
[topic]
```

### Synthesis prompt

```text
以下の4つの調査結果を比較し、重複を除き、主張の一致点・相違点・根拠の強さで整理してください。
NotebookLM に投入する前提で、読みやすいマスターブリーフを Markdown で作ってください。
推測は明確に分離し、日付を残してください。
```

### NotebookLM prompt

```text
このノートブックのソースだけを使って、
1. 確度の高い結論
2. 争点
3. 未解決の質問
4. 次回追跡すべき変化シグナル
を整理してください。
```

---

## Constraints To Remember

- NotebookLM はソースの静的コピーを保持する
- Google Docs / Markdown / PDF / Web URL をソースにできる
- 更新を反映したいなら、元ドキュメントの再同期または再アップロードが必要

---

## Recommendation

最初は `Mode B: Semi-automated` が最も現実的。

理由:

- ツールごとの強みを活かせる
- NotebookLM に入れる前に精度管理できる
- 完全自動化の brittle な部分を避けられる
- 後から API 化やテンプレート化しやすい
