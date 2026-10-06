/**
 * RunAnalyz - Core Logic (Zero Dependencies, Ultra Fast, Robust)
 */

let auto7DayEvents = []; // 7일 플랜 캘린더용 전역 변수
let plannerCustomEvents = []; // 독립 플래너용 전역 변수
const MEMO_STORAGE_KEY = 'runanalyz_calc_memos';
let currentCaptchaAns = 7;
let lastMemoTime = 0;

document.addEventListener('DOMContentLoaded', () => {
    initMainViews();
    initIntegratedCalculator();
    initStandalonePlanner();
    initMemoSystem();
    initArticleFilters();
    initTreadmillConverter();
    // 초기 1회 기본 진단 실행 (10km 48분, 35세, RPE 7, 심박 145)
    calculateComprehensiveDiagnostics();
});

/**
 * 1. 3대 메인 뷰 전환 (계산기 / 플래너 / 사이언스)
 */
function initMainViews() {
    const segmentBtns = document.querySelectorAll('.segment-btn');
    const mainViews = document.querySelectorAll('.main-view');

    const heroSection = document.querySelector('.hero-section');

    function switchView(viewKey) {
        segmentBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewKey);
        });

        mainViews.forEach(view => {
            view.style.display = (view.id === `view-${viewKey}`) ? 'block' : 'none';
        });

        // 러닝 사이언스/플래너 선택 시 계산기용 히어로 배너를 숨겨 콘텐츠가 상단에 즉각 밀착되도록 최적화
        if (heroSection) {
            heroSection.style.display = (viewKey === 'calc') ? 'block' : 'none';
        }
    }

    segmentBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            switchView(btn.dataset.view);
        });
    });

    // URL 파라미터 처리 (?view=planner 등)
    const urlParams = new URLSearchParams(window.location.search);
    const initialView = urlParams.get('view');
    if (initialView && ['calc', 'planner', 'articles'].includes(initialView)) {
        switchView(initialView);
    }
}

/**
 * 2. 올인원 종합 계산기 (속도 + 심장연비 + Age-Grade + 완주예측 + 7일플랜)
 */
function initIntegratedCalculator() {
    const btn = document.getElementById('btn-calc-pace');
    if (btn) {
        btn.addEventListener('click', calculateComprehensiveDiagnostics);
    }

    // 입력 필드 실시간 반응 (RPE, 거리, 시간, 심박수 변경 시 즉시 심장연비/페이스 재계산)
    const liveInputs = [
        'dist-select', 'time-hour', 'time-min', 'time-sec',
        'user-age', 'user-rpe', 'opt-hr-avg', 'opt-hr-rest'
    ];
    liveInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', calculateComprehensiveDiagnostics);
            if (el.tagName === 'INPUT') {
                el.addEventListener('input', calculateComprehensiveDiagnostics);
            }
        }
    });

    const btnAutoIcs = document.getElementById('btn-download-auto-ics');
    if (btnAutoIcs) {
        btnAutoIcs.addEventListener('click', () => {
            if (!auto7DayEvents || auto7DayEvents.length === 0) {
                alert('먼저 훈련 일정을 계산해주세요.');
                return;
            }
            triggerICSDownload(auto7DayEvents, 'runanalyz_7day_plan.ics');
        });
    }
}

function calculateComprehensiveDiagnostics() {
    const dist = parseFloat(document.getElementById('dist-select').value) || 10;
    const h = parseInt(document.getElementById('time-hour').value, 10) || 0;
    const m = parseInt(document.getElementById('time-min').value, 10) || 0;
    const s = parseInt(document.getElementById('time-sec').value, 10) || 0;
    const age = parseInt(document.getElementById('user-age').value, 10) || 35;
    const rpe = parseInt(document.getElementById('user-rpe').value, 10) || 7;

    const optHrAvg = parseInt(document.getElementById('opt-hr-avg')?.value, 10);
    const optHrMax = parseInt(document.getElementById('opt-hr-max')?.value, 10);
    const optHrRest = parseInt(document.getElementById('opt-hr-rest')?.value, 10);

    const totalSec = (h * 3600) + (m * 60) + s;
    if (totalSec <= 0) return;

    const avgPaceSec = totalSec / dist; // sec per km

    // RPE(운동 자각도)에 따른 최대 능력치 보정
    let rpeFactor = 1.0;
    if (rpe <= 4) rpeFactor = 0.86; // 조깅 수준으로 뛰었다면 전력질주 체력은 약 14% 더 빠름
    else if (rpe <= 6) rpeFactor = 0.92;
    else if (rpe <= 8) rpeFactor = 0.98;
    else rpeFactor = 1.0;

    const estimatedAllOutSec = totalSec * rpeFactor;
    const vdot = estimateVDOT(dist, estimatedAllOutSec);

    // 1) 체력 점수 UI 갱신
    const vdotValEl = document.getElementById('vdot-val');
    const vdotLevelEl = document.getElementById('vdot-level');
    if (vdotValEl) vdotValEl.textContent = `${vdot.toFixed(1)}점`;
    if (vdotLevelEl) vdotLevelEl.textContent = getVdotLevel(vdot);

    // 2) WMA Age-Grade (나이대별 러닝 능력 백분위 %)
    const ageGrade = calculateAgeGrade(dist, estimatedAllOutSec, age);
    const ageGradeEl = document.getElementById('age-grade-val');
    if (ageGradeEl) {
        ageGradeEl.textContent = `${age}세 기준 상위 ${(100 - ageGrade.score).toFixed(1)}% 러너 (WMA 공인 점수 ${ageGrade.score.toFixed(1)}%, ${ageGrade.tier})`;
    }

    // 3) 카보넨 심박수 구간 계산 (나이 및 안정심박수 반영)
    const hrMax = (!isNaN(optHrMax) && optHrMax > 100) ? optHrMax : Math.round(208 - (0.7 * age));
    const hrRest = (!isNaN(optHrRest) && optHrRest > 35) ? optHrRest : 65;
    const hrr = hrMax - hrRest;

    // 4) 심장 연비 (EF) 진단: 스마트워치 심박수 미입력 시 RPE 기반 지능형 심박 추정 연동!
    const isRealHr = !isNaN(optHrAvg) && optHrAvg >= 60;
    let hrAvg;
    if (isRealHr) {
        hrAvg = optHrAvg;
    } else {
        // RPE에 따른 심박 예비력(HRR) 비율 매핑 (RPE 3: 62% ~ RPE 9: 95%)
        const rpeRatioMap = { 3: 0.62, 5: 0.74, 7: 0.85, 9: 0.95 };
        const rpeIntensity = rpeRatioMap[rpe] || Math.min(0.98, Math.max(0.55, 0.45 + (rpe / 10) * 0.52));
        hrAvg = Math.round(hrRest + hrr * rpeIntensity);
    }

    const speedMPerMin = (dist * 1000) / (totalSec / 60);
    const efScore = speedMPerMin / hrAvg;

    const efValEl = document.getElementById('ef-val');
    const efBadgeEl = document.getElementById('ef-badge');
    const efGuideEl = document.getElementById('ef-guide');

    if (efValEl) efValEl.textContent = `${efScore.toFixed(2)}점`;
    if (efBadgeEl) {
        if (efScore >= 1.55) {
            efBadgeEl.textContent = "하이브리드 심폐 엔진 (최상급 연비)";
            efBadgeEl.style.background = "#DCFCE7";
            efBadgeEl.style.color = "#166534";
        } else if (efScore >= 1.35) {
            efBadgeEl.textContent = "안정적인 표준 심장 연비 (지침 없음)";
            efBadgeEl.style.background = "#ECFDF5";
            efBadgeEl.style.color = "#065F46";
        } else if (efScore >= 1.15) {
            efBadgeEl.textContent = "심폐 에너지 소모형 (Zone 2 보강 권장)";
            efBadgeEl.style.background = "#FEF3C7";
            efBadgeEl.style.color = "#92400E";
        } else {
            efBadgeEl.textContent = "고부하 심장 엔진 (기초 유산소 조깅 권장)";
            efBadgeEl.style.background = "#FEE2E2";
            efBadgeEl.style.color = "#991B1B";
        }
    }
    if (efGuideEl) {
        const hrSourceText = isRealHr ? `실측 평균 심박 <strong>${hrAvg}bpm</strong>` : `체감 피로도(RPE ${rpe}) 기반 추정 심박 <strong>${hrAvg}bpm</strong>`;
        efGuideEl.innerHTML = `${hrSourceText}에서 분당 <strong>${speedMPerMin.toFixed(0)}m</strong>를 나아갔습니다. 같은 속도를 더 낮은 피로도로 달릴수록 심장 연비가 높아집니다.`;
    }

    // 5) 카보넨 심박수 구간 계산
    const hrEasyMin = Math.round(hrRest + hrr * 0.60);
    const hrEasyMax = Math.round(hrRest + hrr * 0.70);
    const hrMMin = Math.round(hrRest + hrr * 0.71);
    const hrMMax = Math.round(hrRest + hrr * 0.80);
    const hrTMin = Math.round(hrRest + hrr * 0.81);
    const hrTMax = Math.round(hrRest + hrr * 0.88);
    const hrIMin = Math.round(hrRest + hrr * 0.89);
    const hrIMax = Math.round(hrRest + hrr * 0.95);

    // 5) 4단계 페이스 존 렌더링
    const easyFast = formatPace(avgPaceSec * 1.20);
    const easySlow = formatPace(avgPaceSec * 1.32);
    const mFast = formatPace(avgPaceSec * 1.06);
    const mSlow = formatPace(avgPaceSec * 1.12);
    const tFast = formatPace(avgPaceSec * 0.98);
    const tSlow = formatPace(avgPaceSec * 1.02);
    const iFast = formatPace(avgPaceSec * 0.90);
    const iSlow = formatPace(avgPaceSec * 0.94);

    const setElText = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.textContent = txt;
    };

    setElText('pace-easy-val', `${easyFast} ~ ${easySlow}`);
    setElText('pace-marathon-val', `${mFast} ~ ${mSlow}`);
    setElText('pace-threshold-val', `${tFast} ~ ${tSlow}`);
    setElText('pace-interval-val', `${iFast} ~ ${iSlow}`);

    setElText('hr-easy-val', `목표 심박 ${hrEasyMin}~${hrEasyMax} bpm (Zone 2)`);
    setElText('hr-marathon-val', `목표 심박 ${hrMMin}~${hrMMax} bpm (Zone 3)`);
    setElText('hr-threshold-val', `목표 심박 ${hrTMin}~${hrTMax} bpm (Zone 4)`);
    setElText('hr-interval-val', `목표 심박 ${hrIMin}~${hrIMax} bpm (Zone 5)`);

    // 6) 마라톤 완주 예측 테이블 렌더링 (Riegel 공식)
    try {
        renderRiegelTable(dist, estimatedAllOutSec);
    } catch (e) {
        console.error("renderRiegelTable error:", e);
    }

    // 7) 📅 내 실력 맞춤 이번 주 7일 데일리 훈련 스케줄 자동 빌드
    try {
        generateAuto7DayPlan(vdot, avgPaceSec);
    } catch (e) {
        console.error("generateAuto7DayPlan error:", e);
    }

    // 8) 🎯 내 VDOT 수준 맞춤 필독 러닝 사이언스 아티클 동적 추천 렌더링
    try {
        renderRecommendedArticles(vdot);
    } catch (e) {
        console.error("renderRecommendedArticles error:", e);
    }
}

