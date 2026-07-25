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
    products = [], sales = [], purchases = [], biz_expenses = [], personal_expenses = [],
    debts = [], customer_profiles = [], accounts = [], loading,
  } = bd;
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
  const ALL_NAV = [...NAV, ...MORE];
  const isMore = MORE.some((m) => m.id === tab);
  const currentLabel = (ALL_NAV.find((n) => n.id === tab) || {}).label || '';

  return (
    <div className="min-h-screen md:flex" style={{ background: C.bg, fontFamily: 'ui-sans-serif, system-ui' }}>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 md:overflow-y-auto"
        style={{ background: C.dark }}
      >
        <div className="flex items-center gap-2 px-5 pt-6 pb-5">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0" style={{ background: C.gold }}>
            <img src="/icons/icon-192.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="text-white font-semibold text-sm leading-tight" style={{ fontFamily: 'ui-serif, Georgia' }}>Brilliant Company System</div>
            <div className="text-[11px] truncate" style={{ color: C.goldLight }}>{userEmail}</div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {ALL_NAV.map((n) => {
            const Icon = n.icon;
            const active = tab === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition"
                style={{
                  background: active ? 'rgba(198,149,46,0.16)' : 'transparent',
                  color: active ? C.gold : C.goldLight,
                  fontWeight: active ? 600 : 400,
                }}
              >
                <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                {n.label}
              </button>
            );
          })}
        </nav>
        <button
          onClick={logout}
          className="flex items-center gap-2 mx-3 mb-5 px-3 py-2.5 rounded-xl text-sm"
          style={{ color: C.goldLight }}
        >
          <LogOut size={18} /> Toka
        </button>
      </aside>

      {/* Main column */}
      <div className="flex-1 md:ml-64 min-w-0 pb-24 md:pb-10">
        {/* Mobile header */}
        <div className="px-4 pt-5 pb-4 md:hidden" style={{ background: C.dark }}>
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

        {/* Desktop top bar */}
        <div className="hidden md:flex items-center justify-between px-10 pt-8 pb-2">
          <h1 className="text-2xl font-semibold" style={{ color: C.text, fontFamily: 'ui-serif, Georgia' }}>{currentLabel}</h1>
        </div>

        <div className="max-w-md mx-auto px-4 -mt-1 pt-4 md:max-w-5xl md:mx-0 md:px-10 md:pt-4">
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

        {/* Mobile bottom nav */}
        <div className="fixed bottom-0 left-0 right-0 border-t md:hidden" style={{ background: '#fff', borderColor: C.border }}>
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
  const openEdit = (p) => { setF({ date: p.date, productId: p.product_id, qty: p.qty, buyPrice: p.buy_price, supplier: p.supplier, notes: p.notes, newProductName: '', accountId: p.account_id || '' }); setEditId(p.id); setOpen(true); };

  const submit = async () => { await savePurchase(f, editId); setOpen(false); };
  const del = (id) => { if (confirm('Futa manunuzi haya?')) deletePurchase(id); };

  const sorted = [...purchases].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <div className="space-y-4">
      <SectionHeader title="Manunuzi" sub="Stock uliyoinunua" action={<PrimaryBtn onClick={openNew}><Plus size={15} /> Ongeza</PrimaryBtn>} />

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
            <Field label="Jina la Bidhaa Mpya"><input style={inputStyle} value={f.newProductName} onChange={(e) => setF({ ...f, newProductName: e.target.value })} placeholder="mf. Mbaazi" /></Field>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Kiasi (kg)"><input type="number" style={inputStyle} value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></Field>
            <Field label="Bei ya Ununuzi/kg"><input type="number" style={inputStyle} value={f.buyPrice} onChange={(e) => setF({ ...f, buyPrice: e.target.value })} /></Field>
          </div>
          <Field label="Msambazaji"><input style={inputStyle} value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} /></Field>
          {accounts.length > 0 && (
            <Field label="Ilipwa Kutoka Akaunti Gani">
              <select style={inputStyle} value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })}>
                <option value="">— Haijachaguliwa —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Maelezo"><input style={inputStyle} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
          <div className="text-xs pt-1 pb-2" style={{ color: C.muted }}>Jumla ya Gharama: <b>{fmt(Number(f.qty || 0) * Number(f.buyPrice || 0))} Tsh</b></div>
          <PrimaryBtn onClick={submit} style={{ width: '100%', justifyContent: 'center' }}><Check size={15} /> Hifadhi</PrimaryBtn>
        </div>
      )}

      {sorted.length === 0 ? <EmptyState text="Bado hakuna manunuzi yaliyoandikwa." /> : (
        <div className="space-y-2">
          {sorted.map((p) => (
            <div key={p.id} className="rounded-xl p-3 flex justify-between items-start" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
              <div className="text-sm">
                <div className="font-medium">{productName(p.product_id)}</div>
                <div className="text-xs" style={{ color: C.muted }}>{p.date} · {p.qty}kg × {fmt(p.buy_price)} Tsh {p.supplier ? `· ${p.supplier}` : ''}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(p.total_cost)} Tsh</div>
                <div className="flex gap-1 justify-end mt-1">
                  <IconBtn onClick={() => openEdit(p)}><Pencil size={14} /></IconBtn>
                  <IconBtn tone="brick" onClick={() => del(p.id)}><Trash2 size={14} /></IconBtn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Madeni ---------------------------------- */
function MadeniTab({ debts, accounts, addManualDebt, payDebt, accountName }) {
  const [open, setOpen] = useState(false);
  const [payId, setPayId] = useState(null);
  const [payAmt, setPayAmt] = useState('');
  const [payAccount, setPayAccount] = useState('');
  const blank = () => ({ date: todayStr(), customer: '', product: '', totalDebt: '', notes: '' });
  const [f, setF] = useState(blank());

  const submitManual = async () => {
    if (!f.customer || !f.totalDebt) return;
    await addManualDebt(f);
    setF(blank()); setOpen(false);
  };
  const submitPayment = async (d) => {
    const amt = Number(payAmt);
    if (!amt || amt <= 0) return;
    await payDebt(d, amt, payAccount);
    setPayId(null); setPayAmt(''); setPayAccount('');
  };

  const sorted = [...debts].sort((a, b) => (a.status === 'Imelipwa') - (b.status === 'Imelipwa') || (b.date || '').localeCompare(a.date || ''));
  const openDebts = debts.filter((d) => d.status !== 'Imelipwa');
  const totalOpen = openDebts.reduce((s, d) => s + Number(d.balance || 0), 0);

  return (
    <div className="space-y-4">
      <SectionHeader title="Madeni" sub={`Jumla ya wanaodaiwa sasa: ${fmt(totalOpen)} Tsh`} action={<PrimaryBtn onClick={() => setOpen((v) => !v)}><Plus size={15} /> Deni</PrimaryBtn>} />

      {open && (
        <div className="rounded-xl p-4 space-y-1" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
          <div className="flex justify-between items-center mb-2">
            <div className="font-medium text-sm">Deni Jipya (nje ya Mauzo)</div>
            <IconBtn onClick={() => setOpen(false)}><X size={16} /></IconBtn>
          </div>
          <Field label="Tarehe"><input type="date" style={inputStyle} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Jina la Mteja"><input style={inputStyle} value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} /></Field>
          <Field label="Bidhaa"><input style={inputStyle} value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })} /></Field>
          <Field label="Jumla ya Deni (Tsh)"><input type="number" style={inputStyle} value={f.totalDebt} onChange={(e) => setF({ ...f, totalDebt: e.target.value })} /></Field>
          <Field label="Maelezo"><input style={inputStyle} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
          <PrimaryBtn onClick={submitManual} style={{ width: '100%', justifyContent: 'center' }}><Check size={15} /> Hifadhi</PrimaryBtn>
        </div>
      )}

      {sorted.length === 0 ? <EmptyState text="Hakuna madeni yaliyorekodiwa." /> : (
        <div className="space-y-2">
          {sorted.map((d) => (
            <div key={d.id} className="rounded-xl p-3" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
              <div className="flex justify-between items-start">
                <div className="text-sm">
                  <div className="font-medium">{d.customer}{d.product ? ` · ${d.product}` : ''}</div>
                  <div className="text-xs" style={{ color: C.muted }}>{d.date}</div>
                  <Pill tone={d.status === 'Imelipwa' ? 'sage' : d.status === 'Sehemu' ? 'gold' : 'brick'}>{d.status}</Pill>
                </div>
                <div className="text-right text-sm">
                  <div>Deni: <b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(d.total_debt)}</b></div>
                  <div style={{ color: C.brick }}>Salio: <b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(d.balance)}</b></div>
                </div>
              </div>
              {d.status !== 'Imelipwa' && (
                payId === d.id ? (
                  <div className="space-y-2 mt-2">
                    <input type="number" style={inputStyle} placeholder="Kiasi kilicholipwa" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} />
                    {accounts.length > 0 && (
                      <select style={inputStyle} value={payAccount} onChange={(e) => setPayAccount(e.target.value)}>
                        <option value="">— Fedha ziliingia akaunti gani (hiari) —</option>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    )}
                    <div className="flex gap-2">
                      <PrimaryBtn onClick={() => submitPayment(d)} style={{ flex: 1, justifyContent: 'center' }}><Check size={14} /> Hifadhi Malipo</PrimaryBtn>
                      <IconBtn onClick={() => { setPayId(null); setPayAmt(''); setPayAccount(''); }}><X size={16} /></IconBtn>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setPayId(d.id)} className="mt-2 text-xs font-medium" style={{ color: C.sage }}>+ Rekodi Malipo</button>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Bidhaa ---------------------------------- */
function BidhaaTab({ products, addProduct, deleteProduct, avgBuyPrice, stockQty }) {
  const [name, setName] = useState('');
  const add = async () => { if (!name.trim()) return; await addProduct(name.trim()); setName(''); };
  const del = (id) => { if (confirm('Futa bidhaa hii?')) deleteProduct(id); };

  return (
    <div className="space-y-4">
      <SectionHeader title="Bidhaa" sub="Simamia bidhaa zako zote" />
      <div className="rounded-xl p-3 flex gap-2" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
        <input style={inputStyle} placeholder="Jina la bidhaa mpya, mf. Mbaazi" value={name} onChange={(e) => setName(e.target.value)} />
        <PrimaryBtn onClick={add}><Plus size={15} /></PrimaryBtn>
      </div>
      <div className="space-y-2">
        {products.map((p) => (
          <div key={p.id} className="rounded-xl p-3 flex justify-between items-center" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
            <div>
              <div className="font-medium text-sm">{p.name}</div>
              <div className="text-xs" style={{ color: C.muted }}>Stock: {fmt(stockQty(p.id))} kg · Wastani wa gharama: {fmt(avgBuyPrice(p.id))} Tsh/kg</div>
            </div>
            <IconBtn tone="brick" onClick={() => del(p.id)}><Trash2 size={14} /></IconBtn>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- Akaunti za Fedha ---------------------------------- */
function AkauntiTab({ accounts, accountBalance, saveAccount, deleteAccount }) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const blank = () => ({ name: '', type: 'Benki', accountNumber: '', lipaNamba: '', openingBalance: '', status: 'Active', notes: '' });
  const [f, setF] = useState(blank());

  const openNew = () => { setF(blank()); setEditId(null); setOpen(true); };
  const openEdit = (a) => {
    setF({ name: a.name, type: a.type, accountNumber: a.account_number || '', lipaNamba: a.lipa_namba || '', openingBalance: a.opening_balance, status: a.status, notes: a.notes || '' });
    setEditId(a.id); setOpen(true);
  };
  const submit = async () => { await saveAccount(f, editId); setOpen(false); };
  const del = (id) => { if (confirm('Futa akaunti hii? Miamala iliyounganishwa nayo haitafutwa.')) deleteAccount(id); };

  const totalBalance = accounts.filter((a) => a.status !== 'Imefungwa').reduce((s, a) => s + accountBalance(a).balance, 0);

  return (
    <div className="space-y-4">
      <SectionHeader title="Akaunti za Fedha" sub={`Jumla ya fedha zilizopo: ${fmt(totalBalance)} Tsh`} action={<PrimaryBtn onClick={openNew}><Plus size={15} /> Akaunti</PrimaryBtn>} />

      {open && (
        <div className="rounded-xl p-4 space-y-1" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
          <div className="flex justify-between items-center mb-2">
            <div className="font-medium text-sm">{editId ? 'Hariri Akaunti' : 'Akaunti Mpya'}</div>
            <IconBtn onClick={() => setOpen(false)}><X size={16} /></IconBtn>
          </div>
          <Field label="Jina la Akaunti"><input style={inputStyle} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="mf. CRDB Bank, M-Pesa" /></Field>
          <Field label="Aina">
            <select style={inputStyle} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              <option>Benki</option>
              <option>Simu</option>
              <option>Taslimu</option>
            </select>
          </Field>
          <Field label="Namba ya Akaunti (Benki)"><input style={inputStyle} value={f.accountNumber} onChange={(e) => setF({ ...f, accountNumber: e.target.value })} placeholder="mf. 0150XXXXXXX" /></Field>
          <Field label="Lipa Namba (Simu)"><input style={inputStyle} value={f.lipaNamba} onChange={(e) => setF({ ...f, lipaNamba: e.target.value })} placeholder="mf. 400XXX" /></Field>
          <Field label="Salio la Kuanzia (Tsh)"><input type="number" style={inputStyle} value={f.openingBalance} onChange={(e) => setF({ ...f, openingBalance: e.target.value })} /></Field>
          <Field label="Status">
            <select style={inputStyle} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="Active">Active</option>
              <option value="Imefungwa">Imefungwa</option>
            </select>
          </Field>
          <Field label="Maelezo"><input style={inputStyle} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
          <PrimaryBtn onClick={submit} style={{ width: '100%', justifyContent: 'center' }}><Check size={15} /> Hifadhi</PrimaryBtn>
        </div>
      )}

      {accounts.length === 0 ? <EmptyState text="Bado hakuna akaunti. Ongeza benki au namba ya simu unayotumia." /> : (
        <div className="space-y-2">
          {accounts.map((a) => {
            const { balance, moneyIn, moneyOut } = accountBalance(a);
            return (
              <div key={a.id} className="rounded-xl p-3" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-sm">{a.name}</div>
                    <div className="text-xs" style={{ color: C.muted }}>
                      {a.type}{a.account_number ? ` · Acc: ${a.account_number}` : ''}{a.lipa_namba ? ` · Lipa Namba: ${a.lipa_namba}` : ''}
                    </div>
                    <div className="mt-1"><Pill tone={a.status === 'Active' ? 'sage' : 'brick'}>{a.status}</Pill></div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wide" style={{ color: C.muted }}>Salio</div>
                    <div className="font-semibold" style={{ fontVariantNumeric: 'tabular-nums', color: balance < 0 ? C.brick : C.text }}>{fmt(balance)} Tsh</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs mt-2" style={{ color: C.muted }}>
                  <div>Fedha Zilizoingia: <b style={{ color: C.sage }}>{fmt(moneyIn)}</b></div>
                  <div>Matumizi Yaliyotumika: <b style={{ color: C.brick }}>{fmt(moneyOut)}</b></div>
                </div>
                <div className="flex gap-1 justify-end mt-2">
                  <IconBtn onClick={() => openEdit(a)}><Pencil size={14} /></IconBtn>
                  <IconBtn tone="brick" onClick={() => del(a.id)}><Trash2 size={14} /></IconBtn>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Wateja ---------------------------------- */
function WatejaTab({ customerStats, saveCustomerProfile, idadiWateja, madeniSasa, mauzoMwezi, mauzoMwezLiopita, insights }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ phone: '', location: '', follow_up_date: '', follow_up_note: '', remarks: '' });
  const [addOpen, setAddOpen] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', phone: '', location: '' });

  const trendIcon = (t) => t === 'up' ? <TrendingUp size={13} color={C.sage} /> : t === 'down' ? <TrendingDown size={13} color={C.brick} /> : <Minus size={13} color={C.muted} />;
  const salesChangePct = mauzoMwezLiopita > 0 ? Math.round(((mauzoMwezi - mauzoMwezLiopita) / mauzoMwezLiopita) * 100) : (mauzoMwezi > 0 ? 100 : 0);

  const startEdit = (c) => {
    setEditing(c.name);
    setForm({ phone: c.phone || '', location: c.location || '', follow_up_date: c.followUpDate || '', follow_up_note: c.followUpNote || '', remarks: c.remarks || '' });
  };
  const saveProfile = async (name) => { await saveCustomerProfile(name, form); setEditing(null); };
  const addCustomer = async () => {
    if (!newCust.name.trim()) return;
    await saveCustomerProfile(newCust.name.trim(), { phone: newCust.phone, location: newCust.location });
    setNewCust({ name: '', phone: '', location: '' });
    setAddOpen(false);
  };

  const todayIso = todayStr();

  return (
    <div className="space-y-4">
      <SectionHeader title="Wateja" sub="Taarifa na mwenendo wa manunuzi ya wateja wako" action={<PrimaryBtn onClick={() => setAddOpen((v) => !v)}><Plus size={15} /> Mteja</PrimaryBtn>} />

      <div className="flex flex-wrap gap-2.5">
        <StatCard label="Idadi ya Wateja" value={idadiWateja} accent={C.sage} />
        <StatCard label="Jumla ya Madeni" value={`${fmt(madeniSasa)} Tsh`} accent={C.brick} />
      </div>
      <div className="rounded-2xl px-4 py-3 flex items-center justify-between" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
        <div>
          <div className="text-[11px] uppercase tracking-wide" style={{ color: C.muted }}>Mwenendo wa Mauzo</div>
          <div className="text-sm mt-0.5" style={{ color: C.muted }}>Mwezi huu dhidi ya mwezi uliopita</div>
        </div>
        <div className="flex items-center gap-1.5 font-semibold" style={{ color: salesChangePct > 0 ? C.sage : salesChangePct < 0 ? C.brick : C.muted }}>
          {salesChangePct > 0 ? <TrendingUp size={16} /> : salesChangePct < 0 ? <TrendingDown size={16} /> : <Minus size={16} />}
          {salesChangePct > 0 ? '+' : ''}{salesChangePct}%
        </div>
      </div>

      {insights && insights.length > 0 && (
        <div>
          <SectionHeader title="Mapendekezo" sub="Yanajikokotoa moja kwa moja kutoka kwenye mauzo na madeni" />
          <InsightsPanel insights={insights} />
        </div>
      )}

      {addOpen && (
        <div className="rounded-xl p-4 space-y-1" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
          <div className="flex justify-between items-center mb-2">
            <div className="font-medium text-sm">Mteja Mpya</div>
            <IconBtn onClick={() => setAddOpen(false)}><X size={16} /></IconBtn>
          </div>
          <Field label="Jina la Mteja"><input style={inputStyle} value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} /></Field>
          <Field label="Namba ya Simu"><input style={inputStyle} value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} placeholder="07XX XXX XXX" /></Field>
          <Field label="Location ya Biashara"><input style={inputStyle} value={newCust.location} onChange={(e) => setNewCust({ ...newCust, location: e.target.value })} placeholder="mf. Kariakoo, Dar" /></Field>
          <PrimaryBtn onClick={addCustomer} style={{ width: '100%', justifyContent: 'center' }}><Check size={15} /> Hifadhi</PrimaryBtn>
        </div>
      )}

      {customerStats.length === 0 ? <EmptyState text="Bado hakuna wateja. Wataonekana hapa mara utakapoandika mauzo, au ongeza mwenyewe." /> : (
        <div className="space-y-2">
          {customerStats.map((c) => {
            const needsFollowUp = c.followUpDate && c.followUpDate <= todayIso;
            return (
              <div key={c.name} className="rounded-xl p-3" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-sm">{c.name}</div>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      <Pill tone={c.level === 'Mteja Mkubwa' ? 'gold' : c.level === 'Mteja Mpya' ? 'sage' : 'brick'}>{c.level}</Pill>
                      {c.debt > 0 && <Pill tone="brick">Deni {fmt(c.debt)}</Pill>}
                      {needsFollowUp && <Pill tone="gold">Fuatilia Leo</Pill>}
                    </div>
                  </div>
                  <div className="text-right text-xs" style={{ color: C.muted }}>
                    <div>Ununuzi: <b style={{ color: C.text }}>{c.count}</b></div>
                    <div>Jumla: <b style={{ color: C.text }}>{fmt(c.total)}</b></div>
                    <div className="flex items-center gap-1 justify-end">Mwenendo {trendIcon(c.trend)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs mt-2" style={{ color: C.muted }}>
                  <div>Simu: {c.phone || '—'}</div>
                  <div>Location: {c.location || '—'}</div>
                  <div>Ununuzi wa mwisho: {c.lastDate || '—'}</div>
                  <div>Ufuatiliaji: {c.followUpDate || '—'}</div>
                </div>
                {c.followUpNote && <div className="text-xs mt-1 italic" style={{ color: C.muted }}>"{c.followUpNote}"</div>}
                {c.remarks && <div className="text-xs mt-1" style={{ color: C.text }}>Maoni: {c.remarks}</div>}

                {editing === c.name ? (
                  <div className="space-y-1 mt-2 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
                    <Field label="Namba ya Simu"><input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                    <Field label="Location ya Biashara"><input style={inputStyle} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
                    <Field label="Tarehe ya Kufuatilia"><input type="date" style={inputStyle} value={form.follow_up_date} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} /></Field>
                    <Field label="Kumbukumbu ya Ufuatiliaji"><input style={inputStyle} value={form.follow_up_note} onChange={(e) => setForm({ ...form, follow_up_note: e.target.value })} placeholder="mf. Piga simu wiki ijayo" /></Field>
                    <Field label="Maoni"><input style={inputStyle} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></Field>
                    <div className="flex gap-2">
                      <PrimaryBtn onClick={() => saveProfile(c.name)} style={{ flex: 1, justifyContent: 'center' }}><Check size={14} /> Hifadhi</PrimaryBtn>
                      <IconBtn onClick={() => setEditing(null)}><X size={16} /></IconBtn>
                    </div>
                  </div>
                ) : (
                  <button className="text-xs mt-2 font-medium" style={{ color: C.sage }} onClick={() => startEdit(c)}>Hariri Taarifa za Mteja</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Matumizi ---------------------------------- */
function MatumiziTab({ bizExp, persExp, accounts, addBiz, addPers, delBiz, delPers }) {
  const [sub, setSub] = useState('biashara');
  const list = sub === 'biashara' ? bizExp : persExp;
  const [open, setOpen] = useState(false);
  const blank = () => (sub === 'biashara' ? { date: todayStr(), type: '', description: '', amount: '', accountId: '' } : { date: todayStr(), description: '', amount: '', accountId: '' });
  const [f, setF] = useState(blank());

  const openNew = () => { setF(blank()); setOpen(true); };
  const submit = async () => {
    if (!f.amount) return;
    const { accountId, ...rest } = f;
    const row = { ...rest, amount: Number(f.amount), account_id: accountId || null };
    if (sub === 'biashara') await addBiz(row); else await addPers(row);
    setOpen(false);
  };
  const del = (id) => { if (sub === 'biashara') delBiz(id); else delPers(id); };
  const sorted = [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const total = list.reduce((s, x) => s + Number(x.amount || 0), 0);

  return (
    <div className="space-y-4">
      <SectionHeader title="Matumizi" sub={`Jumla: ${fmt(total)} Tsh`} action={<PrimaryBtn onClick={openNew}><Plus size={15} /> Ongeza</PrimaryBtn>} />
      <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
        {[['biashara', 'Gharama za Biashara'], ['binafsi', 'Matumizi Binafsi']].map(([k, label]) => (
          <button key={k} onClick={() => { setSub(k); setOpen(false); }} className="flex-1 py-2 text-xs font-medium" style={{ background: sub === k ? C.dark : '#fff', color: sub === k ? '#fff' : C.muted }}>{label}</button>
        ))}
      </div>

      {open && (
        <div className="rounded-xl p-4 space-y-1" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
          <div className="flex justify-between items-center mb-2">
            <div className="font-medium text-sm">Andika {sub === 'biashara' ? 'Gharama ya Biashara' : 'Matumizi Binafsi'}</div>
            <IconBtn onClick={() => setOpen(false)}><X size={16} /></IconBtn>
          </div>
          <Field label="Tarehe"><input type="date" style={inputStyle} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          {sub === 'biashara' && <Field label="Aina ya Gharama"><input style={inputStyle} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} placeholder="mf. Nauli, Vifungashio" /></Field>}
          <Field label="Maelezo"><input style={inputStyle} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Kiasi (Tsh)"><input type="number" style={inputStyle} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          {accounts.length > 0 && (
            <Field label="Ilipwa Kutoka Akaunti Gani">
              <select style={inputStyle} value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })}>
                <option value="">— Haijachaguliwa —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          )}
          <PrimaryBtn onClick={submit} style={{ width: '100%', justifyContent: 'center' }}><Check size={15} /> Hifadhi</PrimaryBtn>
        </div>
      )}

      {sorted.length === 0 ? <EmptyState text="Hakuna kilichoandikwa bado." /> : (
        <div className="space-y-2">
          {sorted.map((x) => (
            <div key={x.id} className="rounded-xl p-3 flex justify-between items-center" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
              <div className="text-sm">
                <div className="font-medium">{x.description || x.type || '—'}</div>
                <div className="text-xs" style={{ color: C.muted }}>{x.date}{x.type ? ` · ${x.type}` : ''}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(x.amount)} Tsh</div>
                <IconBtn tone="brick" onClick={() => del(x.id)}><Trash2 size={14} /></IconBtn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Muhtasari ---------------------------------- */
function MuhtasariTab({ sales, purchases, bizExp, persExp, debts }) {
  const [period, setPeriod] = useState('mwezi');

  const rows = useMemo(() => {
    const keyFn = period === 'wiki' ? weekKey : period === 'mwezi' ? monthKey : period === 'robo' ? quarterKey : (d) => (d || '').slice(0, 4);
    const buckets = {};
    const touch = (k) => { if (!buckets[k]) buckets[k] = { key: k, mauzo: 0, gManunuzi: 0, gBiashara: 0, binafsi: 0, madeniMapya: 0 }; return buckets[k]; };
    sales.forEach((s) => { touch(keyFn(s.date)).mauzo += Number(s.total_sale || 0); });
    purchases.forEach((p) => { touch(keyFn(p.date)).gManunuzi += Number(p.total_cost || 0); });
    bizExp.forEach((e) => { touch(keyFn(e.date)).gBiashara += Number(e.amount || 0); });
    persExp.forEach((e) => { touch(keyFn(e.date)).binafsi += Number(e.amount || 0); });
    debts.forEach((d) => { touch(keyFn(d.date)).madeniMapya += Number(d.total_debt || 0); });
    return Object.values(buckets)
      .sort((a, b) => b.key.localeCompare(a.key))
      .slice(0, 12)
      .map((b) => ({ ...b, faida: b.mauzo - b.gManunuzi - b.gBiashara, akiba: b.mauzo - b.gManunuzi - b.gBiashara - b.binafsi }));
  }, [period, sales, purchases, bizExp, persExp, debts]);

  const periodLabel = { wiki: 'Wiki (Jumatatu inayoanzia)', mwezi: 'Mwezi', robo: 'Robo Mwaka', mwaka: 'Mwaka' };

  return (
    <div className="space-y-4">
      <SectionHeader title="Muhtasari" sub="Inajikokotoa moja kwa moja kutoka kwenye data yako" />
      <div className="flex gap-1.5 flex-wrap">
        {['wiki', 'mwezi', 'robo', 'mwaka'].map((p) => (
          <button key={p} onClick={() => setPeriod(p)} className="px-3 py-1.5 rounded-full text-xs font-medium capitalize" style={{ background: period === p ? C.dark : '#fff', color: period === p ? '#fff' : C.muted, border: `1px solid ${C.border}` }}>{p}</button>
        ))}
      </div>
      {rows.length === 0 ? <EmptyState text="Bado hakuna data ya kutosha kuonyesha muhtasari." /> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="rounded-xl p-3" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
              <div className="text-xs font-medium mb-1.5" style={{ color: C.muted }}>{periodLabel[period]}: {period === 'mwezi' ? monthLabel(r.key) : r.key}</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div>Mauzo Jumla: <b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(r.mauzo)}</b></div>
                <div>Gharama Manunuzi: <b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(r.gManunuzi)}</b></div>
                <div>Gharama Biashara: <b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(r.gBiashara)}</b></div>
                <div>Matumizi Binafsi: <b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(r.binafsi)}</b></div>
                <div style={{ color: C.sage }}>Faida Halisi: <b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(r.faida)}</b></div>
                <div style={{ color: C.gold }}>Akiba Inayowezekana: <b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(r.akiba)}</b></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
