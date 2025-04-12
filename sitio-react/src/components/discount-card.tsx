import React, { useState, useMemo } from "react";
import pMemoize from "p-memoize";
import { Button } from "src/components/ui/button";
import { Badge } from "src/components/ui/badge";
import { ExternalLinkIcon, StarsIcon, WalletCards, XIcon } from "lucide-react";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerFooter,
  DrawerClose,
  DrawerPortal,
  DrawerOverlay,
} from "src/components/ui/drawer";
import { Alert, AlertDescription, AlertTitle } from "src/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "src/components/ui/accordion";
import { cn } from "src/lib/utils";
import { WALLET_ICONS } from "src/lib/logos"; // Import logo constants
import { PAYMENT_RAILS, type Discount } from "promos-db/schema";
import SupermarketLogo from "./supermarket-logo";
import { useShouldFilterByPaymentMethods } from "@/lib/state";
import { usePaymentMethodsStore } from "@/lib/state";
import { useQuery } from "@tanstack/react-query";

//--- Helper Components (Implement actual components) ---
export const PaymentMethodLogo = ({
  method,
  small,
}: {
  method: string;
  small?: boolean;
}) => {
  const logoSrc = WALLET_ICONS[method];

  // Extract the base payment method (VISA, Mastercard, etc.) and type (credit, debit, etc.)
  let displayTitle = method;

  const cardType = method.includes("crédito")
    ? "Crédito"
    : method.includes("débito")
      ? "Débito"
      : method.includes("Prepaga")
        ? "Prepaga"
        : "";

  // Check if it's one of the payment rails with type information
  if (PAYMENT_RAILS.includes(method as any)) {
    // For payment rails like "Tarjeta de crédito VISA", extract the card network
    const parts = method.split(" ");
    const cardNetwork = parts[parts.length - 1];

    if (cardType) {
      displayTitle = `${cardNetwork} (${cardType})`;
    }
  }

  if (!logoSrc) {
    if (small && WALLET_ICONS[method.split(" - ")[0]]) {
      return (
        <div className="relative">
          <img
            src={WALLET_ICONS[method.split(" - ")[0]]}
            alt={method}
            className={cn(
              "h-6 w-6 rounded-sm object-contain ring-1 ring-yellow-400"
            )}
          />
        </div>
      );
    } else
      return (
        <span className="text-xs border px-1 rounded bg-primary text-primary-foreground">
          {displayTitle}
        </span>
      );
  }

  return (
    <div className="flex items-center gap-1">
      <img
        src={logoSrc}
        alt={method}
        className={cn("h-6 w-6 rounded-sm object-contain")}
      />
      {cardType && !small && (
        <span className="text-xs border px-1 rounded bg-primary text-primary-foreground">
          {cardType}
        </span>
      )}
    </div>
  );
};

// --- Restriction Summary Logic ---
const getRestrictionSummary = pMemoize(
  async (text: string, long = false): Promise<string> => {
    if (!text) return "";
    const upperText = text
      .replaceAll(/ó/gu, "o")
      .replaceAll(/í/giu, "i")
      .replaceAll(/é/giu, "e")
      .toUpperCase();
    if (
      [
        "N/A",
        "TODO EL SURTIDO",
        "TODOS LOS PRODUCTOS",
        "ELECTRODOMESTICOS",
        "LIBRERIA",
      ].includes(upperText)
    )
      return text;
    if (text.toLowerCase() === "electro") return "Electrodomésticos";

    try {
      const res = await fetch("https://nulo-productsummaryapi.web.val.run", {
        method: "POST",
        body: JSON.stringify({ description: text, long }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        console.warn("Restriction summary fetch failed:", res.statusText);
        return text; // Return original text on failure
      }
      const data: { summary: string } = await res.json();
      return data.summary;
    } catch (error) {
      console.error("Restriction summary fetch error:", error);
      return text; // Return original text on error
    }
  },
  { cacheKey: ([t, l]) => `${String(t).toLowerCase()}-${l}` }
);

const useRestrictionSummary = (text: string | undefined, long = false) => {
  const query = useQuery({
    queryKey: ["restrictionSummary", text, long],
    queryFn: () => getRestrictionSummary(text || "", long),
    enabled: !!text,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    initialData: text ? undefined : "",
    retry: false,
  });

  return {
    summary: query.data || text || "",
    isLoading: query.isLoading,
  };
};

const CURRENCY_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
});

function formatCurrency(amount: number | undefined) {
  if (amount === undefined) return "";
  if (amount > 1000 && amount % 1000 === 0) {
    return `$${amount / 1000}mil`;
  }
  return CURRENCY_FORMATTER.format(amount);
}
interface DiscountCardProps {
  discount: Discount;
  selectedType: "Presencial" | "Online";
}

