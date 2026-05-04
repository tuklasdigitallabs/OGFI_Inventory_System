import { AppShell } from '@/components/app-shell';
import { ScreenPage } from '@/components/screen-page';
import { dashboard } from '@/lib/screens';

export default function Home() {
  return (
    <AppShell>
      <ScreenPage screen={dashboard} />
    </AppShell>
  );
}
