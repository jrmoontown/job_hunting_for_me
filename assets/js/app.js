/**
 * 앱 진입점 — 라우팅, 네비게이션, 테마, 동기화 배선.
 */
import { load, subscribe, getSettings, persistSettings, getJobs, getTodos, ddayOf } from './store.js';
import { isOpenStatus } from './seed.js';
import { icons } from './ui.js';
import { syncNow, onSyncState, isConfigured, getSyncState } from './sync.js';
import { renderCalendar } from './views/calendar.js';
import { renderJobs } from './views/jobs.js';
import { renderTodos } from './views/todos.js';
import { renderDashboard } from './views/dashboard.js';
import { renderSettings } from './views/settings.js';
import { renderPipeline, pipelineStats, overdueResultCount } from './views/pipeline.js';
import { openJobForm } from './views/jobShared.js';
import { openTodoForm } from './views/todos.js';
import { openAddChooser } from './views/events.js';
import { getPlan } from './plan.js';

const ROUTES = {
  calendar: { title: '캘린더', icon: 'calendar', render: renderCalendar, caption: () => monthCaption() },
  jobs: { title: '공고', icon: 'briefcase', render: renderJobs, caption: () => jobsCaption() },
  pipeline: { title: '전형', icon: 'pipeline', render: renderPipeline, caption: () => pipelineCaption() },
  todos: { title: '투두', icon: 'check', render: renderTodos, caption: () => todosCaption() },
  dashboard: { title: '현황', icon: 'chart', render: (el2) => renderDashboard(el2, { goTo }), caption: () => '' },
  settings: { title: '설정', icon: 'gear', render: (el2) => renderSettings(el2, { applyTheme }), caption: () => '' },
};
/** 모바일 하단 탭은 다섯 개까지 — 설정은 상단 톱니 아이콘으로 */
const TAB_ORDER = ['calendar', 'jobs', 'pipeline', 'todos', 'dashboard'];
const SIDE_ORDER = ['calendar', 'jobs', 'pipeline', 'todos', 'dashboard', 'settings'];

const view = document.getElementById('view');
let current = '';

/* ------------------------------------------------------------------ */
/* 캡션                                                                */
/* ------------------------------------------------------------------ */
function monthCaption() {
  const open = getJobs().filter((j) => isOpenStatus(j.status));
  const week = open.filter((j) => {
    const d = ddayOf(j.deadline);
    return d !== null && d >= 0 && d <= 6;
  });
  const conflicts = getPlan().plans.size;
  const head = week.length ? `이번 주 마감 ${week.length}건` : `지원 예정 ${open.length}건`;
  return conflicts ? `${head} · 조정 필요 ${conflicts}건` : head;
}
function jobsCaption() {
  const jobs = getJobs();
  const open = jobs.filter((j) => isOpenStatus(j.status)).length;
  return `예정 ${open}건 · 완료 ${jobs.length - open}건`;
}
function pipelineCaption() {
  const s = pipelineStats();
  if (!s.jobs.length) return '지원 완료한 공고가 여기 모여요';
  return s.waiting.length ? `결과 대기 ${s.waiting.length}건 · 가장 오래 ${s.maxWait}일` : `진행 중 ${s.progress.length}건 · 마무리 ${s.done.length}건`;
}
function todosCaption() {
  const open = getTodos().filter((t) => !t.done).length;
  return open ? `진행 중 ${open}건` : '모두 완료!';
}

/** 마감 3일 이내(오늘 포함) 공고 수 — 탭 배지 */
function urgentCount() {
  return getJobs().filter((j) => {
    if (!isOpenStatus(j.status)) return false;
    const d = ddayOf(j.deadline);
    return d !== null && d >= 0 && d <= 3;
  }).length;
}

/* ------------------------------------------------------------------ */
/* 네비게이션                                                            */
/* ------------------------------------------------------------------ */
function buildNav() {
  const badges = { jobs: urgentCount(), pipeline: overdueResultCount() };
  const item = (cls, badgeCls) => (key) => `
    <a class="${cls}" href="#/${key}" ${current === key ? 'aria-current="page"' : ''}>
      ${icons[ROUTES[key].icon]}
      <span>${ROUTES[key].title}</span>
      ${badges[key] ? `<span class="${badgeCls}">${badges[key]}</span>` : ''}
    </a>`;
  document.querySelector('.tabbar').innerHTML = TAB_ORDER.map(item('tabbar__item', 'tabbar__badge')).join('');
  document.querySelector('.sidenav__menu').innerHTML = SIDE_ORDER.map(item('sidenav__item', 'sidenav__badge')).join('');
  document.getElementById('settingsBtn').classList.toggle('is-active', current === 'settings');

  document.getElementById('sidenavSubtitle').textContent = monthCaption();
}

