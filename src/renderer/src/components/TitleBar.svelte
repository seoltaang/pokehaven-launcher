<script lang="ts">
  import Pokeball from './Pokeball.svelte';
  interface Props { title: string; }
  let { title }: Props = $props();
</script>

<header class="titlebar">
  <div class="brand">
    <Pokeball size={20} />
    <span class="name">{title}</span>
  </div>
  <div class="spacer"></div>
  <div class="controls">
    <button class="ctl" title="최소화" onclick={() => window.launcher.minimize()} aria-label="minimize">–</button>
    <button class="ctl close" title="닫기" onclick={() => window.launcher.close()} aria-label="close">×</button>
  </div>
</header>

<style>
  .titlebar {
    height: 44px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 8px 0 14px;
    background: linear-gradient(180deg, var(--panel), var(--panel-2));
    border-bottom: 1px solid var(--line);
    -webkit-app-region: drag;
  }
  .brand { display: flex; align-items: center; gap: 9px; }
  .name { font-weight: 800; font-size: 13px; color: var(--ink); letter-spacing: 0.02em; }
  .spacer { flex: 1; }
  .controls { display: flex; gap: 4px; -webkit-app-region: no-drag; }
  .ctl {
    width: 34px; height: 30px; border: none; border-radius: 8px;
    background: transparent; color: var(--ink-dim);
    font-size: 18px; line-height: 1; cursor: pointer;
  }
  .ctl:hover { background: var(--bg-soft); color: var(--ink); }
  .ctl.close:hover { background: var(--red); color: #fff; }
</style>
