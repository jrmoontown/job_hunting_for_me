/**
 * 최초 실행 시 채워 넣을 기본 데이터.
 * 사용자가 정리해 둔 공고 목록과 Notion TDL의 지원 완료 내역을 옮겨 담았다.
 *
 * deadline  : 사용자가 스스로 정한 마감일(보통 실제 마감 하루 전)
 * realDeadline : 기업이 공지한 실제 마감일 (알고 있을 때만)
 */

export const SEED_VERSION = 4;

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
  doc_pass:  { label: '서류 합격', short: '서류합격', color: 'var(--success)',   tone: 'green',  done: true  },
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

/** 개인 일정 — 지원서를 쓰기 어려운 날 */
export const SEED_EVENTS = [
  event('데이트', '2026-09-07', '2026-09-08', 'meet', 'hard'),
  event('여자친구 500일', '2026-09-13', '2026-09-13', 'anniv', 'hard'),
  event('가족 속초 여행', '2026-09-24', '2026-09-26', 'trip', 'none'),
  event('제주도 여행', '2026-09-29', '2026-10-01', 'trip', 'none'),
];
