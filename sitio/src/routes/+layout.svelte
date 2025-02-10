<script lang="ts">
	import '../app.css';
	import NuloInc from '$lib/Nulo_Science_Inc.svg';
	let { children } = $props();
</script>

{@render children()}

<footer class="mt-8 flex items-center justify-center gap-3 py-4 text-center text-gray-500">
	Un experimento de
	<a href="https://nulo.lol" target="_blank">
		<img src={NuloInc} alt="Nulo Science Inc." class="h-12" />
	</a>
</footer>
