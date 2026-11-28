# 🌱 Green Valley — Telegram Farming Simulator

تم تحويل المشروع من لعبة ممالك وحروب إلى لعبة محاكاة مزرعة. اللاعب ينشئ مزرعته، يزرع المحاصيل، ينتظر نموها، يعتني بها بالماء والسماد، يحصدها ويبيعها، ثم يطوّر الأرض والمخزن والبئر والبيت الزجاجي.

## الواجهة والتجربة

- شاشة افتتاحية برسمة مزرعة خاصة وشريط تحميل متدرّج ورسائل حالة أثناء تحميل بيانات اللاعب.
- مشهد مزرعة ثلاثي الأبعاد محلي بصيغة WebP، مع طبقات حركة ولمعات وطيور وأوراق متطايرة، دون الاعتماد على روابط صور خارجية.
- بطاقات حقول مختلفة حسب الحالة، مع شريط نمو يتحدث كل ثانية، وإبراز المحاصيل الجاهزة للحصاد.
- انتقالات بين الشاشات، حركة للمحاصيل، تأثيرات حصاد ومكافآت، ومؤثرات صوتية مولّدة محلياً قابلة للتفعيل أو الإيقاف.
- إعداد مستقل لتعطيل الحركات، والصوت متوقف افتراضياً حتى يختاره اللاعب.
- تصميم متجاوب مع شاشات الهواتف وواجهة عربية RTL وإنجليزية.

## أنظمة اللعبة

- **الزراعة:** 8 محاصيل بمواعيد نمو وأسعار بذور ومحاصيل مختلفة، وفتح تدريجي حسب مستوى المزرعة.
- **العناية بالمحاصيل:** ري يومي محدود يسرّع النمو، وسماد يشتريه اللاعب بالعملات لتقليل وقت الانتظار.
- **التقدم:** خبرة ومستويات مزرعة، توسعة الأرض، مخزن أكبر، بئر بمياه يومية إضافية، وبيت زجاجي يفتح المحاصيل المتقدمة ويقلل وقت النمو.
- **السوق:** بيع المخزون مقابل عملات المزرعة، وطلبات يومية بمكافآت عملات وخبرة.
- **المكافآت:** مكافأة دخول يومية، 3 تحديات يومية، إنجازات الوصول لمستويات جديدة، وإحالات الأصدقاء.
- **المحفظة:** الجواهر تتحول إلى GRAM حسب سعر التحويل المحدد من الأدمن، مع حد أدنى للسحب ومراجعة يدوية وسجل طلبات.
- **الإدارة:** إحصائيات المزارعين والاقتصاد، بحث عن لاعب، تعديل رصيد الجواهر وGRAM، الحظر، وتعديل إعدادات الاقتصاد.

## التثبيت على Dokploy

1. افتح Supabase → SQL Editor وشغّل `sql/schema.sql` مرة واحدة. المخطط الحالي يستخدم `rl_players.data` لتخزين بيانات المزرعة، ويعيد استخدام `rl_ledger` للجواهر و`rl_withdrawals` لطلبات GRAM؛ لا يحتاج إلى أعمدة أو جداول جديدة.
2. ارفع مجلد `realms` إلى GitHub أو ارفع الملف المضغوط، ثم أنشئ Application بنوع Dockerfile والمنفذ `3000`.
3. أضف متغيرات البيئة من `.env.example`: `BOT_TOKEN`, `BOT_USERNAME`, `WEB_APP_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, و`ADMIN_IDS`.
4. نفّذ Deploy. يجب أن يظهر في السجل `Green Valley listening on :3000`.
5. افتح `https://your-domain/admin` لإدارة اللعبة والسحوبات.

**مهم:** شغّل نسخة واحدة فقط (1 replica)، لأن بيانات المحاكاة محمّلة في ذاكرة عملية Node واحدة وتُحفظ دورياً في Supabase.

## التحويل من نسخة الحرب القديمة

