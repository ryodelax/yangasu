// グッド保険サービス様 御見積書 一式 (Phase A〜D)
// エキセントリック社標準フォーマットに準拠
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Footer, AlignmentType, LevelFormat, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber,
} = require("docx");

const INK    = "000000";
const MUTED  = "595959";
const LINE   = "000000";
const SOFT   = "BFBFBF";
const SECTION_BG = "EFEFEF";
const FONT   = "游ゴシック";

const p = (opts) => new Paragraph(opts);
const t = (text, opts = {}) => new TextRun({ text, font: FONT, ...opts });

const tb     = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const tbSoft = { style: BorderStyle.SINGLE, size: 4, color: SOFT };
const tbNone = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const allBorders = (b = tb) => ({ top: b, bottom: b, left: b, right: b });
const noBorders = { top: tbNone, bottom: tbNone, left: tbNone, right: tbNone };

function cell({
  text, runs, width, align = AlignmentType.LEFT, valign = VerticalAlign.CENTER,
  fill, bold = false, color = INK, size = 18, borders = allBorders(),
  margins = { top: 80, bottom: 80, left: 120, right: 120 },
  columnSpan, rowSpan,
}) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA },
    margins, columnSpan, rowSpan, verticalAlign: valign,
    shading: fill ? { fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    children: [new Paragraph({
      alignment: align,
      children: runs ? runs : [new TextRun({ text: text || "", font: FONT, bold, color, size })],
    })],
  });
}

// ===== Title =====
const title = p({
  alignment: AlignmentType.CENTER,
  spacing: { before: 60, after: 320 },
  children: [t("御 見 積 書", { size: 36, bold: true, color: INK, characterSpacing: 80 })],
});

// ===== TOP : recipient (left) + meta + sender (right) =====
const TOP_W = [5200, 3826];
const META_W = [1500, 2326];

const metaRow = (label, val) => new TableRow({
  height: { value: 360, rule: "exact" },
  children: [
    cell({ text: label, width: META_W[0], size: 18, color: INK, align: AlignmentType.LEFT,
           borders: noBorders, margins: { top: 40, bottom: 40, left: 0, right: 0 } }),
    cell({ text: val,   width: META_W[1], size: 18, color: INK, align: AlignmentType.RIGHT,
           borders: noBorders, margins: { top: 40, bottom: 40, left: 0, right: 0 } }),
  ],
});

const topSection = new Table({
  width: { size: 9026, type: WidthType.DXA },
  columnWidths: TOP_W,
  rows: [
    new TableRow({
      children: [
        // LEFT: recipient block
        new TableCell({
          borders: noBorders, width: { size: TOP_W[0], type: WidthType.DXA },
          margins: { top: 0, bottom: 0, left: 0, right: 200 },
          children: [
            p({ spacing: { after: 100 }, children: [t("株式会社グッド保険サービス  御中", { size: 26, bold: true })] }),
            p({ spacing: { after: 20  }, children: [t("〒XXX-XXXX", { size: 16, color: MUTED })] }),
            p({ spacing: { after: 20  }, children: [t("東京都〇〇区〇〇  〇-〇-〇", { size: 16, color: MUTED })] }),
            p({ spacing: { after: 220 }, children: [t("〇〇ビル〇階", { size: 16, color: MUTED })] }),
            p({ spacing: { after: 0   }, children: [t("専務取締役  伊藤  様", { size: 20 })] }),
          ],
        }),
        // RIGHT: nested meta + sender
        new TableCell({
          borders: noBorders, width: { size: TOP_W[1], type: WidthType.DXA },
          margins: { top: 0, bottom: 0, left: 200, right: 0 },
          children: [
            new Table({
              width: { size: TOP_W[1] - 200, type: WidthType.DXA },
              columnWidths: META_W,
              rows: [
                metaRow("見積日",     "2026年5月20日"),
                metaRow("見積書番号", "Q-2026-0001"),
                metaRow("有効期限",   "発行日より3ヶ月"),
              ],
            }),
            p({ spacing: { before: 240 }, children: [t("")] }),
            p({ spacing: { after: 60 }, children: [t("株式会社エキセントリック", { size: 22, bold: true })] }),
            p({ spacing: { after: 60 }, children: [t("代表取締役  長谷川  遼", { size: 18 })] }),
            p({ spacing: { after: 30 }, children: [t("〒231-XXXX", { size: 14, color: MUTED })] }),
            p({ spacing: { after: 30 }, children: [t("神奈川県横浜市中区吉田町11-2-203", { size: 14, color: MUTED })] }),
            p({ spacing: { after: 30 }, children: [t("Mobile: 090-8684-3615", { size: 14, color: MUTED })] }),
            p({ spacing: { after: 30 }, children: [t("Mail: r.hasegawa@ec-centric.com", { size: 14, color: MUTED })] }),
          ],
        }),
      ],
    }),
  ],
});

