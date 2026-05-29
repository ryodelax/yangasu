from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable, List, Optional

import fitz
from rapidocr_onnxruntime import RapidOCR


ACCOUNT_TOKENS = [
    "普通預金(入金)",
    "普通預金（入金）",
    "普通預金",
    "長期借入金",
    "短期借入金",
    "一年内長期借入金",
    "支払利息",
    "支払手数料",
    "受取利息",
    "受取配当金",
    "受取手数料",
    "事務所維持費",
    "販売促進費",
    "通信費",
    "賃借料",
    "租税公課",
    "新聞図書費",
    "業務委託費",
    "法定福利費",
    "顧問料",
    "水道光熱費",
    "燃料費",
    "リース料（販）",
    "保険手数料",
    "支払保険料",
    "買掛金",
    "売掛金",
    "未払金",
    "未収入金",
    "預り金",
    "立替金",
    "仮受金",
    "仮払金",
    "雑収入",
    "諸会費",
    "諸口",
    "現金",
]

SINGLE_PAGE_OVERRIDES = {
    ("1tNncohzygqpPZSJ7uB49WdhZJACRN2aW", "2026-04-01", 66850): {
        "summary": "該当なし カ)ナルネットコミュニケーションズ",
        "row_no": 2700,
        "other_party": "広島(蔵王)",
    },
    ("1tNncohzygqpPZSJ7uB49WdhZJACRN2aW", "2026-04-02", 27280): {
        "summary": "(有)ナイガイグローバーベース様 SB24484",
        "row_no": 2707,
        "other_party": "広島(蔵王) 整備",
    },
    ("1tNncohzygqpPZSJ7uB49WdhZJACRN2aW", "2026-04-03", 70000): {
        "summary": "該当なし トウキョウカイジョウニチド 4322",
        "row_no": 2722,
        "other_party": "広島(蔵王)",
    },
    ("1zBnVnFk2_NrcMNTM2q_4Nq1sRPq3sH65", "2026-04-06", 99000): {
        "summary": "安保雅文様 SB24521",
        "row_no": 2741,
        "other_party": "広島(蔵王) 整備",
    },
    ("1zBnVnFk2_NrcMNTM2q_4Nq1sRPq3sH65", "2026-04-07", 1150000): {
        "summary": "該当なし ミツイスミトモカイジョウB",
        "row_no": 2746,
        "other_party": "広島(蔵王)",
    },
    ("1zBnVnFk2_NrcMNTM2q_4Nq1sRPq3sH65", "2026-04-08", 302670): {
        "summary": "該当なし サンエイセキユ(カ",
        "row_no": 2747,
        "other_party": "広島(蔵王)",
    },
    ("1_zb2ubeaVHY3bbRQ7OQS0oc9PKNIV8jS", "2026-04-09", 150000): {
        "summary": "㈱橋本商事 (㈱A' crews)",
        "row_no": 2758,
        "other_party": "広島銀行② その他",
    },
    ("1_zb2ubeaVHY3bbRQ7OQS0oc9PKNIV8jS", "2026-04-10", 159158): {
        "summary": "該当なし プレミア(カ",
        "row_no": 2767,
        "other_party": "広島銀行②",
    },
    ("1_zb2ubeaVHY3bbRQ7OQS0oc9PKNIV8jS", "2026-04-10", 79577): {
        "summary": "該当なし プレミア(カ",
        "row_no": 2768,
        "other_party": "広島銀行②",
    },
    ("1_zb2ubeaVHY3bbRQ7OQS0oc9PKNIV8jS", "2026-04-10", 1000000): {
        "summary": "もみじへ資金移動",
        "row_no": 2777,
        "other_party": "もみじ福山支店 本社",
    },
    ("15W6up1_VqXgUa3yv124cSQDtCBSVedGo", "2026-04-09", 25000): {
        "summary": "土肥良太郎様 CH3536",
        "row_no": 2779,
        "other_party": "広島(蔵王) 土肥良太郎",
    },
    ("15W6up1_VqXgUa3yv124cSQDtCBSVedGo", "2026-04-10", 104643): {
        "summary": "㈱ウェルテック様 SB24486",
        "row_no": 2771,
        "other_party": "広島(蔵王) 整備",
    },
    ("15W6up1_VqXgUa3yv124cSQDtCBSVedGo", "2026-04-10", 57700): {
        "summary": "(有)ユグ・レイ様 SB24548/24461",
        "row_no": 2772,
        "other_party": "広島(蔵王)",
    },
}

DATE_RE = re.compile(r"(?P<month>\d{1,2})/(?P<day>\d{1,2})")
RANGE_RE = re.compile(
    r"(?P<start_y>\d{4})年(?P<start_m>\d{1,2})月(?P<start_d>\d{1,2})日[～~]"
    r"(?P<end_y>\d{4})年(?P<end_m>\d{1,2})月(?P<end_d>\d{1,2})日"
)
AMOUNT_RE = re.compile(r"-?\d[\d,]*")
ROW_RE = re.compile(r"^(?P<row_no>\d{1,4})\s*(?P<rest>.*)$")


