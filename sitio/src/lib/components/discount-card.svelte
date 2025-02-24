<script lang="ts">
	import type { schema } from '@/db';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { ChevronDown, ExternalLinkIcon, StarsIcon } from 'lucide-svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Alert from '$lib/components/ui/alert';
	import PaymentMethodLogo from '@/components/payment-method-logo.svelte';
	import type { BANKS_OR_WALLETS } from 'promos-db/schema';
	import { PAYMENT_METHODS } from 'promos-db/schema';
	import type { PaymentMethod } from 'promos-db/schema';
	import { logos } from '@/logos';
	import BrandLogo from './brand-logos.svelte';

	export let mainPaymentMethod: (typeof BANKS_OR_WALLETS)[number] | 'other';
	export let paymentMethods: Record<(typeof PAYMENT_METHODS)[number] | 'other', schema.Discount[]>;
	export let selectedType: 'Presencial' | 'Online';

	function formatCurrency(amount: number) {
		return new Intl.NumberFormat('es-AR', {
			style: 'currency',
			currency: 'ARS',
			minimumFractionDigits: 0
		}).format(amount);
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

	function mergeInstallmentDiscounts(discounts: readonly schema.Discount[]): RenderedDiscount[] {
		const originalDiscounts = [...discounts];
		let mergedDiscounts: RenderedDiscount[] = [];

		while (originalDiscounts.length > 0) {
			const discount = originalDiscounts.shift()!;
			if (discount?.discount.type === 'cuotas sin intereses') {
				const existingDiscountIndex = mergedDiscounts.findIndex(
					(
						d
					): d is
						| MergedInstallmentsDiscount
						| (schema.Discount & { discount: { type: 'cuotas sin intereses' } }) =>
						(d.discount.type === 'cuotas sin intereses' ||
							d.discount.type === 'merged cuotas sin intereses') &&
						d.restrictions
							? d.restrictions.every((r) => discount.restrictions?.includes(r))
							: true
				);
				if (existingDiscountIndex !== -1) {
					const existingDiscount = mergedDiscounts[existingDiscountIndex];
					if (existingDiscount.discount.type === 'merged cuotas sin intereses') {
						existingDiscount.discount.installmentOptions.push(discount.discount.value);
						continue;
					} else {
						mergedDiscounts.push({
							...discount,
							discount: {
								type: 'merged cuotas sin intereses',
								installmentOptions: [existingDiscount.discount.value, discount.discount.value]
							}
						});
						mergedDiscounts.splice(existingDiscountIndex, 1);
						continue;
					}
				}
			}
			mergedDiscounts.push(discount);
		}

		return mergedDiscounts;
	}
</script>

<div class="bg-card text-card-foreground rounded-lg border shadow-sm">
	<div class="space-between flex items-center p-3 pb-0">
		<div class="flex items-center gap-2 text-lg font-semibold">
			{#if isPaymentMethod(mainPaymentMethod)}
				<PaymentMethodLogo method={mainPaymentMethod} />
			{:else}
				{mainPaymentMethod}
			{/if}
		</div>
	</div>
	{#each Object.entries(paymentMethods) as [paymentMethod, discounts]}
		{#if paymentMethod !== mainPaymentMethod}
			<h3 class="border-t px-3 pb-1 pt-3 text-lg font-semibold leading-none tracking-tight">
				{#if isPaymentMethod(paymentMethod)}
					<PaymentMethodLogo method={paymentMethod} />
				{:else}
					{paymentMethod}
				{/if}
			</h3>
		{/if}
		<div class="space-y-2 p-3">
			{#each mergeInstallmentDiscounts(discounts) as discount}
				<Dialog.Root>
					<Dialog.Trigger class="w-full">
						<div class="hover:bg-accent flex items-center justify-between rounded-lg border p-2">
							<div class="flex flex-col items-start gap-1 text-left">
								<BrandLogo source={discount.source} types={discount.where} {selectedType} />

								<div>
									{#if discount.discount.type === 'porcentaje'}
										<strong>{discount.discount.value}%</strong> de descuento
									{:else if discount.discount.type === 'cuotas sin intereses'}
										<strong>{discount.discount.value} cuotas sin intereses</strong>
									{:else if discount.discount.type === 'merged cuotas sin intereses'}
										<strong>
											{discount.discount.installmentOptions.sort((a, b) => a - b).join(', ')} cuotas
											sin intereses
										</strong>
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
															{methods.filter((method) => method !== mainPaymentMethod).join(' + ')}
														</li>
													{/if}
												{/each}
											</ul>
										</div>
									{/if}
								</div>

								<div class="flex flex-row gap-1">
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
						</div>
						<Alert.Root variant="warning">
							<Alert.Title>Verifica los detalles</Alert.Title>
							<Alert.Description
								>Te recomendamos verificar los detalles de la promoción en el sitio de la tienda.</Alert.Description
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
