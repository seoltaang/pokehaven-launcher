<script lang="ts">
  import Button from '../components/Button.svelte';
  interface Props { onlogin: () => void; }
  let { onlogin }: Props = $props();
</script>

<div class="login">
  <div class="logo mono upper">PokeHaven<span class="accent"> Frontier</span></div>
  <div class="sub mono upper">NeoForge 1.21.1 · Pixelmon</div>
  <Button label="Microsoft 로그인" onclick={onlogin} />
</div>

<style>
  .login { height: 100%; display: grid; place-content: center; justify-items: center; gap: 16px; }
  .logo { font-size: 40px; letter-spacing: 0.1em; }
  .accent { color: var(--accent); }
  .sub { color: var(--ink-dim); font-size: 12px; }
</style>
