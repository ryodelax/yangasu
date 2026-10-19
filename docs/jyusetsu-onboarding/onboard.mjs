// 運営画面の API を通して、会社の作成と自社情報の登録をまとめて行う(画面と同じ経路・同じ検証)。
//
//   node onboard.mjs <BASE_URL> <companies.json>            … 何をするかだけ表示(書き込まない)
//   node onboard.mjs <BASE_URL> <companies.json> --apply    … 実行
//
// 運営アカウントのメール・パスワードは環境変数 OPERATOR_EMAIL / OPERATOR_PASSWORD で渡す。
// 同じ名前の会社が既にあれば作らず、自社情報だけを上書きする(何度流しても同じ結果)。
import fs from "node:fs";

const [base, file, flag] = process.argv.slice(2);
const apply = flag === "--apply";
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const email = process.env.OPERATOR_EMAIL;
const password = process.env.OPERATOR_PASSWORD;
if (!base || !email || !password) {
  console.error("BASE_URL と OPERATOR_EMAIL / OPERATOR_PASSWORD が要ります");
  process.exit(2);
}

let cookie = "";
async function call(path, init = {}) {
  const res = await fetch(new URL(path, base), {
    ...init,
    headers: { "Content-Type": "application/json", cookie, origin: base, ...(init.headers ?? {}) },
    redirect: "manual",
  });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(";")[0]).join("; ");
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 200);
  }
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${JSON.stringify(body)}`);
  return body;
}

await call("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
const { companies: existing } = await call("/api/system/companies");

for (const c of data.companies) {
  const settings = { ...data.common, ...c.settings };
  const found = existing.find((e) => e.name === c.name);
  console.log(`\n■ ${c.name} … ${found ? `既にある(id=${found.id})。自社情報だけ上書き` : "新しく作る"} / 自社情報 ${Object.keys(settings).length}項目`);
  for (const [k, v] of Object.entries(settings)) console.log(`   ${k}: ${v}`);
  if (!apply) continue;
  const id = found ? found.id : (await call("/api/system/companies", { method: "POST", body: JSON.stringify({ name: c.name }) })).id;
  const saved = await call(`/api/system/companies/${id}/settings`, { method: "PUT", body: JSON.stringify({ settings }) });
  const n = Object.keys(saved.settings ?? {}).length;
  const missing = Object.keys(settings).filter((k) => !(k in (saved.settings ?? {})));
  console.log(`   → 保存: ${n}項目${missing.length ? ` / 保存されなかった項目: ${missing.join(",")}` : ""}`);
}
console.log(apply ? "\n完了" : "\n(--apply を付けると実行します)");
