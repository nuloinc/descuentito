import * as fs from "fs";
import * as path from "path";
import PQueue from "p-queue";
import { FetchCacher } from "../fetch-cacher";

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
  limits?: {
    maxDiscount?: number;
  };
}

interface OfficialCategory {
  id: number;
  descripcion: string;
  imagen: string | null;
  emoji: string;
}

interface Category {
  id: number;
  name: string;
  description: string;
  image?: string | null;
  emoji?: string;
  count: number;
  promotions: Promotion[];
}

const OFFICIAL_CATEGORIES: OfficialCategory[] = [
  {
    id: 8,
    descripcion: "Supermercados",
    imagen: "Imagensupermercados.png",
    emoji: "cart",
  },
  {
    id: 1,
    descripcion: "Gastronomía",
    imagen: "Imagen%20categoria%20Gastronomi%CC%81a.png",
    emoji: "forkKnife",
  },
  {
    id: 7,
    descripcion: "Indumentaria",
    imagen: "imagen_indumentaria.png",
    emoji: "shirt",
  },
  {
    id: 2,
    descripcion: "Vehículos",
    imagen: "Imagen%20categoria%20Vehiculos.png",
    emoji: "suv",
  },
  {
    id: 3,
    descripcion: "Salud y Bienestar",
    imagen: "Imagen%20categoria%20salud%20y%20bienestar.png",
    emoji: "heartHand",
  },
  {
    id: 5,
    descripcion: "Viajes",
    imagen: "plane",
    emoji: "plane",
  },
  {
    id: 111,
    descripcion: "Beneficios Galicia",
    imagen: "Imagen categoria beneficios galicia.png",
    emoji: "",
  },
  {
    id: 9,
    descripcion: "Electrónica",
    imagen: "card_electro_tecno.png",
    emoji: "computer",
  },
  {
    id: 4,
    descripcion: "Hogar",
    imagen: "Imagen%20categoria%20Hogar.png",
    emoji: "buildingsHome",
  },
  {
    id: 11,
    descripcion: "Juguetes",
    imagen: "bike",
    emoji: "bike",
  },
  {
    id: 6,
    descripcion: "Entretenimiento",
    imagen: "cinesyteatros_principal.png",
    emoji: "emojiHappy",
  },
  {
    id: 101,
    descripcion: "Otros",
    imagen: null,
    emoji: "rubro_otros.png",
  },
  {
    id: 122,
    descripcion: "Librerías",
    imagen: null,
    emoji: "contactsBook",
  },
  {
    id: 131,
    descripcion: "Transportes",
    imagen: "Imagen categoria Transportes.png",
    emoji: "bus",
  },
  {
    id: 121,
    descripcion: "Mascotas",
    imagen: null,
    emoji: "paw",
  },
  {
    id: 83,
    descripcion: "Regalos",
    imagen: "regalo_NAP.png",
    emoji: "gift",
  },
  {
    id: 106,
    descripcion: "Shopping",
    imagen: "Imagen categoria shoppings.png",
    emoji: "shopping",
  },
  {
    id: 119,
    descripcion: "Delivery",
    imagen: "Imagen categoria delivery.png",
    emoji: "",
  },
  {
    id: 10,
    descripcion: "Educación",
    imagen: "imagen_librerias.png",
    emoji: "bag",
  },
  {
    id: 114,
    descripcion: "Especial para vos",
    imagen: "Imagen categoria especial para vos.png",
    emoji: "",
  },
];

// Initialize FetchCacher at the top level
const fetchCacher = FetchCacher.fromEnv();

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

