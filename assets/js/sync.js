/**
 * GitHub Gist 동기화.
 * - 비공개 Gist 하나를 데이터 파일(jobhunt-data.json) 저장소로 사용
 * - 흐름: pull → 항목별 병합(mergeSnapshot) → push
 * - 토큰은 이 브라우저의 localStorage에만 저장되고 GitHub API 외에는 어디에도 전송되지 않는다
 */
import { getSettings, persistSettings, serialize, mergeSnapshot } from './store.js';
import { buildStatusMarkdown } from './status.js';

const API = 'https://api.github.com';
const FILENAME = 'jobhunt-data.json';
/** 사람이 읽는 현황 요약 — Claude 프로젝트 등에서 링크로 읽는 용도 */
export const STATUS_FILE = 'status.md';

/** Gist에 올릴 파일 묶음: 데이터(JSON) + 현황 요약(MD) */
const filesPayload = () => ({
  [FILENAME]: { content: JSON.stringify(serialize(), null, 2) },
  [STATUS_FILE]: { content: buildStatusMarkdown() },
});

/** Gist 응답에서 소유자 로그인을 기억해 둔다 (raw 링크 만들 때 필요) */
function rememberOwner(g) {
  const login = g?.owner?.login;
  if (login && getSettings().gistOwner !== login) {
    getSettings().gistOwner = login;
    persistSettings();
  }
}

/** Gist raw 링크 — 항상 최신 버전을 가리키지만, robots.txt 때문에 Claude 웹 가져오기가 읽지 못한다 */
export function statusUrl() {
  const { gistId, gistOwner } = getSettings();
  return gistId && gistOwner ? `https://gist.githubusercontent.com/${gistOwner}/${gistId}/raw/${STATUS_FILE}` : '';
}

/** 사이트에 올라가는 현황 요약 경로 키 — 배포 워크플로와 같은 방식(sha256(gistId) 앞 16자리) */
export async function statusKey() {
  const { gistId } = getSettings();
  if (!gistId || !globalThis.crypto?.subtle) return '';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(gistId));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/** Claude 프로젝트에 붙여 넣을 링크 — 우리 사이트(GitHub Pages)에 20분마다 복사되는 status.md */
export async function pagesStatusUrl() {
  const key = await statusKey();
  return key ? new URL(`s/${key}.md`, location.href.split('#')[0]).href : '';
}

/** 이 사이트가 올라간 GitHub 저장소 주소 (Pages 주소에서 추정, 아니면 빈 값) */
export function repoUrl() {
  const m = location.hostname.match(/^([^.]+)\.github\.io$/);
  const repo = location.pathname.split('/').filter(Boolean)[0];
  return m && repo ? `https://github.com/${m[1]}/${repo}` : '';
}
const GIST_DESC = '취준 대시보드 데이터 (자동 동기화)';

const listeners = new Set();
export const onSyncState = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

let syncState = { status: 'idle', message: '' }; // idle | off | syncing | ok | error
const setState = (status, message = '') => {
  syncState = { status, message };
  listeners.forEach((fn) => fn(syncState));
};
export const getSyncState = () => syncState;

export const isConfigured = () => Boolean(getSettings().gistToken);

const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
});

async function api(path, { method = 'GET', body } = {}) {
  const { gistToken } = getSettings();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: headers(gistToken),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new Error('토큰이 유효하지 않아요. 설정에서 다시 등록해 주세요.');
  if (res.status === 403 || res.status === 429) throw new Error('GitHub 요청 한도에 걸렸어요. 잠시 후 다시 시도해 주세요.');
  if (res.status === 404) { const e = new Error('NOT_FOUND'); e.code = 404; throw e; }
  if (!res.ok) throw new Error(`GitHub 오류 (${res.status})`);
  return res.status === 204 ? null : res.json();
}

/** 같은 계정의 다른 기기가 이미 만든 데이터 Gist가 있으면 찾아서 재사용 */
async function findExistingGist() {
  const gists = await api('/gists?per_page=100');
  const hit = (gists || []).find((g) => g.files && g.files[FILENAME]);
  return hit ? hit.id : '';
}

async function createGist() {
  const g = await api('/gists', {
    method: 'POST',
    body: { description: GIST_DESC, public: false, files: filesPayload() },
  });
  rememberOwner(g);
  return g.id;
}

async function readGist(gistId) {
  const g = await api(`/gists/${gistId}`);
  rememberOwner(g);
  const file = g.files && g.files[FILENAME];
  if (!file) return null;
  let content = file.content;
  if (file.truncated && file.raw_url) {
    content = await (await fetch(file.raw_url)).text();
  }
  try { return JSON.parse(content); } catch { return null; }
}

async function writeGist(gistId) {
  const g = await api(`/gists/${gistId}`, { method: 'PATCH', body: { files: filesPayload() } });
  rememberOwner(g);
}

/** 토큰 등록 직후 초기 연결: 기존 Gist 탐색 → 없으면 생성 */
export async function connect(token) {
  const settings = getSettings();
  settings.gistToken = token.trim();
  persistSettings();
  setState('syncing', '연결 중…');
  try {
    let gistId = settings.gistId || await findExistingGist();
    let pulled = false;
    if (gistId) {
      const remote = await readGist(gistId);
      if (remote) { mergeSnapshot(remote); pulled = true; }
      await writeGist(gistId);
    } else {
      gistId = await createGist();
    }
    settings.gistId = gistId;
    settings.lastSyncAt = new Date().toISOString();
    persistSettings();
    setState('ok', '동기화 완료');
    return { gistId, pulled };
  } catch (err) {
    settings.gistToken = '';
    persistSettings();
    setState('error', err.message);
    throw err;
  }
}

let syncing = false;
let queued = false;

/** pull → merge → push. 동시에 여러 번 불리면 한 번 더만 이어서 실행 */
export async function syncNow({ silent = false } = {}) {
  const settings = getSettings();
  if (!settings.gistToken) { setState('off'); return false; }
  if (syncing) { queued = true; return false; }
  syncing = true;
  if (!silent) setState('syncing', '동기화 중…');
  try {
    let gistId = settings.gistId;
    if (!gistId) {
      gistId = await findExistingGist() || await createGist();
      settings.gistId = gistId;
      persistSettings();
    }
    let remote = null;
    try {
      remote = await readGist(gistId);
    } catch (err) {
      if (err.code === 404) {
        // Gist가 지워졌으면 새로 만든다
        settings.gistId = await createGist();
        persistSettings();
        remote = null;
      } else throw err;
    }
    if (remote) mergeSnapshot(remote);
    await writeGist(settings.gistId);
    settings.lastSyncAt = new Date().toISOString();
    persistSettings();
    setState('ok');
    return true;
  } catch (err) {
    setState('error', err.message || '동기화 실패');
    return false;
  } finally {
    syncing = false;
    if (queued) { queued = false; syncNow({ silent: true }); }
  }
}

export function disconnect() {
  const settings = getSettings();
  settings.gistToken = '';
  settings.gistId = '';
  settings.lastSyncAt = '';
  persistSettings();
  setState('off');
}

/** 데이터 변경 시 잦은 push를 묶어서 보내는 디바운스 동기화 */
let debounceTimer = 0;
export function scheduleSync() {
  const settings = getSettings();
  if (!settings.gistToken || !settings.autoSync) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => syncNow({ silent: true }), 2500);
}
