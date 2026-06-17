<script lang="ts">
  interface Props {
    label: string;
    variant?: 'primary' | 'ghost' | 'busy';
    disabled?: boolean;
    big?: boolean;
    onclick?: () => void;
  }
  let { label, variant = 'primary', disabled = false, big = false, onclick }: Props = $props();
</script>

<button class="btn {variant}" class:big {disabled} {onclick}>
  <span class="label upper">{label}</span>
</button>

<style>
  .btn {
    border: none;
    border-radius: 999px;
    color: #fff;
    padding: 11px 24px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.06em;
    cursor: pointer;
    box-shadow: var(--shadow-sm);
    transition: transform 0.1s ease, box-shadow 0.12s ease, filter 0.12s ease;
  }
  .btn.big { padding: 18px 56px; font-size: 20px; border-radius: 18px; }

  .primary { background: linear-gradient(135deg, #ff5a3c, var(--red)); }
  .primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: var(--shadow); filter: brightness(1.05); }
  .primary:active:not(:disabled) { transform: translateY(0); }

  .ghost {
    background: var(--panel);
    color: var(--ink);
    border: 2px solid var(--line);
    box-shadow: none;
  }
  .ghost:hover:not(:disabled) { border-color: var(--blue); color: var(--blue); }

  .busy { background: linear-gradient(135deg, #7fb0e8, var(--blue)); cursor: default; }

  .btn:disabled { opacity: 0.55; cursor: default; box-shadow: none; }
</style>
