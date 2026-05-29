# SEO改善 反映用素材一式
対象：
- ① コーポレートHP：https://ec-centric.com/
- ② サービスLP：https://ec-centric.com/smart-kiyaku-assist/

WordPress（Yoast SEO もしくは All in One SEO 推奨）へ貼るだけで反映できる形式でまとめています。
最後に「WordPressのどこに貼るか」のステップバイステップ手順を載せています。

---

## ① HP（ec-centric.com）反映素材

### 1-1. title / meta description（Yoast SEO の SEOタイトル・メタディスクリプション欄）

**SEOタイトル**
```
生成AI導入・業務自動化の伴走支援｜株式会社エキセントリック【中小企業向け】
```

**メタディスクリプション**
```
中小企業向けに、生成AIとシステム開発で業務自動化を伴走支援。不動産管理・製造業を中心に、紙・口頭運用のデジタル化で最大60%の工数削減を実現。神奈川・東京・広島／オンライン全国対応。無料相談受付中。
```

### 1-2. H1の修正

現状H1が2つあるので、メインビジュアル側のみH1に統一。

```html
<h1>中小企業の業務を、生成AIで"楽"にする伴走支援</h1>
```

もう一方（「業務改善の事例を起点に〜」）は `<h2>` または `<p class="lead">` に降格してください。

### 1-3. OGP + canonical（テーマの `header.php` の `</head>` 直前、または Yoast の OGP 設定）

```html
<meta property="og:type" content="website">
<meta property="og:title" content="生成AI導入・業務自動化の伴走支援｜株式会社エキセントリック">
<meta property="og:description" content="中小企業向けに、生成AIとシステム開発で業務自動化を伴走支援。不動産管理・製造業で最大60%の工数削減実績。">
<meta property="og:url" content="https://ec-centric.com/">
<meta property="og:image" content="https://ec-centric.com/wp-content/uploads/ogp.jpg">
<meta property="og:site_name" content="株式会社エキセントリック">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://ec-centric.com/">
```

※ `ogp.jpg` は 1200×630px 推奨。会社ロゴ＋「生成AI導入・業務自動化の伴走支援」のテキストを入れた画像をアップロードしてください。

