// グッド保険サービス様向け AIチャットbot導入提案資料
// 15 slides — 16:9 — pptxgenjs
// 引き継ぎ資料セクション6 成果物1の仕様通り
const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "株式会社エキセントリック";
pres.title = "AI問い合わせ対応導入のご提案";

// ===== Design tokens — matches ec-centric.com brand =====
const C = {
  NAVY:       "2563EB",   // --kl-blue (primary)
  NAVY_DARK:  "0F172A",   // slate-900 (cover / closing dark)
  NAVY_MID:   "3B82F6",   // blue-500 (secondary)
  INK:        "1E293B",   // --kl-text
  MUTED:      "64748B",   // --kl-text-mid
  LINE:       "E2E8F0",   // --kl-border
  LIGHT:      "DBEAFE",   // blue-100 (light wash)
  BG:         "F8FAFC",   // slate-50
  ACCENT:     "0EA5E9",   // --kl-sky (accent)
  ACCENT_LT:  "E0F2FE",   // sky-100
  WHITE:      "FFFFFF",
  GREEN:      "10B981",
  RED:        "DC2626",
};

const FONT_JP = "游ゴシック";
const FONT_JP_B = "游ゴシック";

const W = 10, H = 5.625;
const TOTAL = 15;

// ===== Helpers =====
function pageChrome(slide, _label, pageNum, totalPages) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: W, h: 0.07,
    fill: { color: C.NAVY }, line: { color: C.NAVY, width: 0 },
  });
  slide.addText("株式会社エキセントリック", {
    x: 0.4, y: H - 0.3, w: 4, h: 0.25,
    fontSize: 9, fontFace: FONT_JP, color: C.MUTED,
    align: "left", valign: "middle", margin: 0,
  });
  slide.addText(`${pageNum} / ${totalPages}`, {
    x: W - 1.0, y: H - 0.3, w: 0.6, h: 0.25,
    fontSize: 9, fontFace: FONT_JP, color: C.MUTED,
    align: "right", valign: "middle", margin: 0,
  });
}

function slideTitle(slide, jp, en) {
  slide.addText(jp, {
    x: 0.5, y: 0.4, w: 9.0, h: 0.55,
    fontSize: 26, fontFace: FONT_JP_B, bold: true, color: C.NAVY,
    align: "left", valign: "middle", margin: 0,
  });
  if (en) {
    slide.addText(en, {
      x: 0.5, y: 0.95, w: 9.0, h: 0.28,
      fontSize: 10, fontFace: FONT_JP, color: C.MUTED,
      align: "left", valign: "middle", margin: 0, charSpacing: 2,
    });
  }
}

// ============================================================
// Slide 1 — 表紙
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.NAVY_DARK };
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.18, h: H,
    fill: { color: C.ACCENT }, line: { color: C.ACCENT, width: 0 },
  });
  s.addText("FOR GOOD INSURANCE SERVICE CO., LTD.", {
    x: 0.7, y: 1.2, w: 8.5, h: 0.3,
    fontSize: 10, fontFace: FONT_JP, color: C.ACCENT,
    bold: true, charSpacing: 4, margin: 0,
  });
  s.addText("AI問い合わせ対応の導入", {
    x: 0.7, y: 1.7, w: 8.5, h: 0.9,
    fontSize: 40, fontFace: FONT_JP_B, bold: true, color: C.WHITE,
    align: "left", valign: "middle", margin: 0,
  });
  s.addText("業務効率化を、売上機会の回収につなげる。", {
    x: 0.7, y: 2.65, w: 8.5, h: 0.55,
    fontSize: 18, fontFace: FONT_JP, color: "BFCBE0",
    align: "left", valign: "middle", margin: 0,
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.7, y: 3.5, w: 1.0, h: 0.03,
    fill: { color: C.ACCENT }, line: { color: C.ACCENT, width: 0 },
  });
  s.addText([
    { text: "株式会社グッド保険サービス\n", options: { fontSize: 14, bold: true, color: C.WHITE, breakLine: true } },
    { text: "伊藤専務 御中", options: { fontSize: 11, color: "BFCBE0" } },
  ], {
    x: 0.7, y: 3.7, w: 5.5, h: 0.9,
    fontFace: FONT_JP, valign: "top", margin: 0,
  });
  s.addText([
    { text: "2026年5月\n", options: { fontSize: 10, color: "BFCBE0", breakLine: true } },
    { text: "株式会社エキセントリック\n", options: { fontSize: 12, bold: true, color: C.WHITE, breakLine: true } },
    { text: "代表取締役  長谷川", options: { fontSize: 11, color: "BFCBE0" } },
  ], {
    x: 6.3, y: 4.5, w: 3.2, h: 0.95,
    fontFace: FONT_JP, align: "right", valign: "bottom", margin: 0,
  });
}

// ============================================================
// Slide 2 — 本日の議論論点
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.WHITE };
  pageChrome(s, "", 2, TOTAL);
  slideTitle(s, "本日の論点", "AGENDA");

  const items = [
    ["01", "貴社の現状理解",         "電話・問い合わせ対応の現状と、専務よりお伺いした課題感"],
    ["02", "課題の本質",             "「業務負荷」ではなく「売上機会の損失」として捉え直す"],
    ["03", "解決方針と安全設計",     "AIが吸収する範囲・人が対応すべき範囲の切り分け"],
    ["04", "導入ステップと検収基準", "1週間分析 → 本開発 → テスト運用 → 継続運用"],
    ["05", "価格・契約条件",         "段階的なご投資判断ができるよう設計"],
    ["06", "ロードマップと次のアクション", "今回の範囲とその先の絵を分けてご提示"],
  ];
  const startY = 1.55;
  const rowH = 0.55;
  items.forEach((it, i) => {
    const y = startY + i * rowH;
    s.addText(it[0], {
      x: 0.7, y, w: 0.55, h: rowH - 0.08,
      fontSize: 18, fontFace: FONT_JP_B, bold: true, color: C.ACCENT,
      align: "left", valign: "middle", margin: 0,
    });
    s.addText(it[1], {
      x: 1.35, y, w: 3.6, h: rowH - 0.08,
      fontSize: 13, fontFace: FONT_JP_B, bold: true, color: C.INK,
      align: "left", valign: "middle", margin: 0,
    });
    s.addText(it[2], {
      x: 5.0, y, w: 4.6, h: rowH - 0.08,
      fontSize: 10.5, fontFace: FONT_JP, color: C.MUTED,
      align: "left", valign: "middle", margin: 0,
    });
    if (i < items.length - 1) {
      s.addShape(pres.shapes.RECTANGLE, {
        x: 0.7, y: y + rowH - 0.06, w: 8.9, h: 0.012,
        fill: { color: C.LINE }, line: { color: C.LINE, width: 0 },
      });
    }
  });
  s.addText("想定時間 約90分", {
    x: 0.7, y: 4.95, w: 4, h: 0.3,
    fontSize: 10, fontFace: FONT_JP, color: C.MUTED, italic: true, margin: 0,
  });
}

