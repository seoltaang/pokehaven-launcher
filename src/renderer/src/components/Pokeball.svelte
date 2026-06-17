<script lang="ts">
  interface Props { size?: number; spin?: boolean; }
  let { size = 28, spin = false }: Props = $props();
</script>

<svg class="pokeball" class:spin width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
  <circle cx="50" cy="50" r="46" fill="#fff" stroke="#16243a" stroke-width="6" />
  <path d="M4 50a46 46 0 0 1 92 0Z" fill="#ee1515" stroke="#16243a" stroke-width="6" />
  <line x1="4" y1="50" x2="96" y2="50" stroke="#16243a" stroke-width="6" />
  <circle cx="50" cy="50" r="15" fill="#fff" stroke="#16243a" stroke-width="6" />
  <circle cx="50" cy="50" r="6" fill="#fff" stroke="#16243a" stroke-width="4" />
</svg>

<style>
  .pokeball { display: block; }
  .spin { animation: roll 1.1s linear infinite; transform-origin: 50% 50%; }
  @keyframes roll { to { transform: rotate(360deg); } }
</style>
