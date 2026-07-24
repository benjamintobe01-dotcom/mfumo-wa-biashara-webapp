# Mfumo wa Biashara — Web App (Next.js + Supabase)

App kamili ya bookkeeping (Mauzo, Manunuzi, Madeni, Wateja, Matumizi, Bidhaa, Muhtasari)
yenye akaunti za kweli (login/signup) na data ya kila mtumiaji ikiwa faragha kwake mwenyewe.

## Hatua za kuiweka (fanya kwa mpangilio huu)

### 1. Fungua akaunti ya Supabase (bure)
1. Nenda https://supabase.com → "Start your project" → jisajili.
2. Bofya "New Project". Chagua jina, password ya database, na region iliyo karibu nawe.
3. Subiri dakika 1-2 mradi uandaliwe.

### 2. Tengeneza database (tables)
1. Kwenye dashboard ya mradi wako, bofya **SQL Editor** (upande wa kushoto).
2. Fungua faili `supabase/schema.sql` iliyo kwenye folda hii, copy yote.
3. Bandika kwenye SQL Editor, bofya **Run**.
   - Hii inatengeneza tables zote (products, sales, purchases, biz_expenses,
     personal_expenses, debts, customer_profiles) na kuzifanya salama — kila
     mtumiaji anaona data yake tu (Row Level Security).

### 3. Pata funguo (keys) za mradi wako
1. Bofya **Project Settings** (gia) → **API**.
2. Nakili **Project URL** na **anon public key**.

### 4. Weka funguo hizo kwenye app
1. Kwenye folda hii, badilisha jina la faili `.env.local.example` kuwa `.env.local`.
2. Fungua na jaza:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<Project URL yako>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key yako>
   ```

### 5. (Hiari lakini inasaidia) Zima uthibitisho wa barua pepe wakati wa kujaribu
Kwa default, Supabase inahitaji mtumiaji athibitishe barua pepe kabla ya kuingia.
Ukitaka kujaribu haraka bila hatua hiyo:
1. **Authentication** → **Providers** → **Email** → zima "Confirm email".
   (Baadaye ukiwa tayari kwa watumiaji halisi, ni vizuri kuiwasha tena.)

### 6. Endesha app kwenye kompyuta yako
Hakikisha una Node.js (toleo 18+) imewekwa, kisha kwenye terminal ndani ya folda hii:
```
npm install
npm run dev
```
Fungua http://localhost:3000 — utaona ukurasa wa Login/Signup.

### 7. Weka Live (Deploy) kwenye Vercel — hii ndiyo "link" yako
1. Weka code hii kwenye GitHub (tengeneza repo mpya, push code).
2. Nenda https://vercel.com → jisajili kwa GitHub → "Add New Project" → chagua repo yako.
3. Kwenye "Environment Variables", ongeza zile zile mbili kutoka `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Bofya **Deploy**. Baada ya dakika chache utapata link, mf.
   `https://mfumo-wa-biashara.vercel.app` — hii ndiyo unayoweza kutuma kwa yeyote.

### 8. Kuifanya "Phone App" (hatua ya baadaye)
- **Njia rahisi (PWA):** Fungua link kwenye simu (Chrome/Safari) → "Ongeza kwenye
  Home Screen". Itafanya kazi kama app, na icon yake mwenyewe.
- **Njia ya Play Store / App Store (baadaye):** tunaweza kutumia **Capacitor**
  kuifunga hii hii web app kuwa APK/IPA bila kuandika code mpya kabisa. Hii ni
  hatua ya mbeleni ukishaona mfumo unafanya kazi vizuri kwa wiki/mwezi kadhaa.

## Muundo wa mradi
```
app/                → kurasa (login, signup, ukurasa mkuu)
components/         → BusinessApp.jsx (mantiki yote) + ui.jsx (vipengele vidogo)
hooks/               → useBusinessData.js (huunganisha na Supabase)
lib/                 → wateja wa Supabase (browser + middleware)
supabase/schema.sql  → muundo wa database
middleware.js        → inalinda kurasa (lazima uwe umeingia)
```

## Data ni salama kiasi gani?
- Kila mtumiaji ana akaunti yake mwenyewe (email + password, kupitia Supabase Auth).
- Row Level Security inahakikisha mtumiaji A hawezi kuona data ya mtumiaji B —
  hata kama wote wanatumia link moja.
- Ukiongeza wafanyakazi wengine baadaye (mf. mhasibu), tunaweza kuongeza "roles"
  ili wote waone data ya biashara moja — hilo ni hatua ya baadaye tukifika huko.

## Ukikwama
- Ukiona ukurasa mweupe au error ya "Invalid API key" — hakiki `.env.local` (au
  environment variables kwenye Vercel) zina thamani sahihi bila nafasi za ziada.
- Ukiona huwezi ku-login baada ya signup — angalia kama "Confirm email" bado iko
  wazi (hatua ya 5) na uangalie barua pepe yako (pamoja na Spam).
