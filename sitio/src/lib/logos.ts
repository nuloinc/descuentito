import type { PaymentMethod } from './index.svelte';

import { default as BancoNacion } from './logos/Banco Nación.png?enhanced';
import { default as BancoPatagonia } from './logos/Banco Patagonia.png?enhanced';
import { default as MODO } from './logos/MODO.png?enhanced';
import { default as Mastercard } from './logos/Mastercard.png?enhanced';
import { default as VISA } from './logos/VISA.png?enhanced';
import { default as MercadoPago } from './logos/MercadoPago.png?enhanced';
import { default as TarjetaCarrefourPrepaga } from './logos/Tarjeta Carrefour Prepaga.png?enhanced';
import { default as TarjetaCarrefourCredito } from './logos/Tarjeta Carrefour Crédito.png?enhanced';
import { default as BancoMacro } from './logos/Banco Macro.png?enhanced';
import { default as BancoGalicia } from './logos/Banco Galicia.svg';
import { default as BancoSantander } from './logos/Banco Santander.svg';
import { default as BancoEntreRios } from './logos/banco_entre_rios.webp';
import { default as BancoDelSol } from './logos/banco-sol.webp';
import { default as BancoColumbia } from './logos/Banco Columbia.webp';
import { default as Uilo } from './logos/uilo.png?enhanced';
import { default as CuentaDNI } from './logos/cuenta-dni.png?enhanced';
import { default as BancoSupervielle } from './logos/Supervielle.png?enhanced';
import { default as BancoBBVA } from './logos/BBVA.svg';
import { default as BancoGaliciaMas } from './logos/GaliciaMas.svg';
import { default as BancoCiudad } from './logos/Banco_Ciudad.svg';
import { default as NaranjaX } from './logos/NaranjaX.svg';
import { default as BancoComafi } from './logos/Banco Comafi.png?enhanced';
import { default as TarjetaCreditoCotoTCI } from './logos/Tarjeta TCI.png?enhanced';
import { default as Uala } from './logos/uala.png?enhanced';
import { default as BancoCredicoop } from './logos/Banco_Credicoop.svg';
import { default as PersonalPay } from './logos/personal-pay-color.svg';
import { default as Prex } from './logos/prex.png?enhanced';
import { default as TarjetaCencosud } from './logos/Tarjeta Cencosud.png?enhanced';
import { default as BancoHipotecario } from './logos/Banco_Hipotecario.svg';
import { default as BancoSanJuan } from './logos/Banco San Juan.png?enhanced';
import { default as CarrefourMarket } from './logos/supermercados/carrefour_market.png?enhanced';
import { default as CarrefourComAr } from './logos/supermercados/carrefour_com_ar.png?enhanced';
import { default as CarrefourMaxi } from './logos/supermercados/carrefour_maxi.svg';
import { default as CarrefourSinTexto } from './logos/supermercados/carrefour_sin_texto.svg';
import { default as CarrefourExpressHorizontal } from './logos/supermercados/carrefour_express_horizontal.png?enhanced';
import { default as Jumbo } from './logos/supermercados/jumbo_cropped.png?enhanced';
import { default as JumboSmall } from './logos/supermercados/jumbo.png?enhanced';
import { default as DiaOnline } from './logos/supermercados/dia_online.png?enhanced';
import { default as BancoSantaFe } from './logos/Banco Santa Fe.png?enhanced';
import { default as Dia } from './logos/supermercados/dia.svg';
import { default as DiaSmall } from './logos/supermercados/dia_small.svg';
import { default as Coto } from './logos/supermercados/coto.svg';
import { default as CotoDigital } from './logos/supermercados/coto_digital.png?enhanced';
import { default as CotoStacked } from './logos/supermercados/coto_stacked.svg';
import { default as ChangoMas } from './logos/supermercados/changomas.png?enhanced';
import { default as ChangoMasOnline } from './logos/supermercados/changomas_online.png?enhanced';
import { default as Makro } from './logos/supermercados/makro.svg';
import { default as MakroSmall } from './logos/supermercados/makro_small.svg';

