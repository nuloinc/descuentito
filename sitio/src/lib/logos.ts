import IconAstroPay from "~/logos/wallet-icons/AstroPay.svg?url";
import IconBancoDelSol from "~/logos/wallet-icons/Banco Del Sol.svg?url";
import IconBancoEntreRios from "~/logos/wallet-icons/Banco Entre Rios.svg?url";
import IconBancoNacion from "~/logos/wallet-icons/Banco Nacion.svg?url";
import IconBancoSantaFe from "~/logos/wallet-icons/Banco Santa Fe.svg?url";
import IconPrex from "~/logos/wallet-icons/Prex.svg?url";
import IconBancoPatagonia from "~/logos/wallet-icons/Banco Patagonia.svg?url";
import IconMODO from "~/logos/wallet-icons/MODO.svg?url";
import IconMastercard from "~/logos/wallet-icons/Mastercard.svg?url";
import IconVISA from "~/logos/wallet-icons/VISA.svg?url";
import IconMercadoPago from "~/logos/wallet-icons/MercadoPago.svg?url";
import IconBancoMacro from "~/logos/wallet-icons/Banco Macro.svg?url";
import IconBancoGalicia from "~/logos/wallet-icons/Banco Galicia.svg?url";
import IconBancoSantander from "~/logos/wallet-icons/Banco Santander.svg?url";
import IconBancoColumbia from "~/logos/wallet-icons/Banco Columbia.svg?url";
import IconCuentaDNI from "~/logos/wallet-icons/Cuenta DNI.svg?url";
import IconBancoSupervielle from "~/logos/wallet-icons/Banco Supervielle.svg?url";
import IconBancoBBVA from "~/logos/wallet-icons/Banco BBVA.svg?url";
import IconBancoCiudad from "~/logos/wallet-icons/Banco Ciudad.svg?url";
import IconNaranjaX from "~/logos/wallet-icons/NaranjaX.svg?url";
import IconBancoComafi from "~/logos/wallet-icons/Banco Comafi.svg?url";
import IconUala from "~/logos/wallet-icons/Uala.svg?url";
import IconBancoCredicoop from "~/logos/wallet-icons/Banco Credicoop.svg?url";
import IconPersonalPay from "~/logos/wallet-icons/Personal Pay.svg?url";
import IconBancoHipotecario from "~/logos/wallet-icons/Banco Hipotecario.svg?url";
import IconBancoSanJuan from "~/logos/wallet-icons/Banco San Juan.svg?url";
import IconBancoICBC from "~/logos/wallet-icons/Banco ICBC.svg?url";
import IconBancoProvincia from "~/logos/wallet-icons/Banco Provincia.svg?url";
import IconYOY from "~/logos/wallet-icons/YOY.svg?url";
import IconCencopay from "~/logos/wallet-icons/Cencopay.svg?url";
import IconBancoDeCorrientes from "~/logos/wallet-icons/Banco de Corrientes.svg?url";
import IconBancoSantaCruz from "~/logos/wallet-icons/Banco Santa Cruz.svg?url";
import IconAmericanExpress from "~/logos/wallet-icons/American Express.svg?url";
import IconCabal from "~/logos/wallet-icons/Cabal.svg?url";

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

import CarrefourMarket from "~/logos/supermercados/carrefour_market.png?url";
import CarrefourComAr from "~/logos/supermercados/carrefour_com_ar.png?url";
import CarrefourMaxi from "~/logos/supermercados/carrefour_maxi.svg?url";
import CarrefourSinTexto from "~/logos/supermercados/carrefour_sin_texto.svg?url";
import CarrefourExpressHorizontal from "~/logos/supermercados/carrefour_express_horizontal.png?url";
import Jumbo from "~/logos/supermercados/jumbo_cropped.png?url";
import JumboSmall from "~/logos/supermercados/jumbo.webp?url";
import DiaOnline from "~/logos/supermercados/dia_online.png?url";
import Dia from "~/logos/supermercados/dia.svg?url";
import DiaSmall from "~/logos/supermercados/dia_small.svg?url";
import Coto from "~/logos/supermercados/coto.svg?url";
import CotoDigital from "~/logos/supermercados/coto_digital.png?url";
import CotoStacked from "~/logos/supermercados/coto_stacked.svg?url";
import ChangoMas from "~/logos/supermercados/changomas.png?url";
import ChangoMasOnline from "~/logos/supermercados/changomas_online.png?url";
import Makro from "~/logos/supermercados/makro.svg?url";
import MakroSmall from "~/logos/supermercados/makro_small.svg?url";

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
