const assetUrl = (path) => `${import.meta.env.BASE_URL}${String(path).replace(/^\/+/, '')}`;

export const EGYPT_LOCATIONS = {
  'القاهرة': ['مدينة نصر', 'مصر الجديدة', 'المعادي', 'التجمع الخامس', 'وسط البلد', 'الشروق', 'بدر'],
  'الجيزة': ['الدقي', 'المهندسين', 'الهرم', 'فيصل', 'الشيخ زايد', '6 أكتوبر', 'العجوزة'],
  'الإسكندرية': ['سموحة', 'سيدي جابر', 'العجمي', 'ميامي', 'لوران', 'برج العرب'],
  'القليوبية': ['بنها', 'شبرا الخيمة', 'العبور', 'قليوب', 'الخانكة'],
  'المنوفية': ['شبين الكوم', 'مدينة السادات', 'منوف', 'أشمون', 'قويسنا'],
  'الشرقية': ['الزقازيق', 'العاشر من رمضان', 'بلبيس', 'منيا القمح'],
  'الدقهلية': ['المنصورة', 'طلخا', 'ميت غمر', 'المنزلة'],
  'الغربية': ['طنطا', 'المحلة الكبرى', 'كفر الزيات', 'زفتى'],
  'البحيرة': ['دمنهور', 'كفر الدوار', 'رشيد', 'النوبارية'],
  'بورسعيد': ['بورسعيد', 'بورفؤاد'],
  'السويس': ['السويس'],
  'الإسماعيلية': ['الإسماعيلية', 'فايد'],
  'دمياط': ['دمياط', 'دمياط الجديدة', 'رأس البر'],
  'كفر الشيخ': ['كفر الشيخ', 'دسوق', 'بلطيم'],
  'الفيوم': ['الفيوم', 'سنورس'],
  'بني سويف': ['بني سويف', 'بني سويف الجديدة'],
  'المنيا': ['المنيا', 'المنيا الجديدة', 'ملوي'],
  'أسيوط': ['أسيوط', 'أسيوط الجديدة'],
  'سوهاج': ['سوهاج', 'سوهاج الجديدة', 'أخميم'],
  'قنا': ['قنا', 'قنا الجديدة'],
  'الأقصر': ['الأقصر', 'البياضية'],
  'أسوان': ['أسوان', 'أسوان الجديدة'],
  'البحر الأحمر': ['الغردقة', 'سفاجا', 'مرسى علم'],
  'مطروح': ['مرسى مطروح', 'العلمين الجديدة', 'سيوة'],
  'شمال سيناء': ['العريش'],
  'جنوب سيناء': ['شرم الشيخ', 'دهب', 'طور سيناء'],
  'الوادي الجديد': ['الخارجة', 'الداخلة']
};

export const ROOM_TYPES = [
  { id: 'living_room', label: 'غرفة معيشة', image: assetUrl('assets/rooms/living-room.svg'), description: 'جلسات مريحة وتوزيع عملي للحركة.' },
  { id: 'bedroom', label: 'غرفة نوم', image: assetUrl('assets/rooms/bedroom.svg'), description: 'هدوء وخصوصية ومساحات تخزين ذكية.' },
  { id: 'kids_room', label: 'غرفة أطفال', image: assetUrl('assets/rooms/kids-room.svg'), description: 'أمان، لعب، مذاكرة، ونمو مرن.' },
  { id: 'kitchen', label: 'مطبخ', image: assetUrl('assets/rooms/kitchen.svg'), description: 'مثلث حركة عملي ووحدات تخزين مناسبة.' },
  { id: 'bathroom', label: 'حمام', image: assetUrl('assets/rooms/bathroom.svg'), description: 'خامات مقاومة للرطوبة واستغلال أفضل للمساحة.' },
  { id: 'reception', label: 'ريسبشن', image: assetUrl('assets/rooms/reception.svg'), description: 'توزيع استقبال متوازن ومظهر متناسق.' },
  { id: 'office', label: 'مكتب', image: assetUrl('assets/rooms/office.svg'), description: 'إضاءة وعناصر تساعد على التركيز والإنتاجية.' },
  { id: 'dining_room', label: 'غرفة طعام', image: assetUrl('assets/rooms/dining-room.svg'), description: 'تجربة طعام مريحة ومسافات حركة محسوبة.' }
];

