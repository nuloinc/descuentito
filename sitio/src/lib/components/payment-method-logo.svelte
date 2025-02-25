<script lang="ts">
	import { logos } from '@/logos';
	import type { PAYMENT_METHODS } from 'promos-db/schema';

	export let method: (typeof PAYMENT_METHODS)[number];

	$: logo = logos[method];
</script>

{#if logo}
	{#if typeof logo === 'string'}
		<img src={logo} alt={method} class="h-8 w-auto" />
	{:else}
		<enhanced:img src={logo} alt={method} class="h-8 w-auto" />
	{/if}
{:else}
	{method}
{/if}
