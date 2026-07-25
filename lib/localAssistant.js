// Msaidizi wa Ndani - hauhitaji API wala malipo. Anajibu maswali ya kawaida
// kwa kutumia namba za biashara zilizohesabiwa tayari (context), bila kuunganisha
// na huduma yoyote ya nje. Hii ndiyo inayotumika kama "backup" endapo Claude API
// haipatikani (mf. funguo haijawekwa, salio la API limeisha, au tatizo la mtandao).

const fmtLocal = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');

function has(message, ...words) {
  const m = (message || '').toLowerCase();
  return words.some((w) => m.includes(w));
}

export function localAssistantReply(message, context) {
  const c = context || {};

  if (has(message, 'faida')) {
    return `Faida ya mwezi huu ni ${fmtLocal(c.faida_mwezi_huu_tsh)} Tsh.`;
  }

  if (has(message, 'mauzo')) {
    return `Mauzo ya mwezi huu ni ${fmtLocal(c.mauzo_mwezi_huu_tsh)} Tsh.`;
  }

  if (has(message, 'deni', 'madeni', 'anadaiwa', 'wanaodaiwa')) {
    const list = Array.isArray(c.madeni_wazi) ? c.madeni_wazi : [];
    if (list.length === 0) return 'Hakuna madeni wazi kwa sasa - kazi nzuri!';
    const lines = list.slice(0, 5).map((d) => `- ${d.mteja}: ${fmtLocal(d.salio_tsh)} Tsh`).join('\n');
    return `Jumla ya madeni yanayodaiwa sasa: ${fmtLocal(c.madeni_yanayodaiwa_sasa_tsh)} Tsh.\n\nWanaodaiwa zaidi:\n${lines}`;
  }

  if (has(message, 'akaunti', 'salio', 'benki', 'lipa namba', 'fedha zilizopo')) {
    const accs = Array.isArray(c.akaunti_za_fedha) ? c.akaunti_za_fedha : [];
    if (accs.length === 0) return 'Bado hujaongeza akaunti yoyote. Nenda tab ya "Akaunti" kuongeza benki au namba ya simu.';
    const lines = accs.map((a) => `- ${a.jina} (${a.aina}): ${fmtLocal(a.salio_tsh)} Tsh`).join('\n');
    return `Fedha zilizopo jumla (akaunti zote): ${fmtLocal(c.fedha_zilizopo_kwenye_akaunti_tsh)} Tsh.\n\n${lines}`;
  }

  if (has(message, 'mteja', 'wateja')) {
    const list = Array.isArray(c.wateja_muhimu) ? c.wateja_muhimu : [];
    if (list.length === 0) return 'Bado hakuna wateja walioandikwa kwenye mfumo.';
    const lines = list.slice(0, 5).map((w) => `- ${w.jina}: ${fmtLocal(w.jumla_ununuzi_tsh)} Tsh (${w.kiwango})`).join('\n');
    return `Una wateja ${c.idadi_ya_wateja || 0} kwa jumla. Wanaonunua zaidi:\n${lines}`;
  }

  if (has(message, 'bidhaa', 'stock', 'stoo', 'karanga')) {
    const list = Array.isArray(c.muhtasari_wa_bidhaa) ? c.muhtasari_wa_bidhaa : [];
    if (list.length === 0) return 'Bado hakuna mauzo ya bidhaa yaliyoandikwa.';
    const lines = list.slice(0, 5).map((p) => `- ${p.name}: ${fmtLocal(p.kg)}kg, faida ${fmtLocal(p.faida)} Tsh`).join('\n');
    return `Muhtasari wa bidhaa zako:\n${lines}`;
  }

  if (has(message, 'ushauri', 'mapendekezo', 'fanyeje', 'nifanye', 'boresha')) {
    const list = Array.isArray(c.mapendekezo_ya_mfumo) ? c.mapendekezo_ya_mfumo : [];
    if (list.length === 0) return 'Kwa sasa hakuna mapendekezo maalum. Endelea kuandika mauzo na madeni ili mfumo uweze kukupa ushauri bora zaidi.';
    return `Mapendekezo ya sasa:\n${list.map((x) => `- ${x}`).join('\n')}`;
  }

  return `Msaidizi wa ndani ana uwezo mdogo (hajaunganishwa na AI kamili kwa sasa), lakini hii ndiyo hali ya biashara yako leo (${c.tarehe_ya_leo || ''}):
- Mauzo mwezi huu: ${fmtLocal(c.mauzo_mwezi_huu_tsh)} Tsh
- Faida mwezi huu: ${fmtLocal(c.faida_mwezi_huu_tsh)} Tsh
- Madeni yanayodaiwa: ${fmtLocal(c.madeni_yanayodaiwa_sasa_tsh)} Tsh
- Fedha zilizopo: ${fmtLocal(c.fedha_zilizopo_kwenye_akaunti_tsh)} Tsh
- Idadi ya wateja: ${c.idadi_ya_wateja || 0}

Jaribu kuuliza kuhusu neno moja kati ya: "faida", "mauzo", "madeni", "wateja", "akaunti", "bidhaa", au "mapendekezo".`;
}
