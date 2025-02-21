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
	import { type PaymentMethod } from '@/index';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import type { schema } from '@/db';
	import { BANKS_OR_WALLETS, promotionsTable } from 'promos-db/schema';
	import * as Accordion from '$lib/components/ui/accordion';
	import * as Dialog from '$lib/components/ui/dialog';

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

	$: promotions = [...data.promotions.carrefour, ...data.promotions.coto];

	let selectedWeekday: schema.Weekday = defaultWeekday;

	function formatCurrency(amount: number) {
		return new Intl.NumberFormat('es-AR', {
			style: 'currency',
			currency: 'ARS',
			minimumFractionDigits: 0
		}).format(amount);
	}

	function isPaymentMethod(method: string): method is PaymentMethod {
		return method in logos;
	}
	function groupPromotionsByPaymentMethod(promotions: schema.Promotion[]) {
		const grouped = new Map<
			(typeof BANKS_OR_WALLETS)[number] | 'other',
			(typeof promotions)[number][]
		>();

		for (const wallet of BANKS_OR_WALLETS) {
			grouped.set(wallet, []);
		}

		grouped.set('other', []);

		for (const promotion of promotions) {
			let found = false;
			for (const wallet of BANKS_OR_WALLETS) {
				if (
					promotion.paymentMethods?.some((method) =>
						typeof method === 'string' ? method === wallet : method.some((m) => m === wallet)
					)
				) {
					grouped.set(wallet, [...(grouped.get(wallet) || []), promotion]);
					found = true;
				}
			}
			if (!found) {
				grouped.set('other', [...(grouped.get('other') || []), promotion]);
			}
		}

		// Filter out empty arrays
		for (const [key, value] of Array.from(grouped.entries())) {
			if (Array.isArray(value) && value.length === 0) {
				grouped.delete(key);
			}
		}

		return grouped;
	}
	$: groupedPromotionsForToday = Object.fromEntries(
		groupPromotionsByPaymentMethod(
			promotions.filter((promotion) => promotion.weekdays?.includes(selectedWeekday))
		)
	);
</script>

<div class="container mx-auto px-4 py-4">
	<h1 class="flex items-center gap-2 text-3xl font-bold">
		descuentito.ar
		<Badge variant="destructive">beta :)</Badge>
	</h1>
	<h2 class="mb-2 text-lg font-medium">Descuentos en Carrefour y Coto</h2>

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
					{#each Object.entries(groupedPromotionsForToday) as [paymentMethod, promotions]}
						{#if promotions.length > 0}
							<div class="bg-card text-card-foreground rounded-lg border shadow-sm">
								<div class="space-between flex items-center p-6 pb-0">
									<div class="flex items-center gap-2">
										{#if isPaymentMethod(paymentMethod)}
											<enhanced:img
												src={logos[paymentMethod]}
												alt={paymentMethod}
												class="h-8 w-auto"
											/>
										{/if}
										<h3 class="text-lg font-semibold leading-none tracking-tight">
											{paymentMethod}
										</h3>
									</div>
								</div>
								<div class="p-6 pt-2">
									<div class="space-y-2">
										{#each promotions as promotion}
											<Dialog.Root>
												<Dialog.Trigger class="w-full">
													<div
														class="hover:bg-accent flex items-center justify-between rounded-lg border p-2"
													>
														<div class="flex flex-col items-start gap-1 text-left">
															<span class="font-medium">{promotion.title}</span>
															<div class="flex flex-row gap-1">
																<Badge variant="default">
																	{promotion.source}
																</Badge>

																<Badge variant="secondary">
																	{#each promotion.where as where}
																		{where}{#if where !== promotion.where[promotion.where.length - 1]}{', '}
																		{/if}
																	{/each}
																</Badge>

																{#if promotion.limits?.maxDiscount}
																	<Badge variant="outline">
																		Tope: {formatCurrency(promotion.limits.maxDiscount)}
																	</Badge>
																{:else if promotion.limits?.explicitlyHasNoLimit}
																	<Badge variant="yellow" class="gap-1">
																		<StarsIcon class="h-4 w-4" />
																		Sin tope
																	</Badge>
																{/if}
															</div>
														</div>
														<ChevronDown class="h-4 w-4" />
													</div>
												</Dialog.Trigger>
												<Dialog.Content>
													<Dialog.Header>
														<Dialog.Title>{promotion.title}</Dialog.Title>
													</Dialog.Header>
													<div class="space-y-4">
														{#if promotion.where?.length > 0}
															<div>
																<h4 class="font-medium">Comprando en:</h4>
																<p>
																	{#each promotion.where as where}
																		<span class="font-medium">{where}</span
																		>{#if where !== promotion.where[promotion.where.length - 1]},{' '}
																		{/if}
																	{/each}
																</p>
															</div>
														{/if}
														{#if promotion.limits?.maxDiscount}
															<div>
																<h4 class="font-medium">Tope de descuento:</h4>
																<p class="font-medium">
																	{formatCurrency(promotion.limits.maxDiscount)}
																</p>
															</div>
														{/if}
														{#if promotion.limits?.explicitlyHasNoLimit}
															<p class="flex items-center gap-1">
																<StarsIcon class="h-4 w-4 text-yellow-500" />
																<span class="font-bold text-yellow-500">Sin tope</span>
															</p>
														{/if}
														{#if promotion.membership && promotion.membership.length > 0}
															<div>
																<h4 class="font-medium">Beneficio exclusivo para:</h4>
																<p>
																	{#each promotion.membership as membership}
																		<span class="font-medium">{membership}</span
																		>{#if membership !== promotion.membership[promotion.membership.length - 1]},{' '}
																		{/if}
																	{/each}
																</p>
															</div>
														{/if}
														{#if promotion.paymentMethods && promotion.paymentMethods.length > 0}
															<div>
																<h4 class="font-medium">Medios de pago:</h4>
																<div class="mt-1 flex flex-col gap-2">
																	{#each promotion.paymentMethods as methods}
																		{#if Array.isArray(methods)}
																			<div class="flex flex-wrap items-center gap-2">
																				{#each methods as methodItem}
																					{#if isPaymentMethod(methodItem)}
																						<enhanced:img
																							src={logos[methodItem]}
																							alt={methodItem}
																							class="h-6 w-auto"
																						/>
																					{:else}
																						<Badge variant="secondary">
																							{methodItem}
																						</Badge>
																					{/if}
																					{#if methodItem !== methods[methods.length - 1]}
																						<span>+</span>
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
															<div>
																<h4 class="font-medium">Restricciones:</h4>
																<ul class="list-disc pl-5 text-sm">
																	{#each promotion.restrictions as restriction}
																		<li>{restriction}</li>
																	{/each}
																</ul>
															</div>
														{/if}
													</div>
													<div class="mt-4">
														<Button
															variant="outline"
															href={promotion.url}
															target="_blank"
															rel="noopener noreferrer"
															class="w-full"
														>
															<ExternalLinkIcon class="h-4 w-4" />
															Ver más detalles
														</Button>
													</div>
												</Dialog.Content>
											</Dialog.Root>
										{/each}
									</div>
								</div>
							</div>
						{/if}
					{/each}
				</div>
			</TabsContent>
		{/each}
	</Tabs>
</div>
