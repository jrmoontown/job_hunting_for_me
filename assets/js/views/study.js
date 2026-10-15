/**
 * 공부 뷰 — 자격증 교재(과정)와 날짜별 파트 일정.
 * 교재에 파트를 등록 → "일정 짜기"로 요일에 파트를 배분 → 날마다 체크.
 */
import {
  getStudies, getStudy, getSessions, getSession, getEvents,
  addStudy, updateStudy, deleteStudy, toggleUnit,
  addSessions, updateSession, toggleSession, deleteSession, clearPendingSessions,
  todayStr, ddayOf, ddayLabel, fmtDate, WEEKDAYS_KO,
} from '../store.js';
import { STUDY_COLORS } from '../seed.js';
import { esc, icons, openSheet, closeSheet, confirmSheet, toast } from '../ui.js';
import { scheduleSync } from '../sync.js';
import { fmtShort, addDays, dowOf, availabilityOf } from '../plan.js';

let filter = 'week'; // week | all | missed

/* ------------------------------------------------------------------ */
/* 집계                                                                */
/* ------------------------------------------------------------------ */
export const colorOf = (study) => STUDY_COLORS[study?.color] || STUDY_COLORS.green;
export const progressOf = (study) => {
  const total = study.units.length;
  const done = study.units.filter((u) => u.done).length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
};
export const sessionLabel = (s, study = getStudy(s.studyId)) => {
  if (s.title) return s.title;
  const names = (study?.units || []).filter((u) => s.unitIds.includes(u.id)).map((u) => u.name);
  return names.length ? names.join(' · ') : '공부';
};
export const sessionsOn = (date) => getSessions().filter((s) => s.date === date);
export const missedSessions = () => getSessions().filter((s) => !s.done && s.date < todayStr());

export function studyStats() {
  const today = todayStr();
  const sessions = getSessions();
  const todays = sessions.filter((s) => s.date === today).sort((a, b) => a.done - b.done);
  const missed = missedSessions();
  const weekStart = addDays(today, -dowOf(today));
  const weekEnd = addDays(weekStart, 6);
  const week = sessions.filter((s) => s.date >= weekStart && s.date <= weekEnd);
  const next = sessions.filter((s) => !s.done && s.date > today).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
  return { todays, missed, week, weekDone: week.filter((s) => s.done).length, next, studies: getStudies() };
}

/* ------------------------------------------------------------------ */
/* 일정 아이템 (캘린더·홈에서도 재사용)                                     */
/* ------------------------------------------------------------------ */
export function sessionItemHTML(s, { showDate = false } = {}) {
  const study = getStudy(s.studyId);
  const c = colorOf(study);
  const overdue = !s.done && s.date < todayStr();
  return `
  <div class="todo-item sess-item ${s.done ? 'todo-item--done' : ''}" data-session="${s.id}">
    <button class="checkbox" role="checkbox" aria-checked="${s.done}" data-act="toggle" aria-label="완료 표시" style="${s.done ? `background:${c.main};border-color:${c.main}` : ''}">${icons.checkSmall}</button>
    <button class="todo-item__body" data-act="edit" aria-label="공부 일정 수정">
      <p class="sess-item__study" style="color:${c.main}">${esc(study?.title || '교재')}</p>
      ${(() => {
        const names = s.title ? [s.title] : (study?.units || []).filter((u) => s.unitIds.includes(u.id)).map((u) => u.name);
        return names.length > 1
          ? `<ul class="sess-item__units">${names.map((n) => `<li class="todo-item__text">${esc(n)}</li>`).join('')}</ul>`
          : `<p class="todo-item__text">${esc(names[0] || '공부')}</p>`;
      })()}
      <div class="todo-item__meta">
        ${showDate ? `<span class="todo-item__meta-text ${overdue ? 'todo-item__meta-text--overdue' : ''}">${fmtDate(s.date)}${overdue ? ' · 못 함' : ''}</span>` : overdue ? '<span class="todo-item__meta-text todo-item__meta-text--overdue">못 함</span>' : ''}
        ${s.memo ? `<span class="todo-item__meta-text">${esc(s.memo)}</span>` : ''}
      </div>
    </button>
    <button class="icon-btn" data-act="del" aria-label="삭제" style="width:34px;height:34px">${icons.trash}</button>
  </div>`;
}

