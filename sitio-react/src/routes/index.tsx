import { Await, createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import weekday from "dayjs/plugin/weekday";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { Badge } from "src/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "src/components/ui/tabs";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "src/components/ui/drawer";
import { Button } from "src/components/ui/button";
import { Filter, Share2, CreditCard } from "lucide-react";
import { DiscountCard, PaymentMethodLogo } from "src/components/discount-card"; // Import the actual component
import SupermarketFilter from "src/components/supermarket-filter"; // Import the actual component
import FilterByPaymentMethodsButton from "src/components/filter-by-payment-methods-button"; // Import the actual component
import {
  usePaymentMethodsStore,
  useShouldFilterByPaymentMethods,
  SUPERMARKET_NAMES,
} from "src/lib/state";
import { Discount, PAYMENT_RAILS } from "promos-db/schema";
import { getPromotions, PromotionData } from "src/server/promotions";
import { Skeleton } from "@/components/ui/skeleton";
import { FeedbackForm } from "@/components/feedback-form";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useIsClient } from "@/lib/utils";
import { MembershipSetupPopup } from "@/components/membership-setup-popup";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(weekday);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const timeZone = "America/Argentina/Buenos_Aires";
const getFormattedWeekDates = () => {
  const weekStartDate = dayjs().tz(timeZone).startOf("day");
  const weekDates = Array.from({ length: 7 }, (_, i) =>
    weekStartDate.add(i, "day"),
  );

  const weekdayFormatter = new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    timeZone,
  });
  const shortWeekdayFormatter = new Intl.DateTimeFormat("es", {
    weekday: "short",
    timeZone,
  });

  return weekDates.map((date) => ({
    id: date.format("YYYY-MM-DD"),
    date: date.format("YYYY-MM-DD"),
    dayjs: date,
    display: weekdayFormatter.format(date.toDate()),
    shortDisplay: shortWeekdayFormatter.format(date.toDate()),
    weekday: (
      [
        "Domingo",
        "Lunes",
        "Martes",
        "Miercoles",
        "Jueves",
        "Viernes",
        "Sabado",
      ] as const
    )[date.day()],
  }));
};

export const Route = createFileRoute("/")({
  component: Home,
  loader: async () => {
    return {
      promotions: getPromotions(),
    };
  },
  validateSearch: (search: Record<string, unknown>) => {
    return {
      supermarket: search.supermarket as string | undefined,
    };
  },
  staleTime: 1000 * 60 * 10,
});

