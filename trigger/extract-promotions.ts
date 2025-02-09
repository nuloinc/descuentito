import * as fs from "fs";
import * as path from "path";

interface Promotion {
  id: number;
  title: string;
  description: string;
  category?: string;
  discount: {
    type: string;
    value: string;
  };
  validFrom: string;
  validUntil: string;
  url: string;
  paymentMethods?: string[];
  restrictions?: string[];
  additionalInfo?: string;
}

function generatePromotionUrl(id: number, title: string): string {
  // Convert title to URL-safe format
  const urlSafeTitle = encodeURIComponent(title.toLowerCase().trim());
  return `https://www.galicia.ar/personas/buscador-de-promociones?path=/promocion/${id}%7C${urlSafeTitle}%7Cmarca`;
}

function getRestrictions(promo: any): string[] {
  const restrictions = [
    promo.restricciones,
    promo.terminos,
    promo.condiciones,
    promo.leyendaDiasAplicacion,
  ].filter(Boolean);

  // Add Eminent restriction if applicable
  if (promo.eminent === true) {
    restrictions.push("Exclusivo para clientes Éminent");
  }

  return restrictions;
}

export async function extractPromotions() {
  try {
    // Read the HAR file
    const harFilePath = path.join(process.cwd(), "www.galicia.ar.har");
    const harContent = JSON.parse(fs.readFileSync(harFilePath, "utf-8"));

    const promotions: Promotion[] = [];
    const processedIds = new Set<number>();

    // Process each entry in the HAR file
    for (const entry of harContent.log.entries) {
      if (
        entry.request.url.includes(
          "/api/portal/personalizacion/v1/promociones/list/carrusel/"
        )
      ) {
        console.log("Found promotions API response", {
          url: entry.request.url,
          hasContent: !!entry.response?.content,
          contentType: entry.response?.content?.mimeType,
          contentLength: entry.response?.content?.text?.length,
        });

        if (entry.response?.content?.text) {
          try {
            console.log("Response content sample", {
              sample:
                typeof entry.response.content.text === "string"
                  ? entry.response.content.text.substring(0, 500)
                  : JSON.stringify(entry.response.content.text).substring(
                      0,
                      500
                    ),
            });

            // The response text might be a string that needs to be parsed
            const contentText =
              typeof entry.response.content.text === "string"
                ? entry.response.content.text
                : JSON.stringify(entry.response.content.text);

            const content = JSON.parse(contentText);

            if (content.data?.promociones?.list) {
              for (const promo of content.data.promociones.list) {
                // Skip if we've already processed this promotion
                if (processedIds.has(promo.id)) continue;
                processedIds.add(promo.id);

                const promotion: Promotion = {
                  id: promo.id,
                  title: promo.titulo || "",
                  description: promo.promocion || "",
                  category: promo.subtitulo || "",
                  discount: {
                    type: promo.tipoDescuento || "discount",
                    value: promo.promocion || "",
                  },
                  validFrom:
                    promo.fechaInicioVigencia || new Date().toISOString(),
                  validUntil: promo.fechaFinVigencia || "",
                  url:
                    promo.link || generatePromotionUrl(promo.id, promo.titulo),
                  paymentMethods:
                    promo.mediosDePago?.map((m: any) => m.tarjeta) || [],
                  restrictions: getRestrictions(promo),
                  additionalInfo: promo.adicional || "",
                };

                promotions.push(promotion);
              }
            }
          } catch (e) {
            console.error("Error parsing response content", {
              error: e,
              url: entry.request.url,
              responseText: entry.response.content.text,
            });
          }
        }
      }
    }

    // Save the extracted promotions to a JSON file
    const outputPath = path.join(process.cwd(), "galicia-promotions.json");
    fs.writeFileSync(outputPath, JSON.stringify(promotions, null, 2));

    console.log("Promotions extracted successfully", {
      count: promotions.length,
      outputPath,
    });

    return promotions;
  } catch (error) {
    console.error("Error extracting promotions", { error });
    throw error;
  }
}

// Run the extraction if this file is executed directly
if (require.main === module) {
  extractPromotions().catch((error) => {
    console.error("Failed to extract promotions:", error);
    process.exit(1);
  });
}