function goTo(key) { location.hash = `#/${key}`; }

function route() {
  const key = (location.hash.replace(/^#\/?/, '') || 'calendar').split('?')[0];
  current = ROUTES[key] ? key : 'calendar';
  const r = ROUTES[current];
  document.getElementById('topbarTitle').textContent = r.title;
  document.getElementById('topbarCaption').textContent = r.caption();
  document.title = `${r.title} · 취준 대시보드`;
  buildNav();
  view.scrollTop = 0;
  window.scrollTo({ top: 0 });
  r.render(view);
  view.focus({ preventScroll: true });
}

/* ------------------------------------------------------------------ */
/* 테마                                                                */
/* ------------------------------------------------------------------ */
const media = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const { theme } = getSettings();
  const dark = theme === 'dark' || (theme === 'auto' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#1b1c21' : '#3182F6');
  const btn = document.getElementById('themeToggle');
  btn.innerHTML = dark ? icons.sun : icons.moon;
}
media.addEventListener('change', () => { if (getSettings().theme === 'auto') applyTheme(); });

/* ------------------------------------------------------------------ */
/* 동기화 표시                                                          */
/* ------------------------------------------------------------------ */
function renderSyncUI() {
  const s = getSyncState();
  const btn = document.getElementById('syncBtn');
  btn.innerHTML = isConfigured() ? icons.refresh : icons.cloudOff;
  btn.classList.toggle('is-busy', s.status === 'syncing');

  const chip = document.getElementById('syncChipDesktop');
  if (!isConfigured()) {
    chip.innerHTML = `<span class="sync-chip__dot"></span><span class="sync-chip__text">동기화 꺼짐 · 설정에서 연결</span>`;
    return;
  }
  const { lastSyncAt } = getSettings();
  const when = lastSyncAt
    ? new Date(lastSyncAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : '';
  const map = {
    syncing: ['', '동기화 중…'],
    ok: ['sync-chip__dot--on', `동기화됨 ${when}`],
    error: ['sync-chip__dot--err', '동기화 오류'],
    idle: ['sync-chip__dot--on', when ? `동기화됨 ${when}` : '연결됨'],
    off: ['', '동기화 꺼짐'],
  };
  const [dot, text] = map[s.status] || map.idle;
  chip.innerHTML = `<span class="sync-chip__dot ${dot}"></span><span class="sync-chip__text">${text}</span>`;
}

/* ------------------------------------------------------------------ */
/* FAB — 현재 화면에 맞는 추가 동작                                        */
/* ------------------------------------------------------------------ */
document.getElementById('fab').addEventListener('click', () => {
  if (current === 'todos') openTodoForm();
  else if (current === 'jobs') openJobForm();
  else openAddChooser();
});

document.getElementById('settingsBtn').addEventListener('click', () => goTo('settings'));

document.getElementById('syncBtn').addEventListener('click', async () => {
  if (!isConfigured()) { goTo('settings'); return; }
  await syncNow();
});

document.getElementById('themeToggle').addEventListener('click', () => {
  const s = getSettings();
  const dark = document.documentElement.dataset.theme === 'dark';
  s.theme = dark ? 'light' : 'dark';
  persistSettings();
  applyTheme();
});

/* ------------------------------------------------------------------ */
/* 부팅                                                                */
/* ------------------------------------------------------------------ */
load();
applyTheme();
document.getElementById('settingsBtn').innerHTML = icons.gear;
route();
renderSyncUI();

window.addEventListener('hashchange', route);

// 데이터가 바뀌면 현재 뷰 다시 그림 (시트가 열려 있으면 닫힐 때 반영됨)
subscribe(() => {
  buildNav();
  const r = ROUTES[current];
  document.getElementById('topbarCaption').textContent = r.caption();
  if (!document.getElementById('sheetRoot').hidden) return;
  r.render(view);
});

onSyncState(() => renderSyncUI());

// 시트가 닫히면 열려 있는 동안 미뤄둔 재렌더 반영
document.addEventListener('sheet:closed', () => ROUTES[current].render(view));

// 탭이 다시 보이면 최신 데이터 당겨오기
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && isConfigured() && getSettings().autoSync) {
    syncNow({ silent: true });
  }
});
// 접속 직후 한 번
if (isConfigured() && getSettings().autoSync) syncNow({ silent: true });

// 스크롤 시 상단바 경계선
const topbar = document.querySelector('.topbar');
window.addEventListener('scroll', () => {
  topbar.classList.toggle('is-stuck', window.scrollY > 8);
}, { passive: true });

// PWA 서비스 워커
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* 오프라인 캐시는 선택 기능 */ });
}
