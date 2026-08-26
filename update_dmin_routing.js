const fs = require('fs');
const path = require('path');

// 1. Update App.jsx
const appPath = path.resolve(__dirname, '../frontend_lms/newlms/newlms/src/App.jsx');
let appContent = fs.readFileSync(appPath, 'utf8');

if (!appContent.includes('DMinEvaluations')) {
  appContent = appContent.replace(
    "import GenerateTranscriptPage from './pages/org-admin/transcripts/GenerateTranscriptPage';",
    "import GenerateTranscriptPage from './pages/org-admin/transcripts/GenerateTranscriptPage';\nimport DMinEvaluations from './pages/org-admin/DMinEvaluations';"
  );

  appContent = appContent.replace(
    '<Route path="/admin/transcripts" element={<GenerateTranscriptPage />} />',
    '<Route path="/admin/transcripts" element={<GenerateTranscriptPage />} />\n              <Route path="/admin/dmin-evaluations" element={<DMinEvaluations />} />'
  );

  fs.writeFileSync(appPath, appContent, 'utf8');
  console.log('App.jsx updated with /admin/dmin-evaluations route');
}

// 2. Update navConfig.js
const navPath = path.resolve(__dirname, '../frontend_lms/newlms/newlms/src/components/layout/navConfig.js');
let navContent = fs.readFileSync(navPath, 'utf8');

if (!navContent.includes('/admin/dmin-evaluations')) {
  navContent = navContent.replace(
    "{ to: '/admin/grades', label: 'Grades & Transcripts', icon: ScrollText },",
    "{ to: '/admin/grades', label: 'Grades & Transcripts', icon: ScrollText },\n    { to: '/admin/dmin-evaluations', label: 'D.Min Evaluations', icon: Award },"
  );

  fs.writeFileSync(navPath, navContent, 'utf8');
  console.log('navConfig.js updated with D.Min Evaluations link');
}
