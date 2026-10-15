/**
 * 홈 — 취준 · 공부 · 투두 세 영역을 같은 비중으로 보여주는 첫 화면.
 * "오늘 뭘 해야 하나"에 답하는 데 집중한다.
 */
import { getJobs, getTodos, addTodo, todayStr, ddayOf, fmtDate } from '../store.js';
import { isOpenStatus } from '../seed.js';
import { esc, icons } from '../ui.js';
import { scheduleSync } from '../sync.js';
import { jobCardHTML, bindJobCards } from './jobShared.js';
import { todoItemHTML, bindTodoList } from './todos.js';
import { pipelineStats, resultOverdue } from './pipeline.js';
import { studyStats, sessionItemHTML, bindSessionList, studyCardHTML, bindStudyCards, sessionLabel } from './study.js';
import { getPlan, planFor, fmtShort, weeklyLoad } from '../plan.js';

export function renderHome(root, { goTo }) {
  const today = todayStr();
  const jobs = getJobs();
  const todos = getTodos();

  /* ---- 취준 ---- */
  const open = jobs.filter((j) => isOpenStatus(j.status));
  const withD = (j) => ({ j, d: ddayOf(j.deadline) });
  const soon = open.map(withD).filter((x) => x.d !== null && x.d >= 0 && x.d <= 3).sort((a, b) => a.d - b.d || (b.j.important - a.j.important));
  const overdueJobs = open.map(withD).filter((x) => x.d !== null && x.d < 0);
  const thisWeek = open.map(withD).filter((x) => x.d !== null && x.d >= 0 && x.d <= 6);
  // 오늘이 "작성 기한"인 공고 (개인 일정 때문에 당겨진 것)
  const writeToday = open.filter((j) => planFor(j.id)?.writeBy === today && !soon.some((x) => x.j.id === j.id));
  const pipe = pipelineStats();
  const conflicts = getPlan().plans.size;
  const jobList = [...soon.map((x) => x.j), ...writeToday].slice(0, 3);
  const nextJob = open.map(withD).filter((x) => x.d !== null && x.d > 3).sort((a, b) => a.d - b.d)[0] || null;
  const jobsEmpty = !open.length ? '지원 예정 공고가 없어요'
    : nextJob ? `가장 가까운 마감은 ${fmtShort(nextJob.j.deadline)} ${esc(nextJob.j.company)} (D-${nextJob.d})`
    : overdueJobs.length ? '남은 공고의 마감이 모두 지났어요. 공고 탭에서 정리해 주세요'
    : '3일 안에 마감인 공고가 없어요';

  /* ---- 공부 ---- */
  const st = studyStats();

  /* ---- 투두 ---- */
  const openTodos = todos.filter((t) => !t.done);
  const todoDue = openTodos.filter((t) => t.dueDate && t.dueDate <= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const todoSoon = openTodos.filter((t) => t.dueDate && t.dueDate > today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const todoFree = openTodos.filter((t) => !t.dueDate);
  const todoList = [...todoDue, ...todoSoon, ...todoFree].slice(0, 4);

  /* ---- 헤드라인 ---- */
  const parts = [];
  if (soon.length) parts.push(`마감 ${soon.length}건`);
  if (st.todays.length) parts.push(`공부 ${st.todays.length}건`);
  if (todoDue.length) parts.push(`할 일 ${todoDue.length}건`);
  const headline = parts.length
    ? `오늘은 <em>${parts.join(' · ')}</em>`
    : open.length || openTodos.length ? '오늘 당장 급한 건 없어요. <em>미리 당겨 쓰기</em> 좋은 날' : '모두 처리했어요 🎉';

  /* ---- 이번 주 띠 ---- */
  const week = weeklyLoad(1)[0];
  const sessByDate = new Map();
  st.week.forEach((s) => sessByDate.set(s.date, (sessByDate.get(s.date) || 0) + 1));
  const todoByDate = new Map();
  openTodos.forEach((t) => { if (t.dueDate) todoByDate.set(t.dueDate, (todoByDate.get(t.dueDate) || 0) + 1); });

  root.innerHTML = `
    <div class="hero hero--home">
      <p class="hero__eyebrow">${fmtDate(today, { withYear: true })}</p>
      <h2 class="hero__headline">${headline}</h2>
      <div class="week-strip" aria-label="이번 주">
        ${week.days.map((d) => {
          const dow = new Date(d.date + 'T00:00').getDay();
          const isT = d.date === today;
          return `
          <button class="week-strip__day ${isT ? 'is-today' : ''} ${d.past ? 'is-past' : ''} ${d.avail === 'none' ? 'is-block' : ''}" data-go-date="${d.date}" aria-label="${fmtDate(d.date)}">
            <span class="week-strip__dow ${dow === 0 ? 'is-sun' : dow === 6 ? 'is-sat' : ''}">${['일', '월', '화', '수', '목', '금', '토'][dow]}</span>
            <span class="week-strip__num">${Number(d.date.slice(-2))}</span>
            <span class="week-strip__dots">
              ${d.count ? `<i style="background:var(--primary)" title="마감 ${d.count}"></i>` : ''}
              ${sessByDate.get(d.date) ? '<i style="background:var(--success)" title="공부"></i>' : ''}
              ${todoByDate.get(d.date) ? '<i style="background:var(--violet-500)" title="할 일"></i>' : ''}
            </span>
          </button>`;
        }).join('')}
      </div>
    </div>

    <div class="home-grid">
      <!-- ───── 취준 ───── -->
      <section class="area area--jobs">
        <header class="area__head">
          <span class="area__icon">${icons.briefcase}</span>
          <div class="area__titles"><h3 class="area__title">취준</h3><p class="area__sub">${thisWeek.length ? `이번 주 마감 ${thisWeek.length}건` : `지원 예정 ${open.length}건`}${pipe.waiting.length ? ` · 결과 대기 ${pipe.waiting.length}` : ''}</p></div>
          <button class="area__more" data-go="jobs" aria-label="취준으로 이동">${icons.chevronRight}</button>
        </header>
        <div class="area__kpis">
          <button class="area__kpi ${soon.length ? 'is-hot' : ''}" data-go="jobs"><b>${soon.length}</b><span>3일 내 마감</span></button>
          <button class="area__kpi" data-go="pipeline"><b>${pipe.waiting.length}</b><span>결과 대기</span></button>
          <button class="area__kpi ${conflicts ? 'is-warn' : ''}" data-go="dashboard"><b>${conflicts}</b><span>조정 필요</span></button>
        </div>
        ${overdueJobs.length ? `<p class="area__note area__note--warn">${icons.alert}기한 지난 공고 ${overdueJobs.length}건 — 상태를 정리해 주세요</p>` : ''}
        ${pipe.overdue.length ? `<p class="area__note area__note--warn">${icons.alert}${esc(pipe.overdue[0].company)} 발표일이 지났어요</p>` : ''}
        ${jobList.length ? `<div class="job-list area__list" data-job-list>${jobList.map((j) => jobCardHTML(j)).join('')}</div>`
          : `<div class="area__empty">${jobsEmpty}</div>`}
        <footer class="area__foot">
          <button class="btn btn--ghost btn--sm" data-go="jobs">공고 ${open.length}</button>
          <button class="btn btn--ghost btn--sm" data-go="pipeline">전형 ${pipe.jobs.length}</button>
          <button class="btn btn--ghost btn--sm" data-go="dashboard">현황</button>
        </footer>
      </section>

      <!-- ───── 공부 ───── -->
      <section class="area area--study">
        <header class="area__head">
          <span class="area__icon">${icons.book}</span>
          <div class="area__titles"><h3 class="area__title">공부</h3><p class="area__sub">${st.todays.length ? `오늘 ${st.todays.filter((s) => s.done).length}/${st.todays.length} 완료` : st.next ? `다음 공부 ${fmtShort(st.next.date)}` : '일정을 짜 보세요'}</p></div>
          <button class="area__more" data-go="study" aria-label="공부로 이동">${icons.chevronRight}</button>
        </header>
        ${st.todays.length ? `
          <p class="area__label">오늘 공부</p>
          <div class="todo-list area__list" data-session-list>${st.todays.map((s) => sessionItemHTML(s)).join('')}</div>` : ''}
        ${st.missed.length ? `<p class="area__note area__note--warn">${icons.alert}못 한 공부 ${st.missed.length}건 — 공부 탭에서 다시 짤 수 있어요</p>` : ''}
        ${st.studies.length ? `
          <p class="area__label">진행률</p>
          <div class="study-list study-list--compact" data-study-list>${st.studies.map((s) => studyCardHTML(s, { compact: true })).join('')}</div>`
          : `<div class="area__empty">공부할 교재를 추가해 보세요<br/><span style="font-size:12.5px">예) AICE 문제집 Part 1 ~ 6</span></div>`}
        ${!st.todays.length && st.next ? `<div class="area__empty">오늘은 계획된 공부가 없어요. 다음은 ${fmtShort(st.next.date)} ${esc(sessionLabel(st.next))}</div>` : ''}
        <footer class="area__foot">
          <button class="btn btn--ghost btn--sm" data-go="study">공부 탭</button>
          <button class="btn btn--ghost btn--sm" data-add-study>${icons.plus}교재</button>
        </footer>
      </section>

      <!-- ───── 투두 ───── -->
      <section class="area area--todos">
        <header class="area__head">
          <span class="area__icon">${icons.check}</span>
          <div class="area__titles"><h3 class="area__title">투두</h3><p class="area__sub">${openTodos.length ? `진행 중 ${openTodos.length}건${todoDue.length ? ` · 오늘까지 ${todoDue.length}` : ''}` : '모두 완료!'}</p></div>
          <button class="area__more" data-go="todos" aria-label="투두로 이동">${icons.chevronRight}</button>
        </header>
        <form class="quick-add area__quick" id="homeQuickAdd">
          <input class="input" name="text" placeholder="할 일 추가하고 Enter" autocomplete="off" aria-label="새 할 일" />
          <button class="quick-add__btn" type="submit" aria-label="추가">${icons.plus}</button>
        </form>
        ${todoList.length ? `<div class="todo-list area__list" data-todo-list>${todoList.map((t) => todoItemHTML(t)).join('')}</div>`
          : '<div class="area__empty">남은 할 일이 없어요 👏</div>'}
        <footer class="area__foot">
          <button class="btn btn--ghost btn--sm" data-go="todos">${openTodos.length > todoList.length ? `${openTodos.length - todoList.length}건 더 보기` : '투두 탭'}</button>
        </footer>
      </section>
    </div>
  `;

  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => goTo(b.dataset.go)));
  root.querySelectorAll('[data-go-date]').forEach((b) => b.addEventListener('click', async () => {
    const m = await import('./calendar.js');
    m.focusDate(b.dataset.goDate);
    goTo('calendar');
  }));
  root.querySelectorAll('[data-add-study]').forEach((b) => b.addEventListener('click', async () => {
    const m = await import('./study.js');
    m.openStudyForm();
  }));
  root.querySelector('#homeQuickAdd').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.target.text;
    const text = input.value.trim();
    if (!text) return;
    addTodo({ text });
    scheduleSync();
  });
  const jl = root.querySelector('[data-job-list]'); if (jl) bindJobCards(jl);
  const sl = root.querySelector('[data-session-list]'); if (sl) bindSessionList(sl);
  const stl = root.querySelector('[data-study-list]'); if (stl) bindStudyCards(stl);
  const tl = root.querySelector('[data-todo-list]'); if (tl) bindTodoList(tl);
}