// ============================================================
// Slide 3 — 貴社の現状理解
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.WHITE };
  pageChrome(s, "", 3, TOTAL);
  slideTitle(s, "貴社の現状理解", "CURRENT SITUATION");

  s.addText("前回のご商談で伺った内容を、当社の理解として整理しました。", {
    x: 0.5, y: 1.35, w: 9, h: 0.35,
    fontSize: 12, fontFace: FONT_JP, color: C.INK, margin: 0,
  });

  const stats = [
    { num: "1日 50〜100件", lbl: "電話問い合わせ件数", sub: "(全社合計)" },
    { num: "約 半数",        lbl: "うち質問・確認系の対応",  sub: "(社員が即答できないものを含む)" },
    { num: "約 5分 / 件",    lbl: "1件あたりの対応時間",   sub: "(取次・確認・折り返し含む)" },
  ];
  stats.forEach((st, i) => {
    const x = 0.5 + i * 3.1;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.85, w: 2.9, h: 1.6,
      fill: { color: C.BG }, line: { color: C.LINE, width: 0.75 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.85, w: 0.08, h: 1.6,
      fill: { color: C.ACCENT }, line: { color: C.ACCENT, width: 0 },
    });
    s.addText(st.num, {
      x: x + 0.2, y: 1.95, w: 2.65, h: 0.7,
      fontSize: 22, fontFace: FONT_JP_B, bold: true, color: C.NAVY,
      align: "left", valign: "middle", margin: 0,
    });
    s.addText(st.lbl, {
      x: x + 0.2, y: 2.7, w: 2.65, h: 0.3,
      fontSize: 11, fontFace: FONT_JP_B, bold: true, color: C.INK,
      align: "left", valign: "middle", margin: 0,
    });
    s.addText(st.sub, {
      x: x + 0.2, y: 3.0, w: 2.65, h: 0.3,
      fontSize: 9.5, fontFace: FONT_JP, color: C.MUTED,
      align: "left", valign: "middle", margin: 0,
    });
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 3.75, w: 9.0, h: 1.2,
    fill: { color: C.LIGHT }, line: { color: C.LIGHT, width: 0 },
  });
  s.addText("加えて、伺った業務全体の特徴", {
    x: 0.75, y: 3.85, w: 4, h: 0.3,
    fontSize: 11, fontFace: FONT_JP_B, bold: true, color: C.NAVY, margin: 0,
  });
  s.addText([
    { text: "・ 売上の半分以上を管理組合部門が占めるが、市場は飽和傾向", options: { breakLine: true } },
    { text: "・ イベント部門は月600〜700件の問い合わせ、見積もり作成1件あたり5〜30分", options: { breakLine: true } },
    { text: "・ ドローン部門は成長余地が大きく、専務が売上の柱として期待されている領域", options: {} },
  ], {
    x: 0.75, y: 4.15, w: 8.7, h: 0.75,
    fontSize: 11, fontFace: FONT_JP, color: C.INK, margin: 0, paraSpaceAfter: 2,
  });

  s.addText("※ 数値は前回ご商談でのヒアリングベース。1週間分析で正確な実測値を取得します。", {
    x: 0.5, y: 4.98, w: 9, h: 0.25,
    fontSize: 9, fontFace: FONT_JP, italic: true, color: C.MUTED, margin: 0,
  });
}

// ============================================================
// Slide 4 — 課題の本質
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.WHITE };
  pageChrome(s, "", 4, TOTAL);
  slideTitle(s, "課題の本質は「業務負荷」ではない", "REFRAMING THE PROBLEM");

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 1.5, w: 4.3, h: 3.4,
    fill: { color: C.BG }, line: { color: C.LINE, width: 0.75 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 1.5, w: 0.1, h: 3.4,
    fill: { color: C.LINE }, line: { color: C.LINE, width: 0 },
  });
  s.addText("一般的な捉え方", {
    x: 0.7, y: 1.65, w: 3, h: 0.3,
    fontSize: 10, fontFace: FONT_JP, color: C.MUTED, charSpacing: 2, margin: 0,
  });
  s.addText("業務効率化", {
    x: 0.7, y: 1.95, w: 4, h: 0.55,
    fontSize: 24, fontFace: FONT_JP_B, bold: true, color: C.MUTED, margin: 0,
  });
  s.addText("社員の時間を減らすことが目的", {
    x: 0.7, y: 2.55, w: 4, h: 0.35,
    fontSize: 12, fontFace: FONT_JP, color: C.INK, margin: 0,
  });
  s.addText([
    { text: "・ 電話対応の負荷", options: { breakLine: true } },
    { text: "・ 取次・確認の手間", options: { breakLine: true } },
    { text: "・ 残業時間の削減", options: {} },
  ], {
    x: 0.7, y: 3.0, w: 4, h: 1.5,
    fontSize: 11, fontFace: FONT_JP, color: C.MUTED, margin: 0, paraSpaceAfter: 4,
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.2, y: 1.5, w: 4.3, h: 3.4,
    fill: { color: C.NAVY }, line: { color: C.NAVY, width: 0 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.2, y: 1.5, w: 0.1, h: 3.4,
    fill: { color: C.ACCENT }, line: { color: C.ACCENT, width: 0 },
  });
  s.addText("当社のご提案", {
    x: 5.45, y: 1.65, w: 3, h: 0.3,
    fontSize: 10, fontFace: FONT_JP, color: C.ACCENT, charSpacing: 2, margin: 0,
  });
  s.addText("売上機会の回収", {
    x: 5.45, y: 1.95, w: 4, h: 0.55,
    fontSize: 24, fontFace: FONT_JP_B, bold: true, color: C.WHITE, margin: 0,
  });
  s.addText("生まれた時間を本来の営業活動に戻す", {
    x: 5.45, y: 2.55, w: 4, h: 0.35,
    fontSize: 12, fontFace: FONT_JP, color: "BFCBE0", margin: 0,
  });
  s.addText([
    { text: "・ 既存顧客への深耕・更新提案", options: { breakLine: true } },
    { text: "・ 外勤・対面での関係構築", options: { breakLine: true } },
    { text: "・ 取りこぼしていた商談機会の回収", options: {} },
  ], {
    x: 5.45, y: 3.0, w: 4, h: 1.5,
    fontSize: 11, fontFace: FONT_JP, color: C.WHITE, margin: 0, paraSpaceAfter: 4,
  });

  s.addText("社員の手間を減らすことは手段であって、目的ではないと考えています。", {
    x: 0.5, y: 4.95, w: 9, h: 0.3,
    fontSize: 11, fontFace: FONT_JP, italic: true, color: C.NAVY, align: "center", margin: 0,
  });
}