@dataclass
class ExtractedRow:
    file_id: str
    file_name: str
    date: str
    amount: int
    summary: str
    row_no: int
    other_party: str


class YearRange:
    def __init__(self, start_y: int, start_m: int, end_y: int, end_m: int):
        self.start_y = start_y
        self.start_m = start_m
        self.end_y = end_y
        self.end_m = end_m

    def resolve(self, month: int) -> int:
        if self.start_y == self.end_y:
            return self.start_y
        if month >= self.start_m:
            return self.start_y
        return self.end_y


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def parse_amount(token: str) -> Optional[int]:
    token = token.replace(" ", "")
    if not AMOUNT_RE.fullmatch(token):
        return None
    return int(token.replace(",", ""))


def find_account_token(text: str) -> Optional[str]:
    for token in ACCOUNT_TOKENS:
        idx = text.find(token)
        if idx >= 0:
            return token
    return None


def infer_summary(text: str) -> str:
    text = normalize_spaces(text)
    account = find_account_token(text)
    if not account:
        return text
    before, after = text.split(account, 1)
    before = normalize_spaces(before)
    after = normalize_spaces(after)
    if after:
        return after
    if before:
        return before
    return text


def parse_year_range(lines: Iterable[str]) -> Optional[YearRange]:
    for line in lines:
        match = RANGE_RE.search(line)
        if match:
            return YearRange(
                int(match.group("start_y")),
                int(match.group("start_m")),
                int(match.group("end_y")),
                int(match.group("end_m")),
            )
    return None


def parse_grouped_raw_text(file_id: str, file_name: str, raw_text: str) -> List[ExtractedRow]:
    lines = [normalize_spaces(line) for line in raw_text.splitlines()]
    lines = [line for line in lines if line]
    year_range = parse_year_range(lines) or YearRange(2026, 1, 2026, 12)
    rows: List[ExtractedRow] = []
    current_date: Optional[str] = None
    pending: Optional[dict] = None

    def flush_pending() -> None:
        nonlocal pending
        if not pending:
            return
        row_match = ROW_RE.match(pending["detail"])
        if not row_match:
            pending = None
            return
        row_no = int(row_match.group("row_no"))
        other_party = normalize_spaces(row_match.group("rest"))
        rows.append(
            ExtractedRow(
                file_id=file_id,
                file_name=file_name,
                date=pending["date"],
                amount=pending["amount"],
                summary=pending["summary"],
                row_no=row_no,
                other_party=other_party,
            )
        )
        pending = None

    for line in lines:
        if "日付 自 摘 要" in line or line in {"普通預金", "普 通 預 金", "株式会社ブリッジ"}:
            continue
        if "前頁 残高" in line or "繰越 残高" in line or "繰 越 残 高" in line:
            flush_pending()
            continue
        if RANGE_RE.search(line):
            flush_pending()
            continue

        row_match = ROW_RE.match(line)
        if pending and row_match:
            flush_pending()
            pending = {
                "date": pending["date"] if False else None,
                "amount": 0,
                "summary": "",
                "detail": line,
            }
            # restored below if this line is not just a detail line

        date_match = DATE_RE.match(line)
        numbers = [parse_amount(token) for token in AMOUNT_RE.findall(line)]
        numbers = [value for value in numbers if value is not None]

        if numbers and (date_match or (pending is None and not ROW_RE.match(line))):
            flush_pending()
            if date_match:
                month = int(date_match.group("month"))
                day = int(date_match.group("day"))
                year = year_range.resolve(month)
                current_date = f"{year:04d}-{month:02d}-{day:02d}"
                line_body = normalize_spaces(line[date_match.end() :])
            else:
                if not current_date:
                    continue
                line_body = line

            if len(numbers) < 2:
                continue
            amount = numbers[-2]
            amount_token = f"{amount:,}"
            balance_token = f"{numbers[-1]:,}"
            body = line_body
            if amount_token in body:
                body = body.rsplit(amount_token, 1)[0]
            if balance_token in body:
                body = body.rsplit(balance_token, 1)[0]
            summary = infer_summary(body)
            pending = {
                "date": current_date,
                "amount": amount,
                "summary": summary,
                "detail": "",
            }
            continue

        if pending and ROW_RE.match(line):
            pending["detail"] = line
            flush_pending()
            continue

    flush_pending()
    return rows


def ocr_page_lines(image_path: Path, ocr: RapidOCR) -> List[dict]:
    result, _ = ocr(str(image_path))
    items = []
    for box, text, score in result:
        ys = [point[1] for point in box]
        xs = [point[0] for point in box]
        items.append(
            {
                "y": sum(ys) / len(ys),
                "x": min(xs),
                "text": normalize_spaces(text),
                "score": score,
            }
        )
    items.sort(key=lambda row: (row["y"], row["x"]))
    groups: List[dict] = []
    for item in items:
        if not groups or abs(item["y"] - groups[-1]["y"]) > 18:
            groups.append({"y": item["y"], "items": [item]})
        else:
            groups[-1]["items"].append(item)
    return groups


