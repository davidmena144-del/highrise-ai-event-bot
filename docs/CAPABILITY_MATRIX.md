# مصفوفة القدرات — Capability Matrix

آخر مراجعة: 27 نوفمبر 2026. المصادر الرسمية فقط.

| القدرة | متاحة؟ | المصدر الرسمي | القيود |
|---|---|---|---|
| User authentication (حساب لاعب) | ❌ | https://create.highrise.game/learn/bots/guides/creating-a-bot | توكنات البوت للبوتات فقط (حسابات مستقلة في غرفك). مفيش OAuth رسمي للتحكم في حساب لاعب |
| Read public data (users/rooms/posts/items/grabs) | ✅ | https://create.highrise.game/learn/web-api/general/overview | قراءة فقط، بيانات عامة، rate limit 429 |
| Read event information | ❌ | نفس المصدر | مفيش event endpoints موثقة |
| Read energy | ❌ | نفس المصدر | مفيش energy endpoint موثق |
| Read tasks | ❌ | نفس المصدر | مفيش task endpoint موثق |
| Execute event actions | ❌ | نفس المصدر | التوثيق يمنع التعديل صراحة |
| Collect rewards | ❌ | نفس المصدر | مفيش endpoint |
| Use additional energy | ❌ | نفس المصدر | مفيش endpoint |
| Room bot interactions (chat/emote/move) | ✅ | Bot API | للبوتات في غرفك فقط، لا علاقة له بالإيفنتات |

## القاعدة

ممنوع اختراع endpoints أو ادعاء ميزة غير موثقة. أي قدرة جديدة تتضاف لازم يكون ليها مصدر رسمي هنا أولًا.
