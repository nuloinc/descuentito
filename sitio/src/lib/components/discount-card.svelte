<script module lang="ts">
	import pMemoize from 'p-memoize';
	const getRestrictionSummary = pMemoize(
		async (text: string) => {
			if (
				['N/A', 'TODO EL SURTIDO', 'TODOS LOS PRODUCTOS', 'ELECTRODOMESTICOS', 'LIBRERIA'].includes(
					text.replaceAll(/ó/gu, 'o').replaceAll(/í/giu, 'i').replaceAll(/é/giu, 'e').toUpperCase()
				)
			)
				return text;
			if (text.toLowerCase() === 'electro') return 'Electrodomésticos';

			const res = await fetch('https://nulo-productsummaryapi.web.val.run', {
				method: 'POST',
				body: JSON.stringify({ description: text })
			});
			if (!res.ok) {
				return text;
			}
			const data: { summary: string } = await res.json();
			return data.summary;
		},
		{ cacheKey: ([t]) => t.toLowerCase() }
	);
	const CURRENCY_FORMATTER = new Intl.NumberFormat('es-AR', {
		style: 'currency',
		currency: 'ARS',
		minimumFractionDigits: 0
	});
</script>

<script lang="ts">
	import type * as schema from 'promos-db/schema';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { ChevronDown, ExternalLinkIcon, StarsIcon, WalletCards } from 'lucide-svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Alert from '$lib/components/ui/alert';
	import PaymentMethodLogo from '@/components/payment-method-logo.svelte';
	import { PAYMENT_METHODS, PAYMENT_RAILS } from 'promos-db/schema';
	import type { PaymentMethod } from 'promos-db/schema';
	import { LOGOS, WALLET_ICONS } from '@/logos';
	import BrandLogo from './brand-logos.svelte';
	import { ScrollArea } from './ui/scroll-area';
	import { filteringByPaymentMethods, savedPaymentMethods } from '..';

	export let discount: schema.Discount;
	export let selectedType: 'Presencial' | 'Online';

	function formatCurrency(amount: number) {
		if (amount > 1000 && amount % 1000 === 0) {
			return `$${amount / 1000}mil`;
		}

		return CURRENCY_FORMATTER.format(amount);
	}

	function isPaymentMethod(method: string): method is PaymentMethod {
		return PAYMENT_METHODS.includes(method as PaymentMethod);
	}

	type MergedInstallmentsDiscount = {
		discount: {
			type: 'merged cuotas sin intereses';
			installmentOptions: number[];
		};
	} & Omit<schema.Discount, 'discount'>;

	type RenderedDiscount = schema.Discount | MergedInstallmentsDiscount;

	// function mergeInstallmentDiscounts(discounts: readonly schema.Discount[]): RenderedDiscount[] {
	// 	const originalDiscounts = [...discounts];
	// 	let mergedDiscounts: RenderedDiscount[] = [];

	// 	while (originalDiscounts.length > 0) {
	// 		const discount = originalDiscounts.shift()!;
	// 		if (discount?.discount.type === 'cuotas sin intereses') {
	// 			const existingDiscountIndex = mergedDiscounts.findIndex(
	// 				(
	// 					d
	// 				): d is
	// 					| MergedInstallmentsDiscount
	// 					| (schema.Discount & { discount: { type: 'cuotas sin intereses' } }) =>
	// 					d.source === discount.source &&
	// 					(d.discount.type === 'cuotas sin intereses' ||
	// 						d.discount.type === 'merged cuotas sin intereses') &&
	// 					(d.restrictions
	// 						? d.restrictions.every((r) => discount.restrictions?.includes(r))
	// 						: true) &&
	// 					(d.onlyForProducts ? d.onlyForProducts === discount.onlyForProducts : true)
	// 			);
	// 			if (existingDiscountIndex !== -1) {
	// 				const existingDiscount = mergedDiscounts[existingDiscountIndex];
	// 				if (existingDiscount.discount.type === 'merged cuotas sin intereses') {
	// 					existingDiscount.discount.installmentOptions.push(discount.discount.value);
	// 					continue;
	// 				} else {
	// 					mergedDiscounts.push({
	// 						...discount,
	// 						discount: {
	// 							type: 'merged cuotas sin intereses',
	// 							installmentOptions: [existingDiscount.discount.value, discount.discount.value]
	// 						}
	// 					});
	// 					mergedDiscounts.splice(existingDiscountIndex, 1);
	// 					continue;
	// 				}
	// 			}
	// 		}
	// 		mergedDiscounts.push(discount);
	// 	}

	// 	return mergedDiscounts;
	// }

	const APPLIES_ONLY_STRINGS: Record<keyof schema.Discount['appliesOnlyTo'], string> = {
		anses: 'ANSES',
		jubilados: 'Jubilados',
		programaCiudadaniaPorteña: 'Programa Ciudadanía Porteña'
	};

	function processAppliesOnlyTo(appliesOnlyTo: schema.Discount['appliesOnlyTo']): string[] {
		if (!appliesOnlyTo) return [];
		return Object.entries(appliesOnlyTo).flatMap(([key, value]) => {
			if (value) return [APPLIES_ONLY_STRINGS[key as keyof schema.Discount['appliesOnlyTo']]];
			return [];
		});
	}
	$: appliesOnlyTo = processAppliesOnlyTo(discount.appliesOnlyTo);

	function paymentMethodsToIcons(paymentMethods: schema.Discount['paymentMethods']): string[] {
		return (
			paymentMethods
				?.flatMap((method) => {
					if (Array.isArray(method)) return method;
					return method;
				})
				.map((method: string) => {
					return method.split(' - ')[0] as string;
				})
				.filter(
					(method) =>
						!$filteringByPaymentMethods ||
						PAYMENT_RAILS.includes(method as any) ||
						$savedPaymentMethods.has(method as PaymentMethod)
				)
				.filter((method: string) => {
					if (!(method in WALLET_ICONS)) {
						console.log(method, method in WALLET_ICONS);
					}
					return method in WALLET_ICONS;
				})
				.filter(
					(v, i, a) =>
						a.findIndex(
							(v2) => WALLET_ICONS[v2 as PaymentMethod] === WALLET_ICONS[v as PaymentMethod]
						) === i
				) || []
		);
	}
