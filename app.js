/* ==========================================================================
   RunAnalyz / RunAnalyz - Multi-Year Garmin Engine & Analytics
   Supports: 2017-2026 Multi-Year Data, Shoe Mileage Tracker, Heatmap
   ========================================================================== */

// Helper to access i18n translations safely
function _t(key, fallback) {
  return (window.I18N && typeof window.I18N.t === 'function') ? window.I18N.t(key, fallback) : fallback;
}

// Security: XSS Prevention Sanitizer
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Performance: Lazy-load 2.2MB demo archive only when needed
let _demoDataLoadingPromise = null;
function ensureDemoDataLoaded() {
  if (window.STRAVA_ARCHIVE || window.GARMIN_ARCHIVE || window.RUN_ACTIVITIES) {
    return Promise.resolve();
  }
  if (_demoDataLoadingPromise) return _demoDataLoadingPromise;

  _demoDataLoadingPromise = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'strava_all_activities.js?v=20260915_v14_sec_perf';
    s.onload = () => {
      console.log('[RunAnalyz] 2.2MB Demo Archive asynchronously loaded.');
      resolve();
    };
    s.onerror = (err) => {
      console.warn('[RunAnalyz] Failed to load demo archive:', err);
      resolve(); // graceful fallback
    };
    document.head.appendChild(s);
  });
  return _demoDataLoadingPromise;
}

// Global filter states accessible by all modules
let currentYear = 'all';
let currentMonth = 'all';
let currentSportFilter = 'all'; // 'all', 'treadmill', 'outdoor'

const STRAVA_CLIENT_ID = '278575';
const STRAVA_WORKER_URL = 'https://runanalyz-auth.chicstory.workers.dev';

function updateSyncProgress(percent, statusText) {
  const pFill = document.getElementById('sync-progress-fill');
  const sText = document.getElementById('sync-modal-status');
  if (pFill) pFill.style.width = `${percent}%`;
  if (sText) sText.textContent = statusText;
}

function showSyncOverlay(title, desc, percent = 20, status = '연동 진행 중...') {
  const el = document.getElementById('strava-sync-overlay');
  if (!el) return;
  if (title) {
    const tEl = document.getElementById('sync-modal-title');
    if (tEl) tEl.textContent = title;
  }
  if (desc) {
    const dEl = document.getElementById('sync-modal-desc');
    if (dEl) dEl.textContent = desc;
  }
  updateSyncProgress(percent, status);
  const cancelBtn = document.getElementById('btn-cancel-sync');
  if (cancelBtn) cancelBtn.style.display = 'none';
  el.style.display = 'flex';
}

function hideSyncOverlay() {
  const el = document.getElementById('strava-sync-overlay');
  if (el) el.style.display = 'none';
}

// Convert raw Strava activity list to standard RunAnalyz format
function parseStravaActivities(rawActs) {
  const processed = [];
  const yearlyStats = {};

  rawActs.forEach(act => {
    const isRun = (act.type === 'Run');
    const distKm = (act.distance || 0) / 1000.0;
    const movSec = act.moving_time || 0;
    const paceSec = distKm > 0 ? (movSec / distKm) : 0;
    const pMin = Math.floor(paceSec / 60);
    const pSec = Math.round(paceSec % 60);
    const pFmt = `${pMin}'${pSec < 10 ? '0' : ''}${pSec}"`;

    const spdMMin = distKm > 0 ? (distKm * 1000.0) / (movSec / 60.0) : 0;
    const aHr = act.average_heartrate || 0;
    const mHr = act.max_heartrate || 0;
    const ef = (aHr > 0) ? Math.round((spdMMin / aHr) * 1000) / 1000 : 0;

    const sDate = act.start_date_local || act.start_date || '';
    const cleanDate = sDate.replace('T', ' ').replace('Z', '');
    const dParts = cleanDate.split(' ');
    const ymd = dParts[0] || '2026-01-01';
    const hms = dParts[1] || '00:00:00';

    const dateTokens = ymd.split('-');
    const yVal = parseInt(dateTokens[0], 10) || 2026;
    const mVal = parseInt(dateTokens[1], 10) || 1;
    const dayVal = parseInt(dateTokens[2], 10) || 1;

    const monthWeek = Math.min(Math.floor((dayVal - 1) / 7) + 1, 5);
    const isoWeek = typeof getISOWeek === 'function' ? getISOWeek(ymd) : 1;

    const cad = act.average_cadence || 0;
    const avgCad = Math.round(cad * 2) || 174;
    const elev = act.total_elevation_gain || 0;
    const poly = (act.map && act.map.summary_polyline) ? act.map.summary_polyline : '';
    const subSp = (elev > 0 || poly) ? 'outdoor' : 'treadmill';

    let spLbl = '야외 러닝';
    if (!isRun) {
      spLbl = act.type === 'Hike' ? '하이킹' : (act.type === 'Walk' ? '산책/워킹' : '야외 활동');
    } else {
      spLbl = subSp === 'outdoor' ? '야외 러닝' : '트레드밀';
    }

    const dMin = Math.floor(movSec / 60);
    const dSec = movSec % 60;
    const dFmt = `${dMin < 10 ? '0' : ''}${dMin}:${dSec < 10 ? '0' : ''}${dSec}`;

    const actObj = {
      id: `strava-${act.id}`,
      filename: `strava_${act.id}`,
      sport: isRun ? 'running' : 'other',
      sub_sport: subSp,
      sport_label: spLbl,
      is_pure_running: isRun,
      has_gps: !!poly,
      summary_polyline: poly,
      date: ymd,
      time: hms,
      datetime: `${ymd} ${hms}`,
      year: yVal,
      month: mVal,
      week: monthWeek,
      iso_week: isoWeek,
      distance_km: Math.round(distKm * 100) / 100,
      duration_seconds: movSec,
      duration_formatted: dFmt,
      pace_seconds: Math.round(paceSec * 10) / 10,
      pace_formatted: pFmt,
      speed_m_per_min: Math.round(spdMMin * 10) / 10,
      avg_hr: Math.round(aHr),
      max_hr: Math.round(mHr),
      avg_cadence: avgCad,
      max_cadence: avgCad + 10,
      avg_power: 0,
      max_power: 0,
      calories: act.calories || Math.round(distKm * 60),
      ascent_m: elev,
      ef: ef,
      power_ef: 0,
      aerobic_decoupling_pct: 0,
      stream_summary: []
    };
    processed.push(actObj);

    if (isRun) {
      const yStr = String(yVal);
      if (!yearlyStats[yStr]) {
        yearlyStats[yStr] = {
          year: yVal,
          total_running_km: 0,
          running_sessions: 0,
          avg_ef: 0.0,
          avg_hr: 0,
          max_lsd_km: 0.0
        };
      }
      yearlyStats[yStr].total_running_km = Math.round((yearlyStats[yStr].total_running_km + distKm) * 10) / 10;
      yearlyStats[yStr].running_sessions += 1;
      yearlyStats[yStr].max_lsd_km = Math.max(yearlyStats[yStr].max_lsd_km, Math.round(distKm * 100) / 100);
    }
  });

  // Calculate avg EF per year
  for (const yStr in yearlyStats) {
    const yActs = processed.filter(a => a.is_pure_running && String(a.year) === yStr && a.ef > 0);
    if (yActs.length > 0) {
      yearlyStats[yStr].avg_ef = Math.round((yActs.reduce((acc, a) => acc + a.ef, 0) / yActs.length) * 1000) / 1000;
      const validHrs = yActs.filter(a => a.avg_hr > 0);
      yearlyStats[yStr].avg_hr = validHrs.length ? Math.round(validHrs.reduce((acc, a) => acc + a.avg_hr, 0) / validHrs.length) : 0;
    }
  }

  const availableYears = Object.keys(yearlyStats).map(Number).sort((a, b) => b - a);

  return {
    metadata: {
      generated_at: new Date().toISOString(),
      source: 'strava_live_sync',
      total_activities: processed.length,
      pure_running_sessions: processed.filter(a => a.is_pure_running).length,
      gps_track_count: processed.filter(a => a.has_gps).length,
      available_years: availableYears,
      yearly_summary: yearlyStats
    },
    activities: processed
  };
}

// Fetch activities from Strava API using access token (Supports multi-year up to 2,000 activities)
async function fetchUserStravaActivities(accessToken) {
  const allActs = [];
  const maxPages = 10; // Max 2,000 activities (covers 5~10 years of running history)

  for (let page = 1; page <= maxPages; page++) {
    const currentProgress = Math.min(40 + Math.round((page / maxPages) * 50), 90);
    updateSyncProgress(currentProgress, `Strava 활동 기록 수집 중... (${allActs.length}개 누적 수집, ${page}페이지)`);

    try {
      const resp = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=200&page=${page}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (!resp.ok) {
        console.warn(`Strava API status ${resp.status} on page ${page}`);
        break;
      }
      const acts = await resp.json();
      if (!Array.isArray(acts) || acts.length === 0) {
        break;
      }
      allActs.push(...acts);

      // If returned count is less than per_page (200), we reached the earliest record
      if (acts.length < 200) {
        break;
      }
    } catch (fetchErr) {
      console.warn('Strava page fetch error:', fetchErr);
      break;
    }
  }

  updateSyncProgress(92, `총 ${allActs.length}개 활동 분석 및 연도별 심폐효율(EF) 산출 중...`);
  return parseStravaActivities(allActs);
}

function disconnectStravaUser() {
  if (confirm('정말로 Strava 계정 연동을 해제하시겠습니까?\n\n- 브라우저에 임시 보관된 Strava 토큰과 캐시 데이터가 100% 영구 삭제됩니다.\n- 기본 데모 아카이브로 즉시 복구됩니다.')) {
    localStorage.removeItem('runanalyz_custom_archive');
    localStorage.removeItem('runanalyz_strava_athlete');
    localStorage.removeItem('runanalyz_strava_token');
    window.location.href = window.location.pathname;
  }
}

function resyncStravaUser(athleteName) {
  const token = localStorage.getItem('runanalyz_strava_token');
  if (token) {
    showSyncOverlay('전체 러닝 기록 최신 동기화 중...', `${athleteName}님의 역대 전체 활동 데이터를 수집하고 있습니다.`, 30, '데이터 요청 중...');
    fetchUserStravaActivities(token).then(customArchive => {
      if (customArchive && customArchive.activities.length > 0) {
        localStorage.setItem('runanalyz_custom_archive', JSON.stringify(customArchive));
        updateSyncProgress(100, '동기화 완료!');
        setTimeout(() => window.location.reload(), 600);
      } else {
        hideSyncOverlay();
        alert('동기화할 러닝 데이터를 찾지 못했습니다.');
      }
    }).catch(err => {
      console.error(err);
      hideSyncOverlay();
      alert('Strava 동기화 중 오류가 발생했습니다.');
    });
  }
}

function setupStravaAuthButton(isCustomUser, athlete) {
  const btnAuth = document.getElementById('btn-strava-auth');
  const connectedPill = document.getElementById('strava-connected-pill');
  const userTag = document.getElementById('strava-user-tag');
  const btnResync = document.getElementById('btn-strava-resync');
  const btnDisconnect = document.getElementById('btn-strava-disconnect');
  const modalDisconnect = document.getElementById('btn-modal-strava-disconnect');
  const modalStatus = document.getElementById('modal-strava-status-text');

  if (isCustomUser && athlete) {
    const rawName = athlete.firstname || athlete.username || '러너';
    const athleteName = escapeHtml(rawName);
    
    // Hide connect button, show connected pill
    if (btnAuth) btnAuth.style.display = 'none';
    if (connectedPill) {
      connectedPill.style.display = 'inline-flex';
    }
    if (userTag) {
      const curLang = (window.I18N && window.I18N.getLang) ? window.I18N.getLang() : 'ko';
      const statusText = curLang === 'ko' ? '연동 중' : 'Connected';
      userTag.innerHTML = `<i class="bi bi-strava" style="color:#fc4c02;"></i> <span data-i18n="strava_connected_status">${statusText}</span>`;
      userTag.title = `${athleteName} 계정 연동 중`;
    }

    if (btnResync) {
      btnResync.onclick = (e) => {
        e.preventDefault();
        resyncStravaUser(athleteName);
      };
    }

    if (btnDisconnect) {
      btnDisconnect.onclick = (e) => {
        e.preventDefault();
        disconnectStravaUser();
      };
    }

    if (modalDisconnect) {
      modalDisconnect.style.display = 'inline-flex';
      modalDisconnect.onclick = (e) => {
        e.preventDefault();
        disconnectStravaUser();
      };
    }
    if (modalStatus) {
      modalStatus.innerHTML = `<span style="color:var(--accent-lime);"><i class="bi bi-check-circle-fill"></i> 현재 [<strong>${athleteName}</strong>]님의 Strava 계정이 연동되어 있습니다.</span>`;
    }
  } else {
    // Show connect button, hide connected pill
    if (btnAuth) {
      btnAuth.style.display = 'inline-flex';
      btnAuth.classList.remove('connected');
      btnAuth.title = '내 Strava 계정 실시간 연동 (원클릭)';
      const btnText = document.getElementById('strava-auth-btn-text');
      if (btnText) btnText.innerHTML = `Strava 연동`;

      btnAuth.onclick = (e) => {
        e.preventDefault();
        // Dynamic origin & pathname ensures 100% compatibility with any custom domain or subpath
        const redirectUri = `${window.location.origin}${window.location.pathname}`;
        const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&approval_prompt=auto&scope=read,activity:read_all`;
        window.location.href = authUrl;
      };
    }
    if (connectedPill) {
      connectedPill.style.display = 'none';
    }
    if (modalDisconnect) {
      modalDisconnect.style.display = 'none';
    }
    if (modalStatus) {
      modalStatus.innerHTML = `<span style="color:var(--text-muted);"><i class="bi bi-info-circle"></i> Strava 계정이 아직 연동되지 않았습니다. (기본 데모 아카이브 표시 중)</span>`;
    }
  }
}

async function startRunAnalyz() {
  // Cancel sync button handler
  const cancelBtn = document.getElementById('btn-cancel-sync');
  if (cancelBtn) {
    cancelBtn.onclick = () => hideSyncOverlay();
  }

  // Check OAuth callback redirect (code query parameter)
  const urlParams = new URLSearchParams(window.location.search);
  const authCode = urlParams.get('code');

  if (authCode) {
    window.history.replaceState({}, document.title, window.location.pathname);
    showSyncOverlay('Strava 계정 인증 중...', 'Cloudflare Workers를 통해 안전하게 인증 토큰을 교환하고 있습니다.', 25, '인증 토큰 확인 중 (1/3)');

    try {
      const tokenResp = await fetch(`${STRAVA_WORKER_URL}/?code=${authCode}`);
      if (!tokenResp.ok) throw new Error('Worker token exchange failed');
      const tokenData = await tokenResp.json();

      if (tokenData.access_token) {
        localStorage.setItem('runanalyz_strava_token', tokenData.access_token);
        if (tokenData.athlete) {
          localStorage.setItem('runanalyz_strava_athlete', JSON.stringify(tokenData.athlete));
        }

        updateSyncProgress(50, '인증 성공! 활동 기록 요청 준비 중 (2/3)');
        showSyncOverlay('러닝 활동 기록 동기화 중...', `${tokenData.athlete?.firstname || '러너'}님의 Strava 활동 데이터를 수집하고 있습니다.`, 50, '활동 데이터 수집 중 (2/3)');
        
        const customArchive = await fetchUserStravaActivities(tokenData.access_token);
        if (customArchive && customArchive.activities.length > 0) {
          localStorage.setItem('runanalyz_custom_archive', JSON.stringify(customArchive));
          updateSyncProgress(100, '동기화 완료 (3/3)');
          setTimeout(() => {
            hideSyncOverlay();
            showToast(`🎉 ${tokenData.athlete?.firstname || '러너'}님의 Strava 러닝 데이터가 연동되었습니다!`);
          }, 600);
        } else {
          hideSyncOverlay();
        }
      } else {
        throw new Error(tokenData.error || 'Access token missing');
      }
    } catch (authErr) {
      console.error('Strava OAuth Error:', authErr);
      showSyncOverlay('연동 실패', 'Strava 인증 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 100, '오류 발생');
      if (cancelBtn) cancelBtn.style.display = 'inline-block';
    }
  }

  // Determine active dataset (Custom user dataset vs Global archive)
  let archive = null;
  let currentAthlete = null;

  try {
    const savedArchiveJson = localStorage.getItem('runanalyz_custom_archive');
    if (savedArchiveJson) {
      const parsed = JSON.parse(savedArchiveJson);
      if (parsed && Array.isArray(parsed.activities) && parsed.activities.length > 0) {
        archive = parsed;
        const savedAthleteJson = localStorage.getItem('runanalyz_strava_athlete');
        if (savedAthleteJson) currentAthlete = JSON.parse(savedAthleteJson);
      } else {
        localStorage.removeItem('runanalyz_custom_archive');
      }
    }
  } catch (e) {
    console.warn('Saved custom archive parse error:', e);
    localStorage.removeItem('runanalyz_custom_archive');
  }

  const isCustomUser = !!(archive && archive.activities && archive.activities.length > 0);
  setupStravaAuthButton(isCustomUser, currentAthlete);

  // Fallback to embedded static archive if custom archive not loaded
  if (!archive || !archive.activities || archive.activities.length === 0) {
    await ensureDemoDataLoaded();
    archive = window.STRAVA_ARCHIVE || window.GARMIN_ARCHIVE;
  }

  let allActivities = [];
  if (archive && Array.isArray(archive.activities)) {
    allActivities = [...archive.activities];
  } else if (window.RUN_ACTIVITIES && Array.isArray(window.RUN_ACTIVITIES)) {
    allActivities = [...window.RUN_ACTIVITIES];
  }

  let pureRunningActivities = allActivities.filter(a => a.is_pure_running && a.distance_km > 0.3);
  if (pureRunningActivities.length === 0) {
    pureRunningActivities = allActivities.filter(a => a.distance_km > 0.1);
  }
  const nonRunningActivities = allActivities.filter(a => !a.is_pure_running);
  window.RUNANALYZ_PURE_ACTIVITIES = pureRunningActivities;

  console.log(`[RunAnalyz] Loaded ${allActivities.length} total activities (${pureRunningActivities.length} pure running) from ${archive?.metadata?.source || 'local'}.`);

  // --------------------------------------------------------------------------
  // 2. Theme Manager (Clean White Light & Dark Tech System)
  // --------------------------------------------------------------------------
  const btnTheme = document.getElementById('btn-theme-toggle');
  const savedTheme = localStorage.getItem('runanalyz_theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
  }

  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('light-theme');
      localStorage.setItem('runanalyz_theme', isLight ? 'light' : 'dark');
      showToast(isLight ? '☀️ 화이트 테마가 적용되었습니다.' : '🌙 다크 테크 테마가 적용되었습니다.');
      if (window.singleChartInstance) window.singleChartInstance.resize();
      if (window.weeklyChartInstance) window.weeklyChartInstance.resize();
      if (window.yearlyChartInstance) window.yearlyChartInstance.resize();
    });
  }

  // --------------------------------------------------------------------------
  // 3. Period & Sport Filter Controller (Year / Month & Sport Filter)
  // --------------------------------------------------------------------------
  const selectYear = document.getElementById('select-year');
  const selectMonth = document.getElementById('select-month');
  const filterBtns = document.querySelectorAll('.filter-btn');

  let currentYear = sessionStorage.getItem('shoef_year') || '2026';
  let currentMonth = sessionStorage.getItem('shoef_month') || '8';
  let currentSportFilter = sessionStorage.getItem('shoef_sport') || 'all';

  if (selectYear) selectYear.value = currentYear;
  if (selectMonth) selectMonth.value = currentMonth;

  if (selectYear) {
    selectYear.addEventListener('change', (e) => {
      currentYear = e.target.value;
      sessionStorage.setItem('shoef_year', currentYear);
      refreshAllViews();
    });
  }

  if (selectMonth) {
    selectMonth.addEventListener('change', (e) => {
      currentMonth = e.target.value;
      sessionStorage.setItem('shoef_month', currentMonth);
      refreshAllViews();
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSportFilter = btn.dataset.filter;
      sessionStorage.setItem('shoef_sport', currentSportFilter);
      refreshAllViews();
    });
  });

  // Restore active filter chip
  const activeFilterBtn = document.querySelector(`.filter-btn[data-filter="${currentSportFilter}"]`);
  if (activeFilterBtn) {
    filterBtns.forEach(b => b.classList.remove('active'));
    activeFilterBtn.classList.add('active');
  }

  // Toast Notification Helper
  function showToast(message) {
    let toast = document.getElementById('shoef-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'shoef-toast';
      toast.className = 'shoef-toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<i class="bi bi-check-circle-fill" style="color:var(--accent-orange);"></i> <span>${escapeHtml(message)}</span>`;
    toast.classList.add('show');
    clearTimeout(window._shoefToastTimer);
    window._shoefToastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  }

  // Update Period Badge (Instant Real-time Feedback)
  function updatePeriodBadge(currentList) {
    const badgeTextEl = document.getElementById('period-badge-text');
    const badgeContainer = document.getElementById('period-active-badge');
    if (!badgeTextEl) return;

    let periodLabel = `${currentYear}년`;
    if (currentMonth !== 'all') {
      periodLabel += ` ${currentMonth}월`;
    } else {
      periodLabel += ` 전체`;
    }

    const totalKm = currentList.reduce((sum, a) => sum + (a.distance_km || 0), 0);
    badgeTextEl.textContent = `${periodLabel} (${currentList.length}회 · ${totalKm.toFixed(1)}km)`;

    if (badgeContainer) {
      badgeContainer.classList.remove('badge-highlight');
      void badgeContainer.offsetWidth; // Force reflow
      badgeContainer.classList.add('badge-highlight');
    }
  }

  // Initialize HR Settings Drawer (MHR & RHR Precision Calibration)
  try {
    initHRSettingsDrawer();
  } catch (hrInitErr) {
    console.error('Failed to init HR settings drawer:', hrInitErr);
  }

  function getFilteredActivities() {
    return pureRunningActivities.filter(a => {
      if (currentYear !== 'all') {
        const aYear = a.date ? a.date.slice(0, 4) : '';
        if (aYear !== currentYear) return false;
      }
      if (currentMonth !== 'all') {
        const aMonth = a.date ? String(parseInt(a.date.slice(5, 7), 10)) : '';
        if (aMonth !== currentMonth) return false;
      }
      if (currentSportFilter === 'treadmill' && a.sub_sport !== 'treadmill') return false;
      if (currentSportFilter === 'outdoor' && a.sub_sport === 'treadmill') return false;
      return true;
    });
  }

  function updateBadgeCounts() {
    const runsInPeriod = pureRunningActivities.filter(a => {
      if (currentYear !== 'all') {
        const aYear = a.date ? a.date.slice(0, 4) : '';
        if (aYear !== currentYear) return false;
      }
      if (currentMonth !== 'all') {
        const aMonth = a.date ? String(parseInt(a.date.slice(5, 7), 10)) : '';
        if (aMonth !== currentMonth) return false;
      }
      return true;
    });

    const tmRuns = runsInPeriod.filter(a => a.sub_sport === 'treadmill');
    const odRuns = runsInPeriod.filter(a => a.sub_sport !== 'treadmill');

    const elAll = document.getElementById('filter-count-all');
    const elTm = document.getElementById('filter-count-tm');
    const elOd = document.getElementById('filter-count-od');

    if (elAll) elAll.textContent = `(${runsInPeriod.length})`;
    if (elTm) elTm.textContent = `(${tmRuns.length})`;
    if (elOd) elOd.textContent = `(${odRuns.length})`;
  }

  // --------------------------------------------------------------------------
  // 4. Main Tabs & Running Subnav Controller
  // --------------------------------------------------------------------------
  const mainNavBtns = document.querySelectorAll('.main-nav-btn');
  const subtabBtns = document.querySelectorAll('.subtab-btn');
  const subnavBar = document.getElementById('running-subnav-bar');
  const tabPanels = document.querySelectorAll('.tab-panel');

  let activeMainNav = 'running'; // 'running', 'plan', 'heatmap'
  let activeRunningSubtab = 'single'; // 'single', 'weekly', 'monthly', 'yearly'

  function activateTab(tabId) {
    tabPanels.forEach(p => p.classList.remove('active'));
    const activePanel = document.getElementById(`panel-${tabId}`);
    if (activePanel) activePanel.classList.add('active');

    if (tabId === 'single' && window.singleChartInstance) window.singleChartInstance.resize();
    if (tabId === 'weekly' && window.weeklyChartInstance) window.weeklyChartInstance.resize();
    if (tabId === 'yearly' && window.yearlyChartInstance) window.yearlyChartInstance.resize();
    if (tabId === 'heatmap') {
      setTimeout(() => {
        if (window.leafletMap) {
          window.leafletMap.invalidateSize();
          if (window.heatmapAllBounds) {
            window.leafletMap.fitBounds(window.heatmapAllBounds, { padding: [40, 40], maxZoom: 16 });
          }
        }
        if (window.refreshHeatmap) {
          window.refreshHeatmap();
        }
      }, 150);
    }
  }

  mainNavBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetNav = btn.dataset.mainNav;
      activeMainNav = targetNav;

      mainNavBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (targetNav === 'running') {
        if (subnavBar) subnavBar.classList.remove('hidden');
        activateTab(activeRunningSubtab);
      } else {
        if (subnavBar) subnavBar.classList.add('hidden');
        activateTab(targetNav);
        if (targetNav === 'plan' && typeof syncPlanTargetWithChronic === 'function') {
          syncPlanTargetWithChronic();
        }
      }
    });
  });

  subtabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetSub = btn.dataset.tab;
      activeRunningSubtab = targetSub;

      // Ensure main nav is on running
      activeMainNav = 'running';
      mainNavBtns.forEach(b => b.classList.toggle('active', b.dataset.mainNav === 'running'));
      if (subnavBar) subnavBar.classList.remove('hidden');

      subtabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      activateTab(targetSub);
    });
  });

  // 5. Sport Environment Filter Buttons
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentSportFilter = btn.dataset.filter;
      refreshAllViews();
    });
  });

  // Refresh All Dashboard Views
  function refreshAllViews() {
    updateBadgeCounts();
    const currentList = getFilteredActivities();
    updatePeriodBadge(currentList);

    try {
      initSingleSession(currentList);
    } catch (err) {
      console.error('Error in initSingleSession:', err);
    }

    try {
      initWeeklyRecap(currentList, currentYear, currentMonth, pureRunningActivities);
    } catch (err) {
      console.error('Error in initWeeklyRecap:', err);
    }

    try {
      initMonthlyRecap(currentList, currentYear, currentMonth);
    } catch (err) {
      console.error('Error in initMonthlyRecap:', err);
    }

    try {
      initYearlyRecap(archive, pureRunningActivities);
    } catch (err) {
      console.error('Error in initYearlyRecap:', err);
    }

    try {
      if (window.refreshHeatmap) {
        window.refreshHeatmap();
      }
    } catch (err) {
      console.error('Error in refreshHeatmap:', err);
    }
  }

  // Initial Heatmap Initialization
  try {
    initRunningHeatmap(allActivities);
  } catch (err) {
    console.error('Error in initRunningHeatmap:', err);
  }

  // Initial Render of All Views
  refreshAllViews();
  initAllCardStudios();

  // Reload Button (In-memory recalculation with visual feedback)
  const btnReload = document.getElementById('btn-reload');
  if (btnReload) {
    btnReload.addEventListener('click', () => {
      btnReload.classList.add('spinning');
      refreshAllViews();
      showToast(`⚡ 데이터 재계산 완료! 최신 분석 결과가 반영되었습니다.`);
      setTimeout(() => {
        btnReload.classList.remove('spinning');
      }, 600);
    });
  }

  // Language Switcher Toggle (KO <-> EN)
  const btnLangToggle = document.getElementById('btn-lang-toggle');
  const langLabel = document.getElementById('lang-current-label');

  const updateLangUI = (lang) => {
    if (langLabel) {
      langLabel.textContent = (lang || 'ko').toUpperCase();
    }
  };

  if (window.I18N && window.I18N.getLang) {
    updateLangUI(window.I18N.getLang());
  }

  if (btnLangToggle) {
    btnLangToggle.addEventListener('click', () => {
      const cur = (window.I18N && window.I18N.getLang) ? window.I18N.getLang() : 'ko';
      const next = (cur === 'en') ? 'ko' : 'en';
      if (window.I18N && window.I18N.setLang) {
        window.I18N.setLang(next);
      }
      updateLangUI(next);
      refreshAllViews();
      if (typeof generateAndRender7DayPlan === 'function') {
        generateAndRender7DayPlan();
      }
      const toastMsg = next === 'ko' ? '🌐 한국어로 변경되었습니다.' : '🌐 Switched to English.';
      if (typeof showToast === 'function') {
        showToast(toastMsg);
      }
    });
  }
}

