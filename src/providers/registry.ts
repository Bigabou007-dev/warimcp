import { getConfig } from "../config.js";
import type { BaseProvider } from "./base.js";
import { MockProvider } from "./mock.js";
import { CinetPayProvider } from "./cinetpay.js";
import { WaveProvider } from "./wave.js";
import { Hub2Provider } from "./hub2.js";
import { PapssProvider } from "./papss.js";
import { FlutterwaveProvider } from "./flutterwave.js";
import { KKiaPayProvider } from "./kkiapay.js";
import { MonerooProvider } from "./moneroo.js";
import { MtnMomoProvider } from "./mtn-momo.js";
import { FedaPayProvider } from "./fedapay.js";

const providers: Record<string, BaseProvider> = {
  mock: new MockProvider(),
  cinetpay: new CinetPayProvider(),
  wave: new WaveProvider(),
  hub2: new Hub2Provider(),
  papss: new PapssProvider(),
  flutterwave: new FlutterwaveProvider(),
  kkiapay: new KKiaPayProvider(),
  moneroo: new MonerooProvider(),
  mtn: new MtnMomoProvider(),
  fedapay: new FedaPayProvider(),
};

export function getProvider(name: string): BaseProvider {
  const config = getConfig();

  // Always validate the provider name exists
  if (!providers[name]) {
    throw new Error(
      `Unknown provider: "${name}". Available: ${Object.keys(providers).join(", ")}`
    );
  }

  // In mock mode, redirect all real providers to mock
  if (config.WARIMCP_MODE === "mock" && name !== "mock") {
    return providers.mock;
  }

  return providers[name];
}

export function getAllProviders(): BaseProvider[] {
  return Object.values(providers);
}

export function getProviderNames(): string[] {
  return Object.keys(providers);
}
