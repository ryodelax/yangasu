import csv
import json
import re
import shutil
from datetime import datetime
from pathlib import Path

import requests


SPREADSHEET_ID = "1wX6LR1ssqThgPAIHRyUNeuvROsnXqDMcwFbMCj1PB8M"
TMP_DIR = Path("/Users/hasegawaryou11/Downloads/Cursol/_tmp_import_run")
CLASP_RC = Path.home() / ".clasprc.json"
SALES_SNAPSHOT = Path("/Users/hasegawaryou11/Downloads/Cursol/target.csv")

SYNC_ROOT = Path(
    "/Users/hasegawaryou11/Library/CloudStorage/GoogleDrive-r.hasegawa@ec-centric.com/.shortcut-targets-by-id/1YPsijuYb7uu4_Xu-XXtZ9touETZ41r-z/経理関係各種ファイル保存"
)
BANK_ROOT = SYNC_ROOT / "02_発展会計csv"
SEIBI_ROOT = SYNC_ROOT / "01_売掛残高一覧表csv"

BANK_SUCCESS_FILES = [
    "20260508.2hori .xlsx.csv",
    "20260508.1hori .xlsx.csv",
    "20260507.2hori .xlsx.csv",
    "20260430.2hori .xlsx.csv",
    "20260430.1hori .xlsx.csv",
]
BANK_FAILED_FILES = ["20260507.1hori .xlsx.csv"]
SEIBI_SUCCESS_FILES = [
    "seibireport (20260430).csv",
    "seibireport (20260501-1).csv",
    "seibireport (2026.0427).csv",
]

BUSINESS_NO_RE = re.compile(r"\b([A-Z]{2})(\d{4,8})\b")
CARD_KEYWORDS = ("オリコ", "カード", "チユウギンカード", "VIS", "VISA", "JCB", "MASTER", "AMEX")
INSURANCE_KEYWORDS = ("ミツイスミトモ", "三井住友", "損保", "ソンポ")
INTERNAL_KEYWORDS = ("資金移動", "コンクエスト", "ブリツジ", "橋本商事")


def load_token():
    cfg = json.loads(CLASP_RC.read_text())
    token = cfg["tokens"]["default"]
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
    resp = requests.request(method, url, headers=headers, timeout=60, **kwargs)
    resp.raise_for_status()
    if resp.text:
        return resp.json()
    return {}


def values_get(access_token, a1_range):
    quoted = requests.utils.quote(a1_range, safe="!:'")
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/{quoted}"
    return api_request("GET", url, access_token)


def values_append(access_token, a1_range, values):
    quoted = requests.utils.quote(a1_range, safe="!:'")
    url = (
        f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values/"
        f"{quoted}:append"
    )
    return api_request(
        "POST",
        url,
        access_token,
        params={"valueInputOption": "USER_ENTERED", "insertDataOption": "INSERT_ROWS"},
        json={"values": values, "majorDimension": "ROWS"},
    )


def values_batch_update(access_token, data):
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}/values:batchUpdate"
    return api_request(
        "POST",
        url,
        access_token,
        json={"valueInputOption": "USER_ENTERED", "data": data},
    )


def load_json(name):
    return json.loads((TMP_DIR / name).read_text())


def parse_sales_amount(value):
    if value in ("", None):
        return 0
    return int(str(value).replace(",", ""))


def load_sales_reference():
    with SALES_SNAPSHOT.open(newline="") as f:
        rows = list(csv.reader(f))
    header = rows[0]
    idx = {
        "業務№": header.index("業務№"),
        "顧客№": header.index("顧客№"),
        "顧客名": header.index("顧客名"),
        "請求先名": header.index("請求先名"),
        "売上総計": header.index("売上総計"),
    }
    sales = []
    for row in rows[1:]:
        if not row:
            continue
        sales.append(
            {
                "業務№": row[idx["業務№"]] if len(row) > idx["業務№"] else "",
                "顧客№": row[idx["顧客№"]] if len(row) > idx["顧客№"] else "",
                "顧客名": row[idx["顧客名"]] if len(row) > idx["顧客名"] else "",
                "請求先名": row[idx["請求先名"]] if len(row) > idx["請求先名"] else "",
                "売上総計": parse_sales_amount(row[idx["売上総計"]] if len(row) > idx["売上総計"] else ""),
            }
        )
    for row in load_json("sales_new_rows.json"):
        sales.append(
            {
                "業務№": row[0] if len(row) > 0 else "",
                "顧客№": row[113] if len(row) > 113 else "",
                "顧客名": row[4] if len(row) > 4 else "",
                "請求先名": row[5] if len(row) > 5 else "",
                "売上総計": parse_sales_amount(row[33] if len(row) > 33 else ""),
            }
        )
    mapping = {}
    for sale in sales:
        if sale["業務№"]:
            mapping.setdefault(sale["業務№"], []).append(sale)
    return mapping


