import openai
import asyncio
from typing import Dict, List, Optional, Any
import logging

logger = logging.getLogger(__name__)

class RouterService:
    """
    LLM-based question classifier and router.
    Uses OpenAI LLM to classify incoming questions and provide appropriate responses.
    """
    
    def __init__(self, openai_api_key: str, model_name: str = "gpt-3.5-turbo"):
        self.openai_api_key = openai_api_key
        self.model_name = model_name
        
        # Initialize OpenAI client
        openai.api_key = openai_api_key
        
        # Define question categories
        self.categories = [
            "greeting",
            "product_info", 
            "product_price",
            "product_list",
            "location",
            "payment",
            "general_info",
            "weather",
            "date",
            "thanks",
            "farewell",
            "capabilities",
            "company_info",
            "qr_info",
            "ai_info",
            "vending_info",
            "how_to_buy",
            "working_hours",
            "knowledge_scope",
            "platform_context"
        ]
        
        logger.info("Router service initialized")

    async def classify_question_llm(self, question: str) -> str:
        """Classify question using LLM"""
        try:
            prompt = f"""
            Classify the following question into one of these categories:
            {', '.join(self.categories)}
            
            Question: {question}
            
            Return only the category name, nothing else.
            """
            
            response = await asyncio.to_thread(
                openai.chat.completions.create,
                model=self.model_name,
                messages=[
                    {"role": "system", "content": "You are a question classifier. Return only the category name."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=50,
                temperature=0.1
            )
            
            category = response.choices[0].message.content.strip().lower()
            
            # Validate category
            if category in self.categories:
                return category
            else:
                return "general_info"  # Default fallback
                
        except Exception as e:
            logger.error(f"Error in LLM classification: {e}")
            return "general_info"

    async def get_router_response(self, question: str) -> Optional[str]:
        """Get router response based on question classification"""
        try:
            category = await self.classify_question_llm(question)
            
            # Define responses for each category
            responses = {
                "greeting": "أهلاً وسهلاً! كيف أقدر أساعدك اليوم؟",
                "thanks": "العفو! سعيد بمساعدتك.",
                "farewell": "وداعاً! نتمنى لك يوماً سعيداً.",
                "weather": "ما أقدر أجيب الطقس الآن، لكن أقدر أساعدك في التسوق من دكان فجن.",
                "date": f"التاريخ: {__import__('datetime').datetime.now().strftime('%Y/%m/%d')}",
                "capabilities": "أساعدك في: البحث عن المنتجات، معرفة الفروع، طرق الدفع، الفواتير، إلخ.",
                "company_info": "دكان فجن منصة سعودية مبتكرة تقدم تجربة تسوق ذكية؛ تدخل، تختار منتجاتك، وتخرج بدون الحاجة للوقوف عند الكاشير.",
                "qr_info": "في دكان فجن تبدأ رحلتك بمسح كود QR، ومن ثم يمكنك التسوق بحرية والدفع يتم بشكل تلقائي وسلس عند المغادرة.",
                "ai_info": "نستخدم تقنيات الذكاء الاصطناعي لتتبع المشتريات، تخصيص العروض، وضمان تجربة سلسة بدون تدخل يدوي.",
                "vending_info": "آلاتنا ليست مجرد ماكينات بيع تقليدية؛ بل هي منصات ذكية تتيح لك الدخول، اختيار المنتجات، والخروج والدفع مباشرة بدون انتظار.",
                "how_to_buy": "دكان فجن يقدم: 1) تسوق سريع عبر QR، 2) منتجات متنوعة (مشروبات، وجبات خفيفة)، 3) دفع إلكتروني آمن، 4) فروع 24/7، 5) تجربة ذكية مخصصة.",
                "payment": "ندعم في دكان فجن: مدى/بطاقات، Apple Pay/Google Pay، نقداً، وSTC Pay.",
                "working_hours": "فروع دكان فجن تعمل 24/7 لتوفير الخدمة على مدار الساعة.",
                "knowledge_scope": "نطاق معرفتي يتركز على دكان فجن: المنتجات، الفروع، الفواتير، طرق الدفع، الخدمات، والتسوق الذكي. يمكنني مساعدتك في أي استفسار حول خدماتنا.",
                "platform_context": "المنصة التي أتحدث عنها هي دكان فجن - منصة التسوق الذكي السعودية. نحن نقدم خدمات البيع الآلي الذكي مع تجربة دفع سريعة وآمنة.",
                "general_info": "دكان فجن منصة سعودية مبتكرة تقدم تجربة تسوق ذكية. كيف أقدر أساعدك؟",
                
                # These categories should fall through to other handlers
                "product_list": None,
                "product_price": None, 
                "product_info": None,
                "location": None
            }
            
            response = responses.get(category)
            
            # Return None for categories that should be handled by other services
            if response is not None:
                return response
            else:
                return None
                
        except Exception as e:
            logger.error(f"Error in router response: {e}")
            return None

    async def get_question_intent(self, question: str) -> Dict[str, Any]:
        """Get detailed intent analysis of the question"""
        try:
            category = await self.classify_question_llm(question)
            
            intent_analysis = {
                "category": category,
                "confidence": 0.9,  # High confidence for LLM classification
                "requires_database": category in ["product_list", "product_price", "product_info", "location"],
                "requires_smart_response": category in ["greeting", "thanks", "farewell", "weather", "date"],
                "requires_rag": category == "general_info"
            }
            
            return intent_analysis
            
        except Exception as e:
            logger.error(f"Error in intent analysis: {e}")
            return {
                "category": "unknown",
                "confidence": 0.0,
                "requires_database": False,
                "requires_smart_response": False,
                "requires_rag": True
            }

    async def get_enhanced_classification(self, question: str) -> Dict[str, Any]:
        """Get enhanced classification with multiple approaches"""
        try:
            # Basic LLM classification
            category = await self.classify_question_llm(question)
            
            # Enhanced analysis
            enhanced = {
                "question": question,
                "primary_category": category,
                "confidence": 0.9,
                "alternative_categories": [],
                "keywords_detected": [],
                "suggested_actions": []
            }
            
            # Add alternative categories based on keywords
            question_lower = question.lower()
            
            if "منتج" in question_lower or "product" in question_lower:
                enhanced["alternative_categories"].append("product_info")
                enhanced["keywords_detected"].append("product")
                
            if "سعر" in question_lower or "price" in question_lower or "تكلفة" in question_lower:
                enhanced["alternative_categories"].append("product_price")
                enhanced["keywords_detected"].append("price")
                
            if "فرع" in question_lower or "branch" in question_lower or "موقع" in question_lower:
                enhanced["alternative_categories"].append("location")
                enhanced["keywords_detected"].append("location")
                
            if "دفع" in question_lower or "payment" in question_lower:
                enhanced["alternative_categories"].append("payment")
                enhanced["keywords_detected"].append("payment")
            
            # Suggest actions based on category
            if category in ["product_list", "product_price", "product_info"]:
                enhanced["suggested_actions"].append("query_database")
            elif category in ["greeting", "thanks", "farewell"]:
                enhanced["suggested_actions"].append("smart_response")
            else:
                enhanced["suggested_actions"].append("rag_chain")
            
            return enhanced
            
        except Exception as e:
            logger.error(f"Error in enhanced classification: {e}")
            return {
                "question": question,
                "primary_category": "unknown",
                "confidence": 0.0,
                "alternative_categories": [],
                "keywords_detected": [],
                "suggested_actions": ["rag_chain"]
            }
