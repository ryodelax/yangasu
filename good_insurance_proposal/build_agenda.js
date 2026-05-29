// グッド保険サービス様 商談アジェンダ(事前送付用 A4 1枚)
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Footer, AlignmentType, LevelFormat, BorderStyle, WidthType,
  ShadingType, VerticalAlign,
} = require("docx");

const BLUE   = "2563EB";
const SKY    = "0EA5E9";
const INK    = "1E293B";
const MUTED  = "64748B";
const LINE   = "CBD5E1";
const LIGHT  = "F1F5F9";
const FONT   = "游ゴシック";

const p = (opts) => new Paragraph(opts);
const t = (text, opts = {}) => new TextRun({ text, font: FONT, ...opts });

const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const cellBorders = { top: border, bottom: border, left: border, right: border };

// ===== Header: date right / recipient left =====
const dateRow = p({
  alignment: AlignmentType.RIGHT,
  spacing: { after: 200 },
  children: [t("2026年5月  日", { size: 20, color: MUTED })],
});

const recipientCo = p({
  spacing: { after: 40 },
  children: [t("株式会社グッド保険サービス", { size: 24, bold: true })],
});
const recipientName = p({
  spacing: { after: 200 },
  children: [
    t("　専務取締役  ", { size: 22 }),
    t("伊藤  様", { size: 22, bold: true }),
  ],
});

// ===== Title =====
const title = p({
  alignment: AlignmentType.LEFT,
  spacing: { before: 100, after: 80 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: BLUE, space: 4 } },
  children: [
    t("ご商談アジェンダ", { size: 40, bold: true, color: BLUE }),
    t("　", { size: 28 }),
    t("MEETING AGENDA", { size: 16, color: MUTED, characterSpacing: 40 }),
  ],
});

// ===== Greeting =====
const greeting1 = p({
  spacing: { before: 240, after: 80 },
  children: [t("平素より大変お世話になっております。株式会社エキセントリックの長谷川でございます。", { size: 22 })],
});
const greeting2 = p({
  spacing: { after: 80 },
  children: [t("先日はお時間を頂戴し、誠にありがとうございました。", { size: 22 })],
});
const greeting3 = p({
  spacing: { after: 200 },
  children: [
    t("次回のご商談に向けて、当日ご議論させていただきたい論点を以下にまとめました。", { size: 22 }),
    t("事前にお目通しいただけますと、当日の議論がより深まるかと存じます。", { size: 22 }),
  ],
});

// ===== Section heading =====
function sectionHeading(text, sub = "") {
  return p({
    spacing: { before: 200, after: 120 },
    border: { left: { style: BorderStyle.SINGLE, size: 22, color: BLUE, space: 6 } },
    indent: { left: 100 },
    children: [
      t(text, { size: 24, bold: true, color: BLUE }),
      sub ? t("　 " + sub, { size: 14, color: MUTED, characterSpacing: 30 }) : t(""),
    ],
  });
}

// ===== Agenda items table =====
const agendaItems = [
  { no: "01", ttl: "前回ご相談内容の振り返り", sub: "HPチャットbot導入、業務効率化と売上向上の関係性" },
  { no: "02", ttl: "解決方針のご提案",          sub: "AIで吸収する範囲と人が対応すべき範囲の切り分け、保険業務特有のリスクへの対処" },
  { no: "03", ttl: "導入ステップとスケジュール", sub: "1週間の問い合わせ分析 → 本開発 → テスト運用 → 継続運用" },
  { no: "04", ttl: "将来的なDXロードマップ",     sub: "見積もり業務の省力化、ドローン部門への展開、既存システム(Nats／Alrit)との連携" },
  { no: "05", ttl: "次のアクションのすり合わせ", sub: "1週間分析の開始日とご協力範囲" },
];

