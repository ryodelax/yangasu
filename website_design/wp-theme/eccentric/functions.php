<?php
if ( ! defined( 'ABSPATH' ) ) exit;

// ===== テーマセットアップ =====
function eccentric_setup() {
    add_theme_support( 'title-tag' );
    add_theme_support( 'post-thumbnails' );
    add_theme_support( 'html5', [ 'search-form', 'comment-form', 'comment-list', 'gallery', 'caption' ] );

    // メインナビゲーション登録
    register_nav_menus( [
        'primary' => 'グローバルナビゲーション',
        'footer'  => 'フッターナビゲーション',
    ] );
}
add_action( 'after_setup_theme', 'eccentric_setup' );

// ===== CSS / JS 読み込み =====
function eccentric_enqueue_assets() {
    $ver = '1.0.3';
    $uri = get_template_directory_uri();

    // Google Fonts
    wp_enqueue_style(
        'eccentric-fonts',
        'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&family=Inter:wght@300;400;500;600&display=swap',
        [],
        null
    );

    // メインCSS
    wp_enqueue_style( 'eccentric-main', $uri . '/assets/css/main.css', [ 'eccentric-fonts' ], $ver );

    // メインJS
    wp_enqueue_script( 'eccentric-main', $uri . '/assets/js/main.js', [], $ver, true );
}
add_action( 'wp_enqueue_scripts', 'eccentric_enqueue_assets' );

// ===== フロントエンドの管理バーを非表示 =====
add_filter( 'show_admin_bar', '__return_false' );

// ===== Contact Form 7 が有効なときのみフォームIDを取数 =====
function eccentric_get_cf7_id() {
    if ( ! function_exists( 'wpcf7_get_contact_form_by_title' ) ) return 0;
    $form = wpcf7_get_contact_form_by_title( 'お問い合わせ' );
    return $form ? $form->id() : 0;
}

// ===== JSON-LD 構造化データ =====
function eccentric_json_ld() {
    $site_url = 'https://ec-centric.com';
    $data = [
        '@context' => 'https://schema.org',
        '@graph'   => [
            [
                '@type'       => 'Organization',
                '@id'         => $site_url . '/#organization',
                'name'        => '株式会社エキセントリック',
                'url'         => $site_url . '/',
                'logo'        => [
                    '@type' => 'ImageObject',
                    'url'   => $site_url . '/wp-content/uploads/2026/05/cropped-ChatGPT-Image-2026年1月21日-08_35_13-32x32.png',
                ],
                'description' => '製造業・不動産業界の中小企業向けに生成AI導入・業務自動化の伴走支援を提供。業務工数を最大60%削減。神奈川・東京・広島を中心に全国対応。',
                'address'     => [
                    '@type'           => 'PostalAddress',
                    'addressCountry'  => 'JP',
                    'addressRegion'   => '神奈川県',
                ],
                'areaServed'  => [ '神奈川県', '東京都', '広島県', '日本全国（オンライン対応）' ],
                'knowsAbout'  => [ '生成AI導入', '業務自動化', 'AIチャットボット', '不動産管理', '管理規約改定', 'DX支援' ],
                'contactPoint' => [
                    '@type'       => 'ContactPoint',
                    'contactType' => 'customer service',
                    'availableLanguage' => 'Japanese',
                    'areaServed'  => 'JP',
                ],
            ],
            [
                '@type'     => 'WebSite',
                '@id'       => $site_url . '/#website',
                'url'       => $site_url . '/',
                'name'      => '株式会社エキセントリック',
                'publisher' => [ '@id' => $site_url . '/#organization' ],
                'inLanguage' => 'ja',
            ],
            [
                '@type'       => 'WebPage',
                '@id'         => $site_url . '/#webpage',
                'url'         => $site_url . '/',
                'name'        => '株式会社エキセントリック｜生成AI導入・業務自動化の伴走支援【中小企業向け】',
                'description' => '株式会社エキセントリックは、製造業・不動産業界の中小企業向けに生成AI導入・業務自動化の伴走支援を提供。業務工数を最大60%削減。神奈川・東京・広島を中心に全国対応。初回ヒアリング30分・完全無料。',
                'isPartOf'    => [ '@id' => $site_url . '/#website' ],
                'about'       => [ '@id' => $site_url . '/#organization' ],
                'inLanguage'  => 'ja',
                'breadcrumb'  => [
                    '@type'           => 'BreadcrumbList',
                    'itemListElement' => [
                        [
                            '@type'    => 'ListItem',
                            'position' => 1,
                            'name'     => 'ホーム',
                            'item'     => $site_url . '/',
                        ],
                    ],
                ],
            ],
            [
                '@type' => 'ItemList',
                'name'  => 'サイトナビゲーション',
                'itemListElement' => [
                    [ '@type' => 'ListItem', 'position' => 1, 'name' => 'サービス内容',      'url' => $site_url . '/#service' ],
                    [ '@type' => 'ListItem', 'position' => 2, 'name' => '業務改善事例',      'url' => $site_url . '/#cases' ],
                    [ '@type' => 'ListItem', 'position' => 3, 'name' => '導入の流れ',        'url' => $site_url . '/#flow' ],
                    [ '@type' => 'ListItem', 'position' => 4, 'name' => 'FAQ',               'url' => $site_url . '/#faq' ],
                    [ '@type' => 'ListItem', 'position' => 5, 'name' => '会社情報',          'url' => $site_url . '/#about' ],
                    [ '@type' => 'ListItem', 'position' => 6, 'name' => 'ニュース',          'url' => $site_url . '/#news' ],
                    [ '@type' => 'ListItem', 'position' => 7, 'name' => 'アクセス',          'url' => $site_url . '/#access' ],
                    [ '@type' => 'ListItem', 'position' => 8, 'name' => '管理規約改定サービス', 'url' => 'https://kannrikiyakukaitei.my.canva.site/lp' ],
                    [ '@type' => 'ListItem', 'position' => 9, 'name' => 'お問い合わせ',      'url' => $site_url . '/#contact' ],
                ],
            ],
            [
                '@type' => 'Service',
                'name'  => '生成AI導入・業務自動化支援',
                'provider' => [ '@id' => $site_url . '/#organization' ],
                'areaServed' => '日本',
                'description' => '中小企業向けに生成AIを活用した業務自動化・効率化を伴走支援。製造業・不動産業界を中心に対応。初回ヒアリング30分無料。',
                'offers' => [
                    '@type' => 'Offer',
                    'price' => '0',
                    'priceCurrency' => 'JPY',
                    'description' => '初回ヒアリング30分・完全無料',
                ],
            ],
            [
                '@type'       => 'Service',
                'name'        => 'Smart規約アシスト264 — マンション管理規約改定サービス',
                'provider'    => [ '@id' => $site_url . '/#organization' ],
                'url'         => 'https://kannrikiyakukaitei.my.canva.site/lp',
                'description' => '2026年4月施行の区分所有法改正に対応。AI×マンション管理士の知見で比較表・差分・総会用たたき台を最短3日で納品。',
                'areaServed'  => '日本',
            ],
        ],
    ];
    echo '<script type="application/ld+json">' . wp_json_encode( $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT ) . '</script>' . "\n";
}
add_action( 'wp_head', 'eccentric_json_ld' );
