import csv
import io
import re
import sys
from pathlib import Path

import fitz
import Foundation
import Quartz
import Vision
from PIL import Image


def png_bytes_to_cgimage(png_bytes):
    data = Foundation.NSData.dataWithBytes_length_(png_bytes, len(png_bytes))
    source = Quartz.CGImageSourceCreateWithData(data, None)
    if source is None:
        raise RuntimeError("failed to create image source")
    image = Quartz.CGImageSourceCreateImageAtIndex(source, 0, None)
    if image is None:
        raise RuntimeError("failed to decode PNG to CGImage")
    return image


def ocr_image(pil_image):
    import io

    buf = io.BytesIO()
    pil_image.save(buf, format="PNG")
    image = png_bytes_to_cgimage(buf.getvalue())

    request = Vision.VNRecognizeTextRequest.alloc().init()
    request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
    request.setUsesLanguageCorrection_(False)
    request.setRecognitionLanguages_(["ja-JP", "en-US"])

    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(image, None)
    ok, error = handler.performRequests_error_([request], None)
    if not ok:
        raise RuntimeError(str(error))

    results = request.results() or []
    items = []
    for obs in results:
        candidates = obs.topCandidates_(1)
        if not candidates:
            continue
        box = obs.boundingBox()
        items.append(
            {
                "text": str(candidates[0].string()),
                "x": box.origin.x,
                "y": box.origin.y,
            }
        )
    items.sort(key=lambda item: (-item["y"], item["x"]))

    rows = []
    threshold = 0.04
    for item in items:
        if not rows or abs(rows[-1]["y"] - item["y"]) > threshold:
            rows.append({"y": item["y"], "items": [item]})
        else:
            rows[-1]["items"].append(item)

    lines = []
    for row in rows:
        row["items"].sort(key=lambda item: item["x"])
        lines.append(" ".join(item["text"] for item in row["items"]))

    text = "\n".join(lines)
    text = text.replace("\u3000", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n+", "\n", text)
    return text.strip()


def detect_line_centers(values):
    groups = []
    current = []
    for value in values:
        if not current or value == current[-1] + 1:
            current.append(value)
        else:
            groups.append(current)
            current = [value]
    if current:
        groups.append(current)
    return [round(sum(group) / len(group)) for group in groups]


def detect_table_lines(image):
    gray = image.convert("L")
    w, h = gray.size
    vertical = []
    for x in range(w):
        dark = 0
        for y in range(h):
            if gray.getpixel((x, y)) < 100:
                dark += 1
        if dark > h * 0.6:
            vertical.append(x)

    horizontal = []
    for y in range(h):
        dark = 0
        for x in range(w):
            if gray.getpixel((x, y)) < 100:
                dark += 1
        if dark > w * 0.6:
            horizontal.append(y)

    return detect_line_centers(vertical), detect_line_centers(horizontal)


def render_page(page, scale=3.0):
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    return Image.open(io.BytesIO(pix.tobytes("png")))


def crop(image, left, top, right, bottom, pad=6):
    left = max(0, left + pad)
    top = max(0, top + pad)
    right = min(image.size[0], right - pad)
    bottom = min(image.size[1], bottom - pad)
    return image.crop((left, top, right, bottom))


def digits_only_amount(text):
    m = re.search(r"\d[\d,]*", text)
    return m.group(0) if m else ""


def extract_date(text, year_hint=None):
    m = re.search(r"(\d{2})/(\d{2})", text)
    if not m:
        return ""
    mm, dd = m.groups()
    if year_hint:
        return f"{year_hint}/{mm}/{dd}"
    return f"{mm}/{dd}"


def infer_year(page_text):
    m = re.search(r"(20\d{2})年", page_text)
    return m.group(1) if m else ""


def page_raw_text(image):
    return ocr_image(image.crop((0, 0, image.size[0], min(image.size[1], 340))))


def extract_rows(pdf_path):
    rows = []
    doc = fitz.open(pdf_path)
    for page_index, page in enumerate(doc, start=1):
        image = render_page(page)
        xs, ys = detect_table_lines(image)
        if len(xs) < 7 or len(ys) < 5:
            continue

        year_hint = infer_year(page_raw_text(image))
        last_date = ""
        # Skip header top/bottom and carryover row.
        row_ranges = list(zip(ys[2:-1], ys[3:]))
        blank_streak = 0
        for top, bottom in row_ranges:
            date_text = ocr_image(crop(image, xs[0], top, xs[1], bottom))
            account_text = ocr_image(crop(image, xs[2], top, xs[3], bottom))
            summary_text = ocr_image(crop(image, xs[3], top, xs[4], bottom))
            debit_text = ocr_image(crop(image, xs[4], top, xs[5], bottom))
            credit_text = ocr_image(crop(image, xs[5], top, xs[6], bottom))

            date_value = extract_date(date_text, year_hint)
            debit_value = digits_only_amount(debit_text)
            credit_value = digits_only_amount(credit_text)
            summary_value = summary_text.replace("\n", " ").strip()
            account_value = account_text.replace("\n", " ").strip()

            if not any([date_value, summary_value, account_value, debit_value, credit_value]):
                blank_streak += 1
                if blank_streak >= 3:
                    break
                continue
            blank_streak = 0
            if date_value:
                last_date = date_value
            else:
                date_value = last_date

            rows.append(
                {
                    "source_file": Path(pdf_path).name,
                    "page": page_index,
                    "date": date_value,
                    "counter_account": account_value,
                    "counter_summary": summary_value,
                    "debit_amount": debit_value,
                    "credit_amount": credit_value,
                }
            )
    return rows


def main():
    if len(sys.argv) < 2:
        print("usage: python3 extract_ledger_pdf.py <pdf1> [pdf2 ...]", file=sys.stderr)
        raise SystemExit(2)

    writer = csv.DictWriter(
        sys.stdout,
        fieldnames=[
            "source_file",
            "page",
            "date",
            "counter_account",
            "counter_summary",
            "debit_amount",
            "credit_amount",
        ],
    )
    writer.writeheader()
    for pdf_path in sys.argv[1:]:
        for row in extract_rows(pdf_path):
            writer.writerow(row)


if __name__ == "__main__":
    main()
