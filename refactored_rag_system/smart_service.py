from typing import Dict, List, Tuple, Callable, Optional, Any
from config import SMART_RESPONSES, SMART_PRODUCT_QUERIES, PRODUCT_KEYWORDS, DATABASE_QUERIES, PRODUCT_TRANSLATIONS, REGEX_PATTERNS
import logging
import re

logger = logging.getLogger(__name__)

class SmartResponseService:
    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def get_smart_response(self, question: str, user_name: Optional[str] = None) -> Optional[str]:
        """Get smart response using configuration-based approach with regex support"""
        if not question:
            return None
            
        q = question.lower().strip()
        
        # First, try regex patterns for flexible matching
        regex_match = self._match_regex_patterns(q)
        if regex_match:
            return regex_match
        
        # Then check smart responses
        for keywords, response_func in SMART_RESPONSES.items():
            if any(keyword in q for keyword in keywords):
                return response_func(user_name)
        
        return None

    def _match_regex_patterns(self, question: str) -> Optional[str]:
        """Match question against regex patterns for flexible understanding"""
        try:
            # Price queries
            if re.search(REGEX_PATTERNS["price_query"], question, re.IGNORECASE):
                return "أستطيع مساعدتك في معرفة أسعار المنتجات. ما هو المنتج الذي تريد معرفة سعره؟"
            
            # Location queries
            if re.search(REGEX_PATTERNS["location_query"], question, re.IGNORECASE):
                return "لدينا فروع دكان فجن في الرياض وجدة والدمام والخبر والمدينة. أي مدينة تريد معرفة فرعها؟"
            
            # Product info queries
            if re.search(REGEX_PATTERNS["product_info"], question, re.IGNORECASE):
                return "أستطيع مساعدتك في معرفة معلومات المنتجات. ما هو المنتج الذي تريد معرفة معلوماته؟"
            
            # Working hours queries
            if re.search(REGEX_PATTERNS["hours_query"], question, re.IGNORECASE):
                return "فروع دكان فجن تعمل 24/7 لتوفير الخدمة على مدار الساعة."
            
            # Payment queries
            if re.search(REGEX_PATTERNS["payment_query"], question, re.IGNORECASE):
                return "ندعم في دكان فجن: مدى/بطاقات، Apple Pay/Google Pay، نقداً، وSTC Pay."
            
            return None
            
        except Exception as e:
            logger.error(f"Error in regex matching: {e}")
            return None

    def get_smart_product_query(self, question: str) -> Optional[str]:
        """Get smart product query type with enhanced matching"""
        if not question:
            return None
            
        q = question.lower().strip()
        
        # Check for context-aware questions (pronouns)
        context_pronouns = ["هو", "هي", "هذا", "هذه", "سعره", "سعرها", "سعراته", "سعراتها", "كم سعره", "كم سعرها"]
        if any(pronoun in q for pronoun in context_pronouns):
            return "smart_product_query: context_pronoun"
        
        # Check smart product queries with enhanced variations FIRST (higher priority)
        for keywords, query_type in SMART_PRODUCT_QUERIES.items():
            if any(keyword in q for keyword in keywords):
                return f"smart_product_query: {query_type}"
        
        # Enhanced product keyword matching with variations (lower priority)
        for product in PRODUCT_KEYWORDS:
            if product.lower() in q:
                return f"smart_product_query: product_info:{product}"
        
        return None

    def get_database_query(self, question: str) -> Optional[str]:
        """Get database query type with enhanced matching"""
        if not question:
            return None
            
        q = question.lower().strip()
        
        # Check database queries with enhanced variations
        for keywords, query_type in DATABASE_QUERIES.items():
            if any(keyword in q for keyword in keywords):
                return query_type
        
        return None

    def translate_product_name(self, name: str) -> str:
        """Translate product name from English to Arabic"""
        return PRODUCT_TRANSLATIONS.get(name, name)

    def format_products(self, products: List[Dict], show_prices: bool = True) -> str:
        """Format products for display"""
        if not products:
            return "لا توجد منتجات متوفرة."
        
        out = []
        for i, p in enumerate(products, 1):
            name = self.translate_product_name(p.get('name', ''))
            if show_prices:
                price = p.get('price', 0)
                out.append(f"{i}. {name} - {price} ر.س")
            else:
                out.append(f"{i}. {name}")
        return "\n".join(out)

    def format_branches(self, branches: List[Dict]) -> str:
        """Format branches for display"""
        if not branches:
            return "لا توجد فروع متوفرة."
        
        out = []
        for i, b in enumerate(branches, 1):
            out.append(f"{i}. {b.get('name','')} - {b.get('address','')}")
        return "\n".join(out)

    def format_invoices(self, invoices: List[Dict]) -> str:
        """Format invoices for display"""
        if not invoices:
            return "لا توجد فواتير لهذا المستخدم."
        
        out = []
        for i, inv in enumerate(invoices, 1):
            out.append(f"{i}. ID: {inv.get('id','')}, المجموع: {inv.get('total_amount',0)} ر.س, الحالة: {inv.get('status','')}")
        return "\n".join(out)

    def get_highest_price_product(self, products: List[Dict]) -> Dict:
        """Get product with highest price"""
        if not products:
            return {}
        return max(products, key=lambda x: x.get('price', 0))

    def get_lowest_price_product(self, products: List[Dict]) -> Dict:
        """Get product with lowest price"""
        if not products:
            return {}
        return min(products, key=lambda x: x.get('price', 0))

    def get_highest_calorie_product(self, products: List[Dict]) -> Dict:
        """Get product with highest calories"""
        if not products:
            return {}
        return max(products, key=lambda x: x.get('calories', 0))

    def get_lowest_calorie_product(self, products: List[Dict]) -> Dict:
        """Get product with lowest calories"""
        if not products:
            return {}
        return min(products, key=lambda x: x.get('calories', 0))
