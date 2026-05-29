import csv
import json
import re
import shutil
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

import requests


def date_from_str(value):
    y, m, d = [int(x) for x in str(value).split("/")]
    return datetime(y, m, d)


MAIN_SPREADSHEET_ID = "1wX6LR1ssqThgPAIHRyUNeuvROsnXqDMcwFbMCj1PB8M"
SOURCE_SPREADSHEET_ID = "1QNctVAnkattCX9dyT9DBmaPXWF9-nsfmZwEtEp4t1R8"
PAYMENT_SPREADSHEET_ID = "12Z7hFDO9f8JMTdVYqNCx_1QbgjXmoAqWYJDiUkakuHE"
CF_SPREADSHEET_ID = "1KrtufPs4-1ZsEGPp9j9PCpYpg0knXGW5jMqospmI7UU"

CLASP_RC = Path.home() / ".clasprc.json"
BANK_ROOT = Path(
    "/Users/hasegawaryou11/Library/CloudStorage/GoogleDrive-r.hasegawa@ec-centric.com/"
    ".shortcut-targets-by-id/1YPsijuYb7uu4_Xu-XXtZ9touETZ41r-z/経理関係各種ファイル保存/02_発展会計csv"
)

SOURCE_SERVICE_SHEETS = ["顧客対応状況（車検）", "顧客対応状況（12点）"]
SOURCE_VEHICLE_SHEET = "顧客対応状況（車両販売）"

MATCH_STATUS_AUTO = "自動消込"
MATCH_STATUS_REVIEW = "要確認"
MATCH_STATUS_UNMATCHED = "未照合"
MATCH_STATUS_CARD = "カード入金照合"
MATCH_STATUS_MANUAL = "手動消込"

CONQUEST_GROSS_VENDOR = "株式会社コンクエスト　ジャガーランドローバー広島"
CONQUEST_SUM_VENDOR = "株式会社　コンクエスト　ｼﾞｬｶﾞｰﾗﾝﾄﾞﾛｰﾊﾞｰ営業部門"
CONQUEST_JLR_VENDOR = "株式会社コンクエスト"

BOARD_WORK_TYPES = ["板金", "鈑金", "板金塗装", "鈑金・塗装", "保険請求"]
INSURANCE_HINTS = ["保険", "損保", "共済", "あいおい", "三井住友海上", "東京海上", "損保ジャパン", "ソンポ", "JA共済"]
LOAN_COMPANY_HINTS = ["オリコ", "オリエント", "プレミア", "ジャックス", "アプラス", "セディナ"]
MICRO_DIFF_MAX = 5000

CF_SHEET_NAMES = {
    "income_17": "入金明細【17期】",
    "expense_17": "出金明細【17期】",
    "income_18": "入金明細【18期】",
    "expense_18": "出金明細【18期】",
}

CF_TERMS = [
    ("17", date_from_str("2025/06/01"), date_from_str("2026/05/31"), CF_SHEET_NAMES["income_17"], CF_SHEET_NAMES["expense_17"]),
    ("18", date_from_str("2026/06/01"), date_from_str("2027/05/31"), CF_SHEET_NAMES["income_18"], CF_SHEET_NAMES["expense_18"]),
]

CF_SLOT_MAP = {
    "expense": {
        "金融機関関連": [("E", "F"), ("G", "H"), ("I", "J"), ("K", "L")],
        "買掛関連": [("N", "O"), ("P", "Q"), ("R", "S"), ("T", "U"), ("V", "W"), ("X", "Y"), ("Z", "AA")],
        "経費関連": [("AE", "AF"), ("AG", "AH"), ("AI", "AJ"), ("AK", "AL"), ("AM", "AN"), ("AO", "AP"), ("AQ", "AR"), ("AS", "AT")],
    },
    "income": {
        "金融機関関連": [("E", "F"), ("G", "H"), ("I", "J"), ("K", "L")],
        "保険関連": [("N", "O"), ("P", "Q"), ("R", "S")],
        "お客様関連": [("U", "V"), ("W", "X"), ("Y", "Z"), ("AA", "AB"), ("AC", "AD"), ("AE", "AF"), ("AG", "AH"),
                    ("AI", "AJ"), ("AK", "AL"), ("AM", "AN"), ("AO", "AP"), ("AQ", "AR"), ("AS", "AT"),
                    ("AU", "AV"), ("AW", "AX")],
    },
}

MAIN_SHEET_IDS = {
    "ホーム": 700000200,
    "銀行取込一覧": 1178225085,
    "銀行一覧": 700000308,
    "案件一覧": 700000309,
    "コンクエスト管理": 1923572310,
    "保険立替管理": 2099245968,
    "銀行文字補正学習": 1844421179,
    "振込入金リスト一覧": 143761740,
    "銀行データチェック用": 2024034021,
    "売掛入金見込み管理": 871234567,
    "取込履歴": 362582959,
    "銀行要確認メモ": 700000305,
    "銀行入金一覧": 158584587,
    "銀行出金一覧": 1249021062,
}
def load_access_token():
    token = json.loads(CLASP_RC.read_text())["tokens"]["default"]
    resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": token["client_id"],
            "client_secret": token["client_secret"],
            "refresh_token": token["refresh_token"],
            "grant_type": "refresh_token",
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def api_request(method, url, access_token, **kwargs):
    headers = kwargs.pop("headers", {})
    headers["Authorization"] = f"Bearer {access_token}"
    resp = requests.request(method, url, headers=headers, timeout=120, **kwargs)
    resp.raise_for_status()
    if resp.text:
        return resp.json()
    return {}


def values_batch_get(access_token, spreadsheet_id, ranges, value_render_option="UNFORMATTED_VALUE"):
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values:batchGet"
    return api_request("GET", url, access_token, params={"ranges": ranges, "valueRenderOption": value_render_option})


def values_update(access_token, spreadsheet_id, range_a1, values):
    quoted = requests.utils.quote(range_a1, safe="!:'")
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{quoted}"
    return api_request(
        "PUT",
        url,
        access_token,
        params={"valueInputOption": "USER_ENTERED"},
        json={"values": values},
    )


def values_clear(access_token, spreadsheet_id, range_a1):
    quoted = requests.utils.quote(range_a1, safe="!:'")
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{quoted}:clear"
    return api_request("POST", url, access_token, json={})


def values_batch_update(access_token, spreadsheet_id, data):
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values:batchUpdate"
    return api_request(
        "POST",
        url,
        access_token,
        json={"valueInputOption": "USER_ENTERED", "data": data},
    )


def sheets_batch_update(access_token, spreadsheet_id, requests_body):
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}:batchUpdate"
    return api_request("POST", url, access_token, json={"requests": requests_body})


def safe_string(value):
    return "" if value is None else str(value).strip()


def to_number(value):
    if value is None or value == "":
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    text = safe_string(value).replace(",", "")
    try:
        return int(round(float(text)))
    except ValueError:
        return 0


def is_truthy(value):
    text = safe_string(value).upper()
    return text in {"TRUE", "1", "YES", "Y", "有効"}


def parse_date(value):
    if value in ("", None):
        return None
    if isinstance(value, (int, float)):
        base = datetime(1899, 12, 30)
        return base + timedelta(days=float(value))
    if isinstance(value, datetime):
        return value
    text = safe_string(value)
    m = re.match(r"^R\s*(\d{1,2})[/-](\d{1,2})[/-](\d{1,2})$", text, re.I)
    if m:
        return datetime(2018 + int(m.group(1)), int(m.group(2)), int(m.group(3)))
    for fmt in ("%Y/%m/%d", "%Y-%m-%d", "%Y.%m.%d"):
        try:
            return datetime.strptime(text[:10], fmt)
        except ValueError:
            continue
    return None


def date_key(value):
    dt = parse_date(value)
    return dt.strftime("%Y/%m/%d") if dt else ""


def deposit_month(value):
    dt = parse_date(value)
    return dt.strftime("%Y/%m") if dt else ""


def normalize_text(value):
    text = safe_string(value)
    if not text:
        return ""
    text = text.upper()
    for target in ["該当なし", "HB", "EBフリコミ"]:
        text = text.replace(target, "")
    text = re.sub(r"振込\d+", "", text)
    text = re.sub(r"株式会社|有限会社|合同会社|\(株\)|㈱|\(有\)|（株）|（有）", "", text)
    text = re.sub(r"代表取締役社長|代表取締役|理事長|院長|社長|様|御中", "", text)
    text = re.sub(r"[ 　\t\r\n\-‐‑‒–—―ーｰ・･,，、.．'`\"/\\()（）\[\]【】]", "", text)
    return text


def normalize_compare_name(value):
    text = normalize_text(value)
    text = re.sub(r"^(広|笠|も|中銀|CB)", "", text)
    text = re.sub(r"(該当なし|振込\d*|振込|入金|売内\d+|対象外|本社|支店|その他|整備|車両|キックバック|ｷｯｸﾊﾞｯｸ)", "", text)
    text = re.sub(r"(\d+月分|月会費|支払手数料|手数料|ｺﾋﾟｰ機|コピー機|コピ機|会員費|会費)", "", text)
    text = re.sub(r"[\/.,]", "", text)
    return text


def strong_name_match(left, right):
    return bool(left and right and (left == right or (len(left) >= 5 and len(right) >= 5 and (left in right or right in left))))


def loose_name_match(left, right):
    if not left or not right:
        return False
    shorter, longer = (left, right) if len(left) <= len(right) else (right, left)
    return len(shorter) >= 4 and shorter in longer


def extract_codes(text):
    normalized = safe_string(text).upper()
    matches = re.findall(r"(SB|CH|RA|PC)\s*0*(\d{3,8})", normalized)
    return list(dict.fromkeys([prefix + digits.zfill(8) for prefix, digits in matches]))


def calc_date_diff_days(left, right):
    ld = parse_date(left)
    rd = parse_date(right)
    if not ld or not rd:
        return None
    return abs((ld.date() - rd.date()).days)


def normalize_header(text):
    s = safe_string(text)
    s = s.replace("No.", "№").replace("No", "№").replace("NO", "№")
    s = re.sub(r"[ 　\t\r\n]", "", s)
    return s


def read_csv_rows(path):
    for encoding in ("cp932", "utf-8-sig", "utf-8"):
        try:
            with open(path, "r", encoding=encoding, errors="replace", newline="") as f:
                return list(csv.reader(f))
        except UnicodeDecodeError:
            continue
    with open(path, "r", encoding="cp932", errors="replace", newline="") as f:
        return list(csv.reader(f))


def get_range_map(value_ranges):
    return {item["range"].split("!")[0]: item.get("values", []) for item in value_ranges}


def ensure_row_width(row, width):
    row = list(row)
    if len(row) < width:
        row.extend([""] * (width - len(row)))
    return row[:width]


def get_header_map(header_row):
    return {safe_string(h): idx for idx, h in enumerate(header_row) if safe_string(h)}


def get_by_aliases(row, idx_map, aliases):
    for alias in aliases:
        idx = idx_map.get(alias)
        if idx is not None and idx < len(row):
            return row[idx]
    return ""


