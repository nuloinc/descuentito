import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Button } from "src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "src/components/ui/card";
import { Badge } from "src/components/ui/badge";
import { Download, RefreshCw, Eye, EyeOff } from "lucide-react";
import { getPromotions, type PromotionData } from "src/server/promotions";
import { Discount } from "promos-db/schema";
import { SUPERMARKET_NAMES } from "src/lib/state";
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
  const [selectedDiscounts, setSelectedDiscounts] = useState<Discount[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  // Get best discounts of the week
  useEffect(() => {
    if (!promotions) return;

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
    const bestDiscounts = allPromotions
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
        if (a.discount.type === "porcentaje" && b.discount.type === "porcentaje") {
          return b.discount.value - a.discount.value;
        }
        if (a.discount.type === "porcentaje") return -1;
        if (b.discount.type === "porcentaje") return 1;
        return b.discount.value - a.discount.value;
      })
      .slice(0, 5); // Top 5 discounts

    setSelectedDiscounts(bestDiscounts);
  }, [promotions]);

  const generateImage = async () => {
    if (!canvasRef.current || selectedDiscounts.length === 0) return;

    setIsGenerating(true);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size for Twitter (1200x675 is optimal)
    canvas.width = 1200;
    canvas.height = 675;

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 1200, 675);
    gradient.addColorStop(0, "#1e40af"); // Blue
    gradient.addColorStop(1, "#7c3aed"); // Purple
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1200, 675);

    // Add subtle pattern/noise
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    for (let i = 0; i < 1000; i++) {
      const x = Math.random() * 1200;
      const y = Math.random() * 675;
      ctx.fillRect(x, y, 1, 1);
    }

    // Header
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px Inter, -apple-system, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🛒 Mejores Descuentos de la Semana", 600, 80);

    // Subtitle
    ctx.font = "24px Inter, -apple-system, system-ui, sans-serif";
    ctx.fillStyle = "#e5e7eb";
    const weekText = `Semana del ${dayjs().tz(timeZone).format("DD/MM")}`;
    ctx.fillText(weekText, 600, 120);

    // Discount cards
    let yPosition = 180;
    const cardHeight = 80;
    const cardSpacing = 10;

    selectedDiscounts.forEach((discount, index) => {
      const cardY = yPosition + index * (cardHeight + cardSpacing);
      
      // Card background
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.fillRect(80, cardY, 1040, cardHeight);
      
      // Card border
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 1;
      ctx.strokeRect(80, cardY, 1040, cardHeight);

      // Discount percentage/value
      ctx.fillStyle = "#1f2937";
      ctx.font = "bold 32px Inter, -apple-system, system-ui, sans-serif";
      ctx.textAlign = "left";
      const discountText = discount.discount.type === "porcentaje" 
        ? `${discount.discount.value}%` 
        : `${discount.discount.value}c/si`;
      ctx.fillText(discountText, 100, cardY + 40);

      // Supermarket name
      ctx.fillStyle = "#6b7280";
      ctx.font = "24px Inter, -apple-system, system-ui, sans-serif";
      const supermarketName = SUPERMARKET_NAMES[discount.source] || discount.source;
      ctx.fillText(`en ${supermarketName}`, 220, cardY + 40);

      // Product restriction (if any)
      if (discount.onlyForProducts) {
        ctx.fillStyle = "#7c3aed";
        ctx.font = "18px Inter, -apple-system, system-ui, sans-serif";
        ctx.fillText(`Solo ${discount.onlyForProducts}`, 220, cardY + 60);
      }

      // Payment methods hint
      if (discount.paymentMethods && discount.paymentMethods.length > 0) {
        ctx.fillStyle = "#059669";
        ctx.font = "16px Inter, -apple-system, system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText("Con medios seleccionados", 1100, cardY + 50);
      }
    });

    // Footer with branding
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px Inter, -apple-system, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("descuentito.ar", 600, 620);

    // Footer subtitle
    ctx.font = "20px Inter, -apple-system, system-ui, sans-serif";
    ctx.fillStyle = "#e5e7eb";
    ctx.fillText("Encuentra más descuentos en supermercados", 600, 650);

    // Copy to preview canvas if it exists
    if (previewRef.current) {
      const previewCanvas = previewRef.current;
      const previewCtx = previewCanvas.getContext("2d");
      if (previewCtx) {
        previewCanvas.width = 1200;
        previewCanvas.height = 675;
        previewCtx.drawImage(canvas, 0, 0);
      }
    }

    setIsGenerating(false);
  };

  const downloadImage = () => {
    if (!canvasRef.current) return;
    
    const link = document.createElement("a");
    link.download = `descuentos-semana-${dayjs().tz(timeZone).format("YYYY-MM-DD")}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  const refreshDiscounts = () => {
    // Trigger a re-fetch or re-selection of discounts
    window.location.reload();
  };

  return (
    <div className="container mx-auto max-w-4xl p-4 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">🤫 Generador de Imágenes para Twitter</h1>
        <p className="text-muted-foreground">
          Genera imágenes hermosas de los mejores descuentos de la semana para compartir en redes sociales
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Selected Discounts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Mejores Descuentos Seleccionados
              <Button variant="outline" size="sm" onClick={refreshDiscounts}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {selectedDiscounts.map((discount, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-lg font-bold">
                      {discount.discount.type === "porcentaje" 
                        ? `${discount.discount.value}%` 
                        : `${discount.discount.value}c/si`}
                    </Badge>
                    <div>
                      <div className="font-medium">
                        {SUPERMARKET_NAMES[discount.source] || discount.source}
                      </div>
                      {discount.onlyForProducts && (
                        <div className="text-sm text-muted-foreground">
                          Solo {discount.onlyForProducts}
                        </div>
                      )}
                    </div>
                  </div>
                  {discount.paymentMethods && discount.paymentMethods.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      Con medios específicos
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Controles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={generateImage} 
              className="w-full" 
              disabled={isGenerating || selectedDiscounts.length === 0}
            >
              {isGenerating ? "Generando..." : "Generar Imagen"}
            </Button>
            
            <Button 
              onClick={downloadImage} 
              variant="outline" 
              className="w-full"
              disabled={!canvasRef.current}
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar Imagen
            </Button>

            <Button 
              onClick={() => setShowPreview(!showPreview)} 
              variant="outline" 
              className="w-full"
            >
              {showPreview ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {showPreview ? "Ocultar Vista Previa" : "Mostrar Vista Previa"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Canvas and Preview */}
      <div className="space-y-4">
        <canvas
          ref={canvasRef}
          className="hidden"
          width={1200}
          height={675}
        />
        
        {showPreview && (
          <Card>
            <CardHeader>
              <CardTitle>Vista Previa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <canvas
                  ref={previewRef}
                  className="w-full h-auto max-w-full"
                  width={1200}
                  height={675}
                  style={{ aspectRatio: "1200/675" }}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}