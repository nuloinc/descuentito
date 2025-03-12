<script lang="ts">
	import type { PageData } from './$types';
	import { Badge } from '$lib/components/ui/badge';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import * as Drawer from '$lib/components/ui/drawer';
	import { buttonVariants } from '$lib/components/ui/button';
	import { BANKS_OR_WALLETS, PAYMENT_METHODS, type Discount } from 'promos-db/schema';
	import { dev } from '$app/environment';
	import { page } from '$app/stores';
	import DiscountCard from '@/components/discount-card.svelte';
	import SupermarketFilter from '$lib/components/supermarket-filter.svelte';
	import { Filter } from 'lucide-svelte';
	import dayjs from 'dayjs';
	import utc from 'dayjs/plugin/utc';
	import timezone from 'dayjs/plugin/timezone';
	import weekday from 'dayjs/plugin/weekday';
	import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
	import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
	import { onMount } from 'svelte';
	dayjs.extend(utc);
	dayjs.extend(timezone);
	dayjs.extend(weekday);
	dayjs.extend(isSameOrAfter);
	dayjs.extend(isSameOrBefore);
	export let data: PageData;

	const weekStartDate = dayjs().tz('America/Argentina/Buenos_Aires').startOf('day');
	const weekDates = Array.from({ length: 7 }, (_, i) => weekStartDate.add(i, 'day'));

	const weekdayFormatter = Intl.DateTimeFormat('es', {
		weekday: 'long',
		day: 'numeric',
		timeZone: 'America/Argentina/Buenos_Aires'
	});
	const shortWeekdayFormatter = Intl.DateTimeFormat('es', {
		weekday: 'short',
		timeZone: 'America/Argentina/Buenos_Aires'
	});

	const formattedWeekDates = weekDates.map((date) => ({
		id: date.format('YYYY-MM-DD'),
		date: date.format('YYYY-MM-DD'),
		dayjs: date,
		display: weekdayFormatter.format(date.toDate()),
		shortDisplay: shortWeekdayFormatter.format(date.toDate()),
		weekday: (['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'] as const)[
			date.day()
		]
	}));

	const todayIndex = weekDates.findIndex((date) =>
		date.isSame(dayjs().tz('America/Argentina/Buenos_Aires'), 'day')
	);

	let selectedTabId = formattedWeekDates[todayIndex].id;
	let currentContentIndex = todayIndex;
	$: selectedDateInfo = formattedWeekDates.find((d) => d.id === selectedTabId)!;

	// References for scroll functionality
	let contentContainer: HTMLElement;
	let contentElements: HTMLElement[] = [];
	let lastScrollTime = 0;
	const SCROLL_THROTTLE = 100; // ms between scroll updates

	// Function to update tab based on scroll position
	function updateTabFromScroll() {
		if (!contentContainer) return;

		const now = Date.now();
		if (now - lastScrollTime < SCROLL_THROTTLE) return;
		lastScrollTime = now;

		// Find the centered element
		const containerWidth = contentContainer.clientWidth;
		const scrollLeft = contentContainer.scrollLeft;
		const centerPoint = scrollLeft + containerWidth / 2;

		for (let i = 0; i < contentElements.length; i++) {
			const el = contentElements[i];
			if (!el) continue;

			const elLeft = el.offsetLeft;
			const elWidth = el.offsetWidth;
			const elRight = elLeft + elWidth;

			if (elLeft <= centerPoint && elRight >= centerPoint) {
				if (currentContentIndex !== i) {
					currentContentIndex = i;
					selectedTabId = formattedWeekDates[i].id;
				}
				break;
			}
		}
	}

	// Scroll to the content on mount
	onMount(() => {
		if (contentContainer && contentElements[todayIndex]) {
			scrollToDay(todayIndex);
		}

		// Set up content scroll observer
		if (contentContainer) {
			setupContentScrollObserver();
		}
	});

	function setupContentScrollObserver() {
		// Add scroll event listener for real-time updates
		contentContainer.addEventListener('scroll', updateTabFromScroll, { passive: true });

		// Enhanced snap behavior
		let scrollEndTimer: ReturnType<typeof setTimeout>;
		contentContainer.addEventListener(
			'scroll',
			() => {
				// Update throttling for tab updates
				const now = Date.now();
				if (now - lastScrollTime < SCROLL_THROTTLE) return;
				lastScrollTime = now;

				// Clear any previous timeout
				clearTimeout(scrollEndTimer);

				// Set new timeout for when scrolling stops
				scrollEndTimer = setTimeout(() => {
					// Find the closest snap point
					const containerWidth = contentContainer.clientWidth;
					const scrollLeft = contentContainer.scrollLeft;
					const centerPoint = scrollLeft + containerWidth / 2;

					let closestIndex = 0;
					let closestDistance = Infinity;

					// Find element closest to center point
					for (let i = 0; i < contentElements.length; i++) {
						const el = contentElements[i];
						if (!el) continue;

						const elCenter = el.offsetLeft + el.offsetWidth / 2;
						const distance = Math.abs(centerPoint - elCenter);

						if (distance < closestDistance) {
							closestDistance = distance;
							closestIndex = i;
						}
					}

					// Force snap to the closest element
					if (closestIndex !== currentContentIndex) {
						contentElements[closestIndex].scrollIntoView({
							behavior: 'auto',
							inline: 'center'
						});
						currentContentIndex = closestIndex;
						selectedTabId = formattedWeekDates[closestIndex].id;
					} else {
						// Even if it's the same element, ensure perfect alignment
						contentContainer.scrollTo({
							left: contentElements[closestIndex].offsetLeft,
							behavior: 'auto'
						});
					}
				}, 150); // Short timeout for responsive feel
			},
			{ passive: true }
		);

		// Also use Intersection Observer as a backup for better browser support
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						const index = contentElements.findIndex((el) => el === entry.target);
						if (index !== -1 && index !== currentContentIndex) {
							currentContentIndex = index;
							selectedTabId = formattedWeekDates[index].id;
						}
						break;
					}
				}
			},
			{
				root: contentContainer,
				threshold: 0.7,
				rootMargin: '0px'
			}
		);

		// Observe all content sections
		contentElements.forEach((el) => {
			if (el) observer.observe(el);
		});

		return () => {
			contentContainer.removeEventListener('scroll', updateTabFromScroll);
			clearTimeout(scrollEndTimer);
			contentElements.forEach((el) => {
				if (el) observer.unobserve(el);
			});
		};
	}

	function scrollToDay(index: number) {
		if (contentElements[index]) {
			contentContainer.scrollTo({
				left: contentElements[index].offsetLeft,
				behavior: 'smooth'
			});
		}
	}

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

	type PromotionType = 'Todos' | 'Descuentos' | 'Cuotas';
	let selectedPromotionType: PromotionType = 'Todos';

	$: basePromotions = [
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

		if (selectedPromotionType === 'Descuentos' && promotion.discount.type !== 'porcentaje')
			return false;
		if (selectedPromotionType === 'Cuotas' && promotion.discount.type !== 'cuotas sin intereses')
			return false;

		return true;
	});

	// Pre-filter promotions for each weekday
	$: promotionsByWeekday = formattedWeekDates.map((weekDateInfo) => {
		// Filter promotions for this specific day
		const dayPromotions = basePromotions.filter((promotion) => {
			// Filter by weekday
			if (promotion.weekdays && !promotion.weekdays.includes(weekDateInfo.weekday)) return false;

			// Filter by valid date range
			const weekdayDate = weekDateInfo.dayjs;
			const validFrom = dayjs(promotion.validFrom, 'America/Argentina/Buenos_Aires');
			const validUntil = dayjs(promotion.validUntil, 'America/Argentina/Buenos_Aires');

			return (
				validFrom.isSameOrBefore(weekdayDate, 'day') && validUntil.isSameOrAfter(weekdayDate, 'day')
			);
		});

		// Group the filtered promotions by payment method
		return groupPromotionsByPaymentMethod(dayPromotions);
	});

	let selectedType: 'Presencial' | 'Online' = 'Presencial';

	function groupPromotionsByPaymentMethod(discounts: Discount[]) {
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
			Record<PaymentMethodGroup, Discount[]>
		> = {} as Record<PaymentMethodGroup, Record<PaymentMethodGroup, Discount[]>>;

		for (const [key, value] of grouped.entries()) {
			const joinedKey = JOIN_GROUPS.find((group) => group.includes(key as any))?.[0];
			if (joinedKey) {
				joinedGrouped[joinedKey] = joinedGrouped[joinedKey] || {};
				joinedGrouped[joinedKey][joinedKey] = joinedGrouped[joinedKey][joinedKey] || [];
				joinedGrouped[joinedKey][key as PaymentMethodGroup] = value;
			} else {
				joinedGrouped[key as PaymentMethodGroup] = { [key as PaymentMethodGroup]: value } as Record<
					PaymentMethodGroup,
					Discount[]
				>;
			}
		}
		return joinedGrouped;
	}

	$: {
		if (dev) {
			console.log('Promotions by weekday:', promotionsByWeekday);
		}
	}
