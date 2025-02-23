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
	import { BANKS_OR_WALLETS, PAYMENT_METHODS, promotionsTable } from 'promos-db/schema';
	import * as Accordion from '$lib/components/ui/accordion';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Alert from '$lib/components/ui/alert';
	import PaymentMethodLogo from '@/components/payment-method-logo.svelte';

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

	$: promotions = [
		...data.promotions.carrefour,
		...data.promotions.coto,
		...data.promotions.dia,
		...data.promotions.jumbo
	];

	let selectedWeekday: schema.Weekday = defaultWeekday;

	function formatCurrency(amount: number) {
		return new Intl.NumberFormat('es-AR', {
			style: 'currency',
			currency: 'ARS',
			minimumFractionDigits: 0
		}).format(amount);
	}

	function groupPromotionsByPaymentMethod(discounts: schema.Discount[]) {
		const grouped = new Map<
			(typeof BANKS_OR_WALLETS)[number] | 'other',
			(typeof discounts)[number][]
		>();

		for (const wallet of BANKS_OR_WALLETS) {
			grouped.set(wallet, []);
		}

		grouped.set('other', []);

		for (const discount of discounts) {
			let found = false;
			for (const wallet of BANKS_OR_WALLETS) {
				if (
					discount.paymentMethods?.some((method) =>
						typeof method === 'string' ? method === wallet : method.some((m) => m === wallet)
					)
				) {
					grouped.set(wallet, [...(grouped.get(wallet) || []), discount]);
					found = true;
				}
			}
			if (!found) {
				grouped.set('other', [...(grouped.get('other') || []), discount]);
			}
		}

		// Filter out empty arrays
		for (const [key, value] of Array.from(grouped.entries())) {
			if (Array.isArray(value) && value.length === 0) {
				grouped.delete(key);
			}
		}

		type PaymentMethodGroup = (typeof PAYMENT_METHODS)[number] | 'other';

		const JOIN_GROUPS: PaymentMethodGroup[][] = [
			['Banco Credicoop', 'Banco Credicoop - Plan Sueldo'],
			['Banco ICBC', 'Banco ICBC – Cliente Payroll'],
			['Banco Galicia', 'Banco Galicia - Eminent'],
			['Tarjeta Carrefour Crédito', 'Tarjeta Carrefour Prepaga'],
			['.Reba', '.Reba - Black']
		];
		let joinedGrouped: Record<
			PaymentMethodGroup,
			Record<PaymentMethodGroup, schema.Discount[]>
		> = {} as Record<PaymentMethodGroup, Record<PaymentMethodGroup, schema.Discount[]>>;

		for (const [key, value] of grouped.entries()) {
			const joinedKey = JOIN_GROUPS.find((group) => group.includes(key as any))?.[0];
			if (joinedKey) {
				joinedGrouped[joinedKey] = joinedGrouped[joinedKey] || {};
				joinedGrouped[joinedKey][joinedKey] = [];
				joinedGrouped[joinedKey][key as PaymentMethodGroup] = value;
			} else {
				joinedGrouped[key as PaymentMethodGroup] = { [key as PaymentMethodGroup]: value } as Record<
					PaymentMethodGroup,
					schema.Discount[]
				>;
			}
		}
		return joinedGrouped;
	}
	$: groupedPromotionsForToday = groupPromotionsByPaymentMethod(
		promotions.filter((promotion) => promotion.weekdays?.includes(selectedWeekday))
	);

	$: console.log(groupedPromotionsForToday);
</script>

