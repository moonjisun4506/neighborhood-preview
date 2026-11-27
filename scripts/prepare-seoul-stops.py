"""Prepare the actual official XLSX without third-party Excel dependencies."""
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from collections import Counter
import json
import math

ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
metadata = json.loads(Path('data/transit/seoul-stops-provenance.json').read_text(encoding='utf-8'))
with ZipFile('data/transit/seoul-stops.xlsx') as archive:
    shared = [''.join(node.itertext()) for node in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('s:si', ns)]
    rows = ET.fromstring(archive.read('xl/worksheets/sheet1.xml')).findall('s:sheetData/s:row', ns)
    records, seen, excluded = [], set(), Counter()
    for row in rows[1:]:
        cells = {}
        for cell in row.findall('s:c', ns):
            value = cell.find('s:v', ns)
            text = value.text if value is not None else ''
            if cell.get('t') == 's':
                text = shared[int(text)]
            cells[''.join(c for c in cell.get('r', '') if c.isalpha())] = text
        if cells.get('F') == '한강선착장':
            excluded['river_pier'] += 1
            continue
        try:
            lng, lat = float(cells['D']), float(cells['E'])
            if not math.isfinite(lat) or not math.isfinite(lng) or not (33 <= lat <= 39 and 124 <= lng <= 132):
                raise ValueError('not verified WGS84 degrees')
            node_id, name = cells['A'].strip(), cells['C'].strip()
            if not node_id or not name or node_id in seen:
                raise ValueError('missing or duplicate stop identity')
        except (ValueError, KeyError):
            excluded['invalid'] += 1
            continue
        seen.add(node_id)
        records.append({'stationId': node_id, 'stationNm': name, 'arsId': cells.get('B', '').zfill(5), 'gpsX': lng, 'gpsY': lat, 'stationType': cells.get('F')})
    result = {**metadata, 'rawRows': len(rows)-1, 'excluded': dict(excluded), 'coordinateSystem': 'WGS84 longitude/latitude degrees (actual XLSX values)', 'stations': records}
    Path('src/data').mkdir(parents=True, exist_ok=True)
    Path('src/data/seoul-bus-stops.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(json.dumps({'rawRows': len(rows)-1, 'verifiedStops': len(records), 'excluded': dict(excluded)}))