def build_note(summary, sale_key="", sale=None):
    if "オリコ" in summary:
        return ("", "", "オリコ集約入金。クレカ・現金側の締め期間で確認。")
    if "チユウギンカードVIS" in summary:
        return ("", "", "VISA集約入金。クレカ・現金側のVISA締め期間で確認。")
    if "チユウギンカードJCB" in summary:
        return ("", "", "JCB集約入金。クレカ・現金側のJCB締め期間で確認。")
    if any(k in summary for k in INSURANCE_KEYWORDS):
        return ("", "", "保険会社系の入金候補。請求書発行・保険請求案件を確認。")
    if "橋本商事" in summary or "A’crews" in summary or "A'crews" in summary:
        return ("", "", "既存同摘要の入金履歴あり。重複入金か別案件か確認。")
    if sale_key.startswith("SB") and sale is None:
        return (sale_key, "", f"{sale_key} は案件リスト未登録。案件CSVの追加入力または番号記載漏れを確認。")
    if sale_key.startswith("CH"):
        return (sale_key, "", f"{sale_key} 候補だが案件リスト未登録。請求書発行または案件ソースを確認。")
    return ("", "", "入金候補あり。案件ソースと照合して確定。")


def classify_bank_rows():
    sales_by_no = load_sales_reference()
    bank_rows = load_json("bank_new_rows.json")
    notes = []
    exact_matches = {}
    processed = []
    for row in bank_rows:
        row = list(row)
        date_str = row[0]
        subject = row[1]
        summary = " ".join(str(x) for x in [row[2], row[10], row[13], row[14]] if x)
        amount = int(row[3])
        status = "要確認"
        note_triplet = None
        matched_sale = None
        matched_key = ""

        match = BUSINESS_NO_RE.search(summary)
        if match:
            prefix, num = match.groups()
            matched_key = prefix + num.zfill(8)
            hits = sales_by_no.get(matched_key, [])
            if prefix == "SB" and len(hits) == 1 and hits[0]["売上総計"] == amount:
                matched_sale = hits[0]
                row[4] = hits[0]["業務№"]
                row[5] = hits[0]["顧客№"]
                status = "自動消込"
                exact_matches[hits[0]["業務№"]] = {"amount": amount, "date": date_str}
            else:
                note_triplet = build_note(summary, matched_key, hits[0] if hits else None)

        if status != "自動消込":
            if amount < 0:
                status = "対象外"
            elif subject in ("普通預金", "普通預金(入金)", "短期借入金"):
                status = "対象外"
            elif "コンクエスト" in summary and "該当なし" in summary:
                status = "対象外"
            elif note_triplet is None and any(k in summary for k in CARD_KEYWORDS + INSURANCE_KEYWORDS + INTERNAL_KEYWORDS):
                note_triplet = build_note(summary, matched_key, matched_sale)
            elif note_triplet is None and subject == "売掛金":
                note_triplet = build_note(summary, matched_key, matched_sale)

            if status != "対象外":
                status = "要確認"

        row[6] = status
        processed.append(row)

        if status == "要確認":
            candidate_business, candidate_customer, message = note_triplet or build_note(summary, matched_key, matched_sale)
            notes.append(
                [
                    date_str,
                    row[2],
                    amount,
                    candidate_business,
                    candidate_customer,
                    message,
                ]
            )
    return processed, notes, exact_matches


def mark_exact_matches_in_new_sales(exact_matches):
    rows = load_json("sales_new_rows.json")
    updated = []
    for row in rows:
        row = list(row)
        business_no = row[0] if row else ""
        if business_no in exact_matches:
            amount = exact_matches[business_no]["amount"]
            date_str = exact_matches[business_no]["date"]
            while len(row) < 151:
                row.append("")
            row[143] = "自動消込"
            row[144] = "振り込み"
            row[146] = amount
            row[147] = 0
            row[148] = "入金済"
            row[150] = f"銀行入金 {date_str} {amount:,}"
        updated.append(row)
    return updated


