/**
 * 経営参謀「ゲンさん」bot
 * - 経理管理台帳をリアルタイムに読み、売上2,000万円への逆算を常に把握した経営仲間
 * - チャットWebアプリ（doGet）／毎朝の檄（sendMorningFire）／金曜の週次レビュー（sendWeeklyReview）
 *
 * セットアップは keiei_bot/SETUP.md 参照。
 * 必要なスクリプトプロパティ: GEMINI_API_KEY（既存の秘書アプリと同じキーでOK）
 * 任意: SLACK_WEBHOOK_URL（設定すればSlackにも配信）, MAIL_TO（省略時は実行ユーザー宛）
 */

const GEN_CFG = {
  LEDGER_ID: '10suO_60OkhMpHLgouubGgGtIml49HgvxuVy_jsrSIa0', // 経理管理台帳_事業経費分離
  REPORT_SHEET_HINT: '月次レポート（法人）',
  GOAL_AMOUNT: 20000000,               // 年間売上目標 2,000万円
  GOAL_START: '2026-07-01',            // FY2026: 2026/07〜2027/06
  GOAL_END: '2027-06-30',
  GEMINI_MODEL: 'gemini-2.5-flash',
  MORNING_HOUR: 7,
  WEEKLY_DAY: ScriptApp.WeekDay.FRIDAY,
  WEEKLY_HOUR: 17
};

/* ================= 台帳スナップショット ================= */

/** 台帳から現在地を読み取り、2000万への逆算込みのテキストを返す */
function buildLedgerSnapshot_() {
  const ss = SpreadsheetApp.openById(GEN_CFG.LEDGER_ID);
  const sheet = ss.getSheets().filter(function(s) {
    return s.getName().indexOf(GEN_CFG.REPORT_SHEET_HINT) >= 0;
  })[0] || ss.getSheets()[0];
  const values = sheet.getDataRange().getValues();

  // ラベル行（A列 or B列）を探すヘルパー
  function findRow(label) {
    for (var i = 0; i < values.length; i++) {
      var a = String(values[i][0] || '').trim();
      var b = String(values[i][1] || '').trim();
      if (a === label || b === label) return values[i];
    }
    return null;
  }
  function nums(row) {
    if (!row) return [];
    return row.slice(1).map(function(v) {
      var n = Number(String(v).replace(/[,¥\s]/g, ''));
      return isNaN(n) ? null : n;
    });
  }

  // 月ヘッダー行（"2025/07" 形式が並ぶ行）
  var monthRow = null;
  for (var i = 0; i < Math.min(values.length, 10); i++) {
    var hits = values[i].filter(function(v) {
      return /^\d{4}\/\d{2}$/.test(String(v).trim()) || (v instanceof Date);
    });
    if (hits.length >= 6) { monthRow = values[i]; break; }
  }
  var months = (monthRow || []).map(function(v) {
    if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy/MM');
    return /^\d{4}\/\d{2}$/.test(String(v).trim()) ? String(v).trim() : null;
  });

  var sales = nums(findRow('売上実績'));
  var cashIn = nums(findRow('入金（回収）'));
  var expense = nums(findRow('経費合計'));
  var profit = nums(findRow('営業利益'));

  // 月配列とデータを対応づけて期間内を集計
  var start = new Date(GEN_CFG.GOAL_START);
  var end = new Date(GEN_CFG.GOAL_END);
  var now = new Date();
  // 列対応: nums() は row.slice(1) 済みのため、months の列 c は nums の添字 c-1 に対応する
  var inPeriodSales = 0, totalSales = 0, totalIn = 0, recent = [];
  for (var c = 1; c < months.length; c++) {
    if (!months[c]) continue;
    var d = new Date(months[c] + '/01');
    var s = sales[c - 1] || 0;
    totalSales += s;
    totalIn += (cashIn[c - 1] || 0);
    if (d >= start && d <= end) inPeriodSales += s;
    if (d <= now) recent.push(s);
  }
  var recent3 = recent.slice(-3);
  var recent3avg = recent3.length ? Math.round(recent3.reduce(function(a, b) { return a + b; }, 0) / recent3.length) : 0;

  var monthsLeft = Math.max(1, (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth()) + 1);
  var remaining = Math.max(0, GEN_CFG.GOAL_AMOUNT - inPeriodSales);
  var needPerMonth = Math.round(remaining / monthsLeft);
  var landing = inPeriodSales + recent3avg * monthsLeft;
  var uncollected = Math.max(0, totalSales - totalIn);

  function yen(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '円'; }

  return [
    '【台帳スナップショット ' + Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm') + '】',
    '目標: FY2026(2026/07〜2027/06) 売上 ' + yen(GEN_CFG.GOAL_AMOUNT),
    '期間内売上累計: ' + yen(inPeriodSales) + '（進捗 ' + Math.round(inPeriodSales / GEN_CFG.GOAL_AMOUNT * 100) + '%）',
    '残り: ' + yen(remaining) + ' ÷ 残り' + monthsLeft + 'ヶ月 = 必要月販 ' + yen(needPerMonth),
    '直近3ヶ月平均売上: ' + yen(recent3avg) + '／このペースの着地予測: ' + yen(landing),
    'ギャップ倍率: 現状ペースの ' + (recent3avg > 0 ? (needPerMonth / recent3avg).toFixed(1) : '∞') + '倍が必要',
    '台帳上の未回収（発生-回収の累計差）: ' + yen(uncollected),
    '直近月次売上: ' + months.map(function(m, c) { return m && sales[c - 1] != null ? m + '=' + yen(sales[c - 1]) : null; }).filter(Boolean).slice(-4).join(', ')
  ].join('\n');
}

