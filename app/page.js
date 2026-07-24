'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import BusinessApp from '@/components/BusinessApp';

export default function HomePage() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null);
      setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F6F1E4', color: '#786F5C' }}>
        Inapakia...
      </div>
    );
  }

  if (!user) {
    // middleware should have redirected already; fallback just in case
    if (typeof window !== 'undefined') window.location.href = '/login';
    return null;
  }

  return <BusinessApp userEmail={user.email} userId={user.id} />;
}