/**
 * 🎯 내 실력(VDOT) 맞춤 필독 러닝 사이언스 아티클 동적 추천 렌더링
 */
function renderRecommendedArticles(vdot) {
    const grid = document.getElementById('recommendCardGrid');
    const badge = document.getElementById('recommendTierBadge');
    const title = document.getElementById('recommendSectionTitle');
    if (!grid) return;

    let tierBadge = "초급 러너 맞춤";
    let tierTitle = "통증 없이 오래 달리는 4대 입문 러닝 사이언스";
    let recommendations = [];

    if (vdot >= 48) {
        tierBadge = "상급 러너 맞춤 (서브 3.5 & 서브3 도약)";
        tierTitle = "기록 한계를 돌파하는 엘리트 레이스 사이언스";
        recommendations = [
            {
                href: "articles/lactate-threshold-tempo-run-science.html",
                tag: "상급 마라톤 · 젖산역치와 템포런",
                title: "젖산역치(LT)와 크리티컬 페이스: 왜 템포런이 마라톤 완주 시간을 바꾸는가",
                desc: "젖산은 피로물질이 아닌 프리미엄 유산소 연료. VO2max보다 중요한 LT 지점과 20분 템포런 실전 공식.",
                action: "템포런 공식 읽기 ›"
            },
            {
                href: "articles/marathon-wall-carbo-loading.html",
                tag: "상급 마라톤 · 30km 벽과 카보로딩",
                title: "30km의 벽은 왜 올까? 마라톤 '셧다운'을 막는 호주 체육회 카보로딩",
                desc: "25~30km 지점에서 다리가 굳는 생리학적 이유와 체중kg당 8~10g 탄수화물 사전 완충법.",
                action: "카보로딩 공식 읽기 ›"
            },
            {
                href: "articles/marathon-tapering-science.html",
                tag: "상급 마라톤 · 대회 직전 테이퍼링 피킹",
                title: "대회 3주 전, 훈련량을 40% 줄여야 PB가 터지는 생리학 (테이퍼링)",
                desc: "불안해서 더 뛰면 망합니다. 훈련량(Volume) 감소와 강도(Intensity) 유지의 골디락스 원칙.",
                action: "테이퍼링 원칙 읽기 ›"
            },
            {
                href: "articles/yasso-800s-marathon-predictor.html",
                tag: "상급 마라톤 · 야소 800 풀코스 예측",
                title: "800m 질주로 마라톤 기록을 예측한다? 야소 800(Yasso 800s) 실전 가이드",
                desc: "800m 랩타임(분:초)이 풀코스 완주시간(시:분)이 되는 생리학적 원리와 VO2max 자극 빌드업.",
                action: "야소 800 공식 보기 ›"
            }
        ];
    } else if (vdot >= 38) {
        tierBadge = "중급 러너 맞춤 (10K~하프 빌드업)";
        tierTitle = "심장 연비와 유산소 지구력을 극대화하는 핵심 러닝 사이언스";
        recommendations = [
            {
                href: "articles/zone2-training-mitochondria.html",
                tag: "중급 빌드업 · Zone 2와 미토콘드리아",
                title: "심박수 Zone 2 훈련의 기적: 천천히 뛰어야 빨라지는 세포 생물학적 이유",
                desc: "엘리트 러너들이 훈련의 80%를 숨차지 않게 달리는 이유. 세포 에너지 공장 미토콘드리아 증식의 비밀.",
                action: "Zone 2 원리 보기 ›"
            },
            {
                href: "articles/cardiac-drift-aerobic-decoupling.html",
                tag: "중급 빌드업 · 심박수 표류와 디커플링",
                title: "같은 속도인데 왜 심박수는 계속 치솟을까? '심박수 표류'의 생리학",
                desc: "일정한 페이스에도 심박수가 오르는 1회 박출량 감소 메커니즘과 유산소 디커플링 5% 진단법.",
                action: "심박수 표류 분석 ›"
            },
            {
                href: "articles/runner-hydration-electrolytes-hyponatremia.html",
                tag: "중급 빌드업 · 수분 & 전해질 보충",
                title: "물만 마시면 쓰러진다? 마라톤 저나트륨혈증의 위험과 시간당 500ml 수분 전해질 공식",
                desc: "땀으로 손실되는 염분과 저나트륨혈증의 기전. 1시간 이상 러닝 시 전해질 농도(0.5~0.7g/L) 보충 가이드.",
                action: "수분 보충 가이드 ›"
            },
            {
                href: "articles/post-run-nutrition-glycogen-window.html",
                tag: "중급 빌드업 · 회복 영양 골든타임",
                title: "달린 직후 30분 '기회의 창': 탄수화물·단백질 4:1 황금 비율과 초코우유",
                desc: "운동 직후 GLUT-4 포도당 수송체가 열리는 골든타임. 비싼 보충제보다 편의점 초코우유가 완벽한 이유.",
                action: "영양 회복 가이드 ›"
            }
        ];
    } else {
        tierBadge = "초보 러너 맞춤 (5K~10K 완주 & 부상 방지)";
        tierTitle = "통증 없이 평생 달리는 4대 입문 기초 러닝 사이언스";
        recommendations = [
            {
                href: "articles/running-form-footstrike.html",
                tag: "초보 입문 · 안전한 착지법과 주법",
                title: "앞발 착지 억지로 따라 하다간 다칩니다: 발 착지법의 진실 (포어풋 vs 힐)",
                desc: "실제 마라토너 94%는 뒤꿈치로 착지합니다. 하버드대 연구와 실측 데이터로 밝혀진 진짜 착지 비밀.",
                action: "착지법 진실 보기 ›"
            },
            {
                href: "articles/shin-splints-tibial-stress.html",
                tag: "초보 입문 · 정강이 통증과 부상 방지",
                title: "정강이 안쪽이 찢어질 듯 아픈 신스프린트(MTSS): 원인과 3단계 회복법",
                desc: "단순 근육통이 아닌 정강이 뼈막 과부하 손상. 후경골근·가자미근 강화와 오버스트라이드 교정법.",
                action: "정강이 재활법 읽기 ›"
            },
            {
                href: "articles/everyday-running-vs-rest-days.html",
                tag: "초보 입문 · 달리기 빈도와 관절 보호",
                title: "매일 5km 뛰기 vs 이틀에 한 번 10km 뛰기: 관절과 심폐를 살리는 최적 빈도",
                desc: "근육은 24시간, 건·인대는 72시간 걸리는 회복 주기의 비대칭. 부상 없이 배기량을 키우는 빈도 설계법.",
                action: "최적 훈련 빈도 보기 ›"
            },
            {
                href: "articles/itbs-runner-knee-pain.html",
                tag: "초보 입문 · 무릎 외측 장경인대 통증",
                title: "무릎 바깥쪽이 찌릿하게 아프다면? 장경인대 증후군(ITBS) 원인과 2주 재활 솔루션",
                desc: "달리기 3km만 넘어가면 불타는 외측 무릎 통증. 폼롤러 대신 중둔근 강화로 잡는 과학적 재활.",
                action: "무릎 재활 솔루션 ›"
            }
        ];
    }

    if (badge) badge.textContent = tierBadge;
    if (title) title.textContent = tierTitle;

    grid.innerHTML = recommendations.map(item => `
        <a href="${item.href}" class="recommend-item-card">
            <div>
                <span class="recommend-item-tag">${item.tag}</span>
                <h4 class="recommend-item-title">${item.title}</h4>
                <p class="recommend-item-desc">${item.desc}</p>
            </div>
            <div class="recommend-item-action">
                <span>실전 팁 & 후기 수록</span>
                <span>${item.action}</span>
            </div>
        </a>
    `).join('');
}

