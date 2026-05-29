from __future__ import annotations

import csv
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path

import fitz


ROW_NO_RE = re.compile(r"^\d+$")
FULL_DATE_RE = re.compile(r"^[RH]\s*\d{2}/\d{2}/\d{2}$")
YEAR_MONTH_RE = re.compile(r"^[RH]\s*\d{2}(?:/\d{2})?$")
POSTAL_RE = re.compile(r"^\d{3}-\d{4}$")
PHONE_RE = re.compile(r"^\d{2,4}-\d{2,4}-\d{3,4}$")
AMOUNT_RE = re.compile(r"^\d[\d,]*$")
AMOUNT_WITH_SEQ_RE = re.compile(r"^(?:\d{2})\s+(\d[\d,]*)$")
PHASE_WITH_SEQ_RE = re.compile(r"^(売却決定|受注|見積提示|ヒアリング・検討|登録見込|登録決定|敗戦|延期)\s+\d{2}\s+(\d[\d,]*)$")
PHASES = {
    "売却決定",
    "受注",
    "見積提示",
    "ヒアリング・検討",
    "登録見込",
    "登録決定",
    "敗戦",
    "延期",
}


@dataclass
class JokerVehicleSalesRecord:
    source_file: str
    page_no: int
    row_no: int
    report_date: str
    deal_date: str
    deal_no: str
    purchase_no: str
    u_n: str
    progress: str
    phase_original: str
    customer_name: str
    customer_name_short: str
    salesperson: str
    address: str
    postal_code: str
    phone_number: str
    store: str
    email: str
    model_year: str
    vehicle_name: str
    body_type: str
    displacement: str
    grade: str
    transmission: str
    inspection_date: str
    vehicle_price_tax_in: int
    vehicle_sales_total_tax_in: int
    vehicle_price_tax_ex: int
    raw_block: str