</script>

<div class="bg-card text-card-foreground rounded-lg border px-3 py-2 shadow-md">
	<Dialog.Root>
		<Dialog.Trigger class="flex w-full items-center justify-between">
			<div class="flex items-center gap-2 text-left">
				<BrandLogo
					source={discount.source}
					types={discount.where}
					{selectedType}
					small
					containerClass="flex-grow flex-shrink-0"
					class="!max-h-10 max-w-8"
				/>

				<div class="text-2xl font-black">
					{#if discount.discount.type === 'porcentaje'}
						{discount.discount.value}%
					{:else if discount.discount.type === 'cuotas sin intereses'}
						{discount.discount.value}<span class="text-sm">c/si</span>
					{:else if discount.discount.type === 'merged cuotas sin intereses'}
						{discount.discount.installmentOptions.sort((a, b) => a - b).join(', ')} cuotas sin intereses
					{/if}
				</div>

				<div class="flex flex-shrink flex-col items-start gap-1 pr-1">
					{#if discount.onlyForProducts}
						<Badge
							variant="yellow"
							class="w-36 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs min-[400px]:w-44"
						>
							<span class="overflow-hidden text-ellipsis whitespace-nowrap">
								Solo{' '}
								{#await getRestrictionSummary(discount.onlyForProducts)}
									...
								{:then data}
									{data}
								{/await}
							</span>
						</Badge>
					{/if}
					{#if discount.excludesProducts}
						<Badge variant="destructive" class="gap-1.5 px-2 py-0.5">
							<span class="font-black">!</span>
							Aplican restricciones
						</Badge>
					{/if}

					{#if appliesOnlyTo.length > 0}
						<Badge variant="default" class="gap-1.5">
							<WalletCards class="h-4 w-4" />
							{appliesOnlyTo.join(', ')}
						</Badge>
					{/if}
					{#if discount.membership && discount.membership.length > 0}
						<Badge variant="default" class="gap-1">
							<WalletCards class="h-4 w-4" />
							Solo con {discount.membership.join(' y ')}
						</Badge>
					{/if}

					{#if discount.limits?.maxDiscount}
						<span class="text-sm leading-none"
							>Tope: {formatCurrency(discount.limits.maxDiscount)}</span
						>
					{:else if discount.limits?.explicitlyHasNoLimit}
						<Badge variant="shiny" class="gap-1">
							<StarsIcon class="h-4 w-4" />
							Sin tope
						</Badge>
					{/if}
				</div>
			</div>

			{#if discount.paymentMethods && discount.paymentMethods.length > 0}
				{@const methodIcons = paymentMethodsToIcons(discount.paymentMethods)}
				<div
					class="grid flex-shrink-0 gap-1 {methodIcons.length > 9
						? 'grid-cols-4'
						: methodIcons.length > 4
							? 'grid-cols-3'
							: methodIcons.length > 1
								? 'grid-cols-2'
								: 'grid-cols-1'}"
				>
					{#each methodIcons as method}
						<!-- TODO: mostrar los que no tienen iconos somehow -->
						<img
							src={WALLET_ICONS[method as PaymentMethod]}
							alt={`${String(discount.source)} ${method}`}
							class="h-6 w-6 rounded-sm"
							loading="lazy"
							decoding="async"
						/>
					{/each}
				</div>
			{/if}
		</Dialog.Trigger>
		<Dialog.Content class="p-0">
			<ScrollArea class="max-h-[90vh]">
				<Dialog.Header>
					<Dialog.Title>{discount.title}</Dialog.Title>
				</Dialog.Header>
				<div class="space-y-4 p-4">
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
												{#if isPaymentMethod(methodItem)}
													<PaymentMethodLogo method={methodItem} />
												{:else}
													{methodItem}
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
					{#if discount.excludesProducts}
						<div>
							<h4 class="font-medium">No aplica para:</h4>
							<p class="text-sm text-red-600">{discount.excludesProducts}</p>
						</div>
					{/if}
					<Alert.Root variant="warning">
						<Alert.Title>Verifica los detalles</Alert.Title>
						<Alert.Description
							>Te recomendamos verificar los detalles de la promoción en el sitio de la tienda.</Alert.Description
						>
					</Alert.Root>
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
			</ScrollArea>
		</Dialog.Content>
	</Dialog.Root>
</div>