/**
 * VDOT 추정 공식 (Jack Daniels Approximation)
 */
function estimateVDOT(distKm, timeSec) {
    const timeMin = timeSec / 60;
    const distM = distKm * 1000;
    const velocity = distM / timeMin; // m/min

    const vo2 = -4.60 + 0.182258 * velocity + 0.000104 * (velocity ** 2);
    const percentMax = 0.8 + 0.1894393 * Math.exp(-0.012778 * timeMin) + 0.2989558 * Math.exp(-0.1932605 * timeMin);
    const vdot = vo2 / percentMax;

    return Math.max(20, Math.min(85, vdot));
}

function getVdotLevel(vdot) {
    if (vdot >= 60) return "전국 상위 1% 마라토너 (풀 코스 2시간대 완주 가능)";
    if (vdot >= 52) return "상위 5% 숙련 러너 (풀 코스 3시간 10분대 타겟)";
    if (vdot >= 45) return "탄탄한 중상급 러너 (풀 코스 3시간 30분~45분 안정권)";
    if (vdot >= 38) return "꾸준한 취미 러너 (풀 코스 4시간 이내 완주 가능)";
    return "기초 체력 만드는 건강 러너 (5K~10K 완주 집중 단계)";
}

/**
 * WMA (World Masters Athletics) Age-Grade 공식 추정
 */
function calculateAgeGrade(distKm, timeSec, age) {
    let worldRecordSec = 1584; // 10k 기준 26:24
    if (distKm <= 6) worldRecordSec = 755; // 5k 12:35
    else if (distKm <= 12) worldRecordSec = 1584;
    else if (distKm <= 25) worldRecordSec = 3450;
    else worldRecordSec = 7235; // 마라톤

    let ageFactor = 1.0;
    if (age > 30) {
        ageFactor = 1.0 - (age - 30) * 0.0075;
    }
    const ageStandardSec = worldRecordSec / ageFactor;
    const score = Math.min(99.5, Math.max(30, (ageStandardSec / timeSec) * 100));

    let tier = "건강 러너";
    if (score >= 85) tier = "전국 엘리트 수준";
    else if (score >= 75) tier = "지역 상위 10% 우수 러너";
    else if (score >= 65) tier = "탄탄한 중상위 러너";
    else if (score >= 50) tier = "꾸준한 취미 러너";

    return { score, tier };
}

/**
 * 이번 주 7일 데일리 훈련 플랜 자동 렌더링
 */
function generateAuto7DayPlan(vdot, basePaceSec) {
    const container = document.getElementById('auto-7day-container');
    const badgeEl = document.getElementById('auto-plan-freq-badge');
    if (!container) return;

    container.innerHTML = '';
    auto7DayEvents = [];

    const now = new Date();
    const daysName = ['일', '월', '화', '수', '목', '금', '토'];

    let planType = "beginner";
    if (vdot >= 48) planType = "advanced";
    else if (vdot >= 38) planType = "intermediate";

    if (badgeEl) {
        if (planType === 'advanced') badgeEl.textContent = "주 6~7회 풀마라톤 데일리 루틴";
        else if (planType === 'intermediate') badgeEl.textContent = "주 5회 균형 마일리지 루틴";
        else badgeEl.textContent = "주 3~4회 관절 보호 루틴";
    }

    const scheduleTemplate = {
        beginner: [
            { dayOffset: 1, type: "이지 조깅", dist: 4, badge: "badge-easy", desc: "수다 떨며 편안한 조깅" },
            { dayOffset: 2, type: "완전 휴식", dist: 0, badge: "badge-rest", desc: "하체 피로 회복 및 스트레칭" },
            { dayOffset: 3, type: "조깅 / 빌드업", dist: 5, badge: "badge-tempo", desc: "후반 1km만 기분 좋게 속도 올리기" },
            { dayOffset: 4, type: "완전 휴식", dist: 0, badge: "badge-rest", desc: "관절 휴식" },
            { dayOffset: 5, type: "이지 조깅", dist: 4, badge: "badge-easy", desc: "가벼운 컨디셔닝" },
            { dayOffset: 6, type: "주말 LSD", dist: 7, badge: "badge-long", desc: "심장 연비 키우는 지속 달리기" },
            { dayOffset: 7, type: "완전 휴식", dist: 0, badge: "badge-rest", desc: "주간 피로 회복" }
        ],
        intermediate: [
            { dayOffset: 1, type: "이지 조깅", dist: 6, badge: "badge-easy", desc: "편안한 조깅 (Zone 2)" },
            { dayOffset: 2, type: "템포런 20분", dist: 6, badge: "badge-tempo", desc: "숨찬 실전 스피드 유지" },
            { dayOffset: 3, type: "회복 조깅", dist: 5, badge: "badge-easy", desc: "가벼운 리커버리런" },
            { dayOffset: 4, type: "완전 휴식", dist: 0, badge: "badge-rest", desc: "하체 폼롤러 스트레칭" },
            { dayOffset: 5, type: "이지 조깅", dist: 6, badge: "badge-easy", desc: "주말 LSD 전 몸풀기" },
            { dayOffset: 6, type: "주말 장거리(LSD)", dist: 14, badge: "badge-long", desc: "심장 박출량 극대화" },
            { dayOffset: 7, type: "가벼운 런", dist: 4, badge: "badge-easy", desc: "피로 털어내는 조깅" }
        ],
        advanced: [
            { dayOffset: 1, type: "모닝 리커버리런", dist: 8, badge: "badge-easy", desc: "전날 장거리 피로 씻기" },
            { dayOffset: 2, type: "1000m 인터벌 5회", dist: 10, badge: "badge-tempo", desc: "심폐 배기량 확장" },
            { dayOffset: 3, type: "이지 조깅", dist: 10, badge: "badge-easy", desc: "유산소 베이스 유지" },
            { dayOffset: 4, type: "템포런 30분", dist: 12, badge: "badge-tempo", desc: "마라톤 목표 페이스 지속주" },
            { dayOffset: 5, type: "가벼운 조깅", dist: 8, badge: "badge-easy", desc: "주말 LSD 전 컨디셔닝" },
            { dayOffset: 6, type: "주말 장거리(LSD)", dist: 25, badge: "badge-long", desc: "풀코스 30km 벽 허물기" },
            { dayOffset: 7, type: "액티브 리커버리", dist: 6, badge: "badge-easy", desc: "가벼운 산책 & 조깅" }
        ]
    };

    const currentList = scheduleTemplate[planType];

    currentList.forEach(item => {
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + item.dayOffset);

        const m = targetDate.getMonth() + 1;
        const d = targetDate.getDate();
        const dayStr = daysName[targetDate.getDay()];

        const card = document.createElement('div');
        card.className = 'schedule-day-card';
        card.innerHTML = `
            <div class="schedule-day-row">
                <span class="schedule-day-title"><strong>${m}/${d} (${dayStr})</strong> · ${item.type}</span>
                <span class="schedule-dist-badge ${item.badge}">${item.dist > 0 ? `${item.dist}km` : '휴식'}</span>
            </div>
            <div class="schedule-day-sub">${item.desc}</div>
        `;
        container.appendChild(card);

        if (item.dist > 0) {
            targetDate.setHours(targetDate.getDay() === 6 || targetDate.getDay() === 0 ? 8 : 19, 0, 0);
            auto7DayEvents.push({
                date: targetDate,
                summary: `[RunAnalyz] ${item.type} ${item.dist}km`,
                desc: `${item.desc}. 부상 없이 즐겁게 달리는 날입니다!`
            });
        }
    });
}

