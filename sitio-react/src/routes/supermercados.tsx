import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "src/components/ui/button";
import { Card, CardContent } from "src/components/ui/card";
import { ExternalLink, ArrowLeft } from "lucide-react";
import { useEffect } from "react";

interface SupermarketLink {
  name: string;
  url: string;
  logo: string;
  bgColor: string;
  textColor: string;
  keyBinding: string;
  source: string;
}

const supermarkets: SupermarketLink[] = [
  {
    name: "Carrefour",
    url: "https://www.carrefour.com.ar/descuentos-bancarios",
    logo: "/logos/supermercados/carrefour_sin_texto.svg",
    bgColor: "bg-blue-600",
    textColor: "text-white",
    keyBinding: "c",
    source: "carrefour",
  },
  {
    name: "Coto",
    url: "https://www.coto.com.ar/descuentos/index.asp",
    logo: "/logos/supermercados/coto.svg",
    bgColor: "bg-red-600",
    textColor: "text-white",
    keyBinding: "o",
    source: "coto",
  },
  {
    name: "Día",
    url: "https://diaonline.supermercadosdia.com.ar/medios-de-pago-y-promociones",
    logo: "/logos/supermercados/dia.svg",
    bgColor: "bg-red-500",
    textColor: "text-white",
    keyBinding: "d",
    source: "dia",
  },
  {
    name: "Jumbo",
    url: "https://www.jumbo.com.ar/descuentos-del-dia?type=por-dia&day=1",
    logo: "/logos/supermercados/jumbo.png",
    bgColor: "bg-green-500",
    textColor: "text-black",
    keyBinding: "j",
    source: "jumbo",
  },
  {
    name: "Changomas",
    url: "https://www.masonline.com.ar/promociones-bancarias?banco=Todas",
    logo: "/logos/supermercados/changomas.png",
    bgColor: "bg-green-600",
    textColor: "text-white",
    keyBinding: "h",
    source: "changomas",
  },
  {
    name: "Makro",
    url: "https://makro.com.ar/beneficios-bancarios/",
    logo: "/logos/supermercados/makro.svg",
    bgColor: "bg-red-400",
    textColor: "text-white",
    keyBinding: "m",
    source: "makro",
  },
];

export const Route = createFileRoute("/supermercados")({
  component: SupermarketLinksPage,
});

function SupermarketLinksPage() {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const supermarket = supermarkets.find(
        (s) => s.keyBinding.toLowerCase() === event.key.toLowerCase()
      );
      if (supermarket) {
        window.open(supermarket.url, "_blank", "noopener,noreferrer");
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/" search={{ supermarket: undefined }}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold mb-2">Supermercados</h1>
          <p className="text-muted-foreground">
            Visitá las páginas de promociones de cada supermercado. Presioná una
            tecla para ir directamente.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {supermarkets.map((supermarket) => (
            <Card
              key={supermarket.name}
              className="overflow-hidden hover:shadow-lg transition-shadow p-0"
            >
              <CardContent className="p-0">
                <a
                  href={supermarket.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <div
                    className={`${supermarket.bgColor} ${supermarket.textColor} p-6 flex flex-col items-center justify-center min-h-[200px] relative group`}
                  >
                    <div className="flex flex-col items-center space-y-4">
                      <div className="w-32 h-32 flex items-center justify-center">
                        <img
                          src={supermarket.logo}
                          alt={`Logo de ${supermarket.name}`}
                          className="max-w-full max-h-full object-contain"
                          style={{
                            filter:
                              "drop-shadow(1px 0 0 white) drop-shadow(-1px 0 0 white) drop-shadow(0 1px 0 white) drop-shadow(0 -1px 0 white)",
                          }}
                        />
                      </div>
                    </div>
                    <div className="absolute top-4 right-4 opacity-60 group-hover:opacity-100 transition-opacity">
                      <ExternalLink className="h-5 w-5" />
                    </div>
                    <div className="absolute top-4 left-4 bg-black/20 backdrop-blur-sm rounded-md px-2 py-1">
                      <span className="text-sm font-mono font-bold">
                        {supermarket.keyBinding.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Hacé clic o presioná la tecla correspondiente para ir a las páginas
            de promociones
          </p>
        </div>
      </div>
    </div>
  );
}
