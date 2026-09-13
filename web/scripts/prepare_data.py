import urllib.request
import json
import os
import math

try:
    import pycountry
except ImportError:
    pycountry = None

try:
    from babel import Locale
    KO_LOCALE = Locale('ko')
except ImportError:
    KO_LOCALE = None

# 국가 경계(도형) 소스
# - 110m: 177개국 기본 목록 (전체 국가 로스터의 기준)
# - 50m : 프리셋/주요 비교 대상국 도형 상향용 (R-10)
# - 10m : 대한민국 전용 상세 도형 - 제주도/울릉도/독도 포함 (R-11)
NE_110M_URL = "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/cultural/ne_110m_admin_0_countries.json"
NE_50M_URL = "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/50m/cultural/ne_50m_admin_0_countries.json"
NE_10M_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson"

# 공식 면적(km²)·한글명·수도 사전 (프리셋/주요 비교 대상국 우선 정확도 확보용)
# R-12: flag는 더 이상 여기서 하드코딩하지 않는다 - iso_a2로부터 기계적으로 생성한다.
COUNTRY_INFO = {
    "KOR": {"name_ko": "대한민국", "area_km2": 100432, "capital": "서울"},
    "PRK": {"name_ko": "북한", "area_km2": 120538, "capital": "평양"},
    "JPN": {"name_ko": "일본", "area_km2": 377975, "capital": "도쿄"},
    "CHN": {"name_ko": "중국", "area_km2": 9596961, "capital": "베이징"},
    "USA": {"name_ko": "미국", "area_km2": 9833517, "capital": "워싱턴 D.C."},
    "GBR": {"name_ko": "영국", "area_km2": 243610, "capital": "런던"},
    "FRA": {"name_ko": "프랑스", "area_km2": 551695, "capital": "파리"},
    "DEU": {"name_ko": "독일", "area_km2": 357022, "capital": "베를린"},
    "ITA": {"name_ko": "이탈리아", "area_km2": 301340, "capital": "로마"},
    "ESP": {"name_ko": "스페인", "area_km2": 505990, "capital": "마드리드"},
    "RUS": {"name_ko": "러시아", "area_km2": 17098246, "capital": "모스크바"},
    "CAN": {"name_ko": "캐나다", "area_km2": 9984670, "capital": "오타와"},
    "GRL": {"name_ko": "그린란드", "area_km2": 2166086, "capital": "누크"},
    "AUS": {"name_ko": "호주", "area_km2": 7692024, "capital": "캔버라"},
    "BRA": {"name_ko": "브라질", "area_km2": 8515767, "capital": "브라질리아"},
    "IND": {"name_ko": "인도", "area_km2": 3287263, "capital": "뉴델리"},
    "VNM": {"name_ko": "베트남", "area_km2": 331212, "capital": "하노이"},
    "IDN": {"name_ko": "인도네시아", "area_km2": 1904569, "capital": "자카르타"},
    "PHL": {"name_ko": "필리핀", "area_km2": 300000, "capital": "마닐라"},
    "THA": {"name_ko": "태국", "area_km2": 513120, "capital": "방콕"},
    "MYS": {"name_ko": "말레이시아", "area_km2": 330803, "capital": "쿠알라룸푸르"},
    "SGP": {"name_ko": "싱가포르", "area_km2": 728, "capital": "싱가포르"},
    "NOR": {"name_ko": "노르웨이", "area_km2": 385207, "capital": "오슬로"},
    "SWE": {"name_ko": "스웨덴", "area_km2": 450295, "capital": "스톡홀름"},
    "FIN": {"name_ko": "핀란드", "area_km2": 338424, "capital": "헬싱키"},
    "DNK": {"name_ko": "덴마크", "area_km2": 42933, "capital": "코펜하겐"},
    "NLD": {"name_ko": "네덜란드", "area_km2": 41850, "capital": "암스테르담"},
    "BEL": {"name_ko": "벨기에", "area_km2": 30528, "capital": "브뤼셀"},
    "CHE": {"name_ko": "스위스", "area_km2": 41285, "capital": "베른"},
    "AUT": {"name_ko": "오스트리아", "area_km2": 83879, "capital": "빈"},
    "POL": {"name_ko": "폴란드", "area_km2": 312696, "capital": "바르샤바"},
    "UKR": {"name_ko": "우크라이나", "area_km2": 603550, "capital": "키이우"},
    "TUR": {"name_ko": "튀르키예", "area_km2": 783562, "capital": "앙카라"},
    "EGY": {"name_ko": "이집트", "area_km2": 1002450, "capital": "카이로"},
    "ZAF": {"name_ko": "남아프리카 공화국", "area_km2": 1221037, "capital": "프리토리아"},
    "ARG": {"name_ko": "아르헨티나", "area_km2": 2780400, "capital": "부에노스아이레스"},
    "MEX": {"name_ko": "멕시코", "area_km2": 1964375, "capital": "멕시코시티"},
    "NZL": {"name_ko": "뉴질랜드", "area_km2": 268021, "capital": "웰링턴"},
    "SAU": {"name_ko": "사우디아라비아", "area_km2": 2149690, "capital": "리야드"},
    "IRN": {"name_ko": "이란", "area_km2": 1648195, "capital": "테헤란"},
    "IRQ": {"name_ko": "이라크", "area_km2": 438317, "capital": "바그다드"},
    "ISR": {"name_ko": "이스라엘", "area_km2": 20770, "capital": "예루살렘"},
    "MNG": {"name_ko": "몽골", "area_km2": 1564116, "capital": "울란바토르"},
    "KAZ": {"name_ko": "카자흐스탄", "area_km2": 2724900, "capital": "아스타나"},
    "CHL": {"name_ko": "칠레", "area_km2": 756102, "capital": "산티아고"},
    "COL": {"name_ko": "콜롬비아", "area_km2": 1141748, "capital": "보고타"},
    "PER": {"name_ko": "페루", "area_km2": 1285216, "capital": "리마"},
    "DZA": {"name_ko": "알제리", "area_km2": 2381741, "capital": "알제"},
    "COD": {"name_ko": "콩고 민주 공화국", "area_km2": 2344858, "capital": "킨샤사"},
    "NGA": {"name_ko": "나이지리아", "area_km2": 923768, "capital": "아부자"},
    "ETH": {"name_ko": "에티오피아", "area_km2": 1104300, "capital": "아디스아바바"},
    "KEN": {"name_ko": "케냐", "area_km2": 580367, "capital": "나이로비"},
    "MAD": {"name_ko": "마다가스카르", "area_km2": 587041, "capital": "안타나나리보"}
}

