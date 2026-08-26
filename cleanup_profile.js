const fs = require('fs');
const path = require('path');

const profilePath = path.resolve(__dirname, '../frontend_lms/newlms/newlms/src/pages/org-admin/StudentProfile.jsx');
let content = fs.readFileSync(profilePath, 'utf8');

content = content.replace(
  "if (arguments[0] && arguments[0][3]) setCyclicStatus(arguments[0][3]);",
  ""
);

fs.writeFileSync(profilePath, content, 'utf8');
console.log('StudentProfile.jsx cleaned up line 66');
