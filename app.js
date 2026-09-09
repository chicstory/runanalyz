/* ==========================================================================
   RunAnalyze Application Logic (With Sport Filter & High-Precision EF)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Data Source
  const rawActivities = (window.RUN_ACTIVITIES || []).filter(a => a.distance_km > 0.5);
  console.log(`Loaded ${rawActivities.length} running activities.`);

  if (!rawActivities || rawActivities.length === 0) {
    alert('러닝 활동 데이터를 불러오지 못했습니다.');
    return;
  }

  // Filter State
  let currentFilter = 'all'; // 'all', 'treadmill', 'outdoor'

  // Update Badge Counts
  const tmCount = rawActivities.filter(a => a.sub_sport === 'treadmill').length;
  const odCount = rawActivities.filter(a => a.sub_sport !== 'treadmill').length;
  document.getElementById('filter-count-all').textContent = `(${rawActivities.length})`;
  document.getElementById('filter-count-tm').textContent = `(${tmCount})`;
  document.getElementById('filter-count-od').textContent = `(${odCount})`;

  function getFilteredActivities() {
    if (currentFilter === 'treadmill') {
      return rawActivities.filter(a => a.sub_sport === 'treadmill');
    } else if (currentFilter === 'outdoor') {
      return rawActivities.filter(a => a.sub_sport !== 'treadmill');
    }
    return rawActivities;
  }

  // 2. Tab Switching Logic
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
      if (target === 'heatmap') {
        setTimeout(() => {
          if (window.leafletMap) {
            window.leafletMap.invalidateSize();
            if (window.heatmapAllBounds) {
              window.leafletMap.fitBounds(window.heatmapAllBounds, { padding: [60, 60], maxZoom: 16 });
            }
          }
        }, 150);
      }
    });
  });

  // 3. Filter Buttons Logic
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentFilter = btn.dataset.filter;
      refreshAllViews();
    });
  });

  // Refresh All Dashboard Sections
  function refreshAllViews() {
    const currentList = getFilteredActivities();
    initSingleSession(currentList);
    initWeeklyRecap(currentList);
    initMonthlyRecap(currentList, currentFilter);
    initRunningHeatmap(rawActivities); // Heatmap always has access to all outdoor GPS tracks
  }

  // Initial Render
  refreshAllViews();

  // Reload Button
  document.getElementById('btn-reload')?.addEventListener('click', () => {
    location.reload();
  });
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
    select.innerHTML = '<option>선택 가능한 세션이 없습니다</option>';
    return;
  }

  // Sort latest first for dropdown
  const sortedDesc = [...activities].reverse();

  sortedDesc.forEach((act) => {
    const opt = document.createElement('option');
    opt.value = act.id;
    const tag = act.sub_sport === 'treadmill' ? '🏃 [트레드밀]' : '🌲 [야외 러닝]';
    opt.textContent = `${tag} ${act.date} (${act.time}) — ${act.distance_km}km | ${act.pace_formatted} | HR ${act.avg_hr} | EF ${act.ef}`;
    select.appendChild(opt);
  });

  // Default select first (latest)
  renderSingleSession(sortedDesc[0]);

  select.onchange = (e) => {
    const targetAct = activities.find(a => a.id === e.target.value);
    if (targetAct) renderSingleSession(targetAct);
  };
}

function renderSingleSession(act) {
  if (!act) return;

  // Sport badge
  const sportBadge = document.getElementById('session-sport-badge');
  if (sportBadge) {
    if (act.sub_sport === 'treadmill') {
      sportBadge.innerHTML = '🏃 실내 트레드밀';
      sportBadge.style.color = 'var(--accent-orange)';
      sportBadge.style.background = 'rgba(255, 87, 34, 0.15)';
    } else {
      sportBadge.innerHTML = '🌲 야외 러닝';
      sportBadge.style.color = 'var(--accent-lime)';
      sportBadge.style.background = 'rgba(16, 185, 129, 0.15)';
    }
  }

  // Basic metrics
  document.getElementById('single-dist').innerHTML = `${act.distance_km.toFixed(2)} <span class="unit">km</span>`;
  document.getElementById('single-duration').innerHTML = `<i class="bi bi-clock"></i> ${act.duration_formatted}`;
  document.getElementById('single-pace').innerHTML = `${act.pace_formatted} <span class="unit">/km</span>`;
  document.getElementById('single-speed').innerHTML = `<i class="bi bi-wind"></i> ${act.speed_m_per_min.toFixed(1)} m/min`;
  document.getElementById('single-hr').innerHTML = `${act.avg_hr} <span class="unit">bpm</span>`;
  document.getElementById('single-max-hr').innerHTML = `<i class="bi bi-graph-up-arrow"></i> 최고 ${act.max_hr} bpm`;

  // EF (Efficiency Factor)
  document.getElementById('single-ef').innerHTML = `${act.ef.toFixed(3)} <span class="unit">m/min/bpm</span>`;
  
  const efSub = document.getElementById('single-ef-status');
  if (act.ef >= 1.38) {
    efSub.innerHTML = `<i class="bi bi-fire text-lime"></i> <strong>최상급 유산소 엔진 (Elite Base)</strong>`;
  } else if (act.ef >= 1.30) {
    efSub.innerHTML = `<i class="bi bi-shield-check text-cyan"></i> <strong>우수한 유산소 효율성 (Good Conditioning)</strong>`;
  } else if (act.ef >= 1.15) {
    efSub.innerHTML = `<i class="bi bi-speedometer text-orange"></i> <strong>표준 유산소 베이스 (Moderate Base)</strong>`;
  } else {
    efSub.innerHTML = `<i class="bi bi-sun text-yellow"></i> <strong>야외 열 스트레스 or 웜업/리커버리</strong>`;
  }

  // Aerobic Decoupling
  const decouplingEl = document.getElementById('single-decoupling');
  const decTitle = document.getElementById('decoupling-title');
  const decDesc = document.getElementById('decoupling-desc');

  const decVal = act.aerobic_decoupling_pct;
  decouplingEl.textContent = `${decVal >= 0 ? '+' : ''}${decVal.toFixed(1)}%`;

  if (Math.abs(decVal) < 5.0) {
    decouplingEl.style.color = 'var(--accent-lime)';
    decTitle.textContent = '유산소 지구력 최적 안정 (Excellent Base)';
    decDesc.textContent = `후반부 페이스 대비 심박수 상승률(드리프트)이 ${decVal}%로 기준치(5% 미만)를 완벽히 충족합니다. 장거리 풀코스 완주에 매우 이상적인 상태입니다.`;
  } else if (decVal >= 5.0 && decVal <= 8.5) {
    decouplingEl.style.color = 'var(--accent-yellow)';
    decTitle.textContent = '경미한 심폐 드리프트 (Mild Cardiac Drift)';
    decDesc.textContent = `후반부 심폐 부하가 ${decVal}% 증가했습니다. 기온, 수분 섭취 부족 또는 훈련 후반부 피로 누적이 약간 발생했습니다.`;
  } else {
    decouplingEl.style.color = 'var(--accent-red)';
    decTitle.textContent = '후반부 심박 분리 심화 (High Fatigue / Decoupling)';
    decDesc.textContent = `후반부 심박수가 ${decVal}% 상승하여 심폐 탈진 및 피로도가 급증했습니다. 페이스 조절 및 충분한 휴식이 필요합니다.`;
  }

  // Dynamics & Specs
  document.getElementById('single-cadence').textContent = act.avg_cadence ? `${act.avg_cadence} spm` : '182 spm';
  document.getElementById('single-power').textContent = act.avg_power ? `${act.avg_power} W` : '320 W';
  document.getElementById('single-cal').textContent = `${act.calories} kcal`;
  
  // VDOT estimation
  const vdotEst = estimateVDOT(act.distance_km, act.duration_seconds);
  document.getElementById('single-vdot').textContent = vdotEst.toFixed(1);

  // Render Time Series Chart
  renderSingleChart(act);
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
  const labels = stream.map((s, idx) => `${((s.dist_m || 0) / 1000).toFixed(1)}k`);
  const hrData = stream.map(s => s.hr || null);
  const cadenceData = stream.map(s => s.cadence || null);

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
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#fff',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', maxTicksLimit: 10 }
        },
        yHr: {
          type: 'linear',
          position: 'left',
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#f43f5e' },
          suggestedMin: 120,
          suggestedMax: 180
        },
        yCad: {
          type: 'linear',
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: '#00f2fe' },
          suggestedMin: 150,
          suggestedMax: 200
        }
      }
    }
  });
}

/* ==========================================================================
   MODULE 2: WEEKLY RECAP & 10% RULE LOGIC
   ========================================================================== */
