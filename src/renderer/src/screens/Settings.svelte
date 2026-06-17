<script lang="ts">
  import Panel from '../components/Panel.svelte';
  import Button from '../components/Button.svelte';
  import type { Settings } from '../../../shared/ipc.js';

  interface Props { settings: Settings; onlogout: () => void; }
  let { settings, onlogout }: Props = $props();

  let ram = $state(settings.ramMB);
  let direct = $state(settings.directConnect);
</script>

<div class="settings">
  <Panel label="게임 설정" accent="var(--blue)">
    <div class="row">
      <div class="meta"><div class="k">RAM 할당</div><div class="d dim">마인크래프트에 할당할 메모리</div></div>
      <input id="ram" type="range" min="2048" max="16384" step="512" bind:value={ram} />
      <span class="val">{(ram / 1024).toFixed(1)} GB</span>
    </div>
    <div class="row">
      <div class="meta"><div class="k">서버 바로 접속</div><div class="d dim">실행 시 PokeHaven Frontier로 자동 입장</div></div>
      <label class="switch">
        <input type="checkbox" bind:checked={direct} />
        <span class="slider"></span>
      </label>
    </div>
    <div class="row">
      <div class="meta"><div class="k">인스턴스 폴더</div><div class="d dim">모드·설정이 설치되는 위치</div></div>
      <span class="path mono">{settings.instanceDir}</span>
    </div>
  </Panel>

  <Panel label="계정" accent="var(--red)">
    <div class="row end">
      <Button label="로그아웃" variant="ghost" onclick={onlogout} />
    </div>
  </Panel>
</div>

<style>
  .settings { padding: 18px; height: 100%; overflow: auto; display: flex; flex-direction: column; gap: 16px; }
  .row { display: flex; align-items: center; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--line); }
  .row:last-child { border-bottom: none; }
  .row.end { justify-content: flex-end; }
  .meta { flex: 1; }
  .k { font-size: 14px; font-weight: 700; }
  .d { font-size: 12px; margin-top: 2px; }
  .val { font-weight: 800; color: var(--blue); min-width: 70px; text-align: right; }
  .path { color: var(--ink); font-size: 12px; background: var(--panel-2); padding: 6px 10px; border-radius: 8px; }
  input[type="range"] { flex: 1; max-width: 280px; accent-color: var(--red); }

  .switch { position: relative; display: inline-block; width: 48px; height: 28px; }
  .switch input { opacity: 0; width: 0; height: 0; }
  .slider { position: absolute; inset: 0; background: #cdd9e9; border-radius: 999px; transition: 0.2s; }
  .slider::before { content: ""; position: absolute; height: 22px; width: 22px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: 0.2s; box-shadow: var(--shadow-sm); }
  .switch input:checked + .slider { background: var(--t-grass); }
  .switch input:checked + .slider::before { transform: translateX(20px); }
</style>