const COL_W = [800, 3400, 4800]; // 9000
const agendaTbl = new Table({
  width: { size: 9000, type: WidthType.DXA },
  columnWidths: COL_W,
  rows: agendaItems.map((it) => new TableRow({
    children: [
      new TableCell({
        borders: cellBorders,
        width: { size: COL_W[0], type: WidthType.DXA },
        margins: { top: 140, bottom: 140, left: 160, right: 80 },
        verticalAlign: VerticalAlign.CENTER,
        shading: { fill: LIGHT, type: ShadingType.CLEAR, color: "auto" },
        children: [p({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: it.no, font: FONT, bold: true, size: 28, color: BLUE })],
        })],
      }),
      new TableCell({
        borders: cellBorders,
        width: { size: COL_W[1], type: WidthType.DXA },
        margins: { top: 140, bottom: 140, left: 200, right: 120 },
        verticalAlign: VerticalAlign.CENTER,
        children: [p({
          children: [new TextRun({ text: it.ttl, font: FONT, bold: true, size: 22, color: INK })],
        })],
      }),
      new TableCell({
        borders: cellBorders,
        width: { size: COL_W[2], type: WidthType.DXA },
        margins: { top: 140, bottom: 140, left: 160, right: 160 },
        verticalAlign: VerticalAlign.CENTER,
        children: [p({
          children: [new TextRun({ text: it.sub, font: FONT, size: 18, color: MUTED })],
        })],
      }),
    ],
  })),
});

// ===== Note box =====
const noteBox = new Table({
  width: { size: 9000, type: WidthType.DXA },
  columnWidths: [9000],
  rows: [
    new TableRow({
      children: [
        new TableCell({
          borders: cellBorders,
          width: { size: 9000, type: WidthType.DXA },
          margins: { top: 180, bottom: 180, left: 240, right: 240 },
          shading: { fill: "EFF6FF", type: ShadingType.CLEAR, color: "auto" },
          children: [
            p({ spacing: { after: 60 }, children: [t("◆ 当日の進行について", { size: 20, bold: true, color: BLUE })] }),
            p({ spacing: { after: 40 }, children: [t("　・ 想定時間  約90分", { size: 20 })] }),
            p({ spacing: { after: 40 }, children: [t("　・ ご同席  伊藤専務／〇〇課長／〇〇様(担当者)", { size: 20 })] }),
            p({ spacing: { after: 0  }, children: [t("　・ 提案資料・見積書は当日お持ちいたします", { size: 20 })] }),
          ],
        }),
      ],
    }),
  ],
});

// ===== Closing =====
const closing1 = p({
  spacing: { before: 280, after: 80 },
  children: [t("事前にご質問やご相談事項がございましたら、ご返信いただけますと幸いです。", { size: 22 })],
});
const closing2 = p({
  spacing: { after: 240 },
  children: [t("当日お会いできることを楽しみにしております。何卒よろしくお願い申し上げます。", { size: 22 })],
});

// ===== Signature =====
const sigBox = new Table({
  width: { size: 4400, type: WidthType.DXA },
  columnWidths: [4400],
  alignment: AlignmentType.RIGHT,
  rows: [
    new TableRow({
      children: [
        new TableCell({
          borders: cellBorders,
          width: { size: 4400, type: WidthType.DXA },
          margins: { top: 140, bottom: 140, left: 200, right: 200 },
          shading: { fill: LIGHT, type: ShadingType.CLEAR, color: "auto" },
          children: [
            p({ spacing: { after: 60 }, children: [t("株式会社エキセントリック", { size: 22, bold: true, color: BLUE })] }),
            p({ spacing: { after: 60 }, children: [t("代表取締役  長谷川", { size: 20 })] }),
            p({ spacing: { after: 0  }, children: [t("https://ec-centric.com/", { size: 16, color: MUTED })] }),
          ],
        }),
      ],
    }),
  ],
});

// ===== Build =====
const doc = new Document({
  creator: "株式会社エキセントリック",
  title: "ご商談アジェンダ",
  styles: { default: { document: { run: { font: FONT, size: 22 } } } },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1100, right: 1200, bottom: 1100, left: 1200 },
      },
    },
    children: [
      dateRow,
      recipientCo,
      recipientName,
      title,
      greeting1,
      greeting2,
      greeting3,
      sectionHeading("当日の議論論点", "DISCUSSION POINTS"),
      agendaTbl,
      p({ spacing: { before: 200, after: 0 }, children: [t("")] }),
      noteBox,
      closing1,
      closing2,
      sigBox,
    ],
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("good_insurance_agenda_v1.docx", buf);
  console.log("Wrote: good_insurance_agenda_v1.docx");
});
