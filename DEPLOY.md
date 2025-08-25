# Deployment Guide

This guide explains how to deploy the Horn Viewer app to GitHub Pages.

## Automated Deployment (Recommended)

The project is configured with GitHub Actions for automatic deployment:

1. **Push to main branch** - Any push to the `main` branch will automatically trigger deployment
2. **The workflow will**:
   - Install dependencies with pnpm
   - Build the horn-viewer app for production
   - Deploy to GitHub Pages

## Manual Deployment (if needed)

If you need to deploy manually for testing:

1. **Build the project**:
   ```bash
   pnpm run build:gh-pages
   ```

2. **Manual deployment**:
   ```bash
   cd dist/apps/horn-viewer
   git init
   git add .
   git commit -m "Deploy horn-viewer"
   git remote add origin https://github.com/YOUR_USERNAME/hornProfiles.git
   git push origin HEAD:gh-pages --force
   ```

## Configuration

The build is configured to:
- Use `/hornProfiles/` as the base path for GitHub Pages
- Output to `dist/apps/horn-viewer/`
- Include all necessary assets and dependencies

## Access Your App

Once deployed, your app will be available at:
```
https://YOUR_USERNAME.github.io/hornProfiles/
```

## Build Scripts

- `pnpm run build:horn-viewer` - Regular development build
- `pnpm run build:gh-pages` - Production build for GitHub Pages

## GitHub Actions Workflow

The deployment workflow (`.github/workflows/deploy-gh-pages.yml`) handles:
- Installing dependencies
- Building the app with correct base path
- Deploying to GitHub Pages
- Only runs on pushes to main branch