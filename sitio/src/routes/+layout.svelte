<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import posthog from 'posthog-js';
	import { MediaQuery } from 'svelte/reactivity';

	let { children } = $props();
	const dark = new MediaQuery('prefers-color-scheme: dark');

	$effect(() => {
		if (dark.current) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	});

	onMount(() => {
		posthog.init('phc_QShHtLe5KRFWoNa5m6GgYTbvIhdqDPMJQgoym5MkCKr', {
			api_host: 'https://us.i.posthog.com',
			person_profiles: 'identified_only' // or 'always' to create profiles for anonymous users as well
		});
	});
</script>

<svelte:head>
	<title>descuentito.ar - Descuentos en supermercados</title>
	<meta
		name="description"
		content="Encuentra y compara descuentos en supermercados de Argentina. Carrefour, Coto, Día y Jumbo."
	/>
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
</footer>
