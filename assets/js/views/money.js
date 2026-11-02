/**
 * 가계부 — 이번 달 / 정기결제 / 내역 세 화면.
 */
import {
  getExpenses, getExpense, addExpense, updateExpense, deleteExpense,
  getSubscriptions, getSubscription, addSubscription, updateSubscription, deleteSubscription,
  todayStr, fmtDate, ddayOf,
} from '../store.js';
import { esc, icons, openSheet, closeSheet, confirmSheet, toast } from '../ui.js';
import { scheduleSync } from '../sync.js';
import {
  CATEGORIES, catOf, guessCategory, won, wonShort, monthKey, thisMonth, shiftMonth, monthLabel,
  monthlyCost, nextBilling, monthSummary, normMerchant,
} from '../money.js';
import { fmtShort } from '../plan.js';

export const MONEY_SUBS = ['overview', 'subs', 'history'];
const SUB_LABEL = { overview: '이번 달', subs: '정기결제', history: '내역' };
let sub = 'overview';
let month = thisMonth();
let catFilter = '';
let query = '';

const catDot = (key) => `<i class="cat-dot" style="background:${catOf(key).color}"></i>`;

export function renderMoney(root) {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  if (q.get('v') && MONEY_SUBS.includes(q.get('v'))) { sub = q.get('v'); history.replaceState(null, '', '#/money'); }

  root.innerHTML = `
    <div class="segmented" role="tablist" aria-label="가계부 메뉴">
      ${MONEY_SUBS.map((k) => `<button class="segmented__item" role="tab" aria-selected="${k === sub}" data-sub="${k}">${SUB_LABEL[k]}</button>`).join('')}
    </div>
    <div id="moneyBody"></div>`;
  root.querySelectorAll('[data-sub]').forEach((b) => b.addEventListener('click', () => { sub = b.dataset.sub; renderMoney(root); }));
  const body = root.querySelector('#moneyBody');
  if (sub === 'overview') renderOverview(body, root);
  else if (sub === 'subs') renderSubs(body);
  else renderHistory(body);
}

/* ------------------------------------------------------------------ */
/* 이번 달                                                              */
/* ------------------------------------------------------------------ */
function monthNav(root, rerender) {
  return `
    <div class="cal-head">
      <h2 class="cal-head__month">${monthLabel(month)}</h2>
      <div class="cal-head__nav">
        <button class="icon-btn" data-mnav="-1" aria-label="이전 달">${icons.chevronLeft}</button>
        <button class="btn btn--ghost btn--sm" data-mnav="0">이번 달</button>
        <button class="icon-btn" data-mnav="1" aria-label="다음 달" ${month >= thisMonth() ? 'disabled' : ''}>${icons.chevronRight}</button>
      </div>
    </div>`;
}
function bindMonthNav(el, rerender) {
  el.querySelectorAll('[data-mnav]').forEach((b) => b.addEventListener('click', () => {
    const n = Number(b.dataset.mnav);
    month = n === 0 ? thisMonth() : shiftMonth(month, n);
    rerender();
  }));
}

