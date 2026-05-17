# Restaurant POS - O'rnatish Yo'riqnomasi

## 1. Supabase loyiha yaratish

1. [supabase.com](https://supabase.com) ga kiring
2. "New Project" → loyiha nomi kiriting
3. **Settings → API** ga boring:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Ma'lumotlar bazasini yaratish

Supabase **SQL Editor** ga boring va `supabase/schema.sql` faylidagi kodlarni ishlatib yuboring.

## 3. .env.local fayl yaratish

```bash
cp .env.local.example .env.local
```

Keyin `.env.local` faylini oching va quyidagi ma'lumotlarni kiriting:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=restaurant-secret-key-minimum-32-characters
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 4. Appni ishga tushirish

```bash
npm run dev
```

## 5. Admin akkaunt yaratish

1. Brauzerda: `http://localhost:3000/admin/setup` ga boring
2. Foydalanuvchi nomi va parol kiriting
3. Setup key: `setup-restaurant-2024`
4. Akkaunt yaratilgach `/admin/login` ga o'tasiz

## 6. Foydalanish

### Mijoz paneli
- `/table/1` — 1-stol buyurtma sahifasi
- QR kod skanerlab ochiladi

### Admin paneli
- `/admin` — Bosh sahifa (buyurtmalar)
- `/admin/tables` — Stollar + QR kod generatsiya
- `/admin/menu` — Menyu boshqaruv
- `/admin/categories` — Kategoriyalar

## Xususiyatlar

- ✅ Real-time buyurtmalar (Supabase WebSocket)
- ✅ QR kod generatsiya + yuklab olish + chop etish
- ✅ Koreyscha/Inglizcha til
- ✅ KakaoTalk dizayni
- ✅ Buyurtmalar: Navbat ko'rinishi + Jadval ko'rinishi
- ✅ Oshxona/Zal ajratish
- ✅ Mijoz so'rovlari (qoshiq, suv va h.k.)
- ✅ Admin qo'lda menyu kiritish
- ✅ Tolov qilinganida jadval tozalanadi
