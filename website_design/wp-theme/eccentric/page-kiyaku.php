<?php
/**
 * Template Name: Smart規約アシスト264 LP
 */

add_filter( 'pre_get_document_title', fn() =>
    'マンション管理規約改定を最短3日で納品｜Smart規約アシスト264【AI×マンション管理士】'
);

add_action( 'wp_enqueue_scripts', function() {
    $ver = '1.0.0';
    $uri = get_template_directory_uri();
    wp_enqueue_style( 'eccentric-fonts',
        'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&family=Inter:wght@300;400;500;600&display=swap',
        [], null
    );
    wp_enqueue_style( 'kiyaku-lp', $uri . '/assets/css/kiyaku.css', ['eccentric-fonts'], $ver );
}, 20 );

add_action( 'wp_head', function() {
    $url = 'https://ec-centric.com/smart-kiyaku-assist/';
    ?>
<meta name="description" content="2026年区分所有法改正に対応したマンション管理規約改定サービス。AI×マンション管理士の知見で3点比較表・改正案条文を最短3日で納品。管理組合・管理会社向け。30戸未満53,900円（税込）〜。">
<meta name="keywords" content="マンション管理規約改定,区分所有法改正,管理規約改正サービス,管理規約比較表,マンション管理士,管理規約改定費用">
<meta property="og:title" content="マンション管理規約改定を最短3日で納品｜Smart規約アシスト264">
<meta property="og:description" content="2026年区分所有法改正に対応。AI×マンション管理士で3点比較表・改正案条文を最短3日で納品。30戸未満53,900円〜。">
<meta property="og:type" content="website">
<meta property="og:url" content="<?php echo esc_url( $url ); ?>">
<meta property="og:locale" content="ja_JP">
<meta property="og:site_name" content="株式会社エキセントリック">
<link rel="canonical" href="<?php echo esc_url( $url ); ?>">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service",
      "name": "Smart規約アシスト264 — マンション管理規約改定サービス",
      "provider": {"@type": "Organization", "name": "株式会社エキセントリック", "@id": "https://ec-centric.com/#organization"},
      "url": "<?php echo esc_url( $url ); ?>",
      "description": "2026年4月施行の区分所有法改正に対応したマンション管理規約改定サービス。AI×マンション管理士の知見で3点比較表・改正案条文を最短3日で納品。",
      "areaServed": "日本",
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "管理規約改定サービス料金表",
        "itemListElement": [
          {"@type": "Offer", "name": "30戸未満", "price": "53900", "priceCurrency": "JPY"},
          {"@type": "Offer", "name": "31〜50戸",  "price": "64900", "priceCurrency": "JPY"},
          {"@type": "Offer", "name": "51〜99戸",  "price": "75900", "priceCurrency": "JPY"},
          {"@type": "Offer", "name": "100戸以上", "description": "応相談", "priceCurrency": "JPY"}
        ]
      }
    },
    {
      "@type": "WebPage",
      "@id": "<?php echo esc_url( $url ); ?>#webpage",
      "url": "<?php echo esc_url( $url ); ?>",
      "name": "マンション管理規約改定を最短3日で納品｜Smart規約アシスト264",
      "description": "2026年区分所有法改正に対応したマンション管理規約改定サービス。AI×マンション管理士で最短3日納品。",
      "isPartOf": {"@id": "https://ec-centric.com/#website"},
      "inLanguage": "ja",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {"@type": "ListItem", "position": 1, "name": "ホーム", "item": "https://ec-centric.com/"},
          {"@type": "ListItem", "position": 2, "name": "Smart規約アシスト264", "item": "<?php echo esc_url( $url ); ?>"}
        ]
      }
    }
  ]
}
</script>
    <?php
}, 5 );
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<?php wp_head(); ?>
</head>
<body class="kiyaku-lp-body">
<?php wp_body_open(); ?>

<!-- ===== HEADER ===== -->
<header class="kl-header">
  <div class="kl-container">
    <a href="https://ec-centric.com/" class="kl-logo">ec-centric</a>
    <nav class="kl-header-nav">
      <a href="#kl-service" class="kl-header-link">サービス内容</a>
      <a href="#kl-pricing" class="kl-header-link">料金</a>
      <a href="#kl-contact" class="kl-btn-header">無料相談する</a>
    </nav>
  </div>
</header>

<!-- ===== HERO ===== -->
<section class="kl-hero">
  <div class="kl-hero-bg"></div>
  <div class="kl-container kl-hero-inner">
    <span class="kl-tag">2026年 区分所有法改正 完全対応</span>
    <h1 class="kl-hero-title">マンション管理規約の改定、<br>最短<em>3日</em>で一式納品します。</h1>
    <p class="kl-hero-sub">業界初※ AI×マンション管理士の知見で、<br>比較表・差分・叩き台を圧倒的なコスパ・精度で一式提供</p>
    <p class="kl-hero-note">※当社調べ：AI生成→専門家監修→ファイル納品まで1式のパッケージ化</p>
    <div class="kl-hero-ctas">
      <a href="#kl-contact" class="kl-btn-primary">無料相談する →</a>
      <a href="#kl-pricing" class="kl-btn-ghost">料金を見る</a>
    </div>
  </div>