import { default as IconAstroPay } from './logos/wallet-icons/AstroPay.svg';
import { default as IconBancoDelSol } from './logos/wallet-icons/Banco Del Sol.svg';
import { default as IconBancoEntreRios } from './logos/wallet-icons/Banco Entre Rios.svg';
import { default as IconBancoNacion } from './logos/wallet-icons/Banco Nacion.svg';
import { default as IconBancoSantaFe } from './logos/wallet-icons/Banco Santa Fe.svg';
import { default as IconPrex } from './logos/wallet-icons/Prex.svg';
import { default as IconBancoPatagonia } from './logos/wallet-icons/Banco Patagonia.svg';
import { default as IconMODO } from './logos/wallet-icons/MODO.svg';
import { default as IconMastercard } from './logos/wallet-icons/Mastercard.svg';
import { default as IconVISA } from './logos/wallet-icons/VISA.svg';
import { default as IconMercadoPago } from './logos/wallet-icons/MercadoPago.svg';
import { default as IconBancoMacro } from './logos/wallet-icons/Banco Macro.svg';
import { default as IconBancoGalicia } from './logos/wallet-icons/Banco Galicia.svg';
import { default as IconBancoSantander } from './logos/wallet-icons/Banco Santander.svg';
import { default as IconBancoColumbia } from './logos/wallet-icons/Banco Columbia.svg';
import { default as IconCuentaDNI } from './logos/wallet-icons/Cuenta DNI.svg';
import { default as IconBancoSupervielle } from './logos/wallet-icons/Banco Supervielle.svg';
import { default as IconBancoBBVA } from './logos/wallet-icons/Banco BBVA.svg';
import { default as IconBancoCiudad } from './logos/wallet-icons/Banco Ciudad.svg';
import { default as IconNaranjaX } from './logos/wallet-icons/NaranjaX.svg';
import { default as IconBancoComafi } from './logos/wallet-icons/Banco Comafi.svg';
import { default as IconUala } from './logos/wallet-icons/Uala.svg';
import { default as IconBancoCredicoop } from './logos/wallet-icons/Banco Credicoop.svg';
import { default as IconPersonalPay } from './logos/wallet-icons/Personal Pay.svg';
import { default as IconBancoHipotecario } from './logos/wallet-icons/Banco Hipotecario.svg';
import { default as IconBancoSanJuan } from './logos/wallet-icons/Banco San Juan.svg';
import { default as IconBancoICBC } from './logos/wallet-icons/Banco ICBC.svg';
import { default as IconBancoProvincia } from './logos/wallet-icons/Banco Provincia.svg';
import { default as IconYOY } from './logos/wallet-icons/YOY.svg';
import { default as IconCencopay } from './logos/wallet-icons/Cencopay.svg';
import { default as IconBancoDeCorrientes } from './logos/wallet-icons/Banco de Corrientes.svg';
import { default as IconBancoSantaCruz } from './logos/wallet-icons/Banco Santa Cruz.svg';
import { default as IconAmericanExpress } from './logos/wallet-icons/American Express.svg';
import { default as IconCabal } from './logos/wallet-icons/Cabal.svg';
export const LOGOS: {
	[key in PaymentMethod]?:
		| {
				sources: Record<string, string>;
				img: {
					src: string;
					w: number;
					h: number;
				};
		  }
		| string;
} = {
	'Banco Nación': BancoNacion,
	'Banco Patagonia': BancoPatagonia,
	MODO: MODO,
	// 'Tarjeta de débito Mastercard': Mastercard,
	// 'Tarjeta de crédito Mastercard': Mastercard,
	// 'Tarjeta de débito VISA': VISA,
	// 'Tarjeta de crédito VISA': VISA,
	'Mercado Pago': MercadoPago,
	'Tarjeta Carrefour Prepaga': TarjetaCarrefourPrepaga,
	'Tarjeta Carrefour Crédito': TarjetaCarrefourCredito,
	'Banco Macro': BancoMacro,
	'Banco Galicia': BancoGalicia,
	'Banco Santander': BancoSantander,
	'Banco Entre Ríos': BancoEntreRios,
	'Banco Santa Fe': BancoSantaFe,
	'Banco del Sol': BancoDelSol,
	'Banco Columbia': BancoColumbia,
	Uilo: Uilo,
	'Cuenta DNI': CuentaDNI,
	'Banco Supervielle': BancoSupervielle,
	'Banco BBVA': BancoBBVA,
	'Banco Galicia Más': BancoGaliciaMas,
	'Banco Ciudad': BancoCiudad,
	NaranjaX: NaranjaX,
	'Banco Comafi': BancoComafi,
	'Tarjeta de crédito Coto TCI': TarjetaCreditoCotoTCI,
	Uala: Uala,
	'Banco Credicoop': BancoCredicoop,
	'Personal Pay': PersonalPay,
	Prex: Prex,
	'Tarjeta de crédito Cencosud Mastercard': TarjetaCencosud,
	'Banco Hipotecario': BancoHipotecario,
	'Banco San Juan': BancoSanJuan
};

