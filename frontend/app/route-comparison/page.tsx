'use client';

import React, { Suspense } from 'react';
import { UnifiedRouteSimulator } from '@/src/components/routing/UnifiedRouteSimulator';
import { LoadingSpinner } from '@/src/components/ui/LoadingState';

export default function RouteComparisonPage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading pathway simulator..." />}>
      <UnifiedRouteSimulator />
    </Suspense>
  );
}