export function bindSessionList(container) {
  container.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-session]');
    if (!row) return;
    const id = row.dataset.session;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'toggle') {
      const s = toggleSession(id);
      scheduleSync();
      if (s?.done) toast('오늘 공부 끝! 👏');
    } else if (act === 'del') {
      const ok = await confirmSheet({ title: '이 공부 일정을 지울까요?', desc: '교재의 파트는 그대로 남아요.' });
      if (ok) { deleteSession(id); scheduleSync(); }
    } else if (act === 'edit') {
      openSessionForm(id);
    }
  });
}

/* ------------------------------------------------------------------ */
/* 교재 카드                                                            */
/* ------------------------------------------------------------------ */
export function studyCardHTML(study, { compact = false } = {}) {
  const c = colorOf(study);
  const p = progressOf(study);
  const d = study.examDate ? ddayOf(study.examDate) : null;
  const next = getSessions().filter((s) => s.studyId === study.id && !s.done && s.date >= todayStr()).sort((a, b) => a.date.localeCompare(b.date))[0];
  const pending = study.units.filter((u) => !u.done).length;
  return `
  <article class="study-card" data-study="${study.id}" style="--sc:${c.main};--sc-weak:${c.weak}">
    <button class="study-card__main" data-act="open" aria-label="${esc(study.title)} 관리">
      <span class="study-card__icon">${icons.book}</span>
      <span class="study-card__text">
        <span class="study-card__title">${esc(study.title)}</span>
        <span class="study-card__sub">${[study.exam, study.examDate ? `시험 ${fmtShort(study.examDate)}` : ''].filter(Boolean).join(' · ') || '시험일 미정'}</span>
      </span>
      ${d !== null ? `<span class="study-card__dday ${d <= 7 ? 'is-soon' : ''}">${d >= 0 ? ddayLabel(study.examDate) : '시험 끝'}</span>` : ''}
    </button>
    <div class="study-card__progress">
      <div class="progress"><div class="progress__bar" style="width:${p.pct}%;background:var(--sc)"></div></div>
      <span class="study-card__pct">${p.total ? `${p.done}/${p.total} 파트 · ${p.pct}%` : '파트를 등록해 주세요'}</span>
    </div>
    ${compact ? '' : `
    <div class="study-card__foot">
      <span class="study-card__next">${next ? `다음: ${fmtShort(next.date)} ${esc(sessionLabel(next, study))}` : pending ? '아직 안 짠 일정이 있어요' : p.total ? '모든 파트 완료 🎉' : ''}</span>
      <div class="study-card__btns">
        <button class="btn btn--neutral btn--sm" data-act="units">${icons.list}파트</button>
        <button class="btn btn--primary btn--sm" data-act="plan" ${pending ? '' : 'disabled'}>${icons.wand}일정 짜기</button>
      </div>
    </div>`}
  </article>`;
}

export function bindStudyCards(container) {
  container.addEventListener('click', (e) => {
    const card = e.target.closest('[data-study]');
    if (!card) return;
    const id = card.dataset.study;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'plan') openPlanSheet(id);
    else if (act === 'units' || act === 'open') openStudyForm(id);
  });
}