def build_sales_target_row(width, header_map, payload):
    row = [""] * width
    def setv(header, value):
        idx = header_map.get(header)
        if idx is not None:
            row[idx] = value

    setv("業務№", payload.get("bizNo", ""))
    setv("日付", payload.get("date", ""))
    setv("顧客名", payload.get("customerName", ""))
    setv("売上総計", payload.get("total", ""))
    setv("顧客№", payload.get("customerNo", ""))
    setv("ステータス", payload.get("status", ""))
    setv("入金方法", payload.get("method", ""))
    setv("作業大区分名", payload.get("workType", ""))
    setv("整備店舗", payload.get("serviceShop", ""))
    setv("入金予定日", payload.get("dueDate", ""))
    setv("請求先名", payload.get("billTo", ""))
    setv("粗利益", payload.get("grossProfit", ""))
    setv("保護フラグ", payload.get("protected", ""))
    setv("元シート", payload.get("sourceSheet", ""))
    setv("元状況", payload.get("sourceStatus", ""))
    setv("業務ステータス", payload.get("sourceStatus", ""))
    return row


def service_status_ok(status):
    return safe_string(status) in {"売上決定", "見込"}


def vehicle_status_ok(status):
    return safe_string(status) in {"登録決定", "受注"}


def resolve_due_date(*values):
    for value in values:
        dt = parse_date(value)
        if dt:
            return dt.strftime("%Y/%m/%d")
    return ""


def resolve_special_case(bill_to, total_amount, gross_profit, service_shop, customer_name):
    normalized_bill_to = normalize_text(bill_to)
    if normalized_bill_to == normalize_text(CONQUEST_GROSS_VENDOR):
        reconcile_amount = round(gross_profit * 1.1) if gross_profit > 0 else total_amount
        return "コンクエスト粗利税込請求", reconcile_amount, "粗利益 × 1.1 を照合基準額に使用"
    if normalized_bill_to == normalize_text(CONQUEST_SUM_VENDOR):
        return "コンクエスト営業部門集計", total_amount, "計算は行わず、金額を集計のみ"
    if normalized_bill_to == normalize_text(CONQUEST_JLR_VENDOR):
        return "コンクエストJ&LR整備", total_amount, "株式会社コンクエスト向け整備案件として集計"
    if "MASERATI" in normalize_text(service_shop) or "マセラティ" in normalize_text(service_shop) or "MASERATI" in normalize_text(bill_to):
        return "マセラティ系", total_amount, "マセラティ系案件として特殊管理"
    if "コンクエスト" in normalize_text(bill_to):
        return "コンクエスト個別", total_amount, f"コンクエスト＋{customer_name or bill_to}"
    return "", total_amount, ""


def build_sales_rows(source_ranges, existing_sales_rows):
    sales_values = source_ranges[SOURCE_SERVICE_SHEETS[0]], source_ranges[SOURCE_SERVICE_SHEETS[1]], source_ranges[SOURCE_VEHICLE_SHEET]
    existing_header = existing_sales_rows[0]
    width = len(existing_header)
    header_map = get_header_map(existing_header)

    carry_headers = ["顧客№", "ステータス", "入金方法", "入金累計", "未入金額", "入金状況", "アラート", "確認メモ", "保護フラグ"]
    existing_by_biz = {}
    protected_only = []
    for raw_row in existing_sales_rows[1:]:
        row = ensure_row_width(raw_row, width)
        biz_no = safe_string(row[header_map.get("業務№", -1)]) if header_map.get("業務№") is not None else ""
        protected = is_truthy(row[header_map.get("保護フラグ", -1)]) if header_map.get("保護フラグ") is not None else False
        if biz_no:
            existing_by_biz[biz_no] = row
        elif protected:
            protected_only.append(row)

    generated = []

    for sheet_name in SOURCE_SERVICE_SHEETS:
        values = source_ranges[sheet_name]
        if not values:
            continue
        headers = [safe_string(h) for h in values[0]]
        idx = {h: i for i, h in enumerate(headers) if h}
        for raw in values[1:]:
            biz_no = safe_string(get_by_aliases(raw, idx, ["整備ナンバー"]))
            customer_name = safe_string(get_by_aliases(raw, idx, ["顧客名"]))
            amount = to_number(get_by_aliases(raw, idx, ["売上総計"]))
            source_status = safe_string(get_by_aliases(raw, idx, ["状況"]))
            if not service_status_ok(source_status):
                continue
            if not (biz_no or customer_name or amount):
                continue
            row = build_sales_target_row(width, header_map, {
                "bizNo": biz_no,
                "date": date_key(get_by_aliases(raw, idx, ["日付"])),
                "customerName": customer_name,
                "total": amount,
                "grossProfit": to_number(get_by_aliases(raw, idx, ["粗利益"])),
                "workType": safe_string(get_by_aliases(raw, idx, ["作業大区分"])),
                "serviceShop": safe_string(get_by_aliases(raw, idx, ["整備店舗"])),
                "billTo": safe_string(get_by_aliases(raw, idx, ["請求先名"])),
                "dueDate": resolve_due_date(
                    get_by_aliases(raw, idx, ["入金予定日"]),
                    get_by_aliases(raw, idx, ["納車予定日"]),
                    get_by_aliases(raw, idx, ["納車日"]),
                    get_by_aliases(raw, idx, ["日付"]),
                ),
                "sourceStatus": source_status,
                "sourceSheet": sheet_name,
            })
            generated.append(row)

    values = source_ranges[SOURCE_VEHICLE_SHEET]
    if values:
        headers = [safe_string(h) for h in values[0]]
        idx = {h: i for i, h in enumerate(headers) if h}
        status_idx = idx.get("進捗", 0)
        for raw in values[1:]:
            source_status = safe_string(raw[status_idx]) if status_idx < len(raw) else ""
            if not vehicle_status_ok(source_status):
                continue
            customer_name = safe_string(get_by_aliases(raw, idx, ["顧客名"]))
            listed_amount = to_number(get_by_aliases(raw, idx, ["販売金額（税込）", "販売金額"]))
            fixed_amount = to_number(get_by_aliases(raw, idx, ["確定売上（税込）", "確定売上"]))
            amount = fixed_amount or listed_amount
            if not (customer_name or amount):
                continue
            biz_no = safe_string(get_by_aliases(raw, idx, ["商談No", "案件No", "業務№", "業務No"]))
            bill_to = safe_string(get_by_aliases(raw, idx, ["請求先名"])) or customer_name
            row = build_sales_target_row(width, header_map, {
                "bizNo": biz_no,
                "date": date_key(get_by_aliases(raw, idx, ["登録決定日", "受注日", "案件発生日", "商談日"])),
                "customerName": customer_name,
                "total": amount,
                "grossProfit": to_number(get_by_aliases(raw, idx, ["確定利益（税抜）", "想定粗利", "粗利益"])),
                "workType": "車販",
                "serviceShop": safe_string(get_by_aliases(raw, idx, ["ブランド"])) or "車販",
                "billTo": bill_to,
                "dueDate": resolve_due_date(
                    get_by_aliases(raw, idx, ["入金予定日"]),
                    get_by_aliases(raw, idx, ["登録予定日"]),
                    get_by_aliases(raw, idx, ["登録決定日"]),
                    get_by_aliases(raw, idx, ["受注日"]),
                ),
                "sourceStatus": source_status,
                "sourceSheet": SOURCE_VEHICLE_SHEET,
            })
            generated.append(row)

    merged = []
    seen_biz = set()
    for row in generated:
        biz_no = safe_string(row[header_map.get("業務№", -1)]) if header_map.get("業務№") is not None else ""
        existing = existing_by_biz.get(biz_no) if biz_no else None
        if existing:
            existing = ensure_row_width(existing, width)
            for carry_header in carry_headers:
                idx = header_map.get(carry_header)
                if idx is not None:
                    row[idx] = existing[idx]
        bill_to = safe_string(row[header_map.get("請求先名", -1)])
        total_amount = to_number(row[header_map.get("売上総計", -1)])
        gross_profit = to_number(row[header_map.get("粗利益", -1)])
        service_shop = safe_string(row[header_map.get("整備店舗", -1)])
        customer_name = safe_string(row[header_map.get("顧客名", -1)])
        special_type, reconcile_amount, special_memo = resolve_special_case(bill_to, total_amount, gross_profit, service_shop, customer_name)
        for name, value in [("特殊案件区分", special_type), ("照合基準額", reconcile_amount), ("特殊計算メモ", special_memo)]:
            idx = header_map.get(name)
            if idx is not None:
                row[idx] = value
        merged.append(row)
        if biz_no:
            seen_biz.add(biz_no)

    for row in protected_only:
        merged.append(ensure_row_width(row, width))

    merged.sort(key=lambda row: parse_date(row[header_map.get("日付", -1)]) or datetime(1900, 1, 1), reverse=True)
    return [ensure_row_width(existing_header, width)] + merged


def load_bank_import_rules(correction_rows):
    if not correction_rows:
        return []
    header = correction_rows[0]
    hmap = get_header_map(header)
    rules = []
    for row in correction_rows[1:]:
        if not is_truthy(row[hmap.get("有効", -1)] if hmap.get("有効") is not None else "TRUE"):
            continue
        target_sheet = safe_string(row[hmap.get("対象シート", -1)] if hmap.get("対象シート") is not None else "")
        target_col = safe_string(row[hmap.get("対象列", -1)] if hmap.get("対象列") is not None else "")
        if target_sheet and target_sheet != "銀行データチェック用":
            continue
        if target_col and target_col not in {"自摘要", "相手摘要", "表示摘要"}:
            continue
        read = safe_string(row[hmap.get("誤読文字", -1)] if hmap.get("誤読文字") is not None else "")
        correct = safe_string(row[hmap.get("正しい文字", -1)] if hmap.get("正しい文字") is not None else "")
        mode = safe_string(row[hmap.get("置換方法", -1)] if hmap.get("置換方法") is not None else "")
        if read:
            rules.append((read, correct, mode))
    return rules


def apply_summary_corrections(text, rules):
    out = safe_string(text)
    for read, correct, mode in rules:
        if mode == "完全一致":
            if out == read:
                out = correct
        elif read in out:
            out = out.replace(read, correct)
    return out


def normalize_voucher_type(raw_type, signed_amount):
    text = safe_string(raw_type)
    if text in {"入金", "出金"}:
        return text
    if signed_amount > 0:
        return "入金"
    if signed_amount < 0:
        return "出金"
    return ""


def bank_display_summary(self_summary, partner_summary):
    return safe_string(self_summary) or safe_string(partner_summary)


def bank_dedupe_key_from_record(record):
    date_text = date_key(record["日付"])
    signed_amount = to_number(record["金額"])
    if not date_text or not signed_amount:
        return ""
    voucher_type = normalize_voucher_type(record.get("伝票種"), signed_amount)
    number = safe_string(record.get("番号"))
    management_codes = extract_codes(number)
    display = normalize_compare_name(record.get("表示摘要") or bank_display_summary(record.get("自摘要"), record.get("相手摘要")))
    counter = normalize_compare_name(record.get("相手科目"))
    if management_codes:
        return "|".join([date_text, voucher_type, str(abs(signed_amount)), management_codes[0]])
    return "|".join([date_text, voucher_type, str(abs(signed_amount)), display, counter])


