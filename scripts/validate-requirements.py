#!/usr/bin/env python3
"""
validate-requirements.py
Purpose: Validate docs/TRACEABILITY.md integrity for TASK-0003.
Checks: duplicate IDs, invalid formats, invalid statuses, invalid DEC refs.
This script is read-only and does not modify any application or documentation files.
"""
import re
import os
from collections import Counter

def load_valid_decs():
    dec_path = 'docs/DECISIONS.md'
    if not os.path.exists(dec_path):
        return set()
    with open(dec_path, 'r', encoding='utf-8') as f:
        return set(re.findall(r'DEC-[A-Z0-9-]+', f.read()))

VALID_DEC = load_valid_decs()

INVALID_STATUS = {'BLOCKED', 'BACKLOG', 'READY', 'DONE'}
VALID_STATUS = {
    'DEFINED', 'DECISION_REQUIRED', 'READY_FOR_IMPLEMENTATION',
    'IMPLEMENTED', 'VERIFIED', 'DEFERRED'
}
ID_PATTERN = re.compile(r'^[A-Z0-9]+-[A-Z0-9]+-\d{3}$')

def validate():
    matrix_path = 'docs/TRACEABILITY.md'
    if not os.path.exists(matrix_path):
        print(f'ERROR: {matrix_path} not found.')
        return False

    with open(matrix_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    table_rows = [l.rstrip() for l in lines if l.strip().startswith('| `')]
    req_ids = []
    bad_status = []
    bad_dec = []
    bad_format = []

    for line in table_rows:
        parts = [p.strip() for p in line.split('|')[1:-1]]
        if len(parts) < 7:
            continue
        req_id = parts[0].strip('`')
        dec_col = parts[3]
        status = parts[6].strip('`').strip()

        req_ids.append(req_id)

        if not ID_PATTERN.match(req_id):
            bad_format.append(req_id)

        if status in INVALID_STATUS:
            bad_status.append((req_id, status))

        decs = re.findall(r'DEC-[A-Z0-9\\-]+', dec_col)
        for d in decs:
            if d not in VALID_DEC:
                bad_dec.append((req_id, d))

    counts = Counter(req_ids)
    duplicates = [i for i, c in counts.items() if c > 1]

    print(f'Total requirement IDs: {len(req_ids)}')
    print(f'Duplicates: {len(duplicates)} {duplicates}')
    print(f'Invalid formats: {len(bad_format)} {bad_format}')
    print(f'Invalid statuses: {len(bad_status)} {bad_status}')
    print(f'Invalid DEC refs: {len(bad_dec)} {bad_dec}')

    ok = not (duplicates or bad_format or bad_status or bad_dec)
    if ok:
        print('VALIDATION PASSED: All requirement IDs and traceability entries are valid.')
    else:
        print('VALIDATION FAILED: Review errors above.')
    return ok

if __name__ == '__main__':
    validate()
