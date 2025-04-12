import React, { useState, useMemo, useEffect } from "react";
import pMemoize from "p-memoize";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"; // Assuming Card maps to the outer container
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ExternalLinkIcon,
  StarsIcon,
  WalletCards,
  XIcon,
} from "lucide-react";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
  DrawerPortal,
} from "@/components/ui/drawer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// TODO: Resolve type imports later
type Discount = any;
type PaymentMethod = any;

// Constants (potentially move to a shared lib)
const PAYMENT_RAILS: string[] = [
  /* Add rails if needed from promos-db */ "Visa Crédito",
  "Mastercard Crédito",
  "Visa Débito",
  "Mastercard Débito",
  "American Express",
];
const PAYMENT_METHODS: string[] = [
  /* Add all payment methods if needed from promos-db */
];
const SUPERMARKET_NAMES: Record<string, string> = {
  carrefour: "Carrefour",
  coto: "Coto",
  dia: "Dia",
  jumbo: "Jumbo",
  changomas: "ChangoMas",
  makro: "Makro",
};
const WALLET_ICONS: Record<string, string> = {
  /* TODO: Port WALLET_ICONS from logos.ts */
};
const BRAND_LOGOS: Record<string, Record<string, any>> = {
  /* TODO: Port BRAND_LOGOS from logos.ts */
};
const BRAND_LOGOS_SMALL: Record<string, Record<string, any>> = {
  /* TODO: Port BRAND_LOGOS_SMALL from logos.ts */
};

//--- Helper Components (Placeholders - Implement or import actual components later) ---
const PaymentMethodLogo = ({ method }: { method: PaymentMethod }) => (
  <span className="text-xs border px-1 rounded bg-gray-200">{method}</span>
);

