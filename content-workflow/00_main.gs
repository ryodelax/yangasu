/**
 * 00_main.gs — Web App エントリポイント（Slack ルーター）
 *
 * Slackからの2系統を受ける:
 *   1) スラッシュコマンド /記事作成 <テーマ>   … 壁打ち開始
 *   2) Events API  message.channels           … 壁打ちの回答
 *
 * 【認証】GASはヘッダーを読めないため署名検証は不可。
 *   Request URL に ?key=WEBAPP_SECRET を付け、e.parameter.key を照合する。
 * 【3秒制約 / 再送】event_id を CacheService でデデュープし、再送は即200。
 */

/** ヘルスチェック用 */
function doGet(e) {
  return ContentService.createTextOutput('content-workflow webapp: OK');
}

function doPost(e) {
  try {
    if (!e) return ok200_();

    // --- URL秘密キーの照合 ---
    if (!verifyRequest_(e)) {
      logError_('doPost: 不正なリクエスト（key不一致）', null);
      return ContentService.createTextOutput('forbidden');
    }

    // --- (1) スラッシュコマンド ---
    if (e.parameter && e.parameter.command) {
      return handleSlashCommand_(e);
    }

    // --- (2) Events API / url_verification ---
    if (e.postData && e.postData.contents) {
      var body = JSON.parse(e.postData.contents);

      if (body.type === 'url_verification') {
        return ContentService.createTextOutput(body.challenge || '');
      }

      if (body.type === 'event_callback') {
        // 再送デデュープ（同じevent_idは1度だけ処理）
        if (body.event_id && isDuplicateEvent_(body.event_id)) {
          return ok200_();
        }
        var ev = body.event;
        if (ev && ev.type === 'app_home_opened') {
          publishAppHome_(ev.user);
          return ok200_();
        }
        handleEvent_(ev);
        return ok200_();
      }
    }

    return ok200_();
  } catch (err) {
    notifyError_('doPost', err);
    return ok200_(); // Slackには200を返し再送ループを避ける
  }
}

/** ?key= が WEBAPP_SECRET と一致するか */
function verifyRequest_(e) {
  try {
    return e.parameter && e.parameter.key === CFG().WEBAPP_SECRET;
  } catch (err) {
    return false;
  }
}

/** event_id をキャッシュに記録。既出なら true */
function isDuplicateEvent_(eventId) {
  var cache = CacheService.getScriptCache();
  var k = 'evt_' + eventId;
  if (cache.get(k)) return true;
  cache.put(k, '1', 600); // 10分
  return false;
}

/** スラッシュコマンドをコマンド名で振り分け */
function handleSlashCommand_(e) {
  var cmd = (e.parameter.command || '').trim();
  if (cmd === '/コンテンツ生成') return handleContentCommand_(e);
  if (cmd === '/note整形') return handlePublishCommand_(e);
  return handleArticleCommand_(e);
}

/** /記事作成 <テーマ> */
function handleArticleCommand_(e) {
  var theme   = (e.parameter.text || '').trim();
  var user    = e.parameter.user_id || '';
  var channel = e.parameter.channel_id || CFG().SLACK_CHANNEL_ID;

  if (!theme) {
    return slackAck_('テーマを付けて送ってください。例： `/記事作成 中小企業のAI導入はなぜ失敗するのか`');
  }

  startSession_(theme, user, channel);
  return slackAck_(':memo: 壁打ちを開始しました。スレッドの質問に1問ずつ答えてください。');
}

/** Events API のイベント処理 */
function handleEvent_(event) {
  if (!event || event.type !== 'message') return;

  // Bot自身・編集系・サブタイプ付きは無視
  if (event.subtype) return;
  if (event.bot_id) return;
  if (!event.text) return;
  var botId = getBotUserId_();
  if (botId && event.user === botId) return;

  // --- Phase 1: 壁打ち中セッション ---
  var rec = findActiveSession_(event.user, event.channel);
  if (rec) {
    var sessionTs = threadTsOf_(rec);
    // スレッドが一致する（またはスレッドなし）場合のみ処理
    if (!sessionTs || !event.thread_ts || String(event.thread_ts) === sessionTs) {
      handleAnswer_(rec, event.text);
      return;
    }
    // スレッドが違う → Phase 2以降へ落ちる（別セッションへの返信の可能性）
  }

  // --- Phase 2: 仕様書作成済セッション（NotebookLM承認待ち） ---
  var briefRec = findBriefDoneSession_(event.user, event.channel);
  if (briefRec) {
    var briefTs = threadTsOf_(briefRec);
    // 別スレッドの発言は無視（誤爆防止）。スレッドなし＝チャンネル投稿は通す。
    if (briefTs && event.thread_ts && String(event.thread_ts) !== briefTs) return;
    if (isAffirmative_(event.text)) {
      generateNotebookLMPack_(briefRec);
    } else {
      slackPost_(event.channel,
        'かしこまりました。準備ができたら「はい」と返信してください。', briefTs);
    }
    return;
  }

  // --- Phase 4: Google Doc URL を検出 → NotebookLM素材として保存 ---
  var nlmRec = findNotebookSession_(event.user, event.channel);
  if (nlmRec && event.text && event.text.indexOf('docs.google.com') >= 0) {
    var nlmTs = threadTsOf_(nlmRec);
    if (nlmTs && event.thread_ts && String(event.thread_ts) !== nlmTs) return;
    var urlMatch = event.text.match(/https:\/\/docs\.google\.com\/document\/d\/[a-zA-Z0-9_-]+[^\s]*/);
    if (urlMatch) {
      handleDocUrl_(nlmRec, urlMatch[0], event.channel, nlmTs || event.thread_ts || '');
      return;
    }
  }
}
