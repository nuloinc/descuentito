<script lang="ts">
	import { logos } from '@/logos';
	import type { PAYMENT_METHODS } from 'promos-db/schema';
	import { Badge } from './ui/badge';

	function isPaymentMethod(method: string): method is keyof typeof logos {
		return method in logos;
	}

	export let method: (typeof PAYMENT_METHODS)[number];
</script>

{#if isPaymentMethod(method)}
	<enhanced:img src={logos[method]} alt={method} class="h-8 w-auto" />
{:else}
	{method}
{/if}
