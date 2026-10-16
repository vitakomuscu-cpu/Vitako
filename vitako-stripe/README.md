# Vitako : Stripe Checkout + Billing (mode test)

1. `npm install`
2. Copie `.env.example` en `.env` et renseigne la clé (de préférence une clé restreinte `rk_test_…`).
3. `npm run setup` : crée les 3 produits et prix mensuels (14,99 €, 14,99 €, 24,99 €).
4. Webhooks en local : `stripe listen --forward-to localhost:4242/webhook`, puis copie le `whsec_…` dans `.env`.
5. `npm start`, puis appelle `POST /api/checkout` avec `{ "plan": "train" | "nutri" | "full" }` : la réponse contient l'URL Checkout.
6. Carte de test : `4242 4242 4242 4242`, date future, CVC quelconque.

Avant la production : Dashboard > Portail client (activer et configurer), Stripe Tax (inscriptions fiscales avant
`automatic_tax`), remplacer `data.json` par une base de données, authentifier le client pour `/api/portal`,
passer aux clés live, et compléter les CGV (prestataire, TVA, rétractation).