async function fetchPromotionDetails(id: number): Promise<{
  maxDiscount: number | null;
}> {
  const response = await fetchCacher.fetch(
    `https://loyalty.bff.bancogalicia.com.ar/api/portal/catalogo/v1/promociones/idPromocion/${id}`,
    {
      headers: {
        Accept:
          "application/vnd.iman.v1+json, application/json, text/plain, */*",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        id_canal: "Quiero",
        id_channel: "onlinebanking",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Origin: "https://beneficios.galicia.ar",
        Referer: "https://beneficios.galicia.ar/",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  const details = data?.data;

  if (!details) {
    throw new Error(`No details found for promotion ${id}`);
  }

  const limits = {
    maxDiscount: details.topeReintegro || null,
  };

  return {
    ...limits,
  };
}

async function fetchCategoryPage(
  categoryId: number,
  page: number,
  pageSize: number = 15
): Promise<{ promotions: Promotion[]; totalSize: number }> {
  try {
    const response = await fetchCacher.fetch(
      `https://loyalty.bff.bancogalicia.com.ar/api/portal/personalizacion/v1/promociones/catalogo?page=${page}&pageSize=${pageSize}&IdCategoria=${categoryId}`,
      {
        headers: {
          Accept:
            "application/vnd.iman.v1+json, application/json, text/plain, */*",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          id_canal: "Quiero",
          id_channel: "onlinebanking",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Origin: "https://beneficios.galicia.ar",
          Referer: "https://beneficios.galicia.ar/",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const promotions: Promotion[] = [];

    if (data?.data?.list) {
      // Create a queue with concurrency limit
      const queue = new PQueue({
        concurrency: 50,
        timeout: 30000,
        throwOnTimeout: true,
      });

      // Add error handling at the task level
      const detailsPromises = data.data.list.map((promo: any) =>
        queue.add(async () => {
          let attempts = 0;
          const maxAttempts = 3;

          while (attempts < maxAttempts) {
            try {
              const details = await fetchPromotionDetails(promo.id);
              return { promo, details };
            } catch (error) {
              attempts++;
              if (attempts === maxAttempts) {
                console.warn(
                  `Failed to fetch details for promotion ${promo.id} after ${maxAttempts} attempts:`,
                  error
                );
                return { promo, details: null };
              }
              console.warn(
                `Retry attempt ${attempts} for promotion ${promo.id} due to error:`,
                error
              );
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * attempts)
              ); // Exponential backoff
            }
          }
        })
      );

      const results = await Promise.all(detailsPromises);

      for (const { promo, details } of results) {
        const promotion: Promotion = {
          id: promo.id,
          title: promo.titulo || "",
          description: promo.promocion || "",
          category: promo.subtitulo || "",
          discount: {
            type: promo.tipoDescuento || "discount",
            value: promo.promocion || "",
          },
          validFrom: promo.fechaInicioVigencia || new Date().toISOString(),
          validUntil: promo.fechaFinVigencia || "",
          url: promo.link || generatePromotionUrl(promo.id, promo.titulo),
          paymentMethods: promo.mediosDePago?.map((m: any) => m.tarjeta) || [],
          restrictions: getRestrictions(promo),
          additionalInfo: promo.adicional || "",
          limits: details
            ? {
                maxDiscount: details.maxDiscount,
              }
            : undefined,
        };
        promotions.push(promotion);
      }
    }

    return {
      promotions,
      totalSize: data?.data?.totalSize || 0,
    };
  } catch (error) {
    console.error(
      `Error fetching promotions for category ${categoryId} page ${page}:`,
      error
    );
    return { promotions: [], totalSize: 0 };
  }
}
async function fetchCategoryPromotions(
  categoryId: number
): Promise<Promotion[]> {
  const pageSize = 15;
  let currentPage = 1;
  let totalPromotions: Promotion[] = [];
  let totalSize = 0;

  // Get first page and total size
  const firstPage = await fetchCategoryPage(categoryId, currentPage, pageSize);
  totalPromotions = [...firstPage.promotions];
  totalSize = firstPage.totalSize;

  // Calculate total pages
  const totalPages = Math.ceil(totalSize / pageSize);
  console.log(
    `Category has ${totalSize} promotions across ${totalPages} pages`
  );

  // Create queue for remaining pages
  const queue = new PQueue({ concurrency: 5 });
  const remainingPages = Array.from(
    { length: totalPages - 1 },
    (_, i) => i + 2
  );

  // Add page fetching tasks to queue
  const results = await queue.addAll(
    remainingPages.map((page) => async () => {
      console.log(`Fetching page ${page}/${totalPages}`);
      const { promotions } = await fetchCategoryPage(
        categoryId,
        page,
        pageSize
      );
      return promotions;
    })
  );

  // Combine all promotions
  totalPromotions = [...totalPromotions, ...results.flat()];

  return totalPromotions;
}

function getCategories(): Category[] {
  return OFFICIAL_CATEGORIES.map((cat) => ({
    id: cat.id,
    name: cat.descripcion,
    description: cat.descripcion,
    image: cat.imagen,
    emoji: cat.emoji,
    count: 0,
    promotions: [],
  }));
}

export async function extractPromotions() {
  const res = await fetchCacher.fetch("https://api.ipify.org?format=json");
  console.log(await res.json());
  try {
    // Get official categories
    const categories = getCategories();
    console.log(
      "Official categories:",
      categories.map((c) => c.name)
    );

    // Fetch promotions for each category
    for (const category of categories) {
      console.log(`Fetching promotions for category: ${category.name}`);
      const promotions = await fetchCategoryPromotions(category.id);
      category.promotions = promotions;
      category.count = promotions.length;
      console.log(`Found ${promotions.length} promotions in ${category.name}`);
    }

    // Sort categories by promotion count
    const sortedCategories = categories
      .filter((cat) => cat.count > 0)
      .sort((a, b) => b.count - a.count);

    console.log(
      "Categories with promotions:",
      sortedCategories.map((c) => ({ name: c.name, count: c.count }))
    );

    // Save categories to a file
    const categoriesPath = path.join(process.cwd(), "galicia-categories.json");
    fs.writeFileSync(categoriesPath, JSON.stringify(sortedCategories, null, 2));
    console.log(`Categories saved to ${categoriesPath}`);

    // Save all promotions to a file
    const allPromotions = sortedCategories.flatMap((cat) => cat.promotions);
    const outputPath = path.join(process.cwd(), "galicia-promotions.json");
    fs.writeFileSync(outputPath, JSON.stringify(allPromotions, null, 2));

    console.log("Promotions extracted successfully", {
      count: allPromotions.length,
      outputPath,
    });

    return allPromotions;
  } catch (error) {
    console.error("Error extracting promotions", { error });
    throw error;
  } finally {
    // Wait for all pending uploads to complete before finishing
    await fetchCacher.waitForPendingUploads();
  }
}

// Run the extraction if this file is executed directly
if (require.main === module) {
  extractPromotions().catch((error) => {
    console.error("Failed to extract promotions:", error);
    process.exit(1);
  });
}
