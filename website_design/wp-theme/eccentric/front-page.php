<?php get_header(); ?>

<main>

  <!-- ========== HERO (SLIDESHOW) ========== -->
  <section class="hero" id="top">
    <div class="hero-slides">
      <div class="hero-slide active" style="background-image: url('https://ec-centric.com/wp-content/uploads/2026/05/hero-sphere-1-scaled.jpg')">
        <div class="hero-overlay"></div>
      </div>
      <div class="hero-slide" style="background-image: url('https://ec-centric.com/wp-content/uploads/2026/05/hero-slide2.jpg')">
        <div class="hero-overlay"></div>
      </div>
      <div class="hero-slide" style="background-image: url('<?php echo get_template_directory_uri(); ?>/assets/images/hero-slide3.jpg')">
        <div class="hero-overlay"></div>
      </div>
      <div class="hero-slide" style="background-image: url('https://ec-centric.com/wp-content/uploads/2026/05/hero-slide4.jpg')">
        <div class="hero-overlay"></div>
      </div>
    </div>
    <div class="hero-content">
      <p class="hero-eyebrow">生成AI × 業務自動化</p>
      <h1 class="hero-headline">
        その業務、<br>
        もっと<em>"楽"</em>に<br>
        しませんか？
      </h1>
      <p class="hero-sub">
        中小企業向け 生成AI導入・業務自動化の伴走支援<br>
        神奈川・東京・広島を中心に対応
      </p>
      <a href="#contact" class="btn-primary">無料相談はこちら</a>
    </div>
    <div class="slide-indicators" id="slide-indicators">
      <button class="slide-dot active" data-index="0" aria-label="スライド1"></button>
      <button class="slide-dot" data-index="1" aria-label="スライド2"></button>
      <button class="slide-dot" data-index="2" aria-label="スライド3"></button>
      <button class="slide-dot" data-index="3" aria-label="スライド4"></button>
    </div>
    <div class="scroll-indicator">
      <span>Scroll</span>
      <div class="scroll-line"></div>
    </div>
  </section>

  <!-- ========== TAGLINE ========== -->
  <section class="tagline-section">
    <div class="container">
      <p class="tagline">
        製造業・不動産業界（管理・売買・仲介）を中心に、<br>
        紙・口頭・属人化をAI×仕組み化で減らします。
      </p>
      <p class="tagline-sub">
        業務改善の"事例"を起点に、最短距離で現場が回る状態へ。<br>
        無理・ムラのない仕組みと品質。生成AIサービスの力で未来をつくる創造を。
      </p>
    </div>
  </section>

  <!-- ========== STATS ========== -->
  <section class="stats-section">
    <div class="container">
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-number">60<span class="stat-unit">%</span></div>
          <div class="stat-label">最大工数削減率</div>
        </div>
        <div class="stat-item">
          <div class="stat-number">30<span class="stat-unit">分</span></div>
          <div class="stat-label">初回ヒアリング（無料）</div>
        </div>
        <div class="stat-item">
          <div class="stat-number">3<span class="stat-unit">業界</span></div>
          <div class="stat-label">製造・不動産管理・不動産仲介</div>
        </div>
        <div class="stat-item">
          <div class="stat-number">2<span class="stat-unit">営業日</span></div>
          <div class="stat-label">お問い合わせ返答目安</div>
        </div>
      </div>
    </div>
  </section>

  <!-- ========== SERVICE ========== -->
  <section class="service-section" id="service">
    <div class="service-visual">
      <img src="<?php echo get_template_directory_uri(); ?>/assets/images/service-bg.jpg" alt="サービスイメージ" class="service-bg-img">
      <div class="service-visual-overlay"></div>
      <div class="service-visual-text">
        <p class="section-label-white">Service</p>
        <h2 class="service-visual-title">テクノロジーで、<br>現場を変える</h2>
      </div>
    </div>
    <div class="container">
      <div class="service-grid">
        <div class="service-card fade-up">
          <div class="service-card-num">01</div>
          <div class="service-icon">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect x="4" y="8" width="32" height="24" rx="2" stroke="currentColor" stroke-width="1.5"/>
              <path d="M12 16h16M12 22h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <h3>業務フロー設計</h3>
          <p>現場の"困りごと"を整理し、入力項目・閲覧権限・運用フローを設計。情報漏洩リスクも考慮した権限設計まで対応します。</p>
          <span class="service-card-arrow">→</span>
        </div>
        <div class="service-card fade-up">
          <div class="service-card-num">02</div>
          <div class="service-icon">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="14" stroke="currentColor" stroke-width="1.5"/>
              <path d="M20 12v8l5 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <h3>生成AI実装・初期導入</h3>
          <p>"使える状態"まで一気通貫で構築。設計書をもとにシステムを実装し、初期データ投入・権限設定・動作確認まで完了させます。</p>
          <span class="service-card-arrow">→</span>
        </div>
        <div class="service-card fade-up">
          <div class="service-card-num">03</div>
          <div class="service-icon">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path d="M8 32l8-8 6 6 10-14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h3>定着サポート</h3>
          <p>"分からない"を残さず習慣化まで伴走。導入直後の「使い方が分からない」を防ぐため、運用が定着するまでサポートします。</p>
          <span class="service-card-arrow">→</span>
        </div>
      </div>
    </div>
  </section>

  <!-- ========== CASES ========== -->
  <section class="cases-section" id="cases">
    <div class="container">
      <div class="section-label">Cases</div>
      <h2 class="section-title">業務改善事例</h2>
    </div>
    <div class="cases-list">
      <div class="case-item fade-up">
        <div class="case-image">
          <div class="case-illustration case-illustration-realestate" aria-hidden="true">
            <div class="case-illustration-badge">Property Management</div>
            <svg class="case-illustration-icon" viewBox="0 0 320 320" fill="none">
              <rect x="68" y="82" width="92" height="154" rx="14" stroke="currentColor" stroke-width="10"/>
              <rect x="102" y="112" width="24" height="24" rx="4" fill="currentColor"/>
              <rect x="102" y="148" width="24" height="24" rx="4" fill="currentColor"/>
              <rect x="102" y="184" width="24" height="24" rx="4" fill="currentColor"/>
              <path d="M188 118h58c21 0 38 17 38 38v18c0 21-17 38-38 38h-12l-30 24v-24h-16c-21 0-38-17-38-38v-18c0-21 17-38 38-38Z" stroke="currentColor" stroke-width="10" stroke-linejoin="round"/>
              <path d="M201 156h33M201 176h51" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>
            </svg>
          </div>
        </div>
        <div class="case-body">
          <div class="case-number">01</div>
          <span class="case-industry">不動産管理業</span>
          <div class="case-service-note">
            <p class="case-service-title">マンションの管理規約を省力化・高品質改定</p>
            <p class="case-service-desc">2026年4月施行の区分所有法改正に対応した「Smart規約アシスト264」。AI×マンション管理士の知見で、現行規約・標準管理規約・改正案の3点比較表と総会用たたき台を最短3日で納品します。</p>
            <a href="https://kannrikiyakukaitei.my.canva.site/lp" target="_blank" rel="noopener noreferrer" class="case-service-link">Smart規約アシスト264 — 詳細・お問い合わせ →</a>
          </div>
        </div>
      </div>
      <div class="case-item fade-up">
        <div class="case-image">
          <div class="case-illustration case-illustration-manufacturing" aria-hidden="true">
            <div class="case-illustration-badge">Manufacturing</div>
            <svg class="case-illustration-icon" viewBox="0 0 320 320" fill="none">
              <rect x="68" y="86" width="184" height="148" rx="18" stroke="currentColor" stroke-width="10"/>
              <path d="M108 126h104M108 158h64M108 190h84" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>
              <circle cx="232" cy="122" r="22" stroke="currentColor" stroke-width="10"/>
              <path d="M232 88v-20M232 176v-20M266 122h20M198 122h-20M255 99l14-14M209 145l-14 14M255 145l14 14M209 99l-14-14" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>
            </svg>
          </div>
        </div>
        <div class="case-body">
          <div class="case-number">02</div>
          <span class="case-industry">製造業</span>
          <h3>紙の点検票をデジタル化・データ活用へ</h3>
          <p>月次の手書き点検票をOCR+AIで自動入力。集計・分析まで一括自動化を実現。月<strong>40時間分</strong>の転記作業をゼロにしました。</p>
        </div>
      </div>
      <div class="case-item fade-up">
        <div class="case-image">
          <div class="case-illustration case-illustration-brokerage" aria-hidden="true">
            <div class="case-illustration-badge">Brokerage</div>
            <svg class="case-illustration-icon" viewBox="0 0 320 320" fill="none">
              <path d="M68 146 160 82l92 64v94H68v-94Z" stroke="currentColor" stroke-width="10" stroke-linejoin="round"/>
              <path d="M128 238v-56h64v56" stroke="currentColor" stroke-width="10" stroke-linejoin="round"/>
              <rect x="186" y="104" width="70" height="92" rx="14" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-width="10"/>
              <path d="M204 132h34M204 156h34M204 180h22" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>
            </svg>
          </div>
        </div>
        <div class="case-body">
          <div class="case-number">03</div>
          <span class="case-industry">不動産仲介</span>
          <h3>物件資料作成を半自動化</h3>
          <p>担当者ごとにバラバラだった物件資料をテンプレート化。作成時間を1件あたり<strong>70%短縮</strong>。品質の均一化も同時に実現しました。</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ========== FLOW ========== -->
  <section class="flow-section" id="flow">
    <div class="container">
      <div class="section-label">Flow</div>
      <h2 class="section-title">導入までの流れ</h2>
      <div class="flow-list">
        <div class="flow-item fade-up">
          <div class="flow-index">01</div>
          <div class="flow-content">
            <h3>ヒアリング <span class="flow-time">（30分・無料）</span></h3>
            <p class="flow-desc">いまの業務の"困りごと"を整理します</p>
            <p>「何が無駄で、どこが属人化しているか」を一緒に言語化。ITツールの話ではなく、現場の実態から逆算して設計します。口頭報告・Excel転記・紙運用の実態も遠慮なくお聞かせください。</p>
          </div>
          <div class="flow-badge">Step 1</div>
        </div>
        <div class="flow-item fade-up">
          <div class="flow-index">02</div>
          <div class="flow-content">
            <h3>設計 <span class="flow-time">（項目・権限・運用）</span></h3>
            <p class="flow-desc">"現場で回る形"まで落とし込みます</p>
            <p>ヒアリング内容をもとに、入力項目・閲覧権限・運用フローを設計。不動産特有の「誰が何を見られるか」「どこまで自動化するか」を明確にします。情報漏洩リスクも考慮し、権限設計は細かく調整可能です。</p>
          </div>
          <div class="flow-badge">Step 2</div>
        </div>
        <div class="flow-item fade-up">
          <div class="flow-index">03</div>
          <div class="flow-content">
            <h3>実装・初期導入</h3>
            <p class="flow-desc">"使える状態"まで一気通貫で構築</p>
            <p>設計書をもとにシステムを実装し、初期データ投入・権限設定・動作確認まで完了させます。「作って終わり」ではなく、最初の1件を一緒に登録して、現場で触れる状態にします。</p>
          </div>
          <div class="flow-badge">Step 3</div>
        </div>
        <div class="flow-item fade-up">
          <div class="flow-index">04</div>
          <div class="flow-content">
            <h3>定着 <span class="flow-time">（現場で回るまで）</span></h3>
            <p class="flow-desc">"分からない"を残さず、習慣化まで伴走</p>
            <p>導入直後の「使い方が分からない」「前のやり方に戻ってしまう」を防ぐため、運用が定着するまでサポートします。質問対応・追加レクチャー・マニュアル整備なども、現場の声を聞きながら柔軟に対応します。</p>
          </div>
          <div class="flow-badge">Step 4</div>
        </div>
      </div>
    </div>
  </section>

  <!-- ========== FAQ ========== -->
  <section class="faq-section" id="faq">
    <div class="container">
      <div class="faq-inner">
        <div class="faq-header">
          <div class="section-label">FAQ</div>
          <h2 class="section-title">よくある質問</h2>
          <p class="faq-intro">導入をご検討の方からよくいただくご質問をまとめました。</p>
        </div>
        <div class="faq-list">
          <div class="faq-item fade-up">
            <button class="faq-q" aria-expanded="false">
              <span>IT知識がなくても大丈夫ですか？</span>
              <svg class="faq-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 8l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div class="faq-a"><p>はい、問題ありません。ヒアリングから設計・実装・定着まで伴走しますので、ITの専門知識は不要です。現場の言葉でお話しいただければ、私たちが技術面を担います。</p></div>
          </div>
          <div class="faq-item fade-up">
            <button class="faq-q" aria-expanded="false">
              <span>費用はどのくらいかかりますか？</span>
              <svg class="faq-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 8l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div class="faq-a"><p>業務の規模や自動化の範囲によって異なります。まずは無料相談でヒアリングし、最適なプランをご提案します。小規模なスポット対応から、継続的な伴走支援まで柔軟に対応可能です。</p></div>
          </div>
          <div class="faq-item fade-up">
            <button class="faq-q" aria-expanded="false">
              <span>対応エリアはどこですか？</span>
              <svg class="faq-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 8l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div class="faq-a"><p>神奈川・東京・広島を中心に対応しています。オンラインでの対応も可能ですので、その他のエリアもお気軽にご相談ください。</p></div>
          </div>
          <div class="faq-item fade-up">
            <button class="faq-q" aria-expanded="false">
              <span>導入後のサポートはありますか？</span>
              <svg class="faq-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 8l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div class="faq-a"><p>あります。「定着」フェーズとして、現場で運用が回るようになるまでサポートします。質問対応・追加レクチャー・マニュアル整備なども柔軟に対応します。</p></div>
          </div>
          <div class="faq-item fade-up">
            <button class="faq-q" aria-expanded="false">
              <span>どんな業種に対応していますか？</span>
              <svg class="faq-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 8l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div class="faq-a"><p>製造業・不動産業（管理・売買・仲介）を中心に対応しています。その他の業種もご相談いただければ、最適な対応方法をご提案します。</p></div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ========== ABOUT ========== -->
  <section class="about-section" id="about" style="background-image: url('<?php echo get_template_directory_uri(); ?>/assets/images/about-field.jpg')">
    <div class="about-bg-overlay"></div>
    <div class="container">
      <div class="about-inner">
        <div class="about-text">
          <div class="section-label">About</div>
          <h2 class="section-title">私たちについて</h2>
          <p>代表・長谷川は、大手商社での製造業向け営業として工場の現場を歩き続けた経験から起業しました。広島エリアの中小企業の経営者たちが、昼間は現場で汗を流しながら夜遅くまで電話・FAX・手書き書類の事務作業に追われる姿を目の当たりにし、「今あるものを活かして、もっと楽にできるはずだ」という想いが原点です。</p>
          <p>生成AIという新たな手段との出会いをきっかけに、現場を知る元営業が、テクノロジーと現場の橋渡し役として独立。技術を押し付けるのではなく、現場の声を起点に、最短距離で成果が出る設計を心がけています。</p>
          <p>株式会社エキセントリックは、中小企業の業務現場に寄り添い、生成AIと仕組み化で"働きやすい職場"をつくる会社です。</p>
          <div class="about-tags">
            <span class="about-tag">生成AI導入</span>
            <span class="about-tag">業務自動化</span>
            <span class="about-tag">伴走支援</span>
            <span class="about-tag">中小企業特化</span>
          </div>
        </div>
        <div class="about-visual">
          <img src="https://ec-centric.com/wp-content/uploads/2026/05/president.jpg" alt="代表 長谷川" class="about-img">
          <div class="about-visual-card">
            <p class="about-card-num">100<span>%</span></p>
            <p class="about-card-text">現場定着まで<br>伴走サポート</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ========== NEWS ========== -->
  <section class="news-section" id="news">
    <div class="container">
      <div class="section-label">News</div>
      <h2 class="section-title">ニュース</h2>
      <div class="news-grid">

        <article class="news-card">
          <div class="news-meta">
            <time class="news-date">2026.08</time>
            <span class="news-tag">メディア掲載</span>
          </div>
          <h3 class="news-title">Webマガジン「B-plus」の経営者インタビューに掲載されました</h3>
          <p class="news-desc">代表 長谷川の取り組みが、経営者向けWebマガジン「B-plus」のインタビュー記事として掲載されました。AI活用による業務効率化の実践についてお話しています。</p>
          <div class="news-actions">
            <a href="https://www.business-plus.net/interview/2601/k9933.html" target="_blank" rel="noopener noreferrer" class="news-link">記事を読む →</a>
          </div>
        </article>

        <article class="news-card news-card-service">
          <div class="news-meta">
            <time class="news-date">2026.03.01</time>
            <span class="news-tag news-tag-service">サービス開始</span>
          </div>
          <h3 class="news-title">マンション管理規約改定サービス「Smart規約アシスト264」を開始しました</h3>
          <p class="news-desc">2026年4月施行の区分所有法改正に対応。AI×マンション管理士の知見で、比較表・差分・叩き台を最短3日で納品します。</p>
          <div class="news-actions">
            <a href="#kiyaku" class="btn-primary news-btn">詳しくはこちら・お問い合わせ</a>
          </div>
        </article>

      </div>
    </div>
  </section>

  <!-- ========== ACCESS ========== -->
  <section class="access-section">
    <div class="container">
      <div class="section-label">Access</div>
      <h2 class="section-title">アクセス</h2>
    </div>
    <div class="map-wrapper">
      <iframe
        src="https://maps.google.com/maps?q=35.446185,139.632942&output=embed&z=16"
        width="100%"
        height="420"
        style="border:0;"
        allowfullscreen=""
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
        title="株式会社エキセントリック アクセスマップ">
      </iframe>
    </div>
  </section>

  <!-- ========== BPLUS BANNER ========== -->
  <section class="bplus-section">
    <div class="container">
      <a href="https://www.business-plus.net/interview/2601/k9933.html" target="_blank" rel="noopener noreferrer" class="bplus-banner-link">
        <img src="https://ec-centric.com/wp-content/uploads/2026/05/bplus-banner.jpg" alt="Webマガジン B-plus 経営者インタビュー掲載" class="bplus-banner-img">
        <span class="bplus-banner-caption">Webマガジン「B-plus」経営者インタビューに掲載されました — 記事を読む →</span>
      </a>
    </div>
  </section>

  <!-- ========== CTA ========== -->
  <section class="cta-section">
    <div class="cta-bg-img" style="background-image: url('<?php echo get_template_directory_uri(); ?>/assets/images/cta-beach.jpeg')"></div>
    <div class="cta-overlay"></div>
    <div class="container cta-inner">
      <p class="cta-label">まずは気軽にご相談ください</p>
      <h2 class="cta-title">業務の"困りごと"を<br>一緒に整理しましょう</h2>
      <p class="cta-sub">初回ヒアリングは30分・完全無料。<br>現場の言葉でそのままお話しください。</p>
      <a href="#contact" class="btn-primary btn-large btn-white">無料相談を予約する</a>
    </div>
  </section>

  <!-- ========== CONTACT ========== -->
  <section class="contact-section" id="contact">
    <div class="container">
      <div class="contact-inner">
        <div class="contact-left">
          <div class="section-label">Contact</div>
          <h2 class="section-title">お問い合わせ</h2>
          <p class="contact-lead">お気軽にご連絡ください。<br>通常2営業日以内にご返答します。</p>
          <div class="contact-info">
            <div class="contact-info-item">
              <span class="contact-info-label">対応時間</span>
              <span>平日 9:00〜18:00</span>
            </div>
            <div class="contact-info-item">
              <span class="contact-info-label">対応エリア</span>
              <span>神奈川・東京・広島（オンライン全国対応）</span>
            </div>
          </div>
        </div>
        <div class="contact-right">
          <?php
          // Contact Form 7 が有効な場合はショートコードを使用
          $cf7_id = eccentric_get_cf7_id();
          if ( $cf7_id ) :
            echo do_shortcode( '[contact-form-7 id="' . $cf7_id . '" title="お問い合わせ"]' );
          else :
          ?>
          <form class="contact-form" action="#" method="post">
            <div class="form-group">
              <label for="company">会社名</label>
              <input type="text" id="company" name="company" placeholder="株式会社〇〇">
            </div>
            <div class="form-group">
              <label for="name">お名前 <span class="required">*</span></label>
              <input type="text" id="name" name="name" required placeholder="山田 太郎">
            </div>
            <div class="form-group">
              <label for="email">メールアドレス <span class="required">*</span></label>
              <input type="email" id="email" name="email" required placeholder="example@company.co.jp">
            </div>
            <div class="form-group">
              <label for="message">お問い合わせ内容 <span class="required">*</span></label>
              <textarea id="message" name="message" rows="5" required placeholder="現在の業務課題や、ご相談内容をご記入ください。"></textarea>
            </div>
            <button type="submit" class="btn-primary btn-submit">送信する</button>
          </form>
          <?php endif; ?>
        </div>
      </div>
    </div>
  </section>

</main>

<?php get_footer(); ?>
