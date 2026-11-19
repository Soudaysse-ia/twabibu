# Bibliothèque de composants UI (`packages/ui`)

Implémentation cible : React + Tailwind CSS 4 + primitives Radix (via shadcn/ui) ; chaque composant est typé, accessible, et documenté dans Storybook. Les apps mobiles réimplémentent les mêmes composants en React Native avec les mêmes tokens (`packages/tokens`).

Convention de nommage : `PascalCase`, un dossier par composant (`Button/Button.tsx`, `Button.stories.tsx`, `Button.test.tsx`), props en français interdites (code en anglais, UI en français).

## 1. Fondations
| Composant | Rôle | Notes |
|---|---|---|
| `Logo` | wordmark + icône, variantes `onBlue` / `onWhite`, tailles | SVG inline |
| `Container` | largeur max 1200, gouttières responsives | |
| `Stack`, `Inline`, `Grid` | espacements de la grille 4 px | |
| `Text`, `Heading` | styles typographiques des tokens | `Heading level={1..3}` |
| `Icon` | enveloppe Lucide 16/20/24 | `aria-hidden` par défaut |
| `Skeleton` | chargement | |
| `VisuallyHidden` | accessibilité | |

## 2. Actions
| Composant | Variantes | Spécificités |
|---|---|---|
| `Button` | `primary` (bleu, majuscules), `secondary` (blanc bordé), `navy`, `accent` (jaune), `ghost`, `link`, `danger` ; tailles `sm` 32 / `md` 40 / `lg` 48 ; `fullWidth` ; `loading` ; `iconLeft/iconRight` | Rayon 8 ; sur mobile les CTA principaux sont `lg` + `fullWidth` |
| `IconButton` | mêmes variantes, 40 × 40 | `aria-label` obligatoire |
| `Chip` | `filter` (blanc rayon 16, état sélectionné bleu pâle avec compteur), `tag` (expertises), `status` | |
| `SlotChip` | créneau horaire : fond `primary-soft`, 40 px, `—` si vide, états `selected`, `locked` | Cœur de l'expérience |
| `Link` | bleu, souligné au survol | |

## 3. Formulaires
| Composant | Notes |
|---|---|
| `TextField` | label au-dessus, aide, erreur, préfixe/suffixe, 48 px sur mobile (16 px de texte) |
| `PhoneField` | indicatif `+269` fixe par défaut, masque `3XX XX XX` / `4XX XX XX`, validation E.164 |
| `OtpField` | 6 cases, collage automatique, renvoi du code avec compte à rebours |
| `PasswordField` | affichage/masquage, jauge de robustesse |
| `Select`, `Combobox` | Radix ; `Combobox` avec recherche pour spécialités, localités, patients |
| `SearchAutocomplete` | champ « Nom, spécialité, établissement… » : groupes Spécialités / Soignants / Établissements / Motifs |
| `LocationAutocomplete` | champ « Où ? » : îles, villes, localités + bouton « Autour de moi » |
| `DateField`, `DatePicker` | format `jj/mm/aaaa`, calendrier Radix |
| `Checkbox`, `RadioGroup`, `Switch` | |
| `TextArea` | consignes, notes |
| `FileUpload` | pièces justificatives, documents (PDF/JPG/PNG, 10 Mo max) |
| `Form` | wrapper `react-hook-form` + `zod` (schémas partagés dans `packages/contracts`) |

## 4. Navigation et structure
| Composant | Notes |
|---|---|
| `Header` | public (bleu) ; `HeaderSearch` (résultats) ; `HeaderBack` (mobile) |
| `Footer` | colonnes SEO, mentions légales |
| `SearchBar` | pilule 60 px : `SearchAutocomplete` + `LocationAutocomplete` + bouton navy « Rechercher » ; version empilée sur mobile |
| `Breadcrumb` | Twabibu / Spécialité / Ville |
| `Tabs` | compte patient, fiche patient |
| `SideNav` | compte patient (desktop), espace Pro |
| `BottomNav` | mobile Pro et apps |
| `Stepper` | tunnel de réservation (titre, « Étape précédente ») |
| `Pagination` | « Page précédente / suivante » |
| `Card` | blanc, rayon 8, bordure, `CardHeader` avec icône + titre H2 14 px |
| `InfoBanner` | fond `background`, icône, texte |
| `Alert` | success / warning / danger |
| `Modal`, `Drawer` (mobile), `Popover`, `Tooltip`, `Toast` | Radix |
| `EmptyState` | illustration + texte + action |

