/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: Resolve type imports later

// --- Wallet Icons ---
// Assuming logos are copied to /public/logos/wallet-icons/
const IconAstroPay = "/logos/wallet-icons/AstroPay.svg";
const IconBancoDelSol = "/logos/wallet-icons/Banco Del Sol.svg";
const IconBancoEntreRios = "/logos/wallet-icons/Banco Entre Rios.svg";
const IconBancoNacion = "/logos/wallet-icons/Banco Nacion.svg";
const IconBancoSantaFe = "/logos/wallet-icons/Banco Santa Fe.svg";
const IconPrex = "/logos/wallet-icons/Prex.svg";
const IconBancoPatagonia = "/logos/wallet-icons/Banco Patagonia.svg";
const IconMODO = "/logos/wallet-icons/MODO.svg";
const IconMastercard = "/logos/wallet-icons/Mastercard.svg";
const IconVISA = "/logos/wallet-icons/VISA.svg";
const IconMercadoPago = "/logos/wallet-icons/MercadoPago.svg";
const IconBancoMacro = "/logos/wallet-icons/Banco Macro.svg";
const IconBancoGalicia = "/logos/wallet-icons/Banco Galicia.svg";
const IconBancoSantander = "/logos/wallet-icons/Banco Santander.svg";
const IconBancoColumbia = "/logos/wallet-icons/Banco Columbia.svg";
const IconCuentaDNI = "/logos/wallet-icons/Cuenta DNI.svg";
const IconBancoSupervielle = "/logos/wallet-icons/Banco Supervielle.svg";
const IconBancoBBVA = "/logos/wallet-icons/Banco BBVA.svg";
const IconBancoCiudad = "/logos/wallet-icons/Banco Ciudad.svg";
const IconNaranjaX = "/logos/wallet-icons/NaranjaX.svg";
const IconBancoComafi = "/logos/wallet-icons/Banco Comafi.svg";
const IconUala = "/logos/wallet-icons/Uala.svg";
const IconBancoCredicoop = "/logos/wallet-icons/Banco Credicoop.svg";
const IconPersonalPay = "/logos/wallet-icons/Personal Pay.svg";
const IconBancoHipotecario = "/logos/wallet-icons/Banco Hipotecario.svg";
const IconBancoSanJuan = "/logos/wallet-icons/Banco San Juan.svg";
const IconBancoICBC = "/logos/wallet-icons/Banco ICBC.svg";
const IconBancoProvincia = "/logos/wallet-icons/Banco Provincia.svg";
const IconYOY = "/logos/wallet-icons/YOY.svg";
const IconCencopay = "/logos/wallet-icons/Cencopay.svg";
const IconBancoDeCorrientes = "/logos/wallet-icons/Banco de Corrientes.svg";
const IconBancoSantaCruz = "/logos/wallet-icons/Banco Santa Cruz.svg";
const IconAmericanExpress = "/logos/wallet-icons/American Express.svg";
const IconCabal = "/logos/wallet-icons/Cabal.svg";

export const WALLET_ICONS: { [key: string]: string } = {
  // AstroPay: IconAstroPay,
  "Banco Ciudad": IconBancoCiudad,
  "Banco Columbia": IconBancoColumbia,
  "Banco Comafi": IconBancoComafi,
  "Banco Credicoop": IconBancoCredicoop,
  "Banco del Sol": IconBancoDelSol,
  "Banco Entre Ríos": IconBancoEntreRios,
  "Banco Galicia": IconBancoGalicia,
  "Banco Hipotecario": IconBancoHipotecario,
  "Banco ICBC": IconBancoICBC,
  "Banco Macro": IconBancoMacro,
  "Banco Nación": IconBancoNacion,
  "Cuenta DNI": IconCuentaDNI,
  // 'Banco Provincia': IconBancoProvincia, // Need to check if this exists
  "Banco Santa Fe": IconBancoSantaFe,
  "Banco Santander": IconBancoSantander,
  MODO: IconMODO,
  "Mercado Pago": IconMercadoPago,
  "Personal Pay": IconPersonalPay,
  Uala: IconUala,
  Yoy: IconYOY,
  NaranjaX: IconNaranjaX,
  "Banco BBVA": IconBancoBBVA,
  "Banco Patagonia": IconBancoPatagonia,
  Prex: IconPrex,
  Cencopay: IconCencopay,
  "BanCo (Banco de Corrientes)": IconBancoDeCorrientes,
  "Banco Supervielle": IconBancoSupervielle,
  "Banco San Juan": IconBancoSanJuan,
  "Banco Santa Cruz": IconBancoSantaCruz,
  "Tarjeta American Express": IconAmericanExpress,
  "Tarjeta de débito VISA": IconVISA,
  "Tarjeta de crédito VISA": IconVISA,
  "Tarjeta de débito Mastercard": IconMastercard,
  "Tarjeta de crédito Mastercard": IconMastercard,
  "Tarjeta Prepaga Mastercard": IconMastercard,
  "Tarjeta de débito Cabal": IconCabal,
  "Tarjeta de crédito Cabal": IconCabal,
};
//---------------------------

