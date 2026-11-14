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
