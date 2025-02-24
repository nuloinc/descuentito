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
import { default as BancoGalicia } from './logos/Banco Galicia.png?enhanced';
import { default as BancoSantander } from './logos/Banco Santander.png?enhanced';

import { default as CarrefourMarket } from './logos/supermercados/carrefour_market.png?enhanced';
import { default as CarrefourComAr } from './logos/supermercados/carrefour_com_ar.png?enhanced';
import { default as CarrefourMaxi } from './logos/supermercados/carrefour_maxi.svg';
import { default as CarrefourSinTexto } from './logos/supermercados/carrefour_sin_texto.svg';
import { default as CarrefourExpressHorizontal } from './logos/supermercados/carrefour_express_horizontal.png?enhanced';
import { default as Jumbo } from './logos/supermercados/jumbo_cropped.png?enhanced';
import { default as DiaOnline } from './logos/supermercados/dia_online.png?enhanced';
import { default as Dia } from './logos/supermercados/dia.svg';
import { default as Coto } from './logos/supermercados/coto.svg';
import { default as CotoDigital } from './logos/supermercados/coto_digital.png?enhanced';

export const logos: Record<
	PaymentMethod,
	{
		sources: Record<string, string>;
		img: {
			src: string;
			w: number;
			h: number;
		};
	}
> = {
	'Banco Nación': BancoNacion,
	'Banco Patagonia': BancoPatagonia,
	MODO: MODO,
	Mastercard: Mastercard,
	VISA: VISA,
	'Mercado Pago': MercadoPago,
	'Tarjeta Carrefour Prepaga': TarjetaCarrefourPrepaga,
	'Tarjeta Carrefour Crédito': TarjetaCarrefourCredito,
	'Banco Macro': BancoMacro,
	'Banco Galicia': BancoGalicia,
	'Banco Santander': BancoSantander
};

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
	}
};
