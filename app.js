/* ==========================================================================
   RunAnalyz / RunAnalyz - Multi-Year Garmin Engine & Analytics
   Supports: 2017-2026 Multi-Year Data, Shoe Mileage Tracker, Heatmap
   ========================================================================== */

// Global filter states accessible by all modules
let currentYear = '2026';
let currentMonth = '8';
let currentSportFilter = 'all'; // 'all', 'treadmill', 'outdoor'

document.addEventListener('DOMContentLoaded', () => {
  // 1. Data Sources (Prefers full Garmin Archive, fallbacks to August data)
  const archive = window.GARMIN_ARCHIVE;
  const allActivities = archive?.activities || window.RUN_ACTIVITIES || [];
  const pureRunningActivities = allActivities.filter(a => a.is_pure_running && a.distance_km > 0.3);
  const nonRunningActivities = allActivities.filter(a => !a.is_pure_running);

  console.log(`Loaded ${allActivities.length} total activities: ${pureRunningActivities.length} pure running, ${nonRunningActivities.length} other activities.`);

  if (!pureRunningActivities || pureRunningActivities.length === 0) {
    alert('러닝 활동 데이터를 불러오지 못했습니다.');
    return;
  }

  // 2. Filter States & Persistence
  const selectYear = document.getElementById('select-year');
  const selectMonth = document.getElementById('select-month');

  // Restore saved filter from sessionStorage
  const savedYear = sessionStorage.getItem('shoef_selected_year');
  const savedMonth = sessionStorage.getItem('shoef_selected_month');
  if (savedYear && selectYear) selectYear.value = savedYear;
  if (savedMonth && selectMonth) selectMonth.value = savedMonth;

  currentYear = selectYear?.value || '2026';
  currentMonth = selectMonth?.value || '8';
  currentSportFilter = 'all';

  // Toast Notification Helper
  function showToast(message) {
    let toast = document.getElementById('shoef-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'shoef-toast';
      toast.className = 'shoef-toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<i class="bi bi-check-circle-fill" style="color:var(--accent-orange);"></i> <span>${message}</span>`;
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

    let periodLabel = '';
    if (currentYear === 'all') {
      periodLabel = currentMonth === 'all' ? '역대 전체 (2017~2026)' : `역대 ${currentMonth}월 누적`;
    } else {
      periodLabel = currentMonth === 'all' ? `${currentYear}년 전체` : `${currentYear}년 ${currentMonth}월`;
    }

    const totalKm = currentList.reduce((sum, a) => sum + (a.distance_km || 0), 0);
    badgeTextEl.textContent = `${periodLabel} (${currentList.length}회 · ${totalKm.toFixed(1)}km)`;

    if (badgeContainer) {
      badgeContainer.classList.remove('badge-highlight');
      void badgeContainer.offsetWidth; // Force reflow
      badgeContainer.classList.add('badge-highlight');
    }
  }

  // Filter Selectors Listeners
  if (selectYear) {
    selectYear.addEventListener('change', (e) => {
      currentYear = e.target.value;
      sessionStorage.setItem('shoef_selected_year', currentYear);
      refreshAllViews();
      const pText = currentYear === 'all' ? '역대 전체' : `${currentYear}년`;
      showToast(`📅 기간 필터가 [${pText}] 데이터로 갱신되었습니다.`);
    });
  }

  if (selectMonth) {
    selectMonth.addEventListener('change', (e) => {
      currentMonth = e.target.value;
      sessionStorage.setItem('shoef_selected_month', currentMonth);
      refreshAllViews();
      const mText = currentMonth === 'all' ? '연간 전체' : `${currentMonth}월`;
      showToast(`📅 기간 필터가 [${mText}] 데이터로 갱신되었습니다.`);
    });
  }

  function getFilteredActivities() {
    return pureRunningActivities.filter(a => {
      if (currentYear !== 'all' && a.year != currentYear) return false;
      if (currentMonth !== 'all' && a.month != currentMonth) return false;
      if (currentSportFilter === 'treadmill' && a.sub_sport !== 'treadmill') return false;
      if (currentSportFilter === 'outdoor' && a.sub_sport === 'treadmill') return false;
      return true;
    });
  }

  function updateBadgeCounts() {
    const runsInPeriod = pureRunningActivities.filter(a => {
      if (currentYear !== 'all' && a.year != currentYear) return false;
      if (currentMonth !== 'all' && a.month != currentMonth) return false;
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

  // 3. Tab Switching Logic
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const activePanel = document.getElementById(`panel-${target}`);
      if (activePanel) activePanel.classList.add('active');

      if (target === 'single' && window.singleChartInstance) window.singleChartInstance.resize();
      if (target === 'weekly' && window.weeklyChartInstance) window.weeklyChartInstance.resize();
      if (target === 'yearly' && window.yearlyChartInstance) window.yearlyChartInstance.resize();
      if (target === 'heatmap') {
        setTimeout(() => {
          if (window.leafletMap) {
            window.leafletMap.invalidateSize();
            if (window.heatmapAllBounds) {
              window.leafletMap.fitBounds(window.heatmapAllBounds, { padding: [40, 40], maxZoom: 16 });
            }
          }
          if (window.refreshHeatmap) {
            window.refreshHeatmap(currentYear, currentMonth);
          }
        }, 150);
      }
    });
  });

  // 4. Sport Environment Filter Buttons
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
      initWeeklyRecap(currentList, currentYear, currentMonth);
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
});

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

  // Populate Select (latest first)
  const sortedActs = [...activities].reverse();
  sortedActs.forEach((act, idx) => {
    const opt = document.createElement('option');
    opt.value = act.id;
    opt.textContent = `${act.date} (${act.time}) — ${act.sport_label} ${act.distance_km}km | ${act.pace_formatted} | EF: ${act.ef}`;
    select.appendChild(opt);
  });

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
}