export const DiscountCard: React.FC<DiscountCardProps> = ({
  discount,
  selectedType,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { savedPaymentMethods } = usePaymentMethodsStore();
  const shouldFilterByPaymentMethods = useShouldFilterByPaymentMethods();

  const appliesOnlyTo = useMemo(() => {
    const APPLIES_ONLY_STRINGS: Record<string, string> = {
      anses: "ANSES",
      jubilados: "Jubilados",
      programaCiudadaniaPorteña: "Programa Ciudadanía Porteña",
    };
    if (!discount.appliesOnlyTo) return [];
    return Object.entries(discount.appliesOnlyTo).flatMap(([key, value]) => {
      if (value && APPLIES_ONLY_STRINGS[key])
        return [APPLIES_ONLY_STRINGS[key]];
      return [];
    });
  }, [discount.appliesOnlyTo]);

  const paymentMethodIcons = useMemo(() => {
    return (
      discount.paymentMethods
        ?.flatMap((method: string | string[]) =>
          Array.isArray(method) ? method : [method]
        )
        .filter((method) => WALLET_ICONS[method.split(" - ")[0]])
        .filter(
          (v, i, a) =>
            a.findIndex((v2) => WALLET_ICONS[v2] === WALLET_ICONS[v]) === i
        )
        .filter((method) => {
          if (!shouldFilterByPaymentMethods) return true;
          if (PAYMENT_RAILS.includes(method as any)) return true;
          return savedPaymentMethods.has(method as any);
        })
        .sort((a: string, b: string) => {
          const aIsRail = PAYMENT_RAILS.includes(a as any);
          const bIsRail = PAYMENT_RAILS.includes(b as any);
          if (aIsRail && !bIsRail) return 1;
          if (!aIsRail && bIsRail) return -1;
          return 0;
        }) || []
    );
  }, [
    discount.paymentMethods,
    savedPaymentMethods,
    shouldFilterByPaymentMethods,
  ]);

  // Only fetch summaries when drawer is open
  const { summary: onlyForProductsSummary, isLoading: isLoadingOnlyFor } =
    useRestrictionSummary(discount.onlyForProducts);
  const { summary: excludesProductsSummary, isLoading: isLoadingExcludes } =
    useRestrictionSummary(
      isDrawerOpen ? discount.excludesProducts : undefined,
      true
    );

  const renderDiscountValue = () => {
    if (discount.discount.type === "porcentaje") {
      return <>{discount.discount.value}%</>;
    }
    if (discount.discount.type === "cuotas sin intereses") {
      return (
        <>
          {discount.discount.value}
          <span className="text-sm">c/si</span>
        </>
      );
    }
    // Handle merged type if needed
    return null;
  };

  const getPaymentMethodGridCols = (count: number) => {
    if (count > 9) return "grid-cols-4";
    if (count > 4) return "grid-cols-3";
    if (count > 1) return "grid-cols-2";
    return "grid-cols-1";
  };

  return (
    <div className="bg-card text-card-foreground rounded-lg border px-3 py-2 shadow-md">
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerTrigger asChild className="w-full cursor-pointer">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-left flex-grow min-w-0">
              {" "}
              <SupermarketLogo
                source={discount.source}
                small
                containerClassName="flex-shrink-0 mr-2"
                className="h-8 max-w-8 md:h-10 md:max-w-10"
              />
              <div className="text-xl md:text-2xl font-black flex-shrink-0">
                {" "}
                {renderDiscountValue()}
              </div>
              <div className="flex flex-col items-start gap-1 flex-grow min-w-0">
                {" "}
                {/* Added min-w-0 */}
                {discount.onlyForProducts && (
                  <Badge
                    variant="secondary"
                    className="overflow-hidden text-ellipsis whitespace-nowrap text-xs px-1.5 py-0.5"
                    title={discount.onlyForProducts}
                  >
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                      Solo {isLoadingOnlyFor ? "..." : onlyForProductsSummary}
                    </span>
                  </Badge>
                )}
                {discount.excludesProducts && (
                  <Badge
                    variant="destructive"
                    className="gap-1 px-1.5 py-0.5 text-xs"
                  >
                    {" "}
                    <span className="font-black">!</span>
                    Restricciones
                  </Badge>
                )}
                {appliesOnlyTo.length > 0 && (
                  <Badge
                    variant="default"
                    className="gap-1 px-1.5 py-0.5 text-xs"
                  >
                    <WalletCards className="h-3 w-3" />
                    {appliesOnlyTo.join(", ")}
                  </Badge>
                )}
                {discount.membership && discount.membership.length > 0 && (
                  <Badge
                    variant="default"
                    className="gap-1 px-1.5 py-0.5 text-xs"
                  >
                    <WalletCards className="h-3 w-3" />
                    Solo con {discount.membership.join(" y ")}
                  </Badge>
                )}
                {discount.limits?.maxDiscount !== undefined && (
                  <Badge
                    variant="outline"
                    className="gap-1 px-1.5 py-0.5 text-xs"
                  >
                    Tope: {formatCurrency(discount.limits.maxDiscount)}
                  </Badge>
                )}
                {discount.limits?.explicitlyHasNoLimit && (
                  <Badge
                    variant="default"
                    className="gap-1 bg-yellow-400 text-yellow-900 hover:bg-yellow-500 px-1.5 py-0.5 text-xs"
                  >
                    <StarsIcon className="h-3 w-3" />
                    Sin tope
                  </Badge>
                )}
              </div>
            </div>
            {paymentMethodIcons.length > 0 && (
              <div
                className={cn(
                  "grid flex-shrink-0 gap-1 ml-2",
                  getPaymentMethodGridCols(paymentMethodIcons.length)
                )}
              >
                {" "}
                {paymentMethodIcons.map((method: string) => (
                  <PaymentMethodLogo key={method} method={method} small />
                ))}
              </div>
            )}
          </div>
        </DrawerTrigger>

        <DrawerPortal>
          <DrawerOverlay className="fixed inset-0 bg-black/40" />
          <DrawerContent className="bg-background flex flex-col rounded-t-[10px] mt-24 h-[90%] fixed bottom-0 left-0 right-0 outline-none max-w-2xl mx-auto">
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="mx-auto">
                <DrawerClose
                  className="bg-muted absolute right-4 top-4 rounded p-2 z-50"
                  aria-label="Cerrar"
                >
                  <XIcon className="h-4 w-4" />
                </DrawerClose>
                <div className="space-y-4">
                  {discount.where?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-1">Comprando en:</h4>
                      <p className="text-sm">{discount.where.join(", ")}</p>
                    </div>
                  )}
                  {discount.limits?.maxDiscount !== undefined && (
                    <div>
                      <h4 className="font-medium mb-1">Tope de descuento:</h4>
                      <p className="font-medium text-sm">
                        {formatCurrency(discount.limits.maxDiscount)}
                      </p>
                    </div>
                  )}
                  {discount.limits?.explicitlyHasNoLimit && (
                    <p className="flex items-center gap-1 text-sm">
                      <StarsIcon className="h-4 w-4 text-yellow-500" />
                      <span className="font-bold text-yellow-500">
                        Sin tope
                      </span>
                    </p>
                  )}
                  {discount.membership && discount.membership.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-1">
                        Beneficio exclusivo para:
                      </h4>
                      <p className="text-sm">
                        {discount.membership.join(", ")}
                      </p>
                    </div>
                  )}
                  {discount.paymentMethods &&
                    discount.paymentMethods.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-1">Medios de pago:</h4>
                        <div className="mt-1 flex flex-col gap-2">
                          {discount.paymentMethods.map(
                            (methods: string | string[], idx: number) =>
                              Array.isArray(methods) ? (
                                <div
                                  key={idx}
                                  className="flex flex-wrap items-center gap-1"
                                >
                                  {methods.map((methodItem, itemIdx) => (
                                    <React.Fragment key={itemIdx}>
                                      {/* Use actual PaymentMethodLogo */}
                                      <PaymentMethodLogo method={methodItem} />
                                      {itemIdx < methods.length - 1 && (
                                        <span>+</span>
                                      )}
                                    </React.Fragment>
                                  ))}
                                </div>
                              ) : (
                                // Render non-array payment methods if needed
                                <PaymentMethodLogo key={idx} method={methods} />
                              )
                          )}
                        </div>
                      </div>
                    )}
                  {discount.restrictions &&
                    discount.restrictions.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-1">Restricciones:</h4>
                        <ul className="list-disc pl-5 text-sm space-y-1">
                          {discount.restrictions.map(
                            (restriction: string, idx: number) => (
                              <li key={idx}>{restriction}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                  {discount.excludesProducts && (
                    <div>
                      <h4 className="font-medium mb-1">No aplica para:</h4>
                      {isLoadingExcludes ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Cargando resumen...
                        </p>
                      ) : (
                        <div className="mt-1 rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-900 dark:bg-red-950">
                          <p className="text-sm text-red-600 dark:text-red-400">
                            <span className="font-medium">Resumen:</span>{" "}
                            {excludesProductsSummary}
                          </p>
                        </div>
                      )}
                      <Accordion
                        type="single"
                        collapsible
                        className="w-full mt-2"
                      >
                        <AccordionItem
                          value="original-text"
                          className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
                        >
                          <AccordionTrigger className="flex w-full items-center justify-between rounded-md p-2 text-left text-sm font-medium text-red-600 dark:text-red-400 hover:no-underline border-b border-red-200 dark:border-red-900">
                            Ver texto completo
                          </AccordionTrigger>
                          <AccordionContent className="rounded-b-md p-2 text-sm text-red-600 dark:text-red-400 border-b border-red-200 dark:border-red-900">
                            {discount.excludesProducts}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  )}
                  <Alert
                    variant="default"
                    className="mt-4 border-yellow-500/50 text-yellow-700 dark:border-yellow-500/50 dark:text-yellow-500 [&>svg]:text-yellow-700 dark:[&>svg]:text-yellow-500"
                  >
                    <AlertTitle>Verifica los detalles</AlertTitle>
                    <AlertDescription>
                      Te recomendamos verificar los detalles de la promoción en
                      el sitio de la tienda.
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            </div>
            <DrawerFooter className="border-t sticky bottom-0 bg-background py-2">
              <Button variant="outline" asChild className="w-full">
                <a
                  href={discount.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1"
                >
                  <ExternalLinkIcon className="h-4 w-4" />
                  Ver más detalles
                </a>
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </DrawerPortal>
      </Drawer>
    </div>
  );
};