def current_history_files(access_token):
    values = values_get(access_token, "取込履歴!C2:C1000").get("values", [])
    return {row[0] for row in values if row}


def column_to_a1(idx_zero_based):
    n = idx_zero_based + 1
    out = ""
    while n:
        n, rem = divmod(n - 1, 26)
        out = chr(65 + rem) + out
    return out


def update_exact_sales_rows(access_token, exact_matches):
    col_start = column_to_a1(143)
    col_end = column_to_a1(150)
    values = values_get(access_token, "振込入金リスト一覧!A2:A400").get("values", [])
    row_by_business = {row[0]: idx + 2 for idx, row in enumerate(values) if row and row[0]}
    data = []
    for business_no, match in exact_matches.items():
        row_no = row_by_business.get(business_no)
        if not row_no:
            continue
        data.append(
            {
                "range": f"振込入金リスト一覧!{col_start}{row_no}:{col_end}{row_no}",
                "values": [
                    [
                        "自動消込",
                        "振り込み",
                        "",
                        match["amount"],
                        0,
                        "入金済",
                        "",
                        f"銀行入金 {match['date']} {match['amount']:,}",
                    ]
                ],
            }
        )
    if data:
        values_batch_update(access_token, data)
    return data


def safe_move(src, dst_dir):
    src = Path(src)
    dst_dir.mkdir(parents=True, exist_ok=True)
    dst = dst_dir / src.name
    if dst.exists():
        stem = src.stem
        suffix = src.suffix
        dst = dst_dir / f"{stem}__{datetime.now().strftime('%Y%m%d%H%M%S')}{suffix}"
    shutil.move(str(src), str(dst))
    return str(dst)


def move_files():
    moved = {"bank_done": [], "bank_error": [], "seibi_done": []}
    for name in BANK_SUCCESS_FILES:
        moved["bank_done"].append(
            safe_move(BANK_ROOT / name, BANK_ROOT / "読み取り済み")
        )
    for name in BANK_FAILED_FILES:
        moved["bank_error"].append(
            safe_move(BANK_ROOT / name, BANK_ROOT / "エラー")
        )
    for name in SEIBI_SUCCESS_FILES:
        moved["seibi_done"].append(
            safe_move(SEIBI_ROOT / name, SEIBI_ROOT / "読み取り済み")
        )
    return moved


def main():
    access_token = load_token()
    existing_history = current_history_files(access_token)
    target_files = set(BANK_SUCCESS_FILES + BANK_FAILED_FILES + SEIBI_SUCCESS_FILES)
    duplicates = sorted(existing_history & target_files)
    if duplicates:
        raise SystemExit(f"取込履歴に既存ファイルあり。重複防止で中止: {duplicates}")

    bank_rows, note_rows, exact_matches = classify_bank_rows()
    sales_rows = mark_exact_matches_in_new_sales(exact_matches)
    history_rows = load_json("history_rows.json")

    append_results = {
        "bank": values_append(access_token, "銀行データチェック用!A:T", bank_rows),
        "sales": values_append(access_token, "振込入金リスト一覧!A:EU", sales_rows),
        "history": values_append(access_token, "取込履歴!A:L", history_rows),
        "notes": values_append(access_token, "銀行要確認メモ!A:F", note_rows),
    }

    sales_updates = update_exact_sales_rows(access_token, exact_matches)

    verification = {
        "bank_tail": values_get(access_token, "銀行データチェック用!A117:T125").get("values", []),
        "sales_tail": values_get(access_token, "振込入金リスト一覧!A150:EU160").get("values", []),
        "history_tail": values_get(access_token, "取込履歴!A1:L12").get("values", []),
        "notes_tail": values_get(access_token, "銀行要確認メモ!A1:F30").get("values", []),
    }

    moved = move_files()

    result = {
        "bank_rows": len(bank_rows),
        "sales_rows": len(sales_rows),
        "history_rows": len(history_rows),
        "note_rows": len(note_rows),
        "exact_matches": exact_matches,
        "sales_updates": sales_updates,
        "append_updates": {
            k: v.get("updates", {}) if isinstance(v, dict) else v for k, v in append_results.items()
        },
        "moved": moved,
        "verification": verification,
    }
    out = TMP_DIR / "live_apply_result.json"
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
