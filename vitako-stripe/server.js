import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import fs from "node:fs";
import { StripeClient } from "stripe";

const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SITE_URL = "http://localhost:8080", PORT = 4242 } = process.env;
if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
  console.error("Renseigne STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET dans .env");
  process.exit(1);
}
const stripe = new StripeClient(STRIPE_SECRET_KEY);
const app = express();

// --- Stockage minimal (à remplacer par ta base de données) -------------------
const DB_FILE = new URL("./data.json", import.meta.url);
const db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, "utf8")) : { subs: {}, events: [] };
const saveDb = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

// --- Webhook (corps BRUT obligatoire, déclaré avant express.json) -------------
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Signature webhook invalide :", err.message);
    return res.sendStatus(400);
  }
  if (db.events.includes(event.id)) return res.sendStatus(200); // idempotence
  try {
    handleEvent(event);
    db.events = [...db.events.slice(-500), event.id];
    saveDb();
    res.sendStatus(200);
  } catch (err) {
    console.error("Erreur de traitement :", err);
    res.sendStatus(500); // Stripe réessaiera
  }
});

function handleEvent(event) {
  const o = event.data.object;
  switch (event.type) {
    case "checkout.session.completed": // activation de la formule
    case "checkout.session.async_payment_succeeded":
      if (o.mode === "subscription" && o.payment_status === "paid") {
        db.subs[o.customer] = { ...db.subs[o.customer], customer: o.customer, email: o.customer_details?.email, plan: o.metadata?.plan, subscription: o.subscription, status: "active" };
      }
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      db.subs[o.customer] = { ...db.subs[o.customer], customer: o.customer, subscription: o.id, plan: o.metadata?.plan ?? db.subs[o.customer]?.plan, status: o.status, cancelAtPeriodEnd: o.cancel_at_period_end };
      break;
    case "invoice.paid":
      if (db.subs[o.customer]) db.subs[o.customer].status = "active";
      break;
    case "invoice.payment_failed":
      if (db.subs[o.customer]) db.subs[o.customer].status = "past_due"; // préviens le client (e-mail)
      break;
    default:
      break;
  }
}

// --- API pour le site ---------------------------------------------------------
app.use(cors({ origin: SITE_URL }));
app.use(express.json());

const PLAN_KEYS = ["train", "nutri", "full"];

// Crée une session Checkout en mode abonnement.
app.post("/api/checkout", async (req, res) => {
  try {
    const plan = String(req.body?.plan ?? "");
    if (!PLAN_KEYS.includes(plan)) return res.status(400).json({ error: "Formule inconnue." });
    const prices = await stripe.prices.list({ lookup_keys: [`vitako_${plan}_monthly`], limit: 1 });
    if (!prices.data.length) return res.status(500).json({ error: "Prix introuvable : lance `npm run setup`." });
    const suffix = crypto.randomBytes(8).toString("base64").replace(/[^a-z]/gi, "a").slice(0, 8).toLowerCase();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      // Pas de payment_method_types : les moyens de paiement se règlent dans le Dashboard.
      line_items: [{ price: prices.data[0].id, quantity: 1 }],
      metadata: { plan },
      subscription_data: { metadata: { plan } },
      allow_promotion_codes: false,
      locale: "auto",
      // automatic_tax: { enabled: true }, // À activer seulement après inscription fiscale (Stripe Tax).
      success_url: `${SITE_URL}/#/espace-client?paiement=ok&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/#/abonnements`,
      integration_identifier: `vitako_checkout_${suffix}`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Impossible de démarrer le paiement." });
  }
});

// Portail client : changer de moyen de paiement, résilier, télécharger les factures.
// ⚠ Démo : en production, identifie le client par SA SESSION CONNECTÉE, pas par un session_id d'URL.
app.post("/api/portal", async (req, res) => {
  try {
    const checkout = await stripe.checkout.sessions.retrieve(String(req.body?.session_id ?? ""));
    const portal = await stripe.billingPortal.sessions.create({
      customer: checkout.customer,
      return_url: `${SITE_URL}/#/espace-client`,
    });
    res.json({ url: portal.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Portail indisponible." });
  }
});

app.get("/api/subscription/:customer", (req, res) => {
  const s = db.subs[req.params.customer];
  s ? res.json({ plan: s.plan, status: s.status, cancelAtPeriodEnd: !!s.cancelAtPeriodEnd }) : res.status(404).end();
});

app.listen(PORT, () => console.log(`API Vitako sur http://localhost:${PORT}`));
