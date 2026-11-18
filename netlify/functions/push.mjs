// GET    -> kunci publik VAPID untuk browser
// POST   -> simpan pengingat (dikirim oleh kirim-push.mjs saat waktunya tiba)
// DELETE -> batalkan pengingat
import { getStore } from '@netlify/blobs';
import { createHash, randomBytes } from 'node:crypto';

const MAX_HARI = 30;
const MAX_PER_PERANGKAT = 50;
// Hanya layanan push resmi browser (mencegah server dipakai untuk menembak alamat lain).
const PUSH_HOST = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)\//;

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const bersih = (s, n) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);
const hash = (endpoint) => createHash('sha256').update(endpoint).digest('hex').slice(0, 24);

function originOk(req) {
  const allowed = (process.env.ALLOWED_ORIGIN || '').replace(/\/$/, '');
  if (!allowed) return true;
  return req.headers.get('origin') === allowed;
}

export default async (req) => {
  if (req.method === 'GET') {
    return json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
  }
  if (!['POST', 'DELETE'].includes(req.method)) return json({ ok: false, error: 'Metode tidak didukung' }, 405);
  if (!originOk(req)) return json({ ok: false, error: 'Asal permintaan tidak diizinkan' }, 403);

  let b;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'Data tidak valid' }, 400); }
  const store = getStore('dayflow-push');

  if (req.method === 'DELETE') {
    const id = bersih(b.id, 120);
    const endpoint = String(b.endpoint || '');
    if (!/^\d+-[a-f0-9]{24}-[a-f0-9]{8}$/.test(id) || id.split('-')[1] !== hash(endpoint)) return json({ ok: false, error: 'Tidak cocok' }, 403);
    await store.delete(`jobs/${id}`);
    return json({ ok: true });
  }

  const sub = b.subscription;
  if (!sub || typeof sub.endpoint !== 'string' || sub.endpoint.length > 1000 || !PUSH_HOST.test(sub.endpoint)
      || !sub.keys || typeof sub.keys.p256dh !== 'string' || typeof sub.keys.auth !== 'string'
      || sub.keys.p256dh.length > 200 || sub.keys.auth.length > 100) {
    return json({ ok: false, error: 'Langganan notifikasi tidak valid' }, 400);
  }
  const judul = bersih(b.judul, 120);
  if (!judul) return json({ ok: false, error: 'Judul kosong' }, 400);
  const lokasi = bersih(b.lokasi, 80);
  const waktuLabel = bersih(b.waktuLabel, 80);
  const start = Date.parse(b.startIso);
  const reminder = Number(b.reminder);
  const now = Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(reminder) || reminder < 0 || reminder > 1440) return json({ ok: false, error: 'Waktu tidak valid' }, 400);
  if (start < now - 60000) return json({ ok: false, error: 'Jadwal sudah lewat' }, 400);
  if (start > now + MAX_HARI * 86400000) return json({ ok: false, error: `Maksimal ${MAX_HARI} hari ke depan` }, 400);

  const h = hash(sub.endpoint);
  const { blobs } = await store.list({ prefix: 'jobs/' });
  if (blobs.filter((x) => x.key.includes(`-${h}-`)).length >= MAX_PER_PERANGKAT) return json({ ok: false, error: 'Terlalu banyak pengingat tertunda' }, 429);

  const terjadwal = start - reminder * 60000 > now;
  const sendAt = terjadwal ? start - reminder * 60000 : now;
  const id = `${sendAt}-${h}-${randomBytes(4).toString('hex')}`;
  await store.setJSON(`jobs/${id}`, {
    sendAt,
    sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
    payload: { title: `⏰ Pengingat: ${judul}`, body: waktuLabel + (lokasi ? ` • 📍 ${lokasi}` : ''), url: '/' }
  });
  return json({ ok: true, id, terjadwal });
};
