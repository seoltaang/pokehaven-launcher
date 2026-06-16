<script lang="ts">
  interface Props { text: string; }
  let { text }: Props = $props();
</script>

<footer class="status mono">
  <span class="dot"></span>{text}
</footer>

<style>
  .status {
    display: flex; align-items: center; gap: 8px;
    border-top: 1px solid var(--line);
    padding: 8px 14px;
    color: var(--ink-dim);
    font-size: 11px;
    letter-spacing: 0.08em;
  }
  .dot { width: 7px; height: 7px; background: var(--accent); box-shadow: 0 0 8px var(--accent); }
</style>
