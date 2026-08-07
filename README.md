# RAFFEQ Home — Final GitHub Edition

نسخة جاهزة للرفع على GitHub Pages باسم Repository: `RAFFEQ`.

## التشغيل المحلي

```bash
npm install
npm run dev
```

يفتح المشروع عادة على:

```text
http://localhost:5173
```

## تحديث Supabase

شغّل ملفات الـSQL بالترتيب من داخل:

```text
Supabase Dashboard → SQL Editor → New Query
```

الترتيب:

```text
001_initial_schema.sql        (الملف الذي تم تشغيله أول مرة)
002_rafeeq_extended.sql
003_rafeeq_home_v2.sql
004_rafeeq_final_updates.sql
```

ملف `004_rafeeq_final_updates.sql` يضيف:

- تجربة مجانية واحدة لكل مستخدم.
- 4 رسائل AI وتعديل واحد في التجربة المجانية.
- تأمين استخدام التجربة المجانية من خلال RPC داخل Supabase.
- حقول لوحات الشركة والمصمم والمكتب الهندسي.
- الجداول الخاصة بالمواعيد والفريق والمهام والـPortfolio والتقييمات والأرباح.
- AI Insights وQR Analytics.
- رفع الصور حتى 7 MB.

## رحلة إنشاء المشروع

```text
الوظيفة
→ المحافظة والمدينة
→ غرفة واحدة أو شقة كاملة
→ نوع المساحة
→ المساحة بالمتر المربع
→ Style
→ الألوان
→ الميزانية
→ المتطلبات الإضافية
→ الدفع أو التجربة المجانية
→ رفع الصور
→ AI Processing
→ النتيجة النهائية
```

## النشر على GitHub Pages

1. أنشئ Repository باسم `RAFFEQ` بالضبط.
2. ارفع جميع الملفات، بما فيها مجلد `.github`.
3. افتح `Settings → Pages`.
4. اجعل Source هو `GitHub Actions`.
5. انتظر انتهاء Workflow باسم `Deploy RAFFEQ to GitHub Pages`.

الرابط النهائي:

```text
https://YOUR_GITHUB_USERNAME.github.io/RAFFEQ/
```

ثم أضف داخل Supabase Redirect URLs:

```text
https://YOUR_GITHUB_USERNAME.github.io/RAFFEQ/**
```

## ما هو متصل فعليًا؟

- Supabase Email/Password Authentication.
- Google Login بعد إعداد Google Provider.
- Forgot/Reset Password.
- الحسابات المختلفة وتوجيه كل حساب إلى لوحته.
- حفظ المشاريع والغرف والصور عند تشغيل الـMigrations.
- RLS وصلاحيات المستخدمين.
- طلبات المصممين والمكاتب والمحادثات الموجودة في V2.
- Free Trial counters من خلال Supabase RPC بعد تشغيل Migration 004.

## الأجزاء التجريبية الجاهزة للربط

- الدفع بالبطاقة: UI Simulation وليست بوابة دفع حقيقية.
- توليد التصميم وتعديله: UI Simulation وليست خدمة AI فعلية.
- العرض 360° و3D: محاكاة تفاعلية باستخدام الصور الحالية؛ يمكن استبدالها لاحقًا بنماذج GLB أو Panorama حقيقية.
- بيانات لوحات الشركة والمصمم والمكتب الهندسي: Demo Data مع تفاعلات محلية، والجداول المطلوبة موجودة في Migration 004 للربط الفعلي.

## البناء

```bash
npm run build
npm run preview
```

ينشئ Vite مجلد `dist`، ويقوم GitHub Actions بنشره تلقائيًا.
