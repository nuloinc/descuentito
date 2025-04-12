import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect, useMemo } from "react";
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
  DrawerTrigger,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "src/components/ui/drawer";
import { Button } from "src/components/ui/button";
import { Filter, Sparkles } from "lucide-react";
import { cn } from "src/lib/utils"; // Import cn utility
import { DiscountCard, PaymentMethodLogo } from "src/components/discount-card"; // Import the actual component
import SupermarketFilter from "src/components/supermarket-filter"; // Import the actual component
import FilterByPaymentMethodsButton from "src/components/filter-by-payment-methods-button"; // Import the actual component
import {
  usePaymentMethodsStore,
  useShouldFilterByPaymentMethods,
  SOURCES,
  SUPERMARKET_NAMES,
} from "src/lib/state";
import { Discount, PAYMENT_RAILS } from "promos-db/schema";
import { getPromotions, PromotionData } from "src/server/promotions";
import { useRouter } from "@tanstack/react-router";

// Dayjs setup
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(weekday);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

// Helper for weekdays
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
    // Use the server function to load data
    return await getPromotions();
  },
  ssr: false,
});

function Home() {
  const promotionsData = Route.useLoaderData();
  const router = useRouter();
  const isLoading = router.state.isLoading;
  const [error, setError] = useState<Error | null>(null);

  const formattedWeekDates = useMemo(getFormattedWeekDates, []);
  const todayIndex = useMemo(
    () =>
      formattedWeekDates.findIndex((date) =>
        date.dayjs.isSame(dayjs().tz(timeZone), "day")
      ),
    [formattedWeekDates]
  );

  // Initialize state with simple defaults
  const [selectedTabId, setSelectedTabId] = useState<string | undefined>(
    undefined
  );
  const [currentContentIndex, setCurrentContentIndex] = useState<number>(0);
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

  // Get payment method state from Zustand store
  const { savedPaymentMethods, savedConditions } = usePaymentMethodsStore();
  const shouldFilterByPaymentMethods = useShouldFilterByPaymentMethods();

  // Refs for scrolling
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const contentElementsRef = useRef<HTMLDivElement[]>([]);

  // Effect to set initial tab/index after mount
  useEffect(() => {
    if (formattedWeekDates.length > 0) {
      const initialIndex = todayIndex >= 0 ? todayIndex : 0;
      setCurrentContentIndex(initialIndex);
      setSelectedTabId(formattedWeekDates[initialIndex]?.id ?? undefined);
    }
  }, [formattedWeekDates, todayIndex]); // Run when dates/index are ready

  // Implement scrolling logic using IntersectionObserver
  useEffect(() => {
    if (!contentContainerRef.current) return;

    const contentContainer = contentContainerRef.current;
    const contentElements = contentElementsRef.current.filter(Boolean);

    if (contentElements.length === 0) return;

    // Set up IntersectionObserver to track which day is most visible
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = contentElements.findIndex(
              (el) => el === entry.target
            );
            if (index !== -1 && index !== currentContentIndex) {
              setCurrentContentIndex(index);
              setSelectedTabId(formattedWeekDates[index]?.id);
            }
            break;
          }
        }
      },
      {
        root: contentContainer,
        threshold: 0.7,
        rootMargin: "0px",
      }
    );

    // Observe all content sections
    contentElements.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      contentElements.forEach((el) => {
        if (el) observer.unobserve(el);
      });
    };
  }, [formattedWeekDates, currentContentIndex]);

  // Function to scroll to a specific day
  const scrollToDay = (index: number) => {
    if (contentElementsRef.current[index] && contentContainerRef.current) {
      contentContainerRef.current.scrollTo({
        left: contentElementsRef.current[index].offsetLeft,
        behavior: "smooth",
      });
    }
  };

  // Update tab when handleTabChange is called
  const handleTabChange = (value: string) => {
    const index = formattedWeekDates.findIndex((date) => date.id === value);
    if (index === -1) return;
    setSelectedTabId(value);
    setCurrentContentIndex(index);
    scrollToDay(index);
  };

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
    return allPromotions.filter((promotion: Discount) => {
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
        if (
          !Array.from(promotion.paymentMethods as string[]).some((pm) => {
            const pms = Array.isArray(pm) ? pm : [pm];
            if (
              pms.every((pm2: string) => PAYMENT_RAILS.includes(pm2 as any)) &&
              // For cases like "MODO+Cabal" where user has MODO but not Cabal
              (pms.length > 1 ? !pms.includes("MODO") : true)
            ) {
              return true;
            }
            return pms.some(
              (pm2: string) =>
                !PAYMENT_RAILS.includes(pm2 as any) &&
                savedPaymentMethods.has(pm2)
            );
          })
        ) {
          return false;
        }
      }

      // Filter out specific programs that user might not qualify for
      if (promotion.appliesOnlyTo?.programaCiudadaniaPorteña) return false;
      if (promotion.appliesOnlyTo?.anses && !savedConditions.anses)
        return false;
      if (promotion.appliesOnlyTo?.jubilados && !savedConditions.jubilados)
        return false;

      return true;
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
      // Defensive check for weekDateInfo
      if (!weekDateInfo || !weekDateInfo.dayjs || !weekDateInfo.weekday)
        return [];
      return basePromotions.filter((promotion: Discount) => {
        // Defensive check for promotion object
        if (!promotion) return false;
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

  // Reset selectedTabId if it becomes invalid (e.g., due to data changes)
  useEffect(() => {
    if (
      selectedTabId &&
      !formattedWeekDates.some((d) => d.id === selectedTabId)
    ) {
      const newIndex = todayIndex >= 0 ? todayIndex : 0;
      setSelectedTabId(formattedWeekDates[newIndex]?.id ?? undefined);
      setCurrentContentIndex(newIndex);
    }
  }, [selectedTabId, formattedWeekDates, todayIndex]);

  if (error) {
    return <div>Error loading promotions: {error.message}</div>;
  }

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

          {savedPaymentMethods.size > 0 ? (
            <>
              <FilterByPaymentMethodsButton className="mt-2" />
              <a
                href="/configuracion/medios"
                className="mt-2 flex flex-col w-full space-x-2 rounded-md border p-3 text-sm ring-1 ring-gray-300 transition-all gap-1"
              >
                <div className="flex-grow flex items-center justify-between">
                  <span className="flex-grow font-medium">
                    Configurar mis medios de pago guardados
                  </span>
                  <span className="text-gray-500">→</span>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {Array.from(savedPaymentMethods).map((pm) => (
                    <PaymentMethodLogo key={pm} method={pm} small />
                  ))}
                </div>
              </a>
            </>
          ) : (
            <a
              href="/configuracion/medios"
              className="mt-2 flex w-full items-center space-x-2 rounded-md border border-yellow-300 bg-gradient-to-r from-yellow-100/70 to-amber-100/70 p-3 text-sm shadow-sm transition-all hover:bg-gradient-to-r hover:from-yellow-200/70 hover:to-amber-200/70 dark:border-yellow-700 dark:bg-gradient-to-r dark:from-yellow-900/40 dark:to-amber-900/40 dark:hover:from-yellow-800/40 dark:hover:to-amber-800/40"
            >
              <Sparkles className="mr-1 h-8 w-8 text-yellow-500 dark:text-yellow-400" />
              <span className="flex-grow font-medium">
                Configura tus medios de pago para ver descuentos personalizados
              </span>
              <span className="text-amber-600 dark:text-amber-400">→</span>
            </a>
          )}
        </div>
      </div>

      {/* Sticky Tabs Header */}
      <header className="sticky top-0 z-40 w-full bg-sidebar/70 py-2 shadow-md backdrop-blur">
        <div className="mx-auto w-full">
          <div className="flex items-center justify-between gap-2 px-2">
            <Tabs
              value={selectedTabId}
              onValueChange={handleTabChange}
              className="mx-auto mb-0"
            >
              <TabsList className="flex md:gap-1">
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

      {/* Content Area - Horizontal Scroll */}
      <div
        ref={contentContainerRef}
        className="scrollbar-hide flex w-full flex-grow snap-x snap-mandatory overflow-x-auto pt-3"
        style={{
          scrollBehavior: "smooth",
          WebkitOverflowScrolling: "touch",
          scrollSnapType: "x mandatory",
        }}
      >
        {formattedWeekDates.map((weekDateInfo, index) => (
          <div
            key={weekDateInfo.id}
            ref={(el) => {
              if (el) contentElementsRef.current[index] = el;
            }} // Assign ref
            className={cn(
              "w-full min-w-full flex-shrink-0 flex-grow-0 snap-center px-1 opacity-30 transition-opacity duration-300 ease-out",
              index === currentContentIndex && "!opacity-100"
            )}
            style={{ scrollSnapAlign: "center" }}
          >
            <div className="mx-auto grid max-w-screen-md grid-cols-1 gap-4 px-2 pb-20">
              {" "}
              {/* Added padding bottom */}
              {promotionsByWeekday[index]?.map((discount, idx) => (
                <DiscountCard
                  key={`${discount.source}-${idx}`}
                  discount={discount}
                  selectedType={selectedType} // Pass selectedType
                /> // Added key
              ))}
              {promotionsByWeekday[index]?.length === 0 && (
                <div className="col-span-full py-8">
                  <div className="flex flex-col items-center justify-center gap-4 rounded-lg border bg-card p-8 text-center">
                    <div className="text-muted-foreground">
                      <Filter className="mx-auto mb-2 h-12 w-12 opacity-50" />
                      <h3 className="text-xl font-semibold">
                        No hay promociones
                      </h3>
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
          </div>
        ))}
      </div>

      {/* Filter Drawer */}
      <Drawer open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
        <DrawerTrigger asChild>
          <div
            className="bg-sidebar text-primary fixed bottom-0 z-50 flex w-full flex-col items-center justify-center gap-2 rounded-t-[10px] px-4 pb-2 text-lg font-medium shadow-xl"
            onClick={() => setIsFilterDrawerOpen(true)}
          >
            <div className="bg-muted mx-auto mt-4 h-2 w-[100px] rounded-full"></div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="">Filtros</span>
              <Badge variant="outline" className="ml-1">
                {selectedType}
              </Badge>
            </div>
          </div>
        </DrawerTrigger>
        <DrawerContent>
          <div className="mx-auto w-full max-w-sm">
            <DrawerHeader>
              <DrawerTitle>Filtros</DrawerTitle>
              <DrawerDescription>
                Personaliza tu búsqueda de promociones
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-4">
              {/* Type Filter (Presencial/Online) */}
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
            </div>
            <DrawerFooter>
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
