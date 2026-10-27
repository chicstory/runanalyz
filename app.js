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
    initHrZoneCalculator();
    initRaceCalendar();
    // 초기 1회 기본 진단 실행 (10km 48분, 35세, RPE 7, 심박 145)
    calculateComprehensiveDiagnostics();
});

/**
 * 1. 4대 메인 뷰 전환 (계산기 / 플래너 / 마라톤 일정 / 런로그)
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

        // 런로그/플래너/대회일정 선택 시 계산기용 히어로 배너를 숨겨 콘텐츠가 상단에 즉각 밀착되도록 최적화
        if (heroSection) {
            heroSection.style.display = (viewKey === 'calc') ? 'block' : 'none';
        }
    }

    segmentBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            switchView(btn.dataset.view);
        });
    });

    // URL 파라미터 처리 (?view=planner, ?view=races, ?sub=hrzone, ?sub=treadmill 등)
    const urlParams = new URLSearchParams(window.location.search);
    const initialView = urlParams.get('view') || (urlParams.get('tab') === 'calc' ? 'calc' : null);
    if (initialView && ['calc', 'planner', 'races', 'articles'].includes(initialView)) {
        switchView(initialView);
    }

    const subTab = urlParams.get('sub');
    if (subTab && ['pace', 'treadmill', 'hrzone'].includes(subTab)) {
        switchView('calc');
        const subBtn = document.querySelector(`.sub-switch-btn[data-calc-tab="${subTab}"]`);
        if (subBtn) subBtn.click();
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
    let tierTitle = "통증 없이 오래 달리기 위한 입문 런로그";
    let recommendations = [];

    if (vdot >= 48) {
        tierBadge = "상급 러너 맞춤 (서브 3.5 & 서브3 도약)";
        tierTitle = "기록 한계를 돌파하는 엘리트 레이스 런로그";
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
        tierTitle = "심장 연비와 유산소 지구력을 위한 핵심 런로그";
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
        tierTitle = "통증 없이 평생 달리기 위한 입문 런로그";
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
 * 🏆 목표 메이저 대회 선택 시 훈련 플래너 입력값 및 D-100(14주) 일정 자동 적용
 */
