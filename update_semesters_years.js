const fs = require('fs');
const path = require('path');

const semestersPath = path.resolve(__dirname, '../frontend_lms/newlms/newlms/src/pages/org-admin/semesters/SemestersPage.jsx');
let content = fs.readFileSync(semestersPath, 'utf8');

// Replace Semesters label and terms with Duration in Years
content = content.replace(
  `<div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Semesters</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{prog.totalSemesters || 6} Terms</strong>
                    </div>`,
  `<div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Duration</span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {prog.maxDurationYears ? \`\${prog.maxDurationYears} Years\` : (prog.totalSemesters ? \`\${Math.ceil(prog.totalSemesters / 2)} Years\` : '3 Years')}
                      </strong>
                    </div>`
);

fs.writeFileSync(semestersPath, content, 'utf8');
console.log('SemestersPage.jsx updated to show Years instead of Semesters');
