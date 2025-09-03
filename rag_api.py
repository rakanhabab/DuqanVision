import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from contextlib import asynccontextmanager

# Import the refactored RAG system
from Rag_system.rag_system_refactored import RefactoredSupabaseRAG
from Rag_system.config import RAGConfig

# Environment variables - will work with both local .env and Render environment
from dotenv import load_dotenv
load_dotenv("config.env")  # Load local .env if exists

# Get environment variables (prioritize Render environment variables)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# For Render deployment, these should be set as environment variables
if not all([OPENAI_API_KEY, SUPABASE_URL, SUPABASE_KEY]):
    raise RuntimeError("Missing required environment variables: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_KEY")

rag_system: Optional[RefactoredSupabaseRAG] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag_system
    try:
        # Ensure no proxy env vars leak into HTTP clients used by dependencies
        for key in [
            "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY",
            "http_proxy", "https_proxy", "all_proxy", "no_proxy",
        ]:
            if key in os.environ:
                os.environ.pop(key, None)

        config = RAGConfig(
            openai_api_key=OPENAI_API_KEY,
            supabase_url=SUPABASE_URL,
            supabase_key=SUPABASE_KEY
        )
        rag_system = RefactoredSupabaseRAG(config)
        print("✅ Refactored RAG system initialized successfully!")
        print("📦 New features available:")
        print("   - Modular design with separate services")
        print("   - Configuration-based responses")
        print("   - Per-user memory management")
        print("   - New products: شيبس ليز, برينجلز باربكيو")
    except Exception as e:
        # Print helpful diagnostics to identify the exact source of the error
        try:
            import supabase as _supabase
            import httpx as _httpx
            import openai as _openai
            import postgrest as _postgrest
            print(
                "📦 Versions =>",
                {
                    "supabase": getattr(_supabase, "__version__", "unknown"),
                    "postgrest": getattr(_postgrest, "__version__", "unknown"),
                    "httpx": getattr(_httpx, "__version__", "unknown"),
                    "openai": getattr(_openai, "__version__", "unknown"),
                },
            )
        except Exception:
            pass
        import traceback
        traceback.print_exc()
        print(f"❌ Init error: {e}")
    yield
    rag_system = None
    print("🛑 Refactored RAG system stopped")

app = FastAPI(lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=False,  # Set to False when allow_origins=["*"]
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Models
class QuestionRequest(BaseModel):
    question: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None

class DocumentRequest(BaseModel):
    documents: List[Dict[str, Any]]

# Routes
@app.get("/")
async def root():
    return {
        "status": "running", 
        "version": "2.0.0",
        "system": "refactored_rag",
        "features": [
            "modular_design",
            "configuration_based",
            "per_user_memory",
            "new_products"
        ],
        "new_products": [
            "شيبس ليز (Lays_chips)",
            "برينجلز باربكيو (pringles_barbeque)"
        ]
    }

@app.options("/ask")
async def options_ask():
    return {"message": "OK"}

@app.post("/ask")
async def ask(req: QuestionRequest):
    try:
        # Validate question
        if not req.question or not req.question.strip():
            return JSONResponse(content={
                "answer": "يرجى إدخال سؤال صحيح.",
                "source": "validation_error",
                "confidence": 0,
                "timestamp": datetime.now().isoformat()
            }, status_code=400)
        
        # Clean and normalize the question
        question = req.question.strip()
        print(f"🔍 Processing question: '{question}'")
        print(f"👤 User ID: {req.user_id}")
        print(f"📝 User Name: {req.user_name}")
        
        # Check if RAG system is initialized
        if not rag_system:
            return JSONResponse(content={
                "answer": "عذراً، النظام غير جاهز حالياً. يرجى المحاولة مرة أخرى.",
                "source": "system_error",
                "confidence": 0,
                "timestamp": datetime.now().isoformat()
            }, status_code=503)
        
        # Use the new refactored system
        result = await rag_system.ask_question(question, req.user_id, req.user_name)
        
        print(f"✅ Response source: {result['source']}")
        print(f"📊 Confidence: {result['confidence']}")
        
        return JSONResponse(content={
            "answer": result["answer"],
            "source": result["source"],
            "confidence": result["confidence"],
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        print(f"Error in /ask endpoint: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(content={
            "answer": "عذراً، حدث خطأ في معالجة سؤالك. يرجى المحاولة مرة أخرى.",
            "source": "error",
            "confidence": 0,
            "timestamp": datetime.now().isoformat()
        }, status_code=500)

@app.get("/products")
async def get_products():
    try:
        products = await rag_system.db_service.get_products()
        formatted = rag_system.smart_service.format_products(products)
        return JSONResponse(content={
            "products": products,
            "formatted": formatted,
            "count": len(products),
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting products: {str(e)}")

@app.get("/branches")
async def get_branches():
    try:
        branches = await rag_system.db_service.get_branches()
        formatted = rag_system.smart_service.format_branches(branches)
        return JSONResponse(content={
            "branches": branches,
            "formatted": formatted,
            "count": len(branches),
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting branches: {str(e)}")

@app.get("/invoices/{user_id}")
async def get_user_invoices(user_id: str):
    try:
        invoices = await rag_system.db_service.get_invoices(user_id)
        formatted = rag_system.smart_service.format_invoices(invoices)
        return JSONResponse(content={
            "invoices": invoices,
            "formatted": formatted,
            "user_id": user_id,
            "count": len(invoices),
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting invoices: {str(e)}")

@app.post("/documents")
async def add_documents(req: DocumentRequest):
    try:
        success = await rag_system.add_documents(req.documents)
        if success:
            return JSONResponse(content={
                "message": f"Added {len(req.documents)} documents successfully",
                "timestamp": datetime.now().isoformat()
            })
        raise HTTPException(status_code=500, detail="Failed to add documents")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding documents: {str(e)}")

@app.get("/conversation-history")
async def get_conversation_history(user_id: Optional[str] = None):
    try:
        history = await rag_system.get_conversation_history(user_id)
        return JSONResponse(content={
            "history": history,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting conversation history: {str(e)}")

@app.delete("/conversation-history")
async def clear_conversation_history(user_id: Optional[str] = None):
    try:
        rag_system.clear_memory(user_id)
        return JSONResponse(content={
            "message": "Conversation history cleared successfully",
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing conversation history: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