const BrandLogo = ({
  source,
  types,
  selectedType,
  small,
  containerClass,
  className,
}: {
  source: string;
  types: string[];
  selectedType: "Presencial" | "Online";
  small?: boolean;
  containerClass?: string;
  className?: string;
}) => {
  // Basic placeholder logic - needs actual logo mapping from logos.ts
  const logoKey = types.includes("Online") ? "Online" : (types[0] ?? source);
  const logoSet = small ? BRAND_LOGOS_SMALL[source] : BRAND_LOGOS[source];
  const logoSrc = logoSet?.[logoKey]?.src ?? "placeholder.png"; // Use optional chaining and default

  return (
    <div
      className={cn(
        containerClass,
        "w-10 h-10 bg-gray-300 flex items-center justify-center rounded"
      )}
    >
      <span className="text-xs font-bold">
        {source.substring(0, 1).toUpperCase()}
      </span>
      {/* <img src={logoSrc} alt={source} className={cn("object-contain", className)} /> */}
    </div>
  );
};
//----------------------------------------------------------------------------------

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
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!text) {
      setSummary("");
      return;
    }
    let isMounted = true;
    setIsLoading(true);
    getRestrictionSummary(text, long)
      .then((result) => {
        if (isMounted) {
          setSummary(result);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setSummary(text); // Fallback to original text on error
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [text, long]);

  return { summary, isLoading };
};
//-----------------------------------

// --- Currency Formatter ---
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
//--------------------------

// --- Main DiscountCard Component ---
interface DiscountCardProps {
  discount: Discount;
  selectedType: "Presencial" | "Online";
}

export const DiscountCard: React.FC<DiscountCardProps> = ({
  discount,
  selectedType,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // --- Derived Data ---
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
    // Simplified logic - requires full PAYMENT_RAILS, WALLET_ICONS, and saved state for full accuracy
    return (
      discount.paymentMethods
        ?.flatMap((method: string | string[]) =>
          Array.isArray(method) ? method : [method]
        )
        .map((method: string) => method.split(" - ")[0] as string) // Get base method name
        .filter((method: string) => WALLET_ICONS[method]) // Keep only methods with known icons
        .filter(
          (v: string, i: number, a: string[]) =>
            a.findIndex((v2) => WALLET_ICONS[v2] === WALLET_ICONS[v]) === i
        ) // Unique icons
        .sort((a: string, b: string) => {
          // Sort logic (basic)
          const aIsRail = PAYMENT_RAILS.includes(a);
          const bIsRail = PAYMENT_RAILS.includes(b);
          if (aIsRail && !bIsRail) return 1;
          if (!aIsRail && bIsRail) return -1;
          return 0;
        }) || []
    );
  }, [discount.paymentMethods]); // Dependencies might need adjustment based on full filtering logic

  const { summary: onlyForProductsSummary, isLoading: isLoadingOnlyFor } =
    useRestrictionSummary(discount.onlyForProducts);
  const { summary: excludesProductsSummary, isLoading: isLoadingExcludes } =
    useRestrictionSummary(discount.excludesProducts, true);
  //---------------------

  if (!discount) return null; // Handle case where discount might be null/undefined

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
        <DrawerTrigger
          asChild
          className="flex w-full items-center justify-between cursor-pointer"
        >
          {/* Main Card Content (Trigger Area) */}
          <div className="flex items-center gap-2 text-left flex-grow">
            <BrandLogo
              source={discount.source}
              types={discount.where || []} // Ensure types is an array
              selectedType={selectedType}
              small
              containerClass="flex-grow flex-shrink-0"
              className="!max-h-10 max-w-8"
            />

            <div className="text-2xl font-black">{renderDiscountValue()}</div>

            <div className="flex flex-shrink flex-col items-start gap-1 pr-1">
              {discount.onlyForProducts && (
                <Badge
                  variant="secondary" // Using secondary as a placeholder for yellow
                  className="w-36 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs min-[400px]:w-44"
                >
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                    Solo {isLoadingOnlyFor ? "..." : onlyForProductsSummary}
                  </span>
                </Badge>
              )}
              {discount.excludesProducts && (
                <Badge variant="destructive" className="gap-1.5 px-2 py-0.5">
                  <span className="font-black">!</span>
                  Aplican restricciones
                </Badge>
              )}
              {appliesOnlyTo.length > 0 && (
                <Badge variant="default" className="gap-1.5">
                  <WalletCards className="h-4 w-4" />
                  {appliesOnlyTo.join(", ")}
                </Badge>
              )}
              {discount.membership && discount.membership.length > 0 && (
                <Badge variant="default" className="gap-1">
                  <WalletCards className="h-4 w-4" />
                  Solo con {discount.membership.join(" y ")}
                </Badge>
              )}
              {discount.limits?.maxDiscount !== undefined && (
                <Badge variant="outline" className="gap-1">
                  Tope: {formatCurrency(discount.limits.maxDiscount)}
                </Badge>
              )}
              {discount.limits?.explicitlyHasNoLimit && (
                <Badge
                  variant="default"
                  className="gap-1 bg-yellow-400 text-yellow-900 hover:bg-yellow-500"
                >
                  {" "}
                  {/* Basic shiny */}
                  <StarsIcon className="h-4 w-4" />
                  Sin tope
                </Badge>
              )}
            </div>
          </div>
          {/* Payment Method Icons */}
          {paymentMethodIcons.length > 0 && (
            <div
              className={cn(
                "grid flex-shrink-0 gap-1",
                getPaymentMethodGridCols(paymentMethodIcons.length)
              )}
            >
              {paymentMethodIcons.map((method: string) =>
                WALLET_ICONS[method] ? (
                  <img
                    key={method}
                    src={WALLET_ICONS[method]}
                    alt={`${String(discount.source)} ${method}`}
                    className="h-6 w-6 rounded-sm object-contain" // Added object-contain
                  />
                ) : (
                  <span key={method} className="text-xs">
                    {method}
                  </span> // Fallback for missing icons
                )
              )}
            </div>
          )}
        </DrawerTrigger>

        {/* Drawer Content */}
        <DrawerPortal>
          <DrawerContent className="max-h-[96%]">
            <DrawerClose
              className="bg-muted fixed right-4 top-4 rounded p-2 z-50"
              aria-label="Cerrar"
            >
              <XIcon className="h-4 w-4" />
            </DrawerClose>
            <ScrollArea className="h-full">
              <div className="space-y-4 p-4 mt-8 mb-16">
                {" "}
                {/* Added margin for close button and footer */}
                {/* Drawer Details Here */}
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
                    <span className="font-bold text-yellow-500">Sin tope</span>
                  </p>
                )}
                {discount.membership && discount.membership.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-1">
                      Beneficio exclusivo para:
                    </h4>
                    <p className="text-sm">{discount.membership.join(", ")}</p>
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
                                className="flex flex-wrap items-center gap-2"
                              >
                                {methods.map((methodItem, itemIdx) => (
                                  <React.Fragment key={itemIdx}>
                                    {/* TODO: Use actual PaymentMethodLogo */}
                                    <Badge variant="secondary">
                                      {methodItem}
                                    </Badge>
                                    {/* <PaymentMethodLogo method={methodItem} /> */}
                                    {itemIdx < methods.length - 1 && (
                                      <span className="mx-1">+</span>
                                    )}
                                  </React.Fragment>
                                ))}
                              </div>
                            ) : (
                              <Badge key={idx} variant="secondary">
                                {methods}
                              </Badge>
                            )
                        )}
                      </div>
                    </div>
                  )}
                {discount.restrictions && discount.restrictions.length > 0 && (
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
                        <AccordionTrigger className="flex w-full items-center justify-between rounded-md p-2 text-left text-sm font-medium text-red-600 dark:text-red-400 hover:no-underline">
                          Ver texto completo
                        </AccordionTrigger>
                        <AccordionContent className="rounded-b-md border-t p-2 text-sm text-red-600 dark:border-red-900 dark:text-red-400">
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
                    Te recomendamos verificar los detalles de la promoción en el
                    sitio de la tienda.
                  </AlertDescription>
                </Alert>
              </div>
            </ScrollArea>
            <DrawerFooter className="border-t sticky bottom-0 bg-background py-2">
              <Button
                variant="outline"
                asChild // Use asChild to render an anchor tag
                className="w-full"
              >
                <a
                  href={discount.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1" // Center content
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
