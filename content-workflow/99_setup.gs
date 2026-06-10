/**
 * 99_setup.gs — 初回セットアップ
 *
 * 使い方:
 *   1) Script Properties に SLACK_BOT_TOKEN / GEMINI_API_KEY を貼る（本人）
 *   2) この setup() を1回実行
 *   3) ログに出る WEBAPP_SECRET を控える（Slack Request URL に ?key= で付ける）
 *   4) ウェブアプリとしてデプロイ（全員/匿名アクセス）
 */
function setup() {
  ensureNonSecretProps_();
  ensureWebappSecret_();
  ensureArticleSheet_();
  ensureStyleProfileSheet_();
  reportMissingSecrets_();
  Logger.log('setup 完了。上のログを確認してください。');
}

/** 既知の非機密ID（プランから）を未設定なら投入 */
function ensureNonSecretProps_() {
  var sp = PropertiesService.getScriptProperties();
  var defaults = {
    SHEET_ID:         '1rQ9yuLttQXgm6HeSaQ__x5mOSfYIbs_9sEgppLZ1yc4',
    DRIVE_ROOT_ID:    '10xsP4L9op1HKacCzChAzqYS2bwZA0pEw',
    SLACK_CHANNEL_ID: 'C0B8T5M20PM',
    GEMINI_MODEL:     'gemini-2.5-flash'
  };
  Object.keys(defaults).forEach(function (k) {
    if (!sp.getProperty(k)) {
      sp.setProperty(k, defaults[k]);
      Logger.log('Script Property を設定: ' + k + ' = ' + defaults[k]);
    }
  });
}

/** WEBAPP_SECRET を未設定なら自動生成してログ表示 */
function ensureWebappSecret_() {
  var sp = PropertiesService.getScriptProperties();
  var s = sp.getProperty('WEBAPP_SECRET');
  if (!s) {
    s = Utilities.getUuid().replace(/-/g, '');
    sp.setProperty('WEBAPP_SECRET', s);
  }
  Logger.log('▼ WEBAPP_SECRET（Slack Request URL の末尾に ?key=これ を付ける）:');
  Logger.log('   ' + s);
}

/** 機密キーが未設定なら警告 */
function reportMissingSecrets_() {
  var sp = PropertiesService.getScriptProperties();
  ['SLACK_BOT_TOKEN', 'GEMINI_API_KEY'].forEach(function (k) {
    if (!sp.getProperty(k)) Logger.log('⚠ 未設定: ' + k + ' を Script Properties に貼ってください。');
  });
}

/** article_requests シートを用意し、足りない列を追記（既存データは保持） */
function ensureArticleSheet_() {
  var ss = SpreadsheetApp.openById(prop_('SHEET_ID'));
  var sh = ss.getSheetByName('article_requests');
  if (!sh) {
    sh = ss.insertSheet('article_requests');
    sh.getRange(1, 1, 1, ARTICLE_HEADERS.length).setValues([ARTICLE_HEADERS]);
    sh.setFrozenRows(1);
    Logger.log('article_requests を新規作成');
    return;
  }
  // 既存ヘッダーに無い列を末尾へ追加
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var existing = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (v) { return (v || '').toString().trim(); });
  var toAdd = ARTICLE_HEADERS.filter(function (h) { return existing.indexOf(h) < 0; });
  if (toAdd.length) {
    sh.getRange(1, existing.length + 1, 1, toAdd.length).setValues([toAdd]);
    Logger.log('article_requests に列を追加: ' + toAdd.join(', '));
  }
  sh.setFrozenRows(1);
}

/** style_profile シートを用意し、空なら§7の長谷川らしさを初期投入 */
function ensureStyleProfileSheet_() {
  var ss = SpreadsheetApp.openById(prop_('SHEET_ID'));
  var sh = ss.getSheetByName('style_profile');
  if (!sh) {
    sh = ss.insertSheet('style_profile');
    sh.getRange(1, 1, 1, STYLE_HEADERS.length).setValues([STYLE_HEADERS]);
    sh.setFrozenRows(1);
  }
  if (sh.getLastRow() < 2) {
    var rows = styleProfileSeed_();
    sh.getRange(2, 1, rows.length, STYLE_HEADERS.length).setValues(rows);
    Logger.log('style_profile に初期データを投入: ' + rows.length + '行');
  } else {
    Logger.log('style_profile は既存データありのためスキップ');
  }
}

/** 設計書§7 長谷川らしさプロファイルの初期行 */
function styleProfileSeed_() {
  return [
    ['文体', '一人称', '「僕」を使う。', ''],
    ['文体', '基本トーン', '基本は「です・ます」。内省や違和感の部分は少し崩してよい。', ''],
    ['文体', '構成', '段落は短め。余白を多く取る。強く売り込まない。', ''],
    ['文体', '入り方', '自分の違和感を静かに言語化し、最後に構造やビジネス視点へ接続する。', ''],
    ['思考', '違和感起点', '具体的な出来事から違和感を拾い、すぐ結論にせず構造として見る。', ''],
    ['思考', '関心', '人間の本音・現場の事情・経営判断のズレに関心がある。', ''],
    ['思考', 'AI観', 'AIをすごいツールとしてではなく、現場の詰まりをほどく手段として見る。', ''],
    ['思考', '現場感', '中小企業の現場・紙文化・二重入力・属人化・経営者の孤独に敏感。', ''],
    ['思考', '逆張り', '流行りのAI導入論に距離を置く。「導入しない選択肢」「内製化」「外部依存からの脱却」視点。', ''],
    ['思考', '事業着地', '最終的にAI導入支援・業務設計・自動化・内製化支援につなげたい。', ''],
    ['NG', '一般論', 'AIっぽい一般論・テンプレ表現は禁止。', '生成AIを活用することで、業務効率化や生産性向上が期待できます。'],
    ['NG', '締め表現', '締めのテンプレ表現を使わない。', 'いかがだったでしょうか／本記事では〜を解説しました'],
    ['NG', '煽り', 'ノウハウ商材っぽい煽り・キラキラ起業家文体を避ける。', '〜の3つのポイント／成功の秘訣／AI時代に必要な力'],
    ['OK', '違和感の言語化', '現場の具体で違和感を語る。', 'AI導入で最初に見るべきなのは、AIではないと思っています。現場で同じ数字を何回入力しているか。'],
    ['事業導線', '自然な接続', '「AI導入の相談」ではなく「業務フロー整理・AI導入支援の相談」に自然につなげる。', '']
  ];
}

/* ============================================================
 *  デプロイ前の動作確認用（任意）
 * ============================================================ */

/** 設定の疎通チェック（Slack/Gemini/Sheet/Drive） */
function selftest() {
  var cfg = CFG();
  Logger.log('SHEET: ' + SpreadsheetApp.openById(cfg.SHEET_ID).getName());
  Logger.log('DRIVE: ' + DriveApp.getFolderById(cfg.DRIVE_ROOT_ID).getName());
  Logger.log('BOT user_id: ' + getBotUserId_());
  Logger.log('GEMINI 応答: ' + geminiGenerate_('「テスト成功」とだけ返してください。'));
  Logger.log('selftest 完了');
}
