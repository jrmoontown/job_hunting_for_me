/**
 * 가계부 계산 — 분류, 자동 분류 규칙, 월 합계, 정기결제 일정.
 * 화면(views/money.js)과 명세서 가져오기(views/moneyImport.js)가 함께 쓴다.
 */
import { getExpenses, getSubscriptions, todayStr } from './store.js';

/* ------------------------------------------------------------------ */
/* 분류 — 고정비 4 + 변동비 13                                            */
/* ------------------------------------------------------------------ */
export const CATEGORIES = [
  // 고정비: 매달 거의 같은 돈이 나가는 것
  { key: 'housing',   label: '주거·관리비',  group: 'fixed', color: '#6b7684' },
  { key: 'telecom',   label: '통신',         group: 'fixed', color: '#4e5968' },
  { key: 'subs',      label: '구독·멤버십',  group: 'fixed', color: '#7b5cf0' },
  { key: 'insurance', label: '보험·금융',    group: 'fixed', color: '#8b95a1' },
  // 변동비: 내가 줄일 수 있는 것
  { key: 'food',      label: '식비',         group: 'var', color: '#f04452' },
  { key: 'cafe',      label: '카페·간식',    group: 'var', color: '#a0703c' },
  { key: 'drink',     label: '술·모임',      group: 'var', color: '#ff9500' },
  { key: 'date',      label: '데이트',       group: 'var', color: '#ff6b9d' },
  { key: 'shopping',  label: '쇼핑·생활',    group: 'var', color: '#3182f6' },
  { key: 'beauty',    label: '뷰티·스킨케어', group: 'var', color: '#e05aa8' },
  { key: 'car',       label: '자동차·교통',  group: 'var', color: '#0eb5a0' },
  { key: 'growth',    label: '자기계발',     group: 'var', color: '#02a26a' },
  { key: 'digital',   label: '디지털',       group: 'var', color: '#1957c2' },
  { key: 'health',    label: '건강·의료',    group: 'var', color: '#2fb5e0' },
  { key: 'gift',      label: '경조사·선물',  group: 'var', color: '#c48a00' },
  { key: 'travel',    label: '여행·취미',    group: 'var', color: '#5d9c3f' },
  { key: 'etc',       label: '기타',         group: 'var', color: '#b0b8c1' },
];
export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
export const catOf = (key) => CAT[key] || CAT.etc;

