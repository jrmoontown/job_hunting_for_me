/**
 * 전형 뷰 — 지원 완료한 공고를 결과 대기 → 진행 중 → 마무리 흐름으로 관리한다.
 * 카드의 [서류 합격] [불합격]은 확인창 없이 바로 바뀌고 토스트로 되돌릴 수 있다.
 */
import { getJobs, getJob, updateJob, setJobStatus, ddayOf, ddayLabel, todayStr } from '../store.js';
import { STATUSES, STATUS_ORDER, isOpenStatus } from '../seed.js';
import { esc, icons, openSheet, closeSheet, toast } from '../ui.js';
import { scheduleSync } from '../sync.js';
import { fmtShort } from '../plan.js';

const GROUP_OF = { applied: 'waiting', doc_pass: 'progress', interview: 'progress', offer: 'done', rejected: 'done', dropped: 'done' };
export const groupOf = (status) => GROUP_OF[status] || null;
const GROUP_LABEL = { waiting: '결과 대기', progress: '진행 중', done: '마무리' };
/** 서류 발표는 보통 2주 안에 난다 — 그보다 오래 기다리면 확인 신호 */
export const LONG_WAIT_DAYS = 14;
const STEP_ORDER = ['applied', 'doc_pass', 'interview', 'offer'];

let filter = 'all';      // all | waiting | progress | done
let doneExpanded = false;

/* ------------------------------------------------------------------ */
/* 집계                                                                */
/* ------------------------------------------------------------------ */
export const daysSince = (dateStr) => { const d = ddayOf(dateStr); return d === null ? null : -d; };
export const resultOverdue = (job) => job.status === 'applied' && Boolean(job.resultDate) && job.resultDate < todayStr();
export const overdueResultCount = () => getJobs().filter(resultOverdue).length;

export function pipelineStats() {
  const jobs = getJobs().filter((j) => !isOpenStatus(j.status));
  const byGroup = (g) => jobs.filter((j) => groupOf(j.status) === g);
  const waiting = byGroup('waiting').sort((a, b) => (daysSince(b.appliedAt) || 0) - (daysSince(a.appliedAt) || 0));
  const progress = byGroup('progress').sort((a, b) => (a.interviewDate || '9999').localeCompare(b.interviewDate || '9999'));
  const done = byGroup('done').sort((a, b) => (lastAt(b) || '').localeCompare(lastAt(a) || ''));
  const waits = waiting.map((j) => daysSince(j.appliedAt)).filter((n) => n !== null);
  const avgWait = waits.length ? Math.round(waits.reduce((s, n) => s + n, 0) / waits.length) : 0;
  const maxWait = waits.length ? Math.max(...waits) : 0;
  const counts = Object.fromEntries(STATUS_ORDER.map((k) => [k, jobs.filter((j) => j.status === k).length]));
  return { jobs, waiting, progress, done, avgWait, maxWait, longest: waiting[0] || null, counts, overdue: jobs.filter(resultOverdue) };
}

const lastAt = (job) => (job.history?.length ? job.history[job.history.length - 1].at : job.appliedAt);

/* ------------------------------------------------------------------ */
/* 카드                                                                */
/* ------------------------------------------------------------------ */
const actBtn = (status, label, kind) => `<button class="pipe-act pipe-act--${kind}" data-set="${status}">${label}</button>`;
const moreBtn = () => `<button class="pipe-act pipe-act--more" data-act="sheet" aria-label="더 보기">${icons.more}</button>`;

function historyLine(job) {
  const h = Array.isArray(job.history) ? job.history : [];
  if (!h.length) return job.memo ? esc(job.memo) : '';
  return h.map((x) => `${fmtShort(x.at).split(' ')[0]} ${STATUSES[x.status]?.short || x.status}`).join(' → ');
}