## 5. Composants métier
| Composant | Description |
|---|---|
| `PractitionerCard` | carte de résultat : avatar, nom (bleu), spécialité, adresse, tarif/assurance, badge vérifié, `AvailabilityGrid` ou message |
| `AvailabilityGrid` | 5 colonnes jours × 4 lignes créneaux, flèches semaine, « Voir plus de créneaux » ; mobile : bouton « Prendre rendez-vous » |
| `EstablishmentCard` | logo, nom, « 7 médecins généralistes », adresse |
| `ResultsMap` | Leaflet, marqueurs numérotés, synchro survol ↔ liste |
| `PractitionerHero` | bandeau navy identité |
| `SummaryCard` | « En résumé » + CTA |
| `ProfileSection` | Adresses, Présentation, Tarifs, Horaires, Langues, Formations, Légal, FAQ |
| `PriceTable` | motif → KMF |
| `OpeningHours` | lundi → dimanche |
| `BookingSummary` | récapitulatif latéral du tunnel |
| `MotiveList` | liste de motifs cliquables |
| `DayAccordionSlots` | accordéon jour → chips d'heures |
| `AppointmentCard` | compte patient : date, soignant, lieu, actions |
| `RelativeCard` | proche |
| `DocumentRow` | document avec type, date, téléchargement |
| `CalendarGrid` (Pro) | grille 15 min, colonnes, événements, glisser-déposer, création au clic |
| `AppointmentEvent` (Pro) | bloc coloré par motif, statut, patient |
| `AppointmentDrawer` (Pro) | détail/édition d'un RDV |
| `PatientSearch` (Pro) | recherche instantanée par nom/téléphone |
| `PatientCard`, `PatientTimeline` (Pro) | |
| `AvailabilityRuleEditor` (Pro) | plages récurrentes par jour/lieu/motif |
| `AbsenceEditor` (Pro) | avec liste des RDV impactés |
| `StatCard`, `StatChart` (Pro) | KPI |
| `VerificationQueue` (Admin) | |
| `RecordSummary`, `AllergyBanner`, `TreatmentList`, `VitalsChart`, `ConsultationEditor`, `HistoryTimeline` (Pro) | dossier médical |
| `DrugSearch`, `PrescriptionLineEditor`, `PosologyBuilder`, `PrescriptionPreview`, `DispensationStatus` (Pro) | ordonnance |
| `PharmacyCard`, `DutyPharmacyList`, `OpenNowBadge`, `ProductTable`, `PriceComparator`, `OrderStepper`, `OrderStatusTimeline`, `PrescriptionInbox`, `SponsoredBadge` | pharmacies |
| `Logo` | utilise les SVG de `assets/brand/` (variantes blanc / bleu / fond bleu), jamais du texte |

## 6. Microcopie (règles)
- Vouvoiement. Verbes d'action à l'infinitif sur les boutons : « Prendre rendez-vous », « Rechercher », « Se connecter », « Annuler le rendez-vous ».
- Confirmations positives : « Votre rendez-vous est confirmé » (pas « Succès ! »).
- Erreurs : dire quoi faire : « Entrez un numéro comorien valide, par exemple 3XX XX XX ».
- Dates en toutes lettres : « jeudi 13 novembre 2026 à 10:20 », heures sur 24 h.
- Argent : « 5 000 KMF ».
- Jamais de jargon technique ni de donnée médicale dans un SMS.
- Lexique fixe : *soignant* (et non « praticien » côté patient), *rendez-vous*, *créneau*, *motif de consultation*, *proche*, *cabinet*, *établissement*, *Twabibu Pro*.