export const PROFESSIONS = [
  ['student', 'طالب', '🎓'],
  ['employee', 'موظف', '💼'],
  ['doctor', 'طبيب', '🩺'],
  ['engineer', 'مهندس', '📐'],
  ['teacher', 'معلم', '📚'],
  ['designer', 'مصمم', '🎨'],
  ['business_owner', 'صاحب شركة', '🏢'],
  ['work_from_home', 'العمل من المنزل', '💻'],
  ['other', 'أخرى', '✨']
];

const COMMON_BRANCHES = [
  {
    id: 'cairo-center',
    name: 'فرع وسط القاهرة',
    address: 'شارع التحرير، وسط القاهرة',
    phone: '02 0000 0001',
    distance: '3.8 كم',
    mapUrl: 'https://maps.google.com/?q=30.0444,31.2357',
    qr: assetUrl('assets/qr/cairo-center.png')
  },
  {
    id: 'new-cairo',
    name: 'فرع القاهرة الجديدة',
    address: 'التجمع الخامس، القاهرة الجديدة',
    phone: '02 0000 0002',
    distance: '11 كم',
    mapUrl: 'https://maps.google.com/?q=30.0074,31.4913',
    qr: assetUrl('assets/qr/new-cairo.png')
  },
  {
    id: '6-october',
    name: 'فرع 6 أكتوبر',
    address: 'المحور المركزي، مدينة 6 أكتوبر',
    phone: '02 0000 0003',
    distance: '24 كم',
    mapUrl: 'https://maps.google.com/?q=29.9285,30.9188',
    qr: assetUrl('assets/qr/6-october.png')
  }
];

