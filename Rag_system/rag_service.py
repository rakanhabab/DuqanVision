from typing import Dict, List, Any, Optional
from collections import defaultdict
import asyncio
import openai
import logging

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import SupabaseVectorStore
from langchain.schema import Document
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory
from .config import RAGConfig

logger = logging.getLogger(__name__)

class RAGService:
    def __init__(self, config: RAGConfig):
        self.config = config
        self.llm = None
        self.embeddings = None
        self.vector_store = None
        self.chains = {}  # Store chains per user
        # Per-user memory as suggested in the refactoring plan
        self.memories = defaultdict(lambda: ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True,
            input_key="question",
            output_key="answer"
        ))
        self._initialize()

    def _initialize(self):
        """Initialize LangChain components"""
        try:
            # OpenAI LLM
            self.llm = ChatOpenAI(
                model=self.config.model_name,
                temperature=self.config.temperature,
                max_tokens=self.config.max_tokens,
                openai_api_key=self.config.openai_api_key,
            )
            logger.info("OpenAI LLM initialized")

            # Embeddings
            self.embeddings = OpenAIEmbeddings(
                openai_api_key=self.config.openai_api_key
            )
            logger.info("OpenAI Embeddings initialized")

            # Vector store
            self.vector_store = SupabaseVectorStore(
                client=None,  # Will be set when needed
                embedding=self.embeddings,
                table_name=self.config.table_name,
                query_name=self.config.query_name
            )
            logger.info("Vector store initialized")

        except Exception as e:
            logger.error(f"Error initializing RAG service: {e}")
            raise

    def get_chain(self, user_id: Optional[str] = None):
        """Get conversational chain for specific user"""
        user_key = user_id or "default"
        
        # Return existing chain if available
        if user_key in self.chains:
            return self.chains[user_key]
        
        # Create new chain for user
        memory = self.memories[user_key]
        
        try:
            chain = ConversationalRetrievalChain.from_llm(
                llm=self.llm,
                retriever=self.vector_store.as_retriever(search_kwargs={"k": 5}),
                memory=memory,
                return_source_documents=True,
                verbose=False,  # Set to False to reduce noise
                output_key="answer"
            )
            
            # Store chain for this user
            self.chains[user_key] = chain
            logger.info(f"Created new chain for user {user_key}")
            
            return chain
            
        except Exception as e:
            logger.error(f"Error creating chain for user {user_key}: {e}")
            # Return a simple fallback
            return None

    async def ask_rag(self, question: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Ask question using RAG chain with context awareness"""
        try:
            chain = self.get_chain(user_id)
            
            if chain is None:
                # Fallback response when chain creation fails
                return {
                    "answer": "عذراً، لا أستطيع الإجابة على هذا السؤال حالياً. يرجى المحاولة مرة أخرى.",
                    "source": "rag_fallback",
                    "confidence": 0.0
                }
            
            # Add context awareness to the question
            context_aware_question = self._add_context_to_question(question, user_id)
            
            resp = await chain.ainvoke({"question": context_aware_question})
            
            return {
                "answer": resp.get("answer", "عذراً، لا أستطيع الإجابة على هذا السؤال."),
                "source": "rag",
                "confidence": 0.8,
                "source_documents": resp.get("source_documents", [])
            }
        except Exception as e:
            logger.error(f"Error in RAG chain: {e}")
            return {
                "answer": "عذراً، لا أستطيع الإجابة على هذا السؤال.",
                "source": "rag_error",
                "confidence": 0.0
            }

    async def get_rag_response(self, question: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Get RAG response (alias for ask_rag)"""
        return await self.ask_rag(question, user_id)

    def _add_context_to_question(self, question: str, user_id: Optional[str] = None) -> str:
        """Add context awareness to questions with pronouns"""
        try:
            # Get recent conversation history
            memory = self.memories[user_id or "default"]
            if hasattr(memory, 'chat_memory') and memory.chat_memory.messages:
                recent_messages = memory.chat_memory.messages[-4:]  # Last 2 exchanges
                
                # Check for pronouns that need context
                pronouns = ["هو", "هي", "هذا", "هذه", "سعره", "سعرها", "سعراته", "سعراتها"]
                
                if any(pronoun in question for pronoun in pronouns):
                    # Add context from recent conversation
                    context = ""
                    for msg in recent_messages:
                        if hasattr(msg, 'content'):
                            context += f"{msg.content}\n"
                    
                    if context:
                        enhanced_question = f"سياق المحادثة السابقة:\n{context}\n\nالسؤال الحالي: {question}"
                        return enhanced_question
            
            return question
            
        except Exception as e:
            logger.error(f"Error adding context to question: {e}")
            return question

    async def get_product_info_from_web(self, product_name: str) -> str:
        """Get additional product information from OpenAI"""
        try:
            prompt = f"""
            أعطني معلومات مفيدة ومختصرة عن المنتج التالي: {product_name}
            
            أريد معلومات عن:
            - المكونات الرئيسية
            - الفوائد الصحية
            - القيمة الغذائية
            - نصائح للاستهلاك
            - معلومات عامة مثيرة للاهتمام
            
            اكتب الإجابة باللغة العربية وبشكل مختصر ومفيد.
            """
            
            response = await asyncio.to_thread(
                openai.chat.completions.create,
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "أنت مساعد متخصص في معلومات المنتجات الغذائية. أعط معلومات دقيقة ومفيدة."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300,
                temperature=0.7
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"Error getting product info from web: {e}")
            return "عذراً، لا يمكنني جلب معلومات إضافية عن هذا المنتج حالياً."

    async def add_documents(self, documents: List[Dict[str, Any]]) -> bool:
        """Add documents to vector store"""
        try:
            docs = []
            for doc in documents:
                content = doc.get('content', '')
                metadata = doc.get('metadata', {}) or {}
                docs.append(Document(page_content=content, metadata=metadata))

            splitter = RecursiveCharacterTextSplitter(
                chunk_size=self.config.chunk_size,
                chunk_overlap=self.config.chunk_overlap
            )
            split_docs = splitter.split_documents(docs)
            self.vector_store.add_documents(split_docs)
            logger.info(f"Added {len(split_docs)} chunks to vector store")
            return True
        except Exception as e:
            logger.error(f"Error adding documents: {e}")
            return False

    def clear_memory(self, user_id: Optional[str] = None):
        """Clear conversation memory for specific user"""
        try:
            if user_id:
                if user_id in self.memories:
                    self.memories[user_id].clear()
                    logger.info(f"Conversation memory cleared for user {user_id}")
            else:
                # Clear all memories
                self.memories.clear()
                logger.info("All conversation memories cleared")
        except Exception as e:
            logger.error(f"Error clearing memory: {e}")

    async def get_conversation_history(self, user_id: Optional[str] = None) -> List[Dict[str, str]]:
        """Get conversation history for specific user"""
        try:
            memory = self.memories[user_id or "default"]
            history = []
            
            if hasattr(memory, 'chat_memory') and memory.chat_memory.messages:
                messages = memory.chat_memory.messages
                
                for i in range(0, len(messages), 2):  # Process in pairs (human, ai)
                    if i + 1 < len(messages):
                        history.append({
                            "question": messages[i].content if hasattr(messages[i], 'content') else str(messages[i]),
                            "answer": messages[i + 1].content if hasattr(messages[i + 1], 'content') else str(messages[i + 1])
                        })
            
            logger.info(f"Retrieved {len(history)} conversation pairs for user {user_id}")
            return history
            
        except Exception as e:
            logger.error(f"Error getting conversation history: {e}")
            return []