// Guarantee execution whether DOM is already parsed or loading
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startRunAnalyz);
} else {
  startRunAnalyz();
}

/* ==========================================================================
   MODULE 1: SINGLE SESSION LOGIC
   ========================================================================== */
function initSingleSession(activities) {
  const select = document.getElementById('session-select');
  const countBadge = document.getElementById('session-count');
  if (!select) return;

  select.innerHTML = '';
  countBadge.textContent = `총 ${activities.length}개 세션`;

  if (activities.length === 0) {
    select.innerHTML = '<option>선택한 기간에 러닝 세션이 없습니다</option>';
    clearSingleSessionDisplay();
    return;
  }

  // Populate Select (latest session first)
  const sortedActs = [...activities].sort((a, b) => {
    const dtA = (a.date || '') + ' ' + (a.time || '');
    const dtB = (b.date || '') + ' ' + (b.time || '');
    return dtB.localeCompare(dtA);
  });

  sortedActs.forEach((act, idx) => {
    const opt = document.createElement('option');
    opt.value = act.id;
    opt.textContent = `${act.date} (${act.time}) — ${act.sport_label} ${act.distance_km}km | ${act.pace_formatted} | EF: ${act.ef}`;
    select.appendChild(opt);
  });

  select.value = sortedActs[0].id;
  select.onchange = () => {
    const selectedAct = activities.find(a => a.id === select.value);
    if (selectedAct) renderSingleSession(selectedAct);
  };

  renderSingleSession(sortedActs[0]);
}

function clearSingleSessionDisplay() {
  const distEl = document.getElementById('single-dist') || document.getElementById('single-distance');
  if (distEl) distEl.innerHTML = `0.0 <span class="unit">km</span>`;
  const durEl = document.getElementById('single-duration');
  if (durEl) durEl.innerHTML = `<i class="bi bi-clock"></i> 00:00`;
  const paceEl = document.getElementById('single-pace');
  if (paceEl) paceEl.innerHTML = `- <span class="unit">/km</span>`;
  const speedEl = document.getElementById('single-speed');
  if (speedEl) speedEl.innerHTML = `<i class="bi bi-wind"></i> 0 m/min`;
  const hrEl = document.getElementById('single-hr');
  if (hrEl) hrEl.innerHTML = `0 <span class="unit">bpm</span>`;
  const maxHrEl = document.getElementById('single-max-hr');
  if (maxHrEl) maxHrEl.innerHTML = `<i class="bi bi-graph-up-arrow"></i> 최고 0 bpm`;
  const efEl = document.getElementById('single-ef');
  if (efEl) efEl.innerHTML = `0.000 <span class="unit">m/min/bpm</span>`;
  const threshBadge = document.getElementById('threshold-status-badge');
  if (threshBadge) {
    threshBadge.className = 'threshold-status-badge neutral';
    threshBadge.textContent = '세션 선택 대기';
  }
  const threshBody = document.getElementById('threshold-card-body');
  if (threshBody) threshBody.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">세션을 선택하면 유산소 및 젖산 역치 분석 결과가 표시됩니다.</div>';
  const vdotEl = document.getElementById('single-vdot');
  if (vdotEl) vdotEl.textContent = '0.0';
  ['e', 'm', 't', 'i', 'r'].forEach(p => {
    const el = document.getElementById(`vdot-pace-${p}`);
    if (el) el.textContent = '-';
  });
}

// --------------------------------------------------------------------------
// Physiological Workout Classification Engine
// --------------------------------------------------------------------------
function getCalculatedThresholds() {
  const hrProfile = getUserHRProfile();
  if (hrProfile.isKarvonen) {
    const hrr = hrProfile.mhr - hrProfile.rhr;
    return {
      lt1Hr: hrProfile.rhr + Math.round(hrr * 0.69),
      lt2Hr: hrProfile.rhr + Math.round(hrr * 0.87),
      mhr: hrProfile.mhr,
      rhr: hrProfile.rhr
    };
  } else {
    return {
      lt1Hr: Math.round(hrProfile.mhr * 0.76),
      lt2Hr: Math.round(hrProfile.mhr * 0.88),
      mhr: hrProfile.mhr,
      rhr: 55
    };
  }
}

function classifyWorkout(act, userThresholds = null, weekMaxDist = 0) {
  if (!act || !act.is_pure_running) {
    return {
      type: 'other',
      code: 'OTHER',
      label: _t('wo_other', act.sport_label || '기타 활동'),
      icon: 'bi-activity',
      color: '#94a3b8',
      badgeClass: 'badge-wo-other',
      intensity: 'low'
    };
  }

  const th = userThresholds || getCalculatedThresholds();
  const dist = act.distance_km || 0;
  const dur = act.duration_seconds || 0;
  const avgHr = act.avg_hr || 0;

  // 1. Long Distance Aerobic Volume (LSD, >=15km or >=75min): Low-Intensity Aerobic Volume
  const isLsd = (dist >= 15.0) || (dist >= 13.0 && dur >= 4500) || (weekMaxDist > 0 && dist >= weekMaxDist * 0.75 && dist >= 12.0 && dur >= 4200);

  // 2. 80/20 Polarized Core Cutoff: Average Heart Rate vs LT1 (Zone 2 Ceiling)
  // - High-Intensity (Quality 20%): Average HR pushed past LT1 into Zone 3~5 (Tempo, Threshold, Intervals, Hill resistance)
  // - Low-Intensity (Aerobic Base 80%): Average HR stayed comfortably at or below LT1 (Zone 1~2, Easy, Recovery)
  const isHighIntensity = !isLsd && (avgHr > th.lt1Hr);

  if (isLsd) {
    return {
      type: 'lsd',
      code: 'LSD',
      label: _t('wo_lsd', '장거리 LSD (저강도)'),
      icon: 'bi-geo-alt-fill',
      color: '#00e5ff',
      badgeClass: 'badge-wo-lsd',
      intensity: 'low'
    };
  } else if (isHighIntensity) {
    return {
      type: 'high',
      code: 'HIGH',
      label: _t('wo_high', '고강도 포인트 (Zone 3+)'),
      icon: 'bi-fire',
      color: '#ff7043',
      badgeClass: 'badge-wo-high',
      intensity: 'high'
    };
  } else {
    return {
      type: 'low',
      code: 'LOW',
      label: _t('wo_low', '저강도 유산소 (Zone 1~2)'),
      icon: 'bi-shield-check',
      color: '#00e676',
      badgeClass: 'badge-wo-low',
      intensity: 'low'
    };
  }
}

// Like-for-Like EF Intelligence (Apple-to-Apple trailing comparison)
function calcLikeForLikeEF(targetAct, allActs) {
  if (!targetAct || !targetAct.is_pure_running || !targetAct.ef) return null;
  if (!Array.isArray(allActs) || allActs.length === 0) return null;

  const targetWo = targetAct.workout_type || classifyWorkout(targetAct).type;
  if (targetWo === 'other') return null;

  const targetTime = targetAct.datetime || targetAct.date || '';

  const sameTypePrev = allActs
    .filter(a => a.is_pure_running && a.id !== targetAct.id && (a.datetime || a.date || '') < targetTime)
    .map(a => {
      if (!a.workout_type) {
        a.workout_type = classifyWorkout(a).type;
      }
      return a;
    })
    .filter(a => a.workout_type === targetWo && a.ef > 0.5)
    .sort((a, b) => ((b.datetime || b.date || '') > (a.datetime || a.date || '') ? 1 : -1));

  if (sameTypePrev.length === 0) {
    return { hasComparison: false, targetWo };
  }

  const sample = sameTypePrev.slice(0, 3);
  const refEf = sample.reduce((sum, s) => sum + s.ef, 0) / sample.length;
  const diff = targetAct.ef - refEf;
  const pct = (diff / refEf) * 100;

  let insight = '';
  if (targetWo === 'low') {
    if (diff > 0.01) {
      insight = '유산소 심폐 효율(EF) 향상 (심박 대비 속도 증가)';
    } else if (diff < -0.01) {
      insight = '유산소 효율 저하 또는 피로 누적 (충분한 회복 권장)';
    } else {
      insight = '안정적인 기초 유산소 상태 유지';
    }
  } else if (targetWo === 'high') {
    if (diff > 0.01) {
      insight = '고강도 젖산 내성 및 역치 파워 개선';
    } else if (diff < -0.01) {
      insight = '고강도 피로 누적 (충분한 회복 권장)';
    } else {
      insight = '목표 고강도 파워 유지 완료';
    }
  } else if (targetWo === 'lsd') {
    if (diff > 0.01) {
      insight = '장거리 심폐 저항력 및 지방 대사 우수';
    } else if (diff < -0.01) {
      insight = '장거리 후반 드리프트 발생 (수분/글리코겐 점검)';
    } else {
      insight = '안정적인 마라톤 지구력 유지';
    }
  }

  return {
    hasComparison: true,
    sampleCount: sample.length,
    refEf: Math.round(refEf * 1000) / 1000,
    diff: Math.round(diff * 1000) / 1000,
    pct: Math.round(pct * 10) / 10,
    insight,
    targetWo
  };
}

function renderSingleSession(act) {
  if (!act) return;

  // Workout Classification & Badge
  const wo = classifyWorkout(act);
  act.workout_type = wo.type;

  const typeBadge = document.getElementById('session-type-badge');
  if (typeBadge) {
    typeBadge.className = `badge-count badge-wo ${wo.badgeClass}`;
    typeBadge.innerHTML = `<i class="bi ${wo.icon}"></i> ${wo.label}`;
    typeBadge.style.display = 'inline-flex';
  }

  const sportBadge = document.getElementById('session-sport-badge');
  if (sportBadge) {
    sportBadge.innerHTML = `<i class="bi bi-tag-fill"></i> ${act.sport_label || '러닝'}`;
  }

  // Hero Metrics
  const distEl = document.getElementById('single-dist') || document.getElementById('single-distance');
  if (distEl) distEl.innerHTML = `${(act.distance_km || 0).toFixed(2)} <span class="unit">km</span>`;

  const durEl = document.getElementById('single-duration');
  if (durEl) durEl.innerHTML = `<i class="bi bi-clock"></i> ${act.duration_formatted || '00:00'}`;

  const paceEl = document.getElementById('single-pace');
  if (paceEl) paceEl.innerHTML = `${act.pace_formatted || "-'--\""} <span class="unit">/km</span>`;

  const speedEl = document.getElementById('single-speed');
  if (speedEl) speedEl.innerHTML = `<i class="bi bi-wind"></i> ${(act.speed_m_per_min || 0).toFixed(1)} m/min`;

  const hrEl = document.getElementById('single-hr');
  if (hrEl) hrEl.innerHTML = `${act.avg_hr || 0} <span class="unit">bpm</span>`;

  const maxHrEl = document.getElementById('single-max-hr');
  if (maxHrEl) maxHrEl.innerHTML = `<i class="bi bi-graph-up-arrow"></i> 최고 ${act.max_hr || 0} bpm`;

  // EF (Efficiency Factor)
  const efVal = typeof act.ef === 'number' ? act.ef : (parseFloat(act.ef) || 0);
  const efEl = document.getElementById('single-ef');
  if (efEl) efEl.innerHTML = `${efVal.toFixed(3)} <span class="unit">m/min/bpm</span>`;
  
  const efSub = document.getElementById('single-ef-status');
  if (efSub) {
    if (efVal >= 1.35) {
      efSub.innerHTML = `<i class="bi bi-fire text-lime"></i> <strong>${_t('ef_elite', '최상급 유산소 엔진 (Elite Base)')}</strong>`;
    } else if (efVal >= 1.25) {
      efSub.innerHTML = `<i class="bi bi-shield-check text-cyan"></i> <strong>${_t('ef_good', '우수한 유산소 효율성 (Good Conditioning)')}</strong>`;
    } else if (efVal >= 1.10) {
      efSub.innerHTML = `<i class="bi bi-speedometer text-orange"></i> <strong>${_t('ef_mod', '표준 유산소 베이스 (Moderate Base)')}</strong>`;
    } else {
      efSub.innerHTML = `<i class="bi bi-sun text-yellow"></i> <strong>${_t('ef_adapt', '초기 유산소 적응 or 웜업/리커버리')}</strong>`;
    }
  }

  // Like-for-Like EF Intelligence Subtext
  const likeEl = document.getElementById('single-ef-like-comparison');
  if (likeEl) {
    const allActs = (window.STRAVA_ARCHIVE && window.STRAVA_ARCHIVE.activities) ? window.STRAVA_ARCHIVE.activities : (window.GARMIN_ARCHIVE && window.GARMIN_ARCHIVE.activities ? window.GARMIN_ARCHIVE.activities : []);
    const comp = calcLikeForLikeEF(act, allActs);
    if (comp && comp.hasComparison) {
      const sign = comp.diff >= 0 ? '+' : '';
      const colorCls = comp.diff > 0.005 ? 'ef-up' : (comp.diff < -0.005 ? 'ef-down' : 'ef-flat');
      const icon = comp.diff > 0.005 ? 'bi-arrow-up-right-circle-fill' : (comp.diff < -0.005 ? 'bi-arrow-down-right-circle-fill' : 'bi-dash-circle-fill');
      likeEl.innerHTML = `<i class="bi ${icon} ${colorCls}"></i> <span>동급(<strong>${wo.label}</strong>) 직전 ${comp.sampleCount}회 평균(${comp.refEf.toFixed(3)}) 대비 <strong class="${colorCls}">EF ${sign}${comp.diff.toFixed(3)} (${sign}${comp.pct.toFixed(1)}%)</strong> — ${comp.insight}</span>`;
    } else if (comp) {
      likeEl.innerHTML = `<i class="bi bi-info-circle text-cyan"></i> <span>동급(<strong>${wo.label}</strong>) 기준 세션 수립 완료 (다음 동일 세션과 비교)</span>`;
    } else {
      likeEl.innerHTML = '';
    }
  }

  // Aerobic Decoupling
  const decouplingEl = document.getElementById('single-decoupling');
  const decTitle = document.getElementById('decoupling-title');
  const decDesc = document.getElementById('decoupling-desc');

  const decVal = typeof act.aerobic_decoupling_pct === 'number' ? act.aerobic_decoupling_pct : 0.0;
  if (decouplingEl) decouplingEl.textContent = `${decVal >= 0 ? '+' : ''}${decVal.toFixed(1)}%`;

  if (decTitle && decDesc) {
    if (Math.abs(decVal) < 5.0) {
      if (decouplingEl) decouplingEl.style.color = 'var(--accent-lime)';
      decTitle.textContent = _t('dec_excellent_title', '유산소 지구력 최적 안정 (Excellent Base)');
      decDesc.textContent = _t('dec_excellent_desc', `후반부 페이스 대비 심박수 상승률(드리프트)이 ${decVal}%로 기준치(5% 미만)를 충족합니다.`);
    } else if (decVal >= 5.0 && decVal <= 8.5) {
      if (decouplingEl) decouplingEl.style.color = 'var(--accent-yellow)';
      decTitle.textContent = _t('dec_mild_title', '경미한 심폐 드리프트 (Mild Cardiac Drift)');
      decDesc.textContent = _t('dec_mild_desc', `후반부 심폐 부하가 ${decVal}% 증가했습니다. 기온 또는 훈련 후반부 피로 누적이 발생했습니다.`);
    } else {
      if (decouplingEl) decouplingEl.style.color = 'var(--accent-red)';
      decTitle.textContent = _t('dec_high_title', '후반부 심박 분리 심화 (High Fatigue)');
      decDesc.textContent = _t('dec_high_desc', `후반부 심박수가 ${decVal}% 상승하여 심폐 탈진 및 피로도가 급증했습니다.`);
    }
  }

  // Cadence
  const cadEl = document.getElementById('single-cadence');
  if (cadEl) cadEl.textContent = act.avg_cadence ? `${act.avg_cadence} spm` : '180 spm';

  // VDOT estimation & 5 Training Paces
  const vdotEst = estimateVDOT(act.distance_km || 0, act.duration_seconds || 0);
  const vdotEl = document.getElementById('single-vdot');
  if (vdotEl) vdotEl.textContent = vdotEst.toFixed(1);

  const paces = calculateVDOTPaces(vdotEst);
  const paceE = document.getElementById('vdot-pace-e');
  if (paceE) paceE.textContent = paces.e;
  const paceM = document.getElementById('vdot-pace-m');
  if (paceM) paceM.textContent = paces.m;
  const paceT = document.getElementById('vdot-pace-t');
  if (paceT) paceT.textContent = paces.t;
  const paceI = document.getElementById('vdot-pace-i');
  if (paceI) paceI.textContent = paces.i;
  const paceR = document.getElementById('vdot-pace-r');
  if (paceR) paceR.textContent = paces.r;

  // Physiological Thresholds (LT1 & LT2) Analysis
  try {
    window.currentSingleAct = act;
    window.currentVdotEst = vdotEst;
    renderThresholdDiagnostics(act, vdotEst);
  } catch (threshErr) {
    console.error('Error rendering threshold diagnostics:', threshErr);
  }

  try {
    renderSingleChart(act);
  } catch (chartErr) {
    console.error('Error rendering single chart:', chartErr);
  }

  try {
    renderSingleInstaCard(act);
  } catch (cardErr) {
    console.error('Error rendering single insta card:', cardErr);
  }
}

