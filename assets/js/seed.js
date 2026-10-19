/**
 * 최초 실행 시 채워 넣을 기본 데이터.
 * 사용자가 정리해 둔 공고 목록과 Notion TDL의 지원 완료 내역을 옮겨 담았다.
 *
 * deadline  : 사용자가 스스로 정한 마감일(보통 실제 마감 하루 전)
 * realDeadline : 기업이 공지한 실제 마감일 (알고 있을 때만)
 */

export const SEED_VERSION = 9;

/** 교재/과정 카드 색 — 공부 탭과 캘린더에서 같은 색으로 보인다 */
export const STUDY_COLORS = {
  green:  { label: '초록', main: 'var(--success)',    weak: 'var(--success-weak)' },
  blue:   { label: '파랑', main: 'var(--primary)',    weak: 'var(--primary-weak)' },
  violet: { label: '보라', main: 'var(--violet-500)', weak: 'var(--violet-50)' },
  amber:  { label: '주황', main: 'var(--warning)',    weak: 'var(--warning-weak)' },
  teal:   { label: '청록', main: 'var(--teal-500)',   weak: 'var(--teal-50)' },
  red:    { label: '빨강', main: 'var(--danger)',     weak: 'var(--danger-weak)' },
};

/** 개인 일정 종류 */
export const EVENT_KINDS = { trip: '여행', meet: '약속', anniv: '기념일', work: '회사 일정', other: '기타' };

/** 그날 지원서를 쓸 수 있는 정도 */
export const AVAIL = {
  none: { label: '불가', desc: '아예 못 써요' },
  hard: { label: '어려움', desc: '짬 나면 조금' },
  ok:   { label: '가능', desc: '기록만 해둘게요' },
};
export const AVAIL_RANK = { none: 2, hard: 1, ok: 0 };

/** 공고 진행 상태 정의 — 뷰 전반에서 이 순서대로 노출된다. */
export const STATUSES = {
  planned:   { label: '지원 예정', short: '예정',   color: 'var(--grey-500)',    tone: 'grey',   done: false },
  applied:   { label: '지원 완료', short: '완료',   color: 'var(--primary)',     tone: 'blue',   done: true  },
  doc_pass:  { label: '서류 합격', short: '서류합격', color: 'var(--violet-500)', tone: 'violet', done: true  },
  interview: { label: '면접 진행', short: '면접',   color: 'var(--violet-500)',  tone: 'violet', done: true  },
  offer:     { label: '최종 합격', short: '최종합격', color: 'var(--success)',   tone: 'green',  done: true  },
  rejected:  { label: '불합격',    short: '불합격', color: 'var(--danger)',      tone: 'red',    done: true  },
  dropped:   { label: '지원 포기', short: '포기',   color: 'var(--text-disabled)', tone: 'grey', done: true  },
};

export const STATUS_ORDER = ['planned', 'applied', 'doc_pass', 'interview', 'offer', 'rejected', 'dropped'];

/** 아직 남아 있는(=해야 할 일이 있는) 상태인지 */
export const isOpenStatus = (status) => status === 'planned';

let seq = 0;
const make = (company, position, deadline, extra = {}) => ({
  id: `seed-${String(++seq).padStart(3, '0')}`,
  company,
  position: position || '',
  deadline,
  realDeadline: '',
  important: false,
  status: 'planned',
  url: '',
  memo: '',
  appliedAt: '',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...extra,
});