function renderOverview(el, root) {
  const s = monthSummary(month);
  const prev = monthSummary(shiftMonth(month, -1));
  const diff = s.total - prev.total;
  const isCurrent = month === thisMonth();
  const [y, m] = month.split('-').map(Number);
  const days = isCurrent ? Number(todayStr().slice(8)) : new Date(y, m, 0).getDate();
  const max = Math.max(1, ...s.cats.map((c) => c.amount));
  const subs = getSubscriptions().filter((x) => x.active);
  const review = subs.filter((x) => x.review);
  const reviewMonthly = review.reduce((a, x) => a + monthlyCost(x), 0);
  const upcoming = subs.map((x) => ({ x, d: nextBilling(x) })).filter((o) => ddayOf(o.d) <= 7).sort((a, b) => a.d.localeCompare(b.d));

  // 지난달보다 늘어난 변동비 분류
  const prevBy = new Map(prev.cats.map((c) => [c.key, c.amount]));
  const rising = s.cats.filter((c) => c.group === 'var' && c.amount - (prevBy.get(c.key) || 0) >= 30000)
    .map((c) => ({ ...c, delta: c.amount - (prevBy.get(c.key) || 0) })).sort((a, b) => b.delta - a.delta).slice(0, 3);

  const empty = !s.total;
  el.innerHTML = `
    ${monthNav()}
    <div class="hero money-hero">
      <p class="hero__eyebrow">${isCurrent ? '이번 달 쓴 돈' : `${m}월에 쓴 돈`}</p>
      <h2 class="money-hero__total">${won(s.total)}</h2>
      <p class="money-hero__sub">
        ${prev.total ? `지난달보다 <b class="${diff > 0 ? 'is-up' : 'is-down'}">${diff > 0 ? '+' : ''}${wonShort(diff)}</b> · ` : ''}하루 평균 ${wonShort(s.total / Math.max(1, days))}
      </p>
      ${s.total ? `
      <div class="money-split" role="img" aria-label="고정비 ${won(s.fixed)}, 변동비 ${won(s.flexible)}">
        <i style="flex:${s.fixed};background:var(--grey-500)"></i><i style="flex:${s.flexible};background:var(--primary)"></i>
      </div>
      <div class="money-split__legend">
        <span><i style="background:var(--grey-500)"></i>고정비 <b>${won(s.fixed)}</b></span>
        <span><i style="background:var(--primary)"></i>변동비 <b>${won(s.flexible)}</b></span>
      </div>` : ''}
    </div>

    ${empty ? `
      <div class="card"><div class="empty">
        <span class="empty__icon">${icons.wallet}</span>
        <p class="empty__title">${monthLabel(month)} 지출 기록이 없어요</p>
        <p class="empty__desc">카드 명세서 엑셀을 올리면 한 번에 들어오고 자동으로 분류돼요. 정기결제부터 등록해 두는 것도 좋아요.</p>
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;justify-content:center">
          <button class="btn btn--primary btn--sm" data-act="import">${icons.upload}명세서 가져오기</button>
          <button class="btn btn--neutral btn--sm" data-act="add-sub">${icons.plus}정기결제 등록</button>
        </div>
      </div></div>` : `
    <section class="section">
      <div class="section__head">
        <div><h3 class="section__title">어디에 썼나</h3><p class="section__desc">누르면 그 분류의 내역을 볼 수 있어요</p></div>
      </div>
      <div class="card card--pad">
        <div class="cat-bars">
          ${s.cats.map((c) => `
            <button class="cat-bar" data-cat="${c.key}">
              <span class="cat-bar__top">
                <span class="cat-bar__name">${catDot(c.key)}${c.label}${c.group === 'fixed' ? '<small>고정</small>' : ''}</span>
                <span class="cat-bar__val">${won(c.amount)} <small>${Math.round((c.amount / s.total) * 100)}%</small></span>
              </span>
              <span class="cat-bar__track"><i style="width:${(c.amount / max) * 100}%;background:${c.color}"></i></span>
            </button>`).join('')}
        </div>
      </div>
    </section>`}

    ${review.length || rising.length ? `
    <section class="section">
      <div class="section__head"><div><h3 class="section__title">줄일 수 있는 곳</h3><p class="section__desc">정기결제에서 "해지 고려"로 표시한 것과 지난달보다 3만원 이상 늘어난 분류</p></div></div>
      <div class="card card--pad save-list">
        ${review.length ? `
          <div class="save-row save-row--hero">
            <span>해지 고려 ${review.length}건을 정리하면</span>
            <b>월 ${won(reviewMonthly)} · 연 ${won(reviewMonthly * 12)}</b>
          </div>
          ${review.map((x) => `<div class="save-row"><span>${catDot(x.category)}${esc(x.name)}</span><span>${won(monthlyCost(x))}/월</span></div>`).join('')}` : ''}
        ${rising.map((c) => `<div class="save-row"><span>${catDot(c.key)}${c.label} 지난달보다 늘었어요</span><span class="is-up">+${wonShort(c.delta)}</span></div>`).join('')}
      </div>
    </section>` : ''}

    ${isCurrent && upcoming.length ? `
    <section class="section">
      <div class="section__head"><h3 class="section__title">7일 안에 빠져나갈 돈</h3><button class="section__action" data-go-sub="subs">정기결제 ${icons.chevronRight}</button></div>
      <div class="sub-list">${upcoming.map(({ x, d }) => subRowHTML(x, d)).join('')}</div>
    </section>` : ''}

    <div class="money-actions">
      <button class="btn btn--neutral" data-act="import">${icons.upload}명세서 가져오기</button>
      <button class="btn btn--primary" data-act="add">${icons.plus}지출 추가</button>
    </div>
  `;
  bindMonthNav(el, () => renderOverview(el, root));
  el.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => { catFilter = b.dataset.cat; sub = 'history'; renderMoney(root); }));
  el.querySelectorAll('[data-go-sub]').forEach((b) => b.addEventListener('click', () => { sub = b.dataset.goSub; renderMoney(root); }));
  bindCommon(el);
  bindSubRows(el);
}

