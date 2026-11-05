# التشغيل والنشر

## الخدمات

- الموقع: `https://qinaaapp.com`
- Worker fallback: `https://harat-almafia.mafia-alley.workers.dev`
- Cloudflare Worker name الحالي: `harat-almafia`.
- حساب Cloudflare المعتمد للمشروع هو حساب **Rgana Mohamed** فقط؛ لا يُنشر هذا المشروع في حساب Goussaka Marwan.
- D1 binding: `DB`، database name: `qinaa-production`.
- Durable Object binding: `ROOM_CHAT`، class: `RoomChat`.

## المتغيرات والأسرار

الأسماء المطلوبة موثقة في `.dev.vars.example`:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`
- `FACEBOOK_GRAPH_VERSION`
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `ADMIN_EMAILS`

لا تضع القيم الحقيقية في Git. استخدم Cloudflare Worker Secrets، و`.dev.vars` محلياً فقط.

## قاعدة البيانات

تطبّق migrations بالترتيب الموجود في `migrations/`. راجع قاعدة البيانات المستهدفة قبل تطبيق أي migration، ولا تعدّل migration مطبقاً؛ أضف ملفاً جديداً.

- طُبّقت migration `0006_security_rounds_mafia.sql` على قاعدة الإنتاج بتاريخ 2026-11-01. وهي تضيف حدود المصادقة، ترتيب الجولات، وحالة المافيا الموثوقة.
- طُبّقت migration `0007_mafia_naming.sql` على قاعدة الإنتاج بتاريخ 2026-11-01. وهي تعتمد اسم «المافيا»، slug `mafia`، واسم الدور «عضو المافيا» وتحدّث بيانات SEO.
- طُبّقت migration `0008_wolf_game_and_roles.sql` على قاعدة الإنتاج بتاريخ 2026-11-05. وهي تضيف «ذئاب القرية» كلعبة مستقلة وبيانات SEO الخاصة بها، وتوحّد أسماء أدوار المافيا الحالية.

## فحوصات آمنة

```sh
node --check worker/index.js
node --check dist/js/app.js
node --check dist/js/state.js
node --check dist/sw.js
git diff --check
```

## النشر

من جذر المشروع، وبعد تسجيل الدخول إلى Cloudflare:

```sh
wrangler deploy
```

زد cache version في `dist/index.html` و`dist/js/app.js` و`dist/sw.js` عندما تتغير أصول الواجهة. لا تختبر LiveKit أو خدمات مدفوعة تلقائياً إذا طلب صاحب المشروع الاقتصاد في الاستهلاك.

- واجهة النشر الحالية تستعمل cache version `44`.
- آخر نشر إنتاجي بتاريخ 2026-11-05 يحمل Version ID: `61a2f1b0-e3a2-410c-9568-7d90e9a5ced9`.
- لا تُشغّل اختبارات المتصفح أو LiveKit تلقائياً ما دام طلب صاحب المشروع الحالي هو إيقاف الاختبار.

## الأمن

- كلمات المرور تخزن ببصمة وsalt ولا تظهر في لوحة الإدارة.
- الجلسات HttpOnly وSameSite=Lax وSecure على HTTPS.
- راجع صلاحيات OAuth redirect URIs عند تغيير الدومين.
- أي credential ظهر في محادثة أو سجل يجب إلغاؤه وتدويره، حتى لو لم يوجد في Git.
