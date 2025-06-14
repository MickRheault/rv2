# 🚀 Deployment & CI/CD Setup

This document explains the automated deployment pipeline for RideVault using GitHub Actions and Vercel.

## 📋 Overview

Our CI/CD pipeline automatically:
- ✅ Runs tests, linting, and type checking on all PRs
- 🚀 Deploys preview versions for pull requests  
- 🌟 Deploys to production on `master` branch pushes
- 📊 Provides deployment status and preview URLs

## 🔧 Required Setup

### 1. GitHub Secrets Configuration

Add these secrets to your GitHub repository (`Settings > Secrets and variables > Actions`):

```bash
# Vercel Integration
VERCEL_TOKEN=your_vercel_token_here
VERCEL_ORG_ID=your_vercel_org_id  
VERCEL_PROJECT_ID=your_vercel_project_id

# Supabase Configuration  
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Optional: External Services
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
NEXT_PUBLIC_GA_TRACKING_ID=your_google_analytics_id
```

### 2. Vercel Project Setup

1. **Connect GitHub Repository**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New" → "Project"
   - Import your GitHub repository

2. **Configure Environment Variables**:
   - In Vercel project settings, add the same environment variables
   - Set different values for Production, Preview, and Development

3. **Get Integration Tokens**:
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Login and get tokens
   vercel login
   vercel link  # Links project and gets IDs
   ```

## 🔄 Workflow Details

### CI Workflow (`.github/workflows/ci.yml`)

**Triggers**: Push to `main`/`develop`, PRs to `main`/`develop`

**Steps**:
1. **Test Matrix**: Runs on Node.js 18.x and 20.x
2. **Quality Checks**: ESLint, TypeScript, Jest tests
3. **Coverage**: Uploads test coverage to Codecov
4. **Build Verification**: Ensures production build works

### Deploy Workflow (`.github/workflows/deploy.yml`)

**Triggers**: Push to `main`/`develop`, PRs to `main`

**Steps**:
1. **Environment Detection**: 
   - `main` branch → Production deployment
   - Other branches → Preview deployment
2. **Vercel Integration**: Uses Vercel CLI for deployment
3. **PR Comments**: Automatically comments preview URLs
4. **Status Updates**: Updates GitHub deployment status

## 🌍 Environment Strategy

| Branch | Environment | URL | Auto-Deploy |
|--------|------------|-----|-------------|
| `main` | Production | `ridevault.com` | ✅ |
| `develop` | Staging | `develop.ridevault.com` | ✅ |
| PR branches | Preview | `pr-123.ridevault.com` | ✅ |

## 📊 Deployment Statuses

GitHub will show deployment statuses for each commit:
- 🟡 **Pending**: Deployment in progress
- 🟢 **Success**: Deployment completed successfully  
- 🔴 **Failed**: Deployment failed (check Actions logs)

## 🛠️ Local Development

1. **Environment Setup**:
   ```bash
   # Copy environment template
   cp .env.local.example .env.local
   
   # Add your actual values
   nano .env.local
   ```

2. **Development Server**:
   ```bash
   npm run dev  # Runs on http://localhost:3000
   ```

3. **Testing**:
   ```bash
   npm run test          # Run tests
   npm run test:watch    # Watch mode
   npm run test:coverage # With coverage
   npm run lint         # Linting
   npm run type-check   # TypeScript
   ```

## 🔍 Troubleshooting

### Common Issues

1. **Build Failures**:
   - Check environment variables are set correctly
   - Verify all dependencies are installed
   - Review TypeScript errors in Actions logs

2. **Deployment Failures**:
   - Ensure Vercel tokens are valid and not expired
   - Check Vercel project settings match repository
   - Verify environment variables in Vercel dashboard

3. **Test Failures**:
   - Run tests locally first: `npm run test`
   - Check if Supabase test database is accessible
   - Review test environment setup in `jest.setup.js`

### Getting Help

- **GitHub Actions Logs**: Check the Actions tab in your repository
- **Vercel Logs**: Check deployment logs in Vercel dashboard
- **Local Debugging**: Use `npm run dev` and check console errors

## 🚀 Manual Deployment

If needed, you can deploy manually:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to preview
vercel

# Deploy to production  
vercel --prod
```

## 📈 Performance Monitoring

The deployment includes:
- **Vercel Analytics**: Built-in performance monitoring
- **Bundle Analysis**: Check bundle size on each deployment
- **Core Web Vitals**: Automatic performance tracking

---

**🎯 Ready to Deploy!** 

Once you've set up the GitHub secrets and connected Vercel, every push and PR will automatically trigger the deployment pipeline. 