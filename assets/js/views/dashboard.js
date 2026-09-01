/**
 * 현황 뷰 — 취준 진행 상황 요약 통계.
 */
import { getJobs, getTodos, ddayOf, fmtDate, todayStr } from '../store.js';
import { STATUSES, STATUS_ORDER, isOpenStatus } from '../seed.js';
import { esc, icons } from '../ui.js';
import { jobCardHTML, bindJobCards } from './jobShared.js';

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

  // 상태 분포
  const statusCounts = STATUS_ORDER
    .map((key) => ({ key, ...STATUSES[key], count: jobs.filter((j) => j.status === key).length }))
    .filter((s) => s.count > 0);
  const maxCount = Math.max(1, ...statusCounts.map((s) => s.count));

  // 헤드라인 문구
  let headline;
  if (urgent.length) {
    const first = urgent[0];
    headline = `<span class="accent-red">${first.d === 0 ? '오늘' : `${first.d}일 뒤`}</span> <em>${esc(first.j.company)}</em> 마감${urgent.length > 1 ? ` 외 ${urgent.length - 1}건이 임박했어요` : '이에요'}`;
  } else if (open.length) {
    headline = `남은 공고 <em>${open.length}건</em>, 차근차근 가고 있어요`;
  } else {
    headline = '남은 공고를 모두 처리했어요 🎉';
  }

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

    ${overdue.length ? `
    <section class="section">
      <div class="callout callout--warn">
        ${icons.alert}
        <div><strong>기한이 지난 공고가 ${overdue.length}건 있어요.</strong><br/>
        실제 마감 전이라면 서둘러 제출하고, 놓쳤다면 상태를 정리해 주세요.</div>
      </div>
    </section>` : ''}

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
}
