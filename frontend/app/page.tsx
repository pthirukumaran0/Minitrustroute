'use client';

import React from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { SenderDashboard } from '@/src/components/dashboard/SenderDashboard';
import { AnalystDashboard } from '@/src/components/dashboard/AnalystDashboard';
import { AdminDashboard } from '@/src/components/dashboard/AdminDashboard';
import { LoadingSpinner } from '@/src/components/ui/LoadingState';

export default function RootDashboardPage() {
  const { role, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner message="Authenticating TrustRoute session..." />;
  }

  // Render role-specific dashboard based on active persona
  if (role === 'sender') {
    return <SenderDashboard />;
  }

  if (role === 'analyst') {
    return <AnalystDashboard />;
  }

  // Default to Administrator / Analytics benchmark for admin
  return <AdminDashboard />;
}
