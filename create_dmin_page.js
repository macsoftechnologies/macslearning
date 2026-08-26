const fs = require('fs');
const path = require('path');

// 1. Create src/api/dmin.js
const dminApiPath = path.resolve(__dirname, '../frontend_lms/newlms/newlms/src/api/dmin.js');
const apiContent = `import client from './client';

export const list = async (params) => {
  const { data } = await client.get('/dmin-evaluations', { params });
  return data;
};

export const getById = async (id) => {
  const { data } = await client.get(\`/dmin-evaluations/\${id}\`);
  return data;
};

export const create = async (payload) => {
  const { data } = await client.post('/dmin-evaluations', payload);
  return data;
};

export const evaluate = async (id, payload) => {
  const { data } = await client.put(\`/dmin-evaluations/\${id}/evaluate\`, payload);
  return data;
};

export const remove = async (id) => {
  const { data } = await client.delete(\`/dmin-evaluations/\${id}\`);
  return data;
};
`;
fs.writeFileSync(dminApiPath, apiContent, 'utf8');
console.log('src/api/dmin.js created successfully');

// 2. Create src/pages/org-admin/DMinEvaluations.jsx
const dminPagePath = path.resolve(__dirname, '../frontend_lms/newlms/newlms/src/pages/org-admin/DMinEvaluations.jsx');
const pageContent = `import React, { useState, useEffect } from 'react';
import { Award, FileText, CheckCircle2, Clock, AlertCircle, Eye, Download, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Input, { Field, Select, Textarea } from '../../components/ui/Input';
import { Card, StatCard } from '../../components/ui/Card';
import StatusBadge from '../../components/ui/StatusBadge';
import Tabs from '../../components/ui/Tabs';
import PageLoader from '../../components/ui/PageLoader';
import * as dminApi from '../../api/dmin';
import { buildStaticUrl } from '../../api/client';

export default function DMinEvaluations() {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('SUBMITTED');
  const [evaluatingTarget, setEvaluatingTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    marksObtained: '',
    totalMarks: 100,
    grade: 'A',
    facultyFeedback: '',
    adminFeedback: '',
    status: 'APPROVED',
  });

  const fetchEvaluations = async () => {
    setLoading(true);
    try {
      const res = await dminApi.list();
      const list = res?.data || res || [];
      setEvaluations(Array.isArray(list) ? list : []);
    } catch (err) {
      toast.error('Failed to load D.Min evaluations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvaluations();
  }, []);

  const openEvaluationModal = (item) => {
    setEvaluatingTarget(item);
    setForm({
      marksObtained: item.marksObtained ?? '',
      totalMarks: item.totalMarks || 100,
      grade: item.grade || 'A',
      facultyFeedback: item.facultyFeedback || '',
      adminFeedback: item.adminFeedback || '',
      status: item.status === 'SUBMITTED' ? 'APPROVED' : item.status,
    });
  };

  const handleSaveEvaluation = async (e) => {
    e.preventDefault();
    if (!evaluatingTarget) return;
    setSubmitting(true);
    try {
      await dminApi.evaluate(evaluatingTarget.id, {
        marksObtained: Number(form.marksObtained) || 0,
        totalMarks: Number(form.totalMarks) || 100,
        grade: form.grade,
        facultyFeedback: form.facultyFeedback,
        adminFeedback: form.adminFeedback,
        status: form.status,
      });
      toast.success('D.Min evaluation saved successfully!');
      setEvaluatingTarget(null);
      await fetchEvaluations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save evaluation');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = evaluations.filter(e => e.status === 'SUBMITTED').length;
  const approvedCount = evaluations.filter(e => e.status === 'APPROVED').length;
  const revisionCount = evaluations.filter(e => e.status === 'REVISION_REQUESTED').length;

  const filteredEvaluations = activeTab === 'ALL'
    ? evaluations
    : evaluations.filter(e => e.status === activeTab);

  if (loading) return <PageLoader />;

  return (
    <div className="page stack" style={{ gap: 'var(--sp-6)' }}>
      <div className="page-head">
        <div>
          <span className="page-eyebrow">Doctoral Management</span>
          <h1 className="page-title">Doctor of Ministry (D.Min) Evaluation Desk</h1>
          <p className="page-subtitle">
            Review modular project dissertations, field research papers, and document submissions for D.Min candidates.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <Card style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: 48, height: 48, borderRadius: '12px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={24} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Pending Evaluation</p>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#b45309' }}>{pendingCount} Papers</h3>
          </div>
        </Card>

        <Card style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: 48, height: 48, borderRadius: '12px', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Approved / Graded</p>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#15803d' }}>{approvedCount} Papers</h3>
          </div>
        </Card>

        <Card style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: 48, height: 48, borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={24} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Total Submissions</p>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>{evaluations.length}</h3>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { key: 'SUBMITTED', label: 'Pending Review', count: pendingCount },
          { key: 'APPROVED', label: 'Approved & Graded', count: approvedCount },
          { key: 'REVISION_REQUESTED', label: 'Revision Requested', count: revisionCount },
          { key: 'ALL', label: 'All Submissions', count: evaluations.length },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      <DataTable
        emptyLabel="No D.Min modular submissions found in this tab."
        columns={[
          { key: 'studentId', header: 'Student ID', render: (r) => <span style={{ fontWeight: 600 }}>{r.studentId?.slice(0, 8)}...</span> },
          { key: 'modularTitle', header: 'Modular Topic / Thesis Title', render: (r) => <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{r.modularTitle || 'Untitled Modular Submission'}</span> },
          { 
            key: 'document', 
            header: 'Submitted Document', 
            render: (r) => r.documentUrl ? (
              <a href={buildStaticUrl(r.documentUrl)} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#2563eb', textDecoration: 'none', fontWeight: 600, fontSize: '13px' }}>
                <FileText size={16} /> {r.documentName || 'View Document'}
              </a>
            ) : '—'
          },
          { key: 'submittedAt', header: 'Submitted On', render: (r) => r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : '—' },
          { 
            key: 'status', 
            header: 'Status', 
            render: (r) => {
              const bg = r.status === 'APPROVED' ? '#dcfce7' : r.status === 'SUBMITTED' ? '#fef3c7' : '#fee2e2';
              const col = r.status === 'APPROVED' ? '#166534' : r.status === 'SUBMITTED' ? '#92400e' : '#991b1b';
              return <span style={{ padding: '3px 8px', borderRadius: '4px', background: bg, color: col, fontWeight: 700, fontSize: '11px' }}>{r.status}</span>;
            }
          },
          { key: 'marks', header: 'Score', render: (r) => r.marksObtained != null ? \`\${r.marksObtained}/\${r.totalMarks || 100} (\${r.grade || '—'})\` : 'Ungraded' },
          {
            key: 'actions',
            header: 'Actions',
            render: (r) => (
              <Button size="sm" variant="primary" icon={Eye} onClick={() => openEvaluationModal(r)}>
                {r.status === 'SUBMITTED' ? 'Grade & Review' : 'View / Edit Score'}
              </Button>
            )
          }
        ]}
        rows={filteredEvaluations}
      />

      {/* EVALUATION MODAL */}
      <Modal
        open={!!evaluatingTarget}
        onClose={() => setEvaluatingTarget(null)}
        title="Evaluate D.Min Modular Submission"
        subtitle={evaluatingTarget?.modularTitle}
        width={640}
      >
        {evaluatingTarget && (
          <form className="stack" style={{ gap: '1.25rem' }} onSubmit={handleSaveEvaluation}>
            {evaluatingTarget.documentUrl && (
              <div style={{ padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={20} color="#2563eb" />
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>{evaluatingTarget.documentName || 'Thesis Document'}</span>
                </div>
                <a href={buildStaticUrl(evaluatingTarget.documentUrl)} target="_blank" rel="noreferrer">
                  <Button type="button" size="sm" variant="outline" icon={Download}>Download File</Button>
                </a>
              </div>
            )}

            <div className="form-grid">
              <Field label="Marks Obtained (out of 100)" required>
                <Input 
                  type="number" 
                  min="0" 
                  max="100" 
                  value={form.marksObtained} 
                  onChange={(e) => setForm(f => ({ ...f, marksObtained: e.target.value }))}
                  required 
                />
              </Field>

              <Field label="Letter Grade" required>
                <Select value={form.grade} onChange={(e) => setForm(f => ({ ...f, grade: e.target.value }))}>
                  <option value="A+">A+ (Distinction / Outstanding)</option>
                  <option value="A">A (Excellent)</option>
                  <option value="A-">A- (Very Good)</option>
                  <option value="B+">B+ (Good)</option>
                  <option value="B">B (Satisfactory)</option>
                  <option value="C">C (Pass)</option>
                  <option value="F">F (Fail / Unacceptable)</option>
                </Select>
              </Field>
            </div>

            <Field label="Evaluation Decision" required>
              <Select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="APPROVED">APPROVED — Pass & Record Credit</option>
                <option value="REVISION_REQUESTED">REVISION REQUESTED — Candidate must resubmit</option>
              </Select>
            </Field>

            <Field label="Faculty Feedback & Rubric Notes">
              <Textarea 
                rows={3} 
                value={form.facultyFeedback} 
                onChange={(e) => setForm(f => ({ ...f, facultyFeedback: e.target.value }))}
                placeholder="Qualitative feedback on dissertation arguments, methodology, and biblical coherence..." 
              />
            </Field>

            <Field label="OrgAdmin / Dean Remarks (Optional)">
              <Textarea 
                rows={2} 
                value={form.adminFeedback} 
                onChange={(e) => setForm(f => ({ ...f, adminFeedback: e.target.value }))}
                placeholder="Institutional approval notes..." 
              />
            </Field>

            <div className="row" style={{ justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Button type="button" variant="outline" onClick={() => setEvaluatingTarget(null)}>Cancel</Button>
              <Button type="submit" variant="primary" loading={submitting}>Save Evaluation & Grade</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
`;
fs.writeFileSync(dminPagePath, pageContent, 'utf8');
console.log('src/pages/org-admin/DMinEvaluations.jsx created successfully');