export function pipelineCardHTML(job) {
  const g = groupOf(job.status);
  const st = STATUSES[job.status] || STATUSES.applied;
  const today = todayStr();
  let right = ''; let meta = ''; let actions = ''; let badges = '';

  if (g === 'waiting') {
    const n = daysSince(job.appliedAt);
    if (n !== null) right = `<span class="pipe-wait__d ${n >= LONG_WAIT_DAYS ? 'pipe-wait__d--long' : ''}">D+${n}</span><span class="pipe-wait__s">${fmtShort(job.appliedAt)} 지원</span>`;
    if (resultOverdue(job)) badges = '<span class="badge badge--solid-red">발표일 지남</span>';
    meta = job.resultDate
      ? `<span>발표 예정 <b>${fmtShort(job.resultDate)}</b> · ${job.resultDate >= today ? ddayLabel(job.resultDate) : '확인해 보세요'}</span>`
      : `<span>발표 예정 미입력</span><button class="pipe-card__add" data-act="sheet">+ 발표일 추가</button>`;
    actions = actBtn('doc_pass', '서류 합격', 'pass') + actBtn('rejected', '불합격', 'fail') + moreBtn();
  } else if (g === 'progress') {
    badges = `<span class="badge badge--violet">${esc(st.label)}</span>`;
    if (job.interviewDate) {
      const d = ddayOf(job.interviewDate);
      right = `<span class="pipe-wait__d pipe-wait__d--violet">${d >= 0 ? `D-${d}` : `D+${-d}`}</span><span class="pipe-wait__s">${d >= 0 ? '면접까지' : '면접 지남'}</span>`;
      meta = `<span>면접 <b>${fmtShort(job.interviewDate)}</b></span>`;
    } else {
      meta = `<span>면접일 미입력</span><button class="pipe-card__add" data-act="sheet">+ 면접일 추가</button>`;
    }
    actions = (job.status === 'doc_pass' ? actBtn('interview', '면접 진행', 'pass') : actBtn('offer', '최종 합격', 'pass'))
      + actBtn('rejected', '불합격', 'fail') + moreBtn();
  } else {
    const tone = st.tone === 'grey' ? 'grey' : st.tone;
    badges = `<span class="badge badge--${tone}">${esc(st.label)}${job.status === 'offer' ? ' 🎉' : ''}</span>`;
    meta = `<span>${historyLine(job)}</span>`;
  }

  return `
  <article class="pipe-card ${g === 'done' ? 'pipe-card--done' : ''}" data-job="${job.id}">
    <button class="pipe-card__main" data-act="sheet" aria-label="${esc(job.company)} 전형 관리">
      <span class="pipe-card__name">
        <span class="pipe-card__co">${esc(job.company)} ${badges}</span>
        ${job.position ? `<span class="pipe-card__pos">${esc(job.position)}</span>` : ''}
      </span>
      ${right ? `<span class="pipe-wait">${right}</span>` : ''}
    </button>
    ${meta ? `<div class="pipe-card__meta">${meta}</div>` : ''}
    ${actions ? `<div class="pipe-card__actions">${actions}</div>` : ''}
  </article>`;
}

/** 빠른 상태 변경 — 되돌리기 토스트 포함 */
function quickSet(id, status) {
  const job = getJob(id);
  if (!job) return;
  const snapshot = { status: job.status, appliedAt: job.appliedAt, history: (job.history || []).slice() };
  setJobStatus(id, status);
  scheduleSync();
  const label = STATUSES[status]?.label || status;
  toast(`${job.company} ${label}${status === 'offer' ? ' 🎉' : ''}으로 바꿨어요`, {
    type: 'success',
    action: { label: '되돌리기', onClick: () => { updateJob(id, snapshot); scheduleSync(); toast('되돌렸어요'); } },
  });
}

export function bindPipelineCards(container) {
  container.addEventListener('click', (e) => {
    const card = e.target.closest('[data-job]');
    if (!card) return;
    const id = card.dataset.job;
    const set = e.target.closest('[data-set]')?.dataset.set;
    if (set) { quickSet(id, set); return; }
    if (e.target.closest('[data-act="sheet"]')) openPipelineSheet(id);
  });
}

