<script lang="ts">
	import { LOGOS, LOGOS_NEED_LIGHT_BACKGROUND } from '@/logos';
	import type { PAYMENT_METHODS } from 'promos-db/schema';

	export let method: (typeof PAYMENT_METHODS)[number];

	$: logo = LOGOS[method];
	$: lightBackground = LOGOS_NEED_LIGHT_BACKGROUND.includes(method);
</script>

{#if logo}
	{#if typeof logo === 'string'}
		<img
			src={logo}
			alt={method}
			class={`h-8 w-auto ${lightBackground ? 'rounded bg-white p-1' : ''}`}
			loading="lazy"
			decoding="async"
		/>
	{:else}
		<enhanced:img
			src={logo}
			alt={method}
			class={`h-8 w-auto ${lightBackground ? 'rounded bg-white p-1' : ''}`}
			loading="lazy"
			decoding="async"
		/>
	{/if}
{:else}
	{method}
{/if}