def bank_row_score(record):
    score = 0
    display = safe_string(record.get("表示摘要") or bank_display_summary(record.get("自摘要"), record.get("相手摘要")))
    self_summary = safe_string(record.get("自摘要"))
    partner_summary = safe_string(record.get("相手摘要"))
    number = safe_string(record.get("番号"))
    counter = safe_string(record.get("相手科目"))
    if number:
        score += 80
    if self_summary:
        score += 30
    if partner_summary:
        score += 10
    if counter:
        score += 5
    score += min(len(display), 60)
    score -= display.count("�") * 100
    score -= self_summary.count("�") * 60
    score -= partner_summary.count("�") * 40
    return score


def existing_bank_records(rows):
    header = rows[0]
    hmap = get_header_map(header)
    out = []
    for raw in rows[1:]:
        row = ensure_row_width(raw, len(header))
        record = {header[i]: row[i] for i in range(len(header))}
        record["_row"] = row
        record["_protected"] = is_truthy(row[hmap.get("保護フラグ", -1)]) if hmap.get("保護フラグ") is not None else False
        out.append(record)
    return header, hmap, out


def build_bank_records_from_csv(path, bank_rules):
    rows = read_csv_rows(path)
    if not rows:
        return [], "CSVが空です"
    header = [normalize_header(h) for h in rows[0]]
    hmap = {h: i for i, h in enumerate(header) if h}
    if not {"日付", "借方金額", "貸方金額"}.issubset(set(hmap)):
        if {"開始日付", "終了日付", "残高"}.issubset(set(hmap)) and ("勘定科目" in hmap or "科目コード" in hmap):
            return [], "銀行明細ではなく、残高一覧・科目残高系のCSVです"
        return [], "銀行明細CSVではありません"
    process_rows = []
    valid_entry_count = 0
    for idx, raw in enumerate(rows[1:], start=2):
        dt = parse_date(get_by_aliases(raw, hmap, ["日付"]))
        if not dt:
            continue
        self_summary = apply_summary_corrections(get_by_aliases(raw, hmap, ["自摘要"]), bank_rules)
        partner_summary = apply_summary_corrections(get_by_aliases(raw, hmap, ["相手摘要"]), bank_rules)
        counter_account = safe_string(get_by_aliases(raw, hmap, ["相手科目"]))
        debit_amount = to_number(get_by_aliases(raw, hmap, ["借方金額"]))
        credit_amount = to_number(get_by_aliases(raw, hmap, ["貸方金額"]))
        number = safe_string(get_by_aliases(raw, hmap, ["番号"]))

        if debit_amount:
            valid_entry_count += 1
            process_rows.append({
                "日付": dt.strftime("%Y/%m/%d"),
                "相手科目": counter_account,
                "相手摘要": partner_summary,
                "金額": debit_amount,
                "業務No.": "",
                "顧客No.": "",
                "ステータス": MATCH_STATUS_UNMATCHED,
                "保護フラグ": "",
                "入金月": dt.strftime("%Y/%m"),
                "カード会社振り込み": "",
                "カード照合額": "",
                "自摘要": self_summary,
                "番号": number,
                "伝票種": "入金",
                "取引先": bank_display_summary(self_summary, partner_summary),
                "表示摘要": bank_display_summary(self_summary, partner_summary),
                "借方金額": debit_amount,
                "貸方金額": "",
            })
        if credit_amount:
            valid_entry_count += 1
            process_rows.append({
                "日付": dt.strftime("%Y/%m/%d"),
                "相手科目": counter_account,
                "相手摘要": partner_summary,
                "金額": -credit_amount,
                "業務No.": "",
                "顧客No.": "",
                "ステータス": MATCH_STATUS_UNMATCHED,
                "保護フラグ": "",
                "入金月": dt.strftime("%Y/%m"),
                "カード会社振り込み": "",
                "カード照合額": "",
                "自摘要": self_summary,
                "番号": number,
                "伝票種": "出金",
                "取引先": bank_display_summary(self_summary, partner_summary),
                "表示摘要": bank_display_summary(self_summary, partner_summary),
                "借方金額": "",
                "貸方金額": credit_amount,
            })
    if valid_entry_count == 0:
        return [], "有効な明細行がありません"
    return process_rows, ""


def merge_bank_rows(existing_rows, imported_records, bank_header):
    merged = {}
    order = []
    for record in existing_rows + imported_records:
        key = bank_dedupe_key_from_record(record)
        if not key:
            key = f"raw:{len(order)}"
        if key not in merged:
            merged[key] = record
            order.append(key)
            continue
        current = merged[key]
        if bank_row_score(record) > bank_row_score(current):
            merged[key] = record
    rows = [bank_header]
    values = list(merged.values())
    values.sort(key=lambda rec: (parse_date(rec.get("日付")) or datetime(1900, 1, 1), to_number(rec.get("金額"))), reverse=False)
    for rec in values:
        if rec.get("日付"):
            rec["日付"] = date_key(rec.get("日付"))
        if rec.get("日付"):
            rec["入金月"] = deposit_month(rec.get("日付"))
        rows.append([rec.get(h, "") for h in bank_header])
    return rows


def build_learning_master(rows):
    if not rows:
        return []
    header = rows[0]
    hmap = get_header_map(header)
    out = []
    for row in rows[1:]:
        raw_bank_summary = safe_string(row[hmap.get("銀行摘要原文", -1)] if hmap.get("銀行摘要原文") is not None else "")
        normalized_summary = safe_string(row[hmap.get("正規摘要", -1)] if hmap.get("正規摘要") is not None else "")
        customer_name = safe_string(row[hmap.get("正規顧客名", -1)] if hmap.get("正規顧客名") is not None else "")
        aliases = [
            safe_string(row[hmap.get("別名1", -1)] if hmap.get("別名1") is not None else ""),
            safe_string(row[hmap.get("別名2", -1)] if hmap.get("別名2") is not None else ""),
        ]
        code = safe_string(row[hmap.get("管理番号", -1)] if hmap.get("管理番号") is not None else "")
        expected_category = safe_string(row[hmap.get("想定作業大区分", -1)] if hmap.get("想定作業大区分") is not None else "")
        auto_allowed = safe_string(row[hmap.get("自動消込可否", -1)] if hmap.get("自動消込可否") is not None else "").upper() != "NO"
        match_keys = [raw_bank_summary, normalized_summary, customer_name] + [x for x in aliases if x]
        match_keys = [normalize_text(x) for x in match_keys if x]
        if not match_keys and not code:
            continue
        out.append({
            "customerName": customer_name,
            "code": code,
            "expectedCategory": expected_category,
            "autoAllowed": auto_allowed,
            "matchKeys": match_keys,
        })
    return out


def build_alias_candidates(rows):
    if not rows:
        return []
    header = rows[0]
    hmap = get_header_map(header)
    out = []
    for row in rows[1:]:
        cust_no = safe_string(row[hmap.get("顧客No.", -1)] if hmap.get("顧客No.") is not None else "")
        names = [
            safe_string(row[hmap.get("入金データ表示名", -1)] if hmap.get("入金データ表示名") is not None else ""),
            safe_string(row[hmap.get("Jocar登録名", -1)] if hmap.get("Jocar登録名") is not None else ""),
        ]
        for name in names:
            if name:
                out.append({"custNo": cust_no, "customerName": name, "normalizedName": normalize_text(name)})
    return out


def find_learning_entry(text, learning_master):
    normalized = normalize_text(text)
    best = None
    best_len = 0
    for entry in learning_master:
        for key in entry["matchKeys"]:
            if normalized == key or key in normalized or normalized in key:
                if len(key) > best_len:
                    best = entry
                    best_len = len(key)
    return best


def find_alias_candidate(normalized_text, alias_candidates):
    best = None
    best_len = 0
    for item in alias_candidates:
        alias_name = item["normalizedName"]
        if normalized_text == alias_name or alias_name in normalized_text or normalized_text in alias_name:
            if len(alias_name) > best_len:
                best = item
                best_len = len(alias_name)
    return best


def load_recurring_rules(rows):
    if not rows:
        return []
    header = rows[0]
    hmap = get_header_map(header)
    out = []
    for row in rows[1:]:
        enabled = safe_string(row[hmap.get("有効", -1)] if hmap.get("有効") is not None else "Y").upper()
        if enabled and enabled not in {"TRUE", "1", "YES", "Y", "有効"}:
            continue
        summary = safe_string(row[hmap.get("摘要", -1)] if hmap.get("摘要") is not None else "")
        amount = to_number(row[hmap.get("金額", -1)] if hmap.get("金額") is not None else "")
        if not summary or not amount:
            continue
        out.append({
            "normalizedSummary": normalize_text(summary),
            "amount": amount,
            "bizNo": safe_string(row[hmap.get("業務No.", -1)] if hmap.get("業務No.") is not None else ""),
            "custNo": safe_string(row[hmap.get("顧客No.", -1)] if hmap.get("顧客No.") is not None else ""),
            "status": safe_string(row[hmap.get("ステータス", -1)] if hmap.get("ステータス") is not None else "") or MATCH_STATUS_AUTO,
            "memo": safe_string(row[hmap.get("確認メモ", -1)] if hmap.get("確認メモ") is not None else "") or "定期入金リスト一致",
        })
    return out


def derive_bank_matching_name(raw_name, fallback_name):
    original = safe_string(raw_name) or safe_string(fallback_name)
    if not original:
        return ""
    matches = re.findall(r"(?:SB|CH|PC|RA)\s*0*\d{3,8}", original, re.I)
    if matches:
        last_code = matches[-1]
        last_index = original.upper().rfind(last_code.upper())
        if last_index > 0:
            before = original[:last_index].strip()
            parts = re.split(r"[　 ]+", before)
            parts = [p for p in parts if p]
            return " ".join(parts[-2:]) if parts else before
    normalized = safe_string(original)
    for hint in LOAN_COMPANY_HINTS + INSURANCE_HINTS:
        idx = normalized.find(hint)
        if idx >= 0:
            tail = re.sub(r"^[\s　・･/]+", "", normalized[idx + len(hint):]).strip()
            if tail:
                return tail
    return original


def build_sales_contexts(rows):
    header = rows[0]
    h = get_header_map(header)
    contexts = []
    for row_id, raw in enumerate(rows[1:], start=2):
        row = ensure_row_width(raw, len(header))
        rows[row_id - 1] = row
        biz_no = safe_string(row[h.get("業務№", -1)])
        cust_no = safe_string(row[h.get("顧客№", -1)])
        raw_name = safe_string(row[h.get("顧客名", -1)])
        bill_to = safe_string(row[h.get("請求先名", -1)])
        work_type = safe_string(row[h.get("作業大区分名", -1)])
        special_type = safe_string(row[h.get("特殊案件区分", -1)])
        current_status = safe_string(row[h.get("ステータス", -1)])
        current_method = safe_string(row[h.get("入金方法", -1)])
        protected = is_truthy(row[h.get("保護フラグ", -1)]) if h.get("保護フラグ") is not None else False
        total = to_number(row[h.get("売上総計", -1)])
        reconcile_amount = to_number(row[h.get("照合基準額", -1)]) if h.get("照合基準額") is not None else 0
        contexts.append({
            "row_id": row_id,
            "row": row,
            "bizNo": biz_no,
            "custNo": cust_no,
            "rawName": raw_name,
            "normalizedName": normalize_text(raw_name),
            "workType": work_type,
            "amount": reconcile_amount if reconcile_amount > 0 else total,
            "date": row[h.get("日付", -1)],
            "dueDate": row[h.get("入金予定日", -1)],
            "billTo": bill_to,
            "specialType": special_type,
            "currentStatus": current_status,
            "currentMethod": current_method,
            "protectedFlag": protected,
        })
    return header, h, contexts


