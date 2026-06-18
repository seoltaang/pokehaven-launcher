<script lang="ts">
  import Button from '../components/Button.svelte';
  import ProgressBar from '../components/ProgressBar.svelte';
  import Pokeball from '../components/Pokeball.svelte';
  import { playButtonState } from '../lib/playButton.js';
  import { formatProgress } from '../lib/format.js';
  import type { LauncherStatus, Account } from '../../../shared/ipc.js';

  interface Props {
    status: LauncherStatus;
    account: Account;
    progress?: { fraction: number; currentFile: string } | null;
    onplay: () => void;
  }
  let { status, account, progress = null, onplay }: Props = $props();

  let btn = $derived(playButtonState(status.state));
  let busy = $derived(status.state === 'updating' || status.state === 'launching');
  let bar = $derived(progress ? formatProgress(progress.fraction, progress.currentFile) : null);
  let stateLabel = $derived(
    status.state === 'install-needed' ? '설치가 필요합니다'
    : status.state === 'update-available' ? '업데이트가 필요합니다'
    : status.state === 'updating' ? '진행 중…'
    : status.state === 'launching' ? '실행 중…'
    : status.state === 'playing' ? '게임 플레이 중'
    : status.state === 'logged-out' ? '로그인이 필요합니다'
    : '플레이 준비 완료',
  );
</script>

<div class="stage">
  <!-- key-art backdrop -->
  <div class="art">
    <div class="b1"><Pokeball size={460} /></div>
    <div class="b2"><Pokeball size={140} /></div>
    <div class="b3"><Pokeball size={90} /></div>
  </div>

  <!-- top-left identity -->
  <div class="ident">
    <h1>PokeHaven <span class="hl">Frontier</span></h1>
    <p>Pixelmon · NeoForge 1.21.1</p>
  </div>

  <!-- bottom action bar -->
  <div class="actionbar">
    <div class="left">
      <div class="state">{stateLabel}</div>
      <div class="ver">PACK {status.packVersion}</div>
      {#if busy && bar}<div class="pb"><ProgressBar percent={bar.percent} text={bar.text} /></div>{/if}
    </div>
    <Button label={btn.label} variant={btn.variant} disabled={btn.disabled} big onclick={onplay} />
  </div>
</div>

<style>
  .stage {
    position: relative;
    height: 100%;
    overflow: hidden;
    color: #fff;
    background: linear-gradient(135deg, #14315c 0%, #2a75bb 42%, #6a4fb0 72%, #ff5a3c 128%);
  }

  .art { position: absolute; inset: 0; pointer-events: none; }
  .art > div { position: absolute; opacity: 0.12; }
  .b1 { right: -90px; top: 50%; transform: translateY(-50%); }
  .b2 { left: 38%; bottom: -30px; opacity: 0.1; }
  .b3 { left: 24%; top: 60px; opacity: 0.1; }

  .ident { position: absolute; top: 34px; left: 36px; }
  .ident h1 { margin: 0; font-size: 38px; font-weight: 900; text-shadow: 0 2px 12px rgba(0,0,0,0.25); }
  .ident .hl { color: var(--yellow); }
  .ident p { margin: 6px 0 0; opacity: 0.9; font-weight: 600; }

  .actionbar {
    position: absolute; left: 0; right: 0; bottom: 0;
    display: flex; align-items: flex-end; justify-content: space-between; gap: 20px;
    padding: 28px 36px;
    background: linear-gradient(0deg, rgba(8,18,35,0.6) 0%, rgba(8,18,35,0.2) 55%, transparent 100%);
  }
  .left { display: flex; flex-direction: column; gap: 6px; max-width: 60%; }
  .state { font-size: 20px; font-weight: 800; text-shadow: 0 1px 8px rgba(0,0,0,0.3); }
  .ver { font-size: 12px; opacity: 0.8; font-family: var(--mono); }
  .pb { margin-top: 8px; width: 340px; max-width: 100%; }
</style>