export const PRODUCTS = [
  {
    id: 'sofa-01',
    name: 'أريكة مودرن ثلاثية',
    category: 'sofas',
    price: 42000,
    rating: 4.9,
    image: assetUrl('assets/products/sofa.svg'),
    gallery: [assetUrl('assets/products/sofa.svg'), assetUrl('assets/products/sofa.svg'), assetUrl('assets/products/sofa.svg')],
    description: 'أريكة بخطوط هادئة وقماش مقاوم للبقع، مناسبة لغرف المعيشة الحديثة وتوفر عمق جلوس مريح للاستخدام اليومي.',
    material: 'هيكل خشب زان، إسفنج عالي الكثافة، وقماش معالج ضد البقع',
    dimensions: 'العرض 235 سم × العمق 92 سم × الارتفاع 82 سم',
    colors: ['بيج', 'رمادي', 'أخضر زيتوني', 'كحلي'],
    stock: 12,
    supplier: 'RAFEEQ Living',
    availability: 'متوفر',
    branches: COMMON_BRANCHES
  },
  {
    id: 'chair-01',
    name: 'كرسي قراءة مريح',
    category: 'chairs',
    price: 14800,
    rating: 4.8,
    image: assetUrl('assets/products/chair.svg'),
    gallery: [assetUrl('assets/products/chair.svg'), assetUrl('assets/products/chair.svg')],
    description: 'كرسي مريح مع دعم للظهر وتنجيد عالي الكثافة، مناسب لركن القراءة أو مساحة العمل الهادئة.',
    material: 'خشب طبيعي وكتان معالج',
    dimensions: 'العرض 78 سم × العمق 84 سم × الارتفاع 91 سم',
    colors: ['أوف وايت', 'طوبي', 'أخضر داكن'],
    stock: 8,
    supplier: 'Nook Furniture',
    availability: 'متوفر',
    branches: COMMON_BRANCHES.slice(0, 2)
  },
  {
    id: 'lamp-01',
    name: 'وحدة إضاءة معلقة',
    category: 'lighting',
    price: 6900,
    rating: 4.7,
    image: assetUrl('assets/products/lamp.svg'),
    gallery: [assetUrl('assets/products/lamp.svg'), assetUrl('assets/products/lamp.svg')],
    description: 'إضاءة دافئة بتصميم بسيط يناسب الطابع الاسكندنافي والمودرن، مع ارتفاع قابل للتعديل.',
    material: 'معدن مطلي وزجاج حراري',
    dimensions: 'القطر 42 سم × ارتفاع قابل للتعديل حتى 140 سم',
    colors: ['أسود مطفي', 'ذهبي', 'أبيض'],
    stock: 20,
    supplier: 'Luma Egypt',
    availability: 'متوفر',
    branches: COMMON_BRANCHES
  },
  {
    id: 'table-01',
    name: 'طاولة قهوة دائرية',
    category: 'tables',
    price: 11500,
    rating: 4.6,
    image: assetUrl('assets/products/table.svg'),
    gallery: [assetUrl('assets/products/table.svg'), assetUrl('assets/products/table.svg')],
    description: 'طاولة قهوة بسطح متين وحواف آمنة للاستخدام اليومي، مناسبة للمساحات الصغيرة والمتوسطة.',
    material: 'خشب بلوط طبيعي ومعالجة مقاومة للخدش',
    dimensions: 'القطر 90 سم × الارتفاع 42 سم',
    colors: ['بلوط طبيعي', 'جوز', 'أسود'],
    stock: 6,
    supplier: 'Oak & Form',
    availability: 'متوفر بكمية محدودة',
    branches: COMMON_BRANCHES.slice(1)
  },
  {
    id: 'rug-01',
    name: 'سجادة ناعمة 200×300',
    category: 'decor',
    price: 8400,
    rating: 4.9,
    image: assetUrl('assets/products/rug.svg'),
    gallery: [assetUrl('assets/products/rug.svg'), assetUrl('assets/products/rug.svg')],
    description: 'سجادة بألوان محايدة وملمس ناعم سهل التنظيف، تضيف دفئًا بصريًا وتحدد منطقة الجلوس.',
    material: 'صوف صناعي فاخر منخفض الحساسية',
    dimensions: '200 سم × 300 سم',
    colors: ['بيج', 'رمادي فاتح', 'طوبي هادئ'],
    stock: 15,
    supplier: 'Weave House',
    availability: 'متوفر',
    branches: COMMON_BRANCHES
  },
  {
    id: 'shelf-01',
    name: 'وحدة تخزين عملية',
    category: 'storage',
    price: 17500,
    rating: 4.5,
    image: assetUrl('assets/products/shelf.svg'),
    gallery: [assetUrl('assets/products/shelf.svg'), assetUrl('assets/products/shelf.svg')],
    description: 'وحدة تخزين مرنة تجمع بين الأرفف المفتوحة والخزائن المغلقة لتقليل الفوضى البصرية.',
    material: 'MDF مقاوم للرطوبة مع قشرة خشب طبيعية',
    dimensions: 'العرض 180 سم × العمق 42 سم × الارتفاع 210 سم',
    colors: ['أبيض وخشب', 'أخضر داكن وخشب', 'رمادي'],
    stock: 4,
    supplier: 'Form Storage',
    availability: 'متوفر بكمية محدودة',
    branches: COMMON_BRANCHES.slice(0, 2)
  }
];

export const ENGINEERING_OFFICES = [
  { id: 'office-1', name: 'Axis Engineering', rating: 4.9, projects: 128, duration: '18–24 يومًا', executionCost: 76000, fee: 3500, specialties: ['تشطيب كامل', 'كهرباء وسباكة'], avatar: 'AX' },
  { id: 'office-2', name: 'Buildora Studio', rating: 4.7, projects: 94, duration: '14–20 يومًا', executionCost: 68500, fee: 2800, specialties: ['تشطيب داخلي', 'إدارة موقع'], avatar: 'BS' },
  { id: 'office-3', name: 'Line & Structure', rating: 4.8, projects: 76, duration: '21–28 يومًا', executionCost: 82000, fee: 4000, specialties: ['تنفيذ فاخر', 'أعمال معمارية'], avatar: 'LS' }
];

export const DEMO_ORDERS = [
  { id: 'RF-1048', date: '2026-07-26', total: 48900, status: 'قيد التجهيز' },
  { id: 'RF-1032', date: '2026-07-19', total: 16900, status: 'تم التوصيل' }
];

export const DEMO_NOTIFICATIONS = [
  { icon: '✨', title: 'التصميم جاهز', text: 'تم الانتهاء من تحليل مشروع غرفة المعيشة.' },
  { icon: '📦', title: 'تحديث الطلب', text: 'طلبك RF-1048 دخل مرحلة التجهيز.' },
  { icon: '💬', title: 'رسالة جديدة', text: 'لديك رد جديد من المصمم المسؤول عن الطلب.' }
];
