/**
 * 앱 상태 저장소.
 * - localStorage 를 1차 저장소로 사용 (오프라인 우선)
 * - Gist 동기화(sync.js)가 pull/merge/push 할 때 이 모듈의 직렬화를 사용
 * - 모든 변경은 updatedAt 갱신 → 기기 간 병합 시 최신 수정이 이긴다
 */
import { SEED_JOBS, SEED_TODOS, SEED_TODOS_V5, SEED_TODOS_V6, SEED_EVENTS, SEED_EVENTS_V6, SEED_EVENTS_V7, SEED_TODOS_V7, REMOVED_EVENTS_V7, TODO_DATES_V8, SEED_STUDIES, SEED_SESSIONS, SEED_VERSION } from './seed.js';

const LS_KEY = 'jobhunt.data.v1';
const LS_SETTINGS = 'jobhunt.settings.v1';

const now = () => new Date().toISOString();
const uid = () => `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/* ------------------------------------------------------------------ */
/* 상태                                                                */
/* ------------------------------------------------------------------ */
const state = {
  jobs: [],
  todos: [],
  /** 개인 일정 — 지원서를 쓰기 어려운 날 (여행, 약속, 기념일 …) */
  events: [],
  /** 자격증 공부 — 교재/과정 (파트 목록 포함) */
  studies: [],
  /** 공부 일정 — 어느 날 어느 파트를 풀지 */
  sessions: [],
  /** 삭제 이력(tombstone) — 다른 기기에서 병합할 때 부활을 막는다 */
  deleted: {}, // { [id]: deletedAtISO }
  meta: { updatedAt: '', seedVersion: 0 },
};

const settings = {
  theme: 'auto',            // 'auto' | 'light' | 'dark'
  gistToken: '',
  gistId: '',
  gistOwner: '',
  autoSync: true,
  lastSyncAt: '',
};

/* ------------------------------------------------------------------ */
/* 구독                                                                */
/* ------------------------------------------------------------------ */
const listeners = new Set();
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = (type) => listeners.forEach((fn) => fn(type));

/* ------------------------------------------------------------------ */
/* 저장 / 로드                                                          */
/* ------------------------------------------------------------------ */
function persist() {
  state.meta.updatedAt = now();
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      jobs: state.jobs, todos: state.todos, events: state.events,
      studies: state.studies, sessions: state.sessions, deleted: state.deleted, meta: state.meta,
    }));
  } catch { /* 시크릿 모드 등에서 저장 실패해도 앱은 동작해야 한다 */ }
}

export function persistSettings() {
  try { localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)); } catch { /* noop */ }
}

export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_SETTINGS) || 'null');
    if (s && typeof s === 'object') Object.assign(settings, s);
  } catch { /* noop */ }

  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { /* noop */ }

  if (raw && Array.isArray(raw.jobs)) {
    state.jobs = raw.jobs;
    state.todos = Array.isArray(raw.todos) ? raw.todos : [];
    state.events = Array.isArray(raw.events) ? raw.events : [];
    state.studies = Array.isArray(raw.studies) ? raw.studies : [];
    state.sessions = Array.isArray(raw.sessions) ? raw.sessions : [];
    state.deleted = raw.deleted && typeof raw.deleted === 'object' ? raw.deleted : {};
    state.meta = raw.meta || { updatedAt: now(), seedVersion: 0 };
    state.jobs.forEach(normalizeJob);
    migrate();
  } else {
    // 최초 실행 → 시드 데이터 주입
    state.jobs = structuredClone(SEED_JOBS);
    state.todos = structuredClone(SEED_TODOS);
    state.events = structuredClone(SEED_EVENTS);
    state.studies = structuredClone(SEED_STUDIES);
    state.todos.push(...structuredClone(SEED_TODOS_V5), ...structuredClone(SEED_TODOS_V6));
    state.sessions = structuredClone(SEED_SESSIONS);
    state.events.push(...structuredClone(SEED_EVENTS_V6), ...structuredClone(SEED_EVENTS_V7));
    state.todos.push(...structuredClone(SEED_TODOS_V7));
    state.deleted = {};
    state.meta = { updatedAt: now(), seedVersion: SEED_VERSION };
    state.jobs.forEach(normalizeJob);
    persist();
  }
}

/** 예전 데이터에 전형 필드가 없으면 채워 넣는다 (발표 예정일 · 면접일 · 전형 기록) */
function normalizeJob(j) {
  if (j.resultDate === undefined) j.resultDate = '';
  if (j.interviewDate === undefined) j.interviewDate = '';
  if (!Array.isArray(j.history)) {
    j.history = [];
    if (j.status && j.status !== 'planned') {
      const applied = j.appliedAt || (j.updatedAt || '').slice(0, 10) || todayStr();
      j.history.push({ status: 'applied', at: applied });
      if (j.status !== 'applied') j.history.push({ status: j.status, at: (j.updatedAt || '').slice(0, 10) || applied });
    }
  }
}

/** 이미 쓰고 있던 기기에 새로 추가된 시드를 한 번만 넣어준다 */
function migrate() {
  const ver = state.meta.seedVersion || 0;
  if (ver >= SEED_VERSION) return;
  const addMissing = (list, seeds) => {
    const have = new Set(list.map((x) => x.id));
    seeds.forEach((x) => { if (!have.has(x.id) && !state.deleted[x.id]) list.push(structuredClone(x)); });
  };
  if (ver < 4) addMissing(state.events, SEED_EVENTS);        // v4: 개인 일정 도입
  if (ver < 5) {                                              // v5: 자격증 공부 도입
    addMissing(state.studies, SEED_STUDIES);
    addMissing(state.todos, SEED_TODOS_V5);
  }
  if (ver < 6) {                                              // v6: AICE 목차 묶음 + 일정 + 공부 못 하는 날
    const seed = SEED_STUDIES[0];
    const st = state.studies.find((s) => s.id === seed.id);
    const hasOwnSessions = state.sessions.some((s) => s.studyId === seed.id);
    if (st && !st.units.length && !hasOwnSessions) {
      // 사용자가 아직 파트를 안 만들었으면 목차 묶음과 일정을 채워 넣는다
      Object.assign(st, { title: seed.title, exam: seed.exam, examDate: st.examDate || seed.examDate, memo: st.memo || seed.memo, units: structuredClone(seed.units), updatedAt: now() });
      addMissing(state.sessions, SEED_SESSIONS);
    }
    addMissing(state.events, SEED_EVENTS_V6);
    addMissing(state.todos, SEED_TODOS_V6);
  }
  if (ver < 7) {                                              // v7: 공부 못 하는 날 표시 제거 + 일정·할 일 추가
    REMOVED_EVENTS_V7.forEach((id) => { state.deleted[id] = now(); });
    state.events = state.events.filter((e) => !REMOVED_EVENTS_V7.includes(e.id));
    addMissing(state.events, SEED_EVENTS_V7);
    addMissing(state.todos, SEED_TODOS_V7);
  }
  if (ver < 8) {                                              // v8: 날짜 하루 밀기 + AICE 일정 10/19부터 다시
    const SEEDED_AT = '2026-10-15T09:00:00.000Z';
    state.todos.forEach((t) => {
      if (TODO_DATES_V8[t.id] && t.updatedAt === SEEDED_AT && !t.done) { t.dueDate = TODO_DATES_V8[t.id]; t.updatedAt = now(); }
    });
    // 이전 계획(seed-aice-s*) 중 안 한 것은 지우고, 이미 끝낸 파트는 새 계획에서 뺀다
    const old = state.sessions.filter((x) => x.id.startsWith('seed-aice-s'));
    if (old.length) {
      const doneUnits = new Set(old.filter((x) => x.done).flatMap((x) => x.unitIds));
      old.filter((x) => !x.done).forEach((x) => { state.deleted[x.id] = now(); });
      state.sessions = state.sessions.filter((x) => !(x.id.startsWith('seed-aice-s') && !x.done));
      const fresh = SEED_SESSIONS.map((x) => ({ ...structuredClone(x), unitIds: x.unitIds.filter((u) => !doneUnits.has(u)) })).filter((x) => x.unitIds.length);
      addMissing(state.sessions, fresh);
    }
  }
  state.meta.seedVersion = SEED_VERSION;
  persist();
}

/* ------------------------------------------------------------------ */
/* 조회                                                                */
/* ------------------------------------------------------------------ */
export const getJobs = () => state.jobs;
export const getTodos = () => state.todos;
export const getEvents = () => state.events;
export const getJob = (id) => state.jobs.find((j) => j.id === id);
export const getTodo = (id) => state.todos.find((t) => t.id === id);
export const getEvent = (id) => state.events.find((e) => e.id === id);
export const getStudies = () => state.studies;
export const getStudy = (id) => state.studies.find((s) => s.id === id);
export const getSessions = () => state.sessions;
export const getSession = (id) => state.sessions.find((s) => s.id === id);
export const getSettings = () => settings;

/* ------------------------------------------------------------------ */
/* 공고 CRUD                                                           */
/* ------------------------------------------------------------------ */
export function addJob(data) {
  const job = {
    id: uid(),
    company: '', position: '', deadline: '', realDeadline: '',
    important: false, status: 'planned', url: '', memo: '', appliedAt: '',
    resultDate: '', interviewDate: '', history: [],
    ...data,
    createdAt: now(), updatedAt: now(),
  };
  state.jobs.push(job);
  persist(); emit('jobs');
  return job;
}

export function updateJob(id, patch) {
  const job = getJob(id);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: now() });
  persist(); emit('jobs');
  return job;
}

export function setJobStatus(id, status) {
  const job = getJob(id);
  if (!job) return null;
  const today = todayStr();
  const patch = { status };
  if (status === 'planned') {
    // 다시 지원 예정으로 — 전형 기록도 비운다
    patch.appliedAt = '';
    patch.history = [];
    return updateJob(id, patch);
  }
  // 지원 완료류 상태로 넘어가는데 지원일이 비어 있으면 오늘로 기록
  if (!job.appliedAt) patch.appliedAt = today;
  const hist = Array.isArray(job.history) ? job.history.slice() : [];
  if (!hist.length && status !== 'applied') hist.push({ status: 'applied', at: patch.appliedAt || job.appliedAt });
  if (hist[hist.length - 1]?.status !== status) hist.push({ status, at: today });
  patch.history = hist;
  return updateJob(id, patch);
}

export const toggleImportant = (id) => {
  const job = getJob(id);
  return job ? updateJob(id, { important: !job.important }) : null;
};

export function deleteJob(id) {
  const i = state.jobs.findIndex((j) => j.id === id);
  if (i < 0) return;
  state.jobs.splice(i, 1);
  state.deleted[id] = now();
  // 연결된 투두의 링크 해제
  state.todos.forEach((t) => { if (t.jobId === id) { t.jobId = ''; t.updatedAt = now(); } });
  persist(); emit('jobs');
}

/* ------------------------------------------------------------------ */
/* 투두 CRUD                                                           */
/* ------------------------------------------------------------------ */
export function addTodo(data) {
  const item = {
    id: uid(), text: '', done: false, dueDate: '', jobId: '', url: '',
    ...data,
    createdAt: now(), updatedAt: now(),
  };
  state.todos.push(item);
  persist(); emit('todos');
  return item;
}

export function updateTodo(id, patch) {
  const item = getTodo(id);
  if (!item) return null;
  Object.assign(item, patch, { updatedAt: now() });
  persist(); emit('todos');
  return item;
}

export const toggleTodo = (id) => {
  const item = getTodo(id);
  return item ? updateTodo(id, { done: !item.done }) : null;
};

export function deleteTodo(id) {
  const i = state.todos.findIndex((t) => t.id === id);
  if (i < 0) return;
  state.todos.splice(i, 1);
  state.deleted[id] = now();
  persist(); emit('todos');
}

export function clearDoneTodos() {
  const gone = state.todos.filter((t) => t.done);
  gone.forEach((t) => { state.deleted[t.id] = now(); });
  state.todos = state.todos.filter((t) => !t.done);
  persist(); emit('todos');
  return gone.length;
}

/* ------------------------------------------------------------------ */
/* 개인 일정 CRUD                                                       */
/* ------------------------------------------------------------------ */
export function addEvent(data) {
  const item = {
    id: uid(), title: '', start: '', end: '', kind: 'other', avail: 'none', memo: '',
    ...data,
    createdAt: now(), updatedAt: now(),
  };
  if (!item.end || item.end < item.start) item.end = item.start;
  state.events.push(item);
  persist(); emit('events');
  return item;
}

export function updateEvent(id, patch) {
  const item = getEvent(id);
  if (!item) return null;
  Object.assign(item, patch, { updatedAt: now() });
  if (!item.end || item.end < item.start) item.end = item.start;
  persist(); emit('events');
  return item;
}

export function deleteEvent(id) {
  const i = state.events.findIndex((e) => e.id === id);
  if (i < 0) return;
  state.events.splice(i, 1);
  state.deleted[id] = now();
  persist(); emit('events');
}

/* ------------------------------------------------------------------ */
/* 자격증 공부 CRUD                                                     */
/* ------------------------------------------------------------------ */
export function addStudy(data) {
  const item = {
    id: uid(), title: '', exam: '', examDate: '', color: 'green', memo: '', units: [],
    ...data,
    createdAt: now(), updatedAt: now(),
  };
  item.units = (item.units || []).map((u) => ({ id: u.id || uid(), name: u.name, done: Boolean(u.done), doneAt: u.doneAt || '' }));
  state.studies.push(item);
  persist(); emit('studies');
  return item;
}

export function updateStudy(id, patch) {
  const item = getStudy(id);
  if (!item) return null;
  Object.assign(item, patch, { updatedAt: now() });
  if (patch.units) item.units = patch.units.map((u) => ({ id: u.id || uid(), name: u.name, done: Boolean(u.done), doneAt: u.doneAt || '' }));
  persist(); emit('studies');
  return item;
}

export function deleteStudy(id) {
  const i = state.studies.findIndex((s) => s.id === id);
  if (i < 0) return;
  state.studies.splice(i, 1);
  state.deleted[id] = now();
  // 딸린 공부 일정도 함께 지운다
  state.sessions.filter((s) => s.studyId === id).forEach((s) => { state.deleted[s.id] = now(); });
  state.sessions = state.sessions.filter((s) => s.studyId !== id);
  persist(); emit('studies');
}

/** 파트 완료 상태를 직접 토글 (일정 없이 푼 경우) */
export function toggleUnit(studyId, unitId) {
  const st = getStudy(studyId);
  const u = st?.units.find((x) => x.id === unitId);
  if (!u) return null;
  u.done = !u.done;
  u.doneAt = u.done ? todayStr() : '';
  st.updatedAt = now();
  persist(); emit('studies');
  return u;
}

export function addSessions(list) {
  const made = list.map((data) => ({
    id: uid(), studyId: '', date: '', unitIds: [], title: '', memo: '', done: false, doneAt: '',
    ...data,
    createdAt: now(), updatedAt: now(),
  }));
  state.sessions.push(...made);
  persist(); emit('sessions');
  return made;
}
export const addSession = (data) => addSessions([data])[0];

export function updateSession(id, patch) {
  const item = getSession(id);
  if (!item) return null;
  Object.assign(item, patch, { updatedAt: now() });
  persist(); emit('sessions');
  return item;
}

/** 공부 일정 완료 토글 — 그 일정의 파트들도 함께 완료/해제 */
export function toggleSession(id) {
  const s = getSession(id);
  if (!s) return null;
  s.done = !s.done;
  s.doneAt = s.done ? todayStr() : '';
  s.updatedAt = now();
  const st = getStudy(s.studyId);
  if (st) {
    st.units.forEach((u) => {
      if (s.unitIds.includes(u.id)) { u.done = s.done; u.doneAt = s.done ? s.doneAt : ''; }
    });
    st.updatedAt = now();
  }
  persist(); emit('sessions');
  return s;
}

export function deleteSession(id) {
  const i = state.sessions.findIndex((s) => s.id === id);
  if (i < 0) return;
  state.sessions.splice(i, 1);
  state.deleted[id] = now();
  persist(); emit('sessions');
}

/** 한 교재의 아직 안 한 미래 일정을 모두 지운다 (일정 다시 짤 때) */
export function clearPendingSessions(studyId, fromDate) {
  const gone = state.sessions.filter((s) => s.studyId === studyId && !s.done && s.date >= fromDate);
  gone.forEach((s) => { state.deleted[s.id] = now(); });
  state.sessions = state.sessions.filter((s) => !gone.includes(s));
  if (gone.length) { persist(); emit('sessions'); }
  return gone.length;
}

/* ------------------------------------------------------------------ */
/* 내보내기 / 가져오기 / 병합                                            */
/* ------------------------------------------------------------------ */
export function serialize() {
  return {
    app: 'jobhunt-dashboard',
    version: 3,
    exportedAt: now(),
    jobs: state.jobs,
    todos: state.todos,
    events: state.events,
    studies: state.studies,
    sessions: state.sessions,
    deleted: state.deleted,
    meta: state.meta,
  };
}

/** 다른 기기의 스냅샷과 병합. 항목별 updatedAt이 최신인 쪽이 이긴다. */
export function mergeSnapshot(remote) {
  if (!remote || !Array.isArray(remote.jobs)) throw new Error('형식이 올바르지 않은 데이터예요.');

  const remoteDeleted = remote.deleted && typeof remote.deleted === 'object' ? remote.deleted : {};
  // 삭제 이력 합치기
  for (const [id, at] of Object.entries(remoteDeleted)) {
    if (!state.deleted[id] || state.deleted[id] < at) state.deleted[id] = at;
  }

  const mergeList = (localList, remoteList) => {
    const map = new Map(localList.map((x) => [x.id, x]));
    for (const r of remoteList || []) {
      if (!r || !r.id) continue;
      const l = map.get(r.id);
      if (!l) map.set(r.id, r);
      else if ((r.updatedAt || '') > (l.updatedAt || '')) map.set(r.id, r);
    }
    // 삭제 이력이 항목의 마지막 수정보다 최신이면 제거
    return [...map.values()].filter((x) => {
      const del = state.deleted[x.id];
      return !(del && del >= (x.updatedAt || ''));
    });
  };

  state.jobs = mergeList(state.jobs, remote.jobs);
  state.todos = mergeList(state.todos, remote.todos);
  state.events = mergeList(state.events, remote.events);
  state.studies = mergeList(state.studies, remote.studies);
  state.sessions = mergeList(state.sessions, remote.sessions);
  persist(); emit('all');
}

/** 가져오기(파일) — 병합이 아니라 통째로 교체 */
export function replaceAll(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.jobs)) throw new Error('형식이 올바르지 않은 데이터예요.');
  state.jobs = snapshot.jobs;
  state.todos = Array.isArray(snapshot.todos) ? snapshot.todos : [];
  state.events = Array.isArray(snapshot.events) ? snapshot.events : [];
  state.studies = Array.isArray(snapshot.studies) ? snapshot.studies : [];
  state.sessions = Array.isArray(snapshot.sessions) ? snapshot.sessions : [];
  state.deleted = snapshot.deleted && typeof snapshot.deleted === 'object' ? snapshot.deleted : {};
  state.jobs.forEach(normalizeJob);
  persist(); emit('all');
}

export function resetAll() {
  state.jobs = structuredClone(SEED_JOBS);
  state.todos = [...structuredClone(SEED_TODOS), ...structuredClone(SEED_TODOS_V5), ...structuredClone(SEED_TODOS_V6)];
  state.events = structuredClone(SEED_EVENTS);
  state.studies = structuredClone(SEED_STUDIES);
  state.sessions = structuredClone(SEED_SESSIONS);
  state.events.push(...structuredClone(SEED_EVENTS_V6), ...structuredClone(SEED_EVENTS_V7));
  state.todos.push(...structuredClone(SEED_TODOS_V7));
  state.jobs.forEach(normalizeJob);
  state.deleted = {};
  state.meta.seedVersion = SEED_VERSION;
  persist(); emit('all');
}

/* ------------------------------------------------------------------ */
/* 날짜 유틸 — 여러 뷰에서 함께 사용                                      */
/* ------------------------------------------------------------------ */
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function ddayOf(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const t = new Date();
  const base = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((target - base) / 86400000);
}

export const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

export function fmtDate(dateStr, { withYear = false, withWeekday = true } = {}) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const wd = WEEKDAYS_KO[new Date(y, m - 1, d).getDay()];
  const base = withYear ? `${y}년 ${m}월 ${d}일` : `${m}월 ${d}일`;
  return withWeekday ? `${base} (${wd})` : base;
}

export function ddayLabel(dateStr) {
  const n = ddayOf(dateStr);
  if (n === null) return '';
  if (n === 0) return 'D-DAY';
  return n > 0 ? `D-${n}` : `D+${-n}`;
}
