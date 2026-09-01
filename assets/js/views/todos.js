/**
 * 투두리스트 뷰 + 캘린더에서 재사용하는 투두 아이템 렌더러.
 */
import {
  getTodos, getJob, addTodo, toggleTodo, deleteTodo, updateTodo,
  clearDoneTodos, ddayOf, fmtDate, getJobs,
} from '../store.js';
import { esc, icons, openSheet, closeSheet, confirmSheet, toast } from '../ui.js';
import { scheduleSync } from '../sync.js';

let filter = 'open'; // open | done | all

export function todoItemHTML(t) {
  const job = t.jobId ? getJob(t.jobId) : null;
  const overdue = !t.done && t.dueDate && ddayOf(t.dueDate) < 0;
  const metaBits = [];
  if (t.dueDate) {
    metaBits.push(`<span class="todo-item__meta-text ${overdue ? 'todo-item__meta-text--overdue' : ''}">${fmtDate(t.dueDate)}${overdue ? ' · 기한 지남' : ''}</span>`);
  }
  if (job) metaBits.push(`<span class="badge badge--blue">${esc(job.company)}</span>`);
  if (t.url) metaBits.push(`<a class="todo-item__meta-text" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer" data-stop style="color:var(--primary);font-weight:600">링크 열기 ↗</a>`);

  return `
  <div class="todo-item ${t.done ? 'todo-item--done' : ''}" data-todo="${t.id}">
    <button class="checkbox" role="checkbox" aria-checked="${t.done}" data-act="toggle" aria-label="완료 표시">
      ${icons.checkSmall}
    </button>
    <button class="todo-item__body" data-act="edit" aria-label="할 일 수정">
      <p class="todo-item__text">${esc(t.text)}</p>
      ${metaBits.length ? `<div class="todo-item__meta">${metaBits.join('')}</div>` : ''}
    </button>
    <button class="icon-btn" data-act="del" aria-label="삭제" style="width:34px;height:34px">${icons.trash}</button>
  </div>`;
}

export function bindTodoList(container) {
  container.addEventListener('click', async (e) => {
    if (e.target.closest('[data-stop]')) return; // 링크는 그대로 통과
    const row = e.target.closest('[data-todo]');
    if (!row) return;
    const id = row.dataset.todo;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'toggle') {
      const t = toggleTodo(id);
      scheduleSync();
      if (t?.done) toast('완료! 잘하고 있어요 👏');
    } else if (act === 'del') {
      const ok = await confirmSheet({ title: '할 일을 삭제할까요?', desc: '삭제하면 되돌릴 수 없어요.' });
      if (ok) { deleteTodo(id); scheduleSync(); }
    } else if (act === 'edit') {
      openTodoForm(id);
    }
  });
}

