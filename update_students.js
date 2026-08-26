const fs = require('fs');
const path = require('path');

const studentsPath = path.resolve(__dirname, '../frontend_lms/newlms/newlms/src/pages/org-admin/Students.jsx');
let content = fs.readFileSync(studentsPath, 'utf8');

content = content.replace(
  "programsApi.list({ limit: 100 }).then(res => setPrograms(res.data?.data || [])).catch(() => {});",
  "programsApi.list().then(res => setPrograms(res?.data || res || [])).catch(() => {});"
);

content = content.replace(
  "batchesApi.list({ limit: 100 }).then(res => setBatches(res.data?.data || [])).catch(() => {});",
  "batchesApi.list().then(res => setBatches(res?.data?.data || res?.data || res || [])).catch(() => {});"
);

content = content.replace(
  "semestersApi.list({ limit: 100 }).then(res => setSemesters(res.data?.data || [])).catch(() => {});",
  "semestersApi.list().then(res => setSemesters(res?.data || res || [])).catch(() => {});"
);

fs.writeFileSync(studentsPath, content, 'utf8');
console.log('Students.jsx API calls updated successfully');
