/**
 * 30_brief.gs — 壁打ち完了 → 制作仕様書生成 → フォルダ生成 → 完了通知
 *
 * 重い処理（Gemini呼び出し + Drive/Docs作成）。Slackの3秒制約は
 * doPost側の event_id デデュープ（00_main.gs）で吸収する。
 */

/**
 * 壁打ち完了後の本処理。
 * @param {Object} rec  article_requests の対象行オブジェクト
 */
function finalizeBrief_(rec) {
  var contentId = rec.content_id;
  var channel = rec.slack_channel;
  var thread = threadTsOf_(rec);

  slackPost_(channel, ':hourglass_flowing_sand: 制作仕様書を生成しています…（30秒ほどお待ちください）', thread);

  var answers = getSessionData_(rec);

  // 1) Gemini で制作仕様書(Markdown)を生成
  var markdown = generateBriefMarkdown_(answers, contentId);

  // 2) 案件フォルダ一式を作成
  var folders = createCaseFolders_(contentId);

  // 3) Docs として 01_brief に保存
  var docUrl = writeBriefDoc_(folders.sub['01_brief'], contentId, markdown);
  var folderUrl = folders.folder.getUrl();

  // 4) シート更新
  var primary = answers.primary_channel || '';
  var secondary = answers.secondary_channels || '';
  updateArticle_(contentId, {
    status: STATUS.BRIEF_DONE,
    session_step: 'done',
    brief_doc_url: docUrl,
    drive_folder_url: folderUrl,
    core_discomfort: answers.core_discomfort || '',
    target_reader: answers.target_reader || '',
    main_claim: answers.main_claim || '',
    business_goal: answers.business_goal || '',
    primary_channel: primary,
    secondary_channels: secondary
  });

  // 5) 完了通知（設計書§15-1）
  var msg = [
    ':white_check_mark: *制作仕様書が完成しました。*',
    '',
    '*テーマ：*\n' + (answers.theme || '-'),
    '',
    '*主張：*\n' + (answers.main_claim || '-'),
    '',
    '*想定読者：*\n' + (answers.target_reader || '-'),
    '',
    '*展開先：*\n' + (answers.channels || '-'),
    '',
    '*制作仕様書：* ' + docUrl,
    '*案件フォルダ：* ' + folderUrl,
    '',
    'この内容でNotebookLM素材生成へ進めますか？'
  ].join('\n');
  slackPost_(channel, msg, thread);
}