function applyRaceToPlannerForm(race) {
    if (!race) return;

    // 1. 목표 거리 풀코스로 세팅
    const targetSelect = document.getElementById('plan-target');
    if (targetSelect) {
        targetSelect.value = 'full';
        updatePlannerDaysOptions();
    }

    // 2. 훈련 기간 14주(D-100)로 세팅
    const weeksSelect = document.getElementById('plan-weeks');
    if (weeksSelect) {
        weeksSelect.value = '14';
    }

    // 3. 주간 빈도 4회 권장 세팅
    const daysSelect = document.getElementById('plan-days');
    if (daysSelect) {
        daysSelect.value = '4';
        syncPlannerDaysWithCheckboxes();
    }

    // 4. 시작일 스마트 계산 (대회일로부터 98일 = 14주 전 날짜)
    const startDateInput = document.getElementById('plan-start-date');
    if (startDateInput && race.date) {
        const rDate = new Date(race.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 14주(98일) 전 날짜 계산
        const d100Date = new Date(rDate.getTime() - (14 * 7 * 24 * 60 * 60 * 1000));
        
        // 만약 d100Date가 과거라면(대회까지 14주가 안 남았다면), 시작일은 오늘로 세팅
        const effectiveStartDate = (d100Date.getTime() < today.getTime()) ? today : d100Date;

        const yyyy = effectiveStartDate.getFullYear();
        const mm = String(effectiveStartDate.getMonth() + 1).padStart(2, '0');
        const dd = String(effectiveStartDate.getDate()).padStart(2, '0');
        startDateInput.value = `${yyyy}-${mm}-${dd}`;
    }
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

    const raceSelect = document.getElementById('plan-race-select');
    const weeksSelect = document.getElementById('plan-weeks');

    // 🏆 메이저 대회 드롭다운 선택 시 D-100(14주) 일정 자동 동기화
    if (raceSelect) {
        raceSelect.addEventListener('change', () => {
            const raceId = raceSelect.value;
            if (raceId) {
                const race = MAJOR_RACES.find(r => r.id === raceId);
                if (race) {
                    applyRaceToPlannerForm(race);
                }
            } else {
                const targetBanner = document.getElementById('plan-race-target-banner');
                if (targetBanner) targetBanner.style.display = 'none';
            }
            generateStandalonePlan();
        });
    }

    if (weeksSelect) {
        weeksSelect.addEventListener('change', () => {
            const resultBox = document.getElementById('planner-result-box');
            if (resultBox && resultBox.style.display !== 'none') {
                generateStandalonePlan();
            }
        });
    }

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

    // 🏆 목표 메이저 대회 연동 배너 처리
    const raceSelect = document.getElementById('plan-race-select');
    const targetBanner = document.getElementById('plan-race-target-banner');
    const targetBannerName = document.getElementById('target-banner-race-name');
    const targetBannerDday = document.getElementById('target-banner-dday');
    const targetBannerDesc = document.getElementById('target-banner-desc');

    if (raceSelect && raceSelect.value && targetBanner) {
        const race = MAJOR_RACES.find(r => r.id === raceSelect.value);
        if (race) {
            targetBanner.style.display = 'block';
            if (targetBannerName) {
                targetBannerName.textContent = `${race.name} (${race.isExpected ? race.expectedMonth : race.date})`;
            }
            if (targetBannerDday) {
                const ddayInfo = getRaceDDayInfo(race);
                targetBannerDday.textContent = ddayInfo.badgeText;
                targetBannerDday.style.background = ddayInfo.isUrgent ? '#DC2626' : '#1D4ED8';
            }
            if (targetBannerDesc) {
                targetBannerDesc.innerHTML = `
                    <strong>코스 분석:</strong> 누적고도 ▲ ${race.elevation} · ${race.tags.join(' ')}<br>
                    <strong>코치 가이드:</strong> ${race.guide}
                `;
            }
        }
    } else if (targetBanner) {
        targetBanner.style.display = 'none';
    }

    const badgeEl = document.getElementById('plan-routine-badge');
    if (badgeEl) {
        badgeEl.textContent = weeks === 14 ? "D-100 14주 주기화 마스터" : routineBadgeText;
    }

    const container = document.getElementById('plan-weeks-container');
    container.innerHTML = '';

    // 훈련 주차 생성 (14주 D-100 주기화 vs 일반 4/8/12주 주기화)
    for (let w = 1; w <= weeks; w++) {
        const weekDiv = document.createElement('div');
        weekDiv.className = 'schedule-week';
        weekDiv.style.marginBottom = '20px';

        // 주기화 상태 판단
        let weekStatus = "베이스 빌드업";
        let weekMult = 1.0;
        let phaseBadge = "";

        if (weeks === 14) {
            // 🔥 가민 스타일 14주 (D-100) 마라톤 주기화 완성 로드맵
            if (w <= 4) {
                // 1단계: 유산소 베이스 빌드업 & 착지 안정화
                phaseBadge = "1단계: 기초 베이스 빌드업";
                const isStepRecovery = (w === 4);
                weekMult = isStepRecovery ? 0.85 : (0.85 + (w * 0.05));
                weekStatus = isStepRecovery ? "1단계 완료 회복주 (-15%)" : `유산소 적응 빌드업 (+${Math.round((weekMult - 0.85) * 100)}%)`;
            } else if (w <= 8) {
                // 2단계: 유산소 배기량 확장 & LSD 20~26km
                phaseBadge = "2단계: 유산소 배기량 & LSD 강화";
                const isStepRecovery = (w === 8);
                weekMult = isStepRecovery ? 0.90 : (1.0 + ((w - 4) * 0.05));
                weekStatus = isStepRecovery ? "2단계 완료 회복주 (-15%)" : `지구력 확장 롱런 (+${Math.round((weekMult - 1.0) * 100)}%)`;
            } else if (w <= 12) {
                // 3단계: 실전 마라톤 페이스(MP) & 32km 최종 LSD 피크
                phaseBadge = "3단계: M페이스 실전 & 피크";
                if (w === 12) {
                    weekMult = 1.30;
                    weekStatus = "🔥 14주 중 최고 마일리지 & 32km 최종 LSD 피크";
                } else {
                    weekMult = 1.10 + ((w - 8) * 0.05);
                    weekStatus = `마라톤 실전 페이스 지속주 (+${Math.round((weekMult - 1.0) * 100)}%)`;
                }
            } else {
                // 4단계: 피로 제거 테이퍼링 (D-14 ~ D-Day)
                phaseBadge = "4단계: 피로 회복 테이퍼링";
                if (w === 13) {
                    weekMult = 0.75;
                    weekStatus = "테이퍼링 1단계 (-25% 마일리지 축소)";
                } else {
                    weekMult = 0.50;
                    weekStatus = "대회 주간 글리코겐 로딩 & 최종 컨디셔닝 (-50%)";
                }
            }
        } else {
            // 일반 4/8/12주 주기화
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
            <div class="schedule-week-title" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding-bottom:6px; border-bottom:1px dashed var(--border-light); flex-wrap:wrap; gap:6px;">
                <span style="font-weight:800; font-size:0.95rem; color:var(--text-primary); display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    ${phaseBadge ? `<span style="font-size:0.72rem; background:#DBEAFE; color:#1E40AF; padding:2px 8px; border-radius:4px; font-weight:800;">${phaseBadge}</span>` : ''}
                    <span>${w}주차 · ${weekStatus}</span>
                </span>
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
 * 5. 런로그 5대 카테고리 필터링 & 초고속 실시간 검색 통합 엔진
 */
function initArticleFilters() {
    const filterContainer = document.getElementById('articleFilterBar');
    const searchInput = document.getElementById('articleSearchInput');
    const clearBtn = document.getElementById('btnArticleSearchClear');
    const searchResultBar = document.getElementById('articleSearchResultBar');
    const searchResultText = document.getElementById('searchResultText');
    const resetSearchBtn = document.getElementById('btnSearchFilterReset');
    const emptyState = document.getElementById('articleEmptyState');
    const resetFiltersBtn = document.getElementById('btnResetFilters');
    const articleCards = document.querySelectorAll('.article-card');

    if (!articleCards.length) return;

    let currentCategory = 'all';
    let currentQuery = '';

    const filterChips = filterContainer ? filterContainer.querySelectorAll('.filter-chip') : [];

    function applyFilter() {
        let matchCount = 0;
        const q = currentQuery.trim().toLowerCase();

        articleCards.forEach(card => {
            const cat = card.dataset.category || '';
            const catMatch = (currentCategory === 'all' || cat === currentCategory);

            let searchMatch = true;
            if (q) {
                const text = card.textContent.toLowerCase();
                searchMatch = text.includes(q);
            }

            if (catMatch && searchMatch) {
                card.style.display = 'flex';
                matchCount++;
            } else {
                card.style.display = 'none';
            }
        });

        // 검색창 X 버튼 표시/숨김
        if (clearBtn) {
            clearBtn.style.display = q ? 'flex' : 'none';
        }

        // 검색 결과 상태 바
        if (searchResultBar && searchResultText) {
            if (q) {
                searchResultBar.style.display = 'flex';
                searchResultText.innerHTML = `검색어: <strong>"${escapeHtml(q)}"</strong> · 일치하는 런로그 <strong>${matchCount}</strong>편`;
            } else {
                searchResultBar.style.display = 'none';
            }
        }

        // Empty state 처리
        if (emptyState) {
            emptyState.style.display = (matchCount === 0) ? 'block' : 'none';
        }
    }

    // 1) 카테고리 칩 클릭
    if (filterChips.length) {
        filterChips.forEach(chip => {
            chip.addEventListener('click', () => {
                currentCategory = chip.dataset.filter || 'all';
                filterChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                applyFilter();
            });
        });
    }

    // 2) 실시간 검색 인풋
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentQuery = e.target.value;
            applyFilter();
        });
    }

    // 3) 검색창 X 버튼 클릭
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
            }
            currentQuery = '';
            applyFilter();
        });
    }

    // 4) 초기화 버튼 (결과 바 및 Empty State)
    function resetAllFilters() {
        currentCategory = 'all';
        currentQuery = '';
        if (searchInput) searchInput.value = '';
        if (filterChips.length) {
            filterChips.forEach(c => c.classList.remove('active'));
            const allBtn = filterContainer.querySelector('[data-filter="all"]');
            if (allBtn) allBtn.classList.add('active');
        }
        applyFilter();
    }

    if (resetSearchBtn) resetSearchBtn.addEventListener('click', resetAllFilters);
    if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', resetAllFilters);
}

/**
 * 6. 트레드밀 속도(kph) ⇄ 페이스(min/km) 양방향 환산기 & 거리별 완주 예측
 */