// --- Brand Logos ---
// Assuming logos are copied to /public/logos/supermercados/
const CarrefourMarket = "/logos/supermercados/carrefour_market.png";
const CarrefourComAr = "/logos/supermercados/carrefour_com_ar.png";
const CarrefourMaxi = "/logos/supermercados/carrefour_maxi.svg";
const CarrefourSinTexto = "/logos/supermercados/carrefour_sin_texto.svg";
const CarrefourExpressHorizontal =
  "/logos/supermercados/carrefour_express_horizontal.png";
const Jumbo = "/logos/supermercados/jumbo_cropped.png";
const JumboSmall = "/logos/supermercados/jumbo.png";
const DiaOnline = "/logos/supermercados/dia_online.png";
const Dia = "/logos/supermercados/dia.svg";
const DiaSmall = "/logos/supermercados/dia_small.svg";
const Coto = "/logos/supermercados/coto.svg";
const CotoDigital = "/logos/supermercados/coto_digital.png";
const CotoStacked = "/logos/supermercados/coto_stacked.svg";
const ChangoMas = "/logos/supermercados/changomas.png";
const ChangoMasOnline = "/logos/supermercados/changomas_online.png";
const Makro = "/logos/supermercados/makro.svg";
const MakroSmall = "/logos/supermercados/makro_small.svg";

// Structure mirrors Svelte version, using simple string paths
export const BRAND_LOGOS: Record<string, Record<string, string>> = {
  carrefour: {
    Market: CarrefourMarket,
    Online: CarrefourComAr,
    Maxi: CarrefourMaxi,
    Carrefour: CarrefourSinTexto,
    Express: CarrefourExpressHorizontal,
  },
  jumbo: {
    Jumbo: Jumbo,
    Online: Jumbo,
  },
  dia: {
    Dia: Dia,
    Online: DiaOnline,
  },
  coto: {
    Coto: Coto,
    Online: CotoDigital,
  },
  changomas: {
    ChangoMas: ChangoMas,
    Online: ChangoMasOnline,
  },
  makro: {
    Makro: Makro,
  },
};

export const BRAND_LOGOS_SMALL: Record<string, Record<string, string>> = {
  coto: {
    Coto: CotoStacked,
  },
  dia: {
    Dia: DiaSmall,
  },
  jumbo: {
    Jumbo: JumboSmall,
  },
  makro: {
    Makro: MakroSmall,
  },
};

export const LOGOS_NEED_LIGHT_BACKGROUND: readonly string[] = [
  "Banco Galicia Más", // Note: This might not be a key in WALLET_ICONS
  "Banco Entre Ríos",
  "Banco Santa Fe",
  "Banco Supervielle",
  "Mercado Pago",
  "Cuenta DNI",
  "Banco BBVA",
  "Banco Patagonia",
  "Banco Hipotecario",
  "Prex",
  "Personal Pay",
  "Banco San Juan",
  "Uala",
  "Banco Ciudad",
];

export const BRAND_LOGOS_NEED_LIGHT_BACKGROUND: Record<string, string[]> = {
  changomas: ["Online"],
  makro: ["Makro"],
};