/**
 * Riegel Race Time Prediction 테이블 렌더링
 */
function renderRiegelTable(baseDist, baseSec) {
    const tbody = document.getElementById('riegel-table-body');
    if (!tbody) return;

    const targets = [
        { name: "5 km", dist: 5 },
        { name: "10 km", dist: 10 },
        { name: "하프 마라톤 (21.0975km)", dist: 21.0975 },
        { name: "풀 코스 (42.195km)", dist: 42.195 }
    ];

    tbody.innerHTML = targets.map(target => {
        let predSec = baseSec;
        if (Math.abs(target.dist - baseDist) > 0.05) {
            predSec = baseSec * Math.pow(target.dist / baseDist, 1.06);
        }
        const timeFormatted = formatTime(predSec);
        const paceFormatted = formatPace(predSec / target.dist);

        const isCurrent = Math.abs(target.dist - baseDist) < 0.05;
        const rowStyle = isCurrent ? 'style="background-color: #EFF6FF; font-weight: 700;"' : '';

        return `
            <tr ${rowStyle}>
                <td>${target.name} ${isCurrent ? '<span style="color:var(--primary-blue); font-size:0.75rem;">(기준)</span>' : ''}</td>
                <td>${timeFormatted}</td>
                <td>${paceFormatted} / km</td>
            </tr>
        `;
    }).join('');
}

function formatPace(secPerKm) {
    if (isNaN(secPerKm) || secPerKm <= 0) return "-";
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${m}'${s < 10 ? '0' : ''}${s}"`;
}

function formatTime(totalSec) {
    if (isNaN(totalSec) || totalSec <= 0) return "-";
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = Math.round(totalSec % 60);

    if (h > 0) {
        return `${h}시간 ${m}분 ${s < 10 ? '0' : ''}${s}초`;
    }
    return `${m}분 ${s < 10 ? '0' : ''}${s}초`;
}

/**
 * 3. 독립 훈련 플래너 (PB 기반 VDOT & 안전 주간 마일리지 & 세션별 목표 페이스 산출)
 */
function initStandalonePlanner() {
    const startDateInput = document.getElementById('plan-start-date');
    if (startDateInput) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        startDateInput.value = `${yyyy}-${mm}-${dd}`;
    }

    const targetSelect = document.getElementById('plan-target');
    const daysSelect = document.getElementById('plan-days');
    const btnGenerate = document.getElementById('btn-generate-plan');
    const btnIcs = document.getElementById('btn-download-ics');

    // PB 입력값 실시간 변경 시 결과창 자동 재계산
    const pbInputs = ['plan-pb-dist', 'plan-pb-hour', 'plan-pb-min', 'plan-pb-sec'];
    pbInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                const resultBox = document.getElementById('planner-result-box');
                if (resultBox && resultBox.style.display !== 'none') {
                    generateStandalonePlan();
                }
            });
            if (el.tagName === 'INPUT') {
                el.addEventListener('input', () => {
                    const resultBox = document.getElementById('planner-result-box');
                    if (resultBox && resultBox.style.display !== 'none') {
                        generateStandalonePlan();
                    }
                });
            }
        }
    });

    if (targetSelect) {
        targetSelect.addEventListener('change', () => {
            updatePlannerDaysOptions();
            syncPlannerDaysWithCheckboxes();
            const resultBox = document.getElementById('planner-result-box');
            if (resultBox && resultBox.style.display !== 'none') {
                generateStandalonePlan();
            }
        });
    }

    if (daysSelect) {
        daysSelect.addEventListener('change', () => {
            syncPlannerDaysWithCheckboxes();
            const resultBox = document.getElementById('planner-result-box');
            if (resultBox && resultBox.style.display !== 'none') {
                generateStandalonePlan();
            }
        });
    }

    // 요일 체크박스 클릭 인터랙션 & N회 일치 강제 검증
    initPlannerDayCheckboxes();

    if (btnGenerate) {
        btnGenerate.addEventListener('click', generateStandalonePlan);
    }

    if (btnIcs) {
        btnIcs.addEventListener('click', () => {
            if (!plannerCustomEvents || plannerCustomEvents.length === 0) {
                alert('먼저 훈련 플랜을 생성해주세요.');
                return;
            }
            triggerICSDownload(plannerCustomEvents, 'runanalyz_custom_plan.ics');
        });
    }

    // 초기 옵션 로드 및 체크박스 동기화
    updatePlannerDaysOptions();
    syncPlannerDaysWithCheckboxes();
}

/**
 * 요일 체크박스 사용자 인터랙션 (N회 초과 방지 & 상태 표시)
 */
function initPlannerDayCheckboxes() {
    const checkboxes = document.querySelectorAll('input[name="plan-day-check"]');
    checkboxes.forEach(cb => {
        cb.addEventListener('click', (e) => {
            const daysSelect = document.getElementById('plan-days');
            const targetCount = parseInt(daysSelect?.value, 10) || 3;
            const checkedBoxes = document.querySelectorAll('input[name="plan-day-check"]:checked');

            if (cb.checked && checkedBoxes.length > targetCount) {
                e.preventDefault();
                cb.checked = false;
                alert(`⚠️ 선택하신 주간 훈련 빈도는 주 ${targetCount}회입니다.\n다른 요일을 선택하시려면 먼저 기존 요일 중 하나를 해제해주세요.`);
                return;
            }

            updateDaySelectStatusUI();
        });
    });
}

function syncPlannerDaysWithCheckboxes() {
    const daysSelect = document.getElementById('plan-days');
    const targetCount = parseInt(daysSelect?.value, 10) || 3;

    // 기본 추천 요일 셋 (0:일, 1:월, 2:화, 3:수, 4:목, 5:금, 6:토)
    const presetDaysMap = {
        3: [2, 4, 6],             // 화, 목, 토
        4: [2, 4, 6, 0],          // 화, 목, 토, 일
        5: [2, 3, 4, 6, 0],       // 화, 수, 목, 토, 일
        6: [2, 3, 4, 5, 6, 0],    // 화, 수, 목, 금, 토, 일
        7: [1, 2, 3, 4, 5, 6, 0]  // 월, 화, 수, 목, 금, 토, 일
    };

    const preset = presetDaysMap[targetCount] || [2, 4, 6];
    const checkboxes = document.querySelectorAll('input[name="plan-day-check"]');

    checkboxes.forEach(cb => {
        const val = parseInt(cb.value, 10);
        cb.checked = preset.includes(val);
    });

    updateDaySelectStatusUI();
}

