'use client';

import { CalendarWeekProvider } from '@gitroom/frontend/components/launches/calendar.context';
import { useIntegrationList } from '@gitroom/frontend/components/launches/helpers/use.integration.list';
import { GrowthAgent } from './growth.agent';

export const GrowthPage = () => {
  const { data: integrations = [] } = useIntegrationList();
  return (
    <CalendarWeekProvider integrations={integrations}>
      <GrowthAgent />
    </CalendarWeekProvider>
  );
};
