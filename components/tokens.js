export const C = {
  bg: '#F6F1E4',
  paper: '#FFFFFF',
  dark: '#16301F',
  darkAlt: '#1F4029',
  gold: '#C6952E',
  goldLight: '#EFD9A0',
  brick: '#8F3A34',
  brickLight: '#F3DEDB',
  sage: '#3C6E52',
  sageLight: '#DCEBE1',
  text: '#20201A',
  muted: '#786F5C',
  border: '#E3D9C2',
};

export const PIE_COLORS = [C.sage, C.brick, C.gold, '#5B7BA6', '#8A6FA0'];

export const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
export const todayStr = () => new Date().toISOString().slice(0, 10);
export const monthKey = (d) => (d || '').slice(0, 7);

export const weekKey = (d) => {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  const day = (dt.getDay() + 6) % 7;
  const monday = new Date(dt);
  monday.setDate(dt.getDate() - day);
  return monday.toISOString().slice(0, 10);
};

export const quarterKey = (d) => {
  if (!d) return '';
  const [y, m] = d.split('-');
  const q = Math.ceil(Number(m) / 3);
  return `${y}-R${q}`;
};

export const monthLabel = (mk) => {
  const months = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ago', 'Sep', 'Okt', 'Nov', 'Des'];
  const [y, m] = mk.split('-');
  return `${months[Number(m) - 1]} ${y.slice(2)}`;
};

export const addMonths = (dateStr, delta) => {
  const dt = new Date(dateStr + 'T00:00:00');
  dt.setMonth(dt.getMonth() + delta);
  return dt.toISOString().slice(0, 7);
};

export const inputStyle = {
  width: '100%',
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: '8px 10px',
  fontSize: 14,
  color: C.text,
  background: '#fff',
  outline: 'none',
};
