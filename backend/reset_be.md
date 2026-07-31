Cara benar-benar menghapusnya

  Pilih salah satu sesuai seberapa banyak data yang mau kamu buang:

  Opsi A — hapus user ini saja (paling aman, data lain tetap):
  cd backend
  sqlite3 prisma/dev.db "DELETE FROM users WHERE email='wafiqmuhaz@gmail.com';"
  Row company_members dan agents yang bergantung akan ikut terhapus jika FK-nya ON DELETE CASCADE; kalau tidak, hapus manual dulu:
  sqlite3 prisma/dev.db "DELETE FROM company_members WHERE user_id='5976f24c-199d-4094-8d6f-7529d76ebdc9';"
  sqlite3 prisma/dev.db "DELETE FROM users WHERE email='wafiqmuhaz@gmail.com';"

  Opsi B — reset total via Prisma (drop + recreate + re-seed):
  cd backend
  npx prisma migrate reset

  Opsi C — buang file DB, bikin ulang dari nol:
  cd backend
  rm prisma/dev.db
  npx prisma migrate deploy   # atau: npx prisma db push
  npm run db:seed             # opsional, isi ulang company + chief-of-staff

  Catatan: Opsi B dan C bersifat destruktif — semua data hilang, termasuk perbaikan roster yang sudah kita terapkan sebelumnya. Kalau kamu cuma mau membebaskan email itu untuk daftar ulang, Opsi A sudah cukup.
