#!/usr/bin/env python3
"""
Simple script to start the RAG API server
"""

import uvicorn
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv("config.env")

def main():
    print("🚀 Starting Refactored RAG API Server...")
    print("📍 Server will run on: http://localhost:8001")
    print("📝 Press Ctrl+C to stop the server")
    print("=" * 60)
    
    # Check environment variables
    required_vars = ["OPENAI_API_KEY", "SUPABASE_URL", "SUPABASE_KEY"]
    missing = []
    
    for var in required_vars:
        if not os.getenv(var):
            missing.append(var)
    
    if missing:
        print(f"❌ Missing environment variables: {', '.join(missing)}")
        print("Please check your config.env file")
        return
    
    print("✅ Environment variables loaded successfully")
    print("🆕 New Features Available:")
    print("   📦 Modular design with separate services")
    print("   ⚙️  Configuration-based responses")
    print("   🧠 Per-user memory management")
    print("   🆕 New products: شيبس ليز, برينجلز باربكيو")
    print("=" * 60)
    
    # Start the server
    uvicorn.run(
        "rag_api:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )

if __name__ == "__main__":
    main()
