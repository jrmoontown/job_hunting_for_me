/**
 * 설정 뷰 — Gist 동기화, 데이터 백업/복원, 테마, 초기화.
 */
import { getSettings, persistSettings, serialize, replaceAll, resetAll } from '../store.js';
import { connect, disconnect, syncNow, isConfigured, getSyncState } from '../sync.js';
import { esc, icons, openSheet, closeSheet, confirmSheet, toast } from '../ui.js';

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