export function renderTodos(root) {
  const todos = getTodos();
  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  const list = (filter === 'open' ? open : filter === 'done' ? done : todos)
    .slice()
    .sort((a, b) => {
      if (a.done !== b.done) return a.done - b.done;
      const ad = a.dueDate || '9999-12-31';
      const bd = b.dueDate || '9999-12-31';
      return ad.localeCompare(bd) || (a.createdAt || '').localeCompare(b.createdAt || '');
    });

  root.innerHTML = `
    <form class="quick-add" id="quickAdd">
      <input class="input" name="text" placeholder="할 일을 입력하고 Enter" autocomplete="off" aria-label="새 할 일" />
      <button class="quick-add__btn" type="submit" aria-label="할 일 추가">${icons.plus}</button>
    </form>

    <div class="chips" role="tablist" aria-label="투두 필터" style="margin-bottom:14px">
      <button class="chip" role="tab" aria-pressed="${filter === 'open'}" data-filter="open">진행 중 <span class="chip__count">${open.length}</span></button>
      <button class="chip" role="tab" aria-pressed="${filter === 'done'}" data-filter="done">완료 <span class="chip__count">${done.length}</span></button>
      <button class="chip" role="tab" aria-pressed="${filter === 'all'}" data-filter="all">전체 <span class="chip__count">${todos.length}</span></button>
      ${done.length ? `<button class="chip" data-clear-done>${icons.trash}완료 항목 비우기</button>` : ''}
    </div>

    ${list.length ? `<div class="todo-list" data-todo-list>${list.map(todoItemHTML).join('')}</div>` : `
      <div class="card">
        <div class="empty">
          <span class="empty__icon">${icons.check}</span>
          <p class="empty__title">${filter === 'done' ? '아직 완료한 할 일이 없어요' : '할 일이 없어요'}</p>
          <p class="empty__desc">${filter === 'done' ? '하나씩 끝내고 체크해 보세요' : '위 입력창에서 바로 추가할 수 있어요'}</p>
        </div>
      </div>`}
  `;

  root.querySelector('#quickAdd').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.target.text;
    const text = input.value.trim();
    if (!text) return;
    addTodo({ text });
    scheduleSync();
    renderTodos(root);
    root.querySelector('#quickAdd input')?.focus();
  });

  root.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    filter = b.dataset.filter;
    renderTodos(root);
  }));

  root.querySelector('[data-clear-done]')?.addEventListener('click', async () => {
    const ok = await confirmSheet({
      title: '완료한 할 일을 모두 삭제할까요?',
      desc: `완료된 ${done.length}개 항목이 삭제돼요.`,
      confirmText: '모두 삭제',
    });
    if (ok) {
      const n = clearDoneTodos();
      scheduleSync();
      toast(`${n}개 항목을 정리했어요`);
    }
  });

  const listEl = root.querySelector('[data-todo-list]');
  if (listEl) bindTodoList(listEl);
}

/* ------------------------------------------------------------------ */
/* 추가 / 수정 시트                                                      */
/* ------------------------------------------------------------------ */
export function openTodoForm(id = null) {
  const t = id ? getTodos().find((x) => x.id === id) : null;
  const isEdit = Boolean(t);
  const jobs = getJobs().slice().sort((a, b) => a.company.localeCompare(b.company, 'ko'));

  const sheet = openSheet({
    title: isEdit ? '할 일 수정' : '새 할 일',
    body: `
      <form id="todoForm" novalidate>
        <div class="field">
          <label class="field__label" for="t-text">할 일 *</label>
          <input class="input" id="t-text" name="text" required placeholder="예) LG전자 자소서 2번 문항 쓰기"
            value="${esc(t?.text || '')}" autocomplete="off" />
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field__label" for="t-due">기한</label>
            <input class="input" id="t-due" name="dueDate" type="date" value="${esc(t?.dueDate || '')}" />
          </div>
          <div class="field">
            <label class="field__label" for="t-job">연결할 공고</label>
            <select class="select" id="t-job" name="jobId">
              <option value="">선택 안 함</option>
              ${jobs.map((j) => `<option value="${j.id}" ${t?.jobId === j.id ? 'selected' : ''}>${esc(j.company)}${j.position ? ` · ${esc(j.position)}` : ''}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="t-url">관련 링크</label>
          <input class="input" id="t-url" name="url" type="url" inputmode="url" placeholder="https://…"
            value="${esc(t?.url || '')}" autocomplete="off" />
        </div>
      </form>
    `,
    foot: `
      <button class="btn btn--neutral" data-close>취소</button>
      <button class="btn btn--primary" type="submit" form="todoForm">${isEdit ? '저장' : '추가하기'}</button>
    `,
  });

  sheet.querySelector('#todoForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const text = f.text.value.trim();
    if (!text) { toast('할 일 내용을 입력해 주세요', { type: 'error' }); f.text.focus(); return; }
    let url = f.url.value.trim();
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    const data = { text, dueDate: f.dueDate.value, jobId: f.jobId.value, url };
    if (isEdit) updateTodo(id, data);
    else addTodo(data);
    scheduleSync();
    closeSheet();
    toast(isEdit ? '할 일을 수정했어요' : '할 일을 추가했어요', { type: 'success' });
  });
}
