import { AppShell } from '@/components/app-shell';
import { ScreenPage } from '@/components/screen-page';
import { getScreen, screens } from '@/lib/screens';

type ScreenRouteProps = {
  params: Promise<{
    screen: string[];
  }>;
};

export function generateStaticParams() {
  return Object.keys(screens).map((screen) => ({ screen: [screen] }));
}

export default async function ScreenRoute({ params }: ScreenRouteProps) {
  const { screen } = await params;
  const slug = screen.join('/');

  return (
    <AppShell>
      <ScreenPage screen={getScreen(slug)} />
    </AppShell>
  );
}
