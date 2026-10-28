# البنية التقنية

## الواجهة

- `dist/index.html`: هيكل التطبيق وصفحات SPA والنوافذ.
- `dist/styles.css`: التصميم العام والمتجاوب.
- `dist/js/app.js`: التنقل، الحساب، الغرف، واجهة الجولة والتفاعلات المحلية.
- `dist/js/state.js`: حالة الجولة المحلية والمؤقتات والتصويت المحلي.
- `dist/js/services/room-chat.js`: WebSocket للمحادثة وإعادة الاتصال.
- `dist/js/services/livekit-voice.js`: عميل LiveKit للصوت العام والليلي.
- `dist/js/services/game-audio.js`: تشغيل التعليق الصوتي حسب المرحلة والدور.
- `dist/admindash/`: لوحة الإدارة.
- `dist/privacy/`, `dist/terms/`, `dist/data-deletion/`: الصفحات القانونية.
- `dist/sw.js` و`dist/manifest.webmanifest`: أساس PWA والتخزين المؤقت.

## الخادم

- `worker/index.js`: Cloudflare Worker، REST API، OAuth، جلسات HttpOnly، LiveKit tokens، الإدارة، وDurable Object للمحادثة.
- `migrations/`: مخطط D1 وتحديثاته.
- `wrangler.jsonc`: Worker، Static Assets، D1، وDurable Object bindings.

## البيانات

- D1: المستخدمون، الجلسات، OAuth، الأصدقاء الاجتماعيون، الغرف، الجولات، الأعضاء، الأدوار، الرسائل، المشرفون، الإعدادات وسجل الإدارة.
- Durable Object واحد لكل غرفة محادثة: اتصالات WebSocket وتوزيع الرسائل.
- LiveKit: قنوات الصوت. الخادم يصدر token قصير العمر بحسب الغرفة والدور وحالة الحياة.

## مسارات مهمة

- `/`: الرئيسية.
- `/games/:slug`: صفحة لعبة مستقلة، مع بيانات SEO تُحقن من الخادم.
- `/room/:code`: ردهة غرفة.
- `/room/:code/game`: واجهة الجولة.
- `/profile`: إدارة الملف الشخصي.
- `/rules`: القواعد.
- `/admindash`: لوحة الإدارة.
- `/api/auth/*`: التسجيل والدخول وOAuth.
- `/api/rooms/*`: الغرف والأعضاء والبداية والنهاية والخروج.
- `/api/games`: تعريف صفحات الألعاب العامة.
- `/api/rooms/:code/imposter/*`: حالة الدخيل، الاستعداد، تقدم السؤال والجواب، التصويت وتخمين الكلمة.
- `/api/admin/games/*`: تحرير اسم المسار والعناوين والوصف والكلمات المفتاحية وبيانات المشاركة.
- `/api/livekit/token`: تصريح الصوت.
- `/api/chat/ws`: محادثة الغرفة.
- `/robots.txt` و`/sitemap.xml`: فهرسة ديناميكية لصفحات الألعاب.

## الاتجاه الصحيح للتطوير

يجب أن يصبح الخادم صاحب القرار الوحيد في انتقال المراحل، المؤقتات، قرارات الأدوار، الأصوات، الإقصاء، الروبوتات وإعادة الاتصال. العميل يعرض الحالة ويرسل أوامر فقط.
