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

  async function refresh() {
    try {
      status = await window.launcher.getStatus();
      account = await window.launcher.getAccount();
      settings = await window.launcher.getSettings();
      screen = account.loggedIn ? 'main' : 'login';
    } catch (e) {
      bootError = e instanceof Error ? e.message : String(e);
    }
  }
  refresh();

  async function onlogin() { account = await window.launcher.login(); screen = 'main'; }
  async function onlogout() { await window.launcher.logout(); account = await window.launcher.getAccount(); screen = 'login'; }
  async function onplay() { await window.launcher.playOrUpdate(); }
</script>

<div class="app">
  <TitleBar title="PokeHaven Frontier" />
  <div class="shell">
    {#if account?.loggedIn}
      <nav class="rail">
        <button class="navbtn mono upper" class:active={screen === 'main'} onclick={() => (screen = 'main')}>홈</button>
        <button class="navbtn mono upper" class:active={screen === 'settings'} onclick={() => (screen = 'settings')}>설정</button>
      </nav>
    {/if}

    <div class="content">
      {#if screen === 'login'}
        <Login {onlogin} />
      {:else if screen === 'main' && status && account}
        <Main {status} {account} {onplay} />
      {:else if screen === 'settings' && settings}
        <Settings {settings} {onlogout} />
      {/if}
    </div>
  </div>
  <StatusBar text={bootError ? `ERROR: ${bootError}` : status ? formatStatusLine(status) : 'CONNECTING…'} />
</div>

<style>
  .app { height: 100%; display: flex; flex-direction: column; }
  .shell { flex: 1; display: flex; min-height: 0; }
  .rail { width: 92px; border-right: 1px solid var(--line); display: flex; flex-direction: column; padding-top: 10px; }
  .navbtn {
    background: transparent; border: none; color: var(--ink-dim);
    padding: 14px 0; font-size: 11px; letter-spacing: 0.16em; cursor: pointer;
    border-left: 3px solid transparent;
  }
  .navbtn.active { color: var(--accent); border-left-color: var(--accent); background: rgba(54,224,224,0.05); }
  .content { flex: 1; min-width: 0; overflow: auto; }
</style>
