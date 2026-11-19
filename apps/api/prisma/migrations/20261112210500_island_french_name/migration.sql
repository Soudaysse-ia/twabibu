-- Nom français des îles (Grande Comore, Anjouan, Mohéli) pour l'autocomplétion.
ALTER TABLE "Island" ADD COLUMN "frenchName" TEXT NOT NULL DEFAULT '';
