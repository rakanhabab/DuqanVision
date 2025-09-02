#!/bin/bash

# DuqanVision Render Deployment Script
# This script helps prepare and deploy your project to Render

echo "🚀 DuqanVision Render Deployment Script"
echo "========================================"

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Git repository not found. Initializing..."
    git init
    git add .
    git commit -m "Initial commit for Render deployment"
else
    echo "✅ Git repository found"
fi

# Check if render.yaml exists
if [ -f "render.yaml" ]; then
    echo "✅ render.yaml found"
else
    echo "❌ render.yaml not found. Please create it first."
    exit 1
fi

# Check if requirements-render.txt exists
if [ -f "requirements-render.txt" ]; then
    echo "✅ requirements-render.txt found"
else
    echo "❌ requirements-render.txt not found. Please create it first."
    exit 1
fi

# Check if rag_api.py exists
if [ -f "rag_api.py" ]; then
    echo "✅ rag_api.py found"
else
    echo "❌ rag_api.py not found. Please create it first."
    exit 1
fi

echo ""
echo "📋 Pre-deployment Checklist:"
echo "1. ✅ Git repository initialized"
echo "2. ✅ render.yaml created"
echo "3. ✅ requirements-render.txt created"
echo "4. ✅ rag_api.py updated for Render"
echo ""
echo "🔧 Next Steps:"
echo "1. Push your code to GitHub:"
echo "   git remote add origin <your-github-repo-url>"
echo "   git push -u origin main"
echo ""
echo "2. Go to https://render.com and:"
echo "   - Create a new account or sign in"
echo "   - Click 'New +' and select 'Web Service'"
echo "   - Connect your GitHub repository"
echo "   - Select the repository and branch"
echo "   - Render will automatically detect the render.yaml"
echo "   - Set your environment variables:"
echo "     * OPENAI_API_KEY"
echo "     * SUPABASE_URL"
echo "     * SUPABASE_KEY"
echo "   - Click 'Create Web Service'"
echo ""
echo "3. Wait for the build to complete (usually 5-10 minutes)"
echo ""
echo "🎉 Your API will be available at: https://your-service-name.onrender.com"
echo ""
echo "📝 Important Notes:"
echo "- Free tier has limitations: 15 minutes of inactivity timeout"
echo "- Environment variables are set in Render dashboard, not in code"
echo "- Build time may vary based on dependencies"
echo "- Monitor your service in the Render dashboard"
