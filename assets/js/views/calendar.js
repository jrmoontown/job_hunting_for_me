/**
 * 캘린더 뷰 (메인 화면) — 월간 달력 + 선택한 날짜의 일정 패널.
 */
import { getJobs, getTodos, todayStr, fmtDate, WEEKDAYS_KO } from '../store.js';
import { isOpenStatus } from '../seed.js';
import { esc, icons } from '../ui.js';
import { jobCardHTML, bindJobCards, openJobForm } from './jobShared.js';
import { todoItemHTML, bindTodoList } from './todos.js';

let cursor = null;       // 표시 중인 달 (Date, 1일 고정)
let selected = todayStr(); // 선택한 날짜 (YYYY-MM-DD)

const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

function monthMatrix(base) {
  const y = base.getFullYear();
  const m = base.getMonth();
  const first = new Date(y, m, 1);
  const start = new Date(y, m, 1 - first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push(d);
  }
  // 마지막 줄이 전부 다음 달이면 5줄만
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
  const today = todayStr();

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
    const dayJobs = jobsByDate.get(key) || [];
    const dayTodos = todosByDate.get(key) || [];
    const dow = d.getDay();

    // 점 표시: 중요(빨강) → 예정(파랑) → 완료(회색) → 투두(보라), 최대 4개 + more
    const dots = [];
    dayJobs.forEach((j) => {
      if (j.important && isOpenStatus(j.status)) dots.push('cal-dot--important');
      else if (isOpenStatus(j.status)) dots.push('');
      else dots.push('cal-dot--done');
    });
    dayTodos.forEach((t) => { if (!t.done) dots.push('cal-dot--todo'); });
    dots.sort((a, b) => {
      const rank = (c) => (c === 'cal-dot--important' ? 0 : c === '' ? 1 : c === 'cal-dot--todo' ? 2 : 3);
      return rank(a) - rank(b);
    });
    const shown = dots.slice(0, 4);
    const more = dots.length - shown.length;

    const cls = [
      'cal-cell',
      !inMonth && 'cal-cell--muted',
      key === today && 'cal-cell--today',
      key === selected && 'cal-cell--selected',
      dow === 0 && 'cal-cell--sun',
      dow === 6 && 'cal-cell--sat',
    ].filter(Boolean).join(' ');

    return `
      <button class="${cls}" data-date="${key}" aria-label="${fmtDate(key, { withYear: true })}${dots.length ? `, 일정 ${dots.length}개` : ''}" ${key === selected ? 'aria-current="date"' : ''}>
        <span class="cal-cell__num">${d.getDate()}</span>
        ${shown.length ? `<span class="cal-dots">${shown.map((c) => `<i class="cal-dot ${c}"></i>`).join('')}</span>` : ''}
        ${more > 0 ? `<span class="cal-cell__more">+${more}</span>` : ''}
      </button>`;
  }).join('');

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
        <div class="calendar">
          <div class="cal-weekdays">${WEEKDAYS_KO.map((w) => `<span>${w}</span>`).join('')}</div>
          <div class="cal-grid">${cellHTML}</div>
          <div class="cal-legend">
            <span class="cal-legend__item"><i class="cal-dot cal-dot--important"></i>중요 공고</span>
            <span class="cal-legend__item"><i class="cal-dot"></i>지원 예정</span>
            <span class="cal-legend__item"><i class="cal-dot cal-dot--done"></i>지원 완료</span>
            <span class="cal-legend__item"><i class="cal-dot cal-dot--todo"></i>할 일</span>
          </div>
        </div>
      </section>
      <section class="day-panel" id="dayPanel"></section>
    </div>`;

  renderDayPanel(root.querySelector('#dayPanel'), jobsByDate, todosByDate);

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

  root.querySelectorAll('[data-date]').forEach((b) => b.addEventListener('click', () => {
    selected = b.dataset.date;
    renderCalendar(root);
  }));
}

function renderDayPanel(panel, jobsByDate, todosByDate) {
  const dayJobs = (jobsByDate.get(selected) || [])
    .slice()
    .sort((a, b) => (b.important - a.important) || (isOpenStatus(b.status) - isOpenStatus(a.status)) || a.company.localeCompare(b.company, 'ko'));
  const dayTodos = (todosByDate.get(selected) || []).slice().sort((a, b) => a.done - b.done);
  const isToday = selected === todayStr();

  panel.innerHTML = `
    <div class="day-panel__head">
      <h3 class="day-panel__date">${fmtDate(selected)}${isToday ? '<span>오늘</span>' : ''}</h3>
      <button class="btn btn--ghost btn--sm" data-add-here>${icons.plus}공고 추가</button>
    </div>
    ${dayJobs.length || dayTodos.length ? `
      <div class="job-list" data-job-list>
        ${dayJobs.map((j) => jobCardHTML(j, { showDate: false })).join('')}
      </div>
      ${dayTodos.length ? `
        <div class="todo-list" data-todo-list style="margin-top:${dayJobs.length ? '10px' : '0'}">
          ${dayTodos.map((t) => todoItemHTML(t)).join('')}
        </div>` : ''}
    ` : `
      <div class="card">
        <div class="empty">
          <span class="empty__icon">${icons.calendar}</span>
          <p class="empty__title">이 날은 일정이 없어요</p>
          <p class="empty__desc">마감일이 있는 공고나 할 일을 추가해 보세요</p>
        </div>
      </div>`}
  `;

  panel.querySelector('[data-add-here]').addEventListener('click', () => openJobForm(null, { presetDate: selected }));
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
