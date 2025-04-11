<script lang="ts">
	import { filteringByPaymentMethods, savedPaymentMethods } from '$lib/index';
	import { Sparkles } from 'lucide-svelte';
	import { Switch } from '$lib/components/ui/switch/index.js';

	const { class: className }: { class?: string } = $props();
</script>

<button
	class="flex w-full items-center space-x-2 rounded-md border p-3 {$filteringByPaymentMethods
		? 'border-green-400 bg-green-400/10 ring-1 ring-green-400'
		: 'border-red-400 bg-red-400/10 ring-1 ring-red-400'} transition-all
			{className}"
	onclick={(e) => {
		e.preventDefault();
		filteringByPaymentMethods.set(!$filteringByPaymentMethods);
		return false;
	}}
>
	<Sparkles class="h-5 w-5 text-yellow-500" />
	<span class="flex-grow text-left font-medium">Filtrar por tus medios de pago</span>
	<Switch id="filter-owned" checked={$filteringByPaymentMethods} class="ring-1 ring-gray-300" />
</button>
