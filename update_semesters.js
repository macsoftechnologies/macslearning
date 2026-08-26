const fs = require('fs');
const path = require('path');

const semestersPath = path.resolve(__dirname, '../frontend_lms/newlms/newlms/src/pages/org-admin/semesters/SemestersPage.jsx');
let content = fs.readFileSync(semestersPath, 'utf8');

// 1. Add icons import
if (!content.includes('RotateCcw')) {
  content = content.replace(
    "import { Plus, Edit, Trash2, GraduationCap, ChevronRight, ArrowLeft, Sparkles, BookPlus } from 'lucide-react';",
    "import { Plus, Edit, Trash2, GraduationCap, ChevronRight, ArrowLeft, Sparkles, BookPlus, RotateCcw, AlertTriangle, CheckCircle2, XCircle, Users } from 'lucide-react';"
  );
}

// 2. Add rollover state
if (!content.includes('rolloverModal')) {
  content = content.replace(
    "const [manageCoursesModal, setManageCoursesModal] = useState({ open: false, semester: null });",
    `const [manageCoursesModal, setManageCoursesModal] = useState({ open: false, semester: null });
  const [rolloverModal, setRolloverModal] = useState({ open: false, semester: null, summary: null, loading: false, executing: false });`
  );
}

// 3. Add openRolloverModal and executeRolloverHandler
if (!content.includes('openRolloverModal')) {
  const handlerCode = `
  const openRolloverModal = async (semester) => {
    setRolloverModal({ open: true, semester, summary: null, loading: true, executing: false });
    try {
      const summary = await semestersApi.getSummary(semester.id);
      setRolloverModal(prev => ({ ...prev, summary: summary?.data || summary, loading: false }));
    } catch (err) {
      toast.error('Failed to load semester summary');
      setRolloverModal(prev => ({ ...prev, loading: false }));
    }
  };

  const executeRolloverHandler = async () => {
    if (!rolloverModal.semester) return;
    setRolloverModal(prev => ({ ...prev, executing: true }));
    try {
      const res = await semestersApi.executeRollover(rolloverModal.semester.id);
      toast.success(res?.message || 'Semester rolled over successfully! Students advanced to next term.');
      setRolloverModal({ open: false, semester: null, summary: null, loading: false, executing: false });
      await fetchSemesters();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to execute rollover');
      setRolloverModal(prev => ({ ...prev, executing: false }));
    }
  };
`;
  content = content.replace(
    "// Open Course Assignment modal",
    handlerCode + "\n  // Open Course Assignment modal"
  );
}

// 4. Add Evaluate & Close button in actions column
if (!content.includes('openRolloverModal(r)')) {
  content = content.replace(
    `<Button size="sm" variant="ghost" icon={Edit} onClick={() => openEdit(r)}>Edit</Button>`,
    `<Button size="sm" variant="outline" icon={RotateCcw} onClick={() => openRolloverModal(r)} style={{ color: '#d97706', borderColor: '#fcd34d' }}>Close & Rollover</Button>
                    <Button size="sm" variant="ghost" icon={Edit} onClick={() => openEdit(r)}>Edit</Button>`
  );
}

// 5. Add Rollover Modal at the bottom of the JSX before closing div
if (!content.includes('title="Evaluate & Close Semester"')) {
  const modalJSX = `
      {/* EVALUATE & CLOSE SEMESTER ROLLOVER MODAL */}
      <Modal
        open={rolloverModal.open}
        onClose={() => !rolloverModal.executing && setRolloverModal({ open: false, semester: null, summary: null, loading: false, executing: false })}
        title="Evaluate & Close Semester (Rollover)"
        subtitle={'Review student pass/fail counts and advance batch for ' + (rolloverModal.semester?.name || 'Semester')}
        width={720}
      >
        {rolloverModal.loading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading semester evaluation summary...
          </div>
        ) : (
          <div className="stack" style={{ gap: '1.25rem' }}>
            <div style={{ padding: '1rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <AlertTriangle size={20} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.85rem', color: '#92400e', lineHeight: 1.5 }}>
                <strong>Important Rollover Action:</strong> Closing this semester will calculate cumulative results for all enrolled students (70% coursework + 30% exam). Students who pass will advance to the next semester. Any failed subjects will be queued into the <strong>Backlog Carousel</strong> to be retaken when the cycle loops back.
              </div>
            </div>

            {rolloverModal.summary && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div style={{ padding: '12px', background: 'var(--bg-surface-muted, #f8fafc)', borderRadius: '8px', border: '1px solid var(--border-subtle, #e2e8f0)', textAlign: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Enrolled Students</span>
                    <h3 style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 800 }}>{rolloverModal.summary.totalEnrolledStudents || 0}</h3>
                  </div>
                  <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#166534' }}>Passed Subjects</span>
                    <h3 style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 800, color: '#15803d' }}>{rolloverModal.summary.totalPassedSubjects || 0}</h3>
                  </div>
                  <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca', textAlign: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#991b1b' }}>Queued Backlogs</span>
                    <h3 style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 800, color: '#b91c1c' }}>{rolloverModal.summary.totalBacklogSubjects || 0}</h3>
                  </div>
                </div>

                {rolloverModal.summary.students && rolloverModal.summary.students.length > 0 && (
                  <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border-subtle, #e2e8f0)', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-surface-muted, #f8fafc)', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', textAlign: 'left' }}>
                          <th style={{ padding: '8px 12px' }}>Student</th>
                          <th style={{ padding: '8px 12px' }}>Passed Courses</th>
                          <th style={{ padding: '8px 12px' }}>Backlogs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rolloverModal.summary.students.map((s, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle, #f1f5f9)' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s.studentName}</td>
                            <td style={{ padding: '8px 12px', color: '#16a34a' }}>{s.passedCourses?.length || 0} passed</td>
                            <td style={{ padding: '8px 12px', color: s.backlogs?.length > 0 ? '#dc2626' : '#64748b' }}>
                              {s.backlogs?.length > 0 ? s.backlogs.length + ' queued' : 'None'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            <div className="row" style={{ justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Button 
                variant="outline" 
                disabled={rolloverModal.executing}
                onClick={() => setRolloverModal({ open: false, semester: null, summary: null, loading: false, executing: false })}
              >
                Cancel
              </Button>
              <Button 
                variant="primary" 
                icon={RotateCcw} 
                loading={rolloverModal.executing}
                onClick={executeRolloverHandler}
                style={{ background: '#d97706', borderColor: '#b45309' }}
              >
                Confirm & Execute Rollover
              </Button>
            </div>
          </div>
        )}
      </Modal>
`;
  content = content.replace(
    '</div >\n  );\n}',
    modalJSX + '\n    </div>\n  );\n}'
  );
  if (!content.includes(modalJSX)) {
    content = content.replace(
      '</div>\n  );\n}',
      modalJSX + '\n    </div>\n  );\n}'
    );
  }
}

fs.writeFileSync(semestersPath, content, 'utf8');
console.log('SemestersPage.jsx updated successfully with rollover button and modal');
