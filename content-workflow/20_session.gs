/**
 * 20_session.gs — 壁打ち状態機械（設計書§5-3 必須9項目を1問ずつ進行）
 *
 * 状態は article_requests.session_step（現在の質問番号）と
 * session_data(JSON) に永続化。GASのメモリには持たない。
 */

/** 壁打ち質問の定義（順番＝session_step） */
var QUESTIONS = [
  { key: 'core_discomfort',     q: '1️⃣ 今日いちばん書きたい「違和感」は何ですか？　何に「ん？」と思いましたか？' },
  { key: 'concrete_experience', q: '2️⃣ その違和感を感じた「具体的な出来事」はありますか？　商談・現場・会話など、できるだけ具体的に。' },
  { key: 'target_reader',       q: '3️⃣ 誰に読んでほしい記事ですか？（例：AI導入を考える中小企業経営者）' },
  { key: 'reader_takeaway',     q: '4️⃣ 読者に何を「気づかせたい」ですか？' },
  { key: 'main_claim',          q: '5️⃣ 結局、いちばん言いたい「主張」は何ですか？' },
  { key: 'business_goal',       q: '6️⃣ 最後に何につなげますか？（事業導線：相談／業務フロー整理／AI導入支援 など）' },
  { key: 'channels',            q: '7️⃣ どこまで展開しますか？　note / YouTube / 音声 / SNS / 自社HP（メインも教えてください）' },
  { key: 'tone',                q: '8️⃣ トーンは？　深め／軽め／怒り／静かな違和感 など。' },
  { key: 'ng',                  q: '9️⃣ 今回「避けたい表現や方向性」はありますか？（無ければ「なし」でOK）' }
];

var INTRO_TEXT = [
  '了解しました。いきなり記事化せず、まず方針を固めます。',
  'これから9つ、順番に確認します。1問ずつ、このスレッドに返信してください。',
  '（途中の内容はすべて保存されるので、慌てなくて大丈夫です）'
].join('\n');

/**
 * スラッシュコマンドから新しい壁打ちを開始する。
 * @return {string} content_id
 */
function startSession_(theme, slackUser, slackChannel) {
  var contentId = createArticleRow_(theme, slackUser, slackChannel, '');

  // イントロ＋Q1を投稿。最初の投稿tsをスレッド根にする。
  var intro = '*テーマ：* ' + theme + '\n\n' + INTRO_TEXT;
  var posted = slackPost_(slackChannel, intro);
  var threadTs = posted && posted.ts ? posted.ts : '';

  slackPost_(slackChannel, QUESTIONS[0].q, threadTs);
  // ts は "1718....123456" のような小数。スプレッドシートに数値化されて
  // 小数部が欠落しないよう、必ず "ts_" を付けて文字列として保存する。
  if (threadTs) updateArticle_(contentId, { slack_thread_ts: 'ts_' + threadTs });

  return contentId;
}

/**
 * 壁打ち中セッションへの回答メッセージを処理する。
 * @param {Object} rec   findActiveSession_ で得た対象行
 * @param {string} text  ユーザーの発言
 */
function handleAnswer_(rec, text) {
  var thread = threadTsOf_(rec);
  var channel = rec.slack_channel;

  // リセットコマンド
  if ((text || '').trim() === 'リセット') {
    var kept = { theme: getSessionData_(rec).theme };
    updateArticle_(rec.content_id, { session_step: 1, session_data: JSON.stringify(kept) });
    slackPost_(channel, ':arrows_counterclockwise: 最初の質問に戻します。', thread);
    slackPost_(channel, QUESTIONS[0].q, thread);
    return;
  }

  var step = parseInt(rec.session_step, 10);
  if (isNaN(step) || step < 1 || step > QUESTIONS.length) {
    logInfo_('handleAnswer_: 想定外のstep', { step: rec.session_step, id: rec.content_id });
    return;
  }

  var current = QUESTIONS[step - 1];

  // 回答を session_data に保存
  var patch = {};
  patch[current.key] = (text || '').trim();
  if (current.key === 'channels') {
    var parsed = parseChannels_(text);
    patch.primary_channel = parsed.primary;
    patch.secondary_channels = parsed.secondary;
  }
  patchSessionData_(rec.content_id, patch);

  if (step < QUESTIONS.length) {
    // 次の質問へ
    updateArticle_(rec.content_id, { session_step: step + 1 });
    slackPost_(channel, QUESTIONS[step].q, thread);
  } else {
    // 全問完了 → 制作仕様書生成へ
    updateArticle_(rec.content_id, { session_step: 'finalizing' });
    var fresh = getArticleById_(rec.content_id); // 最新の session_data を取得
    finalizeBrief_(fresh);
  }
}

/** 展開先テキストから主媒体・副媒体を雑に推定 */
function parseChannels_(text) {
  var t = (text || '');
  var known = ['note', 'youtube', 'youtube shorts', '音声', 'podcast', 'sns', 'x', 'threads', '自社hp', 'hp'];
  var lower = t.toLowerCase();
  var hits = [];
  known.forEach(function (k) { if (lower.indexOf(k) >= 0) hits.push(k); });

  // 「メイン」「主」の近くにある媒体を primary とみなす（簡易）
  var primary = '';
  var m = t.match(/(note|youtube|音声|podcast|sns|x|threads|自社hp)[^。\n]{0,6}(メイン|主|中心)/i);
  if (m) primary = m[1];
  else if (hits.length) primary = hits[0];

  var secondary = hits.filter(function (h) { return h !== (primary || '').toLowerCase(); }).join(', ');
  return { primary: primary || t.trim(), secondary: secondary };
}
