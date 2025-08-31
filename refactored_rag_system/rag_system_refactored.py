import asyncio
import logging
from typing import Dict, List, Optional, Any
from config import RAGConfig
from db_service import DatabaseService
from smart_service import SmartResponseService
from rag_service import RAGService
from semantic_service import SemanticSearchService
from router_service import RouterService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RefactoredSupabaseRAG:
    """
    Refactored RAG system using modular design and configuration-based approach.
    
    This implementation addresses the maintainability issues by:
    1. Using configuration files instead of hardcoded if-else blocks
    2. Modular design with separate services
    3. Per-user memory management
    4. Cleaner separation of concerns
    """
    
    def __init__(self, config: RAGConfig):
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        # Initialize all services
        self.db_service = DatabaseService(config.supabase_url, config.supabase_key)
        self.smart_service = SmartResponseService()
        self.rag_service = RAGService(config)
        
        # Initialize new services for enhanced understanding
        self.semantic_service = SemanticSearchService(
            config.openai_api_key, 
            config.supabase_url, 
            config.supabase_key
        )
        self.router_service = RouterService(
            config.openai_api_key, 
            config.model_name
        )
        
        self.logger.info("Refactored RAG system initialized with all three approaches")

    async def ask_question(self, question: str, user_id: Optional[str] = None, user_name: Optional[str] = None) -> Dict[str, Any]:
        """Ask question using optimized approach: Keywords first, then LLM Router, then Semantic as fallback"""
        try:
            if not question:
                return {
                    "answer": "عذراً، لم أفهم سؤالك. هل يمكنك إعادة صياغته؟",
                    "source": "error",
                    "confidence": 0.0,
                    "method": "error"
                }
            
            # Track which method was used
            method_used = "unknown"
            confidence = 0.0
            
            # Approach 1: Keyword Matching (Fastest) - Always try first
            self.logger.info("Trying Approach 1: Keyword Matching")
            smart_response = self.smart_service.get_smart_response(question, user_name)
            if smart_response:
                await self._save_to_memory(question, smart_response, user_id)
                return {
                    "answer": smart_response,
                    "source": "smart_response",
                    "confidence": 0.95,
                    "method": "keyword_matching"
                }
            
            # Approach 2: LLM Router (Fast and Intelligent) - Try second
            self.logger.info("Trying Approach 2: LLM Router")
            router_response = await self.router_service.get_router_response(question)
            if router_response:
                await self._save_to_memory(question, router_response, user_id)
                return {
                    "answer": router_response,
                    "source": "llm_router",
                    "confidence": 0.90,
                    "method": "llm_router"
                }
            
            # Approach 3: Semantic Search (Slow but thorough) - Only if needed
            # Skip semantic search for now to prioritize speed
            # self.logger.info("Trying Approach 3: Semantic Search")
            # semantic_response = await self.semantic_service.get_semantic_response(question)
            # if semantic_response:
            #     await self._save_to_memory(question, semantic_response, user_id)
            #     return {
            #         "answer": semantic_response,
            #         "source": "semantic_search",
            #         "confidence": 0.85,
            #         "method": "semantic_search"
            #     }
            
            # If all approaches fail, try smart product queries
            self.logger.info("Trying Smart Product Queries")
            smart_product_query = self.smart_service.get_smart_product_query(question)
            if smart_product_query:
                result = await self._handle_smart_product_query(smart_product_query, user_id)
                if result:
                    await self._save_to_memory(question, result["answer"], user_id)
                    return result
            
            # Try database queries
            self.logger.info("Trying Database Queries")
            db_query = self.smart_service.get_database_query(question)
            if db_query:
                result = await self._handle_database_query(db_query, user_id)
                if result:
                    await self._save_to_memory(question, result["answer"], user_id)
                    return result
            
            # Final fallback: RAG Chain
            self.logger.info("Trying RAG Chain (Final Fallback)")
            rag_result = await self.rag_service.get_rag_response(question, user_id)
            if rag_result:
                await self._save_to_memory(question, rag_result["answer"], user_id)
                return {
                    "answer": rag_result["answer"],
                    "source": "rag_chain",
                    "confidence": rag_result.get("confidence", 0.7),
                    "method": "rag_chain"
                }
            
            # If nothing works, return default response
            default_response = "عذراً، لا أستطيع فهم سؤالك. هل يمكنك إعادة صياغته بطريقة أخرى؟"
            await self._save_to_memory(question, default_response, user_id)
            return {
                "answer": default_response,
                "source": "default",
                "confidence": 0.0,
                "method": "fallback"
            }
            
        except Exception as e:
            self.logger.error(f"Error in ask_question: {e}")
            return {
                "answer": "عذراً، حدث خطأ في معالجة سؤالك. يرجى المحاولة مرة أخرى.",
                "source": "error",
                "confidence": 0.0,
                "method": "error"
            }

    async def get_question_analysis(self, question: str) -> Dict[str, Any]:
        """Get detailed analysis of question using all three approaches"""
        try:
            analysis = {
                "question": question,
                "approaches": {}
            }
            
            # Approach 1: Keyword Analysis
            smart_response = self.smart_service.get_smart_response(question)
            analysis["approaches"]["keyword_matching"] = {
                "success": bool(smart_response),
                "response": smart_response,
                "confidence": 0.95 if smart_response else 0.0
            }
            
            # Approach 2: Semantic Analysis
            semantic_response = await self.semantic_service.get_semantic_response(question)
            category, confidence = await self.semantic_service.classify_question_semantic(question)
            analysis["approaches"]["semantic_search"] = {
                "success": bool(semantic_response),
                "response": semantic_response,
                "category": category,
                "confidence": confidence
            }
            
            # Approach 3: LLM Router Analysis
            router_response = await self.router_service.get_router_response(question)
            intent = await self.router_service.get_question_intent(question)
            analysis["approaches"]["llm_router"] = {
                "success": bool(router_response),
                "response": router_response,
                "intent": intent
            }
            
            return analysis
            
        except Exception as e:
            self.logger.error(f"Error in get_question_analysis: {e}")
            return {
                "question": question,
                "error": str(e),
                "approaches": {}
            }

    async def _handle_smart_product_query(self, query_type: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Handle smart product queries"""
        try:
            if query_type == "smart_product_query: context_pronoun":
                products = await self.db_service.get_all_products()
                return await self._handle_context_pronoun_query(products, user_id)
            
            elif query_type.startswith("smart_product_query: product_info:"):
                product_name = query_type.split(":", 2)[2]
                products = await self.db_service.get_all_products()
                product = next((p for p in products if self.smart_service.translate_product_name(p.get('name', '')).lower() == product_name.lower()), None)
                
                if product:
                    return await self._format_product_info(product)
                else:
                    return {
                        "answer": f"عذراً، لا أستطيع العثور على معلومات عن {product_name}",
                        "source": "database",
                        "confidence": 0.0
                    }
            
            elif query_type == "smart_product_query: juice_prices":
                products = await self.db_service.get_all_products()
                juice_products = [p for p in products if 'juice' in p.get('name', '').lower() or 'عصير' in self.smart_service.translate_product_name(p.get('name', '')).lower()]
                
                if juice_products:
                    result = "أسعار العصائر:\n"
                    for product in juice_products:
                        name = self.smart_service.translate_product_name(product.get('name', ''))
                        price = product.get('price', 0)
                        result += f"• {name}: {price} ر.س\n"
                    
                    return {
                        "answer": result,
                        "source": "database",
                        "confidence": 1.0
                    }
                else:
                    return {
                        "answer": "عذراً، لا تتوفر معلومات عن أسعار العصائر حالياً",
                        "source": "database",
                        "confidence": 0.0
                    }
            
            elif query_type == "smart_product_query: chips_prices":
                products = await self.db_service.get_all_products()
                chips_products = [p for p in products if 'chips' in p.get('name', '').lower() or 'شيبس' in self.smart_service.translate_product_name(p.get('name', '')).lower()]
                
                if chips_products:
                    result = "أسعار الشيبس:\n"
                    for product in chips_products:
                        name = self.smart_service.translate_product_name(product.get('name', ''))
                        price = product.get('price', 0)
                        result += f"• {name}: {price} ر.س\n"
                    
                    return {
                        "answer": result,
                        "source": "database",
                        "confidence": 1.0
                    }
                else:
                    return {
                        "answer": "عذراً، لا تتوفر معلومات عن أسعار الشيبس حالياً",
                        "source": "database",
                        "confidence": 0.0
                    }
            
            elif query_type == "smart_product_query: milk_prices":
                products = await self.db_service.get_all_products()
                milk_products = [p for p in products if 'milk' in p.get('name', '').lower() or 'حليب' in self.smart_service.translate_product_name(p.get('name', '')).lower()]
                
                if milk_products:
                    result = "أسعار الحليب:\n"
                    for product in milk_products:
                        name = self.smart_service.translate_product_name(product.get('name', ''))
                        price = product.get('price', 0)
                        result += f"• {name}: {price} ر.س\n"
                    
                    return {
                        "answer": result,
                        "source": "database",
                        "confidence": 1.0
                    }
                else:
                    return {
                        "answer": "عذراً، لا تتوفر معلومات عن أسعار الحليب حالياً",
                        "source": "database",
                        "confidence": 0.0
                    }
            
            elif query_type == "smart_product_query: chocolate_prices":
                products = await self.db_service.get_all_products()
                chocolate_products = [p for p in products if 'chocolate' in p.get('name', '').lower() or 'شوكولاتة' in self.smart_service.translate_product_name(p.get('name', '')).lower()]
                
                if chocolate_products:
                    result = "أسعار الشوكولاتة:\n"
                    for product in chocolate_products:
                        name = self.smart_service.translate_product_name(product.get('name', ''))
                        price = product.get('price', 0)
                        result += f"• {name}: {price} ر.س\n"
                    
                    return {
                        "answer": result,
                        "source": "database",
                        "confidence": 1.0
                    }
                else:
                    return {
                        "answer": "عذراً، لا تتوفر معلومات عن أسعار الشوكولاتة حالياً",
                        "source": "database",
                        "confidence": 0.0
                    }
            
            # Handle other smart product queries
            products = await self.db_service.get_all_products()
            
            if query_type == "smart_product_query: highest_price":
                if products:
                    max_product = max(products, key=lambda x: x.get('price', 0))
                    return await self._format_product_info(max_product)
            
            elif query_type == "smart_product_query: lowest_price":
                if products:
                    min_product = min(products, key=lambda x: x.get('price', 0))
                    return await self._format_product_info(min_product)
            
            elif query_type == "smart_product_query: highest_calories":
                if products:
                    max_product = self.smart_service.get_highest_calorie_product(products)
                    if max_product and max_product.get('name'):  # Check if product has name
                        return await self._format_product_info(max_product)
                    else:
                        return {
                            "answer": "عذراً، لا أستطيع العثور على معلومات السعرات الحرارية للمنتجات",
                            "source": "database",
                            "confidence": 0.0
                        }
                else:
                    return {
                        "answer": "عذراً، لا توجد منتجات متوفرة حالياً",
                        "source": "database",
                        "confidence": 0.0
                    }
            
            elif query_type == "smart_product_query: lowest_calories":
                if products:
                    min_product = self.smart_service.get_lowest_calorie_product(products)
                    if min_product and min_product.get('name'):  # Check if product has name
                        return await self._format_product_info(min_product)
                    else:
                        return {
                            "answer": "عذراً، لا أستطيع العثور على معلومات السعرات الحرارية للمنتجات",
                            "source": "database",
                            "confidence": 0.0
                        }
                else:
                    return {
                        "answer": "عذراً، لا توجد منتجات متوفرة حالياً",
                        "source": "database",
                        "confidence": 0.0
                    }
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error in _handle_smart_product_query: {e}")
            return None

    async def _handle_database_query(self, query_type: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Handle database queries"""
        try:
            if query_type == "products":
                products = await self.db_service.get_all_products()
                if products:
                    result = "المنتجات المتوفرة:\n"
                    for product in products[:10]:  # Limit to first 10
                        name = self.smart_service.translate_product_name(product.get('name', ''))
                        price = product.get('price', 0)
                        result += f"• {name}: {price} ر.س\n"
                    
                    if len(products) > 10:
                        result += f"\n... والمزيد من المنتجات ({len(products)} منتج إجمالاً)"
                    
                    return {
                        "answer": result,
                        "source": "database",
                        "confidence": 1.0
                    }
            
            elif query_type == "branches":
                branches = await self.db_service.get_branches()
                if branches:
                    result = "فروع دكان فجن:\n"
                    for branch in branches:
                        name = branch.get('name', '')
                        city = branch.get('city', '')
                        address = branch.get('address', '')
                        working_hours = branch.get('working_hours', '24/7')
                        
                        result += f"• {name} - {city}\n"
                        if address:
                            result += f"  📍 {address}\n"
                        result += f"  🕒 {working_hours}\n\n"
                    
                    return {
                        "answer": result,
                        "source": "database",
                        "confidence": 1.0
                    }
                else:
                    return {
                        "answer": "عذراً، لا تتوفر معلومات الفروع حالياً.",
                        "source": "database",
                        "confidence": 0.0
                    }
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error in _handle_database_query: {e}")
            return None

    async def _save_to_memory(self, question: str, answer: str, user_id: Optional[str] = None):
        """Save conversation to memory for context awareness"""
        try:
            memory = self.rag_service.memories[user_id or "default"]
            if hasattr(memory, 'chat_memory'):
                memory.chat_memory.add_user_message(question)
                memory.chat_memory.add_ai_message(answer)
                self.logger.info(f"Saved conversation to memory for user {user_id}")
        except Exception as e:
            self.logger.error(f"Error saving to memory: {e}")

    async def clear_memory(self, user_id: Optional[str] = None):
        """Clear conversation memory for specific user"""
        try:
            await self.rag_service.clear_memory(user_id)
            self.logger.info(f"Cleared memory for user {user_id}")
        except Exception as e:
            self.logger.error(f"Error clearing memory: {e}")

    async def get_conversation_history(self, user_id: Optional[str] = None) -> List[Dict[str, str]]:
        """Get conversation history for specific user"""
        try:
            return await self.rag_service.get_conversation_history(user_id)
        except Exception as e:
            self.logger.error(f"Error getting conversation history: {e}")
            return []

    async def _handle_context_pronoun_query(self, products: List[Dict], user_id: Optional[str] = None) -> Dict[str, Any]:
        """Handle context-aware questions using conversation history"""
        try:
            # Get conversation history
            history = await self.get_conversation_history(user_id)
            
            if not history or len(history) < 2:
                return {
                    "answer": "عذراً، لا أستطيع فهم السياق. هل يمكنك تحديد المنتج الذي تريد معرفة معلوماته؟",
                    "source": "context_error",
                    "confidence": 0.0
                }
            
            # Look for the most recent product mentioned
            recent_question = history[-1].get('question', '').lower()
            
            # Try to find product in recent question
            for product in products:
                product_name = self.smart_service.translate_product_name(product.get('name', '')).lower()
                if product_name in recent_question:
                    return await self._format_product_info(product)
            
            # If no product found, return generic response
            return {
                "answer": "عذراً، لا أستطيع تحديد المنتج من السياق. هل يمكنك تحديد المنتج الذي تريد معرفة معلوماته؟",
                "source": "context_error",
                "confidence": 0.0
            }
            
        except Exception as e:
            self.logger.error(f"Error in context pronoun query: {e}")
            return {
                "answer": "عذراً، حدث خطأ في معالجة السؤال السياقي.",
                "source": "error",
                "confidence": 0.0
            }

    async def _format_product_info(self, product: Dict) -> Dict[str, Any]:
        """Format product information"""
        try:
            name = self.smart_service.translate_product_name(product.get('name', ''))
            price = product.get('price', 0)
            calories = product.get('calories', 0)
            shelf = product.get('shelf', '')
            
            result = f"معلومات {name}:\n"
            result += f"💰 السعر: {price} ر.س\n"
            if calories > 0:
                result += f"🔥 السعرات الحرارية: {calories} سعرة حرارية\n"
            if shelf:
                result += f"📍 الموقع: {shelf}"
            
            # Try to get additional info from web
            try:
                web_info = await self.rag_service.get_product_info_from_web(name)
                if web_info:
                    result += f"\n\n{web_info}"
            except Exception as e:
                self.logger.warning(f"Could not fetch web info for {name}: {e}")
            
            return {
                "answer": result,
                "source": "database",
                "confidence": 1.0
            }
            
        except Exception as e:
            self.logger.error(f"Error formatting product info: {e}")
            return {
                "answer": "عذراً، حدث خطأ في تنسيق معلومات المنتج.",
                "source": "error",
                "confidence": 0.0
            }