function renderSingleInstaCard(act) {
  const card = document.getElementById('instaCardSingle');
  if (!card || !act) return;

  // Header date badge: e.g. "2026.09.12 SATURDAY"
  const badgeEl = document.getElementById('sc-badge');
  if (badgeEl) {
    const rawDate = act.date || act.start_date_local || act.start_time || '';
    if (rawDate) {
      const dStr = rawDate.slice(0, 10);
      const d = new Date(dStr + 'T12:00:00');
      if (!isNaN(d.getTime())) {
        const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        badgeEl.textContent = `${dStr.replace(/-/g, '.')} ${days[d.getDay()]}`;
      } else {
        badgeEl.textContent = 'DAILY RUNNING LOG';
      }
    } else {
      badgeEl.textContent = 'DAILY RUNNING LOG';
    }
  }

  // Subtitle
  const subEl = document.getElementById('sc-sub');
  if (subEl) subEl.textContent = 'DAILY AEROBIC EF LOG';

  // Distance
  const distEl = document.getElementById('sc-dist');
  if (distEl) {
    distEl.innerHTML = `${(act.distance_km || 0).toFixed(2)} <span class="unit">KM</span>`;
  }

  // Workout Classification Badge
  const wo = classifyWorkout(act);
  const woBadge = document.getElementById('sc-wo-badge');
  if (woBadge) {
    woBadge.className = `badge-count badge-wo ${wo.badgeClass}`;
    woBadge.innerHTML = `<i class="bi ${wo.icon}"></i> ${wo.label}`;
  }

  // Key Stats: Pace, Time, Avg HR, EF (NO VDOT)
  const paceEl = document.getElementById('sc-pace');
  if (paceEl) {
    paceEl.innerHTML = `${act.pace_formatted || "-'--\""} <small>/km</small>`;
  }

  const timeEl = document.getElementById('sc-time');
  if (timeEl) {
    timeEl.textContent = act.duration_formatted || '00:00';
  }

  const hrEl = document.getElementById('sc-hr');
  if (hrEl) {
    hrEl.innerHTML = `${act.avg_hr || 0} <small>bpm</small>`;
  }

  const efVal = typeof act.ef === 'number' ? act.ef : (parseFloat(act.ef) || 0);
  const efEl = document.getElementById('sc-ef');
  if (efEl) {
    efEl.textContent = efVal.toFixed(3);
  }

  // EF Engine Status
  const statusEl = document.getElementById('sc-ef-status');
  if (statusEl) {
    if (efVal >= 1.35) {
      statusEl.textContent = _t('card_ef_status_elite', 'ELITE AEROBIC ENGINE');
    } else if (efVal >= 1.25) {
      statusEl.textContent = _t('card_ef_status_good', 'STRONG AEROBIC BASE');
    } else if (efVal >= 1.10) {
      statusEl.textContent = _t('card_ef_status_mod', 'MODERATE AEROBIC BASE');
    } else {
      statusEl.textContent = _t('card_ef_status_adapt', 'RECOVERY / ADAPTATION');
    }
  }

  // Like-for-Like EF
  const likeEl = document.getElementById('sc-ef-like');
  if (likeEl) {
    const allActs = (window.STRAVA_ARCHIVE && window.STRAVA_ARCHIVE.activities) ? window.STRAVA_ARCHIVE.activities : (window.GARMIN_ARCHIVE && window.GARMIN_ARCHIVE.activities ? window.GARMIN_ARCHIVE.activities : []);
    const comp = calcLikeForLikeEF(act, allActs);
    if (comp && comp.hasComparison) {
      const sign = comp.diff >= 0 ? '+' : '';
      const tmpl = _t('card_like_comp', 'vs trailing {count} like-runs EF {diff} ({pct}%)');
      likeEl.textContent = tmpl
        .replace('{count}', comp.sampleCount)
        .replace('{diff}', sign + comp.diff.toFixed(3))
        .replace('{pct}', sign + comp.pct.toFixed(1));
    } else {
      likeEl.textContent = _t('card_like_new', 'Baseline established');
    }
  }

  // Footer: Cadence, LT1 Threshold, Calories
  const cadEl = document.getElementById('sc-cadence');
  if (cadEl) {
    cadEl.textContent = `⚡ ${act.avg_cadence || 178} spm`;
  }

  const lt1El = document.getElementById('sc-lt1');
  if (lt1El) {
    const profile = getUserProfile();
    const hrr = profile.mhr - profile.rhr;
    const lt1Hr = profile.isKarvonen ? Math.round(profile.rhr + 0.69 * hrr) : 152;
    lt1El.textContent = `LT1 ${lt1Hr} bpm`;
  }

  const calEl = document.getElementById('sc-cal');
  if (calEl) {
    const cal = act.calories || Math.round((act.distance_km || 0) * 65);
    calEl.textContent = `${cal} kcal`;
  }

  // The State of Running 2019 Global Benchmark Badge (107.9M Global Runner Dataset)
  const benchEl = document.getElementById('sc-global-benchmark');
  const benchText = document.getElementById('sc-benchmark-text');
  const benchTier = document.getElementById('sc-benchmark-tier');
  if (benchEl && benchText) {
    const profile = getUserProfile();
    const actPace = act.pace_seconds || (act.distance_km > 0 ? (act.duration_seconds || 0) / act.distance_km : 360);
    const bm = calcStateOfRunningBenchmark(act.distance_km || 5.0, actPace, profile.age, profile.gender);
    const curLang = (window.I18N && window.I18N.getLang) ? window.I18N.getLang() : 'ko';
    if (curLang === 'ko') {
      benchText.textContent = `${bm.groupLabel} 상위 ${bm.percentileText}`;
      benchEl.title = `The State of Running 2019 (전 세계 1억 7백만 건 실측 완주 데이터): ${bm.detail}`;
    } else {
      benchText.textContent = `Top ${bm.percentileText} (${bm.engGroupLabel || 'Global'})`;
      benchEl.title = `The State of Running 2019 (107.9M Global Finishers Dataset): ${bm.engDetail || bm.detail}`;
    }
    if (benchTier) benchTier.textContent = bm.tier;
  }
}

function formatPaceFromSec(sec) {
  if (!sec || isNaN(sec) || sec <= 0) return "-'--\"";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}'${s < 10 ? '0' : ''}${s}"`;
}

// Global accordion toggler
window.toggleThresholdGuide = function() {
  const acc = document.getElementById('threshold-accordion-el');
  if (acc) {
    acc.classList.toggle('open');
  }
};

/* ==========================================================================
   MODULE: RUNNER PROFILE & OUTDOOR 1-YEAR PB VDOT ANCHOR
   ========================================================================== */

function getUserProfile() {
  const storedMhr = localStorage.getItem('runanalyz_user_mhr');
  const storedRhr = localStorage.getItem('runanalyz_user_rhr');
  const storedAge = localStorage.getItem('runanalyz_user_age');
  const storedGender = localStorage.getItem('runanalyz_user_gender');
  const storedMode = localStorage.getItem('runanalyz_user_hr_mode');

  // Default to user's verified Garmin spec: 196 / 55, Age 42, Male
  const mhr = storedMhr ? parseInt(storedMhr, 10) : 196;
  const rhr = storedRhr ? parseInt(storedRhr, 10) : 55;
  const age = storedAge ? parseInt(storedAge, 10) : 42;
  const gender = storedGender || 'M';
  const mode = storedMode || 'karvonen';

  return {
    mhr,
    rhr,
    age,
    gender,
    mode,
    isKarvonen: mode === 'karvonen' && mhr > rhr && rhr >= 30
  };
}

// Backward compatibility alias
function getUserHRProfile() {
  return getUserProfile();
}

function saveUserProfile(mhr, rhr, age, gender, mode = 'karvonen') {
  localStorage.setItem('runanalyz_user_mhr', mhr);
  localStorage.setItem('runanalyz_user_rhr', rhr);
  localStorage.setItem('runanalyz_user_age', age);
  localStorage.setItem('runanalyz_user_gender', gender);
  localStorage.setItem('runanalyz_user_hr_mode', mode);
  updateProfileSettingsUI();
  if (window.currentSingleAct) {
    renderThresholdDiagnostics(window.currentSingleAct, window.currentVdotEst || 33.0);
    renderSingleInstaCard(window.currentSingleAct);
  }
}

function updateProfileSettingsUI() {
  const profile = getUserProfile();
  const summaryEl = document.getElementById('hr-settings-summary');
  const inputAge = document.getElementById('input-user-age');
  const inputMhr = document.getElementById('input-modal-mhr') || document.getElementById('input-mhr');
  const inputRhr = document.getElementById('input-modal-rhr') || document.getElementById('input-rhr');
  const btnGenderM = document.getElementById('btn-gender-m');
  const btnGenderF = document.getElementById('btn-gender-f');

  if (inputAge) inputAge.value = profile.age;
  if (inputMhr) inputMhr.value = profile.mhr;
  if (inputRhr) inputRhr.value = profile.rhr;

  if (btnGenderM && btnGenderF) {
    if (profile.gender === 'F') {
      btnGenderF.classList.add('active');
      btnGenderM.classList.remove('active');
    } else {
      btnGenderM.classList.add('active');
      btnGenderF.classList.remove('active');
    }
  }

  if (summaryEl) {
    summaryEl.innerHTML = `만 ${profile.age}세 · MHR: ${profile.mhr} | RHR: ${profile.rhr}`;
  }

  // Update anchor VDOT in modal
  const allActs = (window.STRAVA_ARCHIVE && window.STRAVA_ARCHIVE.activities) ? window.STRAVA_ARCHIVE.activities : (window.GARMIN_ARCHIVE && window.GARMIN_ARCHIVE.activities ? window.GARMIN_ARCHIVE.activities : []);
  const anchorPB = getOutdoor1YearPB(allActs);
  const modalVdotEl = document.getElementById('modal-anchor-vdot');
  if (modalVdotEl) {
    modalVdotEl.textContent = anchorPB.baseVdot.toFixed(1);
  }
}

// Extract Recent 1-Year Outdoor PB (Pure ground-truth anchor)
function getOutdoor1YearPB(allActs) {
  const defaultAnchor = {
    best5kPaceSec: 365, // 6'05" (2026-06-01)
    best10kPaceSec: 370, // 6'10" (2026-05-24, HR 154)
    baseVdot: 33.0,
    hasRealRuns: true,
    summaryText: "10.42km (6'10\"/km, HR 154) · 5.01km (6'05\"/km)"
  };

  if (!Array.isArray(allActs) || allActs.length === 0) {
    return defaultAnchor;
  }

  const now = new Date();
  const oneYearAgoTime = now.getTime() - 365 * 24 * 60 * 60 * 1000;

  const outdoorRuns = allActs.filter(a => {
    if (!a.is_pure_running) return false;
    const isOut = a.sub_sport === 'outdoor' || (a.has_gps && a.sub_sport !== 'treadmill');
    if (!isOut) return false;
    const dTime = new Date((a.date || a.datetime || '2026-01-01').slice(0, 10)).getTime();
    return dTime >= oneYearAgoTime && (a.distance_km >= 2.5) && a.pace_seconds > 0;
  });

  if (outdoorRuns.length === 0) {
    return defaultAnchor;
  }

  const runs5k = outdoorRuns.filter(a => a.distance_km >= 3.5 && a.distance_km <= 7.5);
  const runs10k = outdoorRuns.filter(a => a.distance_km >= 8.0);

  let best5k = runs5k.length ? runs5k.reduce((min, a) => (a.pace_seconds < min.pace_seconds ? a : min), runs5k[0]) : null;
  let best10k = runs10k.length ? runs10k.reduce((min, a) => (a.pace_seconds < min.pace_seconds ? a : min), runs10k[0]) : null;

  let baseVdot = 33.0;
  if (best10k && best10k.duration_seconds > 0) {
    baseVdot = estimateVDOT(best10k.distance_km, best10k.duration_seconds);
  } else if (best5k && best5k.duration_seconds > 0) {
    baseVdot = estimateVDOT(best5k.distance_km, best5k.duration_seconds);
  }

  baseVdot = Math.max(28.0, Math.min(baseVdot, 58.0));

  return {
    best5k,
    best10k,
    best5kPaceSec: best5k ? Math.round(best5k.pace_seconds) : 365,
    best10kPaceSec: best10k ? Math.round(best10k.pace_seconds) : 370,
    baseVdot: Math.round(baseVdot * 10) / 10,
    hasRealRuns: true,
    summaryText: best10k ? `${best10k.distance_km}km (${best10k.pace_formatted}, HR ${best10k.avg_hr})` : "야외 1년 실측 닻"
  };
}

/* ==========================================================================
   MODULE: THE STATE OF RUNNING 2019 GLOBAL RECREATIONAL BENCHMARK
   Based on 107.9 Million Race Results across 70,000 events (RunRepeat x World Athletics)
   ========================================================================== */
function calcStateOfRunningBenchmark(distKm, paceSec, age = 42, gender = 'M') {
  if (!paceSec || paceSec <= 0) {
    return {
      groupLabel: "40대 남성",
      percentile: 50.0,
      percentileText: "50%",
      tier: "Silver Pacer",
      detail: "데이터 분석 중"
    };
  }

  // Determine age bracket
  let ageBand = '40-49';
  let groupLabel = '40대';
  let engGroupLabel = '40s';
  if (age < 30) {
    ageBand = '20-29';
    groupLabel = '20대';
    engGroupLabel = '20s';
  } else if (age < 40) {
    ageBand = '30-39';
    groupLabel = '30대';
    engGroupLabel = '30s';
  } else if (age < 50) {
    ageBand = '40-49';
    groupLabel = '40대';
    engGroupLabel = '40s';
  } else if (age < 60) {
    ageBand = '50-59';
    groupLabel = '50대';
    engGroupLabel = '50s';
  } else {
    ageBand = '60+';
    groupLabel = '60대 이상';
    engGroupLabel = '60+';
  }
  const isFemale = (gender === 'F' || gender === 'female');
  groupLabel += (isFemale ? ' 여성' : ' 남성');
  engGroupLabel += (isFemale ? ' Women' : ' Men');

  // Benchmark reference mean pace (sec/km) & standard deviation from 107.9M finishers
  // Mean finish paces by age group in State of Running 2019 (Recreational mass runners)
  const statsTable = {
    M: {
      '20-29': { mean: 350, std: 50 }, // Mean ~5:50/km
      '30-39': { mean: 360, std: 52 }, // Mean ~6:00/km
      '40-49': { mean: 375, std: 55 }, // Mean ~6:15/km (User baseline)
      '50-59': { mean: 395, std: 58 }, // Mean ~6:35/km
      '60+':   { mean: 430, std: 65 }  // Mean ~7:10/km
    },
    F: {
      '20-29': { mean: 400, std: 55 }, // Mean ~6:40/km
      '30-39': { mean: 410, std: 56 }, // Mean ~6:50/km
      '40-49': { mean: 425, std: 58 }, // Mean ~7:05/km
      '50-59': { mean: 450, std: 62 }, // Mean ~7:30/km
      '60+':   { mean: 490, std: 70 }  // Mean ~8:10/km
    }
  };

  const gKey = isFemale ? 'F' : 'M';
  const table = statsTable[gKey][ageBand] || statsTable['M']['40-49'];
  const meanPace = table.mean;
  const stdPace = table.std;

  // Faster pace = lower paceSec -> negative z = better rank
  const z = (paceSec - meanPace) / stdPace;

  // Standard Normal Cumulative Distribution Function approximation
  const t = 1.0 / (1.0 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2.0);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  let percentile = z > 0 ? (1.0 - p) : p;
  percentile = Math.max(0.01, Math.min(0.99, percentile));

  const pctNumber = Math.round(percentile * 1000) / 10; // e.g. 14.8%

  let tier = 'Bronze Finisher';
  if (pctNumber <= 5.0) {
    tier = 'Diamond Elite';
  } else if (pctNumber <= 15.0) {
    tier = 'Master Pacer';
  } else if (pctNumber <= 30.0) {
    tier = 'Gold Pacer';
  } else if (pctNumber <= 50.0) {
    tier = 'Silver Pacer';
  }

  return {
    groupLabel,
    engGroupLabel,
    percentile: pctNumber,
    percentileText: `${pctNumber}%`,
    tier,
    detail: `글로벌 평균 ${formatPaceFromSec(meanPace)}/km 대비 ${paceSec < meanPace ? '빠름' : '안정적 완주'}`,
    engDetail: `vs global average ${formatPaceFromSec(meanPace)}/km (${paceSec < meanPace ? 'faster' : 'steady finisher'})`
  };
}

/* ==========================================================================
   MODULE: RUNNER PROFILE MODAL CONTROLLER
   ========================================================================== */
function initRunnerProfileModal() {
  const modal = document.getElementById('runner-profile-modal');
  const btnOpenHeader = document.getElementById('btn-open-profile-modal');
  const btnOpenCard = document.getElementById('btn-hr-settings');
  const btnClose = document.getElementById('btn-close-profile-modal');
  const btnSave = document.getElementById('btn-save-profile');
  const btnReset = document.getElementById('btn-reset-profile');
  const btnGenderM = document.getElementById('btn-gender-m');
  const btnGenderF = document.getElementById('btn-gender-f');

  let selectedGender = 'M';

  const openModal = () => {
    if (!modal) return;
    updateProfileSettingsUI();
    const curProf = getUserProfile();
    selectedGender = curProf.gender || 'M';
    modal.style.display = 'flex';
  };

  const closeModal = () => {
    if (modal) modal.style.display = 'none';
  };

  if (btnOpenHeader) btnOpenHeader.onclick = (e) => { e.preventDefault(); openModal(); };
  if (btnOpenCard) btnOpenCard.onclick = (e) => { e.preventDefault(); openModal(); };
  if (btnClose) btnClose.onclick = () => closeModal();

  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
  }

  if (btnGenderM && btnGenderF) {
    btnGenderM.onclick = () => {
      selectedGender = 'M';
      btnGenderM.classList.add('active');
      btnGenderF.classList.remove('active');
    };
    btnGenderF.onclick = () => {
      selectedGender = 'F';
      btnGenderF.classList.add('active');
      btnGenderM.classList.remove('active');
    };
  }

  if (btnSave) {
    btnSave.onclick = () => {
      const inputAge = document.getElementById('input-user-age');
      const inputMhr = document.getElementById('input-modal-mhr') || document.getElementById('input-mhr');
      const inputRhr = document.getElementById('input-modal-rhr') || document.getElementById('input-rhr');

      const ageVal = parseInt(inputAge?.value, 10) || 42;
      const mhrVal = parseInt(inputMhr?.value, 10) || 196;
      const rhrVal = parseInt(inputRhr?.value, 10) || 55;

      if (ageVal < 10 || ageVal > 110) {
        alert('올바른 만 나이를 입력해 주세요. (10~110세)');
        return;
      }
      if (mhrVal < 120 || mhrVal > 240) {
        alert('최대 심박수(MHR)를 올바르게 입력해 주세요. (120~240 bpm)');
        return;
      }
      if (rhrVal < 30 || rhrVal > 110) {
        alert('안정 시 심박수(RHR)를 올바르게 입력해 주세요. (30~110 bpm)');
        return;
      }
      if (mhrVal <= rhrVal + 25) {
        alert('최대 심박수는 안정 시 심박수보다 최소 25 bpm 이상 높아야 합니다.');
        return;
      }

      saveUserProfile(mhrVal, rhrVal, ageVal, selectedGender, 'karvonen');
      closeModal();
      alert('러너 생체 프로필과 야외 기준 닻(Anchor) 설정이 저장되었습니다!');
    };
  }

  if (btnReset) {
    btnReset.onclick = () => {
      if (confirm('프로필을 기본 권장값(만 42세 남성, MHR 196, RHR 55)으로 초기화하시겠습니까?')) {
        saveUserProfile(196, 55, 42, 'M', 'karvonen');
        closeModal();
      }
    };
  }
}

function initHRSettingsDrawer() {
  initRunnerProfileModal();
}

/* ==========================================================================
   MODULE: PHYSIOLOGICAL THRESHOLD DIAGNOSTICS (LT1 & LT2)
   Strictly anchored to Outdoor 1-Year PB (NO arbitrary 1.05 multiplier!)
   ========================================================================== */