def build_bank_contexts(rows, learning_master, alias_candidates):
    header = rows[0]
    h = get_header_map(header)
    contexts = []
    for row_id, raw in enumerate(rows[1:], start=2):
        row = ensure_row_width(raw, len(header))
        rows[row_id - 1] = row
        raw_name = safe_string(row[h.get("自摘要", -1)]) or safe_string(row[h.get("相手摘要", -1)])
        fallback = safe_string(row[h.get("相手摘要", -1)])
        learning = find_learning_entry(f"{raw_name} {fallback}", learning_master)
        matching_name = derive_bank_matching_name(raw_name, fallback)
        normalized_name = normalize_text(learning["customerName"]) if learning and learning["customerName"] else normalize_text(matching_name)
        alias = find_alias_candidate(normalized_name, alias_candidates)
        contexts.append({
            "row_id": row_id,
            "row": row,
            "rawName": raw_name,
            "fallbackName": fallback,
            "matchingName": matching_name,
            "normalizedName": normalized_name,
            "subject": safe_string(row[h.get("相手科目", -1)]),
            "amount": to_number(row[h.get("金額", -1)]),
            "date": row[h.get("日付", -1)],
            "currentStatus": safe_string(row[h.get("ステータス", -1)]),
            "codes": extract_codes(" ".join([raw_name, fallback, learning["code"] if learning else ""])),
            "mappedCustNo": alias["custNo"] if alias else "",
            "protectedFlag": is_truthy(row[h.get("保護フラグ", -1)]) if h.get("保護フラグ") is not None else False,
            "learning": learning,
        })
    return header, h, contexts


def recurring_match(bank_ctx, recurring_rules):
    candidates = [normalize_text(bank_ctx["rawName"]), normalize_text(bank_ctx["fallbackName"]), normalize_text(bank_ctx["matchingName"])]
    for rule in recurring_rules:
        if rule["amount"] != bank_ctx["amount"]:
            continue
        if any(name and name == rule["normalizedSummary"] for name in candidates):
            return rule
    return None


def is_receivable_like_subject(subject):
    text = safe_string(subject)
    return not text or text in {"売掛金", "諸口", "仮受金", "保険手数料"}


def normalized_bank_joined_text(bank_ctx):
    return normalize_text(" ".join([
        safe_string(bank_ctx.get("rawName")),
        safe_string(bank_ctx.get("fallbackName")),
        safe_string(bank_ctx.get("matchingName")),
        safe_string(bank_ctx.get("subject")),
    ]))


def is_conquest_sale(sale_ctx):
    return "コンクエスト" in normalize_text(
        " ".join([safe_string(sale_ctx.get("billTo")), safe_string(sale_ctx.get("specialType"))])
    )


def is_conquest_bank(bank_ctx):
    return "コンクエスト" in normalized_bank_joined_text(bank_ctx)


def is_insurance_bank(bank_ctx):
    text = safe_string(bank_ctx.get("rawName")) + " " + safe_string(bank_ctx.get("fallbackName")) + " " + safe_string(bank_ctx.get("subject"))
    return any(hint in text for hint in INSURANCE_HINTS)


def is_loan_bank(bank_ctx):
    text = safe_string(bank_ctx.get("rawName")) + " " + safe_string(bank_ctx.get("fallbackName")) + " " + safe_string(bank_ctx.get("subject"))
    return any(hint in text for hint in LOAN_COMPANY_HINTS)


def is_card_bank(bank_ctx):
    return bool(classify_card_key(bank_ctx.get("rawName") or bank_ctx.get("fallbackName")))


def allow_normal_match(bank_ctx, sale_ctx):
    sale_is_conquest = is_conquest_sale(sale_ctx)
    bank_is_conquest = is_conquest_bank(bank_ctx)
    if sale_is_conquest and not bank_is_conquest:
        return False
    if bank_is_conquest and not sale_is_conquest:
        return False
    return True


def score_bank_to_sales(bank_ctx, sale_ctx):
    if not allow_normal_match(bank_ctx, sale_ctx):
        return 0, [], MATCH_STATUS_REVIEW

    score = 40
    reasons = ["金額完全一致"]
    bank_is_insurance = is_insurance_bank(bank_ctx)
    bank_is_loan = is_loan_bank(bank_ctx)
    sale_is_conquest = is_conquest_sale(sale_ctx)
    if sale_ctx["bizNo"] and sale_ctx["bizNo"].upper() in bank_ctx["codes"]:
        score += 120
        reasons.append("管理番号一致")
    learning = bank_ctx["learning"]
    if learning and learning["code"] and sale_ctx["bizNo"] and learning["code"].upper() == sale_ctx["bizNo"].upper():
        score += 120
        reasons.append("学習マスタの管理番号一致")
    due_diff = calc_date_diff_days(bank_ctx["date"], sale_ctx["dueDate"])
    if due_diff is not None:
        if due_diff == 0:
            score += 110
            reasons.append("入金予定日一致")
        elif due_diff <= 3:
            score += 35
            reasons.append("入金予定日近接")
    if bank_ctx["mappedCustNo"] and sale_ctx["custNo"] and bank_ctx["mappedCustNo"] == sale_ctx["custNo"]:
        score += 90
        reasons.append("顧客No一致")
    if strong_name_match(bank_ctx["normalizedName"], sale_ctx["normalizedName"]):
        score += 75
        reasons.append("顧客名一致")
    elif loose_name_match(bank_ctx["normalizedName"], sale_ctx["normalizedName"]):
        score += 50
        reasons.append("顧客名近似")
    normalized_bill_to = normalize_text(sale_ctx["billTo"])
    if normalized_bill_to and sale_is_conquest:
        if strong_name_match(bank_ctx["normalizedName"], normalized_bill_to):
            score += 70
            reasons.append("請求先名一致")
        elif loose_name_match(bank_ctx["normalizedName"], normalized_bill_to):
            score += 45
            reasons.append("請求先名近似")
    elif normalized_bill_to and (bank_is_insurance or bank_is_loan):
        if strong_name_match(bank_ctx["normalizedName"], normalized_bill_to):
            score += 20
            reasons.append("請求先補助一致")
        elif loose_name_match(bank_ctx["normalizedName"], normalized_bill_to):
            score += 10
            reasons.append("請求先補助近似")
    if learning and learning["expectedCategory"] and sale_ctx["workType"] and learning["expectedCategory"] == sale_ctx["workType"]:
        score += 20
        reasons.append("想定作業区分一致")
    if bank_is_insurance and sale_ctx["workType"] in BOARD_WORK_TYPES:
        score += 25
        reasons.append("保険案件傾向一致")
    if bank_is_loan and sale_ctx["workType"] in {"車販", "車両販売"}:
        score += 20
        reasons.append("ローン会社案件傾向一致")
    diff_days = calc_date_diff_days(bank_ctx["date"], sale_ctx["date"])
    if diff_days is not None:
        if diff_days <= 7:
            score += 15
            reasons.append("日付近い")
        elif diff_days <= 30:
            score += 8
            reasons.append("日付許容範囲")
        elif diff_days <= 90:
            score += 3
    if is_receivable_like_subject(bank_ctx["subject"]):
        score += 5
    auto_allowed = not learning or learning["autoAllowed"] is not False
    status = MATCH_STATUS_AUTO if score >= 60 and auto_allowed else MATCH_STATUS_REVIEW
    return score, reasons, status


def find_best_sales_match(bank_ctx, sales_contexts, matched_sales):
    if bank_ctx["amount"] <= 0 or bank_ctx["protectedFlag"]:
        return None
    exact_amount_sales = []
    for sale in sales_contexts:
        if sale["row_id"] in matched_sales:
            continue
        if not allow_normal_match(bank_ctx, sale):
            continue
        if sale["amount"] != bank_ctx["amount"]:
            continue
        exact_amount_sales.append(sale)

    candidates = []
    for sale in exact_amount_sales:
        score, reasons, status = score_bank_to_sales(bank_ctx, sale)
        if score >= 45:
            candidates.append({"sale": sale, "score": score, "reasons": reasons, "status": status})
    candidates.sort(key=lambda item: (-item["score"], calc_date_diff_days(bank_ctx["date"], item["sale"]["date"]) or 9999))
    if not candidates:
        if len(exact_amount_sales) == 1:
            sale = exact_amount_sales[0]
            score, reasons, status = score_bank_to_sales(bank_ctx, sale)
            due_diff = calc_date_diff_days(bank_ctx["date"], sale["dueDate"])
            date_diff = calc_date_diff_days(bank_ctx["date"], sale["date"])
            if (due_diff is not None and due_diff <= 45) or (date_diff is not None and date_diff <= 45):
                auto_allowed = not bank_ctx["learning"] or bank_ctx["learning"]["autoAllowed"] is not False
                boosted_score = score + 20
                boosted_reasons = list(dict.fromkeys(reasons + ["金額完全一致の単独候補"]))
                boosted_status = MATCH_STATUS_AUTO if boosted_score >= 60 and auto_allowed else MATCH_STATUS_REVIEW
                return {"sale": sale, "score": boosted_score, "reasons": boosted_reasons, "status": boosted_status}
        return None
    if len(candidates) > 1 and abs(candidates[0]["score"] - candidates[1]["score"]) <= 5:
        candidates[0]["status"] = MATCH_STATUS_REVIEW
        candidates[0]["reasons"].append("近似候補が複数あるため確認が必要")
    return candidates[0]


def score_split(bank_ctx, sale_ctx):
    score = 0
    reasons = []
    if sale_ctx["bizNo"] and sale_ctx["bizNo"].upper() in bank_ctx["codes"]:
        score += 120
        reasons.append("管理番号一致")
    learning = bank_ctx["learning"]
    if learning and learning["code"] and sale_ctx["bizNo"] and learning["code"].upper() == sale_ctx["bizNo"].upper():
        score += 120
        reasons.append("学習管理番号一致")
    due_diff = calc_date_diff_days(bank_ctx["date"], sale_ctx["dueDate"])
    if due_diff is not None:
        if due_diff == 0:
            score += 90
            reasons.append("入金予定日一致")
        elif due_diff <= 3:
            score += 25
            reasons.append("入金予定日近接")
    if bank_ctx["mappedCustNo"] and sale_ctx["custNo"] and bank_ctx["mappedCustNo"] == sale_ctx["custNo"]:
        score += 85
        reasons.append("顧客No一致")
    if strong_name_match(bank_ctx["normalizedName"], sale_ctx["normalizedName"]):
        score += 70
        reasons.append("顧客名一致")
    elif loose_name_match(bank_ctx["normalizedName"], sale_ctx["normalizedName"]):
        score += 45
        reasons.append("顧客名近似")
    normalized_bill_to = normalize_text(sale_ctx["billTo"])
    if normalized_bill_to:
        if strong_name_match(bank_ctx["normalizedName"], normalized_bill_to):
            score += 65
            reasons.append("請求先名一致")
        elif loose_name_match(bank_ctx["normalizedName"], normalized_bill_to):
            score += 40
            reasons.append("請求先名近似")
    diff_days = calc_date_diff_days(bank_ctx["date"], sale_ctx["date"])
    if diff_days is not None and diff_days <= 90:
        score += 15 if diff_days <= 30 else 5
        reasons.append("日付許容範囲")
    return score, reasons


