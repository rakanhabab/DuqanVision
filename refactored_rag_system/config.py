from typing import Dict, List, Tuple, Callable, Any
from dataclasses import dataclass
import os

@dataclass
class RAGConfig:
    openai_api_key: str
    supabase_url: str
    supabase_key: str
    model_name: str = os.getenv("MODEL_NAME", "gpt-3.5-turbo")
    temperature: float = float(os.getenv("MODEL_TEMPERATURE", "0.7"))
    max_tokens: int = int(os.getenv("MODEL_MAX_TOKENS", "1000"))
    chunk_size: int = 1000
    chunk_overlap: int = 200
    table_name: str = os.getenv("VECTOR_TABLE", "documents")
    query_name: str = os.getenv("VECTOR_QUERY_FN", "match_documents")

# Smart Responses Configuration
SMART_RESPONSES: Dict[Tuple[str, ...], Callable[[str], str]] = {
    # Greetings
    ("اهلا", "أهلا", "مرحبا", "السلام عليكم", "hello", "hi", "مرحبتين", "هلا", "أهلين"): 
        lambda user: f"أهلاً {user}!" if user else "أهلاً وسهلاً! كيف حالك؟ أنا صديق، مساعدك الذكي في دكان فجن، سعيد بلقائك.",
    
    # Farewells
    ("مع السلامة", "إلى اللقاء", "goodbye", "bye", "سلام", "باي"): 
        lambda _: "وداعاً! نتمنى لك يوماً سعيداً.",
    
    # How are you
    ("كيف الحال", "كيف حالك", "how are you", "شخبارك", "شلونك", "كيفك"): 
        lambda user: f"الحمد لله بخير {user or ''}. كيف أقدر أساعدك اليوم؟",
    
    # Thanks
    ("شكرا", "شكراً", "thank you", "thanks", "مشكور", "تسلم"): 
        lambda user: f"العفو {user or ''}! سعيد بمساعدتك.",
    
    # About the assistant
    ("اسمك", "your name", "من انت", "من أنت", "وش اسمك", "ما اسمك"): 
        lambda _: "أنا صديق، مساعدك الذكي في دكان فجن. أساعدك في التسوق والإجابة على أسئلتك.",
    
    # About the user
    ("وش اسمي", "ما اسمي", "اسمي", "my name", "who am i", "من أنا"): 
        lambda user: f"اسمك {user} 😊" if user and user != "مستخدم" else "عذراً، لا أعرف اسمك. هل يمكنك إخباري باسمك؟",
    
    # Capabilities
    ("وش تقدر تسوي", "what can you do", "قدراتك", "وش تسوي", "إيش تقدر"): 
        lambda _: "أساعدك في: البحث عن المنتجات، معرفة الفروع، طرق الدفع، الفواتير، إلخ.",
    
    # About the company
    ("دكان فجن", "الشركة", "company", "المتجر", "المنصة"): 
        lambda user: f"دكان فجن منصة سعودية مبتكرة تقدم تجربة تسوق ذكية؛ تدخل، تختار منتجاتك، وتخرج بدون الحاجة للوقوف عند الكاشير.",
    
    # QR codes
    ("qr", "كيو آر", "باركود", "كود"): 
        lambda _: "في دكان فجن تبدأ رحلتك بمسح كود QR، ومن ثم يمكنك التسوق بحرية والدفع يتم بشكل تلقائي وسلس عند المغادرة.",
    
    # AI
    ("ذكاء اصطناعي", "ai", "artificial intelligence", "الذكاء"): 
        lambda _: "نستخدم تقنيات الذكاء الاصطناعي لتتبع المشتريات، تخصيص العروض، وضمان تجربة سلسة بدون تدخل يدوي.",
    
    # Vending machines
    ("آلة بيع", "ماكينة", "vending machine", "ماكينات"): 
        lambda _: "آلاتنا ليست مجرد ماكينات بيع تقليدية؛ بل هي منصات ذكية تتيح لك الدخول، اختيار المنتجات، والخروج والدفع مباشرة بدون انتظار.",
    
    # How to buy
    ("كيف أشتري", "طريقة الدفع", "كيف أستخدم", "طريقة الشراء", "وش تقدم المنصة", "الخدمات"): 
        lambda user: f"دكان فجن يقدم: 1) تسوق سريع عبر QR، 2) منتجات متنوعة (مشروبات، وجبات خفيفة)، 3) دفع إلكتروني آمن، 4) فروع 24/7، 5) تجربة ذكية مخصصة.",
    
    # Payment methods
    ("كيف ادفع", "طرق الدفع", "payment", "دفع"): 
        lambda _: "ندعم في دكان فجن: مدى/بطاقات، Apple Pay/Google Pay، نقداً، وSTC Pay.",
    
    # Branches
    ("أين الفروع", "وين موقعكم", "فروع", "branches", "locations"): 
        lambda user: f"لدينا فروع دكان فجن في الرياض وجدة والدمام والخبر والمدينة.",
    
    # Working hours
    ("متى تفتحون", "ساعات العمل", "open"): 
        lambda _: "فروع دكان فجن تعمل 24/7 لتوفير الخدمة على مدار الساعة.",
    
    # Prices
    ("كم الأسعار", "price", "السعر", "التكلفة"): 
        lambda user: f"أسعار دكان فجن تتراوح من 2.50 ر.س إلى 8.00 ر.س حسب المنتج.",
    
    # Weather
    ("الطقس", "weather"): 
        lambda _: "ما أقدر أجيب الطقس الآن، لكن أقدر أساعدك في التسوق من دكان فجن.",
    
    # Date
    ("التاريخ", "date", "اليوم"): 
        lambda _: f"التاريخ: {__import__('datetime').datetime.now().strftime('%Y/%m/%d')}",
    
    # Knowledge scope
    ("نطاق معرفتك", "نطاق المعرفة", "قدراتك", "وش تقدر", "إيش تقدر"): 
        lambda user: f"نطاق معرفتي يتركز على دكان فجن: المنتجات، الفروع، الفواتير، طرق الدفع، الخدمات، والتسوق الذكي. يمكنني مساعدتك في أي استفسار حول خدماتنا.",
    
    # Platform context
    ("المنصة", "platform", "السياق", "context"): 
        lambda user: f"المنصة التي أتحدث عنها هي دكان فجن - منصة التسوق الذكي السعودية. نحن نقدم خدمات البيع الآلي الذكي مع تجربة دفع سريعة وآمنة.",
}