// ===== Greeting + Subject =====
const greeting = p({
  spacing: { before: 320, after: 160 },
  children: [t("下記の通り御見積申し上げます。", { size: 20 })],
});

const SUBJECT_W = [1200, 7826];
const subjectTbl = new Table({
  width: { size: 9026, type: WidthType.DXA },
  columnWidths: SUBJECT_W,
  rows: [
    new TableRow({
      children: [
        cell({ text: "件名", width: SUBJECT_W[0], size: 20, color: MUTED, align: AlignmentType.LEFT,
               borders: noBorders, margins: { top: 40, bottom: 40, left: 0, right: 80 } }),
        cell({ text: "AI問い合わせ対応導入業務 一式（HPチャットbot構築・Phase A〜D / 6ヶ月）",
               width: SUBJECT_W[1], size: 20, bold: true,
               borders: noBorders, margins: { top: 40, bottom: 40, left: 0, right: 0 } }),
      ],
    }),
  ],
});

// ===== Summary box: 小計 / 消費税 / 見積金額 =====
const SUM_W = [2400, 2400, 4226];
const summaryTbl = new Table({
  width: { size: 9026, type: WidthType.DXA },
  columnWidths: SUM_W,
  rows: [
    new TableRow({
      height: { value: 380, rule: "exact" },
      children: [
        cell({ text: "小計",       width: SUM_W[0], align: AlignmentType.CENTER, bold: true, size: 18, color: MUTED }),
        cell({ text: "消費税",     width: SUM_W[1], align: AlignmentType.CENTER, bold: true, size: 18, color: MUTED }),
        cell({ text: "見積金額",   width: SUM_W[2], align: AlignmentType.CENTER, bold: true, size: 18, color: MUTED }),
      ],
    }),
    new TableRow({
      height: { value: 720, rule: "exact" },
      children: [
        cell({ text: "1,280,000円", width: SUM_W[0], align: AlignmentType.CENTER, size: 22 }),
        cell({ text: "128,000円",   width: SUM_W[1], align: AlignmentType.CENTER, size: 22 }),
        cell({ width: SUM_W[2], align: AlignmentType.CENTER,
               runs: [new TextRun({ text: "1,408,000円", font: FONT, bold: true, size: 40, color: INK })] }),
      ],
    }),
  ],
});

// ===== Item table =====
const ITEM_W = [4626, 1200, 1500, 1700]; // 9026
const itemHeader = new TableRow({
  tableHeader: true,
  height: { value: 360, rule: "exact" },
  children: [
    cell({ text: "摘要",     width: ITEM_W[0], align: AlignmentType.CENTER, bold: true, size: 18 }),
    cell({ text: "数量",     width: ITEM_W[1], align: AlignmentType.CENTER, bold: true, size: 18 }),
    cell({ text: "単価",     width: ITEM_W[2], align: AlignmentType.CENTER, bold: true, size: 18 }),
    cell({ text: "明細金額", width: ITEM_W[3], align: AlignmentType.CENTER, bold: true, size: 18 }),
  ],
});

