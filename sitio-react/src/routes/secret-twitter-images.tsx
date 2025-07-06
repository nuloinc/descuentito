import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Button } from "src/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "src/components/ui/card";
import { RefreshCw } from "lucide-react";
import { getPromotions, type PromotionData } from "src/server/promotions";
import { Discount } from "promos-db/schema";
import { WALLET_ICONS } from "src/lib/logos";
import SupermarketLogo from "src/components/supermarket-logo";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const timeZone = "America/Argentina/Buenos_Aires";

export const Route = createFileRoute("/secret-twitter-images")({
  component: SecretTwitterImages,
  loader: async () => {
    return {
      promotions: await getPromotions(),
    };
  },
});

function SecretTwitterImages() {
  const { promotions } = Route.useLoaderData();

  // Get best discounts of the week
  const selectedDiscounts = useMemo(() => {
    if (!promotions) return [];

    const allPromotions = Object.entries(promotions as PromotionData)
      .flatMap(([source, sourcePromotions]) => {
        if (!sourcePromotions) return [];
        if (source === "carrefour") {
          return sourcePromotions.filter(
            (promotion) =>
              !(promotion.where.length === 1 && promotion.where[0] === "Maxi"),
          );
        }
        return sourcePromotions;
      })
      .filter(Boolean);

    // Get current week's best discounts
    const currentWeek = dayjs().tz(timeZone);
    const validPromotions = allPromotions
      .filter((promotion: Discount) => {
        const validFrom = dayjs(promotion.validFrom);
        const validUntil = dayjs(promotion.validUntil);
        return (
          validFrom.isSameOrBefore(currentWeek, "day") &&
          validUntil.isSameOrAfter(currentWeek, "day")
        );
      })
      .sort((a, b) => {
        // Sort by discount value (higher percentages first)
        if (
          a.discount.type === "porcentaje" &&
          b.discount.type === "porcentaje"
        ) {
          return b.discount.value - a.discount.value;
        }
        if (a.discount.type === "porcentaje") return -1;
        if (b.discount.type === "porcentaje") return 1;
        return b.discount.value - a.discount.value;
      });

    // Merge discounts with same value but different payment methods
    const mergedDiscounts = new Map<string, Discount>();

    validPromotions.forEach((promotion: Discount) => {
      const key = `${promotion.source}-${promotion.discount.type}-${promotion.discount.value}-${promotion.onlyForProducts || "all"}`;

      if (mergedDiscounts.has(key)) {
        const existing = mergedDiscounts.get(key)!;
        // Merge payment methods
        const existingMethods = existing.paymentMethods || [];
        const newMethods = promotion.paymentMethods || [];
        existing.paymentMethods = [...existingMethods, ...newMethods];

        // Merge weekdays
        const existingWeekdays = existing.weekdays || [];
        const newWeekdays = promotion.weekdays || [];
        existing.weekdays = [...new Set([...existingWeekdays, ...newWeekdays])];
      } else {
        mergedDiscounts.set(key, { ...promotion });
      }
    });

    return Array.from(mergedDiscounts.values()).slice(0, 8); // Top 6 discounts
  }, [promotions]);

  const refreshDiscounts = () => {
    // Trigger a re-fetch or re-selection of discounts
    window.location.reload();
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">
          🤫 Generador de Imágenes para Twitter
        </h1>
        <p className="text-muted-foreground">
          Genera imágenes hermosas de los mejores descuentos de la semana para
          compartir en redes sociales
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Controles
            <Button variant="outline" size="sm" onClick={refreshDiscounts}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Toma una captura de pantalla del template de abajo para usar en
            redes sociales
          </p>
        </CardContent>
      </Card>

      {/* Template for screenshots */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">
          Template para Captura de Pantalla
        </h3>
        <div
          data-template
          className="w-[1200px] h-[675px] bg-gradient-to-br from-blue-700 to-purple-600 p-10 font-sans text-white relative overflow-hidden mx-auto border-none outline-none box-border"
        >
          {/* Background pattern */}
          <div
            className="absolute inset-0 opacity-[0.05] bg-[length:60px_60px]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold mb-2 text-white">
              🛒 Mejores descuentos de la semana
            </h1>
            <p className="text-2xl text-gray-200">
              Semana del {dayjs().tz(timeZone).format("DD/MM/YYYY")}
            </p>
          </div>

          {/* Discount cards */}
          <div className="grid grid-cols-4 grid-rows-3 gap-4">
            {selectedDiscounts.map((discount, index) => {
              const allWeekdays = ["L", "M", "M", "J", "V", "S", "D"];
              const weekdayNames = [
                "lunes",
                "martes",
                "miércoles",
                "jueves",
                "viernes",
                "sábado",
                "domingo",
              ];
              const discountWeekdays =
                discount.weekdays?.map((day) => day.toLowerCase()) || [];

              return (
                <div
                  key={index}
                  className="bg-white/95 rounded-lg p-3 flex flex-col justify-between min-h-[120px]"
                >
                  {/* Payment methods */}
                  {discount.paymentMethods &&
                    discount.paymentMethods.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {discount.paymentMethods
                          .flatMap((method: string | string[]) =>
                            Array.isArray(method) ? method : [method],
                          )
                          .filter(
                            (method) => WALLET_ICONS[method.split(" - ")[0]],
                          )
                          .filter(
                            (v, i, a) =>
                              a.findIndex(
                                (v2) =>
                                  WALLET_ICONS[v2.split(" - ")[0]] ===
                                  WALLET_ICONS[v.split(" - ")[0]],
                              ) === i,
                          )
                          .slice(0, 6)
                          .map((method, idx) => {
                            const iconSrc =
                              WALLET_ICONS[method.split(" - ")[0]];
                            return iconSrc ? (
                              <img
                                key={idx}
                                src={iconSrc}
                                alt={method}
                                className="w-4 h-4 object-contain rounded-xs"
                              />
                            ) : null;
                          })}
                      </div>
                    )}
                  <div className="flex items-start justify-between my-2">
                    <div className="text-5xl font-black text-gray-900">
                      {discount.discount.type === "porcentaje"
                        ? `${discount.discount.value}%`
                        : `${discount.discount.value}c/si`}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {allWeekdays.map((letter, idx) => {
                      const isActive =
                        discountWeekdays.includes(weekdayNames[idx]) ||
                        discountWeekdays.length === 0;
                      return (
                        <div
                          key={idx}
                          className={`text-xs font-medium px-1.5 py-1 rounded ${
                            isActive
                              ? "bg-violet-500 text-white"
                              : "bg-gray-200 text-gray-400"
                          }`}
                        >
                          {letter}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex-1 mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      {discount.where
                        .filter(
                          (where, index, array) =>
                            array.indexOf(where) === index,
                        )
                        .map((where) => (
                          <SupermarketLogo
                            key={where}
                            source={discount.source}
                            where={where}
                            className="h-4 w-auto rounded-xs"
                          />
                        ))}
                    </div>
                    {discount.onlyForProducts && (
                      <div className="text-xs text-purple-600 mt-1">
                        Solo {discount.onlyForProducts}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="absolute bottom-8 left-0 right-0 text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <img
                src="/descuentin.svg"
                alt="Descuentito"
                className="h-12 w-auto"
              />
              <div className="text-4xl font-bold text-white">
                descuentito.ar
              </div>
            </div>
            <div className="text-xl text-gray-200">
              Encuentra más descuentos en supermercados
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
