import "server-only";
import Stripe from "stripe";

const API_VERSION = "2026-09-30.endive" as const;

let client: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    throw new Error("Refusing to run checkout without a Stripe test key.");
  }
  if (!client) {
    client = new Stripe(key, {
      apiVersion: API_VERSION,
      appInfo: {
        name: "Bench & Trade",
      },
    });
  }
  return client;
}

export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  return Boolean(key && (key.startsWith("sk_test_") || key.startsWith("rk_test_")));
}

/** Stable label so this checkout flow can be compared in the Stripe Dashboard. */
export const CHECKOUT_INTEGRATION_ID = "bench-trade-pilot-mkqwxrpl";
