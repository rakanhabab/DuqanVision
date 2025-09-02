# 🚀 DuqanVision Render Deployment Guide

This guide will walk you through deploying your DuqanVision project to Render.

## 📋 Prerequisites

- [Git](https://git-scm.com/) installed on your machine
- [GitHub](https://github.com/) account
- [Render](https://render.com/) account
- Your project code ready

## 🔧 Step 1: Prepare Your Project

### 1.1 Initialize Git Repository (if not already done)
```bash
git init
git add .
git commit -m "Initial commit for Render deployment"
```

### 1.2 Push to GitHub
```bash
git remote add origin <your-github-repo-url>
git push -u origin main
```

## 🌐 Step 2: Deploy to Render

### 2.1 Create Render Account
1. Go to [https://render.com](https://render.com)
2. Sign up or sign in with your GitHub account

### 2.2 Create New Web Service
1. Click the **"New +"** button
2. Select **"Web Service"**
3. Connect your GitHub repository
4. Select the repository and branch (usually `main`)

### 2.3 Configure Service
Render will automatically detect your `render.yaml` file. The configuration includes:

- **Name**: `duqanvision-api`
- **Environment**: Python
- **Plan**: Free
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn rag_api:app --host 0.0.0.0 --port $PORT`

### 2.4 Set Environment Variables
In the Render dashboard, add these environment variables:

| Variable | Description | Value |
|----------|-------------|-------|
| `OPENAI_API_KEY` | Your OpenAI API key | `sk-...` |
| `SUPABASE_URL` | Your Supabase project URL | `https://...` |
| `SUPABASE_KEY` | Your Supabase anon key | `eyJ...` |

**Important**: Never commit these values to your code!

### 2.5 Deploy
1. Click **"Create Web Service"**
2. Wait for the build to complete (5-10 minutes)
3. Your service will be available at: `https://your-service-name.onrender.com`

## 📁 Project Structure for Render

```
DuqanVision/
├── render.yaml              # Render configuration
├── requirements-render.txt  # Python dependencies
├── rag_api.py              # Main FastAPI application
├── Rag_system/             # RAG system modules
├── config.env              # Local environment (not deployed)
└── ...                     # Other project files
```

## 🔍 Monitoring Your Deployment

### Build Logs
- View build logs in the Render dashboard
- Check for any dependency installation issues
- Monitor build time and success

### Runtime Logs
- Access runtime logs in the dashboard
- Monitor API requests and responses
- Check for any runtime errors

### Health Check
Your API includes a health check endpoint:
```
GET https://your-service-name.onrender.com/
```

## ⚠️ Important Notes

### Free Tier Limitations
- **15-minute inactivity timeout**: Service goes to sleep after 15 minutes of no requests
- **Build time**: Limited to 10 minutes
- **Bandwidth**: 100GB/month
- **Sleep mode**: Service wakes up on first request (may take 30-60 seconds)

### Environment Variables
- Set sensitive variables in Render dashboard, not in code
- Use `sync: false` for sensitive variables in `render.yaml`
- Test your environment variables locally before deploying

### Dependencies
- `requirements-render.txt` is optimized for Render deployment
- Computer vision dependencies are excluded to reduce build time
- If you need them, uncomment in the requirements file

## 🚨 Troubleshooting

### Common Issues

#### Build Failures
- Check Python version compatibility
- Verify all dependencies are in `requirements-render.txt`
- Check build logs for specific error messages

#### Runtime Errors
- Verify environment variables are set correctly
- Check runtime logs for error details
- Ensure your Supabase and OpenAI credentials are valid

#### Service Not Starting
- Verify the start command in `render.yaml`
- Check if the port is correctly configured
- Ensure your FastAPI app is properly configured

### Getting Help
- Check Render's [documentation](https://render.com/docs)
- Review your build and runtime logs
- Verify your local setup works before deploying

## 🔄 Updating Your Deployment

### Automatic Updates
- Render automatically redeploys when you push to your main branch
- No manual intervention required

### Manual Updates
1. Make changes to your code
2. Commit and push to GitHub
3. Render will automatically rebuild and deploy

## 📊 Performance Optimization

### For Production Use
- Consider upgrading to a paid plan for better performance
- Implement caching strategies
- Monitor API response times
- Use connection pooling for database connections

### Monitoring
- Set up alerts for service downtime
- Monitor response times and error rates
- Track API usage and costs

## 🎉 Success!

Once deployed, your DuqanVision API will be available at:
```
https://your-service-name.onrender.com
```

You can test it with:
```bash
curl https://your-service-name.onrender.com/
```

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Render's documentation
3. Check your service logs
4. Verify your local setup works

---

**Happy Deploying! 🚀**
