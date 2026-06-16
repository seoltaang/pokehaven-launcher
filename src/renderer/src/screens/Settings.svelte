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
  <Panel label="설정">
    <div class="row">
      <label class="mono upper" for="ram">RAM 할당</label>
      <input id="ram" type="range" min="2048" max="16384" step="512" bind:value={ram} />
      <span class="val mono">{(ram / 1024).toFixed(1)} GB</span>
    </div>
    <div class="row">
      <label class="mono upper" for="dc">서버 바로 접속</label>
      <input id="dc" type="checkbox" bind:checked={direct} />
    </div>
    <div class="row">
      <span class="mono upper">인스턴스 폴더</span>
      <span class="path mono">{settings.instanceDir}</span>
    </div>
    <div class="row end">
      <Button label="로그아웃" variant="ghost" onclick={onlogout} />
    </div>
  </Panel>
</div>

<style>
  .settings { padding: 18px; height: 100%; }
  .row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
  .row.end { justify-content: flex-end; border-bottom: none; }
  label, .row > span:first-child { width: 130px; color: var(--ink-dim); font-size: 11px; }
  .val, .path { color: var(--ink); font-size: 12px; }
  input[type="range"] { flex: 1; accent-color: var(--accent); }
</style>
