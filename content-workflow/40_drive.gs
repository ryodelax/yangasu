/**
 * 40_drive.gs — 案件フォルダ自動生成 + 制作仕様書Docs出力
 *
 * 構成（設計書§12）:
 *   DRIVE_ROOT_ID/
 *     content-production/
 *       articles/
 *         <content_id>/
 *           01_brief 〜 09_publish
 */

/** name の子フォルダを取得、なければ作成 */
function getOrCreateFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

/** content-production/articles を返す（無ければ作る） */
function getArticlesFolder_() {
  var root = DriveApp.getFolderById(CFG().DRIVE_ROOT_ID);
  var cp = getOrCreateFolder_(root, 'content-production');
  return getOrCreateFolder_(cp, 'articles');
}

/**
 * 案件フォルダ一式を作成し、{folder, briefFolder} を返す。
 */
function createCaseFolders_(contentId) {
  var articles = getArticlesFolder_();
  var caseFolder = getOrCreateFolder_(articles, contentId);
  var subRefs = {};
  CASE_SUBFOLDERS.forEach(function (name) {
    subRefs[name] = getOrCreateFolder_(caseFolder, name);
  });
  return { folder: caseFolder, sub: subRefs };
}

/**
 * 制作仕様書(Markdown文字列)を 01_brief 配下の Google Docs として出力。
 * @return {string} 作成したDocのURL
 */
function writeBriefDoc_(briefFolder, contentId, markdown) {
  var doc = DocumentApp.create('制作仕様書_' + contentId);
  var body = doc.getBody();
  body.clear();
  renderMarkdownToBody_(body, markdown);
  doc.saveAndClose();

  // マイドライブ直下にできるので 01_brief へ移動
  var file = DriveApp.getFileById(doc.getId());
  briefFolder.addFile(file);
  try { DriveApp.getRootFolder().removeFile(file); } catch (e) { /* 既に移動済 */ }

  return doc.getUrl();
}

/**
 * 簡易 Markdown → Google Docs レンダラ。
 * 見出し(#,##,###)・箇条書き(-,*)・水平線(---)・通常段落のみ対応。
 */
function renderMarkdownToBody_(body, markdown) {
  var lines = (markdown || '').replace(/\r/g, '').split('\n');
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trimmed = line.trim();

    if (trimmed === '') { body.appendParagraph(''); continue; }

    if (/^---+$/.test(trimmed)) { body.appendHorizontalRule(); continue; }

    var h = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      var level = h[1].length;
      var p = body.appendParagraph(h[2]);
      var styles = [
        DocumentApp.ParagraphHeading.TITLE,
        DocumentApp.ParagraphHeading.HEADING1,
        DocumentApp.ParagraphHeading.HEADING2,
        DocumentApp.ParagraphHeading.HEADING3
      ];
      p.setHeading(styles[level - 1] || DocumentApp.ParagraphHeading.HEADING3);
      continue;
    }

    var li = trimmed.match(/^[-*]\s+(.*)$/);
    if (li) {
      body.appendListItem(stripInlineMd_(li[1])).setGlyphType(DocumentApp.GlyphType.BULLET);
      continue;
    }

    body.appendParagraph(stripInlineMd_(trimmed));
  }
}

/** 太字/コードの記号だけ軽く除去（Docsへはプレーンに） */
function stripInlineMd_(s) {
  return (s || '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/`(.*?)`/g, '$1');
}

/** content_id の案件フォルダを取得（createCaseFolders_ で作成済み前提） */
function findCaseFolder_(contentId) {
  var articles = getArticlesFolder_();
  var it = articles.getFoldersByName(contentId);
  if (it.hasNext()) return it.next();
  throw new Error('案件フォルダが見つかりません: ' + contentId);
}

/** NotebookLMパック(Markdown) を Docs として 03_notebooklm に保存。URL を返す */
function writeNotebookLMDoc_(folder, contentId, markdown) {
  var doc = DocumentApp.create('NLM投入パック_' + contentId);
  var body = doc.getBody();
  body.clear();
  renderMarkdownToBody_(body, markdown);
  doc.saveAndClose();

  var file = DriveApp.getFileById(doc.getId());
  folder.addFile(file);
  try { DriveApp.getRootFolder().removeFile(file); } catch (e) {}

  return doc.getUrl();
}
