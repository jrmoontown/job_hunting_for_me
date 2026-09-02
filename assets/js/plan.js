/**
 * 작성 계획 — 개인 일정(못 쓰는 날)과 공고 마감을 겹쳐 보고
 * "실제로 언제까지 써야 하는지"를 계산한다.
 *
 * 규칙
 * - 마감일이 '작성 불가' 기간이면: 마감 전 마지막으로 쓸 수 있는 날이 작성 기한 (kind: 'none')
 * - 마감일이 '작성 어려움' 날이면: 마감 전 3일(없으면 7일) 중 가장 여유 있는 날에 미리 쓰기를 권함 (kind: 'hard')
 * - 원래 마감일은 건드리지 않고 계산 결과만 덧붙인다. 사용자가 원하면 "당기기"로 마감일 자체를 바꿀 수 있다.
 */
import { getJobs, getEvents, todayStr, subscribe, WEEKDAYS_KO } from './store.js';
import { isOpenStatus, AVAIL_RANK } from './seed.js';

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (t) => `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return ymd(new Date(y, m - 1, d + n));
}
export function dowOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}
/** "9/23 (수)" 형태 */
export function fmtShort(dateStr) {
  if (!dateStr) return '';
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d} (${WEEKDAYS_KO[dowOf(dateStr)]})`;
}

/* ------------------------------------------------------------------ */
/* 일정 조회                                                            */
/* ------------------------------------------------------------------ */
export function eventsOn(date, events = getEvents()) {
  return events
    .filter((e) => e.start && e.start <= date && date <= (e.end || e.start))
    .sort((a, b) => (AVAIL_RANK[b.avail] - AVAIL_RANK[a.avail]) || a.start.localeCompare(b.start));
}

/** 그날 지원서를 쓸 수 있는 정도 — 겹치는 일정 중 가장 나쁜 쪽이 이긴다 */
export function availabilityOf(date, events = getEvents()) {
  let worst = 'ok';
  for (const e of eventsOn(date, events)) {
    if (e.avail === 'none') return 'none';
    if (e.avail === 'hard') worst = 'hard';
  }
  return worst;
}

/* ------------------------------------------------------------------ */
/* 계획 계산 (데이터가 바뀔 때까지 캐시)                                  */
/* ------------------------------------------------------------------ */
let cache = null;
subscribe(() => { cache = null; });

export function getPlan() {
  if (!cache) cache = buildPlan();
  return cache;
}
export const planFor = (jobId) => getPlan().plans.get(jobId) || null;

function buildPlan() {
  const events = getEvents();
  const today = todayStr();
  const jobs = getJobs()
    .filter((j) => isOpenStatus(j.status) && j.deadline)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  const availCache = new Map();
  const avail = (d) => {
    if (!availCache.has(d)) availCache.set(d, availabilityOf(d, events));
    return availCache.get(d);
  };

  /** 날짜별 "그날 써야 하는" 공고 수 */
  const load = new Map();
  const inc = (d) => load.set(d, (load.get(d) || 0) + 1);

  // 1단계: 마감일에 쓸 수 있는 공고(또는 이미 지난 마감)는 그대로 그날 부하로
  const conflicted = [];
  for (const j of jobs) {
    if (j.deadline < today || avail(j.deadline) === 'ok') inc(j.deadline);
    else conflicted.push(j);
  }

  // 2단계: 겹치는 공고에 작성 기한 배정 (마감 빠른 순)
  const plans = new Map();
  for (const j of conflicted) {
    const kind = avail(j.deadline);
    const event = eventsOn(j.deadline, events)[0] || null;
    let writeBy = null;

    if (kind === 'none') {
      // 마감 전 마지막으로 쓸 수 있는 날. '어려움' 날은 피하되 대안이 없으면 허용
      let fallback = null;
      for (let k = 1; k <= 30; k++) {
        const d = addDays(j.deadline, -k);
        if (d < today) break;
        const a = avail(d);
        if (a === 'ok') { writeBy = d; break; }
        if (a === 'hard' && !fallback) fallback = d;
      }
      if (!writeBy) writeBy = fallback;
    } else {
      // 마감 전 3일(없으면 7일) 중 부하가 가장 적은 날, 같으면 마감에 가까운 날
      const pick = (span) => {
        let best = null; let bestLoad = Infinity;
        for (let k = 1; k <= span; k++) {
          const d = addDays(j.deadline, -k);
          if (d < today) break;
          if (avail(d) !== 'ok') continue;
          const l = load.get(d) || 0;
          if (l < bestLoad) { best = d; bestLoad = l; }
        }
        return best;
      };
      writeBy = pick(3) || pick(7);
    }

    if (writeBy) inc(writeBy);
    plans.set(j.id, { kind, event, writeBy, load: 0 });
  }
  // 최종 부하 반영 (나중에 배정된 공고까지 포함)
  for (const p of plans.values()) p.load = p.writeBy ? (load.get(p.writeBy) || 0) : 0;

  return { plans, load, avail, events };
}

