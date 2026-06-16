<script lang="ts">
  interface Props { percent: number; text?: string; }
  let { percent, text = '' }: Props = $props();
</script>

<div class="wrap">
  <div class="track">
    <div class="fill" style="width: {percent}%"></div>
  </div>
  {#if text}<div class="text mono">{text}</div>{/if}
</div>

<style>
  .wrap { display: flex; flex-direction: column; gap: 6px; }
  .track { height: 8px; background: var(--bg-2); border: 1px solid var(--line); }
  .fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent-2), var(--accent));
    box-shadow: 0 0 12px rgba(54,224,224,0.5);
    transition: width 0.2s ease;
  }
  .text { color: var(--ink-dim); font-size: 11px; }
</style>
