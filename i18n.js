/**
 * RunAnalyz / RunAnalyz - Multi-Language (i18n) Engine & Translation Dictionaries
 * Supports: KO (한국어), EN (English), JA (日本語), ES (Español)
 * Feature: 100% Client-Side Auto-Detection via navigator.language
 */

(function () {
  'use strict';

  const TRANSLATIONS = {
    ko: {
      brand_sub: "RUNNING & AEROBIC EF ENGINE",
      period_filter: "기간 필터:",
      period_all_years: "전체 누적 (2017~2026)",
      period_year_suffix: "년",
      period_all_months: "연간 전체",
      period_month_suffix: "월",
      btn_refresh: "새로고침",
      nav_guide: "가이드",
      nav_about: "소개·문의",
      
      // Sport Filter
      filter_label: "훈련 환경 필터",
      filter_all: "전체 보기",
      filter_treadmill: "실내 트레드밀",
      filter_outdoor: "야외 러닝",

      // Tabs
      tab_single: "단일 세션",
      tab_single_sub: "데일리 EF 분석",
      tab_weekly: "주간 정산",
      tab_weekly_sub: "10% 룰 & 부상 진단",
      tab_monthly: "월간 결산",
      tab_monthly_sub: "인스타 카드 생성",
      tab_yearly: "연간 결산",
      tab_yearly_sub: "마일리지 & 유산소 EF",
      tab_heatmap: "러닝 히트맵",
      tab_heatmap_sub: "GPS 코스 아카이브",

      // Metric Cards
      session_select_label: "분석할 러닝 세션 선택",
      session_count_prefix: "총",
      session_count_suffix: "개 세션",
      metric_dist: "달린 거리",
      metric_pace: "평균 페이스",
      metric_hr: "평균 심박수",
      metric_max_hr: "최고",
      metric_ef: "유산소 효율 (EF)",
      core_engine: "CORE ENGINE",

      // EF Evaluations
      ef_elite: "최상급 유산소 엔진 (Elite Base)",
      ef_good: "우수한 유산소 효율성 (Good Conditioning)",
      ef_mod: "표준 유산소 베이스 (Moderate Base)",
      ef_adapt: "초기 유산소 적응 or 웜업/리커버리",

      // Decoupling
      decoupling_title: "유산소 디커플링 (심박 드리프트)",
      decoupling_crit: "기준: 5% 미만 권장",
      dec_excellent_title: "유산소 지구력 최적 안정 (Excellent Base)",
      dec_excellent_desc: "후반부 페이스 대비 심박수 상승률(드리프트)이 5% 미만으로 유산소 베이스가 매우 탄탄합니다.",
      dec_mild_title: "경미한 심폐 드리프트 (Mild Cardiac Drift)",
      dec_mild_desc: "후반부 심폐 부하가 약간 증가했습니다. 기온 또는 훈련 후반부 피로 누적이 발생했습니다.",
      dec_high_title: "후반부 심박 분리 심화 (High Fatigue)",
      dec_high_desc: "후반부 심박수가 급격히 상승하여 심폐 탈진 및 피로도가 급증했습니다.",

      // VDOT & 5 Paces
      vdot_title: "VDOT & 5대 훈련 페이스",
      vdot_banner_desc: "이 세션 기록(거리·시간) 기반의 최대산소섭취능력(VDOT)과 <strong>5대 권장 훈련 페이스</strong>입니다.",
      pace_e_code: "E 페이스",
      pace_e_name: "이지·회복",
      pace_e_desc: "Zone 2 기초 유산소",
      pace_m_code: "M 페이스",
      pace_m_name: "마라톤",
      pace_m_desc: "풀코스 목표 (LT1)",
      pace_t_code: "T 페이스",
      pace_t_name: "역치·템포",
      pace_t_desc: "젖산 역치 (LT2)",
      pace_i_code: "I 페이스",
      pace_i_name: "인터벌",
      pace_i_desc: "VO2max 산소 확장",
      pace_r_code: "R 페이스",
      pace_r_name: "레피티션",
      pace_r_desc: "무산소 스피드 & 자세",

      // Thresholds LT1 / LT2
      thresh_card_title: "유산소 역치(LT1) & 젖산 역치(LT2) 생체 진단",
      thresh_analyzing: "분석 중...",
      thresh_qualified_badge: "실측 변곡점 분석 완료",
      thresh_estimated_badge: "추정 역치 모델 (평지 빌드업 미충족)",
      thresh_lt1_title: "1차 변곡점: 유산소 역치 (LT1 / VT1)",
      thresh_lt2_title: "2차 변곡점: 젖산 역치 (LT2 / VT2)",
      thresh_hr_label: "전환 심박수",
      thresh_limit_hr_label: "한계 심박수",
      thresh_pace_label: "기준 페이스",
      thresh_lt1_desc: "순수 지방 대사(Zone 2)에서 탄수화물 글리코겐이 본격 동원되기 시작하는 생체 전환점입니다. EF 수치가 최고점을 기록한 뒤 완만하게 기울기를 낮추는 기준선(마라톤 M 페이스)입니다.",
      thresh_lt2_desc: "젖산 생성 속도가 제거 능력을 초과하여 체내 젖산(4.0 mmol/L)이 급증하는 무산소 역치(HRDP)입니다. 심박수는 치솟으나 속도 효율이 한계에 부딪혀 EF 곡선이 급락하는 템포(T) 페이스 한계선입니다.",

      // Chart
      chart_stream_title: "주행 중 심박수 & 케이던스 스트림",
      chart_badge_sub: "1초 단위 타임시리즈",

      // Weekly
      weekly_sub: "MARATHON MILEAGE & 10% PROGRESSION RULE",
      weekly_title: "주차별 마일리지 빌드업 & 부상 위험 진단",
      weekly_desc: "마라톤 부상 방지의 황금률인 10% Rule(전주 대비 주간 거리 증가율 10% 이내)과 LSD(최장 런) 비율을 실시간 진단합니다.",
      weekly_chart_title: "주차별 마일리지 변동 및 평균 EF 추세",

      // Monthly
      monthly_sub: "MONTHLY RECAP & SOCIAL STORY STUDIO",
      monthly_title: "월간 마일리지 & 인스타 카드 스튜디오",
      monthly_desc: "한 달간의 총 누적 거리와 평균 페이스, 심폐 유산소 효율(EF) 추이를 확인하고 감각적인 인스타그램 스토리 카드로 저장하세요.",
      monthly_stat_dist: "월간 총 마일리지",
      monthly_stat_runs: "총 러닝 세션",
      monthly_stat_pace: "월간 평균 페이스",
      monthly_stat_ef: "월간 평균 EF (심폐효율)",
      studio_ctrl_title: "스토리 카드 디자인 설정",
      studio_theme_label: "비주얼 테마 선택",
      studio_aspect_label: "화면 비율 (인스타그램 규격)",
      studio_bg_label: "러닝 사진 업로드 (선택)",
      btn_download_story: "스토리 카드 다운로드 (3x Ultra HD)",
      btn_share_story: "모바일 인스타로 공유하기",

      // Heatmap
      heatmap_filter_run: "러닝",
      heatmap_filter_all: "전체 활동",
      heatmap_btn_reset: "코스 전체 보기",
      heatmap_neon_orange: "오렌지",
      heatmap_neon_cyan: "네온 사이언",
      heatmap_neon_pink: "네온 핑크",
      heatmap_neon_lime: "라임 그린",
      heatmap_route_title: "러닝 코스 GPS 궤적",
      heatmap_stat_routes: "기록된 코스 수",
      heatmap_stat_top_loc: "최다 주행 지역",
      heatmap_stat_longest: "인생 최장거리 코스",

      // Footer
      footer_privacy: "개인정보처리방침",
      footer_terms: "이용약관 & 크레딧",
      footer_rights: "All rights reserved. 100% Client-side Secure Computation."
    },

    en: {
      brand_sub: "RUNNING & AEROBIC EF ENGINE",
      period_filter: "Period Filter:",
      period_all_years: "All Time (2017~2026)",
      period_year_suffix: "",
      period_all_months: "All Months",
      period_month_suffix: "",
      btn_refresh: "Refresh",
      nav_guide: "Guide",
      nav_about: "About & Contact",

      // Sport Filter
      filter_label: "Sport Environment Filter",
      filter_all: "All Activities",
      filter_treadmill: "Indoor Treadmill",
      filter_outdoor: "Outdoor Running",

      // Tabs
      tab_single: "Single Session",
      tab_single_sub: "Daily EF Analytics",
      tab_weekly: "Weekly Recap",
      tab_weekly_sub: "10% Rule & Injury Audit",
      tab_monthly: "Monthly Studio",
      tab_monthly_sub: "Social Story Card Generator",
      tab_yearly: "Yearly Archive",
      tab_yearly_sub: "Mileage & Aerobic EF",
      tab_heatmap: "Running Heatmap",
      tab_heatmap_sub: "GPS Route Archive",

      // Metric Cards
      session_select_label: "Select Running Session to Analyze",
      session_count_prefix: "Total",
      session_count_suffix: "Sessions",
      metric_dist: "Distance",
      metric_pace: "Avg Pace",
      metric_hr: "Avg Heart Rate",
      metric_max_hr: "Max",
      metric_ef: "Efficiency Factor (EF)",
      core_engine: "CORE ENGINE",

      // EF Evaluations
      ef_elite: "Elite Aerobic Engine (Elite Base)",
      ef_good: "Good Conditioning (Strong Base)",
      ef_mod: "Moderate Aerobic Base",
      ef_adapt: "Early Adaptation or Warmup/Recovery",

      // Decoupling
      decoupling_title: "Aerobic Decoupling (Cardiac Drift)",
      decoupling_crit: "Benchmark: < 5% Recommended",
      dec_excellent_title: "Optimal Aerobic Base (Excellent Stability)",
      dec_excellent_desc: "Cardiac drift in the 2nd half remained under 5%, indicating rock-solid aerobic endurance.",
      dec_mild_title: "Mild Cardiac Drift",
      dec_mild_desc: "Cardiovascular demand increased slightly in the 2nd half due to temperature or late-session fatigue.",
      dec_high_title: "Significant Cardiac Drift (High Fatigue)",
      dec_high_desc: "Heart rate drifted noticeably in the 2nd half, reflecting cardiovascular strain and exhaustion.",

      // VDOT & 5 Paces
      vdot_title: "VDOT & 5 Training Paces",
      vdot_banner_desc: "Estimated VO2max power (VDOT) and <strong>5 recommended training paces</strong> based on this session's distance and duration.",
      pace_e_code: "E Pace",
      pace_e_name: "Easy & Recovery",
      pace_e_desc: "Zone 2 Aerobic Base",
      pace_m_code: "M Pace",
      pace_m_name: "Marathon",
      pace_m_desc: "Target Race Pace (LT1)",
      pace_t_code: "T Pace",
      pace_t_name: "Threshold & Tempo",
      pace_t_desc: "Lactate Threshold (LT2)",
      pace_i_code: "I Pace",
      pace_i_name: "Interval",
      pace_i_desc: "VO2max Expansion",
      pace_r_code: "R Pace",
      pace_r_name: "Repetition",
      pace_r_desc: "Anaerobic Speed & Economy",

      // Thresholds LT1 / LT2
      thresh_card_title: "Aerobic (LT1) & Lactate (LT2) Threshold Diagnostics",
      thresh_analyzing: "Analyzing...",
      thresh_qualified_badge: "Empirical Inflection Points Verified",
      thresh_estimated_badge: "Estimated Model (Progressive Ramp Needed)",
      thresh_lt1_title: "1st Inflection: Aerobic Threshold (LT1 / VT1)",
      thresh_lt2_title: "2nd Inflection: Lactate Threshold (LT2 / VT2)",
      thresh_hr_label: "Transition HR",
      thresh_limit_hr_label: "Threshold HR",
      thresh_pace_label: "Target Pace",
      thresh_lt1_desc: "The physiological crossover from pure fat oxidation (Zone 2) to progressive carbohydrate burning. Marks the peak plateau of your EF curve (Marathon M Pace boundary).",
      thresh_lt2_desc: "The anaerobic threshold (HRDP) where lactate generation exceeds clearance (4.0 mmol/L). Speed efficiency hits a ceiling and the EF curve plunges abruptly (Tempo T Pace boundary).",

      // Chart
      chart_stream_title: "Heart Rate & Cadence Time Series",
      chart_badge_sub: "1-Second Resolution Stream",

      // Weekly
      weekly_sub: "MARATHON MILEAGE & 10% PROGRESSION RULE",
      weekly_title: "Weekly Mileage Progression & Overuse Injury Audit",
      weekly_desc: "Real-time audit of the golden marathon safety guideline: The 10% Rule (weekly volume bump < 10%) and Long Run ratio.",
      weekly_chart_title: "Weekly Mileage Fluctuation & Avg EF Trend",

      // Monthly
      monthly_sub: "MONTHLY RECAP & SOCIAL STORY STUDIO",
      monthly_title: "Monthly Volume & Story Studio",
      monthly_desc: "Review your monthly cumulative distance, pace, and aerobic efficiency (EF) trend, then export sleek Instagram Story cards.",
      monthly_stat_dist: "Total Monthly Distance",
      monthly_stat_runs: "Total Running Sessions",
      monthly_stat_pace: "Avg Monthly Pace",
      monthly_stat_ef: "Avg Monthly EF",
      studio_ctrl_title: "Story Card Customization",
      studio_theme_label: "Visual Theme",
      studio_aspect_label: "Aspect Ratio",
      studio_bg_label: "Custom Background Photo (Optional)",
      btn_download_story: "Download Story Card (3x Ultra HD)",
      btn_share_story: "Share to Instagram",

      // Heatmap
      heatmap_filter_run: "Running",
      heatmap_filter_all: "All Activities",
      heatmap_btn_reset: "Fit All Routes",
      heatmap_neon_orange: "Neon Orange",
      heatmap_neon_cyan: "Neon Cyan",
      heatmap_neon_pink: "Neon Pink",
      heatmap_neon_lime: "Lime Green",
      heatmap_route_title: "Running GPS Heatmap",
      heatmap_stat_routes: "Recorded Routes",
      heatmap_stat_top_loc: "Top Running Region",
      heatmap_stat_longest: "Longest Course",

      // Footer
      footer_privacy: "Privacy Policy",
      footer_terms: "Terms & Credits",
      footer_rights: "All rights reserved. 100% Client-side Secure Computation."
    },

    ja: {
      brand_sub: "RUNNING & AEROBIC EF ENGINE",
      period_filter: "期間フィルター:",
      period_all_years: "全期間 (2017~2026)",
      period_year_suffix: "年",
      period_all_months: "年間すべて",
      period_month_suffix: "月",
      btn_refresh: "更新",
      nav_guide: "ガイド",
      nav_about: "紹介・問い合わせ",

      // Sport Filter
      filter_label: "トレーニング環境フィルター",
      filter_all: "すべて表示",
      filter_treadmill: "屋内トレッドミル",
      filter_outdoor: "屋外ランニング",

      // Tabs
      tab_single: "単一セッション",
      tab_single_sub: "デイリーEF分析",
      tab_weekly: "週間集計",
      tab_weekly_sub: "10%ルール＆怪我診断",
      tab_monthly: "月間決算",
      tab_monthly_sub: "インスタカード作成",
      tab_yearly: "年間アーカイブ",
      tab_yearly_sub: "走行距離＆有酸素EF",
      tab_heatmap: "ランニングヒートマップ",
      tab_heatmap_sub: "GPSコース記録",

      // Metric Cards
      session_select_label: "分析するランニングセッションを選択",
      session_count_prefix: "全",
      session_count_suffix: "件のセッション",
      metric_dist: "走行距離",
      metric_pace: "平均ペース",
      metric_hr: "平均心拍数",
      metric_max_hr: "最高",
      metric_ef: "有酸素運動効率 (EF)",
      core_engine: "CORE ENGINE",

      // EF Evaluations
      ef_elite: "最上級の有酸素エンジン (Elite Base)",
      ef_good: "優れた有酸素効率 (Good Conditioning)",
      ef_mod: "標準的な有酸素ベース (Moderate Base)",
      ef_adapt: "有酸素適応期 / ウォーミングアップ",

      // Decoupling
      decoupling_title: "有酸素デカップリング (心拍ドリフト)",
      decoupling_crit: "推奨基準: 5% 未満",
      dec_excellent_title: "有酸素持久力 最適安定 (Excellent Base)",
      dec_excellent_desc: "後半の心拍ドリフトが5%未満に保たれ、強固な有酸素ベースが実証されています。",
      dec_mild_title: "軽度の心拍ドリフト (Mild Drift)",
      dec_mild_desc: "後半にわずかな心拍上昇が見られます。気温または後半の疲労が影響しています。",
      dec_high_title: "後半の心拍急増 (High Fatigue)",
      dec_high_desc: "後半の心拍数が大幅に上昇し、心肺疲労が限界に近づいています。",

      // VDOT & 5 Paces
      vdot_title: "VDOT＆5大推奨トレーニングペース",
      vdot_banner_desc: "今回のセッション記録（距離・時間）に基づく最大酸素摂取能力(VDOT)と<strong>5大推奨ペース</strong>です。",
      pace_e_code: "Eペース",
      pace_e_name: "イージー・回復",
      pace_e_desc: "Zone 2 基礎有酸素",
      pace_m_code: "Mペース",
      pace_m_name: "マラソン目標",
      pace_m_desc: "レース標準 (LT1)",
      pace_t_code: "Tペース",
      pace_t_name: "閾値・テンポ",
      pace_t_desc: "乳酸性作業閾値 (LT2)",
      pace_i_code: "Iペース",
      pace_i_name: "インターバル",
      pace_i_desc: "VO2max 有酸素拡大",
      pace_r_code: "Rペース",
      pace_r_name: "レペティション",
      pace_r_desc: "無酸素スピード＆フォーム",

      // Thresholds LT1 / LT2
      thresh_card_title: "有酸素閾値(LT1)＆乳酸閾値(LT2) 生体診断",
      thresh_analyzing: "解析中...",
      thresh_qualified_badge: "実測変曲点の解析完了",
      thresh_estimated_badge: "推定モデル（ビルドアップ条件未達）",
      thresh_lt1_title: "第1変曲点: 有酸素性作業閾値 (LT1 / VT1)",
      thresh_lt2_title: "第2変曲点: 乳酸性作業閾値 (LT2 / VT2)",
      thresh_hr_label: "転換心拍数",
      thresh_limit_hr_label: "限界心拍数",
      thresh_pace_label: "基準ペース",
      thresh_lt1_desc: "純粋な脂肪代謝(Zone 2)からグリコーゲン動員が本格化する生理学的分岐点です。EFがピークに達した後に緩やかに下降する基準線（マラソンMペース）です。",
      thresh_lt2_desc: "乳酸生成速度が除去能力を超え、血中乳酸(4.0 mmol/L)が急増する無酸素性閾値です。速度効率が限界に達しEF曲線が崖のように急落するテンポ(T)ペース限界です。",

      // Chart
      chart_stream_title: "走行中 心拍数＆ケイデンス 推移",
      chart_badge_sub: "1秒単位ストリーム",

      // Weekly
      weekly_sub: "MARATHON MILEAGE & 10% PROGRESSION RULE",
      weekly_title: "週別走行距離ビルドアップ＆怪我リスク診断",
      weekly_desc: "マラソンの怪我防止黄金律である「10%ルール（前週比の距離増加10%以内）」とLSD比率をリアルタイム診断します。",
      weekly_chart_title: "週別走行距離の変動と平均EF推移",

      // Monthly
      monthly_sub: "MONTHLY RECAP & SOCIAL STORY STUDIO",
      monthly_title: "月間走行距離＆ストーリースタジオ",
      monthly_desc: "月間の総距離・平均ペース・有酸素効率(EF)推移を確認し、洗練されたInstagramストーリーカードを作成できます。",
      monthly_stat_dist: "月間総走行距離",
      monthly_stat_runs: "月間ランニング回数",
      monthly_stat_pace: "月間平均ペース",
      monthly_stat_ef: "月間平均EF (心肺効率)",
      studio_ctrl_title: "カードデザイン設定",
      studio_theme_label: "ビジュアルテーマ",
      studio_aspect_label: "画面比率 (Instagram規格)",
      studio_bg_label: "写真アップロード (任意)",
      btn_download_story: "ストーリーカード保存 (3x Ultra HD)",
      btn_share_story: "Instagramにシェアする",

      // Heatmap
      heatmap_filter_run: "ランニング",
      heatmap_filter_all: "全アクティビティ",
      heatmap_btn_reset: "コース全体を表示",
      heatmap_neon_orange: "オレンジ",
      heatmap_neon_cyan: "ネオンシアン",
      heatmap_neon_pink: "ネオンピンク",
      heatmap_neon_lime: "ライムグリーン",
      heatmap_route_title: "GPSヒートマップ軌跡",
      heatmap_stat_routes: "記録コース数",
      heatmap_stat_top_loc: "最多走行地域",
      heatmap_stat_longest: "自己最長コース",

      // Footer
      footer_privacy: "プライバシーポリシー",
      footer_terms: "利用規約＆クレジット",
      footer_rights: "All rights reserved. 100% Client-side Secure Computation."
    },

    es: {
      brand_sub: "RUNNING & AEROBIC EF ENGINE",
      period_filter: "Filtro de Período:",
      period_all_years: "Histórico Total (2017~2026)",
      period_year_suffix: "",
      period_all_months: "Todo el Año",
      period_month_suffix: "",
      btn_refresh: "Actualizar",
      nav_guide: "Guía",
      nav_about: "Acerca de y Contacto",

      // Sport Filter
      filter_label: "Filtro de Entorno Deportivo",
      filter_all: "Todas las Actividades",
      filter_treadmill: "Cinta de Correr",
      filter_outdoor: "Carrera al Aire Libre",

      // Tabs
      tab_single: "Sesión Individual",
      tab_single_sub: "Análisis Diario de EF",
      tab_weekly: "Resumen Semanal",
      tab_weekly_sub: "Regla del 10% y Lesiones",
      tab_monthly: "Estudio Mensual",
      tab_monthly_sub: "Generador de Historias",
      tab_yearly: "Archivo Anual",
      tab_yearly_sub: "Kilometraje y EF Aeróbico",
      tab_heatmap: "Mapa de Calor",
      tab_heatmap_sub: "Rutas GPS Guardadas",

      // Metric Cards
      session_select_label: "Seleccionar Sesión de Running para Analizar",
      session_count_prefix: "Total",
      session_count_suffix: "Sesiones",
      metric_dist: "Distancia",
      metric_pace: "Ritmo Medio",
      metric_hr: "FC Media",
      metric_max_hr: "Máx",
      metric_ef: "Factor de Eficiencia (EF)",
      core_engine: "CORE ENGINE",

      // EF Evaluations
      ef_elite: "Motor Aeróbico Élite (Elite Base)",
      ef_good: "Excelente Eficiencia Aeróbica",
      ef_mod: "Base Aeróbica Moderada",
      ef_adapt: "Adaptación Inicial o Calentamiento",

      // Decoupling
      decoupling_title: "Desacoplamiento Aeróbico (Deriva Cardíaca)",
      decoupling_crit: "Referencia: < 5% Recomendado",
      dec_excellent_title: "Base Aeróbica Óptima (Excelente Estabilidad)",
      dec_excellent_desc: "La deriva cardíaca en la segunda mitad fue inferior al 5%, lo que demuestra una sólida base aeróbica.",
      dec_mild_title: "Deriva Cardíaca Leve",
      dec_mild_desc: "La carga cardiovascular aumentó ligeramente en la segunda mitad por temperatura o fatiga tardía.",
      dec_high_title: "Deriva Cardíaca Severa (Alta Fatiga)",
      dec_high_desc: "La frecuencia cardíaca aumentó drásticamente en la segunda mitad, indicando fatiga y agotamiento.",

      // VDOT & 5 Paces
      vdot_title: "VDOT y 5 Ritmos de Entrenamiento",
      vdot_banner_desc: "Potencia aeróbica estimada (VDOT) y <strong>5 ritmos recomendados</strong> calculados a partir de esta sesión.",
      pace_e_code: "Ritmo E",
      pace_e_name: "Suave y Recuperación",
      pace_e_desc: "Zona 2 Base Aeróbica",
      pace_m_code: "Ritmo M",
      pace_m_name: "Maratón",
      pace_m_desc: "Ritmo Objetivo (LT1)",
      pace_t_code: "Ritmo T",
      pace_t_name: "Umbral y Tempo",
      pace_t_desc: "Umbral de Lactato (LT2)",
      pace_i_code: "Ritmo I",
      pace_i_name: "Intervalos",
      pace_i_desc: "Expansión del VO2máx",
      pace_r_code: "Ritmo R",
      pace_r_name: "Repetición",
      pace_r_desc: "Velocidad y Economía",

      // Thresholds LT1 / LT2
      thresh_card_title: "Diagnóstico Biológico de Umbrales (LT1 y LT2)",
      thresh_analyzing: "Analizando...",
      thresh_qualified_badge: "Puntos de Inflexión Verificados",
      thresh_estimated_badge: "Modelo Estimado (Rampa Progresiva Requerida)",
      thresh_lt1_title: "1ª Inflexión: Umbral Aeróbico (LT1 / VT1)",
      thresh_lt2_title: "2ª Inflexión: Umbral de Lactato (LT2 / VT2)",
      thresh_hr_label: "FC de Transición",
      thresh_limit_hr_label: "FC Límite",
      thresh_pace_label: "Ritmo de Referencia",
      thresh_lt1_desc: "La transición biológica de la quema exclusiva de grasas (Zona 2) al uso de carbohidratos. Marca el punto culminante de la curva EF (límite del ritmo Maratón M).",
      thresh_lt2_desc: "El umbral anaeróbico donde la producción de lactato supera la tasa de aclaramiento (4.0 mmol/L). La curva de EF cae en picada (límite del ritmo Tempo T).",

      // Chart
      chart_stream_title: "Frecuencia Cardíaca y Cadencia en Tiempo Real",
      chart_badge_sub: "Resolución de 1 Segundo",

      // Weekly
      weekly_sub: "KILOMETRAJE Y REGLA DE PROGRESIÓN DEL 10%",
      weekly_title: "Progresión Semanal y Auditoría de Lesiones",
      weekly_desc: "Diagnóstico en tiempo real de la regla de oro: incremento semanal menor al 10% y proporción de tiradas largas.",
      weekly_chart_title: "Variación del Kilometraje Semanal y Tendencia de EF",

      // Monthly
      monthly_sub: "RESUMEN MENSUAL Y ESTUDIO SOCIAL",
      monthly_title: "Volumen Mensual y Tarjetas de Historia",
      monthly_desc: "Comprueba tu kilometraje acumulado, ritmo medio y evolución de EF, y expórtalo en atractivas tarjetas para Instagram.",
      monthly_stat_dist: "Distancia Mensual Total",
      monthly_stat_runs: "Sesiones de Running",
      monthly_stat_pace: "Ritmo Medio Mensual",
      monthly_stat_ef: "EF Medio (Eficiencia)",
      studio_ctrl_title: "Personalización de Tarjetas",
      studio_theme_label: "Tema Visual",
      studio_aspect_label: "Formato de Pantalla",
      studio_bg_label: "Foto de Fondo Personalizada (Opcional)",
      btn_download_story: "Descargar Tarjeta (3x Ultra HD)",
      btn_share_story: "Compartir en Instagram",

      // Heatmap
      heatmap_filter_run: "Carrera",
      heatmap_filter_all: "Todas las Actividades",
      heatmap_btn_reset: "Ver Todas las Rutas",
      heatmap_neon_orange: "Naranja Neón",
      heatmap_neon_cyan: "Cian Neón",
      heatmap_neon_pink: "Rosa Neón",
      heatmap_neon_lime: "Verde Lima",
      heatmap_route_title: "Trayectorias GPS de Running",
      heatmap_stat_routes: "Rutas Registradas",
      heatmap_stat_top_loc: "Zona Más Frecuente",
      heatmap_stat_longest: "Ruta Más Larga",

      // Footer
      footer_privacy: "Política de Privacidad",
      footer_terms: "Términos y Créditos",
      footer_rights: "Todos los derechos reservados. Computación 100% segura en el navegador."
    }
  };

  /**
   * Automatically detects the visitor's language based on browser locale.
   * Priority: localStorage (if set) -> navigator.language prefix -> default 'en'.
   */
  function detectBrowserLanguage() {
    try {
      const saved = localStorage.getItem('runanalyz_lang');
      if (saved && TRANSLATIONS[saved]) {
        return saved;
      }
    } catch (e) {
      // localStorage may be restricted in private browsing
    }

    const navLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    if (navLang.startsWith('ko')) return 'ko';
    if (navLang.startsWith('ja')) return 'ja';
    if (navLang.startsWith('es')) return 'es';
    return 'en'; // Default international fallback
  }

  let currentLanguage = detectBrowserLanguage();

  /**
   * Retrieves translation for a specific key.
   */
  function t(key, fallback) {
    const dict = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;
    if (dict && typeof dict[key] !== 'undefined') {
      return dict[key];
    }
    const enDict = TRANSLATIONS.en;
    if (enDict && typeof enDict[key] !== 'undefined') {
      return enDict[key];
    }
    return fallback || key;
  }

  /**
   * Applies translations to all elements with data-i18n attributes.
   */
  function applyTranslations(lang) {
    if (lang && TRANSLATIONS[lang]) {
      currentLanguage = lang;
    }

    // Set document lang attribute
    document.documentElement.lang = currentLanguage;

    // Translate textContent
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = t(key);
      if (val) {
        if (el.getAttribute('data-i18n-html') === 'true') {
          el.innerHTML = val;
        } else {
          el.textContent = val;
        }
      }
    });

    // Translate titles / tooltips
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const val = t(key);
      if (val) el.setAttribute('title', val);
    });

    // Translate placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const val = t(key);
      if (val) el.setAttribute('placeholder', val);
    });
  }

  // Initialize on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyTranslations());
  } else {
    applyTranslations();
  }

  // Expose to window for app.js
  window.I18N = {
    detect: detectBrowserLanguage,
    getLang: () => currentLanguage,
    setLang: (lang) => {
      if (TRANSLATIONS[lang]) {
        currentLanguage = lang;
        applyTranslations(lang);
      }
    },
    t: t,
    apply: applyTranslations
  };

})();