function renderSingleSession(act) {
  if (!act) return;

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
      efSub.innerHTML = `<i class="bi bi-fire text-lime"></i> <strong>최상급 유산소 엔진 (Elite Base)</strong>`;
    } else if (efVal >= 1.25) {
      efSub.innerHTML = `<i class="bi bi-shield-check text-cyan"></i> <strong>우수한 유산소 효율성 (Good Conditioning)</strong>`;
    } else if (efVal >= 1.10) {
      efSub.innerHTML = `<i class="bi bi-speedometer text-orange"></i> <strong>표준 유산소 베이스 (Moderate Base)</strong>`;
    } else {
      efSub.innerHTML = `<i class="bi bi-sun text-yellow"></i> <strong>초기 유산소 적응 or 웜업/리커버리</strong>`;
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
      decTitle.textContent = '유산소 지구력 최적 안정 (Excellent Base)';
      decDesc.textContent = `후반부 페이스 대비 심박수 상승률(드리프트)이 ${decVal}%로 기준치(5% 미만)를 충족합니다.`;
    } else if (decVal >= 5.0 && decVal <= 8.5) {
      if (decouplingEl) decouplingEl.style.color = 'var(--accent-yellow)';
      decTitle.textContent = '경미한 심폐 드리프트 (Mild Cardiac Drift)';
      decDesc.textContent = `후반부 심폐 부하가 ${decVal}% 증가했습니다. 기온 또는 훈련 후반부 피로 누적이 발생했습니다.`;
    } else {
      if (decouplingEl) decouplingEl.style.color = 'var(--accent-red)';
      decTitle.textContent = '후반부 심박 분리 심화 (High Fatigue)';
      decDesc.textContent = `후반부 심박수가 ${decVal}% 상승하여 심폐 탈진 및 피로도가 급증했습니다.`;
    }
  }

  // Dynamics & Specs
  const cadEl = document.getElementById('single-cadence');
  if (cadEl) cadEl.textContent = act.avg_cadence ? `${act.avg_cadence} spm` : '180 spm';

  const powEl = document.getElementById('single-power');
  if (powEl) powEl.textContent = act.avg_power ? `${act.avg_power} W` : '- W';

  const calEl = document.getElementById('single-cal');
  if (calEl) calEl.textContent = `${act.calories || 0} kcal`;
  
  // VDOT estimation
  const vdotEst = estimateVDOT(act.distance_km || 0, act.duration_seconds || 0);
  const vdotEl = document.getElementById('single-vdot');
  if (vdotEl) vdotEl.textContent = vdotEst.toFixed(1);

  try {
    renderSingleChart(act);
  } catch (chartErr) {
    console.error('Error rendering single chart:', chartErr);
  }
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