def find_split_matches(sale_ctx, bank_contexts, matched_bank_rows):
    if sale_ctx["amount"] <= 0 or sale_ctx["protectedFlag"]:
        return None
    candidates = []
    for bank in bank_contexts:
        if bank["row_id"] in matched_bank_rows or bank["protectedFlag"]:
            continue
        if bank["currentStatus"] == MATCH_STATUS_AUTO:
            continue
        if not (0 < bank["amount"] < sale_ctx["amount"]):
            continue
        score, reasons = score_split(bank, sale_ctx)
        if score >= 45:
            candidates.append({"bank": bank, "score": score, "reasons": reasons})
    candidates.sort(key=lambda item: -item["score"])
    candidates = candidates[:8]
    combos = []
    used = []

    def dfs(start, total, total_score, reasons):
        if total == sale_ctx["amount"] and len(used) >= 2:
            combos.append({"banks": used[:], "score": total_score, "reasons": reasons[:]})
            return
        if total >= sale_ctx["amount"] or len(used) >= 3:
            return
        for idx in range(start, len(candidates)):
            c = candidates[idx]
            used.append(c["bank"])
            dfs(idx + 1, total + c["bank"]["amount"], total_score + c["score"], reasons + c["reasons"])
            used.pop()

    dfs(0, 0, 0, [])
    if not combos:
        return None
    combos.sort(key=lambda item: -item["score"])
    if len(combos) > 1 and abs(combos[0]["score"] - combos[1]["score"]) <= 10:
        return None
    best = combos[0]
    all_auto_allowed = all(not b["learning"] or b["learning"]["autoAllowed"] is not False for b in best["banks"])
    status = MATCH_STATUS_AUTO if best["score"] >= 60 * len(best["banks"]) and all_auto_allowed else MATCH_STATUS_REVIEW
    return {"sale": sale_ctx, "banks": best["banks"], "reasons": list(dict.fromkeys(best["reasons"] + [f"分割入金 {len(best['banks'])}件合算"])), "status": status}


def is_excluded_income(text, subject, voucher_type):
    joined = " ".join([safe_string(text), safe_string(subject), safe_string(voucher_type)])
    if not joined.strip():
        return True
    if re.search(r"資金移動|前頁残高|繰越残高|前日繰越|当座預金|普通預金", joined):
        return True
    return False


def classify_card_key(summary):
    normalized = normalize_text(summary)
    if any(code in normalized for code in ["SB", "CH", "PC", "RA"]) and re.search(r"(SB|CH|PC|RA)\d", normalized):
        return ""
    if "VISA" in normalized:
        return "VISA"
    if "JCB" in normalized:
        return "JCB"
    if "MASTER" in normalized or "MASTERCARD" in normalized:
        return "MASTER"
    if "AMEX" in normalized or "AMERICANEXPRESS" in normalized:
        return "AMEX"
    return ""


def build_review_reason(bank_ctx, sales_contexts):
    reasons = []
    if bank_ctx["codes"]:
        reasons.append("案件未登録の可能性（番号候補: " + ", ".join(bank_ctx["codes"]) + "）")
    near = None
    for sale in sales_contexts:
        if sale["protectedFlag"]:
            continue
        diff = abs(sale["amount"] - bank_ctx["amount"])
        if diff <= MICRO_DIFF_MAX:
            near = (sale, diff)
            break
    if near:
        reasons.append(f"金額微差（手数料疑い: 差額 {near[1]}円 / 候補 {near[0]['bizNo'] or near[0]['rawName']}）")
    return "\n".join(reasons)


def run_matching(bank_rows, sales_rows, alias_rows, learning_rows, recurring_rows):
    bank_header, bank_h, bank_contexts = build_bank_contexts(bank_rows, build_learning_master(learning_rows), build_alias_candidates(alias_rows))
    sales_header, sales_h, sales_contexts = build_sales_contexts(sales_rows)
    recurring_rules = load_recurring_rules(recurring_rows)
    matched_bank_rows = set()
    matched_sales_rows = set()
    review_memos = []

    for bank in bank_contexts:
        row = bank["row"]
        current_status = safe_string(row[bank_h.get("ステータス", -1)])
        current_biz = safe_string(row[bank_h.get("業務No.", -1)])
        current_cust = safe_string(row[bank_h.get("顧客No.", -1)])
        if (current_status in {MATCH_STATUS_AUTO, MATCH_STATUS_MANUAL} and (current_biz or current_cust)) or bank["protectedFlag"]:
            continue
        if bank["amount"] <= 0:
            row[bank_h["ステータス"]] = "対象外"
            continue
        if is_excluded_income(bank["rawName"] or bank["fallbackName"], bank["subject"], row[bank_h.get("伝票種", -1)]):
            row[bank_h["ステータス"]] = "対象外"
            continue
        if re.search(r"利息|手数料|借入|短期借入|資金移動", safe_string(bank["rawName"]) + " " + safe_string(bank["subject"])):
            row[bank_h["ステータス"]] = "対象外"
            continue

        rule = recurring_match(bank, recurring_rules)
        if rule:
            row[bank_h["顧客No."]] = rule["custNo"]
            row[bank_h["業務No."]] = rule["bizNo"]
            row[bank_h["ステータス"]] = rule["status"]
            matched_bank_rows.add(bank["row_id"])
            if rule["bizNo"]:
                for sale in sales_contexts:
                    if sale["bizNo"] == rule["bizNo"]:
                        sale["row"][sales_h["ステータス"]] = rule["status"]
                        sale["row"][sales_h["入金方法"]] = "振り込み"
                        matched_sales_rows.add(sale["row_id"])
                        break
            continue

        card_key = classify_card_key(bank["rawName"] or bank["fallbackName"])
        if bank_h.get("カード会社振り込み") is not None:
            row[bank_h["カード会社振り込み"]] = card_key

        match = find_best_sales_match(bank, sales_contexts, matched_sales_rows)
        if match:
            sale = match["sale"]
            row[bank_h["顧客No."]] = sale["custNo"]
            row[bank_h["業務No."]] = sale["bizNo"]
            row[bank_h["ステータス"]] = match["status"]
            sale["row"][sales_h["ステータス"]] = match["status"]
            sale["row"][sales_h["入金方法"]] = "振り込み"
            matched_bank_rows.add(bank["row_id"])
            matched_sales_rows.add(sale["row_id"])
            if match["status"] == MATCH_STATUS_REVIEW:
                review_memos.append([date_key(bank["date"]), bank["rawName"] or bank["fallbackName"], bank["amount"], MATCH_STATUS_REVIEW, sale["bizNo"], "\n".join(match["reasons"])])
            continue

        row[bank_h["ステータス"]] = MATCH_STATUS_UNMATCHED

    for bank in bank_contexts:
        row = bank["row"]
        status = safe_string(row[bank_h.get("ステータス", -1)])
        current_biz = safe_string(row[bank_h.get("業務No.", -1)])
        current_cust = safe_string(row[bank_h.get("顧客No.", -1)])
        if status not in {MATCH_STATUS_AUTO, MATCH_STATUS_MANUAL, "補正適用"}:
            continue
        if current_biz or current_cust:
            continue
        if bank["protectedFlag"] or bank["amount"] <= 0 or is_card_bank(bank) or is_conquest_bank(bank):
            continue
        match = find_best_sales_match(bank, sales_contexts, matched_sales_rows)
        if not match:
            continue
        sale = match["sale"]
        row[bank_h["顧客No."]] = sale["custNo"]
        row[bank_h["業務No."]] = sale["bizNo"]
        if sale["row"][sales_h["ステータス"]] not in {MATCH_STATUS_MANUAL, MATCH_STATUS_AUTO}:
            sale["row"][sales_h["ステータス"]] = status
        sale["row"][sales_h["入金方法"]] = "振り込み"
        matched_bank_rows.add(bank["row_id"])
        matched_sales_rows.add(sale["row_id"])

    for sale in sales_contexts:
        if sale["row_id"] in matched_sales_rows or safe_string(sale["currentStatus"]) in {MATCH_STATUS_AUTO, MATCH_STATUS_MANUAL} or sale["protectedFlag"]:
            continue
        split = find_split_matches(sale, bank_contexts, matched_bank_rows)
        if not split:
            continue
        sale["row"][sales_h["ステータス"]] = split["status"]
        sale["row"][sales_h["入金方法"]] = "振り込み"
        for bank in split["banks"]:
            bank["row"][bank_h["顧客No."]] = sale["custNo"]
            bank["row"][bank_h["業務No."]] = sale["bizNo"]
            bank["row"][bank_h["ステータス"]] = split["status"]
            matched_bank_rows.add(bank["row_id"])
        if split["status"] == MATCH_STATUS_REVIEW:
            review_memos.append([date_key(split["banks"][0]["date"]), split["banks"][0]["rawName"], sum(b["amount"] for b in split["banks"]), MATCH_STATUS_REVIEW, sale["bizNo"], "\n".join(split["reasons"])])

    for bank in bank_contexts:
        row = bank["row"]
        status = safe_string(row[bank_h["ステータス"]])
        if status in {"対象外", MATCH_STATUS_AUTO, MATCH_STATUS_MANUAL} or bank["amount"] <= 0:
            continue
        if status in {MATCH_STATUS_UNMATCHED, MATCH_STATUS_REVIEW}:
            reason = build_review_reason(bank, sales_contexts)
            if reason:
                row[bank_h["ステータス"]] = MATCH_STATUS_REVIEW
                review_memos.append([date_key(bank["date"]), bank["rawName"] or bank["fallbackName"], bank["amount"], MATCH_STATUS_REVIEW, safe_string(row[bank_h.get("業務No.", -1)]), reason])

    return bank_rows, sales_rows, review_memos