</section>

<!-- ===== INTRO ===== -->
<section class="kl-intro">
  <div class="kl-container">
    <p class="kl-intro-text">
      すでにご存知のように、マンションの区分所有法が<strong>2026年4月1日に大幅な改正</strong>となりました。<br>
      当社はこの改正に特化し、<strong>「比較・差分・叩き台」を一覧表にてご提供するサービス</strong>を全国に先駆けて開始しました。
    </p>
    <p class="kl-intro-text">
      通常1ヶ月以上かかる工程を大幅に短縮。総会スケジュールに合わせた納期でお届けします。
    </p>
    <a href="#kl-contact" class="kl-btn-outline">今すぐ相談する →</a>
  </div>
</section>

<!-- ===== PROBLEMS ===== -->
<section class="kl-problems" id="kl-problems">
  <div class="kl-container">
    <p class="kl-section-label">PROBLEMS</p>
    <h2 class="kl-section-title">「まだ対応していない」から<br>「間に合わない」に変わる前に。</h2>
    <p class="kl-section-sub">こんなお悩み、ありませんか？</p>
    <div class="kl-problems-grid">
      <div class="kl-problem-card">
        <span class="kl-problem-icon">⏰</span>
        <h3>総会まで時間がない</h3>
        <p>改正法の施行が迫る中、何から手をつければいいか分からない。総会資料の準備が間に合わない不安を抱えている。</p>
      </div>
      <div class="kl-problem-card">
        <span class="kl-problem-icon">📋</span>
        <h3>何を準備すればいいか不明</h3>
        <p>総会で説明できる資料が必要だが、比較表や解説文の作り方が分からない。条文の書き方も手探り状態。</p>
      </div>
      <div class="kl-problem-card">
        <span class="kl-problem-icon">😓</span>
        <h3>圧倒的に労力が足りない</h3>
        <p>現行規約と標準規約を読み比べる作業だけで何ヶ月もかかりそう。理事のメンバーは本業が忙しく、専門知識もない。</p>
      </div>
      <div class="kl-problem-card">
        <span class="kl-problem-icon">🙋</span>
        <h3>相談先がない</h3>
        <p>管理会社がいないため、法改正への対応を相談できる専門家がいない。自分たちだけで正しく対応できるか心配。</p>
      </div>
    </div>
  </div>
</section>

<!-- ===== WARNING ===== -->
<section class="kl-warning-section">
  <div class="kl-container">
    <div class="kl-warning-box">
      <span class="kl-warning-icon">⚠️</span>
      <div>
        <p class="kl-warning-title">2026年4月1日以降の総会では<strong>改正後のルールが前提</strong>になります。</p>
        <p class="kl-warning-text">改正法の施行日は2026年4月1日。それ以降に招集手続きを開始する総会では、決議要件をはじめとした改正後のルールが適用されます。直前の対応は混乱や総会延期につながるため、<strong>早めの準備</strong>が安心です。</p>
      </div>
    </div>
  </div>
</section>

<!-- ===== DELIVERABLES ===== -->
<section class="kl-deliverables" id="kl-service">
  <div class="kl-container">
    <p class="kl-section-label">DELIVERABLES</p>
    <h2 class="kl-section-title">総会に間に合う書類を、一式ご用意します。</h2>
    <div class="kl-deliverables-grid">
      <div class="kl-deliver-card">
        <div class="kl-deliver-num">01</div>
        <h3>3点比較表<br><small>（現行 / 標準 / 改正案）</small></h3>
        <p>現在の規約・国の標準管理規約・今回の改正案を並べて比較。どこが変わるのか一目で分かります。</p>
      </div>
      <div class="kl-deliver-card">
        <div class="kl-deliver-num">02</div>
        <h3>改正案条文<br><small>（叩き台）</small></h3>
        <p>総会議案として提出できるWord形式の改正案条文。変更がなければそのまま使えるたたき台です。</p>
      </div>
    </div>
    <div class="kl-deliver-notes">
      <p>※本業務は使用細則は含みません。</p>
      <p>※現在は単棟型・団地型のみの対応となっております。店舗併用型・複合用途等は開発中のため随時リリース予定です。</p>
      <p>※規約改正の最終判断および責任は、管理組合（総会）に帰属します。</p>
      <p>※本サービスの成果物は、理事会・総会での検討・判断のための基礎資料であり、承認・可決・成立を保証するものではありません。</p>
    </div>
  </div>
</section>