/* ================= ペルソナ ================= */

const GEN_PERSONA = [
  'あなたは「源田 剛（げんだ つよし）」、通称ゲンさん。52歳。株式会社エキセントリック（代表: 長谷川遼）の経営参謀であり、本気の経営仲間。',
  '経歴: 広島の整備機器商社で営業部長として年商を3倍にした後、中小企業3社の経営再建に参画。現場・現金・現実の「3ゲン主義」が信条。',
  '',
  '# 性格・話し方',
  '- 熱い兄貴分。軽い広島弁混じりのタメ口（「〜じゃろ」「ようやっとる」「ほいじゃ」程度。読みにくいほどは崩さない）。',
  '- 精神論だけで励まさない。必ず台帳の数字（スナップショットが毎回渡される）を根拠に話す。',
  '- 「あれもこれも」を最も嫌う。施策を広げようとしたら必ず止めて、一点集中に絞らせる。',
  '- 遠慮しない。良くない数字・甘い計画はハッキリ指摘する。ただし人格は絶対に否定しない。行動と仕組みの話に落とす。',
  '- 口癖: 「で、今日どう動く？」「売上は嘘つかんし、行動も嘘つかん」',
  '- 返答は短く。長くても400字程度。箇条書きを使い、最後は必ず「次の一歩」を1個だけ指定する。',
  '',
  '# モチベーションが下がっている・迷っている相談への対応プロトコル',
  '1. まず1行だけ共感する（説教から入らない）',
  '2. 台帳の数字で「現在地」を客観的に見せる（意外と進んでいる点があれば必ず拾う）',
  '3. 5分でできる小さい一歩を1個だけ指示する（DM1通書く、督促メール1本、台帳を開く、で良い）',
  '4. 最後に前を向かせる一言で締める',
  '',
  '# 会社の現在戦略（FY2026・承認済み）を前提に助言すること',
  '- 目標: 年間売上2,000万円（2026/07〜2027/06）。月平均167万円。本気の挑戦目標。',
  '- 看板商品「ミカイシュウ・ゼロ」: 請求したのに払われていないお金を自動で見つけて回収まで追いかけるシステム。初期498,000円+月額29,800円。フロント商品は無料未回収診断（30分）。',
  '- ターゲットは1業種のみ: 従業員5〜30名の自動車整備・鈑金・車検工場（広島・福山→神奈川）。上期は他業種営業禁止。',
  '- チャネルは2本のみ: ①導入先起点の業界内紹介（紹介カード+成約時謝礼10%） ②郵送DM月50通+3営業日後の電話→無料診断アポ。',
  '- 受注ファネル目安: DM60通→電話25件→診断2.5件→受注1件。2,000万に必要なのは概ね「パッケージ月2件+大型開発を年2件+保守ストック積み上げ」。つまりDM・電話は月120件規模、1日あたりDM6通+電話フォロー6件が基準行動量。',
  '- 過去の教訓: ブリッジ社案件は顧客トラブルで打ち切り。全案件で契約3点セット（要件定義・検収基準・解約精算条項）を必須化。未回収は期日+3営業日で督促。',
  '- FY2025実績: 売上5,248,734円、営業利益2,769,448円（利益率52.8%）、固定費は月約17万円と軽い。稼げば残る体質。',
  '',
  '# 禁止事項',
  '- 新しい施策・チャネル・ターゲットを安易に足すこと（提案されたら「今のファネルの数字を見てから」と返す）',
  '- 根拠のない売上予測、税務・法務の断定的助言（専門家に確認させる）',
  '- 長い一般論。ゲンさんは常に「長谷川遼の会社の、今日の話」をする。'
].join('\n');

/* ================= Gemini 呼び出し ================= */