export const SEED_JOBS = [
  // ── 9월 4일 ──────────────────────────────────────────────
  make('ASE', 'IT', '2026-09-04'),
  make('현대비앤지스틸', '', '2026-09-04'),
  make('주성엔지니어링', '', '2026-09-04'),

  // ── 9월 6일 ──────────────────────────────────────────────
  make('KT', 'NW 인프라 운용', '2026-09-06'),

  // ── 9월 7일 ──────────────────────────────────────────────
  make('ASML', '', '2026-09-07'),

  // ── 9월 8일 ──────────────────────────────────────────────
  make('현대엔지니어링', '', '2026-09-08'),
  make('어플라이드 머티어리얼즈 코리아', '비즈니스 운영 지원', '2026-09-08'),

  // ── 9월 9일 ──────────────────────────────────────────────
  make('KT&G', '', '2026-09-09', { memo: '직무 미정 — 지원 전 결정 필요' }),
  make('LG에너지솔루션', '', '2026-09-09'),
  make('현대모비스', '', '2026-09-09'),

  // ── 9월 10일 ─────────────────────────────────────────────
  make('금호석유화학', '', '2026-09-10'),
  make('LG이노텍', '', '2026-09-10'),

  // ── 9월 11일 ─────────────────────────────────────────────
  make('LG생활건강', '', '2026-09-11'),

  // ── 9월 12일 ─────────────────────────────────────────────
  make('LG전자', '', '2026-09-12', { memo: '직무 미정 — 지원 전 결정 필요' }),
  make('현대자동차', '', '2026-09-12'),
  make('LIG', 'D&A', '2026-09-12'),
  make('심팩(SIMPAC)', '', '2026-09-12', { important: true }),
  make('현대글로비스', '', '2026-09-12'),

  // ── 9월 13일 ─────────────────────────────────────────────
  make('키움증권', '', '2026-09-13'),
  make('LG CNS', '', '2026-09-13'),

  // ── 9월 15일 ─────────────────────────────────────────────
  make('한화 금융계열', '', '2026-09-15'),
  make('LG디스플레이', '', '2026-09-15'),
  make('롯데이노베이트', '', '2026-09-15', { important: true }),
  make('포스코DX', '', '2026-09-15'),

  // ── 9월 19일 ─────────────────────────────────────────────
  make('LX인터내셔널', '', '2026-09-19'),
  make('현대로템', '', '2026-09-19'),

  // ── 9월 20일 ─────────────────────────────────────────────
  make('두산(주)', '', '2026-09-20'),
  make('한국항공산업', '', '2026-09-20'),
  make('한화엔진', 'ESS', '2026-09-20'),
  make('한화시스템', '', '2026-09-20'),

  // ── 9월 26일 ─────────────────────────────────────────────
  make('HL그룹', '', '2026-09-26'),
  make('HD현대그룹', '', '2026-09-26'),

  // ── 10월 1일 ─────────────────────────────────────────────
  make('DB하이텍', '', '2026-10-01'),

  // ── 지원 완료 (Notion TDL 기록) ──────────────────────────
  make('현대종합금속', '전산실', '2026-08-19', {
    status: 'dropped', appliedAt: '2026-08-19', memo: '서류 합격 → 면접 포기',
  }),
  make('미디어로그', '전산실', '2026-08-19', {
    status: 'dropped', appliedAt: '2026-08-19', memo: '서류 합격 → 면접 포기',
  }),
  make('엘티정밀', '', '2026-08-19', {
    status: 'rejected', appliedAt: '2026-08-19', memo: '서류 탈락',
  }),
  make('코오롱글로벌', '', '2026-08-19', { status: 'applied', appliedAt: '2026-08-19' }),
  make('SK하이닉스', '', '2026-08-26', { status: 'applied', appliedAt: '2026-08-26' }),
  make('한국산업기술시험원', '', '2026-08-27', { status: 'applied', appliedAt: '2026-08-27' }),
  make('경동', '', '2026-08-27', { status: 'applied', appliedAt: '2026-08-27' }),
];

let tseq = 0;
const todo = (text, extra = {}) => ({
  id: `seed-todo-${String(++tseq).padStart(3, '0')}`,
  text,
  done: false,
  dueDate: '',
  jobId: '',
  url: '',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...extra,
});

export const SEED_TODOS = [
  todo('LG전자 지원 직무 정하기', { dueDate: '2026-09-11' }),
  todo('KT&G 지원 직무 정하기', { dueDate: '2026-09-08' }),
  todo('KT 지원 직무 정하기', { dueDate: '2026-09-05' }),
  todo('자소설닷컴 공고용 포트폴리오 만들기', { url: 'https://link.jasoseol.com/recruit/105652' }),
  todo('SQLD 자격증 나오면 미제출 공고 일괄 제출하기'),
  todo('지구회의', { dueDate: '2026-09-16' }),
];

let eseq = 0;
const event = (title, start, end, kind, avail, extra = {}) => ({
  id: `seed-evt-${String(++eseq).padStart(3, '0')}`,
  title, start, end, kind, avail,
  memo: '',
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
  ...extra,
});

/**
 * AICE 시나공 Associate 공식 수험서 — 챕터 단위 그대로.
 * Part1 Ch01~10 + Part2 사례 실습 + Part3 실전 연습문제 2회. 시험 전에 교재 전부 끝내는 게 목표.
 */
