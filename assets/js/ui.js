/**
 * 공용 UI 유틸 — 아이콘, 바텀시트, 토스트, 이스케이프.
 */

/* ------------------------------------------------------------------ */
/* HTML 유틸                                                            */
/* ------------------------------------------------------------------ */
export const esc = (s) => String(s ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export const el = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

/* ------------------------------------------------------------------ */
/* 아이콘 (24x24 stroke 기반 — Toss 스타일의 둥근 라인)                    */
/* ------------------------------------------------------------------ */
const I = (paths, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${paths}</svg>`;

export const icons = {
  calendar: I('<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/>'),
  briefcase: I('<rect x="3.5" y="7.5" width="17" height="12.5" rx="3"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 12.5h17"/>'),
  check: I('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  checkSmall: I('<path d="m5.5 12.5 4 4L18.5 8" stroke-width="3"/>'),
  chart: I('<path d="M5 20V10M12 20V4M19 20v-7"/>'),
  gear: I('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z"/>'),
  star: I('<path d="m12 3.6 2.5 5.06 5.6.82-4.05 3.94.96 5.57L12 16.36l-5 2.63.95-5.57L3.9 9.48l5.6-.82L12 3.6Z"/>'),
  starFill: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 3.1 2.65 5.37 5.93.86-4.29 4.18 1.01 5.9L12 16.63l-5.3 2.78 1.01-5.9-4.29-4.18 5.93-.86L12 3.1Z"/></svg>',
  link: I('<path d="M10 14a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 5.93"/><path d="M14 10a5 5 0 0 0-7.07 0L4.8 12.12a5 5 0 0 0 7.07 7.07L13 18.07"/>'),
  external: I('<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 13.5V18a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18V7.5A2.5 2.5 0 0 1 6 5h4.5"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  chevronLeft: I('<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>'),
  chevronRight: I('<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>'),
  chevronDown: I('<path d="m6 9.5 6 6 6-6"/>'),
  sun: I('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.3 4.3l1.4 1.4M18.3 18.3l1.4 1.4M2.5 12h2M19.5 12h2M4.3 19.7l1.4-1.4M18.3 5.7l1.4-1.4"/>'),
  moon: I('<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"/>'),
  refresh: I('<path d="M20 11.5A8 8 0 0 0 6.5 6L4 8.5M4 12.5A8 8 0 0 0 17.5 18l2.5-2.5"/><path d="M4 4v4.5h4.5M20 20v-4.5h-15.5" style="display:none"/><path d="M4 4.5V8.5h4M20 19.5v-4h-4"/>'),
  trash: I('<path d="M4.5 6.5h15M9.5 6V4.5A1.5 1.5 0 0 1 11 3h2a1.5 1.5 0 0 1 1.5 1.5V6M6.5 6.5 7.3 19a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12.5M10 10.5v6M14 10.5v6"/>'),
  edit: I('<path d="M14.5 5 19 9.5 8.5 20H4v-4.5L14.5 5Z"/><path d="m12.5 7 4.5 4.5"/>'),
  download: I('<path d="M12 3.5v11M7.5 10 12 14.5 16.5 10"/><path d="M4.5 16.5V18A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-1.5"/>'),
  upload: I('<path d="M12 14.5v-11M7.5 8 12 3.5 16.5 8"/><path d="M4.5 16.5V18A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-1.5"/>'),
  cloud: I('<path d="M7 18.5a4.5 4.5 0 0 1-.4-8.98 6 6 0 0 1 11.68 1.4A3.8 3.8 0 0 1 17.5 18.5H7Z"/>'),
  cloudOff: I('<path d="M7 18.5a4.5 4.5 0 0 1-.4-8.98 6 6 0 0 1 8.2-4.36M17 8.5a3.8 3.8 0 0 1 1.28 7.4M4 4l16 16"/>'),
  info: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.8v.3"/>'),
  alert: I('<path d="M12 4 2.8 19.5h18.4L12 4Z"/><path d="M12 10v4M12 16.8v.3"/>'),
  key: I('<circle cx="8" cy="14.5" r="4.5"/><path d="m11.5 11.5 8-8M16 4.5l3 3M13.5 7l3 3"/>'),
  fire: I('<path d="M12 21c-3.6 0-6.5-2.6-6.5-6.3 0-2.8 1.9-5 3.2-6.6.6-.7 1.7-.3 1.8.6.1.9.4 1.8 1 2.3.3-2 1.2-5.3 3.6-7 .7-.5 1.6.1 1.5.9-.1 1.5.2 3.5 1.5 5 1.1 1.4 2.4 2.8 2.4 4.8 0 3.7-2.9 6.3-6.5 6.3Z"/>'),
  list: I('<path d="M8.5 6.5H20M8.5 12H20M8.5 17.5H20M4 6.5h.3M4 12h.3M4 17.5h.3" stroke-width="2.2"/>'),
  x: I('<path d="m6 6 12 12M18 6 6 18"/>'),
  memo: I('<rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M8.5 8.5h7M8.5 12.5h7M8.5 16.5h4"/>'),
  building: I('<rect x="4.5" y="3.5" width="10" height="17" rx="2"/><path d="M14.5 9.5h3.5a1.5 1.5 0 0 1 1.5 1.5v9.5M8 7.5h3M8 11.5h3M8 15.5h3M14.5 20.5H21"/>'),
  clock: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
};

/* ------------------------------------------------------------------ */
/* 바텀시트 / 모달                                                       */
/* ------------------------------------------------------------------ */
const sheetRoot = () => document.getElementById('sheetRoot');
let activeSheet = null;

export function openSheet({ title, desc = '', body, foot = '', onOpen, wide = false }) {
  closeSheet();
  const root = sheetRoot();
  root.hidden = false;
  root.innerHTML = `
    <div class="sheet-dim" data-close></div>
    <div class="sheet ${wide ? 'sheet--wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet__grip" aria-hidden="true"></div>
      <div class="sheet__head">
        <div class="sheet__titles">
          <h2 class="sheet__title">${esc(title)}</h2>
          ${desc ? `<p class="sheet__desc">${esc(desc)}</p>` : ''}
        </div>
        <button class="icon-btn" data-close aria-label="닫기">${icons.x}</button>
      </div>
      <div class="sheet__body">${body}</div>
      ${foot ? `<div class="sheet__foot">${foot}</div>` : ''}
    </div>`;
  document.body.style.overflow = 'hidden';

  const close = () => closeSheet();
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  activeSheet = { root, onKey };

  const sheet = root.querySelector('.sheet');
  onOpen?.(sheet);
  // 첫 입력 요소에 포커스 (모바일 키보드가 바로 뜨는 건 피하려고 데스크톱만)
  if (matchMedia('(min-width: 1024px)').matches) {
    sheet.querySelector('input, select, textarea, button.btn--primary')?.focus?.();
  }
  return sheet;
}

export function closeSheet() {
  if (!activeSheet) return;
  document.removeEventListener('keydown', activeSheet.onKey);
  activeSheet.root.hidden = true;
  activeSheet.root.innerHTML = '';
  document.body.style.overflow = '';
  activeSheet = null;
  // 시트가 닫히면 뷰가 최신 데이터로 다시 그려지도록 알림
  document.dispatchEvent(new CustomEvent('sheet:closed'));
}

/** 확인 다이얼로그 — confirm() 대체 */
export function confirmSheet({ title, desc, confirmText = '삭제', danger = true }) {
  return new Promise((resolve) => {
    const sheet = openSheet({
      title, desc,
      body: '',
      foot: `
        <button class="btn btn--neutral" data-act="cancel">취소</button>
        <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-act="ok">${esc(confirmText)}</button>`,
    });
    sheet.querySelector('[data-act="cancel"]').addEventListener('click', () => { closeSheet(); resolve(false); });
    sheet.querySelector('[data-act="ok"]').addEventListener('click', () => { closeSheet(); resolve(true); });
  });
}

/* ------------------------------------------------------------------ */
/* 토스트                                                               */
/* ------------------------------------------------------------------ */
export function toast(message, { type = 'default', duration = 2400 } = {}) {
  const root = document.getElementById('toastRoot');
  const icon = type === 'success' ? icons.check : type === 'error' ? icons.alert : '';
  const node = el(`<div class="toast toast--${type}">${icon}<span>${esc(message)}</span></div>`);
  root.appendChild(node);
  setTimeout(() => {
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 240);
  }, duration);
}
