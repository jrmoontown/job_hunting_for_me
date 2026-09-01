/**
 * 공고 목록 뷰 — 필터 · 검색 · 마감일 그룹.
 */
import { getJobs, ddayOf, fmtDate } from '../store.js';
import { STATUSES, isOpenStatus } from '../seed.js';
import { esc, icons } from '../ui.js';
import { jobCardHTML, bindJobCards, openJobForm } from './jobShared.js';

let filter = 'open';   // open | important | done | all
let query = '';

const FILTERS = [
  { key: 'open', label: '지원 예정' },
  { key: 'important', label: '중요' },
  { key: 'done', label: '지원 완료' },
  { key: 'all', label: '전체' },
];

export function renderJobs(root) {
  const jobs = getJobs();
  const counts = {
    open: jobs.filter((j) => isOpenStatus(j.status)).length,
    important: jobs.filter((j) => j.important && isOpenStatus(j.status)).length,
    done: jobs.filter((j) => !isOpenStatus(j.status)).length,
    all: jobs.length,
  };

  let list = jobs.filter((j) => {
    if (filter === 'open') return isOpenStatus(j.status);
    if (filter === 'important') return j.important && isOpenStatus(j.status);
    if (filter === 'done') return !isOpenStatus(j.status);
    return true;
  });

  const q = query.trim().toLowerCase();
  if (q) {
    list = list.filter((j) =>
      j.company.toLowerCase().includes(q)
      || (j.position || '').toLowerCase().includes(q)
      || (j.memo || '').toLowerCase().includes(q));
  }

  // 정렬: 마감 임박 순 (완료 목록은 최근 지원 순)
  list.sort((a, b) => {
    if (filter === 'done') return (b.appliedAt || b.deadline || '').localeCompare(a.appliedAt || a.deadline || '');
    return (a.deadline || '9999').localeCompare(b.deadline || '9999')
      || (b.important - a.important)
      || a.company.localeCompare(b.company, 'ko');
  });

  // 날짜별 그룹
  const groups = new Map();
  list.forEach((j) => {
    const key = filter === 'done' ? (j.appliedAt || j.deadline || '날짜 미정') : (j.deadline || '날짜 미정');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(j);
  });

  const groupHTML = [...groups.entries()].map(([date, items]) => {
    const isDateKey = /^\d{4}-/.test(date);
    const dday = isDateKey ? ddayOf(date) : null;
    let ddayBadge = '';
    if (filter !== 'done' && dday !== null) {
      if (dday === 0) ddayBadge = '<span class="badge badge--solid-red">D-DAY</span>';
      else if (dday > 0 && dday <= 3) ddayBadge = `<span class="badge badge--red">D-${dday}</span>`;
      else if (dday > 0) ddayBadge = `<span class="badge">D-${dday}</span>`;
      else ddayBadge = '<span class="badge badge--amber">기한 지남</span>';
    }
    return `
    <section class="date-group">
      <div class="date-group__head">
        <span class="date-group__label">${isDateKey ? fmtDate(date) : esc(date)}</span>
        ${ddayBadge}
        <span class="date-group__count">${items.length}건</span>
        <span class="date-group__rule"></span>
      </div>
      <div class="job-list">${items.map((j) => jobCardHTML(j, { showDate: false })).join('')}</div>
    </section>`;
  }).join('');

  root.innerHTML = `
    <div class="quick-add" style="margin-bottom:12px">
      <input class="input" id="jobSearch" placeholder="기업명 · 직무 검색" value="${esc(query)}" autocomplete="off" aria-label="공고 검색" />
      <button class="quick-add__btn" id="jobAddBtn" type="button" aria-label="새 공고 추가">${icons.plus}</button>
    </div>

    <div class="chips" style="margin-bottom:16px">
      ${FILTERS.map((f) => `
        <button class="chip" aria-pressed="${filter === f.key}" data-filter="${f.key}">
          ${f.label} <span class="chip__count">${counts[f.key]}</span>
        </button>`).join('')}
    </div>

    ${list.length ? `<div data-job-groups>${groupHTML}</div>` : `
      <div class="card">
        <div class="empty">
          <span class="empty__icon">${icons.briefcase}</span>
          <p class="empty__title">${q ? '검색 결과가 없어요' : '표시할 공고가 없어요'}</p>
          <p class="empty__desc">${q ? '다른 키워드로 검색해 보세요' : '새 공고를 추가해 보세요'}</p>
          ${q ? '' : `<button class="btn btn--primary btn--sm" id="emptyAdd">${icons.plus}공고 추가</button>`}
        </div>
      </div>`}
  `;

  const search = root.querySelector('#jobSearch');
  search.addEventListener('input', () => {
    query = search.value;
    const pos = search.selectionStart;
    renderJobs(root);
    const s2 = root.querySelector('#jobSearch');
    s2.focus();
    s2.setSelectionRange(pos, pos);
  });

  root.querySelector('#jobAddBtn').addEventListener('click', () => openJobForm());
  root.querySelector('#emptyAdd')?.addEventListener('click', () => openJobForm());
  root.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    filter = b.dataset.filter;
    renderJobs(root);
  }));

  const groupsEl = root.querySelector('[data-job-groups]');
  if (groupsEl) bindJobCards(groupsEl);
}