def build_payment_progress(bank_rows, sales_rows):
    bank_header = bank_rows[0]
    bank_h = get_header_map(bank_header)
    sales_header = sales_rows[0]
    sales_h = get_header_map(sales_header)
    agg_biz = defaultdict(lambda: {"total": 0, "review": False, "methods": set(), "counts": defaultdict(int)})
    agg_cust = defaultdict(lambda: {"total": 0, "review": False, "methods": set(), "counts": defaultdict(int)})

    for raw in bank_rows[1:]:
        row = ensure_row_width(raw, len(bank_header))
        status = safe_string(row[bank_h.get("ステータス", -1)])
        if not status or status == MATCH_STATUS_UNMATCHED:
            continue
        amount = to_number(row[bank_h.get("金額", -1)])
        if amount <= 0:
            continue
        biz_no = safe_string(row[bank_h.get("業務No.", -1)])
        cust_no = safe_string(row[bank_h.get("顧客No.", -1)])
        if not biz_no and not cust_no:
            continue
        target = agg_biz[biz_no] if biz_no else agg_cust[cust_no]
        target["total"] += amount
        if status == MATCH_STATUS_REVIEW:
            target["review"] = True
        target["methods"].add("振り込み")
        target["counts"]["銀行"] += 1

    for row_idx in range(1, len(sales_rows)):
        raw = sales_rows[row_idx]
        row = ensure_row_width(raw, len(sales_header))
        biz_no = safe_string(row[sales_h.get("業務№", -1)])
        cust_no = safe_string(row[sales_h.get("顧客№", -1)])
        total = to_number(row[sales_h.get("照合基準額", -1)]) or to_number(row[sales_h.get("売上総計", -1)])
        match_status = safe_string(row[sales_h.get("ステータス", -1)])
        payment = agg_biz.get(biz_no) or agg_cust.get(cust_no)
        paid_total = payment["total"] if payment else 0
        if match_status == MATCH_STATUS_REVIEW or (payment and payment["review"]):
            progress = MATCH_STATUS_REVIEW
        elif total > 0 and paid_total >= total:
            progress = "入金済"
        elif paid_total > 0:
            progress = "一部入金"
        else:
            progress = "未入金"
        if sales_h.get("入金累計") is not None:
            row[sales_h["入金累計"]] = paid_total or 0
        if sales_h.get("未入金額") is not None:
            row[sales_h["未入金額"]] = max(total - paid_total, 0) if total else ""
        if sales_h.get("入金状況") is not None:
            row[sales_h["入金状況"]] = progress
        if sales_h.get("確認メモ") is not None and payment:
            parts = [f"{label}:{count}件" for label, count in payment["counts"].items()]
            if payment["methods"]:
                parts.append("方法:" + "/".join(sorted(payment["methods"])))
            if payment["review"]:
                parts.append("要確認あり")
            row[sales_h["確認メモ"]] = " / ".join(parts)
        if sales_h.get("アラート") is not None:
            due = parse_date(row[sales_h.get("入金予定日", -1)])
            if progress == "入金済":
                alert = ""
            elif due and due.date() < datetime.now().date():
                alert = "期限超過"
            elif due and (due.date() - datetime.now().date()).days <= 3:
                alert = "期限間近"
            else:
                alert = ""
            row[sales_h["アラート"]] = alert
        sales_rows[row_idx] = row
    return sales_rows


def resolve_special_bucket(bill_to, special_type):
    joined = normalize_text(" ".join([safe_string(bill_to), safe_string(special_type)]))
    if "コンクエスト" in joined:
        return "conquest"
    if any(normalize_text(hint) in joined for hint in INSURANCE_HINTS):
        return "insurance"
    return ""


def derive_conquest_label(row, h):
    customer_name = safe_string(row[h.get("顧客名", -1)])
    bill_to = safe_string(row[h.get("請求先名", -1)])
    service_shop = safe_string(row[h.get("整備店舗", -1)])
    sales_date = parse_date(row[h.get("日付", -1)])
    month = sales_date.month if sales_date else ""
    normalized_bill = normalize_text(bill_to)
    normalized_shop = normalize_text(service_shop)
    if "MASERATI広島".upper() in normalized_shop or normalized_bill == normalize_text(CONQUEST_GROSS_VENDOR):
        return f"ｺﾝｸｴｽﾄ様ﾏｾﾗﾃｨ{month}月分" if month else "ｺﾝｸｴｽﾄ様ﾏｾﾗﾃｨ"
    if normalized_bill == normalize_text(CONQUEST_SUM_VENDOR):
        return "ｺﾝｸｴｽﾄ様J&LR営業部門"
    if "コンクエスト" in normalized_bill:
        return "ｺﾝｸｴｽﾄ様J&LR整備"
    return "コンクエスト＋" + (customer_name or bill_to or "案件")


def find_insurance_candidate(row, sales_h, bank_records):
    biz_no = safe_string(row[sales_h.get("業務№", -1)])
    cust_no = safe_string(row[sales_h.get("顧客№", -1)])
    amount = to_number(row[sales_h.get("照合基準額", -1)]) or to_number(row[sales_h.get("売上総計", -1)])
    due_date = row[sales_h.get("入金予定日", -1)]
    customer_name = safe_string(row[sales_h.get("顧客名", -1)])
    bill_to = safe_string(row[sales_h.get("請求先名", -1)])
    norm_customer = normalize_compare_name(customer_name)
    norm_bill_to = normalize_compare_name(bill_to)
    best = None
    best_score = -1

    for bank in bank_records:
        if bank["amount"] <= 0 or not bank["insuranceLike"]:
            continue
        score = 0
        if biz_no and bank["bizNo"] == biz_no:
            score += 220
        if cust_no and bank["custNo"] == cust_no:
            score += 120
        if amount and bank["amount"] == amount:
            score += 140
        elif amount and abs(bank["amount"] - amount) <= MICRO_DIFF_MAX:
            score += 80
        due_diff = calc_date_diff_days(bank["date"], due_date)
        if due_diff is not None:
            if due_diff == 0:
                score += 90
            elif due_diff <= 7:
                score += 40
            elif due_diff <= 30:
                score += 15
        bank_text = normalize_compare_name(bank["summary"])
        if norm_customer and norm_customer in bank_text:
            score += 50
        if norm_bill_to and norm_bill_to in bank_text:
            score += 20
        if score > best_score:
            best = bank
            best_score = score
    return best


def build_operational_view_rows(bank_rows, sales_rows):
    bank_header = bank_rows[0]
    bank_h = get_header_map(bank_header)
    sales_header = sales_rows[0]
    sales_h = get_header_map(sales_header)

    bank_records = []
    for raw in bank_rows[1:]:
        row = ensure_row_width(raw, len(bank_header))
        bank_records.append({
            "date": row[bank_h.get("日付", -1)],
            "summary": safe_string(row[bank_h.get("表示摘要", -1)]) or safe_string(row[bank_h.get("自摘要", -1)]) or safe_string(row[bank_h.get("相手摘要", -1)]),
            "amount": to_number(row[bank_h.get("金額", -1)]),
            "status": safe_string(row[bank_h.get("ステータス", -1)]),
            "bizNo": safe_string(row[bank_h.get("業務No.", -1)]),
            "custNo": safe_string(row[bank_h.get("顧客No.", -1)]),
            "insuranceLike": is_insurance_bank({
                "rawName": safe_string(row[bank_h.get("自摘要", -1)]),
                "fallbackName": safe_string(row[bank_h.get("相手摘要", -1)]),
                "subject": safe_string(row[bank_h.get("相手科目", -1)]),
            }),
        })

    normal_items = []
    conquest_items = []
    insurance_items = []

    for raw in sales_rows[1:]:
        row = ensure_row_width(raw, len(sales_header))
        biz_no = safe_string(row[sales_h.get("業務№", -1)])
        raw_date = date_key(row[sales_h.get("日付", -1)])
        due_date = date_key(row[sales_h.get("入金予定日", -1)])
        display_date = raw_date or due_date
        amount = to_number(row[sales_h.get("売上総計", -1)])
        paid_total = to_number(row[sales_h.get("入金累計", -1)])
        unpaid = to_number(row[sales_h.get("未入金額", -1)])
        customer_name = safe_string(row[sales_h.get("顧客名", -1)])
        bill_to = safe_string(row[sales_h.get("請求先名", -1)])
        if not (biz_no or customer_name or bill_to or amount or paid_total or unpaid):
            continue
        item = {
            "bizNo": biz_no,
            "date": display_date,
            "sourceDate": raw_date,
            "customerName": customer_name,
            "billTo": bill_to,
            "workType": safe_string(row[sales_h.get("作業大区分名", -1)]),
            "amount": amount,
            "expectedAmount": to_number(row[sales_h.get("照合基準額", -1)]) or amount,
            "grossProfit": to_number(row[sales_h.get("粗利益", -1)]) if sales_h.get("粗利益") is not None else 0,
            "custNo": safe_string(row[sales_h.get("顧客№", -1)]),
            "matchStatus": safe_string(row[sales_h.get("ステータス", -1)]),
            "paymentMethod": safe_string(row[sales_h.get("入金方法", -1)]),
            "dueDate": due_date,
            "paidTotal": paid_total,
            "unpaid": unpaid,
            "progressStatus": safe_string(row[sales_h.get("入金状況", -1)]) or "未入金",
            "alert": safe_string(row[sales_h.get("アラート", -1)]),
            "memo": safe_string(row[sales_h.get("確認メモ", -1)]),
            "specialType": safe_string(row[sales_h.get("特殊案件区分", -1)]),
            "serviceShop": safe_string(row[sales_h.get("整備店舗", -1)]) if sales_h.get("整備店舗") is not None else "",
            "row": row,
        }
        item["matchStatus"] = derive_visible_match_status(item)
        item["progressStatus"] = safe_string(row[sales_h.get("入金状況", -1)]) or derive_visible_progress_status(item)
        item["alert"] = item["alert"] or derive_visible_alert(item)
        bucket = resolve_special_bucket(item["billTo"], item["specialType"])
        if bucket == "conquest":
            conquest_items.append(item)
        elif bucket == "insurance":
            insurance_items.append(item)
        else:
            normal_items.append(item)

    normal_items.sort(key=lambda item: parse_date(item["date"]) or datetime(1900, 1, 1), reverse=True)
    conquest_items.sort(key=lambda item: parse_date(item["date"]) or datetime(1900, 1, 1), reverse=True)
    insurance_items.sort(key=lambda item: parse_date(item["date"]) or datetime(1900, 1, 1), reverse=True)

    case_rows = [
        ["案件一覧"],
        ["コンクエスト案件と保険立替案件を除いた通常案件の一覧です。通常の未入金・一部入金・要確認だけをここで見ます。"],
        ["状態", "件数", "", "", "見方"],
        ["対象件数", len(normal_items), "", "", "通常照合の対象として残っている案件数"],
        ["入金済", sum(1 for item in normal_items if item["progressStatus"] == "入金済"), "", "", "入金累計が予定額以上"],
        ["一部入金", sum(1 for item in normal_items if item["progressStatus"] == "一部入金"), "", "", "一部だけ入っている"],
        ["要確認", sum(1 for item in normal_items if item["progressStatus"] == "要確認"), "", "", "照合に人の確認が必要"],
        ["未入金", sum(1 for item in normal_items if item["progressStatus"] == "未入金"), "", "", "まだ入金実績が返っていない案件"],
        ["業務No", "日付", "顧客名", "請求先名", "作業区分", "売上総計", "顧客No", "照合ステータス", "入金方法", "入金予定日", "入金累計", "未入金額", "入金状況", "アラート", "確認メモ"],
    ]
    for item in normal_items:
        case_rows.append([
            item["bizNo"], item["date"], item["customerName"], item["billTo"], item["workType"], item["amount"],
            item["custNo"], item["matchStatus"], item["paymentMethod"], item["dueDate"], item["paidTotal"],
            item["unpaid"], item["progressStatus"], item["alert"], item["memo"]
        ])

    conquest_rows = [
        ["コンクエスト管理"],
        ["コンクエスト案件を通常案件から分離した管理ビューです。相殺・集約前提の案件をここで管理します。"],
        ["状態", "件数", "", "", "見方"],
        ["対象件数", len(conquest_items), "", "", "コンクエスト系として分離した案件数"],
        ["入金済", sum(1 for item in conquest_items if item["progressStatus"] == "入金済"), "", "", "個別に入金済み判定まで進んだ案件"],
        ["集約管理中", len(conquest_items) - sum(1 for item in conquest_items if item["progressStatus"] == "入金済"), "", "", "相殺・集約管理を前提に確認する案件"],
        ["業務No", "日付", "顧客名", "請求先名", "特殊区分", "CFラベル", "照合基準額", "入金予定日", "管理状況", "確認メモ"],
    ]
    for item in conquest_items:
        manage_status = "入金済" if item["progressStatus"] == "入金済" else "コンクエスト管理"
        memo = item["memo"]
        conquest_rows.append([
            item["bizNo"], item["date"], item["customerName"], item["billTo"], item["specialType"],
            derive_conquest_label(item["row"], sales_h), item["expectedAmount"], item["dueDate"], manage_status, memo
        ])

    insurance_rows = [
        ["保険立替管理"],
        ["保険会社名義の案件を通常案件から分離した管理ビューです。銀行候補と差額をここで確認します。"],
        ["状態", "件数", "", "", "見方"],
        ["対象件数", len(insurance_items), "", "", "保険会社請求先として分離した案件数"],
        ["候補あり", 0, "", "", "銀行側に近い候補入金が見つかった案件"],
        ["入金済", sum(1 for item in insurance_items if item["progressStatus"] == "入金済"), "", "", "案件側で入金済みになっている案件"],
        ["業務No", "日付", "顧客名", "請求先名", "照合基準額", "入金予定日", "案件状況", "候補入金日", "候補摘要", "候補額", "差額", "銀行状況", "確認メモ"],
    ]
    candidate_count = 0
    for item in insurance_items:
        candidate = find_insurance_candidate(item["row"], sales_h, bank_records)
        candidate_date = candidate["date"] if candidate else ""
        candidate_summary = candidate["summary"] if candidate else ""
        candidate_amount = candidate["amount"] if candidate else ""
        difference = abs(item["expectedAmount"] - candidate["amount"]) if candidate else ""
        bank_status = candidate["status"] if candidate else ""
        memo_parts = []
        if item["memo"]:
            memo_parts.append(item["memo"])
        if candidate:
            candidate_count += 1
            memo_parts.append(f"候補差額 {difference}円")
        insurance_rows.append([
            item["bizNo"], item["date"], item["customerName"], item["billTo"], item["expectedAmount"], item["dueDate"],
            item["progressStatus"], candidate_date, candidate_summary, candidate_amount, difference, bank_status,
            " / ".join(memo_parts)
        ])
    insurance_rows[4][1] = candidate_count

    return case_rows, conquest_rows, insurance_rows


