# Dayflow (versi Web Push / PWA)

Pengingat tugas muncul sebagai notifikasi di HP atau laptop pengguna, tanpa nomor HP dan tanpa Fonnte.

## Cara kerja
1. Pengguna menekan **Aktifkan** di kartu "Notifikasi Pengingat" dan menyetujui izin dari browser.
2. Saat tugas dibuat, Dayflow mengirim data tugas dan alamat notifikasi perangkat ke `push.mjs`, yang menyimpannya di Netlify Blobs.
3. `kirim-push.mjs` berjalan otomatis tiap menit dan mengirim notifikasi yang waktunya sudah tiba.
4. `sw.js` di perangkat menerima dan menampilkannya, walau Dayflow sedang ditutup.

## Deploy ke Netlify
1. Ekstrak ZIP, upload isinya ke repository GitHub baru. Jangan upload file `KUNCI-VAPID-RAHASIA.txt`.
2. Di netlify.com: Add new site, Import from GitHub, pilih repository itu, lalu Deploy.
3. Site configuration, Environment variables, isi empat nilai dari `KUNCI-VAPID-RAHASIA.txt`:
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (isi `mailto:emailmu`), `ALLOWED_ORIGIN` (alamat situsmu, tanpa garis miring di akhir).
4. Deploys, Trigger deploy, Deploy site.
5. Google Cloud Console: tambahkan alamat Netlify ke Authorized JavaScript origins.
6. Di `public/index.html`, isi `GOOGLE_CLIENT_ID_DEFAULT` dengan Client ID-mu, lalu commit dan push.

## Cek di Netlify
- Functions: harus ada `push` dan `kirim-push`. `kirim-push` berlabel Scheduled (jalan tiap menit, hanya di deploy produksi).
- Kalau notifikasi tidak muncul, buka Logs, Functions, `kirim-push`.

## Catatan
- Butuh **https**. Di localhost juga bisa, tapi jadwal otomatis hanya jalan di Netlify.
- iPhone/iPad (iOS 16.4+): buka lewat Safari, Bagikan, Tambah ke Layar Utama, lalu buka dari ikon itu dan aktifkan.
- Notifikasi terikat ke satu perangkat dan browser. Ganti perangkat berarti aktifkan lagi di sana.
- Ketepatan waktu sekitar 1 menit. Jadwal maksimal 30 hari ke depan, maksimal 50 pengingat tertunda per perangkat.
- Menghapus tugas (🗑️) di Dayflow ikut membatalkan notifikasinya.
- Daftar tugas hanya ada selama halaman terbuka (seperti versi sebelumnya), tetapi notifikasi yang sudah dijadwalkan tetap terkirim.
