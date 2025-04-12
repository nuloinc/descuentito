import React from "react";
import { Sparkles } from "lucide-react";
import { Switch } from "src/components/ui/switch";
import { cn } from "src/lib/utils";
import { usePaymentMethodsStore } from "src/lib/state";

interface FilterByPaymentMethodsButtonProps {
  className?: string;
}

const FilterByPaymentMethodsButton: React.FC<
  FilterByPaymentMethodsButtonProps
> = ({ className }) => {
  const {
    filteringByPaymentMethods,
    setFilteringByPaymentMethods,
    savedPaymentMethods,
  } = usePaymentMethodsStore();

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
          ? "border-green-400 dark:border-green-500 bg-green-400/10 dark:bg-green-500/10"
          : "border-red-400 dark:border-red-500 bg-red-400/10 dark:bg-red-500/10",
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