/* ------------------------------------------------------------------ */
/* 정기결제                                                             */
/* ------------------------------------------------------------------ */
function subRowHTML(x, next = nextBilling(x)) {
  const d = ddayOf(next);
  return `
  <button class="sub-row ${x.active ? '' : 'is-off'} ${x.review ? 'is-review' : ''}" data-sub-id="${x.id}">
    <span class="sub-row__icon" style="background:${catOf(x.category).color}">${esc((x.name || '?').slice(0, 1))}</span>
    <span class="sub-row__text">
      <span class="sub-row__name">${esc(x.name)}${x.review ? '<span class="badge badge--amber">해지 고려</span>' : ''}${!x.active ? '<span class="badge">해지함</span>' : ''}</span>
      <span class="sub-row__meta">${x.cycle === 'yearly' ? `매년 ${x.billingMonth}월 ${x.billingDay}일` : `매달 ${x.billingDay}일`}${x.method ? ` · ${esc(x.method)}` : ''}${x.active ? ` · ${d === 0 ? '오늘 결제' : `${fmtShort(next)} 결제`}` : ''}</span>
    </span>
    <span class="sub-row__amt"><b>${won(x.amount)}</b><small>${x.cycle === 'yearly' ? `월 ${wonShort(monthlyCost(x))}` : '/월'}</small></span>
  </button>`;
}
function bindSubRows(el) {
  el.querySelectorAll('[data-sub-id]').forEach((b) => b.addEventListener('click', () => openSubForm(b.dataset.subId)));
}

