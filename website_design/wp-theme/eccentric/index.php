<?php
// フロントページが設定されている場合は front-page.php を使用。
// そうでない場合のフォールバック。
get_header();
if ( have_posts() ) :
    while ( have_posts() ) : the_post();
        the_content();
    endwhile;
endif;
get_footer();
