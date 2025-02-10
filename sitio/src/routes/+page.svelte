<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleDateString('es-AR');
	}
</script>

<div class="container mx-auto px-4 py-8">
	<h1 class="mb-8 text-3xl font-bold">Promociones Disponibles</h1>

	<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
		{#each data.promotions as promo}
			{#if promo.json}
				{@const promotion = promo.json as import('promos-db/schema').GaliciaPromotion}
				<div class="rounded-lg bg-white p-6 shadow-md transition-shadow hover:shadow-lg">
					<div class="mb-4 flex items-start justify-between">
						<h2 class="text-xl font-semibold text-gray-800">{promotion.title}</h2>
						<!-- <span
							class="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800"
						>
							{promotion.discount.value}
						</span> -->
					</div>

					<p class="mb-4 text-gray-600">{promotion.description}</p>

					<div class="space-y-2 text-sm text-gray-500">
						<div>
							<span class="font-medium">Válido desde:</span>
							{formatDate(promotion.validFrom)}
						</div>
						<div>
							<span class="font-medium">Válido hasta:</span>
							{formatDate(promotion.validUntil)}
						</div>

						{#if promotion.paymentMethods && promotion.paymentMethods.length > 0}
							<div class="mt-3">
								<span class="font-medium">Medios de pago:</span>
								<div class="mt-1 flex flex-wrap gap-2">
									{#each promotion.paymentMethods as method}
										<span class="rounded-md bg-gray-100 px-2 py-1 text-xs">
											{method}
										</span>
									{/each}
								</div>
							</div>
						{/if}
					</div>

					<a
						href={promotion.url}
						target="_blank"
						rel="noopener noreferrer"
						class="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
					>
						Ver más
					</a>
				</div>
			{/if}
		{/each}
	</div>
</div>
