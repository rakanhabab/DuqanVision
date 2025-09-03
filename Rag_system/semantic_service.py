import openai
import numpy as np
from typing import Dict, List, Tuple, Optional, Any
import logging
from supabase import create_client, Client
import asyncio
import os
import httpx

logger = logging.getLogger(__name__)

class SemanticSearchService:
    """
    Semantic search service using OpenAI embeddings and cosine similarity.
    Provides semantic understanding of questions beyond keyword matching.
    """
    
    def __init__(self, openai_api_key: str, supabase_url: str, supabase_key: str):
        self.openai_api_key = openai_api_key
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        
        # Initialize OpenAI client
        openai.api_key = openai_api_key
        
        # Initialize Supabase client with optional proxy via httpx
        proxies = {}
        http_proxy = os.getenv("HTTP_PROXY")
        https_proxy = os.getenv("HTTPS_PROXY")
        if http_proxy:
            proxies["http://"] = http_proxy
        if https_proxy:
            proxies["https://"] = https_proxy

        http_client = httpx.Client(proxies=proxies or None, timeout=30.0)

        self.supabase: Client = create_client(
            supabase_url,
            supabase_key,
            http_client=http_client,
        )
        
        # Define semantic patterns for different question categories
        self.semantic_patterns = {
            "greeting": [
                "مرحبا", "اهلا", "السلام عليكم", "صباح الخير", "مساء الخير",
                "hello", "hi", "good morning", "good evening"
            ],
            "product_info": [
                "معلومات المنتج", "تفاصيل المنتج", "وصف المنتج", "ما هو المنتج",
                "product information", "product details", "product description"
            ],
            "price_query": [
                "كم السعر", "ما هو السعر", "تكلفة المنتج", "سعر المنتج",
                "price", "cost", "how much", "what is the price"
            ],
            "location_query": [
                "أين الفروع", "مواقع الفروع", "أين يمكنني العثور", "فروعكم",
                "branches", "locations", "where can I find", "your branches"
            ],
            "payment_query": [
                "كيف أدفع", "طرق الدفع", "وسائل الدفع", "هل تقبلون",
                "payment methods", "how to pay", "do you accept"
            ],
            "general_info": [
                "معلومات عامة", "عن الشركة", "عن المنصة", "ما هي الخدمة",
                "general information", "about the company", "about the platform"
            ]
        }
        
        logger.info("Semantic search service initialized")

    async def get_embeddings(self, text: str) -> List[float]:
        """Get embeddings for text using OpenAI"""
        try:
            response = await asyncio.to_thread(
                openai.embeddings.create,
                model="text-embedding-ada-002",
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Error getting embeddings: {e}")
            return []

    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        try:
            vec1 = np.array(vec1)
            vec2 = np.array(vec2)
            
            dot_product = np.dot(vec1, vec2)
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
                
            return dot_product / (norm1 * norm2)
        except Exception as e:
            logger.error(f"Error calculating cosine similarity: {e}")
            return 0.0

    async def classify_question_semantic(self, question: str) -> Tuple[str, float]:
        """Classify question using semantic similarity"""
        try:
            question_embedding = await self.get_embeddings(question)
            if not question_embedding:
                return "unknown", 0.0
            
            best_category = "unknown"
            best_similarity = 0.0
            
            for category, patterns in self.semantic_patterns.items():
                for pattern in patterns:
                    pattern_embedding = await self.get_embeddings(pattern)
                    if pattern_embedding:
                        similarity = self.cosine_similarity(question_embedding, pattern_embedding)
                        if similarity > best_similarity:
                            best_similarity = similarity
                            best_category = category
            
            return best_category, best_similarity
            
        except Exception as e:
            logger.error(f"Error in semantic classification: {e}")
            return "unknown", 0.0

    async def get_semantic_response(self, question: str) -> Optional[str]:
        """Get semantic-based response for question"""
        try:
            category, confidence = await self.classify_question_semantic(question)
            
            if confidence < 0.7:  # Low confidence threshold
                return None
            
            # Return category-specific responses
            responses = {
                "greeting": "أهلاً وسهلاً! كيف أقدر أساعدك اليوم؟",
                "product_info": "أستطيع مساعدتك في معرفة معلومات المنتجات. ما هو المنتج الذي تريد معرفة معلوماته؟",
                "price_query": "أستطيع مساعدتك في معرفة أسعار المنتجات. ما هو المنتج الذي تريد معرفة سعره؟",
                "location_query": "لدينا فروع دكان فجن في الرياض وجدة والدمام والخبر والمدينة. أي مدينة تريد معرفة فرعها؟",
                "payment_query": "ندعم في دكان فجن: مدى/بطاقات، Apple Pay/Google Pay، نقداً، وSTC Pay.",
                "general_info": "دكان فجن منصة سعودية مبتكرة تقدم تجربة تسوق ذكية. كيف أقدر أساعدك؟"
            }
            
            return responses.get(category)
            
        except Exception as e:
            logger.error(f"Error getting semantic response: {e}")
            return None

    async def store_question_embedding(self, question: str, category: str) -> bool:
        """Store question embedding in vector database for future reference"""
        try:
            embedding = await self.get_embeddings(question)
            if not embedding:
                return False
            
            # Store in Supabase vector store
            data = {
                "content": question,
                "category": category,
                "embedding": embedding
            }
            
            result = self.supabase.table("question_embeddings").insert(data).execute()
            return bool(result.data)
            
        except Exception as e:
            logger.error(f"Error storing question embedding: {e}")
            return False

    async def find_similar_questions(self, question: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Find similar questions from stored embeddings"""
        try:
            question_embedding = await self.get_embeddings(question)
            if not question_embedding:
                return []
            
            # Query vector store for similar questions
            result = self.supabase.rpc(
                "match_question_embeddings",
                {
                    "query_embedding": question_embedding,
                    "match_threshold": 0.7,
                    "match_count": limit
                }
            ).execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Error finding similar questions: {e}")
            return []