def build_receivable_forecast(sales_rows):
    header = ["売上月", "入金予定月末", "コンクエスト請求ラベル", "コンクエスト請求額", "売掛請求ラベル", "売掛請求額", "保護フラグ"]
    sales_header = sales_rows[0]
    h = get_header_map(sales_header)
    forecast_map = {}
    for raw in sales_rows[1:]:
        row = ensure_row_width(raw, len(sales_header))
        if h.get("保護フラグ") is not None and is_truthy(row[h["保護フラグ"]]):
            continue
        progress = safe_string(row[h.get("入金状況", -1)])
        if progress == "入金済":
            continue
        sales_date = parse_date(row[h.get("日付", -1)])
        due_date = parse_date(row[h.get("入金予定日", -1)]) or (datetime(sales_date.year, sales_date.month, 28) if sales_date else None)
        if not sales_date or not due_date:
            continue
        reconcile_amount = to_number(row[h.get("照合基準額", -1)]) if h.get("照合基準額") is not None else 0
        expected_amount = reconcile_amount if reconcile_amount > 0 else to_number(row[h.get("売上総計", -1)])
        if expected_amount <= 0:
            continue
        customer_name = safe_string(row[h.get("顧客名", -1)])
        bill_to = safe_string(row[h.get("請求先名", -1)])
        service_shop = safe_string(row[h.get("整備店舗", -1)])
        work_type = safe_string(row[h.get("作業大区分名", -1)])
        gross_profit = to_number(row[h.get("粗利益", -1)]) if h.get("粗利益") is not None else 0
        sales_month = datetime(sales_date.year, sales_date.month, 1)
        due_end = datetime(due_date.year, due_date.month, 28) + timedelta(days=4)
        due_end = due_end - timedelta(days=due_end.day)
        normalized_bill = normalize_text(bill_to)

        if "MASERATI広島".upper() in normalize_text(service_shop):
            kind = "conquest"
            label = f"ｺﾝｸｴｽﾄ様ﾏｾﾗﾃｨ{sales_month.month}月分"
            amount = round(gross_profit * 1.1) if gross_profit > 0 else expected_amount
        elif normalized_bill in {normalize_text(CONQUEST_GROSS_VENDOR), normalize_text(CONQUEST_JLR_VENDOR)}:
            kind = "conquest"
            label = "ｺﾝｸｴｽﾄ様J&LR整備"
            amount = expected_amount
        elif normalized_bill == normalize_text(CONQUEST_SUM_VENDOR):
            kind = "conquest"
            label = "ｺﾝｸｴｽﾄ様J&LR営業部門"
            amount = expected_amount
        elif "コンクエスト" in normalize_text(bill_to):
            kind = "conquest"
            label = "コンクエスト＋" + (customer_name or bill_to)
            amount = expected_amount
        else:
            kind = "ar"
            label = bill_to or customer_name or work_type or "売掛"
            amount = expected_amount

        key = (sales_month.strftime("%Y/%m"), due_end.strftime("%Y/%m/%d"), kind, normalize_text(label))
        forecast_map.setdefault(key, {"salesMonth": sales_month, "dueDate": due_end, "kind": kind, "label": label, "amount": 0})
        forecast_map[key]["amount"] += amount

    rows = [header]
    items = list(forecast_map.values())
    items.sort(key=lambda item: (item["dueDate"], item["label"]))
    for item in items:
        rows.append([
            item["salesMonth"].strftime("%Y/%m/%d"),
            item["dueDate"].strftime("%Y/%m/%d"),
            item["label"] if item["kind"] == "conquest" else "",
            round(item["amount"]) if item["kind"] == "conquest" else "",
            item["label"] if item["kind"] == "ar" else "",
            round(item["amount"]) if item["kind"] == "ar" else "",
            "",
        ])
    return rows


def derive_visible_match_status(item):
    explicit = safe_string(item.get("matchStatus"))
    if explicit:
        return explicit
    expected = to_number(item.get("expectedAmount"))
    paid = to_number(item.get("paidTotal"))
    if expected > 0 and paid >= expected and paid > 0:
        return "入金済"
    if paid > 0:
        return "一部入金"
    if not item.get("date") and not item.get("dueDate"):
        return "案件情報不足"
    return "未照合"


def derive_visible_progress_status(item):
    status = safe_string(item.get("matchStatus"))
    total = to_number(item.get("amount"))
    paid = to_number(item.get("paidTotal"))
    if status == "要確認":
        return "要確認"
    if status == "案件情報不足":
        return "案件情報不足"
    if total > 0 and paid >= total:
        return "入金済"
    if paid > 0:
        return "一部入金"
    return "未入金"


def derive_visible_alert(item):
    if safe_string(item.get("matchStatus")) == "案件情報不足":
        return "案件情報不足"
    if safe_string(item.get("progressStatus")) == "入金済":
        return ""
    due_date = parse_date(item.get("dueDate"))
    if not due_date:
        return ""
    today = datetime.now(JST).replace(hour=0, minute=0, second=0, microsecond=0)
    diff_days = (due_date - today).days
    if diff_days < 0:
        return "期限超過"
    if diff_days <= 3:
        return "期限間近"
    return ""


def build_direction_rows(bank_rows):
    header = ["日付", "表示摘要", "自摘要", "相手摘要", "相手科目", "借方金額", "金額", "ステータス", "顧客No.", "業務No.", "入金月", "伝票種", "番号"]
    bank_header = bank_rows[0]
    h = get_header_map(bank_header)
    deposits = [header]
    withdrawals = [header]
    seen = set()
    for raw in bank_rows[1:]:
        row = ensure_row_width(raw, len(bank_header))
        amount = to_number(row[h.get("金額", -1)])
        voucher = normalize_voucher_type(row[h.get("伝票種", -1)], amount)
        display = safe_string(row[h.get("表示摘要", -1)]) or bank_display_summary(row[h.get("自摘要", -1)], row[h.get("相手摘要", -1)])
        subject = safe_string(row[h.get("相手科目", -1)])
        if is_excluded_income(display, subject, voucher):
            continue
        out = [
            safe_string(row[h.get("日付", -1)]),
            display,
            safe_string(row[h.get("自摘要", -1)]),
            safe_string(row[h.get("相手摘要", -1)]),
            subject,
            row[h.get("借方金額", -1)] if voucher == "入金" else row[h.get("貸方金額", -1)],
            abs(amount),
            safe_string(row[h.get("ステータス", -1)]),
            safe_string(row[h.get("顧客No.", -1)]),
            safe_string(row[h.get("業務No.", -1)]),
            safe_string(row[h.get("入金月", -1)]),
            voucher,
            safe_string(row[h.get("番号", -1)]),
        ]
        dedup = "|".join([date_key(out[0]), safe_string(out[11]), safe_string(out[6]), normalize_compare_name(out[1] or out[12])])
        if dedup in seen:
            continue
        seen.add(dedup)
        if amount > 0 or voucher == "入金":
            deposits.append(out)
        elif amount < 0 or voucher == "出金":
            withdrawals.append(out)
    return deposits, withdrawals


def history_rows_existing(rows):
    existing = set()
    if not rows:
        return existing
    for row in rows[1:]:
        if len(row) >= 3 and safe_string(row[2]):
            existing.add(safe_string(row[2]))
    return existing


def move_file(src, dst_dir):
    dst_dir.mkdir(parents=True, exist_ok=True)
    dst = dst_dir / src.name
    if dst.exists():
        stem, suffix = src.stem, src.suffix
        dst = dst_dir / f"{stem}__{datetime.now().strftime('%Y%m%d%H%M%S')}{suffix}"
    shutil.move(str(src), str(dst))
    return str(dst)


def import_bank_files(bank_rows, correction_rows, history_rows):
    existing_files = history_rows_existing(history_rows)
    bank_header = bank_rows[0]
    header_width = len(bank_header)
    header_map = get_header_map(bank_header)
    existing_records = []
    for raw in bank_rows[1:]:
        row = ensure_row_width(raw, header_width)
        existing_records.append({bank_header[i]: row[i] for i in range(header_width)})
    existing_keys = {bank_dedupe_key_from_record(rec): True for rec in existing_records}
    rules = load_bank_import_rules(correction_rows)
    imported = []
    history_add = []
    result_moves = {"success": [], "error": []}
    scanned = []

    for path in sorted(BANK_ROOT.iterdir()):
        if path.is_dir() or path.suffix.lower() != ".csv":
            continue
        scanned.append(path.name)
        is_already_logged = path.name in existing_files
        records, error = build_bank_records_from_csv(path, rules)
        imported_at = datetime.now().strftime("%Y/%m/%d %H:%M:%S")
        process_id = datetime.now().strftime("%Y%m%d%H%M%S") + "_" + re.sub(r"\W+", "_", path.name)
        if error:
            if not is_already_logged:
                history_add.append([process_id, imported_at, path.name, "", 0, "", "", "失敗", error, "エラー", "再実行待ち", ""])
            result_moves["error"].append(move_file(path, BANK_ROOT / "エラー"))
            continue

        new_count = 0
        skip_count = 0
        for record in records:
            key = bank_dedupe_key_from_record(record)
            if key and key in existing_keys:
                skip_count += 1
                continue
            existing_keys[key] = True
            record["取込処理ID"] = process_id
            record["取込ファイル名"] = path.name
            record["取込日時"] = imported_at
            imported.append(record)
            new_count += 1

        if not is_already_logged:
            history_add.append([process_id, imported_at, path.name, len(records), new_count, skip_count, 0, "成功", "", "読み取り済み", "", ""])
        result_moves["success"].append(move_file(path, BANK_ROOT / "読み取り済み"))

    merged_rows = merge_bank_rows(existing_records, imported, bank_header)
    return merged_rows, history_add, result_moves, scanned


