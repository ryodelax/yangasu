# companies.json から、本番の Supabase SQL Editor に貼る SQL を作る。
#   python3 make-sql.py > onboard-3-companies.sql
import json, sys
d = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "companies.json", encoding="utf-8"))
q = lambda s: "'" + str(s).replace("'", "''") + "'"
names = [c["name"] for c in d["companies"]]
out = []
w = out.append
w("-- 3社(オリーブ・UIエステート・小俣靴下)の会社と自社情報を登録する。")
w("-- 本番の Supabase SQL Editor で、全体を貼って1回で実行する。途中の確認に引っかかったら例外で止まり、何も変わらない。")
w("-- 前提: マイグレーション 0021〜0023 とデプロイ、#218 の会社の分け直しが済んでいること(運営用の会社がある)。")
w("-- 監査ログは残さない(画面からの登録ではないため)。作ったあとは運営画面 /system で見て直せる。")
w("begin;")
w("do $$")
w("begin")
w("  if not exists (select 1 from organizations where is_operator) then")
w("    raise exception '運営用の会社がありません。先に #218 の分け直しを流してください';")
w("  end if;")
w("  if exists (select 1 from organizations where name in (" + ", ".join(q(n) for n in names) + ")) then")
w("    raise exception '同じ名前の会社が既にあります(もう流した?)。運営画面で確かめてください';")
w("  end if;")
w("end $$;")
for c in d["companies"]:
    s = {**d["common"], **c["settings"]}
    s = {k: v for k, v in s.items() if str(v).strip() != ""}
    w("")
    w(f"-- {c['name']}({len(s)}項目)")
    w("with o as (insert into organizations (name) values (" + q(c["name"]) + ") returning id)")
    w("insert into app_settings (org_id, field_id, value)")
    w("select o.id, v.field_id, v.value from o, (values")
    w(",\n".join(f"  ({q(k)}, {q(v)})" for k, v in s.items()))
    w(") as v(field_id, value);")
w("")
w("-- 結果の目視用")
w("select o.id, o.name, o.is_operator, o.disabled_at, count(a.field_id) as 自社情報")
w("  from organizations o left join app_settings a on a.org_id = o.id")
w(" where o.name in (" + ", ".join(q(n) for n in names) + ")")
w(" group by o.id order by o.id;")
w("commit;")
print("\n".join(out))