function Promotions({
  promotionsData,
  selectedType,
  selectedSupermarket,
  selectedPromotionType,
  formattedWeekDates,
  selectedTabId,
  currentTabIndex,
  setSelectedSupermarket,
}: {
  promotionsData: PromotionData;
  selectedType: "Presencial" | "Online";
  selectedSupermarket: string | null;
  selectedPromotionType: "Todos" | "Descuentos" | "Cuotas";
  formattedWeekDates: ReturnType<typeof getFormattedWeekDates>;
  selectedTabId: string;
  currentTabIndex: number;
  setSelectedSupermarket: (supermarket: string | null) => void;
}) {
  const { savedPaymentMethods, savedConditions } = usePaymentMethodsStore();
  const shouldFilterByPaymentMethods = useShouldFilterByPaymentMethods();

  const basePromotions = useMemo(() => {
    if (!promotionsData) return [];

    const allPromotions = Object.entries(promotionsData)
      .flatMap(([source, promotions]) => {
        if (source === "carrefour") {
          return promotions.filter(
            (promotion) =>
              !(promotion.where.length === 1 && promotion.where[0] === "Maxi"),
          );
        }
        return promotions;
      })
      .filter(Boolean);

    // Apply filters based on selected options
    return allPromotions
      .filter((promotion: Discount) => {
        if (selectedType === "Online") {
          if (!(promotion.where as string[]).includes("Online")) return false;
        } else {
          if (promotion.where.length === 1 && promotion.where[0] === "Online")
            return false;
        }

        if (selectedSupermarket && selectedSupermarket !== promotion.source)
          return false;

        if (
          selectedPromotionType === "Descuentos" &&
          promotion.discount.type !== "porcentaje"
        ) {
          return false;
        }
        if (
          selectedPromotionType === "Cuotas" &&
          promotion.discount.type !== "cuotas sin intereses"
        ) {
          return false;
        }

        if (promotion.onlyForProducts?.match(/electro|aires/i)) {
          // jumbo tiene muchos descuentos solo para electrodomesticos o aires acondicionados
          return false;
        }

        if (promotion.paymentMethods && shouldFilterByPaymentMethods) {
          const isPassedByPaymentMethods = (() => {
            if (
              // if promotion only requires a payment rail and user has it
              promotion.paymentMethods
                .map((pm) => (Array.isArray(pm) ? pm : [pm]))
                .every(
                  (pm) =>
                    pm.length === 1 && PAYMENT_RAILS.includes(pm[0] as any),
                ) &&
              promotion.paymentMethods
                .flat()
                .some((pm) => savedPaymentMethods.has(pm as any))
            ) {
              return true;
            }

            if (
              Array.from(promotion.paymentMethods).some((pm) => {
                const pms = Array.isArray(pm) ? pm : [pm];
                return pms.some(
                  (pm2) =>
                    !PAYMENT_RAILS.includes(pm2 as any) &&
                    savedPaymentMethods.has(pm2 as any),
                );
              })
            ) {
              return true;
            }
          })();
          if (!isPassedByPaymentMethods) return false;
        }

        // Filter out specific programs that user might not qualify for
        if (promotion.appliesOnlyTo?.programaCiudadaniaPorteña) return false;
        if (promotion.appliesOnlyTo?.anses && !savedConditions.anses)
          return false;
        if (promotion.appliesOnlyTo?.jubilados && !savedConditions.jubilados)
          return false;

        return true;
      })
      .sort((a, b) => {
        // First sort by discount type: percentage discounts first, then cuotas sin intereses
        if (a.discount.type !== b.discount.type) {
          return a.discount.type === "porcentaje" ? -1 : 1;
        }

        // Then sort by discount value (higher percentages or more installments first)
        if (a.discount.value !== b.discount.value) {
          return b.discount.value - a.discount.value;
        }

        // Finally, sort by date as a tiebreaker
        if (a.validFrom && b.validFrom) {
          return dayjs(a.validFrom).isBefore(dayjs(b.validFrom)) ? -1 : 1;
        }
        return 0;
      });
  }, [
    promotionsData,
    selectedType,
    selectedSupermarket,
    selectedPromotionType,
    shouldFilterByPaymentMethods,
    savedPaymentMethods,
    savedConditions,
  ]);

  const promotionsByWeekday = useMemo(() => {
    return formattedWeekDates.map((weekDateInfo) => {
      return basePromotions.filter((promotion: Discount) => {
        if (
          promotion.weekdays &&
          !promotion.weekdays.includes(weekDateInfo.weekday)
        )
          return false;
        const weekdayDate = weekDateInfo.dayjs;
        // Defensive check for date fields
        if (!promotion.validFrom || !promotion.validUntil) return false;
        const validFrom = dayjs(promotion.validFrom, timeZone);
        const validUntil = dayjs(promotion.validUntil, timeZone);
        // Defensive check for valid dayjs objects
        if (
          !validFrom.isValid() ||
          !validUntil.isValid() ||
          !weekdayDate.isValid()
        ) {
          console.warn("Invalid date found during filtering", {
            promotion,
            weekdayDate: weekdayDate.toISOString(),
          });
          return false;
        }
        return (
          validFrom.isSameOrBefore(weekdayDate, "day") &&
          validUntil.isSameOrAfter(weekdayDate, "day")
        );
      });
    });
  }, [basePromotions, formattedWeekDates]);

  const currentPromotions =
    currentTabIndex >= 0 ? (promotionsByWeekday?.[currentTabIndex] ?? []) : [];

  return (
    <>
      <div className="mx-auto max-w-screen-md grid grid-cols-1 gap-2 px-2">
        {currentPromotions.map((discount, idx) => (
          <motion.div
            key={`${discount.source}-${idx}`}
            layoutId={`discount-${selectedTabId}-${idx}`}
            layout="position"
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <DiscountCard discount={discount} selectedType={selectedType} />
          </motion.div>
        ))}
        {currentPromotions.length === 0 && selectedTabId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="col-span-full py-8"
          >
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-card p-8 text-center">
              <div className="text-muted-foreground">
                <Filter className="mx-auto mb-2 h-12 w-12 opacity-50" />
                <h3 className="text-xl font-semibold">No hay promociones</h3>
                <p className="mt-2 text-sm">
                  No se encontraron promociones para este día{" "}
                  {selectedSupermarket
                    ? `en ${SUPERMARKET_NAMES[selectedSupermarket]}`
                    : ""}
                  .
                </p>
              </div>
              {selectedSupermarket && (
                <Button
                  variant="outline"
                  onClick={() => setSelectedSupermarket(null)}
                  className="mt-2"
                >
                  Ver todos los supermercados
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </div>
      <div className="mt-2 flex flex-col items-stretch p-2 border-secondary rounded-lg gap-2 mb-2 max-w-md mx-auto">
        <FeedbackForm />
        <ShareButton
          currentPromotions={currentPromotions}
          formattedWeekDates={formattedWeekDates}
          currentTabIndex={currentTabIndex}
        />
        <a
          href="https://cafecito.app/descuentito"
          rel="noopener"
          target="_blank"
          className="mx-auto"
        >
          <img
            srcSet="https://cdn.cafecito.app/imgs/buttons/button_2.png 1x, https://cdn.cafecito.app/imgs/buttons/button_2_2x.png 2x, https://cdn.cafecito.app/imgs/buttons/button_2_3.75x.png 3.75x"
            src="https://cdn.cafecito.app/imgs/buttons/button_2.png"
            alt="Invitame un café en cafecito.app"
          />
        </a>
      </div>
    </>
  );
}

function ShareButton({
  currentPromotions,
  formattedWeekDates,
  currentTabIndex,
}: {
  currentPromotions: Discount[];
  formattedWeekDates: ReturnType<typeof getFormattedWeekDates>;
  currentTabIndex: number;
}) {
  return (
    <Button
      variant="outline"
      className="text-lg py-6 rounded-full"
      size="lg"
      onClick={async () => {
        const promotionsText = currentPromotions
          .map((promotion) => {
            const source =
              SUPERMARKET_NAMES[promotion.source] || promotion.source;
            const discountType =
              promotion.discount.type === "cuotas sin intereses" ? "CSI" : "%";
            const paymentMethodsText =
              promotion.paymentMethods && promotion.paymentMethods.length > 0
                ? ` con ${promotion.paymentMethods.flat().slice(0, 2).join(", ")}${promotion.paymentMethods.flat().length > 2 ? "..." : ""}`
                : "";
            return `* ${promotion.discount.value}${discountType} en ${source}${paymentMethodsText}`;
          })
          .join("\n");
        const text = `Mira estos descuentos en supermercados para ${formattedWeekDates[currentTabIndex]?.display || "hoy"}:\n${promotionsText}\n\nEncontrá más descuentos en descuentito.ar`;

        try {
          if (navigator.share) {
            await navigator.share({
              text,
            });
          } else {
            navigator.clipboard.writeText(text);
            alert("Link copiado al portapapeles");
          }
        } catch {}
      }}
    >
      <Share2 className="size-5" />
      Compartir
    </Button>
  );
}

function PromotionsSkeleton({ tabId }: { tabId: string }) {
  return (
    <div className="mx-auto max-w-screen-md grid grid-cols-1 gap-2 px-2">
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, idx) => (
          <motion.div
            key={`skeleton-${tabId}-${idx}`}
            layoutId={`discount-${tabId}-${idx}`}
            layout="position"
            className="rounded-lg border bg-card px-3 py-2"
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-7 w-1/7" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-5.5 w-2/3" />
                <Skeleton className="h-5.5 w-1/2" />
              </div>
              <div className="grid grid-cols-2 gap-1 items-center justify-center">
                <Skeleton className="h-6 w-6 rounded" />
                <Skeleton className="h-6 w-6 rounded" />
                <Skeleton className="h-6 w-6 rounded" />
                <Skeleton className="h-6 w-6 rounded" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Home() {
  const { promotions } = Route.useLoaderData();
  const { supermarket: initialSupermarket } = Route.useSearch();

  const formattedWeekDates = useMemo(getFormattedWeekDates, []);
  const todayIndex = useMemo(
    () =>
      formattedWeekDates.findIndex((date) =>
        date.dayjs.isSame(dayjs().tz(timeZone), "day"),
      ),
    [formattedWeekDates],
  );

  const [selectedTabId, setSelectedTabId] = useState<string>(
    dayjs().tz(timeZone).format("YYYY-MM-DD"),
  );
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<"Presencial" | "Online">(
    "Presencial",
  );
  const [selectedSupermarket, setSelectedSupermarket] = useState<string | null>(
    initialSupermarket || null,
  );
  const [selectedPromotionType, setSelectedPromotionType] = useState<
    "Todos" | "Descuentos" | "Cuotas"
  >("Todos");

  const { savedPaymentMethods, savedConditions, membershipSetupCompleted } =
    usePaymentMethodsStore();
  const shouldFilterByPaymentMethods = useShouldFilterByPaymentMethods();

  // Membership setup popup state
  const [showMembershipPopup, setShowMembershipPopup] = useState(false);

  // Show membership popup if user has payment methods but hasn't completed membership setup
  useEffect(() => {
    const hasPaymentMethods = savedPaymentMethods.size > 0;
    const shouldShowPopup = hasPaymentMethods && !membershipSetupCompleted;

    if (shouldShowPopup) {
      // Add a small delay to let the page load before showing popup
      const timer = setTimeout(() => {
        setShowMembershipPopup(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [savedPaymentMethods.size, membershipSetupCompleted]);

  // Reset selectedTabId if it becomes invalid (e.g., due to data changes)
  useEffect(() => {
    if (
      selectedTabId &&
      !formattedWeekDates.some((d) => d.id === selectedTabId)
    ) {
      const newIndex = todayIndex >= 0 ? todayIndex : 0;
      setSelectedTabId(formattedWeekDates[newIndex]?.id ?? undefined);
    }
  }, [selectedTabId, formattedWeekDates, todayIndex]);

  const currentTabIndex = formattedWeekDates.findIndex(
    (d) => d.id === selectedTabId,
  );

  const isClient = useIsClient();

  return (
    <>
      <div className="site-container bg-backgrounder relative min-h-[70vh] flex flex-col">
        <motion.div
          className="bg-sidebar"
          layout="size"
          transition={{ duration: 0.3 }}
        >
          {/* Static Title Block */}
          <motion.div
            className="container mx-auto max-w-3xl px-4 pt-4 bg-sidebar"
            layout="position"
            transition={{ duration: 0.3 }}
          >
            <div>
              <h1 className="flex items-center gap-2 text-3xl font-bold">
                descuentito.ar
                <Badge variant="destructive">beta :)</Badge>
              </h1>
              <h2 className="text-lg font-medium">
                Descuentos en supermercados de CABA
              </h2>
            </div>
          </motion.div>

          {/* Conditional Content Block (Separate Sibling) */}
          <div className="container mx-auto max-w-3xl px-4 bg-sidebar">
            <motion.div className="flex flex-col justify-center pb-2">
              <AnimatePresence mode="popLayout">
                {!isClient ? (
                  <motion.div
                    key="skeleton"
                    layout
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-2 flex w-full items-center gap-2 rounded-md border bg-sidebar px-3 py-5"
                  >
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-4" />
                  </motion.div>
                ) : savedPaymentMethods.size > 0 ? (
                  <motion.div
                    key="saved-payments"
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Link
                      to="/configuracion/medios"
                      className="mt-2 flex flex-col w-full space-x-2 rounded-md border p-3 text-sm ring-1 ring-secondary transition-all gap-1"
                    >
                      <div className="flex-grow flex items-center justify-between">
                        <span className="flex-grow font-medium">
                          Configurá tus medios de pago guardados
                        </span>
                        <span>→</span>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {Array.from(savedPaymentMethods).map((pm) => (
                          <PaymentMethodLogo key={pm} method={pm} small />
                        ))}
                      </div>
                    </Link>
                  </motion.div>
                ) : (
                  <motion.div
                    className="mt-2"
                    key="welcome-message"
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.div className="flex flex-col w-full rounded-md border border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/40 p-4 shadow-sm gap-3">
                      <div className="flex gap-3 items-start">
                        <motion.div
                          className="h-10 w-10 flex-shrink-0 flex items-center justify-center"
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 260,
                            damping: 20,
                            delay: 0.2,
                          }}
                        >
                          <img
                            src="/descuentin.svg"
                            alt="Descuentin"
                            className="size-16"
                          />
                        </motion.div>
                        <div className="flex-1">
                          <motion.p
                            className="font-medium text-green-800 dark:text-green-300"
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3, duration: 0.3 }}
                          >
                            ¡Hola! Soy Descuentin y te voy a ayudar a encontrar
                            los mejores descuentos
                          </motion.p>
                          <motion.p
                            className="mt-1 text-sm text-green-700 dark:text-green-400"
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5, duration: 0.3 }}
                          >
                            Configurá tus medios de pago para ver solo los
                            descuentos que te sirven a vos
                          </motion.p>
                        </div>
                      </div>
                      <motion.div
                        className="flex gap-2 justify-end"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7, duration: 0.3 }}
                      >
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                          asChild
                        >
                          <Link
                            to="/configuracion/medios/wizard/$step"
                            params={{ step: "welcome" }}
                          >
                            Configurá ahora
                            <CreditCard className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </motion.div>

        <div className="h-[env(safe-area-inset-top)] fixed top-0 left-0 right-0 z-40 bg-sidebar/90 backdrop-blur"></div>

        <motion.header
          layout
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="sticky top-[env(safe-area-inset-top)] z-40 w-full bg-sidebar/90 shadow-md backdrop-blur"
        >
          <div className="mx-auto w-full my-2">
            <div className="flex items-center justify-center px-2">
              <Tabs
                value={selectedTabId}
                onValueChange={(value: string) => setSelectedTabId(value)}
                className="mb-0"
              >
                <TabsList className="flex md:gap-1 overflow-x-auto scrollbar-hide">
                  {formattedWeekDates.map((weekDateInfo) => (
                    <TabsTrigger
                      key={weekDateInfo.id}
                      value={weekDateInfo.id}
                      className="xs:px-4 px-2"
                    >
                      <span className="hidden lg:block">
                        {weekDateInfo.display}
                      </span>
                      <span className="block lg:hidden">
                        {weekDateInfo.shortDisplay}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsFilterDrawerOpen(true)}
                className="ml-2 flex-shrink-0 relative"
                aria-label="Filtros"
              >
                <Filter className="h-4 w-4" />
                {(selectedSupermarket ||
                  selectedPromotionType !== "Todos" ||
                  selectedType !== "Online" ||
                  shouldFilterByPaymentMethods) && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                  </span>
                )}
              </Button>
            </div>
          </div>
        </motion.header>

        <motion.div className="flex-grow pt-3 relative pb-3">
          <LayoutGroup>
            <AnimatePresence initial={false} mode="wait">
              {!isClient ? (
                <PromotionsSkeleton
                  key={`skeleton-${selectedTabId}`}
                  tabId={selectedTabId}
                />
              ) : (
                <Await
                  promise={promotions}
                  fallback={
                    <PromotionsSkeleton
                      key={`skeleton-fallback-${selectedTabId}`}
                      tabId={selectedTabId}
                    />
                  }
                >
                  {(data) => (
                    <Promotions
                      key={`promotions-${selectedTabId}`}
                      promotionsData={data}
                      selectedType={selectedType}
                      selectedSupermarket={selectedSupermarket}
                      selectedPromotionType={selectedPromotionType}
                      formattedWeekDates={formattedWeekDates}
                      selectedTabId={selectedTabId}
                      currentTabIndex={currentTabIndex}
                      setSelectedSupermarket={setSelectedSupermarket}
                    />
                  )}
                </Await>
              )}
            </AnimatePresence>
          </LayoutGroup>
        </motion.div>

        <Drawer
          open={isFilterDrawerOpen}
          onOpenChange={setIsFilterDrawerOpen}
          repositionInputs={false}
        >
          <DrawerContent>
            <div className="mx-auto w-full max-w-sm overflow-y-auto">
              <DrawerHeader className="pb-0 text-xl">
                <DrawerTitle>Filtros</DrawerTitle>
              </DrawerHeader>
              <div className="p-4">
                <div className="mb-4">
                  <h3 className="mb-2 font-medium">Tipo de compra</h3>
                  <Tabs
                    value={selectedType}
                    onValueChange={(value) =>
                      setSelectedType(value as "Presencial" | "Online")
                    }
                    className="mb-4"
                  >
                    <TabsList className="grid w-full grid-cols-2 rounded-full py-1 h-auto">
                      {["Presencial", "Online"].map((type) => (
                        <TabsTrigger
                          key={type}
                          value={type}
                          className="rounded-full px-4 text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                        >
                          {type}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>

                {/* Supermarket Filter */}
                <div className="mb-4">
                  <h3 className="mb-2 font-medium">Supermercado</h3>
                  <SupermarketFilter
                    selectedSupermarket={selectedSupermarket}
                    onSelect={(supermarket: string | null) => {
                      setSelectedSupermarket(supermarket);
                    }}
                  />
                </div>

                {/* Promotion Type Filter */}
                <div className="mb-4">
                  <h3 className="mb-2 font-medium">Tipo de promoción</h3>
                  <Tabs
                    value={selectedPromotionType}
                    onValueChange={(value) =>
                      setSelectedPromotionType(
                        value as "Todos" | "Descuentos" | "Cuotas",
                      )
                    }
                    className="mb-4"
                  >
                    <TabsList className="grid w-full grid-cols-3 rounded-full py-1 h-auto">
                      {["Todos", "Descuentos", "Cuotas"].map((type) => (
                        <TabsTrigger
                          key={type}
                          value={type}
                          className="flex-1 rounded-full px-4 text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                        >
                          {type}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
                <FilterByPaymentMethodsButton className="mt-2" />
              </div>
            </div>
            <DrawerFooter className="border-t sticky bottom-0 pb-[calc(env(safe-area-inset-bottom)+.5rem)] bg-sidebar">
              <DrawerClose asChild>
                <Button variant="default" className="max-w-sm mx-auto w-full">
                  Aplicar filtros
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>

      <MembershipSetupPopup
        isOpen={showMembershipPopup}
        onClose={() => setShowMembershipPopup(false)}
      />
    </>
  );
}
