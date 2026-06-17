<script lang="ts">
  import Button from '../components/Button.svelte';
  import ProgressBar from '../components/ProgressBar.svelte';
  import Panel from '../components/Panel.svelte';
  import Pokeball from '../components/Pokeball.svelte';
  import { playButtonState } from '../lib/playButton.js';
  import { formatProgress } from '../lib/format.js';
  import type { LauncherStatus, Account } from '../../../shared/ipc.js';

  interface Props { status: LauncherStatus; account: Account; onplay: () => void; }
  let { status, account, onplay }: Props = $props();

  let btn = $derived(playButtonState(status.state));
  let progress = $derived(formatProgress(0.42, 'Pixelmon-1.21.1-9.3.16-universal.jar'));
  let busy = $derived(status.state === 'updating' || status.state === 'launching');

  // mock server flavor data (real data wired in a later plan)
  const server = { players: 142, maxPlayers: 200, region: 'ASIA', season: 'SEASON 3' };
  const featured = [
    { name: 'Pikachu', type: 'electric', color: 'var(--t-electric)' },
    { name: 'Bulbasaur', type: 'grass', color: 'var(--t-grass)' },
    { name: 'Charmander', type: 'fire', color: 'var(--t-fire)' },
    { name: 'Squirtle', type: 'water', color: 'var(--t-water)' },
  ];
</script>

<div class="main">
  <!-- hero banner -->
  <div class="hero">
    <div class="hero-ball"><Pokeball size={260} /></div>
    <div class="hero-inner">
      <div class="badges">
        <span class="badge season">{server.season}</span>
        <span class="badge region">{server.region}</span>
      </div>
      <h1 class="title">PokeHaven <span class="hl">Frontier</span></h1>
      <p class="tagline">Pixelmon · NeoForge 1.21.1 — 트레이너 {account.username} 환영합니다</p>

      <div class="cta">
        {#if busy}
          <div class="prog"><ProgressBar percent={progress.percent} text={progress.text} /></div>
        {/if}
        <Button label={btn.label} variant={btn.variant} disabled={btn.disabled} big onclick={onplay} />
      </div>
    </div>
  </div>

  <!-- info row -->
  <div class="grid">
    <Panel label="서버 현황" accent="var(--t-grass)">
      <div class="stats">
        <div class="stat">
          <div class="num">{server.players}<span class="den">/{server.maxPlayers}</span></div>
          <div class="lbl dim">접속 중</div>
        </div>
        <div class="stat">
          <div class="num">{server.region}</div>
          <div class="lbl dim">리전</div>
        </div>
        <div class="stat">
          <div class="num up">ONLINE</div>
          <div class="lbl dim">상태</div>
        </div>
      </div>
    </Panel>

    <Panel label="추천 포켓몬" accent="var(--red)">
      <div class="mons">
        {#each featured as m (m.name)}
          <div class="mon">
            <div class="disc" style="background:{m.color}"><Pokeball size={26} /></div>
            <div class="mname">{m.name}</div>
            <span class="chip" style="background:{m.color}">{m.type}</span>
          </div>
        {/each}
      </div>
    </Panel>
  </div>
</div>

<style>
  .main { height: 100%; overflow: auto; padding: 18px; display: flex; flex-direction: column; gap: 18px; }

  .hero {
    position: relative;
    border-radius: var(--radius);
    padding: 34px 34px 30px;
    color: #fff;
    overflow: hidden;
    background: linear-gradient(125deg, var(--blue-dark), var(--blue) 45%, #ff5a3c 120%);
    box-shadow: var(--shadow);
  }
  .hero-ball { position: absolute; right: -40px; top: -50px; opacity: 0.18; }
  .hero-inner { position: relative; }
  .badges { display: flex; gap: 8px; margin-bottom: 12px; }
  .badge {
    font-size: 11px; font-weight: 800; letter-spacing: 0.08em;
    padding: 5px 12px; border-radius: 999px; backdrop-filter: blur(2px);
  }
  .badge.season { background: var(--yellow); color: var(--gold-ink); }
  .badge.region { background: rgba(255,255,255,0.22); color: #fff; }
  .title { margin: 0; font-size: 40px; font-weight: 900; letter-spacing: 0.01em; }
  .hl { color: var(--yellow); }
  .tagline { margin: 8px 0 0; opacity: 0.92; font-size: 14px; }
  .cta { margin-top: 22px; display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
  .prog { flex: 1; min-width: 220px; }

  .grid { display: grid; grid-template-columns: 1fr 1.4fr; gap: 18px; }

  .stats { display: flex; gap: 10px; }
  .stat { flex: 1; background: var(--panel-2); border-radius: var(--radius-sm); padding: 14px; text-align: center; }
  .num { font-size: 26px; font-weight: 900; color: var(--ink); }
  .num .den { font-size: 14px; color: var(--ink-dim); font-weight: 700; }
  .num.up { font-size: 18px; color: var(--t-grass); }
  .lbl { font-size: 11px; margin-top: 4px; }

  .mons { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .mon { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 6px; background: var(--panel-2); border-radius: var(--radius-sm); }
  .disc { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; box-shadow: var(--shadow-sm); }
  .mname { font-size: 13px; font-weight: 700; }
  .chip { font-size: 10px; font-weight: 800; color: #fff; padding: 3px 10px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.04em; }
</style>