def chunked_rows(rows, chunk_size=200):
    for i in range(0, len(rows), chunk_size):
        yield rows[i:i + chunk_size]


def write_sheet_values(access_token, spreadsheet_id, sheet_name, rows, max_columns=None):
    if not rows:
        return
    width = max(len(r) for r in rows)
    if max_columns:
        width = max(width, max_columns)
    col_end = column_letter(width)
    values_clear(access_token, spreadsheet_id, f"{sheet_name}!A:{col_end}")
    payloads = []
    for offset, chunk in enumerate(chunked_rows(rows, 200)):
        start_row = offset * 200 + 1
        payloads.append({"range": f"{sheet_name}!A{start_row}", "values": [ensure_row_width(r, width) for r in chunk]})
    values_batch_update(access_token, spreadsheet_id, payloads)


def column_letter(col_num):
    result = ""
    while col_num:
        col_num, rem = divmod(col_num - 1, 26)
        result = chr(65 + rem) + result
    return result


def update_visible_sheets(access_token, bank_rows, sales_rows):
    requests = [
        {"updateSheetProperties": {"properties": {"sheetId": MAIN_SHEET_IDS["銀行取込一覧"], "hidden": False}, "fields": "hidden"}},
        {"updateSheetProperties": {"properties": {"sheetId": MAIN_SHEET_IDS["銀行一覧"], "hidden": False}, "fields": "hidden"}},
        {"updateSheetProperties": {"properties": {"sheetId": MAIN_SHEET_IDS["案件一覧"], "hidden": False}, "fields": "hidden"}},
        {"updateSheetProperties": {"properties": {"sheetId": MAIN_SHEET_IDS["コンクエスト管理"], "hidden": False}, "fields": "hidden"}},
        {"updateSheetProperties": {"properties": {"sheetId": MAIN_SHEET_IDS["保険立替管理"], "hidden": False}, "fields": "hidden"}},
        {"updateSheetProperties": {"properties": {"sheetId": MAIN_SHEET_IDS["銀行要対応"], "hidden": True}, "fields": "hidden"}} if "銀行要対応" in MAIN_SHEET_IDS else None,
    ]
    requests = [req for req in requests if req]
    sheets_batch_update(access_token, MAIN_SPREADSHEET_ID, requests)

    bank_import_rows = [
        ["銀行取込一覧"],
        ["CSVから読み込んだ銀行原本です。自摘要を優先に、誰から・いつ・いくら入出金があったかをそのまま確認します。"],
        ["状態", "件数", "", "", "このシートの意味"],
        ["全件", "=COUNTA(A8:A)", "", "", "銀行CSVから読んだ全入出金を正規化して表示"],
        ["入金", '=COUNTIF(G8:G,"入金")', "", "", "案件照合の元になる入金行"],
        ["出金", '=COUNTIF(G8:G,"出金")', "", "", "支払い一覧へ渡す出金行"],
        ["日付", "表示摘要", "相手摘要", "自摘要", "相手科目", "金額", "区分", "ステータス", "顧客No", "業務No", "入金月", "番号", "取込ファイル"],
        ['=SORT(FILTER({\'銀行データチェック用\'!A2:A,\'銀行データチェック用\'!P2:P,\'銀行データチェック用\'!C2:C,\'銀行データチェック用\'!L2:L,\'銀行データチェック用\'!B2:B,\'銀行データチェック用\'!D2:D,\'銀行データチェック用\'!N2:N,\'銀行データチェック用\'!G2:G,\'銀行データチェック用\'!F2:F,\'銀行データチェック用\'!E2:E,\'銀行データチェック用\'!I2:I,\'銀行データチェック用\'!M2:M,\'銀行データチェック用\'!T2:T},\'銀行データチェック用\'!A2:A<>""),1,FALSE)']
    ]
    bank_list_rows = [
        ["銀行一覧"],
        ["入金があったものだけを抜き出し、誰から・いつ・いくら入金され、照合済みか要確認かを管理するシートです。"],
        ["状態", "件数", "", "", "この一覧の意味"],
        ["照合済み", '=COUNTIF(H8:H,"自動消込")+COUNTIF(H8:H,"手動消込")+COUNTIF(H8:H,"補正適用")', "", "", "案件と結びついた入金"],
        ["要確認", '=COUNTIF(H8:H,"要確認")', "", "", "人の確認が必要な入金"],
        ["未照合", '=COUNTIF(H8:H,"未照合")+COUNTIF(H8:H,"カード入金照合")', "", "", "まだ案件に結びついていない入金"],
        ["日付", "摘要", "金額", "区分", "取込ファイル", "業務No", "顧客No", "ステータス", "入金月", "確認メモ"],
        ['=SORT(FILTER({\'銀行取込一覧\'!A8:A,\'銀行取込一覧\'!B8:B,\'銀行取込一覧\'!F8:F,\'銀行取込一覧\'!G8:G,\'銀行取込一覧\'!M8:M,\'銀行取込一覧\'!J8:J,\'銀行取込一覧\'!I8:I,\'銀行取込一覧\'!H8:H,\'銀行取込一覧\'!K8:K,IFNA(VLOOKUP(TEXT(\'銀行取込一覧\'!A8:A,"yyyy/mm/dd")&"|"&\'銀行取込一覧\'!B8:B&"|"&TEXT(\'銀行取込一覧\'!F8:F,"0"),{TEXT(\'銀行要確認メモ\'!A2:A,"yyyy/mm/dd")&"|"&\'銀行要確認メモ\'!B2:B&"|"&TEXT(\'銀行要確認メモ\'!C2:C,"0"),\'銀行要確認メモ\'!F2:F},2,FALSE),"")},(\'銀行取込一覧\'!A8:A<>"")*(\'銀行取込一覧\'!G8:G="入金")*(\'銀行取込一覧\'!H8:H<>"対象外")),1,FALSE)']
    ]
    case_rows, conquest_rows, insurance_rows = build_operational_view_rows(bank_rows, sales_rows)
    write_sheet_values(access_token, MAIN_SPREADSHEET_ID, "銀行取込一覧", bank_import_rows, 13)
    write_sheet_values(access_token, MAIN_SPREADSHEET_ID, "銀行一覧", bank_list_rows, 10)
    write_sheet_values(access_token, MAIN_SPREADSHEET_ID, "案件一覧", case_rows, 15)
    write_sheet_values(access_token, MAIN_SPREADSHEET_ID, "コンクエスト管理", conquest_rows, 10)
    write_sheet_values(access_token, MAIN_SPREADSHEET_ID, "保険立替管理", insurance_rows, 13)


def main():
    access_token = load_access_token()

    main_data = values_batch_get(access_token, MAIN_SPREADSHEET_ID, [
        "銀行データチェック用!A:U",
        "振込入金リスト一覧!A:FB",
        "銀行文字補正学習!A:G",
        "※名義対応表!A:Z",
        "照合学習マスタ!A:P",
        "定期入金リスト!A:G",
        "取込履歴!A:L",
        "銀行要確認メモ!A:F",
    ])
    source_data = values_batch_get(access_token, SOURCE_SPREADSHEET_ID, [
        f"{SOURCE_SERVICE_SHEETS[0]}!1:800",
        f"{SOURCE_SERVICE_SHEETS[1]}!1:800",
        f"{SOURCE_VEHICLE_SHEET}!1:800",
    ])

    main_ranges = get_range_map(main_data["valueRanges"])
    source_ranges = get_range_map(source_data["valueRanges"])

    sales_rows = build_sales_rows(source_ranges, main_ranges["振込入金リスト一覧"])
    merged_bank_rows, history_add, moved, scanned = import_bank_files(
        main_ranges["銀行データチェック用"],
        main_ranges["銀行文字補正学習"],
        main_ranges["取込履歴"],
    )
    merged_bank_rows, sales_rows, review_memos = run_matching(
        merged_bank_rows,
        sales_rows,
        main_ranges["※名義対応表"],
        main_ranges["照合学習マスタ"],
        main_ranges["定期入金リスト"],
    )
    sales_rows = build_payment_progress(merged_bank_rows, sales_rows)
    forecast_rows = build_receivable_forecast(sales_rows)
    deposit_rows, withdrawal_rows = build_direction_rows(merged_bank_rows)

    history_rows = main_ranges["取込履歴"][:1] + main_ranges["取込履歴"][1:] + history_add if main_ranges["取込履歴"] else [["処理ID", "取込日時", "ファイル名", "対象行数", "成功行数", "スキップ行数", "失敗行数", "結果", "失敗理由", "移動先", "再実行状況", "メモ"]] + history_add
    review_header = main_ranges["銀行要確認メモ"][:1] if main_ranges["銀行要確認メモ"] else [["日付", "摘要", "金額", "状態", "候補案件", "確認メモ"]]
    review_rows = review_header + review_memos

    write_sheet_values(access_token, MAIN_SPREADSHEET_ID, "銀行データチェック用", merged_bank_rows, 21)
    write_sheet_values(access_token, MAIN_SPREADSHEET_ID, "振込入金リスト一覧", sales_rows, len(sales_rows[0]))
    write_sheet_values(access_token, MAIN_SPREADSHEET_ID, "売掛入金見込み管理", forecast_rows, 7)
    write_sheet_values(access_token, MAIN_SPREADSHEET_ID, "取込履歴", history_rows, 12)
    write_sheet_values(access_token, MAIN_SPREADSHEET_ID, "銀行要確認メモ", review_rows, 6)
    write_sheet_values(access_token, MAIN_SPREADSHEET_ID, "銀行入金一覧", deposit_rows, 13)
    write_sheet_values(access_token, MAIN_SPREADSHEET_ID, "銀行出金一覧", withdrawal_rows, 13)
    write_sheet_values(access_token, PAYMENT_SPREADSHEET_ID, "銀行データチェック用", withdrawal_rows, 21)
    update_visible_sheets(access_token, merged_bank_rows, sales_rows)

    result = {
        "scanned_bank_files": scanned,
        "moved": moved,
        "bank_rows": len(merged_bank_rows) - 1,
        "sales_rows": len(sales_rows) - 1,
        "forecast_rows": len(forecast_rows) - 1,
        "review_rows": len(review_rows) - 1,
        "deposit_rows": len(deposit_rows) - 1,
        "withdrawal_rows": len(withdrawal_rows) - 1,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