// ============================================================
// Slide 5 — 機会損失のロジック図
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.WHITE };
  pageChrome(s, "", 5, TOTAL);
  slideTitle(s, "なぜ売上機会が失われているのか", "THE LOSS MECHANISM");

  const colW = 4.3;
  const blockH = 0.5;
  const blockGap = 0.10;

  s.addText("現状", {
    x: 0.5, y: 1.5, w: colW, h: 0.35,
    fontSize: 11, fontFace: FONT_JP_B, bold: true, color: C.MUTED,
    align: "center", margin: 0,
  });
  s.addText("AI導入後", {
    x: 5.2, y: 1.5, w: colW, h: 0.35,
    fontSize: 11, fontFace: FONT_JP_B, bold: true, color: C.ACCENT,
    align: "center", margin: 0,
  });

  const beforeFlow = [
    "現場の質問対応に時間を取られる",
    "取次・確認・折り返しで一日が終わる",
    "提案業務に回す時間と気力が残らない",
    "更新・追加提案・深耕のタイミング損失",
    "見えない売上機会が失われていく",
  ];
  const afterFlow = [
    "質問の一次対応をAIが吸収",
    "社員は判断が必要な案件に集中",
    "外勤・対面の時間が確保できる",
    "深耕・更新提案の質と量が上がる",
    "売上の上振れにつながる",
  ];

  beforeFlow.forEach((tx, i) => {
    const y = 1.85 + i * (blockH + blockGap);
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y, w: colW, h: blockH,
      fill: { color: C.BG }, line: { color: C.LINE, width: 0.5 },
    });
    s.addText(tx, {
      x: 0.65, y, w: colW - 0.3, h: blockH,
      fontSize: 11, fontFace: FONT_JP, color: C.INK,
      align: "left", valign: "middle", margin: 0,
    });
    if (i < beforeFlow.length - 1) {
      s.addText("▼", {
        x: 0.5 + colW / 2 - 0.2, y: y + blockH - 0.02, w: 0.4, h: blockGap + 0.04,
        fontSize: 10, bold: true, color: C.MUTED, align: "center", valign: "middle", margin: 0,
      });
    }
  });
  afterFlow.forEach((tx, i) => {
    const y = 1.85 + i * (blockH + blockGap);
    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.2, y, w: colW, h: blockH,
      fill: { color: C.LIGHT }, line: { color: C.LIGHT, width: 0 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.2, y, w: 0.08, h: blockH,
      fill: { color: C.ACCENT }, line: { color: C.ACCENT, width: 0 },
    });
    s.addText(tx, {
      x: 5.35, y, w: colW - 0.25, h: blockH,
      fontSize: 11, fontFace: FONT_JP, color: C.INK,
      align: "left", valign: "middle", margin: 0,
    });
    if (i < afterFlow.length - 1) {
      s.addText("▼", {
        x: 5.2 + colW / 2 - 0.2, y: y + blockH - 0.02, w: 0.4, h: blockGap + 0.04,
        fontSize: 10, bold: true, color: C.ACCENT, align: "center", valign: "middle", margin: 0,
      });
    }
  });
}