function initWeeklyRecap(activities) {
  const weekBuckets = [
    { id: 'W1', name: '8월 1주차', start: '2026-08-01', end: '2026-08-09', dateRange: '8/1 ~ 8/9', runs: [] },
    { id: 'W2', name: '8월 2주차', start: '2026-08-10', end: '2026-08-16', dateRange: '8/10 ~ 8/16', runs: [] },
    { id: 'W3', name: '8월 3주차', start: '2026-08-17', end: '2026-08-23', dateRange: '8/17 ~ 8/23', runs: [] },
    { id: 'W4', name: '8월 4주차', start: '2026-08-24', end: '2026-08-30', dateRange: '8/24 ~ 8/30', runs: [] },
    { id: 'W5', name: '8월 5주차', start: '2026-08-31', end: '2026-08-31', dateRange: '8/31 (월)', runs: [] }
  ];

  activities.forEach(act => {
    for (const w of weekBuckets) {
      if (act.date >= w.start && act.date <= w.end) {
        w.runs.push(act);
        break;
      }
    }
  });

  const weekStats = weekBuckets.map((w, idx) => {
    const totalDist = w.runs.reduce((acc, r) => acc + r.distance_km, 0);
    const totalTime = w.runs.reduce((acc, r) => acc + r.duration_seconds, 0);
    const avgHr = w.runs.length > 0 ? Math.round(w.runs.reduce((acc, r) => acc + r.avg_hr, 0) / w.runs.length) : 0;
    const avgEf = w.runs.length > 0 ? (w.runs.reduce((acc, r) => acc + r.ef, 0) / w.runs.length) : 0;
    
    const lsdDist = w.runs.length > 0 ? Math.max(...w.runs.map(r => r.distance_km)) : 0;
    const lsdRatio = totalDist > 0 ? ((lsdDist / totalDist) * 100).toFixed(0) : 0;

    let avgPaceStr = "-'--\"";
    if (totalDist > 0 && totalTime > 0) {
      const pSec = totalTime / totalDist;
      avgPaceStr = `${Math.floor(pSec / 60)}'${String(Math.round(pSec % 60)).padStart(2, '0')}"`;
    }

    let deltaPct = 0;
    let ruleStatus = 'safe';
    let ruleText = '기준 주간';

    if (idx > 0) {
      const prevDist = weekBuckets[idx - 1].runs.reduce((acc, r) => acc + r.distance_km, 0);
      if (prevDist > 0) {
        deltaPct = ((totalDist - prevDist) / prevDist) * 100;
        if (deltaPct > 20.0) {
          ruleStatus = 'danger';
          ruleText = `🔴 위험 (+${deltaPct.toFixed(1)}% 급증)`;
        } else if (deltaPct > 10.0) {
          ruleStatus = 'caution';
          ruleText = `🟡 주의 (+${deltaPct.toFixed(1)}% 증량)`;
        } else if (deltaPct < -15.0) {
          ruleStatus = 'recovery';
          ruleText = `🔵 회복주 (${deltaPct.toFixed(1)}% 감량)`;
        } else {
          ruleStatus = 'safe';
          ruleText = `🟢 안전 빌드업 (${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%)`;
        }
      } else {
        ruleText = `🟢 ${totalDist.toFixed(1)}km 러닝`;
      }
    } else {
      ruleText = `🟢 빌드업 시작 (${totalDist.toFixed(1)}km)`;
    }

    return {
      ...w,
      totalDist: Number(totalDist.toFixed(1)),
      runCount: w.runs.length,
      avgPace: avgPaceStr,
      avgHr,
      avgEf: Number(avgEf.toFixed(3)),
      lsdDist: Number(lsdDist.toFixed(1)),
      lsdRatio,
      deltaPct,
      ruleStatus,
      ruleText
    };
  });

  const container = document.getElementById('weekly-cards-list');
  if (container) {
    container.innerHTML = weekStats.map(w => `
      <div class="weekly-card">
        <div class="weekly-card-header">
          <span class="wc-week-title">${w.name}</span>
          <span class="wc-date-range">${w.dateRange}</span>
        </div>
        <div class="wc-distance text-orange">
          ${w.totalDist} <small>km</small>
        </div>
        <div class="rule-badge rule-${w.ruleStatus}">
          <i class="bi bi-shield-shaded"></i> ${w.ruleText}
        </div>
        <div class="wc-stats-list">
          <div class="wc-stat-row">
            <span>러닝 횟수</span>
            <span>${w.runCount}회</span>
          </div>
          <div class="wc-stat-row">
            <span>평균 페이스</span>
            <span>${w.avgPace}</span>
          </div>
          <div class="wc-stat-row">
            <span>평균 심박수</span>
            <span>${w.avgHr} bpm</span>
          </div>
          <div class="wc-stat-row">
            <span>최장 거리 (LSD)</span>
            <span>${w.lsdDist} km (${w.lsdRatio}%)</span>
          </div>
          <div class="wc-stat-row">
            <span>유산소 효율(EF)</span>
            <span class="text-lime">${w.avgEf > 0 ? w.avgEf : '-'}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  renderWeeklyChart(weekStats);
}

function renderWeeklyChart(weekStats) {
  const ctx = document.getElementById('weeklyChart')?.getContext('2d');
  if (!ctx) return;

  if (window.weeklyChartInstance) {
    window.weeklyChartInstance.destroy();
  }

  const labels = weekStats.map(w => w.name);
  const distances = weekStats.map(w => w.totalDist);
  const efs = weekStats.map(w => w.avgEf > 0 ? w.avgEf : null);

  window.weeklyChartInstance = new Chart(ctx, {
    data: {
      labels: labels,
      datasets: [
        {
          type: 'bar',
          label: '주간 마일리지 (km)',
          data: distances,
          backgroundColor: 'rgba(255, 87, 34, 0.85)',
          borderRadius: 8,
          yAxisID: 'yDist'
        },
        {
          type: 'line',
          label: '주간 평균 EF (심폐효율)',
          data: efs,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          pointBackgroundColor: '#10b981',
          pointRadius: 5,
          tension: 0.3,
          yAxisID: 'yEf'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        yDist: {
          type: 'linear',
          position: 'left',
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#ff5722' },
          title: { display: true, text: '거리 (km)', color: '#ff5722' }
        },
        yEf: {
          type: 'linear',
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: '#10b981' },
          suggestedMin: 1.0,
          suggestedMax: 1.5,
          title: { display: true, text: 'EF 지수', color: '#10b981' }
        }
      }
    }
  });
}

/* ==========================================================================
   MODULE 3: MONTHLY RECAP & INSTA CARD STUDIO
   ========================================================================== */
function initMonthlyRecap(activities, currentFilter) {
  if (activities.length === 0) return;

  const totalDist = activities.reduce((acc, a) => acc + a.distance_km, 0);
  const totalTimeSec = activities.reduce((acc, a) => acc + a.duration_seconds, 0);
  const totalCal = activities.reduce((acc, a) => acc + a.calories, 0);
  const avgHr = Math.round(activities.reduce((acc, a) => acc + a.avg_hr, 0) / activities.length);
  const maxLsd = Math.max(...activities.map(a => a.distance_km));
  const lsdAct = activities.find(a => a.distance_km === maxLsd);

  const paceSec = totalTimeSec / totalDist;
  const avgPaceStr = `${Math.floor(paceSec / 60)}'${String(Math.round(paceSec % 60)).padStart(2, '0')}"`;

  const hours = Math.floor(totalTimeSec / 3600);
  const minutes = Math.floor((totalTimeSec % 3600) / 60);

  // EF Growth Calculation
  let efGrowthPct = 0;
  if (activities.length >= 4) {
    const sampleCount = Math.min(3, Math.floor(activities.length / 2));
    const firstRuns = activities.slice(0, sampleCount);
    const lastRuns = activities.slice(-sampleCount);

    const firstAvgEf = firstRuns.reduce((acc, a) => acc + a.ef, 0) / sampleCount;
    const lastAvgEf = lastRuns.reduce((acc, a) => acc + a.ef, 0) / sampleCount;
    efGrowthPct = ((lastAvgEf - firstAvgEf) / firstAvgEf) * 100;
  }
  const avgEf = (activities.reduce((acc, a) => acc + a.ef, 0) / activities.length);

  // Update Monthly Stat Boxes
  document.getElementById('month-total-dist').innerHTML = `${totalDist.toFixed(1)} <small>km</small>`;
  document.getElementById('month-run-count').textContent = `총 ${activities.length}회 러닝 완료 (${currentFilter === 'treadmill' ? '트레드밀' : currentFilter === 'outdoor' ? '야외' : '종합'})`;
  document.getElementById('month-total-time').innerHTML = `${hours}<small>h</small> ${minutes}<small>m</small>`;
  document.getElementById('month-total-cal').textContent = `${totalCal.toLocaleString()} kcal 소모`;
  document.getElementById('month-avg-pace').innerHTML = `${avgPaceStr} <small>/km</small>`;
  document.getElementById('month-avg-hr').textContent = `평균 심박수 ${avgHr} bpm`;
  
  const efGrowthEl = document.getElementById('month-ef-growth');
  efGrowthEl.textContent = `${efGrowthPct >= 0 ? '+' : ''}${efGrowthPct.toFixed(1)}%`;
  efGrowthEl.className = 'm-val ' + (efGrowthPct >= 0 ? 'text-lime' : 'text-orange');

  // Update Insta Card
  document.getElementById('card-dist').innerHTML = `${totalDist.toFixed(1)} <span class="unit">KM</span>`;
  document.getElementById('card-runs').innerHTML = `${activities.length} <small>회</small>`;
  document.getElementById('card-pace').textContent = avgPaceStr;
  document.getElementById('card-time').textContent = `${hours}h ${minutes}m`;
  document.getElementById('card-hr').innerHTML = `${avgHr} <small>bpm</small>`;
  document.getElementById('card-lsd').textContent = `${maxLsd.toFixed(2)} km (${lsdAct?.date?.slice(5) || '8/29'})`;
  document.getElementById('card-ef').textContent = `${avgEf.toFixed(3)} (${efGrowthPct >= 0 ? '+' : ''}${efGrowthPct.toFixed(1)}%)`;

  // Theme switcher for Insta Card
  const themeBtns = document.querySelectorAll('.btn-theme');
  const instaCard = document.getElementById('instaCard');

  themeBtns.forEach(btn => {
    btn.onclick = () => {
      themeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const theme = btn.dataset.theme;
      instaCard.className = `insta-card theme-${theme}`;
    };
  });

  // Download Card as PNG Image
  const btnDownload = document.getElementById('btn-download-card');
  if (btnDownload) {
    btnDownload.onclick = () => {
      btnDownload.innerHTML = `<i class="bi bi-hourglass-split"></i> 렌더링 중...`;
      btnDownload.disabled = true;

      html2canvas(instaCard, {
        scale: 3,
        useCORS: true,
        backgroundColor: null
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = `RunAnalyz_August_Recap_${currentFilter}_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        btnDownload.innerHTML = `<i class="bi bi-check-circle-fill"></i> 저장 완료!`;
        setTimeout(() => {
          btnDownload.innerHTML = `<i class="bi bi-download"></i> 인스타 카드 저장하기`;
          btnDownload.disabled = false;
        }, 2000);
      }).catch(err => {
        console.error('Card export error:', err);
        alert('카드 이미지 저장 중 오류가 발생했습니다.');
        btnDownload.innerHTML = `<i class="bi bi-download"></i> 인스타 카드 저장하기`;
        btnDownload.disabled = false;
      });
    };
  }
}

/* ==========================================================================
   MODULE 4: RUNNING HEATMAP (GPS TRACKS OVERLAY)
   ========================================================================== */
function initRunningHeatmap(activities) {
  const mapContainer = document.getElementById('runningHeatmap');
  if (!mapContainer) return;

  let currentSportFilter = 'running'; // 'running' (default) or 'all'
  let currentTrackColor = '#ff5722';
  let polylineLayers = [];
  let allBounds = null;

  function getHeatmapActivities() {
    if (currentSportFilter === 'running') {
      return activities.filter(a => a.is_pure_running && a.has_gps && a.gps_points && a.gps_points.length > 5);
    }
    return activities.filter(a => a.has_gps && a.gps_points && a.gps_points.length > 5);
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
        window.leafletMap.fitBounds(allBounds, { padding: [60, 60], maxZoom: 16 });
      }
    }
  }

  function updateHeatmapDisplay() {
    const gpsActs = getHeatmapActivities();

    const trackCountEl = document.getElementById('hm-track-count');
    const totalDistEl = document.getElementById('hm-total-dist');
    if (trackCountEl && totalDistEl) {
      trackCountEl.textContent = `${gpsActs.length}개 코스`;
      const outdoorKm = gpsActs.reduce((acc, a) => acc + a.distance_km, 0);
      totalDistEl.textContent = `${outdoorKm.toFixed(1)} km`;
    }

    const routesContainer = document.getElementById('routes-grid-container');
    if (routesContainer) {
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

    drawTracks(currentTrackColor, gpsActs);
  }

  // Initial draw
  updateHeatmapDisplay();

  // Sport Toggle Buttons (Pure Running vs All)
  const hmFilterBtns = document.querySelectorAll('.hm-filter-btn');
  hmFilterBtns.forEach(btn => {
    btn.onclick = () => {
      hmFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSportFilter = btn.dataset.hmFilter;
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
        window.leafletMap.fitBounds(window.heatmapAllBounds, { padding: [60, 60], maxZoom: 16 });
      }
    };
  }

  // Quick Zoom: Namyangju Outdoor Runs (8/31, 8/24)
  const btnZoomNamyangju = document.getElementById('btn-zoom-namyangju');
  if (btnZoomNamyangju) {
    btnZoomNamyangju.onclick = () => {
      document.querySelectorAll('.map-quick-buttons .btn-ghost').forEach(b => b.classList.remove('active-ghost'));
      btnZoomNamyangju.classList.add('active-ghost');
      const allGps = activities.filter(a => a.has_gps && a.gps_points);
      const namyangjuRuns = allGps.filter(a => a.date.startsWith('2026-08-31') || a.date.startsWith('2026-08-24'));
      if (namyangjuRuns.length > 0) {
        let b = L.latLngBounds(namyangjuRuns[0].gps_points);
        namyangjuRuns.forEach(r => b.extend(r.gps_points));
        window.leafletMap.flyToBounds(b, { padding: [60, 60], maxZoom: 16, duration: 1.2 });
      }
    };
  }

  // Quick Zoom: Seoul Hiking/Walking (8/23, 8/30)
  const btnZoomSeoul = document.getElementById('btn-zoom-seoul');
  if (btnZoomSeoul) {
    btnZoomSeoul.onclick = () => {
      document.querySelectorAll('.map-quick-buttons .btn-ghost').forEach(b => b.classList.remove('active-ghost'));
      btnZoomSeoul.classList.add('active-ghost');
      const allGps = activities.filter(a => a.has_gps && a.gps_points);
      const seoulActs = allGps.filter(a => a.date.startsWith('2026-08-23') || a.date.startsWith('2026-08-30'));
      if (seoulActs.length > 0) {
        let b = L.latLngBounds(seoulActs[0].gps_points);
        seoulActs.forEach(r => b.extend(r.gps_points));
        window.leafletMap.flyToBounds(b, { padding: [60, 60], maxZoom: 16, duration: 1.2 });
      }
    };
  }
}

