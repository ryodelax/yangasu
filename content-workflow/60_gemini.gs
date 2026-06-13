/**
 * 60_gemini.gs — 実行時AI（Gemini）ラッパー
 *
 * 壁打ちの深掘り質問生成・制作仕様書ドラフト生成に使う。
 * 設計書§3-1「記事生成・整理はGemini」に準拠（Phase1はGemini単独）。
 * 文体チェック用のClaudeはPhase3の編集長AIで導入予定。
 */

/**
 * Gemini にテキストを投げて回答テキストを返す。
 * @param {string} prompt  ユーザープロンプト
 * @param {string=} systemText  システム指示（長谷川らしさプロファイル等）
 */
function geminiGenerate_(prompt, systemText) {
  var cfg = CFG();
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/'
    + cfg.GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(cfg.GEMINI_API_KEY);

  var payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
  };
  if (systemText) {
    payload.systemInstruction = { parts: [{ text: systemText }] };
  }

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  var body = JSON.parse(res.getContentText() || '{}');
  if (code !== 200) {
    throw new Error('Gemini APIエラー(' + code + '): ' + (body.error && body.error.message || res.getContentText()));
  }
  var cand = body.candidates && body.candidates[0];
  if (!cand || !cand.content || !cand.content.parts) {
    throw new Error('Gemini 応答が空です: ' + res.getContentText());
  }
  return cand.content.parts.map(function (p) { return p.text || ''; }).join('').trim();
}

/**
 * 制作仕様書（設計書§6-2の14項目）を Markdown で生成する。
 * @param {Object} answers  壁打ちで集めた回答（session_data）
 * @param {string} contentId
 */
function generateBriefMarkdown_(answers, contentId) {
  var style = loadStyleProfileText_();

  var system = [
    'あなたは株式会社エキセントリック代表・長谷川遼の「編集パートナー」です。',
    'これから渡す壁打ちメモをもとに、NotebookLMと編集長AIに渡すための「制作仕様書」を作成します。',
    'いきなり記事本文を書いてはいけません。作るのは仕様書です。',
    '',
    '最重要ルール:',
    '- 長谷川本人の違和感・具体体験・現場感を絶対に薄めない。一般化しない。',
    '- 「業務効率化が期待できます」「生産性向上」「いかがだったでしょうか」等のAIっぽい一般論・テンプレ表現は禁止。',
    '- テーマが何であれ、そのテーマに忠実に書く。AI導入・中小企業など無関係な文脈を無理やり結びつけない。',
    '- 回答が薄い項目は、長谷川の思考特徴から自然に補える範囲だけ補い、勝手に事実を創作しない。',
    '',
    '== 長谷川らしさプロファイル ==',
    style
  ].join('\n');

  var prompt = [
    '以下の壁打ちメモから、制作仕様書を Markdown で作成してください。',
    'コンテンツID: ' + contentId,
    '',
    '【壁打ちメモ】',
    '- テーマ: ' + (answers.theme || ''),
    '- 今日の違和感: ' + (answers.core_discomfort || ''),
    '- 具体的な体験: ' + (answers.concrete_experience || ''),
    '- 想定読者: ' + (answers.target_reader || ''),
    '- 読者に気づかせたいこと: ' + (answers.reader_takeaway || ''),
    '- 主張: ' + (answers.main_claim || ''),
    '- 事業導線: ' + (answers.business_goal || ''),
    '- 展開先: ' + (answers.channels || ''),
    '- トーン: ' + (answers.tone || ''),
    '- 避けたい表現/方向性(NG): ' + (answers.ng || ''),
    '',
    '【出力フォーマット】次の14見出しを必ずこの順で含めてください。',
    '# 制作仕様書',
    '## 1. コンテンツID',
    '## 2. 仮タイトル  （違和感が伝わる候補を1〜3案）',
    '## 3. 今日の違和感',
    '## 4. 具体的な体験',
    '## 5. 想定読者',
    '## 6. 読者の状態',
    '## 7. 読者に気づかせたいこと',
    '## 8. 主張',
    '## 9. 避けたい方向性  （NG表現を具体的に列挙）',
    '## 10. 文体  （長谷川らしさプロファイルを反映）',
    '## 11. 事業導線',
    '## 12. 展開先  （note/YouTube/音声/SNS/自社HPの方針）',
    '## 13. 使用予定資料',
    '## 14. 成功条件',
    '',
    '注意: 余計な前置き・後書きは書かず、Markdown本体のみを返してください。'
  ].join('\n');

  return geminiGenerate_(prompt, system);
}

