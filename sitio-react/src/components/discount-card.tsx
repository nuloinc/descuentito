import React, { useState, useMemo } from "react";
import { Button } from "src/components/ui/button";
import { Badge } from "src/components/ui/badge";
import {
  ExternalLinkIcon,
  MessageCircleWarning,
  StarsIcon,
  WalletCards,
  XIcon,
  QrCodeIcon,
  SmartphoneNfcIcon,
  CreditCardIcon,
  Check,
} from "lucide-react";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerFooter,
  DrawerClose,
} from "src/components/ui/drawer";
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
import { FeedbackForm } from "./feedback-form";
import { motion } from "framer-motion";
import { DialogHeader, DialogTitle } from "./ui/dialog";

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
              "h-6 w-6 rounded-sm object-contain ring-1 ring-yellow-400",
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

const getRestrictionSummary = async (
  text: string,
  long = false,
): Promise<string> => {
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
    if (!res.ok) throw new Error("Status: " + res.status);
    const data: { summary: string } = await res.json();
    return data.summary;
  } catch (error) {
    console.error("Restriction summary fetch error:", error);
    return text; // Return original text on error
  }
};

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
  if (amount > 100 && amount % 100 === 0) {
    const thousands = amount / 1000;
    if (thousands % 1 === 0) {
      return `$${thousands}mil`;
    }
    return `$${thousands.toFixed(1)}mil`;
  }
  return CURRENCY_FORMATTER.format(amount);
}
interface DiscountCardProps {
  discount: Discount;
  selectedType: "Presencial" | "Online";
}

export const ExcludesProductsSummary: React.FC<{
  discount: Discount & { excludesProducts: string };
  isDrawerOpen: boolean;
}> = ({ discount, isDrawerOpen }) => {
  const { summary: excludesProductsSummary, isLoading: isLoadingExcludes } =
    useRestrictionSummary(
      isDrawerOpen ? discount.excludesProducts : undefined,
      true,
    );
  const summarySucks =
    excludesProductsSummary.length > 0 &&
    excludesProductsSummary.length > discount.excludesProducts.length;

  return (
    <div className="mt-1 rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-900 dark:bg-red-950 text-red-600 dark:text-red-400">
      {isLoadingExcludes ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Cargando resumen...
        </p>
      ) : summarySucks ? (
        <p className="text-sm">{discount.excludesProducts}</p>
      ) : (
        <p className="text-sm">
          <span className="font-medium">Resumen:</span>{" "}
          {excludesProductsSummary}
        </p>
      )}
      {summarySucks ? null : (
        <Accordion type="single" collapsible className="w-full mt-2">
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
      )}
    </div>
  );
};

