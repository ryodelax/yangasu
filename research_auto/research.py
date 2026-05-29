#!/usr/bin/env python3
"""
商談リサーチ自動化ツール
商談テキスト → リサーチ項目抽出 → プロンプト生成 → 並行ディープリサーチ → レポート統合

使い方:
  python research.py 商談テキスト.txt
  echo "商談テキスト" | python research.py
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path

import anthropic
import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY")
PERPLEXITY_KEY = os.getenv("PERPLEXITY_API_KEY")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")

SCRIPT_DIR = Path(__file__).parent
OUTPUT_DIR = SCRIPT_DIR / "reports"


# ── Step 1: 商談テキスト解析 ─────────────────────────────────────────────────

def extract_research_context(deal_text: str) -> dict:
    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": f"""以下の商談テキストを分析し、JSONで返してください。

商談テキスト:
{deal_text}

出力形式（JSONのみ、コードブロック不要）:
{{
  "company_name": "会社名（不明な場合はnull）",
  "industry": "業界・業種（具体的に）",
  "deal_summary": "商談の概要（2-3文）",
  "research_topics": [
    "リサーチすべき具体的なトピック1",
    "リサーチすべき具体的なトピック2",
    "リサーチすべき具体的なトピック3"
  ],
  "key_questions": [
    "この商談で明らかにしたい疑問1",
    "この商談で明らかにしたい疑問2"
  ]
}}"""
        }]
    )
    text = response.content[0].text.strip()
    if "```" in text:
        text = text.split("```")[1].lstrip("json").strip()
    return json.loads(text)


# ── Step 2: リサーチプロンプト生成 ───────────────────────────────────────────

def generate_research_prompts(context: dict) -> list:
    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{
            "role": "user",
            "content": f"""以下の商談コンテキストに基づき、ディープリサーチ用プロンプトを3つ生成してください。

コンテキスト:
- 業界: {context['industry']}
- 商談概要: {context['deal_summary']}
- リサーチトピック: {', '.join(context['research_topics'])}
- 知りたいこと: {', '.join(context['key_questions'])}

各プロンプトで以下をカバーしてください:
プロンプト1: {context['industry']}業界での具体的な成功事例（企業名・数値・成果を含む）
プロンプト2: {context['industry']}業界の現状・市場トレンド・主要プレイヤー
プロンプト3: 商談テーマに関連する課題と解決策・ベストプラクティス

出力形式（JSONのみ）:
{{"prompts": ["プロンプト1", "プロンプト2", "プロンプト3"]}}"""
        }]
    )
    text = response.content[0].text.strip()
    if "```" in text:
        text = text.split("```")[1].lstrip("json").strip()
    return json.loads(text)["prompts"]


# ── Step 3: 並行ディープリサーチ ─────────────────────────────────────────────

async def research_with_perplexity(prompt: str, session: httpx.AsyncClient) -> dict:
    resp = await session.post(
        "https://api.perplexity.ai/chat/completions",
        json={
            "model": "sonar-deep-research",
            "messages": [
                {
                    "role": "system",
                    "content": "あなたは優秀なビジネスリサーチャーです。日本語で詳細なリサーチレポートを作成してください。具体的な事例、数値、出典を必ず含めてください。"
                },
                {"role": "user", "content": prompt}
            ]
        },
        headers={"Authorization": f"Bearer {PERPLEXITY_KEY}"},
        timeout=300.0,
    )
    resp.raise_for_status()
    data = resp.json()
    return {
        "source": "Perplexity (sonar-deep-research)",
        "content": data["choices"][0]["message"]["content"],
        "citations": data.get("citations", []),
    }


def _gemini_sync(prompt: str) -> dict:
    from google import genai
    from google.genai import types as gtypes

    client = genai.Client(api_key=GEMINI_KEY)
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=f"日本語でビジネスリサーチレポートを作成してください。具体的な事例・数値・出典を含めてください。\n\n{prompt}",
        config=gtypes.GenerateContentConfig(
            tools=[gtypes.Tool(google_search=gtypes.GoogleSearch())],
        ),
    )
    sources = []
    try:
        for chunk in (response.candidates[0].grounding_metadata.grounding_chunks or []):
            if hasattr(chunk, "web") and chunk.web:
                sources.append({"title": chunk.web.title, "url": chunk.web.uri})
    except Exception:
        pass
    return {
        "source": "Gemini 2.0 Flash (Google Search)",
        "content": response.text,
        "sources": sources,
    }


async def research_with_gemini(prompt: str) -> dict:
    return await asyncio.to_thread(_gemini_sync, prompt)


async def run_parallel_research(prompts: list) -> list:
    results = []
    async with httpx.AsyncClient() as session:
        tasks = []
        for p in prompts:
            tasks.append(research_with_perplexity(p, session))
            tasks.append(research_with_gemini(p))

        gathered = await asyncio.gather(*tasks, return_exceptions=True)

    for i, r in enumerate(gathered):
        if isinstance(r, Exception):
            source = "Perplexity" if i % 2 == 0 else "Gemini"
            print(f"  ⚠️  {source} エラー: {r}")
        else:
            results.append(r)
    return results


# ── Step 4: レポート統合 ─────────────────────────────────────────────────────

def synthesize_report(context: dict, research_results: list) -> str:
    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

    research_text = ""
    for i, r in enumerate(research_results, 1):
        research_text += f"\n\n---\n### リサーチ結果 {i}（{r['source']}）\n\n{r['content']}\n"
        if r.get("citations"):
            research_text += "\n出典:\n" + "\n".join(
                f"{j}. {c}" for j, c in enumerate(r["citations"][:8], 1)
            )
        if r.get("sources"):
            research_text += "\n参照ソース:\n" + "\n".join(
                f"- [{s.get('title','N/A')}]({s.get('url','')})" for s in r["sources"][:8]
            )

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8192,
        messages=[{
            "role": "user",
            "content": f"""以下のリサーチ結果を統合し、商談で即活用できる日本語レポートを作成してください。