function initTreadmillConverter() {
    const switchBtns = document.querySelectorAll('.sub-switch-btn');
    const panePace = document.getElementById('calc-pane-pace');
    const paneTreadmill = document.getElementById('calc-pane-treadmill');
    const paneHrzone = document.getElementById('calc-pane-hrzone');

    if (switchBtns.length) {
        switchBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.calcTab;
                switchBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                if (panePace) panePace.style.display = (tab === 'pace') ? 'block' : 'none';
                if (paneTreadmill) paneTreadmill.style.display = (tab === 'treadmill') ? 'block' : 'none';
                if (paneHrzone) paneHrzone.style.display = (tab === 'hrzone') ? 'block' : 'none';
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

/**
 * 7. 카보넨(Karvonen) 여유심박수 기반 정밀 심박존(Zone 1~5) 계산기
 */
function initHrZoneCalculator() {
    const ageInput = document.getElementById('hrz-age');
    const genderRadios = document.querySelectorAll('input[name="hrz-gender"]');
    const restInput = document.getElementById('hrz-rest');
    const customMaxInput = document.getElementById('hrz-custom-max');

    const valMax = document.getElementById('hrz-val-max');
    const lblMaxMethod = document.getElementById('hrz-lbl-max-method');
    const valRest = document.getElementById('hrz-val-rest');
    const valHrr = document.getElementById('hrz-val-hrr');

    const foxZone2 = document.getElementById('hrz-fox-zone2');
    const karvZone2 = document.getElementById('hrz-karv-zone2');
    const container = document.getElementById('hrZonesContainer');
    const copyBtn = document.getElementById('btn-copy-hr-zones');
    const copyBtnText = document.getElementById('copy-hr-btn-text');

    if (!ageInput || !restInput || !container) return;

    let lastCalculatedZones = [];

    function calculateHrZones() {
        const age = Math.min(Math.max(parseInt(ageInput.value, 10) || 35, 10), 100);
        const restHr = Math.min(Math.max(parseInt(restInput.value, 10) || 60, 30), 120);
        const customMax = parseInt(customMaxInput.value, 10);

        let maxHr = 0;
        let maxMethod = '';

        if (!isNaN(customMax) && customMax >= 100 && customMax <= 240) {
            maxHr = customMax;
            maxMethod = '워치 실측 최대심박수 직접 반영';
        } else {
            // Tanaka 의학 공식: 208 - (0.7 * 나이)
            maxHr = Math.round(208 - (0.7 * age));
            maxMethod = `Tanaka 의학 공식 기준 (208 - 0.7×${age})`;
        }

        const hrr = Math.max(maxHr - restHr, 20);

        // 카보넨 5대 구역 산출: Target HR = Rest + (HRR * %)
        const z1Low = Math.round(restHr + (hrr * 0.50));
        const z1High = Math.round(restHr + (hrr * 0.60));

        const z2Low = z1High;
        const z2High = Math.round(restHr + (hrr * 0.70));

        const z3Low = z2High;
        const z3High = Math.round(restHr + (hrr * 0.80));

        const z4Low = z3High;
        const z4High = Math.round(restHr + (hrr * 0.90));

        const z5Low = z4High;
        const z5High = maxHr;

        // 전통 220-나이 단순 공식(Fox)
        const foxMax = Math.max(220 - age, 100);
        const foxZ2Low = Math.round(foxMax * 0.60);
        const foxZ2High = Math.round(foxMax * 0.70);

        // 상단 요약 카드 갱신
        if (valMax) valMax.textContent = `${maxHr} bpm`;
        if (lblMaxMethod) lblMaxMethod.textContent = maxMethod;
        if (valRest) valRest.textContent = `${restHr} bpm`;
        if (valHrr) valHrr.textContent = `${hrr} bpm`;

        // 비교 분석 인사이트
        if (foxZone2) foxZone2.textContent = `${foxZ2Low} ~ ${foxZ2High} bpm`;
        if (karvZone2) karvZone2.textContent = `${z2Low} ~ ${z2High} bpm`;

        // 5대 Zone 데이터
        lastCalculatedZones = [
            {
                num: 1,
                cls: 'zone-1',
                badge: 'Zone 1',
                name: '액티브 리커버리 (회복 조깅)',
                range: `${z1Low} ~ ${z1High} bpm`,
                intensity: '50% ~ 60% HRR',
                rpe: 'RPE 2~3 · 숨이 전혀 차지 않고 노래 부르며 달릴 수 있는 강도',
                purpose: '혈류 순환 촉진, 젖산 부산물 세척, 고강도 훈련 다음 날 회복 러닝'
            },
            {
                num: 2,
                cls: 'zone-2',
                badge: 'Zone 2 (황금존)',
                name: '지방 대사 & 미토콘드리아 기초 유산소',
                range: `${z2Low} ~ ${z2High} bpm`,
                intensity: '60% ~ 70% HRR',
                rpe: 'RPE 4~5 · 입 다물고 코로만 편안하게 호흡 가능 (완전한 대화 가능)',
                purpose: '지방 산화율 극대화, 모세혈관망 확장, 심실 용적 확대, 부상 없는 장거리 마일리지 베이스'
            },
            {
                num: 3,
                cls: 'zone-3',
                badge: 'Zone 3',
                name: '에어로빅 템포 (마라톤 페이스)',
                range: `${z3Low} ~ ${z3High} bpm`,
                intensity: '70% ~ 80% HRR',
                rpe: 'RPE 6~7 · 약간 숨이 차며 2~3문장 짧은 대화만 가능',
                purpose: '풀 마라톤 목표 지속주, 글리코겐과 지방의 최적 연소 비율 확립'
            },
            {
                num: 4,
                cls: 'zone-4',
                badge: 'Zone 4',
                name: '젖산역치 LT2 (역치 템포)',
                range: `${z4Low} ~ ${z4High} bpm`,
                intensity: '80% ~ 90% HRR',
                rpe: 'RPE 8 · 숨이 턱 끝까지 차며 단어 단위로만 말할 수 있는 한계선',
                purpose: '젖산 축적 경계선(LT2) 돌파, 10k~하프 레이스 페이스 및 젖산 청소율 극대화'
            },
            {
                num: 5,
                cls: 'zone-5',
                badge: 'Zone 5',
                name: 'VO2max 인터벌 & 무산소 파워',
                range: `${z5Low} ~ ${z5High} bpm`,
                intensity: '90% ~ 100% HRR',
                rpe: 'RPE 9~10 · 전력 질주, 대화 일절 불가능, 한계 쥐어짜기',
                purpose: '최대 산소 섭취량(VO2max) 확장, 400m/800m 트랙 인터벌, 스피드 내구력'
            }
        ];

        // 5대 카드 DOM 렌더링
        container.innerHTML = lastCalculatedZones.map(z => `
            <div class="hr-zone-card ${z.cls}">
                <div>
                    <span class="hr-zone-badge">${z.badge}</span>
                </div>
                <div>
                    <span class="hr-zone-bpm">${z.range}</span>
                    <span style="font-size:0.75rem; color:var(--text-secondary); display:block; margin-top:2px;">${z.intensity}</span>
                </div>
                <div class="hr-zone-info">
                    <span class="hr-zone-name">${z.name}</span>
                    <span class="hr-zone-rpe">🗣️ ${z.rpe}</span>
                    <span class="hr-zone-purpose">🎯 ${z.purpose}</span>
                </div>
            </div>
        `).join('');
    }

    // 이벤트 리스너 바인딩
    ageInput.addEventListener('input', calculateHrZones);
    restInput.addEventListener('input', calculateHrZones);
    customMaxInput.addEventListener('input', calculateHrZones);

    genderRadios.forEach(radio => {
        radio.addEventListener('change', calculateHrZones);
    });

    // 원클릭 복사 기능
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            if (!lastCalculatedZones.length) return;

            const age = ageInput.value;
            const maxVal = valMax ? valMax.textContent : '';
            const restVal = valRest ? valRest.textContent : '';
            const hrrVal = valHrr ? valHrr.textContent : '';

            let copyText = `[RunAnalyz 카보넨(HRR) 정밀 심박존 처방 (만 ${age}세)]\n`;
            copyText += `• 최대심박(HRmax): ${maxVal} / 안정심박(HRrest): ${restVal} / 여유심박(HRR): ${hrrVal}\n\n`;

            lastCalculatedZones.forEach(z => {
                copyText += `• ${z.badge} (${z.name}): ${z.range} [${z.intensity}]\n`;
            });

            copyText += `\n※ 스마트워치(가민/애플워치/갤럭시) 심박수 구역에 위 bpm을 입력하세요.\n출처: https://runanalyz.com/`;

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(copyText).then(() => {
                    if (copyBtnText) copyBtnText.textContent = '✅ 복사 완료!';
                    setTimeout(() => {
                        if (copyBtnText) copyBtnText.textContent = '시계 설정용 수치 1초 복사';
                    }, 2000);
                }).catch(() => {
                    fallbackCopyText(copyText);
                });
            } else {
                fallbackCopyText(copyText);
            }
        });
    }

    function fallbackCopyText(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            if (copyBtnText) copyBtnText.textContent = '✅ 복사 완료!';
            setTimeout(() => {
                if (copyBtnText) copyBtnText.textContent = '시계 설정용 수치 1초 복사';
            }, 2000);
        } catch (err) {
            alert('복사에 실패했습니다. 수동으로 복사해주세요.');
        }
        document.body.removeChild(textArea);
    }

    // 초기 1회 실행 (기본 35세, 60bpm)
    calculateHrZones();
}

