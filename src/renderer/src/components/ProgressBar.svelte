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
    position: relative;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--yellow), #ff9b3d, var(--red));
    transition: width 0.2s ease;
    overflow: hidden;
    min-width: 12px;
  }
  /* Moving stripes so the bar always looks "alive", even when a phase (e.g. the
     NeoForge processors) makes no measurable progress for a minute or two. */
  .fill::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.22) 25%,
      transparent 25%,
      transparent 50%,
      rgba(255, 255, 255, 0.22) 50%,
      rgba(255, 255, 255, 0.22) 75%,
      transparent 75%
    );
    background-size: 22px 22px;
    animation: stripes 0.7s linear infinite;
  }
  @keyframes stripes {
    from { background-position: 0 0; }
    to { background-position: 22px 0; }
  }
  .text { font-size: 12px; text-align: center; }
</style>
