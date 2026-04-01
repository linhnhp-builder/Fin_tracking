/**
 * Parse JSON từ n8n (SJC screenshot + GPT / Code node) → số dùng cho định giá.
 */
export function normalizeFeedPayload(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      return typeof p === 'object' && p !== null && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

function parseMoney(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.round(v);
  if (typeof v === 'string') {
    const s = v.trim().replace(/\s/g, "").replace(/\./g, "").replace(/,/g, "");
    const digits = s.replace(/[^\d]/g, "");
    if (!digits) return null;
    const n = parseInt(digits, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function getFirstMoney(o: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const direct = o[k];
    if (direct !== undefined && direct !== null) {
      const n = parseMoney(direct);
      if (n != null) return n;
    }
    const lower = Object.keys(o).find((x) => x.toLowerCase() === k.toLowerCase());
    if (lower) {
      const n = parseMoney(o[lower]);
      if (n != null) return n;
    }
  }
  return null;
}

export function parseSourceTimeFromPayload(payload: unknown): string | null {
  const o = normalizeFeedPayload(payload);
  const v =
    o.thoiGianCapNhat ??
    o.thoi_gian_cap_nhat ??
    o.updatedAt ??
    o.updated_at ??
    o.capNhat ??
    o.time ??
    o.timestamp;
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export function goldVndPerLuongFromPayload(payload: unknown): number | null {
  const o = normalizeFeedPayload(payload);
  const unitHint = String(o.unit ?? o.donVi ?? o.don_vi ?? o.donvi ?? '').toLowerCase();

  const explicitLuong = getFirstMoney(o, [
    'giaBanLuong', 'sellPerLuong', 'banLuong', 'gia_ban_luong', 'pricePerLuong', 'gia1Luong', 'gia_1_luong',
  ]);
  if (explicitLuong != null) return explicitLuong;

  const explicitChi = getFirstMoney(o, [
    'giaBanChi', 'sellPerChi', 'banChi', 'gia_ban_chi', 'pricePerChi', 'gia1Chi',
  ]);
  if (explicitChi != null) return explicitChi * 10;

  const genericSell = getFirstMoney(o, [
    'ban', 'BAN', 'bán', 'sell', 'sellPrice', 'giaBan', 'gia_ban', 'gia_bán', 'outPrice',
  ]);
  if (genericSell == null) return null;

  if (unitHint.includes('chỉ') || unitHint.includes('chi')) {
    return genericSell * 10;
  }
  return genericSell;
}

export function silverVndPerGramFromPayload(payload: unknown): number | null {
  const o = normalizeFeedPayload(payload);
  const perGram = getFirstMoney(o, [
    'giaBanGram', 'sellPerGram', 'banGram', 'gia_ban_gram', 'pricePerGram', 'giaGram',
  ]);
  if (perGram != null) return perGram;

  const perKg = getFirstMoney(o, ['giaBanKg', 'sellPerKg', 'banKg', 'gia_ban_kg', 'pricePerKg']);
  if (perKg != null) return perKg / 1000;

  const perLuong = getFirstMoney(o, ['giaBanLuong', 'banLuong', 'sellPerLuong', 'gia_ban_luong']);
  if (perLuong != null) return perLuong / 37.5;

  const generic = getFirstMoney(o, ['ban', 'sell', 'sellPrice', 'giaBan', 'gia_ban', 'BAN']);
  if (generic == null) return null;

  const unitHint = String(o.unit ?? o.donVi ?? o.don_vi ?? '').toLowerCase();
  if (unitHint.includes('kg')) return generic / 1000;
  if (unitHint.includes('lượng') || unitHint.includes('luong')) return generic / 37.5;
  return generic;
}
