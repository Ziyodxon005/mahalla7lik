# Admin (7-lik) sifatida kirish uchun qo'llanma

Tizimda xavfsizlik uchun **har kim o'zi mustaqil ravishda Admin/Rasmiy bo'lib ro'yxatdan o'ta olmaydi**.
Buning tartibi quyidagicha:

1.  **Ro'yxatdan o'tish**:
    - Har qanday "7-lik" a'zosi avval oddiy foydalanuvchi kabi **asosiy sahifada (`index.html`)** ro'yxatdan o'tadi (Telefon va Parol bilan).
    - Hozircha uning roli: `user`.

2.  **Rolni o'zgartirish (Supabase orqali)**:
    - Siz (Loyihachi/Super Admin) **Supabase Dashboard** ga kirasiz.
    - **Table Editor** -> **profiles** jadvaliga o'tasiz.
    - O'sha shaxsning qatorini topib, `role` ustunini `user` dan kerakli lavozimga o'zgartirasiz.
    
    **Mavjud rollar:**
    - `rais`
    - `yoshlar_yetakchisi`
    - `ijtimoiy_xodim`
    - `inspektor`
    - `hokim_yordamchisi`
    - `soliq_inspektori`
    - `ayollar_faoli`
    - `super_admin` (Hamma narsani ko'ra oladi)

3.  **Admin Panelga Kirish**:
    - Rol o'zgarganidan so'ng, u shaxs **`/admin.html`** sahifasiga o'tib, o'z telefon raqami va paroli bilan kirishi mumkin.
    - Tizim uning rolini tekshiradi va tegishli murojaatlarni ko'rsatadi.

---

### SQL orqali tezkor o'zgartirish
Agar ma'lum bir telefon raqam egasini tezda `soliq_inspektori` qilmoqchi bo'lsangiz, Supabase SQL Editor-da buni yuriting:

```sql
update profiles 
set role = 'soliq_inspektori' 
where phone = '991234567'; -- O'sha insonning raqami (tozalangan holda)
```
