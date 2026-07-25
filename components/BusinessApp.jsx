'use client';

import React, { useMemo, useState } from 'react';
import {
  LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  LayoutDashboard, ShoppingCart, ShoppingBag, Users, Wallet, Package,
  Plus, Trash2, Pencil, X, Check, TrendingUp, TrendingDown, Minus,
  Menu, ClipboardList, LogOut, CreditCard, Bot,
} from 'lucide-react';
import AIAssistant from './AIAssistant';
import { supabase } from '@/lib/supabaseClient';
import { useBusinessData } from '@/hooks/useBusinessData';
import {
  C, PIE_COLORS, fmt, todayStr, monthKey, weekKey, quarterKey, monthLabel, addMonths, inputStyle,
} from './tokens';
import {
  StatCard, Pill, SectionHeader, Field, IconBtn, PrimaryBtn, EmptyState, InsightsPanel,
} from './ui';

export default function BusinessApp({ userEmail, userId }) {
  const bd = useBusinessData(userId);
  const {
    products = [],
    sales = [],
    purchases = [],
    biz_expenses = [],
    personal_expenses = [],
    debts = [],
    customer_profiles = [],
    accounts = [],
    loading,
  } = bd || {};
  const [tab, setTab] = useState('dashboard');
  const [moreOpen, setMoreOpen] = useState(false);

  /* -------- helpers -------- */
  const productName = (id) => (products.find((p) => p.id === id) || {}).name || '—';
  const avgBuyPrice = (id) => {
    const rel = purchases.filter((p) => p.product_id === id);
    const q = rel.reduce((s, p) => s + Number(p.qty || 0), 0);
    const c = rel.reduce((s, p) => s + Number(p.total_cost || 0), 0);
    return q > 0 ? c / q : 0;
  };
  const stockQty = (id) => {
    const bought = purchases.filter((p) => p.product_id === id).reduce((s, p) => s + Number(p.qty || 0), 0);
    const sold = sales.filter((s) => s.product_id === id).reduce((s, x) => s + Number(x.qty || 0), 0);
    return bought - sold;
  };
  const addProduct = async (name) => {
    const { data } = await bd.insertRow('products', { name });
    return data;
  };

  /* -------- Akaunti za Fedha -------- */
  const accountName = (id) => (accounts.find((a) => a.id === id) || {}).name || '—';
  const accountBalance = (acc) => {
    const inSales = sales.filter((s) => s.account_id === acc.id && s.payment_type === 'Taslimu').reduce((s, x) => s + Number(x.total_sale || 0), 0);
    const inDebtPay = debts.filter((d) => d.account_id === acc.id).reduce((s, d) => s + Number(d.paid_amount || 0), 0);
    const outPurchases = purchases.filter((p) => p.account_id === acc.id).reduce((s, p) => s + Number(p.total_cost || 0), 0);
    const outBiz = biz_expenses.filter((e) => e.account_id === acc.id).reduce((s, e) => s + Number(e.amount || 0), 0);
    const outPers = personal_expenses.filter((e) => e.account_id === acc.id).reduce((s, e) => s + Number(e.amount || 0), 0);
    const moneyIn = inSales + inDebtPay;
    const moneyOut = outPurchases + outBiz + outPers;
    return { balance: Number(acc.opening_balance || 0) + moneyIn - moneyOut, moneyIn, moneyOut };
  };
  const saveAccount = async (form, editId) => {
    if (!form.name.trim()) return;
    const row = {
      name: form.name.trim(), type: form.type, account_number: form.accountNumber,
      lipa_namba: form.lipaNamba, opening_balance: Number(form.openingBalance || 0), status: form.status, notes: form.notes,
    };
    if (editId) await bd.updateRow('accounts', editId, row);
    else await bd.insertRow('accounts', row);
  };
  const deleteAccount = (id) => bd.deleteRow('accounts', id);

  /* -------- Mauzo (sales) with debt sync -------- */
  const saveSale = async (form, editId) => {
    let productId = form.productId;
    if (productId === '__new__') {
      if (!form.newProductName.trim()) return;
      const newProd = await addProduct(form.newProductName.trim());
      if (!newProd) return;
      productId = newProd.id;
    }
    if (!productId || !form.qty || !form.sellPrice) return;
    const qty = Number(form.qty), sellPrice = Number(form.sellPrice), buyPrice = Number(form.buyPrice || 0);
    const total_sale = qty * sellPrice, cost = qty * buyPrice, profit = total_sale - cost;
    const row = {
      date: form.date, customer: form.customer || 'Mteja', product_id: productId, qty,
      sell_price: sellPrice, total_sale, buy_price: buyPrice, cost, profit, payment_type: form.paymentType,
      account_id: form.paymentType === 'Taslimu' ? (form.accountId || null) : null,
    };
    let saleRow;
    if (editId) {
      const { data } = await bd.updateRow('sales', editId, row);
      saleRow = data;
    } else {
      const { data } = await bd.insertRow('sales', row);
      saleRow = data;
    }
    if (!saleRow) return;
    const existingDebt = debts.find((d) => d.sale_id === saleRow.id);
    if (form.paymentType === 'Deni') {
      const paid = existingDebt ? Number(existingDebt.paid_amount || 0) : 0;
      const balance = Math.max(total_sale - paid, 0);
      const status = balance <= 0 ? 'Imelipwa' : paid > 0 ? 'Sehemu' : 'Wazi';
      if (existingDebt) {
        await bd.updateRow('debts', existingDebt.id, {
          date: form.date, customer: row.customer, product: productName(productId), total_debt: total_sale, balance, status,
        });
      } else {
        await bd.insertRow('debts', {
          sale_id: saleRow.id, date: form.date, customer: row.customer, product: productName(productId),
          total_debt: total_sale, paid_amount: 0, balance: total_sale, status: 'Wazi',
        });
      }
    } else if (existingDebt) {
      await bd.deleteRow('debts', existingDebt.id);
    }
  };
  const deleteSale = async (id) => {
    const linked = debts.find((d) => d.sale_id === id);
    if (linked) await bd.deleteRow('debts', linked.id);
    await bd.deleteRow('sales', id);
  };

  /* -------- Manunuzi (purchases) -------- */
  const savePurchase = async (form, editId) => {
    let productId = form.productId;
    if (productId === '__new__') {
      if (!form.newProductName.trim()) return;
      const newProd = await addProduct(form.newProductName.trim());
      if (!newProd) return;
      productId = newProd.id;
    }
    if (!productId || !form.qty || !form.buyPrice) return;
    const qty = Number(form.qty), buyPrice = Number(form.buyPrice);
    const row = {
      date: form.date, product_id: productId, qty, buy_price: buyPrice,
      total_cost: qty * buyPrice, supplier: form.supplier, notes: form.notes, account_id: form.accountId || null,
    };
    if (editId) await bd.updateRow('purchases', editId, row);
    else await bd.insertRow('purchases', row);
  };

  /* -------- Madeni (debts) -------- */
  const addManualDebt = (form) => bd.insertRow('debts', {
    date: form.date, customer: form.customer, product: form.product,
    total_debt: Number(form.totalDebt), paid_amount: 0, balance: Number(form.totalDebt),
    status: 'Wazi', notes: form.notes,
  });
  const payDebt = async (d, amt, accountId) => {
    const paid = Number(d.paid_amount || 0) + amt;
    const balance = Math.max(Number(d.total_debt) - paid, 0);
    const status = balance <= 0 ? 'Imelipwa' : 'Sehemu';
    await bd.updateRow('debts', d.id, { paid_amount: paid, balance, status, payment_date: todayStr(), account_id: accountId || d.account_id || null });
  };

  /* -------- Wateja profiles -------- */
  const saveCustomerProfile = async (name, patch) => {
    const existing = customer_profiles.find((c) => c.name === name);
    if (existing) await bd.updateRow('customer_profiles', existing.id, patch);
    else await bd.insertRow('customer_profiles', { name, ...patch });
  };

  /* -------- customer stats -------- */
  const customerStats = useMemo(() => {
    const curMk = monthKey(todayStr());
    const lastMk = addMonths(todayStr(), -1);
    const map = {};
    sales.forEach((s) => {
      const name = s.customer || 'Haijulikani';
      if (!map[name]) map[name] = { name, count: 0, total: 0, lastDate: '', thisMonth: 0, lastMonth: 0 };
      map[name].count += 1;
      map[name].total += Number(s.total_sale) || 0;
      if (!map[name].lastDate || s.date > map[name].lastDate) map[name].lastDate = s.date;
      const mk = monthKey(s.date);
      if (mk === curMk) map[name].thisMonth += Number(s.total_sale) || 0;
      if (mk === lastMk) map[name].lastMonth += Number(s.total_sale) || 0;
    });
    customer_profiles.forEach((p) => {
      if (!map[p.name]) map[p.name] = { name: p.name, count: 0, total: 0, lastDate: '', thisMonth: 0, lastMonth: 0 };
    });
    const debtBy = {};
    debts.forEach((d) => { if (d.status !== 'Imelipwa') debtBy[d.customer] = (debtBy[d.customer] || 0) + Number(d.balance || 0); });
    const profileByName = {};
    customer_profiles.forEach((p) => { profileByName[p.name] = p; });
    return Object.values(map).map((c) => {
      const profile = profileByName[c.name] || {};
      return {
        ...c,
        avg: c.count ? c.total / c.count : 0,
        debt: debtBy[c.name] || 0,
        trend: c.thisMonth > c.lastMonth ? 'up' : c.thisMonth < c.lastMonth ? 'down' : 'sawa',
        level: c.count >= 5 || c.total >= 300000 ? 'Mteja Mkubwa' : c.count >= 2 ? 'Mteja wa Kawaida' : 'Mteja Mpya',
        remarks: profile.remarks || '',
        phone: profile.phone || '',
        location: profile.location || '',
        followUpDate: profile.follow_up_date || '',
        followUpNote: profile.follow_up_note || '',
      };
    }).sort((a, b) => b.total - a.total);
  }, [sales, debts, customer_profiles]);

  const insights = useMemo(() => {
    const curMk = monthKey(todayStr());
    const firstDateByCustomer = {};
    sales.forEach((s) => {
      const name = s.customer || 'Haijulikani';
      if (!firstDateByCustomer[name] || s.date < firstDateByCustomer[name]) firstDateByCustomer[name] = s.date;
    });
    const list = [];
    customerStats.forEach((c) => {
      if (firstDateByCustomer[c.name] && monthKey(firstDateByCustomer[c.name]) === curMk) {
        list.push({ type: 'new', tone: 'sage', text: `${c.name} ni mteja mpya mwezi huu — karibu!` });
      }
      if (c.lastMonth > 0 && c.thisMonth > c.lastMonth) {
        const pct = Math.round(((c.thisMonth - c.lastMonth) / c.lastMonth) * 100);
        if (pct >= 20) list.push({ type: 'growth', tone: 'gold', text: `${c.name} ameongeza ununuzi kwa ${pct}% mwezi huu ukilinganisha na uliopita.` });
      }
      if (c.lastMonth > 0 && c.thisMonth === 0) {
        list.push({ type: 'risk', tone: 'brick', text: `${c.name} hajanunua mwezi huu (alinunua ${fmt(c.lastMonth)} Tsh mwezi uliopita) — mfuatilie.` });
      }
      if (c.debt > 0) {
        list.push({ type: 'debt', tone: 'brick', text: `${c.name} anadaiwa ${fmt(c.debt)} Tsh.` });
      }
    });
    const order = { risk: 0, debt: 1, growth: 2, new: 3 };
    return list.sort((a, b) => order[a.type] - order[b.type]);
  }, [customerStats, sales]);

  /* -------- dashboard aggregates -------- */
  const curMk = monthKey(todayStr());
  const salesThisMonth = sales.filter((s) => monthKey(s.date) === curMk);
  const mauzoMwezi = salesThisMonth.reduce((s, x) => s + Number(x.total_sale || 0), 0);
  const faidaMwezi = salesThisMonth.reduce((s, x) => s + Number(x.profit || 0), 0);
  const madeniSasa = debts.filter((d) => d.status !== 'Imelipwa').reduce((s, d) => s + Number(d.balance || 0), 0);
  const idadiWateja = customerStats.length;
  const lastMkTop = addMonths(todayStr(), -1);
  const mauzoMwezLiopita = sales.filter((s) => monthKey(s.date) === lastMkTop).reduce((s, x) => s + Number(x.total_sale || 0), 0);
  const fedhaZilizopo = accounts.filter((a) => a.status !== 'Imefungwa').reduce((s, a) => s + accountBalance(a).balance, 0);

  const productSummary = products.map((p) => {
    const rel = sales.filter((s) => s.product_id === p.id);
    return {
      name: p.name,
      kg: rel.reduce((s, x) => s + Number(x.qty || 0), 0),
      mauzo: rel.reduce((s, x) => s + Number(x.total_sale || 0), 0),
      faida: rel.reduce((s, x) => s + Number(x.profit || 0), 0),
    };
  }).filter((p) => p.kg > 0 || p.mauzo > 0);

  const trend = useMemo(() => {
    const arr = [];
    for (let i = 5; i >= 0; i--) {
      const mk = addMonths(todayStr(), -i);
      const rel = sales.filter((s) => monthKey(s.date) === mk);
      arr.push({
        month: monthLabel(mk),
        Mauzo: rel.reduce((s, x) => s + Number(x.total_sale || 0), 0),
        Faida: rel.reduce((s, x) => s + Number(x.profit || 0), 0),
      });
    }
    return arr;
  }, [sales]);

  const expenseBreakdown = useMemo(() => {
    const yr = todayStr().slice(0, 4);
    const gManunuzi = purchases.filter((p) => p.date?.startsWith(yr)).reduce((s, p) => s + Number(p.total_cost || 0), 0);
    const gBiashara = biz_expenses.filter((p) => p.date?.startsWith(yr)).reduce((s, p) => s + Number(p.amount || 0), 0);
    const gBinafsi = personal_expenses.filter((p) => p.date?.startsWith(yr)).reduce((s, p) => s + Number(p.amount || 0), 0);
    return [
      { name: 'Manunuzi', value: gManunuzi },
      { name: 'Gharama Biashara', value: gBiashara },
      { name: 'Matumizi Binafsi', value: gBinafsi },
    ].filter((x) => x.value > 0);
  }, [purchases, biz_expenses, personal_expenses]);

  const assistantContext = useMemo(() => ({
    tarehe_ya_leo: todayStr(),
    mauzo_mwezi_huu_tsh: mauzoMwezi,
    faida_mwezi_huu_tsh: faidaMwezi,
    madeni_yanayodaiwa_sasa_tsh: madeniSasa,
    idadi_ya_wateja: idadiWateja,
    fedha_zilizopo_kwenye_akaunti_tsh: fedhaZilizopo,
    muhtasari_wa_bidhaa: productSummary.slice(0, 15),
    wateja_muhimu: customerStats.slice(0, 10).map((c) => ({
      jina: c.name, jumla_ununuzi_tsh: c.total, idadi_ununuzi: c.count,
      kiwango: c.level, deni_tsh: c.debt, mwenendo: c.trend, ununuzi_wa_mwisho: c.lastDate,
    })),
    akaunti_za_fedha: accounts.map((a) => ({ jina: a.name, aina: a.type, salio_tsh: accountBalance(a).balance, status: a.status })),
    madeni_wazi: debts.filter((d) => d.status !== 'Imelipwa').slice(0, 15).map((d) => ({ mteja: d.customer, salio_tsh: d.balance, tarehe: d.date })),
    mapendekezo_ya_mfumo: insights.map((i) => i.text),
  }), [mauzoMwezi, faidaMwezi, madeniSasa, idadiWateja, fedhaZilizopo, productSummary, customerStats, accounts, debts, insights]);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, color: C.muted }}>
        Inapakia data...
      </div>
    );
  }

  const NAV = [
    { id: 'dashboard', label: 'Dashibodi', icon: LayoutDashboard },
    { id: 'mauzo', label: 'Mauzo', icon: ShoppingCart },
    { id: 'manunuzi', label: 'Manunuzi', icon: ShoppingBag },
    { id: 'madeni', label: 'Madeni', icon: Wallet },
  ];
  const MORE = [
    { id: 'bidhaa', label: 'Bidhaa', icon: Package },
    { id: 'wateja', label: 'Wateja', icon: Users },
    { id: 'matumizi', label: 'Matumizi', icon: Wallet },
    { id: 'akaunti', label: 'Akaunti', icon: CreditCard },
    { id: 'muhtasari', label: 'Muhtasari', icon: ClipboardList },
    { id: 'msaidizi', label: 'Msaidizi', icon: Bot },
  ];
  const isMore = MORE.some((m) => m.id === tab);

  return (
    <div className="min-h-screen pb-24" style={{ background: C.bg, fontFamily: 'ui-sans-serif, system-ui' }}>
      <div className="px-4 pt-5 pb-4" style={{ background: C.dark }}>
        <div className="max-w-md mx-auto flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center" style={{ background: C.gold }}>
            <img src="/icons/icon-192.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <div className="text-white font-semibold text-base" style={{ fontFamily: 'ui-serif, Georgia' }}>Brilliant Company System</div>
            <div className="text-[11px]" style={{ color: C.goldLight }}>{userEmail}</div>
          </div>
          <button onClick={logout} title="Toka" className="p-2 rounded-lg" style={{ color: C.goldLight }}>
            <LogOut size={17} />
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-1 pt-4">
        {tab === 'dashboard' && (
          <Dashboard {...{ mauzoMwezi, faidaMwezi, madeniSasa, idadiWateja, productSummary, trend, expenseBreakdown, customerStats, insights, fedhaZilizopo }} />
        )}
        {tab === 'mauzo' && (
          <MauzoTab {...{ sales, products, accounts, saveSale, deleteSale, productName, avgBuyPrice }} />
        )}
        {tab === 'manunuzi' && (
          <ManunuziTab {...{ purchases, products, accounts, savePurchase, deletePurchase: (id) => bd.deleteRow('purchases', id), productName }} />
        )}
        {tab === 'madeni' && (
          <MadeniTab {...{ debts, accounts, addManualDebt, payDebt, accountName }} />
        )}
        {tab === 'bidhaa' && (
          <BidhaaTab {...{ products, addProduct, deleteProduct: (id) => bd.deleteRow('products', id), avgBuyPrice, stockQty }} />
        )}
        {tab === 'wateja' && (
          <WatejaTab {...{ customerStats, saveCustomerProfile, idadiWateja, madeniSasa, mauzoMwezi, mauzoMwezLiopita, insights }} />
        )}
        {tab === 'matumizi' && (
          <MatumiziTab {...{
            bizExp: biz_expenses, persExp: personal_expenses, accounts,
            addBiz: (row) => bd.insertRow('biz_expenses', row),
            addPers: (row) => bd.insertRow('personal_expenses', row),
            delBiz: (id) => bd.deleteRow('biz_expenses', id),
            delPers: (id) => bd.deleteRow('personal_expenses', id),
          }} />
        )}
        {tab === 'akaunti' && (
          <AkauntiTab {...{ accounts, accountBalance, saveAccount, deleteAccount }} />
        )}
        {tab === 'muhtasari' && (
          <MuhtasariTab {...{ sales, purchases, bizExp: biz_expenses, persExp: personal_expenses, debts }} />
        )}
        {tab === 'msaidizi' && (
          <AIAssistant context={assistantContext} />
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t" style={{ background: '#fff', borderColor: C.border }}>
        <div className="max-w-md mx-auto flex items-stretch">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = tab === n.id;
            return (
              <button
                key={n.id}
                onClick={() => { setTab(n.id); setMoreOpen(false); }}
                className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px]"
                style={{ color: active ? C.dark : C.muted, fontWeight: active ? 600 : 400 }}
              >
                <Icon size={19} strokeWidth={active ? 2.4 : 2} />
                {n.label}
              </button>
            );
          })}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px]"
            style={{ color: isMore || moreOpen ? C.dark : C.muted, fontWeight: isMore || moreOpen ? 600 : 400 }}
          >
            <Menu size={19} strokeWidth={isMore || moreOpen ? 2.4 : 2} />
            Zaidi
          </button>
        </div>
        {moreOpen && (
          <div className="max-w-md mx-auto border-t px-2 py-2 grid grid-cols-4 gap-1" style={{ borderColor: C.border }}>
            {MORE.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => { setTab(m.id); setMoreOpen(false); }}
                  className="flex flex-col items-center gap-1 py-2 rounded-xl text-[11px]"
                  style={{ background: tab === m.id ? C.sageLight : 'transparent', color: tab === m.id ? C.sage : C.muted }}
                >
                  <Icon size={18} />
                  {m.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- Dashboard ---------------------------------- */
function Dashboard({ mauzoMwezi, faidaMwezi, madeniSasa, idadiWateja, productSummary, trend, expenseBreakdown, customerStats, insights, fedhaZilizopo }) {
  const top5 = customerStats.slice(0, 5);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2.5">
        <StatCard label="Mauzo Mwezi Huu" value={`${fmt(mauzoMwezi)} Tsh`} dark />
        <StatCard label="Faida Mwezi Huu" value={`${fmt(faidaMwezi)} Tsh`} dark />
      </div>
      <div className="flex flex-wrap gap-2.5">
        <StatCard label="Madeni Yanayodaiwa" value={`${fmt(madeniSasa)} Tsh`} accent={C.brick} />
        <StatCard label="Idadi ya Wateja" value={idadiWateja} accent={C.sage} />
      </div>
      <StatCard label="Fedha Zilizopo Kwenye Akaunti" value={`${fmt(fedhaZilizopo)} Tsh`} accent={C.sage} />

      {insights && insights.length > 0 && (
        <div>
          <SectionHeader title="Mapendekezo" sub="Ushauri wa haraka kuhusu wateja wako" />
          <InsightsPanel insights={insights} compact />
          {insights.length > 3 && (
            <div className="text-xs mt-1.5" style={{ color: C.muted }}>+{insights.length - 3} zaidi kwenye tab ya Wateja</div>
          )}
        </div>
      )}

      <div>
        <SectionHeader title="Muhtasari wa Bidhaa" />
        {productSummary.length === 0 ? <EmptyState text="Bado hakuna mauzo yaliyoandikwa." /> : (
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: C.dark, color: '#fff' }}>
                  <th className="text-left px-3 py-2 font-medium">Bidhaa</th>
                  <th className="text-right px-3 py-2 font-medium">Kg</th>
                  <th className="text-right px-3 py-2 font-medium">Mauzo</th>
                  <th className="text-right px-3 py-2 font-medium">Faida</th>
                </tr>
              </thead>
              <tbody>
                {productSummary.map((p, i) => (
                  <tr key={i} style={{ background: i % 2 ? C.bg : '#fff' }}>
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(p.kg)}</td>
                    <td className="px-3 py-2 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(p.mauzo)}</td>
                    <td className="px-3 py-2 text-right font-medium" style={{ color: C.sage, fontVariantNumeric: 'tabular-nums' }}>{fmt(p.faida)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <SectionHeader title="Mwenendo wa Mauzo na Faida" sub="Miezi 6 iliyopita" />
        <div className="rounded-xl p-2" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.muted }} />
              <YAxis tick={{ fontSize: 10, fill: C.muted }} width={40} />
              <Tooltip formatter={(v) => `${fmt(v)} Tsh`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Mauzo" stroke={C.dark} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Faida" stroke={C.gold} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {expenseBreakdown.length > 0 && (
        <div>
          <SectionHeader title="Mgawanyo wa Gharama" sub={`Mwaka ${todayStr().slice(0, 4)}`} />
          <div className="rounded-xl p-2 flex items-center justify-center" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={expenseBreakdown} dataKey="value" nameKey="name" outerRadius={75}>
                  {expenseBreakdown.map((e, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `${fmt(v)} Tsh`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div>
        <SectionHeader title="Wateja Wanaonunua Sana" sub="Top 5" />
        {top5.length === 0 ? <EmptyState text="Bado hakuna wateja." /> : (
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
            {top5.map((c, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2.5 text-sm" style={{ background: i % 2 ? C.bg : '#fff', borderBottom: i < top5.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div>
                  <div className="font-medium">{c.name}</div>
                  <Pill tone={c.level === 'Mteja Mkubwa' ? 'gold' : c.level === 'Mteja Mpya' ? 'sage' : 'brick'}>{c.level}</Pill>
                </div>
                <div className="text-right font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(c.total)} Tsh</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- Mauzo ---------------------------------- */
function MauzoTab({ sales, products, accounts, saveSale, deleteSale, productName, avgBuyPrice }) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const blank = () => ({
    date: todayStr(), customer: '', productId: products[0]?.id || '', qty: '', sellPrice: '',
    buyPrice: '', paymentType: 'Taslimu', newProductName: '', accountId: '',
  });
  const [f, setF] = useState(blank());

  const openNew = () => { setF(blank()); setEditId(null); setOpen(true); };
  const openEdit = (s) => {
    setF({ date: s.date, customer: s.customer, productId: s.product_id, qty: s.qty, sellPrice: s.sell_price, buyPrice: s.buy_price, paymentType: s.payment_type, newProductName: '', accountId: s.account_id || '' });
    setEditId(s.id); setOpen(true);
  };
  const onProductChange = (pid) => setF((v) => ({ ...v, productId: pid, buyPrice: pid !== '__new__' && avgBuyPrice(pid) ? Number(avgBuyPrice(pid)).toFixed(0) : v.buyPrice }));

  const submit = async () => {
    await saveSale(f, editId);
    setOpen(false);
  };

  const sorted = [...sales].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <div className="space-y-4">
      <SectionHeader title="Mauzo" sub="Rekodi ya mauzo yako" action={<PrimaryBtn onClick={openNew}><Plus size={15} /> Ongeza</PrimaryBtn>} />

      {open && (
        <div className="rounded-xl p-4 space-y-1" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
          <div className="flex justify-between items-center mb-2">
            <div className="font-medium text-sm">{editId ? 'Hariri Mauzo' : 'Mauzo Mapya'}</div>
            <IconBtn onClick={() => setOpen(false)}><X size={16} /></IconBtn>
          </div>
          <Field label="Tarehe"><input type="date" style={inputStyle} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Jina la Mteja"><input style={inputStyle} value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} placeholder="mf. Vicent" /></Field>
          <Field label="Bidhaa">
            <select style={inputStyle} value={f.productId} onChange={(e) => onProductChange(e.target.value)}>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="__new__">+ Bidhaa Nyingine...</option>
            </select>
          </Field>
          {f.productId === '__new__' && (
            <Field label="Jina la Bidhaa Mpya"><input style={inputStyle} value={f.newProductName} onChange={(e) => setF({ ...f, newProductName: e.target.value })} placeholder="mf. Mbaazi" /></Field>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Kiasi (kg)"><input type="number" style={inputStyle} value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></Field>
            <Field label="Bei ya Kuuza/kg"><input type="number" style={inputStyle} value={f.sellPrice} onChange={(e) => setF({ ...f, sellPrice: e.target.value })} /></Field>
          </div>
          <Field label="Bei ya Ununuzi/kg (gharama)"><input type="number" style={inputStyle} value={f.buyPrice} onChange={(e) => setF({ ...f, buyPrice: e.target.value })} /></Field>
          <Field label="Aina ya Malipo">
            <select style={inputStyle} value={f.paymentType} onChange={(e) => setF({ ...f, paymentType: e.target.value })}>
              <option>Taslimu</option>
              <option>Deni</option>
            </select>
          </Field>
          {f.paymentType === 'Taslimu' && accounts.length > 0 && (
            <Field label="Fedha Ziliingia Akaunti Gani">
              <select style={inputStyle} value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })}>
                <option value="">— Haijachaguliwa —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          )}
          <div className="text-xs pt-1 pb-2" style={{ color: C.muted }}>
            Jumla ya Mauzo: <b>{fmt(Number(f.qty || 0) * Number(f.sellPrice || 0))} Tsh</b> · Faida: <b>{fmt(Number(f.qty || 0) * Number(f.sellPrice || 0) - Number(f.qty || 0) * Number(f.buyPrice || 0))} Tsh</b>
          </div>
          <PrimaryBtn onClick={submit} style={{ width: '100%', justifyContent: 'center' }}><Check size={15} /> Hifadhi</PrimaryBtn>
        </div>
      )}

      {sorted.length === 0 ? <EmptyState text="Bado hakuna mauzo. Bofya 'Ongeza' kuandika la kwanza." /> : (
        <div className="space-y-2">
          {sorted.map((s) => (
            <div key={s.id} className="rounded-xl p-3 flex justify-between items-start" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
              <div className="text-sm">
                <div className="font-medium">{s.customer} · {productName(s.product_id)}</div>
                <div className="text-xs" style={{ color: C.muted }}>{s.date} · {s.qty}kg × {fmt(s.sell_price)} Tsh</div>
                <div className="flex gap-1.5 mt-1"><Pill tone={s.payment_type === 'Deni' ? 'brick' : 'sage'}>{s.payment_type}</Pill></div>
              </div>
              <div className="text-right">
                <div className="font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(s.total_sale)} Tsh</div>
                <div className="text-xs" style={{ color: C.sage }}>+{fmt(s.profit)} faida</div>
                <div className="flex gap-1 justify-end mt-1">
                  <IconBtn onClick={() => openEdit(s)}><Pencil size={14} /></IconBtn>
                  <IconBtn tone="brick" onClick={() => { if (confirm('Futa mauzo haya?')) deleteSale(s.id); }}><Trash2 size={14} /></IconBtn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Manunuzi ---------------------------------- */
function ManunuziTab({ purchases, products, accounts, savePurchase, deletePurchase, productName }) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const blank = () => ({ date: todayStr(), productId: products[0]?.id || '', qty: '', buyPrice: '', supplier: '', notes: '', newProductName: '', accountId: '' });
  const [f, setF] = useState(blank());

  const openNew = () => { setF(blank()); setEditId(null); setOpen(true); };
  const openEdit = (p) => {
    setF({ date: p.date, productId: p.product_id, qty: p.qty, buyPrice: p.buy_price, supplier: p.supplier || '', notes: p.notes || '', newProductName: '', accountId: p.account_id || '' });
    setEditId(p.id); setOpen(true);
  };

  const submit = async () => {
    await savePurchase(f, editId);
    setOpen(false);
  };

  const sorted = [...purchases].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <div className="space-y-4">
      <SectionHeader title="Manunuzi" sub="Rekodi ya manunuzi ya bidhaa" action={<PrimaryBtn onClick={openNew}><Plus size={15} /> Ongeza</PrimaryBtn>} />

      {open && (
        <div className="rounded-xl p-4 space-y-1" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
          <div className="flex justify-between items-center mb-2">
            <div className="font-medium text-sm">{editId ? 'Hariri Manunuzi' : 'Manunuzi Mapya'}</div>
            <IconBtn onClick={() => setOpen(false)}><X size={16} /></IconBtn>
          </div>
          <Field label="Tarehe"><input type="date" style={inputStyle} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Bidhaa">
            <select style={inputStyle} value={f.productId} onChange={(e) => setF({ ...f, productId: e.target.value })}>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="__new__">+ Bidhaa Nyingine...</option>
            </select>
          </Field>
          {f.productId === '__new__' && (
            <Field label="Jina la Bidhaa Mpya"><input style={inputStyle} value={f.newProductName} onChange={(e) => setF({ ...f, newProductName: e.target.value })} placeholder="mf. Alizeti" /></Field>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Kiasi (kg)"><input type="number" style={inputStyle} value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></Field>
            <Field label="Bei ya Ununuzi/kg"><input type="number" style={inputStyle} value={f.buyPrice} onChange={(e) => setF({ ...f, buyPrice: e.target.value })} /></Field>
          </div>
          <Field label="Muuzaji / Supplier"><input style={inputStyle} value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} placeholder="mf. Juma" /></Field>
          {accounts.length > 0 && (
            <Field label="Fedha Zilitoka Akaunti Gani">
              <select style={inputStyle} value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })}>
                <option value="">— Haijachaguliwa —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Maelezo (Hiari)"><input style={inputStyle} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Maelezo ya ziada..." /></Field>
          <div className="text-xs pt-1 pb-2" style={{ color: C.muted }}>
            Jumla ya Gharama: <b>{fmt(Number(f.qty || 0) * Number(f.buyPrice || 0))} Tsh</b>
          </div>
          <PrimaryBtn onClick={submit} style={{ width: '100%', justifyContent: 'center' }}><Check size={15} /> Hifadhi</PrimaryBtn>
        </div>
      )}

      {sorted.length === 0 ? <EmptyState text="Bado hakuna manunuzi yaliyorekodiwa." /> : (
        <div className="space-y-2">
          {sorted.map((p) => (
            <div key={p.id} className="rounded-xl p-3 flex justify-between items-start" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
              <div className="text-sm">
                <div className="font-medium">{productName(p.product_id)}</div>
                <div className="text-xs" style={{ color: C.muted }}>{p.date} · {p.qty}kg × {fmt(p.buy_price)} Tsh</div>
                {p.supplier && <div className="text-xs mt-0.5" style={{ color: C.muted }}>Muuzaji: {p.supplier}</div>}
              </div>
              <div className="text-right">
                <div className="font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(p.total_cost)} Tsh</div>
                <div className="flex gap-1 justify-end mt-1">
                  <IconBtn onClick={() => openEdit(p)}><Pencil size={14} /></IconBtn>
                  <IconBtn tone="brick" onClick={() => { if (confirm('Futa manunuzi haya?')) deletePurchase(p.id); }}><Trash2 size={14} /></IconBtn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Bidhaa ---------------------------------- */
function BidhaaTab({ products, addProduct, deleteProduct, avgBuyPrice, stockQty }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const submit = async () => {
    if (!name.trim()) return;
    await addProduct(name.trim());
    setName('');
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="Bidhaa" sub="Orodha ya bidhaa zote" action={<PrimaryBtn onClick={() => setOpen(true)}><Plus size={15} /> Ongeza</PrimaryBtn>} />

      {open && (
        <div className="rounded-xl p-4 space-y-2" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
          <div className="flex justify-between items-center mb-1">
            <div className="font-medium text-sm">Bidhaa Mpya</div>
            <IconBtn onClick={() => setOpen(false)}><X size={16} /></IconBtn>
          </div>
          <Field label="Jina la Bidhaa"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="mf. Maharage" /></Field>
          <PrimaryBtn onClick={submit} style={{ width: '100%', justifyContent: 'center' }}><Check size={15} /> Hifadhi</PrimaryBtn>
        </div>
      )}

      {products.length === 0 ? <EmptyState text="Bado hakuna bidhaa zilizosajiliwa." /> : (
        <div className="space-y-2">
          {products.map((p) => {
            const stock = stockQty(p.id);
            const avg = avgBuyPrice(p.id);
            return (
              <div key={p.id} className="rounded-xl p-3 flex justify-between items-center" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
                <div>
                  <div className="font-medium text-sm">{p.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.muted }}>
                    Salio la Stoo: <span className="font-medium" style={{ color: stock > 0 ? C.sage : C.brick }}>{fmt(stock)} kg</span>
                    {avg > 0 && ` · Wastani Bei ya Kununua: ${fmt(avg)} Tsh/kg`}
                  </div>
                </div>
                <IconBtn tone="brick" onClick={() => { if (confirm(`Futa bidhaa ${p.name}?`)) deleteProduct(p.id); }}><Trash2 size={14} /></IconBtn>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Madeni ---------------------------------- */
function MadeniTab({ debts, accounts, addManualDebt, payDebt, accountName }) {
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [targetDebt, setTargetDebt] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payAccountId, setPayAccountId] = useState('');
  const [f, setF] = useState({ date: todayStr(), customer: '', product: '', totalDebt: '', notes: '' });

  const submitManual = async () => {
    if (!f.customer || !f.totalDebt) return;
    await addManualDebt(f);
    setF({ date: todayStr(), customer: '', product: '', totalDebt: '', notes: '' });
    setOpen(false);
  };

  const submitPay = async () => {
    const amt = Number(payAmount);
    if (!targetDebt || amt <= 0) return;
    await payDebt(targetDebt, amt, payAccountId);
    setPayAmount('');
    setPayAccountId('');
    setPayOpen(false);
    setTargetDebt(null);
  };

  const activeDebts = debts.filter((d) => d.status !== 'Imelipwa');
  const paidDebts = debts.filter((d) => d.status === 'Imelipwa');

  return (
    <div className="space-y-4">
      <SectionHeader title="Madeni" sub="Usimamizi wa madeni ya wateja" action={<PrimaryBtn onClick={() => setOpen(true)}><Plus size={15} /> Deni la Nje</PrimaryBtn>} />

      {open && (
        <div className="rounded-xl p-4 space-y-1" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
          <div className="flex justify-between items-center mb-2">
            <div className="font-medium text-sm">Ongeza Deni la Nje (Linaloanzia nje ya mauzo)</div>
            <IconBtn onClick={() => setOpen(false)}><X size={16} /></IconBtn>
          </div>
          <Field label="Tarehe"><input type="date" style={inputStyle} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Jina la Mteja"><input style={inputStyle} value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} placeholder="mf. Baraka" /></Field>
          <Field label="Bidhaa au Maelezo"><input style={inputStyle} value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })} placeholder="mf. Mkopo wa bidhaa" /></Field>
          <Field label="Jumla ya Deni (Tsh)"><input type="number" style={inputStyle} value={f.totalDebt} onChange={(e) => setF({ ...f, totalDebt: e.target.value })} placeholder="mf. 50000" /></Field>
          <PrimaryBtn onClick={submitManual} style={{ width: '100%', justifyContent: 'center' }}><Check size={15} /> Hifadhi</PrimaryBtn>
        </div>
      )}

      {payOpen && targetDebt && (
        <div className="rounded-xl p-4 space-y-2" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
          <div className="flex justify-between items-center mb-1">
            <div className="font-medium text-sm">Lipia Deni: {targetDebt.customer}</div>
            <IconBtn onClick={() => setPayOpen(false)}><X size={16} /></IconBtn>
          </div>
          <div className="text-xs" style={{ color: C.muted }}>Salio linalosalia: <b>{fmt(targetDebt.balance)} Tsh</b></div>
          <Field label="Kiasi kinacholipwa (Tsh)"><input type="number" style={inputStyle} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="mf. 20000" /></Field>
          {accounts.length > 0 && (
            <Field label="Fedha Ziliingia Akaunti Gani">
              <select style={inputStyle} value={payAccountId} onChange={(e) => setPayAccountId(e.target.value)}>
                <option value="">— Haijachaguliwa —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          )}
          <PrimaryBtn onClick={submitPay} style={{ width: '100%', justifyContent: 'center' }}><Check size={15} /> Kamilisha Malipo</PrimaryBtn>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>Madeni Ambayo Hayajalipwa ({activeDebts.length})</div>
        {activeDebts.length === 0 ? <EmptyState text="Hongera! Hakuna madeni ya wateja kwa sasa." /> : (
          <div className="space-y-2">
            {activeDebts.map((d) => (
              <div key={d.id} className="rounded-xl p-3 flex justify-between items-start" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
                <div>
                  <div className="font-medium text-sm">{d.customer}</div>
                  <div className="text-xs" style={{ color: C.muted }}>{d.product || 'Bidhaa'} · Tarehe: {d.date}</div>
                  <div className="flex gap-1.5 mt-1"><Pill tone="brick">Deni: {fmt(d.balance)} Tsh</Pill></div>
                </div>
                <div className="text-right">
                  <div className="text-xs" style={{ color: C.muted }}>Jumla: {fmt(d.total_debt)} Tsh</div>
                  {Number(d.paid_amount || 0) > 0 && <div className="text-xs" style={{ color: C.sage }}>Imelipwa: {fmt(d.paid_amount)} Tsh</div>}
                  <button
                    onClick={() => { setTargetDebt(d); setPayAmount(d.balance); setPayOpen(true); }}
                    className="mt-2 px-2.5 py-1 rounded-lg text-xs font-medium text-white"
                    style={{ background: C.dark }}
                  >
                    Lipia
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {paidDebts.length > 0 && (
        <div className="pt-2">
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>Madeni Yaliyolipwa Kikamilifu ({paidDebts.length})</div>
          <div className="space-y-2">
            {paidDebts.map((d) => (
              <div key={d.id} className="rounded-xl p-3 flex justify-between items-center opacity-75" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                <div>
                  <div className="font-medium text-sm line-through">{d.customer}</div>
                  <div className="text-xs" style={{ color: C.muted }}>{d.product || 'Bidhaa'} · Jumla: {fmt(d.total_debt)} Tsh</div>
                </div>
                <Pill tone="sage">Imelipwa</Pill>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Wateja ---------------------------------- */
function WatejaTab({ customerStats, saveCustomerProfile, idadiWateja, madeniSasa, mauzoMwezi, mauzoMwezLiopita, insights }) {
  const [editCustomer, setEditCustomer] = useState(null);
  const [form, setForm] = useState({ phone: '', location: '', remarks: '', followUpDate: '', followUpNote: '' });

  const openProfile = (c) => {
    setEditCustomer(c);
    setForm({
      phone: c.phone || '',
      location: c.location || '',
      remarks: c.remarks || '',
      followUpDate: c.followUpDate || '',
      followUpNote: c.followUpNote || '',
    });
  };

  const saveProfile = async () => {
    if (!editCustomer) return;
    await saveCustomerProfile(editCustomer.name, {
      phone: form.phone,
      location: form.location,
      remarks: form.remarks,
      follow_up_date: form.followUpDate,
      follow_up_note: form.followUpNote,
    });
    setEditCustomer(null);
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="Wateja" sub="Uchambuzi na taarifa za wateja" />

      {insights && insights.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>Ushauri na Mapendekezo</div>
          <InsightsPanel insights={insights} />
        </div>
      )}

      {editCustomer && (
        <div className="rounded-xl p-4 space-y-2" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
          <div className="flex justify-between items-center mb-1">
            <div className="font-medium text-sm">Taarifa za Mteja: {editCustomer.name}</div>
            <IconBtn onClick={() => setEditCustomer(null)}><X size={16} /></IconBtn>
          </div>
          <Field label="Namba ya Simu"><input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="mf. 0712345678" /></Field>
          <Field label="Eneo / Anwani"><input style={inputStyle} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="mf. Kariakoo" /></Field>
          <Field label="Aina ya Biashara / Maelezo"><input style={inputStyle} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="mf. Anauza rejareja" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tarehe ya Kufuatilia"><input type="date" style={inputStyle} value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} /></Field>
            <Field label="Kumbusho / Ujumbe"><input style={inputStyle} value={form.followUpNote} onChange={(e) => setForm({ ...form, followUpNote: e.target.value })} placeholder="Mpigie simu..." /></Field>
          </div>
          <PrimaryBtn onClick={saveProfile} style={{ width: '100%', justifyContent: 'center' }}><Check size={15} /> Hifadhi Mabadiliko</PrimaryBtn>
        </div>
      )}

      {customerStats.length === 0 ? <EmptyState text="Bado hakuna wateja waliorekodiwa." /> : (
        <div className="space-y-2">
          {customerStats.map((c, i) => (
            <div key={i} className="rounded-xl p-3 flex justify-between items-start" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
              <div className="text-sm">
                <div className="font-medium flex items-center gap-2">
                  {c.name}
                  <Pill tone={c.level === 'Mteja Mkubwa' ? 'gold' : c.level === 'Mteja Mpya' ? 'sage' : 'brick'}>{c.level}</Pill>
                </div>
                <div className="text-xs mt-1" style={{ color: C.muted }}>
                  Manunuzi: <b>{c.count}</b> · Jumla: <b>{fmt(c.total)} Tsh</b>
                  {c.phone && ` · Simu: ${c.phone}`}
                  {c.location && ` · Eneo: ${c.location}`}
                </div>
                {c.debt > 0 && <div className="text-xs mt-0.5" style={{ color: C.brick }}>Ana deni la: {fmt(c.debt)} Tsh</div>}
              </div>
              <IconBtn onClick={() => openProfile(c)}><Pencil size={14} /></IconBtn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Matumizi ---------------------------------- */
function MatumiziTab({ bizExp, persExp, accounts, addBiz, addPers, delBiz, delPers }) {
  const [type, setType] = useState('biz');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ date: todayStr(), category: 'Usafiri', amount: '', notes: '', accountId: '' });

  const submit = async () => {
    if (!f.amount) return;
    const row = { date: f.date, category: f.category, amount: Number(f.amount), notes: f.notes, account_id: f.accountId || null };
    if (type === 'biz') await addBiz(row);
    else await addPers(row);
    setF({ date: todayStr(), category: 'Usafiri', amount: '', notes: '', accountId: '' });
    setOpen(false);
  };

  const combined = [
    ...bizExp.map((e) => ({ ...e, typeLabel: 'Biashara', deleteFn: () => delBiz(e.id) })),
    ...persExp.map((e) => ({ ...e, typeLabel: 'Binafsi', deleteFn: () => delPers(e.id) })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <div className="space-y-4">
      <SectionHeader title="Matumizi" sub="Gharama za biashara na matumizi binafsi" action={<PrimaryBtn onClick={() => setOpen(true)}><Plus size={15} /> Ongeza</PrimaryBtn>} />

      {open && (
        <div className="rounded-xl p-4 space-y-1" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
          <div className="flex justify-between items-center mb-2">
            <div className="font-medium text-sm">Ongeza Matumizi</div>
            <IconBtn onClick={() => setOpen(false)}><X size={16} /></IconBtn>
          </div>
          <Field label="Aina ya Matumizi">
            <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="biz">Gharama za Biashara</option>
              <option value="pers">Matumizi Binafsi</option>
            </select>
          </Field>
          <Field label="Tarehe"><input type="date" style={inputStyle} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Kundi / Kategoria">
            <select style={inputStyle} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              <option>Usafiri</option>
              <option>Chakula</option>
              <option>Pango / Kodi</option>
              <option>Umeme / Maji</option>
              <option>Mishahara</option>
              <option>Vifaa</option>
              <option>Ingineyo</option>
            </select>
          </Field>
          <Field label="Kiasi (Tsh)"><input type="number" style={inputStyle} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="mf. 10000" /></Field>
          {accounts.length > 0 && (
            <Field label="Fedha Zilitoka Akaunti Gani">
              <select style={inputStyle} value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })}>
                <option value="">— Haijachaguliwa —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Maelezo (Hiari)"><input style={inputStyle} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Maelezo ya ziada..." /></Field>
          <PrimaryBtn onClick={submit} style={{ width: '100%', justifyContent: 'center' }}><Check size={15} /> Hifadhi</PrimaryBtn>
        </div>
      )}

      {combined.length === 0 ? <EmptyState text="Bado hakuna matumizi yaliyorekodiwa." /> : (
        <div className="space-y-2">
          {combined.map((e, i) => (
            <div key={i} className="rounded-xl p-3 flex justify-between items-start" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
              <div className="text-sm">
                <div className="font-medium">{e.category} ({e.typeLabel})</div>
                <div className="text-xs" style={{ color: C.muted }}>{e.date} {e.notes ? `· ${e.notes}` : ''}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold" style={{ fontVariantNumeric: 'tabular-nums', color: C.brick }}>-{fmt(e.amount)} Tsh</div>
                <IconBtn tone="brick" onClick={() => { if (confirm('Futa matumizi haya?')) e.deleteFn(); }}><Trash2 size={14} /></IconBtn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Akaunti ---------------------------------- */
function AkauntiTab({ accounts, accountBalance, saveAccount, deleteAccount }) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const blank = () => ({ name: '', type: 'Benki', accountNumber: '', lipaNamba: '', openingBalance: '', status: 'Wazi', notes: '' });
  const [f, setF] = useState(blank());

  const openNew = () => { setF(blank()); setEditId(null); setOpen(true); };
  const openEdit = (a) => {
    setF({ name: a.name, type: a.type || 'Benki', accountNumber: a.account_number || '', lipaNamba: a.lipa_namba || '', openingBalance: a.opening_balance || '', status: a.status || 'Wazi', notes: a.notes || '' });
    setEditId(a.id); setOpen(true);
  };

  const submit = async () => {
    await saveAccount(f, editId);
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="Akaunti za Fedha" sub="Simamia akaunti za benki na mitandao ya simu" action={<PrimaryBtn onClick={openNew}><Plus size={15} /> Ongeza</PrimaryBtn>} />

      {open && (
        <div className="rounded-xl p-4 space-y-1" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
          <div className="flex justify-between items-center mb-2">
            <div className="font-medium text-sm">{editId ? 'Hariri Akaunti' : 'Akaunti Mpya'}</div>
            <IconBtn onClick={() => setOpen(false)}><X size={16} /></IconBtn>
          </div>
          <Field label="Jina la Akaunti"><input style={inputStyle} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="mf. NMB Bank au M-Pesa" /></Field>
          <Field label="Aina">
            <select style={inputStyle} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              <option>Benki</option>
              <option>Simu (M-Pesa/TigoPesa)</option>
              <option>Taslimu (Cash)</option>
            </select>
          </Field>
          <Field label="Namba ya Akaunti / Simu"><input style={inputStyle} value={f.accountNumber} onChange={(e) => setF({ ...f, accountNumber: e.target.value })} placeholder="mf. 0712..." /></Field>
          <Field label="Lipa Namba (Kama ipo)"><input style={inputStyle} value={f.lipaNamba} onChange={(e) => setF({ ...f, lipaNamba: e.target.value })} placeholder="mf. 123456" /></Field>
          <Field label="Salio la Kuanzia (Opening Balance)"><input type="number" style={inputStyle} value={f.openingBalance} onChange={(e) => setF({ ...f, openingBalance: e.target.value })} placeholder="0" /></Field>
          <PrimaryBtn onClick={submit} style={{ width: '100%', justifyContent: 'center' }}><Check size={15} /> Hifadhi</PrimaryBtn>
        </div>
      )}

      {accounts.length === 0 ? <EmptyState text="Bado hakuna akaunti zilizoongezwa." /> : (
        <div className="space-y-2">
          {accounts.map((a) => {
            const { balance, moneyIn, moneyOut } = accountBalance(a);
            return (
              <div key={a.id} className="rounded-xl p-3 flex justify-between items-start" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
                <div className="text-sm">
                  <div className="font-medium">{a.name} ({a.type})</div>
                  <div className="text-xs mt-1" style={{ color: C.muted }}>
                    Zilioingia: <span style={{ color: C.sage }}>+{fmt(moneyIn)}</span> · Zilitoka: <span style={{ color: C.brick }}>-{fmt(moneyOut)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(balance)} Tsh</div>
                  <div className="flex gap-1 justify-end mt-1">
                    <IconBtn onClick={() => openEdit(a)}><Pencil size={14} /></IconBtn>
                    <IconBtn tone="brick" onClick={() => { if (confirm('Futa akaunti hii?')) deleteAccount(a.id); }}><Trash2 size={14} /></IconBtn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Muhtasari ---------------------------------- */
function MuhtasariTab({ sales, purchases, bizExp, persExp, debts }) {
  const totalSales = sales.reduce((s, x) => s + Number(x.total_sale || 0), 0);
  const totalProfit = sales.reduce((s, x) => s + Number(x.profit || 0), 0);
  const totalPurchases = purchases.reduce((s, x) => s + Number(x.total_cost || 0), 0);
  const totalBizExp = bizExp.reduce((s, x) => s + Number(x.amount || 0), 0);
  const totalPersExp = persExp.reduce((s, x) => s + Number(x.amount || 0), 0);
  const totalDebts = debts.filter((d) => d.status !== 'Imelipwa').reduce((s, x) => s + Number(x.balance || 0), 0);

  return (
    <div className="space-y-4">
      <SectionHeader title="Muhtasari wa Jumla" sub="Ripoti kuu ya biashara yako" />
      <div className="rounded-xl p-4 space-y-3" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
        <div className="flex justify-between items-center text-sm border-b pb-2" style={{ borderColor: C.border }}>
          <span style={{ color: C.muted }}>Jumla ya Mauzo</span>
          <span className="font-semibold">{fmt(totalSales)} Tsh</span>
        </div>
        <div className="flex justify-between items-center text-sm border-b pb-2" style={{ borderColor: C.border }}>
          <span style={{ color: C.muted }}>Jumla ya Faida</span>
          <span className="font-semibold" style={{ color: C.sage }}>{fmt(totalProfit)} Tsh</span>
        </div>
        <div className="flex justify-between items-center text-sm border-b pb-2" style={{ borderColor: C.border }}>
          <span style={{ color: C.muted }}>Jumla ya Manunuzi</span>
          <span className="font-semibold">{fmt(totalPurchases)} Tsh</span>
        </div>
        <div className="flex justify-between items-center text-sm border-b pb-2" style={{ borderColor: C.border }}>
          <span style={{ color: C.muted }}>Gharama za Biashara</span>
          <span className="font-semibold" style={{ color: C.brick }}>{fmt(totalBizExp)} Tsh</span>
        </div>
        <div className="flex justify-between items-center text-sm border-b pb-2" style={{ borderColor: C.border }}>
          <span style={{ color: C.muted }}>Matumizi Binafsi</span>
          <span className="font-semibold" style={{ color: C.brick }}>{fmt(totalPersExp)} Tsh</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span style={{ color: C.muted }}>Madeni Yanayodaiwa</span>
          <span className="font-semibold" style={{ color: C.brick }}>{fmt(totalDebts)} Tsh</span>
        </div>
      </div>
    </div>
  );
}