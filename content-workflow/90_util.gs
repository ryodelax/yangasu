/**
 * 90_util.gs — 設定・ID取得・ログ・共通定数
 *
 * 思考起点型コンテンツ制作ワークフロー / Phase1
 * 認証情報はすべて Script Properties から読む。コード／Gitには絶対に書かない。
 */

/** Script Properties から値を取得（必須キーが空ならエラー） */
function prop_(key, opt_default) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  if (v === null || v === '') {
    if (typeof opt_default !== 'undefined') return opt_default;
    throw new Error('Script Property が未設定です: ' + key);
  }
  return v;
}

/** 設定値まとめ（呼ぶたびに読む。GASはステートレス前提） */
function CFG() {
  return {
    SLACK_BOT_TOKEN:    prop_('SLACK_BOT_TOKEN'),
    GEMINI_API_KEY:     prop_('GEMINI_API_KEY'),
    GEMINI_MODEL:       prop_('GEMINI_MODEL', 'gemini-2.5-flash'),
    SHEET_ID:           prop_('SHEET_ID'),
    DRIVE_ROOT_ID:      prop_('DRIVE_ROOT_ID'),
    SLACK_CHANNEL_ID:   prop_('SLACK_CHANNEL_ID'),
    WEBAPP_SECRET:      prop_('WEBAPP_SECRET'),
    ADMIN_CHANNEL:      prop_('ADMIN_SLACK_CHANNEL', prop_('SLACK_CHANNEL_ID'))
  };
}

/** article_requests シートの列順（setup() でヘッダーとして書き込む） */
var ARTICLE_HEADERS = [
  'content_id',
  'created_at',
  'status',
  'session_step',
  'slack_user',
  'slack_channel',
  'slack_thread_ts',
  'session_data',
  'theme',
  'core_discomfort',
  'target_reader',
  'main_claim',
  'business_goal',
  'primary_channel',
  'secondary_channels',
  'brief_doc_url',
  'drive_folder_url',
  'note_draft_url',
  'youtube_asset_url',
  'audio_asset_url',
  'published_note_url',
  'published_youtube_url'
];

/** style_profile シートの列順 */
var STYLE_HEADERS = ['category', 'item', 'detail', 'examples'];

/** ステータス定義 */
var STATUS = {
  WALL:       '壁打ち中',
  BRIEF_DONE: '仕様書作成済',
  NOTEBOOK:   'NotebookLM中',
  EDITOR:     '編集長AI中',
  WAITING:    '投稿待ち',
  PUBLISHED:  '投稿済'
};

/** 案件フォルダのサブフォルダ構成（設計書§12-2） */
var CASE_SUBFOLDERS = [
  '01_brief',
  '02_sources',
  '03_notebooklm',
  '04_editorial_judge',
  '05_note',
  '06_youtube',
  '07_audio',
  '08_sns',
  '09_publish'
];

/** ログ出力（Stackdriver / 実行ログ） */
function logInfo_(msg, obj) {
  try {
    console.log('[INFO] ' + msg + (obj ? ' :: ' + JSON.stringify(obj) : ''));
  } catch (e) { console.log('[INFO] ' + msg); }
}
function logError_(msg, err) {
  console.error('[ERROR] ' + msg + (err ? ' :: ' + (err.stack || err) : ''));
}

/** 例外を管理者チャンネルへ通知（落ちても本処理は止めない） */
function notifyError_(context, err) {
  logError_(context, err);
  try {
    slackPost_(CFG().ADMIN_CHANNEL, ':warning: エラー (' + context + ')\n```' + (err && (err.stack || err.message || err) || err) + '```');
  } catch (e) {
    logError_('notifyError_ 自体が失敗', e);
  }
}

/** content_id 用スラッグ生成（日本語はそのまま残し、危険文字のみ除去） */
function slugify_(text) {
  var s = (text || '').toString().trim();
  s = s.replace(/[\\\/:\*\?"<>\|\[\]\.]/g, '');   // ファイル名に使えない文字を除去
  s = s.replace(/\s+/g, '_');
  s = s.slice(0, 40);
  return s || 'untitled';
}

/** 今日の日付 YYYY-MM-DD（JST） */
function today_() {
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
}

/** ISO風タイムスタンプ（JST） */
function now_() {
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
}