export const WALLET_ICONS: { [key in PaymentMethod]?: string } = {
	// AstroPay: IconAstroPay,
	'Banco Ciudad': IconBancoCiudad,
	'Banco Columbia': IconBancoColumbia,
	'Banco Comafi': IconBancoComafi,
	'Banco Credicoop': IconBancoCredicoop,
	'Banco del Sol': IconBancoDelSol,
	'Banco Entre Ríos': IconBancoEntreRios,
	'Banco Galicia': IconBancoGalicia,
	'Banco Hipotecario': IconBancoHipotecario,
	'Banco ICBC': IconBancoICBC,
	'Banco Macro': IconBancoMacro,
	'Banco Nación': IconBancoNacion,
	'Cuenta DNI': IconCuentaDNI,
	// 'Banco Provincia': IconBancoProvincia,
	'Banco Santa Fe': IconBancoSantaFe,
	'Banco Santander': IconBancoSantander,
	MODO: IconMODO,
	'Mercado Pago': IconMercadoPago,
	'Personal Pay': IconPersonalPay,
	Uala: IconUala,
	Yoy: IconYOY,
	NaranjaX: IconNaranjaX,
	'Banco BBVA': IconBancoBBVA,
	'Banco Patagonia': IconBancoPatagonia,
	Prex: IconPrex,
	Cencopay: IconCencopay,
	'BanCo (Banco de Corrientes)': IconBancoDeCorrientes,
	'Banco Supervielle': IconBancoSupervielle,
	'Banco San Juan': IconBancoSanJuan,
	'Banco Santa Cruz': IconBancoSantaCruz,
	'Tarjeta American Express': IconAmericanExpress,
	'Tarjeta de débito VISA': IconVISA,
	'Tarjeta de crédito VISA': IconVISA,
	'Tarjeta de débito Mastercard': IconMastercard,
	'Tarjeta de crédito Mastercard': IconMastercard,
	'Tarjeta Prepaga Mastercard': IconMastercard,
	'Tarjeta de débito Cabal': IconCabal,
	'Tarjeta de crédito Cabal': IconCabal
};

export const LOGOS_NEED_LIGHT_BACKGROUND: readonly PaymentMethod[] = [
	'Banco Galicia Más',
	'Banco Entre Ríos',
	'Banco Santa Fe',
	'Banco Supervielle',
	'Mercado Pago',
	'Cuenta DNI',
	'Banco BBVA',
	'Banco Patagonia',
	'Banco Hipotecario',
	'Prex',
	'Personal Pay',
	'Banco San Juan',
	'Uala',
	'Banco Ciudad'
];

export const BRAND_LOGOS = {
	carrefour: {
		Market: CarrefourMarket,
		Online: CarrefourComAr,
		Maxi: CarrefourMaxi,
		Carrefour: CarrefourSinTexto,
		Express: CarrefourExpressHorizontal
	},
	jumbo: {
		Jumbo: Jumbo,
		Online: Jumbo
	},
	dia: {
		Dia: Dia,
		Online: DiaOnline
	},
	coto: {
		Coto: Coto,
		Online: CotoDigital
	},
	changomas: {
		ChangoMas: ChangoMas,
		Online: ChangoMasOnline
	},
	makro: {
		Makro: Makro
	}
};

export const BRAND_LOGOS_SMALL: {
	[key in keyof typeof BRAND_LOGOS]?: {
		[key in keyof (typeof BRAND_LOGOS)[keyof typeof BRAND_LOGOS]]: string;
	};
} = {
	coto: {
		Coto: CotoStacked
	},
	dia: {
		Dia: DiaSmall
	},
	jumbo: {
		Jumbo: JumboSmall
	},
	makro: {
		Makro: MakroSmall
	}
};

export const BRAND_LOGOS_NEED_LIGHT_BACKGROUND = {
	changomas: ['Online'],
	makro: ['Makro']
};
