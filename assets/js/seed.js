/**
 * 최초 실행 시 채워 넣을 기본 데이터.
 * 사용자가 정리해 둔 공고 목록과 Notion TDL의 지원 완료 내역을 옮겨 담았다.
 *
 * deadline  : 사용자가 스스로 정한 마감일(보통 실제 마감 하루 전)
 * realDeadline : 기업이 공지한 실제 마감일 (알고 있을 때만)
 */

export const SEED_VERSION = 8;

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
 * AICE 공부 — 시나공 수험서 목차를 17개 묶음으로 나누고, 공식 사이트(aice.study) 학습 4개를 더했다.
 * 공식 사이트 항목은 기사로 확인된 내용만 담았다: 샘플 문항 제공, 클라우드 주피터 랩 실습 환경,
 * Associate 14문항·90분·80점 이상 합격, 시험 중 지정 참고 사이트만 열람 가능(2025년 기준).
 */
const AICE_UNITS = [
  ['u01', '1. Ch01 환경 구성 + Ch02 데이터 획득 (넘파이·판다스·불러오기·저장)'],
  ['o01', '공식① 시험 안내 확인 + 샘플 문항 훑어보기 (aice.study)'],
  ['u02', '2. Ch03 데이터 구조 확인 + Ch04 §1 필요 데이터 선택하기'],
  ['o02', '공식② 공식 실습 환경(주피터 랩) 접속해서 코드 돌려보기'],
  ['u03', '3. Ch04 §2~4 데이터 변경·변형(그룹화·피벗)·병합(concat·merge)'],
  ['u04', '4. Ch05 데이터 이해하기 (지표 탐색 + matplotlib·seaborn 시각화)'],
  ['u05', '5. Ch06 §1 수치형 정제 (결측치·이상치·구간화)'],
  ['u06', '6. Ch06 §2~4 범주형 인코딩·스케일링·변수 선택'],
  ['u07', '7. Ch07 AI 모델링 필수 개념 (학습 방법·프로세스·데이터 분할·평가)'],
  ['u08', '8. Ch08 §1 머신러닝 ① 사이킷런·선형회귀·로지스틱·의사결정나무'],
  ['u09', '9. Ch08 §1 머신러닝 ② 앙상블·랜덤 포레스트·그래디언트 부스팅'],
  ['u10', '10. Ch08 §2 딥러닝 (인공신경망·심층신경망·고객 만족 분류 실습)'],
  ['u11', '11. Ch09 비지도학습 (PCA·t-SNE·K-평균·DBSCAN·고객 세분화 실습)'],
  ['u12', '12. Ch10 성능 향상 (그리드·랜덤 서치 + 항공권 가격·고객만족 실습)'],
  ['u13', '13. Part2 실습 §1~3 환경·전처리·EDA (렌탈 고객 해지 예측)'],
  ['u14', '14. Part2 실습 §4~5 모델링 전처리·모델 생성·평가'],
  ['u15', '15. Part3 실전 연습문제 1회 [회귀]'],
  ['u16', '16. Part3 실전 연습문제 2회 [분류]'],
  ['o03', '공식③ 공식 샘플 문항 90분 재고 실전처럼 풀기 (14문항·80점 합격선)'],
  ['u17', '17. 총정리 — 각 장 확인 문제·개념정리 다시 보기, 틀린 문제 복습'],
  ['o04', '공식④ 시험 중 볼 수 있는 참고 사이트(공식 문서)에서 함수 찾는 연습'],
];
const aiceId = (k) => `seed-aice-${k}`;

/** 자격증 공부 — 교재/과정 */
export const SEED_STUDIES = [
  {
    id: 'seed-study-001',
    title: 'AICE 시나공 수험서', exam: 'AICE Associate', examDate: '2026-10-31', color: 'green',
    memo: '수험서 Part1~3 + 공식 사이트 https://aice.study (샘플 문항·실습 환경). 시험 14문항·90분·80점 합격',
    units: AICE_UNITS.map(([k, name]) => ({ id: aiceId(k), name, done: false, doneAt: '' })),
    createdAt: '2026-10-15T00:00:00.000Z', updatedAt: '2026-10-15T00:00:00.000Z',
  },
];

/**
 * AICE 공부 일정 — 시험 10/31(토). 퇴근 후 2시간 기준, 10/19부터 공부 가능한 8일에 배치.
 * 10/16·17·18·24·28·29·30은 공부 못 하는 날. 10/25(일)은 주말이라 길게 잡았다.
 * 시간이 모자라 Ch09 비지도학습(u11)과 공식 샘플 90분 실전(o03)은 일정에서 뺐다 — 여유 생기면 추가.
 */
const AICE_PLAN = [
  ['2026-10-19', ['u01', 'u02', 'o01']],
  ['2026-10-20', ['u03', 'o02']],
  ['2026-10-21', ['u04', 'u05']],
  ['2026-10-22', ['u06', 'u07']],
  ['2026-10-23', ['u08', 'u09']],
  ['2026-10-25', ['u10', 'u12', 'u13']],
  ['2026-10-26', ['u14', 'u15']],
  ['2026-10-27', ['u16', 'u17', 'o04']],
];
export const SEED_SESSIONS = AICE_PLAN.map(([date, keys], i) => ({
  id: `seed-aice-t${String(i + 1).padStart(2, '0')}`,
  studyId: 'seed-study-001', date, unitIds: keys.map(aiceId), title: '',
  memo: keys.some((k) => k.startsWith('o')) ? 'aice.study' : '',
  done: false, doneAt: '',
  createdAt: '2026-10-15T00:00:00.000Z', updatedAt: '2026-10-15T00:00:00.000Z',
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
