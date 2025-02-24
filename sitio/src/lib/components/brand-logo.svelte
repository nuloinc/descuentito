<script lang="ts">
	import { BRAND_LOGOS } from '@/logos';
	// import type { SOURCES } from '..';

	const { source, type, ...restProps } = $props<{
		source: string;
		type: string;
		[key: string]: any;
	}>();

	const src = $derived(
		BRAND_LOGOS[source as keyof typeof BRAND_LOGOS] &&
			BRAND_LOGOS[source as keyof typeof BRAND_LOGOS][
				type as keyof (typeof BRAND_LOGOS)[keyof typeof BRAND_LOGOS]
			]
	);
</script>

{#if src}
	{#if typeof src === 'string'}
		<img {src} alt={`${String(source)} ${type}`} class="h-8 w-auto" {...restProps} />
	{:else}
		<enhanced:img {src} alt={`${String(source)} ${type}`} class="h-8 w-auto" {...restProps} />
	{/if}
{:else}
	{source} {type}
{/if}