function updateDaySelectStatusUI() {
    const daysSelect = document.getElementById('plan-days');
    const targetCount = parseInt(daysSelect?.value, 10) || 3;
    const checkedBoxes = document.querySelectorAll('input[name="plan-day-check"]:checked');
    const currentCount = checkedBoxes.length;

    const countSpan = document.getElementById('day-select-target-count');
    const badge = document.getElementById('day-select-status-badge');
    const warning = document.getElementById('day-select-warning-msg');

    if (countSpan) countSpan.textContent = targetCount;

    if (badge) {
        if (currentCount === targetCount) {
            badge.textContent = `${currentCount} / ${targetCount} 완료`;
            badge.style.color = 'var(--accent-green)';
            badge.style.background = '#DCFCE7';
        } else {
            badge.textContent = `${currentCount} / ${targetCount}개 (${targetCount - currentCount}개 더 선택)`;
            badge.style.color = 'var(--accent-orange)';
            badge.style.background = '#FFEDD5';
        }
    }

    if (warning) {
        warning.style.display = (currentCount === targetCount) ? 'none' : 'block';
        if (currentCount < targetCount) {
            warning.textContent = `※ 주 ${targetCount}회 훈련입니다. ${targetCount - currentCount}개 요일을 추가로 선택해주세요.`;
        } else if (currentCount > targetCount) {
            warning.textContent = `※ 선택된 요일(${currentCount}개)이 주간 빈도(${targetCount}회)를 초과했습니다.`;
        }
    }
}

/**
 * 목표 거리별 현실적인 훈련 빈도 옵션 동적 갱신
 */
function updatePlannerDaysOptions() {
    const target = document.getElementById('plan-target')?.value || '10k';
    const daysSelect = document.getElementById('plan-days');
    const badgeEl = document.getElementById('plan-routine-badge');
    if (!daysSelect) return;

    daysSelect.innerHTML = '';

    const optionsMap = {
        '5k': {
            badge: "부상 방지 조깅 중심",
            options: [
                { val: 3, label: "주 3회 (초보 부상 방지)", default: true },
                { val: 4, label: "주 4회 (유산소 강화)" }
            ]
        },
        '10k': {
            badge: "유산소 베이스 빌드업",
            options: [
                { val: 3, label: "주 3회 (기본 완주)" },
                { val: 4, label: "주 4회 (추천 루틴)", default: true },
                { val: 5, label: "주 5회 (기록 단축)" }
            ]
        },
        'half': {
            badge: "지구력 & 페이스 지속주",
            options: [
                { val: 4, label: "주 4회 (안정권 완주)" },
                { val: 5, label: "주 5회 (추천 루틴)", default: true },
                { val: 6, label: "주 6회 (기록 향상)" }
            ]
        },
        'full': {
            badge: "마일리지 & LSD 완주 루틴",
            options: [
                { val: 5, label: "주 5회 (풀마라톤 기본)", default: true },
                { val: 6, label: "주 6회 (서브4 목표)" },
                { val: 7, label: "주 7회 (매일 데일리 마일리지 / 마스터스)" }
            ]
        }
    };

    const config = optionsMap[target] || optionsMap['10k'];

    if (badgeEl) {
        badgeEl.textContent = config.badge;
    }

    config.options.forEach(opt => {
        const optionEl = document.createElement('option');
        optionEl.value = opt.val;
        optionEl.textContent = opt.label;
        if (opt.default) optionEl.selected = true;
        daysSelect.appendChild(optionEl);
    });
}