# Smart Product Queries
SMART_PRODUCT_QUERIES: Dict[Tuple[str, ...], str] = {
    # Price queries
    ("اعلى سعر", "أعلى سعر", "اغلى", "أغلى", "أعلى تكلفة", "اعلى تكلفة", "highest price", "most expensive"): "highest_price",
    ("اقل سعر", "أقل سعر", "ارخص", "أرخص", "أقل تكلفة", "اقل تكلفة", "lowest price", "cheapest"): "lowest_price",
    ("اعلى كالوري", "أعلى كالوري", "أعلى سعرات", "اعلى سعرات", "highest calories", "most calories"): "highest_calories",
    
    # Calories queries
    ("كم فيه سعرة", "كم سعرة", "كم سعرات", "كم سعرات حرارية", "calories", "سعرات حرارية", "سعرة حرارية"): "all_calories",
    
    # Specific product categories
    ("كم سعر العصير", "سعر العصير", "تكلفة العصير", "price of juice"): "juice_prices",
    ("كم سعر الحليب", "سعر الحليب", "تكلفة الحليب", "price of milk"): "milk_prices",
    ("كم سعر الشوكولاتة", "سعر الشوكولاتة", "تكلفة الشوكولاتة", "price of chocolate"): "chocolate_prices",
    ("كم سعر الشيبس", "سعر الشيبس", "تكلفة الشيبس", "price of chips", "كم سعر المقرمشات", "سعر المقرمشات"): "chips_prices",
    
    # Comparison
    ("قارن", "مقارنة", "مقارنه", "compare", "competition", "منافسة", "منافسين", "الاسواق", "متجر اخر", "متجر آخر"): "price_comparison",
}

# Product Keywords for Info Queries
PRODUCT_KEYWORDS: List[str] = [
    "عصير المراعي", "عصير الربيع", "بارني", "بسكريم", "جالكسي", 
    "سكيتلز", "كيت كات", "لويكر", "حليب نادك", "أوريو", 
    "بروتين بار", "صن توب", "شيبس ليز", "برينجلز باربكيو"
]

# Database Queries
DATABASE_QUERIES: Dict[Tuple[str, ...], str] = {
    # Products
    ("المنتجات", "products", "product", "وش المنتجات", "ما هي المنتجات", "عرض المنتجات"): "products",
    
    # Prices
    ("الاسعار", "prices", "price", "كم السعر", "كم الاسعار", "التكلفة", "cost"): "prices",
    
    # Branches
    ("الفروع", "branches", "branch", "وين الفروع", "أين الفروع", "مواقع الفروع", "فروعكم"): "branches",
    
    # Invoices (user-specific)
    ("فواتيري", "فواتيري", "invoices", "invoice", "كم عدد فواتيري", "عرض فواتيري", "فواتيري"): "user_invoices",
    
    # General invoices
    ("الفواتير", "invoices", "invoice"): "general_invoices",
}

# Product Translations (temporary until moved to database)
PRODUCT_TRANSLATIONS: Dict[str, str] = {
    'Almarai_juice': 'عصير المراعي',
    'alrabie_juice': 'عصير الربيع',
    'Nadec_Mlik': 'حليب نادك',
    'Sun_top': 'صن توب',
    'barni': 'بارني',
    'biskrem': 'بسكريم',
    'loacker': 'لويكر',
    'oreos': 'أوريو',
    'galaxy': 'جالكسي',
    'green_skittles': 'سكيتلز أخضر',
    'kit_kat': 'كيت كات',
    'pink_skittles': 'سكيتلز وردي',
    'protein_bar': 'بروتين بار',
    'Lays_chips': 'شيبس ليز',
    'pringles_barbeque': 'برينجلز باربكيو'
}