/* ------------------------------------------------------------------ */
/* 뷰                                                                  */
/* ------------------------------------------------------------------ */
export function renderStudy(root) {
  const s = studyStats();
  const today = todayStr();
  const sessions = getSessions();
  let list;
  if (filter === 'week') list = s.week.filter((x) => x.date >= today || !x.done);
  else if (filter === 'missed') list = s.missed;
  else list = sessions;
  list = list.slice().sort((a, b) => a.date.localeCompare(b.date) || a.done - b.done);

  // 날짜별 그룹
  const groups = new Map();
  list.forEach((x) => { if (!groups.has(x.date)) groups.set(x.date, []); groups.get(x.date).push(x); });

  root.innerHTML = `
    ${s.studies.length ? `
    <section class="section">
      <div class="section__head">
        <div>
          <h3 class="section__title">오늘 공부</h3>
          <p class="section__desc">${s.todays.length ? `${s.todays.filter((x) => x.done).length}/${s.todays.length} 완료` : '오늘 계획된 공부가 없어요'}</p>
        </div>
        ${s.missed.length ? `<button class="section__action" data-filter="missed" style="color:var(--danger)">못 한 공부 ${s.missed.length}건 ${icons.chevronRight}</button>` : ''}
      </div>
      ${s.todays.length ? `<div class="todo-list" data-session-list>${s.todays.map((x) => sessionItemHTML(x)).join('')}</div>`
        : `<div class="card"><div class="empty" style="padding:22px 16px">
            <p class="empty__title">${s.next ? `다음 공부는 ${fmtShort(s.next.date)} ${esc(sessionLabel(s.next))}` : '아직 짜둔 일정이 없어요'}</p>
            <p class="empty__desc">${s.next ? '오늘은 쉬어 가도 괜찮아요' : '교재 카드의 "일정 짜기"로 요일별 파트를 배분해 보세요'}</p>
          </div></div>`}
    </section>` : ''}

    <section class="section">
      <div class="section__head">
        <div>
          <h3 class="section__title">교재 · 과정</h3>
          <p class="section__desc">파트를 등록하고 일정을 짜면 캘린더와 홈에 떠요</p>
        </div>
        <button class="section__action" data-add-study>${icons.plus}교재 추가</button>
      </div>
      ${s.studies.length ? `<div class="study-list" data-study-list>${s.studies.map((st) => studyCardHTML(st)).join('')}</div>` : `
        <div class="card"><div class="empty">
          <span class="empty__icon">${icons.book}</span>
          <p class="empty__title">공부할 교재를 추가해 보세요</p>
          <p class="empty__desc">예) AICE 문제집 — Part 1 ~ Part 6</p>
          <button class="btn btn--primary btn--sm" data-add-study>${icons.plus}교재 추가</button>
        </div></div>`}
    </section>

    ${sessions.length ? `
    <section class="section">
      <div class="section__head">
        <h3 class="section__title">공부 일정</h3>
      </div>
      <div class="chips" role="tablist" aria-label="공부 일정 필터" style="margin-bottom:12px">
        <button class="chip" role="tab" aria-pressed="${filter === 'week'}" data-filter="week">이번 주 <span class="chip__count">${s.week.length}</span></button>
        <button class="chip" role="tab" aria-pressed="${filter === 'missed'}" data-filter="missed">못 함 <span class="chip__count">${s.missed.length}</span></button>
        <button class="chip" role="tab" aria-pressed="${filter === 'all'}" data-filter="all">전체 <span class="chip__count">${sessions.length}</span></button>
        ${s.missed.length && filter === 'missed' ? `<button class="chip" data-reschedule>${icons.wand}오늘부터 다시 짜기</button>` : ''}
      </div>
      ${groups.size ? [...groups.entries()].map(([date, items]) => `
        <section class="date-group">
          <div class="date-group__head">
            <span class="date-group__label">${fmtDate(date)}</span>
            ${date === today ? '<span class="badge badge--blue">오늘</span>' : date < today && items.some((x) => !x.done) ? '<span class="badge badge--red">못 함</span>' : ''}
            <span class="date-group__count">${items.length}건</span>
            <span class="date-group__rule"></span>
          </div>
          <div class="todo-list" data-session-list>${items.map((x) => sessionItemHTML(x)).join('')}</div>
        </section>`).join('') : `
        <div class="card"><div class="empty" style="padding:22px 16px">
          <p class="empty__title">${filter === 'missed' ? '밀린 공부가 없어요 👍' : '이 기간에 일정이 없어요'}</p>
        </div></div>`}
    </section>` : ''}
  `;

  root.querySelectorAll('[data-add-study]').forEach((b) => b.addEventListener('click', () => openStudyForm()));
  root.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.filter; renderStudy(root); }));
  root.querySelector('[data-reschedule]')?.addEventListener('click', () => {
    const ids = [...new Set(s.missed.map((x) => x.studyId))];
    if (ids.length === 1) openPlanSheet(ids[0], { includeMissed: true });
    else toast('교재 카드의 "일정 짜기"에서 교재별로 다시 짤 수 있어요', { duration: 3200 });
  });
  root.querySelectorAll('[data-session-list]').forEach(bindSessionList);
  const sl = root.querySelector('[data-study-list]');
  if (sl) bindStudyCards(sl);
}

