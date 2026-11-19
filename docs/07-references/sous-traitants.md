# Registre des sous-traitants (données personnelles)

À compléter au moment de la signature de chaque contrat (ticket LEGAL-01). Pour chaque sous-traitant : nom, pays d'hébergement, données traitées, finalité, garanties (chiffrement, clauses contractuelles), date de contrat.

| Rôle | Fournisseur pressenti | Pays | Données | Statut |
|---|---|---|---|---|
| Hébergement (VPS) | Hetzner ou OVH | Allemagne / France | toutes (chiffrées) | à contractualiser |
| CDN / DNS / WAF | Cloudflare | UE (points de présence mondiaux) | adresses IP, trafic | à contractualiser |
| Stockage objet | Cloudflare R2 ou Scaleway | UE | documents (chiffrés) | à contractualiser |
| SMS | Twilio / Infobip, puis opérateurs comoriens | — | numéro, contenu non médical | à contractualiser |
| E-mail transactionnel | Resend ou Brevo | — | e-mail, contenu non médical | à contractualiser |
| Erreurs / supervision | Sentry, Grafana Cloud | UE | journaux techniques masqués | à contractualiser |
| Push mobile | Expo Push (Apple/Google) | — | jetons d'appareil | à contractualiser |