const AICE_UNITS = [
  ['c01', 'Ch01 AI 작업 환경 만들기'],
  ['c02', 'Ch02 데이터 획득하기'],
  ['c03', 'Ch03 데이터 구조 확인하기'],
  ['c04', 'Ch04 기초 데이터 다루기'],
  ['c05', 'Ch05 데이터 이해하기 (탐색·시각화)'],
  ['c06', 'Ch06 데이터 전처리하기'],
  ['c07', 'Ch07 AI 모델링 필수 개념'],
  ['c08', 'Ch08 지도학습 (머신러닝·딥러닝)'],
  ['c09', 'Ch09 비지도학습 (차원 축소·군집화)'],
  ['c10', 'Ch10 모델 성능 향상 (튜닝)'],
  ['p2',  'Part2 사례 실습 — 렌탈 고객 해지 예측'],
  ['m1',  '실전 연습문제 1회 [회귀]'],
  ['m2',  '실전 연습문제 2회 [분류]'],
];
const aiceId = (k) => `seed-aice2-${k}`;
const DONE_1019 = ['c01', 'c02', 'c03'];

/** 자격증 공부 — 교재/과정 */
export const SEED_STUDIES = [
  {
    id: 'seed-study-001',
    title: 'AICE 시나공 공식 수험서', exam: 'AICE Associate', examDate: '2026-10-31', color: 'green',
    memo: 'Ch01~10 → Part2 사례 실습 → 실전 2회. 시험 10/31(토) 14문항·90분·80점 합격 · aice.study',
    units: AICE_UNITS.map(([k, name]) => ({
      id: aiceId(k), name,
      done: DONE_1019.includes(k), doneAt: DONE_1019.includes(k) ? '2026-10-19' : '',
    })),
    createdAt: '2026-10-19T00:00:00.000Z', updatedAt: '2026-10-19T00:00:00.000Z',
  },
];

/**
 * AICE 일정 — 10/19(월) Ch01~03 완료. 목요일(10/22)·토요일(10/24) 공부 못 함.
 * 금요일은 오전 공부라 가볍게. 다음 주 월·화 몰아서, 수·목·금 오전, 토(10/31) 시험.
 * [날짜, 챕터들, 직접 제목(복습 등), 메모]
 */
const AICE_PLAN = [
  ['2026-10-19', ['c01', 'c02', 'c03'], '', '', true],
  ['2026-10-20', ['c04', 'c05', 'c06'], '', '진도 많이 빼는 날'],
  ['2026-10-21', ['c07'], '', '개념 위주'],
  ['2026-10-23', [], 'Ch04~07 확인 문제·개념정리 다시 보기', '금요일 · 오전 공부, 가볍게'],
  ['2026-10-25', ['c08', 'c09'], '', '일요일 · 분량 큼 (Ch08이 가장 길어요)'],
  ['2026-10-26', ['c10', 'p2'], '', '열심히 하는 날'],
  ['2026-10-27', ['m1'], '', '90분 재고 풀고 오답 정리'],
  ['2026-10-28', ['m2'], '', '오전 공부 · 90분 재고'],
  ['2026-10-29', [], '실전 2회 오답 + Ch08~10 확인 문제 다시 보기', '오전 공부'],
  ['2026-10-30', [], '총정리 — 전 챕터 개념정리 훑기, 자주 쓰는 코드 정리', '금요일 · 오전 공부, 가볍게 · 내일 시험'],
];
export const SEED_SESSIONS = AICE_PLAN.map(([date, keys, title, memo, done], i) => ({
  id: `seed-aice2-s${String(i + 1).padStart(2, '0')}`,
  studyId: 'seed-study-001', date, unitIds: keys.map(aiceId), title, memo,
  done: Boolean(done), doneAt: done ? date : '',
  createdAt: '2026-10-19T00:00:00.000Z', updatedAt: '2026-10-19T00:00:00.000Z',
}));

/** v6에서 추가되는 할 일 */
export const SEED_TODOS_V6 = [
  { id: 'seed-todo-102', text: 'AICE 시험(10/31) 접수 상태·응시 방식·준비물 확인하기', done: false, dueDate: '2026-10-23', jobId: '', url: 'https://aice.study',
    createdAt: '2026-10-15T00:00:00.000Z', updatedAt: '2026-10-15T00:00:00.000Z' },
];