<div class="container mx-auto px-4 py-4">
	<h1 class="flex items-center gap-2 text-3xl font-bold">
		descuentito.ar
		<Badge variant="destructive">beta :)</Badge>
	</h1>
	<h2 class="mb-2 text-lg font-medium">Descuentos en Carrefour, Coto, Dia y Jumbo</h2>

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
					{#each Object.entries(groupedPromotionsForToday) as [mainPaymentMethod, paymentMethods]}
						<div class="bg-card text-card-foreground rounded-lg border shadow-sm">
							<div class="space-between flex items-center p-3 pb-0">
								<div class="flex items-center gap-2 text-lg font-semibold">
									<PaymentMethodLogo method={mainPaymentMethod as keyof typeof logos} />
								</div>
							</div>
							{#each Object.entries(paymentMethods) as [paymentMethod, promotions]}
								{#if paymentMethod !== mainPaymentMethod}
									<h3
										class="border-t px-3 pb-1 pt-3 text-lg font-semibold leading-none tracking-tight"
									>
										<PaymentMethodLogo method={paymentMethod as keyof typeof logos} />
									</h3>
								{/if}
								<div class="space-y-2 p-3">
									{#each promotions as discount}
										<Dialog.Root>
											<Dialog.Trigger class="w-full">
												<div
													class="hover:bg-accent flex items-center justify-between rounded-lg border p-2"
												>
													<div class="flex flex-col items-start gap-1 text-left">
														<div>
															{#if discount.discount.type === 'porcentaje'}
																<strong>{discount.discount.value}%</strong> de descuento
															{:else if discount.discount.type === 'cuotas sin intereses'}
																<strong>{discount.discount.value} cuotas sin intereses</strong>
															{/if}
														</div>
														{#if discount.onlyForProducts}
															<p class=" text-sm">
																⚠️ Solo para productos: {discount.onlyForProducts}
															</p>
														{/if}
														<div>
															{#if discount.paymentMethods && discount.paymentMethods.length > 0}
																<div class="text-muted-foreground text-sm">
																	<ul>
																		{#each discount.paymentMethods as methods}
																			{#if Array.isArray(methods)}
																				<li>
																					{methods
																						.filter((method) => method !== mainPaymentMethod)
																						.join(' + ')}
																				</li>
																			{/if}
																		{/each}
																	</ul>
																</div>
															{/if}
														</div>
														<div class="flex flex-row gap-1">
															<Badge variant="default">
																{discount.source}
															</Badge>

															<Badge variant="secondary">
																{#each discount.where as where}
																	{where}{#if where !== discount.where[discount.where.length - 1]}{', '}
																	{/if}
																{/each}
															</Badge>

															{#if discount.limits?.maxDiscount}
																<Badge variant="outline">
																	Tope: {formatCurrency(discount.limits.maxDiscount)}
																</Badge>
															{:else if discount.limits?.explicitlyHasNoLimit}
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
													<Dialog.Title>{discount.title}</Dialog.Title>
												</Dialog.Header>
												<div class="space-y-4">
													{#if discount.where?.length > 0}
														<div>
															<h4 class="font-medium">Comprando en:</h4>
															<p>
																{#each discount.where as where}
																	<span class="font-medium">{where}</span
																	>{#if where !== discount.where[discount.where.length - 1]},{' '}
																	{/if}
																{/each}
															</p>
														</div>
													{/if}
													{#if discount.limits?.maxDiscount}
														<div>
															<h4 class="font-medium">Tope de descuento:</h4>
															<p class="font-medium">
																{formatCurrency(discount.limits.maxDiscount)}
															</p>
														</div>
													{/if}
													{#if discount.limits?.explicitlyHasNoLimit}
														<p class="flex items-center gap-1">
															<StarsIcon class="h-4 w-4 text-yellow-500" />
															<span class="font-bold text-yellow-500">Sin tope</span>
														</p>
													{/if}
													{#if discount.membership && discount.membership.length > 0}
														<div>
															<h4 class="font-medium">Beneficio exclusivo para:</h4>
															<p>
																{#each discount.membership as membership}
																	<span class="font-medium">{membership}</span
																	>{#if membership !== discount.membership[discount.membership.length - 1]},{' '}
																	{/if}
																{/each}
															</p>
														</div>
													{/if}
													{#if discount.paymentMethods && discount.paymentMethods.length > 0}
														<div>
															<h4 class="font-medium">Medios de pago:</h4>
															<div class="mt-1 flex flex-col gap-2">
																{#each discount.paymentMethods as methods}
																	{#if Array.isArray(methods)}
																		<div class="flex flex-wrap items-center gap-2">
																			{#each methods as methodItem}
																				<PaymentMethodLogo
																					method={methodItem as keyof typeof logos}
																				/>
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
													{#if discount.restrictions && discount.restrictions.length > 0}
														<div>
															<h4 class="font-medium">Restricciones:</h4>
															<ul class="list-disc pl-5 text-sm">
																{#each discount.restrictions as restriction}
																	<li>{restriction}</li>
																{/each}
															</ul>
														</div>
													{/if}
												</div>
												<Alert.Root variant="warning">
													<Alert.Title>Verifica los detalles</Alert.Title>
													<Alert.Description
														>Te recomendamos verificar los detalles de la promoción en el sitio de
														la tienda.</Alert.Description
													>
												</Alert.Root>
												<div class="mt-4">
													<Button
														variant="outline"
														href={discount.url}
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
							{/each}
						</div>
					{/each}
				</div>
			</TabsContent>
		{/each}
	</Tabs>
</div>
