/**
 * 앱 상태 저장소.
 * - localStorage 를 1차 저장소로 사용 (오프라인 우선)
 * - Gist 동기화(sync.js)가 pull/merge/push 할 때 이 모듈의 직렬화를 사용
 * - 모든 변경은 updatedAt 갱신 → 기기 간 병합 시 최신 수정이 이긴다
 */
import { SEED_JOBS, SEED_TODOS, SEED_VERSION } from './seed.js';

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
  /** 삭제 이력(tombstone) — 다른 기기에서 병합할 때 부활을 막는다 */
  deleted: {}, // { [id]: deletedAtISO }
  meta: { updatedAt: '', seedVersion: 0 },
};

const settings = {
  theme: 'auto',            // 'auto' | 'light' | 'dark'
  gistToken: '',
  gistId: '',
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
      jobs: state.jobs, todos: state.todos, deleted: state.deleted, meta: state.meta,
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
    state.deleted = raw.deleted && typeof raw.deleted === 'object' ? raw.deleted : {};
    state.meta = raw.meta || { updatedAt: now(), seedVersion: SEED_VERSION };
  } else {
    // 최초 실행 → 시드 데이터 주입
    state.jobs = structuredClone(SEED_JOBS);
    state.todos = structuredClone(SEED_TODOS);
    state.deleted = {};
    state.meta = { updatedAt: now(), seedVersion: SEED_VERSION };
    persist();
  }
}

/* ------------------------------------------------------------------ */
/* 조회                                                                */
/* ------------------------------------------------------------------ */
export const getJobs = () => state.jobs;
export const getTodos = () => state.todos;
export const getJob = (id) => state.jobs.find((j) => j.id === id);
export const getTodo = (id) => state.todos.find((t) => t.id === id);
export const getSettings = () => settings;

/* ------------------------------------------------------------------ */
/* 공고 CRUD                                                           */
/* ------------------------------------------------------------------ */
export function addJob(data) {
  const job = {
    id: uid(),
    company: '', position: '', deadline: '', realDeadline: '',
    important: false, status: 'planned', url: '', memo: '', appliedAt: '',
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
  const patch = { status };
  // 지원 완료류 상태로 넘어가는데 지원일이 비어 있으면 오늘로 기록
  const job = getJob(id);
  if (job && status !== 'planned' && !job.appliedAt) {
    patch.appliedAt = new Date().toISOString().slice(0, 10);
  }
  if (status === 'planned') patch.appliedAt = '';
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
/* 내보내기 / 가져오기 / 병합                                            */
/* ------------------------------------------------------------------ */
export function serialize() {
  return {
    app: 'jobhunt-dashboard',
    version: 1,
    exportedAt: now(),
    jobs: state.jobs,
    todos: state.todos,
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
  persist(); emit('all');
}

/** 가져오기(파일) — 병합이 아니라 통째로 교체 */
export function replaceAll(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.jobs)) throw new Error('형식이 올바르지 않은 데이터예요.');
  state.jobs = snapshot.jobs;
  state.todos = Array.isArray(snapshot.todos) ? snapshot.todos : [];
  state.deleted = snapshot.deleted && typeof snapshot.deleted === 'object' ? snapshot.deleted : {};
  persist(); emit('all');
}

export function resetAll() {
  state.jobs = structuredClone(SEED_JOBS);
  state.todos = structuredClone(SEED_TODOS);
  state.deleted = {};
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