function sectionRow(label) {
  return new TableRow({
    height: { value: 320, rule: "exact" },
    children: [
      new TableCell({
        borders: allBorders(), columnSpan: 4,
        width: { size: 9026, type: WidthType.DXA },
        margins: { top: 60, bottom: 60, left: 160, right: 160 },
        shading: { fill: SECTION_BG, type: ShadingType.CLEAR, color: "auto" },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [new TextRun({ text: label, font: FONT, bold: true, size: 18, color: INK })],
        })],
      }),
    ],
  });
}

function itemRow(desc, qty, unit, amt) {
  return new TableRow({
    height: { value: 340, rule: "exact" },
    children: [
      cell({ text: desc, width: ITEM_W[0], size: 18, align: AlignmentType.LEFT,
             margins: { top: 60, bottom: 60, left: 240, right: 80 } }),
      cell({ text: qty,  width: ITEM_W[1], size: 18, align: AlignmentType.CENTER }),
      cell({ text: unit, width: ITEM_W[2], size: 18, align: AlignmentType.RIGHT,
             margins: { top: 60, bottom: 60, left: 80, right: 160 } }),
      cell({ text: amt,  width: ITEM_W[3], size: 18, align: AlignmentType.RIGHT,
             margins: { top: 60, bottom: 60, left: 80, right: 160 } }),
    ],
  });
}

function subtotalRow(label, amt) {
  return new TableRow({
    height: { value: 320, rule: "exact" },
    children: [
      new TableCell({
        borders: allBorders(), columnSpan: 3,
        width: { size: ITEM_W[0] + ITEM_W[1] + ITEM_W[2], type: WidthType.DXA },
        margins: { top: 60, bottom: 60, left: 160, right: 200 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: label, font: FONT, size: 16, color: MUTED })],
        })],
      }),
      cell({ text: amt, width: ITEM_W[3], size: 18, bold: true, align: AlignmentType.RIGHT,
             margins: { top: 60, bottom: 60, left: 80, right: 160 } }),
    ],
  });
}

const itemTbl = new Table({
  width: { size: 9026, type: WidthType.DXA },
  columnWidths: ITEM_W,
  rows: [
    itemHeader,

    sectionRow("【Phase A】1週間 問い合わせ分析 ※今回ご契約範囲"),
    itemRow("問い合わせ内容のヒアリング・分類設計",   "1 式", "30,000", "30,000"),
    itemRow("FAQ化可能率の測定・可視化",             "1 式", "30,000", "30,000"),
    itemRow("保険業務特有の危険回答 設計指針策定",   "1 式", "30,000", "30,000"),
    itemRow("チャットbot対象範囲・優先順位の確定",   "1 式", "20,000", "20,000"),
    itemRow("Phase B 本開発の正式見積算出",          "1 式", "20,000", "20,000"),
    itemRow("分析レポート作成・ご報告",               "1 式", "20,000", "20,000"),
    subtotalRow("Phase A 小計", "150,000"),

    sectionRow("【Phase B】本開発（チャットbot構築・納品）※Phase A 後に正式見積"),
    itemRow("チャットbot本体構築（RAG + 標準UI）",   "1 式", "400,000", "400,000"),
    itemRow("RAG用ナレッジデータ構築",               "1 式", "200,000", "200,000"),
    itemRow("初期FAQ設計・有人連携実装・テスト・納品", "1 式", "50,000",  "50,000"),
    subtotalRow("Phase B 小計", "650,000"),

    sectionRow("【Phase C】テスト運用 月額 × 3ヶ月（納品後3ヶ月）"),
    itemRow("ログ確認・FAQ調整・精度改善・モデル選定検証", "3 ヶ月", "60,000", "180,000"),
    subtotalRow("Phase C 小計", "180,000"),

    sectionRow("【Phase D】継続運用 月額 × 3ヶ月（4〜6ヶ月目）"),
    itemRow("月次分析・精度改善・FAQ追加・レポート",  "3 ヶ月", "100,000", "300,000"),
    subtotalRow("Phase D 小計", "300,000"),

    // 総計
    new TableRow({
      height: { value: 400, rule: "exact" },
      children: [
        new TableCell({
          borders: allBorders(), columnSpan: 3,
          width: { size: ITEM_W[0] + ITEM_W[1] + ITEM_W[2], type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 160, right: 200 },
          shading: { fill: SECTION_BG, type: ShadingType.CLEAR, color: "auto" },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "合計（税抜）", font: FONT, bold: true, size: 20, color: INK })],
          })],
        }),
        cell({ text: "1,280,000", width: ITEM_W[3], size: 22, bold: true, fill: SECTION_BG,
               align: AlignmentType.RIGHT, margins: { top: 80, bottom: 80, left: 80, right: 160 } }),
      ],
    }),
  ],
});

