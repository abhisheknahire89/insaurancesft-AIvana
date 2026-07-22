# Vercel Deployment Guide

## Overview
This application is a Vite + React frontend with serverless API handlers for Vercel deployment.

## Prerequisites
- Node.js 18+ installed
- Vercel CLI (`npm install -g vercel`)
- GitHub repository connected to Vercel (recommended)

## Environment Variables Setup

Before deploying, configure these environment variables in Vercel:

1. **GEMINI_API_KEY** - Google Generative AI API key (server-side)
   - Used by `/api/gemini.ts` handler
   - Obtained from: https://ai.google.dev

2. **VITE_GEMINI_API_KEY** - Frontend Gemini API key (optional, client-side)
   - Used by frontend directly if API proxy unavailable
   - Same value as GEMINI_API_KEY

3. **DATABASE_URL** - (Optional) Database connection string
   - Used for user auth persistence
   - If not provided, mock auth is used

## Deployment Steps

### Option 1: Vercel CLI (Recommended for First Deploy)

```bash
# Install Vercel CLI globally (if not already installed)
npm install -g vercel

# Navigate to project directory
cd "V1 tpa insaurance"

# Deploy to Vercel
vercel

# On first deployment, you'll be prompted to:
# 1. Select organization/account
# 2. Set project name
# 3. Confirm directory structure
# 4. Deploy (will create vercel.json if needed)

# For production deployment
vercel --prod
```

### Option 2: GitHub Integration (Recommended for Ongoing Deployments)

1. **Push code to GitHub**
   ```bash
   cd "V1 tpa insaurance"
   git push origin main
   ```

2. **Connect GitHub to Vercel**
   - Go to https://vercel.com
   - Click "Add New Project"
   - Select GitHub repository
   - Click "Import"

3. **Configure Environment Variables**
   - In Vercel dashboard, go to Settings → Environment Variables
   - Add:
     - `GEMINI_API_KEY`: your API key
     - `VITE_GEMINI_API_KEY`: your API key (same value)
   - Click "Save"

4. **Deploy**
   - Vercel automatically builds on every push to main
   - Or manually click "Deploy" button in dashboard

## Build Configuration

The `vercel.json` file already configured with:
- **buildCommand**: `npm run build` (Vite build)
- **outputDirectory**: `dist` (Vite output)
- **framework**: `vite`
- **rewrites**: Routes API calls to serverless handlers
- **SPA fallback**: Routes 404s to index.html for React Router

## API Routes

### /api/gemini (POST)
- **Purpose**: Proxy Gemini API calls from frontend
- **Handler**: `/api/gemini.ts`
- **Env Required**: `GEMINI_API_KEY`
- **Max Duration**: 60 seconds

### /api/auth/* (POST)
- **Purpose**: User authentication
- **Handlers**: `/api/auth/login.ts`, `/api/auth/signup.ts`
- **Features**: JWT tokens, mock auth fallback

### /api/users/* (GET)
- **Purpose**: User profile endpoints
- **Handler**: `/api/users/me.ts`
- **Features**: Mock user return if no database

## Build & Preview Locally

```bash
# Build production bundle
npm run build

# Preview production build
npm run preview

# This runs the built dist/ on port 3000
# Verify it works before deploying
```

## Monitoring Deployment

### In Vercel Dashboard
1. **Deployments** tab shows build/deployment status
2. **Functions** tab shows API handler execution
3. **Logs** show real-time request logs
4. **Analytics** show usage metrics

### Common Issues & Solutions

**Issue**: "GEMINI_API_KEY is not configured"
- **Solution**: Add `GEMINI_API_KEY` to Vercel Environment Variables

**Issue**: "404 on API routes"
- **Solution**: Ensure `vercel.json` rewrites are correct

**Issue**: "Frontend loads but API calls fail"
- **Solution**: Check browser console for CORS issues, verify API key is valid

**Issue**: "Build fails with TypeScript errors"
- **Solution**: Run `npm run build` locally to catch errors before deploying

## Post-Deployment

1. **Test the Live App**
   ```bash
   # Vercel provides a URL like: https://your-project.vercel.app
   # Test features:
   # - Queue view loads
   # - Case Overview loads
   # - Document upload modal works
   # - Pre-Auth generation workflow accessible
   ```

2. **Enable Analytics** (Optional)
   - Vercel Dashboard → Settings → Analytics
   - Track Web Vitals and performance metrics

3. **Set Custom Domain** (Optional)
   - Vercel Dashboard → Domains
   - Connect your custom domain

## Deployment Checklist

- [ ] Environment variables configured in Vercel
- [ ] `vercel.json` exists in project root
- [ ] `npm run build` succeeds locally
- [ ] `npm run preview` works and loads app
- [ ] API endpoints return correct responses
- [ ] GitHub repository is up-to-date
- [ ] Vercel project is connected
- [ ] Production deployment completes without errors
- [ ] Live app loads and functions work
- [ ] Document upload can be tested
- [ ] Pre-Auth generation modal accessible

## Next Steps

After successful deployment:
1. Share the live URL: `https://your-project.vercel.app`
2. Test end-to-end workflows
3. Monitor logs for errors
4. Gather user feedback
5. Deploy Phase 4 features (TPA submission, Timeline, Live readiness)

## Useful Vercel Links

- Dashboard: https://vercel.com/dashboard
- Deployments: https://vercel.com/dashboard/deployments
- Documentation: https://vercel.com/docs
- CLI Reference: https://vercel.com/docs/cli

## Support

If deployment fails:
1. Check Vercel build logs
2. Verify environment variables are set
3. Run `npm run build` locally to debug
4. Check GitHub Actions for any blocking issues
5. Contact Vercel support: https://vercel.com/support