/**
 * note記事草稿（Phase 3）を Markdown で生成する。
 */
function generateNoteMarkdown_(answers, contentId) {
  var style = loadStyleProfileText_();

  var system = [
    'あなたは株式会社エキセントリック代表・長谷川遼の「ゴーストライター兼編集者」です。',
    '長谷川本人の声・口調・現場感を完全に再現してnote記事を書きます。',
    '',
    '最重要ルール:',
    '- 「業務効率化」「生産性向上」「いかがだったでしょうか」等のAI生成っぽい表現は絶対禁止。',
    '- 長谷川の違和感・現場の具体エピソードを起点に書く。抽象化・一般化しない。',
    '- テーマが何であれ、そのテーマに忠実に書く。AI導入・中小企業など無関係な文脈に無理やり結びつけない。',
    '- 読者が「あ、自分のことだ」と感じる具体性を保つ。',
    '- 結論を最初に言い、根拠をエピソードで肉付けする構成を基本とする。',
    '- 書き出しは「こんにちは〜」等ではなく、違和感・問いかけ・現場描写から入る。',
    '',
    '== 長谷川らしさプロファイル ==',
    style
  ].join('\n');

  var prompt = [
    '以下の制作情報からnote記事をMarkdownで書いてください。',
    'コンテンツID: ' + contentId,
    '',
    '【制作情報】',
    '- テーマ: '             + (answers.theme || ''),
    '- 今日の違和感: '       + (answers.core_discomfort || ''),
    '- 具体的な体験: '       + (answers.concrete_experience || ''),
    '- 想定読者: '           + (answers.target_reader || ''),
    '- 読者に気づかせたいこと: ' + (answers.reader_takeaway || ''),
    '- 主張: '               + (answers.main_claim || ''),
    '- 事業導線: '           + (answers.business_goal || ''),
    '- トーン: '             + (answers.tone || ''),
    '- NG: '                 + (answers.ng || ''),
    '',
    '【要件】',
    '- 文字数: 2000〜3000字',
    '- 構成: 書き出し（違和感・問い）→ 具体エピソード → 主張と根拠 → 読者へのメッセージ → 締め（事業導線を自然に）',
    '- 見出しは ## を使用',
    '- 最後に「#タグ」を5個（note用）',
    '',
    '注意: 余計な前置き・後書きは不要。Markdown本体のみ返してください。'
  ].join('\n');

  return geminiGenerate_(prompt, system);
}

/**
 * SNS投稿案（Phase 3）を Markdown で生成する。
 * X(Twitter)・Threads・noteのSNS用それぞれ生成。
 */
function generateSNSMarkdown_(answers, contentId) {
  var style = loadStyleProfileText_();

  var system = [
    'あなたは株式会社エキセントリック代表・長谷川遼の「SNS担当編集者」です。',
    '長谷川の口調・違和感・現場目線を活かしたSNS投稿を作ります。',
    '',
    '最重要ルール:',
    '- 「業務効率化」「生産性向上」等の一般論禁止。長谷川の現場感を出す。',
    '- バズ狙いの煽り文句・数字の羅列は避ける。',
    '- X投稿は140字以内（URLなし）。読んで「刺さる」一言を優先。',
    '',
    '== 長谷川らしさプロファイル ==',
    style
  ].join('\n');

  var prompt = [
    '以下の制作情報からSNS投稿案をMarkdownで作成してください。',
    'コンテンツID: ' + contentId,
    '',
    '【制作情報】',
    '- テーマ: '             + (answers.theme || ''),
    '- 今日の違和感: '       + (answers.core_discomfort || ''),
    '- 主張: '               + (answers.main_claim || ''),
    '- 想定読者: '           + (answers.target_reader || ''),
    '- トーン: '             + (answers.tone || ''),
    '',
    '【出力フォーマット】',
    '## X（Twitter）投稿案',
    '3パターン。各140字以内。',
    '',
    '## Threads投稿案',
    '1パターン。500字以内。少し長めに書いてOK。',
    '',
    '## note公開時のSNS告知文',
    'noteリンクを貼る想定の告知文。X用140字 + Threads用300字の2種。',
    '',
    '注意: 余計な前置き・後書きは不要。Markdown本体のみ返してください。'
  ].join('\n');

  return geminiGenerate_(prompt, system);
}