function generateStandalonePlan() {
    // 1) PB 값 파싱
    const pbDist = parseFloat(document.getElementById('plan-pb-dist')?.value) || 10;
    const pbH = parseInt(document.getElementById('plan-pb-hour')?.value, 10) || 0;
    const pbM = parseInt(document.getElementById('plan-pb-min')?.value, 10) || 0;
    const pbS = parseInt(document.getElementById('plan-pb-sec')?.value, 10) || 0;

    let pbTotalSec = pbH * 3600 + pbM * 60 + pbS;
    if (pbTotalSec <= 0) {
        pbTotalSec = 2910; // 기본 48분 30초 (10km 기준)
    }

    // PB 기반 VDOT 산출
    const vdot = estimateVDOT(pbDist, pbTotalSec);

    // 10km 환산 표준 페이스 도출 (Riegel 공식)
    const std10kSec = pbTotalSec * Math.pow(10 / pbDist, 1.06);
    const std10kPaceSec = std10kSec / 10; // 초/km

    // 4대 핵심 훈련 페이스 (초/km)
    // 조깅 (Zone 2 Easy): 10k 페이스 대비 122% ~ 132%
    const easyFastSec = std10kPaceSec * 1.22;
    const easySlowSec = std10kPaceSec * 1.32;
    const easyMidSec = (easyFastSec + easySlowSec) / 2;

    // 마라톤 페이스 (MP): 10k 페이스 대비 107% ~ 112%
    const mFastSec = std10kPaceSec * 1.07;
    const mSlowSec = std10kPaceSec * 1.12;
    const mMidSec = (mFastSec + mSlowSec) / 2;

    // 젖산역치 템포런 (Threshold / Tempo): 10k 페이스 대비 98% ~ 102%
    const tFastSec = std10kPaceSec * 0.98;
    const tSlowSec = std10kPaceSec * 1.02;
    const tMidSec = (tFastSec + tSlowSec) / 2;

    // VO2max 인터벌 페이스 (Interval): 10k 페이스 대비 90% ~ 94%
    const iFastSec = std10kPaceSec * 0.90;
    const iSlowSec = std10kPaceSec * 0.94;
    const iMidSec = (iFastSec + iSlowSec) / 2;

    // 목표 대회 설정 파싱
    const target = document.getElementById('plan-target')?.value || '10k';
    const weeks = parseInt(document.getElementById('plan-weeks')?.value, 10) || 8;
    const daysPerWeek = parseInt(document.getElementById('plan-days')?.value, 10) || 4;
    const startDateVal = document.getElementById('plan-start-date')?.value;

    if (!startDateVal) {
        alert('훈련 시작 날짜를 선택해주세요.');
        return;
    }

    // 선택된 요일 확인 및 유효성 검사
    const checkedBoxes = Array.from(document.querySelectorAll('input[name="plan-day-check"]:checked'));
    if (checkedBoxes.length !== daysPerWeek) {
        alert(`⚠️ 선택하신 주간 훈련 빈도는 '주 ${daysPerWeek}회'입니다.\n현재 ${checkedBoxes.length}개 요일이 선택되어 있습니다. 요일을 정확히 ${daysPerWeek}개 체크해주세요.`);
        return;
    }

    const dayNames = { 0: "일요일", 1: "월요일", 2: "화요일", 3: "수요일", 4: "목요일", 5: "금요일", 6: "토요일" };
    const mondayOffsets = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 };

    const selectedDays = checkedBoxes
        .map(cb => parseInt(cb.value, 10))
        .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));

    const startDate = new Date(startDateVal);
    plannerCustomEvents = [];

    // VDOT 기반 러너 레벨 & 권장 주간 마일리지 산출
    let tierName = "꾸준한 취미 러너";
    let vdotMult = 1.0;
    if (vdot >= 60) {
        tierName = "최상위 엘리트/마스터스";
        vdotMult = 1.35;
    } else if (vdot >= 52) {
        tierName = "상위 5% 싱글 러너";
        vdotMult = 1.22;
    } else if (vdot >= 45) {
        tierName = "탄탄한 중상급 러너";
        vdotMult = 1.10;
    } else if (vdot >= 38) {
        tierName = "서브4 타겟 취미 러너";
        vdotMult = 1.0;
    } else {
        tierName = "기초 유산소 건강 러너";
        vdotMult = 0.85;
    }

    let baseEasy = 5;
    let baseLSD = 8;
    let targetName = "10km 단축마라톤";
    let routineBadgeText = "유산소 베이스 빌드업";
    let targetMileageMin = 30;
    let targetMileageMax = 38;

    if (target === '5k') {
        baseEasy = 4; baseLSD = 6; targetName = "5km 스피드 코스"; routineBadgeText = "부상 방지 조깅 중심";
        targetMileageMin = Math.round(20 * vdotMult);
        targetMileageMax = Math.round(28 * vdotMult);
    } else if (target === '10k') {
        baseEasy = 5; baseLSD = 9; targetName = "10km 단축마라톤"; routineBadgeText = "유산소 베이스 빌드업";
        targetMileageMin = Math.round(30 * vdotMult);
        targetMileageMax = Math.round(40 * vdotMult);
    } else if (target === 'half') {
        baseEasy = 7; baseLSD = 14; targetName = "하프마라톤 (21.1km)"; routineBadgeText = "지구력 & 페이스 지속주";
        targetMileageMin = Math.round(38 * vdotMult);
        targetMileageMax = Math.round(52 * vdotMult);
    } else if (target === 'full') {
        baseEasy = 8; baseLSD = 20; targetName = "풀마라톤 (42.2km)"; routineBadgeText = "마일리지 & LSD 완주 루틴";
        targetMileageMin = Math.round(48 * vdotMult);
        targetMileageMax = Math.round(68 * vdotMult);
    }

    // 상단 브리핑 카드 업데이트
    const vdotBadgeEl = document.getElementById('plan-vdot-badge');
    const weeklyMileageValEl = document.getElementById('plan-weekly-mileage-val');
    const paceEasyValEl = document.getElementById('plan-pace-easy-val');
    const paceTempoValEl = document.getElementById('plan-pace-tempo-val');
    const paceIntervalValEl = document.getElementById('plan-pace-interval-val');

    if (vdotBadgeEl) vdotBadgeEl.textContent = `VDOT ${vdot.toFixed(1)}점 • ${tierName}`;
    if (weeklyMileageValEl) weeklyMileageValEl.textContent = `평균 ${targetMileageMin} ~ ${targetMileageMax} km`;
    if (paceEasyValEl) paceEasyValEl.textContent = `${formatPace(easyFastSec)} ~ ${formatPace(easySlowSec)}`;
    if (paceTempoValEl) paceTempoValEl.textContent = `${formatPace(tFastSec)} ~ ${formatPace(tSlowSec)}`;
    if (paceIntervalValEl) paceIntervalValEl.textContent = `${formatPace(iFastSec)} ~ ${formatPace(iSlowSec)}`;

    const badgeEl = document.getElementById('plan-routine-badge');
    if (badgeEl) badgeEl.textContent = routineBadgeText;

    const container = document.getElementById('plan-weeks-container');
    container.innerHTML = '';

    // 훈련 주차 생성 (3주 점진적 증량 + 1주 회복주(-20%) + 마지막 테이퍼링 주기화)
    for (let w = 1; w <= weeks; w++) {
        const weekDiv = document.createElement('div');
        weekDiv.className = 'schedule-week';
        weekDiv.style.marginBottom = '20px';

        // 주기화 상태 판단
        let weekStatus = "베이스 빌드업";
        let weekMult = 1.0;

        const isTaper = (w === weeks);
        const isPreTaper = (weeks >= 8 && w === weeks - 1);
        const isRecoveryWeek = (!isTaper && !isPreTaper && w % 4 === 0);

        if (isTaper) {
            weekStatus = "대회 직전 테이퍼링 (-40%)";
            weekMult = 0.60;
        } else if (isPreTaper) {
            weekStatus = "테이퍼링 1단계 (-20%)";
            weekMult = 0.80;
        } else if (isRecoveryWeek) {
            weekStatus = "부상 방지 회복주 (Rest Week -20%)";
            weekMult = 0.80;
        } else {
            // 점진적 증량 (주차마다 약 3~5%씩 누적 빌드업)
            const buildStep = (w - 1) - Math.floor((w - 1) / 4);
            weekMult = 1.0 + (buildStep * 0.05);
            weekStatus = `점진적 마일리지 확장 (+${Math.round((weekMult - 1) * 100)}%)`;
        }

        // 주차별 세션 거리 계산
        let currentLsdDist = Math.round(baseLSD * weekMult);
        if (target === 'full') {
            currentLsdDist = isTaper ? 15 : Math.min(35, currentLsdDist);
        } else if (target === 'half') {
            currentLsdDist = isTaper ? 10 : Math.min(22, currentLsdDist);
        } else {
            currentLsdDist = isTaper ? 5 : Math.min(15, currentLsdDist);
        }

        const currentEasyDist = Math.max(3, Math.round(baseEasy * weekMult));
        const currentTempoDist = Math.max(4, Math.round(currentEasyDist * 0.85));
        const currentRecoveryDist = Math.max(3, Math.round(currentEasyDist * 0.65));

        // 세션별 구체적 페이스 텍스트 매핑
        const easyPaceText = formatPace(easyMidSec);
        const tempoPaceText = formatPace(tMidSec);
        const marathonPaceText = formatPace(mMidSec);
        const intervalPaceText = formatPace(iMidSec);
        const recoveryPaceText = formatPace(easySlowSec * 1.05);

        // 사용자가 선택한 요일에 맞춤형 훈련 세션 지능형 매핑
        const daysSchedule = [];
        selectedDays.forEach((dayNum, idx) => {
            const dayName = dayNames[dayNum];
            const offset = mondayOffsets[dayNum];

            let session = {
                dayName,
                offset,
                type: "이지 조깅",
                dist: currentEasyDist,
                targetPace: easyPaceText,
                badge: "badge-easy",
                desc: `Zone 2 편안한 유산소 (대화가 가능한 속도)`
            };

            if (selectedDays.length === 3) {
                if (idx === 0) {
                    session = {
                        dayName, offset,
                        type: "이지 조깅",
                        dist: currentEasyDist,
                        targetPace: easyPaceText,
                        badge: "badge-easy",
                        desc: `유산소 기초 체력 확장 (심박 안정화)`
                    };
                } else if (idx === 1) {
                    session = {
                        dayName, offset,
                        type: "젖산역치 템포런",
                        dist: currentTempoDist,
                        targetPace: tempoPaceText,
                        badge: "badge-tempo",
                        desc: `젖산 분해 한계 속도 적응`
                    };
                } else {
                    session = {
                        dayName, offset,
                        type: "주말 LSD",
                        dist: currentLsdDist,
                        targetPace: formatPace(easySlowSec),
                        badge: "badge-long",
                        desc: `심장 배기량 & 체지방 연소 지속주`
                    };
                }
            } else if (selectedDays.length === 4) {
                if (idx === 0) {
                    session = {
                        dayName, offset,
                        type: "이지 조깅",
                        dist: currentEasyDist,
                        targetPace: easyPaceText,
                        badge: "badge-easy",
                        desc: `유산소 베이스 조깅`
                    };
                } else if (idx === 1) {
                    session = {
                        dayName, offset,
                        type: "템포런 / 페이스주",
                        dist: currentTempoDist,
                        targetPace: (target === 'full' ? marathonPaceText : tempoPaceText),
                        badge: "badge-tempo",
                        desc: `실전 레이스 페이스 적응`
                    };
                } else if (idx === 2) {
                    session = {
                        dayName, offset,
                        type: "회복 조깅",
                        dist: currentRecoveryDist,
                        targetPace: recoveryPaceText,
                        badge: "badge-rest",
                        desc: `피로 털어내는 초경량 리커버리`
                    };
                } else {
                    session = {
                        dayName, offset,
                        type: "주말 LSD",
                        dist: currentLsdDist,
                        targetPace: formatPace(easySlowSec),
                        badge: "badge-long",
                        desc: `지구력 확장 장거리 훈련`
                    };
                }
            } else if (selectedDays.length === 5) {
                if (idx === 0) {
                    session = {
                        dayName, offset,
                        type: "이지 조깅",
                        dist: currentEasyDist,
                        targetPace: easyPaceText,
                        badge: "badge-easy",
                        desc: `Zone 2 유산소 베이스 확장`
                    };
                } else if (idx === 1) {
                    session = {
                        dayName, offset,
                        type: "스피드 인터벌",
                        dist: Math.max(4, Math.round(currentTempoDist * 0.9)),
                        targetPace: intervalPaceText,
                        badge: "badge-tempo",
                        desc: `VO2max 최대산소섭취량 자극 (질주 구간)`
                    };
                } else if (idx === 2) {
                    session = {
                        dayName, offset,
                        type: "회복 조깅",
                        dist: currentRecoveryDist,
                        targetPace: recoveryPaceText,
                        badge: "badge-rest",
                        desc: `가벼운 피로 회복런`
                    };
                } else if (idx === 3) {
                    session = {
                        dayName, offset,
                        type: target === 'full' ? "마라톤 페이스주" : "템포런",
                        dist: currentTempoDist,
                        targetPace: target === 'full' ? marathonPaceText : tempoPaceText,
                        badge: "badge-tempo",
                        desc: `목표 페이스 몸에 익히기`
                    };
                } else {
                    session = {
                        dayName, offset,
                        type: "주말 LSD",
                        dist: currentLsdDist,
                        targetPace: formatPace(easySlowSec),
                        badge: "badge-long",
                        desc: `대회 완주용 지구력 장거리`
                    };
                }
            } else {
                // 6회 또는 7회
                const types = [
                    { type: "모닝 조깅", dist: currentEasyDist, pace: easyPaceText, badge: "badge-easy", desc: `기초 유산소` },
                    { type: "스피드 세션", dist: currentTempoDist, pace: (idx % 2 === 0 ? tempoPaceText : intervalPaceText), badge: "badge-tempo", desc: `심폐 부하 자극` },
                    { type: "회복 조깅", dist: currentRecoveryDist, pace: recoveryPaceText, badge: "badge-rest", desc: `피로 분해 조깅` },
                    { type: "컨디셔닝 런", dist: currentEasyDist, pace: easyPaceText, badge: "badge-easy", desc: `밸런스 유지주` },
                    { type: "주말 LSD", dist: currentLsdDist, pace: formatPace(easySlowSec), badge: "badge-long", desc: `지속주 마일리지` },
                    { type: "액티브 리커버리", dist: currentRecoveryDist, pace: recoveryPaceText, badge: "badge-rest", desc: `가벼운 쉐이크아웃` },
                    { type: "가벼운 런", dist: currentRecoveryDist, pace: recoveryPaceText, badge: "badge-rest", desc: `컨디션 조율` }
                ];
                const t = types[idx % types.length];
                session = {
                    dayName, offset,
                    type: t.type,
                    dist: t.dist,
                    targetPace: t.pace,
                    badge: t.badge,
                    desc: t.desc
                };
            }

            daysSchedule.push(session);
        });

        const weeklyKm = daysSchedule.reduce((acc, cur) => acc + cur.dist, 0);

        const cardsHtml = daysSchedule.map(item => `
            <div class="schedule-day-card" style="margin-bottom:8px;">
                <div class="schedule-day-row">
                    <span class="schedule-day-title"><strong>${item.dayName}</strong> · ${item.type}</span>
                    <span class="schedule-dist-badge ${item.badge}">${item.dist}km</span>
                </div>
                <div class="schedule-day-sub">
                    <span style="display:inline-block; font-weight:800; color:var(--primary-blue); background:#EFF6FF; padding:1px 6px; border-radius:4px; font-size:0.78rem; margin-right:4px;">
                        🎯 목표 페이스: ${item.targetPace}/km
                    </span>
                    <span>${item.desc}</span>
                </div>
            </div>
        `).join('');

        weekDiv.innerHTML = `
            <div class="schedule-week-title" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding-bottom:6px; border-bottom:1px dashed var(--border-light);">
                <span style="font-weight:800; font-size:0.95rem; color:var(--text-primary);">${w}주차 (${weekStatus})</span>
                <span style="font-size:0.8rem; color:var(--text-muted); font-weight:700;">주간 합계 약 ${weeklyKm}km</span>
            </div>
            ${cardsHtml}
        `;
        container.appendChild(weekDiv);

        // 월요일 기준 날짜 계산
        const weekStart = new Date(startDate);
        const dayOfWeek = weekStart.getDay(); // 0:일, 1:월 ...
        const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
        const currentMonday = new Date(weekStart);
        currentMonday.setDate(currentMonday.getDate() + diffToMonday + (w - 1) * 7);

        daysSchedule.forEach(item => {
            const eventDate = new Date(currentMonday);
            eventDate.setDate(eventDate.getDate() + item.offset);
            eventDate.setHours(item.offset === 5 || item.offset === 6 ? 8 : 19, 0, 0);
            plannerCustomEvents.push({
                date: eventDate,
                summary: `[RunAnalyz] ${item.type} ${item.dist}km (목표: ${item.targetPace}/km)`,
                desc: `${item.desc}\n목표 페이스: ${item.targetPace}/km | 훈련 목표: ${targetName} (${w}주차)`
            });
        });
    }

    const summaryTitle = document.getElementById('plan-summary-title');
    if (summaryTitle) {
        const selectedDayStr = selectedDays.map(d => dayNames[d].replace('요일', '')).join('·');
        summaryTitle.textContent = `${targetName} • ${weeks}주 완성 (${selectedDayStr} / 주 ${daysPerWeek}회)`;
    }

    const resultBox = document.getElementById('planner-result-box');
    if (resultBox) {
        resultBox.style.display = 'block';
        resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}


