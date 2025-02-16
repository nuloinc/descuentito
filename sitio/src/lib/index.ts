// place files you want to import through the `$lib` alias in this folder.

export type PaymentMethod =
	| 'Tarjeta Carrefour Prepaga'
	| 'Tarjeta Carrefour Crédito'
	| 'Banco Patagonia'
	| 'Banco Nación'
	| 'Banco Macro'
	| 'Banco Galicia'
	| 'Banco Santander'
	| 'MODO'
	| 'MercadoPago'
	| 'Mastercard'
	| 'VISA';

export function getPaymentMethod(method: string): PaymentMethod | null {
	const normalizedMethod = method.trim();

	if (normalizedMethod === 'Banco Nación' || normalizedMethod === 'Banco Nacion') {
		return 'Banco Nación';
	}
	if (normalizedMethod === 'Banco Patagonia') {
		return 'Banco Patagonia';
	}
	if (normalizedMethod === 'Banco Macro') {
		return 'Banco Macro';
	}
	if (normalizedMethod === 'Banco Galicia') {
		return 'Banco Galicia';
	}
	if (normalizedMethod === 'Banco Santander') {
		return 'Banco Santander';
	}
	if (
		normalizedMethod === 'Tarjeta Carrefour Prepaga' ||
		normalizedMethod === 'Tarjeta prepaga Mastercard Mi Carrefour' ||
		normalizedMethod === 'Tarjeta Prepaga Mi Carrefour' ||
		normalizedMethod === 'Tarjeta Mi Carrefour Prepaga'
	) {
		return 'Tarjeta Carrefour Prepaga';
	}
	if (
		normalizedMethod === 'Tarjeta Carrefour Crédito' ||
		normalizedMethod === 'Tarjeta Mi Carrefour Crédito' ||
		normalizedMethod === 'Tarjeta de crédito Mastercard Mi Carrefour'
	) {
		return 'Tarjeta Carrefour Crédito';
	}
	if (normalizedMethod === 'MODO') {
		return 'MODO';
	}
	if (normalizedMethod === 'MercadoPago' || normalizedMethod === 'Mercado Pago') {
		return 'MercadoPago';
	}

	if (normalizedMethod.toLowerCase() === 'mastercard') {
		return 'Mastercard';
	}
	if (normalizedMethod.toLowerCase() === 'visa') {
		return 'VISA';
	}

	return null;
}
