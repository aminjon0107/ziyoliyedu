# AIEdu 2.1 — Universal Smart Education

AIEdu — maktab, kollej, universitet va mustaqil o‘rganuvchilar uchun ta’lim platformasi.

## Ushbu versiyada
- Mobilga mos bosh sahifa va kurslar ro‘yxati
- Supabase orqali ro‘yxatdan o‘tish va kirish
- O‘quvchi profili
- Admin uchun foydalanuvchilar va umumiy statistika API
- Admin kurs qo‘shish API
- AI endpoint (serverda API kalit bo‘lsa ishlaydi)
- Click va Payme integratsiyasi uchun xavfsiz konfiguratsiya joylari
- Express 5 bilan mos catch-all route (`/{*splat}`)

## Muhim xavfsizlik
- `.env` faylini GitHub'ga yuklamang.
- `SUPABASE_SERVICE_ROLE_KEY`, Click/Payme secret key va AI kalitlarini faqat Render Environment Variables ichiga kiriting.
- Hech qachon foydalanuvchining karta raqami yoki CVV kodini AIEdu bazasida saqlamang.
- Haqiqiy to‘lovlar uchun Click va Payme merchant shartnomalari hamda rasmiy merchant identifikatorlari talab qilinadi. Hozircha to‘lov endpointi ataylab yopiq.

## Supabase sozlash
1. Supabase'da yangi project yarating.
2. Project Settings -> API bo‘limidan Project URL, anon key va service_role key oling.
3. SQL Editor'ga kiring va `supabase/schema.sql` ichidagi kodni ishga tushiring.
4. Authentication -> URL Configuration bo‘limida Render saytingiz manzilini Site URL sifatida kiriting.
5. Keyin birinchi akkauntni sayt orqali yarating.
6. SQL Editor'da README oxiridagi admin tayinlash so‘rovini o‘z emailingiz bilan bajaring.

## Render sozlash
- New -> Web Service -> GitHub repo `aminjon0107/aiedu2.0`
- Branch: `main`
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Environment: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Deploy tugagach `/api/health` manzilini oching.

## Adminni tayinlash
Supabase SQL Editor'da quyidagini o‘z emailingizga moslab bajaring:
```sql
update public.profiles p set role = 'admin'
from auth.users u
where p.id = u.id and lower(u.email) = lower('YOUR_EMAIL_HERE');
```
Admin huquqini faqat ishonchli o‘zingizning emailingizga bering.

## Lokal ishga tushirish
Node.js 20+:
```bash
npm install
cp .env.example .env
npm start
```
So‘ng `http://localhost:3000` ni oching.

## To‘lovlar
Click va Payme merchant onboarding tugagach, rasmiy hujjatlar asosida server callback, imzo tekshirish, tranzaksiya holati va qayta yuborishdan himoya (idempotency) qo‘shiladi. Kartani platformada saqlash o‘rniga provayderning xavfsiz to‘lov sahifasidan foydalaniladi.