### 1-4. 構造化データ JSON-LD（`</head>` 直前に貼り付け）

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "株式会社エキセントリック",
  "alternateName": "EC-Centric Inc.",
  "url": "https://ec-centric.com/",
  "logo": "https://ec-centric.com/wp-content/uploads/logo.png",
  "description": "中小企業向けに生成AI導入・業務自動化・システム開発を伴走支援する企業。マンション管理規約改定サービス『Smart規約アシスト264』も提供。",
  "founder": {"@type": "Person", "name": "長谷川 遼"},
  "areaServed": {"@type": "Country", "name": "Japan"},
  "knowsAbout": ["生成AI導入", "業務自動化", "システム開発", "不動産管理DX", "製造業DX", "マンション管理規約改定"]
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "IT知識がなくても大丈夫ですか？",
      "acceptedAnswer": {"@type":"Answer","text":"はい、問題ありません。ヒアリングから設計・実装・定着まで伴走しますので、ITの専門知識は不要です。現場の言葉でお話しいただければ、私たちが技術面を担います。"}
    },
    {
      "@type": "Question",
      "name": "費用はどのくらいかかりますか？",
      "acceptedAnswer": {"@type":"Answer","text":"業務の規模や自動化の範囲によって異なります。まずは無料相談でヒアリングし、最適なプランをご提案します。小規模なスポット対応から、継続的な伴走支援まで柔軟に対応可能です。"}
    },
    {
      "@type": "Question",
      "name": "対応エリアはどこですか？",
      "acceptedAnswer": {"@type":"Answer","text":"神奈川・東京・広島を中心に対応しています。オンラインでの対応も可能ですので、その他のエリアもお気軽にご相談ください。"}
    },
    {
      "@type": "Question",
      "name": "導入後のサポートはありますか？",
      "acceptedAnswer": {"@type":"Answer","text":"あります。『定着』フェーズとして、現場で運用が回るようになるまでサポートします。質問対応・追加レクチャー・マニュアル整備なども柔軟に対応します。"}
    },
    {
      "@type": "Question",
      "name": "どんな業種に対応していますか？",
      "acceptedAnswer": {"@type":"Answer","text":"製造業・不動産業（管理・売買・仲介）を中心に対応しています。その他の業種もご相談いただければ、最適な対応方法をご提案します。"}
    },
    {
      "@type": "Question",
      "name": "株式会社エキセントリックはどんな会社ですか？",
      "acceptedAnswer": {"@type":"Answer","text":"株式会社エキセントリックは、代表取締役・長谷川遼が率いる生成AI導入・業務自動化の専門企業です。中小企業がAIを活用して業務効率を高められるよう、導入から定着まで伴走支援しています。"}
    },
    {
      "@type": "Question",
      "name": "代表の長谷川遼はどんな専門家ですか？",
      "acceptedAnswer": {"@type":"Answer","text":"長谷川遼は株式会社エキセントリック代表取締役として、生成AIの業務活用・業務自動化を専門としています。中小企業向けのAI導入伴走支援から、マンション管理規約改定サービス『Smart規約アシスト』まで幅広く事業を展開しています。"}
    },
    {
      "@type": "Question",
      "name": "システム開発はどのようなサービスですか？",
      "acceptedAnswer": {"@type":"Answer","text":"株式会社エキセントリック（代表：長谷川遼）のシステム開発は、生成AIを組み込んだ業務システム・自動化ツールをスクラッチで開発するサービスです。AIとシステム開発を掛け合わせることで、中小企業の業務課題を根本から解決します。製造業・不動産業など幅広い業種に対応しており、要件定義から運用・保守まで一気通貫で対応します。"}
    }
  ]
}
</script>
```

### 1-5. 内部リンク強化

- 「事例」セクション内の不動産管理事例の末尾に追加：
  ```html
  <p><a href="/smart-kiyaku-assist/">マンション管理規約の改定を最短3日で代行 →</a></p>
  ```
- グローバルナビ or フッターのサービス一覧に「Smart規約アシスト264」を追加

---

## ② Smart規約アシスト264（LP）反映素材

### 2-1. title / meta description

**SEOタイトル**
```
マンション管理規約の改定代行【最短3日・¥53,900〜】Smart規約アシスト264｜2026年区分所有法改正対応
```

**メタディスクリプション**
```
2026年4月施行の区分所有法改正に対応した管理規約の改定を、AI×マンション管理士が最短3日で一式納品。比較表・差分・改正案叩き台を¥53,900〜。264件超の実績。管理会社フロント担当者向け。無料相談受付中。
```

### 2-2. H1の修正

```html
<h1>マンション管理規約の改定代行｜最短3日・¥53,900〜【2026年区分所有法改正対応】</h1>
```

### 2-3. OGP + canonical

```html
<meta property="og:type" content="product">
<meta property="og:title" content="マンション管理規約の改定を最短3日で｜Smart規約アシスト264">
<meta property="og:description" content="2026年区分所有法改正対応。AI×マンション管理士で比較表・差分・改正案叩き台を¥53,900〜。264件超の実績。">
<meta property="og:url" content="https://ec-centric.com/smart-kiyaku-assist/">
<meta property="og:image" content="https://ec-centric.com/wp-content/uploads/smart-kiyaku-ogp.jpg">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://ec-centric.com/smart-kiyaku-assist/">
```

### 2-4. 構造化データ JSON-LD

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Service",
  "serviceType": "マンション管理規約改定代行サービス",
  "name": "Smart規約アシスト264",
  "provider": {
    "@type": "Organization",
    "name": "株式会社エキセントリック",
    "url": "https://ec-centric.com/"
  },
  "areaServed": {"@type": "Country", "name": "Japan"},
  "description": "2026年4月施行の区分所有法改正に対応した管理規約の改定を、AI×マンション管理士が最短3日で一式納品するサービス。比較表・差分リスト・改正案叩き台を提供。",
  "offers": [
    {"@type":"Offer","name":"小規模（30戸未満）","price":"53900","priceCurrency":"JPY","url":"https://ec-centric.com/smart-kiyaku-assist/#pricing"},
    {"@type":"Offer","name":"中小規模（31〜50戸）","price":"64900","priceCurrency":"JPY","url":"https://ec-centric.com/smart-kiyaku-assist/#pricing"},
    {"@type":"Offer","name":"中規模（51〜99戸）","price":"75900","priceCurrency":"JPY","url":"https://ec-centric.com/smart-kiyaku-assist/#pricing"}
  ]
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type":"ListItem","position":1,"name":"ホーム","item":"https://ec-centric.com/"},
    {"@type":"ListItem","position":2,"name":"Smart規約アシスト264","item":"https://ec-centric.com/smart-kiyaku-assist/"}
  ]
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {"@type":"Question","name":"複数物件をまとめて依頼できますか？","acceptedAnswer":{"@type":"Answer","text":"はい、可能です。担当物件を一括でご依頼いただく場合は、物件数に応じた割引もご相談できます。詳細はお問い合わせください。"}},
    {"@type":"Question","name":"現行規約がデータ化されていない場合は？","acceptedAnswer":{"@type":"Answer","text":"紙の規約をスキャンしたPDFでも対応可能です。OCR処理を含むオプション（別途お見積り）もございます。まずはご相談ください。"}},
    {"@type":"Question","name":"3日納品は確実ですか？","acceptedAnswer":{"@type":"Answer","text":"「最短3日」はご依頼内容と混雑状況によります。標準的には3〜5営業日でのご納品となります。総会の日程が決まっている場合は、お申込み時にお知らせください。"}},
    {"@type":"Question","name":"成果物に法的効力はありますか？","acceptedAnswer":{"@type":"Answer","text":"当サービスは「叩き台・比較資料」の提供です。法的な有効性は管理組合の総会での正式な決議によります。必要に応じて弁護士・司法書士への確認を推奨します。"}},
    {"@type":"Question","name":"管理会社として請求書払いはできますか？","acceptedAnswer":{"@type":"Answer","text":"はい、銀行振込（請求書払い）に対応しています。クレジットカード払いも可能です。お申込み後に請求書をお送りします。"}},
    {"@type":"Question","name":"どの地域が対応可能ですか？","acceptedAnswer":{"@type":"Answer","text":"日本全国どこでも対応可能です。ただし訪問希望の際は別途交通費をご請求いたします。"}},
    {"@type":"Question","name":"このサービスはどこの会社が提供していますか？","acceptedAnswer":{"@type":"Answer","text":"株式会社エキセントリック（代表取締役：長谷川遼）が提供しています。生成AI導入・業務自動化の専門企業として、AIとマンション管理士の知見を掛け合わせた管理規約改定サービスを運営しています。"}},
    {"@type":"Question","name":"AIを活用した管理規約改定は品質面で問題ありませんか？","acceptedAnswer":{"@type":"Answer","text":"はい、品質面でも安心してご利用いただけます。Smart規約アシストでは長谷川遼（エキセントリック代表）が監修し、AIによる効率化とマンション管理士による専門確認を組み合わせることで、264件以上の対応実績を積み重ねています。"}}
  ]
}
</script>
```

