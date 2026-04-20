# MiniBob Dashboard - GitHub Pages Deployment

## 🚀 Live Demo
**Deployed at:** https://metabobproject.github.io/demo-minibob-cicd/

## 📊 Dashboard Features

The MiniBob Dashboard is a comprehensive activity execution monitor with the following features:

### 1. **API-Integrated Dashboard**
- Primary data source: `https://activity.metabob.com/v2/activities/execution-traces`
- Secondary data source: `https://activity.metabob.com/v2/activities/templates`
- Automatic fallback to local JSON files when API is unavailable

### 2. **Execution Traces Visualization**
- Real-time display of activity execution traces
- Interactive trace explorer with detailed metadata
- Status indicators (success, running, error)
- Execution time tracking and analysis

### 3. **Cost Budget Tracking**
- Live cost monitoring and budget allocation
- Breakdown by resource type (API calls, compute, storage)
- Budget alerts and threshold monitoring
- Monthly spend projections

### 4. **Auto-Refresh Every 30 Seconds**
- Automatic data refresh every 30 seconds
- Manual refresh capability
- Pause/resume auto-refresh functionality
- Smart refresh when tab becomes visible

### 5. **Thompson Sampling Algorithm**
- Real beta distribution implementation
- Success/failure rate calculation
- Confidence interval analysis
- Alpha/beta parameter tracking

### 6. **Beta Distribution Calculations**
- Mathematical modeling of activity success rates
- Dynamic parameter updates based on execution data
- Statistical confidence intervals
- Real-time probability calculations

### 7. **Fallback JSON Data**
- Graceful degradation when API is unavailable
- Local sample data for offline demonstration
- Seamless transition between online/offline modes
- Error handling and status indication

### 8. **Real-Time Activity Metrics**
- Total activities executed
- Success rate percentage
- Average execution duration
- Live cost budget display

### 9. **Interactive Trace Explorer**
- Detailed activity execution history
- Sortable and filterable trace list
- Execution time analysis
- Error tracking and reporting

## 🗂️ Data Sources

### Primary (Online Mode)
- **API Endpoint:** `https://activity.metabob.com/v2/activities/execution-traces`
- **Cost API:** `https://activity.metabob.com/v2/activities/cost-budget`
- **Status:** Real-time data with live updates

### Fallback (Offline Mode)
- **Traces:** `./traces/index.json` (Sample execution data)
- **Budget:** `./cost-budget.json` (Sample cost data)
- **Status:** Static demonstration data

## 🚀 GitHub Pages Deployment

### Prerequisites
1. GitHub repository with Pages enabled
2. Repository structure: `demos/minibob-cicd/deploy/`
3. GitHub Actions (optional for automated deployment)

### Deployment Steps

#### Option A: Manual Deployment
1. **Copy deployment files:**
   ```bash
   # From repository root
   cp -r demos/minibob-cicd/deploy/* docs/
   # OR upload files directly to GitHub
   ```

2. **Enable GitHub Pages:**
   - Go to repository Settings → Pages
   - Set source to "Deploy from a branch"
   - Select `main` branch and `/docs` folder
   - Click "Save"

3. **Access dashboard:**
   - Navigate to: `https://yourusername.github.io/your-repo-name/`

#### Option B: Automated Deployment (Recommended)
1. **Create workflow file:** `.github/workflows/deploy.yml`
   ```yaml
   name: Deploy MiniBob Dashboard
   
   on:
     push:
       branches: [ main ]
       paths: [ 'demos/minibob-cicd/deploy/**' ]
   
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - name: Deploy to GitHub Pages
           uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./demos/minibob-cicd/deploy
   ```

### Deployment Checklist

- [ ] **Files Ready**
  - [ ] `index.html` (main dashboard)
  - [ ] `traces/index.json` (sample data)
  - [ ] `cost-budget.json` (budget data)
  - [ ] `README.md` (this documentation)

- [ ] **Path Configuration**
  - [ ] All paths are relative (no `file://` or absolute paths)
  - [ ] Fallback data files accessible via `./filename.json`
  - [ ] No hardcoded localhost URLs

- [ ] **GitHub Repository**
  - [ ] Repository exists and accessible
  - [ ] GitHub Pages enabled in settings
  - [ ] Correct source branch/folder selected
  - [ ] Custom domain configured (if applicable)

- [ ] **Testing**
  - [ ] Dashboard loads correctly
  - [ ] API integration attempts (will fallback gracefully)
  - [ ] Fallback data displays properly
  - [ ] Auto-refresh functionality works
  - [ ] Responsive design on mobile devices

- [ ] **Documentation**
  - [ ] README.md included with deployment instructions
  - [ ] Feature list documented
  - [ ] Data sources explained
  - [ ] Links to main repository included

## 🔧 Current Development Status

### ✅ Completed Features
- Complete dashboard UI with responsive design
- API integration with graceful fallback
- Thompson Sampling algorithm implementation
- Real-time data refresh and auto-update
- Cost budget tracking and visualization
- Comprehensive error handling
- GitHub Pages deployment preparation

### 🚧 In Progress
- Advanced analytics and reporting
- User authentication and personalization
- Extended API endpoint coverage
- Performance optimization and caching

### 📋 Planned Features
- Activity template management UI
- Advanced filtering and search capabilities
- Export functionality for reports
- Integration with additional monitoring services
- Real-time notifications and alerts

## 🔗 Links

- **Main Repository:** [MiniBob Project](https://github.com/metabobproject)
- **Documentation:** [MiniBob Docs](https://docs.metabob.com/minibob)
- **API Reference:** [Activity API](https://activity.metabob.com/docs)
- **Support:** [Issues & Support](https://github.com/metabobproject/minibob/issues)

## 📄 License

This project is part of the MetaBob ecosystem. See the main repository for license information.

## 🤝 Contributing

Contributions welcome! Please see the main repository for contribution guidelines and development setup instructions.

---

**Generated by:** MiniBob Activity System  
**Last Updated:** April 19, 2024  
**Version:** 1.0.0