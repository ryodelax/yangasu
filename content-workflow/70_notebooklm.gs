/**
 * 70_notebooklm.gs — Phase 2: NotebookLM投入パック生成
 *
 * 制作仕様書完成後、スレッドへの「はい」返信を受けて
 * NotebookLMに投入するソース文書を Gemini で生成・保存する。
 */

/** 「はい」系の返答かどうかを判定 */
function isAffirmative_(text) {
  var t = (text || '').trim().toLowerCase();
  var YES = ['はい', 'yes', 'ok', 'okay', '進める', '進めて', '◯', '○', 'いいです',
             'おねがい', 'お願い', 'やって', 'どうぞ', 'はーい', 'いいよ', 'go'];
  for (var i = 0; i < YES.length; i++) {
    if (t === YES[i] || t.indexOf(YES[i]) >= 0) return true;
  }
  return false;
}

/**
 * NotebookLM投入パックを生成して Drive(03_notebooklm) に保存する。
 * @param {Object} rec  article_requests の対象行オブジェクト
 */
function generateNotebookLMPack_(rec) {
  var contentId = rec.content_id;
  var channel   = rec.slack_channel;
  var thread    = threadTsOf_(rec);
  var answers   = getSessionData_(rec);

  // 重複実行防止：先にステータスを更新
  updateArticle_(contentId, { status: STATUS.NOTEBOOK });

  slackPost_(channel,
    ':books: NotebookLM用の素材を生成しています…（30〜60秒ほどお待ちください）',
    thread);

  var markdown = generateNotebookLMMarkdown_(answers, contentId);

  var caseFolder = findCaseFolder_(contentId);
  var nlmFolder  = getOrCreateFolder_(caseFolder, '03_notebooklm');
  var docUrl     = writeNotebookLMDoc_(nlmFolder, contentId, markdown);

  patchSessionData_(contentId, { notebooklm_doc_url: docUrl });

  var msg = [
    ':white_check_mark: *NotebookLM投入パックが完成しました。*',
    '',
    '*ドキュメント：* ' + docUrl,
    '',
    '【使い方】',
    '1. 上のドキュメントと制作仕様書を NotebookLM にアップロード',
    '2. 「記事の骨格をさらに深掘りして」「読者の疑問を想定して」などと問いかける',
    '3. 生成物は `03_notebooklm` フォルダに保存して編集長AIフェーズへ'
  ].join('\n');
  slackPost_(channel, msg, thread);
}