# R-11: 독도(동도·서도) 알려진 좌표 - 10m 소스에 독도 폴리곤이 없을 경우의 안전망.
# 각 섬을 아주 작은 사각형 폴리곤으로 근사한다 (실제 면적 표기에는 영향 없음 - area_km2는
# COUNTRY_INFO의 공식 통계치를 그대로 사용).
DOKDO_FALLBACK_POLYGONS = [
    # 서도(West Islet) 부근, 약 37.2417N 131.8622E
    [[[131.8615, 37.2405], [131.8615, 37.2429], [131.8639, 37.2429], [131.8639, 37.2405], [131.8615, 37.2405]]],
    # 동도(East Islet) 부근, 약 37.2429N 131.8664E
    [[[131.8657, 37.2417], [131.8657, 37.2441], [131.8681, 37.2441], [131.8681, 37.2417], [131.8657, 37.2417]]],
]

DOKDO_LON, DOKDO_LAT = 131.8664, 37.2429


def log(msg):
    print(f"[*] {msg}", flush=True)


def fetch_json(url, label):
    log(f"{label} 다운로드 중... ({url})")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode('utf-8'))


def normalize_iso(props):
    """
    ISO_A3/ISO_A2 정규화.
    Natural Earth 데이터는 미승인/분쟁 지역(예: 프랑스, 노르웨이, 코소보, 북키프로스,
    소말릴란드)에 대해 ISO_A3="-99"를 채워 넣는데, 그대로 두면 여러 국가가 같은
    "-99" 코드/피처 id를 공유하는 충돌이 생긴다(사소 항목). ADM0_A3(대체 코드) →
    pycountry 역조회 순서로 최대한 실제 코드를 복원하고, 그래도 없으면 빈 문자열로
    남겨 각 피처의 name_en으로 유일성을 확보한다.
    """
    iso_a3 = (props.get('ISO_A3') or props.get('ADM0_A3') or props.get('SOV_A3') or '').strip()
    iso_a2 = (props.get('ISO_A2') or '').strip()

    if not iso_a3 or iso_a3 == '-99':
        iso_a3 = (props.get('ADM0_A3') or '').strip()
    if iso_a3 == '-99':
        iso_a3 = ''

    if not iso_a2 or iso_a2 == '-99':
        iso_a2 = ''
        if pycountry and iso_a3:
            c = pycountry.countries.get(alpha_3=iso_a3)
            if c:
                iso_a2 = c.alpha_2

    return iso_a3, iso_a2


def flag_from_iso_a2(iso_a2):
    """
    R-12: 국기 이모지를 iso_a2 두 글자로부터 Regional Indicator Symbol
    (U+1F1E6 = 'A') 조합으로 기계 생성한다. 사전 하드코딩이 필요 없다.
    """
    if not iso_a2 or len(iso_a2) != 2 or not iso_a2.isalpha():
        return "🌐"
    code = iso_a2.upper()
    return ''.join(chr(0x1F1E6 + (ord(ch) - ord('A'))) for ch in code)


