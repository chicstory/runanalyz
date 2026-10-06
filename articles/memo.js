/**
 * 💬 RunAnalyz 아티클 전용 러너 실전 소감 & 팁 시스템 (memo.js)
 * 각 아티클별 고유 키를 기반으로 LocalStorage에 영구 보존되며, 날짜(YYYY-MM-DD)를 기록합니다.
 */

(function () {
    // 1. 현재 아티클 고유 ID 추출 (예: 'zone2-training-mitochondria')
    const pathParts = window.location.pathname.split('/');
    let articleId = pathParts[pathParts.length - 1] || 'default';
    articleId = articleId.replace('.html', '');
    const STORAGE_KEY = 'runanalyz_article_memo_' + articleId;

    let lastSubmitTime = 0;
    let currentCaptchaAns = 0;

    // 아티클별 기본 시드 팁 (초기 방문 시 노출)
    const DEFAULT_SEED_MAP = {
        'running-form-footstrike': [
            { author: "마포러너", date: "2026-10-05", text: "포어풋 억지로 흉내 내다가 아킬레스건 염증 생겼었는데, 원래 편한 뒤꿈치 착지로 돌아오니 통증 싹 사라졌습니다." },
            { author: "힐러너", date: "2026-10-06", text: "엘리트 94%가 뒤꿈치 착지라는 데이터 보고 안심했습니다. 케이던스만 신경 쓰는 중!" }
        ],
        'zone2-training-mitochondria': [
            { author: "서브3도전", date: "2026-10-05", text: "Zone 2 지키기가 제일 힘들었는데, 2달 버티니까 같은 심박에서 페이스가 30초 당겨집니다. 미토콘드리아 진짜 늘어나는 듯!" },
            { author: "런린이", date: "2026-10-06", text: "말할 수 있는 속도로 뛰라는 게 Zone 2였군요. 맨날 숨차게 뛰다가 페이스 낮추니 매일 뛰어도 안 피곤해요." }
        ],
        'shin-splints-tibial-stress': [
            { author: "정강이탈출", date: "2026-10-06", text: "전경골근 폼롤러 문지르지 말라는 거 진짜 꿀팁입니다. 가자미근 카프레이즈 일주일 하니까 통증 반으로 줄었어요." }
        ],
        'post-run-nutrition-glycogen-window': [
            { author: "초코러너", date: "2026-10-06", text: "10k 뛰고 편의점에서 초코우유 바로 마시기 시작했는데 다음 날 다리 무거움이 신기하게 사라졌습니다." }
        ]
    };

    function getTodayString() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function getStoredMemos() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (e) {
            console.error(e);
        }
        return DEFAULT_SEED_MAP[articleId] || [
            { author: "러너A", date: "2026-10-06", text: "아티클 읽고 오늘 러닝에 바로 적용해봤습니다. 도움 많이 되었습니다!" }
        ];
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

    function renderMemos() {
        const listBox = document.getElementById('articleMemoList');
        const badge = document.getElementById('memoCountBadge');
        if (!listBox) return;

        const memos = getStoredMemos();
        if (badge) badge.textContent = `${memos.length}개`;

        listBox.innerHTML = memos.map(m => `
            <div class="memo-item">
                <div class="memo-item-top">
                    <span class="memo-author">🏃 ${escapeHtml(m.author)}</span>
                    <span class="memo-time">${m.date || m.time || getTodayString()}</span>
                </div>
                <div class="memo-text">${escapeHtml(m.text)}</div>
            </div>
        `).join('');
    }

    function handleMemoSubmit(e) {
        e.preventDefault();

        const now = Date.now();
        if (now - lastSubmitTime < 10000) {
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
            date: getTodayString()
        };

        const memos = getStoredMemos();
        memos.unshift(newMemo);

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(memos.slice(0, 50)));
        } catch (e) {
            console.error(e);
        }

        lastSubmitTime = now;
        textInput.value = '';
        document.getElementById('memoAns').value = '';
        renderCaptcha();
        renderMemos();
    }

    document.addEventListener('DOMContentLoaded', () => {
        renderCaptcha();
        renderMemos();

        const form = document.getElementById('articleMemoForm');
        if (form) {
            form.addEventListener('submit', handleMemoSubmit);
        }
    });
})();
