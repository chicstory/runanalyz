"""Shared bilingual (Korean + English) search rules and strict adult-only matching for ShoeF."""

import re

GLOBAL_EXCLUDE_TOKENS = (
    "키즈",
    "주니어",
    "아동",
    "유아",
    "인펀트",
    "토들러",
    "베이비",
    "어린이",
    "초등",
    "칠드런",
    "양말",
    "가방",
    "모자",
    "의류",
    "재킷",
    "자켓",
    "티셔츠",
    "팬츠",
    "해외직구",
    "병행수입",
    "구매대행",
    "택일",
)

GLOBAL_EXCLUDE_EN_RE = re.compile(
    r"\b(?:KIDS?|JUNIOR|JR|INFANT|TODDLER|BABY|YOUTH|CHILDREN|GS|PS|TD|BG|BP|EL\s+[IC])\b",
    re.I,
)

# Each rule has:
# - queries: Korean and English search terms to try (all queried, lowest valid adult dept-store price wins)
# - token_groups: list of alternative-token lists; EVERY group must match at least one token (case-insensitive)
# - exclude: model-specific tokens to reject sibling/different models (case-insensitive)
SEARCH_RULES: dict[str, dict] = {
    # --- Nike (18) ---
    "nike-pegasus-42": {
        "queries": ["나이키 페가수스 42", "NIKE PEGASUS 42"],
        "token_groups": [["페가수스", "PEGASUS"], ["42"]],
        "exclude": ["플러스", "PLUS", "프리미엄", "PREMIUM", "트레일", "TRAIL", "터보", "TURBO", "GORE-TEX", "고어텍스", "GTX"],
    },
    "nike-pegasus-plus": {
        "queries": ["나이키 페가수스 플러스", "NIKE PEGASUS PLUS"],
        "token_groups": [["페가수스", "PEGASUS"], ["플러스", "PLUS"]],
        "exclude": ["41", "42", "프리미엄", "PREMIUM", "트레일", "TRAIL"],
    },
    "nike-pegasus-premium": {
        "queries": ["나이키 페가수스 프리미엄", "NIKE PEGASUS PREMIUM"],
        "token_groups": [["페가수스", "PEGASUS"], ["프리미엄", "PREMIUM"]],
        "exclude": ["플러스", "PLUS", "트레일", "TRAIL"],
    },
    "nike-vomero-18": {
        "queries": ["나이키 보메로 18", "NIKE VOMERO 18"],
        "token_groups": [["보메로", "VOMERO"], ["18"]],
        "exclude": ["SE", "플러스", "PLUS", "프리미엄", "PREMIUM", "GORE-TEX", "고어텍스", "GTX"],
    },
    "nike-vomero-18-se": {
        "queries": ["나이키 보메로 18 SE", "NIKE VOMERO 18 SE"],
        "token_groups": [["보메로", "VOMERO"], ["18"], ["SE"]],
        "exclude": ["플러스", "PLUS", "프리미엄", "PREMIUM"],
    },
    "nike-vomero-plus": {
        "queries": ["나이키 보메로 플러스", "NIKE VOMERO PLUS"],
        "token_groups": [["보메로", "VOMERO"], ["플러스", "PLUS"]],
        "exclude": ["프리미엄", "PREMIUM"],
    },
    "nike-vomero-premium": {
        "queries": ["나이키 보메로 프리미엄", "NIKE VOMERO PREMIUM"],
        "token_groups": [["보메로", "VOMERO"], ["프리미엄", "PREMIUM"]],
        "exclude": ["플러스", "PLUS"],
    },
    "nike-structure-26": {
        "queries": ["나이키 스트럭처 26", "NIKE STRUCTURE 26"],
        "token_groups": [["스트럭처", "STRUCTURE"], ["26"]],
        "exclude": ["플러스", "PLUS", "트레일", "TRAIL"],
    },
    "nike-structure-plus": {
        "queries": ["나이키 스트럭처 플러스", "NIKE STRUCTURE PLUS"],
        "token_groups": [["스트럭처", "STRUCTURE"], ["플러스", "PLUS"]],
        "exclude": ["25", "26"],
    },
    "nike-zoomfly-6": {
        "queries": ["나이키 줌 플라이 6", "NIKE ZOOM FLY 6"],
        "token_groups": [["줌", "ZOOM"], ["플라이", "FLY"], ["6"]],
        "exclude": ["라이벌", "RIVAL", "베이퍼", "VAPOR", "알파", "ALPHA", "스트릭", "STREAK"],
    },
    "nike-vaporfly-4": {
        "queries": ["나이키 베이퍼플라이 4", "NIKE VAPORFLY 4"],
        "token_groups": [["베이퍼플라이", "VAPORFLY"], ["4"]],
        "exclude": ["3", "알파", "ALPHA"],
    },
    "nike-alphafly-4": {
        "queries": ["나이키 알파플라이 4", "NIKE ALPHAFLY 4"],
        "token_groups": [["알파플라이", "ALPHAFLY"], ["4"]],
        "exclude": ["3", "베이퍼", "VAPOR"],
    },
    "nike-alphafly-3": {
        "queries": ["나이키 알파플라이 3", "NIKE ALPHAFLY 3"],
        "token_groups": [["알파플라이", "ALPHAFLY"], ["3"]],
        "exclude": ["4", "베이퍼", "VAPOR"],
    },
    "nike-streakfly-2": {
        "queries": ["나이키 스트릭플라이 2", "NIKE STREAKFLY 2"],
        "token_groups": [["스트릭플라이", "STREAKFLY"], ["2"]],
        "exclude": [],
    },
    "nike-winflow-12": {
        "queries": ["나이키 윈플로 12", "NIKE WINFLO 12"],
        "token_groups": [["윈플로", "WINFLO"], ["12"]],
        "exclude": ["11", "10", "GORE-TEX", "고어텍스", "GTX"],
    },
    "nike-quest-7": {
        "queries": ["나이키 퀘스트 7", "NIKE QUEST 7"],
        "token_groups": [["퀘스트", "QUEST"], ["7"]],
        "exclude": ["6", "5"],
    },
    "nike-journey-run": {
        "queries": ["나이키 저니 런", "NIKE JOURNEY RUN"],
        "token_groups": [["저니", "JOURNEY"], ["런", "RUN"]],
        "exclude": [],
    },
    "nike-rival-fly-4": {
        "queries": ["나이키 라이벌 플라이 4", "NIKE RIVAL FLY 4"],
        "token_groups": [["라이벌", "RIVAL"], ["플라이", "FLY"], ["4"]],
        "exclude": ["3", "와플", "WAFFLE"],
    },
    # --- Adidas (22) ---
    "adidas-adistar-3": {
        "queries": ["아디다스 아디스타 3", "ADIDAS ADISTAR 3"],
        "token_groups": [["아디스타", "ADISTAR"], ["3"]],
        "exclude": ["컨트롤", "CONTROL", "BYD", "CS", "메리제인", "MARY"],
    },
    "adidas-adistar-5": {
        "queries": ["아디다스 아디스타 5", "ADIDAS ADISTAR 5"],
        "token_groups": [["아디스타", "ADISTAR"], ["5"]],
        "exclude": ["컨트롤", "CONTROL", "BYD", "메리제인", "MARY"],
    },
    "adidas-adizero-adios-9": {
        "queries": ["아디다스 아디오스 9", "ADIDAS ADIZERO ADIOS 9"],
        "token_groups": [["아디오스", "ADIOS"], ["9"]],
        "exclude": ["프로", "PRO", "새티스파이", "SATISFY"],
    },
    "adidas-adizero-adios-pro-4": {
        "queries": ["아디다스 아디오스 프로 4", "ADIDAS ADIZERO ADIOS PRO 4"],
        "token_groups": [["아디오스", "ADIOS"], ["프로", "PRO"], ["4"]],
        "exclude": ["에보", "EVO", "5", "3"],
    },
    "adidas-adizero-adios-pro-5": {
        "queries": ["아디다스 아디오스 프로 5", "ADIDAS ADIZERO ADIOS PRO 5"],
        "token_groups": [["아디오스", "ADIOS"], ["프로", "PRO"], ["5"]],
        "exclude": ["에보", "EVO", "4"],
    },
    "adidas-adizero-adios-pro-evo-2": {
        "queries": ["아디다스 아디오스 프로 에보 2", "ADIDAS ADIZERO ADIOS PRO EVO 2"],
        "token_groups": [["아디오스", "ADIOS"], ["에보", "EVO"], ["2"]],
        "exclude": ["SL", "1"],
    },
    "adidas-adizero-adios-satisfy": {
        "queries": ["아디다스 아디오스 새티스파이", "ADIDAS ADIOS SATISFY"],
        "token_groups": [["아디오스", "ADIOS"], ["새티스파이", "SATISFY"]],
        "exclude": [],
    },
    "adidas-adizero-boston-12": {
        "queries": ["아디다스 보스턴 12", "ADIDAS ADIZERO BOSTON 12"],
        "token_groups": [["보스턴", "BOSTON"], ["12"]],
        "exclude": ["13", "11"],
    },
    "adidas-adizero-boston-13": {
        "queries": ["아디다스 보스턴 13", "ADIDAS ADIZERO BOSTON 13"],
        "token_groups": [["보스턴", "BOSTON"], ["13"]],
        "exclude": ["12", "EQT"],
    },
    "adidas-adizero-evo-sl": {
        "queries": ["아디다스 아디제로 에보 SL", "ADIDAS ADIZERO EVO SL"],
        "token_groups": [["아디제로", "ADIZERO"], ["에보", "EVO"], ["SL"]],
        "exclude": ["라이트블레이즈", "LIGHTBLAZE", "프로", "PRO", "ATR", "WOVEN"],
    },
    "adidas-adizero-prime-x3-strung": {
        "queries": ["아디다스 프라임 X3", "ADIDAS PRIME X3 STRUNG"],
        "token_groups": [["프라임", "PRIME"], ["X3", "X 3"]],
        "exclude": ["X2", "X 2"],
    },
    "adidas-adizero-sl-2": {
        "queries": ["아디다스 아디제로 SL2", "ADIDAS ADIZERO SL2"],
        "token_groups": [["아디제로", "ADIZERO"], ["SL2", "SL 2"]],
        "exclude": ["에보", "EVO", "라이트블레이즈", "LIGHTBLAZE", "보스턴", "BOSTON"],
    },
    "adidas-duramo-sl-2": {
        "queries": ["아디다스 듀라모 SL 2", "ADIDAS DURAMO SL2"],
        "token_groups": [["듀라모", "DURAMO"], ["SL"], ["2"]],
        "exclude": ["스피드", "SPEED", "RC"],
    },
    "adidas-duramo-speed-2": {
        "queries": ["아디다스 듀라모 스피드 2", "ADIDAS DURAMO SPEED 2"],
        "token_groups": [["듀라모", "DURAMO"], ["스피드", "SPEED"], ["2"]],
        "exclude": ["SL"],
    },
    "adidas-galaxy-8": {
        "queries": ["아디다스 갤럭시 8", "ADIDAS GALAXY 8"],
        "token_groups": [["갤럭시", "GALAXY"], ["8"]],
        "exclude": ["7", "6", "STAR"],
    },
    "adidas-hyperboost-edge": {
        "queries": ["아디다스 하이퍼부스트 엣지", "ADIDAS HYPERBOOST EDGE"],
        "token_groups": [["하이퍼부스트", "HYPERBOOST"], ["엣지", "EDGE"]],
        "exclude": [],
    },
    "adidas-runpalcon-5": {
        "queries": ["아디다스 런팔콘 5", "ADIDAS RUNFALCON 5"],
        "token_groups": [["런팔콘", "RUNFALCON"], ["5"]],
        "exclude": ["TR", "트레일", "3", "2"],
    },
    "adidas-supernova-ease-2": {
        "queries": ["아디다스 슈퍼노바 이즈 2", "ADIDAS SUPERNOVA EASE 2"],
        "token_groups": [["슈퍼노바", "SUPERNOVA"], ["이즈", "EASE"], ["2"]],
        "exclude": ["라이즈", "RISE", "프리마", "PRIMA"],
    },
    "adidas-supernova-prima-3": {
        "queries": ["아디다스 슈퍼노바 프리마 3", "ADIDAS SUPERNOVA PRIMA 3"],
        "token_groups": [["슈퍼노바", "SUPERNOVA"], ["프리마", "PRIMA"], ["3"]],
        "exclude": ["라이즈", "RISE", "이즈", "EASE"],
    },
    "adidas-supernova-rise-2": {
        "queries": ["아디다스 슈퍼노바 라이즈 2", "ADIDAS SUPERNOVA RISE 2"],
        "token_groups": [["슈퍼노바", "SUPERNOVA"], ["라이즈", "RISE"], ["2"]],
        "exclude": ["3", "GTX", "고어텍스", "이즈", "EASE"],
    },
    "adidas-supernova-rise-3": {
        "queries": ["아디다스 슈퍼노바 라이즈 3", "ADIDAS SUPERNOVA RISE 3"],
        "token_groups": [["슈퍼노바", "SUPERNOVA"], ["라이즈", "RISE"], ["3"]],
        "exclude": ["2", "GTX", "고어텍스", "이즈", "EASE"],
    },
    "adidas-ultraboost-5x": {
        "queries": ["아디다스 울트라부스트 5X", "ADIDAS ULTRABOOST 5X"],
        "token_groups": [["울트라부스트", "ULTRABOOST"], ["5X"]],
        "exclude": ["1.0", "LIGHT", "라이트", "5 "],
    },
    # --- ASICS (16) ---
    "asics-superblast-3": {
        "queries": ["아식스 슈퍼블라스트 3", "ASICS SUPERBLAST 3"],
        "token_groups": [["슈퍼블라스트", "SUPERBLAST"], ["3"]],
        "exclude": ["2"],
    },
    "asics-novablast-6": {
        "queries": ["아식스 노바블라스트 6", "ASICS NOVABLAST 6"],
        "token_groups": [["노바블라스트", "NOVABLAST"], ["6"]],
        "exclude": ["5", "4", "TR"],
    },
    "asics-megablast": {
        "queries": ["아식스 메가블라스트", "ASICS MEGABLAST"],
        "token_groups": [["메가블라스트", "MEGABLAST"]],
        "exclude": [],
    },
    "asics-sonicblast": {
        "queries": ["아식스 소닉블라스트", "ASICS SONICBLAST"],
        "token_groups": [["소닉블라스트", "SONICBLAST"]],
        "exclude": ["2"],
    },
    "asics-sonicblast-2": {
        "queries": ["아식스 소닉블라스트 2", "ASICS SONICBLAST 2"],
        "token_groups": [["소닉블라스트", "SONICBLAST"], ["2"]],
        "exclude": [],
    },
    "asics-magicspeed-4": {
        "queries": ["아식스 매직스피드 4", "ASICS MAGIC SPEED 4"],
        "token_groups": [["매직스피드", "매직 스피드", "MAGIC SPEED"], ["4"]],
        "exclude": ["3", "5"],
    },
    "asics-gel-nimbus-28": {
        "queries": ["아식스 젤 님버스 28", "ASICS GEL-NIMBUS 28"],
        "token_groups": [["님버스", "NIMBUS"], ["28"]],
        "exclude": ["27", "26", "TR"],
    },
    "asics-gel-kayano-33": {
        "queries": ["아식스 젤 카야노 33", "ASICS GEL-KAYANO 33"],
        "token_groups": [["카야노", "KAYANO"], ["33"]],
        "exclude": ["32", "31", "14", "20"],
    },
    "asics-gt2000-15": {
        "queries": ["아식스 GT-2000 15", "ASICS GT-2000 15"],
        "token_groups": [["GT-2000", "GT 2000", "GT2000"], ["15"]],
        "exclude": ["14", "13", "TR", "GTX"],
    },
    "asics-glideride-max-2": {
        "queries": ["아식스 글라이드라이드 맥스 2", "ASICS GLIDERIDE MAX 2"],
        "token_groups": [["글라이드라이드", "GLIDERIDE"], ["맥스", "MAX"], ["2"]],
        "exclude": [],
    },
    "asics-gel-slowqushi": {
        "queries": ["아식스 젤 슬로우쿠시", "ASICS GEL-SLOWCUSH"],
        "token_groups": [["슬로우쿠시", "SLOWCUSH"]],
        "exclude": [],
    },
    "asics-gel-contend-10": {
        "queries": ["아식스 젤 컨텐드 10", "ASICS GEL-CONTEND 10"],
        "token_groups": [["컨텐드", "CONTEND"], ["10"]],
        "exclude": ["9", "8", "SL"],
    },
    "asics-metaspeed-sky-tokyo": {
        "queries": ["아식스 메타스피드 스카이 도쿄", "ASICS METASPEED SKY TOKYO"],
        "token_groups": [["메타스피드", "METASPEED"], ["스카이", "SKY"], ["도쿄", "TOKYO"]],
        "exclude": ["엣지", "EDGE", "파리", "PARIS"],
    },
    "asics-metaspeed-edge-tokyo": {
        "queries": ["아식스 메타스피드 엣지 도쿄", "ASICS METASPEED EDGE TOKYO"],
        "token_groups": [["메타스피드", "METASPEED"], ["엣지", "EDGE"], ["도쿄", "TOKYO"]],
        "exclude": ["스카이", "SKY", "파리", "PARIS"],
    },
    "asics-metaspeed-ray": {
        "queries": ["아식스 메타스피드 레이", "ASICS METASPEED RAY"],
        "token_groups": [["메타스피드", "METASPEED"], ["레이", "RAY"]],
        "exclude": ["스카이", "SKY", "엣지", "EDGE"],
    },
    "asics-evoride-speed-3": {
        "queries": ["아식스 에보라이드 스피드 3", "ASICS EVORIDE SPEED 3"],
        "token_groups": [["에보라이드", "EVORIDE"], ["스피드", "SPEED"], ["3"]],
        "exclude": ["2"],
    },
    # --- Mizuno (17) ---
    "mizuno-hyperwarp-pure": {
        "queries": ["미즈노 하이퍼워프 퓨어", "MIZUNO HYPERWARP PURE"],
        "token_groups": [["하이퍼워프", "HYPERWARP"], ["퓨어", "PURE"]],
        "exclude": ["엘리트", "ELITE", "프로", "PRO"],
    },
    "mizuno-hyperwarp-elite": {
        "queries": ["미즈노 하이퍼워프 엘리트", "MIZUNO HYPERWARP ELITE"],
        "token_groups": [["하이퍼워프", "HYPERWARP"], ["엘리트", "ELITE"]],
        "exclude": ["퓨어", "PURE", "프로", "PRO"],
    },
    "mizuno-hyperwarp-pro": {
        "queries": ["미즈노 하이퍼워프 프로", "MIZUNO HYPERWARP PRO"],
        "token_groups": [["하이퍼워프", "HYPERWARP"], ["프로", "PRO"]],
        "exclude": ["퓨어", "PURE", "엘리트", "ELITE"],
    },
    "mizuno-wave-rebellion-pro-3": {
        "queries": ["미즈노 리벨리온 프로 3", "MIZUNO WAVE REBELLION PRO 3"],
        "token_groups": [["리벨리온", "REBELLION"], ["프로", "PRO"], ["3"]],
        "exclude": ["로우", "LOW", "플래시", "FLASH", "2"],
    },
    "mizuno-wave-rebellion-pro-low": {
        "queries": ["미즈노 리벨리온 프로 로우", "MIZUNO WAVE REBELLION PRO LOW"],
        "token_groups": [["리벨리온", "REBELLION"], ["프로", "PRO"], ["로우", "LOW"]],
        "exclude": ["플래시", "FLASH"],
    },
    "mizuno-wave-rebellion-flash-3": {
        "queries": ["미즈노 리벨리온 플래시 3", "MIZUNO WAVE REBELLION FLASH 3"],
        "token_groups": [["리벨리온", "REBELLION"], ["플래시", "FLASH"], ["3"]],
        "exclude": ["프로", "PRO", "2"],
    },
    "mizuno-neo-vista-3": {
        "queries": ["미즈노 네오 비스타 3", "MIZUNO NEO VISTA 3"],
        "token_groups": [["네오", "NEO"], ["비스타", "VISTA"], ["3"]],
        "exclude": ["2"],
    },
    "mizuno-neo-zen-2": {
        "queries": ["미즈노 네오 젠 2", "MIZUNO NEO ZEN 2"],
        "token_groups": [["네오", "NEO"], ["젠", "ZEN"], ["2"]],
        "exclude": [],
    },
    "mizuno-neo-cosmo-2": {
        "queries": ["미즈노 네오 코스모 2", "MIZUNO NEO COSMO 2"],
        "token_groups": [["네오", "NEO"], ["코스모", "COSMO"], ["2"]],
        "exclude": [],
    },
    "mizuno-wave-rider-30": {
        "queries": ["미즈노 웨이브 라이더 30", "MIZUNO WAVE RIDER 30"],
        "token_groups": [["라이더", "RIDER"], ["30"]],
        "exclude": ["29", "28", "GTX", "고어텍스", "베타", "BETA"],
    },
    "mizuno-wave-rider-29": {
        "queries": ["미즈노 웨이브 라이더 29", "MIZUNO WAVE RIDER 29"],
        "token_groups": [["라이더", "RIDER"], ["29"]],
        "exclude": ["30", "28", "GTX", "고어텍스"],
    },
    "mizuno-wave-sky-9": {
        "queries": ["미즈노 웨이브 스카이 9", "MIZUNO WAVE SKY 9"],
        "token_groups": [["스카이", "SKY"], ["9"]],
        "exclude": ["8", "프라임", "PRIME", "라이즈", "SKYRISE"],
    },
    "mizuno-sky-prim": {
        "queries": ["미즈노 스카이 프라임", "MIZUNO SKY PRIME"],
        "token_groups": [["스카이", "SKY"], ["프라임", "PRIME"]],
        "exclude": [],
    },
    "mizuno-wave-inspire-22": {
        "queries": ["미즈노 웨이브 인스파이어 22", "MIZUNO WAVE INSPIRE 22"],
        "token_groups": [["인스파이어", "INSPIRE"], ["22"]],
        "exclude": ["21", "20"],
    },
    "mizuno-wave-horizon-7": {
        "queries": ["미즈노 웨이브 호라이즌 7", "MIZUNO WAVE HORIZON 7"],
        "token_groups": [["호라이즌", "HORIZON"], ["7"]],
        "exclude": ["6", "8"],
    },
    "mizuno-wave-prophecy-15": {
        "queries": ["미즈노 웨이브 프로페시 15", "MIZUNO WAVE PROPHECY 15"],
        "token_groups": [["프로페시", "PROPHECY"], ["15"]],
        "exclude": ["14", "13", "LS", "MOC", "STRAP"],
    },
    "mizuno-maximizer-26": {
        "queries": ["미즈노 맥시마이저 26", "MIZUNO MAXIMIZER 26"],
        "token_groups": [["맥시마이저", "MAXIMIZER"], ["26"]],
        "exclude": ["25", "27"],
    },
    # --- New Balance (7) ---
    "nb-1080-v15": {
        "queries": ["뉴발란스 1080 v15", "NEW BALANCE 1080 V15"],
        "token_groups": [["1080"], ["V15", "15"]],
        "exclude": ["V14", "V13"],
    },
    "nb-860-v15": {
        "queries": ["뉴발란스 860 v15", "NEW BALANCE 860 V15"],
        "token_groups": [["860"], ["V15", "15"]],
        "exclude": ["V14", "V13", "V2"],
    },
    "nb-rebel-v5": {
        "queries": ["뉴발란스 레벨 v5", "NEW BALANCE REBEL V5"],
        "token_groups": [["레벨", "REBEL"], ["V5", "5"]],
        "exclude": ["SC", "V4", "V3"],
    },
    "nb-sc-elite-v6": {
        "queries": ["뉴발란스 SC 엘리트 v6", "NEW BALANCE SC ELITE V6"],
        "token_groups": [["엘리트", "ELITE"], ["V6", "6"]],
        "exclude": ["V5", "V4"],
    },
    "nb-sc-rebel-v1": {
        "queries": ["뉴발란스 SC 레벨", "NEW BALANCE SUPERCOMP REBEL"],
        "token_groups": [["SC", "SUPERCOMP"], ["레벨", "REBEL"]],
        "exclude": [],
    },
    "nb-elips-v1": {
        "queries": ["뉴발란스 엘립스", "NEW BALANCE ELLIPSE"],
        "token_groups": [["엘립스", "ELLIPSE"]],
        "exclude": [],
    },
    "nb-ac-runner-v1": {
        "queries": ["뉴발란스 AC 러너", "NEW BALANCE AC RUNNER"],
        "token_groups": [["AC"], ["러너", "RUNNER"]],
        "exclude": [],
    },
    # --- Saucony (13) ---
    "saucony-endorphin-elite-3": {
        "queries": ["써코니 엔돌핀 엘리트 3", "SAUCONY ENDORPHIN ELITE 3"],
        "token_groups": [["엔돌핀", "ENDORPHIN"], ["엘리트", "ELITE"], ["3"]],
        "exclude": ["2", "프로", "PRO"],
    },
    "saucony-endorphin-pro-5": {
        "queries": ["써코니 엔돌핀 프로 5", "SAUCONY ENDORPHIN PRO 5"],
        "token_groups": [["엔돌핀", "ENDORPHIN"], ["프로", "PRO"], ["5"]],
        "exclude": ["4", "3", "스피드", "SPEED"],
    },
    "saucony-endorphin-speed-5": {
        "queries": ["써코니 엔돌핀 스피드 5", "SAUCONY ENDORPHIN SPEED 5"],
        "token_groups": [["엔돌핀", "ENDORPHIN"], ["스피드", "SPEED"], ["5"]],
        "exclude": ["4", "3", "프로", "PRO"],
    },
    "saucony-endorphin-azura": {
        "queries": ["써코니 엔돌핀 아주라", "SAUCONY ENDORPHIN AZURA"],
        "token_groups": [["엔돌핀", "ENDORPHIN"], ["아주라", "AZURA"]],
        "exclude": [],
    },
    "saucony-paramount-max": {
        "queries": ["써코니 파라마운트 맥스", "SAUCONY PARAMOUNT MAX"],
        "token_groups": [["파라마운트", "PARAMOUNT"], ["맥스", "MAX"]],
        "exclude": [],
    },
    "saucony-triumph-24": {
        "queries": ["써코니 트라이엄프 24", "SAUCONY TRIUMPH 24"],
        "token_groups": [["트라이엄프", "TRIUMPH"], ["24"]],
        "exclude": ["23", "22", "4"],
    },
    "saucony-ride-19": {
        "queries": ["써코니 라이드 19", "SAUCONY RIDE 19"],
        "token_groups": [["라이드", "RIDE"], ["19"]],
        "exclude": ["18", "17", "프로그리드", "PROGRID"],
    },
    "saucony-guide-19": {
        "queries": ["써코니 가이드 19", "SAUCONY GUIDE 19"],
        "token_groups": [["가이드", "GUIDE"], ["19"]],
        "exclude": ["18", "17"],
    },
    "saucony-hurricane-26": {
        "queries": ["써코니 허리케인 26", "SAUCONY HURRICANE 26"],
        "token_groups": [["허리케인", "HURRICANE"], ["26"]],
        "exclude": ["25", "24"],
    },
    "saucony-omni-st-23": {
        "queries": ["써코니 옴니 ST 23", "SAUCONY OMNI ST 23"],
        "token_groups": [["옴니", "OMNI"], ["23"]],
        "exclude": ["22", "21"],
    },
    "saucony-kinvara-16": {
        "queries": ["써코니 킨바라 16", "SAUCONY KINVARA 16"],
        "token_groups": [["킨바라", "KINVARA"], ["16"]],
        "exclude": ["15", "14"],
    },
    "saucony-kinvara-1": {
        "queries": ["써코니 킨바라 1", "SAUCONY KINVARA 1"],
        "token_groups": [["킨바라", "KINVARA"], ["1"]],
        "exclude": ["16", "15", "14", "13", "프로", "PRO"],
    },
    "saucony-progrid-ride-1": {
        "queries": ["써코니 프로그리드 라이드", "SAUCONY PROGRID RIDE"],
        "token_groups": [["프로그리드", "PROGRID"], ["라이드", "RIDE"]],
        "exclude": ["19", "18"],
    },
    # --- Puma (11) ---
    "puma-fast-r-nitro-elite-3": {
        "queries": ["푸마 패스트 R 나이트로 엘리트 3", "PUMA FAST-R NITRO ELITE 3"],
        "token_groups": [["FAST-R", "FAST R", "패스트-R", "패스트 R"], ["엘리트", "ELITE"], ["3"]],
        "exclude": ["2"],
    },
    "puma-deviate-nitro-elite-4": {
        "queries": ["푸마 디비에이트 나이트로 엘리트 4", "PUMA DEVIATE NITRO ELITE 4"],
        "token_groups": [["디비에이트", "DEVIATE"], ["엘리트", "ELITE"], ["4"]],
        "exclude": ["3"],
    },
    "puma-fastforward-nitro-elite-2": {
        "queries": ["푸마 패스트 FWD 나이트로 엘리트 2", "PUMA FAST-FWD NITRO ELITE 2"],
        "token_groups": [["FAST-FWD", "FASTFWD", "패스트"], ["엘리트", "ELITE"], ["2"]],
        "exclude": [],
    },
    "puma-deviate-nitro-4": {
        "queries": ["푸마 디비에이트 나이트로 4", "PUMA DEVIATE NITRO 4"],
        "token_groups": [["디비에이트", "DEVIATE"], ["나이트로", "NITRO"], ["4"]],
        "exclude": ["엘리트", "ELITE", "3"],
    },
    "puma-deviate-nitro-3": {
        "queries": ["푸마 디비에이트 나이트로 3", "PUMA DEVIATE NITRO 3"],
        "token_groups": [["디비에이트", "DEVIATE"], ["나이트로", "NITRO"], ["3"]],
        "exclude": ["엘리트", "ELITE", "4"],
    },
    "puma-deviate-pure-nitro": {
        "queries": ["푸마 디비에이트 퓨어 나이트로", "PUMA DEVIATE PURE NITRO"],
        "token_groups": [["디비에이트", "DEVIATE"], ["퓨어", "PURE"]],
        "exclude": [],
    },
    "puma-velocity-nitro-4-ap": {
        "queries": ["푸마 벨로시티 나이트로 4", "PUMA VELOCITY NITRO 4"],
        "token_groups": [["벨로시티", "VELOCITY"], ["나이트로", "NITRO"], ["4"]],
        "exclude": ["3"],
    },
    "puma-magnify-nitro-3": {
        "queries": ["푸마 매그니파이 나이트로 3", "PUMA MAGNIFY NITRO 3"],
        "token_groups": [["매그니파이", "MAGNIFY"], ["나이트로", "NITRO"], ["3"]],
        "exclude": ["2"],
    },
    "puma-magmax-nitro-2": {
        "queries": ["푸마 매그맥스 나이트로 2", "PUMA MAGMAX NITRO 2"],
        "token_groups": [["매그맥스", "MAGMAX"], ["2"]],
        "exclude": [],
    },
    "puma-foreverrun-nitro-3": {
        "queries": ["푸마 포에버런 나이트로 3", "PUMA FOREVERRUN NITRO 3"],
        "token_groups": [["포에버런", "FOREVERRUN"], ["3"]],
        "exclude": ["2"],
    },
    "puma-darter-pro-2": {
        "queries": ["푸마 다터 프로 2", "PUMA DARTER PRO 2"],
        "token_groups": [["다터", "DARTER"], ["프로", "PRO"], ["2"]],
        "exclude": [],
    },
    # --- Hoka (13) ---
    "hoka-cielo-x1-3": {
        "queries": ["호카 시엘로 X1 3.0", "HOKA CIELO X1 3"],
        "token_groups": [["시엘로", "CIELO"], ["X1"], ["3"]],
        "exclude": ["2.0"],
    },
    "hoka-rocket-x-3": {
        "queries": ["호카 로켓 X 3", "HOKA ROCKET X 3"],
        "token_groups": [["로켓", "ROCKET"], ["X"], ["3"]],
        "exclude": ["2"],
    },
    "hoka-cielo-road": {
        "queries": ["호카 시엘로 로드", "HOKA CIELO ROAD"],
        "token_groups": [["시엘로", "CIELO"], ["로드", "ROAD"]],
        "exclude": ["X1"],
    },
    "hoka-skyward-x-2": {
        "queries": ["호카 스카이워드 X 2", "HOKA SKYWARD X 2"],
        "token_groups": [["스카이워드", "SKYWARD"], ["X"], ["2"]],
        "exclude": [],
    },
    "hoka-mach-x-3": {
        "queries": ["호카 마하 X 3", "HOKA MACH X 3"],
        "token_groups": [["마하", "MACH"], ["X"], ["3"]],
        "exclude": ["2"],
    },
    "hoka-mach-7": {
        "queries": ["호카 마하 7", "HOKA MACH 7"],
        "token_groups": [["마하", "MACH"], ["7"]],
        "exclude": ["X", "6"],
    },
    "hoka-clifton-11": {
        "queries": ["호카 클리프톤 11", "HOKA CLIFTON 11"],
        "token_groups": [["클리프톤", "CLIFTON"], ["11"]],
        "exclude": ["10", "9", "GTX", "L ", "프로", "PRO"],
    },
    "hoka-clifton-10": {
        "queries": ["호카 클리프톤 10", "HOKA CLIFTON 10"],
        "token_groups": [["클리프톤", "CLIFTON"], ["10"]],
        "exclude": ["11", "9", "GTX", "프로", "PRO"],
    },
    "hoka-clifton-pro": {
        "queries": ["호카 클리프톤 프로", "HOKA CLIFTON PRO"],
        "token_groups": [["클리프톤", "CLIFTON"], ["프로", "PRO"]],
        "exclude": [],
    },
    "hoka-bondi-9": {
        "queries": ["호카 본디 9", "HOKA BONDI 9"],
        "token_groups": [["본디", "BONDI"], ["9"]],
        "exclude": ["8", "SR", "L "],
    },
    "hoka-rincon-5": {
        "queries": ["호카 링컨 5", "HOKA RINCON 5"],
        "token_groups": [["링컨", "RINCON"], ["5"]],
        "exclude": ["4", "3"],
    },
    "hoka-arahi-9": {
        "queries": ["호카 아라히 9", "HOKA ARAHI 9"],
        "token_groups": [["아라히", "ARAHI"], ["9"]],
        "exclude": ["8", "7"],
    },
    "hoka-gaviota-6": {
        "queries": ["호카 가비오타 6", "HOKA GAVIOTA 6"],
        "token_groups": [["가비오타", "GAVIOTA"], ["6"]],
        "exclude": ["5"],
    },
    # --- Brooks (16) ---
    "brooks-hyperion-elite-6": {
        "queries": ["브룩스 하이페리온 엘리트 6", "BROOKS HYPERION ELITE 6"],
        "token_groups": [["하이페리온", "HYPERION"], ["엘리트", "ELITE"], ["6"]],
        "exclude": ["5", "4", "맥스", "MAX"],
    },
    "brooks-hyperion-max-4": {
        "queries": ["브룩스 하이페리온 맥스 4", "BROOKS HYPERION MAX 4"],
        "token_groups": [["하이페리온", "HYPERION"], ["맥스", "MAX"], ["4"]],
        "exclude": ["3", "2", "엘리트", "ELITE"],
    },
    "brooks-ghost-18": {
        "queries": ["브룩스 고스트 18", "BROOKS GHOST 18"],
        "token_groups": [["고스트", "GHOST"], ["18"]],
        "exclude": ["17", "16", "맥스", "MAX", "앰프", "AMP", "GTX"],
    },
    "brooks-ghost-max-4": {
        "queries": ["브룩스 고스트 맥스 4", "BROOKS GHOST MAX 4"],
        "token_groups": [["고스트", "GHOST"], ["맥스", "MAX"], ["4"]],
        "exclude": ["3", "2"],
    },
    "brooks-ghost-amp": {
        "queries": ["브룩스 고스트 앰프", "BROOKS GHOST AMP"],
        "token_groups": [["고스트", "GHOST"], ["앰프", "AMP"]],
        "exclude": [],
    },
    "brooks-glycerin-23": {
        "queries": ["브룩스 글리세린 23", "BROOKS GLYCERIN 23"],
        "token_groups": [["글리세린", "GLYCERIN"], ["23"]],
        "exclude": ["GTS", "맥스", "MAX", "22", "21"],
    },
    "brooks-glycerin-gts-23": {
        "queries": ["브룩스 글리세린 GTS 23", "BROOKS GLYCERIN GTS 23"],
        "token_groups": [["글리세린", "GLYCERIN"], ["GTS"], ["23"]],
        "exclude": ["22", "21"],
    },
    "brooks-glycerin-max-3": {
        "queries": ["브룩스 글리세린 맥스 3", "BROOKS GLYCERIN MAX 3"],
        "token_groups": [["글리세린", "GLYCERIN"], ["맥스", "MAX"], ["3"]],
        "exclude": ["2"],
    },
    "brooks-adrenaline-gts-26": {
        "queries": ["브룩스 아드레날린 GTS 26", "BROOKS ADRENALINE GTS 26"],
        "token_groups": [["아드레날린", "ADRENALINE"], ["26"]],
        "exclude": ["25", "24"],
    },
    "brooks-launch-12": {
        "queries": ["브룩스 런치 12", "BROOKS LAUNCH 12"],
        "token_groups": [["런치", "LAUNCH"], ["12"]],
        "exclude": ["11", "10", "GTS"],
    },
    "brooks-revel-9": {
        "queries": ["브룩스 레벨 9", "BROOKS REVEL 9"],
        "token_groups": [["레벨", "REVEL"], ["9"]],
        "exclude": ["8", "7", "맥스", "MAX"],
    },
    "brooks-revel-max": {
        "queries": ["브룩스 레벨 맥스", "BROOKS REVEL MAX"],
        "token_groups": [["레벨", "REVEL"], ["맥스", "MAX"]],
        "exclude": [],
    },
    "brooks-anthem-8": {
        "queries": ["브룩스 앤썸 8", "BROOKS ANTHEM 8"],
        "token_groups": [["앤썸", "ANTHEM"], ["8"]],
        "exclude": ["7", "6"],
    },
    "brooks-defyance-max": {
        "queries": ["브룩스 디파이언스 맥스", "BROOKS DEFYANCE MAX"],
        "token_groups": [["디파이언스", "DEFYANCE"], ["맥스", "MAX"]],
        "exclude": [],
    },
    "brooks-beast-gts-26": {
        "queries": ["브룩스 비스트 GTS 26", "BROOKS BEAST GTS 26"],
        "token_groups": [["비스트", "BEAST"], ["26"]],
        "exclude": ["24", "20"],
    },
    "brooks-addiction-gts-15": {
        "queries": ["브룩스 에딕션 GTS 15", "BROOKS ADDICTION GTS 15"],
        "token_groups": [["에딕션", "ADDICTION"], ["15"]],
        "exclude": ["워커", "WALKER"],
    },
}


def matches_rule(title: str, rule: dict) -> bool:
    """Return True if title is an adult running shoe matching all required token groups and no exclusions."""
    upper = title.upper()
    if any(tok.upper() in upper for tok in GLOBAL_EXCLUDE_TOKENS):
        return False
    if GLOBAL_EXCLUDE_EN_RE.search(title):
        return False
    for bad in rule.get("exclude", []):
        if bad.upper() in upper:
            return False
    for group in rule["token_groups"]:
        if not any(tok.upper() in upper for tok in group):
            return False
    return True
