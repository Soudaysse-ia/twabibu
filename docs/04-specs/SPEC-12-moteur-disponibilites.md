# SPEC-12 — Moteur de disponibilités et verrous de créneaux

## Objectif
Calculer de façon déterministe, rapide et testable les créneaux réservables d'un agenda pour un motif, et garantir qu'un créneau n'est réservé qu'une fois.

## Emplacement
`packages/availability` (fonctions pures, zéro IO, testées à 100 %) + `apps/api/src/availability` (chargement des données, cache, verrous Redis).

## Entrées
```ts
type ComputeInput = {
  agenda: { id; timezone: 'Indian/Comoro'; slotStepMinutes; bookingHorizonDays; minNoticeMinutes; onlineBookingEnabled };
  motive: { id; durationMinutes; isOnline; newPatientsAllowed; minNoticeMinutes? };
  rules: AvailabilityRule[];        // plages récurrentes hebdo (weekday, start, end, motiveIds, capacity, validFrom/Until)
  absences: Absence[];              // intervalles UTC (après expansion RRULE), allDay résolus
  holidays: Date[];                 // jours fériés (bloquants si agenda.blockHolidays)
  appointments: { startsAt; endsAt; status }[]; // RDV actifs sur la fenêtre (hors annulés)
  locks: { startsAt; endsAt }[];    // verrous Redis en cours
  range: { from: Date; to: Date };  // ≤ 14 jours
  now: Date;
  context: { isKnownPatient: boolean; source: 'ONLINE' | 'PRACTICE' };
};
type Slot = { startsAt: Date; endsAt: Date; remainingCapacity: number };
```

## Algorithme
1. Si `source = ONLINE` et (`!agenda.onlineBookingEnabled` ou `!motive.isOnline` ou (`!motive.newPatientsAllowed` et `!isKnownPatient`)) → `[]` avec `reason`.
2. Borner `range` à `[max(now + minNotice, from), min(now + horizonDays, to)]`.
3. Pour chaque jour local (fuseau `Indian/Comoro`, attention aux conversions : calculer en local puis convertir en UTC) : prendre les `rules` du `weekday` valides ce jour et autorisant le motif ; soustraire absences, jours fériés, hors `validFrom/validUntil`.
4. Dans chaque plage restante, générer les débuts de créneau tous les `slotStepMinutes` depuis `start` tant que `start + duration ≤ end`.
5. Pour chaque créneau candidat `[s, s+duration)` : compter les RDV et verrous qui le chevauchent ; `remainingCapacity = capacity − count` ; garder si > 0.
6. Pour `source = PRACTICE`, les étapes 1 et 2 (délai, horizon, plages en ligne) ne s'appliquent pas : on retourne toute la journée d'ouverture (ou 24 h) moins RDV/absences, avec `outsideOnlineRules: true` pour l'affichage.
7. Résultat trié, dédoublonné, groupé par jour pour l'API.

Complexité : O(jours × plages × créneaux) — pour 14 jours à pas 10 min, < 2 000 candidats ; avec un index trié des RDV, < 5 ms.

## Verrous (`SlotLock`)
- `POST /booking/locks` : recalcul du créneau demandé (jamais confiance au client) → `SET lock:{agendaId}:{startsAtISO}:{motiveId} {sessionId} NX EX 600`. Si la clé existe pour une autre session → `SLOT_UNAVAILABLE`. Pour `capacity > 1`, utiliser un compteur `INCR` avec plafond et TTL.
- Le verrou est associé à la session (cookie anonyme ou utilisateur). Il survit à l'inscription/connexion (le `sessionId` est conservé).
- Libération : `DELETE`, expiration, ou consommation à la création du RDV (script Lua : vérifier propriétaire + supprimer + autoriser l'insertion, le tout avant l'écriture SQL).
- Insertion SQL dans une transaction `SERIALIZABLE` ou avec la contrainte d'exclusion ; en cas de violation → `SLOT_UNAVAILABLE` (le verrou protège de la course courante, la contrainte protège de tout le reste).

## Invalidation du cache
Cache Redis des réponses `availabilities` par `(agendaId, motiveId, day)` TTL 30 s, invalidé par les événements `appointment.*`, `absence.*`, `availability_rules.updated`, `lock.*` (clé du jour concerné).

## Cas de test obligatoires (`packages/availability/test`)
1. Plage 08:00–12:00, pas 15, durée 30 → créneaux 08:00…11:30 (8).
2. Durée 20 avec pas 15 → 08:00, 08:15, … tant que fin ≤ 12:00 ; chevauchements correctement comptés.
3. RDV 09:00–09:30 retire 08:45 (durée 30) et 09:00, 09:15.
4. Absence 10:00–11:00 retire tout créneau qui l'intersecte.
5. Délai minimum 120 min : à 07:30 locales, premier créneau 09:30.
6. Horizon 90 jours : aucun créneau au-delà.
7. Jour férié bloquant ; jour férié non bloquant.
8. Règle valable du 1er au 30 mars seulement (ramadan) ; règle `BIWEEKLY`.
9. Capacité 2 : un RDV laisse 1 ; deux RDV retirent le créneau ; verrou compte comme RDV.
10. Motif réservé aux patients connus : liste vide pour un inconnu, pleine pour un connu.
11. Changement d'heure inexistant aux Comores mais conversion UTC ↔ Indian/Comoro vérifiée aux bornes de journée (créneau 23:50 local).
12. `source = PRACTICE` ignore délai/horizon et retourne hors plages.
13. Deux réservations concurrentes sur le même créneau → une seule réussit (test d'intégration API avec Redis réel).

## Critères d'acceptation
- [ ] Couverture 100 % du package, tests de propriété (fast-check) : aucun créneau retourné ne chevauche un RDV actif ni une absence.
- [ ] `GET availabilities` sur 14 jours répond en < 100 ms (p95) avec cache froid sur un agenda de 300 RDV.
- [ ] Les créneaux affichés dans la recherche, le profil et le tunnel sont identiques pour un même instant (même fonction, même cache).

## Tickets
AVAIL-01 package + types + algorithme · AVAIL-02 tests unitaires et de propriété · AVAIL-03 service API (chargement, cache, groupement par jour) · AVAIL-04 verrous Redis + script Lua + contrainte SQL · AVAIL-05 invalidation par événements · AVAIL-06 tests d'intégration et de charge.
