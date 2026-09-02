/**
 * 공고 카드 / 상세 시트 / 등록·수정 폼 — 캘린더·공고 뷰에서 공유.
 */
import {
  getJob, addJob, updateJob, deleteJob, setJobStatus, toggleImportant,
  ddayOf, ddayLabel, fmtDate, todayStr,
} from '../store.js';
import { STATUSES, STATUS_ORDER, isOpenStatus } from '../seed.js';
import { esc, icons, openSheet, closeSheet, confirmSheet, toast } from '../ui.js';
import { scheduleSync } from '../sync.js';
import { planFor, fmtShort } from '../plan.js';

/** 개인 일정과 겹칠 때 붙는 "언제까지 쓰기" 칩 */
export function planChipHTML(job) {
  const p = planFor(job.id);
  if (!p) return '';
  if (!p.writeBy) return `<span class="shift">${icons.alert}일정 겹침</span>`;
  if (p.kind === 'none') return `<span class="shift shift--ok">${icons.chevronLeft}${fmtShort(p.writeBy)}까지 쓰기</span>`;
  return `<span class="shift">${icons.chevronLeft}${fmtShort(p.writeBy)}에 미리 쓰기</span>`;
}

function planCalloutHTML(job) {
  const p = planFor(job.id);
  if (!p) return '';
  const evName = p.event ? esc(p.event.title) : '개인 일정';
  let text;
  if (p.kind === 'none') {
    text = `<strong>마감일이 ‘${evName}’ 기간이에요.</strong><br/>${p.writeBy
      ? `${fmtShort(p.writeBy)}까지 써두면 안전해요.`
      : '마감 전에 쓸 수 있는 날이 없어요. 마감일이나 일정을 조정해 주세요.'}`;
  } else {
    text = `<strong>마감일에 ‘${evName}’ 일정이 있어요.</strong><br/>${p.writeBy
      ? `${fmtShort(p.writeBy)}에 미리 써두는 걸 권해요${p.load >= 3 ? ` (그날 ${p.load}건 몰림)` : ''}.`
      : '마감 전에 여유 있는 날이 없어요.'}`;
  }
  return `
      <div class="callout callout--warn" style="margin-top:14px">${icons.alert}<div>${text}</div></div>
      ${p.writeBy ? `<button class="btn btn--neutral btn--block" style="margin-top:10px" data-act="pull" data-date="${p.writeBy}">${icons.calendar}내 마감일을 ${fmtShort(p.writeBy)}로 당기기</button>` : ''}`;
}

/* ------------------------------------------------------------------ */
/* 카드 렌더                                                            */
/* ------------------------------------------------------------------ */
export function jobCardHTML(job, { showDate = true } = {}) {
  const st = STATUSES[job.status] || STATUSES.planned;
  const open = isOpenStatus(job.status);
  const dday = ddayOf(job.deadline);
  const overdue = open && dday !== null && dday < 0;

  let ddayCls = 'job-card__dday--far';
  if (dday !== null && dday <= 2) ddayCls = 'job-card__dday--soon';
  else if (dday !== null && dday <= 5) ddayCls = 'job-card__dday--near';

  const badge = open
    ? (overdue ? '<span class="badge badge--amber">기한 지남</span>' : '')
    : `<span class="badge badge--${st.tone === 'grey' ? '' : st.tone}">${esc(st.label)}</span>`;

  return `
  <article class="job-card ${job.important ? 'job-card--important' : ''} ${!open ? 'job-card--done' : ''} ${overdue ? 'job-card--overdue' : ''}" data-job="${job.id}">
    <button class="job-card__main" data-act="detail" aria-label="${esc(job.company)} 상세 보기">
      <div class="job-card__top">
        <span class="job-card__company">${esc(job.company)}</span>
        ${job.important ? '<span class="badge badge--red">중요</span>' : ''}
        ${badge}
      </div>
      ${job.position ? `<p class="job-card__position">${esc(job.position)}</p>` : ''}
      <div class="job-card__meta">
        ${open && job.deadline ? `<span class="job-card__dday ${ddayCls}">${ddayLabel(job.deadline)}</span>` : ''}
        ${showDate && job.deadline ? `<span class="job-card__date">${fmtDate(job.deadline)} 마감</span>` : ''}
        ${!open && job.appliedAt ? `<span class="job-card__date">${fmtDate(job.appliedAt)} 지원</span>` : ''}
        ${open ? planChipHTML(job) : ''}
      </div>
    </button>
    <div class="job-card__side">
      <button class="star-btn" data-act="star" aria-pressed="${job.important}" aria-label="중요 표시 토글">
        ${job.important ? icons.starFill : icons.star}
      </button>
      ${job.url ? `<a class="link-btn" href="${esc(job.url)}" target="_blank" rel="noopener noreferrer" data-act="link" aria-label="채용 사이트 열기">${icons.external}</a>` : ''}
    </div>
  </article>`;
}

