<script lang="ts">
	import type { PageData } from './$types';
	import { Badge } from '$lib/components/ui/badge';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import type { schema } from '@/db';
	import { BANKS_OR_WALLETS, PAYMENT_METHODS } from 'promos-db/schema';
	import { dev } from '$app/environment';
	import { TZDate } from '@date-fns/tz';
	import { page } from '$app/stores';
	import DiscountCard from '@/components/discount-card.svelte';
	import SupermarketFilter from '$lib/components/supermarket-filter.svelte';
	import { SOURCES } from '$lib';
	import { format, isWithinInterval, parseISO, addDays, startOfWeek, getDay } from 'date-fns';
	import { es } from 'date-fns/locale';
	export let data: PageData;

	const today = new TZDate(new Date(), 'America/Argentina/Buenos_Aires');

	// Generate dates for current week
	const weekStartDate = startOfWeek(today, { weekStartsOn: 1 }); // Start from Monday
	const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));

	// Format each date as "Weekday Day" (e.g. "Lunes 15")
	const formattedWeekDates = weekDates.map((date) => ({
		id: format(date, 'yyyy-MM-dd'), // Use as ID for tabs
		date: format(date, 'yyyy-MM-dd'),
		display: format(date, 'EEEE d', { locale: es }),
		shortDisplay: format(date, 'EEE d', { locale: es }) // Short weekday name with day
	}));

	// Find today's index in the week dates
	const todayIndex = weekDates.findIndex(
		(date) => format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
	);

	// Default to today, or first day of week if today not in range
	let selectedDateInfo = formattedWeekDates[todayIndex !== -1 ? todayIndex : 0];
	let selectedDate = selectedDateInfo.date;
	let selectedTabId = selectedDateInfo.id;

	$: selectedSupermarket = new URL($page.url).searchParams.get('supermarket');
	function updateSupermarketFilter(supermarket: string | null) {
		const url = new URL($page.url);
		if (supermarket) {
			url.searchParams.set('supermarket', supermarket);
		} else {
			url.searchParams.delete('supermarket');
		}
		history.pushState({}, '', url.toString());
		selectedSupermarket = supermarket;
	}

	$: promotions = [
		...data.promotions.carrefour.filter(
			// ignorar Maxi: por ahora solo estamos trackeando minorista en CABA
			(promotion) => !(promotion.where.length === 1 && promotion.where[0] === 'Maxi')
		),
		...data.promotions.coto,
		...data.promotions.dia,
		...data.promotions.jumbo
	].filter((promotion) => {
		if (selectedSupermarket && selectedSupermarket !== promotion.source) return false;

		const selectedDateObj = parseISO(selectedDate);
		const validFrom = parseISO(promotion.validFrom);
		const validUntil = parseISO(promotion.validUntil);

		const dayIndex = getDay(selectedDateObj);
		const selectedWeekday = (
			['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'] as const
		)[dayIndex];
		if (promotion.weekdays && !promotion.weekdays.includes(selectedWeekday)) return false;

		return isWithinInterval(selectedDateObj, { start: validFrom, end: validUntil });
	});

	let selectedType: 'Presencial' | 'Online' = 'Presencial';

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
			['.Reba', '.Reba - Black'],
			['Banco Ciudad', 'Banco Ciudad - Plan Sueldo y Jubilados'],
			[
				'Banco Supervielle',
				'Banco Supervielle - Plan Sueldo',
				'Banco Supervielle - Identité',
				'Banco Supervielle - Jubilados'
			],
			['Banco Nación', 'Banco Nación - Tarjeta Nativa']
		];
		let joinedGrouped: Record<
			PaymentMethodGroup,
			Record<PaymentMethodGroup, schema.Discount[]>
		> = {} as Record<PaymentMethodGroup, Record<PaymentMethodGroup, schema.Discount[]>>;

		for (const [key, value] of grouped.entries()) {
			const joinedKey = JOIN_GROUPS.find((group) => group.includes(key as any))?.[0];
			if (joinedKey) {
				joinedGrouped[joinedKey] = joinedGrouped[joinedKey] || {};
				joinedGrouped[joinedKey][joinedKey] = joinedGrouped[joinedKey][joinedKey] || [];
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
		promotions.filter((promotion) =>
			selectedType === 'Online'
				? promotion.where.includes('Online')
				: !(promotion.where.length === 1 && promotion.where[0] === 'Online')
		)
	);

	$: {
		if (dev) {
			console.log(groupedPromotionsForToday);
		}
	}
</script>

<div class="container mx-auto px-4 py-4">
	<h1 class="flex items-center gap-2 text-3xl font-bold">
		descuentito.ar
		<Badge variant="destructive">beta :)</Badge>
	</h1>
	<h2 class="mb-2 text-lg font-medium">Descuentos en Carrefour, Coto, Dia y Jumbo</h2>

	<div class="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
		<Tabs
			value={selectedType}
			onValueChange={(value) => (selectedType = value as 'Presencial' | 'Online')}
			class="mb-0"
		>
			<TabsList class="gap-2 rounded-full py-6">
				{#each ['Presencial', 'Online'] as type}
					<TabsTrigger value={type} class="rounded-full px-4 text-lg">
						<span class="">{type}</span>
					</TabsTrigger>
				{/each}
			</TabsList>
		</Tabs>

		<div class="flex-1">
			<SupermarketFilter
				{selectedSupermarket}
				on:select={(e) => updateSupermarketFilter(e.detail)}
			/>
		</div>
	</div>

	<Tabs
		value={selectedTabId}
		onValueChange={(value) => {
			selectedTabId = value;
			selectedDate = formattedWeekDates.find((d) => d.id === value)?.date || selectedDate;
		}}
	>
		<TabsList>
			{#each formattedWeekDates as weekDateInfo}
				<TabsTrigger value={weekDateInfo.id}>
					<span class="hidden md:block">{weekDateInfo.display}</span>
					<span class="block md:hidden">{weekDateInfo.shortDisplay}</span>
				</TabsTrigger>
			{/each}
		</TabsList>
		{#each formattedWeekDates as weekDateInfo}
			<TabsContent value={weekDateInfo.id} class="mt-6">
				<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
					{#each Object.entries(groupedPromotionsForToday) as [mainPaymentMethod, paymentMethods]}
						<DiscountCard
							mainPaymentMethod={mainPaymentMethod as (typeof BANKS_OR_WALLETS)[number] | 'other'}
							{paymentMethods}
							{selectedType}
						/>
					{/each}
				</div>
			</TabsContent>
		{/each}
	</Tabs>
</div>