// ============================================================
// Slide 6 — 解決方針
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.WHITE };
  pageChrome(s, "", 6, TOTAL);
  slideTitle(s, "解決方針", "OUR APPROACH");

  s.addText("「全てをAIに置き換える」のではなく、AIと人の役割を分けて設計します。", {
    x: 0.5, y: 1.35, w: 9, h: 0.35,
    fontSize: 12, fontFace: FONT_JP, color: C.INK, margin: 0,
  });

  const colY = 1.85;
  const colH = 3.0;

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: colY, w: 4.3, h: colH,
    fill: { color: C.LIGHT }, line: { color: C.LIGHT, width: 0 },
  });
  s.addText("AIが吸収する領域", {
    x: 0.7, y: colY + 0.15, w: 4, h: 0.45,
    fontSize: 16, fontFace: FONT_JP_B, bold: true, color: C.NAVY, margin: 0,
  });
  s.addText("一次対応の自動化", {
    x: 0.7, y: colY + 0.6, w: 4, h: 0.3,
    fontSize: 11, fontFace: FONT_JP, color: C.NAVY_MID, margin: 0,
  });
  s.addText([
    { text: "・ 商品概要・手続きの流れの案内", options: { breakLine: true } },
    { text: "・ 必要書類のご案内", options: { breakLine: true } },
    { text: "・ よくあるご質問への回答", options: { breakLine: true } },
    { text: "・ 担当者への引き継ぎ導線", options: { breakLine: true } },
    { text: "・ 社内ナレッジ検索の補助", options: {} },
  ], {
    x: 0.75, y: colY + 1.05, w: 4.0, h: 2.0,
    fontSize: 11.5, fontFace: FONT_JP, color: C.INK, margin: 0, paraSpaceAfter: 3,
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.2, y: colY, w: 4.3, h: colH,
    fill: { color: C.BG }, line: { color: C.LINE, width: 0.5 },
  });
  s.addText("人が担う領域", {
    x: 5.4, y: colY + 0.15, w: 4, h: 0.45,
    fontSize: 16, fontFace: FONT_JP_B, bold: true, color: C.ACCENT, margin: 0,
  });
  s.addText("判断・関係構築・提案", {
    x: 5.4, y: colY + 0.6, w: 4, h: 0.3,
    fontSize: 11, fontFace: FONT_JP, color: C.MUTED, margin: 0,
  });
  s.addText([
    { text: "・ 個別契約内容の解釈", options: { breakLine: true } },
    { text: "・ 引受可否・補償可否の判断", options: { breakLine: true } },
    { text: "・ 保険料の最終確定", options: { breakLine: true } },
    { text: "・ 既存顧客への深耕・更新提案", options: { breakLine: true } },
    { text: "・ 対面での信頼関係構築", options: {} },
  ], {
    x: 5.45, y: colY + 1.05, w: 4.0, h: 2.0,
    fontSize: 11.5, fontFace: FONT_JP, color: C.INK, margin: 0, paraSpaceAfter: 3,
  });

  s.addText("この切り分けが、保険業務でAIを使う際の安全性と実効性を両立させる要だと考えています。", {
    x: 0.5, y: 4.97, w: 9, h: 0.3,
    fontSize: 10.5, fontFace: FONT_JP, italic: true, color: C.NAVY,
    align: "center", margin: 0,
  });
}

// ============================================================
// Slide 7 — 安全設計
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.WHITE };
  pageChrome(s, "", 7, TOTAL);
  slideTitle(s, "保険業務だからこその安全設計", "SAFETY BY DESIGN");

  s.addText("AIに判断させない領域を明示し、回答の前提条件・出典・引き継ぎ導線を設計に組み込みます。", {
    x: 0.5, y: 1.35, w: 9, h: 0.35,
    fontSize: 12, fontFace: FONT_JP, color: C.INK, margin: 0,
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 1.85, w: 4.4, h: 0.5,
    fill: { color: C.GREEN }, line: { color: C.GREEN, width: 0 },
  });
  s.addText("○  AIが対応する", {
    x: 0.6, y: 1.85, w: 4.2, h: 0.5,
    fontSize: 13, fontFace: FONT_JP_B, bold: true, color: C.WHITE,
    align: "left", valign: "middle", margin: 0,
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.1, y: 1.85, w: 4.4, h: 0.5,
    fill: { color: C.RED }, line: { color: C.RED, width: 0 },
  });
  s.addText("×  AIには判断させない", {
    x: 5.2, y: 1.85, w: 4.2, h: 0.5,
    fontSize: 13, fontFace: FONT_JP_B, bold: true, color: C.WHITE,
    align: "left", valign: "middle", margin: 0,
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 2.35, w: 4.4, h: 2.55,
    fill: { color: C.BG }, line: { color: C.LINE, width: 0.5 },
  });
  s.addText([
    { text: "加入手続きの流れのご案内", options: { bullet: { code: "25CB" }, breakLine: true } },
    { text: "必要書類のご説明", options: { bullet: { code: "25CB" }, breakLine: true } },
    { text: "営業時間・申込期限などの基本情報", options: { bullet: { code: "25CB" }, breakLine: true } },
    { text: "商品の一般的な概要説明", options: { bullet: { code: "25CB" }, breakLine: true } },
    { text: "問い合わせ前の情報整理", options: { bullet: { code: "25CB" }, breakLine: true } },
    { text: "担当者への引き継ぎ", options: { bullet: { code: "25CB" } } },
  ], {
    x: 0.7, y: 2.5, w: 4.05, h: 2.3,
    fontSize: 11.5, fontFace: FONT_JP, color: C.INK, margin: 0, paraSpaceAfter: 5,
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.1, y: 2.35, w: 4.4, h: 2.55,
    fill: { color: C.BG }, line: { color: C.LINE, width: 0.5 },
  });
  s.addText([
    { text: "保険料の最終確定", options: { bullet: { code: "25A0" }, breakLine: true } },
    { text: "引受可否の判断", options: { bullet: { code: "25A0" }, breakLine: true } },
    { text: "補償可否の断定", options: { bullet: { code: "25A0" }, breakLine: true } },
    { text: "個別契約内容の解釈", options: { bullet: { code: "25A0" }, breakLine: true } },
    { text: "事故時の支払可否", options: { bullet: { code: "25A0" }, breakLine: true } },
    { text: "最適商品の断定的な推奨", options: { bullet: { code: "25A0" } } },
  ], {
    x: 5.3, y: 2.5, w: 4.05, h: 2.3,
    fontSize: 11.5, fontFace: FONT_JP, color: C.INK, margin: 0, paraSpaceAfter: 5,
  });

  s.addText("「できないこと」ではなく「安全のために線を引いた領域」として、利用者にも明示する設計です。", {
    x: 0.5, y: 4.95, w: 9, h: 0.3,
    fontSize: 10.5, fontFace: FONT_JP, italic: true, color: C.NAVY,
    align: "center", margin: 0,
  });
}

