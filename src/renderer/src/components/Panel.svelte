<script lang="ts">
  interface Props { label?: string; children?: import('svelte').Snippet; }
  let { label, children }: Props = $props();
</script>

<section class="panel cut">
  {#if label}<div class="head mono upper">{label}</div>{/if}
  <div class="body">
    {@render children?.()}
  </div>
</section>

<style>
  .panel {
    border: 1px solid var(--line);
    background: linear-gradient(180deg, var(--bg-1), var(--bg-0));
  }
  .head {
    color: var(--accent);
    font-size: 11px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--line);
    letter-spacing: 0.18em;
  }
  .body { padding: 14px; }
</style>
