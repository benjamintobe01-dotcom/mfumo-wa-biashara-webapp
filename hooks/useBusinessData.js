'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const TABLES = [
  'products', 'sales', 'purchases', 'biz_expenses',
  'personal_expenses', 'debts', 'customer_profiles', 'accounts',
];

export function useBusinessData(userId) {
  const [data, setData] = useState({
    products: [], sales: [], purchases: [], biz_expenses: [],
    personal_expenses: [], debts: [], customer_profiles: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const results = await Promise.all(
      TABLES.map((t) => supabase.from(t).select('*').order('created_at', { ascending: false }))
    );
    const next = {};
    let firstError = null;
    TABLES.forEach((t, i) => {
      next[t] = results[i].data || [];
      if (results[i].error && !firstError) firstError = results[i].error;
    });
    setData(next);
    setError(firstError);
    setLoading(false);
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);

  const insertRow = async (table, row) => {
    const { data: d, error } = await supabase
      .from(table)
      .insert({ ...row, user_id: userId })
      .select()
      .single();
    if (!error && d) setData((prev) => ({ ...prev, [table]: [d, ...prev[table]] }));
    return { data: d, error };
  };

  const updateRow = async (table, id, patch) => {
    const { data: d, error } = await supabase
      .from(table)
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (!error && d) setData((prev) => ({ ...prev, [table]: prev[table].map((r) => (r.id === id ? d : r)) }));
    return { data: d, error };
  };

const deleteRow = async (table, id) => {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (!error) {
    setData((prev) => ({
      ...prev,
      [table]: prev?.[table]?.filter((r) => r.id !== id) ?? []
    }));
  }
  return { error };
};