/* ------------------------------------------------------------------ */
/* 자동 분류 — 가맹점 이름에 들어 있는 단어로 추정                          */
/* 위에 있는 규칙이 먼저 적용된다 (예: KTX는 통신이 아니라 교통)             */
/* ------------------------------------------------------------------ */
const RULES = [
  ['subs', ['넷플릭스', 'netflix', '유튜브', 'youtube', '디즈니', 'disney', '티빙', 'tving', '웨이브', 'wavve', '왓챠', '쿠팡와우', '와우멤버십', '스포티파이', 'spotify', '멜론', '지니뮤직', '네이버플러스', 'icloud', 'apple.com/bill', 'chatgpt', 'openai', 'claude', 'anthropic', '노션', 'notion', '밀리의서재', '리디', 'ridi', '배민클럽', '요기패스', 'microsoft', 'adobe']],
  ['car', ['주유', '오일뱅크', 'gs칼텍스', 'sk에너지', 's-oil', '에쓰오일', '알뜰주유', '주차', '하이패스', '도로공사', '톨게이트', '세차', '카카오t', '카카오택시', '택시', '티머니', '코레일', 'ktx', 'srt', '고속버스', '시외버스', '쏘카', '그린카', '타이어', '카센터', '정비']],
  ['telecom', ['sk텔레콤', 'skt', '케이티', 'kt통신', 'lg유플러스', '유플러스', 'u+', '알뜰폰', '헬로모바일', '리브모바일']],
  ['insurance', ['보험', '화재', '생명', '손해', '연회비']],
  ['housing', ['관리비', '월세', '전기요금', '한국전력', '가스', '도시가스', '수도', '아파트']],
  ['cafe', ['스타벅스', 'starbucks', '투썸', '이디야', '메가커피', '메가mgc', '컴포즈', '빽다방', '폴바셋', '할리스', '파스쿠찌', '블루보틀', '커피', 'coffee', '카페', 'cafe', '배스킨', '던킨', '파리바게', '뚜레쥬르', '베이커리', '디저트', '설빙']],
  ['drink', ['포차', '호프', '주점', '이자카야', '술집', '와인', '맥주', '비어', 'pub', '바 ', '노래']],
  ['food', ['배달의민족', '배민', '요기요', '쿠팡이츠', '맥도날드', '버거킹', '롯데리아', '맘스터치', '서브웨이', '김밥', '식당', '분식', '국밥', '치킨', '피자', '한솥', '본죽', '도시락', '고기', '갈비', '찌개', '반점', '짬뽕', '초밥', '스시', '라멘', '푸드', '키친', '레스토랑']],
  ['beauty', ['올리브영', 'oliveyoung', '시코르', '아모레', '이니스프리', '미용실', '헤어', '네일', '화장품', '왁싱']],
  ['digital', ['애플', 'apple', '삼성전자', '하이마트', '전자랜드', '앱스토어', 'app store', 'google play', '구글플레이', '컴퓨존', '다나와']],
  ['growth', ['교보문고', 'yes24', '예스24', '알라딘', '영풍문고', '인프런', 'inflearn', '패스트캠퍼스', '클래스101', '유데미', 'udemy', '시험', '자격', '학원', '큐넷', '한국데이터', 'aice', '토익', 'ybm']],
  ['health', ['약국', '병원', '의원', '치과', '한의원', '안과', '피부과', '헬스', '피트니스', '필라테스', '요가']],
  ['travel', ['호텔', '숙박', '모텔', '펜션', '야놀자', '여기어때', '에어비앤비', 'airbnb', '항공', '대한항공', '아시아나', '제주항공', '진에어', '티웨이', 'cgv', '메가박스', '롯데시네마', '볼링', '골프']],
  ['gift', ['꽃', '플라워', '선물하기', '카카오톡 선물', '축의', '부의']],
  ['shopping', ['쿠팡', 'coupang', '다이소', '이마트', '홈플러스', '롯데마트', '컬리', '11번가', 'g마켓', '지마켓', '옥션', '무신사', '29cm', '지그재그', '에이블리', '네이버페이', '스마트스토어', '편의점', 'gs25', 'cu ', '씨유', '세븐일레븐', '이마트24', '노브랜드', '코스트코', '이케아', '마트', '유니클로', '자라']],
];

export const normMerchant = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const squash = (s) => normMerchant(s).replace(/[\s()㈜(주)]/g, '');

/** 이전에 같은 가맹점을 어떻게 분류했는지 먼저 보고, 없으면 단어 규칙으로 */
export function guessCategory(merchant, history = getExpenses()) {
  const m = normMerchant(merchant);
  if (!m) return 'etc';
  const key = squash(m);
  const past = history.filter((x) => squash(x.merchant) === key).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0];
  if (past && past.category && past.category !== 'etc') return past.category;
  const padded = ` ${m} `;
  for (const [cat, words] of RULES) {
    if (words.some((w) => padded.includes(w))) return cat;
  }
  return 'etc';
}

/** 가맹점·금액이 정기결제와 맞으면 그 정기결제 id (금액 ±10%) */
export function matchSubscription(merchant, amount, subs = getSubscriptions()) {
  const m = squash(merchant);
  if (!m) return '';
  const hit = subs.find((s) => {
    const kw = squash(s.keyword || s.name);
    if (!kw || !m.includes(kw)) return false;
    return !s.amount || Math.abs(Math.abs(amount) - s.amount) <= s.amount * 0.1;
  });
  return hit ? hit.id : '';
}

