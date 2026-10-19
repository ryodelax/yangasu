-- 3社(オリーブ・UIエステート・小俣靴下)の会社と自社情報を登録する。
-- 本番の Supabase SQL Editor で、全体を貼って1回で実行する。途中の確認に引っかかったら例外で止まり、何も変わらない。
-- 前提: マイグレーション 0021〜0023 とデプロイ、#218 の会社の分け直しが済んでいること(運営用の会社がある)。
-- 監査ログは残さない(画面からの登録ではないため)。作ったあとは運営画面 /system で見て直せる。
begin;
do $$
begin
  if not exists (select 1 from organizations where is_operator) then
    raise exception '運営用の会社がありません。先に #218 の分け直しを流してください';
  end if;
  if exists (select 1 from organizations where name in ('株式会社オリーブ', '合同会社UIエステート', '小俣靴下株式会社')) then
    raise exception '同じ名前の会社が既にあります(もう流した?)。運営画面で確かめてください';
  end if;
end $$;

-- 株式会社オリーブ(20項目)
with o as (insert into organizations (name) values ('株式会社オリーブ') returning id)
insert into app_settings (org_id, field_id, value)
select o.id, v.field_id, v.value from o, (values
  ('kyotakusho_kubun', '宅地建物取引業保証協会の社員'),
  ('hoshou_kyokai_name', '公益社団法人 不動産保証協会'),
  ('hoshou_kyokai_address', '東京都千代田区紀尾井町3番30号 全日会館'),
  ('hoshou_kyokai_honbu_name', '公益社団法人 不動産保証協会 神奈川県本部'),
  ('hoshou_kyokai_honbu_address', '神奈川県横浜市西区北幸1丁目11番15号 横浜STビル6階'),
  ('bensai_kyotakusho_name', '東京法務局'),
  ('bensai_kyotakusho_address', '東京都千代田区九段南1丁目1番15号 九段第2合同庁舎'),
  ('gyousha_name', '株式会社オリーブ'),
  ('gyousha_daihyou', '白鳥 力'),
  ('gyousha_menkyo_kenja', '神奈川県知事'),
  ('gyousha_menkyo_koushin', '2'),
  ('gyousha_menkyo_no', '30942'),
  ('gyousha_address', '神奈川県横浜市南区井土ケ谷中町161'),
  ('gyousha_address_2', 'KSビル501'),
  ('gyousha_tel', '045-308-7338'),
  ('torihikishi_jimusho_name', '株式会社オリーブ'),
  ('torihikishi_jimusho_address', '神奈川県横浜市南区井土ケ谷中町161'),
  ('torihikishi_jimusho_address_2', 'KSビル501'),
  ('torihikishi_jimusho_tel', '045-308-7338'),
  ('torihikishi_name', '白鳥 力')
) as v(field_id, value);

-- 合同会社UIエステート(18項目)
with o as (insert into organizations (name) values ('合同会社UIエステート') returning id)
insert into app_settings (org_id, field_id, value)
select o.id, v.field_id, v.value from o, (values
  ('kyotakusho_kubun', '宅地建物取引業保証協会の社員'),
  ('hoshou_kyokai_name', '公益社団法人 不動産保証協会'),
  ('hoshou_kyokai_address', '東京都千代田区紀尾井町3番30号 全日会館'),
  ('hoshou_kyokai_honbu_name', '公益社団法人 不動産保証協会 神奈川県本部'),
  ('hoshou_kyokai_honbu_address', '神奈川県横浜市西区北幸1丁目11番15号 横浜STビル6階'),
  ('bensai_kyotakusho_name', '東京法務局'),
  ('bensai_kyotakusho_address', '東京都千代田区九段南1丁目1番15号 九段第2合同庁舎'),
  ('gyousha_name', '合同会社UIエステート'),
  ('gyousha_daihyou', '荒井 隼也'),
  ('gyousha_menkyo_kenja', '神奈川県知事'),
  ('gyousha_menkyo_koushin', '1'),
  ('gyousha_menkyo_no', '32383'),
  ('gyousha_address', '神奈川県横浜市港南区野庭町1716-3'),
  ('gyousha_tel', '045-367-8145'),
  ('torihikishi_jimusho_name', '合同会社UIエステート'),
  ('torihikishi_jimusho_address', '神奈川県横浜市港南区野庭町1716-3'),
  ('torihikishi_jimusho_tel', '045-367-8145'),
  ('torihikishi_name', '荒井 隼也')
) as v(field_id, value);

-- 小俣靴下株式会社(18項目)
with o as (insert into organizations (name) values ('小俣靴下株式会社') returning id)
insert into app_settings (org_id, field_id, value)
select o.id, v.field_id, v.value from o, (values
  ('kyotakusho_kubun', '宅地建物取引業保証協会の社員'),
  ('hoshou_kyokai_name', '公益社団法人 不動産保証協会'),
  ('hoshou_kyokai_address', '東京都千代田区紀尾井町3番30号 全日会館'),
  ('hoshou_kyokai_honbu_name', '公益社団法人 不動産保証協会 神奈川県本部'),
  ('hoshou_kyokai_honbu_address', '神奈川県横浜市西区北幸1丁目11番15号 横浜STビル6階'),
  ('bensai_kyotakusho_name', '東京法務局'),
  ('bensai_kyotakusho_address', '東京都千代田区九段南1丁目1番15号 九段第2合同庁舎'),
  ('gyousha_name', '小俣靴下株式会社'),
  ('gyousha_daihyou', '小俣 富樹'),
  ('gyousha_menkyo_kenja', '神奈川県知事'),
  ('gyousha_menkyo_koushin', '2'),
  ('gyousha_menkyo_no', '30147'),
  ('gyousha_address', '神奈川県横浜市磯子区丸山2丁目14-3'),
  ('gyousha_tel', '045-751-4845'),
  ('torihikishi_jimusho_name', '小俣靴下株式会社'),
  ('torihikishi_jimusho_address', '神奈川県横浜市磯子区丸山2丁目14-3'),
  ('torihikishi_jimusho_tel', '045-751-4845'),
  ('torihikishi_name', '小俣 富樹')
) as v(field_id, value);

-- 結果の目視用
select o.id, o.name, o.is_operator, o.disabled_at, count(a.field_id) as 自社情報
  from organizations o left join app_settings a on a.org_id = o.id
 where o.name in ('株式会社オリーブ', '合同会社UIエステート', '小俣靴下株式会社')
 group by o.id order by o.id;
commit;