// ============================================================
// Slide 8 — 導入ステップ
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.WHITE };
  pageChrome(s, "", 8, TOTAL);
  slideTitle(s, "段階的に進める導入ステップ", "PHASED ROLLOUT");

  s.addText("いきなり大きく作らず、1週間の分析からスタートし、結果を見て本開発を判断いただける設計です。", {
    x: 0.5, y: 1.35, w: 9, h: 0.35,
    fontSize: 12, fontFace: FONT_JP, color: C.INK, margin: 0,
  });

  const phases = [
    { ph: "Phase A",  ttl: "1週間 分析",      sub: "問い合わせ分類・FAQ化可能率の測定・対象範囲の確定" },
    { ph: "Phase B",  ttl: "本開発",          sub: "チャットbot構築・FAQ設計・有人連携・テスト・納品" },
    { ph: "Phase C",  ttl: "テスト運用 3ヶ月",sub: "ログ確認・FAQ調整・精度改善・モデル選定検証" },
    { ph: "Phase D",  ttl: "継続運用 3ヶ月",  sub: "月次分析・精度改善・FAQ追加・レポート" },
    { ph: "Phase E",  ttl: "7ヶ月目以降",     sub: "ライト／標準／伴走の3プランから選択し再見積もり" },
  ];

  const startX = 0.5;
  const totalW = 9.0;
  const cardW = (totalW - 0.4) / 5;
  const gap = 0.1;
  phases.forEach((p, i) => {
    const x = startX + i * (cardW + gap);
    const y = 1.95;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cardW, h: 0.5,
      fill: { color: C.NAVY }, line: { color: C.NAVY, width: 0 },
    });
    s.addText(p.ph, {
      x, y, w: cardW, h: 0.5,
      fontSize: 12, fontFace: FONT_JP_B, bold: true, color: C.WHITE,
      align: "center", valign: "middle", margin: 0,
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: y + 0.5, w: cardW, h: 2.15,
      fill: { color: C.BG }, line: { color: C.LINE, width: 0.5 },
    });
    s.addText(p.ttl, {
      x: x + 0.05, y: y + 0.6, w: cardW - 0.1, h: 0.5,
      fontSize: 13, fontFace: FONT_JP_B, bold: true, color: C.NAVY,
      align: "center", valign: "middle", margin: 0,
    });
    s.addText(p.sub, {
      x: x + 0.12, y: y + 1.1, w: cardW - 0.24, h: 1.55,
      fontSize: 10, fontFace: FONT_JP, color: C.INK,
      align: "left", valign: "top", margin: 0,
    });
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 4.85, w: 9, h: 0.35,
    fill: { color: C.ACCENT_LT }, line: { color: C.ACCENT_LT, width: 0 },
  });
  s.addText("最低契約期間は 6ヶ月。Phase A の結果を見て、Phase B 以降に進むかを改めてご判断いただけます。", {
    x: 0.6, y: 4.85, w: 8.9, h: 0.35,
    fontSize: 10.5, fontFace: FONT_JP, color: C.NAVY, bold: true,
    align: "left", valign: "middle", margin: 0,
  });
}

// ============================================================
// Slide 9 — Phase A : 1週間分析の内容
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.WHITE };
  pageChrome(s, "", 9, TOTAL);
  slideTitle(s, "Phase A : 1週間分析の中身", "WEEK-1 ANALYSIS");

  s.addText("分析項目", {
    x: 0.5, y: 1.4, w: 4, h: 0.35,
    fontSize: 12, fontFace: FONT_JP_B, bold: true, color: C.ACCENT, margin: 0,
  });
  s.addText([
    { text: "各部門に来る問い合わせの分類", options: { bullet: { code: "25A0" }, breakLine: true } },
    { text: "FAQ化が可能な比率の測定", options: { bullet: { code: "25A0" }, breakLine: true } },
    { text: "AIで答えられる範囲と人が対応すべき範囲の切り分け", options: { bullet: { code: "25A0" }, breakLine: true } },
    { text: "保険判断につながる危険回答を出さないための設計指針策定", options: { bullet: { code: "25A0" }, breakLine: true } },
    { text: "チャットbotの初期対象範囲の確定", options: { bullet: { code: "25A0" }, breakLine: true } },
    { text: "Phase B 本開発の正式見積もりの算出", options: { bullet: { code: "25A0" } } },
  ], {
    x: 0.5, y: 1.75, w: 5.0, h: 2.9,
    fontSize: 11.5, fontFace: FONT_JP, color: C.INK, margin: 0, paraSpaceAfter: 6,
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.0, y: 1.4, w: 3.5, h: 3.3,
    fill: { color: C.NAVY }, line: { color: C.NAVY, width: 0 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.0, y: 1.4, w: 0.1, h: 3.3,
    fill: { color: C.ACCENT }, line: { color: C.ACCENT, width: 0 },
  });
  s.addText("Phase A スペック", {
    x: 6.25, y: 1.55, w: 3.2, h: 0.3,
    fontSize: 10, fontFace: FONT_JP, color: C.ACCENT, charSpacing: 2, margin: 0,
  });
  s.addText("¥150,000", {
    x: 6.25, y: 1.85, w: 3.2, h: 0.7,
    fontSize: 32, fontFace: FONT_JP_B, bold: true, color: C.WHITE, margin: 0,
  });
  s.addText("(税抜 / 一括)", {
    x: 6.25, y: 2.55, w: 3.2, h: 0.3,
    fontSize: 10, fontFace: FONT_JP, color: "BFCBE0", margin: 0,
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.25, y: 3.0, w: 3.05, h: 0.02,
    fill: { color: C.NAVY_MID }, line: { color: C.NAVY_MID, width: 0 },
  });
  s.addText([
    { text: "期間:1週間", options: { breakLine: true, bold: true } },
    { text: "アウトプット:", options: { breakLine: true } },
    { text: "・ 分析レポート", options: { breakLine: true } },
    { text: "・ Phase B 正式見積書", options: {} },
  ], {
    x: 6.25, y: 3.1, w: 3.05, h: 1.55,
    fontSize: 11, fontFace: FONT_JP, color: C.WHITE, margin: 0, paraSpaceAfter: 3,
  });

  s.addText("Phase A は独立した契約として完結します。結果に納得いただいてからPhase Bへ進む建付けです。", {
    x: 0.5, y: 4.95, w: 9, h: 0.3,
    fontSize: 10.5, fontFace: FONT_JP, italic: true, color: C.NAVY,
    align: "center", margin: 0,
  });
}