/** v6: 공부 못 하는 날 — 개인 일정으로 등록 (작성 불가로 두었고, 앱에서 바꿀 수 있음) */
export const SEED_EVENTS_V6 = [
  { id: 'seed-evt-104', title: 'AICE 시험', start: '2026-10-31', end: '2026-10-31', kind: 'work', avail: 'none', memo: '14문항 · 90분 · 80점 합격', createdAt: '2026-10-15T00:00:00.000Z', updatedAt: '2026-10-15T00:00:00.000Z' },
];

/** v5에서 추가되는 할 일 */
export const SEED_TODOS_V5 = [
  { id: 'seed-todo-101', text: 'SQLD 문제집 사기', done: false, dueDate: '', jobId: '', url: '',
    createdAt: '2026-10-15T00:00:00.000Z', updatedAt: '2026-10-15T00:00:00.000Z' },
];

/** 개인 일정 — 지원서를 쓰기 어려운 날 */
export const SEED_EVENTS = [
  event('데이트', '2026-09-07', '2026-09-08', 'meet', 'hard'),
  event('여자친구 500일', '2026-09-13', '2026-09-13', 'anniv', 'hard'),
  event('가족 속초 여행', '2026-09-24', '2026-09-26', 'trip', 'none'),
  event('제주도 여행', '2026-09-29', '2026-10-01', 'trip', 'none'),
];

/** v7: 공부 못 하는 날 표시는 없앴다 (이전 기기에서는 마이그레이션이 지운다) */
export const REMOVED_EVENTS_V7 = ['seed-evt-101', 'seed-evt-102', 'seed-evt-103'];

/** v7: 개인 일정 */
export const SEED_EVENTS_V7 = [
  { id: 'seed-evt-201', title: '밀알축제', start: '2026-10-18', end: '2026-10-18', kind: 'other', avail: 'hard', memo: '', createdAt: '2026-10-15T09:00:00.000Z', updatedAt: '2026-10-15T09:00:00.000Z' },
  { id: 'seed-evt-202', title: '데이트', start: '2026-10-24', end: '2026-10-24', kind: 'meet', avail: 'hard', memo: '', createdAt: '2026-10-15T09:00:00.000Z', updatedAt: '2026-10-15T09:00:00.000Z' },
  { id: 'seed-evt-203', title: '데이트', start: '2026-10-28', end: '2026-10-28', kind: 'meet', avail: 'hard', memo: '', createdAt: '2026-10-15T09:00:00.000Z', updatedAt: '2026-10-15T09:00:00.000Z' },
  { id: 'seed-evt-204', title: '회사 회식', start: '2026-10-29', end: '2026-10-29', kind: 'work', avail: 'hard', memo: '', createdAt: '2026-10-15T09:00:00.000Z', updatedAt: '2026-10-15T09:00:00.000Z' },
  { id: 'seed-evt-205', title: '데이트', start: '2026-10-30', end: '2026-10-30', kind: 'meet', avail: 'hard', memo: '', createdAt: '2026-10-15T09:00:00.000Z', updatedAt: '2026-10-15T09:00:00.000Z' },
];

/** v7: 할 일 */
const t7 = (id, text, dueDate) => ({ id, text, done: false, dueDate, jobId: '', url: '', createdAt: '2026-10-15T09:00:00.000Z', updatedAt: '2026-10-15T09:00:00.000Z' });
export const SEED_TODOS_V7 = [
  t7('seed-todo-201', '청년미래적금 신청', '2026-10-16'),
  t7('seed-todo-202', '증명사진 찍기', '2026-10-16'),
  t7('seed-todo-203', '아이클라우드 정리 → 외장 SSD로 옮기기', '2026-10-17'),
  t7('seed-todo-204', '주민등록증 · 운전면허증 재발급 신청', '2026-10-19'),
  t7('seed-todo-205', '옷걸이 20개 추가 구매', ''),
];

/** v8: 오늘이 10/16이라 날짜를 다시 맞춘 할 일 (사용자가 손대지 않았을 때만 바꾼다) */
export const TODO_DATES_V8 = { 'seed-todo-201': '2026-10-16', 'seed-todo-202': '2026-10-16', 'seed-todo-203': '2026-10-17' };