/* ------------------------------------------------------------------ */
/* 날짜 · 금액 유틸                                                     */
/* ------------------------------------------------------------------ */
const pad = (n) => String(n).padStart(2, '0');
export const won = (n) => `${Math.round(n || 0).toLocaleString('ko-KR')}원`;
export const wonShort = (n) => {
  const v = Math.round(n || 0);
  if (Math.abs(v) >= 10000) return `${(v / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만원`;
  return won(v);
};
export const monthKey = (dateStr) => (dateStr || '').slice(0, 7);
export const thisMonth = () => monthKey(todayStr());
export function shiftMonth(key, n) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export const monthLabel = (key) => { const [y, m] = key.split('-').map(Number); return `${y}년 ${m}월`; };
const lastDay = (y, m) => new Date(y, m, 0).getDate(); // m: 1~12

/* ------------------------------------------------------------------ */
/* 정기결제                                                             */
/* ------------------------------------------------------------------ */
/** 한 달에 드는 돈으로 환산 (연 결제는 12로 나눔) */
export const monthlyCost = (s) => (s.cycle === 'yearly' ? s.amount / 12 : s.amount);

/** 해당 월에 살아 있던 정기결제인지 (시작 전·해지 후 달은 제외) */
export function subActiveIn(s, key) {
  const start = `${key}-01`;
  const [y, m] = key.split('-').map(Number);
  const end = `${key}-${pad(lastDay(y, m))}`;
  if (s.startDate && s.startDate > end) return false;
  if (!s.active && s.cancelledAt && s.cancelledAt < start) return false;
  if (!s.active && !s.cancelledAt) return false;
  return true;
}

/** 다음 결제일 (오늘 포함) */
export function nextBilling(s, from = todayStr()) {
  const [fy, fm] = from.split('-').map(Number);
  if (s.cycle === 'yearly') {
    const bm = Number(s.billingMonth) || 1;
    for (const y of [fy, fy + 1]) {
      const d = `${y}-${pad(bm)}-${pad(Math.min(Number(s.billingDay) || 1, lastDay(y, bm)))}`;
      if (d >= from) return d;
    }
  }
  for (let i = 0; i < 2; i++) {
    const dt = new Date(fy, fm - 1 + i, 1);
    const y = dt.getFullYear(); const m = dt.getMonth() + 1;
    const d = `${y}-${pad(m)}-${pad(Math.min(Number(s.billingDay) || 1, lastDay(y, m)))}`;
    if (d >= from) return d;
  }
  return from;
}

/** 해당 월 결제일 (그 달에 결제가 없으면 '') */
export function billingDateIn(s, key) {
  const [y, m] = key.split('-').map(Number);
  if (s.cycle === 'yearly' && Number(s.billingMonth) !== m) return '';
  return `${key}-${pad(Math.min(Number(s.billingDay) || 1, lastDay(y, m)))}`;
}

/* ------------------------------------------------------------------ */
/* 월 합계                                                              */
/* ------------------------------------------------------------------ */
/**
 * 한 달 지출 요약.
 * 총액 = 일반 지출(정기결제와 연결되지 않은 것) + 그 달의 정기결제(월 환산).
 * 명세서에서 들어온 정기결제 승인 건은 정기결제와 연결돼 두 번 세지 않는다.
 */
export function monthSummary(key = thisMonth()) {
  const expenses = getExpenses().filter((x) => monthKey(x.date) === key);
  const variable = expenses.filter((x) => !x.subscriptionId);
  const subs = getSubscriptions().filter((s) => subActiveIn(s, key));
  const byCat = new Map();
  const add = (k, v) => byCat.set(k, (byCat.get(k) || 0) + v);
  variable.forEach((x) => add(x.category || 'etc', x.amount));
  subs.forEach((s) => add(s.category || 'subs', monthlyCost(s)));
  const subsTotal = subs.reduce((a, s) => a + monthlyCost(s), 0);
  const varTotal = variable.reduce((a, x) => a + x.amount, 0);
  const cats = [...byCat.entries()].map(([k, v]) => ({ ...catOf(k), amount: v })).filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
  const fixed = cats.filter((c) => c.group === 'fixed').reduce((a, c) => a + c.amount, 0);
  return {
    key, total: varTotal + subsTotal, varTotal, subsTotal, fixed, flexible: varTotal + subsTotal - fixed,
    cats, count: variable.length, subs, expenses,
  };
}
