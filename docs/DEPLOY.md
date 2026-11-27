# النشر كموقع خاص (Private Web App)

## ما اللي اتنفذ واتختبر
- سيرفر Node بدون مكتبات (server/app.mjs): صفحة دخول، كلمة المرور متخزنة كـ scrypt hash في متغير بيئة (مفيش كلمة مرور في الكود)، كوكي HttpOnly + SameSite=Strict + Secure، قفل بعد 5 محاولات غلط (15 دقيقة)، خروج بيلغي الجلسة، ترويسات أمان (CSP, X-Frame-Options, nosniff, noindex).
- كود التطبيق نفسه مش بيتحمل من غير تسجيل دخول.
- PWA: manifest + أيقونات + Service Worker بدون كاش (مفيش نسخة أوفلاين بعد الخروج).
- لا يتم تخزين كلمات مرور Highrise نهائيا.

## حدود صريحة
- بيانات الجلسات المحفوظة بتتخزن في localStorage على متصفح موبايلك (مش على السيرفر)، فهي مش بتتنقل بين الأجهزة، وبتتمسح لو مسحت بيانات الموقع.
- الحماية = كلمة مرور واحدة لمستخدم واحد. مفيش 2FA.
- التشفير في النقل (HTTPS) بيوفره مزود الاستضافة، مش الكود.
- الخطة المجانية في Render بتنام بعد فترة خمول، أول فتح بعدها ممكن ياخد حوالي دقيقة.

## الخطوات
1. على جهازك: `npm install` ثم `npm run hash-password` (يطلب كلمة مرور من اختيارك، ويطبع APP_PASSWORD_HASH و SESSION_SECRET).
2. ارفع المشروع على مستودع GitHub خاص (private).
3. على Render: New > Blueprint > اختر المستودع (فيه render.yaml). حط 3 متغيرات: APP_USERNAME, APP_PASSWORD_HASH, SESSION_SECRET.
4. افتح الرابط https://<اسم-الخدمة>.onrender.com من Chrome على الأندرويد وسجل دخول.
5. قائمة Chrome ⋮ > "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية".

بديل: أي خدمة بتشغل Docker (Fly.io, Railway, VPS): الـ Dockerfile جاهز، والبورت من PORT.

تشغيل محلي للتجربة: ضع المتغيرات الثلاثة + INSECURE_COOKIES=1 ثم `npm run build && npm start`.