export const DiscountCard: React.FC<DiscountCardProps> = ({
  discount,
  selectedType,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const {
    savedPaymentMethods,
    showingPaymentMethodsInDiscountCard,
    savedMemberships,
  } = usePaymentMethodsStore();
  const shouldFilterByPaymentMethods = useShouldFilterByPaymentMethods();

  const shouldShowPaymentMethodsInCard =
    savedPaymentMethods.size > 0 ? showingPaymentMethodsInDiscountCard : true;

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

  const missingMemberships = useMemo(() => {
    if (!discount.membership || discount.membership.length === 0) return [];
    return discount.membership.filter(
      (membership) => !savedMemberships.has(membership),
    );
  }, [discount.membership, savedMemberships]);

  const paymentMethodIcons = useMemo(() => {
    return (
      discount.paymentMethods
        ?.flatMap((method: string | string[]) =>
          Array.isArray(method) ? method : [method],
        )
        .filter((method) => WALLET_ICONS[method.split(" - ")[0]])
        .filter(
          (v, i, a) =>
            a.findIndex((v2) => WALLET_ICONS[v2] === WALLET_ICONS[v]) === i,
        )
        .filter((method) => {
          if (!shouldFilterByPaymentMethods) return true;
          if (PAYMENT_RAILS.includes(method as any)) return false;
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
    return null;
  };

  const getPaymentMethodGridCols = (count: number) => {
    if (count > 9) return "grid-cols-4";
    if (count > 4) return "grid-cols-3";
    if (count > 1) return "grid-cols-2";
    return "grid-cols-1";
  };

  return (
    <Drawer
      open={isDrawerOpen}
      onOpenChange={setIsDrawerOpen}
      repositionInputs={false}
    >
      <DrawerTrigger asChild>
        <div
          className={cn(
            "bg-card text-card-foreground rounded-lg border px-3 py-2",
            missingMemberships.length > 0 && "opacity-70",
          )}
        >
          <motion.div
            layout
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="flex items-center justify-between w-full cursor-pointer"
          >
            <div className="flex items-center gap-2 text-left flex-grow min-w-0">
              <SupermarketLogo
                source={discount.source}
                small
                containerClassName="flex-shrink-0 mr-2"
                className="h-8 max-w-8 md:h-10 md:max-w-10"
              />
              <div className="text-xl md:text-2xl font-black flex-shrink-0">
                {renderDiscountValue()}
              </div>
              <div className="flex flex-col items-start gap-1 flex-grow min-w-0">
                {discount.onlyForProducts && (
                  <Badge
                    variant="secondary"
                    className="overflow-hidden text-ellipsis whitespace-nowrap text-xs px-1.5 py-0.5 max-w-48"
                    title={discount.onlyForProducts}
                  >
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                      Solo {discount.onlyForProducts}
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
            {paymentMethodIcons.length > 0 &&
              shouldShowPaymentMethodsInCard && (
                <div
                  className={cn(
                    "grid flex-shrink-0 gap-1 ml-2",
                    getPaymentMethodGridCols(paymentMethodIcons.length),
                  )}
                >
                  {" "}
                  {paymentMethodIcons.map((method: string) => (
                    <PaymentMethodLogo key={method} method={method} small />
                  ))}
                </div>
              )}
          </motion.div>
        </div>
      </DrawerTrigger>

      <DrawerContent className="bg-background flex flex-col rounded-t-[10px] mt-24 h-[90%] fixed bottom-0 left-0 right-0 outline-none max-w-2xl mx-auto">
        <div className="p-4 flex-1 overflow-y-auto">
          <DialogHeader className="text-center mb-4 flex flex-col items-center gap-0">
            <DialogTitle className="text-2xl font-black">
              {discount.discount.type === "porcentaje"
                ? `${discount.discount.value}% OFF`
                : `${discount.discount.value} cuotas sin interés`}
            </DialogTitle>
            <div className="flex items-center justify-center gap-1">
              en{" "}
              {discount.where?.length > 0 &&
                discount.where.map((where) => (
                  <SupermarketLogo
                    source={discount.source}
                    where={where}
                    className="h-6"
                  />
                ))}
            </div>
          </DialogHeader>
          {discount.membership && discount.membership.length > 0 && (
            <div
              className={cn(
                "mb-4 p-3 border rounded-md",
                missingMemberships.length > 0
                  ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                  : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
              )}
            >
              <div className="flex items-start gap-2">
                {missingMemberships.length > 0 ? (
                  <MessageCircleWarning className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                )}
                <div
                  className={cn(
                    "text-sm",
                    missingMemberships.length > 0
                      ? "text-amber-800 dark:text-amber-200"
                      : "text-green-800 dark:text-green-200",
                  )}
                >
                  <p className="font-medium">
                    {missingMemberships.length > 0
                      ? "Requiere membresía"
                      : "Tienes acceso"}
                  </p>
                  <p>
                    {missingMemberships.length > 0
                      ? `Para obtener este descuento necesitas tener: ${missingMemberships.join(", ")}`
                      : `Este descuento está disponible con tu membresía: ${discount.membership.join(", ")}`}
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="mx-auto">
            <DrawerClose
              className="bg-muted absolute right-4 top-4 rounded p-2 z-50"
              aria-label="Cerrar"
            >
              <XIcon className="h-4 w-4" />
            </DrawerClose>
            <div className="space-y-4">
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
                                  <PaymentMethodLogo method={methodItem} />
                                  {itemIdx < methods.length - 1 && (
                                    <span>+</span>
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          ) : (
                            <PaymentMethodLogo key={idx} method={methods} />
                          ),
                      )}
                    </div>
                  </div>
                )}

              {discount.paymentRails &&
                (discount.paymentRails.pagoConQR ||
                  discount.paymentRails.telefonoContactless ||
                  discount.paymentRails.contactless) && (
                  <div>
                    <h4 className="font-medium mb-1">Tecnologías de pago:</h4>
                    <div className="mt-1 flex flex-col gap-2">
                      {discount.paymentRails.pagoConQR && (
                        <div className="flex items-center gap-2 text-sm">
                          <QrCodeIcon className="h-5 w-5 text-primary" />
                          <span>Pago con QR</span>
                        </div>
                      )}
                      {discount.paymentRails.telefonoContactless && (
                        <div className="flex items-center gap-2 text-sm">
                          <SmartphoneNfcIcon className="h-5 w-5 text-primary" />
                          <span>Contactless con Celular (NFC)</span>
                        </div>
                      )}
                      {discount.paymentRails.contactless && (
                        <div className="flex items-center gap-2 text-sm">
                          <CreditCardIcon className="h-5 w-5 text-primary" />
                          <span>Contactless con Tarjeta</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {discount.excludesProducts && (
                <div>
                  <h4 className="font-medium mb-1">
                    No aplica para productos:
                  </h4>
                  <ExcludesProductsSummary
                    discount={
                      discount as Discount & { excludesProducts: string }
                    }
                    isDrawerOpen={isDrawerOpen}
                  />
                </div>
              )}
              {discount.restrictions && discount.restrictions.length > 0 && (
                <div>
                  <h4 className="font-medium mb-1">Restricciones:</h4>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {discount.onlyForProducts ? (
                      <li>
                        <span className="font-bold">Solo para:</span>{" "}
                        {discount.onlyForProducts}
                      </li>
                    ) : null}
                    {discount.restrictions.map(
                      (restriction: string, idx: number) => (
                        <li key={idx}>{restriction}</li>
                      ),
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <FeedbackForm discount={discount} />
        </div>
        <DrawerFooter className="border-t sticky bottom-0 bg-background py-2 pb-[calc(env(safe-area-inset-bottom)+.5rem)]">
          <p className="text-sm text-center text-amber-500">
            Te recomendamos verificar los detalles de la promoción en el sitio
            del supermercado.
          </p>
          <Button asChild className="w-full">
            <a
              href={discount.url}
              target="_blank"
              rel="noopener"
              className="flex items-center justify-center gap-1"
            >
              <ExternalLinkIcon className="h-4 w-4" />
              Ver en el sitio del supermercado
            </a>
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
