# RecoveryDex Documentation Deployment

This documentation is built with [VitePress](https://vitepress.dev/) and deployed on Vercel.

## 🌐 Live Documentation Site

**Production URL**: https://docs-7w2bmlkf6-think-in-coins-projects.vercel.app

### 🚀 New Features Applied:
- ✅ **Clean URLs**: URLs without `.html` for better SEO
- ✅ **XML Sitemap**: Automatic generation for indexing
- ✅ **SEO Optimized**: Open Graph and Twitter Cards meta tags  
- ✅ **Performance**: Optimized cache for static assets
- ✅ **Scripts**: `npm run deploy` and `npm run deploy:preview` commands

## 🚀 Deploy Options

### Option 1: Deploy via Vercel CLI (Recommended ✅)

```bash
# Install Vercel CLI
npm install -g vercel

# In docs/ folder
cd docs

# Preview deploy
vercel --yes

# Production deploy
vercel --prod
```

**Automatic configuration**:
- ✅ Build Command: `npm run build`
- ✅ Output Directory: `.vitepress/dist`
- ✅ Install Command: `npm install`
- ✅ Framework: VitePress (auto-detected)

### Option 2: Automatic Deploy via Vercel Dashboard

1. **Connect Repository**:
   - Access [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New..." → "Project" 
   - Import the RecoveryDex repository

2. **Configure Build Settings**:
   ```bash
   # Framework Preset: Other
   # Root Directory: docs
   # Build Command: npm run build
   # Output Directory: .vitepress/dist
   # Install Command: npm install
   ```

### Option 3: Deploy via GitHub Actions

The repository already includes automatic workflow (`.github/workflows/docs.yml`).

**Required setup:**
1. Create project on Vercel via dashboard
2. Get tokens from Vercel Settings
3. Add secrets to GitHub:
   ```bash
   # In GitHub Repository Settings > Secrets
   VERCEL_TOKEN=your_vercel_token
   VERCEL_ORG_ID=team_VsyAT1ZlGQf82kFPvHFzVVwq
   VERCEL_PROJECT_ID=prj_sTcYXDMyMJzpYtNmkbG4Z367W5K3
   ```

## 🛠 Troubleshooting

### 404 NOT_FOUND Error
```bash
# Solution: Deploy directly from docs/ folder
cd docs
vercel --yes --debug
```

### Build Failures
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json .vitepress/cache
npm install
npm run build
```

### Broken Links
```bash
# VitePress uses relative paths
# ✅ Correct: ./setup.html or ./components.html  
# ❌ Incorrect: /setup.html or /components.html
```

## 📁 File Structure

```
docs/
├── .vitepress/
│   ├── config.mjs          # VitePress configuration
│   └── dist/               # Build output
├── en/                     # English documentation
│   ├── index.md           # Homepage
│   ├── setup.md           # Setup guide
│   ├── architecture.md     # Architecture
│   └── ...
├── package.json           # Dependencies
└── vercel.json           # Vercel config
```

## 🔧 Configuration

### vercel.json (docs/)
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": ".vitepress/dist"
      }
    }
  ]
}
```

### package.json Scripts
```json
{
  "scripts": {
    "dev": "vitepress dev",
    "build": "vitepress build", 
    "preview": "vitepress preview"
  }
}
   ```
### env file
   ```env
   VERCEL_TOKEN=seu_token_aqui
   ORG_ID=seu_org_id
   PROJECT_ID=seu_project_id
   ```

## 📁 Deploy Structure

```
docs/
├── .vitepress/
│   ├── config.mjs          # VitePress configuration
│   └── dist/              # Build output
├── en/                    # English documentation
│   ├── index.md          # Homepage
│   ├── setup.md
│   └── ...
├── package.json          # Docs dependencies
├── vercel.json          # Vercel configuration
└── README.md           # This file
```

## 🛠️ Local Build

```bash
# Install dependencies
cd docs
npm install

# Development
npm run docs:dev

# Production build
npm run docs:build

# Build preview
npm run docs:preview
```

## 🔧 Vercel Configuration

### vercel.json
```json
{
  "buildCommand": "npm run docs:build",
  "outputDirectory": ".vitepress/dist",
  "installCommand": "npm install"
}
```

### Domains & Redirects
Possible domain configurations:
- `docs.RecoveryDex.com` (primary)
- `docs-dev.RecoveryDex.com` (staging)
- `RecoveryDex-docs.vercel.app` (default)

## 📊 Performance

### Build Stats
- **Build Time**: ~30-60 seconds
- **Output Size**: ~2-5MB
- **Assets**: Automatically optimized by VitePress

### Optimizations
- ✅ Static Site Generation (SSG)
- ✅ Automatic code splitting
- ✅ Asset optimization
- ✅ Service worker for caching
- ✅ SEO meta tags

## 🔍 Monitoring

### Vercel Analytics
Enable in dashboard for:
- Page views and performance
- Core Web Vitals
- User behavior tracking

### Custom Monitoring
```javascript
// Add to config.mjs if needed
export default defineConfig({
  head: [
    // Google Analytics
    ['script', { src: 'https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID' }],
    ['script', {}, `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'GA_MEASUREMENT_ID');`]
  ]
})
```

## 🚨 Troubleshooting

### Build Errors
```bash
# Clear cache
rm -rf node_modules .vitepress/cache
npm install

# Debug build
DEBUG=vitepress:* npm run docs:build
```

### Deploy Issues
1. Check `package.json` in docs folder
2. Confirm paths in `vercel.json`
3. Check logs in Vercel Dashboard
4. Validate file structure

### 404 Errors
- Check if `index.md` exists in `docs/en/`
- Confirm `srcDir: './en'` in config.mjs
- Check routing in vercel.json

## 📋 Deploy Checklist

- [ ] Dependencies installed (`npm install`)
- [ ] Local build working (`npm run docs:build`)
- [ ] Vercel project created
- [ ] Build settings configured
- [ ] Domain configured (optional)
- [ ] GitHub secrets added (for CI/CD)
- [ ] SSL certificate active
- [ ] Analytics configured (optional)

## 📞 Support


- **GitHub Issues**: [Report project-specific issues](https://github.com/ThinkinCoin/RecoveryDex/issues/new)