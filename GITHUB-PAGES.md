# نشر مشروع RAFFEQ على GitHub Pages

## 1) اسم المستودع

أنشئ Repository جديدًا بالاسم التالي **بالضبط**:

```text
RAFFEQ
```

ارفع كل محتويات هذا المجلد إلى جذر المستودع، بما فيها مجلد `.github`.

## 2) تفعيل GitHub Pages

من داخل المستودع:

```text
Settings → Pages → Build and deployment → Source → GitHub Actions
```

بعد أول Push إلى فرع `main` سيعمل Workflow تلقائيًا، وسيظهر الموقع على رابط مشابه:

```text
https://YOUR_GITHUB_USERNAME.github.io/RAFFEQ/
```

## 3) إعداد Supabase بعد معرفة اسم مستخدم GitHub

في Supabase افتح:

```text
Authentication → URL Configuration
```

أضف إلى Redirect URLs:

```text
https://YOUR_GITHUB_USERNAME.github.io/RAFFEQ/**
```

يمكن ترك Site URL المحلي أثناء التطوير، أو تغييره إلى:

```text
https://YOUR_GITHUB_USERNAME.github.io/RAFFEQ/
```

إعداد Google Cloud لا يتغير. يظل Authorized redirect URI الخاص بـGoogle هو:

```text
https://agvxxgrxlbjpetbhpfeq.supabase.co/auth/v1/callback
```

## 4) التشغيل المحلي

```bash
npm install
npm run dev
```

ثم افتح:

```text
http://localhost:5173
```

## ملاحظات

- لا ترفع أي `service_role` أو Secret Key.
- المفتاح الموجود في `.env.production` هو Publishable Key مخصص للاستخدام في المتصفح.
- ملفات CSS وJavaScript والصور ستعمل من المسار `/RAFFEQ/` بعد عملية البناء التلقائية.
