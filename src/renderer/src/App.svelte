<script lang="ts">
  import TitleBar from './components/TitleBar.svelte';
  import StatusBar from './components/StatusBar.svelte';
  import Login from './screens/Login.svelte';
  import Main from './screens/Main.svelte';
  import Settings from './screens/Settings.svelte';
  import { formatStatusLine } from './lib/format.js';
  import type { LauncherStatus, Account, Settings as SettingsT } from '../../shared/ipc.js';

  type Screen = 'login' | 'main' | 'settings';
  let screen = $state<Screen>('main');

  let status = $state<LauncherStatus | null>(null);
  let account = $state<Account | null>(null);
  let settings = $state<SettingsT | null>(null);
  let bootError = $state<string | null>(null);
  let progress = $state<{ fraction: number; currentFile: string } | null>(null);

  window.launcher.onStateChange((s) => {
    if (status) status = { ...status, state: s };
    if (s !== 'updating' && s !== 'launching') progress = null;
  });
  window.launcher.onProgress((p) => { progress = p; });

  async function refresh() {
    try {
      account = await window.launcher.getAccount();
      settings = await window.launcher.getSettings();
      status = await window.launcher.getStatus();
      screen = account.loggedIn ? 'main' : 'login';
    } catch (e) {
      bootError = e instanceof Error ? e.message : String(e);
    }
  }
  refresh();

  async function onlogin() {
    try {
      account = await window.launcher.login();
      await refresh();
    } catch (e) {
      bootError = e instanceof Error ? e.message : String(e);
    }
  }
  async function onlogout() { await window.launcher.logout(); account = await window.launcher.getAccount(); screen = 'login'; }
  async function onplay() {
    try {
      await window.launcher.playOrUpdate();
    } catch (e) {
      bootError = e instanceof Error ? e.message : String(e);
    } finally {
      // Always re-derive the real state so the button never stays stuck on busy.
      status = await window.launcher.getStatus();
      progress = null;
    }
  }
</script>

<div class="app">
  <TitleBar title="PokeHaven Frontier" />
  <div class="shell">
    {#if account?.loggedIn}
      <nav class="rail">
        {#if account}
          <div class="me">
            <div class="ava">{account.username.slice(0, 1)}</div>
            <div class="uname">{account.username}</div>
          </div>
        {/if}
        <button class="navbtn" class:active={screen === 'main'} onclick={() => (screen = 'main')}>🏠 홈</button>
        <button class="navbtn" class:active={screen === 'settings'} onclick={() => (screen = 'settings')}>⚙️ 설정</button>
      </nav>
    {/if}

    <div class="content">
      {#if screen === 'login'}
        <Login {onlogin} />
      {:else if screen === 'main' && status && account}
        <Main {status} {account} {progress} {onplay} />
      {:else if screen === 'settings' && settings}
        <Settings {settings} {onlogout} />
      {/if}
    </div>
  </div>
  <StatusBar text={bootError ? `ERROR: ${bootError}` : status ? formatStatusLine(status) : 'CONNECTING…'} online={status?.online ?? false} />
</div>

<style>
  .app { height: 100%; display: flex; flex-direction: column; }
  .shell { flex: 1; display: flex; min-height: 0; }
  .rail {
    width: 132px; padding: 14px 10px; gap: 6px;
    display: flex; flex-direction: column;
    background: var(--panel);
    border-right: 1px solid var(--line);
  }
  .me { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 10px 0 16px; }
  .ava {
    width: 46px; height: 46px; border-radius: 50%;
    display: grid; place-items: center;
    background: linear-gradient(135deg, var(--blue), var(--red));
    color: #fff; font-weight: 900; font-size: 20px;
    box-shadow: var(--shadow-sm);
  }
  .uname { font-size: 12px; font-weight: 700; color: var(--ink); }
  .navbtn {
    text-align: left; background: transparent; border: none; color: var(--ink-dim);
    padding: 11px 12px; font-size: 13px; font-weight: 700; cursor: pointer;
    border-radius: var(--radius-sm);
  }
  .navbtn:hover { background: var(--bg-soft); color: var(--ink); }
  .navbtn.active { color: var(--blue); background: rgba(42,117,187,0.10); }
  .content { flex: 1; min-width: 0; overflow: auto; }
</style>
