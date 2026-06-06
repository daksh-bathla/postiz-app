import { Metadata } from 'next';
import { GrowthPage } from '@gitroom/frontend/components/growth/growth.page';

export const metadata: Metadata = {
  title: 'Postiz - Growth Agent',
  description: 'Discover growth opportunities across the internet',
};

export default function Page() {
  return <GrowthPage />;
}