### 2-5. 【最重要】追加コンテンツ：2026年区分所有法改正の解説セクション

LP下部の「よくあるご質問」直前に挿入してください。SEO検索流入を狙う本命セクションです。

```html
<section id="law-revision-2026">
  <h2>2026年4月施行 区分所有法改正で、マンション管理規約はどう変わる？</h2>

  <p>2026年4月1日、約40年ぶりとなる区分所有法の大改正が施行されます。これに合わせて国土交通省は2025年10月17日、マンション標準管理規約も改正済みです。改正内容は管理組合の運営に直結するため、<strong>多くのマンションで管理規約の見直しが必要</strong>になります。</p>

  <h3>1. 決議要件の緩和（最重要）</h3>
  <p>これまで「区分所有者全員の4分の3以上」の賛成が必要だった特別決議が、<strong>「総会に出席した区分所有者（委任状・議決権行使書を含む）の4分の3以上」</strong>に変更されます。所在不明者がいても決議が進められるようになり、長年塩漬けだった大規模修繕・規約改定が動かしやすくなります。</p>

  <h3>2. 再生手法の多様化（建替え・一括売却・取壊し）</h3>
  <p>従来は「建替え（5分の4）」しか選択肢がなかった老朽マンションの再生に、<strong>一棟リノベーション・建物敷地の一括売却・取り壊し</strong>といった新しい手法が加わります。多数決割合も一定条件下で「4分の3」に緩和されます。</p>

  <h3>3. 所在不明区分所有者の除外制度</h3>
  <p>所在不明の区分所有者を、裁判所の決定により<strong>決議の母数から除外できる制度</strong>が新設されます。連絡が取れない所有者がいて総会が成立しないケースの救済になります。</p>

  <h3>4. 管理計画認定制度の拡充</h3>
  <p>適切に管理されているマンションを自治体が認定する「管理計画認定制度」が拡充され、税制優遇や融資面でのメリットが広がる方向です。</p>

  <h3>規約改定のタイムライン目安</h3>
  <ul>
    <li><strong>2025年10月17日</strong>：標準管理規約 改正版 公表</li>
    <li><strong>～2026年3月</strong>：各管理組合で改正案の準備・理事会承認</li>
    <li><strong>2026年4月1日</strong>：改正区分所有法 施行</li>
    <li><strong>2026年度の定期総会</strong>：規約改定の決議</li>
  </ul>

  <h3>管理会社フロント担当者がいま着手すべきこと</h3>
  <ol>
    <li>担当物件ごとの<strong>現行規約と新標準管理規約の差分把握</strong></li>
    <li>理事会向けの<strong>比較表・改正案たたき台の準備</strong></li>
    <li>総会招集通知への<strong>改正案の同封スケジュール組み立て</strong></li>
  </ol>

  <p>この「差分把握 → 比較表 → 改正案たたき台」までを、<strong>Smart規約アシスト264</strong>なら最短3日・¥53,900〜で一式ご納品します。担当物件が複数あっても一括対応可能です。</p>

  <p><a class="btn-primary" href="#contact">無料相談を申し込む</a></p>
</section>
```

