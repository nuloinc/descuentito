import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import weekday from "dayjs/plugin/weekday";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Filter, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils"; // Import cn utility
// import { DiscountCard } from '@/components/discount-card'; // Will import later

// import type { Discount } from "promos-db"; // Assuming Discount type is exported
// Use any for now to unblock UI porting
type Discount = any;

// Define sources - potentially move to a shared lib later
const SOURCES = [
  "carrefour",
  "coto",
  "dia",
  "jumbo",
  "changomas",
  "makro",
] as const;
type Source = (typeof SOURCES)[number];

// Define the data structure we expect
export type PromotionData = {
  [key in Source]?: Discount[];
};

// Async function to fetch all promotions
const fetchPromotions = async (): Promise<PromotionData> => {
  const dataEntries = await Promise.all(
    SOURCES.map(async (source) => {
      const url = `https://raw.githubusercontent.com/nuloinc/descuentito-data/refs/heads/main/${source}.json`;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.warn(`Failed to fetch ${source}: ${response.statusText}`);
          return [source, []];
        }
        const kv = await response.text();
        return [source, JSON.parse(kv) as Discount[]];
      } catch (error) {
        console.error(`Error fetching or parsing ${source}:`, error);
        return [source, []];
      }
    })
  );
  return Object.fromEntries(dataEntries);
};

// Dayjs setup
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(weekday);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

// Placeholder components
const DiscountCard = ({
  discount,
  selectedType,
}: {
  discount: Discount;
  selectedType: "Presencial" | "Online";
}) => (
  <div className="border p-2 rounded my-1 bg-gray-100 dark:bg-gray-800">
    Discount Card Placeholder: {JSON.stringify(discount.discount)} for{" "}
    {selectedType}
  </div>
);
const SupermarketFilter = ({
  selectedSupermarket,
  onSelect,
}: {
  selectedSupermarket: string | null;
  onSelect: (supermarket: string | null) => void;
}) => <div>Supermarket Filter Placeholder</div>;
const FilterByPaymentMethodsButton = ({
  className,
}: {
  className?: string;
}) => (
  <button className={cn("border p-2 rounded", className)}>
    Payment Method Filter Button Placeholder
  </button>
);

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
});

function Home() {
  const {
    data: promotionsData,
    isLoading,
    error,
  } = useQuery<PromotionData, Error>({
    queryKey: ["promotions"],
    queryFn: fetchPromotions,
    staleTime: 1000 * 60 * 5, // Cache data for 5 minutes
  });

  const formattedWeekDates = useMemo(getFormattedWeekDates, []);
  const todayIndex = useMemo(
    () =>
      formattedWeekDates.findIndex((date) =>
        date.dayjs.isSame(dayjs().tz(timeZone), "day")
      ),
    [formattedWeekDates]
  );

  const [selectedTabId, setSelectedTabId] = useState(
    formattedWeekDates[todayIndex]?.id ?? formattedWeekDates[0]?.id // Handle potential undefined todayIndex
  );
  const [currentContentIndex, setCurrentContentIndex] = useState(
    todayIndex >= 0 ? todayIndex : 0
  ); // Handle potential -1 index
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

  // Refs for scrolling
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const contentElementsRef = useRef<HTMLDivElement[]>([]);

  // TODO: Implement scrolling logic (updateTabFromScroll, scrollToDay) using useEffect and Refs
  // TODO: Implement filtering logic based on selected filters
  // TODO: Implement logic for saved payment methods (will require state/context)

  const handleTabChange = (value: string) => {
    const index = formattedWeekDates.findIndex((date) => date.id === value);
    if (index === -1) return;
    setSelectedTabId(value);
    setCurrentContentIndex(index);
    // TODO: scrollToDay(index);
  };

  const handleSupermarketSelect = (supermarket: string | null) => {
    setSelectedSupermarket(supermarket);
    // TODO: Handle URL update if needed (using Tanstack Router)
  };

  if (isLoading) {
    return <div>Loading promotions...</div>;
  }

  if (error) {
    return <div>Error loading promotions: {error.message}</div>;
  }

  // Basic filtering logic (needs refinement based on Svelte version)
  const basePromotions = useMemo(() => {
    if (!promotionsData) return [];
    return Object.values(promotionsData).flat().filter(Boolean); // Flatten all promotions
  }, [promotionsData]);

  const promotionsByWeekday = useMemo(() => {
    return formattedWeekDates.map((weekDateInfo) => {
      return basePromotions.filter((promotion: Discount) => {
        // Basic date/weekday filtering - needs full logic from Svelte
        if (
          promotion.weekdays &&
          !promotion.weekdays.includes(weekDateInfo.weekday)
        )
          return false;
        const weekdayDate = weekDateInfo.dayjs;
        const validFrom = dayjs(promotion.validFrom, timeZone);
        const validUntil = dayjs(promotion.validUntil, timeZone);
        return (
          validFrom.isSameOrBefore(weekdayDate, "day") &&
          validUntil.isSameOrAfter(weekdayDate, "day")
        );
      });
    });
  }, [basePromotions, formattedWeekDates]);

  return (
    <div className="site-container bg-background relative min-h-screen flex flex-col">
      {/* Header Section */}
      <div className="bg-sidebar pb-2 pt-4">
        <div className="container mx-auto max-w-4xl px-4">
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            descuentito.ar (React)
            <Badge variant="destructive">beta :)</Badge>
          </h1>
          <h2 className="text-lg font-medium">
            Descuentos en supermercados de CABA
          </h2>
          {/* TODO: Add payment method configuration link/prompt */}
          <a
            href="#" // Placeholder link
            className="mt-2 flex w-full items-center space-x-2 rounded-md border border-yellow-300 bg-gradient-to-r from-yellow-100/70 to-amber-100/70 p-3 text-sm shadow-sm transition-all hover:bg-gradient-to-r hover:from-yellow-200/70 hover:to-amber-200/70 dark:border-yellow-700 dark:bg-gradient-to-r dark:from-yellow-900/40 dark:to-amber-900/40 dark:hover:from-yellow-800/40 dark:hover:to-amber-800/40"
          >
            <Sparkles className="mr-1 h-8 w-8 text-yellow-500 dark:text-yellow-400" />
            <span className="flex-grow font-medium">
              Configura tus medios de pago para ver descuentos personalizados
            </span>
            <span className="text-amber-600 dark:text-amber-400">→</span>
          </a>
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
                <div className="col-span-full">
                  <p className="text-center text-sm text-gray-500">
                    No hay promociones para este día
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Filter Drawer */}
      <Drawer open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
        <DrawerTrigger asChild>
          <Button
            variant="outline"
            className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full shadow-lg"
            onClick={() => setIsFilterDrawerOpen(true)}
          >
            <Filter className="mr-2 h-4 w-4" /> Filtros
          </Button>
          {/* Original Svelte Trigger Style (for reference/adaptation) */}
          {/* <div
            className={`bg-sidebar text-primary fixed bottom-0 z-50 flex w-full flex-col items-center justify-center gap-2 rounded-t-[10px] px-4 pb-2 text-lg font-medium shadow-xl`}
            onClick={() => setIsFilterDrawerOpen(true)} // Simplified trigger 
          >
            <div className="bg-muted mx-auto mt-4 h-2 w-[100px] rounded-full"></div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="">Filtros</span>
            </div>
          </div> */}
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
                  onSelect={handleSupermarketSelect}
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
