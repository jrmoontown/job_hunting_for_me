/**
 * 개인 일정 — 카드 렌더, 추가/수정 시트, 그리고 "무엇을 추가할지" 고르는 시트.
 */
import { getEvent, addEvent, updateEvent, deleteEvent, getJobs } from '../store.js';
import { EVENT_KINDS, AVAIL, isOpenStatus } from '../seed.js';
import { esc, icons, openSheet, closeSheet, confirmSheet, toast } from '../ui.js';
import { scheduleSync } from '../sync.js';
import { fmtShort, addDays, availabilityOf } from '../plan.js';
import { openJobForm } from './jobShared.js';
import { openTodoForm } from './todos.js';

const KIND_ICON = { trip: 'luggage', meet: 'people', anniv: 'heart', work: 'building', other: 'flag' };

/* ------------------------------------------------------------------ */
/* 카드                                                                */
/* ------------------------------------------------------------------ */
export function eventRangeLabel(e) {
  const end = e.end || e.start;
  if (end === e.start) return fmtShort(e.start);
  const [sy, sm, sd] = e.start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const days = Math.round((new Date(ey, em - 1, ed) - new Date(sy, sm - 1, sd)) / 86400000) + 1;
  return `${fmtShort(e.start)} – ${fmtShort(end)} · ${days}일`;
}

export function eventCardHTML(e) {
  const av = AVAIL[e.avail] || AVAIL.ok;
  return `
  <button class="evt-card" data-event="${e.id}" aria-label="${esc(e.title)} 일정 열기">
    <span class="evt-card__mark evt-card__mark--${e.avail}">${icons[KIND_ICON[e.kind] || 'flag']}</span>
    <span class="evt-card__text">
      <span class="evt-card__title">${esc(e.title)}</span>
      <span class="evt-card__sub">${eventRangeLabel(e)}${EVENT_KINDS[e.kind] ? ` · ${EVENT_KINDS[e.kind]}` : ''}</span>
    </span>
    <span class="evt-card__pill evt-card__pill--${e.avail}">${e.avail === 'ok' ? '작성 가능' : `작성 ${av.label}`}</span>
  </button>`;
}

export function bindEventCards(container) {
  container.addEventListener('click', (e) => {
    const card = e.target.closest('[data-event]');
    if (card) openEventForm(card.dataset.event);
  });
}

