'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push('/');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#F6F1E4' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-2"
            style={{ background: '#C6952E', color: '#16301F' }}
          >K</div>
          <h1 className="text-xl font-semibold" style={{ color: '#20201A', fontFamily: 'ui-serif, Georgia' }}>Mfumo wa Biashara</h1>
          <p className="text-xs" style={{ color: '#786F5C' }}>Ingia kwenye akaunti yako</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl p-5 space-y-3" style={{ background: '#fff', border: '1px solid #E3D9C2' }}>
          {error && (
            <div className="text-xs px-3 py-2 rounded-lg" style={{ background: '#F3DEDB', color: '#8F3A34' }}>{error}</div>
          )}
          <label className="block text-xs" style={{ color: '#786F5C' }}>
            <span className="block mb-1 font-medium">Barua pepe</span>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid #E3D9C2', outline: 'none' }}
            />
          </label>
          <label className="block text-xs" style={{ color: '#786F5C' }}>
            <span className="block mb-1 font-medium">Password</span>
            <input
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid #E3D9C2', outline: 'none' }}
            />
          </label>
          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-medium"
            style={{ background: '#16301F', color: '#fff', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Inaingia...' : 'Ingia'}
          </button>
        </form>

        <p className="text-center text-xs mt-4" style={{ color: '#786F5C' }}>
          Huna akaunti?{' '}
          <a href="/signup" className="font-medium" style={{ color: '#3C6E52' }}>Jisajili</a>
        </p>
      </div>
    </div>
  );
}
