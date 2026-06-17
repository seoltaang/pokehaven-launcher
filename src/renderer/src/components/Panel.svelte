<script lang="ts">
  interface Props { label?: string; accent?: string; children?: import('svelte').Snippet; }
  let { label, accent = 'var(--blue)', children }: Props = $props();
</script>

<section class="panel">
  {#if label}
    <div class="head">
      <span class="tick" style="background:{accent}"></span>
      <span class="upper">{label}</span>
    </div>
  {/if}
  <div class="body">
    {@render children?.()}
  </div>
</section>

<style>
  .panel {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--panel);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }
  .head {
    display: flex; align-items: center; gap: 8px;
    color: var(--ink);
    font-size: 12px; font-weight: 800;
    padding: 12px 16px;
    border-bottom: 1px solid var(--line);
    background: var(--panel-2);
  }
  .tick { width: 8px; height: 8px; border-radius: 3px; }
  .body { padding: 16px; }
</style>
