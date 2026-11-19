'use client';

import { Printer } from 'lucide-react';
import { Button } from '@twabibu/ui';

export function PrintButton() {
  return (
    <Button onClick={() => window.print()} className="print:hidden">
      <Printer aria-hidden="true" size={16} /> Imprimer ou enregistrer en PDF
    </Button>
  );
}
