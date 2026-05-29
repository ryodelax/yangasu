<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo( 'charset' ); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<header class="site-header" id="site-header">
  <div class="header-inner">
    <a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="logo">
      <span class="logo-text"><?php bloginfo( 'name' ); ?></span>
    </a>

    <nav class="global-nav" aria-label="グローバルナビゲーション">
      <?php
      wp_nav_menu( [
        'theme_location' => 'primary',
        'container'      => false,
        'fallback_cb'    => function() {
          echo '<ul>
            <li><a href="#service">サービス</a></li>
            <li><a href="#cases">業務改善事例</a></li>
            <li><a href="#flow">導入の流れ</a></li>
            <li><a href="#faq">FAQ</a></li>
            <li><a href="#about">会社情報</a></li>
          </ul>';
        },
      ] );
      ?>
    </nav>

    <a href="#contact" class="btn-contact">無料相談</a>
    <button class="hamburger" id="hamburger" aria-label="メニュー">
      <span></span><span></span><span></span>
    </button>
  </div>
</header>

<div class="mobile-menu" id="mobile-menu">
  <?php
  wp_nav_menu( [
    'theme_location' => 'primary',
    'container'      => false,
    'fallback_cb'    => function() {
      echo '<ul>
        <li><a href="#service">サービス</a></li>
        <li><a href="#cases">業務改善事例</a></li>
        <li><a href="#flow">導入の流れ</a></li>
        <li><a href="#faq">FAQ</a></li>
        <li><a href="#about">会社情報</a></li>
        <li><a href="#contact" class="btn-contact-mobile">無料相談</a></li>
      </ul>';
    },
  ] );
  ?>
</div>
