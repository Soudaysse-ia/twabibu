# SPEC-13 — Dossier médical patient (suivi complet)

## Objectif
Donner au médecin, à l'ouverture de chaque rendez-vous, tout ce qu'il doit savoir sur le patient, et lui permettre d'écrire sa consultation en deux minutes. Le dossier suit le patient d'un praticien à l'autre avec son consentement. C'est le module qui crée la dépendance positive : « je ne travaille plus sans ».

## Acteurs
Praticien (auteur), autres praticiens autorisés (lecture/écriture selon consentement), secrétaire (jamais le contenu médical), patient (lecture de son carnet, ajout d'informations déclaratives), laboratoire (V2 : dépôt de résultats).

## Principes
1. **Un dossier par personne** (`MedicalRecord` lié à `PatientProfile` ou `Relative`, ou à un `PatientRecord` orphelin si le patient n'a pas de compte), partagé entre cabinets **uniquement avec consentement** du patient (par cabinet, révocable). Sans consentement, chaque cabinet ne voit que ce qu'il a écrit lui-même.
2. **Tout est horodaté, signé par un auteur, jamais supprimé** (correction = nouvelle version, l'ancienne reste visible dans l'historique).
3. **Chiffré** au repos (champ par champ), lecture journalisée (`AuditLog` avec motif d'accès optionnel « urgence »).
4. **Structuré mais rapide** : des champs structurés là où ça compte (allergies, traitements, constantes, diagnostics codés), du texte libre partout ailleurs, des modèles par spécialité.
5. **Pas d'IA** : alertes par règles uniquement.

## Contenu du dossier
| Section | Contenu | Saisie |
|---|---|---|
| **Synthèse** (écran d'accueil du dossier) | âge, sexe, groupe sanguin, allergies (rouge), traitements en cours, antécédents majeurs, dernières constantes, prochain RDV, alertes de suivi | générée |
| **Antécédents** | médicaux, chirurgicaux (date, intervention), familiaux, gynéco-obstétricaux (G/P, grossesses), habitudes (tabac, alcool, activité), vaccinations (vaccin, date, lot, rappel prévu) | liste structurée + texte |
| **Allergies et intolérances** | substance (DCI ou autre), type de réaction, gravité, date, source (déclarée par le patient / constatée) | structuré, bloque à la prescription |
| **Traitements en cours** | médicament (référentiel), posologie, début, fin prévue, prescripteur, origine (ordonnance Twabibu ou saisie), statut (actif, arrêté, terminé) | structuré, alimenté par SPEC-14 |
| **Consultations** | une entrée par RDV (ou hors RDV) : motif, interrogatoire, examen clinique, constantes, diagnostic(s) (texte + code CIM-10 optionnel), conduite à tenir, ordonnance(s), documents, prochain contrôle | modèle SOAP par spécialité, texte riche léger |
| **Constantes** | poids, taille, IMC (calculé), tension, fréquence cardiaque, température, SpO₂, glycémie, périmètre crânien (pédiatrie), avec courbes (croissance OMS en pédiatrie, poids/tension en chronique) | formulaire rapide, courbes automatiques |
| **Résultats et documents** | résultats de laboratoire (PDF + valeurs saisies optionnelles), imagerie, comptes rendus, certificats, documents envoyés par le patient | upload (SPEC-09) + saisie |
| **Ordonnances** | toutes les ordonnances Twabibu (statut de dispensation) et papier scannées | SPEC-14 |
| **Suivi des chroniques** | protocole simple : pathologie (diabète, HTA, asthme, grossesse…), examens de contrôle attendus et périodicité, prochaine échéance, alerte « contrôle en retard » | structuré |
| **Notes privées** | notes du praticien non partagées même avec consentement (`ClinicalNote` existante) | texte |
| **Carnet du patient** (vue patient) | synthèse lisible, vaccins, traitements, ordonnances, résultats, données qu'il déclare lui-même (allergie, poids) marquées « déclaré par le patient » | app/web patient |

## Écrans (Twabibu Pro)
- `/pro/app/patients/{id}/dossier` : **Synthèse** (bandeau rouge allergies, cartes traitements / antécédents / constantes / alertes), onglets Consultations (timeline), Antécédents, Traitements, Constantes (courbes), Résultats, Ordonnances, Suivi, Notes.
- **Vue consultation** (`/pro/app/agenda/rdv/{id}/consultation`) : colonne gauche = synthèse du dossier (repliable), colonne centrale = note de consultation (modèle), colonne droite = actions : constantes, ordonnance, document, certificat, prochain RDV, « Terminer la consultation ». Raccourcis clavier. Mobile : onglets.
- **Modèles de consultation** par spécialité (généraliste, pédiatrie, gynéco, dentaire, kiné…), éditables par le cabinet.
- **Consentement** : bandeau « Dossier partagé par le patient » / bouton « Demander l'accès » (SMS au patient avec lien OUI/NON, ou saisie d'un code que le patient lit sur son app). Accès d'urgence : lecture avec justification obligatoire, notifié au patient.
- Côté patient : `/mon-compte/carnet` (web et app) : synthèse, traitements, vaccins, ordonnances, résultats, « Partager mon dossier avec un cabinet », historique des accès.

## Règles métier
1. Secrétaire : jamais d'accès aux sections médicales (API 403, UI masquée) ; accès aux documents administratifs seulement.
2. Allergie enregistrée + prescription d'une DCI correspondante → alerte bloquante avec justification (SPEC-14).
3. Une consultation se rattache à un RDV `DONE` ; terminer la consultation passe le RDV en `DONE` et crée l'entrée.
4. Croissance pédiatrique : courbes OMS 0–5 ans (poids, taille, PC), 5–19 ans (IMC) intégrées (données libres OMS).
5. Export du dossier (PDF structuré + JSON) par le patient ou à la demande d'un confrère autorisé.
6. Rappels de suivi : job quotidien → alertes dans le tableau de bord Pro + SMS au patient optionnel (« Votre contrôle de tension est à programmer »).
7. Conservation : durée de vie du patient + 10 ans (règle interne, à aligner sur le droit comorien, LEGAL-01).

## Données (ajout au modèle)
`MedicalRecord`, `RecordConsent` (recordId, organizationId, grantedAt, revokedAt, scope), `Allergy`, `MedicalHistoryItem` (type, label, date, details), `Vaccination`, `CurrentTreatment`, `Consultation` (appointmentId?, practitionerId, template, sections JSON chiffré, diagnoses[]), `Vital` (type, value, unit, measuredAt, consultationId?), `LabResult` (documentId, analytes JSON), `FollowUpPlan` (condition, checks[], nextDueAt), `RecordAccessLog`. Référentiels : `Icd10Code` (sous-ensemble), `Vaccine`, `Drug` (SPEC-14).

## API
`/v1/pro/orgs/{orgId}/patients/{id}/record` (GET synthèse), `/record/history`, `/record/allergies`, `/record/treatments`, `/record/consultations`, `/record/vitals`, `/record/results`, `/record/follow-ups`, `/record/consent-requests` ; `/v1/me/record` (patient), `/v1/me/record/consents`, `/v1/me/record/export`.

## Critères d'acceptation
- [ ] Ouvrir un RDV affiche la synthèse en < 1 s avec allergies en rouge en premier.
- [ ] Une consultation complète (constantes + note + ordonnance) se saisit en < 2 min sur un modèle (test utilisateur avec 3 médecins pilotes).
- [ ] Un cabinet sans consentement ne voit que ses propres entrées (test API).
- [ ] Toute lecture du dossier est présente dans `RecordAccessLog` et visible par le patient.
- [ ] Courbe de croissance correcte sur un jeu de données OMS de référence.

## Tickets
RECORD-01 modèle de données + chiffrement + consentement · RECORD-02 synthèse + allergies + antécédents + traitements · RECORD-03 consultation (modèles, vue consultation, clôture du RDV) · RECORD-04 constantes + courbes (OMS) · RECORD-05 résultats et documents rattachés · RECORD-06 suivi des chroniques + alertes · RECORD-07 carnet patient (web/app) + partage + historique des accès · RECORD-08 export PDF/JSON · RECORD-09 tests (droits, chiffrement, performance).
