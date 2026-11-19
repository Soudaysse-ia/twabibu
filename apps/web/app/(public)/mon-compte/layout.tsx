import { AccountNav } from '@/components/account/AccountNav';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AccountNav />
      {children}
    </>
  );
}
