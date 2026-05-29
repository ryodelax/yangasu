<footer class="site-footer">
  <div class="container">
    <div class="footer-inner">
      <div class="footer-brand">
        <p class="footer-logo"><?php bloginfo( 'name' ); ?></p>
        <p class="footer-desc">中小企業向け 生成AI導入・業務自動化の伴走支援</p>
      </div>
      <div class="footer-actions">
        <nav class="footer-nav" aria-label="フッターナビゲーション">
          <?php
          wp_nav_menu( [
            'theme_location' => 'footer',
            'container'      => false,
            'fallback_cb'    => function() {
              echo '<ul>
                <li><a href="#service">サービス</a></li>
                <li><a href="#cases">業務改善事例</a></li>
                <li><a href="#flow">導入の流れ</a></li>
                <li><a href="#faq">FAQ</a></li>
                <li><a href="#about">会社情報</a></li>
                <li><a href="#contact">お問い合わせ</a></li>
              </ul>';
            },
          ] );
          ?>
        </nav>
        <a href="#contact" class="footer-contact">お問い合わせ</a>
      </div>
    </div>
    <div class="footer-bottom">
      <p>&copy; <?php echo date( 'Y' ); ?> 株式会社エキセントリック. All rights reserved.</p>
    </div>
  </div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
