<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Filter } from 'lucide-svelte';
	import { SOURCES } from '$lib';
	import { createEventDispatcher } from 'svelte';
	import { page } from '$app/stores';

	const supermarketNames: Record<string, string> = {
		carrefour: 'Carrefour',
		coto: 'Coto',
		dia: 'Dia',
		jumbo: 'Jumbo',
		changomas: 'ChangoMas',
		makro: 'Makro'
	};

	export let selectedSupermarket: string | null = null;

	const SHOW_CHANGOMAS = new URL($page.url).searchParams.get('showChangomas');

	const dispatch = createEventDispatcher<{
		select: string | null;
	}>();

	function updateSupermarket(supermarket: string | null) {
		dispatch('select', supermarket);
	}

	$: sources = SOURCES.filter((source) => {
		if (SHOW_CHANGOMAS) return true;
		return source !== 'changomas';
	});
</script>

<div class="grid w-full grid-cols-3 gap-2">
	<div class="col-span-3 flex justify-center">
		<Button
			variant={!selectedSupermarket ? 'default' : 'outline'}
			size="sm"
			class="w-2/3 rounded-full"
			onclick={() => updateSupermarket(null)}
		>
			Todos
		</Button>
	</div>
	{#each sources as source}
		<Button
			variant={selectedSupermarket === source ? 'default' : 'outline'}
			size="sm"
			class="rounded-full"
			onclick={() => updateSupermarket(source)}
		>
			{supermarketNames[source]}
		</Button>
	{/each}
</div>