// ===== Optional & API notes (compact addendum table) =====
const ADD_W = [4626, 1200, 1500, 1700];
const addendumTbl = new Table({
  width: { size: 9026, type: WidthType.DXA },
  columnWidths: ADD_W,
  rows: [
    sectionRow("ご参考：オプション項目 ※本見積金額には含みません"),
    new TableRow({
      height: { value: 340, rule: "exact" },
      children: [
        cell({ text: "オリジナルUI制作（テンプレートUIに代えてご指定の場合）",
               width: ADD_W[0], size: 18, color: MUTED, align: AlignmentType.LEFT,
               margins: { top: 60, bottom: 60, left: 240, right: 80 } }),
        cell({ text: "1 式",        width: ADD_W[1], size: 18, color: MUTED, align: AlignmentType.CENTER }),
        cell({ text: "150,000",     width: ADD_W[2], size: 18, color: MUTED, align: AlignmentType.RIGHT,
               margins: { top: 60, bottom: 60, left: 80, right: 160 } }),
        cell({ text: "150,000",     width: ADD_W[3], size: 18, color: MUTED, align: AlignmentType.RIGHT,
               margins: { top: 60, bottom: 60, left: 80, right: 160 } }),
      ],
    }),
    new TableRow({
      height: { value: 340, rule: "exact" },
      children: [
        cell({ text: "AI利用料（OpenAI / Anthropic 等 API 実費 + 管理フィー）",
               width: ADD_W[0], size: 18, color: MUTED, align: AlignmentType.LEFT,
               margins: { top: 60, bottom: 60, left: 240, right: 80 } }),
        cell({ text: "実費精算",    width: ADD_W[1], size: 18, color: MUTED, align: AlignmentType.CENTER }),
        cell({ text: "—",           width: ADD_W[2], size: 18, color: MUTED, align: AlignmentType.RIGHT,
               margins: { top: 60, bottom: 60, left: 80, right: 160 } }),
        cell({ text: "毎月請求",    width: ADD_W[3], size: 18, color: MUTED, align: AlignmentType.RIGHT,
               margins: { top: 60, bottom: 60, left: 80, right: 160 } }),
      ],
    }),
    new TableRow({
      height: { value: 340, rule: "exact" },
      children: [
        cell({ text: "Phase E（7ヶ月目以降の継続運用）",
               width: ADD_W[0], size: 18, color: MUTED, align: AlignmentType.LEFT,
               margins: { top: 60, bottom: 60, left: 240, right: 80 } }),
        cell({ text: "—",           width: ADD_W[1], size: 18, color: MUTED, align: AlignmentType.CENTER }),
        cell({ text: "別途見積",    width: ADD_W[2], size: 18, color: MUTED, align: AlignmentType.RIGHT,
               margins: { top: 60, bottom: 60, left: 80, right: 160 } }),
        cell({ text: "ライト／標準／伴走から選択",
               width: ADD_W[3], size: 14, color: MUTED, align: AlignmentType.RIGHT,
               margins: { top: 60, bottom: 60, left: 80, right: 160 } }),
      ],
    }),
  ],
});

// ===== Bottom : 納品期限 / 場所 / 支払条件 (left) + 内訳 (right) =====
const BOT_W = [4826, 4200];
const BOT_R_W = [2100, 2100];

