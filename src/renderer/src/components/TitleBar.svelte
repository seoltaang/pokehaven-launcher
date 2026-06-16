<script lang="ts">
  interface Props { title: string; }
  let { title }: Props = $props();
</script>

<header class="titlebar">
  <div class="brand mono upper">{title}</div>
  <div class="spacer"></div>
  <div class="hint mono">PHF // LAUNCHER</div>
</header>

<style>
  .titlebar {
    height: 38px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 14px;
    border-bottom: 1px solid var(--line);
    -webkit-app-region: drag;
    background: linear-gradient(180deg, rgba(54,224,224,0.04), transparent);
  }
  .brand { color: var(--accent); font-size: 12px; }
  .spacer { flex: 1; }
  .hint { color: var(--ink-dim); font-size: 11px; letter-spacing: 0.2em; }
</style>
