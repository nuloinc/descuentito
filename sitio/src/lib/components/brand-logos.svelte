<script lang="ts">
	import { BRAND_LOGOS, BRAND_LOGOS_NEED_LIGHT_BACKGROUND, BRAND_LOGOS_SMALL } from '@/logos';
	// import type { SOURCES } from '..';

	const {
		source,
		types,
		selectedType,
		small,
		class: className,
		containerClass
	} = $props<{
		source: string;
		types: string[];
		selectedType: 'Presencial' | 'Online';
		small?: boolean;
		class?: string;
		containerClass?: string;
	}>();

	function getSrc(type: string) {
		return (
			(small &&
				BRAND_LOGOS_SMALL[source as keyof typeof BRAND_LOGOS_SMALL] &&
				BRAND_LOGOS_SMALL[source as keyof typeof BRAND_LOGOS_SMALL][
					type as keyof (typeof BRAND_LOGOS_SMALL)[keyof typeof BRAND_LOGOS_SMALL]
				]) ||
			(BRAND_LOGOS[source as keyof typeof BRAND_LOGOS] &&
				BRAND_LOGOS[source as keyof typeof BRAND_LOGOS][
					type as keyof (typeof BRAND_LOGOS)[keyof typeof BRAND_LOGOS]
				])
		);
	}

	function needsLightBackground(type: string) {
		return (
			BRAND_LOGOS_NEED_LIGHT_BACKGROUND[source as keyof typeof BRAND_LOGOS_NEED_LIGHT_BACKGROUND] &&
			BRAND_LOGOS_NEED_LIGHT_BACKGROUND[
				source as keyof typeof BRAND_LOGOS_NEED_LIGHT_BACKGROUND
			].includes(type)
		);
	}

	function reduceTypes(types: string[]) {
		const basicTypes = types.filter((type) =>
			selectedType === 'Online' ? type === 'Online' : type !== 'Online'
		);
		if (source === 'carrefour') {
			if (selectedType === 'Presencial') {
				return {
					types: ['Carrefour'],
					applies: basicTypes.filter((type) => type !== 'Maxi')
				};
			} else return { types: ['Online'] };
		}

		return { types: basicTypes };
	}

	const { types: typesShown, applies } = $derived(reduceTypes(types));
</script>

<div class="flex flex-wrap gap-2 {containerClass}">
	{#each typesShown as type, index}
		{@const src = getSrc(type)}
		{#if src}
			{#if typeof src === 'string'}
				<img
					{src}
					alt={`${String(source)} ${type}`}
					class="h-8 w-auto {needsLightBackground(type) ? 'rounded bg-white p-1' : ''} {className}"
					loading="lazy"
					decoding="async"
				/>
			{:else}
				<enhanced:img
					{src}
					alt={`${String(source)} ${type}`}
					class="max-h-8 w-auto rounded {needsLightBackground(type)
						? 'bg-white p-1'
						: ''} {className}"
					loading="lazy"
					decoding="async"
				/>
			{/if}
		{:else}
			{source} {type}
		{/if}
	{/each}
</div>

{#if applies?.length && !small}
	<div class="">
		Aplica:
		{#each applies as type, index}
			{type}{#if index < applies.length - 1},{' '}
			{/if}
		{/each}
	</div>
{/if}
