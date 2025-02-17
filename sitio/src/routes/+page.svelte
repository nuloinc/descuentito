<script lang="ts">
	import type { PageData } from './$types';
	import * as Card from '$lib/components/ui/card';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import {
		ChevronDown,
		ChevronsUpDown,
		ExternalLinkIcon,
		StarIcon,
		StarsIcon
	} from 'lucide-svelte';
	import { logos } from '@/logos';
	import { getPaymentMethod } from '@/index';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import type { schema } from '@/db';
	import { promotionsTable } from 'promos-db/schema';
	import * as Accordion from '$lib/components/ui/accordion';

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

	let selectedWeekday: schema.Weekday = defaultWeekday;

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleDateString('es-AR');
	}

	function formatCurrency(amount: number) {
		return new Intl.NumberFormat('es-AR', {
			style: 'currency',
			currency: 'ARS',
			minimumFractionDigits: 0
		}).format(amount);
	}
</script>

<div class="container mx-auto px-4 py-4">
	<h1 class="flex items-center gap-2 text-3xl font-bold">
		descuentito.ar

		<Badge variant="destructive">beta :)</Badge>
	</h1>
	<h2 class="mb-2 text-lg font-medium">Descuentos en Carrefour</h2>

	<Tabs
		value={selectedWeekday}
		onValueChange={(value) => (selectedWeekday = value as schema.Weekday)}
	>
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
											{#if promotion.where?.length > 0}
												<p>
													Comprando:
													{#each promotion.where as where}
														<span class="font-bold">{where}</span
														>{#if where !== promotion.where[promotion.where.length - 1]},{' '}
														{/if}
													{/each}
												</p>
											{/if}
											{#if promotion.limits?.maxDiscount}
												<p>
													Tope de descuento: <strong
														>{formatCurrency(promotion.limits.maxDiscount)}</strong
													>
												</p>
											{/if}
											{#if promotion.limits?.explicitlyHasNoLimit}
												<p class="flex items-center gap-1">
													<StarsIcon class="h-4 w-4 text-yellow-500" />
													<span class="font-bold text-yellow-500">Sin tope</span>
												</p>
											{/if}
											{#if promotion.paymentMethods && promotion.paymentMethods.length > 0}
												<div
													class="mt-3 flex items-center gap-2 data-[multiple-methods]:flex-col data-[multiple-methods]:items-start"
													data-multiple-methods={promotion.paymentMethods.length > 1}
												>
													<span class="font-medium">Medios de pago:</span>
													<div class="mt-1 flex flex-col flex-wrap gap-2">
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
											{#if promotion.restrictions && promotion.restrictions.length > 0}
												<Accordion.Root type="single" class="w-full space-y-2">
													<Accordion.Item
														value="restrictions"
														class="rounded-md border border-gray-100 px-2"
													>
														<Accordion.Trigger
															class="flex flex-1 items-center justify-between  py-2 font-medium transition-all [&[data-state=open]>svg]:rotate-180"
														>
															<h4 class="text-sm font-semibold">Restricciones</h4>
														</Accordion.Trigger>
														<Accordion.Content class="pb-2 pt-0">
															<ul class="list-disc pl-5 text-xs">
																{#each promotion.restrictions as restriction}
																	<li>{restriction}</li>
																{/each}
															</ul>
														</Accordion.Content>
													</Accordion.Item>
												</Accordion.Root>
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
