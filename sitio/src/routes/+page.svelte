<script lang="ts">
	import type { PageData } from './$types';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';

	export let data: PageData;

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleDateString('es-AR');
	}
</script>

<div class="container mx-auto px-4 py-8">
	<div class="container mx-auto px-4 py-8">
		<h1 class="mb-8 text-3xl font-bold">Promociones Disponibles (Carrefour)</h1>

		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each data.promotions.carrefour as promo}
				{#if promo.json}
					{@const promotion = promo.json as import('promos-db/schema').CarrefourPromotion}
					<Card.Root class="flex flex-col">
						<Card.Header>
							<Card.Title>{promotion.title}</Card.Title>
						</Card.Header>
						<Card.Content>
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
												<Badge variant="secondary">
													{method}
												</Badge>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						</Card.Content>
						<Card.Footer class="mt-auto">
							<Button>
								<a href={promotion.url} target="_blank" rel="noopener noreferrer" class="w-full">
									Ver más
								</a>
							</Button>
						</Card.Footer>
					</Card.Root>
				{/if}
			{/each}
		</div>
	</div>

	<h1 class="mb-8 text-3xl font-bold">Promociones Disponibles (Banco Galicia)</h1>

	<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
		{#each data.promotions.galicia as promo}
			{#if promo.json}
				{@const promotion = promo.json as import('promos-db/schema').GaliciaPromotion}
				<Card.Root class="flex flex-col">
					<Card.Header>
						<Card.Title>{promotion.title}</Card.Title>
					</Card.Header>
					<Card.Content>
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
											<Badge variant="secondary">
												{method}
											</Badge>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					</Card.Content>
					<Card.Footer class="mt-auto">
						<Button>
							<a href={promotion.url} target="_blank" rel="noopener noreferrer" class="w-full">
								Ver más
							</a>
						</Button>
					</Card.Footer>
				</Card.Root>
			{/if}
		{/each}
	</div>
</div>