/* ------------------------------------------------------------------ */
/* 추가 / 수정 시트                                                      */
/* ------------------------------------------------------------------ */
export function openEventForm(id = null, { presetDate = '' } = {}) {
  const ev = id ? getEvent(id) : null;
  const isEdit = Boolean(ev);
  let kind = ev?.kind || 'trip';
  let avail = ev?.avail || 'none';

  const kindChips = Object.entries(EVENT_KINDS).map(([k, label]) => `
    <button type="button" class="chip" data-kind="${k}" aria-pressed="${k === kind}">${label}</button>`).join('');
  const availOpts = Object.entries(AVAIL).map(([k, a]) => `
    <button type="button" class="seg__opt" data-avail="${k}" aria-pressed="${k === avail}">${a.label}<small>${a.desc}</small></button>`).join('');

  const sheet = openSheet({
    title: isEdit ? '개인 일정 수정' : '개인 일정 추가',
    desc: '이 날엔 지원서를 쓸 수 있나요?',
    body: `
      <form id="eventForm" novalidate>
        <div class="field">
          <label class="field__label" for="e-title">제목 *</label>
          <input class="input" id="e-title" name="title" required placeholder="예) 가족 속초 여행"
            value="${esc(ev?.title || '')}" autocomplete="off" />
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field__label" for="e-start">시작 *</label>
            <input class="input" id="e-start" name="start" type="date" required value="${esc(ev?.start || presetDate || '')}" />
          </div>
          <div class="field">
            <label class="field__label" for="e-end">끝</label>
            <input class="input" id="e-end" name="end" type="date" value="${esc(ev?.end || '')}" />
            <p class="field__hint">하루짜리면 비워두세요</p>
          </div>
        </div>
        <div class="field">
          <span class="field__label">종류</span>
          <div class="chips kind-chips" id="e-kinds">${kindChips}</div>
        </div>
        <div class="field">
          <span class="field__label">지원서 작성</span>
          <div class="seg" id="e-avail">${availOpts}</div>
        </div>
        <div class="field">
          <label class="field__label" for="e-memo">메모 <span style="font-weight:500;color:var(--text-disabled)">(선택)</span></label>
          <input class="input" id="e-memo" name="memo" placeholder="예) 노트북은 안 가져감" value="${esc(ev?.memo || '')}" autocomplete="off" />
        </div>
        <div id="e-preview"></div>
      </form>
    `,
    foot: `
      ${isEdit ? `<button class="btn btn--danger btn--icon-only" data-act="delete" aria-label="일정 삭제">${icons.trash}</button>` : ''}
      <button class="btn btn--neutral" data-close>취소</button>
      <button class="btn btn--primary" type="submit" form="eventForm">${isEdit ? '저장' : '추가하기'}</button>
    `,
  });

  const form = sheet.querySelector('#eventForm');
  const startEl = form.start;
  const endEl = form.end;
  const preview = sheet.querySelector('#e-preview');

  const renderPreview = () => {
    const start = startEl.value;
    const end = endEl.value || start;
    if (!start || avail === 'ok') { preview.innerHTML = ''; return; }
    const hit = getJobs().filter((j) => isOpenStatus(j.status) && j.deadline >= start && j.deadline <= end && j.id);
    if (!hit.length) { preview.innerHTML = ''; return; }
    const names = hit.slice(0, 3).map((j) => esc(j.company)).join(', ') + (hit.length > 3 ? ` 외 ${hit.length - 3}건` : '');
    let action;
    if (avail === 'none') {
      // 미리 보기: 시작 전날부터 거슬러 올라가 쓸 수 있는 날
      let d = addDays(start, -1); let steps = 0;
      while (steps++ < 30 && availabilityOf(d) !== 'ok') d = addDays(d, -1);
      action = `저장하면 <strong>${fmtShort(d)}까지</strong> 쓰도록 표시해요.`;
    } else {
      action = '저장하면 마감 전 여유 있는 날에 <strong>미리 쓰기</strong>를 권해요.';
    }
    preview.innerHTML = `
      <div class="callout callout--warn" style="margin-top:4px">
        ${icons.alert}
        <div>이 기간에 <strong>${names}</strong> 마감이 있어요.<br/>${action}</div>
      </div>`;
  };

  sheet.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => {
    kind = b.dataset.kind;
    sheet.querySelectorAll('[data-kind]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  }));
  sheet.querySelectorAll('[data-avail]').forEach((b) => b.addEventListener('click', () => {
    avail = b.dataset.avail;
    sheet.querySelectorAll('[data-avail]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    renderPreview();
  }));
  startEl.addEventListener('change', () => {
    if (endEl.value && endEl.value < startEl.value) endEl.value = startEl.value;
    renderPreview();
  });
  endEl.addEventListener('change', () => {
    if (endEl.value && startEl.value && endEl.value < startEl.value) startEl.value = endEl.value;
    renderPreview();
  });
  renderPreview();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = form.title.value.trim();
    const start = form.start.value;
    let end = form.end.value;
    if (!title) { toast('제목을 입력해 주세요', { type: 'error' }); form.title.focus(); return; }
    if (!start) { toast('시작 날짜를 선택해 주세요', { type: 'error' }); form.start.focus(); return; }
    if (!end || end < start) end = start;
    const data = { title, start, end, kind, avail, memo: form.memo.value.trim() };
    if (isEdit) {
      updateEvent(id, data);
      toast('일정을 수정했어요', { type: 'success' });
    } else {
      addEvent(data);
      toast(`‘${title}’ 일정을 추가했어요`, { type: 'success' });
    }
    scheduleSync();
    closeSheet();
  });

  sheet.querySelector('[data-act="delete"]')?.addEventListener('click', async () => {
    closeSheet();
    const ok = await confirmSheet({ title: '일정을 삭제할까요?', desc: `‘${ev.title}’ 일정이 캘린더에서 사라져요.` });
    if (ok) { deleteEvent(id); scheduleSync(); toast('일정을 삭제했어요'); }
  });
}

/* ------------------------------------------------------------------ */
/* 무엇을 추가할지 고르기 — 캘린더/현황의 + 버튼                          */
/* ------------------------------------------------------------------ */
export function openAddChooser({ presetDate = '' } = {}) {
  const sheet = openSheet({
    title: '무엇을 추가할까요?',
    desc: presetDate ? `${fmtShort(presetDate)}에 추가해요` : '',
    body: `
      <div class="chooser">
        <button class="chooser__opt" data-pick="job">
          <span class="chooser__icon" style="background:var(--primary-weak);color:var(--primary)">${icons.briefcase}</span>
          <span><span class="chooser__title">공고</span><span class="chooser__desc">기업 · 직무 · 마감일</span></span>
        </button>
        <button class="chooser__opt" data-pick="event">
          <span class="chooser__icon" style="background:var(--teal-50);color:var(--teal-700)">${icons.luggage}</span>
          <span><span class="chooser__title">개인 일정</span><span class="chooser__desc">여행 · 약속 · 기념일처럼 지원서를 못 쓰는 날</span></span>
        </button>
        <button class="chooser__opt" data-pick="todo">
          <span class="chooser__icon" style="background:var(--violet-50);color:var(--violet-500)">${icons.check}</span>
          <span><span class="chooser__title">할 일</span><span class="chooser__desc">기한 · 연결할 공고</span></span>
        </button>
      </div>`,
  });
  sheet.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
    const pick = b.dataset.pick;
    closeSheet();
    if (pick === 'job') openJobForm(null, { presetDate });
    else if (pick === 'event') openEventForm(null, { presetDate });
    else openTodoForm();
  }));
}