const bottomRow = new Table({
  width: { size: 9026, type: WidthType.DXA },
  columnWidths: BOT_W,
  rows: [
    new TableRow({
      children: [
        new TableCell({
          borders: noBorders, width: { size: BOT_W[0], type: WidthType.DXA },
          margins: { top: 100, bottom: 80, left: 0, right: 0 },
          children: [
            new Table({
              width: { size: BOT_W[0] - 200, type: WidthType.DXA },
              columnWidths: [1400, 3226],
              rows: [
                new TableRow({ children: [
                  cell({ text: "納品期限", width: 1400, size: 18, color: MUTED, borders: noBorders, align: AlignmentType.LEFT, margins: { top: 40, bottom: 40, left: 0, right: 0 } }),
                  cell({ text: "Phase A 着手から約2.5ヶ月（Phase B 検収まで）", width: 3226, size: 18, borders: noBorders, align: AlignmentType.LEFT, margins: { top: 40, bottom: 40, left: 0, right: 0 } }),
                ]}),
                new TableRow({ children: [
                  cell({ text: "納品場所", width: 1400, size: 18, color: MUTED, borders: noBorders, align: AlignmentType.LEFT, margins: { top: 40, bottom: 40, left: 0, right: 0 } }),
                  cell({ text: "別途協議", width: 3226, size: 18, borders: noBorders, align: AlignmentType.LEFT, margins: { top: 40, bottom: 40, left: 0, right: 0 } }),
                ]}),
                new TableRow({ children: [
                  cell({ text: "支払条件", width: 1400, size: 18, color: MUTED, borders: noBorders, align: AlignmentType.LEFT, margins: { top: 40, bottom: 40, left: 0, right: 0 } }),
                  cell({ text: "Phase A 完了後一括 / Phase B 契約時50%・検収後50% / 月額分は当月末締 翌月末払",
                         width: 3226, size: 16, borders: noBorders, align: AlignmentType.LEFT, margins: { top: 40, bottom: 40, left: 0, right: 0 } }),
                ]}),
                new TableRow({ children: [
                  cell({ text: "最低契約期間", width: 1400, size: 18, color: MUTED, borders: noBorders, align: AlignmentType.LEFT, margins: { top: 40, bottom: 40, left: 0, right: 0 } }),
                  cell({ text: "6ヶ月（Phase B 完了後の運用期間として）", width: 3226, size: 18, borders: noBorders, align: AlignmentType.LEFT, margins: { top: 40, bottom: 40, left: 0, right: 0 } }),
                ]}),
              ],
            }),
          ],
        }),
        new TableCell({
          borders: noBorders, width: { size: BOT_W[1], type: WidthType.DXA },
          margins: { top: 100, bottom: 0, left: 100, right: 0 },
          children: [
            new Table({
              width: { size: BOT_W[1] - 100, type: WidthType.DXA },
              columnWidths: BOT_R_W,
              rows: [
                new TableRow({ children: [
                  cell({ text: "内訳", width: BOT_R_W[0], align: AlignmentType.LEFT, size: 18, color: MUTED }),
                  cell({ text: "",      width: BOT_R_W[1], align: AlignmentType.RIGHT, size: 18 }),
                ]}),
                new TableRow({ children: [
                  cell({ text: "10%対象（税抜）", width: BOT_R_W[0], align: AlignmentType.LEFT,  size: 16, color: MUTED }),
                  cell({ text: "1,280,000円",     width: BOT_R_W[1], align: AlignmentType.RIGHT, size: 18 }),
                ]}),
                new TableRow({ children: [
                  cell({ text: "10%消費税",       width: BOT_R_W[0], align: AlignmentType.LEFT,  size: 16, color: MUTED }),
                  cell({ text: "128,000円",       width: BOT_R_W[1], align: AlignmentType.RIGHT, size: 18 }),
                ]}),
              ],
            }),
          ],
        }),
      ],
    }),
  ],
});

