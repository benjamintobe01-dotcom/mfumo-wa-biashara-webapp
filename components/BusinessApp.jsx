const submit = async () => {
    await savePurchase(f, editId);
    setOpen(false);
  };

  const sorted = [...purchases].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <div className="space-y-4">
      <SectionHeader title="Manunuzi" sub="Rekodi ya bidhaa ulizonunua au kuweka stoku" action={<PrimaryBtn onClick={openNew}><Plus size={15} /> Ongeza</PrimaryBtn>} />

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
            <Field label="Jina la Bidhaa Mpya"><input style={inputStyle} value={f.newProductName} onChange={(e) => setF({ ...f, newProductName: e.target.value })} placeholder="mf. Dengu" /></Field>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Kiasi (kg)"><input type="number" style={inputStyle} value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></Field>
            <Field label="Bei ya Ununuzi/kg"><input type="number" style={inputStyle} value={f.buyPrice} onChange={(e) => setF({ ...f, buyPrice: e.target.value })} /></Field>
          </div>
          <Field label="Muuzaji / Chanzo"><input style={inputStyle} value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} placeholder="mf. Soko Kuu" /></Field>
          {accounts.length > 0 && (
            <Field label="Fedha Zimetoka Akaunti Gani">
              <select style={inputStyle} value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })}>
                <option value="">— Haijachaguliwa —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Maelezo (Hiari)"><input style={inputStyle} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Maelezo zaidi..." /></Field>
          <div className="text-xs pt-1 pb-2" style={{ color: C.muted }}>
            Jumla ya Gharama: <b>{fmt(Number(f.qty || 0) * Number(f.buyPrice || 0))} Tsh</b>
          </div>
          <PrimaryBtn onClick={submit} style={{ width: '100%', justifyContent: 'center' }}><Check size={15} /> Hifadhi</PrimaryBtn>
        </div>
      )}

      {sorted.length === 0 ? <EmptyState text="Bado hakuna manunuzi yaliyoandikwa." /> : (
        <div className="space-y-2">
          {sorted.map((p) => (
            <div key={p.id} className="rounded-xl p-3 flex justify-between items-start" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
              <div className="text-sm">
                <div className="font-medium">{productName(p.product_id)} {p.supplier ? `· ${p.supplier}` : ''}</div>
                <div className="text-xs" style={{ color: C.muted }}>{p.date} · {p.qty}kg × {fmt(p.buy_price)} Tsh</div>
                {p.notes && <div className="text-xs mt-0.5" style={{ color: C.muted }}>{p.notes}</div>}
              </div>
              <div className="text-right">
                <div className="font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(p.total_cost)} Tsh</div>
                <div className="flex gap-1 justify-end mt-1">
                  <IconBtn onClick={() => { setF({ date: p.date, productId: p.product_id, qty: p.qty, buyPrice: p.buy_price, supplier: p.supplier || '', notes: p.notes || '', newProductName: '', accountId: p.account_id || '' }); setEditId(p.id); setOpen(true); }}><Pencil size={14} /></IconBtn>
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

/* ---------------------------------- Madeni ---------------------------------- */
function MadeniTab({ debts, accounts, addManualDebt, payDebt, accountName }) {
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payAccount, setPayAccount] = useState('');
  const blank = () => ({ date: todayStr(), customer: '', product: '', totalDebt: '', notes: '' });
  const [f, setF] = useState(blank());

  const submitManual = async () => {
    if (!f.customer.trim() || !f.totalDebt) return;
    await addManualDebt(f);
    setF(blank());
    setOpen(false);
  };

  const handlePay = async () => {
    const amt = Number(payAmount);
    if (!selectedDebt || !amt || amt <= 0) return;
    await payDebt(selectedDebt, amt, payAccount);
    setPayOpen(false);
    setSelectedDebt(null);
    setPayAmount('');
    setPayAccount('');
  };

  const activeDebts = debts.filter((d) => d.status !== 'Imelipwa');
  const paidDebts = debts.filter((d) => d.status === 'Imelipwa');

  return (
    <div className="space-y-4">
      <SectionHeader title="Madeni ya Wateja" sub="Simamia madeni na malipo" action={<PrimaryBtn onClick={() => setOpen(true)}><Plus size={15} /> Ongeza Deni</PrimaryBtn>} />

      {open && (
        <div className="rounded-xl p-4 space-y-1" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
          <div className="flex justify-between items-center mb-2">
            <div className="font-medium text-sm">Ongeza Deni la Nje</div>
            <IconBtn onClick={() => setOpen(false)}><X size={16} /></IconBtn>
          </div>
          <Field label="Tarehe"><input type="date" style={inputStyle} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Jina la Mteja"><input style={inputStyle} value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} placeholder="mf. Asha" /></Field>
          <Field label="Bidhaa (Hiari)"><input style={inputStyle} value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })} placeholder="mf. Mchele" /></Field>
          <Field label="Jumla ya Deni (Tsh)"><input type="number" style={inputStyle} value={f.totalDebt} onChange={(e) => setF({ ...f, totalDebt: e.target.value })} /></Field>
          <Field label="Maelezo"><input style={inputStyle} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Maelezo..." /></Field>
          <PrimaryBtn onClick={submitManual} style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}><Check size={15} /> Hifadhi Deni</PrimaryBtn>
        </div>
      )}

      {payOpen && selectedDebt && (
        <div className="rounded-xl p-4 space-y-1" style={{ background: C.sageLight, border: `1px solid ${C.sage}` }}>
          <div className="flex justify-between items-center mb-2">
            <div className="font-medium text-sm" style={{ color: C.dark }}>Pokea Malipo kutoka kwa {selectedDebt.customer}</div>
            <IconBtn onClick={() => setPayOpen(false)}><X size={16} /></IconBtn>
          </div>
          <div className="text-xs mb-2" style={{ color: C.muted }}>Salio linalodaiwa: <b>{fmt(selectedDebt.balance)} Tsh</b></div>
          <Field label="Kiasi kinacholipwa (Tsh)"><input type="number" style={inputStyle} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="mf. 50000" /></Field>
          {accounts.length > 0 && (
            <Field label="Fedha Zimeingia Akaunti Gani">
              <select style={inputStyle} value={payAccount} onChange={(e) => setPayAccount(e.target.value)}>
                <option value="">— Chagua Akaunti —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          )}
          <PrimaryBtn onClick={handlePay} style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}><Check size={15} /> Thibitisha Malipo</PrimaryBtn>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>Madeni Wazi ({activeDebts.length})</div>
        {activeDebts.length === 0 ? <EmptyState text="Hongera! Hakuna madeni wazi kwa sasa." /> : (
          <div className="space-y-2">
            {activeDebts.map((d) => (
              <div key={d.id} className="rounded-xl p-3 flex justify-between items-start" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
                <div>
                  <div className="font-medium text-sm">{d.customer}</div>
                  <div className="text-xs" style={{ color: C.muted }}>{d.product ? `${d.product} · ` : ''}{d.date}</div>
                  {Number(d.paid_amount || 0) > 0 && (
                    <div className="text-xs mt-0.5" style={{ color: C.sage }}>Imelipwa: {fmt(d.paid_amount)} Tsh</div>
                  )}
                  {d.account_id && (
                    <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>Akaunti: {accountName(d.account_id)}</div>
                  )}
                  <div className="mt-1.5"><Pill tone={d.status === 'Sehemu' ? 'gold' : 'brick'}>{d.status}</Pill></div>
                </div>
                <div className="text-right flex flex-col items-end">
                  <div className="font-semibold text-sm" style={{ color: C.brick, fontVariantNumeric: 'tabular-nums' }}>{fmt(d.balance)} Tsh</div>
                  <div className="text-[11px]" style={{ color: C.muted }}>Jumla: {fmt(d.total_debt)}</div>
                  <button
                    onClick={() => { setSelectedDebt(d); setPayAmount(d.balance); setPayAccount(d.account_id || accounts[0]?.id || ''); setPayOpen(true); }}
                    className="mt-2 px-2.5 py-1 rounded-lg text-xs font-medium text-white flex items-center gap-1"
                    style={{ background: C.dark }}
                  >
                    Pokea Malipo
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {paidDebts.length > 0 && (
        <div className="mt-6">
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>Madeni Yaliyolipwa Yote ({paidDebts.length})</div>
          <div className="space-y-2">
            {paidDebts.map((d) => (
              <div key={d.id} className="rounded-xl p-3 flex justify-between items-start opacity-75" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
                <div>
                  <div className="font-medium text-sm line-through">{d.customer}</div>
                  <div className="text-xs" style={{ color: C.muted }}>{d.date} · Imelipwa kikamilifu</div>
                  <div className="mt-1"><Pill tone="sage">Imelipwa</Pill></div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-sm" style={{ fontVariantNumeric: 'tabular-nums', color: C.sage }}>{fmt(d.total_debt)} Tsh</div>
                </div>
              </div>
            ))}
          </div>
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
      <SectionHeader title="Bidhaa" sub="Orodha ya bidhaa unazouza" action={<PrimaryBtn onClick={() => setOpen(true)}><Plus size={15} /> Ongeza Bidhaa</PrimaryBtn>} />

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
            const stq = stockQty(p.id);
            const abp = avgBuyPrice(p.id);
            return (
              <div key={p.id} className="rounded-xl p-3 flex justify-between items-center" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
                <div>
                  <div className="font-medium text-sm">{p.name}</div>
                  <div className="text-xs" style={{ color: C.muted }}>
                    Stoku: <b style={{ color: stq < 0 ? C.brick : C.dark }}>{fmt(stq)} kg</b>
                    {abp > 0 ? ` · Wastani wa ununuzi: ${fmt(abp)} Tsh/kg` : ''}
                  </div>
                </div>
                <div className="flex gap-1">
                  <IconBtn tone="brick" onClick={() => { if (confirm(`Futa bidhaa ${p.name}?`)) deleteProduct(p.id); }}><Trash2 size={14} /></IconBtn>
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
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [remarks, setRemarks] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');

  const openProfile = (c) => {
    setSelectedCustomer(c);
    setPhone(c.phone || '');
    setLocation(c.location || '');
    setRemarks(c.remarks || '');
    setFollowUpDate(c.followUpDate || '');
    setFollowUpNote(c.followUpNote || '');
  };

  const saveProfile = async () => {
    if (!selectedCustomer) return;
    await saveCustomerProfile(selectedCustomer.name, {
      phone, location, remarks, follow_up_date: followUpDate, follow_up_note: followUpNote,
    });
    setSelectedCustomer(null);
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="Wateja" sub="Uchambuzi na maelezo ya wateja" />

      {insights && insights.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.muted }}>Ushauri wa Mfumo</div>
          <InsightsPanel insights={insights} />
        </div>
      )}

      {selectedCustomer && (
        <div className="rounded-xl p-4 space-y-2" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
          <div className="flex justify-between items-center mb-1">
            <div className="font-medium text-sm">Taarifa za Mteja: {selectedCustomer.name}</div>
            <IconBtn onClick={() => setSelectedCustomer(null)}><X size={16} /></IconBtn>
          </div>
          <div className="text-xs" style={{ color: C.muted }}>
            Jumla ya Ununuzi: <b>{fmt(selectedCustomer.total)} Tsh</b> ({selectedCustomer.count} mara) · Deni: <b style={{ color: C.brick }}>{fmt(selectedCustomer.debt)} Tsh</b>
          </div>
          <Field label="Namba ya Simu"><input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="mf. 0712345678" /></Field>
          <Field label="Mahali / Eneo"><input style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="mf. Kariakoo" /></Field>
          <Field label="Maoni kuhusu Mteja"><input style={inputStyle} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="mf. Anapenda bidhaa zenye ubora mzuri" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tarehe ya Kufuatilia"><input type="date" style={inputStyle} value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} /></Field>
            <Field label="Ujumbe wa Kufuatilia"><input style={inputStyle} value={followUpNote} onChange={(e) => setFollowUpNote(e.target.value)} placeholder="mf. Piga simu kuuliza kama mzigo ulishuka" /></Field>
          </div>
          <PrimaryBtn onClick={saveProfile} style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}><Check size={15} /> Hifadhi Taarifa</PrimaryBtn>
        </div>
      )}

      {customerStats.length === 0 ? <EmptyState text="Bado hakuna wateja waliorekodiwa." /> : (
        <div className="space-y-2">
          {customerStats.map((c, i) => (
            <div key={i} onClick={() => openProfile(c)} className="rounded-xl p-3 cursor-pointer flex justify-between items-center" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
              <div>
                <div className="font-medium text-sm flex items-center gap-2">
                  {c.name}
                  {c.trend === 'up' && <TrendingUp size={14} style={{ color: C.sage }} />}
                  {c.trend === 'down' && <TrendingDown size={14} style={{ color: C.brick }} />}
                </div>
                <div className="text-xs mt-0.5" style={{ color: C.muted }}>
                  {c.count} mauzo · Jumla: {fmt(c.total)} Tsh
                  {c.debt > 0 ? ` · Anadaiwa: ${fmt(c.debt)} Tsh` : ''}
                </div>
                <div className="flex gap-1.5 mt-1">
                  <Pill tone={c.level === 'Mteja Mkubwa' ? 'gold' : c.level === 'Mteja Mpya' ? 'sage' : 'brick'}>{c.level}</Pill>
                  {c.phone && <Pill tone="sage">{c.phone}</Pill>}
                </div>
              </div>
              <div className="text-right">
                <Pencil size={15} style={{ color: C.muted }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Matumizi ---------------------------------- */
function MatumiziTab({ bizExp, persExp, accounts, addBiz, addPers, delBiz, delPers }) {
  const [tabType, setTabType] = useState('biz');
  const [open, setOpen] = useState(false);
  const blank = () => ({ date: todayStr(), category: '', amount: '', notes: '', accountId: '' });
  const [f, setF] = useState(blank());

  const submit = async () => {
    if (!f.category.trim() || !f.amount) return;
    const row = { date: f.date, category: f.category.trim(), amount: Number(f.amount), notes: f.notes, account_id: f.accountId || null };
    if (tabType === 'biz') await addBiz(row);
    else await addPers(row);
    setF(blank());
    setOpen(false);
  };

  const currentList = tabType === 'biz' ? bizExp : persExp;
  const sorted = [...currentList].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setTabType('biz')}
          className="flex-1 py-2 rounded-xl text-xs font-semibold"
          style={{ background: tabType === 'biz' ? C.dark : C.paper, color: tabType === 'biz' ? '#fff' : C.muted, border: `1px solid ${C.border}` }}
        >
          Gharama za Biashara
        </button>
        <button
          onClick={() => setTabType('pers')}
          className="flex-1 py-2 rounded-xl text-xs font-semibold"
          style={{ background: tabType === 'pers' ? C.dark : C.paper, color: tabType === 'pers' ? '#fff' : C.muted, border: `1px solid ${C.border}` }}
        >
          Matumizi Binafsi
        </button>
      </div>

      <SectionHeader
        title={tabType === 'biz' ? 'Gharama za Biashara' : 'Matumizi Binafsi'}
        sub={tabType === 'biz' ? 'Gharama zinazohusiana na uendeshaji biashara' : 'Matumizi ya nyumbani au binafsi'}
        action={<PrimaryBtn onClick={() => setOpen(true)}><Plus size={15} /> Ongeza</PrimaryBtn>}
      />

      {open && (
        <div className="rounded-xl p-4 space-y-1" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
          <div className="flex justify-between items-center mb-2">
            <div className="font-medium text-sm">{tabType === 'biz' ? 'Gharama Mpya ya Biashara' : 'Matumizi Mapya Binafsi'}</div>
            <IconBtn onClick={() => setOpen(false)}><X size={16} /></IconBtn>
          </div>
          <Field label="Tarehe"><input type="date" style={inputStyle} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Aina / Kundi"><input style={inputStyle} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder={tabType === 'biz' ? 'mf. Usafiri, Kodi, Mishahara' : 'mf. Chakula, Pango'} /></Field>
          <Field label="Kiasi (Tsh)"><input type="number" style={inputStyle} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="mf. 20000" /></Field>
          {accounts.length > 0 && (
            <Field label="Fedha Zimetoka Akaunti Gani">
              <select style={inputStyle} value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })}>
                <option value="">— Haijachaguliwa —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Maelezo (Hiari)"><input style={inputStyle} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Maelezo..." /></Field>
          <PrimaryBtn onClick={submit} style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}><Check size={15} /> Hifadhi</PrimaryBtn>
        </div>
      )}

      {sorted.length === 0 ? <EmptyState text="Bado hakuna matumizi yaliyorekodiwa." /> : (
        <div className="space-y-2">
          {sorted.map((item) => (
            <div key={item.id} className="rounded-xl p-3 flex justify-between items-start" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
              <div>
                <div className="font-medium text-sm">{item.category}</div>
                <div className="text-xs" style={{ color: C.muted }}>{item.date}{item.notes ? ` · ${item.notes}` : ''}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-sm" style={{ color: C.brick, fontVariantNumeric: 'tabular-nums' }}>{fmt(item.amount)} Tsh</div>
                <div className="flex gap-1 justify-end mt-1">
                  <IconBtn tone="brick" onClick={() => { if (confirm('Futa rekodi hii?')) { tabType === 'biz' ? delBiz(item.id) : delPers(item.id); } }}><Trash2 size={14} /></IconBtn>
                </div>
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
  const blank = () => ({ name: '', type: 'Benki', accountNumber: '', lipaNamba: '', openingBalance: '', status: 'Hai', notes: '' });
  const [f, setF] = useState(blank());

  const openNew = () => { setF(blank()); setEditId(null); setOpen(true); };
  const openEdit = (a) => {
    setF({ name: a.name, type: a.type || 'Benki', accountNumber: a.account_number || '', lipaNamba: a.lipa_namba || '', openingBalance: a.opening_balance || '', status: a.status || 'Hai', notes: a.notes || '' });
    setEditId(a.id); setOpen(true);
  };

  const submit = async () => {
    await saveAccount(f, editId);
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="Akaunti za Fedha" sub="Simamia akaunti za benki na mitandao ya simu" action={<PrimaryBtn onClick={openNew}><Plus size={15} /> Ongeza Akaunti</PrimaryBtn>} />

      {open && (
        <div className="rounded-xl p-4 space-y-1" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
          <div className="flex justify-between items-center mb-2">
            <div className="font-medium text-sm">{editId ? 'Hariri Akaunti' : 'Akaunti Mpya'}</div>
            <IconBtn onClick={() => setOpen(false)}><X size={16} /></IconBtn>
          </div>
          <Field label="Jina la Akaunti"><input style={inputStyle} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="mf. CRDB Benki / M-Pesa" /></Field>
          <Field label="Aina ya Akaunti">
            <select style={inputStyle} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              <option>Benki</option>
              <option>Simu</option>
              <option>Taslimu (Cash)</option>
            </select>
          </Field>
          <Field label="Namba ya Akaunti / Simu"><input style={inputStyle} value={f.accountNumber} onChange={(e) => setF({ ...f, accountNumber: e.target.value })} placeholder="mf. 015... au 07..." /></Field>
          <Field label="Lipa Namba / Merchant Code (Hiari)"><input style={inputStyle} value={f.lipaNamba} onChange={(e) => setF({ ...f, lipaNamba: e.target.value })} placeholder="mf. 123456" /></Field>
          <Field label="Salio la Kuanzia (Opening Balance)"><input type="number" style={inputStyle} value={f.openingBalance} onChange={(e) => setF({ ...f, openingBalance: e.target.value })} placeholder="0" /></Field>
          <Field label="Hali">
            <select style={inputStyle} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option>Hai</option>
              <option>Imefungwa</option>
            </select>
          </Field>
          <Field label="Maelezo"><input style={inputStyle} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Maelezo..." /></Field>
          <PrimaryBtn onClick={submit} style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}><Check size={15} /> Hifadhi</PrimaryBtn>
        </div>
      )}

      {accounts.length === 0 ? <EmptyState text="Bado hakuna akaunti zilizosajiliwa." /> : (
        <div className="space-y-2">
          {accounts.map((acc) => {
            const ab = accountBalance(acc);
            return (
              <div key={acc.id} className="rounded-xl p-3 flex justify-between items-start" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
                <div>
                  <div className="font-medium text-sm flex items-center gap-2">
                    {acc.name}
                    <Pill tone={acc.type === 'Benki' ? 'gold' : 'sage'}>{acc.type}</Pill>
                  </div>
                  <div className="text-xs mt-1" style={{ color: C.muted }}>
                    {acc.account_number ? `Namba: ${acc.account_number} · ` : ''}
                    {acc.lipa_namba ? `Lipa Namba: ${acc.lipa_namba}` : ''}
                  </div>
                  <div className="text-xs mt-1" style={{ color: C.muted }}>
                    Zilioingia: <span style={{ color: C.sage }}>+{fmt(ab.moneyIn)}</span> · Zilitoka: <span style={{ color: C.brick }}>-{fmt(ab.moneyOut)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-sm" style={{ fontVariantNumeric: 'tabular-nums', color: ab.balance < 0 ? C.brick : C.dark }}>{fmt(ab.balance)} Tsh</div>
                  <div className="flex gap-1 justify-end mt-2">
                    <IconBtn onClick={() => openEdit(acc)}><Pencil size={14} /></IconBtn>
                    <IconBtn tone="brick" onClick={() => { if (confirm(`Futa akaunti ${acc.name}?`)) deleteAccount(acc.id); }}><Trash2 size={14} /></IconBtn>
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
  const [filterType, setFilterType] = useState('all');

  const allItems = useMemo(() => {
    const list = [];
    sales.forEach((s) => list.push({ id: 's-' + s.id, date: s.date, type: 'Mauzo', desc: `${s.customer} (${s.qty}kg)`, amount: Number(s.total_sale || 0), sign: '+' }));
    purchases.forEach((p) => list.push({ id: 'p-' + p.id, date: p.date, type: 'Manunuzi', desc: `${p.supplier || 'Manunuzi'} (${p.qty}kg)`, amount: Number(p.total_cost || 0), sign: '-' }));
    bizExp.forEach((e) => list.push({ id: 'be-' + e.id, date: e.date, type: 'Gharama Biashara', desc: e.category, amount: Number(e.amount || 0), sign: '-' }));
    persExp.forEach((e) => list.push({ id: 'pe-' + e.id, date: e.date, type: 'Matumizi Binafsi', desc: e.category, amount: Number(e.amount || 0), sign: '-' }));
    return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [sales, purchases, bizExp, persExp]);

  const filtered = filterType === 'all' ? allItems : allItems.filter((i) => i.type === filterType);

  return (
    <div className="space-y-4">
      <SectionHeader title="Muhtasari wa Shughuli" sub="Rekodi zote kwa mpangilio wa tarehe" />

      <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
        {['all', 'Mauzo', 'Manunuzi', 'Gharama Biashara', 'Matumizi Binafsi'].map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className="px-3 py-1.5 rounded-lg whitespace-nowrap font-medium"
            style={{ background: filterType === t ? C.dark : C.paper, color: filterType === t ? '#fff' : C.muted, border: `1px solid ${C.border}` }}
          >
            {t === 'all' ? 'Zote' : t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? <EmptyState text="Hakuna rekodi zilizopatikana." /> : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <div key={item.id} className="rounded-xl p-3 flex justify-between items-center" style={{ background: C.paper, border: `1px solid ${C.border}` }}>
              <div>
                <div className="font-medium text-sm flex items-center gap-2">
                  {item.desc}
                  <Pill tone={item.sign === '+' ? 'sage' : 'brick'}>{item.type}</Pill>
                </div>
                <div className="text-xs mt-0.5" style={{ color: C.muted }}>{item.date}</div>
              </div>
              <div className="text-right font-semibold text-sm" style={{ color: item.sign === '+' ? C.sage : C.brick, fontVariantNumeric: 'tabular-nums' }}>
                {item.sign}{fmt(item.amount)} Tsh
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}