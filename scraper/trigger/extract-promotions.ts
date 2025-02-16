import PQueue from "p-queue";
import { FetchCacher } from "../fetch-cacher";
import { RequestInit } from "undici";
import { GaliciaPromotion, GenericPromotion } from "promos-db/schema";

interface OfficialCategory {
  id: number;
  descripcion: string;
  imagen: string | null;
  emoji: string;
}

interface Category extends Omit<OfficialCategory, "descripcion" | "imagen"> {
  name: string;
  description: string;
  image?: string | null;
  count: number;
  promotions: GenericPromotion[];
}

interface ApiResponse<T> {
  data: T;
}

type FetchOptions = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
};

// Common API configuration
const API_CONFIG = {
  baseUrl: "https://loyalty.bff.bancogalicia.com.ar/api/portal",
  headers: {
    Accept: "application/vnd.iman.v1+json, application/json, text/plain, */*",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    id_canal: "Quiero",
    id_channel: "onlinebanking",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Origin: "https://beneficios.galicia.ar",
    Referer: "https://beneficios.galicia.ar/",
  },
} as const;

// Retry configuration
const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 1000,
} as const;

// Queue configuration
const QUEUE_CONFIG = {
  detailsConcurrency: 50,
  pagesConcurrency: 5,
  timeout: 30000,
} as const;

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

  if (promo.eminent === true) {
    restrictions.push("Exclusivo para clientes Éminent");
  }

  return restrictions;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  let attempts = 0;
  while (attempts < RETRY_CONFIG.maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      attempts++;
      if (attempts === RETRY_CONFIG.maxAttempts) {
        console.warn(
          `Failed ${context} after ${RETRY_CONFIG.maxAttempts} attempts:`,
          error
        );
        throw error;
      }
      console.warn(
        `Retry attempt ${attempts} for ${context} due to error:`,
        error
      );
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_CONFIG.baseDelay * attempts)
      );
    }
  }
  throw new Error(`Unexpected retry loop exit for ${context}`);
}

async function fetchApi<T>(
  endpoint: string,
  options: Partial<RequestInit> = {}
): Promise<T> {
  const response = await fetchCacher.fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
    ...options,
    headers: { ...API_CONFIG.headers, ...(options.headers || {}) },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = (await response.json()) as ApiResponse<T>;
  return result.data;
}

async function fetchPromotionDetails(
  id: number
): Promise<{ maxDiscount: number | null }> {
  const details = await withRetry(
    () => fetchApi<any>(`/catalogo/v1/promociones/idPromocion/${id}`),
    `promotion details ${id}`
  );

  return {
    maxDiscount: details?.topeReintegro || null,
  };
}

function mapPromotion(
  promo: any,
  details: { maxDiscount: number | null } | null
): GaliciaPromotion {
  return {
    id: promo.id,
    source: "galicia",
    title: promo.titulo || "",
    description: promo.promocion || "",
    category: promo.subtitulo || "",
    discount: {
      type: promo.tipoDescuento || "discount",
      value: promo.promocion ? parseFloat(promo.promocion) : 0,
    },
    validFrom: promo.fechaInicioVigencia || new Date().toISOString(),
    validUntil: promo.fechaFinVigencia || "",
    url: promo.link || generatePromotionUrl(promo.id, promo.titulo),
    paymentMethods: promo.mediosDePago?.map((m: any) => m.tarjeta) || [],
    restrictions: getRestrictions(promo),
    additionalInfo: promo.adicional || "",
    limits: details
      ? { maxDiscount: details.maxDiscount || undefined }
      : undefined,
  };
}

async function fetchCategoryPage(
  categoryId: number,
  page: number,
  pageSize: number = 15
): Promise<{ promotions: GaliciaPromotion[]; totalSize: number }> {
  try {
    const data = await fetchApi<any>(
      `/personalizacion/v1/promociones/catalogo?page=${page}&pageSize=${pageSize}&IdCategoria=${categoryId}`
    );

    if (!data?.list) {
      return { promotions: [], totalSize: 0 };
    }

    const queue = new PQueue({
      concurrency: QUEUE_CONFIG.detailsConcurrency,
      timeout: QUEUE_CONFIG.timeout,
      throwOnTimeout: true,
    });

    const results = await Promise.all(
      data.list.map((promo: any) =>
        queue.add(async () => {
          const details = await withRetry(
            () => fetchPromotionDetails(promo.id),
            `promotion ${promo.id}`
          );
          return { promo, details };
        })
      )
    );

    return {
      promotions: results.map(({ promo, details }) =>
        mapPromotion(promo, details)
      ),
      totalSize: data.totalSize || 0,
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
): Promise<GaliciaPromotion[]> {
  const pageSize = 15;
  const firstPage = await fetchCategoryPage(categoryId, 1, pageSize);
  let totalPromotions = firstPage.promotions;
  const totalPages = Math.ceil(firstPage.totalSize / pageSize);

  console.log(
    `Category has ${firstPage.totalSize} promotions across ${totalPages} pages`
  );

  if (totalPages > 1) {
    const queue = new PQueue({ concurrency: QUEUE_CONFIG.pagesConcurrency });
    const remainingPages = Array.from(
      { length: totalPages - 1 },
      (_, i) => i + 2
    );

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

    totalPromotions = [...totalPromotions, ...results.flat()];
  }

  return totalPromotions;
}

function mapCategory(cat: OfficialCategory): Category {
  return {
    id: cat.id,
    name: cat.descripcion,
    description: cat.descripcion,
    image: cat.imagen,
    emoji: cat.emoji,
    count: 0,
    promotions: [],
  };
}

export async function extractPromotions() {
  try {
    const categories = OFFICIAL_CATEGORIES.map(mapCategory);
    console.log(
      "Official categories:",
      categories.map((c) => c.name)
    );

    for (const category of categories) {
      console.log(`Fetching promotions for category: ${category.name}`);
      category.promotions = await fetchCategoryPromotions(category.id);
      category.count = category.promotions.length;
      console.log(`Found ${category.count} promotions in ${category.name}`);
    }

    const sortedCategories = categories
      .filter((cat) => cat.count > 0)
      .sort((a, b) => b.count - a.count);

    console.log(
      "Categories with promotions:",
      sortedCategories.map((c) => ({ name: c.name, count: c.count }))
    );

    const allPromotions = sortedCategories.flatMap((cat) => cat.promotions);
    console.log("Promotions extracted successfully", {
      count: allPromotions.length,
    });

    return allPromotions;
  } catch (error) {
    console.error("Error extracting promotions", { error });
    throw error;
  } finally {
    await fetchCacher.waitForPendingUploads();
  }
}

// Run the extraction if this file is executed directly
if (import.meta.url === new URL(import.meta.url).href) {
  extractPromotions().catch((error) => {
    console.error("Failed to extract promotions:", error);
    process.exit(1);
  });
}