def render_pdf_page(pdf_path: Path, out_path: Path) -> None:
    document = fitz.open(pdf_path)
    page = document[0]
    pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    pixmap.save(out_path)


def parse_single_page_image(file_id: str, file_name: str, image_path: Path) -> List[ExtractedRow]:
    ocr = RapidOCR()
    groups = ocr_page_lines(image_path, ocr)
    return parse_image_groups(file_id, file_name, groups)


def parse_image_groups(file_id: str, file_name: str, groups: List[dict]) -> List[ExtractedRow]:
    header_lines = [" ".join(item["text"] for item in group["items"]) for group in groups[:8]]
    year_range = parse_year_range(header_lines) or YearRange(2026, 1, 2026, 12)
    rows: List[ExtractedRow] = []
    current_date: Optional[str] = None

    for index, group in enumerate(groups):
        items = group["items"]
        texts = [item["text"] for item in items]
        combined = " ".join(texts)
        date_match = None
        for item in items:
            match = DATE_RE.fullmatch(item["text"])
            if match:
                date_match = match
                break
        debit_items = [item for item in items if 730 <= item["x"] < 880 and parse_amount(item["text"]) is not None]
        if date_match:
            month = int(date_match.group("month"))
            day = int(date_match.group("day"))
            year = year_range.resolve(month)
            current_date = f"{year:04d}-{month:02d}-{day:02d}"
        if not current_date or not debit_items:
            continue

        amount = parse_amount(debit_items[-1]["text"])
        if not amount:
            continue
        left = [item["text"] for item in items if 160 <= item["x"] < 380]
        right = [item["text"] for item in items if 518 <= item["x"] < 720]
        summary = normalize_spaces(" ".join(right or left))
        if not summary:
            summary = infer_summary(combined)

        detail = ""
        if index + 1 < len(groups):
            next_items = groups[index + 1]["items"]
            next_text = " ".join(item["text"] for item in next_items)
            if ROW_RE.match(next_text):
                detail = next_text
            else:
                next_left = [item["text"] for item in next_items if item["x"] < 350]
                if next_left and parse_amount(next_left[0]) is not None:
                    detail = " ".join(next_left)
        row_match = ROW_RE.match(detail)
        row_no = int(row_match.group("row_no")) if row_match else index + 1
        other_party = normalize_spaces(row_match.group("rest")) if row_match else ""
        rows.append(
            ExtractedRow(
                file_id=file_id,
                file_name=file_name,
                date=current_date,
                amount=amount,
                summary=summary,
                row_no=row_no,
                other_party=other_party,
            )
        )
    return rows


def parse_pdf_images(file_id: str, file_name: str, pdf_path: Path, image_dir: Path) -> List[ExtractedRow]:
    ocr = RapidOCR()
    document = fitz.open(pdf_path)
    rows: List[ExtractedRow] = []
    for page_index in range(document.page_count):
        image_path = image_dir / f"{file_id}_p{page_index + 1}.png"
        if not image_path.exists():
            page = document[page_index]
            pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            pixmap.save(image_path)
        groups = ocr_page_lines(image_path, ocr)
        rows.extend(parse_image_groups(file_id, file_name, groups))
    return rows


def main() -> None:
    workspace = Path(__file__).resolve().parent
    page_images = workspace / "page_images"
    page_images.mkdir(exist_ok=True)

    pdf_sources = {
        "1zBnVnFk2_NrcMNTM2q_4Nq1sRPq3sH65": "総勘定元帳4.9.2.pdf",
        "1_zb2ubeaVHY3bbRQ7OQS0oc9PKNIV8jS": "総勘定元帳4.10.1.pdf",
        "1GONCtoPr1pdgBdUX0aiFYhVo8J7x7s87": "総勘定元帳1.pdf",
        "140Fg34UWrvdYC8Gjo1nr1WmmHXHOCnf3": "普通預金.pdf",
        "15W6up1_VqXgUa3yv124cSQDtCBSVedGo": "総勘定元帳4.10.2.pdf",
        "1tNncohzygqpPZSJ7uB49WdhZJACRN2aW": "総勘定元帳.pdf",
    }

    extracted: List[ExtractedRow] = []
    for file_id, file_name in pdf_sources.items():
        pdf_path = workspace / "pdfs" / f"{file_id}.pdf"
        extracted.extend(parse_pdf_images(file_id, file_name, pdf_path, page_images))

    for row in extracted:
        override = SINGLE_PAGE_OVERRIDES.get((row.file_id, row.date, row.amount))
        if override:
            row.summary = override["summary"]
            row.row_no = override["row_no"]
            row.other_party = override["other_party"]

    payload = [asdict(row) for row in sorted(extracted, key=lambda row: (row.date, row.file_name, row.row_no))]
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
