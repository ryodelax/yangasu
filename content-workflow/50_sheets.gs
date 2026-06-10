/**
 * 50_sheets.gs — 管理スプレッドシートの読み書き
 *
 * article_requests を唯一の真実とする（GASはステートレス）。
 * 壁打ちの途中状態も必ずここに永続化する。
 */

function ss_() {
  return SpreadsheetApp.openById(CFG().SHEET_ID);
}

function sheetByName_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('シートが見つかりません: ' + name);
  return sh;
}

/** ヘッダー行を {列名: 列index(1始まり)} で返す */
function headerMap_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return {};
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    var key = (headers[i] || '').toString().trim();
    if (key) map[key] = i + 1;
  }
  return map;
}

/**
 * 新しい壁打ちセッション行を追加して content_id を返す。
 */
function createArticleRow_(theme, slackUser, slackChannel, slackThreadTs) {
  var sh = sheetByName_('article_requests');
  var map = headerMap_(sh);
  var contentId = today_() + '_' + slugify_(theme);

  var row = new Array(sh.getLastColumn()).fill('');
  function set(col, val) { if (map[col]) row[map[col] - 1] = val; }

  set('content_id', contentId);
  set('created_at', now_());
  set('status', STATUS.WALL);
  set('session_step', 1);
  set('slack_user', slackUser);
  set('slack_channel', slackChannel);
  set('slack_thread_ts', slackThreadTs || '');
  set('session_data', JSON.stringify({ theme: theme }));
  set('theme', theme);

  sh.appendRow(row);
  return contentId;
}

/** content_id で1行を {列名: 値, _row: 行番号} として取得 */
function getArticleById_(contentId) {
  var sh = sheetByName_('article_requests');
  var map = headerMap_(sh);
  var idCol = map['content_id'];
  if (!idCol) throw new Error('content_id 列がありません');
  var values = sh.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if ((values[r][idCol - 1] || '').toString() === contentId) {
      return rowToObj_(values[r], map, r + 1);
    }
  }
  return null;
}

/**
 * 指定ユーザー×チャンネルで「壁打ち中」の最新セッションを取得。
 * （壁打ちの回答メッセージを正しいセッションに紐付けるため）
 */
function findActiveSession_(slackUser, slackChannel) {
  var sh = sheetByName_('article_requests');
  var map = headerMap_(sh);
  var values = sh.getDataRange().getValues();
  var found = null;
  for (var r = 1; r < values.length; r++) {
    var status = (values[r][map['status'] - 1] || '').toString();
    var user = (values[r][map['slack_user'] - 1] || '').toString();
    var ch = (values[r][map['slack_channel'] - 1] || '').toString();
    if (status === STATUS.WALL && user === slackUser && ch === slackChannel) {
      found = rowToObj_(values[r], map, r + 1); // 後勝ち＝最新行を採用
    }
  }
  return found;
}

function rowToObj_(rowValues, map, rowNumber) {
  var obj = { _row: rowNumber };
  for (var key in map) obj[key] = rowValues[map[key] - 1];
  return obj;
}

/** content_id の特定列を更新（複数列を一括） */
function updateArticle_(contentId, updates) {
  var sh = sheetByName_('article_requests');
  var map = headerMap_(sh);
  var rec = getArticleById_(contentId);
  if (!rec) throw new Error('行が見つかりません: ' + contentId);
  for (var col in updates) {
    if (map[col]) sh.getRange(rec._row, map[col]).setValue(updates[col]);
  }
}

/**
 * 行に保存された Slack スレッドts を実値で返す。
 * 保存時に "ts_" を付けているため、それを剥がす。
 * （万一プレフィックスなしの旧データでも文字列化して返す）
 */
function threadTsOf_(rec) {
  var v = String((rec && rec.slack_thread_ts) || '');
  return v.indexOf('ts_') === 0 ? v.slice(3) : v;
}

/** session_data(JSON) を読む */
function getSessionData_(rec) {
  try { return JSON.parse(rec.session_data || '{}'); }
  catch (e) { return {}; }
}

/** session_data(JSON) に1キー追記して保存 */
function patchSessionData_(contentId, patch) {
  var rec = getArticleById_(contentId);
  var data = getSessionData_(rec);
  for (var k in patch) data[k] = patch[k];
  updateArticle_(contentId, { session_data: JSON.stringify(data) });
  return data;
}

/**
 * 指定ユーザー×チャンネルで「仕様書作成済」の最新セッションを取得。
 * Phase2 のNotebookLM承認待ちを検出するために使う。
 */
function findBriefDoneSession_(slackUser, slackChannel) {
  var sh = sheetByName_('article_requests');
  var map = headerMap_(sh);
  var values = sh.getDataRange().getValues();
  var found = null;
  for (var r = 1; r < values.length; r++) {
    var status = (values[r][map['status'] - 1] || '').toString();
    var user   = (values[r][map['slack_user'] - 1] || '').toString();
    var ch     = (values[r][map['slack_channel'] - 1] || '').toString();
    if (status === STATUS.BRIEF_DONE && user === slackUser && ch === slackChannel) {
      found = rowToObj_(values[r], map, r + 1); // 後勝ち＝最新行を採用
    }
  }
  return found;
}

/**
 * style_profile を1つのテキストブロックにまとめて返す。
 * 全AI呼び出しのコンテキスト源（設計書§7 長谷川らしさ）。
 */
function loadStyleProfileText_() {
  var sh = ss_().getSheetByName('style_profile');
  if (!sh || sh.getLastRow() < 2) return '(style_profile 未設定)';
  var map = headerMap_(sh);
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var lines = [];
  for (var i = 0; i < values.length; i++) {
    var cat = values[i][map['category'] - 1];
    var item = values[i][map['item'] - 1];
    var detail = values[i][map['detail'] - 1];
    var ex = values[i][map['examples'] - 1];
    if (!cat && !item && !detail) continue;
    var line = '【' + cat + '】' + (item ? item + ': ' : '') + detail;
    if (ex) line += '\n   例: ' + ex;
    lines.push(line);
  }
  return lines.join('\n');
}
