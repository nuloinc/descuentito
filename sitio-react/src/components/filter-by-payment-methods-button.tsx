import React from "react";
import { Sparkles } from "lucide-react";
import { Switch } from "src/components/ui/switch";
import { cn } from "src/lib/utils";
import { usePaymentMethodsStore } from "src/lib/state";

// TODO: Replace with proper state management like React Context or Zustand
// In Svelte, this component is using persistent stores
interface FilterByPaymentMethodsButtonProps {
  className?: string;
}

const FilterByPaymentMethodsButton: React.FC<
  FilterByPaymentMethodsButtonProps
> = ({ className }) => {
  // Use the Zustand store for state management
  const {
    filteringByPaymentMethods,
    setFilteringByPaymentMethods,
    savedPaymentMethods,
  } = usePaymentMethodsStore();

  // Check if there are saved payment methods
  const hasSavedPaymentMethods = savedPaymentMethods.size > 0;

  const handleToggle = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    setFilteringByPaymentMethods(!filteringByPaymentMethods);
    return false;
  };

  return (
    <div
      role="button"
      tabIndex={hasSavedPaymentMethods ? 0 : -1}
      className={cn(
        "flex w-full items-center space-x-2 rounded-md border p-3 transition-all cursor-pointer",
        filteringByPaymentMethods
          ? "border-green-400 bg-green-400/10 ring-1 ring-green-400"
          : "border-red-400 bg-red-400/10 ring-1 ring-red-400",
        hasSavedPaymentMethods ? "" : "opacity-50 pointer-events-none",
        className
      )}
      onClick={handleToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleToggle(e);
        }
      }}
      aria-disabled={!hasSavedPaymentMethods}
    >
      <Sparkles className="h-5 w-5 text-yellow-500" />
      <span className="flex-grow text-left font-medium">
        Filtrar por tus medios de pago
      </span>
      <Switch
        id="filter-owned"
        checked={filteringByPaymentMethods}
        onCheckedChange={setFilteringByPaymentMethods}
        className="ring-1 ring-gray-300"
        disabled={!hasSavedPaymentMethods}
      />
    </div>
  );
};

export default FilterByPaymentMethodsButton;
