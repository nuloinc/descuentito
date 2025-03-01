<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Filter } from 'lucide-svelte';
	import { SOURCES } from '$lib';
	import { createEventDispatcher } from 'svelte';

	const supermarketNames: Record<string, string> = {
		carrefour: 'Carrefour',
		coto: 'Coto',
		dia: 'Dia',
		jumbo: 'Jumbo'
	};

	export let selectedSupermarket: string | null = null;

	const dispatch = createEventDispatcher<{
		select: string | null;
	}>();

	function updateSupermarket(supermarket: string | null) {
		dispatch('select', supermarket);
	}
</script>

<div class="flex w-full flex-wrap items-center justify-end gap-2">
	<div class="flex items-center gap-2 text-sm font-medium">
		<Filter class="h-4 w-4" />
		<span>Filtrar:</span>
	</div>
	<Button
		variant={!selectedSupermarket ? 'default' : 'outline'}
		size="sm"
		class="rounded-full"
		onclick={() => updateSupermarket(null)}
	>
		Todos
	</Button>
	{#each SOURCES as source}
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
