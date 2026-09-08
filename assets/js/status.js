/**
 * 현황 요약 마크다운 — Gist에 status.md 로 함께 저장한다.
 * Claude 프로젝트 등 외부에서 링크 하나로 최신 취준 현황을 읽을 수 있게 하는 용도.
 */
import { getJobs, getTodos, getEvents, todayStr, ddayOf, fmtDate } from './store.js';
import { STATUSES, STATUS_ORDER, EVENT_KINDS, AVAIL, isOpenStatus } from './seed.js';
import { getPlan, conflictGroups, monthSummary, fmtShort } from './plan.js';

const line = (s) => s.replace(/\s+/g, ' ').trim();

export function buildStatusMarkdown() {
  const today = todayStr();
  const jobs = getJobs();
  const todos = getTodos();
  const events = getEvents().slice().sort((a, b) => a.start.localeCompare(b.start));
  const { plans } = getPlan();
  const month = monthSummary();
  const conflicts = conflictGroups();

  const open = jobs.filter((j) => isOpenStatus(j.status)).sort((a, b) =>
    (a.deadline || '9999').localeCompare(b.deadline || '9999') || (b.important - a.important) || a.company.localeCompare(b.company, 'ko'));
  const done = jobs.filter((j) => !isOpenStatus(j.status)).sort((a, b) =>
    (b.appliedAt || b.deadline || '').localeCompare(a.appliedAt || a.deadline || ''));
  const dd = (j) => ddayOf(j.deadline);
  const thisWeek = open.filter((j) => { const d = dd(j); return d !== null && d >= 0 && d <= 6; });
  const urgent = open.filter((j) => { const d = dd(j); return d !== null && d >= 0 && d <= 3; });
  const overdue = open.filter((j) => { const d = dd(j); return d !== null && d < 0; });
  const counts = STATUS_ORDER.map((k) => `${STATUSES[k].label} ${jobs.filter((j) => j.status === k).length}`).join(' · ');

  const out = [];
  out.push(`# 취준 현황 (${fmtDate(today, { withYear: true })} 기준)`);
  out.push('');
  out.push('> 취준 대시보드 앱이 자동으로 만든 파일입니다. 앱에서 내용을 바꾸면 잠시 후 이 파일도 갱신됩니다.');
  out.push('> 날짜는 모두 "내 마감일"(보통 실제 마감 하루 전에 스스로 정한 제출 목표일)입니다.');
  out.push('');

  out.push('## 요약');
  out.push(`- 지원 예정 ${open.length}건 · 이번 주 마감 ${thisWeek.length}건 · 3일 내 마감 ${urgent.length}건${overdue.length ? ` · 기한 지남 ${overdue.length}건` : ''}`);
  out.push(`- 전형 현황: ${counts}`);
  out.push(`- ${month.monthLabel} 남은 마감 ${month.remaining}건, 개인 일정을 뺀 쓸 수 있는 저녁 ${month.freeEvenings}일, 일정과 겹쳐 조정 필요 ${month.conflicts}건`);
  out.push('');

  if (conflicts.total) {
    out.push('## 개인 일정과 겹치는 마감 (작성 기한 제안)');
    const row = (g) => {
      const who = g.jobs.map((j) => j.company).join(', ');
      const ev = g.event ? `'${g.event.title}'` : '개인 일정';
      const to = g.writeBy ? (g.kind === 'none' ? `→ ${fmtShort(g.writeBy)}까지 쓰기` : `→ ${fmtShort(g.writeBy)}에 미리 쓰기`) : '→ 마감 전에 쓸 수 있는 날이 없음';
      const load = g.writeBy && g.load >= 3 ? ` (그날 ${g.load}건 몰림)` : '';
      return `- ${who} — ${fmtShort(g.deadline)} 마감이 ${ev} ${g.kind === 'none' ? '기간(작성 불가)' : '날(작성 어려움)'} ${to}${load}`;
    };
    conflicts.none.forEach((g) => out.push(row(g)));
    conflicts.hard.forEach((g) => out.push(row(g)));
    out.push('');
  }

  out.push('## 지원 예정 (마감일 순)');
  if (!open.length) out.push('- 없음');
  let lastDate = null;
  for (const j of open) {
    const key = j.deadline || '날짜 미정';
    if (key !== lastDate) {
      const d = j.deadline ? dd(j) : null;
      const dLabel = d === null ? '' : d === 0 ? ' · D-DAY' : d > 0 ? ` · D-${d}` : ` · 기한 ${-d}일 지남`;
      out.push('');
      out.push(`### ${j.deadline ? fmtShort(j.deadline) : '날짜 미정'}${dLabel}`);
      lastDate = key;
    }
    const p = plans.get(j.id);
    const bits = [];
    if (j.important) bits.push('⭐ 중요');
    if (j.position) bits.push(j.position);
    if (j.realDeadline) bits.push(`실제 마감 ${fmtShort(j.realDeadline)}`);
    if (p?.writeBy) bits.push(p.kind === 'none' ? `${fmtShort(p.writeBy)}까지 쓰기` : `${fmtShort(p.writeBy)}에 미리 쓰기`);
    if (j.url) bits.push(`[공고 링크](${j.url})`);
    if (j.memo) bits.push(`메모: ${line(j.memo)}`);
    out.push(`- **${j.company}**${bits.length ? ` — ${bits.join(' · ')}` : ''}`);
  }
  out.push('');

  out.push('## 개인 일정 (지원서를 쓰기 어려운 날)');
  if (!events.length) out.push('- 없음');
  for (const e of events) {
    const end = e.end || e.start;
    const range = end === e.start ? fmtShort(e.start) : `${fmtShort(e.start)} – ${fmtShort(end)}`;
    const av = AVAIL[e.avail]?.label || e.avail;
    out.push(`- ${range} ${e.title} · ${EVENT_KINDS[e.kind] || e.kind} · 작성 ${av}${e.memo ? ` · ${line(e.memo)}` : ''}`);
  }
  out.push('');

  out.push('## 할 일');
  if (!todos.length) out.push('- 없음');
  const byId = new Map(jobs.map((j) => [j.id, j]));
  todos.slice().sort((a, b) => a.done - b.done || (a.dueDate || '9999').localeCompare(b.dueDate || '9999')).forEach((t) => {
    const bits = [];
    if (t.dueDate) bits.push(`${fmtShort(t.dueDate)}까지`);
    if (t.jobId && byId.get(t.jobId)) bits.push(`관련 공고: ${byId.get(t.jobId).company}`);
    if (t.url) bits.push(`[링크](${t.url})`);
    out.push(`- [${t.done ? 'x' : ' '}] ${t.text}${bits.length ? ` (${bits.join(' · ')})` : ''}`);
  });
  out.push('');

  out.push('## 지원 완료 · 결과');
  if (!done.length) out.push('- 없음');
  for (const j of done) {
    const st = STATUSES[j.status]?.label || j.status;
    const bits = [st];
    if (j.position) bits.push(j.position);
    if (j.memo) bits.push(line(j.memo));
    out.push(`- ${j.appliedAt ? fmtShort(j.appliedAt) : ''} ${j.company} — ${bits.join(' · ')}`.trim());
  }
  out.push('');

  return out.join('\n');
}