/* ------------------------------------------------------------------ */
/* 뷰                                                                  */
/* ------------------------------------------------------------------ */
export function renderPipeline(root) {
  // 다른 화면에서 #/pipeline?f=waiting 처럼 열면 그 필터로 시작
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  if (q.get('f')) { filter = q.get('f'); history.replaceState(null, '', '#/pipeline'); }

  const s = pipelineStats();
  const total = s.jobs.length;
  const seg = (n, color) => (n ? `<i style="flex:${n};background:${color}"></i>` : '');
  const progressN = s.counts.doc_pass + s.counts.interview;

  let hint = '';
  if (s.overdue.length) {
    hint = `<strong>${esc(s.overdue[0].company)}</strong>${s.overdue.length > 1 ? ` 외 ${s.overdue.length - 1}건` : ''}은 발표 예정일이 지났어요. 결과를 확인하고 카드에서 바로 바꿔 주세요.`;
  } else if (s.longest && daysSince(s.longest.appliedAt) >= LONG_WAIT_DAYS) {
    const n = daysSince(s.longest.appliedAt);
    hint = `<strong>${esc(s.longest.company)}</strong>은 지원한 지 ${n >= 21 ? `${Math.floor(n / 7)}주가` : '2주가'} 넘었어요. 채용 페이지에서 발표 일정을 확인해 보세요.`;
  }

  const CHIPS = [
    ['all', '전체', total], ['waiting', '결과 대기', s.waiting.length],
    ['progress', '진행 중', progressN], ['done', '마무리', s.done.length],
  ];
  const show = (g) => filter === 'all' || filter === g;
  const doneList = doneExpanded || filter === 'done' ? s.done : s.done.slice(0, 3);

  root.innerHTML = `
    <div class="pipe-summary">
      <div class="pipe-summary__row">
        <div class="kpi kpi--blue"><span class="kpi__k">결과 대기</span><span class="kpi__v">${s.waiting.length}<small>건</small></span><span class="kpi__s">${s.waiting.length ? `평균 ${s.avgWait}일째` : '기다리는 결과 없음'}</span></div>
        <div class="kpi kpi--violet"><span class="kpi__k">진행 중</span><span class="kpi__v">${progressN}<small>건</small></span><span class="kpi__s">서류 합격 ${s.counts.doc_pass} · 면접 ${s.counts.interview}</span></div>
        <div class="kpi"><span class="kpi__k">마무리</span><span class="kpi__v">${s.done.length}<small>건</small></span><span class="kpi__s">합격 ${s.counts.offer} · 불합 ${s.counts.rejected} · 포기 ${s.counts.dropped}</span></div>
      </div>
      ${total ? `
      <div class="funnel">
        <div class="funnel__bar" role="img" aria-label="지원 ${total}건 상태 분포">
          ${seg(s.waiting.length, 'var(--primary)')}${seg(progressN, 'var(--violet-500)')}${seg(s.counts.offer, 'var(--success)')}${seg(s.counts.rejected, 'var(--danger)')}${seg(s.counts.dropped, 'var(--grey-400)')}
        </div>
        <div class="funnel__legend">
          <span><i style="background:var(--primary)"></i>대기 <b>${s.waiting.length}</b></span>
          <span><i style="background:var(--violet-500)"></i>진행 <b>${progressN}</b></span>
          <span><i style="background:var(--success)"></i>합격 <b>${s.counts.offer}</b></span>
          <span><i style="background:var(--danger)"></i>불합격 <b>${s.counts.rejected}</b></span>
          <span><i style="background:var(--grey-400)"></i>포기 <b>${s.counts.dropped}</b></span>
        </div>
      </div>` : ''}
    </div>

    <div class="chips" role="tablist" aria-label="전형 필터" style="margin-bottom:12px">
      ${CHIPS.map(([k, label, n]) => `<button class="chip" role="tab" aria-pressed="${filter === k}" data-filter="${k}">${label} <span class="chip__count">${n}</span></button>`).join('')}
    </div>

    ${hint ? `<div class="callout callout--warn" style="margin-bottom:14px">${icons.alert}<div>${hint}</div></div>` : ''}

    ${!total ? `
      <div class="card"><div class="empty">
        <span class="empty__icon">${icons.pipeline}</span>
        <p class="empty__title">아직 지원 완료한 공고가 없어요</p>
        <p class="empty__desc">공고 탭에서 "지원 완료로 표시"를 누르면 여기서 결과를 관리할 수 있어요</p>
      </div></div>` : ''}

    ${total && show('waiting') ? `
    <section class="section">
      <div class="section__head">
        <h3 class="section__title">결과 대기 <span class="section__count">${s.waiting.length}</span></h3>
        ${s.waiting.length ? '<span class="section__desc">오래 기다린 순</span>' : ''}
      </div>
      ${s.waiting.length ? `<div class="pipe-list" data-pipe-list>${s.waiting.map(pipelineCardHTML).join('')}</div>`
        : '<div class="card"><div class="empty" style="padding:22px 16px"><p class="empty__title">기다리는 결과가 없어요</p></div></div>'}
    </section>` : ''}

    ${total && show('progress') ? `
    <section class="section">
      <div class="section__head"><h3 class="section__title">진행 중 <span class="section__count">${progressN}</span></h3></div>
      ${s.progress.length ? `<div class="pipe-list" data-pipe-list>${s.progress.map(pipelineCardHTML).join('')}</div>`
        : `<div class="card"><div class="empty" style="padding:22px 16px"><p class="empty__title">아직 서류 합격 소식이 없어요</p><p class="empty__desc">합격을 누르면 여기로 옮겨지고 면접일을 적을 수 있어요</p></div></div>`}
    </section>` : ''}

    ${total && show('done') ? `
    <section class="section">
      <div class="section__head">
        <h3 class="section__title">마무리 <span class="section__count">${s.done.length}</span></h3>
        ${s.done.length > 3 && filter !== 'done' ? `<button class="section__action" data-toggle-done>${doneExpanded ? '접기' : `${s.done.length - 3}건 더 보기`} ${icons.chevronDown}</button>` : ''}
      </div>
      ${s.done.length ? `<div class="pipe-list" data-pipe-list>${doneList.map(pipelineCardHTML).join('')}</div>`
        : '<div class="card"><div class="empty" style="padding:22px 16px"><p class="empty__title">마무리된 전형이 없어요</p></div></div>'}
    </section>` : ''}
  `;

  root.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.filter; renderPipeline(root); }));
  root.querySelector('[data-toggle-done]')?.addEventListener('click', () => { doneExpanded = !doneExpanded; renderPipeline(root); });
  root.querySelectorAll('[data-pipe-list]').forEach(bindPipelineCards);
}