/**
 * 4. 범용 ICS 파일 다운로드 실행기
 */
function triggerICSDownload(scheduleArray, filename) {
    function formatDateToICS(dt) {
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        const h = String(dt.getHours()).padStart(2, '0');
        const min = String(dt.getMinutes()).padStart(2, '0');
        const s = String(dt.getSeconds()).padStart(2, '0');
        return `${y}${m}${d}T${h}${min}${s}`;
    }

    let icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//RunAnalyz Mk2//Training Planner//KO",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:RunAnalyz 러닝 훈련 플랜",
        "X-WR-TIMEZONE:Asia/Seoul"
    ];

    scheduleArray.forEach((evt, idx) => {
        const startStr = formatDateToICS(evt.date);
        const endDt = new Date(evt.date.getTime() + 60 * 60 * 1000);
        const endStr = formatDateToICS(endDt);

        icsContent.push("BEGIN:VEVENT");
        icsContent.push(`UID:runanalyz-${Date.now()}-${idx}@runanalyz.com`);
        icsContent.push(`DTSTAMP:${formatDateToICS(new Date())}`);
        icsContent.push(`DTSTART:${startStr}`);
        icsContent.push(`DTEND:${endStr}`);
        icsContent.push(`SUMMARY:${evt.summary}`);
        icsContent.push(`DESCRIPTION:${evt.desc}`);
        icsContent.push("STATUS:CONFIRMED");
        icsContent.push("BEGIN:VALARM");
        icsContent.push("TRIGGER:-PT30M");
        icsContent.push("ACTION:DISPLAY");
        icsContent.push("DESCRIPTION:달리기 알림");
        icsContent.push("END:VALARM");
        icsContent.push("END:VEVENT");
    });

    icsContent.push("END:VCALENDAR");

    const blob = new Blob([icsContent.join("\r\n")], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * 5. 익명 한줄 러너 메모장 시스템
 */
function initMemoSystem() {
    renderCaptcha();
    renderMemos();

    const form = document.getElementById('calcMemoForm');
    if (form) {
        form.addEventListener('submit', handleMemoSubmit);
    }
}

function renderCaptcha() {
    const num1 = Math.floor(Math.random() * 8) + 1;
    const num2 = Math.floor(Math.random() * 8) + 1;
    currentCaptchaAns = num1 + num2;
    const quizEl = document.getElementById('memoQuiz');
    if (quizEl) {
        quizEl.textContent = `${num1} + ${num2} =`;
    }
}

function getStoredMemos() {
    try {
        const raw = localStorage.getItem(MEMO_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (e) {
        console.error(e);
    }
    return [
        { author: "잠실러너", text: "10k 48분 찍고 조깅 6분 페이스로 낮췄더니 무릎 통증 싹 사라졌습니다. 조깅은 진짜 느릴수록 보약이네요!", time: "방금 전" },
        { author: "서브3도전", text: "심박수 Zone 2 지키기가 제일 힘들었는데, 2달 버티니까 같은 심박에서 페이스가 30초 당겨집니다. 강추!", time: "1시간 전" },
        { author: "런데이초보", text: "폰 캘린더에 일정 다운로드 받아서 화목토 알림 오니까 귀찮아도 운동화 끈 묶게 돼요 ㅎㅎ", time: "어제" }
    ];
}

function renderMemos() {
    const listBox = document.getElementById('calcMemoList');
    const badge = document.getElementById('memoCountBadge');
    if (!listBox) return;

    const memos = getStoredMemos();
    if (badge) badge.textContent = `${memos.length}개`;

    listBox.innerHTML = memos.map(m => `
        <div class="memo-item">
            <div class="memo-item-top">
                <span class="memo-author">🏃 ${escapeHtml(m.author)}</span>
                <span class="memo-time">${m.time}</span>
            </div>
            <div class="memo-text">${escapeHtml(m.text)}</div>
        </div>
    `).join('');
}

function handleMemoSubmit(e) {
    e.preventDefault();

    const now = Date.now();
    if (now - lastMemoTime < 10000) {
        alert('도배 방지를 위해 10초 후에 다시 작성해주세요.');
        return;
    }

    const trap = document.getElementById('hp_trap');
    if (trap && trap.value) return;

    const userAns = parseInt(document.getElementById('memoAns').value, 10);
    if (userAns !== currentCaptchaAns) {
        alert('보안 퀴즈(덧셈) 정답이 올바르지 않습니다.');
        renderCaptcha();
        return;
    }

    const authorInput = document.getElementById('memoAuthor');
    const textInput = document.getElementById('memoText');

    const author = authorInput.value.trim() || "익명러너";
    const text = textInput.value.trim();

    if (!text) {
        alert('한줄 소감이나 팁을 입력해주세요.');
        return;
    }

    const newMemo = {
        author: author,
        text: text,
        time: "방금 전"
    };

    const memos = getStoredMemos();
    memos.unshift(newMemo);

    try {
        localStorage.setItem(MEMO_STORAGE_KEY, JSON.stringify(memos.slice(0, 50)));
    } catch (e) {
        console.error(e);
    }

    lastMemoTime = now;
    textInput.value = '';
    document.getElementById('memoAns').value = '';
    renderCaptcha();
    renderMemos();
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

/**
 * 5. 러닝 사이언스 카테고리 칩 필터링
 */
function initArticleFilters() {
    const filterContainer = document.getElementById('articleFilterBar');
    if (!filterContainer) return;
    const filterChips = filterContainer.querySelectorAll('.filter-chip');
    const articleCards = document.querySelectorAll('.article-card');

    if (!filterChips.length || !articleCards.length) return;

    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const filter = chip.dataset.filter;

            // 칩 active 토글
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            // 아티클 카드 표시/숨김
            let matchCount = 0;
            articleCards.forEach(card => {
                const category = card.dataset.category;
                if (filter === 'all' || category === filter) {
                    card.style.display = 'flex';
                    matchCount++;
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });
}

/**
 * 6. 트레드밀 속도(kph) ⇄ 페이스(min/km) 양방향 환산기 & 거리별 완주 예측
 */
function initTreadmillConverter() {
    // 6-1. 서브 스위처 탭 전환
    const switchBtns = document.querySelectorAll('.sub-switch-btn');
    const panePace = document.getElementById('calc-pane-pace');
    const paneTreadmill = document.getElementById('calc-pane-treadmill');

    if (switchBtns.length && panePace && paneTreadmill) {
        switchBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.calcTab;
                switchBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                if (tab === 'pace') {
                    panePace.style.display = 'block';
                    paneTreadmill.style.display = 'none';
                } else {
                    panePace.style.display = 'none';
                    paneTreadmill.style.display = 'block';
                }
            });
        });
    }

    // 6-2. DOM 요소 바인딩
    const kphInput = document.getElementById('treadmill-kph-input');
    const paceMinInput = document.getElementById('treadmill-pace-min');
    const paceSecInput = document.getElementById('treadmill-pace-sec');
    const presetBtns = document.querySelectorAll('.btn-tread-preset');

    const resultPace = document.getElementById('tread-result-pace');
    const resultMile = document.getElementById('tread-result-mile');
    const summaryKph = document.getElementById('tread-summary-kph');

    const time3k = document.getElementById('tread-time-3k');
    const time5k = document.getElementById('tread-time-5k');
    const time10k = document.getElementById('tread-time-10k');
    const timeHalf = document.getElementById('tread-time-half');
    const timeFull = document.getElementById('tread-time-full');

    if (!kphInput || !paceMinInput || !paceSecInput) return;

    let isUpdating = false;

    function formatTime(totalSeconds) {
        if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0 || !isFinite(totalSeconds)) {
            return '-';
        }
        const total = Math.round(totalSeconds);
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        const pad = (n) => String(n).padStart(2, '0');

        if (h > 0) {
            return `${h}시간 ${pad(m)}분 ${pad(s)}초`;
        }
        return `${m}분 ${pad(s)}초`;
    }

    function syncActivePreset(kphVal) {
        const rounded = (Math.round(kphVal * 10) / 10).toFixed(1);
        presetBtns.forEach(btn => {
            if (parseFloat(btn.dataset.kph).toFixed(1) === rounded) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    function renderCalculations(kph) {
        if (summaryKph) summaryKph.textContent = kph.toFixed(1);

        // 1km당 페이스 초
        const secPerKm = 3600 / kph;
        let pMin = Math.floor(secPerKm / 60);
        let pSec = Math.round(secPerKm % 60);
        if (pSec === 60) {
            pMin += 1;
            pSec = 0;
        }

        const paceStr = `${pMin}'${String(pSec).padStart(2, '0')}"`;
        if (resultPace) resultPace.textContent = paceStr;

        // 1마일당 페이스 (1마일 = 1.609344 km)
        const secPerMile = secPerKm * 1.609344;
        let mMin = Math.floor(secPerMile / 60);
        let mSec = Math.round(secPerMile % 60);
        if (mSec === 60) {
            mMin += 1;
            mSec = 0;
        }
        if (resultMile) resultMile.textContent = `${mMin}'${String(mSec).padStart(2, '0')}"`;

        // 거리별 완주 시간
        if (time3k) time3k.textContent = formatTime((3 / kph) * 3600);
        if (time5k) time5k.textContent = formatTime((5 / kph) * 3600);
        if (time10k) time10k.textContent = formatTime((10 / kph) * 3600);
        if (timeHalf) timeHalf.textContent = formatTime((21.0975 / kph) * 3600);
        if (timeFull) timeFull.textContent = formatTime((42.195 / kph) * 3600);
    }

    function updateFromKph() {
        if (isUpdating) return;
        isUpdating = true;

        const kph = parseFloat(kphInput.value);
        if (!isNaN(kph) && kph > 0) {
            const secPerKm = 3600 / kph;
            let pMin = Math.floor(secPerKm / 60);
            let pSec = Math.round(secPerKm % 60);
            if (pSec === 60) {
                pMin += 1;
                pSec = 0;
            }

            paceMinInput.value = pMin;
            paceSecInput.value = String(pSec).padStart(2, '0');

            syncActivePreset(kph);
            renderCalculations(kph);
        }

        isUpdating = false;
    }

    function updateFromPace() {
        if (isUpdating) return;
        isUpdating = true;

        const min = parseInt(paceMinInput.value, 10) || 0;
        const sec = parseInt(paceSecInput.value, 10) || 0;
        const totalSec = (min * 60) + sec;

        if (totalSec > 0) {
            const calculatedKph = 3600 / totalSec;
            const clampedKph = Math.min(Math.max(calculatedKph, 1.0), 35.0);
            kphInput.value = (Math.round(clampedKph * 10) / 10).toFixed(1);

            syncActivePreset(clampedKph);
            renderCalculations(clampedKph);
        }

        isUpdating = false;
    }

    // 6-3. 이벤트 바인딩
    kphInput.addEventListener('input', updateFromKph);
    kphInput.addEventListener('change', updateFromKph);

    paceMinInput.addEventListener('input', updateFromPace);
    paceMinInput.addEventListener('change', updateFromPace);
    paceSecInput.addEventListener('input', updateFromPace);
    paceSecInput.addEventListener('change', updateFromPace);

    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const kph = parseFloat(btn.dataset.kph);
            if (!isNaN(kph)) {
                kphInput.value = kph.toFixed(1);
                updateFromKph();
            }
        });
    });

    // 초기 1회 환산 렌더링
    updateFromKph();
}

