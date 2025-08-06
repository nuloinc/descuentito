import { usePaymentMethodsStore } from "@/lib/state";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, ChevronRight, Wallet, CreditCard } from "lucide-react";
import { PaymentMethod } from "promos-db/schema";
import { WALLET_ICONS } from "@/lib/logos";

export function ChildMethod({
  childMethod,
  method,
}: {
  childMethod: PaymentMethod;
  method: string;
}) {
  const { addPaymentMethod, removePaymentMethod, savedPaymentMethods } =
    usePaymentMethodsStore();
  const childMethodName = childMethod
    .replace(method + " - ", "")
    .replace(" y ", " o ")
    .replace("Jubilados", "Jubilado");
  const isOrHas = childMethodName.match(/(tarjeta)|(plan)/i) ? "Tenes" : "Sos";
  return (
    <div
      key={childMethod}
      className="flex items-center gap-2 p-2.5 border rounded-md"
    >
      <Checkbox
        id={childMethod}
        checked={savedPaymentMethods.has(childMethod)}
        onCheckedChange={(checked) =>
          checked
            ? addPaymentMethod(childMethod)
            : removePaymentMethod(childMethod)
        }
      />
      <Label
        htmlFor={childMethod}
        className="flex items-center gap-2 flex-grow cursor-pointer"
      >
        <span className="text-sm">
          ¿{isOrHas} {childMethodName}?
        </span>
      </Label>
    </div>
  );
}

export function ParentMethod({
  method,
  children,
  index,
}: {
  method: PaymentMethod;
  children: PaymentMethod[];
  index?: number;
}) {
  const { addPaymentMethod, removePaymentMethod, savedPaymentMethods } =
    usePaymentMethodsStore();
  const isSelected = savedPaymentMethods.has(method);
  const isExpanded = isSelected;
  const hasChildren = children.length > 0;
  const hasSelectedChildren = children.some((child) =>
    savedPaymentMethods.has(child),
  );
  const buttonVariant = isSelected
    ? "default"
    : hasSelectedChildren
      ? "secondary"
      : "outline";

  return (
    <motion.div
      key={method}
      className="flex flex-col"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 * (index || 0) }}
    >
      <Button
        variant={buttonVariant}
        className={cn(
          "flex items-center justify-start gap-2 p-3 h-auto w-full border whitespace-normal",
          "font-medium",
        )}
        onClick={() => {
          if (isSelected) {
            removePaymentMethod(method);
            children.forEach((child) => removePaymentMethod(child));
          } else {
            addPaymentMethod(method);
          }
        }}
      >
        {method in WALLET_ICONS ? (
          <img
            src={WALLET_ICONS[method as keyof typeof WALLET_ICONS]}
            alt={method}
            className="h-6 w-auto rounded-sm mr-1"
          />
        ) : method.startsWith("Tarjeta") ? (
          <CreditCard className="size-6 mr-1 p-0.5 bg-primary text-primary-foreground rounded-sm" />
        ) : (
          <Wallet className="size-6 mr-1 p-0.5 bg-primary text-primary-foreground rounded-sm" />
        )}
        <span className="flex-grow text-left">{method}</span>
        {savedPaymentMethods.has(method) && <Check className="h-5 w-5" />}
        {!savedPaymentMethods.has(method) && (
          // placeholder
          <span className="size-4 block flex-shrink-0"></span>
        )}
        {hasChildren && (
          <ChevronRight
            className={cn(
              "h-5 w-5 transition-transform duration-200",
              isExpanded && "rotate-90",
            )}
          />
        )}
      </Button>

      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            className="flex flex-col gap-1.5 pl-6 pt-1.5"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children.map((childMethod) => (
              <ChildMethod childMethod={childMethod} method={method} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