/**
 * ==========================================================================
 * 8. 국내외 18대 메이저 마라톤 D-Day & 코스 분석 시스템
 * ==========================================================================
 */
const MAJOR_RACES = [
    // ----------------------------------------------------
    // 🇰🇷 국내 메이저 대회
    // ----------------------------------------------------
    {
        id: 'jtbc-seoul',
        name: 'JTBC 서울마라톤',
        nameEn: 'JTBC Seoul Marathon',
        category: 'domestic',
        isExpected: false,
        date: '2026-11-01',
        time: '08:00',
        location: '서울 상암월드컵경기장 ~ 잠실종합운동장',
        label: 'WA 골드 라벨',
        distance: 'Full 42.195km / 10km',
        difficulty: 3,
        difficultyDesc: '보통 (후반 롤링힐 주의)',
        elevation: '+112m',
        tags: ['#상암출발', '#잠실피니시', '#마포대교', '#수서나들목'],
        guide: '상암에서 양화대교를 거쳐 여의도까지는 평탄하나, 30km 이후 수서나들목과 탄천 합류 구간의 완만한 오르막에서 다리 경련이 잦습니다. 25km까지 이븐 페이스를 철저히 지키는 것이 후반 완주의 핵심입니다.',
        officialUrl: 'https://marathon.jtbc.com/'
    },
    {
        id: 'seoul-marathon',
        name: '서울마라톤 (동아마라톤)',
        nameEn: 'Seoul Marathon (Dong-A)',
        category: 'domestic',
        isExpected: true,
        expectedMonth: '2027.03 예정 (3월 셋째주)',
        date: '2027-03-21',
        time: '08:00',
        location: '서울 광화문광장 ~ 잠실종합운동장',
        label: 'WA 플래티넘 라벨',
        distance: 'Full 42.195km / 10km',
        difficulty: 2,
        difficultyDesc: '쉬움 (국내 최고 PB 코스)',
        elevation: '+58m',
        tags: ['#광화문출발', '#청계천순환', '#잠실피니시', '#국내최고PB'],
        guide: '광화문에서 숭례문으로 이어지는 초반 약내리막에서 오버페이스하기 쉽습니다. 청계천의 완벽한 평지 주로에서 체력을 비축하고, 36km 잠실대교의 마지막 오르막만 넘기면 역대 최고 기록(PB)을 노릴 수 있는 최적의 고속 코스입니다.',
        officialUrl: 'https://www.seoul-marathon.com/'
    },
    {
        id: 'daegu-marathon',
        name: '대구국제마라톤',
        nameEn: 'Daegu International Marathon',
        category: 'domestic',
        isExpected: true,
        expectedMonth: '2027.04 예정 (4월 첫째주)',
        date: '2027-04-04',
        time: '08:00',
        location: '대구스타디움 및 도심 순환 주로',
        label: 'WA 골드 라벨',
        distance: 'Full 42.195km / 마스터즈 풀',
        difficulty: 2,
        difficultyDesc: '쉬움 (개편된 도심 순환 플랫 코스)',
        elevation: '+75m',
        tags: ['#대구스타디움', '#도심순환', '#세계육상골드', '#봄맞이레이스'],
        guide: '코스가 대구 도심을 관통하는 순환 플랫 주로로 전면 개편되어 전반적인 고저차가 완만합니다. 4월 초순 대구 특유의 기온 상승이 발생할 수 있으므로 매 5km 급수대마다 전해질 섭취가 승부처입니다.',
        officialUrl: 'https://www.daegurace.com/'
    },
    {
        id: 'gunsan-marathon',
        name: '군산새만금국제마라톤',
        nameEn: 'Gunsan Saemangeum International Marathon',
        category: 'domestic',
        isExpected: true,
        expectedMonth: '2027.04 예정 (4월 둘째주)',
        date: '2027-04-11',
        time: '08:00',
        location: '군산 월명종합경기장 ~ 새만금방조제',
        label: 'KAAF 공인',
        distance: 'Full 42.195km / Half / 10km / 5km',
        difficulty: 1,
        difficultyDesc: '매우 쉬움 (초평탄 직선 주로)',
        elevation: '+22m',
        tags: ['#새만금방조제', '#국내최저고저차', '#직선주로', '#바닷바람변수'],
        guide: '국내 마라톤 중 누적 상승고도가 가장 낮은(+22m) 초평탄 주로입니다. 언덕 부담은 제로에 가깝지만, 새만금 방조제 구간의 탁 트인 서해 바닷바람(맞바람/측풍)에 대비해 페이스메이커 뒤에 붙어 달리는 풍동 전략이 중요합니다.',
        officialUrl: 'https://www.gunsanrun.co.kr/'
    },
    {
        id: 'gyeongju-marathon',
        name: '경주국제마라톤',
        nameEn: 'Gyeongju International Marathon',
        category: 'domestic',
        isExpected: true,
        expectedMonth: '2027.10 예정 (10월 셋째주)',
        date: '2027-10-17',
        time: '08:00',
        location: '경주시민운동장 ~ 보문관광단지 순환',
        label: 'KAAF 공인',
        distance: 'Full 42.195km / Half / 10km / 5km',
        difficulty: 2,
        difficultyDesc: '보통 (보문호 완만한 경사)',
        elevation: '+98m',
        tags: ['#천년고도경주', '#보문단지', '#가을단풍주로', '#순환코스'],
        guide: '가을 단풍이 절정인 보문호를 순환하는 코스로 풍광이 수려합니다. 보문단지로 진입하는 중반 구간에 길고 완만한 오르막이 있으나 경사도가 가팔라지지 않아 페이스 안배만 잘하면 안정적인 서브4 달성이 가능합니다.',
        officialUrl: 'https://gyeongjumarathon.com/'
    },
    {
        id: 'chuncheon-marathon',
        name: '춘천마라톤',
        nameEn: 'Chuncheon Marathon',
        category: 'domestic',
        isExpected: true,
        expectedMonth: '2027.10 예정 (10월 넷째주)',
        date: '2027-10-24',
        time: '09:00',
        location: '춘천 공지천교 ~ 의암호 일주 순환',
        label: 'WA 골드 라벨',
        distance: 'Full 42.195km / 10km',
        difficulty: 4,
        difficultyDesc: '어려움 (의암호 낙타등 & 후반 신매대교)',
        elevation: '+165m',
        tags: ['#조선의마라톤', '#가을의전설', '#의암호순환', '#낙타등언덕'],
        guide: '15km부터 25km까지 이어지는 춘천 의암호의 낙타등 연속 언덕과 33km 신매대교 후반 오르막이 러너를 시험합니다. 전반부에 절대 속도를 내지 말고 에너지를 아껴두어야 가을의 전설 완주 메달을 목에 걸 수 있습니다.',
        officialUrl: 'http://marathon.chosun.com/'
    },
    {
        id: 'songdo-marathon',
        name: '인천송도국제마라톤',
        nameEn: 'Incheon Songdo International Marathon',
        category: 'domestic',
        isExpected: true,
        expectedMonth: '2027.10 예정 (10월 초순)',
        date: '2027-10-10',
        time: '08:30',
        location: '인천 송도 센트럴파크 및 신도시 해안도로',
        label: 'KAAF 공인',
        distance: 'Half 21.1km / 10km / 5km',
        difficulty: 1,
        difficultyDesc: '매우 쉬움 (신도시 초평탄 광폭 주로)',
        elevation: '+18m',
        tags: ['#송도센트럴파크', '#초평지', '#쾌적한도로', '#하프PB추천'],
        guide: '송도 국제도시의 넓고 평탄한 아스팔트 대로를 달리는 대표적인 쾌속 코스입니다. 언덕이 거의 없어 가을 시즌 하프마라톤 PB 기록을 측정하기에 최고의 조건을 자랑합니다.',
        officialUrl: 'https://songdorun.com/'
    },

    // ----------------------------------------------------
    // 🌍 애보트 월드 마라톤 메이저스 (Abbott WMM)
    // ----------------------------------------------------
    {
        id: 'nyc-marathon',
        name: '뉴욕 마라톤',
        nameEn: 'TCS New York City Marathon',
        category: 'wmm',
        isExpected: false,
        date: '2026-11-01',
        time: '09:00',
        location: '미국 뉴욕 5개 자치구 (스태튼아일랜드 ~ 센트럴파크)',
        label: 'Abbott WMM',
        distance: 'Full 42.195km',
        difficulty: 5,
        difficultyDesc: '매우 어려움 (5대 교량 업힐 & 센트럴파크 롤링힐)',
        elevation: '+255m',
        tags: ['#뉴욕5개구', '#베라자노다리', '#퀸즈보로브릿지', '#센트럴파크피니시'],
        guide: '출발 직후 베라자노 다리의 강풍 오르막과 25km 퀸즈보로 다리의 정적, 그리고 마지막 센트럴파크의 끝없는 롤링힐이 악명 높습니다. 기록보다는 2백만 관중의 응원을 즐기며 체계적인 파워 배분이 요구됩니다.',
        officialUrl: 'https://www.nyrr.org/tcsnycmarathon'
    },
    {
        id: 'tokyo-marathon',
        name: '도쿄 마라톤',
        nameEn: 'Tokyo Marathon',
        category: 'wmm',
        isExpected: false,
        date: '2027-03-07',
        time: '09:10',
        location: '일본 도쿄 도청 ~ 도쿄역 교코도리',
        label: 'Abbott WMM',
        distance: 'Full 42.195km / 10.7km',
        difficulty: 1,
        difficultyDesc: '매우 쉬움 (아시아 최고속 초평탄 WMM 코스)',
        elevation: '+42m',
        tags: ['#도쿄도청', '#긴자', '#아사쿠사', '#도쿄역피니시'],
        guide: '신주쿠 도청 출발 후 5km까지 시원한 내리막이 펼쳐지며, 이후 아사쿠사와 긴자를 통과하는 전 구간이 완벽에 가까운 평지입니다. 세계 7대 메이저 중 가장 빠른 기록을 낼 수 있는 꿈의 주로입니다.',
        officialUrl: 'https://www.marathon.tokyo/'
    },
    {
        id: 'boston-marathon',
        name: '보스턴 마라톤',
        nameEn: 'Boston Marathon',
        category: 'wmm',
        isExpected: false,
        date: '2027-04-19',
        time: '09:30',
        location: '미국 매사추세츠 홉킨턴 ~ 보스턴 보이얼스턴가',
        label: 'Abbott WMM',
        distance: 'Full 42.195km',
        difficulty: 5,
        difficultyDesc: '매우 어려움 (초반 내리막 대퇴 파괴 & 32km 심장파열언덕)',
        elevation: '+248m (순하강 -137m)',
        tags: ['#패트리어츠데이', '#홉킨턴', '#하트브레이크힐', '#보이얼스턴'],
        guide: '전체 고도는 순하강(-137m)이지만 초반 10km의 가파른 내리막에서 대퇴사두근이 털리면, 32km 뉴턴 언덕(하트브레이크 힐)에서 걷게 됩니다. 전반 내리막 속도 자제가 보스턴 완주의 알파이자 오메가입니다.',
        officialUrl: 'https://www.baa.org/races/boston-marathon'
    },
    {
        id: 'london-marathon',
        name: '런던 마라톤',
        nameEn: 'TCS London Marathon',
        category: 'wmm',
        isExpected: false,
        date: '2027-04-25',
        time: '09:30',
        location: '영국 런던 그리니치 공원 ~ 버킹엄궁 더 몰',
        label: 'Abbott WMM',
        distance: 'Full 42.195km',
        difficulty: 1,
        difficultyDesc: '매우 쉬움 (플랫 & 패스트, 세계 기록 산실)',
        elevation: '+38m',
        tags: ['#그리니치', '#타워브리지', '#빅벤', '#버킹엄궁'],
        guide: '그리니치에서 커티삭, 타워브리지를 거쳐 버킹엄궁까지 템스 강변을 따라 달리는 평탄하고 아름다운 코스입니다. 코너링이 일부 있으나 고저차가 거의 없어 세계적인 엘리트 PB가 쏟아지는 명품 레이스입니다.',
        officialUrl: 'https://www.tcslondonmarathon.com/'
    },
    {
        id: 'sydney-marathon',
        name: '시드니 마라톤',
        nameEn: 'TCS Sydney Marathon',
        category: 'wmm',
        isExpected: false,
        date: '2027-08-29',
        time: '07:00',
        location: '호주 시드니 하버브리지 ~ 시드니 오페라하우스',
        label: 'Abbott WMM (신규 승격)',
        distance: 'Full 42.195km',
        difficulty: 4,
        difficultyDesc: '어려움 (하버브리지 진입 & 도심 롤링 언덕)',
        elevation: '+210m',
        tags: ['#7대메이저승격', '#하버브리지', '#오페라하우스', '#남반구겨울레이스'],
        guide: '2025년 애보트 월드 마라톤 메이저스(WMM) 공식 7번째 멤버로 확정된 역사적인 대회입니다. 8월 남반구의 선선한 기온 속에 하버브리지를 건너며 도심의 롤링 언덕을 통과해 오페라하우스 앞 포어코트에 피니시합니다.',
        officialUrl: 'https://sydneymarathon.com/'
    },
    {
        id: 'berlin-marathon',
        name: '베를린 마라톤',
        nameEn: 'BMW Berlin Marathon',
        category: 'wmm',
        isExpected: true,
        expectedMonth: '2027.09 예정 (9월 마지막주)',
        date: '2027-09-26',
        time: '09:15',
        location: '독일 베를린 티어가르텐 ~ 브란덴부르크문',
        label: 'Abbott WMM',
        distance: 'Full 42.195km',
        difficulty: 1,
        difficultyDesc: '매우 쉬움 (인류 역사상 가장 빠른 세계신기록 산실)',
        elevation: '+20m',
        tags: ['#세계신기록산실', '#브란덴부르크문', '#완벽한초평지', '#킵초게2시간코스'],
        guide: '킵초게의 세계 신기록이 탄생한 인류 역사상 가장 평평하고 넓은 아스팔트 주로입니다. 고저차가 사실상 0에 수렴하여 인생 최고의 퍼스널 베스트(PB)를 노리는 전 세계 러너들의 성지입니다.',
        officialUrl: 'https://www.bmw-berlin-marathon.com/'
    },
    {
        id: 'chicago-marathon',
        name: '시카고 마라톤',
        nameEn: 'Bank of America Chicago Marathon',
        category: 'wmm',
        isExpected: true,
        expectedMonth: '2027.10 예정 (10월 둘째주)',
        date: '2027-10-10',
        time: '07:30',
        location: '미국 시카고 그랜트 공원 순환',
        label: 'Abbott WMM',
        distance: 'Full 42.195km',
        difficulty: 1,
        difficultyDesc: '매우 쉬움 (초평탄 도심 쾌속 주로, 바람 변수)',
        elevation: '+24m',
        tags: ['#그랜트파크', '#루프도심', '#바람의도시', '#켈빈킵툼세계신기록'],
        guide: '고(故) 켈빈 킵툼이 2시간 00분 35초의 경이적인 세계 신기록을 세운 초고속 코스입니다. 언덕이 전혀 없으며, 미시간호의 바람(Windy City) 변수만 제어한다면 최고의 스피드를 만끽할 수 있습니다.',
        officialUrl: 'https://www.chicagomarathon.com/'
    },

    // ----------------------------------------------------
    // 🇯🇵 일본 대도시 메이저 대회
    // ----------------------------------------------------
    {
        id: 'kobe-marathon',
        name: '고베 마라톤',
        nameEn: 'Kobe Marathon',
        category: 'japan',
        isExpected: false,
        date: '2026-11-15',
        time: '09:00',
        location: '일본 고베 시청 ~ 포트아일랜드 시민국제광장',
        label: 'JAAF 공인 / WA 라벨',
        distance: 'Full 42.195km',
        difficulty: 3,
        difficultyDesc: '보통 (35km 하버랜드 고가도로 오르막)',
        elevation: '+85m',
        tags: ['#고베시청', '#세토내해해안선', '#하버랜드', '#포트아일랜드'],
        guide: '세토내해의 아름다운 해안도로를 따라 달리다 35km 지점에서 포트아일랜드로 진입하는 고가 교량 업힐이 마지막 복병입니다. 다리 진입 전까지 허벅지 근력을 비축하는 레이스 운영이 필수입니다.',
        officialUrl: 'https://kobe-marathon.net/'
    },
    {
        id: 'fukuoka-marathon',
        name: '후쿠오카 국제마라톤',
        nameEn: 'Fukuoka International Marathon',
        category: 'japan',
        isExpected: false,
        date: '2026-12-06',
        time: '12:10',
        location: '일본 후쿠오카 헤이와다이 육상경기장 ~ 가시이 반환',
        label: 'JAAF 공인 / 전통의 엘리트 명문',
        distance: 'Full 42.195km',
        difficulty: 1,
        difficultyDesc: '매우 쉬움 (전통의 초평탄 엘리트 고속 주로)',
        elevation: '+30m',
        tags: ['#헤이와다이', '#일본최고권위', '#초평탄', '#엘리트명문코스'],
        guide: '70년 넘는 역사를 지닌 아시아 최고 권위의 전통 주로입니다. 고저차가 거의 없는 평탄한 도로로 설계되어 강풍이 없는 12월 특유의 차분한 기온 속에서 정밀한 페이스 배분이 가능합니다.',
        officialUrl: 'https://www.fukuoka-marathon.com/'
    },
    {
        id: 'osaka-marathon',
        name: '오사카 마라톤',
        nameEn: 'Osaka Marathon',
        category: 'japan',
        isExpected: false,
        date: '2027-02-28',
        time: '09:15',
        location: '일본 오사카성 공원 ~ 오사카시청 ~ 인텍스 오사카',
        label: 'JAAF 공인 / WA 골드 라벨',
        distance: 'Full 42.195km / 7.2km',
        difficulty: 2,
        difficultyDesc: '쉬움 (오사카성 중심 도심 쾌속 순환 코스)',
        elevation: '+52m',
        tags: ['#오사카성', '#도톤보리', '#미도스지', '#도심순환'],
        guide: '오사카성과 미도스지 대로를 가로지르는 화려한 도심 코스로, 3만 명의 러너와 열정적인 오사카 시민들의 응원이 유명합니다. 코스가 완만하게 다듬어져 2월 말 서브3~서브4 도전지로 각광받고 있습니다.',
        officialUrl: 'https://www.osaka-marathon.com/'
    },
    {
        id: 'nagoya-women',
        name: '나고야 우먼스 마라톤',
        nameEn: 'Nagoya Women\'s Marathon',
        category: 'japan',
        isExpected: false,
        date: '2027-03-14',
        time: '09:10',
        location: '일본 반테린 돔 나고야 ~ 나고야 시내 순환',
        label: 'WA 플래티넘 라벨',
        distance: 'Full 42.195km (여성 단독)',
        difficulty: 1,
        difficultyDesc: '매우 쉬움 (세계 최대 여성 풀마라톤 초평지)',
        elevation: '+25m',
        tags: ['#세계최대여성마라톤', '#기네스북', '#티파니목걸이완주', '#초평탄'],
        guide: '기네스북에 등재된 세계 최대 여성 풀마라톤으로, 완주 시 턱시도 요원이 티파니앤코 펜던트 목걸이를 수여합니다. 돔구장 출발/피니시의 초평탄 주로로 제한시간도 7시간으로 넉넉하여 첫 풀마라톤에 최고입니다.',
        officialUrl: 'https://womens-marathon.nagoya/'
    }
];

