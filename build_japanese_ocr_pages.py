from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path

import fitz


@dataclass
class OcrPageRow:
    file_id: str
    file_name: str
    page_no: int
    ocr_method: str
    ocr_text: str


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


def normalize_text(value: str) -> str:
    return "\n".join(line.rstrip() for line in value.replace("\r\n", "\n").splitlines()).strip()


def load_text_layer_pages(workspace: Path) -> list[OcrPageRow]:
    rows: list[OcrPageRow] = []
    for file_id, file_name in TEXT_LAYER_FILE_IDS.items():
        pdf_path = workspace / "pdfs" / f"{file_id}.pdf"
        document = fitz.open(pdf_path)
        for page_index in range(document.page_count):
            page_text = normalize_text(document[page_index].get_text())
            rows.append(
                OcrPageRow(
                    file_id=file_id,
                    file_name=file_name,
                    page_no=page_index + 1,
                    ocr_method="embedded_text",
                    ocr_text=page_text,
                )
            )
    return rows


def load_image_fallback_pages(workspace: Path) -> list[OcrPageRow]:
    payload = json.loads((workspace / "japanese_ocr_rows.json").read_text())
    grouped: dict[str, list[dict]] = {}
    for row in payload:
        if row["file_id"] not in IMAGE_FALLBACK_FILE_IDS:
            continue
        grouped.setdefault(row["file_id"], []).append(row)

    rows: list[OcrPageRow] = []
    for file_id, items in grouped.items():
        items.sort(key=lambda item: (item["date"], item["row_no"]))
        lines = []
        for item in items:
            lines.append(
                "\t".join(
                    [
                        item["date"],
                        str(item["amount"]),
                        item["summary"],
                        item["other_party"],
                        str(item["row_no"]),
                    ]
                )
            )
        rows.append(
            OcrPageRow(
                file_id=file_id,
                file_name=items[0]["file_name"],
                page_no=1,
                ocr_method="normalized_rows",
                ocr_text="\n".join(lines),
            )
        )
    return rows


def main() -> None:
    workspace = Path(__file__).resolve().parent
    rows = sorted(
        load_text_layer_pages(workspace) + load_image_fallback_pages(workspace),
        key=lambda row: (row.file_name, row.page_no),
    )
    (workspace / "japanese_ocr_pages.json").write_text(
        json.dumps([asdict(row) for row in rows], ensure_ascii=False, indent=2)
    )


if __name__ == "__main__":
    main()
