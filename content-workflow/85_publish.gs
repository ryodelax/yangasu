/**
 * 85_publish.gs — Phase 4: コンテンツ整形・公開準備
 *
 * NotebookLMで作ったテキストを note / SNS 用に整形して、
 * Slack に返す（ユーザーがコピペして各媒体に公開）
 */

/**
 * /note整形 コマンドを処理する（content_id のみ受け取り、Doc URLはスレッドから自動検出）。
 */
function handlePublishCommand_(e) {
  var contentId = (e.parameter.text || '').trim();
  var channel   = e.parameter.channel_id || CFG().SLACK_CHANNEL_ID;

  if (!contentId) {
    return slackAck_('コンテンツIDを指定してください。例： `/note整形 2026-06-10_テーマ`');
  }

  var rec = getArticleById_(contentId);
  if (!rec) {
    return slackAck_('コンテンツIDが見つかりません: `' + contentId + '`');
  }

  var thread = threadTsOf_(rec);
  var answers = getSessionData_(rec);
  var docUrl  = answers.notebooklm_doc_url || '';

  if (!docUrl) {
    return slackAck_(
      ':warning: NotebookLM素材のDocが見つかりません。\n' +
      '`03_notebooklm` フォルダに保存した Google Doc の URL を、このスレッドに貼り付けてください。'
    );
  }

  formatAndPublish_(rec, docUrl, channel, thread);
  return slackAck_(':pencil: コンテンツを整形しています…（30〜60秒ほどお待ちください）');
}

/**
 * Slack スレッドに Google Doc URL が貼られた場合に呼ばれる。
 * Doc URL を session_data に保存し、整形を開始する。
 */
function handleDocUrl_(rec, docUrl, channel, threadTs) {
  patchSessionData_(rec.content_id, { notebooklm_doc_url: docUrl });
  slackPost_(channel,
    ':link: Google Doc を確認しました。`/note整形 ' + rec.content_id + '` で整形を開始します。',
    threadTs);
}

/**
 * Google Doc を読み込み、note / SNS 用に整形して Slack に返す。
 */
function formatAndPublish_(rec, docUrl, channel, threadTs) {
  var contentId = rec.content_id;
  var answers   = getSessionData_(rec);

  slackPost_(channel, ':hourglass: NotebookLM素材を整形しています…', threadTs);

  var nlmText = readDocContent_(docUrl);
  if (!nlmText) {
    slackPost_(channel,
      ':warning: Google Doc の内容を読み取れませんでした。Doc の共有設定を確認してください。',
      threadTs);
    return;
  }

  var noteFormatted = formatForNote_(nlmText, answers, contentId);
  var snsFormatted  = formatForSNS_(nlmText, answers, contentId);

  // note 用は Drive に保存してURLを返す（文字数制限対策）
  var caseFolder    = findCaseFolder_(contentId);
  var publishFolder = getOrCreateFolder_(caseFolder, '09_publish');
  var savedUrl      = writeContentDoc_(publishFolder, '整形済みnote_' + contentId, noteFormatted);
  patchSessionData_(contentId, { publish_doc_url: savedUrl });

  var msg = [
    ':white_check_mark: *整形完了しました。以下をコピペして公開してください。*',
    '',
    '*📝 note 記事：* ' + savedUrl,
    '（上のリンクを開いてテキストをコピペ → note.com に貼り付け）',
    '',
    '─────────────────',
    '*🐦 X（Twitter）用：*',
    snsFormatted.x,
    '',
    '─────────────────',
    '*🧵 Threads 用：*',
    snsFormatted.threads
  ].join('\n');

  slackPost_(channel, msg, threadTs);
}

/**
 * Google Doc URL からドキュメント本文テキストを取得する。
 */
function readDocContent_(docUrl) {
  try {
    var match = docUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) return '';
    var doc = DocumentApp.openById(match[1]);
    return doc.getBody().getText();
  } catch (e) {
    logError_('readDocContent_', e);
    return '';
  }
}

