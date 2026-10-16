# Supabase pour Vitako

1. Supabase > SQL Editor > New query : colle `schema.sql`, clique sur Run.
2. Authentication > URL Configuration :
   - Site URL : l'adresse publique du site (par exemple https://vitakomuscu-cpu.github.io/Vitako/)
   - Redirect URLs : la même adresse (utilisée par les liens de confirmation et de réinitialisation).
3. Authentication > Providers > Email : laisse « Confirm email » activé, et mets la longueur minimale
   du mot de passe à 8.
4. Authentication > Emails : personnalise les modèles (confirmation, réinitialisation) en français.
5. Pour la production : configure un SMTP personnalisé (le service d'e-mails par défaut est limité).

La clé `sb_publishable_…` est publique. La clé `sb_secret_…` ne va que sur le serveur Stripe (jamais dans le site).
