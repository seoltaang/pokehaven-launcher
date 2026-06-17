<script lang="ts">
  interface Props { percent: number; text?: string; }
  let { percent, text = '' }: Props = $props();
</script>

<div class="wrap">
  <div class="track">
    <div class="fill" style="width: {percent}%"></div>
  </div>
  {#if text}<div class="text mono dim">{text}</div>{/if}
</div>

<style>
  .wrap { display: flex; flex-direction: column; gap: 7px; width: 100%; }
  .track { height: 12px; background: var(--bg-soft); border-radius: 999px; overflow: hidden; }
  .fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--yellow), #ff9b3d, var(--red));
    transition: width 0.2s ease;
  }
  .text { font-size: 12px; text-align: center; }
</style>
