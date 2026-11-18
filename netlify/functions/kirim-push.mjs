// Berjalan otomatis tiap menit: kirim semua pengingat yang waktunya sudah tiba.
import { getStore } from '@netlify/blobs';
import webpush from 'web-push';

export default async () => {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) { console.error('VAPID key belum diatur'); return; }
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const store = getStore('dayflow-push');
  const { blobs } = await store.list({ prefix: 'jobs/' });
  const now = Date.now();
  const jatuhTempo = blobs.filter((b) => Number(b.key.slice(5).split('-')[0]) <= now).slice(0, 100);

  await Promise.all(jatuhTempo.map(async (b) => {
    const job = await store.get(b.key, { type: 'json' });
    if (!job) { await store.delete(b.key); return; }
    try {
      await webpush.sendNotification(job.sub, JSON.stringify(job.payload), { TTL: 3600, urgency: 'high' });
      await store.delete(b.key);
    } catch (e) {
      const sementara = (e.statusCode === 429 || e.statusCode >= 500 || !e.statusCode) && now - job.sendAt < 30 * 60000;
      console.error('Push gagal', e.statusCode || '', e.body || e.message);
      if (!sementara) await store.delete(b.key); // 404/410 = langganan sudah dicabut
    }
  }));
};

export const config = { schedule: '* * * * *' };
