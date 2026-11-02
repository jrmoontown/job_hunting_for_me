/**
 * 카드·통장 명세서 가져오기 — CSV / 엑셀(xls·xlsx) 파일을 읽어 지출로 넣는다.
 * 1) 파일 읽기 → 2) 머리글 줄 찾기 → 3) 날짜·가맹점·금액 칸 맞추기 → 4) 자동 분류 미리 보기 → 5) 저장
 * 같은 파일을 두 번 올려도 importKey로 중복을 건너뛴다.
 */
import { addExpenses, getExpenses, getSubscriptions, todayStr } from '../store.js';
import { esc, icons, openSheet, closeSheet, toast } from '../ui.js';
import { scheduleSync } from '../sync.js';
import { CATEGORIES, catOf, guessCategory, matchSubscription, won } from '../money.js';

const XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

/* ------------------------------------------------------------------ */
/* 파일 → 2차원 배열                                                    */
/* ------------------------------------------------------------------ */
export function parseCSV(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',' || ch === '\t') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c));
}

function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = XLSX_URL; s.async = true;
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error('엑셀을 읽는 도구를 불러오지 못했어요. 인터넷 연결을 확인하거나 CSV로 저장해서 올려 주세요.'));
    document.head.appendChild(s);
  });
}

async function readRows(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const buf = await file.arrayBuffer();
    // 한국 카드사 CSV는 EUC-KR인 경우가 많다
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('�')) text = new TextDecoder('euc-kr').decode(buf);
    return parseCSV(text.replace(/^﻿/, ''));
  }
  const XLSX = await loadXLSX();
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
  // 행이 가장 많은 시트를 쓴다
  let best = [];
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: '' })
      .map((r) => r.map((c) => (typeof c === 'string' ? c.trim() : c)))
      .filter((r) => r.some((c) => c !== '' && c !== null));
    if (rows.length > best.length) best = rows;
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* 칸 맞추기                                                            */
/* ------------------------------------------------------------------ */
const HINTS = {
  date: ['이용일', '거래일', '승인일', '사용일', '일자', '날짜', '거래일시', 'date'],
  merchant: ['가맹점', '이용처', '사용처', '내용', '적요', '거래처', '상호', '기재내용', 'description', 'merchant'],
  amount: ['이용금액', '승인금액', '결제금액', '거래금액', '출금', '찾으신', '사용금액', '금액', 'amount'],
  method: ['카드명', '카드종류', '이용카드', '카드번호', '결제수단'],
  cancel: ['취소', '상태', '승인구분', '구분'],
};
const score = (cell, words) => { const c = String(cell || '').replace(/\s/g, ''); return words.findIndex((w) => c.includes(w)); };

export function detectHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const r = rows[i];
    const hasDate = r.some((c) => score(c, HINTS.date) >= 0);
    const hasAmt = r.some((c) => score(c, HINTS.amount) >= 0);
    if (hasDate && hasAmt) return i;
  }
  return 0;
}

export function guessColumns(header) {
  const pick = (words, avoid = []) => {
    let best = -1; let bestScore = 99;
    header.forEach((h, i) => {
      if (avoid.includes(i)) return;
      const s = score(h, words);
      if (s >= 0 && s < bestScore) { best = i; bestScore = s; }
    });
    return best;
  };
  const date = pick(HINTS.date);
  const amount = pick(HINTS.amount, [date]);
  const merchant = pick(HINTS.merchant, [date, amount]);
  const method = pick(HINTS.method, [date, amount, merchant]);
  const cancel = pick(HINTS.cancel, [date, amount, merchant, method]);
  return { date, merchant, amount, method, cancel };
}

