<script lang="ts">
  import Button from '../components/Button.svelte';
  import ProgressBar from '../components/ProgressBar.svelte';
  import Pokeball from '../components/Pokeball.svelte';
  import { playButtonState } from '../lib/playButton.js';
  import { formatProgress } from '../lib/format.js';
  import type { LauncherStatus, Account } from '../../../shared/ipc.js';

  interface Props { status: LauncherStatus; account: Account; onplay: () => void; }
  let { status, account, onplay }: Props = $props();

  let btn = $derived(playButtonState(status.state));
  let progress = $derived(formatProgress(0.42, 'Pixelmon-1.21.1-9.3.16-universal.jar'));
  let busy = $derived(status.state === 'updating' || status.state === 'launching');
  let stateLabel = $derived(
    status.state === 'update-available' ? '업데이트가 필요합니다'
    : status.state === 'updating' ? '업데이트 중…'
    : status.state === 'launching' ? '실행 중…'
    : status.state === 'logged-out' ? '로그인이 필요합니다'
    : '플레이 준비 완료',
  );

  const server = { players: 142, maxPlayers: 200, region: 'ASIA' };
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

  <!-- server info (glass) -->
  <div class="srv">
    <div class="srv-top"><span class="live"></span>SERVER ONLINE</div>
    <div class="srv-big">{server.players}<span>/{server.maxPlayers}</span></div>
    <div class="srv-sub">트레이너 접속 중 · {server.region}</div>
  </div>

  <!-- bottom action bar -->
  <div class="actionbar">
    <div class="left">
      <div class="state">{stateLabel}</div>
      <div class="ver">PACK {status.packVersion}</div>
      {#if busy}<div class="pb"><ProgressBar percent={progress.percent} text={progress.text} /></div>{/if}
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

  .srv {
    position: absolute; top: 34px; right: 36px;
    background: rgba(255,255,255,0.14);
    border: 1px solid rgba(255,255,255,0.25);
    backdrop-filter: blur(8px);
    border-radius: 16px;
    padding: 16px 20px;
    min-width: 180px;
  }
  .srv-top { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; opacity: 0.95; }
  .live { width: 8px; height: 8px; border-radius: 50%; background: #66e08a; box-shadow: 0 0 0 4px rgba(102,224,138,0.3); }
  .srv-big { font-size: 34px; font-weight: 900; margin-top: 6px; }
  .srv-big span { font-size: 16px; opacity: 0.8; font-weight: 700; }
  .srv-sub { font-size: 12px; opacity: 0.85; margin-top: 2px; }

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
