/**
 * 15_home.gs — Slack App Home タブ
 *
 * ユーザーがBotのアイコンをクリックすると app_home_opened イベントが発火し、
 * views.publish で Block Kit のホーム画面を返す。
 */

/**
 * App Home を公開する。
 * @param {string} userId  Slack ユーザーID
 */
function publishAppHome_(userId) {
  var view = {
    type: 'home',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '📝 壁打きBot — コマンドガイド', emoji: true }
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Step 1｜壁打きを始める*\n`/記事作成 テーマ`\n\n例: `/記事作成 中小企業がAI導入に失敗する理由`\n\n→ 9つの質問に順番に答えると *制作仕様書* が自動生成されます。'
        }
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Step 2｜NotebookLM素材を生成する*\n壁打き完了後、スレッドに *「はい」* と返信\n\n→ NotebookLMに投入するための深掘り素材が生成されます。\n→ 生成されたドキュメントを手動でNotebookLMにアップロードしてください。'
        }
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Step 3｜コンテンツを生成する*\n`/コンテンツ生成`\n\n→ note記事草稿・SNS投稿案（X×3案、Threads、note告知）を\n　 自動生成してDriveに保存します。'
        }
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*壁打き中のヒント*\n• 1問ずつスレッドに返信してください\n• 「*リセット*」と返信すると最初の質問に戻ります\n• 答えに詰まったら簡単に書いてOK（AIが補足します）'
        }
      }
    ]
  };

  UrlFetchApp.fetch('https://slack.com/api/views.publish', {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    headers: { Authorization: 'Bearer ' + CFG().SLACK_BOT_TOKEN },
    payload: JSON.stringify({ user_id: userId, view: view }),
    muteHttpExceptions: true
  });
}
