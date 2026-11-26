# Jadi Link workflow

- Kerjakan satu fase sesuai persetujuan pengguna. Ringkas rencana sebelum coding;
  setelah selesai, jelaskan cara menjalankan/mengetes dan tunggu izin fase berikutnya.
- Setelah perubahan satu tahap selesai dan pengujian lulus, commit dan push ke
  branch `main` pada `origin` (`https://github.com/mfadlikurniawann-webdev/Jadi-Link.git`).
  Jangan force-push. Jika autentikasi/push gagal, laporkan blocker secara jelas.
- Periksa isi staging sebelum commit. Jangan commit `.env`, secret, token,
  `node_modules`, `dist`, coverage, atau log. Pertahankan `.env.example` tanpa
  kredensial sungguhan dan jangan menimpa `.env` pengguna.
- Jangan membuang perubahan yang tidak dibuat sendiri. Jangan menimpa riwayat
  remote atau mengubah Git author tanpa persetujuan pengguna.
- Backend memakai Node 24 LTS dan npm. Verifikasi perubahan dengan lint,
  format check, unit test, HTTP/e2e test, serta build dari `backend/`.
- Jangan menulis data uji ke Neon pengguna. Gunakan mock atau PostgreSQL lokal
  sementara untuk pengujian integrasi dan bersihkan hanya data uji sendiri.
