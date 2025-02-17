<script lang="ts">
	import '../app.css';
	import NuloInc from '$lib/Nulo_Science_Inc.svg';
	let { children } = $props();
</script>

<svelte:head>
	<title>descuentito.ar - Descuentos en supermercados</title>
	<meta
		name="description"
		content="Encuentra y compara descuentos en supermercados de Argentina. Carrefour, Coto, Día y Jumbo."
	/>
	<meta name="author" content="Nulo Science Inc." />
	<meta property="og:title" content="descuentito.ar - Descuentos en supermercados" />
	<meta
		property="og:description"
		content="Encuentra y compara descuentos en supermercados de Argentina. Carrefour, Coto, Día y Jumbo."
	/>
	<meta property="og:image" content="/og.png" />
	<meta property="og:url" content="https://descuentito.ar" />
	<meta property="og:type" content="website" />
</svelte:head>

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