const pad = (n) => String(n).padStart(2, '0');
export function parseDate(v) {
  if (v === '' || v === null || v === undefined) return '';
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // 엑셀 날짜 일련번호
    const d = new Date(Math.round((v - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(v).trim();
  let m = s.match(/(\d{4})\D{0,2}(\d{1,2})\D{0,2}(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) return `20${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[.\-/월]\s?(\d{1,2})/);
  if (m) {
    const y = Number(todayStr().slice(0, 4));
    const guess = `${y}-${pad(m[1])}-${pad(m[2])}`;
    return guess > todayStr() ? `${y - 1}-${pad(m[1])}-${pad(m[2])}` : guess;
  }
  return '';
}
export function parseAmount(v) {
  if (typeof v === 'number') return v;
  const s = String(v || '').replace(/[,\s원₩]/g, '');
  const neg = /^-|^\(.*\)$/.test(s);
  const n = Number(s.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? (neg ? -n : n) : 0;
}

/** 머리글/칸 설정으로 지출 후보 목록을 만든다 */
export function buildCandidates(rows, headerIdx, cols, { method = '' } = {}) {
  const history = getExpenses();
  const subs = getSubscriptions();
  const seen = new Map();
  const out = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const date = parseDate(r[cols.date]);
    let amount = parseAmount(r[cols.amount]);
    const merchant = cols.merchant >= 0 ? String(r[cols.merchant] ?? '').trim() : '';
    if (!date || !amount) continue; // 합계·빈 줄 등
    if (/합계|소계|총\s?계/.test(merchant)) continue;
    const cancelCell = cols.cancel >= 0 ? String(r[cols.cancel] ?? '') : '';
    if (/취소|환불|반품/.test(cancelCell) && amount > 0) amount = -amount;
    const m = (cols.method >= 0 && r[cols.method]) ? String(r[cols.method]).trim() : method;
    const base = `${date}|${amount}|${merchant}`;
    const n = (seen.get(base) || 0) + 1; seen.set(base, n);
    const subscriptionId = amount > 0 ? matchSubscription(merchant, amount, subs) : '';
    const sub = subscriptionId ? subs.find((s) => s.id === subscriptionId) : null;
    out.push({
      date, amount: Math.round(amount), merchant, method: m,
      category: sub ? sub.category : guessCategory(merchant, history),
      subscriptionId, source: 'import', importKey: `${base}#${n}`,
    });
  }
  return out;
}

/** 파일 이름에서 카드사 추정 (영문 파일 이름도) */
const CARD_NAMES = [
  [/신한|shinhan/i, '신한카드'], [/삼성|samsung/i, '삼성카드'], [/현대|hyundai/i, '현대카드'],
  [/국민|kb(?![a-z])/i, 'KB국민카드'], [/롯데|lotte/i, '롯데카드'], [/하나|hana(?![a-z])/i, '하나카드'],
  [/우리|woori/i, '우리카드'], [/비씨|bc(?![a-z])/i, 'BC카드'], [/농협|nh(?![a-z])/i, 'NH농협카드'],
  [/카카오|kakao/i, '카카오뱅크'], [/토스|toss/i, '토스'],
];
export const cardFromFileName = (name) => (CARD_NAMES.find(([re]) => re.test(name)) || [, ''])[1];

/* ------------------------------------------------------------------ */
/* 시트                                                                */
/* ------------------------------------------------------------------ */
export function openImportSheet() {
  const sheet = openSheet({
    title: '명세서 가져오기',
    desc: '카드·통장 이용내역 파일을 올리면 한 번에 들어와요',
    body: `
      <div class="callout" style="margin-bottom:14px">
        ${icons.info}
        <div>
          <strong>파일 받는 법</strong><br/>
          카드사 앱·홈페이지 → <strong>이용내역 조회</strong> → 기간 선택 → <strong>엑셀 다운로드</strong><br/>
          은행은 거래내역 조회 → 엑셀 저장. CSV · XLS · XLSX 모두 돼요.
        </div>
      </div>
      <label class="file-drop" id="fileDrop">
        <input type="file" id="importFile" accept=".csv,.txt,.xls,.xlsx" hidden />
        <span class="file-drop__icon">${icons.upload}</span>
        <span class="file-drop__title">파일 선택</span>
        <span class="file-drop__desc">같은 파일을 다시 올려도 중복은 건너뛰어요</span>
      </label>
      <div id="importStep"></div>`,
    foot: '<button class="btn btn--neutral" data-close>닫기</button><button class="btn btn--primary" id="importSave" disabled>가져오기</button>',
  });
  const step = sheet.querySelector('#importStep');
  const saveBtn = sheet.querySelector('#importSave');
  let rows = []; let headerIdx = 0; let cols = {}; let cands = []; let methodName = '';

  const colSelect = (key, label, optional = false) => {
    const header = rows[headerIdx] || [];
    return `
      <div class="field">
        <label class="field__label" for="col-${key}">${label}</label>
        <select class="select" id="col-${key}" data-col="${key}">
          ${optional ? '<option value="-1">없음</option>' : ''}
          ${header.map((h, i) => `<option value="${i}" ${cols[key] === i ? 'selected' : ''}>${esc(String(h || `${i + 1}번째 칸`))}</option>`).join('')}
        </select>
      </div>`;
  };

  const renderStep = () => {
    cands = buildCandidates(rows, headerIdx, cols, { method: methodName });
    const existing = new Set(getExpenses().map((x) => x.importKey));
    const fresh = cands.filter((c) => !existing.has(c.importKey));
    const total = fresh.reduce((a, c) => a + c.amount, 0);
    const subCount = fresh.filter((c) => c.subscriptionId).length;
    const etc = fresh.filter((c) => c.category === 'etc').length;
    step.innerHTML = `
      <p class="field__label" style="margin-top:18px">칸 맞추기 <span style="font-weight:500;color:var(--text-tertiary)">· 자동으로 골랐어요. 틀리면 바꿔 주세요</span></p>
      <div class="field-row">${colSelect('date', '날짜')}${colSelect('amount', '금액')}</div>
      <div class="field-row">${colSelect('merchant', '가맹점')}${colSelect('cancel', '취소 여부', true)}</div>
      <div class="field">
        <label class="field__label" for="importMethod">결제수단 이름 <span style="font-weight:500;color:var(--text-disabled)">(선택)</span></label>
        <input class="input" id="importMethod" placeholder="예) 신한카드" value="${esc(methodName)}" autocomplete="off" />
      </div>
      <div class="import-sum">
        <b>${fresh.length}건 · ${won(total)}</b>
        <span>${cands.length - fresh.length ? `이미 있는 ${cands.length - fresh.length}건 제외 · ` : ''}${subCount ? `정기결제 ${subCount}건 연결 · ` : ''}${etc ? `분류 못 한 ${etc}건은 '기타'` : '모두 자동 분류됨'}</span>
      </div>
      <div class="import-preview">
        ${fresh.slice(0, 30).map((c, i) => `
          <div class="import-row">
            <span class="import-row__date">${c.date.slice(5).replace('-', '/')}</span>
            <span class="import-row__name">${esc(c.merchant || '(이름 없음)')}${c.subscriptionId ? ' <span class="badge badge--violet">정기결제</span>' : ''}</span>
            <select class="import-row__cat" data-idx="${i}" aria-label="분류">${CATEGORIES.map((k) => `<option value="${k.key}" ${k.key === c.category ? 'selected' : ''}>${k.label}</option>`).join('')}</select>
            <span class="import-row__amt ${c.amount < 0 ? 'is-refund' : ''}">${won(c.amount)}</span>
          </div>`).join('')}
        ${fresh.length > 30 ? `<p class="field__hint" style="text-align:center;padding:8px">… 외 ${fresh.length - 30}건 (가져온 뒤 내역에서 바꿀 수 있어요)</p>` : ''}
      </div>`;
    saveBtn.disabled = !fresh.length;
    saveBtn.textContent = fresh.length ? `${fresh.length}건 가져오기` : '새로 가져올 내역 없음';
    step.querySelectorAll('[data-col]').forEach((s) => s.addEventListener('change', () => { cols[s.dataset.col] = Number(s.value); renderStep(); }));
    step.querySelector('#importMethod').addEventListener('change', (e) => { methodName = e.target.value.trim(); renderStep(); });
    step.querySelectorAll('.import-row__cat').forEach((s) => s.addEventListener('change', () => {
      const c = fresh[Number(s.dataset.idx)];
      // 같은 가맹점은 한꺼번에 바꾼다
      fresh.forEach((o) => { if (o.merchant === c.merchant) o.category = s.value; });
      step.querySelectorAll('.import-row__cat').forEach((o) => { const f = fresh[Number(o.dataset.idx)]; if (f.merchant === c.merchant) o.value = s.value; });
    }));
    saveBtn.onclick = () => {
      const made = addExpenses(fresh);
      scheduleSync(); closeSheet();
      toast(`${made.length}건을 가져왔어요`, { type: 'success' });
    };
  };

  sheet.querySelector('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    sheet.querySelector('.file-drop__title').textContent = file.name;
    step.innerHTML = '<p class="field__hint" style="padding:12px 2px">읽는 중…</p>';
    try {
      rows = await readRows(file);
      if (!rows.length) throw new Error('파일에서 표를 찾지 못했어요.');
      headerIdx = detectHeader(rows);
      cols = guessColumns(rows[headerIdx]);
      if (cols.date < 0 || cols.amount < 0) throw new Error('날짜나 금액 칸을 찾지 못했어요. 이용내역 엑셀이 맞는지 확인해 주세요.');
      if (!methodName) methodName = cardFromFileName(file.name);
      renderStep();
    } catch (err) {
      step.innerHTML = `<div class="callout callout--warn" style="margin-top:14px">${icons.alert}<div>${esc(err.message || '파일을 읽지 못했어요.')}</div></div>`;
      saveBtn.disabled = true;
    }
  });
}
