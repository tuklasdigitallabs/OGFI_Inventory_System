import { AppShell } from '@/components/app-shell';
import { AuthGate } from '@/components/auth-gate';
import { ScreenPage } from '@/components/screen-page';
import { dashboard } from '@/lib/screens';

export default function Home() {
  return (
    <AuthGate>
      <AppShell>
        <ScreenPage screen={dashboard} />
      </AppShell>
    </AuthGate>
  );
}