/* ------------------------------------------------------------------ */
/* 교재 추가 / 수정 (파트 관리 포함)                                       */
/* ------------------------------------------------------------------ */
export function openStudyForm(id = null) {
  const st = id ? getStudy(id) : null;
  const isEdit = Boolean(st);
  let color = st?.color || 'green';
  let units = (st?.units || []).map((u) => ({ ...u }));

  const colorChips = Object.entries(STUDY_COLORS).map(([k, c]) => `
    <button type="button" class="color-chip" data-color="${k}" aria-pressed="${k === color}" aria-label="${c.label}" style="--cc:${c.main}"></button>`).join('');

  const unitRows = () => units.length ? units.map((u, i) => `
    <div class="unit-row" data-unit="${u.id || `new-${i}`}">
      <button type="button" class="checkbox" role="checkbox" aria-checked="${u.done}" data-unit-toggle="${i}" aria-label="완료 표시">${icons.checkSmall}</button>
      <input class="unit-row__input" value="${esc(u.name)}" data-unit-name="${i}" aria-label="파트 이름" />
      <button type="button" class="icon-btn" data-unit-del="${i}" aria-label="파트 삭제" style="width:32px;height:32px">${icons.x}</button>
    </div>`).join('') : '<p class="field__hint" style="padding:6px 2px">아직 파트가 없어요. 아래에서 한 번에 만들거나 직접 추가하세요.</p>';

  const sheet = openSheet({
    title: isEdit ? '교재 관리' : '교재 추가',
    desc: isEdit ? '파트를 체크하면 진행률에 바로 반영돼요' : '문제집, 강의, 과목 등 공부 단위 하나',
    body: `
      <form id="studyForm" novalidate>
        <div class="field">
          <label class="field__label" for="s-title">교재 이름 *</label>
          <input class="input" id="s-title" name="title" required placeholder="예) AICE 문제집" value="${esc(st?.title || '')}" autocomplete="off" />
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field__label" for="s-exam">시험 · 자격증</label>
            <input class="input" id="s-exam" name="exam" placeholder="예) AICE Associate" value="${esc(st?.exam || '')}" autocomplete="off" />
          </div>
          <div class="field">
            <label class="field__label" for="s-examDate">시험일</label>
            <input class="input" id="s-examDate" name="examDate" type="date" value="${esc(st?.examDate || '')}" />
          </div>
        </div>
        <div class="field">
          <span class="field__label">색</span>
          <div class="color-chips">${colorChips}</div>
        </div>

        <div class="field">
          <div class="field__label" style="display:flex;justify-content:space-between;align-items:center">
            <span>파트 · 챕터</span>
            <span style="font-weight:500;color:var(--text-tertiary)" id="unitCount">${units.filter((u) => u.done).length}/${units.length} 완료</span>
          </div>
          <div class="unit-list" id="unitList">${unitRows()}</div>
          <div class="unit-tools">
            <div class="unit-gen">
              <input class="input" id="genPrefix" value="Part" aria-label="이름 접두어" />
              <input class="input" id="genCount" type="number" inputmode="numeric" min="1" max="60" placeholder="개수" aria-label="개수" />
              <button type="button" class="btn btn--neutral btn--sm" id="genBtn">한 번에 만들기</button>
            </div>
            <button type="button" class="btn btn--ghost btn--sm" id="addUnit">${icons.plus}파트 하나 추가</button>
          </div>
          <p class="field__hint">예) 접두어 "Part", 개수 6 → Part 1 ~ Part 6</p>
        </div>

        <div class="field">
          <label class="field__label" for="s-memo">메모</label>
          <input class="input" id="s-memo" name="memo" placeholder="예) 2024 개정판, 기출 위주" value="${esc(st?.memo || '')}" autocomplete="off" />
        </div>
      </form>
    `,
    foot: `
      ${isEdit ? `<button class="btn btn--danger btn--icon-only" data-act="delete" aria-label="교재 삭제">${icons.trash}</button>` : ''}
      <button class="btn btn--neutral" data-close>취소</button>
      <button class="btn btn--primary" type="submit" form="studyForm">${isEdit ? '저장' : '추가하기'}</button>
    `,
  });

  const form = sheet.querySelector('#studyForm');
  const listEl = sheet.querySelector('#unitList');
  const countEl = sheet.querySelector('#unitCount');

  const syncFromInputs = () => {
    listEl.querySelectorAll('[data-unit-name]').forEach((inp) => { units[Number(inp.dataset.unitName)].name = inp.value; });
  };
  const redraw = () => {
    listEl.innerHTML = unitRows();
    countEl.textContent = `${units.filter((u) => u.done).length}/${units.length} 완료`;
  };
  listEl.addEventListener('click', (e) => {
    const t = e.target.closest('[data-unit-toggle]'); const d = e.target.closest('[data-unit-del]');
    if (t) { syncFromInputs(); const u = units[Number(t.dataset.unitToggle)]; u.done = !u.done; u.doneAt = u.done ? todayStr() : ''; redraw(); }
    if (d) { syncFromInputs(); units.splice(Number(d.dataset.unitDel), 1); redraw(); }
  });
  sheet.querySelectorAll('[data-color]').forEach((b) => b.addEventListener('click', () => {
    color = b.dataset.color;
    sheet.querySelectorAll('[data-color]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  }));
  sheet.querySelector('#genBtn').addEventListener('click', () => {
    syncFromInputs();
    const prefix = sheet.querySelector('#genPrefix').value.trim() || 'Part';
    const n = Math.min(60, Math.max(0, Number(sheet.querySelector('#genCount').value) || 0));
    if (!n) { toast('개수를 입력해 주세요', { type: 'error' }); return; }
    const start = units.length + 1;
    for (let i = 0; i < n; i++) units.push({ name: `${prefix} ${start + i}`, done: false, doneAt: '' });
    redraw();
  });
  sheet.querySelector('#addUnit').addEventListener('click', () => {
    syncFromInputs();
    units.push({ name: `Part ${units.length + 1}`, done: false, doneAt: '' });
    redraw();
    listEl.querySelector('[data-unit-name]:last-of-type')?.focus();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    syncFromInputs();
    const title = form.title.value.trim();
    if (!title) { toast('교재 이름을 입력해 주세요', { type: 'error' }); form.title.focus(); return; }
    const data = {
      title, exam: form.exam.value.trim(), examDate: form.examDate.value, color,
      memo: form.memo.value.trim(),
      units: units.filter((u) => u.name.trim()).map((u) => ({ ...u, name: u.name.trim() })),
    };
    const saved = isEdit ? updateStudy(id, data) : addStudy(data);
    scheduleSync();
    closeSheet();
    toast(isEdit ? '교재를 저장했어요' : `‘${title}’ 교재를 추가했어요`, { type: 'success' });
    if (!isEdit && saved.units.length) openPlanSheet(saved.id);
  });

  sheet.querySelector('[data-act="delete"]')?.addEventListener('click', async () => {
    closeSheet();
    const ok = await confirmSheet({ title: '교재를 삭제할까요?', desc: `‘${st.title}’과 짜둔 공부 일정이 함께 사라져요.` });
    if (ok) { deleteStudy(id); scheduleSync(); toast('교재를 삭제했어요'); }
  });
}

/* ------------------------------------------------------------------ */
/* 일정 짜기 — 요일에 파트 배분                                            */
/* ------------------------------------------------------------------ */
export function openPlanSheet(studyId, { includeMissed = false } = {}) {
  const st = getStudy(studyId);
  if (!st) return;
  const today = todayStr();
  const planned = new Set(getSessions().filter((s) => s.studyId === studyId && (s.done || s.date >= today)).flatMap((s) => s.unitIds));
  const pendingUnits = st.units.filter((u) => !u.done && (includeMissed || !planned.has(u.id)));
  const allPending = st.units.filter((u) => !u.done);

  let days = new Set([1, 2, 3, 4, 5]);
  let perDay = 1;
  let start = today;
  let skipBlocked = true;
  let replace = includeMissed || allPending.length > pendingUnits.length;
  let scope = replace ? 'all' : 'new'; // all: 안 끝낸 파트 전부 다시 / new: 아직 안 짠 파트만

  const build = () => {
    const units = scope === 'all' ? allPending : pendingUnits;
    const out = [];
    let date = start; let guard = 0; let i = 0;
    while (i < units.length && guard++ < 400) {
      const ok = days.has(dowOf(date)) && (!skipBlocked || availabilityOf(date, getEvents()) !== 'none');
      if (ok) { out.push({ date, units: units.slice(i, i + perDay) }); i += perDay; }
      date = addDays(date, 1);
    }
    return out;
  };

  const sheet = openSheet({
    title: '일정 짜기',
    desc: `${st.title} · 안 끝낸 파트 ${allPending.length}개`,
    body: `
      <div class="field">
        <span class="field__label">공부하는 요일</span>
        <div class="dow-picker" id="dowPicker">
          ${WEEKDAYS_KO.map((w, i) => `<button type="button" class="dow-chip ${i === 0 ? 'is-sun' : i === 6 ? 'is-sat' : ''}" data-dow="${i}" aria-pressed="${days.has(i)}">${w}</button>`).join('')}
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label class="field__label" for="planStart">시작일</label>
          <input class="input" id="planStart" type="date" value="${start}" />
        </div>
        <div class="field">
          <label class="field__label" for="planPerDay">하루에 몇 파트</label>
          <select class="select" id="planPerDay">${[1, 2, 3, 4].map((n) => `<option value="${n}" ${n === perDay ? 'selected' : ''}>${n}파트</option>`).join('')}</select>
        </div>
      </div>
      ${allPending.length > pendingUnits.length ? `
      <div class="field">
        <span class="field__label">어떤 파트를</span>
        <div class="seg" style="grid-template-columns:1fr 1fr">
          <button type="button" class="seg__opt" data-scope="new" aria-pressed="${scope === 'new'}">아직 안 짠 파트만<small>${pendingUnits.length}개</small></button>
          <button type="button" class="seg__opt" data-scope="all" aria-pressed="${scope === 'all'}">안 끝낸 파트 전부<small>${allPending.length}개 · 기존 일정 교체</small></button>
        </div>
      </div>` : ''}
      <div class="field">
        <div class="switch-row">
          <div class="switch-row__text">
            <p class="switch-row__title">작성 불가 날은 건너뛰기</p>
            <p class="switch-row__desc">여행 등 개인 일정에서 "불가"로 표시한 날</p>
          </div>
          <button type="button" class="switch" role="switch" aria-checked="${skipBlocked}" id="planSkip" aria-label="작성 불가 날 건너뛰기"></button>
        </div>
      </div>
      <div class="field">
        <span class="field__label">미리 보기</span>
        <div class="plan-preview" id="planPreview"></div>
      </div>
    `,
    foot: `
      <button class="btn btn--neutral" data-close>취소</button>
      <button class="btn btn--primary" id="planMake">일정 만들기</button>
    `,
  });

  const preview = sheet.querySelector('#planPreview');
  const makeBtn = sheet.querySelector('#planMake');
  const redraw = () => {
    const plan = build();
    if (!plan.length) {
      preview.innerHTML = '<p class="field__hint">조건에 맞는 날이 없거나 짤 파트가 없어요.</p>';
      makeBtn.disabled = true; return;
    }
    makeBtn.disabled = false;
    const last = plan[plan.length - 1].date;
    const examNote = st.examDate ? (last <= st.examDate ? `시험 ${fmtShort(st.examDate)} 전에 끝나요` : `<span style="color:var(--danger)">시험일(${fmtShort(st.examDate)})을 넘겨요 — 요일을 늘리거나 하루 파트 수를 올려 보세요</span>`) : '';
    preview.innerHTML = `
      <p class="plan-preview__sum">${plan.length}일 · ${fmtShort(plan[0].date)} ~ ${fmtShort(last)}${examNote ? ` · ${examNote}` : ''}</p>
      <ul class="plan-preview__list">${plan.slice(0, 14).map((p) => `<li><span>${fmtShort(p.date)}</span><span>${p.units.map((u) => esc(u.name)).join(' · ')}</span></li>`).join('')}${plan.length > 14 ? `<li><span></span><span>… 외 ${plan.length - 14}일</span></li>` : ''}</ul>`;
    makeBtn.textContent = `${plan.length}일 일정 만들기`;
  };
  sheet.querySelectorAll('[data-dow]').forEach((b) => b.addEventListener('click', () => {
    const d = Number(b.dataset.dow);
    if (days.has(d)) days.delete(d); else days.add(d);
    b.setAttribute('aria-pressed', days.has(d));
    redraw();
  }));
  sheet.querySelectorAll('[data-scope]').forEach((b) => b.addEventListener('click', () => {
    scope = b.dataset.scope; replace = scope === 'all';
    sheet.querySelectorAll('[data-scope]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    redraw();
  }));
  sheet.querySelector('#planStart').addEventListener('change', (e) => { start = e.target.value || today; redraw(); });
  sheet.querySelector('#planPerDay').addEventListener('change', (e) => { perDay = Number(e.target.value) || 1; redraw(); });
  sheet.querySelector('#planSkip').addEventListener('click', (e) => { skipBlocked = !skipBlocked; e.currentTarget.setAttribute('aria-checked', skipBlocked); redraw(); });
  redraw();

  makeBtn.addEventListener('click', () => {
    const plan = build();
    if (!plan.length) return;
    if (replace) clearPendingSessions(studyId, today);
    addSessions(plan.map((p) => ({ studyId, date: p.date, unitIds: p.units.map((u) => u.id) })));
    scheduleSync();
    closeSheet();
    toast(`${plan.length}일치 공부 일정을 만들었어요`, { type: 'success' });
  });
}

/* ------------------------------------------------------------------ */
/* 공부 일정 하나 추가 / 수정                                              */
/* ------------------------------------------------------------------ */
export function openSessionForm(id = null, { presetDate = '', presetStudyId = '' } = {}) {
  const s = id ? getSession(id) : null;
  const isEdit = Boolean(s);
  const studies = getStudies();
  if (!studies.length) { openStudyForm(); return; }
  let studyId = s?.studyId || presetStudyId || studies[0].id;
  let unitIds = new Set(s?.unitIds || []);

  const unitChips = () => {
    const st = getStudy(studyId);
    if (!st?.units.length) return '<p class="field__hint">이 교재엔 파트가 없어요. 아래 "직접 입력"에 적어 주세요.</p>';
    return st.units.map((u) => `<button type="button" class="chip ${u.done ? 'is-done' : ''}" data-unit="${u.id}" aria-pressed="${unitIds.has(u.id)}">${esc(u.name)}${u.done ? ' ✓' : ''}</button>`).join('');
  };

  const sheet = openSheet({
    title: isEdit ? '공부 일정 수정' : '공부 일정 추가',
    body: `
      <form id="sessForm" novalidate>
        <div class="field-row">
          <div class="field">
            <label class="field__label" for="ss-study">교재</label>
            <select class="select" id="ss-study">${studies.map((st) => `<option value="${st.id}" ${st.id === studyId ? 'selected' : ''}>${esc(st.title)}</option>`).join('')}</select>
          </div>
          <div class="field">
            <label class="field__label" for="ss-date">날짜 *</label>
            <input class="input" id="ss-date" type="date" required value="${esc(s?.date || presetDate || todayStr())}" />
          </div>
        </div>
        <div class="field">
          <span class="field__label">파트 (여러 개 선택 가능)</span>
          <div class="chips kind-chips" id="unitChips">${unitChips()}</div>
        </div>
        <div class="field">
          <label class="field__label" for="ss-title">직접 입력 <span style="font-weight:500;color:var(--text-disabled)">(파트 대신 쓸 제목)</span></label>
          <input class="input" id="ss-title" placeholder="예) 모의고사 1회" value="${esc(s?.title || '')}" autocomplete="off" />
        </div>
        <div class="field">
          <label class="field__label" for="ss-memo">메모</label>
          <input class="input" id="ss-memo" placeholder="예) 틀린 문제 다시" value="${esc(s?.memo || '')}" autocomplete="off" />
        </div>
      </form>
    `,
    foot: `
      ${isEdit ? `<button class="btn btn--danger btn--icon-only" data-act="delete" aria-label="삭제">${icons.trash}</button>` : ''}
      <button class="btn btn--neutral" data-close>취소</button>
      <button class="btn btn--primary" type="submit" form="sessForm">${isEdit ? '저장' : '추가하기'}</button>
    `,
  });

  const chipsEl = sheet.querySelector('#unitChips');
  chipsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-unit]'); if (!b) return;
    const u = b.dataset.unit;
    if (unitIds.has(u)) unitIds.delete(u); else unitIds.add(u);
    b.setAttribute('aria-pressed', unitIds.has(u));
  });
  sheet.querySelector('#ss-study').addEventListener('change', (e) => { studyId = e.target.value; unitIds = new Set(); chipsEl.innerHTML = unitChips(); });

  sheet.querySelector('#sessForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const date = sheet.querySelector('#ss-date').value;
    const title = sheet.querySelector('#ss-title').value.trim();
    if (!date) { toast('날짜를 선택해 주세요', { type: 'error' }); return; }
    if (!unitIds.size && !title) { toast('파트를 고르거나 제목을 적어 주세요', { type: 'error' }); return; }
    const data = { studyId, date, unitIds: [...unitIds], title, memo: sheet.querySelector('#ss-memo').value.trim() };
    if (isEdit) updateSession(id, data); else addSessions([data]);
    scheduleSync();
    closeSheet();
    toast(isEdit ? '공부 일정을 수정했어요' : '공부 일정을 추가했어요', { type: 'success' });
  });
  sheet.querySelector('[data-act="delete"]')?.addEventListener('click', async () => {
    closeSheet();
    const ok = await confirmSheet({ title: '이 공부 일정을 지울까요?', desc: '교재의 파트는 그대로 남아요.' });
    if (ok) { deleteSession(id); scheduleSync(); }
  });
}