// ============================================================
// Slide 10 — Phase B : 本開発・検収基準
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.WHITE };
  pageChrome(s, "", 10, TOTAL);
  slideTitle(s, "Phase B : 本開発と検収基準", "DEVELOPMENT & ACCEPTANCE");

  s.addText("構築内容", {
    x: 0.5, y: 1.4, w: 4, h: 0.35,
    fontSize: 12, fontFace: FONT_JP_B, bold: true, color: C.ACCENT, margin: 0,
  });
  s.addText([
    { text: "チャットbot本体の構築(RAG + 標準UI)", options: { bullet: { code: "25A0" }, breakLine: true } },
    { text: "初期FAQと回答ルールの設計", options: { bullet: { code: "25A0" }, breakLine: true } },
    { text: "有人連携(担当者引き継ぎ)機能", options: { bullet: { code: "25A0" }, breakLine: true } },
    { text: "テストと納品", options: { bullet: { code: "25A0" } } },
  ], {
    x: 0.5, y: 1.75, w: 5.0, h: 1.95,
    fontSize: 11.5, fontFace: FONT_JP, color: C.INK, margin: 0, paraSpaceAfter: 5,
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.0, y: 1.4, w: 3.5, h: 2.3,
    fill: { color: C.LIGHT }, line: { color: C.LIGHT, width: 0 },
  });
  s.addText("Phase B  本開発", {
    x: 6.2, y: 1.55, w: 3.2, h: 0.3,
    fontSize: 10, fontFace: FONT_JP, color: C.NAVY, charSpacing: 2, margin: 0,
  });
  s.addText("¥650,000", {
    x: 6.2, y: 1.85, w: 3.2, h: 0.7,
    fontSize: 30, fontFace: FONT_JP_B, bold: true, color: C.NAVY, margin: 0,
  });
  s.addText("税抜 / 期間 1.5〜2ヶ月", {
    x: 6.2, y: 2.55, w: 3.2, h: 0.3,
    fontSize: 10, fontFace: FONT_JP, color: C.NAVY_MID, margin: 0,
  });
  s.addText("契約時 50% ／ 検収後 50%", {
    x: 6.2, y: 2.9, w: 3.2, h: 0.3,
    fontSize: 10, fontFace: FONT_JP, color: C.NAVY_MID, margin: 0,
  });
  s.addText("オプション: オリジナルUI制作 +¥150,000", {
    x: 6.2, y: 3.25, w: 3.2, h: 0.3,
    fontSize: 9.5, fontFace: FONT_JP, color: C.MUTED, italic: true, margin: 0,
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 3.95, w: 9, h: 1.05,
    fill: { color: C.BG }, line: { color: C.LINE, width: 0.5 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 3.95, w: 0.1, h: 1.05,
    fill: { color: C.ACCENT }, line: { color: C.ACCENT, width: 0 },
  });
  s.addText("検収基準(契約前に明文化)", {
    x: 0.75, y: 4.0, w: 5, h: 0.3,
    fontSize: 11, fontFace: FONT_JP_B, bold: true, color: C.NAVY, margin: 0,
  });
  s.addText([
    { text: "・ 合意したFAQ範囲の回答妥当率 80% 以上", options: { breakLine: true } },
    { text: "・ 危険回答(保険判断・引受可否・補償可否の断定)0件", options: { breakLine: true } },
    { text: "・ 有人引き継ぎ導線が正常動作 ／ 主要シナリオ20件のテストケース通過", options: {} },
  ], {
    x: 0.75, y: 4.3, w: 8.65, h: 0.7,
    fontSize: 10.5, fontFace: FONT_JP, color: C.INK, margin: 0, paraSpaceAfter: 1,
  });
}

// ============================================================
// Slide 11 — 効果測定 KPI
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.WHITE };
  pageChrome(s, "", 11, TOTAL);
  slideTitle(s, "効果をどう測るか", "HOW WE MEASURE");

  s.addText("導入効果は「人件費削減」ではなく、現場で実感できる指標で見ていきます。", {
    x: 0.5, y: 1.35, w: 9, h: 0.35,
    fontSize: 12, fontFace: FONT_JP, color: C.INK, margin: 0,
  });

  const kpis = [
    { ttl: "FAQ化可能率",       desc: "問い合わせのうち、AIで一次対応できる比率" },
    { ttl: "自己解決率",         desc: "AI応答だけで完結した会話の割合" },
    { ttl: "有人移行率",         desc: "担当者に引き継がれた会話の割合と内容" },
    { ttl: "平均解決時間",       desc: "問い合わせ発生〜解決までの所要時間" },
    { ttl: "回答妥当率",         desc: "AI回答の内容が妥当だった割合(サンプリング)" },
    { ttl: "営業活動可処分時間", desc: "電話対応の負荷が下がったことで生まれる時間" },
  ];
  const cellW = 2.85, cellH = 1.45;
  const gridX = 0.5, gridY = 1.85;
  kpis.forEach((k, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = gridX + col * (cellW + 0.15);
    const y = gridY + row * (cellH + 0.15);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cellW, h: cellH,
      fill: { color: C.BG }, line: { color: C.LINE, width: 0.5 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cellW, h: 0.08,
      fill: { color: C.NAVY }, line: { color: C.NAVY, width: 0 },
    });
    s.addText(k.ttl, {
      x: x + 0.15, y: y + 0.2, w: cellW - 0.3, h: 0.4,
      fontSize: 13, fontFace: FONT_JP_B, bold: true, color: C.NAVY,
      align: "left", valign: "middle", margin: 0,
    });
    s.addText(k.desc, {
      x: x + 0.15, y: y + 0.6, w: cellW - 0.3, h: 0.8,
      fontSize: 10, fontFace: FONT_JP, color: C.INK,
      align: "left", valign: "top", margin: 0,
    });
  });

  s.addText("具体的な数値目標は、Phase A の分析結果をもとに、貴社の現状値を起点に設定します。", {
    x: 0.5, y: 4.95, w: 9, h: 0.3,
    fontSize: 10.5, fontFace: FONT_JP, italic: true, color: C.NAVY,
    align: "center", margin: 0,
  });
}

