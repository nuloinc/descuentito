import type { PaymentMethod } from '.';

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
import { default as DiaOnline } from './logos/supermercados/dia_online.png?enhanced';
import { default as BancoSantaFe } from './logos/Banco Santa Fe.png?enhanced';
import { default as Dia } from './logos/supermercados/dia.svg';
import { default as Coto } from './logos/supermercados/coto.svg';
import { default as CotoDigital } from './logos/supermercados/coto_digital.png?enhanced';
import { default as ChangoMas } from './logos/supermercados/changomas.png?enhanced';
import { default as ChangoMasOnline } from './logos/supermercados/changomas_online.png?enhanced';
import { default as Makro } from './logos/supermercados/makro.svg';
export const logos: {
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

export const BRAND_LOGOS_NEED_LIGHT_BACKGROUND = {
	changomas: ['Online'],
	makro: ['Makro']
};
