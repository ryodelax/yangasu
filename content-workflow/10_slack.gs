/**
 * 10_slack.gs — Slack 送受信
 *
 * 【GASの制約メモ】
 * GAS の doPost(e) は HTTP リクエストヘッダーを読めない。
 * → Slack の X-Slack-Signature による署名検証は実装不可能。
 * 代替として Request URL に秘密クエリ ?key=WEBAPP_SECRET を付け、
 *   e.parameter.key を照合する（verifyRequest_ / 00_main.gs）。
 * SLACK_SIGNING_SECRET は将来の中継サーバ用に保管のみ。
 */

/** chat.postMessage（thread_ts 指定でスレッド返信） */
function slackPost_(channel, text, opt_threadTs) {
  var payload = { channel: channel, text: text };
  if (opt_threadTs) payload.thread_ts = opt_threadTs;
  var res = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    headers: { Authorization: 'Bearer ' + CFG().SLACK_BOT_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var body = JSON.parse(res.getContentText() || '{}');
  if (!body.ok) {
    logError_('slack chat.postMessage 失敗', body.error + ' (channel=' + channel + ')');
    // スレッドtsが不正で失敗した場合は、スレッドなしで再送して取りこぼしを防ぐ
    if (opt_threadTs) {
      logInfo_('スレッドなしで再送します', { channel: channel });
      return slackPost_(channel, text);
    }
  }
  return body; // body.ts にメッセージtsが入る
}

/** Bot 自身のユーザーIDを取得（自分の投稿を無視するため）。CacheService に保持 */
function getBotUserId_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('bot_user_id');
  if (cached) return cached;
  var res = UrlFetchApp.fetch('https://slack.com/api/auth.test', {
    method: 'post',
    headers: { Authorization: 'Bearer ' + CFG().SLACK_BOT_TOKEN },
    muteHttpExceptions: true
  });
  var body = JSON.parse(res.getContentText() || '{}');
  if (body.ok && body.user_id) {
    cache.put('bot_user_id', body.user_id, 21600); // 6h
    return body.user_id;
  }
  return '';
}

/** スラッシュコマンドへの即時ACK（3秒制約対策・チャンネルに見えるレスポンス） */
function slackAck_(text) {
  return ContentService
    .createTextOutput(JSON.stringify({ response_type: 'in_channel', text: text }))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 空の200レスポンス（Events API 用） */
function ok200_() {
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}
