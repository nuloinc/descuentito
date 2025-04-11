<script lang="ts">
	import type { PageData } from './$types';
	import { Badge } from '$lib/components/ui/badge';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import * as Drawer from '$lib/components/ui/drawer';
	import { buttonVariants } from '$lib/components/ui/button';
	import {
		BANKS_OR_WALLETS,
		JOIN_GROUPS,
		PAYMENT_METHODS,
		type Discount,
		type PaymentMethodGroup
	} from 'promos-db/schema';
	import { dev } from '$app/environment';
	import { page } from '$app/stores';
	import DiscountCard from '@/components/discount-card.svelte';
	import SupermarketFilter from '$lib/components/supermarket-filter.svelte';
	import { Filter, Sparkles } from 'lucide-svelte';
	import dayjs from 'dayjs';
	import utc from 'dayjs/plugin/utc';
	import timezone from 'dayjs/plugin/timezone';
	import weekday from 'dayjs/plugin/weekday';
	import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
	import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
	import { onMount } from 'svelte';
	import FilterByPaymentMethodsButton from '@/components/filter-by-payment-methods-button.svelte';
	import { filteringByPaymentMethods, savedPaymentMethods } from '@/index';
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

		if (promotion.paymentMethods && $filteringByPaymentMethods) {
			if (
				!Array.from(promotion.paymentMethods).some((pm) =>
					Array.isArray(pm)
						? pm.some((pm2) => $savedPaymentMethods.has(pm2 as any))
						: $savedPaymentMethods.has(pm as any)
				)
			)
				return false;
		}

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
		return dayPromotions;
	});

	let selectedType: 'Presencial' | 'Online' = 'Presencial';

	let isOpen = false;
</script>

<div class="site-container bg-background relative">
	<div class="title-container bg-sidebar pb-2 pt-4">
		<div class="container mx-auto px-4">
			<h1 class="flex items-center gap-2 text-3xl font-bold">
				descuentito.ar
				<Badge variant="destructive">beta :)</Badge>
			</h1>
			<h2 class="text-lg font-medium">Descuentos en supermercados de CABA</h2>

			{#if $savedPaymentMethods.size > 0}
				<FilterByPaymentMethodsButton class="mt-2" />
				<a
					href="/configuracion/medios"
					class="mt-2 flex w-full items-center space-x-2 rounded-md border p-3 text-sm ring-1 ring-gray-300 transition-all"
				>
					<span class="flex-grow font-medium">Configurar mis medios de pago guardados</span>
					<span class="text-gray-500">→</span>
				</a>
			{:else}
				<a
					href="/configuracion/medios"
					class="mt-2 flex w-full items-center space-x-2 rounded-md border border-yellow-300 bg-gradient-to-r from-yellow-100/70 to-amber-100/70 p-3 text-sm shadow-sm transition-all hover:bg-gradient-to-r hover:from-yellow-200/70 hover:to-amber-200/70"
				>
					<Sparkles class="mr-1 h-8 w-8 text-yellow-500" />
					<span class="flex-grow font-medium"
						>Configura tus medios de pago para ver descuentos personalizados</span
					>
					<span class="text-amber-600">→</span>
				</a>
			{/if}
		</div>
	</div>

	<header
		class="sticky-header bg-sidebar/70 sticky left-0 right-0 top-0 z-40 w-full py-2 shadow-md backdrop-blur transition-all duration-300 ease-in-out"
	>
		<div class="mx-auto w-full">
			<div class="flex items-center justify-between gap-2 px-2">
				<Tabs
					value={selectedTabId}
					onValueChange={(value) => {
						const index = formattedWeekDates.findIndex((date) => date.id === value);
						selectedTabId = value;
						currentContentIndex = index;
						scrollToDay(index);
					}}
					class="mx-auto mb-0"
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
				<div class="mx-auto grid max-w-screen-md grid-cols-1 gap-4 px-2">
					{#each promotionsByWeekday[index] as discount}
						<DiscountCard {selectedType} {discount} />
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

	<Drawer.Root bind:open={isOpen}>
		<Drawer.Trigger
			class={`bg-sidebar text-primary sticky bottom-0 z-50 flex w-full flex-col items-center justify-center gap-2 rounded-t-[10px] px-4 pb-2 text-lg font-medium shadow-xl`}
			onmousedown={(e) => {
				e.preventDefault();
				isOpen = true;
				return false;
			}}
		>
			<div class="bg-muted mx-auto mt-4 h-2 w-[100px] rounded-full"></div>
			<div class="flex items-center gap-2">
				<Filter class="h-4 w-4" />
				<span class="">Filtros</span>
			</div>
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

<style>
	.scrollbar-hide {
		-ms-overflow-style: none; /* IE and Edge */
		scrollbar-width: none; /* Firefox */
	}
	.scrollbar-hide::-webkit-scrollbar {
		display: none; /* Chrome, Safari and Opera */
	}
</style>