function initRaceCalendar() {
    const listContainer = document.getElementById('races-card-list');
    if (!listContainer) return;

    let currentStatusFilter = 'all'; // 'all' | 'confirmed' | 'expected'
    let currentRegionFilter = 'all'; // 'all' | 'domestic' | 'wmm' | 'japan'

    // D-Day 계산 헬퍼 함수
    function getRaceDDayInfo(race) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (race.isExpected) {
            return {
                badgeText: race.expectedMonth.split(' ')[0],
                subText: '시기 예정',
                dateDisplay: race.expectedMonth,
                isUrgent: false,
                isExpected: true,
                statusKey: 'expected'
            };
        }

        const raceDate = new Date(race.date);
        raceDate.setHours(0, 0, 0, 0);

        const diffTime = raceDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const yyyy = raceDate.getFullYear();
        const mm = String(raceDate.getMonth() + 1).padStart(2, '0');
        const dd = String(raceDate.getDate()).padStart(2, '0');
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const dayName = dayNames[raceDate.getDay()];
        const dateDisplay = `${yyyy}.${mm}.${dd} (${dayName}) ${race.time || ''}`;

        if (diffDays < 0) {
            return {
                badgeText: '종료',
                subText: '차기 시즌 예정',
                dateDisplay: dateDisplay,
                isUrgent: false,
                isExpected: true,
                isPast: true,
                statusKey: 'expected'
            };
        } else if (diffDays === 0) {
            return {
                badgeText: 'D-Day',
                subText: '오늘 결전!',
                dateDisplay: dateDisplay,
                isUrgent: true,
                isExpected: false,
                statusKey: 'confirmed'
            };
        } else {
            return {
                badgeText: `D-${diffDays}`,
                subText: `${diffDays}일 남음`,
                dateDisplay: dateDisplay,
                isUrgent: diffDays <= 30,
                isExpected: false,
                statusKey: 'confirmed'
            };
        }
    }

    function renderStarIcons(diff) {
        return '★'.repeat(diff) + '☆'.repeat(5 - diff);
    }

    function updateCountBadges() {
        let confirmedCount = 0;
        let expectedCount = 0;

        MAJOR_RACES.forEach(race => {
            const dday = getRaceDDayInfo(race);
            if (dday.statusKey === 'confirmed') confirmedCount++;
            else expectedCount++;
        });

        const badgeAll = document.getElementById('count-all');
        const badgeConfirmed = document.getElementById('count-confirmed');
        const badgeExpected = document.getElementById('count-expected');

        if (badgeAll) badgeAll.textContent = MAJOR_RACES.length;
        if (badgeConfirmed) badgeConfirmed.textContent = confirmedCount;
        if (badgeExpected) badgeExpected.textContent = expectedCount;
    }

    function renderRaces() {
        listContainer.innerHTML = '';

        const filtered = MAJOR_RACES.filter(race => {
            const dday = getRaceDDayInfo(race);
            
            // 상태 필터
            if (currentStatusFilter === 'confirmed' && dday.statusKey !== 'confirmed') return false;
            if (currentStatusFilter === 'expected' && dday.statusKey !== 'expected') return false;

            // 지역 필터
            if (currentRegionFilter !== 'all' && race.category !== currentRegionFilter) return false;

            return true;
        });

        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align:center; padding: 40px 20px; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; color:var(--text-muted);">
                    <div style="font-size:2rem; margin-bottom:8px;">🔍</div>
                    <div style="font-weight:700; color:var(--text-primary); margin-bottom:4px;">해당 조건의 대회가 없습니다.</div>
                    <div style="font-size:0.82rem;">상단 필터를 '전체'로 변경해 보세요.</div>
                </div>
            `;
            return;
        }

        filtered.forEach(race => {
            const dday = getRaceDDayInfo(race);
            const badgeClass = dday.isUrgent ? 'urgent' : (dday.isExpected ? 'expected' : '');
            
            const categoryLabel = race.category === 'domestic' ? '🇰🇷 국내' : (race.category === 'wmm' ? '🌍 WMM' : '🇯🇵 일본');
            const labelClass = race.category === 'wmm' ? 'label-major' : (race.label.includes('플래티넘') ? 'label-platinum' : '');

            const card = document.createElement('div');
            card.className = 'race-card';
            card.id = `race-card-${race.id}`;

            card.innerHTML = `
                <div class="race-card-main">
                    <!-- 1행: 대회명 - D-Day - 날짜/장소 -->
                    <div class="race-row-top">
                        <div class="race-title-cluster">
                            <span class="race-title-ko">${race.name}</span>
                            <span class="race-title-en">${race.nameEn}</span>
                        </div>
                        <div class="race-dday-cluster">
                            <div class="race-dday-badge ${badgeClass}">
                                ${dday.badgeText}
                            </div>
                            <div class="race-date-box">
                                <span class="race-date-text">${dday.dateDisplay}</span>
                                <span class="race-loc-text">${race.location}</span>
                            </div>
                        </div>
                    </div>

                    <!-- 2행: 스펙/메타 정보 칩 (가로 스택형) -->
                    <div class="race-row-specs">
                        <span class="race-meta-badge">${categoryLabel}</span>
                        <span class="race-meta-badge ${labelClass}">${race.label}</span>
                        <span class="spec-chip spec-elev">누적 획득고도 ▲ ${race.elevation}</span>
                        <span class="spec-chip spec-diff">난이도: ${renderStarIcons(race.difficulty)} (${race.difficultyDesc})</span>
                        <span class="spec-chip spec-dist">${race.distance}</span>
                    </div>

                    <!-- 3행: 코스분석 및 공식홈페이지 바로가기 (하단 액션 행) -->
                    <div class="race-row-actions">
                        <button type="button" class="btn-race-toggle" data-race-id="${race.id}" aria-expanded="false" title="코스 분석 및 고저차 보기">
                            <span>📊 코스분석</span>
                            <span class="toggle-icon">▼</span>
                        </button>
                        <a href="${race.officialUrl}" target="_blank" rel="noopener noreferrer" class="btn-race-link" title="${race.name} 공식 홈페이지 새창 이동">
                            대회 공식홈페이지 바로가기 ↗
                        </a>
                    </div>
                </div>

                <!-- 부드럽게 펼쳐지는 코스 분석 상세 영역 (아코디언) -->
                <div class="race-card-detail" id="race-detail-${race.id}">
                    <div class="race-detail-grid">
                        <div class="race-detail-item">
                            <div class="race-detail-label">종목 및 거리</div>
                            <div class="race-detail-val">${race.distance}</div>
                        </div>
                        <div class="race-detail-item">
                            <div class="race-detail-label">코스 고저차 및 프로필</div>
                            <div class="race-detail-val" style="color:#166534;">누적상승 ${race.elevation}</div>
                        </div>
                        <div class="race-detail-item">
                            <div class="race-detail-label">코스 지형 태그</div>
                            <div class="race-detail-val" style="font-size:0.8rem; font-weight:700; color:var(--primary-blue);">
                                ${race.tags.join(' ')}
                            </div>
                        </div>
                    </div>

                    <div class="race-guide-box">
                        <div class="race-guide-title">
                            <span>💡</span> 코치 실전 코스 공략 가이드
                        </div>
                        <p class="race-guide-text">${race.guide}</p>
                    </div>

                    <div class="race-detail-action-row">
                        <button type="button" class="btn-race-plan-cta" data-race-id="${race.id}" data-race-name="${race.name}" data-race-date="${race.date}">
                            <span>📅</span> 이 대회 목표로 D-100 주기화 플랜 세우기 →
                        </button>
                    </div>
                </div>
            `;

            listContainer.appendChild(card);
        });

        // 아코디언 토글 이벤트 등록
        const toggleBtns = listContainer.querySelectorAll('.btn-race-toggle');
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const raceId = btn.dataset.raceId;
                const detailEl = document.getElementById(`race-detail-${raceId}`);
                if (!detailEl) return;

                const isOpen = detailEl.classList.contains('open');
                if (isOpen) {
                    detailEl.classList.remove('open');
                    btn.classList.remove('open');
                    btn.setAttribute('aria-expanded', 'false');
                } else {
                    detailEl.classList.add('open');
                    btn.classList.add('open');
                    btn.setAttribute('aria-expanded', 'true');
                }
            });
        });

        // 훈련 플래너 연동 이벤트 등록
        const planCtaBtns = listContainer.querySelectorAll('.btn-race-plan-cta');
        planCtaBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const raceId = btn.dataset.raceId;
                const raceName = btn.dataset.raceName;
                const raceDateStr = btn.dataset.raceDate;
                linkRaceToPlanner(raceName, raceDateStr, raceId);
            });
        });
    }

    // 훈련 플래너 연동 함수 (가민 스타일 D-100 주기화 템플릿 세팅)
    function linkRaceToPlanner(raceName, raceDateStr, raceId) {
        // 1. 훈련 플래너 뷰로 전환
        const plannerBtn = document.querySelector('.segment-btn[data-view="planner"]');
        if (plannerBtn) plannerBtn.click();

        // 2. 목표 대회 드롭다운에서 해당 대회 선택 및 D-100 입력값 자동 세팅
        const raceSelect = document.getElementById('plan-race-select');
        if (raceSelect && raceId) {
            raceSelect.value = raceId;
            const race = MAJOR_RACES.find(r => r.id === raceId);
            if (race) {
                applyRaceToPlannerForm(race);
            }
        }

        // 3. 플래너 14주 D-100 플랜 즉시 생성 실행
        generateStandalonePlan();

        // 4. 결과 화면으로 부드럽게 스크롤
        setTimeout(() => {
            const resultBox = document.getElementById('planner-result-box');
            if (resultBox) {
                resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 120);
    }

    // 필터 이벤트 바인딩
    const statusTabs = document.querySelectorAll('.race-status-tab');
    statusTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            statusTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentStatusFilter = tab.dataset.raceStatus;
            renderRaces();
        });
    });

    const regionChips = document.querySelectorAll('.race-chip');
    regionChips.forEach(chip => {
        chip.addEventListener('click', () => {
            regionChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentRegionFilter = chip.dataset.raceRegion;
            renderRaces();
        });
    });

    // 초기 카운트 계산 및 렌더링
    updateCountBadges();
    renderRaces();
}



