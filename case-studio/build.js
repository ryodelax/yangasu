/* ============================================================
   build.js — モジュール版を1ファイル完結HTMLにまとめる
   使い方:  node case-studio/build.js
   出力:    case-studio.html（リポジトリ直下・どこで開いても動く単体版）
   ============================================================ */

const fs = require("fs");
const path = require("path");

const dir = __dirname;
const read = (p) => fs.readFileSync(path.join(dir, p), "utf8");

let html = read("index.html");
const css = read("css/styles.css");
// 各JSは個別の<script>に展開（元の複数ファイル構成と同じスコープ挙動にする）
const jsFiles = ["js/store.js", "js/art.js", "js/ui.js", "js/app.js"];

// 重要: replace の第2引数は「関数」を使う。
// 文字列を渡すと $$ や $& が特殊置換として解釈され、コードが壊れる。
html = html.replace(
  /<link rel="stylesheet" href="css\/styles.css" \/>/,
  () => `<style>\n${css}\n</style>`
);

const scriptTags = jsFiles
  .map((f) => `  <script>\n${read(f)}\n  </script>`)
  .join("\n");

html = html.replace(
  /\s*<script src="js\/store.js"><\/script>\s*<script src="js\/art.js"><\/script>\s*<script src="js\/ui.js"><\/script>\s*<script src="js\/app.js"><\/script>/,
  () => `\n${scriptTags}`
);

const out = path.join(dir, "..", "case-studio.html");
fs.writeFileSync(out, html);

const remaining = (html.match(/href="css|src="js/g) || []).length;
console.log(`✓ ${path.relative(path.join(dir, ".."), out)} を生成 (${html.length} bytes)`);
console.log(`  残り外部参照: ${remaining}`);
