<script lang="ts">
	import type { PageData } from './$types';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { ExternalLinkIcon } from 'lucide-svelte';
	import { logos } from '@/logos';
	import { getPaymentMethod } from '@/index';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import type { schema } from '@/db';

	export let data: PageData;

	const weekdays: schema.Weekday[] = [
		'Lunes',
		'Martes',
		'Miercoles',
		'Jueves',
		'Viernes',
		'Sabado',
		'Domingo'
	];
	const today = new Date();
	const todayWeekdayIndex = today.getDay() - 1; // Adjust to start from Monday (0)
	const defaultWeekday = weekdays[todayWeekdayIndex >= 0 ? todayWeekdayIndex : weekdays.length - 1];

	let selectedWeekday: string = defaultWeekday;

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleDateString('es-AR');
	}
</script>

<div class="container mx-auto px-4 py-8">
	<h1 class="mb-8 text-3xl font-bold">Promociones Disponibles (Carrefour)</h1>

	<Tabs value={selectedWeekday} onValueChange={(value) => (selectedWeekday = value)}>
		<TabsList>
			{#each weekdays as weekday}
				<TabsTrigger value={weekday}>
					<span class="hidden md:block">{weekday}</span>
					<span class="block md:hidden">{weekday.substring(0, 3)}</span>
				</TabsTrigger>
			{/each}
		</TabsList>
		{#each weekdays as weekday}
			<TabsContent value={weekday} class="mt-6">
				<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
					{#each data.promotions.carrefour as promo}
						{#if promo.json}
							{@const promotion = promo.json as import('promos-db/schema').CarrefourPromotion}
							{#if !promotion.weekdays || promotion.weekdays.length === 0 || promotion.weekdays.includes(weekday as any)}
								<Card.Root class="flex flex-col">
									<Card.Header>
										<Card.Title>{promotion.title}</Card.Title>
									</Card.Header>
									<Card.Content>
										<div class="space-y-2 text-sm text-gray-500">
											{#if promotion.paymentMethods && promotion.paymentMethods.length > 0}
												<div class="mt-3">
													<span class="font-medium">Medios de pago:</span>
													<div class="mt-1 flex flex-wrap gap-2">
														{#each promotion.paymentMethods as methods}
															{#if Array.isArray(methods)}
																<div class="flex flex-wrap gap-2">
																	{#each methods as methodItem}
																		{@const method = getPaymentMethod(methodItem)}
																		{#if method}
																			<enhanced:img
																				src={logos[method]}
																				alt={methodItem}
																				class="h-6 w-auto"
																			/>
																		{:else}
																			{methodItem}
																		{/if}
																		{#if methodItem !== methods[methods.length - 1]}
																			+{' '}
																		{/if}
																	{/each}
																</div>
															{:else}
																<Badge variant="secondary">
																	{methods}
																</Badge>
															{/if}
														{/each}
													</div>
												</div>
											{/if}
										</div>
									</Card.Content>
									<Card.Footer class="mt-auto">
										<Button
											variant="outline"
											size="sm"
											href={promotion.url}
											target="_blank"
											rel="noopener noreferrer"
										>
											<ExternalLinkIcon class="h-4 w-4" />
											Fuente
										</Button>
									</Card.Footer>
								</Card.Root>
							{/if}
						{/if}
					{/each}
				</div>
			</TabsContent>
		{/each}
	</Tabs>
</div>