/** 카드가 든 컨테이너에 클릭 위임 바인딩 */
export function bindJobCards(container) {
  container.addEventListener('click', (e) => {
    const card = e.target.closest('[data-job]');
    if (!card) return;
    const id = card.dataset.job;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'star') {
      const job = toggleImportant(id);
      scheduleSync();
      if (job) toast(job.important ? '중요 공고로 표시했어요' : '중요 표시를 해제했어요');
    } else if (act === 'link') {
      /* 링크는 브라우저 기본 동작 */
    } else if (act === 'detail') {
      openJobDetail(id);
    }
  });
}

/* ------------------------------------------------------------------ */
/* 상세 시트                                                            */
/* ------------------------------------------------------------------ */
export function openJobDetail(id) {
  const job = getJob(id);
  if (!job) return;
  const st = STATUSES[job.status] || STATUSES.planned;
  const open = isOpenStatus(job.status);
  const dday = ddayOf(job.deadline);

  const statusBtns = STATUS_ORDER.map((key) => `
    <button class="status-opt" data-status="${key}" aria-pressed="${job.status === key}">
      <span class="status-opt__dot" style="background:${STATUSES[key].color}"></span>
      ${STATUSES[key].label}
    </button>`).join('');

  const sheet = openSheet({
    title: '공고 상세',
    body: `
      <div class="detail-hero">
        <h3 class="detail-hero__company">${esc(job.company)}</h3>
        ${job.position ? `<p class="detail-hero__position">${esc(job.position)}</p>` : ''}
        <div class="detail-hero__badges">
          ${open && job.deadline && dday !== null ? `<span class="badge ${dday <= 2 ? 'badge--solid-red' : 'badge--blue'}">${ddayLabel(job.deadline)}</span>` : ''}
          <span class="badge badge--${st.tone === 'grey' ? '' : st.tone}">${esc(st.label)}</span>
          ${job.important ? `<span class="badge badge--red">${icons.starFill}중요</span>` : ''}
        </div>
      </div>

      <div class="field">
        <span class="field__label">진행 상태</span>
        <div class="status-picker">${statusBtns}</div>
      </div>

      <div class="field">
        <div class="switch-row">
          <div class="switch-row__text">
            <p class="switch-row__title">중요 공고</p>
            <p class="switch-row__desc">캘린더와 목록에서 빨간색으로 강조돼요</p>
          </div>
          <button class="switch switch--amber" role="switch" aria-checked="${job.important}" data-act="important" aria-label="중요 공고 토글"></button>
        </div>
      </div>

      <div class="detail-rows">
        <div class="detail-row">
          <span class="detail-row__label">내 마감일</span>
          <span class="detail-row__value">${job.deadline ? fmtDate(job.deadline, { withYear: true }) : '미정'}</span>
        </div>
        ${job.realDeadline ? `
        <div class="detail-row">
          <span class="detail-row__label">실제 마감일</span>
          <span class="detail-row__value">${fmtDate(job.realDeadline, { withYear: true })}</span>
        </div>` : ''}
        ${job.appliedAt ? `
        <div class="detail-row">
          <span class="detail-row__label">지원일</span>
          <span class="detail-row__value">${fmtDate(job.appliedAt, { withYear: true })}</span>
        </div>` : ''}
        <div class="detail-row">
          <span class="detail-row__label">채용 링크</span>
          <span class="detail-row__value">${job.url
            ? `<a href="${esc(job.url)}" target="_blank" rel="noopener noreferrer">공고 페이지 열기 ↗</a>`
            : '<span style="color:var(--text-tertiary)">등록된 링크가 없어요</span>'}</span>
        </div>
        ${job.memo ? `
        <div class="detail-row">
          <span class="detail-row__label">메모</span>
          <span class="detail-row__value" style="white-space:pre-wrap">${esc(job.memo)}</span>
        </div>` : ''}
      </div>
      ${open ? planCalloutHTML(job) : ''}
    `,
    foot: `
      <button class="btn btn--danger btn--icon-only" data-act="delete" aria-label="공고 삭제">${icons.trash}</button>
      <button class="btn btn--neutral" data-act="edit">${icons.edit}수정</button>
      ${open
        ? '<button class="btn btn--primary" data-act="apply">지원 완료로 표시</button>'
        : '<button class="btn btn--primary" data-act="close-sheet">확인</button>'}
    `,
  });

  sheet.querySelectorAll('.status-opt').forEach((b) => b.addEventListener('click', () => {
    setJobStatus(id, b.dataset.status);
    scheduleSync();
    openJobDetail(id); // 최신 상태로 다시 그림
  }));
  sheet.querySelector('[data-act="important"]').addEventListener('click', () => {
    toggleImportant(id);
    scheduleSync();
    openJobDetail(id);
  });
  sheet.querySelector('[data-act="edit"]').addEventListener('click', () => openJobForm(id));
  sheet.querySelector('[data-act="pull"]')?.addEventListener('click', (e) => {
    const date = e.currentTarget.dataset.date;
    updateJob(id, { deadline: date });
    scheduleSync();
    toast(`마감일을 ${fmtShort(date)}로 옮겼어요`, { type: 'success' });
    openJobDetail(id);
  });
  sheet.querySelector('[data-act="apply"]')?.addEventListener('click', () => {
    setJobStatus(id, 'applied');
    scheduleSync();
    closeSheet();
    toast(`${job.company} 지원 완료! 수고했어요 🎉`, { type: 'success' });
  });
  sheet.querySelector('[data-act="close-sheet"]')?.addEventListener('click', closeSheet);
  sheet.querySelector('[data-act="delete"]').addEventListener('click', async () => {
    closeSheet();
    const ok = await confirmSheet({
      title: '공고를 삭제할까요?',
      desc: `‘${job.company}’ 공고가 목록과 캘린더에서 사라져요.`,
    });
    if (ok) {
      deleteJob(id);
      scheduleSync();
      toast('공고를 삭제했어요');
    }
  });
}

