<script lang="ts">
  interface Props {
    label: string;
    variant?: 'primary' | 'ghost' | 'busy';
    disabled?: boolean;
    onclick?: () => void;
  }
  let { label, variant = 'primary', disabled = false, onclick }: Props = $props();
</script>

<button class="ak cut {variant}" {disabled} {onclick}>
  <span class="bar"></span>
  <span class="label mono upper">{label}</span>
</button>

<style>
  .ak {
    position: relative;
    border: 1px solid var(--line-bright);
    background: var(--bg-2);
    color: var(--ink);
    padding: 12px 22px;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, box-shadow 0.12s;
  }
  .ak .bar {
    position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
    background: var(--accent);
  }
  .label { padding-left: 8px; }
  .ak.primary:hover:not(:disabled) {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent), 0 0 18px rgba(54,224,224,0.25);
  }
  .ak.ghost { background: transparent; }
  .ak.ghost .bar { background: var(--ink-dim); }
  .ak.busy { color: var(--ink-dim); }
  .ak.busy .bar { background: var(--accent-2); animation: pulse 1s ease-in-out infinite; }
  .ak:disabled { cursor: default; opacity: 0.7; }
  @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
</style>
