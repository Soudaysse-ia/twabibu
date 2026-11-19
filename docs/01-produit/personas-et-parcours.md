# Personas et parcours utilisateurs

## Personas

### Amina, 32 ans, patiente — Moroni (Ngazidja)
- Téléphone Android milieu de gamme, connexion 3G/4G Yas (ex-Telma) ou Comores Telecom, utilise WhatsApp tous les jours, rarement l'e-mail.
- Veut un rendez-vous pour sa fille de 4 ans chez un pédiatre « vite et sans appeler 5 fois ».
- Frein : peur des faux profils, besoin de voir le tarif avant de réserver.
- Succès : réserve en 2 minutes depuis son téléphone, reçoit un SMS de confirmation et un rappel la veille.

### Dr Saïd, 45 ans, médecin généraliste — Mutsamudu (Ndzuani)
- Cabinet seul, une secrétaire à mi-temps, agenda papier, ~25 patients/jour, beaucoup de rendez-vous non honorés.
- Veut garder le contrôle : motifs, durées, pas de nouveaux patients le samedi, délai minimum de 2 h.
- Frein : le temps de paramétrage, la peur de « perdre » des créneaux pour les patients sans internet.
- Succès : 60 % des RDV pris en ligne, la secrétaire gère le reste dans le même agenda, les absents baissent.

### Fatima, 27 ans, secrétaire médicale — centre de santé, Fomboni (Mwali)
- Gère 4 praticiens, répond au téléphone, enregistre les patients.
- Veut voir tous les agendas sur un écran, déplacer un RDV en un geste, retrouver un patient par téléphone.
- N'a pas accès aux notes médicales.

### Clinique Al-Kamar (établissement fictif) — Moroni
- 12 praticiens, 2 sites, un administrateur.
- Veut une page établissement, une vue consolidée, des droits par rôle, des statistiques.

### Hamidou, 38 ans, pharmacien titulaire — Moroni
- Officine de 4 personnes, stock géré sur un cahier et Excel, tour de garde une semaine par mois.
- Veut être trouvé les soirs de garde, recevoir les ordonnances avant que le patient se déplace, vendre la parapharmacie en livraison, et être mis en avant dans son quartier.
- Frein : saisir le catalogue ; d'où l'import CSV et l'enrichissement progressif à partir des ordonnances reçues.

### Équipe Twabibu (back-office)
- Vérifie les soignants, répond au support, gère les référentiels et les abonnements.

## Parcours clés (version courte)

### P1 — Réserver un rendez-vous (patient, mobile)
1. Accueil → tape « pédiatre » → choisit « Moroni » (ou « Autour de moi »).
2. Liste : voit les créneaux des 5 prochains jours, filtre « Dans les 3 prochains jours ».
3. Ouvre un profil, lit tarif et consignes, « Prendre rendez-vous ».
4. Motif « Enfant - consultation » → créneau jeudi 10:20 → identification par téléphone (code SMS) → « Pour ma fille » (crée le proche) → accepte les consignes → **Confirmé**.
5. Reçoit SMS : « Twabibu : RDV confirmé jeu. 13 nov. 10:20 avec Dr X, Moroni. Annuler/déplacer : lien ».

### P2 — Annuler / déplacer (patient)
Mes rendez-vous → RDV → « Déplacer » (nouveau créneau) ou « Annuler » (si le délai d'annulation est respecté, sinon message « contactez le cabinet »). Le cabinet est notifié ; le créneau redevient disponible ; la liste d'attente est prévenue.

### P3 — Ouvrir son agenda (soignant)
1. « Vous êtes soignant ? » → inscription (identité, spécialité, cabinet, téléphone, e-mail, mot de passe).
2. Dépose ses justificatifs → statut « En vérification » → Twabibu valide sous 48 h.
3. Assistant de configuration : lieu(x), horaires, motifs (modèles par spécialité), plages en ligne, consignes, tarifs, photo.
4. Profil publié → premier RDV en ligne → notification.

### P4 — Journée au cabinet (secrétaire)
Vue semaine multi-praticiens → patient appelle → recherche par téléphone → crée le RDV sur un créneau libre → le patient reçoit un SMS → à l'arrivée, statut « Arrivé » → fin de journée, marque les « Non honorés ».

### P5 — Absence imprévue (soignant)
Ajoute une absence sur jeudi après-midi → la plateforme liste les 6 RDV impactés → « Annuler et prévenir » ou « Proposer un autre créneau » → SMS envoyés automatiquement.

### P7 — Consultation complète (médecin)
Ouvre le RDV → la synthèse du dossier s'affiche (allergie pénicilline en rouge, traitement en cours) → choisit le modèle « Consultation adulte » → saisit tension et poids (courbe mise à jour) → note en 4 champs → « Nouvelle ordonnance » : recherche « amoxicilline » → alerte allergie bloquante → choisit une alternative, posologie guidée → signe → PDF imprimé + ordonnance dans le carnet du patient → « Terminer » → le RDV passe en terminé, le traitement est inscrit dans le dossier.

### P8 — Ordonnance → pharmacie (patient)
Reçoit le SMS « Votre ordonnance est disponible » → ouvre l'app → « Envoyer à une pharmacie » → voit les pharmacies proches et de garde, avec disponibilité et prix estimé → envoie → la pharmacie répond « prête dans 30 min, 2 produits sur 3, substitution proposée » → le patient accepte, choisit la livraison → suit les statuts → reçoit les médicaments → la dispensation apparaît chez le médecin.

### P9 — Soir de garde (pharmacien)
Son officine est de garde cette semaine : elle est en tête de la page « Pharmacies de garde » de Ngazidja et dans l'app → les ordonnances arrivent dans Twabibu Pharma → il prépare, répond, et organise les livraisons du soir.

### P6 — Vérifier un soignant (Twabibu)
File d'attente → ouvre le dossier → pièces (diplôme, autorisation d'exercer, CNI) → « Valider » (profil publié, badge vérifié) ou « Demander un complément » / « Refuser » (motif).
