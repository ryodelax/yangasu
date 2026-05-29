from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable

import fitz


TEXT_LAYER_FILE_IDS = {
    "140Fg34UWrvdYC8Gjo1nr1WmmHXHOCnf3": "普通預金.pdf",
}

IMAGE_FALLBACK_FILE_IDS = {
    "1zBnVnFk2_NrcMNTM2q_4Nq1sRPq3sH65": "総勘定元帳4.9.2.pdf",
    "1_zb2ubeaVHY3bbRQ7OQS0oc9PKNIV8jS": "総勘定元帳4.10.1.pdf",
    "1GONCtoPr1pdgBdUX0aiFYhVo8J7x7s87": "総勘定元帳1.pdf",
    "15W6up1_VqXgUa3yv124cSQDtCBSVedGo": "総勘定元帳4.10.2.pdf",
    "1tNncohzygqpPZSJ7uB49WdhZJACRN2aW": "総勘定元帳.pdf",
}

DATE_RE = re.compile(r"^(\d{2})/(\d{2})$")
RANGE_RE = re.compile(
    r"(\d{4})年(\d{2})月(\d{2})日～(\d{4})年(\d{2})月(\d{2})日"
)
NUMBER_RE = re.compile(r"-?[\d,]+")
KNOWN_ACCOUNTS = [
    "売掛金",
    "買掛金",
    "仮受金",
    "仮払金",
    "雑収入",
    "保険手数料",
    "長期借入金",
    "短期借入金",
    "受取利息",
    "受取配当金",
    "受取手数料",
    "未収入金",
    "立替金",
    "預り金",
    "前受金",
    "支払利息",
    "支払保険料",
    "諸口",
    "普通預金",
]


@dataclass
class OcrRow:
    import_target: str
    internal_transfer: str
    column_side: str
    file_id: str
    file_name: str
    page_no: int
    row_no: int
    date: str
    amount: int
    summary: str
    other_party: str
    account: str
    ocr_method: str
    raw_text: str
    extracted_at: str


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def dedupe_adjacent_lines(lines: list[str]) -> list[str]:
    deduped: list[str] = []
    for line in lines:
        normalized = normalize_spaces(line)
        if not normalized:
            continue
        if deduped and deduped[-1] == normalized:
            continue
        deduped.append(normalized)
    return deduped


def looks_like_meaningful_summary(value: str) -> bool:
    text = normalize_spaces(value)
    if not text:
        return False
    return bool(re.search(r"[A-Za-zＡ-Ｚａ-ｚぁ-んァ-ヶ一-龠㈱]", text))


def clean_account_lines_for_summary(lines: list[str]) -> list[str]:
    cleaned = dedupe_adjacent_lines(lines)
    cleaned = [line for line in cleaned if not DATE_RE.match(line)]
    while len(cleaned) > 1 and cleaned[-1] in KNOWN_ACCOUNTS:
        cleaned.pop()
    return cleaned


def build_summary(detail_lines: list[str], account_lines: list[str]) -> str:
    detail = normalize_spaces(" ".join(detail_lines))
    if looks_like_meaningful_summary(detail):
        return detail
    fallback_lines = clean_account_lines_for_summary(account_lines)
    return normalize_spaces(" ".join(fallback_lines))


def normalize_account_name(account: str) -> str:
    text = normalize_spaces(account)
    if not text:
        return ""
    matches = [name for name in KNOWN_ACCOUNTS if name in text]
    if matches:
        return matches[-1]
    return text


def parse_amount(value: str) -> int | None:
    text = value.replace(" ", "").replace(",", "")
    if not re.fullmatch(r"-?\d+", text):
        return None
    return int(text)


def is_internal_transfer(text: str) -> bool:
    return "資金移動" in text


def resolve_year(month: int, start_year: int, start_month: int, end_year: int) -> int:
    return start_year if month >= start_month else end_year


def classify_column_side(amount_x: float) -> str:
    if amount_x <= 430:
        return "debit"
    if amount_x < 500:
        return "credit"
    return ""


