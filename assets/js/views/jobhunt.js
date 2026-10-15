/**
 * 취준 — 공고 · 전형 · 현황을 한 탭 아래 세그먼트로 묶는다.
 */
import { renderJobs } from './jobs.js';
import { renderPipeline, overdueResultCount } from './pipeline.js';
import { renderDashboard } from './dashboard.js';
import { getJobs, ddayOf } from '../store.js';
import { isOpenStatus } from '../seed.js';

export const JOBHUNT_SUBS = ['jobs', 'pipeline', 'dashboard'];
const LABELS = { jobs: '공고', pipeline: '전형', dashboard: '현황' };
let last = 'jobs';
export const lastJobhuntSub = () => last;

const urgent = () => getJobs().filter((j) => isOpenStatus(j.status) && (() => { const d = ddayOf(j.deadline); return d !== null && d >= 0 && d <= 3; })()).length;

export function renderJobhunt(root, { sub, goTo }) {
  last = JOBHUNT_SUBS.includes(sub) ? sub : last;
  const badges = { jobs: urgent(), pipeline: overdueResultCount(), dashboard: 0 };
  root.innerHTML = `
    <div class="segmented" role="tablist" aria-label="취준 메뉴">
      ${JOBHUNT_SUBS.map((k) => `
        <a class="segmented__item" role="tab" href="#/${k}" aria-selected="${k === last}">
          ${LABELS[k]}${badges[k] ? `<span class="segmented__badge">${badges[k]}</span>` : ''}
        </a>`).join('')}
    </div>
    <div id="jobhuntBody"></div>`;
  const body = root.querySelector('#jobhuntBody');
  if (last === 'jobs') renderJobs(body);
  else if (last === 'pipeline') renderPipeline(body);
  else renderDashboard(body, { goTo });
}
