# @twabibu/ui

Composants React du site web (Next.js), stylés avec Tailwind CSS 4 et les tokens de `@twabibu/tokens`.
Paquet « source » : Next le transpile directement (`transpilePackages`), il n'a pas d'étape de build.

Règles : couleurs et rayons uniquement via les classes issues des tokens (`bg-primary`, `text-navy`, `rounded-md`…),
jamais de couleur en dur ; chaque composant interactif a un état focus visible ; textes fournis par l'appelant (i18n).
Storybook et tests visuels : ticket UI-04 (pas encore en place).