def korean_name(iso_a3, iso_a2, name_en):
    """
    R-12: name_ko 결정 우선순위
    1) COUNTRY_INFO 수동 사전(공식 표기가 필요한 51개 주요/프리셋국)
    2) babel(CLDR) 한국어 지역명 - ISO 3166 전수 커버
    3) 최후 수단으로 영문명
    """
    info = COUNTRY_INFO.get(iso_a3)
    if info and info.get('name_ko'):
        return info['name_ko']
    if KO_LOCALE and iso_a2:
        ko = KO_LOCALE.territories.get(iso_a2)
        if ko:
            return ko
    return name_en


def build_iso3_index(raw_features):
    index = {}
    for f in raw_features:
        props = f.get('properties', {})
        iso_a3, _ = normalize_iso(props)
        if iso_a3 and iso_a3 not in index:
            index[iso_a3] = f.get('geometry')
    return index


def round_coords(node, ndigits=4):
    """좌표 leaf(숫자 리스트)까지 재귀적으로 내려가 소수 자릿수를 제한해 용량을 줄인다."""
    if isinstance(node, list):
        if node and isinstance(node[0], (int, float)):
            return [round(v, ndigits) for v in node]
        return [round_coords(v, ndigits) for v in node]
    return node


def polygon_near(ring_coords, lon, lat, tolerance=0.3):
    lons = [c[0] for c in ring_coords]
    lats = [c[1] for c in ring_coords]
    return (min(lons) - tolerance <= lon <= max(lons) + tolerance and
            min(lats) - tolerance <= lat <= max(lats) + tolerance)


def has_dokdo(geometry):
    if not geometry or geometry.get('type') != 'MultiPolygon':
        return False
    for poly in geometry['coordinates']:
        if poly and polygon_near(poly[0], DOKDO_LON, DOKDO_LAT):
            return True
    return False


def has_area_near(geometry, lon, lat, tolerance=0.3):
    if not geometry:
        return False
    gtype = geometry.get('type')
    polys = geometry['coordinates'] if gtype == 'MultiPolygon' else [geometry['coordinates']]
    for poly in polys:
        if poly and polygon_near(poly[0], lon, lat, tolerance):
            return True
    return False


def build_korea_geometry(ne10m_index):
    """
    R-11: 한국 폴리곤을 10m 소스로 교체해 제주도·울릉도·독도를 포함한
    MultiPolygon으로 만든다. 독도가 소스에 없으면 알려진 좌표로 직접 추가한다.
    """
    kor_geom = ne10m_index.get('KOR')
    if not kor_geom:
        raise RuntimeError("10m 소스에서 KOR(대한민국) 지오메트리를 찾지 못했습니다.")

    if kor_geom.get('type') != 'MultiPolygon':
        # 방어적 처리: 어떤 이유로든 Polygon 단일 형태로 온 경우 MultiPolygon으로 승격
        kor_geom = {"type": "MultiPolygon", "coordinates": [kor_geom['coordinates']]}
    else:
        kor_geom = {"type": "MultiPolygon", "coordinates": list(kor_geom['coordinates'])}

    has_jeju = has_area_near(kor_geom, 126.5, 33.4)
    has_ulleung = has_area_near(kor_geom, 130.9, 37.5)
    log(f"한국 도형 확인 - 제주도 포함: {has_jeju}, 울릉도 포함: {has_ulleung}, 독도 포함: {has_dokdo(kor_geom)}")

    if not has_dokdo(kor_geom):
        log("[경고] 10m 소스에 독도 폴리곤이 없어 알려진 좌표(37.2429N 131.8664E 인근)로 직접 추가합니다.")
        kor_geom['coordinates'].extend(DOKDO_FALLBACK_POLYGONS)

    return kor_geom


# 구면 폴리곤 면적 근사 계산 (COUNTRY_INFO에 없는 국가의 표시 면적 자동 산출용)
def calculate_spherical_area(coords, geom_type):
    # WGS84 지구 반경 (km)
    R = 6371.0

    def ring_area(ring):
        if len(ring) < 3:
            return 0
        area = 0.0
        for i in range(len(ring)):
            p1 = ring[i]
            p2 = ring[(i + 1) % len(ring)]
            lon1, lat1 = math.radians(p1[0]), math.radians(p1[1])
            lon2, lat2 = math.radians(p2[0]), math.radians(p2[1])
            area += (lon2 - lon1) * (2 + math.sin(lat1) + math.sin(lat2))
        return abs(area * (R * R) / 2.0)

    total_area = 0.0
    if geom_type == "Polygon":
        if coords and len(coords) > 0:
            total_area += ring_area(coords[0])
            for hole in coords[1:]:
                total_area -= ring_area(hole)
    elif geom_type == "MultiPolygon":
        for poly in coords:
            if poly and len(poly) > 0:
                total_area += ring_area(poly[0])
                for hole in poly[1:]:
                    total_area -= ring_area(hole)
    return round(max(0.0, total_area))