def clean_line(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def to_amount(value: str) -> int:
    return int(value.replace(",", ""))


def normalize_progress(phase: str) -> str:
    return "登録決定" if phase == "売却決定" else phase


def extract_report_date(text: str) -> str:
    match = re.search(r"(20\d{2})年(\d{2})月(\d{2})日", text)
    if not match:
        return ""
    return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"


def iter_record_blocks(page_text: str) -> list[tuple[int, list[str]]]:
    lines = [clean_line(line) for line in page_text.splitlines()]
    lines = [line for line in lines if line]

    if "商談名" not in lines:
        return []

    start = max(index for index, line in enumerate(lines) if line == "商談名") + 1
    body = lines[start:]
    blocks: list[tuple[int, list[str]]] = []
    index = 0

    while index < len(body):
        line = body[index]
        if line.startswith("＜商談一覧＞") or line == "合計":
            break
        next_line = body[index + 1] if index + 1 < len(body) else ""
        is_record_start = ROW_NO_RE.fullmatch(line) and FULL_DATE_RE.fullmatch(next_line)
        if not is_record_start:
            index += 1
            continue

        row_no = int(line)
        index += 1
        record_lines: list[str] = []

        while index < len(body):
            current = body[index]
            if current.startswith("＜商談一覧＞") or current == "合計":
                break
            next_current = body[index + 1] if index + 1 < len(body) else ""
            if ROW_NO_RE.fullmatch(current) and FULL_DATE_RE.fullmatch(next_current):
                break
            record_lines.append(current)
            index += 1

        if record_lines:
            blocks.append((row_no, record_lines))

    return blocks


def parse_spec_lines(lines: list[str]) -> dict[str, str | int]:
    if not lines:
        return {
            "model_year": "",
            "vehicle_name": "",
            "body_type": "",
            "displacement": "",
            "grade": "",
            "transmission": "",
            "inspection_date": "",
            "vehicle_price_tax_in": 0,
            "vehicle_sales_total_tax_in": 0,
        }

    amount_indexes = [
        i for i, line in enumerate(lines)
        if AMOUNT_RE.fullmatch(line) and to_amount(line) >= 100000
    ]
    if len(amount_indexes) < 2:
        raise ValueError(f"金額列を2つ検出できません: {lines}")

    amount1_index, amount2_index = amount_indexes[0], amount_indexes[1]
    detail_lines = lines[:amount1_index]
    inspection_date = ""

    if detail_lines and FULL_DATE_RE.fullmatch(detail_lines[-1]):
        inspection_date = detail_lines.pop()

    transmission = ""
    if detail_lines and re.search(r"(AT|CVT|MT|PDK)", detail_lines[-1]):
        transmission = detail_lines.pop()

    model_year = ""
    if detail_lines and YEAR_MONTH_RE.fullmatch(detail_lines[0]):
        model_year = detail_lines.pop(0)

    vehicle_name = detail_lines.pop(0) if detail_lines else ""
    body_type = ""
    displacement = ""
    grade_parts: list[str] = []

    if detail_lines:
        if not re.search(r"\d", detail_lines[0]) and len(detail_lines) >= 2:
            body_type = detail_lines.pop(0)
        if detail_lines and re.search(r"\d", detail_lines[0]):
            displacement = detail_lines.pop(0)
        grade_parts = detail_lines

    return {
        "model_year": model_year,
        "vehicle_name": vehicle_name,
        "body_type": body_type,
        "displacement": displacement,
        "grade": " ".join(grade_parts).strip(),
        "transmission": transmission,
        "inspection_date": inspection_date,
        "vehicle_price_tax_in": to_amount(lines[amount1_index]),
        "vehicle_sales_total_tax_in": to_amount(lines[amount2_index]),
        "tail_start": amount2_index + 1,
    }


def looks_like_store(line: str) -> bool:
    return (
        "㈱ﾌﾞﾘｯｼﾞ本社" in line
        or "J・L" in line
        or "小売" in line
        or "輸入車" in line
        or "国産車" in line
    )


def parse_tail_lines(lines: list[str]) -> dict[str, str | int]:
    phone = next((line for line in lines if PHONE_RE.fullmatch(line)), "")
    postal = next((line for line in lines if POSTAL_RE.fullmatch(line)), "")
    email = next((line for line in lines if "@" in line), "")
    store_lines = [line for line in lines if looks_like_store(line)]
    store = " / ".join(store_lines)

    phase = ""
    vehicle_price_tax_ex = 0
    phase_index = -1

    for index, line in enumerate(lines):
        if line in PHASES:
            phase = line
            phase_index = index
            break
        match = PHASE_WITH_SEQ_RE.fullmatch(line)
        if match:
            phase = match.group(1)
            vehicle_price_tax_ex = to_amount(match.group(2))
            phase_index = index
            break

    if not vehicle_price_tax_ex:
        for line in lines:
            seq_match = AMOUNT_WITH_SEQ_RE.fullmatch(line)
            if seq_match:
                vehicle_price_tax_ex = to_amount(seq_match.group(1))
                break
            if AMOUNT_RE.fullmatch(line) and line != phone and line != postal:
                # Guard against customer lines that happen to contain digits.
                if "," in line:
                    vehicle_price_tax_ex = to_amount(line)
                    break

    address = ""
    for line in lines:
        if line in PHASES or PHASE_WITH_SEQ_RE.fullmatch(line):
            break
        if PHONE_RE.fullmatch(line) or POSTAL_RE.fullmatch(line) or looks_like_store(line):
            continue
        if "@" in line or AMOUNT_WITH_SEQ_RE.fullmatch(line) or AMOUNT_RE.fullmatch(line):
            continue
        if re.search(r"[都道府県市区町村]", line):
            address = line
            break

    candidate_lines = [
        line
        for line in lines
        if line
        and line != address
        and line != phone
        and line != postal
        and line != email
        and not looks_like_store(line)
        and line not in PHASES
        and not PHASE_WITH_SEQ_RE.fullmatch(line)
        and not AMOUNT_WITH_SEQ_RE.fullmatch(line)
        and not AMOUNT_RE.fullmatch(line)
    ]

    customer_full = ""
    if phase_index >= 0 and phase_index + 1 < len(lines):
        customer_full = lines[phase_index + 1]
    elif candidate_lines:
        customer_full = candidate_lines[-1]

    customer_short = ""
    if phase_index > 0:
        for line in reversed(lines[:phase_index]):
            if (
                line != address
                and line != phone
                and line != postal
                and line != email
                and not looks_like_store(line)
                and not AMOUNT_WITH_SEQ_RE.fullmatch(line)
                and not AMOUNT_RE.fullmatch(line)
            ):
                customer_short = line
                break

    if not customer_short and candidate_lines:
        customer_short = candidate_lines[0]

    return {
        "phase_original": phase,
        "progress": normalize_progress(phase),
        "address": address,
        "postal_code": postal,
        "phone_number": phone,
        "store": store,
        "email": email,
        "vehicle_price_tax_ex": vehicle_price_tax_ex,
        "customer_name": customer_full or customer_short,
        "customer_name_short": customer_short or customer_full,
    }


def parse_record(
    source_file: str,
    report_date: str,
    page_no: int,
    row_no: int,
    lines: list[str],
) -> JokerVehicleSalesRecord:
    index = 0
    deal_date = lines[index] if index < len(lines) and FULL_DATE_RE.fullmatch(lines[index]) else ""
    if deal_date:
        index += 1

    u_n = lines[index] if index < len(lines) and lines[index] in {"U", "N"} else ""
    if u_n:
        index += 1

    deal_no = ""
    purchase_no = ""
    if index < len(lines) and lines[index].startswith("CS"):
        deal_no = lines[index]
        index += 1
    if index < len(lines) and lines[index].startswith("CH"):
        purchase_no = lines[index]
        index += 1

    spec = parse_spec_lines(lines[index:])
    tail = lines[index + int(spec["tail_start"]):]
    parsed_tail = parse_tail_lines(tail)

    return JokerVehicleSalesRecord(
        source_file=source_file,
        page_no=page_no,
        row_no=row_no,
        report_date=report_date,
        deal_date=deal_date,
        deal_no=deal_no,
        purchase_no=purchase_no,
        u_n=u_n,
        progress=str(parsed_tail["progress"]),
        phase_original=str(parsed_tail["phase_original"]),
        customer_name=str(parsed_tail["customer_name"]),
        customer_name_short=str(parsed_tail["customer_name_short"]),
        salesperson="",
        address=str(parsed_tail["address"]),
        postal_code=str(parsed_tail["postal_code"]),
        phone_number=str(parsed_tail["phone_number"]),
        store=str(parsed_tail["store"]),
        email=str(parsed_tail["email"]),
        model_year=str(spec["model_year"]),
        vehicle_name=str(spec["vehicle_name"]),
        body_type=str(spec["body_type"]),
        displacement=str(spec["displacement"]),
        grade=str(spec["grade"]),
        transmission=str(spec["transmission"]),
        inspection_date=str(spec["inspection_date"]),
        vehicle_price_tax_in=int(spec["vehicle_price_tax_in"]),
        vehicle_sales_total_tax_in=int(spec["vehicle_sales_total_tax_in"]),
        vehicle_price_tax_ex=int(parsed_tail["vehicle_price_tax_ex"]),
        raw_block="\n".join(lines),
    )


def parse_pdf(pdf_path: Path) -> list[JokerVehicleSalesRecord]:
    document = fitz.open(pdf_path)
    report_date = extract_report_date(document[0].get_text())
    records: list[JokerVehicleSalesRecord] = []

    for page_index in range(document.page_count):
        page_text = document[page_index].get_text()
        for row_no, lines in iter_record_blocks(page_text):
            records.append(
                parse_record(
                    source_file=pdf_path.name,
                    report_date=report_date,
                    page_no=page_index + 1,
                    row_no=row_no,
                    lines=lines,
                )
            )

    return records


def write_outputs(records: list[JokerVehicleSalesRecord], output_prefix: Path) -> None:
    json_path = output_prefix.with_suffix(".json")
    csv_path = output_prefix.with_suffix(".csv")

    payload = [asdict(record) for record in records]
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2))

    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(payload[0].keys()))
        writer.writeheader()
        writer.writerows(payload)


def main() -> None:
    workspace = Path(__file__).resolve().parent
    pdf_path = workspace / "joker_vehicle_sales_source.pdf"
    records = parse_pdf(pdf_path)
    write_outputs(records, workspace / "joker_vehicle_sales_parsed")

    summary = {
        "records": len(records),
        "phase_counts": {},
        "sample": asdict(records[0]) if records else {},
    }

    for record in records:
        summary["phase_counts"].setdefault(record.phase_original, 0)
        summary["phase_counts"][record.phase_original] += 1

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