// ============================================================
// Slide 12 — 価格・契約条件
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.WHITE };
  pageChrome(s, "", 12, TOTAL);
  slideTitle(s, "価格と契約条件", "PRICING & TERMS");

  const tblData = [
    [
      { text: "区分",         options: { fill: { color: C.NAVY }, color: C.WHITE, bold: true, align: "left",  valign: "middle" } },
      { text: "内容",         options: { fill: { color: C.NAVY }, color: C.WHITE, bold: true, align: "left",  valign: "middle" } },
      { text: "金額(税抜)",   options: { fill: { color: C.NAVY }, color: C.WHITE, bold: true, align: "right", valign: "middle" } },
      { text: "期間 / 支払",  options: { fill: { color: C.NAVY }, color: C.WHITE, bold: true, align: "left",  valign: "middle" } },
    ],
    ["Phase A",     "1週間分析(独立契約)",                  "¥150,000",           "1週間 / 完了時一括"],
    ["Phase B",     "本開発(チャットbot構築・納品)",         "¥650,000",           "1.5〜2ヶ月 / 契約時50%・検収後50%"],
    ["Phase C",     "テスト運用 月額 × 3ヶ月",              "¥60,000 / 月",       "当月末締 翌月末払"],
    ["Phase D",     "継続運用 月額 × 3ヶ月",                "¥100,000 / 月",      "当月末締 翌月末払"],
    ["Phase E",     "7ヶ月目以降",                          "別途見積",           "ライト／標準／伴走から選択"],
    ["オプション", "オリジナルUI制作",                       "+¥150,000",          "Phase B と同条件"],
    ["別途請求",   "AI利用料(API実費)",                     "実費精算+管理フィー", "毎月請求書添付"],
  ];
  for (let i = 1; i < tblData.length; i++) {
    tblData[i] = tblData[i].map((cell, j) => {
      if (typeof cell === "string") {
        const align = (j === 2) ? "right" : "left";
        return { text: cell, options: { align, valign: "middle", fontSize: 10.5, color: C.INK } };
      }
      return cell;
    });
  }
  s.addTable(tblData, {
    x: 0.5, y: 1.4, w: 9.0,
    colW: [1.1, 3.0, 2.3, 2.6],
    rowH: 0.34,
    fontFace: FONT_JP, fontSize: 10.5,
    border: { type: "solid", pt: 0.5, color: C.LINE },
    color: C.INK,
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 4.35, w: 9, h: 0.55,
    fill: { color: C.LIGHT }, line: { color: C.LIGHT, width: 0 },
  });
  s.addText([
    { text: "最低契約期間 ", options: { bold: true, color: C.NAVY } },
    { text: "6ヶ月    ", options: { color: C.INK } },
    { text: "見積有効期限 ", options: { bold: true, color: C.NAVY } },
    { text: "提出日より3ヶ月    ", options: { color: C.INK } },
    { text: "消費税 ", options: { bold: true, color: C.NAVY } },
    { text: "別途", options: { color: C.INK } },
  ], {
    x: 0.7, y: 4.35, w: 8.6, h: 0.55,
    fontSize: 11, fontFace: FONT_JP, valign: "middle", margin: 0,
  });

  s.addText("Phase B 以降の正式金額は Phase A の分析結果に基づき改めてご提示します。", {
    x: 0.5, y: 4.97, w: 9, h: 0.25,
    fontSize: 9.5, fontFace: FONT_JP, italic: true, color: C.MUTED,
    align: "center", margin: 0,
  });
}

// ============================================================
// Slide 13 — DXロードマップ
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.WHITE };
  pageChrome(s, "", 13, TOTAL);
  slideTitle(s, "今回の範囲とその先の絵", "DX ROADMAP");

  s.addText("第1層を今回の見積もり範囲としつつ、第2層・第3層は将来の絵として共有しておきます。", {
    x: 0.5, y: 1.35, w: 9, h: 0.35,
    fontSize: 12, fontFace: FONT_JP, color: C.INK, margin: 0,
  });

  const layers = [
    { tag: "第1層", label: "今回ご提案する範囲",
      color: C.NAVY, textColor: C.WHITE,
      items: [
        "HP上のAIチャットbot(全社共通FAQ)",
        "問い合わせの一次対応の自動化と担当者引き継ぎ",
      ] },
    { tag: "第2層", label: "次フェーズの本命(別途見積)",
      color: C.NAVY_MID, textColor: C.WHITE,
      items: [
        "イベント部門の見積もり転記の自動化",
        "保険会社見積 → Excel → PDF → 送信履歴の一気通貫",
      ] },
    { tag: "第3層", label: "中長期の絵(議論ベース)",
      color: C.LIGHT, textColor: C.NAVY,
      items: [
        "ドローン部門の満期メール案内の自動化",
        "Nats / Alrit との連携または置き換え検討",
        "AIによる更新提案・クロスセル支援",
      ] },
  ];

  const rowY = 1.85;
  const rowH = 1.0;
  const gap = 0.12;
  layers.forEach((L, i) => {
    const y = rowY + i * (rowH + gap);
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y, w: 1.5, h: rowH,
      fill: { color: L.color }, line: { color: L.color, width: 0 },
    });
    s.addText(L.tag, {
      x: 0.5, y, w: 1.5, h: 0.45,
      fontSize: 14, fontFace: FONT_JP_B, bold: true, color: L.textColor,
      align: "center", valign: "middle", margin: 0,
    });
    s.addText(L.label, {
      x: 0.5, y: y + 0.45, w: 1.5, h: 0.55,
      fontSize: 9, fontFace: FONT_JP, color: L.textColor,
      align: "center", valign: "top", margin: 0,
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 2.1, y, w: 7.4, h: rowH,
      fill: { color: i === 0 ? C.BG : C.WHITE }, line: { color: C.LINE, width: 0.5 },
    });
    const bulletText = L.items.map((tx, k) => ({
      text: tx, options: { bullet: { code: "25A0" }, breakLine: k < L.items.length - 1 },
    }));
    s.addText(bulletText, {
      x: 2.3, y: y + 0.12, w: 7.05, h: rowH - 0.2,
      fontSize: 11, fontFace: FONT_JP, color: C.INK,
      valign: "middle", margin: 0, paraSpaceAfter: 2,
    });
  });

  s.addText("第2層・第3層は今回の見積もりには含みません。Phase A の中で優先順位を一緒に整理させてください。", {
    x: 0.5, y: 4.97, w: 9, h: 0.25,
    fontSize: 10, fontFace: FONT_JP, italic: true, color: C.MUTED,
    align: "center", margin: 0,
  });
}