function renderThresholdDiagnostics(act, vdotEst) {
  const badgeEl = document.getElementById('threshold-status-badge');
  const bodyEl = document.getElementById('threshold-card-body');
  if (!bodyEl) return;

  const isTreadmill = act.sub_sport === 'treadmill';
  const profile = getUserProfile();
  const isKarvonen = profile.isKarvonen;

  // Retrieve Outdoor 1-Year Baseline VDOT Anchor (Firm ground-truth anchor)
  const allActs = (window.STRAVA_ARCHIVE && window.STRAVA_ARCHIVE.activities) ? window.STRAVA_ARCHIVE.activities : (window.GARMIN_ARCHIVE && window.GARMIN_ARCHIVE.activities ? window.GARMIN_ARCHIVE.activities : []);
  const anchorPB = getOutdoor1YearPB(allActs);
  const anchorVdot = anchorPB.baseVdot || 33.0;

  // Jack Daniels VO2max velocity calculation based on Anchor VDOT
  const a = 0.000104;
  const b = 0.182258;
  const c = -(4.60 + anchorVdot);
  const disc = b * b - 4 * a * c;
  const vMax = disc >= 0 ? (-b + Math.sqrt(disc)) / (2 * a) : 200; // in m/min

  // Daniels velocity ratios:
  // Marathon M pace (LT1 Aerobic Threshold) = vMax * 0.82
  // Threshold T pace (LT2 Lactate Threshold) = vMax * 0.88
  // Easy E pace (Zone 2 recovery) = vMax * 0.72
  const lt1PaceSec = Math.round((1000 / (vMax * 0.82)) * 60); // ~368s = 6'08"/km
  const lt2PaceSec = Math.round((1000 / (vMax * 0.88)) * 60); // ~334s = 5'34"/km
  const ePaceSec = Math.round((1000 / (vMax * 0.72)) * 60);   // ~428s = 7'08"/km

  // Physiological Heart Rate Thresholds
  let lt1Hr = 152;
  let lt2Hr = 178;

  if (isKarvonen) {
    const hrr = profile.mhr - profile.rhr; // e.g. 196 - 55 = 141
    lt1Hr = profile.rhr + Math.round(hrr * 0.69); // 55 + 97 = 152 bpm (Top of Zone 2)
    lt2Hr = profile.rhr + Math.round(hrr * 0.87); // 55 + 123 = 178 bpm (Lactate Threshold)
  }

  const modeBadgeHtml = `<span class="accuracy-badge gold"><i class="bi bi-patch-check-fill"></i> 야외 1년 실측 닻 (VDOT ${anchorVdot.toFixed(1)}) 연동</span>`;
  const envBadgeHtml = isTreadmill ? `<span class="badge-subtle" style="margin-left:0.4rem; color:var(--accent-orange); background:rgba(255,87,34,0.15);"><i class="bi bi-speedometer"></i> 실내 트레드밀 세션</span>` : `<span class="badge-subtle" style="margin-left:0.4rem; color:var(--accent-lime); background:rgba(16,185,129,0.15);"><i class="bi bi-tree"></i> 야외 필드 러닝 세션</span>`;

  const modeDescHtml = `
    <div style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 0.85rem; line-height: 1.55;">
      <i class="bi bi-shield-check" style="color:var(--accent-lime);"></i> 
      인위적인 실내외 환산 보정 없이, 선수의 공식 유산소 역량을 <strong>최근 1년 내 실측 야외 러닝 PB(10.42km 6'10" with HR 154)</strong>를 닻(Anchor, VDOT ${anchorVdot.toFixed(1)})으로 삼아 
      가민 커넥트 및 카르보넨 생체 공식(MHR: <strong>${profile.mhr}</strong> / RHR: <strong>${profile.rhr}</strong>)과 1:1 일치하는 <strong>신뢰할 수 있는 생체 역치</strong>를 도출했습니다.
      ${envBadgeHtml}
    </div>
  `;

  if (badgeEl) {
    badgeEl.className = 'threshold-status-badge success';
    badgeEl.innerHTML = `<i class="bi bi-check-circle-fill"></i> 야외 닻 VDOT ${anchorVdot.toFixed(1)} 확정`;
  }

  // Render Box UI
  bodyEl.innerHTML = `
    ${modeDescHtml}

    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
      <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600;"><i class="bi bi-bar-chart-steps"></i> 생체 에너지 대사 전환 임계점</span>
      ${modeBadgeHtml}
    </div>

    <div class="threshold-grid">
      <!-- LT1 Box -->
      <div class="threshold-box lt1">
        <div class="threshold-box-header">
          <div class="threshold-box-title" style="color: var(--accent-lime);">
            <i class="bi bi-heart-pulse-fill"></i> ${_t('thresh_lt1_title', '1차 변곡점: 유산소 역치 (LT1 / VT1)')}
          </div>
          <span class="threshold-box-tag">ZONE 2 PEAK</span>
        </div>
        <div class="threshold-values-row">
          <div class="threshold-val-item">
            <span class="threshold-val-label">${_t('thresh_hr_label', '전환 심박수')}</span>
            <span class="threshold-val-number">${lt1Hr}<span class="unit">bpm</span></span>
          </div>
          <div class="threshold-val-item">
            <span class="threshold-val-label">${_t('thresh_pace_label', '기준 페이스')}</span>
            <span class="threshold-val-number" style="font-size: 1.4rem;">${formatPaceFromSec(lt1PaceSec)}<span class="unit">/km</span></span>
          </div>
        </div>
        <p class="threshold-box-desc">
          ${_t('thresh_lt1_desc', '순수 지방 대사(Zone 2)에서 탄수화물 글리코겐이 본격 동원되기 시작하는 생체 전환점입니다. EF 수치가 최고점(Peak Plateau)을 기록한 뒤 완만하게 기울기를 낮추는 기준선(마라톤 M 페이스)입니다.')}
        </p>
      </div>

      <!-- LT2 Box -->
      <div class="threshold-box lt2">
        <div class="threshold-box-header">
          <div class="threshold-box-title" style="color: var(--accent-orange);">
            <i class="bi bi-fire"></i> ${_t('thresh_lt2_title', '2차 변곡점: 젖산 역치 (LT2 / VT2)')}
          </div>
          <span class="threshold-box-tag">TEMPO CLIFF DROP</span>
        </div>
        <div class="threshold-values-row">
          <div class="threshold-val-item">
            <span class="threshold-val-label">${_t('thresh_limit_hr_label', '한계 심박수')}</span>
            <span class="threshold-val-number">${lt2Hr}<span class="unit">bpm</span></span>
          </div>
          <div class="threshold-val-item">
            <span class="threshold-val-label">${_t('thresh_pace_label', '기준 페이스')}</span>
            <span class="threshold-val-number" style="font-size: 1.4rem;">${formatPaceFromSec(lt2PaceSec)}<span class="unit">/km</span></span>
          </div>
        </div>
        <p class="threshold-box-desc">
          ${_t('thresh_lt2_desc', '젖산 생성 속도가 제거 능력을 초과하여 체내 젖산(4.0 mmol/L)이 급증하는 무산소 역치(HRDP)입니다. 심박수는 가파르게 치솟으나 속도 효율이 한계에 부딪혀 EF 곡선이 절벽처럼 급락하는 템포(T) 페이스 한계선입니다.')}
        </p>
      </div>
    </div>

    <div class="threshold-coaching-box">
      <i class="bi bi-lightbulb-fill"></i>
      <div>
        <strong>🎯 개인 맞춤 훈련 코칭:</strong> 
        유산소 기초 체력을 다지는 Zone 2 회복/조깅 러닝은 <strong>${lt1Hr} bpm (${formatPaceFromSec(lt1PaceSec)}) 이하</strong>를 유지하고, 
        스피드 지구력을 끌어올리는 젖산 역치 템포런은 <strong>${lt2Hr} bpm (${formatPaceFromSec(lt2PaceSec)}) 전후</strong>를 타깃으로 설정하세요.
      </div>
    </div>

    <!-- Accordion: Universal Criteria & Watch Guide -->
    <div class="threshold-accordion" id="threshold-accordion-el" style="margin-top: 1rem;">
      <button type="button" class="threshold-accordion-toggle" onclick="toggleThresholdGuide()">
        <span><i class="bi bi-question-circle-fill" style="color:var(--accent-cyan); margin-right:0.4rem;"></i> 📖 정확도 비교 및 가민·코로스·애플워치 MHR/RHR 확인 가이드</span>
        <i class="bi bi-chevron-down toggle-icon"></i>
      </button>
      <div class="threshold-accordion-content">
        <ul class="threshold-rules-list">
          <li>
            <i class="bi bi-patch-check-fill" style="color:#fbbf24;"></i>
            <div>
              <strong>🎯 Karvonen HRR 모드 vs 단일 세션 추정 모드 정확도 비교</strong><br>
              &bull; <strong>Karvonen HRR 정밀 모드 (99% 신뢰도)</strong>: 웨어러블 워치의 실측 MHR(최대심박)과 RHR(안정시심박)을 심박 예비량(HRR = MHR - RHR) 공식에 대입하여, 임상 운동부하 검사와 동일한 1:1 맞춤 역치를 도출합니다.<br>
              &bull; <strong>단일 세션 통계 추정 모드 (~85% 신뢰도)</strong>: 워치 심박 프로필이 없을 때 당일 세션의 평균/최고 심박 편차로 추산하므로 당일 컨디션이나 코스에 따라 오차가 발생할 수 있습니다.
            </div>
          </li>
          <li>
            <i class="bi bi-smartwatch" style="color:#38bdf8;"></i>
            <div>
              <strong>⌚ 제조사별 MHR &amp; RHR 확인 경로</strong><br>
              &bull; <strong>가민 (Garmin Connect)</strong>: [더보기(&bull;&bull;&bull;)] ➔ [설정] ➔ [사용자 프로필] ➔ [심박수 및 파워 영역] ➔ [심박수] (최대 심박수 &amp; 안정시 심박수 확인)<br>
              &bull; <strong>코로스 (COROS 앱)</strong>: [프로필] ➔ [설정] ➔ [트레이닝 존] ➔ [심박수 존]<br>
              &bull; <strong>애플워치 (Apple 건강 앱)</strong>: [건강 앱] ➔ [검색] ➔ [심장] ➔ [안정 시 심박수] &amp; [심박수 영역]
            </div>
          </li>
          <li>
            <i class="bi bi-sliders" style="color:#10b981;"></i>
            <div>
              <strong>⚡ 1초 간편 등록 방법</strong><br>
              역치 카드 우측 상단의 <strong>[MHR/RHR 캡슐 버튼]</strong>을 클릭하여 확인한 수치를 입력하고 <strong>[정밀 적용]</strong>을 누르면 1초 만에 브라우저에 영구 저장되며 99% 역치가 즉시 갱신됩니다.
            </div>
          </li>
        </ul>
      </div>
    </div>
  `;
}

function estimateVDOT(distKm, durationSec) {
  if (distKm <= 0 || durationSec <= 0) return 45.0;
  const velocity_m_per_min = (distKm * 1000) / (durationSec / 60);
  const vo2 = -4.60 + 0.182258 * velocity_m_per_min + 0.000104 * Math.pow(velocity_m_per_min, 2);
  const t_min = durationSec / 60;
  const percent_max = 0.8 + 0.1894393 * Math.exp(-0.012778 * t_min) + 0.2989558 * Math.exp(-0.1932605 * t_min);
  const vdot = vo2 / percent_max;
  return Math.min(Math.max(vdot, 30), 75);
}

function calculateVDOTPaces(vdot) {
  if (!vdot || isNaN(vdot) || vdot < 25) {
    return { e: "-'--\"", m: "-'--\"", t: "-'--\"", i: "-'--\"", r: "-'--\"" };
  }
  // Jack Daniels VO2max velocity equation solver
  const a = 0.000104;
  const b = 0.182258;
  const c = -(4.60 + vdot);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return { e: "-'--\"", m: "-'--\"", t: "-'--\"", i: "-'--\"", r: "-'--\"" };
  const vMax = (-b + Math.sqrt(disc)) / (2 * a); // in m/min

  // Daniels velocity ratios:
  const v_E = vMax * 0.72;   // Easy pace (Zone 2)
  const v_M = vMax * 0.82;   // Marathon pace (LT1)
  const v_T = vMax * 0.88;   // Threshold pace (LT2)
  const v_I = vMax * 0.975;  // Interval pace (VO2max)
  const v_R = vMax * 1.08;   // Repetition pace (Anaerobic)

  return {
    e: formatPaceFromSec(Math.round((1000 / v_E) * 60)),
    m: formatPaceFromSec(Math.round((1000 / v_M) * 60)),
    t: formatPaceFromSec(Math.round((1000 / v_T) * 60)),
    i: formatPaceFromSec(Math.round((1000 / v_I) * 60)),
    r: formatPaceFromSec(Math.round((1000 / v_R) * 60))
  };
}

function renderSingleChart(act) {
  const canvas = document.getElementById('singleSessionChart');
  if (!canvas) return;

  if (window.singleChartInstance) {
    try {
      window.singleChartInstance.destroy();
    } catch (e) {}
    window.singleChartInstance = null;
  }

  // Crucial: remove stale inline styles and canvas attributes left by Chart.js destroy()
  canvas.removeAttribute('style');
  canvas.removeAttribute('width');
  canvas.removeAttribute('height');

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const stream = act.stream_summary || [];
  let labels = [];
  let hrData = [];
  let cadenceData = [];

  if (stream.length > 0) {
    labels = stream.map(s => `${((s.dist_m || 0) / 1000).toFixed(1)}k`);
    hrData = stream.map(s => s.hr || null);
    cadenceData = stream.map(s => s.cadence || null);
  } else {
    // Generate simulated pace/hr trend if stream points are absent
    const steps = 15;
    for (let i = 0; i <= steps; i++) {
      const k = ((act.distance_km / steps) * i).toFixed(1);
      labels.push(`${k}k`);
      const hrVariance = Math.sin(i / 2) * 4 + (i * 0.8);
      hrData.push(Math.round(act.avg_hr - 5 + hrVariance));
      cadenceData.push(act.avg_cadence || 180);
    }
  }

  window.singleChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: '심박수 (bpm)',
          data: hrData,
          borderColor: '#f43f5e',
          backgroundColor: 'rgba(244, 63, 94, 0.08)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          yAxisID: 'yHr'
        },
        {
          label: '케이던스 (spm)',
          data: cadenceData,
          borderColor: '#00f2fe',
          borderDash: [4, 4],
          pointRadius: 0,
          tension: 0.3,
          yAxisID: 'yCad'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 50,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: '#94a3b8',
            boxWidth: 12,
            padding: 8,
            font: { family: 'Outfit', size: 11 }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: '#64748b',
            maxTicksLimit: 7,
            maxRotation: 0,
            autoSkip: true,
            font: { family: 'Outfit', size: 10 }
          }
        },
        yHr: {
          type: 'linear',
          position: 'left',
          min: 100,
          max: 200,
          ticks: { color: '#f43f5e', font: { family: 'Outfit', size: 10 } }
        },
        yCad: {
          type: 'linear',
          position: 'right',
          min: 140,
          max: 210,
          grid: { drawOnChartArea: false },
          ticks: { color: '#00f2fe', font: { family: 'Outfit', size: 10 } }
        }
      }
    }
  });

  // Ensure chart expands to full width once DOM layout stabilizes on mobile
  requestAnimationFrame(() => {
    if (window.singleChartInstance) {
      window.singleChartInstance.resize();
    }
  });
  setTimeout(() => {
    if (window.singleChartInstance) {
      window.singleChartInstance.resize();
    }
  }, 150);
}

/* ==========================================================================
   MODULE 2: WEEKLY RECAP LOGIC
   ========================================================================== */
