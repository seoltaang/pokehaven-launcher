<script lang="ts">
  import Button from '../components/Button.svelte';
  import Pokeball from '../components/Pokeball.svelte';
  interface Props { onlogin: () => void; }
  let { onlogin }: Props = $props();
</script>

<div class="login">
  <div class="card">
    <div class="ball"><Pokeball size={96} /></div>
    <h1 class="logo">PokeHaven<span class="hl"> Frontier</span></h1>
    <p class="sub">Pixelmon · NeoForge 1.21.1</p>
    <Button label="Microsoft 계정으로 로그인" big onclick={onlogin} />
    <p class="hint dim">서버에 입장하려면 마인크래프트 계정으로 로그인하세요</p>
  </div>
</div>

<style>
  .login { height: 100%; display: grid; place-items: center; padding: 24px; }
  .card {
    display: flex; flex-direction: column; align-items: center; gap: 14px;
    padding: 44px 56px;
    background: var(--panel);
    border-radius: 24px;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--line);
    text-align: center;
  }
  .ball { animation: bob 2.4s ease-in-out infinite; }
  @keyframes bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  .logo { margin: 6px 0 0; font-size: 36px; font-weight: 900; }
  .hl { color: var(--red); }
  .sub { margin: 0 0 6px; color: var(--ink-dim); font-weight: 600; }
  .hint { font-size: 12px; margin: 4px 0 0; }
</style>