/* ------------------------------------------------------------------ */
/* 등록 / 수정 폼                                                        */
/* ------------------------------------------------------------------ */
export function openJobForm(id = null, { presetDate = '' } = {}) {
  const job = id ? getJob(id) : null;
  const isEdit = Boolean(job);

  const sheet = openSheet({
    title: isEdit ? '공고 수정' : '새 공고 추가',
    desc: isEdit ? '' : '기업 · 직무 · 마감일만 있으면 충분해요',
    body: `
      <form id="jobForm" novalidate>
        <div class="field">
          <label class="field__label" for="f-company">기업명 *</label>
          <input class="input" id="f-company" name="company" required placeholder="예) LG전자"
            value="${esc(job?.company || '')}" autocomplete="off" />
        </div>
        <div class="field">
          <label class="field__label" for="f-position">직무</label>
          <input class="input" id="f-position" name="position" placeholder="예) SW 개발 (미정이면 비워두세요)"
            value="${esc(job?.position || '')}" autocomplete="off" />
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field__label" for="f-deadline">내 마감일 *</label>
            <input class="input" id="f-deadline" name="deadline" type="date" required
              value="${esc(job?.deadline || presetDate || '')}" />
            <p class="field__hint">스스로 정한 제출 목표일</p>
          </div>
          <div class="field">
            <label class="field__label" for="f-realDeadline">실제 마감일</label>
            <input class="input" id="f-realDeadline" name="realDeadline" type="date"
              value="${esc(job?.realDeadline || '')}" />
            <p class="field__hint">기업 공지 기준 (선택)</p>
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="f-url">채용 공고 링크</label>
          <input class="input" id="f-url" name="url" type="url" inputmode="url"
            placeholder="https://…" value="${esc(job?.url || '')}" autocomplete="off" />
        </div>
        <div class="field">
          <label class="field__label" for="f-memo">메모</label>
          <textarea class="textarea" id="f-memo" name="memo" placeholder="자소서 문항, 전형 일정, 준비할 것 등">${esc(job?.memo || '')}</textarea>
        </div>
        <div class="field">
          <div class="switch-row">
            <div class="switch-row__text">
              <p class="switch-row__title">중요 공고로 표시</p>
              <p class="switch-row__desc">꼭 챙겨야 하는 공고라면 켜 두세요</p>
            </div>
            <button type="button" class="switch switch--amber" role="switch"
              aria-checked="${job?.important ? 'true' : 'false'}" id="f-important" aria-label="중요 공고 토글"></button>
          </div>
        </div>
      </form>
    `,
    foot: `
      <button class="btn btn--neutral" data-close>취소</button>
      <button class="btn btn--primary" type="submit" form="jobForm">${isEdit ? '저장' : '추가하기'}</button>
    `,
  });

  const importantBtn = sheet.querySelector('#f-important');
  importantBtn.addEventListener('click', () => {
    importantBtn.setAttribute('aria-checked', importantBtn.getAttribute('aria-checked') !== 'true');
  });

  sheet.querySelector('#jobForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const company = f.company.value.trim();
    const deadline = f.deadline.value;
    if (!company) { toast('기업명을 입력해 주세요', { type: 'error' }); f.company.focus(); return; }
    if (!deadline) { toast('마감일을 선택해 주세요', { type: 'error' }); f.deadline.focus(); return; }
    let url = f.url.value.trim();
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;

    const data = {
      company,
      position: f.position.value.trim(),
      deadline,
      realDeadline: f.realDeadline.value,
      url,
      memo: f.memo.value.trim(),
      important: importantBtn.getAttribute('aria-checked') === 'true',
    };

    if (isEdit) {
      updateJob(id, data);
      toast('공고를 수정했어요', { type: 'success' });
    } else {
      addJob(data);
      toast(`${company} 공고를 추가했어요`, { type: 'success' });
    }
    scheduleSync();
    closeSheet();
  });
}