/**
 * NotebookLM テキストを note 記事用に整形する。
 * @return {Object} {note, markdown}
 */
function formatForNote_(nlmText, answers, contentId) {
  var style = loadStyleProfileText_();

  var system = [
    'あなたは株式会社エキセントリック代表・長谷川遼の「note編集者」です。',
    '壊れかけたNotebookLMの素材を「読みやすく・心に刺さる」note記事に整形します。',
    '',
    '最重要ルール:',
    '- 長谷川の声・現場感を消さない。',
    '- 「業務効率化」「生産性向上」等のAIっぽい一般論は禁止。',
    '- テーマが何であれ、そのテーマに忠実に整形する。AI導入・中小企業など無関係な文脈に無理やり結びつけない。',
    '- 見出しは ## / ### を使う。段落は短く。',
    '- 改行を多めに（オンライン記事向け）。',
    '- 最後に #タグを5個。',
    '',
    '== 長谷川らしさプロファイル ==',
    style
  ].join('\n');

  var prompt = [
    '以下のNotebookLM素材を「note」として読みやすく整形してください。',
    'コンテンツID: ' + contentId,
    '主張: ' + (answers.main_claim || ''),
    '想定読者: ' + (answers.target_reader || ''),
    '',
    '【NotebookLM素材】',
    nlmText,
    '',
    '【要件】',
    '- Markdown形式',
    '- 見出しは ## / ### で作成',
    '- 段落を短く、読みやすく',
    '- 改行を活用',
    '- 最後に #タグを5個追加',
    '- 読者が「自分のことだ」と感じる具体性を保つ',
    '',
    '注意: note に直接コピペできるMarkdownのみ返してください。前置き・後書きなし。'
  ].join('\n');

  var markdown = geminiGenerate_(prompt, system);
  return { note: markdown, markdown: markdown };
}

/**
 * NotebookLM テキストをSNS用に整形する。
 * @return {Object} {x, threads}
 */
function formatForSNS_(nlmText, answers, contentId) {
  var style = loadStyleProfileText_();

  var system = [
    'あなたは株式会社エキセントリック代表・長谷川遼のSNS編集者です。',
    '長谷川の口調・違和感・現場感でSNS投稿を作ります。',
    '',
    '最重要ルール:',
    '- 「業務効率化」「生産性向上」禁止。長谷川の現場感を出す。',
    '- X は140字以内、Threads は300字以内。',
    '- 短い。刺さる。一言で伝わるように。',
    '',
    '== 長谷川らしさプロファイル ==',
    style
  ].join('\n');

  var prompt = [
    '以下のコンテンツからX / Threads 投稿を作成してください。',
    'コンテンツID: ' + contentId,
    '主張: ' + (answers.main_claim || ''),
    '',
    '【素材】',
    nlmText,
    '',
    '【出力フォーマット】',
    '## X（Twitter）投稿',
    '140字以内。note公開時に使う告知文（note記事へのリンク貼り前提）。',
    '',
    '## Threads 投稿',
    '300字以内。長めでOK。note公開を受けての補足・深掘り。',
    '',
    '注意: 投稿テキストのみ。前置き・後書きなし。'
  ].join('\n');

  var snsMarkdown = geminiGenerate_(prompt, system);

  // X と Threads を分割抽出
  var lines = snsMarkdown.split('\n');
  var xText = '';
  var threadsText = '';
  var currentSection = '';

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.includes('X') || line.includes('Twitter')) {
      currentSection = 'x';
    } else if (line.includes('Threads')) {
      currentSection = 'threads';
    } else if (line.trim() && !line.startsWith('#')) {
      if (currentSection === 'x') xText += line + '\n';
      if (currentSection === 'threads') threadsText += line + '\n';
    }
  }

  return { x: xText.trim(), threads: threadsText.trim() };
}