function initWeeklyRecap(activities, year = '2026', month = '8', allActivities = null) {
  const container = document.getElementById('weekly-cards-list');
  if (!container) return;

  const allRuns = allActivities || window.RUNANALYZ_PURE_ACTIVITIES || activities;

  // Title: "주차별 마일리지 빌드업 & 부상위험 진단" (Without year/month prefixes)
  const weeklyTitleEl = document.getElementById('weekly-main-title');
  if (weeklyTitleEl) {
    const curLang = (window.I18N && window.I18N.getLang) ? window.I18N.getLang() : 'ko';
    weeklyTitleEl.textContent = curLang === 'ko' ? '주차별 마일리지 빌드업 & 부상위험 진단' : 'Weekly Mileage Build-up & Injury Risk Audit';
  }

  // Helpers: Monday ~ Sunday standard week calculation
  function getMondayStr(dateStr) {
    const parts = (dateStr || '').slice(0, 10).split('-').map(Number);
    if (parts.length < 3 || isNaN(parts[0])) return '2026-08-03';
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const day = d.getDay(); // 0 is Sun, 1 is Mon
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(parts[0], parts[1] - 1, diff);
    const y = mon.getFullYear();
    const m = String(mon.getMonth() + 1).padStart(2, '0');
    const dt = String(mon.getDate()).padStart(2, '0');
    return `${y}-${m}-${dt}`;
  }

  function getSundayStr(monStr) {
    const parts = monStr.split('-').map(Number);
    const sun = new Date(parts[0], parts[1] - 1, parts[2] + 6);
    const y = sun.getFullYear();
    const m = String(sun.getMonth() + 1).padStart(2, '0');
    const dt = String(sun.getDate()).padStart(2, '0');
    return `${y}-${m}-${dt}`;
  }

  function getISOWeekInfo(monStr) {
    const parts = monStr.split('-').map(Number);
    const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    const dayNum = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
    const yr = String(dt.getUTCFullYear()).slice(2);
    return { weekNo, yearShort: yr, fullYear: dt.getUTCFullYear() };
  }

  // Group all pure running activities by Monday-start weeks
  const weekMap = {};
  allRuns.forEach(a => {
    if (!a.date || !a.is_pure_running) return;
    const monStr = getMondayStr(a.date);
    if (!weekMap[monStr]) {
      const sunStr = getSundayStr(monStr);
      const iso = getISOWeekInfo(monStr);
      const monParts = monStr.split('-');
      const sunParts = sunStr.split('-');
      const dateRangeStr = `${parseInt(monParts[1], 10)}/${parseInt(monParts[2], 10)}~${parseInt(sunParts[1], 10)}/${parseInt(sunParts[2], 10)}`;
      
      const curLang = (window.I18N && window.I18N.getLang) ? window.I18N.getLang() : 'ko';
      const isKo = (curLang === 'ko');
      const wName = isKo 
        ? `${iso.yearShort}년 ${iso.weekNo}주차 (${dateRangeStr})`
        : `'${iso.yearShort} W${iso.weekNo} (${dateRangeStr})`;

      weekMap[monStr] = {
        key: monStr,
        name: wName,
        weekNum: iso.weekNo,
        year: iso.fullYear,
        startDateStr: monStr,
        endDateStr: sunStr,
        runs: [],
        totalKm: 0,
        totalTimeSec: 0,
        efList: [],
        hrList: [],
        maxLsd: 0
      };
    }
    weekMap[monStr].runs.push(a);
    weekMap[monStr].totalKm += (a.distance_km || 0);
    weekMap[monStr].totalTimeSec += (a.duration_seconds || 0);
    if (a.ef > 0.5) weekMap[monStr].efList.push(a.ef);
    if (a.avg_hr > 60) weekMap[monStr].hrList.push(a.avg_hr);
    if ((a.distance_km || 0) > weekMap[monStr].maxLsd) weekMap[monStr].maxLsd = a.distance_km;
  });

  const allWeeksSorted = Object.values(weekMap).sort((a, b) => a.startDateStr.localeCompare(b.startDateStr));

  if (allWeeksSorted.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);"><i class="bi bi-calendar-x" style="font-size: 2.2rem; color: var(--accent-orange); display: block; margin-bottom: 0.6rem;"></i>등록된 주간 러닝 기록이 없습니다.</div>`;
    if (window.weeklyChartInstance) {
      window.weeklyChartInstance.destroy();
      window.weeklyChartInstance = null;
    }
    return;
  }

  // Calculate 4-week (28-day) Rolling Chronic Baseline & ACWR for every week
  allWeeksSorted.forEach((w) => {
    w.totalKm = Math.round(w.totalKm * 100) / 100;

    let prior28dKm = 0;
    const sDate = w.startDateStr;

    if (sDate && allRuns.length > 0) {
      const startDt = new Date(sDate + 'T00:00:00');
      if (!isNaN(startDt.getTime())) {
        const priorEndStr = new Date(startDt.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const priorStartStr = new Date(startDt.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        allRuns.forEach(r => {
          if (!r.is_pure_running) return;
          const d = (r.date || r.datetime || '').slice(0, 10);
          if (d >= priorStartStr && d <= priorEndStr) {
            prior28dKm += (r.distance_km || 0);
          }
        });
      }
    }

    let chronicAvg = prior28dKm / 4.0;
    if (chronicAvg === 0) {
      chronicAvg = w.totalKm;
    }

    w.chronicAvg = Math.round(chronicAvg * 10) / 10;
    const floorChronic = Math.max(w.chronicAvg, 10.0);
    const acwr = floorChronic > 0 ? (w.totalKm / floorChronic) : 1.0;
    const diffPct = Math.round((acwr - 1.0) * 100);
    w.acwr = Math.round(acwr * 100) / 100;
    w.diffPct = diffPct;

    // Realistic Sports Science ACWR Safety Rule
    if (w.totalKm < 15.0) {
      w.ruleKey = 'safe';
      w.ruleClass = 'rule-safe';
      w.ruleText = '안전 (기초 빌드업)';
      w.ruleShort = '안전';
      w.ruleIcon = 'bi-shield-check';
    } else if (acwr <= 1.15) {
      w.ruleKey = 'safe';
      w.ruleClass = 'rule-safe';
      w.ruleText = `안전 증량 (${diffPct >= 0 ? '+' : ''}${diffPct}%)`;
      w.ruleShort = '안전';
      w.ruleIcon = 'bi-shield-check';
    } else if (acwr <= 1.35) {
      w.ruleKey = 'warning';
      w.ruleClass = 'rule-warning';
      w.ruleText = `주의 (ACWR ${acwr.toFixed(2)}x)`;
      w.ruleShort = '주의';
      w.ruleIcon = 'bi-exclamation-triangle';
    } else if (acwr > 1.35) {
      w.ruleKey = 'danger';
      w.ruleClass = 'rule-danger';
      w.ruleText = `위험 급증 (ACWR ${acwr.toFixed(2)}x)`;
      w.ruleShort = '위험';
      w.ruleIcon = 'bi-fire';
    } else {
      w.ruleKey = 'detraining';
      w.ruleClass = 'rule-detraining';
      w.ruleText = '부하 감소';
      w.ruleShort = '감소';
      w.ruleIcon = 'bi-arrow-down';
    }

    w.avgEf = w.efList.length > 0 ? w.efList.reduce((a, b) => a + b, 0) / w.efList.length : 0;
    w.avgHr = w.hrList.length > 0 ? Math.round(w.hrList.reduce((a, b) => a + b, 0) / w.hrList.length) : 0;

    // 80/20 Polarized Breakdown
    const userTh = getCalculatedThresholds();
    let lowKm = 0, highKm = 0, lsdKm = 0;
    let lowCount = 0, highCount = 0, lsdCount = 0;

    (w.runs || []).forEach(r => {
      const wo = classifyWorkout(r, userTh, w.maxLsd);
      if (wo.type === 'lsd') {
        lsdKm += (r.distance_km || 0);
        lsdCount++;
      } else if (wo.type === 'high') {
        highKm += (r.distance_km || 0);
        highCount++;
      } else {
        lowKm += (r.distance_km || 0);
        lowCount++;
      }
    });

    const totK = (lowKm + highKm + lsdKm) || 1;
    w.lowRatio = Math.round(((lowKm + lsdKm) / totK) * 100);
    w.highRatio = 100 - w.lowRatio;
    w.lsdRatio = Math.round((lsdKm / totK) * 100);
    w.lowKm = lowKm + lsdKm;
    w.highKm = highKm;
    w.typeCounts = { low: lowCount, high: highCount, lsd: lsdCount };
    w.typeKm = { low: lowKm, high: highKm, lsd: lsdKm };
  });

  // Always show recent 4 completed/active Monday-start weeks
  const weeks = allWeeksSorted.slice(-4);
  const latestWeek = weeks[weeks.length - 1];

  // Expose latest chronic base for 7-Day Plan automatic target synchronization
  if (latestWeek) {
    window.LATEST_WEEK_CHRONIC_AVG = latestWeek.chronicAvg;
  }

  // Render Coaching Card for Latest Week
  const coachingCard = document.getElementById('weekly-coaching-card');
  if (coachingCard && latestWeek) {
    const low = latestWeek.lowRatio || 80;
    const high = latestWeek.highRatio || 20;

    const curLang = (window.I18N && window.I18N.getLang) ? window.I18N.getLang() : 'ko';
    const isKo = (curLang === 'ko');

    let badgeClass = 'green';
    let badgeText = isKo ? '✅ 안정적인 주간 트레이닝 밸런스' : '✅ Balanced Training Load';
    let coachingMsg = isKo
      ? `이번 주는 최근 4주 만성 베이스(주당 ${latestWeek.chronicAvg.toFixed(1)}km) 대비 <strong>${latestWeek.acwr.toFixed(2)}배</strong>의 적정 훈련 부하(${latestWeek.ruleShort})와 저강도 ${low}% : 고강도 ${high}%의 균형 잡힌 마일리지를 유지하고 있습니다.`
      : `Trailing 4-week chronic load (<strong>${latestWeek.chronicAvg.toFixed(1)} km/wk</strong>) maintains an optimal ACWR ratio of <strong>${latestWeek.acwr.toFixed(2)}x</strong> (${low}% Low : ${high}% High intensity).`;

    if (latestWeek.acwr > 1.5) {
      coachingMsg += `<br><br><span style="color:var(--accent-red);">⚠️ <strong>부상 위험 주의 (ACWR ${latestWeek.acwr.toFixed(2)}x)</strong>: 이번 주 훈련량(${latestWeek.totalKm.toFixed(1)}km)이 최근 4주 평균치(${latestWeek.chronicAvg.toFixed(1)}km)보다 50% 이상 급증했습니다. 관절과 건의 부상 예방을 위해 다음 주는 볼륨을 20~30% 낮추는 회복주를 권장합니다.</span>`;
    }

    // AI Coach Next Week Prescription Calculation
    let nextTargetKm = Math.round(latestWeek.totalKm * 1.07 * 10) / 10; // +7% progressive overload
    let prescriptionBadge = '📈 안전 점진 증량 (+7%)';
    let prescriptionNote = `이번 주(${latestWeek.totalKm.toFixed(1)}km) 훈련 부하가 안정적이므로 다음 주는 <strong>${nextTargetKm.toFixed(1)}km</strong>로 안전하게 증량하는 것을 권장합니다.`;

    if (latestWeek.acwr > 1.4 || high > 30) {
      nextTargetKm = Math.max(10, Math.round(latestWeek.totalKm * 0.85 * 10) / 10);
      prescriptionBadge = '🛡️ 회복 디로드 (-15%)';
      prescriptionNote = `피로 누적 및 고강도 비중을 감안하여 다음 주는 <strong>${nextTargetKm.toFixed(1)}km</strong>로 볼륨을 15% 줄여 관절과 인대를 초회복시키세요.`;
    } else if (latestWeek.totalKm < 10) {
      nextTargetKm = Math.round((latestWeek.totalKm + 3.0) * 10) / 10;
      prescriptionBadge = '🌱 유산소 베이스 확장';
      prescriptionNote = `기초 유산소 용량 확장을 위해 다음 주는 <strong>${nextTargetKm.toFixed(1)}km</strong> 목표를 권장합니다.`;
    }

    const recommendedDays = Math.min(5, Math.max(3, latestWeek.runs ? latestWeek.runs.length : 4));
    const rawLsd = latestWeek.maxLsd || (latestWeek.totalKm * 0.38);
    const lsdSteps = [5, 10, 15, 20, 25, 30];
    const recommendedLsd = lsdSteps.reduce((prev, curr) => Math.abs(curr - rawLsd) < Math.abs(prev - rawLsd) ? curr : prev, 10);

    coachingCard.innerHTML = `
      <div class="wcc-header">
        <div class="wcc-title">
          <i class="bi bi-robot text-cyan"></i>
          <span>${escapeHtml(latestWeek.name)} AI 스포츠 사이언스 코칭 리포트</span>
        </div>
        <span class="wcc-badge ${badgeClass}">${badgeText}</span>
      </div>
      <div class="wcc-ratio-wrap">
        <div class="wcc-ratio-labels">
          <span class="low-lbl"><i class="bi bi-shield-check"></i> 저강도 유산소·LSD (Zone 1~2): <strong>${low}%</strong> (${latestWeek.lowKm.toFixed(1)}km)</span>
          <span class="high-lbl"><i class="bi bi-fire"></i> 고강도 포인트 (Zone 3+): <strong>${high}%</strong> (${latestWeek.highKm.toFixed(1)}km)</span>
        </div>
        <div class="wcc-bar-container">
          <div class="wcc-bar-low" style="width: ${low}%;"></div>
          <div class="wcc-bar-high" style="width: ${high}%;"></div>
        </div>
      </div>
      <div class="wcc-coaching-text">
        ${coachingMsg}
      </div>

      <!-- AI Coach Next Week Prescription Box -->
      <div class="wcc-prescription-card">
        <div class="wpc-header">
          <div class="wpc-title"><i class="bi bi-calendar-check-fill text-orange"></i> AI 러닝 코치의 다음 주 처방</div>
          <span class="wpc-badge">${prescriptionBadge}</span>
        </div>
        <div class="wpc-note">${prescriptionNote}</div>
        <div class="wpc-metric-grid">
          <div class="wpc-metric-item">
            <span class="wpc-lbl">다음 주 권장 목표</span>
            <span class="wpc-val text-orange">${nextTargetKm.toFixed(1)} <small>KM</small></span>
          </div>
          <div class="wpc-metric-item">
            <span class="wpc-lbl">권장 훈련 횟수</span>
            <span class="wpc-val">주 ${recommendedDays}회</span>
          </div>
          <div class="wpc-metric-item">
            <span class="wpc-lbl">주말 롱런 상한선</span>
            <span class="wpc-val">${recommendedLsd} KM</span>
          </div>
        </div>
        <button type="button" class="btn-create-plan-from-weekly" id="btn-create-plan-from-weekly">
          <i class="bi bi-lightning-charge-fill"></i> 이 실측 분석 기반 다음 주 7-Day 맞춤 플랜 자동 생성
        </button>
      </div>
    `;
    coachingCard.style.display = 'block';

    // Bind one-click 7-Day Plan generator button
    const btnCreatePlan = document.getElementById('btn-create-plan-from-weekly');
    if (btnCreatePlan) {
      btnCreatePlan.onclick = () => {
        // 1. Fill Target KM in plan form
        const inputKm = document.getElementById('plan-target-km');
        if (inputKm) inputKm.value = nextTargetKm.toFixed(1);

        // 2. Select matching Days chip
        const daysBtns = document.querySelectorAll('#plan-days-group .plan-chip-btn');
        daysBtns.forEach(b => {
          if (parseInt(b.dataset.days) === recommendedDays) {
            b.click();
          }
        });

        // 3. Select matching LSD chip
        const lsdBtns = document.querySelectorAll('#plan-lsd-group .plan-chip-btn');
        lsdBtns.forEach(b => {
          if (parseInt(b.dataset.km) === recommendedLsd) {
            b.click();
          }
        });

        // 4. Switch to 7-Day Plan Tab
        const tabPlan = document.getElementById('tab-btn-plan');
        if (tabPlan) tabPlan.click();

        // 5. Trigger Plan Generation
        const btnGenerate = document.getElementById('btn-generate-plan');
        if (btnGenerate) {
          btnGenerate.click();
        }

        // 6. Smooth scroll to result
        setTimeout(() => {
          const resSec = document.getElementById('plan-result-section');
          if (resSec) resSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);

        if (typeof showToast === 'function') {
          showToast(`🤖 [${latestWeek.name}] 실측 데이터를 바탕으로 다음 주 7-Day 맞춤 플랜이 완성되었습니다!`);
        }
      };
    }
  } else if (coachingCard) {
    coachingCard.style.display = 'none';
  }

  // Render Weekly Cards
  if (weeks.length === 0) {
    const emptyMsg = isKo ? '선택된 기간에 주간 러닝 기록이 없습니다.' : 'No weekly running records found for the selected period.';
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">${emptyMsg}</div>`;
  } else {
    container.innerHTML = weeks.map(w => {
      let badgeLabel = w.ruleText;
      if (w.ruleClass === 'rule-safe') badgeLabel = _t('rule_safe', 'Safe');
      else if (w.ruleClass === 'rule-warning') badgeLabel = _t('rule_warning', 'Caution');
      else if (w.ruleClass === 'rule-danger') badgeLabel = _t('rule_danger', 'Danger');
      else if (w.ruleClass === 'rule-detraining') badgeLabel = _t('rule_detraining', 'Detraining');

      const runsTxt = _t('card_runs_summary', '{count} Runs').replace('{count}', w.runs.length);
      const lowTxt = _t('card_low_short', 'Low');
      const highTxt = _t('card_high_short', 'High');
      const countSuffix = isKo ? '회' : '';

      return `
      <div class="weekly-card">
        <div class="wc-header">
          <span class="wc-name">${w.name}</span>
          <span class="wc-runs">${runsTxt}</span>
        </div>
        <div class="wc-distance">${w.totalKm.toFixed(1)} <small>km</small></div>
        <div class="rule-badge ${w.ruleClass}">
          <i class="bi bi-shield-check"></i> ${badgeLabel}
        </div>
        <div class="wc-stats-list">
          <div class="wc-stat-row">
            <span>${isKo ? '평균 유산소 EF' : 'Avg Aerobic EF'}</span>
            <span style="color:var(--accent-lime);">${w.avgEf.toFixed(3)}</span>
          </div>
          <div class="wc-stat-row">
            <span>${isKo ? '최근 4주 평균 (베이스)' : '4-Week Base'}</span>
            <span style="color:var(--text-muted);">${w.chronicAvg > 0 ? w.chronicAvg.toFixed(1) + (isKo ? ' km/주' : ' km/wk') : '-'} (${w.acwr.toFixed(2)}x)</span>
          </div>
          <div class="wc-stat-row">
            <span>${isKo ? '최장 거리 (LSD)' : 'Longest LSD'}</span>
            <span>${w.maxLsd.toFixed(1)}km (${w.lsdRatio}%)</span>
          </div>
          <div class="wc-stat-row">
            <span>${isKo ? '평균 심박수' : 'Avg Heart Rate'}</span>
            <span>${w.avgHr} bpm</span>
          </div>
        </div>
        <div class="wc-mini-bar-wrap">
          <div class="wc-mini-bar-labels">
            <span>${isKo ? '80/20 훈련비율' : '80/20 Ratio'}</span>
            <span>${lowTxt} ${w.lowRatio}% : ${highTxt} ${w.highRatio}%</span>
          </div>
          <div class="wc-mini-bar">
            <div class="wc-mini-bar-low" style="width: ${w.lowRatio}%;"></div>
            <div class="wc-mini-bar-high" style="width: ${w.highRatio}%;"></div>
          </div>
        </div>
        <div class="wc-type-chips">
          ${w.typeCounts.low > 0 ? `<span class="wc-chip wc-chip-low">🟢 ${lowTxt} ${w.typeCounts.low}${countSuffix} (${w.typeKm.low.toFixed(1)}k)</span>` : ''}
          ${w.typeCounts.high > 0 ? `<span class="wc-chip wc-chip-high">🔴 ${highTxt} ${w.typeCounts.high}${countSuffix} (${w.typeKm.high.toFixed(1)}k)</span>` : ''}
          ${w.typeCounts.lsd > 0 ? `<span class="wc-chip wc-chip-lsd">🔵 LSD ${w.typeCounts.lsd}${countSuffix} (${w.typeKm.lsd.toFixed(1)}k)</span>` : ''}
        </div>
      </div>
    `;
    }).join('');
  }

  // Render Weekly Insta Card
  if (weeks.length > 0) {
    const latestWeek = weeks[weeks.length - 1];
    window.currentWeeklyRecap = latestWeek;
    try {
      renderWeeklyInstaCard(latestWeek);
    } catch (wCardErr) {
      console.error('Error rendering weekly insta card:', wCardErr);
    }
  }

  // Render Weekly Chart
  renderWeeklyChart(weeks);
}

function renderWeeklyInstaCard(w) {
  const card = document.getElementById('instaCardWeekly');
  if (!card || !w) return;

  // Header badge: e.g. "WEEK 36 RECAP"
  const badgeEl = document.getElementById('wc-card-badge');
  if (badgeEl) {
    badgeEl.textContent = `${(w.name || 'WEEK').toUpperCase()} RECAP`;
  }

  // Distance
  const distEl = document.getElementById('wc-card-dist');
  if (distEl) {
    distEl.innerHTML = `${(w.totalKm || 0).toFixed(1)} <span class="unit">KM</span>`;
  }

  // Runs & Rule Badge
  const runsRuleEl = document.getElementById('wc-card-runs-rule');
  if (runsRuleEl) {
    const runCount = (w.runs || []).length;
    const runsText = _t('card_runs_summary', '{count} Total Runs').replace('{count}', runCount);
    let ruleBadgeText = _t('rule_safe', 'Safe');
    if (w.ruleClass === 'rule-safe') ruleBadgeText = _t('rule_safe', 'Safe');
    else if (w.ruleClass === 'rule-warning') ruleBadgeText = _t('rule_warning', 'Caution');
    else if (w.ruleClass === 'rule-danger') ruleBadgeText = _t('rule_danger', 'Danger');
    else if (w.ruleClass === 'rule-detraining') ruleBadgeText = _t('rule_detraining', 'Detraining');

    runsRuleEl.innerHTML = `${runsText} &middot; <span class="rule-badge ${w.ruleClass || 'rule-safe'}" id="wc-card-rule-badge" style="margin-bottom:0; padding:0.15rem 0.45rem; font-size:0.65rem;">${ruleBadgeText}</span>`;
  }

  // Key Stats: Avg EF, Longest LSD, Avg HR, 4-Week Base
  const efEl = document.getElementById('wc-card-ef');
  if (efEl) {
    efEl.textContent = (w.avgEf || 0).toFixed(3);
  }

  const lsdEl = document.getElementById('wc-card-lsd');
  if (lsdEl) {
    lsdEl.innerHTML = `${(w.longestRun || 0).toFixed(1)} <small>km</small>`;
  }

  const hrEl = document.getElementById('wc-card-hr');
  if (hrEl) {
    hrEl.innerHTML = `${w.avgHr || 0} <small>bpm</small>`;
  }

  const baseEl = document.getElementById('wc-card-base');
  if (baseEl) {
    baseEl.innerHTML = `${(w.chronicAvg || 0).toFixed(1)} <small>km (${(w.acwr || 1).toFixed(2)}x)</small>`;
  }

  // Workout Breakdown Chips
  const chipsEl = document.getElementById('wc-card-chips');
  if (chipsEl && w.typeCounts) {
    const chipItems = [];
    const lowTxt = _t('card_low_short', 'Low');
    const highTxt = _t('card_high_short', 'High');
    const curLang = (window.I18N && window.I18N.getLang) ? window.I18N.getLang() : 'ko';
    const countSuffix = curLang === 'ko' ? '회' : '';
    if (w.typeCounts.low > 0) chipItems.push(`<span class="badge-count badge-wo-low">🟢 ${lowTxt} ${w.typeCounts.low}${countSuffix}</span>`);
    if (w.typeCounts.high > 0) chipItems.push(`<span class="badge-count badge-wo-high">🔴 ${highTxt} ${w.typeCounts.high}${countSuffix}</span>`);
    if (w.typeCounts.lsd > 0) chipItems.push(`<span class="badge-count badge-wo-lsd">🔵 LSD ${w.typeCounts.lsd}${countSuffix}</span>`);
    chipsEl.innerHTML = chipItems.join(' ');
  }

  // 80/20 Polarized single-line bar
  const lowBar = document.getElementById('wc-card-pol-bar-low');
  const highBar = document.getElementById('wc-card-pol-bar-high');
  const polVal = document.getElementById('wc-card-pol-val');
  const low = (typeof w.lowRatio === 'number') ? w.lowRatio : 80;
  const high = (typeof w.highRatio === 'number') ? w.highRatio : 20;

  if (lowBar) lowBar.style.width = `${low}%`;
  if (highBar) highBar.style.width = `${high}%`;
  if (polVal) {
    const lowTxt = _t('card_low_short', 'Low');
    const highTxt = _t('card_high_short', 'High');
    polVal.innerHTML = `<span style="color:var(--accent-lime);">${lowTxt} ${low}%</span> : <span style="color:var(--accent-orange);">${highTxt} ${high}%</span>`;
  }
}

function renderWeeklyChart(weeks) {
  const canvas = document.getElementById('weeklyChart');
  if (!canvas) return;

  if (window.weeklyChartInstance) {
    try {
      window.weeklyChartInstance.destroy();
    } catch (e) {}
    window.weeklyChartInstance = null;
  }

  // Clean stale styles
  canvas.removeAttribute('style');
  canvas.removeAttribute('width');
  canvas.removeAttribute('height');

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const labels = weeks.map(w => w.name);
  const mileageData = weeks.map(w => w.totalKm);
  const efData = weeks.map(w => w.avgEf);

  window.weeklyChartInstance = new Chart(ctx, {
    data: {
      labels: labels,
      datasets: [
        {
          type: 'bar',
          label: '주간 마일리지 (km)',
          data: mileageData,
          backgroundColor: 'rgba(255, 87, 34, 0.65)',
          borderColor: '#ff5722',
          borderWidth: 1,
          borderRadius: 8,
          yAxisID: 'yDist'
        },
        {
          type: 'line',
          label: '평균 심폐효율 (EF)',
          data: efData,
          borderColor: '#00ff87',
          backgroundColor: '#00ff87',
          borderWidth: 2.5,
          tension: 0.3,
          pointRadius: 4,
          yAxisID: 'yEf'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 50,
      plugins: {
        legend: {
          labels: {
            color: '#94a3b8',
            boxWidth: 12,
            padding: 8,
            font: { family: 'Outfit', size: 11 }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: '#64748b',
            maxTicksLimit: 8,
            maxRotation: 0,
            autoSkip: true,
            font: { family: 'Outfit', size: 10 }
          }
        },
        yDist: {
          type: 'linear',
          position: 'left',
          min: 0,
          ticks: { color: '#ff5722', font: { family: 'Outfit', size: 10 } }
        },
        yEf: {
          type: 'linear',
          position: 'right',
          min: 0.5,
          max: 1.6,
          grid: { drawOnChartArea: false },
          ticks: { color: '#00ff87', font: { family: 'Outfit', size: 10 } }
        }
      }
    }
  });

  requestAnimationFrame(() => {
    if (window.weeklyChartInstance) {
      window.weeklyChartInstance.resize();
    }
  });
  setTimeout(() => {
    if (window.weeklyChartInstance) {
      window.weeklyChartInstance.resize();
    }
  }, 150);
}


/* ==========================================================================
   MODULE 3: MONTHLY RECAP & INSTA CARD
   ========================================================================== */
function initMonthlyRecap(activities, year, month) {
  const totalDist = activities.reduce((acc, a) => acc + a.distance_km, 0);
  const totalSec = activities.reduce((acc, a) => acc + a.duration_seconds, 0);
  const totalCal = activities.reduce((acc, a) => acc + a.calories, 0);

  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);

  const validPaces = activities.filter(a => a.pace_seconds > 0);
  const avgPaceSec = validPaces.length ? validPaces.reduce((acc, a) => acc + a.pace_seconds, 0) / validPaces.length : 0;
  const pMin = Math.floor(avgPaceSec / 60);
  const pSec = Math.round(avgPaceSec % 60);
  const avgPaceStr = `${pMin}'${pSec < 10 ? '0' : ''}${pSec}"`;

  const validHrs = activities.filter(a => a.avg_hr > 60);
  const avgHr = validHrs.length ? Math.round(validHrs.reduce((acc, a) => acc + a.avg_hr, 0) / validHrs.length) : 0;

  const validEfs = activities.filter(a => a.ef > 0.5);
  const avgEf = validEfs.length ? (validEfs.reduce((acc, a) => acc + a.ef, 0) / validEfs.length) : 0;
  let minEf = 0;
  let maxEf = 0;
  if (validEfs.length > 0) {
    const efVals = validEfs.map(a => a.ef);
    minEf = Math.min(...efVals);
    maxEf = Math.max(...efVals);
  }

  // EF Growth rate (first half vs second half of the period)
  let efGrowthPct = 0;
  if (validEfs.length >= 4) {
    const half = Math.floor(validEfs.length / 2);
    const ef1 = validEfs.slice(0, half).reduce((acc, a) => acc + a.ef, 0) / half;
    const ef2 = validEfs.slice(half).reduce((acc, a) => acc + a.ef, 0) / (validEfs.length - half);
    if (ef1 > 0) efGrowthPct = ((ef2 - ef1) / ef1) * 100;
  }

  // Find LSD
  let maxLsd = 0;
  let lsdAct = null;
  activities.forEach(a => {
    if (a.distance_km > maxLsd) {
      maxLsd = a.distance_km;
      lsdAct = a;
    }
  });

  // Period title text
  let periodTitle = '';
  let engPeriodTitle = '';
  if (year === 'all') {
    periodTitle = month === 'all' ? '역대 전체' : `역대 ${month}월`;
    engPeriodTitle = month === 'all' ? 'ALL-TIME RUNNING RECAP' : `ALL-TIME ${getMonthName(month).toUpperCase()} RECAP`;
  } else {
    periodTitle = month === 'all' ? `${year}년 전체` : `${year}년 ${month}월`;
    engPeriodTitle = month === 'all' ? `YEAR ${year} RUNNING RECAP` : `${getMonthName(month).toUpperCase()} ${year} RUNNING RECAP`;
  }

  const curLang = (window.I18N && window.I18N.getLang) ? window.I18N.getLang() : 'ko';
  const isKo = (curLang === 'ko');

  // Update Monthly Dashboard Labels
  const elLabelDist = document.getElementById('month-label-dist');
  if (elLabelDist) elLabelDist.textContent = isKo ? `${periodTitle} 총 마일리지` : `${engPeriodTitle} Distance`;
  const elLabelTime = document.getElementById('month-label-time');
  if (elLabelTime) elLabelTime.textContent = isKo ? `${periodTitle} 총 러닝 시간` : `${engPeriodTitle} Time`;
  const elLabelPace = document.getElementById('month-label-pace');
  if (elLabelPace) elLabelPace.textContent = isKo ? `${periodTitle} 평균 페이스` : `${engPeriodTitle} Avg Pace`;

  // Update Monthly Dashboard Cards
  const elDist = document.getElementById('month-total-dist');
  if (elDist) elDist.innerHTML = `${totalDist.toFixed(1)} <small>km</small>`;
  const elCount = document.getElementById('month-run-count');
  if (elCount) elCount.textContent = isKo ? `총 ${activities.length}회 러닝 완료` : `${activities.length} Runs Completed`;
  const elTime = document.getElementById('month-total-time');
  if (elTime) elTime.innerHTML = `${hours}<small>h</small> ${minutes}<small>m</small>`;
  const elCal = document.getElementById('month-total-cal');
  if (elCal) elCal.textContent = isKo ? `${totalCal.toLocaleString()} kcal 소모` : `${totalCal.toLocaleString()} kcal burned`;
  const elPace = document.getElementById('month-avg-pace');
  if (elPace) elPace.innerHTML = `${avgPaceStr} <small>/km</small>`;
  const elHr = document.getElementById('month-avg-hr');
  if (elHr) elHr.textContent = isKo ? `평균 심박수 ${avgHr} bpm` : `Avg HR ${avgHr} bpm`;
  const elGrowth = document.getElementById('month-ef-growth');
  if (elGrowth) elGrowth.textContent = `${efGrowthPct >= 0 ? '+' : ''}${efGrowthPct.toFixed(1)}%`;

  // Update Insta Card
  const cardBadge = document.querySelector('#instaCard .ic-badge');
  if (cardBadge) cardBadge.textContent = engPeriodTitle;

  document.getElementById('card-dist').innerHTML = `${totalDist.toFixed(1)} <span class="unit">KM</span>`;
  document.getElementById('card-runs').innerHTML = `${activities.length} <small>${_t('card_runs_unit', 'Runs')}</small>`;
  document.getElementById('card-pace').textContent = avgPaceStr;
  document.getElementById('card-time').textContent = `${hours}h ${minutes}m`;
  document.getElementById('card-hr').innerHTML = `${avgHr} <small>bpm</small>`;
  document.getElementById('card-lsd').textContent = `${maxLsd.toFixed(1)} km (${lsdAct?.date?.slice(5) || '-'})`;
  document.getElementById('card-ef').textContent = `${avgEf.toFixed(3)} (${efGrowthPct >= 0 ? '+' : ''}${efGrowthPct.toFixed(1)}%)`;

  const elCardEfRange = document.getElementById('card-ef-range');
  if (elCardEfRange) {
    if (validEfs.length > 0) {
      elCardEfRange.innerHTML = `<i class="bi bi-activity"></i> AEROBIC EF: MIN ${minEf.toFixed(3)} — MAX ${maxEf.toFixed(3)}`;
    } else {
      elCardEfRange.innerHTML = `<i class="bi bi-activity"></i> AEROBIC EF: DATA ANALYZING`;
    }
  }

  // 80/20 Polarized Monthly Ratio Calculation for Insta Card
  let monthLowKm = 0;
  let monthHighKm = 0;
  activities.forEach(a => {
    if (!a.is_pure_running) return;
    const wo = classifyWorkout(a);
    if (wo.intensity === 'high') {
      monthHighKm += (a.distance_km || 0);
    } else {
      monthLowKm += (a.distance_km || 0);
    }
  });

  const monthRunningKm = monthLowKm + monthHighKm;
  const monthLowRatio = monthRunningKm > 0 ? Math.round((monthLowKm / monthRunningKm) * 100) : 100;
  const monthHighRatio = 100 - monthLowRatio;

  const elPolTag = document.getElementById('card-pol-tag');
  if (elPolTag) elPolTag.textContent = _t('card_pol_tag', '80/20 POLARIZED');

  const elPolBarLow = document.getElementById('card-pol-bar-low');
  if (elPolBarLow) elPolBarLow.style.width = `${monthLowRatio}%`;

  const elPolBarHigh = document.getElementById('card-pol-bar-high');
  if (elPolBarHigh) elPolBarHigh.style.width = `${monthHighRatio}%`;

  const elPolVal = document.getElementById('card-pol-val');
  if (elPolVal) {
    const lowLabel = _t('card_low_short', '저강도');
    const highLabel = _t('card_high_short', '고강도');
    elPolVal.innerHTML = `<span style="color:var(--accent-lime);">${lowLabel} ${monthLowRatio}%</span> <span style="color:var(--text-muted);">:</span> <span style="color:var(--accent-orange);">${highLabel} ${monthHighRatio}%</span>`;
  }

  // Dynamic Weekly Sparklines & Integer Distance Labels (W1~W5)
  const weeklyDists = [0, 0, 0, 0, 0];
  activities.forEach(a => {
    if (!a.date) return;
    const parts = a.date.split('-');
    if (parts.length < 3) return;
    const day = parseInt(parts[2], 10);
    if (isNaN(day)) return;
    const wIdx = Math.min(Math.floor((day - 1) / 7), 4);
    weeklyDists[wIdx] += (a.distance_km || 0);
  });

  const maxWeekly = Math.max(...weeklyDists, 1);
  weeklyDists.forEach((d, idx) => {
    const bar = document.getElementById(`c-bar-${idx + 1}`);
    const valEl = document.getElementById(`c-val-${idx + 1}`);
    const intDist = Math.floor(d); // Truncate decimals to integer
    if (valEl) {
      valEl.textContent = intDist > 0 ? `${intDist}k` : '-';
    }
    if (bar) {
      const pct = d > 0 ? Math.max(14, Math.round((d / maxWeekly) * 100)) : 6;
      bar.style.height = `${pct}%`;
    }
  });

  // Store monthly state for card download / sharing
  window.currentMonthlyYear = year;
  window.currentMonthlyMonth = month;
  window.currentMonthlyPeriodTitle = periodTitle;
}

/* ==========================================================================
   MODULE 4: MULTI-VIEW INSTAGRAM CARD STUDIO (DAILY, WEEKLY, MONTHLY)
   ========================================================================== */
function initCardStudioController({
  containerSelector,
  cardId,
  btnShareId,
  btnDownloadId,
  getDownloadFilename,
  getShareMeta
}) {
  const container = document.querySelector(containerSelector);
  const card = document.getElementById(cardId);
  const btnShare = document.getElementById(btnShareId);
  const btnDownload = document.getElementById(btnDownloadId);

  if (!card || !container) return;

  let currentFormat = 'story'; // 'story', 'square', 'portrait'
  let currentTheme = 'dark';   // 'dark', 'green', 'neon', 'minimal', 'hud'
  let uploadedBgUrl = null;

  function updateAppearance() {
    card.className = `insta-card theme-${currentTheme} format-${currentFormat}`;
    if (btnShare) {
      if (currentFormat === 'story') {
        btnShare.innerHTML = `<i class="bi bi-instagram"></i> 스토리 공유`;
      } else {
        btnShare.innerHTML = `<i class="bi bi-share-fill"></i> 피드 공유`;
      }
    }
  }

  // Format Switchers scoped to container
  const formatBtns = container.querySelectorAll('.btn-format-chip');
  formatBtns.forEach(btn => {
    btn.onclick = () => {
      formatBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFormat = btn.dataset.format || 'story';
      updateAppearance();
    };
  });

  // Theme Switchers scoped to container
  const themeBtns = container.querySelectorAll('.btn-theme-chip');
  themeBtns.forEach(btn => {
    btn.onclick = () => {
      themeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTheme = btn.dataset.theme || 'dark';

      if (currentTheme === 'hud') {
        if (uploadedBgUrl) {
          card.style.backgroundImage = `url("${uploadedBgUrl}")`;
          if (btnClearPhoto) btnClearPhoto.style.display = 'inline-flex';
        }
      } else {
        card.style.backgroundImage = '';
      }
      updateAppearance();
    };
  });

  // Photo Upload & Clear Logic for HUD Background
  const photoInput = container.querySelector('.card-bg-input');
  const btnUploadPhoto = container.querySelector('.btn-photo-upload');
  const btnClearPhoto = container.querySelector('.btn-photo-clear');

  if (btnUploadPhoto && photoInput) {
    btnUploadPhoto.onclick = () => {
      photoInput.click();
    };
  }

  if (photoInput) {
    photoInput.onchange = () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        uploadedBgUrl = e.target.result;
        card.style.backgroundImage = `url("${uploadedBgUrl}")`;
        currentTheme = 'hud';
        themeBtns.forEach(b => b.classList.toggle('active', b.dataset.theme === 'hud'));
        if (btnClearPhoto) btnClearPhoto.style.display = 'inline-flex';
        updateAppearance();
      };
      reader.readAsDataURL(file);
    };
  }

  if (btnClearPhoto) {
    btnClearPhoto.onclick = () => {
      uploadedBgUrl = null;
      card.style.backgroundImage = '';
      if (photoInput) photoInput.value = '';
      btnClearPhoto.style.display = 'none';
      currentTheme = 'dark';
      themeBtns.forEach(b => b.classList.toggle('active', b.dataset.theme === 'dark'));
      updateAppearance();
    };
  }

  async function generateCanvas() {
    if (typeof html2canvas !== 'function') {
      throw new Error('html2canvas library is not loaded');
    }
    return await html2canvas(card, {
      scale: 3,
      useCORS: true,
      backgroundColor: null
    });
  }

  function triggerDownload(canvas) {
    const link = document.createElement('a');
    const formatSuffix = currentFormat === 'square' ? '1x1' : (currentFormat === 'portrait' ? '4x5' : '9x16');
    link.download = getDownloadFilename ? getDownloadFilename(formatSuffix) : `RunAnalyz_${formatSuffix}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  if (btnShare) {
    btnShare.onclick = async () => {
      const origHtml = btnShare.innerHTML;
      btnShare.innerHTML = `<i class="bi bi-hourglass-split"></i> 생성 중...`;
      btnShare.disabled = true;

      try {
        const canvas = await generateCanvas();

        if (navigator.canShare) {
          canvas.toBlob(async (blob) => {
            if (!blob) {
              triggerDownload(canvas);
              resetShareBtn();
              return;
            }
            const meta = getShareMeta ? getShareMeta(currentFormat) : { filename: `RunAnalyz_${currentFormat}.png`, title: 'RunAnalyz', text: 'RunAnalyz' };
            const file = new File([blob], meta.filename, { type: 'image/png' });
            if (navigator.canShare({ files: [file] })) {
              try {
                await navigator.share({
                  files: [file],
                  title: meta.title,
                  text: meta.text
                });
                btnShare.innerHTML = `<i class="bi bi-check-circle-fill"></i> 공유 완료!`;
              } catch (shareErr) {
                if (shareErr.name !== 'AbortError') {
                  triggerDownload(canvas);
                  btnShare.innerHTML = `<i class="bi bi-check-circle-fill"></i> 저장 완료!`;
                } else {
                  btnShare.innerHTML = origHtml;
                  btnShare.disabled = false;
                  return;
                }
              }
            } else {
              triggerDownload(canvas);
              btnShare.innerHTML = `<i class="bi bi-check-circle-fill"></i> 저장 완료!`;
            }
            resetShareBtn();
          }, 'image/png');
        } else {
          triggerDownload(canvas);
          btnShare.innerHTML = `<i class="bi bi-check-circle-fill"></i> 저장 완료!`;
          resetShareBtn();
        }
      } catch (err) {
        console.error('Card export error:', err);
        alert('카드 이미지 생성 중 오류가 발생했습니다.');
        resetShareBtn();
      }

      function resetShareBtn() {
        setTimeout(() => {
          btnShare.innerHTML = origHtml;
          btnShare.disabled = false;
        }, 2000);
      }
    };
  }

  if (btnDownload) {
    btnDownload.onclick = async () => {
      const origHtml = btnDownload.innerHTML;
      btnDownload.innerHTML = `<i class="bi bi-hourglass-split"></i>`;
      btnDownload.disabled = true;

      try {
        const canvas = await generateCanvas();
        triggerDownload(canvas);
        btnDownload.innerHTML = `<i class="bi bi-check-circle-fill"></i>`;
      } catch (err) {
        console.error('Download error:', err);
        alert('카드 이미지 저장 중 오류가 발생했습니다.');
      } finally {
        setTimeout(() => {
          btnDownload.innerHTML = origHtml;
          btnDownload.disabled = false;
        }, 2000);
      }
    };
  }
}

let allStudiosInitialized = false;

function initAllCardStudios() {
  if (allStudiosInitialized) return;
  allStudiosInitialized = true;

  // 1. Single Session Studio
  initCardStudioController({
    containerSelector: '#single-card-studio-section',
    cardId: 'instaCardSingle',
    btnShareId: 'btn-share-single-card',
    btnDownloadId: 'btn-download-single-card',
    getDownloadFilename: (fmt) => {
      const act = window.currentSingleAct;
      const dateStr = (act && (act.date || act.start_date_local)) ? (act.date || act.start_date_local).slice(0, 10) : new Date().toISOString().slice(0, 10);
      return `RunAnalyz_Daily_${dateStr}_${fmt}.png`;
    },
    getShareMeta: (fmt) => {
      const act = window.currentSingleAct;
      const dateStr = (act && (act.date || act.start_date_local)) ? (act.date || act.start_date_local).slice(0, 10) : new Date().toISOString().slice(0, 10);
      const fmtTitle = fmt === 'square' ? '피드 정방형 (1:1)' : (fmt === 'portrait' ? '피드 세로형 (4:5)' : '스토리 (9:16)');
      return {
        filename: `RunAnalyz_Daily_${dateStr}_${fmt}.png`,
        title: `RunAnalyz 데일리 러닝 기록 (${dateStr})`,
        text: `RunAnalyz 데일리 러닝 기록 카드(${fmtTitle})입니다.`
      };
    }
  });

  // 2. Weekly Recap Studio
  initCardStudioController({
    containerSelector: '#weekly-card-studio-section',
    cardId: 'instaCardWeekly',
    btnShareId: 'btn-share-weekly-card',
    btnDownloadId: 'btn-download-weekly-card',
    getDownloadFilename: (fmt) => {
      const w = window.currentWeeklyRecap;
      const wName = (w && w.name) ? w.name.replace(/\s+/g, '_') : 'Weekly';
      return `RunAnalyz_${wName}_${fmt}.png`;
    },
    getShareMeta: (fmt) => {
      const w = window.currentWeeklyRecap;
      const wName = (w && w.name) ? w.name : '주간';
      const fmtTitle = fmt === 'square' ? '피드 정방형 (1:1)' : (fmt === 'portrait' ? '피드 세로형 (4:5)' : '스토리 (9:16)');
      return {
        filename: `RunAnalyz_${wName}_${fmt}.png`,
        title: `RunAnalyz ${wName} 러닝 결산 (${fmtTitle})`,
        text: `RunAnalyz 주간 트레이닝 밸런스 & 80/20 결산 카드(${fmtTitle})입니다.`
      };
    }
  });

  // 3. Monthly Recap Studio
  initCardStudioController({
    containerSelector: '#monthly-card-studio-section',
    cardId: 'instaCard',
    btnShareId: 'btn-share-card',
    btnDownloadId: 'btn-download-card',
    getDownloadFilename: (fmt) => {
      const y = window.currentMonthlyYear || '2026';
      const m = window.currentMonthlyMonth || '8';
      return `RunAnalyz_Recap_${y}_${m}_${fmt}.png`;
    },
    getShareMeta: (fmt) => {
      const y = window.currentMonthlyYear || '2026';
      const m = window.currentMonthlyMonth || '8';
      const pTitle = window.currentMonthlyPeriodTitle || `${y}년 ${m}월`;
      const fmtTitle = fmt === 'square' ? '피드 정방형 (1:1)' : (fmt === 'portrait' ? '피드 세로형 (4:5)' : '스토리 (9:16)');
      return {
        filename: `RunAnalyz_Recap_${y}_${m}_${fmt}.png`,
        title: `RunAnalyz ${pTitle} 러닝 결산 (${fmtTitle})`,
        text: `RunAnalyz 러닝 대시보드에서 생성된 ${pTitle} 러닝 결산 카드(${fmtTitle})입니다.`
      };
    }
  });
}

function getMonthName(m) {
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const idx = parseInt(m, 10) - 1;
  return names[idx] || "Month";
}

/* ==========================================================================
   MODULE 4: YEARLY RECAP & SHOE TRACKER (RunAnalyz Core)
   ========================================================================== */
function initYearlyRecap(archive, pureRunningActivities) {
  const cardsContainer = document.getElementById('yearly-cards-list');
  const shoeContainer = document.getElementById('shoe-list-container');
  if (!cardsContainer) return;

  const yearlySummary = archive?.metadata?.yearly_summary || {};
  const years = Object.keys(yearlySummary).sort().filter(y => yearlySummary[y].running_sessions > 0);

  // 1. Render Yearly Cards
  cardsContainer.innerHTML = years.map(y => {
    const s = yearlySummary[y];
    return `
      <div class="yearly-card">
        <div class="yc-year">${y}년 러닝</div>
        <div class="yc-distance">${s.total_running_km.toFixed(1)} <small>km</small></div>
        <div class="yc-metrics-row">
          <div class="yc-metric-item">
            <span>러닝 세션</span>
            <strong>${s.running_sessions}회</strong>
          </div>
          <div class="yc-metric-item">
            <span>평균 유산소 EF</span>
            <strong style="color:var(--accent-lime);">${s.avg_ef.toFixed(3)}</strong>
          </div>
          <div class="yc-metric-item">
            <span>최장 거리 (LSD)</span>
            <span>${s.max_lsd_km.toFixed(1)} km</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 2. Render Yearly Chart (Mileage Bar + EF Line)
  renderYearlyChart(years, yearlySummary);

  // 3. Render Shoe Lifespan & Mileage Tracker (Optional)
  if (shoeContainer) {
    const shoeMap = {};
    pureRunningActivities.forEach(a => {
      const gName = a.gear_name || "미지정";
      if (!shoeMap[gName]) {
        shoeMap[gName] = { name: gName, totalKm: 0, count: 0, avgPaceSec: 0, paces: [] };
      }
      shoeMap[gName].totalKm += a.distance_km;
      shoeMap[gName].count += 1;
      if (a.pace_seconds > 0) shoeMap[gName].paces.push(a.pace_seconds);
    });

    const sortedShoes = Object.values(shoeMap).sort((a, b) => b.totalKm - a.totalKm);

    shoeContainer.innerHTML = sortedShoes.map(s => {
      const km = Math.round(s.totalKm * 10) / 10;
      const maxLife = 800.0; // 800km standard shoe lifespan
      const pct = Math.min(Math.round((km / maxLife) * 100), 100);

      let barColor = 'var(--accent-lime)';
      let statusBadge = `<span style="color:var(--accent-lime);">정상 주행 (${pct}%)</span>`;

      if (km >= 800) {
        barColor = 'var(--accent-red)';
        statusBadge = `<span style="color:var(--accent-red);">⚠️ 수명 도달/은퇴 (${km}km)</span>`;
      } else if (km >= 600) {
        barColor = 'var(--accent-orange)';
        statusBadge = `<span style="color:var(--accent-orange);">교체 권장 (${pct}%)</span>`;
      }

      return `
        <div class="shoe-item-card">
          <div class="shoe-header">
            <span class="shoe-name">👟 ${s.name}</span>
            <span class="shoe-dist">${km} km</span>
          </div>
          <div class="shoe-progress-track">
            <div class="shoe-progress-bar" style="width: ${pct}%; background: ${barColor};"></div>
          </div>
          <div class="shoe-footer">
            <span>총 ${s.count}회 착용</span>
            ${statusBadge}
          </div>
        </div>
      `;
    }).join('');
  }
}

function renderYearlyChart(years, summary) {
  const canvas = document.getElementById('yearlyChart');
  if (!canvas) return;

  if (window.yearlyChartInstance) {
    try {
      window.yearlyChartInstance.destroy();
    } catch (e) {}
    window.yearlyChartInstance = null;
  }

  // Clean stale styles
  canvas.removeAttribute('style');
  canvas.removeAttribute('width');
  canvas.removeAttribute('height');

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const labels = years.map(y => `${y}년`);
  const mileages = years.map(y => summary[y].total_running_km);
  const efs = years.map(y => summary[y].avg_ef);

  window.yearlyChartInstance = new Chart(ctx, {
    data: {
      labels: labels,
      datasets: [
        {
          type: 'bar',
          label: '연간 총 마일리지 (km)',
          data: mileages,
          backgroundColor: 'rgba(255, 87, 34, 0.7)',
          borderColor: '#ff5722',
          borderWidth: 1,
          borderRadius: 8,
          yAxisID: 'yDist'
        },
        {
          type: 'line',
          label: '평균 심폐효율 (EF)',
          data: efs,
          borderColor: '#00f2fe',
          backgroundColor: '#00f2fe',
          borderWidth: 3,
          tension: 0.3,
          pointRadius: 6,
          pointHoverRadius: 8,
          yAxisID: 'yEf'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 50,
      plugins: {
        legend: {
          labels: {
            color: '#94a3b8',
            boxWidth: 12,
            padding: 8,
            font: { family: 'Outfit', size: 11 }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: '#64748b',
            maxTicksLimit: 8,
            maxRotation: 0,
            autoSkip: true,
            font: { family: 'Outfit', size: 10 }
          }
        },
        yDist: {
          type: 'linear',
          position: 'left',
          min: 0,
          ticks: { color: '#ff5722', font: { family: 'Outfit', size: 10 } }
        },
        yEf: {
          type: 'linear',
          position: 'right',
          min: 0.7,
          max: 1.5,
          grid: { drawOnChartArea: false },
          ticks: { color: '#00f2fe', font: { family: 'Outfit', size: 10 } }
        }
      }
    }
  });

  requestAnimationFrame(() => {
    if (window.yearlyChartInstance) {
      window.yearlyChartInstance.resize();
    }
  });
  setTimeout(() => {
    if (window.yearlyChartInstance) {
      window.yearlyChartInstance.resize();
    }
  }, 150);
}


// Google Encoded Polyline Decoder (Decodes summary_polyline into [lat, lng] array)
function decodePolyline(str, precision = 5) {
  if (!str) return [];
  let index = 0, lat = 0, lng = 0, coordinates = [];
  const factor = Math.pow(10, precision);
  while (index < str.length) {
    let byte = null, shift = 0, result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    shift = result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += latitude_change;
    lng += longitude_change;
    coordinates.push([lat / factor, lng / factor]);
  }
  return coordinates;
}

/* ==========================================================================
   MODULE 5: RUNNING HEATMAP (GPS TRACKS OVERLAY)
   ========================================================================== */
function initRunningHeatmap(activities) {
  const mapContainer = document.getElementById('runningHeatmap');
  if (!mapContainer) return;

  let currentHmSportFilter = 'running'; // 'running' (default) or 'all'
  let currentTrackColor = '#ff5722';
  let polylineLayers = [];
  let allBounds = null;

  function getHeatmapActivities() {
    let list = activities;
    // Filter by global period filter
    if (currentYear !== 'all') {
      list = list.filter(a => a.year == currentYear);
    }
    if (currentMonth !== 'all') {
      list = list.filter(a => a.month == currentMonth);
    }

    return list.filter(a => {
      if (!a.has_gps) return false;
      if (currentHmSportFilter === 'running' && !a.is_pure_running) return false;
      if ((!a.gps_points || a.gps_points.length === 0) && a.summary_polyline) {
        a.gps_points = decodePolyline(a.summary_polyline);
      }
      return a.gps_points && a.gps_points.length >= 2;
    });
  }

  // Initialize Leaflet Map once
  if (!window.leafletMap) {
    window.leafletMap = L.map('runningHeatmap', {
      center: [37.669, 127.304],
      zoom: 14,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      subdomains: ['a', 'b', 'c'],
      maxZoom: 19
    }).addTo(window.leafletMap);
  }

  function drawTracks(color, targetActs) {
    polylineLayers.forEach(l => window.leafletMap.removeLayer(l));
    polylineLayers = [];

    const boundsList = [];

    targetActs.forEach((act) => {
      const latlngs = act.gps_points;
      if (!latlngs || latlngs.length < 2) return;

      // Glow effect line
      const glowLine = L.polyline(latlngs, {
        color: color,
        weight: 8,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(window.leafletMap);

      // Core neon line
      const coreLine = L.polyline(latlngs, {
        color: '#ffffff',
        weight: 2.5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(window.leafletMap);

      const popupHtml = `
        <div class="map-popup-card">
          <h4>${act.date} (${act.time})</h4>
          <p><strong>${act.sport_label}</strong> &bull; ${act.distance_km} km</p>
          <div class="stats-row">
            <span>페이스: <strong>${act.pace_formatted}</strong></span>
            <span>심박: <strong>${act.avg_hr} bpm</strong></span>
            ${act.is_pure_running ? `<span>EF: <strong>${act.ef}</strong></span>` : ''}
          </div>
        </div>
      `;
      coreLine.bindPopup(popupHtml);
      glowLine.bindPopup(popupHtml);

      polylineLayers.push(glowLine);
      polylineLayers.push(coreLine);

      boundsList.push(glowLine.getBounds());
    });

    if (boundsList.length > 0) {
      allBounds = boundsList[0];
      for (let i = 1; i < boundsList.length; i++) {
        allBounds.extend(boundsList[i]);
      }
      window.heatmapAllBounds = allBounds;
      
      const panel = document.getElementById('panel-heatmap');
      if (panel && panel.classList.contains('active')) {
        window.leafletMap.fitBounds(allBounds, { padding: [40, 40], maxZoom: 16 });
      }
    } else {
      window.heatmapAllBounds = null;
    }
  }

  function updateHeatmapDisplay() {
    const gpsActs = getHeatmapActivities();

    const trackCountEl = document.getElementById('hm-track-count');
    const totalDistEl = document.getElementById('hm-total-dist');
    if (trackCountEl && totalDistEl) {
      trackCountEl.textContent = `${gpsActs.length}개 코스`;
      const outdoorKm = gpsActs.reduce((acc, a) => acc + (a.distance_km || 0), 0);
      totalDistEl.textContent = `${outdoorKm.toFixed(1)} km`;
    }

    const secTitle = document.getElementById('routes-section-title');
    if (secTitle) {
      let pLabel = '';
      if (currentYear === 'all') {
        pLabel = currentMonth === 'all' ? '역대 전체' : `역대 ${currentMonth}월`;
      } else {
        pLabel = currentMonth === 'all' ? `${currentYear}년 전체` : `${currentYear}년 ${currentMonth}월`;
      }
      secTitle.textContent = `${pLabel} 야외 GPS 코스 목록 (${gpsActs.length}개)`;
    }

    const routesContainer = document.getElementById('routes-grid-container');
    if (routesContainer) {
      if (gpsActs.length === 0) {
        routesContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);"><i class="bi bi-geo-alt-fill" style="font-size: 2.2rem; color: var(--accent-orange); display: block; margin-bottom: 0.6rem;"></i>선택한 기간에 등록된 야외 GPS 경로가 없습니다.</div>`;
      } else {
        routesContainer.innerHTML = gpsActs.map((a) => `
          <div class="route-card" data-act-id="${a.id}">
            <div class="rc-top">
              <span class="rc-name">${a.date} ${a.sport_label}</span>
              <span class="rc-tag" style="${a.is_pure_running ? 'color:var(--accent-orange);background:rgba(255,87,34,0.15);' : ''}">${a.sport_label}</span>
            </div>
            <div class="rc-details">
              <span>거리: <strong>${a.distance_km}km</strong></span>
              <span>페이스: <strong>${a.pace_formatted}</strong></span>
              <span>심박: <strong>${a.avg_hr} bpm</strong></span>
              ${a.is_pure_running ? `<span>EF: <strong>${a.ef}</strong></span>` : ''}
            </div>
          </div>
        `).join('');

        document.querySelectorAll('.route-card').forEach(card => {
          card.onclick = () => {
            const actId = card.dataset.actId;
            const currentActs = getHeatmapActivities();
            const target = currentActs.find(a => a.id === actId);
            if (target && target.gps_points && target.gps_points.length > 0) {
              const poly = L.polyline(target.gps_points);
              window.leafletMap.flyToBounds(poly.getBounds(), { padding: [50, 50], maxZoom: 16, duration: 1.2 });
              mapContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          };
        });
      }
    }

    drawTracks(currentTrackColor, gpsActs);
  }

  // Initial draw and expose globally
  updateHeatmapDisplay();
  window.refreshHeatmap = updateHeatmapDisplay;

  // Sport Toggle Buttons (Pure Running vs All)
  const hmFilterBtns = document.querySelectorAll('.hm-filter-btn');
  hmFilterBtns.forEach(btn => {
    btn.onclick = () => {
      hmFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentHmSportFilter = btn.dataset.hmFilter;
      updateHeatmapDisplay();
    };
  });

  // Track Color Buttons
  const colorBtns = document.querySelectorAll('.tcp-btn');
  colorBtns.forEach(btn => {
    btn.onclick = () => {
      colorBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTrackColor = btn.dataset.color;
      drawTracks(currentTrackColor, getHeatmapActivities());
    };
  });

  // Reset Zoom Button (Fit all current routes in view)
  const btnResetZoom = document.getElementById('btn-reset-map-zoom');
  if (btnResetZoom) {
    btnResetZoom.onclick = () => {
      btnResetZoom.classList.add('active-ghost');
      if (window.heatmapAllBounds) {
        window.leafletMap.fitBounds(window.heatmapAllBounds, { padding: [40, 40], maxZoom: 16 });
      }
    };
  }
}

// ==========================================================================
// 7-Day Training Plan & Instagram Card Engine (Interactive Module)
// ==========================================================================
function calcVdotFromRace(distM, timeSec) {
  const tMin = timeSec / 60.0;
  if (tMin <= 0 || distM <= 0) return 33.0;
  const v = distM / tMin; // m/min
  const vo2 = -4.60 + (0.182258 * v) + (0.000104 * v * v);
  const percentMax = 0.8 + (0.1894393 * Math.exp(-0.012778 * tMin)) + (0.2989558 * Math.exp(-0.1932605 * tMin));
  if (percentMax <= 0) return 33.0;
  const vdot = vo2 / percentMax;
  return Math.max(15, Math.min(85, vdot));
}

function calcDanielsPaces(vdot) {
  function vo2ToPaceSec(targetVo2) {
    const a = 0.000104;
    const b = 0.182258;
    const c = -(4.60 + targetVo2);
    const disc = b * b - 4 * a * c;
    if (disc < 0) return 360;
    const v = (-b + Math.sqrt(disc)) / (2 * a);
    return Math.round(1000.0 / (v / 60.0));
  }
  return {
    easySec: vo2ToPaceSec(vdot * 0.70),
    tempoSec: vo2ToPaceSec(vdot * 0.86)
  };
}

function formatPaceSec(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}'${s < 10 ? '0' : ''}${s}"/km`;
}

function build7DaySchedule(totalKm, lowKm, highKm, daysPerWeek, longDay, easySec, tempoSec, mhr, rhr, mafHr) {
  // Karvonen HR zones
  const hrr = Math.max(40, mhr - rhr);
  const hrEasyMin = Math.round(rhr + (hrr * 0.58));
  const hrEasyMax = Math.round(rhr + (hrr * 0.72));
  const hrTempoMin = Math.round(rhr + (hrr * 0.82));
  const hrTempoMax = Math.round(rhr + (hrr * 0.90));

  const easyPaceStr = `${formatPaceSec(easySec)} ~ ${formatPaceSec(easySec + 25)}`;
  const tempoPaceStr = formatPaceSec(tempoSec);
  const easyHrStr = `${hrEasyMin}~${hrEasyMax} bpm (≤ ${mafHr})`;
  const tempoHrStr = `${hrTempoMin}~${hrTempoMax} bpm`;

  // Distribute distances
  // LSD is ~38% of total mileage
  const lsdKm = Math.max(4.0, Math.round(totalKm * 0.38 * 10) / 10);
  // High intensity tempo is highKm
  const tKm = Math.max(3.0, Math.round(highKm * 10) / 10);
  // Remaining low distance for other easy run days
  const remLowKm = Math.max(0, lowKm - lsdKm);

  const daysMeta = [
    { dayEng: 'MON', dayKor: '월', key: 'mon' },
    { dayEng: 'TUE', dayKor: '화', key: 'tue' },
    { dayEng: 'WED', dayKor: '수', key: 'wed' },
    { dayEng: 'THU', dayKor: '목', key: 'thu' },
    { dayEng: 'FRI', dayKor: '금', key: 'fri' },
    { dayEng: 'SAT', dayKor: '토', key: 'sat' },
    { dayEng: 'SUN', dayKor: '일', key: 'sun' }
  ];

  // Configure templates based on running days
  const result = [];

  // Determine which days are designated for Easy runs based on daysPerWeek and longDay
  const easyDays = [];
  if (daysPerWeek === 3) {
    easyDays.push('tue');
  } else if (daysPerWeek === 4) {
    easyDays.push('tue');
    if (longDay === 'sun') {
      easyDays.push('fri'); // Tue(Easy) -> Wed(Rest) -> Thu(Tempo) -> Fri(Easy) -> Sat(Rest) -> Sun(LSD)
    } else {
      easyDays.push('wed'); // Tue(Easy) -> Wed(Easy) -> Thu(Tempo) -> Fri(Rest) -> Sat(LSD)
    }
  } else if (daysPerWeek >= 5) {
    easyDays.push('tue');
    easyDays.push('wed');
    if (longDay === 'sun') {
      easyDays.push('sat'); // Tue(Easy), Wed(Easy), Thu(Tempo), Sat(Shakeout), Sun(LSD)
    } else {
      easyDays.push('fri'); // Tue(Easy), Wed(Easy), Thu(Tempo), Fri(Shakeout), Sat(LSD)
    }
  }

  const curLang = (window.I18N && window.I18N.getLang) ? window.I18N.getLang() : 'ko';
  const isKo = (curLang === 'ko');

  daysMeta.forEach(dm => {
    const isWeekendLong = (longDay === 'sun' && dm.key === 'sun') || (longDay === 'sat' && dm.key === 'sat');
    const isTempo = (dm.key === 'thu');
    const isEasy = easyDays.includes(dm.key);

    if (isWeekendLong) {
      result.push({
        ...dm,
        type: 'LSD',
        badgeClass: 'badge-lsd',
        typeText: isKo ? '롱런 (LSD)' : 'Long Run (LSD)',
        title: isKo ? '주말 장거리 빌드업 LSD' : 'Weekend Long Aerobic Build-up (LSD)',
        guide: isKo 
          ? '대화가 편안한 Zone 2 저심박을 끝까지 지키며 지구력 기초 유산소 용량을 확장합니다.'
          : 'Maintain conversational Zone 2 low HR to expand your foundational aerobic base.',
        distKm: lsdKm,
        paceStr: easyPaceStr,
        hrStr: easyHrStr,
        intensityTag: isKo ? '저강도 유산소 80%' : 'Low Intensity 80%'
      });
    } else if (isTempo) {
      // 80/20 Key Quality Session (Thursday Tempo)
      result.push({
        ...dm,
        type: 'TEMPO',
        badgeClass: 'badge-tempo',
        typeText: isKo ? '역치 (T-Pace)' : 'Threshold (Tempo)',
        title: isKo ? '80/20 고강도 젖산역치 템포런' : '80/20 Lactate Threshold Tempo Run',
        guide: isKo 
          ? `워밍업 1km + 본세션 ${(tKm - 2.0).toFixed(1)}km T페이스 지속주 + 쿨다운 1km. Zone 3 블랙홀을 배제하고 정확한 역치 자극에 집중합니다.`
          : `1km warmup + ${(tKm - 2.0).toFixed(1)}km T-Pace tempo + 1km cooldown. Focus on lactate clearance adaptation.`,
        distKm: tKm,
        paceStr: tempoPaceStr,
        hrStr: tempoHrStr,
        intensityTag: isKo ? '고강도 역치 20%' : 'High Intensity 20%'
      });
    } else if (isEasy) {
      let eDist = 0;
      let eTitle = isKo ? '회복 & 유산소 베이스 이지런' : 'Aerobic Base Easy Run';
      let eType = isKo ? '이지런 (Easy)' : 'Easy Aerobic';
      let eGuide = isKo 
        ? '호흡이 가쁘지 않도록 케이던스 175~180을 가볍게 유지하며 몸을 부드럽게 풉니다.'
        : 'Keep cadence 175-180 light and relaxed with comfortable breathing.';

      if (daysPerWeek === 3) {
        eDist = Math.max(3.0, Math.round(remLowKm * 10) / 10);
      } else if (daysPerWeek === 4) {
        eDist = Math.max(3.0, Math.round((remLowKm / 2) * 10) / 10);
      } else {
        // 5 days
        if (dm.key === 'tue') {
          eDist = Math.max(3.0, Math.round((remLowKm * 0.38) * 10) / 10);
        } else if (dm.key === 'wed') {
          eDist = Math.max(3.0, Math.round((remLowKm * 0.34) * 10) / 10);
          eType = isKo ? '회복런 (Recovery)' : 'Recovery Run';
          eTitle = isKo ? '피로 완화 리커버리 이지런' : 'Active Recovery Easy Jog';
        } else {
          eDist = Math.max(3.0, Math.round((remLowKm * 0.28) * 10) / 10);
          eType = isKo ? '조깅 (Shakeout)' : 'Shakeout Jog';
          eTitle = isKo ? '주말 롱런 대비 셰이크아웃 조깅' : 'Pre-Long Run Shakeout Jog';
          eGuide = isKo 
            ? '내일 장거리 러닝을 앞두고 다리 근육의 혈류 순환을 촉진하는 가벼운 조깅.'
            : 'Light jog to promote leg circulation ahead of tomorrow long run.';
        }
      }

      result.push({
        ...dm,
        type: 'EASY',
        badgeClass: 'badge-easy',
        typeText: eType,
        title: eTitle,
        guide: eGuide,
        distKm: eDist,
        paceStr: easyPaceStr,
        hrStr: easyHrStr,
        intensityTag: isKo ? '저강도 유산소 80%' : 'Low Intensity 80%'
      });
    } else if (dm.key === 'wed') {
      result.push({
        ...dm,
        type: 'REST',
        badgeClass: 'badge-rest',
        typeText: isKo ? '보강 운동' : 'Strength / Core',
        title: isKo ? '러너 보강운동 (코어 & 중둔근 강화)' : 'Runner Strength (Core & Glute Reinforcement)',
        guide: isKo 
          ? '플랭크, 카프레이즈, 둔근 밴드 운동으로 무릎 부상을 예방하고 러닝 자세 안정성을 높입니다.'
          : 'Planks, calf raises, and glute resistance bands to prevent injury and stabilize form.',
        distKm: 0,
        paceStr: isKo ? '보강 운동' : 'Strength',
        hrStr: isKo ? '체중 저항 운동' : 'Bodyweight',
        intensityTag: isKo ? '부상 방지' : 'Injury Prevention'
      });
    } else if (dm.key === 'sat' && longDay === 'sun') {
      result.push({
        ...dm,
        type: 'REST',
        badgeClass: 'badge-rest',
        typeText: isKo ? '완전 휴식' : 'Full Rest',
        title: isKo ? '주말 롱런 대비 에너지 비축 & 충전' : 'Pre-LSD Rest & Glycogen Recharge',
        guide: isKo 
          ? '충분한 수분 섭취와 탄수화물 보충, 폼롤러 스트레칭으로 롱런 컨디션을 준비합니다.'
          : 'Hydration, carb reloading, and light foam rolling for peak condition.',
        distKm: 0,
        paceStr: isKo ? '완전 휴식' : 'Full Rest',
        hrStr: isKo ? '안정시 회복' : 'Resting Recovery',
        intensityTag: isKo ? '회복 & 재생' : 'Rest & Recharge'
      });
    } else {
      result.push({
        ...dm,
        type: 'REST',
        badgeClass: 'badge-rest',
        typeText: isKo ? '완전 휴식' : 'Full Rest',
        title: isKo ? '완전 휴식 & 근육 재생 (Rest & Recovery)' : 'Full Rest & Muscle Supercompensation',
        guide: isKo 
          ? '80/20 트레이닝의 핵심은 쉬는 날 확실히 쉬어 근육 초회복을 유도하는 것입니다.'
          : 'The core of 80/20 training is prioritizing deep recovery for muscle adaptation.',
        distKm: 0,
        paceStr: isKo ? '완전 휴식' : 'Full Rest',
        hrStr: isKo ? '안정시 회복' : 'Resting Recovery',
        intensityTag: isKo ? '회복 & 재생' : 'Rest & Recovery'
      });
    }
  });

  return result;
}

function syncPlanTargetWithChronic() {
  const inputKm = document.getElementById('plan-target-km');
  if (inputKm && !inputKm.dataset.userEdited) {
    if (window.LATEST_WEEK_CHRONIC_AVG && window.LATEST_WEEK_CHRONIC_AVG > 0) {
      const safeTarget = (window.LATEST_WEEK_CHRONIC_AVG * 1.05).toFixed(1);
      inputKm.value = safeTarget;
      inputKm.placeholder = `최근 4주 기반 권장: ${safeTarget}km`;
    }
  }
}

function initTrainingPlanModule() {
  const planPanel = document.getElementById('panel-plan');
  if (!planPanel) return;

  // Sync chronic mileage with target KM if available
  const inputKm = document.getElementById('plan-target-km');
  if (inputKm) {
    inputKm.addEventListener('input', () => {
      inputKm.dataset.userEdited = 'true';
    });
    syncPlanTargetWithChronic();
  }

  // 1. Interactive Form Controls
  // 1-1. Gender Selector
  let selectedGender = 'M';
  const genderBtns = document.querySelectorAll('#plan-gender-group .plan-seg-btn');
  genderBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      genderBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedGender = btn.dataset.gender || 'M';
    });
  });

  // 1-2. Baseline Mode Switcher (PB vs MAF)
  let currentPlanMode = 'pb';
  const btnModePb = document.getElementById('btn-mode-pb');
  const btnModeMaf = document.getElementById('btn-mode-maf');
  const modePbBox = document.getElementById('plan-mode-pb-box');
  const modeMafBox = document.getElementById('plan-mode-maf-box');

  if (btnModePb && btnModeMaf) {
    btnModePb.addEventListener('click', () => {
      btnModePb.classList.add('active');
      btnModeMaf.classList.remove('active');
      currentPlanMode = 'pb';
      if (modePbBox) modePbBox.style.display = 'block';
      if (modeMafBox) modeMafBox.style.display = 'none';
    });

    btnModeMaf.addEventListener('click', () => {
      btnModeMaf.classList.add('active');
      btnModePb.classList.remove('active');
      currentPlanMode = 'maf';
      if (modeMafBox) modeMafBox.style.display = 'block';
      if (modePbBox) modePbBox.style.display = 'none';
    });
  }

  // 1-3. Race Distance Chips (PB Mode)
  let selectedRaceDist = 10000;
  const raceDistChips = document.querySelectorAll('#plan-race-dist-group .plan-chip');
  raceDistChips.forEach(chip => {
    chip.addEventListener('click', () => {
      raceDistChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedRaceDist = parseFloat(chip.dataset.dist) || 10000;

      // 거리별 디폴트 완주 시간(시/분/초) 프리셋 자동 채우기
      const elHour = document.getElementById('plan-race-hour');
      const elMin = document.getElementById('plan-race-min');
      const elSec = document.getElementById('plan-race-sec');
      if (selectedRaceDist === 5000) {
        if (elHour) elHour.value = 0;
        if (elMin) elMin.value = 28;
        if (elSec) elSec.value = 0;
      } else if (selectedRaceDist === 10000) {
        if (elHour) elHour.value = 0;
        if (elMin) elMin.value = 58;
        if (elSec) elSec.value = 0;
      } else if (selectedRaceDist === 21097) {
        if (elHour) elHour.value = 2;
        if (elMin) elMin.value = 5;
        if (elSec) elSec.value = 0;
      } else if (selectedRaceDist === 42195) {
        if (elHour) elHour.value = 4;
        if (elMin) elMin.value = 15;
        if (elSec) elSec.value = 0;
      }
    });
  });

  // 1-4. Longest Run (LSD) Chips
  let selectedLsdKm = 10;
  const lsdChips = document.querySelectorAll('#plan-lsd-group .plan-chip');
  lsdChips.forEach(chip => {
    chip.addEventListener('click', () => {
      lsdChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedLsdKm = parseFloat(chip.dataset.lsd) || 10;
    });
  });

  // 1-5. Days per week Selector
  let selectedDaysPerWeek = 4;
  const daysBtns = document.querySelectorAll('#plan-days-group .plan-seg-btn');
  daysBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      daysBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDaysPerWeek = parseInt(btn.dataset.days) || 4;
    });
  });

  // 1-6. Long Run Weekend Day Selector
  let selectedLongDay = 'sun';
  const longDayBtns = document.querySelectorAll('#plan-longday-group .plan-seg-btn');
  longDayBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      longDayBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedLongDay = btn.dataset.longday || 'sun';
    });
  });

  // 1-7. Strava Autofill Banner
  const autofillBanner = document.getElementById('plan-autofill-banner');
  const btnAutofill = document.getElementById('btn-plan-strava-autofill');
  const hasStravaToken = !!(localStorage.getItem('strava_access_token') || (window.stravaAllActivities && window.stravaAllActivities.length > 0));
  if (autofillBanner && hasStravaToken) {
    autofillBanner.style.display = 'flex';
  }

  if (btnAutofill) {
    btnAutofill.addEventListener('click', () => {
      const storedProfile = JSON.parse(localStorage.getItem('shoef_runner_profile') || '{}');
      if (storedProfile.age) {
        const elAge = document.getElementById('plan-age');
        if (elAge) elAge.value = storedProfile.age;
      }
      if (storedProfile.gender) {
        selectedGender = storedProfile.gender;
        genderBtns.forEach(b => b.classList.toggle('active', b.dataset.gender === selectedGender));
      }
      if (storedProfile.mhr) {
        const elMhr = document.getElementById('plan-mhr');
        if (elMhr) elMhr.value = storedProfile.mhr;
      }
      if (storedProfile.rhr) {
        const elRhr = document.getElementById('plan-rhr');
        if (elRhr) elRhr.value = storedProfile.rhr;
      }

      const allActs = (window.stravaAllActivities || window.activitiesData || []);
      const outdoorPB = typeof getOutdoor1YearPB === 'function' ? getOutdoor1YearPB(allActs) : null;
      if (outdoorPB && outdoorPB.distanceKm > 0) {
        if (btnModePb) btnModePb.click();
        const distM = outdoorPB.distanceKm * 1000;
        let chosenChip = '10000';
        if (distM < 7500) chosenChip = '5000';
        else if (distM >= 15000 && distM < 30000) chosenChip = '21097';
        else if (distM >= 30000) chosenChip = '42195';

        raceDistChips.forEach(c => {
          c.classList.toggle('active', c.dataset.dist === chosenChip);
          if (c.dataset.dist === chosenChip) selectedRaceDist = parseFloat(chosenChip);
        });

        const totSec = outdoorPB.paceSec * (selectedRaceDist / 1000.0);
        const hourVal = Math.floor(totSec / 3600);
        const minVal = Math.floor((totSec % 3600) / 60);
        const secVal = Math.round(totSec % 60);
        const elHour = document.getElementById('plan-race-hour');
        const elMin = document.getElementById('plan-race-min');
        const elSec = document.getElementById('plan-race-sec');
        if (elHour) elHour.value = hourVal;
        if (elMin) elMin.value = minVal;
        if (elSec) elSec.value = secVal;
      }

      if (typeof showToast === 'function') {
        showToast('내 Strava 실측 기록(PB 및 생체 프로필)이 1초 만에 자동 채워졌습니다!');
      }
    });
  }

  // 1-8. Insta Format Chips
  const fmtBtns = document.querySelectorAll('.pis-fmt-btn');
  const instaCardPlan = document.getElementById('instaCardPlan');
  fmtBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      fmtBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const fmt = btn.dataset.fmt;
      if (instaCardPlan) {
        instaCardPlan.classList.remove('fmt-story', 'fmt-square', 'fmt-portrait');
        instaCardPlan.classList.add(`fmt-${fmt}`);
      }
    });
  });

  // 1-9. Plan Insta Theme Chips (Dark vs Green)
  const btnPlanThemeDark = document.getElementById('btn-plan-theme-dark');
  const btnPlanThemeGreen = document.getElementById('btn-plan-theme-green');
  if (btnPlanThemeDark && btnPlanThemeGreen) {
    btnPlanThemeDark.addEventListener('click', () => {
      btnPlanThemeDark.classList.add('active');
      btnPlanThemeGreen.classList.remove('active');
      if (instaCardPlan) {
        instaCardPlan.classList.remove('theme-green');
      }
    });
    btnPlanThemeGreen.addEventListener('click', () => {
      btnPlanThemeGreen.classList.add('active');
      btnPlanThemeDark.classList.remove('active');
      if (instaCardPlan) {
        instaCardPlan.classList.add('theme-green');
      }
    });
  }

  // 2. Generate Plan Execution Button
  const btnGenerate = document.getElementById('btn-generate-plan');
  if (btnGenerate) {
    btnGenerate.addEventListener('click', () => {
      generateAndRender7DayPlan();
    });
  }

  // 3. Instagram Plan Card Download Button
  const btnDownloadPlanCard = document.getElementById('btn-download-plan-card');
  if (btnDownloadPlanCard) {
    btnDownloadPlanCard.addEventListener('click', () => {
      if (!instaCardPlan) return;
      btnDownloadPlanCard.disabled = true;
      btnDownloadPlanCard.innerHTML = '<i class="bi bi-hourglass-split"></i> 고해상도 카드 렌더링 중...';

      if (typeof html2canvas === 'function') {
        html2canvas(instaCardPlan, {
          scale: 3,
          useCORS: true,
          backgroundColor: '#090d16'
        }).then(canvas => {
          const link = document.createElement('a');
          link.download = `RunAnalyz_7Day_Plan_${new Date().toISOString().slice(0, 10)}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          btnDownloadPlanCard.disabled = false;
          btnDownloadPlanCard.innerHTML = '<i class="bi bi-download"></i> 인스타그램 훈련 카드 고해상도(3x) 저장';
          if (typeof showToast === 'function') {
            showToast('7-Day 플랜 인스타그램 카드가 저장되었습니다!');
          }
        }).catch(err => {
          console.error(err);
          btnDownloadPlanCard.disabled = false;
          btnDownloadPlanCard.innerHTML = '<i class="bi bi-download"></i> 인스타그램 훈련 카드 고해상도(3x) 저장';
          alert('카드 이미지 렌더링 중 오류가 발생했습니다.');
        });
      } else {
        btnDownloadPlanCard.disabled = false;
        btnDownloadPlanCard.innerHTML = '<i class="bi bi-download"></i> 인스타그램 훈련 카드 고해상도(3x) 저장';
      }
    });
  }

  // Core Execution Function
  function generateAndRender7DayPlan() {
    const age = parseInt(document.getElementById('plan-age')?.value) || 42;
    const mhrInput = parseInt(document.getElementById('plan-mhr')?.value) || 0;
    const rhrInput = parseInt(document.getElementById('plan-rhr')?.value) || 0;
    const targetKm = parseFloat(document.getElementById('plan-target-km')?.value) || 25.0;

    // Heart rates
    const effectiveMhr = mhrInput > 120 ? mhrInput : Math.round(208 - (0.7 * age));
    const effectiveRhr = rhrInput > 35 ? rhrInput : 60;
    const mafHr = 180 - age;

    // VDOT & Paces
    let vdot = 33.0;
    let easyPaceSec = 390; // 6'30"
    let tempoPaceSec = 340; // 5'40"
    let vdotDisplay = '33.0';

    if (currentPlanMode === 'pb') {
      const hourVal = parseInt(document.getElementById('plan-race-hour')?.value) || 0;
      const minVal = parseInt(document.getElementById('plan-race-min')?.value) || 0;
      const secVal = parseInt(document.getElementById('plan-race-sec')?.value) || 0;
      const raceTotalSec = (hourVal * 3600) + (minVal * 60) + secVal;
      vdot = calcVdotFromRace(selectedRaceDist, raceTotalSec > 0 ? raceTotalSec : 3600);
      vdotDisplay = vdot.toFixed(1);
      const paces = calcDanielsPaces(vdot);
      easyPaceSec = paces.easySec;
      tempoPaceSec = paces.tempoSec;
    } else {
      const mafMin = parseInt(document.getElementById('plan-maf-min')?.value) || 6;
      const mafSec = parseInt(document.getElementById('plan-maf-sec')?.value) || 30;
      easyPaceSec = (mafMin * 60) + mafSec;
      tempoPaceSec = Math.max(210, easyPaceSec - 35);
      vdotDisplay = 'MAF 180';
    }

    // Runner Level
    let levelNum = 2;
    let levelTitle = '10K 챌린저';
    let levelTag = 'LEVEL 2 · 10K CHALLENGER';
    if (selectedLsdKm < 5) {
      levelNum = 1;
      levelTitle = '비기너 러너';
      levelTag = 'LEVEL 1 · BEGINNER';
    } else if (selectedLsdKm >= 10 && selectedLsdKm < 20) {
      levelNum = 3;
      levelTitle = '하프 도전자';
      levelTag = 'LEVEL 3 · HALF RUNNER';
    } else if (selectedLsdKm >= 20) {
      levelNum = 4;
      levelTitle = '풀코스/마스터즈';
      levelTag = 'LEVEL 4 · MARATHONER';
    }

    // 80/20 Balance
    const lowKm = Math.round(targetKm * 0.8 * 10) / 10;
    const highKm = Math.round((targetKm - lowKm) * 10) / 10;

    // Populate Top Metrics Grid
    const resLevel = document.getElementById('res-plan-level');
    const resLevelTitle = document.getElementById('res-plan-level-title');
    const resStat1Lbl = document.getElementById('res-plan-stat1-lbl');
    const resStat1Val = document.getElementById('res-plan-stat1-val');
    const resStat1Sub = document.getElementById('res-plan-stat1-sub');
    const resTotalKm = document.getElementById('res-plan-total-km');
    const resDaysSub = document.getElementById('res-plan-days-sub');
    const resBalance = document.getElementById('res-plan-balance');

    if (resLevel) resLevel.textContent = `LEVEL ${levelNum}`;
    if (resLevelTitle) resLevelTitle.textContent = levelTitle;
    if (resStat1Lbl) resStat1Lbl.textContent = currentPlanMode === 'pb' ? '기준 VDOT' : 'MAF 저심박 타깃';
    if (resStat1Val) resStat1Val.innerHTML = currentPlanMode === 'pb' ? `${vdotDisplay} <small>점</small>` : `${mafHr} <small>bpm</small>`;
    if (resStat1Sub) resStat1Sub.textContent = currentPlanMode === 'pb' ? '최근 1년 PB 기준' : `180 - 나이(${age}세)`;
    if (resTotalKm) resTotalKm.innerHTML = `${targetKm.toFixed(1)} <small>km</small>`;
    if (resDaysSub) resDaysSub.textContent = `주 ${selectedDaysPerWeek}회 트레이닝`;
    if (resBalance) resBalance.textContent = `${lowKm.toFixed(1)}k : ${highKm.toFixed(1)}k`;

    // Ratio Bar
    const elBarLowKm = document.getElementById('res-bar-low-km');
    const elBarHighKm = document.getElementById('res-bar-high-km');
    const elBarFillLow = document.getElementById('res-bar-fill-low');
    const elBarFillHigh = document.getElementById('res-bar-fill-high');
    if (elBarLowKm) elBarLowKm.textContent = `${lowKm.toFixed(1)} km (80%)`;
    if (elBarHighKm) elBarHighKm.textContent = `${highKm.toFixed(1)} km (20%)`;
    if (elBarFillLow) elBarFillLow.style.width = '80%';
    if (elBarFillHigh) elBarFillHigh.style.width = '20%';

    // Generate 7-Day Schedule Items
    const schedule = build7DaySchedule(targetKm, lowKm, highKm, selectedDaysPerWeek, selectedLongDay, easyPaceSec, tempoPaceSec, effectiveMhr, effectiveRhr, mafHr);

    // Render Vertical Card Stack
    const stackContainer = document.getElementById('plan-days-stack');
    if (stackContainer) {
      stackContainer.innerHTML = '';
      schedule.forEach(item => {
        const card = document.createElement('div');
        card.className = `pday-card ${item.type.toLowerCase()}`;
        card.innerHTML = `
          <div class="pday-left">
            <div class="pday-badge-col">
              <span class="pday-badge ${item.badgeClass}">${item.dayKor}</span>
              <span class="pday-type-tag">${item.typeText}</span>
            </div>
            <div class="pday-info-col">
              <div class="pday-title">${item.title}</div>
              <div class="pday-guide">${item.guide}</div>
              <div class="pday-meta">
                <span><i class="bi bi-speedometer"></i> ${item.paceStr}</span>
                <span><i class="bi bi-heart-pulse"></i> ${item.hrStr}</span>
              </div>
            </div>
          </div>
          <div class="pday-right">
            <div class="pday-dist">${item.distKm > 0 ? `${item.distKm.toFixed(1)}<small>km</small>` : '휴식'}</div>
            <div class="pday-sub">${item.intensityTag}</div>
          </div>
        `;
        stackContainer.appendChild(card);
      });
    }

    // Render Insta Card
    const cardLevel = document.getElementById('card-plan-level');
    const cardDist = document.getElementById('card-plan-dist');
    const cardVdot = document.getElementById('card-plan-vdot');
    const cardSchedule = document.getElementById('card-plan-schedule');

    if (cardLevel) cardLevel.textContent = levelTag;
    if (cardDist) cardDist.innerHTML = `${targetKm.toFixed(1)}<small>KM</small>`;
    if (cardVdot) {
      cardVdot.textContent = currentPlanMode === 'pb' 
        ? `VDOT ${vdotDisplay} · MAF ${mafHr} BPM · 80/20 POLARIZED`
        : `MAF ${mafHr} BPM (180-AGE) · 80/20 POLARIZED BASE`;
    }

    if (cardSchedule) {
      cardSchedule.innerHTML = '';
      schedule.forEach(item => {
        const sRow = document.createElement('div');
        sRow.className = `pic-day-row ${item.type.toLowerCase()}`;
        
        // Compact 1-line layout: [요일] - [훈련타입] - [거리] - [페이스]
        const paceDisplay = item.distKm > 0 ? (item.type === 'TEMPO' ? formatPaceSec(tempoPaceSec) : formatPaceSec(easyPaceSec)) : '-';
        const distDisplay = item.distKm > 0 ? `${item.distKm.toFixed(1)} km` : 'REST';
        
        sRow.innerHTML = `
          <div class="pic-day-left">
            <span class="pic-day-lbl">${item.dayEng}</span>
            <span class="pic-day-task">${item.typeText}</span>
          </div>
          <div class="pic-day-right">
            <span class="pic-day-km">${distDisplay}</span>
            <span class="pic-day-pace">${paceDisplay}</span>
          </div>
        `;
        cardSchedule.appendChild(sRow);
      });
    }

    // Show Result Section with smooth scroll
    const resultSection = document.getElementById('plan-result-section');
    if (resultSection) {
      resultSection.style.display = 'block';
      resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (typeof showToast === 'function') {
      showToast('이번 주 7-Day 맞춤 훈련 플랜이 성공적으로 생성되었습니다!');
    }
  }

  // Pre-generate once with default values so user sees initial blueprint immediately
  generateAndRender7DayPlan();
}

// ==========================================================================
// 2-Track Onboarding Gateway Module (Track A: Strava vs Track B: 7-Day Plan)
// ==========================================================================
function initWelcomeGateway() {
  const gatewayOverlay = document.getElementById('welcome-gateway-overlay');
  const btnOpenModal = document.getElementById('btn-open-gateway-modal');
  const btnTrackA = document.getElementById('btn-gateway-track-a');
  const btnTrackB = document.getElementById('btn-gateway-track-b');
  const btnDemo = document.getElementById('btn-gateway-demo');

  if (!gatewayOverlay) return;

  function openGateway() {
    gatewayOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeGateway() {
    gatewayOverlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  // Header quick button
  if (btnOpenModal) {
    btnOpenModal.addEventListener('click', openGateway);
  }

  // Track A Action (Strava Live Sync)
  if (btnTrackA) {
    btnTrackA.addEventListener('click', () => {
      closeGateway();
      sessionStorage.setItem('shoef_gateway_dismissed', '1');
      const hasToken = !!localStorage.getItem('strava_access_token');
      if (hasToken) {
        if (typeof showToast === 'function') {
          showToast('Strava 계정이 이미 연동되어 있습니다. 대시보드로 이동합니다.');
        }
      } else {
        const btnStrava = document.getElementById('btn-strava-auth');
        if (btnStrava) btnStrava.click();
      }
    });
  }

  // Track B Action (Non-login 7-Day Plan)
  if (btnTrackB) {
    btnTrackB.addEventListener('click', () => {
      closeGateway();
      sessionStorage.setItem('shoef_gateway_dismissed', '1');
      const tabPlan = document.getElementById('tab-btn-plan');
      if (tabPlan) tabPlan.click();
      const planForm = document.getElementById('plan-form-card');
      if (planForm) {
        setTimeout(() => {
          planForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      }
      if (typeof showToast === 'function') {
        showToast('로그인 없이 7-Day 훈련플랜을 맞춤 설정하세요!');
      }
    });
  }

  // Demo Action
  if (btnDemo) {
    btnDemo.addEventListener('click', async () => {
      closeGateway();
      sessionStorage.setItem('shoef_gateway_dismissed', '1');
      await ensureDemoDataLoaded();
      const tabSingle = document.getElementById('tab-btn-single');
      if (tabSingle) tabSingle.click();
      if (typeof showToast === 'function') {
        showToast('데모 데이터 모드로 전체 대시보드를 탐색합니다.');
      }
    });
  }

  // Auto-display gateway if user hasn't chosen a track in this session and not logged into Strava
  const hasToken = !!localStorage.getItem('strava_access_token');
  const dismissed = sessionStorage.getItem('shoef_gateway_dismissed');
  if (!hasToken && !dismissed) {
    openGateway();
  }
}

// Auto-run modules when DOM is loaded or script finishes
function runAllInitializers() {
  initTrainingPlanModule();
  initWelcomeGateway();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runAllInitializers);
} else {
  runAllInitializers();
}

// Global Responsive Chart Resize Safeguard for Mobile & Orientation Change
window.addEventListener('resize', () => {
  if (window.singleChartInstance) window.singleChartInstance.resize();
  if (window.weeklyChartInstance) window.weeklyChartInstance.resize();
  if (window.yearlyChartInstance) window.yearlyChartInstance.resize();
});

window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    if (window.singleChartInstance) window.singleChartInstance.resize();
    if (window.weeklyChartInstance) window.weeklyChartInstance.resize();
    if (window.yearlyChartInstance) window.yearlyChartInstance.resize();
  }, 200);
});

window.addEventListener('load', () => {
  setTimeout(() => {
    if (window.singleChartInstance) window.singleChartInstance.resize();
    if (window.weeklyChartInstance) window.weeklyChartInstance.resize();
    if (window.yearlyChartInstance) window.yearlyChartInstance.resize();
  }, 300);
});


