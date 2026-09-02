/**
 * 캘린더 뷰 (메인 화면) — 월간 달력 + 개인 일정 띠 + 선택한 날짜의 일정 패널.
 */
import { getJobs, getTodos, getEvents, todayStr, fmtDate, WEEKDAYS_KO } from '../store.js';
import { isOpenStatus } from '../seed.js';
import { esc, icons } from '../ui.js';
import { jobCardHTML, bindJobCards } from './jobShared.js';
import { todoItemHTML, bindTodoList } from './todos.js';
import { eventCardHTML, bindEventCards, openAddChooser } from './events.js';
import { eventsOn, availabilityOf, addDays } from '../plan.js';

let cursor = null;          // 표시 중인 달 (Date, 1일 고정)
let selected = todayStr();  // 선택한 날짜 (YYYY-MM-DD)
let layer = 'all';          // all | jobs | events | todos

const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const LAYERS = [
  { key: 'all', label: '전체' },
  { key: 'jobs', label: '공고', dot: 'var(--primary)' },
  { key: 'events', label: '개인 일정', dot: 'var(--teal-500)' },
  { key: 'todos', label: '할 일', dot: 'var(--violet-500)' },
];

function monthMatrix(base) {
  const y = base.getFullYear();
  const m = base.getMonth();
  const first = new Date(y, m, 1);
  const start = new Date(y, m, 1 - first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  const lastRow = cells.slice(35);
  return lastRow.every((d) => d.getMonth() !== m) ? cells.slice(0, 35) : cells;
}

export function renderCalendar(root) {
  if (!cursor) {
    const [y, m] = selected.split('-').map(Number);
    cursor = new Date(y, m - 1, 1);
  }

  const jobs = getJobs();
  const todos = getTodos();
  const events = getEvents();
  const today = todayStr();
  const showJobs = layer === 'all' || layer === 'jobs';
  const showEvents = layer === 'all' || layer === 'events';
  const showTodos = layer === 'all' || layer === 'todos';

  // 날짜별 인덱스
  const jobsByDate = new Map();
  jobs.forEach((j) => {
    if (!j.deadline) return;
    if (!jobsByDate.has(j.deadline)) jobsByDate.set(j.deadline, []);
    jobsByDate.get(j.deadline).push(j);
  });
  const todosByDate = new Map();
  todos.forEach((t) => {
    if (!t.dueDate) return;
    if (!todosByDate.has(t.dueDate)) todosByDate.set(t.dueDate, []);
    todosByDate.get(t.dueDate).push(t);
  });

  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const cells = monthMatrix(cursor);

  const cellHTML = cells.map((d) => {
    const key = ymd(d.getFullYear(), d.getMonth(), d.getDate());
    const inMonth = d.getMonth() === m;
    const dow = d.getDay();
    const dayJobs = showJobs ? (jobsByDate.get(key) || []) : [];
    const dayTodos = showTodos ? (todosByDate.get(key) || []) : [];
    const dayEvents = showEvents ? eventsOn(key, events) : [];
    const avail = showEvents ? availabilityOf(key, events) : 'ok';

    // 점 표시: 중요(빨강) → 예정(파랑) → 투두(보라) → 완료(회색), 최대 4개 + more
    const dots = [];
    dayJobs.forEach((j) => {
      if (j.important && isOpenStatus(j.status)) dots.push('cal-dot--important');
      else if (isOpenStatus(j.status)) dots.push('');
      else dots.push('cal-dot--done');
    });
    dayTodos.forEach((t) => { if (!t.done) dots.push('cal-dot--todo'); });
    const rank = (c) => (c === 'cal-dot--important' ? 0 : c === '' ? 1 : c === 'cal-dot--todo' ? 2 : 3);
    dots.sort((a, b) => rank(a) - rank(b));
    const shown = dots.slice(0, 4);
    const more = dots.length - shown.length;

    // 작성 불가 구간: 앞뒤 날짜가 이어지면 모서리를 붙인다
    const blocked = avail === 'none';
    const blockStart = blocked && (dow === 0 || availabilityOf(addDays(key, -1), events) !== 'none');
    const blockEnd = blocked && (dow === 6 || availabilityOf(addDays(key, 1), events) !== 'none');

    // 일정 띠: 최대 2개, 시작 셀(또는 주 시작)에만 라벨
    const bands = dayEvents.slice(0, 2).map((e) => {
      const end = e.end || e.start;
      const isStart = key === e.start || dow === 0;
      const isEnd = key === end || dow === 6;
      return `<span class="cal-band cal-band--${e.avail} ${isStart ? 'cal-band--start' : ''} ${isEnd ? 'cal-band--end' : ''}">
        ${isStart ? `<span class="cal-band__label">${esc(e.title)}</span>` : ''}
      </span>`;
    }).join('');

    const cls = [
      'cal-cell',
      !inMonth && 'cal-cell--muted',
      key === today && 'cal-cell--today',
      key === selected && 'cal-cell--selected',
      dow === 0 && 'cal-cell--sun',
      dow === 6 && 'cal-cell--sat',
      blocked && 'cal-cell--block',
      blockStart && 'cal-cell--block-start',
      blockEnd && 'cal-cell--block-end',
      dayEvents.length >= 2 ? 'cal-cell--bands-2' : dayEvents.length === 1 ? 'cal-cell--bands-1' : '',
    ].filter(Boolean).join(' ');

    const label = [
      fmtDate(key, { withYear: true }),
      dots.length ? `일정 ${dots.length}개` : '',
      dayEvents.length ? dayEvents.map((e) => e.title).join(', ') : '',
      blocked ? '작성 불가' : avail === 'hard' ? '작성 어려움' : '',
    ].filter(Boolean).join(', ');

    return `
      <button class="${cls}" data-date="${key}" aria-label="${esc(label)}" ${key === selected ? 'aria-current="date"' : ''}>
        <span class="cal-cell__num">${d.getDate()}</span>
        ${shown.length ? `<span class="cal-dots">${shown.map((c) => `<i class="cal-dot ${c}"></i>`).join('')}</span>` : ''}
        ${more > 0 ? `<span class="cal-cell__more">+${more}</span>` : ''}
        ${bands ? `<span class="cal-bands">${bands}</span>` : ''}
      </button>`;
  }).join('');

  // 이번 달과 겹치는 개인 일정 목록
  const monthStart = ymd(y, m, 1);
  const monthEnd = ymd(y, m, new Date(y, m + 1, 0).getDate());
  const monthEvents = events
    .filter((e) => e.start <= monthEnd && (e.end || e.start) >= monthStart)
    .sort((a, b) => a.start.localeCompare(b.start));

  root.innerHTML = `
    <div class="cal-layout">
      <section class="section">
        <div class="cal-head">
          <h2 class="cal-head__month">${y}년 ${m + 1}월</h2>
          <div class="cal-head__nav">
            <button class="icon-btn" data-nav="-1" aria-label="이전 달">${icons.chevronLeft}</button>
            <button class="btn btn--ghost btn--sm" data-nav="today">오늘</button>
            <button class="icon-btn" data-nav="1" aria-label="다음 달">${icons.chevronRight}</button>
          </div>
        </div>
        <div class="chips" style="margin-bottom:12px" role="tablist" aria-label="캘린더 표시 항목">
          ${LAYERS.map((l) => `
            <button class="chip" role="tab" aria-pressed="${layer === l.key}" data-layer="${l.key}">
              ${l.dot ? `<i class="chip__dot" style="background:${l.dot}"></i>` : ''}${l.label}
            </button>`).join('')}
        </div>
        <div class="calendar">
          <div class="cal-weekdays">${WEEKDAYS_KO.map((w) => `<span>${w}</span>`).join('')}</div>
          <div class="cal-grid">${cellHTML}</div>
          <div class="cal-legend">
            <span class="cal-legend__item"><i class="cal-legend__sw cal-legend__sw--hatch"></i>작성 불가</span>
            <span class="cal-legend__item"><i class="cal-legend__sw cal-legend__sw--hard"></i>작성 어려움</span>
            <span class="cal-legend__item"><i class="cal-dot"></i>마감</span>
            <span class="cal-legend__item"><i class="cal-dot cal-dot--important"></i>중요</span>
            <span class="cal-legend__item"><i class="cal-dot cal-dot--done"></i>완료</span>
            <span class="cal-legend__item"><i class="cal-dot cal-dot--todo"></i>할 일</span>
          </div>
        </div>
        ${monthEvents.length && showEvents ? `
        <div class="section" style="margin-top:16px">
          <div class="section__head">
            <div>
              <h3 class="section__title">${m + 1}월 개인 일정</h3>
              <p class="section__desc">누르면 수정할 수 있어요</p>
            </div>
            <button class="section__action" data-add-event>${icons.plus}일정 추가</button>
          </div>
          <div class="evt-list" data-event-list>${monthEvents.map(eventCardHTML).join('')}</div>
        </div>` : ''}
      </section>
      <section class="day-panel" id="dayPanel"></section>
    </div>`;

  renderDayPanel(root.querySelector('#dayPanel'), { jobsByDate, todosByDate, events });

  root.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => {
    const nav = b.dataset.nav;
    if (nav === 'today') {
      selected = todayStr();
      const [ty, tm] = selected.split('-').map(Number);
      cursor = new Date(ty, tm - 1, 1);
    } else {
      cursor = new Date(y, m + Number(nav), 1);
    }
    renderCalendar(root);
  }));
  root.querySelectorAll('[data-layer]').forEach((b) => b.addEventListener('click', () => {
    layer = b.dataset.layer;
    renderCalendar(root);
  }));
  root.querySelectorAll('[data-date]').forEach((b) => b.addEventListener('click', () => {
    selected = b.dataset.date;
    renderCalendar(root);
  }));
  root.querySelector('[data-add-event]')?.addEventListener('click', () => openAddChooser({ presetDate: selected }));
  const evList = root.querySelector('[data-event-list]');
  if (evList) bindEventCards(evList);
}

