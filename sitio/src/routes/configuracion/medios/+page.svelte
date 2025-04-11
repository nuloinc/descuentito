<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { ArrowLeft } from 'lucide-svelte';
	import { savedPaymentMethods, savedConditions } from '$lib/index';
	import { PAYMENT_METHODS, JOIN_GROUPS } from 'promos-db/schema';
	import type { PaymentMethod } from 'promos-db/schema';
	import { WALLET_ICONS } from '@/logos';
	import { slide } from 'svelte/transition';
	import FilterByPaymentMethodsButton from '$lib/components/filter-by-payment-methods-button.svelte';

	type SubOptionDisplay = {
		id: PaymentMethod;
		question: string; // Generated question
	};

	type BankOptionDisplay = {
		id: PaymentMethod;
		name: string; // Display name
		subOptions?: SubOptionDisplay[];
	};

	function buildDisplayOptions(
		allMethods: readonly PaymentMethod[],
		groups: ReadonlyArray<readonly PaymentMethod[]>
	): BankOptionDisplay[] {
		const optionsMap = new Map<PaymentMethod, BankOptionDisplay>();
		const allGroupChildren = new Set<PaymentMethod>();

		// Initialize map with all methods as potential top-level options
		for (const method of allMethods) {
			optionsMap.set(method, { id: method, name: method, subOptions: [] });
		}

		// Process groups to establish hierarchy and collect children
		for (const group of groups) {
			if (group.length > 1) {
				const parentId = group[0];
				const parentOption = optionsMap.get(parentId);
				if (!parentOption) continue; // Skip if parent doesn't exist

				for (let i = 1; i < group.length; i++) {
					const childId = group[i];
					allGroupChildren.add(childId); // Mark as child
					const childOption = optionsMap.get(childId);
					if (!childOption) continue; // Skip if child doesn't exist

					let question = `¿Especificación: ${childId.replace(parentId, '').trim()}?`;
					if (childId.includes('Eminent')) question = '¿Sos cliente Eminent?';
					if (childId.includes('PLATINUM')) question = '¿Tenés tarjeta Platinum?';
					if (childId.includes('Selecta')) question = '¿Tenés tarjeta Selecta?';
					if (childId.includes('Plan Sueldo')) question = '¿Tenés Plan Sueldo?';
					if (childId.includes('Jubilados')) question = '¿Sos Jubilado/a?';
					if (childId.includes('Women')) question = '¿Tarjeta Women?';
					if (childId.includes('Cliente Payroll')) question = '¿Sos Cliente Payroll?';
					if (childId.includes('Identité')) question = '¿Sos cliente Identité?';
					if (childId.includes('Búho')) question = '¿Tenés cuenta Búho?';
					if (childId.includes('Black')) question = '¿Tarjeta Black?';
					if (childId.includes('Nativa')) question = '¿Tarjeta Nativa?';

					parentOption.subOptions?.push({ id: childId, question });
				}
				// Clean up empty subOptions array if no children were actually added
				if (parentOption.subOptions?.length === 0) {
					parentOption.subOptions = undefined;
				}
			}
		}

		const finalOptions = Array.from(optionsMap.values()).filter(
			(opt) => !allGroupChildren.has(opt.id)
		);

		return finalOptions;
	}

	const displayOptions = buildDisplayOptions(PAYMENT_METHODS, JOIN_GROUPS);

	function updateStore(method: PaymentMethod, isChecked: boolean) {
		const currentSet = new Set(savedPaymentMethods.get());
		if (isChecked) {
			currentSet.add(method);
		} else {
			currentSet.delete(method);
			for (const subOption of displayOptions.find((opt) => opt.id === method)?.subOptions || []) {
				currentSet.delete(subOption.id);
			}
		}
		savedPaymentMethods.set(currentSet);
		// The $effect handles updating the local selectedMethods state if needed
	}

	// https://svelte.dev/playground/7729845536404efcaf1f6c65328df3f2?version=5.26.0
	export function accordion(node: HTMLElement, isOpen: boolean) {
		let initialHeight = node.offsetHeight;
		node.style.height = isOpen ? 'auto' : '0px';
		node.style.overflow = 'hidden';
		return {
			update(isOpen: boolean) {
				let animation = node.animate(
					[
						{
							height: initialHeight + 'px',
							overflow: 'hidden'
						},
						{
							height: 0,
							overflow: 'hidden'
						}
					],
					{ duration: 100, fill: 'both' }
				);
				animation.pause();
				if (!isOpen) {
					animation.play();
				} else {
					animation.reverse();
				}
			}
		};
	}
</script>

<nav class="bg-sidebar sticky top-0 z-10 flex items-center gap-2 border-b p-2">
	<a href="/">
		<ArrowLeft class="h-8 w-8" />
	</a>
	<span class="flex-grow text-left font-medium">Medios de pago</span>
</nav>

<div class="container mx-auto max-w-md p-4">
	<FilterByPaymentMethodsButton
		class="mb-6 {$savedPaymentMethods.size == 0 ? 'pointer-events-none opacity-0' : ''}"
	/>

	<div class="mb-6 space-y-4">
		<div class="space-y-3">
			<div class="flex items-center space-x-3">
				<Checkbox
					id="jubilados"
					checked={$savedConditions.jubilados}
					onCheckedChange={(e) => savedConditions.setKey('jubilados', e)}
				/>
				<Label for="jubilados" class="font-medium">Soy jubilado/a</Label>
			</div>
			<div class="flex items-center space-x-3">
				<Checkbox
					id="anses"
					checked={$savedConditions.anses}
					onCheckedChange={(e) => savedConditions.setKey('anses', e)}
				/>
				<Label for="anses" class="font-medium">Recibo beneficios de ANSES</Label>
			</div>
		</div>
	</div>

	<div class="space-y-6">
		{#each displayOptions as bank (bank.id)}
			{@const bankId = `bank-${bank.id}`}
			{@const isBankChecked = $savedPaymentMethods.has(bank.id)}
			<div class="flex items-stretch space-x-3">
				<Checkbox
					id={bankId}
					checked={isBankChecked}
					onCheckedChange={(e) => updateStore(bank.id, e)}
					class="mt-1"
				/>
				<div class="grid flex-grow gap-1.5">
					<Label for={bankId} class="flex items-center gap-2 font-medium">
						{#if bank.id in WALLET_ICONS}
							<img
								src={WALLET_ICONS[bank.id as PaymentMethod]}
								alt={bank.name}
								class="h-6 w-auto rounded-sm"
							/>
						{/if}
						<span class="flex-grow leading-relaxed">{bank.name}</span>
					</Label>
					{#if isBankChecked && bank.subOptions && bank.subOptions.length > 0}
						<div class="mt-2 space-y-3 pl-6" transition:slide>
							{#each bank.subOptions as subOption (subOption.id)}
								{@const subOptionId = `sub-${subOption.id}`}
								{@const isSubChecked = $savedPaymentMethods.has(subOption.id)}
								<div class="flex items-center space-x-3">
									<Checkbox
										id={subOptionId}
										checked={isSubChecked}
										onCheckedChange={(e) => updateStore(subOption.id, e)}
									/>
									<Label for={subOptionId} class="text-sm font-normal">
										{subOption.question}
									</Label>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>