重複は排除し、具体的な数値・事例を優先してください。

## 商談コンテキスト
- 業界: {context['industry']}
- 会社: {context.get('company_name') or '不明'}
- 商談概要: {context['deal_summary']}
- 知りたいこと: {', '.join(context['key_questions'])}

## リサーチ結果
{research_text}

---

以下の構成でMarkdownレポートを作成してください（見出しはそのまま使用）:

# {context['industry']} 業界リサーチレポート

## エグゼクティブサマリー
（商談に直結する重要ポイントを箇条書きで5つ以内）

## 業界概況・市場トレンド
（現状、規模感、主要プレイヤー、直近の動向）

## 成功事例（3件以上）
（企業名・取り組み内容・数値・成果を具体的に）

## 業界の主要課題
（企業・担当者が直面している典型的な課題）

## 解決策・ベストプラクティス
（課題への具体的アプローチと実績）

## 商談への示唆
（このリサーチをどう商談で活かすか、提案ポイント）

## 参考情報源
（引用・参照したURL・出典一覧）"""
        }]
    )
    return response.content[0].text


# ── 保存 ─────────────────────────────────────────────────────────────────────

def save_report(context: dict, report: str) -> Path:
    OUTPUT_DIR.mkdir(exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    company = context.get("company_name") or "unknown"
    safe = "".join(c for c in company if c.isalnum() or c in "-_")[:20]
    path = OUTPUT_DIR / f"research_{safe}_{ts}.md"
    header = (
        f"---\n"
        f"作成日時: {datetime.now().strftime('%Y年%m月%d日 %H:%M')}\n"
        f"業界: {context['industry']}\n"
        f"会社: {context.get('company_name') or '不明'}\n"
        f"---\n\n"
    )
    path.write_text(header + report, encoding="utf-8")
    return path


# ── メイン ───────────────────────────────────────────────────────────────────

async def main():
    if len(sys.argv) > 1:
        deal_text = Path(sys.argv[1]).read_text(encoding="utf-8")
    elif not sys.stdin.isatty():
        deal_text = sys.stdin.read()
    else:
        print("使い方:")
        print("  python research.py 商談テキスト.txt")
        print("  echo '商談テキスト' | python research.py")
        sys.exit(1)

    print("Step 1/4: 商談テキストを分析中...")
    context = extract_research_context(deal_text)
    print(f"  業界    : {context['industry']}")
    print(f"  会社    : {context.get('company_name') or '不明'}")
    print(f"  トピック: {', '.join(context['research_topics'])}")

    print("\nStep 2/4: リサーチプロンプトを生成中...")
    prompts = generate_research_prompts(context)
    for i, p in enumerate(prompts, 1):
        print(f"  [{i}] {p[:70]}...")

    print(f"\nStep 3/4: ディープリサーチ実行中（{len(prompts) * 2}件並行）...")
    research_results = await run_parallel_research(prompts)
    print(f"  完了: {len(research_results)} 件のリサーチ結果を取得")

    print("\nStep 4/4: レポートを統合・生成中...")
    report = synthesize_report(context, research_results)
    path = save_report(context, report)

    print(f"\n完了！レポートを保存しました:")
    print(f"  {path.absolute()}")
    print(f"\nNotebookLM へのアップロード手順:")
    print(f"  1. NotebookLM を開く → 「新しいノートブック」")
    print(f"  2. 「ソースを追加」→ 「ファイルをアップロード」")
    print(f"  3. {path.name} を選択してアップロード")


if __name__ == "__main__":
    asyncio.run(main())
