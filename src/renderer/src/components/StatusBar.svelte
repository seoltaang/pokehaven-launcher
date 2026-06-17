<script lang="ts">
  interface Props { text: string; online?: boolean; }
  let { text, online = true }: Props = $props();
</script>

<footer class="status mono">
  <span class="dot" class:off={!online}></span>{text}
</footer>

<style>
  .status {
    display: flex; align-items: center; gap: 8px;
    border-top: 1px solid var(--line);
    padding: 9px 16px;
    background: var(--panel);
    color: var(--ink-dim);
    font-size: 11px;
    letter-spacing: 0.04em;
  }
  .dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--t-grass); box-shadow: 0 0 0 3px rgba(95,189,88,0.2);
  }
  .dot.off { background: #c4ccd6; box-shadow: none; }
</style>