/* ------------------------------------------------------------------ */
/* 전형 상태 바꾸기 시트                                                  */
/* ------------------------------------------------------------------ */
export function openPipelineSheet(id) {
  const job = getJob(id);
  if (!job) return;
  const g = groupOf(job.status);
  const hist = Array.isArray(job.history) ? job.history : [];
  const reached = Math.max(STEP_ORDER.indexOf(job.status), ...hist.map((h) => STEP_ORDER.indexOf(h.status)));
  const finished = job.status === 'rejected' || job.status === 'dropped';
  const atOf = (status) => hist.find((h) => h.status === status)?.at || '';
  const waitN = daysSince(job.appliedAt);

  const sub = g === 'waiting' ? `${fmtShort(job.appliedAt)} 지원 · 결과 대기 ${waitN ?? 0}일째`
    : g === 'progress' ? `${STATUSES[job.status].label}${job.interviewDate ? ` · 면접 ${fmtShort(job.interviewDate)}` : ''}`
    : `${STATUSES[job.status].label}${lastAt(job) ? ` · ${fmtShort(lastAt(job))}` : ''}`;

  const step = (idx, title, desc, btn) => {
    const key = STEP_ORDER[idx];
    const done = idx <= reached && !(finished && idx > reached);
    const now = !finished && idx === reached + 1;
    const cls = done ? 'pipe-step--done' : now ? 'pipe-step--now' : 'pipe-step--todo';
    return `
      <div class="pipe-step ${cls}">
        <span class="pipe-step__dot">${done ? icons.checkSmall : ''}</span>
        <div><div class="pipe-step__t">${title}</div>${desc ? `<div class="pipe-step__s">${desc}</div>` : ''}</div>
        <div>${btn || ''}</div>
      </div>`;
  };
  const dateIn = (id2, name, value, ph) => `
    <label class="pipe-step__in"><span>${icons.calendar}</span>
      <input type="date" id="${id2}" name="${name}" value="${esc(value || '')}" aria-label="${ph}" /></label>`;

  const sheet = openSheet({
    title: job.company,
    desc: sub,
    body: `
      <form id="pipeForm" novalidate>
        <div class="pipe-steps">
          ${step(0, '지원 완료', job.appliedAt ? fmtShort(job.appliedAt) : '')}
          ${step(1, '서류 결과',
            `${atOf('doc_pass') ? `${fmtShort(atOf('doc_pass'))} 합격` : '발표 예정일을 적어 두면 지난 뒤 알려드려요'}${reached < 1 && !finished ? dateIn('p-result', 'resultDate', job.resultDate, '발표 예정일') : ''}`,
            !finished && reached === 0 ? '<button type="button" class="pipe-step__btn pipe-step__btn--pri" data-set="doc_pass">서류 합격</button>' : '')}
          ${step(2, '면접',
            `${atOf('interview') ? `${fmtShort(atOf('interview'))} 면접 진행` : reached >= 1 ? '면접일을 적어 두면 캘린더에 표시돼요' : '서류 합격 후 면접일을 적을 수 있어요'}${reached >= 1 && !finished ? dateIn('p-interview', 'interviewDate', job.interviewDate, '면접일') : ''}`,
            !finished && reached === 1 ? '<button type="button" class="pipe-step__btn pipe-step__btn--pri" data-set="interview">면접 진행</button>' : '')}
          ${step(3, '최종 합격', atOf('offer') ? `${fmtShort(atOf('offer'))} 🎉` : '',
            !finished && reached >= 1 && reached < 3 ? '<button type="button" class="pipe-step__btn pipe-step__btn--pri" data-set="offer">최종 합격</button>' : '')}
        </div>

        ${!finished && job.status !== 'offer' ? `
        <div class="pipe-outcomes">
          <button type="button" class="pipe-outcome pipe-outcome--red" data-set="rejected">불합격</button>
          <button type="button" class="pipe-outcome" data-set="dropped">지원 포기</button>
        </div>` : `
        <div class="pipe-outcomes pipe-outcomes--single">
          <span class="badge badge--${STATUSES[job.status].tone === 'grey' ? 'grey' : STATUSES[job.status].tone}" style="height:32px;font-size:13px">${STATUSES[job.status].label}로 마무리됨</span>
          <button type="button" class="btn btn--ghost btn--sm" data-set="applied">결과 대기로 되돌리기</button>
        </div>`}

        <div class="field" style="margin-top:16px">
          <label class="field__label" for="p-memo">메모</label>
          <textarea class="textarea" id="p-memo" name="memo" placeholder="예) 인적성 9/20, 면접 복장 확인">${esc(job.memo || '')}</textarea>
        </div>

        <div class="pipe-timeline">
          <p class="pipe-timeline__title">전형 기록</p>
          <ul>
            ${hist.map((h) => `<li><span>${fmtShort(h.at)}</span><span>${STATUSES[h.status]?.label || h.status}</span></li>`).join('')}
            ${job.status === 'applied' && job.resultDate ? `<li class="is-future"><span>${fmtShort(job.resultDate)}</span><span>서류 발표 예정</span></li>` : ''}
            ${job.interviewDate && !atOf('interview') ? `<li class="is-future"><span>${fmtShort(job.interviewDate)}</span><span>면접 예정</span></li>` : ''}
          </ul>
        </div>
        <button type="button" class="btn btn--ghost btn--sm btn--block" data-act="detail" style="margin-top:6px">${icons.briefcase}공고 상세 · 수정 열기</button>
      </form>
    `,
    foot: `
      <button class="btn btn--neutral" data-close>닫기</button>
      <button class="btn btn--primary" type="submit" form="pipeForm">저장</button>
    `,
  });

  const form = sheet.querySelector('#pipeForm');
  const saveDates = () => {
    const patch = { memo: form.memo.value.trim() };
    if (form.resultDate) patch.resultDate = form.resultDate.value;
    if (form.interviewDate) patch.interviewDate = form.interviewDate.value;
    updateJob(id, patch);
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveDates();
    scheduleSync();
    closeSheet();
    toast('저장했어요', { type: 'success' });
  });
  sheet.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => {
    saveDates(); // 날짜 입력을 잃지 않도록 먼저 저장
    const status = b.dataset.set;
    if (status === 'rejected' || status === 'dropped') {
      quickSet(id, status);
      closeSheet();
    } else if (status === 'applied') {
      quickSet(id, status);
      openPipelineSheet(id);
    } else {
      quickSet(id, status);
      openPipelineSheet(id); // 다음 단계가 열린 상태로 다시 그림
    }
  }));
  sheet.querySelector('[data-act="detail"]').addEventListener('click', async () => {
    saveDates();
    closeSheet();
    const m = await import('./jobShared.js');
    m.openJobDetail(id);
  });
}
