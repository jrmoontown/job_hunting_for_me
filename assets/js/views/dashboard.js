/**
 * 현황 뷰 — 취준 진행 상황 요약, 일정과 겹치는 마감, 주간 부하.
 */
import { getJobs, getTodos, ddayOf, fmtDate, todayStr, updateJob } from '../store.js';
import { STATUSES, STATUS_ORDER, isOpenStatus } from '../seed.js';
import { esc, icons, confirmSheet, toast } from '../ui.js';
import { scheduleSync } from '../sync.js';
import { jobCardHTML, bindJobCards } from './jobShared.js';
import { conflictGroups, weeklyLoad, monthSummary, fmtShort } from '../plan.js';

export function renderDashboard(root, { goTo }) {
  const jobs = getJobs();
  const todos = getTodos();

  const open = jobs.filter((j) => isOpenStatus(j.status));
  const done = jobs.filter((j) => !isOpenStatus(j.status));
  const applied = jobs.filter((j) => ['applied', 'doc_pass', 'interview', 'offer'].includes(j.status));
  const important = open.filter((j) => j.important);
  const openTodos = todos.filter((t) => !t.done);

  const withD = (j) => ({ j, d: ddayOf(j.deadline) });
  const urgent = open.map(withD).filter((x) => x.d !== null && x.d >= 0 && x.d <= 3)
    .sort((a, b) => a.d - b.d || (b.j.important - a.j.important));
  const overdue = open.map(withD).filter((x) => x.d !== null && x.d < 0);
  const thisWeek = open.map(withD).filter((x) => x.d !== null && x.d >= 0 && x.d <= 6);

  const total = jobs.length;
  const progress = total ? Math.round((done.length / total) * 100) : 0;

  const statusCounts = STATUS_ORDER
    .map((key) => ({ key, ...STATUSES[key], count: jobs.filter((j) => j.status === key).length }))
    .filter((s) => s.count > 0);
  const maxCount = Math.max(1, ...statusCounts.map((s) => s.count));

  const month = monthSummary();
  const conflicts = conflictGroups();
  const weeks = weeklyLoad(5);

  // 헤드라인 문구
  let headline;
  if (urgent.length) {
    const first = urgent[0];
    headline = `<span class="accent-red">${first.d === 0 ? '오늘' : `${first.d}일 뒤`}</span> <em>${esc(first.j.company)}</em> 마감${urgent.length > 1 ? ` 외 ${urgent.length - 1}건이 임박했어요` : '이에요'}`;
  } else if (conflicts.total) {
    headline = `개인 일정과 겹치는 마감이 <em>${conflicts.total}건</em> 있어요`;
  } else if (open.length) {
    headline = `남은 공고 <em>${open.length}건</em>, 차근차근 가고 있어요`;
  } else {
    headline = '남은 공고를 모두 처리했어요 🎉';
  }

  const groupHTML = (g) => {
    const who = g.jobs.map((j) => esc(j.company)).join(' · ');
    const evName = g.event ? esc(g.event.title) : '개인 일정';
    const hot = g.load >= 3;
    const dayCls = g.kind === 'hard' && hot ? 'plan-row__day--warn' : '';
    return `
      <button class="plan-row" data-pull="${g.jobs.map((j) => j.id).join(',')}" data-date="${g.writeBy || ''}" ${g.writeBy ? '' : 'disabled'}>
        <span>
          <span class="plan-row__who">${who}</span>
          <span class="plan-row__why">${fmtShort(g.deadline)} 마감 · <b>${evName}</b></span>
        </span>
        <span class="plan-row__to">
          <span class="plan-row__arrow">${g.kind === 'none' ? '이때까지' : '미리 쓰기'}</span>
          <span class="plan-row__day ${dayCls}">${g.writeBy ? fmtShort(g.writeBy) : '쓸 날 없음'}</span>
          <span class="plan-row__load ${hot ? 'plan-row__load--hot' : ''}">${g.writeBy ? `그날 마감 ${g.load}건${hot ? ' 몰림' : ''}` : '마감일을 조정해 주세요'}</span>
        </span>
      </button>`;
  };

  root.innerHTML = `
    <div class="hero">
      <p class="hero__eyebrow">${fmtDate(todayStr(), { withYear: true })}</p>
      <h2 class="hero__headline">${headline}</h2>
      <div class="progress" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100" aria-label="전체 진행률">
        <div class="progress__bar" style="width:${progress}%"></div>
      </div>
      <p class="section__desc" style="margin-top:8px">전체 ${total}건 중 ${done.length}건 처리 · ${progress}%</p>
    </div>

    <section class="section">
      <div class="stat-grid">
        <button class="stat stat--danger" data-go="jobs">
          <span class="stat__label">${icons.fire}3일 내 마감</span>
          <span class="stat__value">${urgent.length}<small>건</small></span>
        </button>
        <button class="stat stat--warning" data-go="jobs">
          <span class="stat__label">${icons.clock}이번 주 마감</span>
          <span class="stat__value">${thisWeek.length}<small>건</small></span>
        </button>
        <button class="stat stat--primary" data-go="jobs">
          <span class="stat__label">${icons.briefcase}지원 예정</span>
          <span class="stat__value">${open.length}<small>건</small></span>
        </button>
        <button class="stat stat--success" data-go="jobs">
          <span class="stat__label">${icons.check}지원 완료</span>
          <span class="stat__value">${applied.length}<small>건</small></span>
        </button>
      </div>
    </section>

    <section class="section">
      <div class="section__head">
        <div>
          <h3 class="section__title">${month.monthLabel} 남은 기간</h3>
          <p class="section__desc">개인 일정을 뺀 실제로 쓸 수 있는 날</p>
        </div>
        <button class="section__action" data-go="calendar">캘린더 ${icons.chevronRight}</button>
      </div>
      <div class="stat-grid stat-grid--3">
        <div class="stat stat--teal">
          <span class="stat__label">쓸 수 있는 저녁</span>
          <span class="stat__value">${month.freeEvenings}<small>일</small></span>
        </div>
        <div class="stat">
          <span class="stat__label">남은 마감</span>
          <span class="stat__value">${month.remaining}<small>건</small></span>
        </div>
        <div class="stat ${month.conflicts ? 'stat--danger' : ''}">
          <span class="stat__label">조정 필요</span>
          <span class="stat__value">${month.conflicts}<small>건</small></span>
        </div>
      </div>
    </section>

    ${overdue.length ? `
    <section class="section">
      <div class="callout callout--warn">
        ${icons.alert}
        <div><strong>기한이 지난 공고가 ${overdue.length}건 있어요.</strong><br/>
        실제 마감 전이라면 서둘러 제출하고, 놓쳤다면 상태를 정리해 주세요.</div>
      </div>
    </section>` : ''}

    ${conflicts.total ? `
    <section class="section">
      <div class="section__head">
        <div>
          <h3 class="section__title">일정과 겹치는 마감</h3>
          <p class="section__desc">마감 전 가장 여유 있는 날을 골라 제안해요. 누르면 내 마감일을 그날로 당겨요.</p>
        </div>
      </div>
      <div class="card card--pad" data-plan-rows>
        ${conflicts.none.length ? `
        <div class="plan-group">
          <p class="plan-group__title"><i class="cal-legend__sw cal-legend__sw--hatch"></i>작성 불가 기간에 마감 <span class="plan-group__count">${conflicts.none.reduce((s, g) => s + g.jobs.length, 0)}건</span></p>
          ${conflicts.none.map(groupHTML).join('')}
        </div>` : ''}
        ${conflicts.hard.length ? `
        <div class="plan-group">
          <p class="plan-group__title"><i class="cal-legend__sw cal-legend__sw--hard"></i>작성 어려운 날에 마감 <span class="plan-group__count">${conflicts.hard.reduce((s, g) => s + g.jobs.length, 0)}건</span></p>
          ${conflicts.hard.map(groupHTML).join('')}
        </div>` : ''}
      </div>
    </section>` : ''}

    <section class="section">
      <div class="section__head">
        <div>
          <h3 class="section__title">한 주에 몇 건씩 써야 할까</h3>
          <p class="section__desc">칸 하나가 하루, 숫자는 그날 쓸 공고 수예요</p>
        </div>
      </div>
      <div class="card card--pad">
        <div class="weeks">
          ${weeks.map((w) => `
            <div class="week">
              <span class="week__rng">${fmtShort(w.start).split(' ')[0]} – ${fmtShort(w.end).split(' ')[0]}${w.current ? '<small>이번 주</small>' : ''}</span>
              <span class="week__track" aria-label="${w.total}건, 쓸 수 있는 날 ${w.writable}일">
                ${w.days.map((d) => `<i class="week__day ${d.past ? 'week__day--past' : ''} ${d.avail === 'none' ? 'week__day--block' : d.avail === 'hard' ? 'week__day--hard' : ''} ${d.count >= 4 ? 'week__day--heavy' : ''}">${d.count || ''}</i>`).join('')}
              </span>
              <span class="week__sum week__sum--${w.level.key}">${w.total}건 / ${w.writable}일<small>${w.level.label}</small></span>
            </div>`).join('')}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section__head">
        <div>
          <h3 class="section__title">지금 챙길 공고</h3>
          <p class="section__desc">마감 3일 이내 ${important.length ? `· 중요 공고 ${important.length}건 포함` : ''}</p>
        </div>
        <button class="section__action" data-go="jobs">전체 보기 ${icons.chevronRight}</button>
      </div>
      ${urgent.length ? `<div class="job-list" data-job-list>
        ${urgent.slice(0, 5).map(({ j }) => jobCardHTML(j)).join('')}
      </div>` : `
      <div class="card"><div class="empty" style="padding:32px 24px">
        <p class="empty__title">3일 내 마감 공고가 없어요</p>
        <p class="empty__desc">여유 있을 때 자소서를 미리 준비해 두세요</p>
      </div></div>`}
    </section>

    ${statusCounts.length ? `
    <section class="section">
      <div class="section__head"><h3 class="section__title">전형 현황</h3></div>
      <div class="card card--pad">
        <div class="bar-list">
          ${statusCounts.map((s) => `
            <div class="bar-item">
              <div class="bar-item__top">
                <span class="bar-item__name">${s.label}</span>
                <span class="bar-item__val">${s.count}건</span>
              </div>
              <div class="bar-item__track">
                <div class="bar-item__fill" style="width:${Math.round((s.count / maxCount) * 100)}%;background:${s.color}"></div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </section>` : ''}

    <section class="section">
      <div class="section__head">
        <div>
          <h3 class="section__title">할 일</h3>
          <p class="section__desc">진행 중 ${openTodos.length}건</p>
        </div>
        <button class="section__action" data-go="todos">전체 보기 ${icons.chevronRight}</button>
      </div>
    </section>
  `;

  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => goTo(b.dataset.go)));
  const list = root.querySelector('[data-job-list]');
  if (list) bindJobCards(list);

  root.querySelectorAll('[data-pull]').forEach((b) => b.addEventListener('click', async () => {
    const ids = b.dataset.pull.split(',').filter(Boolean);
    const date = b.dataset.date;
    if (!ids.length || !date) return;
    const names = ids.map((id) => jobs.find((j) => j.id === id)?.company).filter(Boolean).join(', ');
    const ok = await confirmSheet({
      title: `내 마감일을 ${fmtShort(date)}로 당길까요?`,
      desc: `${names} — 원래 마감일 대신 이 날이 목록과 캘린더에 표시돼요.`,
      confirmText: '당기기',
      danger: false,
    });
    if (!ok) return;
    ids.forEach((id) => updateJob(id, { deadline: date }));
    scheduleSync();
    toast(`${ids.length}건의 마감일을 ${fmtShort(date)}로 옮겼어요`, { type: 'success' });
  }));
}