/* ------------------------------------------------------------------ */
/* 현황 뷰용 집계                                                        */
/* ------------------------------------------------------------------ */

/** 겹치는 공고를 (종류, 마감일, 일정, 작성 기한) 단위로 묶는다 */
export function conflictGroups() {
  const { plans } = getPlan();
  const byId = new Map(getJobs().map((j) => [j.id, j]));
  const groups = new Map();
  for (const [id, p] of plans) {
    const j = byId.get(id);
    if (!j) continue;
    const key = `${p.kind}|${j.deadline}|${p.event?.id || ''}|${p.writeBy || ''}`;
    if (!groups.has(key)) {
      groups.set(key, { kind: p.kind, deadline: j.deadline, event: p.event, writeBy: p.writeBy, load: p.load, jobs: [] });
    }
    groups.get(key).jobs.push(j);
  }
  const list = [...groups.values()].sort((a, b) => a.deadline.localeCompare(b.deadline));
  return { none: list.filter((g) => g.kind === 'none'), hard: list.filter((g) => g.kind === 'hard'), total: plans.size };
}

const levelOf = (total, writable) => {
  if (total === 0) return { key: 'blue', label: '여유' };
  const ratio = total / Math.max(1, writable);
  if (ratio >= 2) return { key: 'red', label: '과부하' };
  if (ratio >= 1) return { key: 'amber', label: '주의' };
  return { key: 'blue', label: '여유' };
};

/** 이번 주부터 n주간, 하루 단위 부하와 가용성 */
export function weeklyLoad(weeks = 5) {
  const { load, avail } = getPlan();
  const today = todayStr();
  let start = addDays(today, -dowOf(today));
  const out = [];
  for (let w = 0; w < weeks; w++) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      days.push({ date, past: date < today, avail: avail(date), count: load.get(date) || 0 });
    }
    const active = days.filter((x) => !x.past);
    const writable = active.filter((x) => x.avail !== 'none').length;
    const total = active.reduce((s, x) => s + x.count, 0);
    out.push({ start, end: addDays(start, 6), days, writable, total, level: levelOf(total, writable), current: w === 0 });
    start = addDays(start, 7);
  }
  return out;
}

/** 이번 달 남은 기간 요약 */
export function monthSummary() {
  const { avail, plans } = getPlan();
  const today = todayStr();
  const [y, m] = today.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${y}-${pad(m)}-${pad(lastDay)}`;

  let freeEvenings = 0;
  for (let d = today; d <= monthEnd; d = addDays(d, 1)) if (avail(d) === 'ok') freeEvenings += 1;

  const remaining = getJobs().filter((j) => isOpenStatus(j.status) && j.deadline >= today && j.deadline <= monthEnd).length;
  return { freeEvenings, remaining, conflicts: plans.size, monthLabel: `${m}월` };
}