// ===== 備考 =====
const remarks = [
  "本見積は AI問い合わせ対応導入業務 一式（Phase A〜D / 6ヶ月）に対するご提示です。Phase E（7ヶ月目以降の継続運用）は別途お見積いたします。",
  "本契約は段階建付けです。Phase A（¥150,000 税抜）の完了をもって Phase B 以降に進むかをご判断いただき、Phase B 以降は Phase A の分析結果に基づき改めて正式見積書を発行いたします。Phase A 単独でご終了の場合、本見積の Phase B〜D は無効となります。",
  "Phase B 本開発の検収基準は、合意したFAQ範囲の回答妥当率80%以上、危険回答（保険判断・引受可否・補償可否の断定）0件、有人引き継ぎ導線の正常動作、主要シナリオ20件のテストケース通過、を契約前に明文化いたします。",
  "AI利用料（OpenAI / Anthropic 等の API 実費）は本見積に含まれず、実費に管理フィーを加算のうえ毎月請求書を添付します。利用量上限は事前にご相談のうえ設定します。",
  "オリジナルUI制作（+¥150,000 税抜）はご希望時のみの追加項目です。デフォルトはテンプレートUIで本見積金額に含まれます。",
  "サーバー・SaaS・電子契約・決済・送信等の外部サービス利用料は本見積に含まれず、貴社負担となります。",
  "AIモデル提供事業者側の仕様変更・利用可能プラン・審査・検証環境・API仕様により、実装内容・開発期間・費用は変動する場合があります。",
  "納品後の文言修正、FAQ追加、回答ルール変更、モデル切替等は、Phase C・D の月次対応範囲を超える場合は別途見積となります。",
  "守秘義務契約（NDA）の締結が必要な場合は、Phase A 着手前に締結いたします。",
  "本見積金額および表記は税抜・税込いずれの場合も特に断りのない限り日本円とし、消費税は別途申し受けます。",
  "詳細はご提案資料および別途仕様書にてご案内いたします。",
];

const remarksTbl = new Table({
  width: { size: 9026, type: WidthType.DXA },
  columnWidths: [9026],
  rows: [
    new TableRow({
      children: [
        new TableCell({
          borders: allBorders(tbSoft), width: { size: 9026, type: WidthType.DXA },
          margins: { top: 160, bottom: 160, left: 200, right: 200 },
          children: [
            p({ spacing: { after: 100 }, children: [t("備考", { size: 18, color: MUTED })] }),
            ...remarks.map((r) => p({
              numbering: { reference: "bullets", level: 0 },
              spacing: { after: 60 },
              children: [t(r, { size: 16 })],
            })),
          ],
        }),
      ],
    }),
  ],
});

// ===== Footer =====
const footer = new Footer({
  children: [
    p({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40 },
      children: [
        new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: MUTED }),
        new TextRun({ text: " / ", font: FONT, size: 16, color: MUTED }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: MUTED }),
      ],
    }),
  ],
});

// ===== Build doc =====
const doc = new Document({
  creator: "株式会社エキセントリック",
  title: "御見積書 — AI問い合わせ対応導入業務 一式",
  styles: { default: { document: { run: { font: FONT, size: 18 } } } },
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "・", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 320, hanging: 220 } } },
      }],
    }],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1100, right: 1200, bottom: 900, left: 1200 },
      },
    },
    footers: { default: footer },
    children: [
      title,
      topSection,
      greeting,
      subjectTbl,
      p({ spacing: { before: 80, after: 80 }, children: [t("")] }),
      summaryTbl,
      p({ spacing: { before: 120, after: 60 }, children: [t("")] }),
      itemTbl,
      p({ spacing: { before: 200, after: 60 }, children: [t("")] }),
      addendumTbl,
      bottomRow,
      p({ spacing: { before: 200, after: 0 }, children: [t("")] }),
      remarksTbl,
    ],
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("good_insurance_quotation_v1.docx", buf);
  console.log("Wrote: good_insurance_quotation_v1.docx");
});
