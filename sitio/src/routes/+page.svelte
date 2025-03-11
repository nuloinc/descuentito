<script lang="ts">
	import type { PageData } from './$types';
	import { Badge } from '$lib/components/ui/badge';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import type { schema } from '@/db';
	import { BANKS_OR_WALLETS, PAYMENT_METHODS } from 'promos-db/schema';
	import { dev } from '$app/environment';
	import { page } from '$app/stores';
	import DiscountCard from '@/components/discount-card.svelte';
	import SupermarketFilter from '$lib/components/supermarket-filter.svelte';
	import dayjs from 'dayjs';
	import utc from 'dayjs/plugin/utc';
	import timezone from 'dayjs/plugin/timezone';
	import weekday from 'dayjs/plugin/weekday';
	import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
	import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
	dayjs.extend(utc);
	dayjs.extend(timezone);
	dayjs.extend(weekday);
	dayjs.extend(isSameOrAfter);
	dayjs.extend(isSameOrBefore);
	export let data: PageData;

	const weekStartDate = dayjs(undefined, 'America/Argentina/Buenos_Aires').startOf('day');
	const weekDates = Array.from({ length: 7 }, (_, i) => weekStartDate.add(i, 'day'));

	const weekdayFormatter = Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric' });
	const shortWeekdayFormatter = Intl.DateTimeFormat('es', { weekday: 'short' });

	const formattedWeekDates = weekDates.map((date) => ({
		id: date.format('YYYY-MM-DD'),
		date: date.format('YYYY-MM-DD'),
		dayjs: date,
		display: weekdayFormatter.format(date.toDate()),
		shortDisplay: shortWeekdayFormatter.format(date.toDate())
	}));

	const todayIndex = weekDates.findIndex((date) =>
		date.isSame(dayjs(undefined, 'America/Argentina/Buenos_Aires'), 'day')
	);

	let selectedTabId = formattedWeekDates[todayIndex].id;
	$: selectedDateInfo = formattedWeekDates.find((d) => d.id === selectedTabId)!;

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

	const SHOW_CHANGOMAS = new URL($page.url).searchParams.get('showChangomas');

	$: promotions = [
		...data.promotions.carrefour.filter(
			// ignorar Maxi: por ahora solo estamos trackeando minorista en CABA
			(promotion) => !(promotion.where.length === 1 && promotion.where[0] === 'Maxi')
		),
		...data.promotions.coto,
		...data.promotions.dia,
		...data.promotions.jumbo,
		...data.promotions.makro,
		...(SHOW_CHANGOMAS ? data.promotions.changomas : [])
	].filter((promotion) => {
		if (selectedType === 'Online') {
			if (!(promotion.where as string[]).includes('Online')) return false;
		} else {
			if (promotion.where.length === 1 && promotion.where[0] === 'Online') return false;
		}

		if (selectedSupermarket && selectedSupermarket !== promotion.source) return false;

		const selectedWeekday = (
			['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'] as const
		)[selectedDateInfo.dayjs.day()];
		if (promotion.weekdays && !promotion.weekdays.includes(selectedWeekday)) return false;

		const selectedDateObj = selectedDateInfo.dayjs;
		const validFrom = dayjs(promotion.validFrom, 'America/Argentina/Buenos_Aires');
		const validUntil = dayjs(promotion.validUntil, 'America/Argentina/Buenos_Aires');

		return (
			validFrom.isSameOrBefore(selectedDateObj, 'day') &&
			validUntil.isSameOrAfter(selectedDateObj, 'day')
		);
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
				'Banco Supervielle - Identité y Plan Sueldo',
				'Banco Supervielle - Jubilados'
			],
			['Banco Nación', 'Banco Nación - Tarjeta Nativa'],
			['Banco Santander', 'Banco Santander - Jubilados', 'Banco Santander - Women'],
			['Banco Hipotecario', 'Banco Hipotecario - Búho/Plan Sueldo'],
			['Banco Macro', 'Banco Macro - Tarjeta PLATINUM', 'Banco Macro - Tarjeta Selecta']
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
	$: groupedPromotionsForToday = groupPromotionsByPaymentMethod(promotions);

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
		}}
	>
		<TabsList class="mx-auto flex w-fit">
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
