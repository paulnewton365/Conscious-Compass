# Deploying SOW Review Tool to Vercel

This guide walks you through deploying the SOW Review Tool to Vercel step by step.

## Prerequisites

Before you begin, make sure you have:

1. A GitHub account (https://github.com)
2. A Vercel account (https://vercel.com) - you can sign up with GitHub
3. Git installed on your computer
4. Node.js installed (version 18 or higher) - download from https://nodejs.org

## Step 1: Prepare Your Local Project

### 1.1 Create a project folder

Open Terminal (Mac) or Command Prompt (Windows) and run:

```bash
# Create a new folder for the project
mkdir sow-reviewer
cd sow-reviewer
```

### 1.2 Copy the project files

Copy all the project files I provided into this folder. Your folder structure should look like:

```
sow-reviewer/
├── public/
│   └── favicon.svg
├── src/
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── .gitignore
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── README.md
└── DEPLOYMENT.md
```

### 1.3 Test locally (optional but recommended)

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:5173 in your browser to verify it works.

Press Ctrl+C to stop the server when done testing.

## Step 2: Create a GitHub Repository

### 2.1 Go to GitHub

1. Open https://github.com in your browser
2. Sign in to your account
3. Click the **+** icon in the top right corner
4. Select **New repository**

### 2.2 Configure the repository

1. **Repository name**: `sow-reviewer` (or any name you prefer)
2. **Description**: "SOW Review Tool for quality assessment" (optional)
3. **Visibility**: Choose **Private** (recommended for internal tools)
4. **DO NOT** check "Add a README file" (we already have one)
5. Click **Create repository**

### 2.3 Push your code to GitHub

After creating the repository, GitHub will show you commands. Run these in your terminal:

```bash
# Initialize git in your project folder
git init

# Add all files
git add .

# Create first commit
git commit -m "Initial commit: SOW Review Tool"

# Add GitHub as remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/sow-reviewer.git

# Push to GitHub
git branch -M main
git push -u origin main
```

You may be prompted to log in to GitHub.

## Step 3: Deploy to Vercel

### 3.1 Sign up/Log in to Vercel

1. Go to https://vercel.com
2. Click **Sign Up** or **Log In**
3. Choose **Continue with GitHub** (easiest option)
4. Authorize Vercel to access your GitHub account

### 3.2 Import your project

1. From the Vercel dashboard, click **Add New...** → **Project**
2. You'll see a list of your GitHub repositories
3. Find **sow-reviewer** and click **Import**

### 3.3 Configure the project

Vercel will auto-detect that this is a Vite project. Verify these settings:

| Setting | Value |
|---------|-------|
| Framework Preset | Vite |
| Root Directory | ./ |
| Build Command | npm run build |
| Output Directory | dist |
| Install Command | npm install |

You don't need to add any environment variables (the API key is entered by users in the browser).

### 3.4 Deploy

1. Click **Deploy**
2. Wait 1-2 minutes for the build to complete
3. You'll see a success screen with your deployment URL

Your app is now live at a URL like: `https://sow-reviewer-xxxxx.vercel.app`

## Step 4: Set Up a Custom Domain (Optional)

If you want a custom domain like `sow-review.antennagroup.com`:

### 4.1 Add domain in Vercel

1. Go to your project in Vercel dashboard
2. Click **Settings** → **Domains**
3. Enter your domain (e.g., `sow-review.antennagroup.com`)
4. Click **Add**

### 4.2 Configure DNS

Vercel will show you DNS records to add. Go to your domain registrar and add:

**For a subdomain** (like sow-review.antennagroup.com):
- Type: CNAME
- Name: sow-review
- Value: cname.vercel-dns.com

**For a root domain** (like antennagroup.com):
- Follow Vercel's specific instructions for A records

DNS changes can take up to 48 hours to propagate, but usually work within minutes.

## Step 5: Ongoing Updates

When you make changes to the app:

```bash
# Make your changes to the code, then:
git add .
git commit -m "Description of your changes"
git push
```

Vercel will automatically detect the push and redeploy your app.

## Troubleshooting

### Build fails

1. Check the build logs in Vercel for specific errors
2. Make sure all files are present and correctly named
3. Try running `npm run build` locally to see errors

### API calls fail

1. The Anthropic API requires the `anthropic-dangerous-direct-browser-access` header for browser requests
2. This is already included in the code
3. Make sure users are entering a valid API key

### CORS errors

The app makes direct calls to the Anthropic API. This should work with the headers we've set. If you see CORS errors:

1. Verify the API key is correct
2. Check that the Anthropic API is accessible from your network

### Blank page after deployment

1. Check browser console for JavaScript errors
2. Verify the build completed successfully in Vercel
3. Try clearing browser cache or opening in incognito mode

## Security Notes

1. **API keys are client-side**: Users enter their own API keys which are only used in their browser session. Keys are never sent to your server or stored anywhere.

2. **Private repository**: Consider keeping the GitHub repository private since this is an internal tool.

3. **Access control**: Vercel offers password protection for deployments on paid plans if you need to restrict access.

## Support

For issues with:
- **Vercel deployment**: https://vercel.com/docs
- **Anthropic API**: https://docs.anthropic.com
- **The SOW Review Tool itself**: Contact your development team