<!-- ===== REASONS ===== -->
<section class="kl-reasons" id="kl-reasons">
  <div class="kl-container">
    <p class="kl-section-label">WHY CHOOSE US</p>
    <h2 class="kl-section-title">選ばれる4つの理由</h2>
    <div class="kl-reasons-grid">
      <div class="kl-reason-card">
        <div class="kl-reason-num">①</div>
        <h3>圧倒的な短納期</h3>
        <p>手作業では1〜6ヶ月かかる工程（読み込み・整理・資料化・条文化）を、AI活用と固定プロセスで大幅に圧縮。<strong>最短3日で納品</strong>し、総会スケジュールに間に合う納期で対応します。</p>
      </div>
      <div class="kl-reason-card">
        <div class="kl-reason-num">②</div>
        <h3>Wordファイル納品</h3>
        <p>総会資料として配布・保管・ご自身での微調整ができる体制で納品。そのまま理事会・総会で使えます。</p>
      </div>
      <div class="kl-reason-card">
        <div class="kl-reason-num">③</div>
        <h3>専門家監修を標準装備</h3>
        <p>短納期でも品質は妥協しません。納品前に必ず<strong>マンション管理士の監修</strong>を挟み、体裁・表記を整えたうえでお届けします。</p>
      </div>
      <div class="kl-reason-card">
        <div class="kl-reason-num">④</div>
        <h3>業界内初の"二段構え"</h3>
        <p>AIで下書きを最短化し、専門家監修で品質を担保。総会に持ち込める形で納品まで<strong>一気通貫</strong>で対応します。</p>
      </div>
    </div>
  </div>
</section>

<!-- ===== TRACK RECORD ===== -->
<section class="kl-track-record">
  <div class="kl-container">
    <p class="kl-section-label">TRACK RECORD</p>
    <h2 class="kl-section-title">納入実績</h2>
    <p class="kl-track-lead">本サービスは業界内初の提供形態のため先行リリース価格でご案内しておりましたが、リリースからわずか1ヶ月弱で多くのご要望をいただきました。お取引先規模・形態まで幅広く対応可能です。</p>
    <ul class="kl-track-list">
      <li>大手独立系マンション管理会社</li>
      <li>マンション管理士・フロント代行企業</li>
      <li>マンション管理組合 及び NPOマンション管理組合ネットワーク</li>
      <li>その他多数</li>
    </ul>
  </div>
</section>

<!-- ===== PRICING ===== -->
<section class="kl-pricing" id="kl-pricing">
  <div class="kl-container">
    <p class="kl-section-label">PRICING</p>
    <h2 class="kl-section-title">価格表（税込）</h2>
    <div class="kl-pricing-table-wrap">
      <table class="kl-pricing-table">
        <thead>
          <tr>
            <th>戸数</th>
            <th>標準価格</th>
            <th>製本サンプル付</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>30戸未満</td>
            <td class="kl-price">53,900円</td>
            <td class="kl-price">59,400円</td>
          </tr>
          <tr>
            <td>31〜50戸</td>
            <td class="kl-price">64,900円</td>
            <td class="kl-price">70,400円</td>
          </tr>
          <tr>
            <td>51〜99戸</td>
            <td class="kl-price">75,900円</td>
            <td class="kl-price">81,400円</td>
          </tr>
          <tr>
            <td>100戸以上</td>
            <td class="kl-price-consult" colspan="2">応相談</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="kl-options">
      <h3>オプション</h3>
      <div class="kl-option-grid">
        <div class="kl-option-card">
          <p class="kl-option-label">オプション a</p>
          <h4>総会承認までのコンサルティング業務</h4>
          <ul>
            <li>マンション管理士による理事会および総会での説明支援</li>
            <li>理事会または総会への出席（1回 ＠30,000円）</li>
          </ul>
        </div>
        <div class="kl-option-card">
          <p class="kl-option-label">オプション b</p>
          <h4>コンサルティング資料作成業務</h4>
          <ul>
            <li>レジュメおよび議案書・議事録作成（1式 ＠30,000円）</li>
          </ul>
        </div>
      </div>
      <p class="kl-option-note">「作る」までか「通す」までか。状況に合わせて選べます。</p>
    </div>
  </div>
</section>

<!-- ===== CONTACT ===== -->
<section class="kl-contact" id="kl-contact">
  <div class="kl-container">
    <p class="kl-section-label">CONTACT</p>
    <h2 class="kl-section-title">まずは無料相談から</h2>
    <p class="kl-contact-lead">現行の管理規約が分かればOK。<br>お気軽にお問い合わせください。その他のご相談も歓迎します。</p>
    <?php
    $cf7_id = eccentric_get_cf7_id();
    if ( $cf7_id ) {
        echo do_shortcode( '[contact-form-7 id="' . $cf7_id . '" title="お問い合わせ"]' );
    } else { ?>
    <div class="kl-contact-btn-wrap">
      <a href="https://ec-centric.com/#contact" class="kl-btn-primary kl-btn-large">お問い合わせフォームへ →</a>
    </div>
    <?php } ?>
  </div>
</section>

<!-- ===== FOOTER ===== -->
<footer class="kl-footer">
  <div class="kl-container">
    <div class="kl-footer-inner">
      <a href="https://ec-centric.com/" class="kl-footer-logo">ec-centric</a>
      <p class="kl-footer-desc">株式会社エキセントリック｜生成AI導入・業務自動化の伴走支援</p>
    </div>
    <p class="kl-footer-copy">&copy; <?php echo esc_html( date( 'Y' ) ); ?> 株式会社エキセントリック. All rights reserved.</p>
  </div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
