import { Await, createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import dayjs, { Dayjs } from "dayjs";
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
  DrawerTrigger,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "src/components/ui/drawer";
import { Button } from "src/components/ui/button";
import { Filter, Sparkles } from "lucide-react";
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
import { BRAND_LOGOS_SMALL } from "@/lib/logos";
import SupermarketLogo from "@/components/supermarket-logo";
import { Skeleton } from "@/components/ui/skeleton";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(weekday);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const timeZone = "America/Argentina/Buenos_Aires";
const getFormattedWeekDates = () => {
  const weekStartDate = dayjs().tz(timeZone).startOf("day");
  const weekDates = Array.from({ length: 7 }, (_, i) =>
    weekStartDate.add(i, "day")
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
              !(promotion.where.length === 1 && promotion.where[0] === "Maxi")
          );
        }
        if (source === "changomas") return [];
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

        if (promotion.paymentMethods && shouldFilterByPaymentMethods) {
          const isPassedByPaymentMethods = (() => {
            if (
              // if promotion only requires a payment rail and user has it
              promotion.paymentMethods
                .map((pm) => (Array.isArray(pm) ? pm : [pm]))
                .every(
                  (pm) =>
                    pm.length === 1 && PAYMENT_RAILS.includes(pm[0] as any)
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
                    savedPaymentMethods.has(pm2 as any)
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
        // Basic date/weekday filtering - needs full logic from Svelte
        if (
          promotion.weekdays &&
          !promotion.weekdays.includes(weekDateInfo.weekday) // weekday is checked above
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

  return (
    selectedTabId && (
      <div className="mx-auto max-w-screen-md grid grid-cols-1 gap-2 px-2">
        {currentTabIndex >= 0 &&
          promotionsByWeekday[currentTabIndex]?.map((discount, idx) => (
            <DiscountCard
              key={`${discount.source}-${idx}`}
              discount={discount}
              selectedType={selectedType}
            />
          ))}
        {currentTabIndex >= 0 &&
          promotionsByWeekday[currentTabIndex]?.length === 0 && (
            <div className="col-span-full py-8">
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
            </div>
          )}
      </div>
    )
  );
}

function PromotionsSkeleton() {
  return (
    <div className="mx-auto max-w-screen-md grid grid-cols-1 gap-2 px-2 py-3">
      <div className="space-y-2">
        {Array.from({ length: 13 }).map((_, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2"
          >
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
        ))}
      </div>
    </div>
  );
}

function Home() {
  const { promotions } = Route.useLoaderData();

  const formattedWeekDates = useMemo(getFormattedWeekDates, []);
  const todayIndex = useMemo(
    () =>
      formattedWeekDates.findIndex((date) =>
        date.dayjs.isSame(dayjs().tz(timeZone), "day")
      ),
    [formattedWeekDates]
  );

  const [selectedTabId, setSelectedTabId] = useState<string>(
    dayjs().tz(timeZone).format("YYYY-MM-DD")
  );
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<"Presencial" | "Online">(
    "Presencial"
  );
  const [selectedSupermarket, setSelectedSupermarket] = useState<string | null>(
    null
  );
  const [selectedPromotionType, setSelectedPromotionType] = useState<
    "Todos" | "Descuentos" | "Cuotas"
  >("Todos");

  const { savedPaymentMethods, savedConditions } = usePaymentMethodsStore();
  const shouldFilterByPaymentMethods = useShouldFilterByPaymentMethods();

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
    (d) => d.id === selectedTabId
  );

  return (
    <div className="site-container bg-background relative min-h-screen flex flex-col">
      <div className="bg-sidebar pb-2 pt-4">
        <div className="container mx-auto max-w-4xl px-4">
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            descuentito.ar
            <Badge variant="destructive">beta :)</Badge>
          </h1>
          <h2 className="text-lg font-medium">
            Descuentos en supermercados de CABA
          </h2>

          {typeof window === "undefined" ? (
            <div className="mt-2 flex w-full items-center gap-2 rounded-md border px-3 py-5">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-4" />
            </div>
          ) : savedPaymentMethods.size > 0 ? (
            <>
              <Link
                to="/configuracion/medios"
                className="mt-2 flex flex-col w-full space-x-2 rounded-md border p-3 text-sm ring-1 ring-secondary transition-all gap-1"
              >
                <div className="flex-grow flex items-center justify-between">
                  <span className="flex-grow font-medium">
                    Configurar mis medios de pago guardados
                  </span>
                  <span>→</span>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {Array.from(savedPaymentMethods).map((pm) => (
                    <PaymentMethodLogo key={pm} method={pm} small />
                  ))}
                </div>
              </Link>
            </>
          ) : (
            <Link
              to="/configuracion/medios"
              className="mt-2 flex w-full items-center space-x-2 rounded-md border border-yellow-300 bg-gradient-to-r from-yellow-100/70 to-amber-100/70 px-3 py-4 text-sm shadow-sm transition-all hover:bg-gradient-to-r hover:from-yellow-200/70 hover:to-amber-200/70 dark:border-yellow-700 dark:bg-gradient-to-r dark:from-yellow-900/40 dark:to-amber-900/40 dark:hover:from-yellow-800/40 dark:hover:to-amber-800/40 gap-1"
            >
              <Sparkles className="mr-1 h-8 w-8 text-yellow-500 dark:text-yellow-400" />
              <span className="flex-grow font-medium">
                Configura tus medios de pago para ver descuentos personalizados
              </span>
              <span className="text-amber-600 dark:text-amber-400">→</span>
            </Link>
          )}
        </div>
      </div>

      <header className="sticky top-0 z-40 w-full bg-sidebar/70 py-2 shadow-md backdrop-blur">
        <div className="mx-auto w-full">
          <div className="flex items-center justify-between gap-2 px-2">
            <Tabs
              value={selectedTabId}
              onValueChange={(value: string) => setSelectedTabId(value)}
              className="mx-auto mb-0"
            >
              <TabsList className="flex md:gap-1 overflow-x-auto scrollbar-hide">
                {formattedWeekDates.map((weekDateInfo) => (
                  <TabsTrigger
                    key={weekDateInfo.id}
                    value={weekDateInfo.id}
                    className="xs:px-4 px-2.5"
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
          </div>
        </div>
      </header>

      <div className="flex-grow pt-3 relative">
        {typeof window === "undefined" ? (
          <PromotionsSkeleton />
        ) : (
          <Await promise={promotions} fallback={<PromotionsSkeleton />}>
            {(data) => {
              return (
                <Promotions
                  promotionsData={data}
                  selectedType={selectedType}
                  selectedSupermarket={selectedSupermarket}
                  selectedPromotionType={selectedPromotionType}
                  formattedWeekDates={formattedWeekDates}
                  selectedTabId={selectedTabId}
                  currentTabIndex={currentTabIndex}
                  setSelectedSupermarket={setSelectedSupermarket}
                />
              );
            }}
          </Await>
        )}
      </div>

      <Drawer open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
        <DrawerTrigger asChild>
          <div
            className="bg-sidebar text-primary fixed bottom-0 z-50 flex w-full flex-col items-center justify-center gap-2 rounded-t-[10px] px-4 pb-2 text-lg font-medium shadow-xl"
            onClick={() => setIsFilterDrawerOpen(true)}
            onTouchStart={() => setIsFilterDrawerOpen(true)}
          >
            <div className="bg-muted mx-auto mt-4 h-2 w-[100px] rounded-full"></div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="">Filtros</span>
              <Badge variant="outline" className="ml-1">
                {selectedType}
              </Badge>
              {selectedSupermarket &&
                (BRAND_LOGOS_SMALL[selectedSupermarket] ? (
                  <SupermarketLogo
                    source={selectedSupermarket}
                    small
                    className="h-4 w-4"
                  />
                ) : (
                  <Badge variant="outline" className="ml-1">
                    {selectedSupermarket}
                  </Badge>
                ))}
              {selectedPromotionType !== "Todos" && (
                <Badge variant="outline" className="ml-1">
                  {selectedPromotionType}
                </Badge>
              )}
            </div>
          </div>
        </DrawerTrigger>
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
                      value as "Todos" | "Descuentos" | "Cuotas"
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
            <DrawerFooter className="border-t sticky bottom-0">
              <DrawerClose asChild>
                <Button variant="default">Aplicar filtros</Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
