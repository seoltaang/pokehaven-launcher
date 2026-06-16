<script lang="ts">
  import Button from '../components/Button.svelte';
  import ProgressBar from '../components/ProgressBar.svelte';
  import { playButtonState } from '../lib/playButton.js';
  import { formatProgress } from '../lib/format.js';
  import type { LauncherStatus, Account } from '../../../shared/ipc.js';

  interface Props { status: LauncherStatus; account: Account; onplay: () => void; }
  let { status, account, onplay }: Props = $props();

  let btn = $derived(playButtonState(status.state));
  let progress = $derived(formatProgress(0.42, 'mods/Pixelmon-1.21.1-9.3.16-universal.jar'));
  let busy = $derived(status.state === 'updating' || status.state === 'launching');
</script>

<div class="main">
  <div class="profile">
    <div class="avatar"></div>
    <div class="who">
      <div class="name mono">{account.username}</div>
      <div class="tag mono upper">{account.loggedIn ? 'authenticated' : 'offline'}</div>
    </div>
  </div>

  <div class="hero">
    <div class="title mono upper">PokeHaven <span class="accent">Frontier</span></div>
    {#if busy}
      <ProgressBar percent={progress.percent} text={progress.text} />
    {/if}
    <Button label={btn.label} variant={btn.variant} disabled={btn.disabled} onclick={onplay} />
  </div>
</div>

<style>
  .main { height: 100%; display: flex; flex-direction: column; }
  .profile { display: flex; align-items: center; gap: 10px; padding: 14px; }
  .avatar { width: 34px; height: 34px; background: var(--bg-2); border: 1px solid var(--line-bright); }
  .name { color: var(--ink); font-size: 13px; }
  .tag { color: var(--accent); font-size: 10px; }
  .hero { flex: 1; display: grid; place-content: center; justify-items: center; gap: 18px; width: min(560px, 80%); margin: 0 auto; }
  .title { font-size: 30px; letter-spacing: 0.08em; }
  .accent { color: var(--accent); }
</style>