function renderSubs(el) {
  const all = getSubscriptions();
  const on = all.filter((x) => x.active).sort((a, b) => nextBilling(a).localeCompare(nextBilling(b)));
  const off = all.filter((x) => !x.active);
  const monthly = on.reduce((a, x) => a + monthlyCost(x), 0);
  const review = on.filter((x) => x.review);
  const reviewMonthly = review.reduce((a, x) => a + monthlyCost(x), 0);
  const byCat = new Map();
  on.forEach((x) => byCat.set(x.category, (byCat.get(x.category) || 0) + monthlyCost(x)));

  el.innerHTML = `
    <div class="hero money-hero">
      <p class="hero__eyebrow">정기결제 ${on.length}건 · 한 달에</p>
      <h2 class="money-hero__total">${won(monthly)}</h2>
      <p class="money-hero__sub">1년이면 <b>${won(monthly * 12)}</b>${review.length ? ` · 해지 고려 ${review.length}건 정리 시 <b class="is-down">월 −${wonShort(reviewMonthly)}</b>` : ''}</p>
      ${byCat.size ? `<div class="chips" style="margin-top:12px">${[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="chip chip--static">${catDot(k)}${catOf(k).label} ${wonShort(v)}</span>`).join('')}</div>` : ''}
    </div>

    <section class="section">
      <div class="section__head">
        <div><h3 class="section__title">결제일 순</h3><p class="section__desc">누르면 수정하거나 "해지 고려" 표시를 할 수 있어요</p></div>
        <button class="section__action" data-act="add-sub">${icons.plus}추가</button>
      </div>
      ${on.length ? `<div class="sub-list">${on.map((x) => subRowHTML(x)).join('')}</div>` : `
        <div class="card"><div class="empty">
          <span class="empty__icon">${icons.repeat}</span>
          <p class="empty__title">등록된 정기결제가 없어요</p>
          <p class="empty__desc">넷플릭스, 유튜브 프리미엄, 통신비, 보험, ChatGPT처럼 매달·매년 빠져나가는 걸 적어 두세요</p>
          <button class="btn btn--primary btn--sm" data-act="add-sub">${icons.plus}정기결제 추가</button>
        </div></div>`}
    </section>

    ${off.length ? `
    <section class="section">
      <div class="section__head"><h3 class="section__title">해지한 것 <span class="section__count">${off.length}</span></h3></div>
      <div class="sub-list">${off.map((x) => subRowHTML(x)).join('')}</div>
    </section>` : ''}
  `;
  bindCommon(el);
  bindSubRows(el);
}

/* ------------------------------------------------------------------ */
/* 내역                                                                */
/* ------------------------------------------------------------------ */
function renderHistory(el) {
  const subsById = new Map(getSubscriptions().map((x) => [x.id, x]));
  let list = getExpenses().filter((x) => monthKey(x.date) === month);
  const usedCats = [...new Set(list.map((x) => x.category))];
  if (catFilter) list = list.filter((x) => x.category === catFilter);
  const qq = query.trim().toLowerCase();
  if (qq) list = list.filter((x) => normMerchant(x.merchant).includes(qq) || (x.memo || '').toLowerCase().includes(qq));
  list.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  const total = list.reduce((a, x) => a + x.amount, 0);

  const groups = new Map();
  list.forEach((x) => { if (!groups.has(x.date)) groups.set(x.date, []); groups.get(x.date).push(x); });

  el.innerHTML = `
    ${monthNav()}
    <div class="quick-add" style="margin-bottom:12px">
      <input class="input" id="moneySearch" placeholder="가맹점 · 메모 검색" value="${esc(query)}" autocomplete="off" aria-label="지출 검색" />
      <button class="quick-add__btn" type="button" data-act="add" aria-label="지출 추가">${icons.plus}</button>
    </div>
    <div class="chips" style="margin-bottom:12px">
      <button class="chip" aria-pressed="${!catFilter}" data-filter="">전체</button>
      ${CATEGORIES.filter((c) => usedCats.includes(c.key) || c.key === catFilter).map((c) => `<button class="chip" aria-pressed="${catFilter === c.key}" data-filter="${c.key}">${catDot(c.key)}${c.label}</button>`).join('')}
    </div>
    <p class="money-list-sum">${list.length}건 · <b>${won(total)}</b>${catFilter ? ` · ${catOf(catFilter).label}` : ''}</p>
    ${groups.size ? [...groups.entries()].map(([date, items]) => `
      <section class="date-group">
        <div class="date-group__head">
          <span class="date-group__label">${fmtDate(date)}</span>
          <span class="date-group__count">${won(items.reduce((a, x) => a + x.amount, 0))}</span>
          <span class="date-group__rule"></span>
        </div>
        <div class="exp-list">${items.map((x) => `
          <button class="exp-row" data-exp="${x.id}">
            <span class="exp-row__cat" style="background:${catOf(x.category).color}">${catOf(x.category).label.slice(0, 1)}</span>
            <span class="exp-row__text">
              <span class="exp-row__name">${esc(x.merchant || catOf(x.category).label)}</span>
              <span class="exp-row__meta">${catOf(x.category).label}${x.subscriptionId ? ` · 정기결제(${esc(subsById.get(x.subscriptionId)?.name || '')})` : ''}${x.method ? ` · ${esc(x.method)}` : ''}${x.memo ? ` · ${esc(x.memo)}` : ''}</span>
            </span>
            <span class="exp-row__amt ${x.amount < 0 ? 'is-refund' : ''}">${x.amount < 0 ? '+' : ''}${won(Math.abs(x.amount))}</span>
          </button>`).join('')}</div>
      </section>`).join('') : `
      <div class="card"><div class="empty">
        <span class="empty__icon">${icons.wallet}</span>
        <p class="empty__title">${qq || catFilter ? '조건에 맞는 내역이 없어요' : `${monthLabel(month)} 내역이 없어요`}</p>
        ${qq || catFilter ? '' : `<button class="btn btn--primary btn--sm" data-act="import">${icons.upload}명세서 가져오기</button>`}
      </div></div>`}
  `;
  bindMonthNav(el, () => renderHistory(el));
  el.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { catFilter = b.dataset.filter; renderHistory(el); }));
  const search = el.querySelector('#moneySearch');
  search.addEventListener('input', () => {
    query = search.value; const pos = search.selectionStart;
    renderHistory(el);
    const s2 = el.querySelector('#moneySearch'); s2.focus(); s2.setSelectionRange(pos, pos);
  });
  el.querySelectorAll('[data-exp]').forEach((b) => b.addEventListener('click', () => openExpenseForm(b.dataset.exp)));
  bindCommon(el);
}

function bindCommon(el) {
  el.querySelectorAll('[data-act="add"]').forEach((b) => b.addEventListener('click', () => openExpenseForm()));
  el.querySelectorAll('[data-act="add-sub"]').forEach((b) => b.addEventListener('click', () => openSubForm()));
  el.querySelectorAll('[data-act="import"]').forEach((b) => b.addEventListener('click', async () => {
    const m = await import('./moneyImport.js');
    m.openImportSheet();
  }));
}

/* ------------------------------------------------------------------ */
/* 분류 고르기                                                          */
/* ------------------------------------------------------------------ */
function catPickerHTML(selected, name = 'category') {
  const grp = (g, title) => `
    <p class="cat-pick__title">${title}</p>
    <div class="cat-pick">${CATEGORIES.filter((c) => c.group === g).map((c) => `
      <label class="cat-pick__opt"><input type="radio" name="${name}" value="${c.key}" ${c.key === selected ? 'checked' : ''} />
        <span>${catDot(c.key)}${c.label}</span></label>`).join('')}</div>`;
  return grp('var', '변동비') + grp('fixed', '고정비');
}

/* ------------------------------------------------------------------ */
/* 지출 추가 / 수정                                                     */
/* ------------------------------------------------------------------ */
export function openExpenseForm(id = null, { presetDate = '' } = {}) {
  const x = id ? getExpense(id) : null;
  const isEdit = Boolean(x);
  const sameCount = x ? getExpenses().filter((e) => e.id !== x.id && normMerchant(e.merchant) && normMerchant(e.merchant) === normMerchant(x.merchant)).length : 0;
  const sheet = openSheet({
    title: isEdit ? '지출 수정' : '지출 추가',
    body: `
      <form id="expForm" novalidate>
        <div class="field">
          <label class="field__label" for="x-amount">금액 *</label>
          <div class="amount-input"><input class="input" id="x-amount" name="amount" inputmode="numeric" placeholder="0" value="${x ? Math.abs(x.amount).toLocaleString('ko-KR') : ''}" autocomplete="off" /><span>원</span></div>
          ${isEdit && x.amount < 0 ? '<p class="field__hint">환불·취소 건이에요 (합계에서 빠져요)</p>' : ''}
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field__label" for="x-merchant">어디서</label>
            <input class="input" id="x-merchant" name="merchant" placeholder="예) 스타벅스" value="${esc(x?.merchant || '')}" autocomplete="off" />
          </div>
          <div class="field">
            <label class="field__label" for="x-date">날짜 *</label>
            <input class="input" id="x-date" name="date" type="date" value="${esc(x?.date || presetDate || todayStr())}" />
          </div>
        </div>
        <div class="field">
          <span class="field__label">분류</span>
          ${catPickerHTML(x?.category || '')}
          <p class="field__hint" id="x-guess"></p>
        </div>
        ${sameCount ? `
        <div class="field">
          <div class="switch-row">
            <div class="switch-row__text"><p class="switch-row__title">같은 가맹점 ${sameCount}건도 같은 분류로</p><p class="switch-row__desc">다음에 가져올 때도 이 분류로 들어가요</p></div>
            <button type="button" class="switch" role="switch" aria-checked="true" id="x-all" aria-label="같은 가맹점 모두 바꾸기"></button>
          </div>
        </div>` : ''}
        <div class="field-row">
          <div class="field">
            <label class="field__label" for="x-method">결제수단</label>
            <input class="input" id="x-method" name="method" placeholder="예) 신한카드" value="${esc(x?.method || '')}" autocomplete="off" />
          </div>
          <div class="field">
            <label class="field__label" for="x-memo">메모</label>
            <input class="input" id="x-memo" name="memo" placeholder="예) 여자친구랑" value="${esc(x?.memo || '')}" autocomplete="off" />
          </div>
        </div>
      </form>`,
    foot: `
      ${isEdit ? `<button class="btn btn--danger btn--icon-only" data-act="delete" aria-label="삭제">${icons.trash}</button>` : ''}
      <button class="btn btn--neutral" data-close>취소</button>
      <button class="btn btn--primary" type="submit" form="expForm">${isEdit ? '저장' : '추가하기'}</button>`,
  });
  const form = sheet.querySelector('#expForm');
  const amountEl = form.amount;
  amountEl.addEventListener('input', () => {
    const digits = amountEl.value.replace(/[^\d]/g, '');
    amountEl.value = digits ? Number(digits).toLocaleString('ko-KR') : '';
  });
  // 가맹점을 적으면 분류를 미리 골라 준다 (사용자가 직접 고르기 전까지)
  let touched = Boolean(x);
  form.querySelectorAll('input[name="category"]').forEach((r) => r.addEventListener('change', () => { touched = true; }));
  form.merchant.addEventListener('input', () => {
    if (touched) return;
    const g = guessCategory(form.merchant.value);
    const r = form.querySelector(`input[name="category"][value="${g}"]`);
    if (r && g !== 'etc') { r.checked = true; sheet.querySelector('#x-guess').textContent = `‘${catOf(g).label}’로 골라 뒀어요`; }
  });
  sheet.querySelector('#x-all')?.addEventListener('click', (e) => e.currentTarget.setAttribute('aria-checked', e.currentTarget.getAttribute('aria-checked') !== 'true'));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = Number(amountEl.value.replace(/[^\d]/g, '')) * (x && x.amount < 0 ? -1 : 1);
    if (!amount) { toast('금액을 입력해 주세요', { type: 'error' }); amountEl.focus(); return; }
    const category = form.querySelector('input[name="category"]:checked')?.value || guessCategory(form.merchant.value);
    const data = { amount, date: form.date.value || todayStr(), merchant: form.merchant.value.trim(), category, method: form.method.value.trim(), memo: form.memo.value.trim() };
    if (isEdit) {
      updateExpense(id, data);
      if (sheet.querySelector('#x-all')?.getAttribute('aria-checked') === 'true') {
        const key = normMerchant(data.merchant);
        getExpenses().filter((e2) => e2.id !== id && normMerchant(e2.merchant) === key && e2.category !== category).forEach((e2) => updateExpense(e2.id, { category }));
      }
    } else addExpense(data);
    scheduleSync(); closeSheet();
    toast(isEdit ? '저장했어요' : `${won(amount)} 기록했어요`, { type: 'success' });
  });
  sheet.querySelector('[data-act="delete"]')?.addEventListener('click', async () => {
    closeSheet();
    if (await confirmSheet({ title: '이 지출을 지울까요?', desc: `${x.merchant || ''} ${won(Math.abs(x.amount))}` })) { deleteExpense(id); scheduleSync(); toast('지웠어요'); }
  });
}

/* ------------------------------------------------------------------ */
/* 정기결제 추가 / 수정                                                  */
/* ------------------------------------------------------------------ */
export function openSubForm(id = null) {
  const x = id ? getSubscription(id) : null;
  const isEdit = Boolean(x);
  let cycle = x?.cycle || 'monthly';
  const fixedCats = CATEGORIES.filter((c) => c.group === 'fixed' || ['growth', 'digital', 'car', 'health'].includes(c.key));
  const sheet = openSheet({
    title: isEdit ? '정기결제 수정' : '정기결제 추가',
    desc: '매달·매년 자동으로 빠져나가는 돈',
    body: `
      <form id="subForm" novalidate>
        <div class="field">
          <label class="field__label" for="s-name">이름 *</label>
          <input class="input" id="s-name" name="name" placeholder="예) 넷플릭스, 유튜브 프리미엄, KT 휴대폰" value="${esc(x?.name || '')}" autocomplete="off" />
        </div>
        <div class="field">
          <label class="field__label" for="s-amount">금액 *</label>
          <div class="amount-input"><input class="input" id="s-amount" name="amount" inputmode="numeric" placeholder="0" value="${x ? x.amount.toLocaleString('ko-KR') : ''}" autocomplete="off" /><span>원</span></div>
        </div>
        <div class="field">
          <span class="field__label">주기</span>
          <div class="seg" style="grid-template-columns:1fr 1fr">
            <button type="button" class="seg__opt" data-cycle="monthly" aria-pressed="${cycle === 'monthly'}">매달</button>
            <button type="button" class="seg__opt" data-cycle="yearly" aria-pressed="${cycle === 'yearly'}">매년</button>
          </div>
        </div>
        <div class="field-row">
          <div class="field" id="s-month-wrap" ${cycle === 'yearly' ? '' : 'hidden'}>
            <label class="field__label" for="s-month">결제 월</label>
            <select class="select" id="s-month">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${Number(x?.billingMonth) === i + 1 ? 'selected' : ''}>${i + 1}월</option>`).join('')}</select>
          </div>
          <div class="field">
            <label class="field__label" for="s-day">결제일</label>
            <select class="select" id="s-day">${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${Number(x?.billingDay || 1) === i + 1 ? 'selected' : ''}>${i + 1}일</option>`).join('')}</select>
          </div>
          <div class="field">
            <label class="field__label" for="s-method">결제수단</label>
            <input class="input" id="s-method" placeholder="예) 신한카드" value="${esc(x?.method || '')}" autocomplete="off" />
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="s-cat">분류</label>
          <select class="select" id="s-cat">${fixedCats.map((c) => `<option value="${c.key}" ${(x?.category || 'subs') === c.key ? 'selected' : ''}>${c.label}</option>`).join('')}</select>
        </div>
        <div class="field">
          <label class="field__label" for="s-keyword">명세서에 찍히는 이름 <span style="font-weight:500;color:var(--text-disabled)">(선택)</span></label>
          <input class="input" id="s-keyword" placeholder="예) NETFLIX.COM — 비우면 이름으로 찾아요" value="${esc(x?.keyword || '')}" autocomplete="off" />
          <p class="field__hint">명세서를 가져올 때 이 이름이 들어간 결제는 정기결제로 묶여서 두 번 세지 않아요</p>
        </div>
        <div class="field">
          <div class="switch-row">
            <div class="switch-row__text"><p class="switch-row__title">해지 고려</p><p class="switch-row__desc">"줄일 수 있는 곳"에 모아서 보여 드려요</p></div>
            <button type="button" class="switch switch--amber" role="switch" aria-checked="${Boolean(x?.review)}" id="s-review" aria-label="해지 고려"></button>
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="s-memo">메모</label>
          <input class="input" id="s-memo" placeholder="예) 가족 공유, 12월까지 할인가" value="${esc(x?.memo || '')}" autocomplete="off" />
        </div>
      </form>`,
    foot: `
      ${isEdit ? `<button class="btn btn--danger btn--icon-only" data-act="delete" aria-label="삭제">${icons.trash}</button>` : ''}
      ${isEdit ? `<button class="btn btn--neutral" data-act="toggle">${x.active ? '해지함으로' : '다시 사용'}</button>` : '<button class="btn btn--neutral" data-close>취소</button>'}
      <button class="btn btn--primary" type="submit" form="subForm">${isEdit ? '저장' : '추가하기'}</button>`,
  });
  const form = sheet.querySelector('#subForm');
  const amt = form.amount;
  amt.addEventListener('input', () => { const d = amt.value.replace(/[^\d]/g, ''); amt.value = d ? Number(d).toLocaleString('ko-KR') : ''; });
  sheet.querySelectorAll('[data-cycle]').forEach((b) => b.addEventListener('click', () => {
    cycle = b.dataset.cycle;
    sheet.querySelectorAll('[data-cycle]').forEach((o) => o.setAttribute('aria-pressed', o === b));
    sheet.querySelector('#s-month-wrap').hidden = cycle !== 'yearly';
  }));
  const rv = sheet.querySelector('#s-review');
  rv.addEventListener('click', () => rv.setAttribute('aria-checked', rv.getAttribute('aria-checked') !== 'true'));
  const collect = () => ({
    name: form.name.value.trim(), amount: Number(amt.value.replace(/[^\d]/g, '')), cycle,
    billingDay: Number(sheet.querySelector('#s-day').value), billingMonth: Number(sheet.querySelector('#s-month').value),
    method: sheet.querySelector('#s-method').value.trim(), category: sheet.querySelector('#s-cat').value,
    keyword: sheet.querySelector('#s-keyword').value.trim(), review: rv.getAttribute('aria-checked') === 'true',
    memo: sheet.querySelector('#s-memo').value.trim(),
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = collect();
    if (!data.name) { toast('이름을 입력해 주세요', { type: 'error' }); form.name.focus(); return; }
    if (!data.amount) { toast('금액을 입력해 주세요', { type: 'error' }); amt.focus(); return; }
    if (isEdit) updateSubscription(id, data); else addSubscription(data);
    scheduleSync(); closeSheet();
    toast(isEdit ? '저장했어요' : `${data.name} 정기결제를 추가했어요`, { type: 'success' });
  });
  sheet.querySelector('[data-act="toggle"]')?.addEventListener('click', () => {
    const active = !x.active;
    updateSubscription(id, { ...collect(), active, cancelledAt: active ? '' : todayStr(), review: active ? x.review : false });
    scheduleSync(); closeSheet();
    toast(active ? '다시 사용으로 바꿨어요' : `${x.name} 해지함으로 옮겼어요. 다음 달부터 합계에서 빠져요`, { type: 'success', duration: 3200 });
  });
  sheet.querySelector('[data-act="delete"]')?.addEventListener('click', async () => {
    closeSheet();
    if (await confirmSheet({ title: '정기결제를 삭제할까요?', desc: '해지한 거라면 삭제 대신 "해지함으로"를 쓰면 지난 달 합계가 그대로 남아요.' })) { deleteSubscription(id); scheduleSync(); toast('삭제했어요'); }
  });
}
