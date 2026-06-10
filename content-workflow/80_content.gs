/**
 * 80_content.gs — Phase 3: note記事・SNS投稿の自動生成
 *
 * /コンテンツ生成 をトリガーに、制作仕様書をもとに
 * note記事草稿と SNS投稿案を Drive に書き出す。
 */

/**
 * /コンテンツ生成 コマンドを処理する。
 * content_id が省略された場合は最新の NOTEBOOK ステータスを探す。
 */
function handleContentCommand_(e) {
  var user    = e.parameter.user_id || '';
  var channel = e.parameter.channel_id || CFG().SLACK_CHANNEL_ID;
  var arg     = (e.parameter.text || '').trim();

  var rec = null;
  if (arg) {
    rec = getArticleById_(arg);
    if (!rec) {
      return slackAck_('コンテンツIDが見つかりません: `' + arg + '`');
    }
  } else {
    rec = findNotebookSession_(user, channel);
    if (!rec) {
      return slackAck_('NotebookLM中 または 仕様書作成済 のセッションが見つかりません。`/コンテンツ生成 <content_id>` で指定するか、先に壁打きを完了させてください。');
    }
  }

  // 重い処理は非同期で（GASのタイムアウト回避のため即ACK）
  generateContentDocs_(rec, channel);
  return slackAck_(':gear: コンテンツ生成を開始しました。完了したらこのチャンネルに通知します。');
}

/**
 * note記事・SNS投稿を生成して Drive に保存し、Slackへ通知する。
 */
function generateContentDocs_(rec, notifyChannel) {
  var contentId = rec.content_id;
  var channel   = notifyChannel || rec.slack_channel;
  var thread    = threadTsOf_(rec);
  var answers   = getSessionData_(rec);

  updateArticle_(contentId, { status: STATUS.EDITOR });

  slackPost_(channel,
    ':writing_hand: note記事とSNS投稿案を生成しています…（1〜2分ほどお待ちください）',
    thread);

  var caseFolder  = findCaseFolder_(contentId);
  var noteFolder  = getOrCreateFolder_(caseFolder, '05_note');
  var snsFolder   = getOrCreateFolder_(caseFolder, '08_sns');

  // note記事生成
  var noteMarkdown = generateNoteMarkdown_(answers, contentId);
  var noteUrl = writeContentDoc_(noteFolder, 'note記事草稿_' + contentId, noteMarkdown);

  // SNS投稿案生成
  var snsMarkdown = generateSNSMarkdown_(answers, contentId);
  var snsUrl = writeContentDoc_(snsFolder, 'SNS投稿案_' + contentId, snsMarkdown);

  patchSessionData_(contentId, { note_draft_url: noteUrl, sns_draft_url: snsUrl });
  updateArticle_(contentId, { status: STATUS.WAITING, note_draft_url: noteUrl });

  var msg = [
    ':white_check_mark: *コンテンツ生成が完了しました。*',
    '',
    '*note記事草稿：* ' + noteUrl,
    '*SNS投稿案：* ' + snsUrl,
    '',
    '内容を確認して、必要であれば修正・加筆してから投稿してください。'
  ].join('\n');
  slackPost_(channel, msg, thread);
}

/** NOTEBOOK or BRIEF_DONE ステータスの最新セッションを探す */
function findNotebookSession_(slackUser, slackChannel) {
  var sh     = sheetByName_('article_requests');
  var map    = headerMap_(sh);
  var values = sh.getDataRange().getValues();
  var found  = null;
  var target = [STATUS.NOTEBOOK, STATUS.BRIEF_DONE];
  for (var r = 1; r < values.length; r++) {
    var status = (values[r][map['status'] - 1] || '').toString();
    var user   = (values[r][map['slack_user'] - 1] || '').toString();
    var ch     = (values[r][map['slack_channel'] - 1] || '').toString();
    if (target.indexOf(status) >= 0 && user === slackUser && ch === slackChannel) {
      found = rowToObj_(values[r], map, r + 1);
    }
  }
  return found;
}

/** Markdown を Google Docs として指定フォルダに保存。URL を返す */
function writeContentDoc_(folder, title, markdown) {
  var doc  = DocumentApp.create(title);
  var body = doc.getBody();
  body.clear();
  renderMarkdownToBody_(body, markdown);
  doc.saveAndClose();

  var file = DriveApp.getFileById(doc.getId());
  folder.addFile(file);
  try { DriveApp.getRootFolder().removeFile(file); } catch (e) {}

  return doc.getUrl();
}