</script>

<div class="site-container relative">
	<div class="title-container bg-sidebar pb-2 pt-4">
		<div class="container mx-auto px-4">
			<h1 class="flex items-center gap-2 text-3xl font-bold">
				descuentito.ar
				<Badge variant="destructive">beta :)</Badge>
			</h1>
			<h2 class="text-lg font-medium">Descuentos en supermercados de CABA</h2>
		</div>
	</div>

	<header
		class="sticky-header bg-sidebar/70 sticky left-0 right-0 top-0 z-40 w-full py-2 shadow-md backdrop-blur transition-all duration-300 ease-in-out"
	>
		<div class="mx-auto w-full">
			<div class="flex items-center justify-between gap-2 px-2">
				<div class="none">
					<Drawer.Root>
						<Drawer.Trigger
							class={`${buttonVariants({ variant: 'outline', size: 'icon' })} md:hidden`}
						>
							<Filter class="h-4 w-4" />
						</Drawer.Trigger>
						<Drawer.Trigger class={`${buttonVariants({ variant: 'outline' })} hidden md:flex`}>
							<Filter class="h-4 w-4" />
							<span class="">Filtros</span>
						</Drawer.Trigger>
						<Drawer.Content>
							<div class="mx-auto w-full max-w-sm">
								<Drawer.Header>
									<Drawer.Title>Filtros</Drawer.Title>
									<Drawer.Description>Personaliza tu búsqueda de promociones</Drawer.Description>
								</Drawer.Header>
								<div class="p-4">
									<div class="mb-4">
										<h3 class="mb-2 font-medium">Tipo de compra</h3>
										<Tabs
											value={selectedType}
											onValueChange={(value) => (selectedType = value as 'Presencial' | 'Online')}
											class="mb-4"
										>
											<TabsList class="w-full gap-2 rounded-full py-6">
												{#each ['Presencial', 'Online'] as type}
													<TabsTrigger value={type} class="w-1/2 rounded-full px-4 text-lg">
														<span class="">{type}</span>
													</TabsTrigger>
												{/each}
											</TabsList>
										</Tabs>
									</div>

									<div class="mb-4">
										<h3 class="mb-2 font-medium">Supermercado</h3>
										<SupermarketFilter
											{selectedSupermarket}
											on:select={(e) => updateSupermarketFilter(e.detail)}
										/>
									</div>

									<div class="mb-4">
										<h3 class="mb-2 font-medium">Tipo de promoción</h3>
										<Tabs
											value={selectedPromotionType}
											onValueChange={(value) => (selectedPromotionType = value as PromotionType)}
											class="mb-4"
										>
											<TabsList class="w-full gap-2 rounded-full py-6">
												{#each ['Todos', 'Descuentos', 'Cuotas'] as type}
													<TabsTrigger value={type} class="flex-1 rounded-full px-4 text-lg">
														<span class="">{type}</span>
													</TabsTrigger>
												{/each}
											</TabsList>
										</Tabs>
									</div>
								</div>
								<Drawer.Footer>
									<Drawer.Close class={buttonVariants({ variant: 'default' })}>
										Aplicar filtros
									</Drawer.Close>
								</Drawer.Footer>
							</div>
						</Drawer.Content>
					</Drawer.Root>
				</div>

				<Tabs
					value={selectedTabId}
					onValueChange={(value) => {
						const index = formattedWeekDates.findIndex((date) => date.id === value);
						selectedTabId = value;
						currentContentIndex = index;
						scrollToDay(index);
					}}
					class="mx-auto mb-0  md:mx-0"
				>
					<TabsList class="flex md:gap-1">
						{#each formattedWeekDates as weekDateInfo}
							<TabsTrigger value={weekDateInfo.id} class="xs:px-4 px-2.5">
								<span class="hidden lg:block">{weekDateInfo.display}</span>
								<span class="block lg:hidden">{weekDateInfo.shortDisplay}</span>
							</TabsTrigger>
						{/each}
					</TabsList>
				</Tabs>
				<!-- 
				<div class="ml-auto">
					<div class="text-right text-sm">
						<span class="font-medium">{selectedType}</span>
						{#if selectedSupermarket && selectedSupermarket in data.promotions}
							· <span class="font-medium">{SUPERMARKET_NAMES[selectedSupermarket]}</span>
						{/if}
						{#if selectedPromotionType !== 'Todos'}
							· <span class="font-medium">{selectedPromotionType}</span>
						{/if}
						· <span class="font-medium">{selectedDateInfo.display}</span>
					</div>
				</div> -->
			</div>
		</div>
	</header>

	<!-- Content container with horizontal scrolling -->
	<div
		bind:this={contentContainer}
		class="scrollbar-hide flex w-full snap-x snap-mandatory overflow-x-auto pt-3"
		style="scroll-behavior: smooth; -webkit-overflow-scrolling: auto; overscroll-behavior-x: contain; will-change: scroll-position; scroll-snap-type: x mandatory; scroll-snap-stop: always;"
	>
		{#each formattedWeekDates as weekDateInfo, index}
			<div
				bind:this={contentElements[index]}
				class="w-full min-w-full flex-shrink-0 flex-grow-0 snap-center px-1 opacity-30 transition-opacity duration-300 ease-out"
				class:!opacity-100={index === currentContentIndex}
				style="scroll-snap-align: center; scroll-snap-stop: always;"
			>
				<div class="grid grid-cols-1 gap-6 px-2 md:grid-cols-2 lg:grid-cols-3">
					{#each Object.entries(promotionsByWeekday[index]) as [mainPaymentMethod, paymentMethods]}
						<DiscountCard
							mainPaymentMethod={mainPaymentMethod as (typeof BANKS_OR_WALLETS)[number] | 'other'}
							{paymentMethods}
							{selectedType}
						/>
					{/each}
					{#if Object.values(promotionsByWeekday[index]).length === 0}
						<div class="col-span-full">
							<p class="text-center text-sm text-gray-500">No hay promociones para este día</p>
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.scrollbar-hide {
		-ms-overflow-style: none; /* IE and Edge */
		scrollbar-width: none; /* Firefox */
	}
	.scrollbar-hide::-webkit-scrollbar {
		display: none; /* Chrome, Safari and Opera */
	}
</style>