function callGemini_(systemText, contents) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY が設定されていません（スクリプトプロパティ）');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    GEN_CFG.GEMINI_MODEL + ':generateContent?key=' + apiKey;
  const payload = {
    systemInstruction: { parts: [{ text: systemText }] },
    contents: contents,
    generationConfig: { temperature: 0.9, maxOutputTokens: 1024 }
  };
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const json = JSON.parse(res.getContentText());
  if (res.getResponseCode() !== 200) {
    throw new Error('Gemini API エラー: ' + (json.error && json.error.message || res.getResponseCode()));
  }
  return json.candidates[0].content.parts.map(function(p) { return p.text || ''; }).join('');
}

/* ================= チャット本体 ================= */

/**
 * チャットUIから呼ばれる。history は [{role:'user'|'model', text:'...'}] の配列。
 */
function askGen(userMessage, history) {
  const snapshot = buildLedgerSnapshot_();
  const contents = [];
  (history || []).slice(-12).forEach(function(m) {
    contents.push({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: m.text }] });
  });
  contents.push({ role: 'user', parts: [{ text: userMessage }] });
  const system = GEN_PERSONA + '\n\n# 最新の台帳データ（毎回これを根拠に話すこと）\n' + snapshot;
  try {
    return callGemini_(system, contents);
  } catch (e) {
    return 'すまん、頭（API）が一瞬つながらんかった。もう一回送ってくれ。\n（' + e.message + '）\n\nとりあえず現在地だけ置いとくで:\n' + snapshot;
  }
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('chat')
    .setTitle('ゲンさん｜経営参謀')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ================= 定時配信 ================= */

function deliver_(subject, body) {
  const props = PropertiesService.getScriptProperties();
  const to = props.getProperty('MAIL_TO') || Session.getActiveUser().getEmail();
  GmailApp.sendEmail(to, subject, body);
  const webhook = props.getProperty('SLACK_WEBHOOK_URL');
  if (webhook) {
    UrlFetchApp.fetch(webhook, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ text: '*' + subject + '*\n' + body }),
      muteHttpExceptions: true
    });
  }
}

/** 毎朝7時: 今日の檄 */
function sendMorningFire() {
  const snapshot = buildLedgerSnapshot_();
  var body;
  try {
    body = callGemini_(GEN_PERSONA + '\n\n# 最新の台帳データ\n' + snapshot, [{
      role: 'user',
      parts: [{ text: '朝の檄をくれ。①現在地を数字で2行 ②今日の基準行動（DM6通・電話6件・台帳15分チェック）への一押し ③今日イチバン大事な一手を1個。全体で250字以内。' }]
    }]);
  } catch (e) {
    body = 'おはよう。今日も現場・現金・現実じゃ。\n\n' + snapshot +
      '\n\n基準行動: DM6通／電話フォロー6件／台帳チェック15分。\nで、今日どう動く？';
  }
  deliver_('【ゲンさん】今日の檄 ' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'M/d'), body);
}

/** 金曜17時: 週次レビュー */
function sendWeeklyReview() {
  const snapshot = buildLedgerSnapshot_();
  var body;
  try {
    body = callGemini_(GEN_PERSONA + '\n\n# 最新の台帳データ\n' + snapshot, [{
      role: 'user',
      parts: [{ text: '金曜の週次レビューをくれ。①今週の数字の評価（進捗率と必要月販に対して）②来週最優先の1テーマ ③ねぎらいの一言。400字以内。返信でそのまま相談できることも伝えて。' }]
    }]);
  } catch (e) {
    body = '週次レビューじゃ。\n\n' + snapshot + '\n\n来週の最優先を1個だけ決めて月曜に教えてくれ。ようやっとる、休むのも仕事じゃ。';
  }
  deliver_('【ゲンさん】週次レビュー ' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'M/d'), body);
}

/** トリガー一括設定（初回に1度だけ手動実行） */
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (['sendMorningFire', 'sendWeeklyReview'].indexOf(t.getHandlerFunction()) >= 0) {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('sendMorningFire').timeBased().everyDays(1).atHour(GEN_CFG.MORNING_HOUR).create();
  ScriptApp.newTrigger('sendWeeklyReview').timeBased().onWeekDay(GEN_CFG.WEEKLY_DAY).atHour(GEN_CFG.WEEKLY_HOUR).create();
  return 'トリガー設定完了: 毎朝' + GEN_CFG.MORNING_HOUR + '時の檄＋金曜' + GEN_CFG.WEEKLY_HOUR + '時の週次レビュー';
}

/** 動作確認用: スナップショットをログに出す */
function testSnapshot() {
  Logger.log(buildLedgerSnapshot_());
}
