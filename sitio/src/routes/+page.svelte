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
	import DiscountCard from '$lib/components/discount-card.svelte';

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
		...data.promotions.carrefour.filter(
			// ignorar Maxi: por ahora solo estamos trackeando minorista en CABA
			(promotion) => !(promotion.where.length === 1 && promotion.where[0] === 'Maxi')
		),
		...data.promotions.coto,
		...data.promotions.dia,
		...data.promotions.jumbo
	];

	let selectedType: 'Presencial' | 'Online' = 'Presencial';
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
		promotions.filter(
			(promotion) =>
				promotion.weekdays?.includes(selectedWeekday) &&
				(selectedType === 'Online'
					? promotion.where.includes('Online')
					: !(promotion.where.length === 1 && promotion.where[0] === 'Online'))
		)
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
		value={selectedType}
		onValueChange={(value) => (selectedType = value as 'Presencial' | 'Online')}
		class="mb-2"
	>
		<TabsList class="gap-2 rounded-full py-6">
			{#each ['Presencial', 'Online'] as type}
				<TabsTrigger value={type} class="rounded-full px-4 text-lg">
					<span class="">{type}</span>
				</TabsTrigger>
			{/each}
		</TabsList>
	</Tabs>

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
