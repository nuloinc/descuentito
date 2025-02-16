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
	MercadoPago: MercadoPago,
	'Tarjeta Carrefour Prepaga': TarjetaCarrefourPrepaga,
	'Tarjeta Carrefour Crédito': TarjetaCarrefourCredito,
	'Banco Macro': BancoMacro,
	'Banco Galicia': BancoGalicia,
	'Banco Santander': BancoSantander
};
