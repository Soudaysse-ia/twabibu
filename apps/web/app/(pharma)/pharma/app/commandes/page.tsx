import type { Metadata } from 'next';
import { OrdersBoard } from '@/components/pharma/OrdersBoard';

export const metadata: Metadata = { title: 'Commandes' };

export default function Page() {
  return <OrdersBoard />;
}
