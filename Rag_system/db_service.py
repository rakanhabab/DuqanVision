from typing import Dict, List, Any, Optional
from supabase import create_client, Client
import logging

logger = logging.getLogger(__name__)

class DatabaseService:
    def __init__(self, supabase_url: str, supabase_key: str):
        self.supabase: Client = create_client(supabase_url, supabase_key)
        logger.info("Database service initialized")

    async def get_products(self) -> List[Dict[str, Any]]:
        """Get all products from database"""
        try:
            result = self.supabase.table("products").select("*").execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Error fetching products: {e}")
            return []

    async def get_all_products(self) -> List[Dict[str, Any]]:
        """Get all products from database (alias for get_products)"""
        return await self.get_products()

    async def get_branches(self) -> List[Dict[str, Any]]:
        """Get all branches from database"""
        try:
            result = self.supabase.table("branches").select("*").execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Error fetching branches: {e}")
            return []

    async def get_invoices(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get invoices, optionally filtered by user_id"""
        try:
            query = self.supabase.table("invoices").select("*")
            if user_id:
                query = query.eq("user_id", user_id)
            result = query.execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Error fetching invoices: {e}")
            return []

    async def get_product_translations(self) -> Dict[str, str]:
        """Get product translations from database (future enhancement)"""
        try:
            # For now, return empty dict - will be implemented when translations table is created
            # result = self.supabase.table("product_translations").select("*").execute()
            # return {row['eng_name']: row['ar_name'] for row in result.data or []}
            return {}
        except Exception as e:
            logger.error(f"Error fetching translations: {e}")
            return {}

    async def add_document(self, content: str, metadata: Dict[str, Any]) -> bool:
        """Add document to vector store"""
        try:
            # This would be implemented when vector store is set up
            # For now, just log the action
            logger.info(f"Would add document with metadata: {metadata}")
            return True
        except Exception as e:
            logger.error(f"Error adding document: {e}")
            return False