def main():
    if pycountry is None:
        log("[경고] pycountry 미설치 - ISO 코드 역조회(France/Norway 등 -99 보정)가 제한됩니다. `pip install pycountry` 권장.")
    if KO_LOCALE is None:
        log("[경고] babel 미설치 - CLDR 한국어 지역명 전수 커버가 불가합니다. `pip install babel` 권장. COUNTRY_INFO 미등재국은 영문명으로 표시됩니다.")

    raw_110m = fetch_json(NE_110M_URL, "110m 전체 국가 목록(기준 로스터)")
    raw_50m = fetch_json(NE_50M_URL, "50m 주요국 도형(R-10 상향용)")
    raw_10m_full = fetch_json(NE_10M_URL, "10m 대한민국 상세 도형(R-11: 제주/울릉/독도)")

    ne50m_index = build_iso3_index(raw_50m['features'])
    ne10m_index = build_iso3_index(raw_10m_full['features'])
    korea_geom_10m = build_korea_geometry(ne10m_index)

    log(f"기준 국가 수 {len(raw_110m['features'])}개 로드 완료. 가공 시작...")

    processed_features = []
    used_ids = set()
    upgraded_50m_count = 0
    missing_ko_count = 0

    for f in raw_110m['features']:
        props = f.get('properties', {})
        iso_a3, iso_a2 = normalize_iso(props)
        name_en = props.get('NAME') or props.get('ADMIN') or ""
        continent = props.get('CONTINENT') or ""
        pop_est = int(props.get('POP_EST') or 0)

        geom = f.get('geometry')
        if iso_a3 == 'KOR':
            geom = korea_geom_10m
        elif iso_a3 in COUNTRY_INFO and iso_a3 in ne50m_index:
            # R-10: "프리셋/주요국"(COUNTRY_INFO에 등재된, 공식 면적을 직접 관리하는
            # 국가)만 선택적으로 50m로 상향한다. 나머지 126개국까지 전부 50m로
            # 올리면 번들 용량이 기존 대비 8배 이상(약 3.9MB) 불어나 "경량 오픈 데이터"
            # 취지에서 벗어나므로 의도적으로 범위를 제한한다.
            geom = ne50m_index[iso_a3]
            upgraded_50m_count += 1

        calculated_area = calculate_spherical_area(geom.get('coordinates', []), geom.get('type', ''))

        info = COUNTRY_INFO.get(iso_a3, {})
        name_ko = korean_name(iso_a3, iso_a2, name_en)
        if name_ko == name_en:
            missing_ko_count += 1
        area_km2 = info.get("area_km2", calculated_area)
        flag = flag_from_iso_a2(iso_a2)
        capital = info.get("capital", "")

        new_properties = {
            "iso_a3": iso_a3,
            "iso_a2": iso_a2,
            "name_en": name_en,
            "name_ko": name_ko,
            "area_km2": area_km2,
            "population": pop_est,
            "continent": continent,
            "flag": flag,
            "capital": capital
        }

        # 사소 항목 정리: id 충돌 방지 (iso_a3 정규화로 대부분 해소되지만, 혹시 모를
        # 잔여 충돌에 대한 방어적 유일화)
        feat_id = iso_a3 or name_en or f"NE_{len(processed_features)}"
        base_id, suffix = feat_id, 2
        while feat_id in used_ids:
            feat_id = f"{base_id}_{suffix}"
            suffix += 1
        used_ids.add(feat_id)

        processed_features.append({
            "type": "Feature",
            "id": feat_id,
            "properties": new_properties,
            "geometry": round_coords(geom)
        })

    output_geojson = {
        "type": "FeatureCollection",
        "features": processed_features
    }

    out_dir = os.path.join(os.path.dirname(__file__), "..", "public", "data")
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, "countries.geojson")

    with open(out_file, "w", encoding="utf-8") as out:
        json.dump(output_geojson, out, ensure_ascii=False)

    size_kb = os.path.getsize(out_file) / 1024
    log(f"생성 완료: {out_file}")
    log(f"총 국가 수: {len(processed_features)}개, 파일 크기: {size_kb:.1f} KB")
    log(f"50m 도형으로 상향된 국가(프리셋/주요국): {upgraded_50m_count}개 (+ 대한민국은 10m)")
    log(f"한글명 미확보(영문명 대체) 국가: {missing_ko_count}개")


if __name__ == "__main__":
    main()