// ============================================================
// Slide 14 — リスク管理
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.WHITE };
  pageChrome(s, "", 14, TOTAL);
  slideTitle(s, "保険業務特有のリスクへの対処方針", "RISK MANAGEMENT");

  s.addText("AIを保険代理店の業務に組み込むうえで想定されるリスクと、それぞれへの対処方針です。", {
    x: 0.5, y: 1.35, w: 9, h: 0.35,
    fontSize: 12, fontFace: FONT_JP, color: C.INK, margin: 0,
  });

  const risks = [
    { ttl: "顧客情報の保護",   body: "顧客情報をAIの学習に使わない設定。送信内容を制御し、貴社管理下で完結する設計とします。" },
    { ttl: "誤回答(ハルシネーション)対策", body: "RAGによる根拠付き回答に限定。回答できない質問は無理に答えず、人へ確実に引き継ぎます。" },
    { ttl: "金融庁規制への配慮", body: "保険業法・金商法のグレーゾーンには踏み込まない設計。会話履歴は監査対応可能な形で保存します。" },
    { ttl: "API障害時の継続性", body: "プロバイダ障害時は二次プロバイダへフォールバック。停止時は人手対応への明示誘導で穴を作りません。" },
    { ttl: "監査ログの保全",     body: "全会話を保存し、いつ誰の質問にAIがどう答えたかを後日確認可能に。金融庁規制への対応に活用できます。" },
    { ttl: "担当者引き継ぎの確実性", body: "AIで完結できない案件は担当部署へ確実にエスカレーション。引き継ぎログを社内で共有します。" },
  ];

  const cellW = 2.85, cellH = 1.45;
  const gridX = 0.5, gridY = 1.85;
  risks.forEach((r, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = gridX + col * (cellW + 0.15);
    const y = gridY + row * (cellH + 0.15);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cellW, h: cellH,
      fill: { color: C.BG }, line: { color: C.LINE, width: 0.5 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cellW, h: 0.08,
      fill: { color: C.ACCENT }, line: { color: C.ACCENT, width: 0 },
    });
    s.addText(r.ttl, {
      x: x + 0.15, y: y + 0.2, w: cellW - 0.3, h: 0.4,
      fontSize: 12, fontFace: FONT_JP_B, bold: true, color: C.NAVY,
      align: "left", valign: "middle", margin: 0,
    });
    s.addText(r.body, {
      x: x + 0.15, y: y + 0.6, w: cellW - 0.3, h: 0.8,
      fontSize: 9.5, fontFace: FONT_JP, color: C.INK,
      align: "left", valign: "top", margin: 0,
    });
  });

  s.addText("検収条件・契約条項として明文化のうえ、運用開始後も月次レビューで継続的に確認していきます。", {
    x: 0.5, y: 4.95, w: 9, h: 0.3,
    fontSize: 10.5, fontFace: FONT_JP, italic: true, color: C.NAVY,
    align: "center", margin: 0,
  });
}

// ============================================================
// Slide 15 — 次のアクション
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.NAVY_DARK };
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.18, h: H,
    fill: { color: C.ACCENT }, line: { color: C.ACCENT, width: 0 },
  });
  s.addText("NEXT ACTION", {
    x: 0.7, y: 0.8, w: 9, h: 0.3,
    fontSize: 11, fontFace: FONT_JP, color: C.ACCENT,
    bold: true, charSpacing: 4, margin: 0,
  });
  s.addText("次のアクション", {
    x: 0.7, y: 1.15, w: 9, h: 0.7,
    fontSize: 32, fontFace: FONT_JP_B, bold: true, color: C.WHITE, margin: 0,
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.7, y: 1.95, w: 1.0, h: 0.03,
    fill: { color: C.ACCENT }, line: { color: C.ACCENT, width: 0 },
  });
  s.addText("Phase A(1週間の問い合わせ分析)の開始日を、本日のなかで握らせてください。", {
    x: 0.7, y: 2.2, w: 8.6, h: 0.45,
    fontSize: 16, fontFace: FONT_JP, color: C.WHITE, margin: 0,
  });
  s.addText("Phase A の分析レポートを見たうえで、Phase B 本開発に進むかをご判断いただく建付けです。", {
    x: 0.7, y: 2.7, w: 8.6, h: 0.45,
    fontSize: 12, fontFace: FONT_JP, color: "BFCBE0", margin: 0,
  });

  const steps = [
    { n: "1", ttl: "Phase A 開始日の確定",   sub: "本日中に、開始希望週を決定" },
    { n: "2", ttl: "ヒアリング対象の確定",   sub: "対象部門と協力者をすり合わせ" },
    { n: "3", ttl: "Phase B 判断",           sub: "1週間後、分析結果を見て判断" },
  ];
  steps.forEach((st, i) => {
    const x = 0.7 + i * 3.0;
    const y = 3.7;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 2.8, h: 1.3,
      fill: { color: C.NAVY }, line: { color: "2E537A", width: 0.5 },
    });
    s.addText(st.n, {
      x: x + 0.2, y: y + 0.15, w: 0.55, h: 0.55,
      fontSize: 26, fontFace: FONT_JP_B, bold: true, color: C.ACCENT,
      align: "left", valign: "middle", margin: 0,
    });
    s.addText(st.ttl, {
      x: x + 0.2, y: y + 0.7, w: 2.5, h: 0.35,
      fontSize: 12, fontFace: FONT_JP_B, bold: true, color: C.WHITE,
      align: "left", valign: "middle", margin: 0,
    });
    s.addText(st.sub, {
      x: x + 0.2, y: y + 1.0, w: 2.5, h: 0.3,
      fontSize: 9.5, fontFace: FONT_JP, color: "BFCBE0",
      align: "left", valign: "middle", margin: 0,
    });
  });

  s.addText("株式会社エキセントリック  /  代表取締役 長谷川", {
    x: 0.7, y: 5.25, w: 9, h: 0.3,
    fontSize: 10, fontFace: FONT_JP, color: "BFCBE0", margin: 0,
  });
}

// ============================================================
pres.writeFile({ fileName: "good_insurance_proposal_v1.pptx" })
  .then(fn => console.log("Wrote:", fn));
