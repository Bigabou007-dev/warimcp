export const SUPPORTED_CURRENCIES = ["XOF", "XAF", "CDF", "GNF"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const PROVIDER_CURRENCY_MAP: Record<string, readonly string[]> = {
  cinetpay: ["XOF", "XAF", "CDF", "GNF"],
  wave: ["XOF"],
  mock: ["XOF", "XAF", "CDF", "GNF", "USD", "EUR"],
  hub2: ["XOF", "XAF"],
  papss: ["XOF", "KES", "NGN", "GHS"],
};

export function validateCurrency(currency: string): string | null {
  if (!SUPPORTED_CURRENCIES.includes(currency as SupportedCurrency)) {
    return `Unsupported currency: ${currency}. Supported: ${SUPPORTED_CURRENCIES.join(", ")}`;
  }
  return null;
}

export function providerSupportsCurrency(provider: string, currency: string): boolean {
  const supported = PROVIDER_CURRENCY_MAP[provider];
  return supported ? supported.includes(currency) : false;
}
