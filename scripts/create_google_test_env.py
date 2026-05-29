#!/usr/bin/env python3
import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request


SOURCES = {
    "sales": {
        "name": "営業用",
        "id": "1QNctVAnkattCX9dyT9DBmaPXWF9-nsfmZwEtEp4t1R8",
    },
    "intake": {
        "name": "【最新】入金一覧",
        "id": "1wX6LR1ssqThgPAIHRyUNeuvROsnXqDMcwFbMCj1PB8M",
    },
    "payments": {
        "name": "支払一覧",
        "id": "12Z7hFDO9f8JMTdVYqNCx_1QbgjXmoAqWYJDiUkakuHE",
    },
    "cashflow": {
        "name": "キャッシュフロー表0515",
        "id": "1KrtufPs4-1ZsEGPp9j9PCpYpg0knXGW5jMqospmI7UU",
    },
}

SETTINGS_SHEET = "システム設定"
SETTINGS_ROWS = [
    ["CF_TARGET_SPREADSHEET_ID", "", "CF反映先スプレッドシートID"],
    ["CF_ACTUAL_SOURCE_SPREADSHEET_ID", "", "銀行実績ソース（入金一覧）"],
    ["CF_RECEIVABLE_SOURCE_SPREADSHEET_ID", "", "売掛見込みソース（入金一覧）"],
    ["CF_PAYMENT_SOURCE_SPREADSHEET_ID", "", "支払い予定ソース（支払一覧）"],
]


def load_clasp_token():
    token_path = pathlib.Path.home() / ".clasprc.json"
    payload = json.loads(token_path.read_text())
    return payload["tokens"]["default"]


def refresh_access_token(token_info):
    body = urllib.parse.urlencode(
        {
            "client_id": token_info["client_id"],
            "client_secret": token_info["client_secret"],
            "refresh_token": token_info["refresh_token"],
            "grant_type": "refresh_token",
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["access_token"]


def json_request(url, access_token, method="GET", payload=None):
    body = None
    headers = {"Authorization": f"Bearer {access_token}"}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        raw = resp.read()
    return json.loads(raw.decode("utf-8")) if raw else {}


def copy_file(access_token, file_id, new_name):
    url = f"https://www.googleapis.com/drive/v3/files/{file_id}/copy?supportsAllDrives=true"
    data = json_request(url, access_token, method="POST", payload={"name": new_name})
    return {
        "id": data["id"],
        "name": new_name,
        "url": f"https://docs.google.com/spreadsheets/d/{data['id']}/edit",
    }


def get_sheet_metadata(access_token, spreadsheet_id):
    fields = urllib.parse.quote(
        "spreadsheetId,properties(title,timeZone),sheets(properties(sheetId,title,index))"
    )
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}?includeGridData=false&fields={fields}"
    return json_request(url, access_token)


def batch_update(access_token, spreadsheet_id, requests):
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}:batchUpdate"
    return json_request(url, access_token, method="POST", payload={"requests": requests})


def update_values(access_token, spreadsheet_id, rng, values):
    encoded_range = urllib.parse.quote(rng, safe="!:'")
    url = (
        f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/"
        f"{encoded_range}"
        "?valueInputOption=USER_ENTERED"
    )
    return json_request(
        url,
        access_token,
        method="PUT",
        payload={"range": rng, "majorDimension": "ROWS", "values": values},
    )


def ensure_settings_sheet(access_token, spreadsheet_id):
    meta = get_sheet_metadata(access_token, spreadsheet_id)
    for sheet in meta.get("sheets", []):
        props = sheet.get("properties", {})
        if props.get("title") == SETTINGS_SHEET:
            return props["sheetId"]

    result = batch_update(
        access_token,
        spreadsheet_id,
        [{"addSheet": {"properties": {"title": SETTINGS_SHEET}}}],
    )
    return result["replies"][0]["addSheet"]["properties"]["sheetId"]


def ensure_settings_rows(access_token, spreadsheet_id):
    ensure_settings_sheet(access_token, spreadsheet_id)
    update_values(
        access_token,
        spreadsheet_id,
        f"'{SETTINGS_SHEET}'!A1:C5",
        [["キー", "値", "メモ"], *SETTINGS_ROWS],
    )


def write_cashflow_settings(access_token, spreadsheet_id, copied):
    ensure_settings_rows(access_token, spreadsheet_id)
    values = [
        ["CF_TARGET_SPREADSHEET_ID", copied["cashflow"]["id"], "CF反映先スプレッドシートID"],
        ["CF_ACTUAL_SOURCE_SPREADSHEET_ID", copied["intake"]["id"], "銀行実績ソース（入金一覧）"],
        ["CF_RECEIVABLE_SOURCE_SPREADSHEET_ID", copied["intake"]["id"], "売掛見込みソース（入金一覧）"],
        ["CF_PAYMENT_SOURCE_SPREADSHEET_ID", copied["payments"]["id"], "支払い予定ソース（支払一覧）"],
    ]
    update_values(access_token, spreadsheet_id, f"'{SETTINGS_SHEET}'!A2:C5", values)


def write_manifest(access_token, spreadsheet_id, copied, tag):
    meta = get_sheet_metadata(access_token, spreadsheet_id)
    manifest_sheet_id = None
    for sheet in meta.get("sheets", []):
        props = sheet.get("properties", {})
        if props.get("title") == "テスト環境情報":
            manifest_sheet_id = props["sheetId"]
            break

    if manifest_sheet_id is None:
        batch_update(
            access_token,
            spreadsheet_id,
            [{"addSheet": {"properties": {"title": "テスト環境情報"}}}],
        )

    rows = [
        ["作成タグ", tag],
        ["種別", "元ファイル名", "複製ID", "複製URL"],
    ]
    for key in ("sales", "intake", "payments", "cashflow"):
        item = copied[key]
        rows.append([key, SOURCES[key]["name"], item["id"], item["url"]])

    update_values(access_token, spreadsheet_id, "'テスト環境情報'!A1:D6", rows)


def main():
    tag = time.strftime("%Y%m%d_%H%M%S")
    prefix = f"[TEST_2026-03_{tag}] "
    token_info = load_clasp_token()
    access_token = refresh_access_token(token_info)

    copied = {}
    for key in ("sales", "intake", "payments", "cashflow"):
        source = SOURCES[key]
        copied[key] = copy_file(access_token, source["id"], prefix + source["name"])

    write_cashflow_settings(access_token, copied["cashflow"]["id"], copied)
    write_manifest(access_token, copied["cashflow"]["id"], copied, prefix)

    print(json.dumps({"tag": prefix, "files": copied}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise
