import csv, io, json, re, sys, urllib.request, zipfile
from datetime import datetime
from pathlib import Path

SYNC_ROOT = Path('/Users/hasegawaryou11/Library/CloudStorage/GoogleDrive-r.hasegawa@ec-centric.com/.shortcut-targets-by-id/1YPsijuYb7uu4_Xu-XXtZ9touETZ41r-z/経理関係各種ファイル保存')
SALES_SNAPSHOT = Path('/Users/hasegawaryou11/Downloads/Cursol/target.csv')
BANK_HEADER_ROW = [
    '日付','相手科目','相手摘要','金額','業務No.','顧客No.','ステータス','入金月',
    'カード会社振り込み','カード照合額','自摘要','番号','伝票種','取引先','表示摘要',
    '借方金額','貸方金額','取込処理ID','取込ファイル名','取込日時'
]
SALES_EXTRA_HEADERS = ['入金予定日','入金累計','未入金額','入金状況','アラート','確認メモ']

BANK_FILES = [
    ("20260508.2hori .xlsx.csv","1lFKZZdiOrbO2rn4LZlZP4FtHG-O5Kbc-",str(SYNC_ROOT / '02_発展会計csv' / '20260508.2hori .xlsx.csv')),
    ("20260508.1hori .xlsx.csv","1-0mQpIYnScT5LVqgBAgxWpdZ2c0p7UAm",str(SYNC_ROOT / '02_発展会計csv' / '20260508.1hori .xlsx.csv')),
    ("20260507.2hori .xlsx.csv","1JHBHYXLzqcRjB3fF7UHAtntruEiEa_iH",str(SYNC_ROOT / '02_発展会計csv' / '20260507.2hori .xlsx.csv')),
    ("20260507.1hori .xlsx.csv","1aLiphjgJ2UH1Uu0YJlG7Zx2rnOwoTa0u",str(SYNC_ROOT / '02_発展会計csv' / '20260507.1hori .xlsx.csv')),
    ("20260430.2hori .xlsx.csv","1v3GHZWvZ3FGiT0iRrFHYYIz3ofYqXXY1",str(SYNC_ROOT / '02_発展会計csv' / '20260430.2hori .xlsx.csv')),
    ("20260430.1hori .xlsx.csv","1inRGmkYKXd6_cXl7JMjLF2iFdGHU7OHN",str(SYNC_ROOT / '02_発展会計csv' / '20260430.1hori .xlsx.csv')),
]
SEIBI_FILES = [
    ("seibireport (20260430).csv","1Wj_yu8Qat79LFUJ28t1IW1XUbaHW7ERD",str(SYNC_ROOT / '01_売掛残高一覧表csv' / 'seibireport (20260430).csv')),
    ("seibireport (20260501-1).csv","1Cg61SqVnNnROn4exPiamu3YcMetpZP5j",str(SYNC_ROOT / '01_売掛残高一覧表csv' / 'seibireport (20260501-1).csv')),
    ("seibireport (2026.0427).csv","1Jb9dFZxUETyhK_cxjHlLXk7GJC78TXFx",str(SYNC_ROOT / '01_売掛残高一覧表csv' / 'seibireport (2026.0427).csv')),
]

OUTDIR = Path('_tmp_import_run')
OUTDIR.mkdir(exist_ok=True)

BUILTIN_REPLACEMENTS = [
    ('業務��', '業務№'),
    ('宮�ｱ　亜希子', '宮﨑　亜希子'),
    ('�繻ｴ　裕樹', '桒原　裕樹'),
    ('�肝ﾞﾘｯｼﾞ本社', '㈱ﾌﾞﾘｯｼﾞ本社'),
    ('車台��', '車台№'),
    ('顧客��', '顧客№'),
    ('仕入��', '仕入№'),
    ('在納点A-�B', '在納点A-③'),
    ('在庫車B-�@', '在庫車B-①'),
    ('新納点A-�@', '新納点A-①'),
]


def fetch_bytes(url):
    if str(url).startswith('/'):
        return Path(url).read_bytes()
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def safe_string(value):
    if value is None:
        return ''
    if isinstance(value, datetime):
        return value.strftime('%Y/%m/%d')
    return str(value).strip()


def parse_number(value):
    text = safe_string(value).replace(',', '')
    if not text:
        return 0
    try:
        return int(round(float(text)))
    except Exception:
        return 0


def apply_builtin(text):
    result = safe_string(text)
    for src, dst in BUILTIN_REPLACEMENTS:
        result = result.replace(src, dst)
    return result


def normalize_header_key(value):
    text = apply_builtin(value)
    text = re.sub(r'[ 　\t\r\n]', '', text)
    text = re.sub(r'No\.', '№', text, flags=re.I)
    text = re.sub(r'No', '№', text, flags=re.I)
    return text


def normalize_wareki_date(value):
    text = safe_string(value)
    m = re.search(r'R\s*(\d{1,2})[\/／](\d{1,2})[\/／](\d{1,2})', text)
    if not m:
        return text
    y = 2018 + int(m.group(1))
    return f'{y:04d}/{int(m.group(2)):02d}/{int(m.group(3)):02d}'


def normalize_record_dates(record):
    for k, v in list(record.items()):
        if isinstance(v, str):
            record[k] = normalize_wareki_date(v)
    return record


def parse_date_text(value):
    if isinstance(value, datetime):
        return value.strftime('%Y/%m/%d')
    text = safe_string(value)
    if not text:
        return ''
    m = re.match(r'^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$', text)
    if not m:
        return text.replace('-', '/')
    return f'{int(m.group(1)):04d}/{int(m.group(2)):02d}/{int(m.group(3)):02d}'


def to_deposit_month(date_text):
    text = parse_date_text(date_text)
    m = re.match(r'^(\d{4})/(\d{2})/(\d{2})$', text)
    if not m:
        return ''
    return f'{int(m.group(1)):04d}/{int(m.group(2)):02d}'


def build_bank_duplicate_key(date_value, amount_value, partner_summary):
    date_text = parse_date_text(date_value)
    amount = parse_number(amount_value)
    partner = safe_string(partner_summary)
    return '|'.join([date_text, str(amount), partner])


def collect_mojibake_cells(record):
    out = []
    for k, v in record.items():
        if k == '_meta':
            continue
        if isinstance(v, str) and '�' in v:
            out.append({'headerName': k, 'value': v})
    return out


def decode_csv(raw, encodings):
    last = None
    for enc in encodings:
        try:
            text = raw.decode(enc)
            rows = list(csv.reader(io.StringIO(text)))
            if rows:
                return rows
        except Exception as e:
            last = e
    raise last or RuntimeError('CSV decode failed')


def sheet_rows(ws):
    return [list(r) for r in ws.iter_rows(values_only=True)]


def build_header_map(headers):
    mp = {}
    for idx, h in enumerate(headers):
        key = normalize_header_key(h)
        if key:
            mp[key] = idx
    return mp


def load_learning_map(ws, target_sheet_name):
    rows = sheet_rows(ws)
    if len(rows) <= 1:
        return {}
    header = build_header_map(rows[0])
    required = ['読み取り日付','ファイル名','ファイルURL','該当シート','該当列','読取データ','正データ','判定理由']
    for h in required:
        if h not in header:
            raise RuntimeError(f'AI読み取り学習用 missing header {h}')
    out = {}
    for row in rows[1:]:
        sheet_value = safe_string(row[header['該当シート']]) if header['該当シート'] < len(row) else ''
        from_text = safe_string(row[header['読取データ']]) if header['読取データ'] < len(row) else ''
        to_text = safe_string(row[header['正データ']]) if header['正データ'] < len(row) else ''
        if sheet_value != target_sheet_name:
            continue
        if not from_text or not to_text:
            continue
        out[from_text] = to_text
    return out


def apply_learning_corrections(text, learning_map):
    result = safe_string(text)
    if not result:
        return result
    for src, dst in learning_map.items():
        if src and dst:
            result = result.replace(src, dst)
    return result


def apply_mojibake_corrections_to_record(record, learning_map):
    corrected = {}
    for k, v in record.items():
        if isinstance(v, (int, float, datetime)):
            corrected[k] = v
            continue
        text = apply_builtin(v)
        text = apply_learning_corrections(text, learning_map)
        corrected[k] = text
    return corrected


def load_bank_manual_rules(ws):
    rows = sheet_rows(ws)
    if len(rows) <= 1:
        return []
    header = build_header_map(rows[0])
    required = ['対象シート','対象列','誤読文字','正しい文字']
    for h in required:
        if h not in header:
            return []
    rules = []
    for row in rows[1:]:
        enabled = safe_string(row[header.get('有効',0)] if header.get('有効',0) < len(row) else '').upper()
        sheet_value = safe_string(row[header['対象シート']]) if header['対象シート'] < len(row) else ''
        target_header = safe_string(row[header['対象列']]) if header['対象列'] < len(row) else ''
        src = safe_string(row[header['誤読文字']]) if header['誤読文字'] < len(row) else ''
        dst = safe_string(row[header['正しい文字']]) if header['正しい文字'] < len(row) else ''
        mode = safe_string(row[header.get('置換方法',0)] if header.get('置換方法',0) < len(row) else '') or '部分一致'
        if enabled in ('N','FALSE'):
            continue
        if sheet_value and sheet_value != '銀行データチェック用':
            continue
        if not src or not dst:
            continue
        rules.append((target_header, src, dst, mode))
    return rules


def apply_bank_replacements(record, ai_map, manual_rules):
    out = dict(record)
    for key, val in list(out.items()):
        if key == '_meta':
            continue
        if isinstance(val, str):
            text = val
            for src, dst in ai_map.items():
                text = text.replace(src, dst)
            for target_header, src, dst, mode in manual_rules:
                if target_header and target_header != key:
                    continue
                if mode == '完全一致':
                    if text == src:
                        text = dst
                else:
                    text = text.replace(src, dst)
            out[key] = text
    return out


def load_existing_bank_keys(ws):
    rows = sheet_rows(ws)
    header = build_header_map(rows[0])
    keys = {}
    for row in rows[1:]:
        date_val = row[header['日付']] if header['日付'] < len(row) else ''
        amount_val = row[header['金額']] if header['金額'] < len(row) else ''
        partner_val = row[header['相手摘要']] if header['相手摘要'] < len(row) else ''
        key = build_bank_duplicate_key(date_val, amount_val, partner_val)
        if key:
            keys[key] = True
    return keys


def load_existing_business_nos(ws):
    rows = sheet_rows(ws)
    header = build_header_map(rows[0])
    idx = header.get('業務№')
    if idx is None:
        raise RuntimeError('業務№ header missing')
    values = {}
    for row in rows[1:]:
        key = safe_string(row[idx] if idx < len(row) else '')
        if key:
            values[key] = True
    return values


def build_record_from_csv_row(row, header_map):
    return {h: (row[idx] if idx < len(row) else '') for h, idx in header_map.items()}


def build_bank_import_records(csv_rows, existing_keys):
    header_map = build_header_map(csv_rows[0])
    data_rows = csv_rows[1:]
    records = []
    skipped = 0
    detected = 0
    for i, row in enumerate(data_rows, start=2):
        date_text = safe_string(row[header_map['日付']] if header_map.get('日付') is not None and header_map['日付'] < len(row) else '')
        partner = safe_string(row[header_map['相手摘要']] if header_map.get('相手摘要') is not None and header_map['相手摘要'] < len(row) else '')
        counter = safe_string(row[header_map['相手科目']] if header_map.get('相手科目') is not None and header_map['相手科目'] < len(row) else '')
        self_summary = safe_string(row[header_map['自摘要']] if header_map.get('自摘要') is not None and header_map['自摘要'] < len(row) else '')
        debit = parse_number(row[header_map['借方金額']] if header_map.get('借方金額') is not None and header_map['借方金額'] < len(row) else '')
        credit = parse_number(row[header_map['貸方金額']] if header_map.get('貸方金額') is not None and header_map['貸方金額'] < len(row) else '')
        entries = [
            {'amount': debit, 'voucherType': '入金', 'signedAmount': debit},
            {'amount': credit, 'voucherType': '出金', 'signedAmount': -credit if credit else 0},
        ]
        for entry in entries:
            if not entry['amount']:
                continue
            detected += 1
            dup_key = build_bank_duplicate_key(date_text, entry['signedAmount'], partner)
            if existing_keys.get(dup_key):
                skipped += 1
                continue
            existing_keys[dup_key] = True
            rec = {
                '日付': parse_date_text(date_text),
                '金額': entry['signedAmount'],
                '相手摘要': partner,
                '相手科目': counter,
                'ステータス': '未照合',
                '入金月': to_deposit_month(date_text),
                '取引先': partner or self_summary,
                '自摘要': self_summary,
                '伝票種': entry['voucherType'],
                '借方金額': debit or '',
                '貸方金額': credit or '',
                '表示摘要': self_summary or partner,
                '_meta': {'source_row_no': i, 'mojibake_cells': []},
            }
            rec['_meta']['mojibake_cells'] = collect_mojibake_cells(rec)
            records.append(rec)
    return {'records': records, 'skippedDuplicateCount': skipped, 'detectedEntryCount': detected}


def detect_bank_failure_reasons(build_result):
    reasons = []
    detected = int(build_result.get('detectedEntryCount', 0) or 0)
    records = build_result.get('records', [])
    record_count = len(records)
    dup = int(build_result.get('skippedDuplicateCount', 0) or 0)
    mojibake = sum(1 for r in records if r.get('_meta',{}).get('mojibake_cells'))
    if detected == 0:
        reasons.append('有効な入出金行を検出できませんでした')
    if record_count == 0 and dup > 0:
        reasons.append('重複取込の疑い')
    if mojibake > 0:
        reasons.append('文字化け検出')
    return reasons


def create_import_process_id(file_id, imported_at):
    return 'BANK_' + imported_at.strftime('%Y%m%d_%H%M%S') + '_' + file_id[:8]


def bank_history_row(process_id, imported_at, name, file_id, target_count, success_count, skip_count, failed_count, result, reason, dest, rerun):
    return [process_id, imported_at.strftime('%Y/%m/%d %H:%M:%S'), name, file_id, target_count, success_count, skip_count, failed_count, result, reason, dest, rerun]


def build_seibi_records(csv_rows, file_name, sheet_header_map, existing_business_nos, learning_map):
    rows = [r[:] for r in csv_rows]
    rows[0] = [normalize_header_key(h) for h in rows[0]]
    csv_header = build_header_map(rows[0])
    imported_at = datetime.now()
    records = []
    skipped = 0
    for idx, row in enumerate(rows[1:], start=2):
        raw_record = build_record_from_csv_row(row, csv_header)
        if not safe_string(raw_record.get('データ取り込み日')):
            raw_record['データ取り込み日'] = imported_at.strftime('%Y/%m/%d %H:%M:%S')
        if not safe_string(raw_record.get('OCR元ファイル名')):
            raw_record['OCR元ファイル名'] = file_name
        raw_record['ステータス'] = '未照合'
        normalized = apply_mojibake_corrections_to_record(raw_record, learning_map)
        normalize_record_dates(normalized)
        business_no = safe_string(normalized.get('業務№'))
        if business_no and existing_business_nos.get(business_no):
            skipped += 1
            continue
        if business_no:
            existing_business_nos[business_no] = True
        normalized['_meta'] = {'source_row_no': idx, 'file_name': file_name, 'mojibake_cells': collect_mojibake_cells(normalized)}
        records.append(normalized)
    return {'records': records, 'skippedDuplicateCount': skipped}


def serialize_row_for_sheet(record, header_order):
    row = []
    for h in header_order:
        if h == '_meta':
            continue
        v = record.get(h, '')
        if isinstance(v, datetime):
            row.append(v.strftime('%Y/%m/%d %H:%M:%S'))
        else:
            row.append(v)
    return row


def load_sales_snapshot():
    rows = decode_csv(SALES_SNAPSHOT.read_bytes(), ['utf-8-sig', 'utf-8', 'cp932', 'shift_jis'])
    header_row = [safe_string(v) for v in rows[0]]
    for extra in SALES_EXTRA_HEADERS:
        if extra not in header_row:
            header_row.append(extra)
    existing_business_nos = {}
    header_map = build_header_map(header_row)
    biz_idx = header_map.get('業務№')
    if biz_idx is not None:
        for row in rows[1:]:
            key = safe_string(row[biz_idx] if biz_idx < len(row) else '')
            if key:
                existing_business_nos[key] = True
    return header_row, existing_business_nos


def main():
    bank_header_row = BANK_HEADER_ROW[:]
    sales_header_row, existing_business_nos = load_sales_snapshot()
    sales_header_map = build_header_map(sales_header_row)
    existing_bank_keys = {}
    sales_learning = {}
    bank_ai_learning = {}
    bank_manual_rules = []

    bank_new = []
    sales_new = []
    history_rows = []
    learning_rows = []
    summary = {'bank': [], 'seibi': []}

    now_base = datetime.now()
    for idx, (name, file_id, url) in enumerate(BANK_FILES):
        imported_at = now_base.replace(microsecond=0)
        process_id = create_import_process_id(file_id, imported_at)
        raw = fetch_bytes(url)
        csv_rows = decode_csv(raw, ['shift_jis', 'utf-8', 'cp932'])
        build = build_bank_import_records(csv_rows, existing_bank_keys)
        reasons = detect_bank_failure_reasons(build)
        if reasons:
            for rec in build['records']:
                for item in rec.get('_meta', {}).get('mojibake_cells', []):
                    learning_rows.append([
                        imported_at.strftime('%Y/%m/%d %H:%M:%S'), name, '', '銀行データチェック用', item['headerName'], item['value'], '', '', '文字化けの疑いあり'
                    ])
            history_rows.append(bank_history_row(process_id, imported_at, name, file_id, '', 0, '', '', '失敗', ' / '.join(reasons), 'エラー', '再実行待ち'))
            summary['bank'].append({'file': name, 'status': 'failed', 'reasons': reasons, 'detected': build['detectedEntryCount'], 'records': len(build['records']), 'duplicates': build['skippedDuplicateCount']})
        else:
            records = []
            for rec in build['records']:
                out = {k: v for k, v in rec.items() if k != '_meta'}
                out['取込処理ID'] = process_id
                out['取込ファイル名'] = name
                out['取込日時'] = imported_at.strftime('%Y/%m/%d %H:%M:%S')
                out = apply_bank_replacements(out, bank_ai_learning, bank_manual_rules)
                records.append(out)
            bank_new.extend(records)
            history_rows.append(bank_history_row(process_id, imported_at, name, file_id, build['detectedEntryCount'], len(records), build['skippedDuplicateCount'], 0, '成功', '', '読み取り済み', ''))
            summary['bank'].append({'file': name, 'status': 'success', 'records': len(records), 'detected': build['detectedEntryCount'], 'duplicates': build['skippedDuplicateCount']})

    for name, file_id, url in sorted(SEIBI_FILES, key=lambda x: x[0]):
        raw = fetch_bytes(url)
        csv_rows = decode_csv(raw, ['utf-8-sig', 'utf-8', 'shift_jis', 'cp932'])
        build = build_seibi_records(csv_rows, name, sales_header_map, existing_business_nos, sales_learning)
        sales_new.extend([{k: v for k, v in rec.items() if k != '_meta'} for rec in build['records']])
        summary['seibi'].append({'file': name, 'status': 'success', 'records': len(build['records']), 'duplicates': build['skippedDuplicateCount']})

    # filter rows to known headers only
    bank_new_rows = [serialize_row_for_sheet(rec, bank_header_row) for rec in bank_new]
    sales_new_rows = [serialize_row_for_sheet(rec, sales_header_row) for rec in sales_new]

    OUTDIR.joinpath('bank_new_rows.json').write_text(json.dumps(bank_new_rows, ensure_ascii=False, indent=2), encoding='utf-8')
    OUTDIR.joinpath('sales_new_rows.json').write_text(json.dumps(sales_new_rows, ensure_ascii=False, indent=2), encoding='utf-8')
    OUTDIR.joinpath('history_rows.json').write_text(json.dumps(history_rows, ensure_ascii=False, indent=2), encoding='utf-8')
    OUTDIR.joinpath('learning_rows.json').write_text(json.dumps(learning_rows, ensure_ascii=False, indent=2), encoding='utf-8')
    OUTDIR.joinpath('summary.json').write_text(json.dumps({
        'bank_success_files': sum(1 for x in summary['bank'] if x['status']=='success'),
        'bank_failed_files': sum(1 for x in summary['bank'] if x['status']=='failed'),
        'bank_new_rows': len(bank_new_rows),
        'seibi_new_rows': len(sales_new_rows),
        'history_rows': len(history_rows),
        'learning_rows': len(learning_rows),
        'bank_details': summary['bank'],
        'seibi_details': summary['seibi'],
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print(OUTDIR.joinpath('summary.json').read_text(encoding='utf-8'))

if __name__ == '__main__':
    main()