/**
 * NotebookLM投入パック（Phase 2）を Markdown で生成する。
 * @param {Object} answers  壁打ちで集めた回答（session_data）
 * @param {string} contentId
 */
function generateNotebookLMMarkdown_(answers, contentId) {
  var style = loadStyleProfileText_();

  var system = [
    'あなたは株式会社エキセントリック代表・長谷川遼の「編集パートナー」です。',
    'NotebookLMに投入するためのソース文書を作成します。',
    '記事本文を書くのではなく、NotebookLMがさらに深掘りできるよう「素材と問い」を用意します。',
    '',
    '最重要ルール:',
    '- 長谷川本人の違和感・現場感・具体体験を起点にしてください。',
    '- 「業務効率化」「生産性向上」「いかがだったでしょうか」等のAIっぽい一般論は使わない。',
    '- テーマが何であれ、そのテーマに忠実に深掘りする。AI導入・中小企業など無関係な文脈を無理やり結びつけない。',
    '- 読者が「自分のことだ」と感じる具体性を維持する。',
    '',
    '== 長谷川らしさプロファイル ==',
    style
  ].join('\n');

  var prompt = [
    '以下の制作仕様情報からNotebookLM投入パックをMarkdownで作成してください。',
    'コンテンツID: ' + contentId,
    '',
    '【元情報】',
    '- テーマ: '             + (answers.theme || ''),
    '- 今日の違和感: '       + (answers.core_discomfort || ''),
    '- 具体的な体験: '       + (answers.concrete_experience || ''),
    '- 想定読者: '           + (answers.target_reader || ''),
    '- 読者に気づかせたいこと: ' + (answers.reader_takeaway || ''),
    '- 主張: '               + (answers.main_claim || ''),
    '- 事業導線: '           + (answers.business_goal || ''),
    '- 展開先: '             + (answers.channels || ''),
    '- トーン: '             + (answers.tone || ''),
    '- NG: '                 + (answers.ng || ''),
    '',
    '【出力フォーマット】次の見出し順で作成してください。',
    '# NotebookLM投入パック',
    '## 1. このコンテンツの目的',
    '（3〜5文で：誰に、何を気づかせ、何につなげるか）',
    '## 2. 壁打ちQ&A（整理版）',
    '（9問の回答を読みやすく整理。ただし長谷川の言葉・現場感を活かす）',
    '## 3. 記事の骨格案',
    '（導入〜結論まで5〜8セクション。各セクションに「問いかけ」と「要点1行」を添える）',
    '## 4. 論点と根拠',
    '（主張を支える論点3〜5個。それぞれに「なぜそう言えるか」を現場目線で）',
    '## 5. 想定Q&A（読者の疑問と切り返し）',
    '（読者が抱きそうな5つの疑問と、長谷川らしい答え方）',
    '## 6. エピソード深掘り',
    '（具体的な体験を3〜5つの「場面」に分解。各場面に：状況→長谷川の観察・思考→違和感の正体、を添える）',
    '## 7. 読者別・刺さるフレーズ集',
    '（想定読者が「自分のことだ」と感じる表現を10個。記事の書き出し候補・見出し候補を含む）',
    '## 8. NotebookLMへの推奨プロンプト集',
    '（このパックを投入した後、即コンテンツ生成につながる問い5〜8個。「〇〇の観点でnote記事の書き出しを3案書いて」等の具体形式で）',
    '',
    '注意: 余計な前置き・後書きは書かず、Markdown本体のみ返してください。'
  ].join('\n');

  return geminiGenerate_(prompt, system);
}
