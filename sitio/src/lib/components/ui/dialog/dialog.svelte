{
<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";
	import { fade } from "svelte/transition";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: DialogPrimitive.Props = $props();
</script>

<DialogPrimitive.Root bind:ref {...restProps}>
	<DialogPrimitive.Trigger class={className}>
		{@render children?.()}
	</DialogPrimitive.Trigger>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay
			transition={fade}
			class="fixed inset-0 z-50 bg-black/80"
			transitionConfig={{ duration: 150 }}
		/>
		<div class="fixed inset-0 z-50 flex items-center justify-center">
			<DialogPrimitive.Content
				transition={fade}
				transitionConfig={{ duration: 150 }}
				class={cn(
					"relative grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg md:w-full",
					className
				)}
			>
				<slot />
			</DialogPrimitive.Content>
		</div>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
} 