المشروع يتعرف على حسابات `rl_players` الحالية ويضيف لها ملف مزرعة تلقائياً عند التشغيل. يحتفظ بمعرّف اللاعب واسمه ورصيد الجواهر وGRAM والإحالات والحظر؛ ولا يحذف أو يغير سجلات السحب السابقة. مباني المملكة والجيش والخريطة لا تنتقل إلى نظام الزراعة. يحصل الحساب القديم على مزرعة بداية، بينما تبقى محفظته كما كانت.

## إعدادات الاقتصاد

من `/admin` → «اقتصاد اللعبة» يمكن ضبط `gems_per_gram`، الحد الأدنى للسحب، مستوى المزرعة المطلوب، مكافآت الدخول والمهام والإحالات والإنجازات، أسعار السماد، وسرعة الري والتسميد. القيمة الافتراضية للتحويل هي **1000 جوهرة = 1 GRAM**.

مكافآت الجواهر ليست دخلاً مضموناً. قبل فتح السحب الحقيقي، اضبط الاقتصاد وفق ميزانية الدفع الفعلية وعائد مصادر التمويل، وراجع طلبات السحب يدوياً. لا تضع وعداً بعائد ثابت للاعبين.

## تشغيل وتجربة محلية

```bash
DEV_AUTH=1 node server/index.js
```

افتح `http://localhost:3000/?dev=111`، ويمكن تجربة حساب آخر عبر `?dev=222`.

```bash
npm test
node test/farm.mjs
node test/migration.mjs
node test/ui-smoke.mjs
```

Node.js 20 أو أحدث. لا توجد مكتبات خارجية مطلوبة. الرسوم والرموز الأساسية محلية، والمؤثرات الصوتية تُولّد داخل المتصفح عند تفعيلها.

## Version 2.0 — big update

- **🪓 قطع الأشجار / Lumberjack** (tab "الغابة"): 25 axe levels, 5 tree types, timed cycles that run offline, logs sold for coins, gems every cycle, optional ×2 reward via ad, bot message when ready. Tap the tree to chop (sound, wood chips, combo — cosmetic).
- **💎 More ways to earn gems**: gem on every level-up, small gem drop chance on harvest, gems for market orders (+bonus for all 3), bonus for all 3 daily missions, lumber gems, ad rewards, admin quests. All values editable in `/admin → الاقتصاد`.
- **📺 AdsGram**: `/admin → الإعلانات` has fields for the Task / Rewarded / Interstitial **Block IDs** (no redeploy needed). Rewarded ads feed the "Earn centre" (gems, coins, full water, crop speed-up). Server measures watch time itself; daily cap and cooldown are configurable. For the Task block set `ADSGRAM_REWARD_SECRET` and the Reward URL shown in the admin page.
- **⭐ Quests from admin**: `/admin → المهام` — link, Telegram channel (verified with getChatMember; the bot must be admin of the channel), invite N friends, reach level, harvest N, finish N lumber cycles. Once or daily.
- **Look & sound**: procedural SFX + optional ambient music (Settings), time-of-day sky, falling leaves, crop growth stages, count-up balances, flying gem/coin effects, level-up celebration. Sound effects are now ON by default.
- No database migration: new data lives inside existing player JSON and `rl_settings`.

## Version 2.1
- Lumberjack opens at farm level 1: level 1 = 3 hour cycle → 2 gems; time, logs and gems scale per level. Every number is in `/admin → الاقتصاد → قطع الأشجار` with a live per-level table.
- First farm levels are much faster (XP needed: 40 / 90 / 180 / 330 for levels 1→5).
- Home page: "watch an ad, earn a gem" (AdsGram interstitial, player must click the ad and come back — toggle `ad_click_required`) + AdsGram Task card. Rewarded block is no longer needed.
- Tasks page has two sections: **المهام** (quests you add in admin) and **مهام يومية** (daily reward, missions, market orders).
- "المزيد" tab renamed **الإحالات**.
- New animated loading screen, richer forest scene, soil-bed plots, forest ambience (wind, birds, crickets at night, woodpecker) and a more realistic axe chop sound. Music/ambience is ON by default (Settings → toggle).
