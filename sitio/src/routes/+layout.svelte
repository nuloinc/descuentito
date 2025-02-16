<script lang="ts">
	import '../app.css';
	import NuloInc from '$lib/Nulo_Science_Inc.svg';
	let { children } = $props();
</script>

{@render children()}

<footer
	class="mt-8 flex flex-col items-center justify-center gap-3 px-2 py-4 text-center text-gray-500"
>
	<p>
		Los resultados mostrados son generados automaticamente. Siempre verifica la información en la
		fuente original.
	</p>
	<p>Marcas registradas pertenecen a sus respectivos dueños.</p>
	<div>
		Un experimento de
		<a href="https://nulo.lol" target="_blank">
			<img src={NuloInc} alt="Nulo Science Inc." class="h-12" />
		</a>
	</div>
</footer>