function renderSingleChart(act) {
  const ctx = document.getElementById('singleSessionChart')?.getContext('2d');
  if (!ctx) return;

  if (window.singleChartInstance) {
    window.singleChartInstance.destroy();
  }

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
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: 'Outfit' } } }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
        yHr: { type: 'linear', position: 'left', min: 100, max: 200, ticks: { color: '#f43f5e' } },
        yCad: { type: 'linear', position: 'right', min: 140, max: 210, grid: { drawOnChartArea: false }, ticks: { color: '#00f2fe' } }
      }
    }
  });
}

/* ==========================================================================
   MODULE 2: WEEKLY RECAP LOGIC
   ========================================================================== */
function initWeeklyRecap(activities, year = '2026', month = '8') {
  const container = document.getElementById('weekly-cards-list');
  if (!container) return;

  const weeklyTitleEl = document.getElementById('weekly-main-title');
  if (weeklyTitleEl) {
    let pLabel = '';
    if (year === 'all') {
      pLabel = month === 'all' ? '역대 전체' : `역대 ${month}월`;
    } else {
      pLabel = month === 'all' ? `${year}년 전체` : `${year}년 ${month}월`;
    }
    weeklyTitleEl.textContent = `${pLabel} 주차별 마일리지 빌드업 & 부상 위험 진단`;
  }

  if (activities.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);"><i class="bi bi-calendar-x" style="font-size: 2.2rem; color: var(--accent-orange); display: block; margin-bottom: 0.6rem;"></i>선택한 기간에 등록된 주간 러닝 기록이 없습니다.</div>`;
    if (window.weeklyChartInstance) {
      window.weeklyChartInstance.destroy();
      window.weeklyChartInstance = null;
    }
    return;
  }

  // Group by ISO week
  const weekMap = {};
  activities.forEach(a => {
    const wKey = `W${a.week || 1}`;
    if (!weekMap[wKey]) {
      weekMap[wKey] = {
        name: `${wKey} (${a.date.slice(5, 10)})`,
        weekNum: a.week,
        runs: [],
        totalKm: 0,
        totalTimeSec: 0,
        efList: [],
        hrList: [],
        maxLsd: 0
      };
    }
    weekMap[wKey].runs.push(a);
    weekMap[wKey].totalKm += a.distance_km;
    weekMap[wKey].totalTimeSec += a.duration_seconds;
    if (a.ef > 0.5) weekMap[wKey].efList.push(a.ef);
    if (a.avg_hr > 60) weekMap[wKey].hrList.push(a.avg_hr);
    if (a.distance_km > weekMap[wKey].maxLsd) weekMap[wKey].maxLsd = a.distance_km;
  });

  const weeks = Object.values(weekMap).sort((a, b) => a.weekNum - b.weekNum);

  // Compute 10% progression rule
  let prevKm = 0;
  weeks.forEach((w) => {
    w.totalKm = Math.round(w.totalKm * 100) / 100;
    if (prevKm > 0) {
      w.increasePct = Math.round(((w.totalKm - prevKm) / prevKm) * 1000) / 10;
    } else {
      w.increasePct = 0;
    }
    w.avgEf = w.efList.length ? Math.round((w.efList.reduce((a,b)=>a+b,0)/w.efList.length)*1000)/1000 : 0;
    w.avgHr = w.hrList.length ? Math.round(w.hrList.reduce((a,b)=>a+b,0)/w.hrList.length) : 0;
    w.lsdRatio = w.totalKm > 0 ? Math.round((w.maxLsd / w.totalKm) * 1000) / 10 : 0;

    // Safety rule
    if (w.increasePct > 15) {
      w.ruleClass = 'rule-danger';
      w.ruleText = `⚠️ 위험 (+${w.increasePct}%)`;
    } else if (w.increasePct > 10) {
      w.ruleClass = 'rule-caution';
      w.ruleText = `주의 (+${w.increasePct}%)`;
    } else if (w.increasePct < -10) {
      w.ruleClass = 'rule-recovery';
      w.ruleText = `회복주 (-${Math.abs(w.increasePct)}%)`;
    } else {
      w.ruleClass = 'rule-safe';
      w.ruleText = `안전 (${w.increasePct >= 0 ? '+' : ''}${w.increasePct}%)`;
    }

    prevKm = w.totalKm;
  });

  // Render Weekly Cards
  if (weeks.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">선택된 기간에 주간 러닝 기록이 없습니다.</div>`;
  } else {
    container.innerHTML = weeks.map(w => `
      <div class="weekly-card">
        <div class="wc-header">
          <span class="wc-name">${w.name}</span>
          <span class="wc-runs">${w.runs.length}회 러닝</span>
        </div>
        <div class="wc-distance">${w.totalKm.toFixed(1)} <small>km</small></div>
        <div class="rule-badge ${w.ruleClass}">
          <i class="bi bi-shield-check"></i> ${w.ruleText}
        </div>
        <div class="wc-stats-list">
          <div class="wc-stat-row">
            <span>평균 유산소 EF</span>
            <span style="color:var(--accent-lime);">${w.avgEf.toFixed(3)}</span>
          </div>
          <div class="wc-stat-row">
            <span>최장 거리 (LSD)</span>
            <span>${w.maxLsd.toFixed(1)}km (${w.lsdRatio}%)</span>
          </div>
          <div class="wc-stat-row">
            <span>평균 심박수</span>
            <span>${w.avgHr} bpm</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Render Weekly Chart
  renderWeeklyChart(weeks);
}

function renderWeeklyChart(weeks) {
  const ctx = document.getElementById('weeklyChart')?.getContext('2d');
  if (!ctx) return;

  if (window.weeklyChartInstance) {
    window.weeklyChartInstance.destroy();
  }

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
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: 'Outfit' } } }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
        yDist: { type: 'linear', position: 'left', min: 0, ticks: { color: '#ff5722' } },
        yEf: { type: 'linear', position: 'right', min: 0.5, max: 1.6, grid: { drawOnChartArea: false }, ticks: { color: '#00ff87' } }
      }
    }
  });
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

  // Update Monthly Dashboard Labels
  const elLabelDist = document.getElementById('month-label-dist');
  if (elLabelDist) elLabelDist.textContent = `${periodTitle} 총 마일리지`;
  const elLabelTime = document.getElementById('month-label-time');
  if (elLabelTime) elLabelTime.textContent = `${periodTitle} 총 러닝 시간`;
  const elLabelPace = document.getElementById('month-label-pace');
  if (elLabelPace) elLabelPace.textContent = `${periodTitle} 평균 페이스`;

  // Update Monthly Dashboard Cards
  const elDist = document.getElementById('month-total-dist');
  if (elDist) elDist.innerHTML = `${totalDist.toFixed(1)} <small>km</small>`;
  const elCount = document.getElementById('month-run-count');
  if (elCount) elCount.textContent = `총 ${activities.length}회 러닝 완료`;
  const elTime = document.getElementById('month-total-time');
  if (elTime) elTime.innerHTML = `${hours}<small>h</small> ${minutes}<small>m</small>`;
  const elCal = document.getElementById('month-total-cal');
  if (elCal) elCal.textContent = `${totalCal.toLocaleString()} kcal 소모`;
  const elPace = document.getElementById('month-avg-pace');
  if (elPace) elPace.innerHTML = `${avgPaceStr} <small>/km</small>`;
  const elHr = document.getElementById('month-avg-hr');
  if (elHr) elHr.textContent = `평균 심박수 ${avgHr} bpm`;
  const elGrowth = document.getElementById('month-ef-growth');
  if (elGrowth) elGrowth.textContent = `${efGrowthPct >= 0 ? '+' : ''}${efGrowthPct.toFixed(1)}%`;

  // Update Insta Card
  const cardBadge = document.querySelector('.ic-badge');
  if (cardBadge) cardBadge.textContent = engPeriodTitle;

  document.getElementById('card-dist').innerHTML = `${totalDist.toFixed(1)} <span class="unit">KM</span>`;
  document.getElementById('card-runs').innerHTML = `${activities.length} <small>회</small>`;
  document.getElementById('card-pace').textContent = avgPaceStr;
  document.getElementById('card-time').textContent = `${hours}h ${minutes}m`;
  document.getElementById('card-hr').innerHTML = `${avgHr} <small>bpm</small>`;
  document.getElementById('card-lsd').textContent = `${maxLsd.toFixed(1)} km (${lsdAct?.date?.slice(5) || '-'})`;
  document.getElementById('card-ef').textContent = `${avgEf.toFixed(3)} (${efGrowthPct >= 0 ? '+' : ''}${efGrowthPct.toFixed(1)}%)`;

  // Format & Theme state for Insta Card Studio
  let currentCardFormat = 'story'; // 'story' (9:16), 'square' (1:1), 'portrait' (4:5)
  let currentCardTheme = 'dark'; // 'dark', 'neon', 'minimal'
  const instaCard = document.getElementById('instaCard');
  const btnShare = document.getElementById('btn-share-card');

  function updateCardAppearance() {
    if (instaCard) {
      instaCard.className = `insta-card theme-${currentCardTheme} format-${currentCardFormat}`;
    }
    if (btnShare) {
      if (currentCardFormat === 'story') {
        btnShare.innerHTML = `<i class="bi bi-instagram"></i> 스토리 공유`;
      } else {
        btnShare.innerHTML = `<i class="bi bi-share-fill"></i> 피드 공유`;
      }
    }
  }

  // Format switcher (Story 9:16 vs Feed Square 1:1 vs Feed Portrait 4:5)
  const formatBtns = document.querySelectorAll('.btn-format-chip');
  formatBtns.forEach(btn => {
    btn.onclick = () => {
      formatBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCardFormat = btn.dataset.format || 'story';
      updateCardAppearance();
    };
  });

  // Theme switcher
  const themeBtns = document.querySelectorAll('.btn-theme-chip, .btn-theme');
  themeBtns.forEach(btn => {
    btn.onclick = () => {
      themeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCardTheme = btn.dataset.theme || 'dark';
      updateCardAppearance();
    };
  });

  // Helper: Render Insta Card Canvas (High-res 3x scale)
  async function generateCardCanvas() {
    return await html2canvas(instaCard, {
      scale: 3,
      useCORS: true,
      backgroundColor: null
    });
  }

  function triggerImageDownload(canvas) {
    const link = document.createElement('a');
    const formatName = currentCardFormat === 'square' ? 'FeedSquare_1x1' : (currentCardFormat === 'portrait' ? 'FeedPortrait_4x5' : 'Story_9x16');
    link.download = `RunAnalyz_${year}_${month}_${formatName}_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  // Smart Share Button (Web Share API for Mobile Instagram/AirDrop + fallback)
  if (btnShare) {
    btnShare.onclick = async () => {
      const origHtml = btnShare.innerHTML;
      btnShare.innerHTML = `<i class="bi bi-hourglass-split"></i> 생성 중...`;
      btnShare.disabled = true;

      try {
        const canvas = await generateCardCanvas();

        if (navigator.canShare) {
          canvas.toBlob(async (blob) => {
            if (!blob) {
              triggerImageDownload(canvas);
              resetShareBtn();
              return;
            }
            const formatTitle = currentCardFormat === 'square' ? '피드 정방형 (1:1)' : (currentCardFormat === 'portrait' ? '피드 세로형 (4:5)' : '스토리 (9:16)');
            const file = new File([blob], `RunAnalyz_Recap_${year}_${month}_${currentCardFormat}.png`, { type: 'image/png' });
            if (navigator.canShare({ files: [file] })) {
              try {
                await navigator.share({
                  files: [file],
                  title: `RunAnalyz ${periodTitle} 러닝 결산 (${formatTitle})`,
                  text: `RunAnalyz 러닝 대시보드에서 생성된 ${periodTitle} 러닝 결산 카드(${formatTitle})입니다.`
                });
                btnShare.innerHTML = `<i class="bi bi-check-circle-fill"></i> 공유 완료!`;
              } catch (shareErr) {
                if (shareErr.name !== 'AbortError') {
                  triggerImageDownload(canvas);
                  btnShare.innerHTML = `<i class="bi bi-check-circle-fill"></i> 저장 완료!`;
                } else {
                  btnShare.innerHTML = origHtml;
                  btnShare.disabled = false;
                  return;
                }
              }
            } else {
              triggerImageDownload(canvas);
              btnShare.innerHTML = `<i class="bi bi-check-circle-fill"></i> 저장 완료!`;
            }
            resetShareBtn();
          }, 'image/png');
        } else {
          triggerImageDownload(canvas);
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

  // Dedicated Direct Download Button
  const btnDownload = document.getElementById('btn-download-card');
  if (btnDownload) {
    btnDownload.onclick = async () => {
      const origHtml = btnDownload.innerHTML;
      btnDownload.innerHTML = `<i class="bi bi-hourglass-split"></i>`;
      btnDownload.disabled = true;

      try {
        const canvas = await generateCardCanvas();
        triggerImageDownload(canvas);
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
  const ctx = document.getElementById('yearlyChart')?.getContext('2d');
  if (!ctx) return;

  if (window.yearlyChartInstance) {
    window.yearlyChartInstance.destroy();
  }

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
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: 'Outfit' } } }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
        yDist: { type: 'linear', position: 'left', min: 0, ticks: { color: '#ff5722' } },
        yEf: { type: 'linear', position: 'right', min: 0.7, max: 1.5, grid: { drawOnChartArea: false }, ticks: { color: '#00f2fe' } }
      }
    }
  });
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

    if (currentHmSportFilter === 'running') {
      return list.filter(a => a.is_pure_running && a.has_gps && a.gps_points && a.gps_points.length > 5);
    }
    return list.filter(a => a.has_gps && a.gps_points && a.gps_points.length > 5);
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

  // Reset Zoom Button
  const btnResetZoom = document.getElementById('btn-reset-map-zoom');
  if (btnResetZoom) {
    btnResetZoom.onclick = () => {
      document.querySelectorAll('.map-quick-buttons .btn-ghost').forEach(b => b.classList.remove('active-ghost'));
      btnResetZoom.classList.add('active-ghost');
      if (window.heatmapAllBounds) {
        window.leafletMap.fitBounds(window.heatmapAllBounds, { padding: [40, 40], maxZoom: 16 });
      }
    };
  }

  // Quick Zoom: Namyangju Outdoor Runs
  const btnZoomNamyangju = document.getElementById('btn-zoom-namyangju');
  if (btnZoomNamyangju) {
    btnZoomNamyangju.onclick = () => {
      document.querySelectorAll('.map-quick-buttons .btn-ghost').forEach(b => b.classList.remove('active-ghost'));
      btnZoomNamyangju.classList.add('active-ghost');
      const allGps = activities.filter(a => a.has_gps && a.gps_points && a.gps_points.length > 0);
      const namyangjuRuns = allGps.filter(a => {
        const pt = a.gps_points[0];
        return pt && pt[0] >= 37.60 && pt[0] <= 37.75 && pt[1] >= 127.15 && pt[1] <= 127.40;
      });
      if (namyangjuRuns.length > 0) {
        let b = L.latLngBounds(namyangjuRuns[0].gps_points);
        namyangjuRuns.forEach(r => b.extend(r.gps_points));
        window.leafletMap.flyToBounds(b, { padding: [40, 40], maxZoom: 15, duration: 1.2 });
      } else {
        window.leafletMap.flyTo([37.669, 127.304], 14, { duration: 1.2 });
      }
    };
  }

  // Quick Zoom: Seoul Hiking/Walking
  const btnZoomSeoul = document.getElementById('btn-zoom-seoul');
  if (btnZoomSeoul) {
    btnZoomSeoul.onclick = () => {
      document.querySelectorAll('.map-quick-buttons .btn-ghost').forEach(b => b.classList.remove('active-ghost'));
      btnZoomSeoul.classList.add('active-ghost');
      const allGps = activities.filter(a => a.has_gps && a.gps_points && a.gps_points.length > 0);
      const seoulActs = allGps.filter(a => {
        const pt = a.gps_points[0];
        return pt && pt[0] >= 37.45 && pt[0] <= 37.65 && pt[1] >= 126.85 && pt[1] <= 127.12;
      });
      if (seoulActs.length > 0) {
        let b = L.latLngBounds(seoulActs[0].gps_points);
        seoulActs.forEach(r => b.extend(r.gps_points));
        window.leafletMap.flyToBounds(b, { padding: [40, 40], maxZoom: 15, duration: 1.2 });
      } else {
        window.leafletMap.flyTo([37.566, 126.978], 13, { duration: 1.2 });
      }
    };
  }
}
