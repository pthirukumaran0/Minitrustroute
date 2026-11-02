'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sliders, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // Automatically redirect obsolete settings route to Admin dashboard
    router.replace('/admin');
  }, [router]);

  return (
    <div className="py-20 px-4 max-w-md mx-auto text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center mx-auto shadow-xs">
        <Sliders className="w-7 h-7 text-purple-600 animate-pulse" />
      </div>
      <h1 className="text-xl font-black text-slate-900 tracking-tight">System Settings Retired</h1>
      <p className="text-xs text-slate-500 leading-relaxed">
        Engine configuration and parameters are now directly governed through dynamic topology and zero-trust policy consoles. Redirecting you to the Admin Dashboard...
      </p>
      <div className="pt-2">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-2xs transition-all"
        >
          <span>Go to Admin Dashboard</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