def parse_text_layer_rows(file_id: str, file_name: str, pdf_path: Path) -> list[OcrRow]:
    document = fitz.open(pdf_path)
    year_range = RANGE_RE.search(document[0].get_text())
    start_year = 2025
    start_month = 1
    end_year = 2025
    if year_range:
        start_year = int(year_range.group(1))
        start_month = int(year_range.group(2))
        end_year = int(year_range.group(4))

    extracted_at = datetime.now().isoformat(timespec="seconds")
    rows: list[OcrRow] = []
    current_date = ""

    for page_index in range(document.page_count):
        page = document[page_index]
        words = page.get_text("words")
        blocks = sorted(page.get_text("blocks"), key=lambda block: (round(block[1], 1), round(block[0], 1)))
        for block in blocks:
            x0, y0, _x1, _y1, text, *_rest = block
            if x0 > 120 or y0 < 120:
                continue
            raw_lines = [line.strip() for line in text.splitlines() if line.strip()]
            if not raw_lines or "繰越残高" in raw_lines[0]:
                continue
            if not re.fullmatch(r"\d+", raw_lines[-1]):
                continue

            row_no = int(raw_lines[-1])
            lines = raw_lines[:-1]
            if not lines:
                continue

            date_match = DATE_RE.match(lines[0])
            if date_match:
                month = int(date_match.group(1))
                day = int(date_match.group(2))
                year = resolve_year(month, start_year, start_month, end_year)
                current_date = f"{year:04d}-{month:02d}-{day:02d}"
                lines = lines[1:]

            if not current_date or len(lines) < 3:
                continue

            number_lines = [(index, parse_amount(line)) for index, line in enumerate(lines)]
            number_lines = [(index, value) for index, value in number_lines if value is not None]
            if len(number_lines) < 2:
                continue

            amount_index, amount = number_lines[0]
            balance_index, _balance = number_lines[-1]
            if amount_index == balance_index:
                continue

            amount_token = f"{amount:,}"
            amount_words = []
            for word in words:
                word_x0, word_y0, _word_x1, word_y1, word_text, *_word_rest = word
                if word_text != amount_token:
                    continue
                if word_x0 < 350 or word_x0 >= 500:
                    continue
                if word_y0 < y0 - 2 or word_y1 > _y1 + 2:
                    continue
                amount_words.append(word)
            if not amount_words:
                continue
            amount_word = sorted(amount_words, key=lambda item: item[0])[0]
            column_side = classify_column_side(amount_word[0])
            if column_side != "debit":
                continue

            account_lines = lines[:amount_index]
            account = normalize_account_name(" ".join(account_lines))
            detail_lines = [line for line in lines[amount_index + 1:balance_index] if line]
            other_party_lines = [line for line in lines[balance_index + 1:] if line]
            summary = build_summary(detail_lines, account_lines)
            other_party = normalize_spaces(" ".join(other_party_lines))
            raw_text = normalize_spaces(" / ".join(lines))
            joined = " ".join(part for part in [summary, other_party, raw_text] if part)

            rows.append(
                OcrRow(
                    import_target="N" if is_internal_transfer(joined) else "Y",
                    internal_transfer="Y" if is_internal_transfer(joined) else "",
                    column_side=column_side,
                    file_id=file_id,
                    file_name=file_name,
                    page_no=page_index + 1,
                    row_no=row_no,
                    date=current_date,
                    amount=amount,
                    summary=summary,
                    other_party=other_party,
                    account=account,
                    ocr_method="embedded_text",
                    raw_text=raw_text,
                    extracted_at=extracted_at,
                )
            )

    return rows


def load_image_fallback_rows(workspace: Path) -> list[OcrRow]:
    extracted_at = datetime.now().isoformat(timespec="seconds")
    payload = json.loads((workspace / "extracted_rows.json").read_text())
    rows: list[OcrRow] = []

    for item in payload:
        file_id = item["file_id"]
        if file_id not in IMAGE_FALLBACK_FILE_IDS:
            continue
        summary = normalize_spaces(item["summary"])
        other_party = normalize_spaces(item.get("other_party", ""))
        joined = " ".join(part for part in [summary, other_party] if part)
        rows.append(
            OcrRow(
                import_target="N" if is_internal_transfer(joined) else "Y",
                internal_transfer="Y" if is_internal_transfer(joined) else "",
                column_side="debit",
                file_id=file_id,
                file_name=item["file_name"],
                page_no=1,
                row_no=int(item["row_no"]),
                date=item["date"],
                amount=int(item["amount"]),
                summary=summary,
                other_party=other_party,
                account="",
                ocr_method="image_fallback",
                raw_text=normalize_spaces(f"{item['date']} {summary} {other_party}"),
                extracted_at=extracted_at,
            )
        )

    return rows


def build_rows(workspace: Path) -> list[OcrRow]:
    rows: list[OcrRow] = []
    for file_id, file_name in TEXT_LAYER_FILE_IDS.items():
        pdf_path = workspace / "pdfs" / f"{file_id}.pdf"
        rows.extend(parse_text_layer_rows(file_id, file_name, pdf_path))
    rows.extend(load_image_fallback_rows(workspace))
    return sorted(rows, key=lambda row: (row.date, row.file_name, row.page_no, row.row_no))


def to_tsv_lines(rows: Iterable[OcrRow]) -> list[str]:
    header = [
        "取込対象",
        "内部振替",
        "金額列",
        "OCR元ファイルID",
        "OCR元ファイル名",
        "ページ",
        "行番号",
        "日付",
        "金額",
        "摘要",
        "相手",
        "科目",
        "OCR方式",
        "OCR本文",
        "抽出日時",
    ]
    lines = ["\t".join(header)]
    for row in rows:
        values = [
            row.import_target,
            row.internal_transfer,
            row.column_side,
            row.file_id,
            row.file_name,
            str(row.page_no),
            str(row.row_no),
            row.date,
            str(row.amount),
            row.summary,
            row.other_party,
            row.account,
            row.ocr_method,
            row.raw_text,
            row.extracted_at,
        ]
        lines.append("\t".join(value.replace("\t", " ").replace("\n", " ") for value in values))
    return lines


def main() -> None:
    workspace = Path(__file__).resolve().parent
    rows = build_rows(workspace)
    (workspace / "japanese_ocr_rows.json").write_text(
        json.dumps([asdict(row) for row in rows], ensure_ascii=False, indent=2)
    )
    (workspace / "japanese_ocr_rows.tsv").write_text("\n".join(to_tsv_lines(rows)))
    print(len(rows))


if __name__ == "__main__":
    main()
