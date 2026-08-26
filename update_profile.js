const fs = require('fs');
const path = require('path');

const profilePath = path.resolve(__dirname, '../frontend_lms/newlms/newlms/src/pages/org-admin/StudentProfile.jsx');
let content = fs.readFileSync(profilePath, 'utf8');

// 1. Add semestersApi import
if (!content.includes('import * as semestersApi')) {
  content = content.replace(
    "import * as certificatesApi from '../../api/certificates';",
    "import * as certificatesApi from '../../api/certificates';\nimport * as semestersApi from '../../api/semesters';"
  );
}

// 2. Add cyclicStatus state
if (!content.includes('cyclicStatus')) {
  content = content.replace(
    "const [programsList, setProgramsList] = useState([]);",
    "const [programsList, setProgramsList] = useState([]);\n  const [cyclicStatus, setCyclicStatus] = useState(null);"
  );

  content = content.replace(
    "programsApi.list({ limit: 100 }).catch(() => ({ data: [] }))",
    "programsApi.list({ limit: 100 }).catch(() => ({ data: [] })),\n      semestersApi.getStudentCyclicStatus(id).catch(() => null)"
  );

  content = content.replace(
    "setProgramsList(programsRes.data?.data || programsRes.data || []);",
    "setProgramsList(programsRes.data?.data || programsRes.data || []);\n      if (arguments[0] && arguments[0][3]) setCyclicStatus(arguments[0][3]);"
  );
}

// Ensure cyclicStatus is properly assigned in the Promise.all
content = content.replace(
  /\]\)\.then\(\(\[studentRes, questionsRes, programsRes\]\) => \{/,
  "]).then(([studentRes, questionsRes, programsRes, cyclicRes]) => {\n      if (cyclicRes) setCyclicStatus(cyclicRes.data || cyclicRes);"
);

// 3. Add Carousel UI Component right before the programs list
if (!content.includes('ATA Academic Carousel & Backlog Queue')) {
  const carouselUI = `
      {/* ATA ACADEMIC CAROUSEL & BACKLOG QUEUE */}
      {cyclicStatus && (
        <Card style={{ padding: 'var(--sp-6)', marginBottom: 'var(--sp-6)', border: '1.5px solid #c7d2fe', background: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: 36, height: 36, borderRadius: '10px', background: '#4338ca', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                🔄
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1e1b4b' }}>ATA Academic Carousel & Backlog Queue</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#6366f1' }}>Single-attempt exam cycle & semester rollover tracking</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ padding: '4px 12px', background: '#4338ca', color: '#fff', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
                Cycle Round {cyclicStatus.cyclicProgress?.currentCycleRound || 1}
              </span>
              <span style={{ padding: '4px 12px', background: '#e0e7ff', color: '#3730a3', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
                Active: Semester {cyclicStatus.currentSemesterIndex || 1}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div style={{ padding: '12px 16px', background: '#fff', borderRadius: '8px', border: '1px solid #e0e7ff' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Passed Subjects</span>
              <h4 style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 800, color: '#15803d' }}>
                {cyclicStatus.passedCount || 0} / {cyclicStatus.totalSubjects || 30}
              </h4>
            </div>
            <div style={{ padding: '12px 16px', background: '#fff', borderRadius: '8px', border: '1px solid #e0e7ff' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Queued Backlogs</span>
              <h4 style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 800, color: (cyclicStatus.backlogCount > 0 ? '#b91c1c' : '#64748b') }}>
                {cyclicStatus.backlogCount || 0} Subjects
              </h4>
            </div>
            <div style={{ padding: '12px 16px', background: '#fff', borderRadius: '8px', border: '1px solid #e0e7ff' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Next Retake Window</span>
              <h4 style={{ margin: '4px 0 0', fontSize: '14px', fontWeight: 700, color: '#4338ca' }}>
                {cyclicStatus.backlogCount > 0 ? 'On Cycle Return to Sem 1' : 'No Active Backlogs'}
              </h4>
            </div>
          </div>

          {cyclicStatus.backlogCourses && cyclicStatus.backlogCourses.length > 0 && (
            <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}>
              <strong style={{ fontSize: '13px', color: '#991b1b' }}>Queued Backlog Subjects (Retake on Cycle Return):</strong>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                {cyclicStatus.backlogCourses.map((c, i) => (
                  <span key={i} style={{ padding: '3px 10px', background: '#fff', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '12px', color: '#b91c1c', fontWeight: 600 }}>
                    ⚠️ {c.title || c.id}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
`;
  content = content.replace(
    "{Object.keys(programsMap).length === 0 ? (",
    carouselUI + "\n      {Object.keys(programsMap).length === 0 ? ("
  );
}

fs.writeFileSync(profilePath, content, 'utf8');
console.log('StudentProfile.jsx updated successfully with ATA Carousel tab');
