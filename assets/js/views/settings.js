/**
 * 설정 뷰 — Gist 동기화, 데이터 백업/복원, 테마, 초기화.
 */
import { getSettings, persistSettings, serialize, replaceAll, resetAll } from '../store.js';
import { connect, disconnect, syncNow, isConfigured, getSyncState, pagesStatusUrl, repoUrl } from '../sync.js';
import { buildStatusMarkdown } from '../status.js';
import { esc, icons, openSheet, closeSheet, confirmSheet, toast } from '../ui.js';

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* 아래 폴백 */ }
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

/** Claude 프로젝트 지침에 붙여 넣을 문장 */
const projectInstruction = (url) => `내 취업 준비 현황은 아래 링크의 마크다운 파일에 있어. 취준·지원·일정 관련 질문을 받으면 먼저 웹 가져오기(fetch) 도구로 이 링크를 열어 읽고, 그 내용을 기준으로 답해 줘. 파일은 내 취준 대시보드 앱이 자동으로 갱신하니까 대화마다 다시 읽어 줘. 링크를 못 열면 추측하지 말고, 앱의 "설정 → 현황 복사"로 붙여 넣어 달라고 나에게 말해 줘.
${url}`;

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function renderSettings(root, { applyTheme }) {
  const settings = getSettings();
  const sync = getSyncState();
  const themeLabel = { auto: '시스템 설정', light: '라이트', dark: '다크' }[settings.theme] || '시스템 설정';
  const lastSync = settings.lastSyncAt
    ? new Date(settings.lastSyncAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '아직 없음';

  root.innerHTML = `
    <div class="settings-group">
      <p class="settings-group__title">기기 간 동기화</p>
      <div class="settings-list">
        ${isConfigured() ? `
        <div class="settings-row">
          <span class="settings-row__icon" style="background:var(--success-weak);color:var(--success)">${icons.cloud}</span>
          <div class="settings-row__text">
            <p class="settings-row__title">GitHub Gist 연결됨</p>
            <p class="settings-row__desc">마지막 동기화 · ${esc(lastSync)}${sync.status === 'error' ? ` · <span style="color:var(--danger)">${esc(sync.message)}</span>` : ''}</p>
          </div>
        </div>
        <button class="settings-row" data-act="sync-now">
          <span class="settings-row__icon">${icons.refresh}</span>
          <div class="settings-row__text">
            <p class="settings-row__title">지금 동기화</p>
            <p class="settings-row__desc">다른 기기의 변경 사항을 가져오고 이 기기 내용을 올려요</p>
          </div>
          <span class="settings-row__arrow">${icons.chevronRight}</span>
        </button>
        <div class="settings-row">
          <span class="settings-row__icon">${icons.upload}</span>
          <div class="settings-row__text">
            <p class="settings-row__title">자동 동기화</p>
            <p class="settings-row__desc">내용을 수정하면 잠시 후 자동으로 저장돼요</p>
          </div>
          <button class="switch" role="switch" aria-checked="${settings.autoSync}" data-act="auto-sync" aria-label="자동 동기화 토글"></button>
        </div>
        <button class="settings-row" data-act="share-claude">
          <span class="settings-row__icon" style="background:var(--violet-50);color:var(--violet-500)">${icons.link}</span>
          <div class="settings-row__text">
            <p class="settings-row__title">Claude 프로젝트에 현황 공유</p>
            <p class="settings-row__desc">앱이 만드는 현황 요약 링크를 프로젝트 지침에 넣어요</p>
          </div>
          <span class="settings-row__arrow">${icons.chevronRight}</span>
        </button>
        <button class="settings-row settings-row--danger" data-act="disconnect">
          <span class="settings-row__icon">${icons.cloudOff}</span>
          <div class="settings-row__text">
            <p class="settings-row__title">연결 해제</p>
            <p class="settings-row__desc">이 기기에서 토큰을 지워요 (Gist 데이터는 유지)</p>
          </div>
        </button>
        ` : `
        <button class="settings-row" data-act="connect">
          <span class="settings-row__icon" style="background:var(--primary-weak);color:var(--primary)">${icons.cloud}</span>
          <div class="settings-row__text">
            <p class="settings-row__title">GitHub Gist 연결하기</p>
            <p class="settings-row__desc">노트북 · 폰 어디서든 같은 데이터를 보게 돼요</p>
          </div>
          <span class="settings-row__arrow">${icons.chevronRight}</span>
        </button>`}
      </div>
    </div>

    <div class="settings-group">
      <p class="settings-group__title">화면</p>
      <div class="settings-list">
        <button class="settings-row" data-act="theme">
          <span class="settings-row__icon">${icons.moon}</span>
          <div class="settings-row__text">
            <p class="settings-row__title">테마</p>
            <p class="settings-row__desc">${themeLabel}</p>
          </div>
          <span class="settings-row__arrow">${icons.chevronRight}</span>
        </button>
      </div>
    </div>

    <div class="settings-group">
      <p class="settings-group__title">데이터</p>
      <div class="settings-list">
        <button class="settings-row" data-act="export">
          <span class="settings-row__icon">${icons.download}</span>
          <div class="settings-row__text">
            <p class="settings-row__title">JSON으로 내보내기</p>
            <p class="settings-row__desc">공고 · 할 일 전체를 파일로 백업해요</p>
          </div>
          <span class="settings-row__arrow">${icons.chevronRight}</span>
        </button>
        <button class="settings-row" data-act="import">
          <span class="settings-row__icon">${icons.upload}</span>
          <div class="settings-row__text">
            <p class="settings-row__title">JSON 가져오기</p>
            <p class="settings-row__desc">백업 파일로 현재 데이터를 교체해요</p>
          </div>
          <span class="settings-row__arrow">${icons.chevronRight}</span>
        </button>
        <button class="settings-row settings-row--danger" data-act="reset">
          <span class="settings-row__icon">${icons.trash}</span>
          <div class="settings-row__text">
            <p class="settings-row__title">데이터 초기화</p>
            <p class="settings-row__desc">처음 담아둔 공고 목록으로 되돌려요</p>
          </div>
        </button>
      </div>
    </div>

    <div class="settings-group">
      <p class="settings-group__title">모바일에서 쓰기</p>
      <div class="settings-list">
        <div class="settings-row">
          <span class="settings-row__icon">${icons.info}</span>
          <div class="settings-row__text">
            <p class="settings-row__title">홈 화면에 추가하면 앱처럼 쓸 수 있어요</p>
            <p class="settings-row__desc">iPhone: 공유 → 홈 화면에 추가 · Android: 메뉴 → 앱 설치</p>
          </div>
        </div>
      </div>
    </div>

    <input type="file" id="importFile" accept="application/json,.json" hidden />
  `;

  /* ---------------- Gist 연결 ---------------- */
  root.querySelector('[data-act="connect"]')?.addEventListener('click', () => {
    const sheet = openSheet({
      title: 'GitHub Gist 연결',
      desc: '토큰 하나로 모든 기기의 데이터가 하나로 합쳐져요',
      body: `
        <div class="callout" style="margin-bottom:16px">
          ${icons.key}
          <div>
            <strong>준비물: GitHub 토큰 (1분 소요)</strong><br/>
            1. <a href="https://github.com/settings/tokens/new?scopes=gist&description=jobhunt-dashboard" target="_blank" rel="noopener noreferrer">github.com/settings/tokens/new ↗</a> 접속<br/>
            2. <strong>gist</strong> 권한만 체크 (링크로 열면 자동 선택돼요)<br/>
            3. Expiration은 <strong>No expiration</strong> 권장<br/>
            4. Generate token → 복사해서 아래에 붙여넣기
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="gistToken">Personal Access Token</label>
          <input class="input" id="gistToken" type="password" placeholder="ghp_… 또는 github_pat_…" autocomplete="off" spellcheck="false" />
          <p class="field__hint">토큰은 이 브라우저에만 저장되고 GitHub 외에는 전송되지 않아요. 폰에서도 같은 토큰을 한 번만 입력하면 돼요.</p>
        </div>
      `,
      foot: `
        <button class="btn btn--neutral" data-close>취소</button>
        <button class="btn btn--primary" data-act="do-connect">연결하기</button>
      `,
    });
    sheet.querySelector('[data-act="do-connect"]').addEventListener('click', async () => {
      const token = sheet.querySelector('#gistToken').value.trim();
      if (!token) { toast('토큰을 입력해 주세요', { type: 'error' }); return; }
      const btn = sheet.querySelector('[data-act="do-connect"]');
      btn.disabled = true; btn.textContent = '연결 중…';
      try {
        const { pulled } = await connect(token);
        closeSheet();
        toast(pulled ? '기존 데이터를 찾아서 합쳤어요!' : '연결 완료! 이제 자동으로 동기화돼요', { type: 'success', duration: 3200 });
        renderSettings(root, { applyTheme });
      } catch (err) {
        btn.disabled = false; btn.textContent = '연결하기';
        toast(err.message || '연결에 실패했어요', { type: 'error', duration: 3600 });
      }
    });
  });

  root.querySelector('[data-act="sync-now"]')?.addEventListener('click', async () => {
    toast('동기화하는 중…');
    const ok = await syncNow();
    toast(ok ? '동기화 완료!' : `동기화 실패 — ${getSyncState().message}`, { type: ok ? 'success' : 'error' });
    renderSettings(root, { applyTheme });
  });

  root.querySelector('[data-act="share-claude"]')?.addEventListener('click', async () => {
    const { gistId } = getSettings();
    let url = await pagesStatusUrl();
    if (!url) {
      toast('링크를 만들기 위해 한 번 동기화할게요…');
      await syncNow({ silent: true });
      url = await pagesStatusUrl();
      if (!url) { toast(`동기화가 안 됐어요 — ${getSyncState().message || '잠시 후 다시 시도해 주세요'}`, { type: 'error' }); return; }
    }
    const repo = repoUrl();
    const secretsUrl = repo ? `${repo}/settings/secrets/actions/new` : '';
    const actionsUrl = repo ? `${repo}/actions/workflows/deploy.yml` : '';

    const sheet = openSheet({
      title: 'Claude 프로젝트에 현황 공유',
      desc: '링크 하나로 Claude가 내 최신 취준 현황을 읽어요',
      body: `
        <div class="field">
          <label class="field__label" for="statusUrl">Claude가 읽을 링크</label>
          <div class="quick-add" style="margin:0">
            <input class="input" id="statusUrl" value="${esc(url)}" readonly aria-label="현황 요약 링크" />
            <button class="quick-add__btn" type="button" data-copy="url" aria-label="링크 복사">${icons.link}</button>
          </div>
          <p class="field__hint">앱에서 바꾼 내용이 이 링크에 반영되기까지 <strong>최대 20분</strong> 걸려요 (20분마다 자동 갱신). 주소는 추측할 수 없게 만들었지만 로그인 없이 열리니 외부에 올리지 마세요.</p>
        </div>

        <div class="callout" style="margin-bottom:14px">
          ${icons.key}
          <div>
            <strong>처음 한 번: 저장소에 GIST_ID 등록</strong><br/>
            링크가 동작하려면 GitHub 저장소가 내 Gist를 알아야 해요.<br/>
            1. ${secretsUrl ? `<a href="${esc(secretsUrl)}" target="_blank" rel="noopener noreferrer">저장소 Settings → Secrets → New repository secret ↗</a>` : '저장소 Settings → Secrets and variables → Actions → New repository secret'}<br/>
            2. Name에 <strong>GIST_ID</strong>, Secret에 아래 값을 붙여 넣고 Add secret<br/>
            3. ${actionsUrl ? `<a href="${esc(actionsUrl)}" target="_blank" rel="noopener noreferrer">Actions → Deploy to GitHub Pages → Run workflow ↗</a>` : 'Actions → Deploy to GitHub Pages → Run workflow'} 로 한 번 실행 (이후엔 자동)
          </div>
        </div>
        <div class="quick-add" style="margin:0 0 18px">
          <input class="input" value="${esc(gistId)}" readonly aria-label="Gist ID" />
          <button class="quick-add__btn" type="button" data-copy="gist" aria-label="Gist ID 복사">${icons.key}</button>
        </div>

        <div class="field">
          <span class="field__label">프로젝트 지침에 붙여 넣을 문장</span>
          <div class="code-block" style="white-space:pre-wrap;word-break:break-all;font-family:inherit;font-size:13px">${esc(projectInstruction(url))}</div>
          <button class="btn btn--neutral btn--block" style="margin-top:8px" data-copy="instruction">${icons.memo}문장 복사</button>
          <p class="field__hint">claude.ai → 프로젝트 → 오른쪽 <strong>프로젝트 지침</strong>에 붙여 넣고 저장하세요.</p>
        </div>

        <div class="field">
          <span class="field__label">링크가 안 될 때 — 직접 건네주기</span>
          <div class="field-row">
            <button class="btn btn--neutral" data-copy="markdown">${icons.memo}현황 복사</button>
            <button class="btn btn--neutral" data-act="download">${icons.download}파일 내려받기</button>
          </div>
          <p class="field__hint">복사한 현황을 채팅에 붙여 넣거나, 내려받은 status.md를 프로젝트 지식(Knowledge)에 올리면 돼요.</p>
        </div>

        <details style="margin-top:6px">
          <summary style="cursor:pointer;font-size:13.5px;font-weight:600;color:var(--text-secondary);padding:6px 2px">Claude가 읽게 될 내용 미리보기</summary>
          <div class="code-block" style="white-space:pre-wrap;word-break:break-word;font-family:inherit;font-size:12.5px;margin-top:8px;max-height:320px;overflow:auto">${esc(buildStatusMarkdown())}</div>
        </details>
      `,
      foot: '<button class="btn btn--primary" data-close>확인</button>',
    });
    const say = (ok, good, bad) => toast(ok ? good : bad, { type: ok ? 'success' : 'error', duration: 3000 });
    sheet.querySelector('[data-copy="url"]').addEventListener('click', async () =>
      say(await copyText(url), '링크를 복사했어요', '복사에 실패했어요. 길게 눌러 직접 복사해 주세요'));
    sheet.querySelector('[data-copy="gist"]').addEventListener('click', async () =>
      say(await copyText(gistId), 'Gist ID를 복사했어요. GitHub 시크릿에 붙여 넣으세요', '복사에 실패했어요'));
    sheet.querySelector('[data-copy="instruction"]').addEventListener('click', async () =>
      say(await copyText(projectInstruction(url)), '문장을 복사했어요. 프로젝트 지침에 붙여 넣으세요', '복사에 실패했어요'));
    sheet.querySelector('[data-copy="markdown"]').addEventListener('click', async () =>
      say(await copyText(buildStatusMarkdown()), '현황을 복사했어요. 채팅에 붙여 넣으세요', '복사에 실패했어요'));
    sheet.querySelector('[data-act="download"]').addEventListener('click', () => {
      downloadText('status.md', buildStatusMarkdown());
      toast('status.md를 내려받았어요', { type: 'success' });
    });
  });

  root.querySelector('[data-act="auto-sync"]')?.addEventListener('click', (e) => {
    const s = getSettings();
    s.autoSync = !s.autoSync;
    persistSettings();
    e.currentTarget.setAttribute('aria-checked', s.autoSync);
  });

  root.querySelector('[data-act="disconnect"]')?.addEventListener('click', async () => {
    const ok = await confirmSheet({
      title: '연결을 해제할까요?',
      desc: 'Gist에 저장된 데이터는 남아 있어요. 토큰을 다시 입력하면 언제든 이어서 쓸 수 있어요.',
      confirmText: '해제',
    });
    if (ok) { disconnect(); toast('연결을 해제했어요'); renderSettings(root, { applyTheme }); }
  });

  /* ---------------- 테마 ---------------- */
  root.querySelector('[data-act="theme"]').addEventListener('click', () => {
    const s = getSettings();
    const order = ['auto', 'light', 'dark'];
    s.theme = order[(order.indexOf(s.theme) + 1) % order.length];
    persistSettings();
    applyTheme();
    renderSettings(root, { applyTheme });
  });

  /* ---------------- 백업 / 복원 ---------------- */
  root.querySelector('[data-act="export"]').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `jobhunt-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('백업 파일을 내려받았어요', { type: 'success' });
  });

  const fileInput = root.querySelector('#importFile');
  root.querySelector('[data-act="import"]').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const ok = await confirmSheet({
        title: '데이터를 교체할까요?',
        desc: `현재 데이터가 '${file.name}' 내용으로 바뀌어요.`,
        confirmText: '가져오기',
        danger: false,
      });
      if (ok) { replaceAll(data); toast('데이터를 가져왔어요', { type: 'success' }); }
    } catch {
      toast('파일을 읽지 못했어요. 올바른 백업 파일인지 확인해 주세요.', { type: 'error' });
    }
    fileInput.value = '';
  });

  root.querySelector('[data-act="reset"]').addEventListener('click', async () => {
    const ok = await confirmSheet({
      title: '모든 데이터를 초기화할까요?',
      desc: '직접 추가·수정한 내용이 사라지고 처음 목록으로 돌아가요.',
      confirmText: '초기화',
    });
    if (ok) { resetAll(); toast('초기 데이터로 되돌렸어요'); }
  });
}