### 2-6. 画像 alt 属性の改善例

WordPress管理画面でメディアを開いて「代替テキスト」欄に入力：

| 画像 | 推奨altテキスト |
|------|---------------|
| メインビジュアル | マンション管理規約の改定を最短3日で代行するSmart規約アシスト264 |
| 成果物サンプル（比較表） | 現行管理規約と改正標準管理規約の比較表サンプル |
| 成果物サンプル（差分リスト） | 区分所有法改正に伴う管理規約の差分リストサンプル |
| 料金プラン表 | Smart規約アシスト264の料金プラン一覧（30戸未満/31-50戸/51-99戸/100戸以上） |
| 利用企業ロゴ | 利用企業：◯◯マンション管理会社 |
| 代表者写真 | 株式会社エキセントリック 代表取締役 長谷川遼 |

---

## ③ 競合・参考リソース（次回コンテンツ強化の参照元）

### 区分所有法改正の主要解説記事
- [標準管理規約改正(令和7年10月)完全解説](https://inazawa.estate/hyouzyun-kanrikiyaku-kaisei-r7/)
- [国土交通省 マンション標準管理規約](https://www.mlit.go.jp/jutakukentiku/house/mansionkiyaku.html)
- [日経xTECH：分譲マンションの管理組合は規約改正を](https://xtech.nikkei.com/atcl/nxt/column/18/03493/020500008/)
- [全日本不動産協会：改正マンション標準管理規約 ポイント解説](https://magazine.zennichi.or.jp/commentary/23357)
- [LIFULL HOME'S：管理規約見直しチェックリスト全19項目](https://www.homes.co.jp/cont/press/buy/buy_01946/)
- [横浜マリン法律事務所：規約はいつ・どのように変更すべきか](https://yokohamamarin.com/%EF%BC%92%EF%BC%90%EF%BC%92%EF%BC%95%E5%B9%B4%E5%8C%BA%E5%88%86%E6%89%80%E6%9C%89%E6%B3%95%E5%A4%A7%E6%94%B9%E6%AD%A3%EF%BC%81%EF%BC%81%E7%AE%A1%E7%90%86%E8%A6%8F%E7%B4%84%E3%81%AF%E3%81%84%E3%81%A4/)
- [Diamond：総会決議要件が変更に！](https://diamond.jp/articles/-/386660)
- [クラセル：2026年区分所有法改正で何が変わる？](https://www.innovelios.com/column/2026_kubun_kaise/)

### 競合状況の所感
SERP上位は「法律事務所」「マンション管理士事務所」「管理組合向けアプリ」「解説メディア」で構成されており、**「改定代行サービス」を明確に打ち出している競合はほぼ皆無**です。「最短3日・¥53,900〜」「264件実績」「AI×マンション管理士」という差別化要素は強力なので、これらを必ず title・h1・description・h2 に含めてください。

---

## ④ WordPress 反映手順（ステップバイステップ）

### A. SEOプラグインの導入確認
1. WP管理画面 → プラグイン → 「Yoast SEO」または「All in One SEO」がインストール済みか確認
2. 未導入なら「Yoast SEO」を新規追加してインストール＋有効化

### B. title / meta description の反映
1. WP管理画面 → 固定ページ → 該当ページ（トップ・smart-kiyaku-assist）を編集
2. ページ編集画面を一番下までスクロール → 「Yoast SEO」または「AIOSEO」のメタボックスを開く
3. **SEOタイトル** 欄に上記1-1または2-1の文言を貼り付け
4. **メタディスクリプション** 欄に上記文言を貼り付け
5. 「更新」ボタンをクリック

### C. OGP の反映
- **Yoast SEO の場合**：SEOメタボックス内「ソーシャル」タブ → Facebook/Twitter のタイトル・説明・画像を入力
- **手動の場合**：外観 → テーマファイルエディター → `header.php` の `</head>` 直前に貼り付け（子テーマでの編集を強く推奨）

### D. 構造化データ JSON-LD の反映
推奨：プラグイン **「WPCode (Insert Headers and Footers)」** を使用
1. プラグイン → 新規追加 → 「WPCode」検索 → インストール＋有効化
2. Code Snippets → Add Snippet → 「Add Your Custom Code (New Snippet)」
3. **Code Type** を `HTML Snippet` に設定
4. 上記の `<script type="application/ld+json">...</script>` を貼り付け
5. **Insertion** を「Page Specific → Insert on Specific Pages」に設定、対象ページを選択
6. Save Snippet → Activate

### E. H1の修正
1. 該当ページをブロックエディタで開く
2. キャッチコピーのブロックを選択 → 「ブロックの種類または書式を変更」→「見出し」を選択 → レベルを **H1** に変更
3. もう一方のH1ブロックは **H2** に変更
4. 更新

### F. 反映確認（Google上での見え方チェック）
1. **Google リッチリザルトテスト**：https://search.google.com/test/rich-results
   → URLを入力して、FAQ・Service等が認識されているか確認
2. **Twitter Card Validator** / **Facebook シェアデバッガー** でOGP確認
3. **Google Search Console**（未登録なら登録）→ URL検査 → 「インデックス登録をリクエスト」

### G. 仕上げ
- XMLサイトマップ：Yoast SEO が自動生成（`/sitemap_index.xml`）→ Search Console に登録
- 画像 alt：メディアライブラリで1枚ずつ「代替テキスト」を埋める
- robots.txt と noindex 設定が誤って入っていないか確認（設定 → 表示設定 → 「検索エンジンがサイトをインデックスしないようにする」がOFFか）

---

## ⑤ 反映後 2〜4週間でやること

1. **Search Console** でクエリレポートを確認し、流入KWを把握
2. 「マンション管理規約 改定」「区分所有法改正 2026」のランキング推移を週次で記録
3. 競合上位記事と比較して、追加で書くべき見出しがないか月1で見直し
4. LPに「導入事例」「お客様の声」を毎月1件ずつ追加（E-E-A-T強化）