function renderDayPanel(panel, { jobsByDate, todosByDate, events }) {
  const dayJobs = (jobsByDate.get(selected) || [])
    .slice()
    .sort((a, b) => (b.important - a.important) || (isOpenStatus(b.status) - isOpenStatus(a.status)) || a.company.localeCompare(b.company, 'ko'));
  const dayTodos = (todosByDate.get(selected) || []).slice().sort((a, b) => a.done - b.done);
  const dayEvents = eventsOn(selected, events);
  const isToday = selected === todayStr();
  const hasAny = dayJobs.length || dayTodos.length || dayEvents.length;

  panel.innerHTML = `
    <div class="day-panel__head">
      <h3 class="day-panel__date">${fmtDate(selected)}${isToday ? '<span>오늘</span>' : ''}</h3>
      <button class="btn btn--ghost btn--sm" data-add-here>${icons.plus}추가</button>
    </div>
    ${hasAny ? `
      ${dayEvents.length ? `<div class="evt-list" data-event-list style="margin-bottom:10px">${dayEvents.map(eventCardHTML).join('')}</div>` : ''}
      ${dayJobs.length ? `<div class="job-list" data-job-list>${dayJobs.map((j) => jobCardHTML(j, { showDate: false })).join('')}</div>` : ''}
      ${dayTodos.length ? `
        <div class="todo-list" data-todo-list style="margin-top:${dayJobs.length || dayEvents.length ? '10px' : '0'}">
          ${dayTodos.map((t) => todoItemHTML(t)).join('')}
        </div>` : ''}
    ` : `
      <div class="card">
        <div class="empty">
          <span class="empty__icon">${icons.calendar}</span>
          <p class="empty__title">이 날은 일정이 없어요</p>
          <p class="empty__desc">마감 공고나 개인 일정, 할 일을 추가해 보세요</p>
        </div>
      </div>`}
  `;

  panel.querySelector('[data-add-here]').addEventListener('click', () => openAddChooser({ presetDate: selected }));
  const evList = panel.querySelector('[data-event-list]');
  if (evList) bindEventCards(evList);
  const jobList = panel.querySelector('[data-job-list]');
  if (jobList) bindJobCards(jobList);
  const todoList = panel.querySelector('[data-todo-list]');
  if (todoList) bindTodoList(todoList);
}

/** 다른 뷰에서 특정 날짜를 선택한 채 캘린더를 열 때 사용 */
export function focusDate(dateStr) {
  selected = dateStr;
  const [y, m] = dateStr.split('-').map(Number);
  cursor = new Date(y, m - 1, 1);
}
