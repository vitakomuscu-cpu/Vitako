// Crée (une seule fois) les 3 produits et leurs prix mensuels dans ton compte Stripe.
// Relançable sans risque : un prix déjà créé (même lookup_key) est réutilisé.
import "dotenv/config";
import { StripeClient } from "stripe";

const stripe = new StripeClient(process.env.STRIPE_SECRET_KEY);

// Un produit par formule (un prix mensuel chacun), prix en centimes d'euro.
const PLANS = [
  { key: "train", name: "Vitako Entraînement", amount: 1499 },
  { key: "nutri", name: "Vitako Nutrition", amount: 1499 },
  { key: "full", name: "Vitako Offre complète", amount: 2499 },
];

for (const p of PLANS) {
  const lookup_key = `vitako_${p.key}_monthly`;
  const existing = await stripe.prices.list({ lookup_keys: [lookup_key], limit: 1 });
  if (existing.data.length) {
    console.log(`${p.key}: prix déjà présent -> ${existing.data[0].id}`);
    continue;
  }
  const product = await stripe.products.create({ name: p.name, metadata: { plan: p.key } });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "eur",
    unit_amount: p.amount,
    recurring: { interval: "month" },
    lookup_key,
    metadata: { plan: p.key },
  });
  console.log(`${p.key}: produit ${product.id}, prix ${price.id}`);
}
console.log("Terminé. Vérifie les montants dans le Dashboard (mode test).");
