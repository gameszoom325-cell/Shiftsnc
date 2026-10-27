import React, { Suspense, lazy, useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  Building2,
  CheckCircle2,
  Edit3,
  GraduationCap,
  KeyRound,
  Loader2,
  LogOut,
  MessageSquareWarning,
  Sparkles,
  Trash2,
  UserPlus,
  Wand2,
} from 'lucide-react';
import {
  CollegeDepartmentStat,
  DemoUser,
  SafetyComplaintItem,
  SkillRecordItem,
} from '../types';
import { TTSBriefingButton } from './AudioTools';
import { sanitizeInput, validateUserProvisioning } from '../security/validation';

const AITransparencyStudio = lazy(() =>
  import('./AITransparencyStudio').then((m) => ({ default: m.AITransparencyStudio }))
);

interface CollegeAdminPortalProps {
  user: DemoUser;
  departments: CollegeDepartmentStat[];
  managedStudents: DemoUser[];
  onCreateStudent: (student: Omit<DemoUser, 'id' | 'organization' | 'role' | 'roleLabel'>) => void;
  onUpdateStudent: (id: string, updated: Partial<DemoUser>) => void;
  onDeleteStudent: (id: string) => void;
  complaints: SafetyComplaintItem[];
  skills: SkillRecordItem[];
  onVerifySkill: (id: string) => void;
  onUpdateComplaintStatus: (
    id: string,
    nextStatus: 'Submitted' | 'Under Review' | 'Resolved'
  ) => void;
  onLogout: () => void;
}

type CollegeAdminSection =
  | 'overview'
  | 'students'
  | 'departments'
  | 'verification'
  | 'complaints'
  | 'ai';

export const CollegeAdminPortal: React.FC<CollegeAdminPortalProps> = ({
  user,
  departments,
  managedStudents,
  onCreateStudent,
  onUpdateStudent,
  onDeleteStudent,
  complaints,
  skills,
  onVerifySkill,
  onUpdateComplaintStatus,
  onLogout,
}) => {
  const [activeSection, setActiveSection] = useState<CollegeAdminSection>('overview');

  // Create / Edit Student Account State
  const [studentName, setStudentName] = useState('');
  const [studentBadgeId, setStudentBadgeId] = useState('');
  const [studentUsername, setStudentUsername] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [studentDept, setStudentDept] = useState('B.Tech Computer Science & Engineering (CSE)');
  const [studentSemester, setStudentSemester] = useState('Semester 6 (Autumn 2026)');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [accountFeedback, setAccountFeedback] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  const collegeComplaints = useMemo(
    () => complaints.filter((c) => c.portalType === 'college'),
    [complaints]
  );
  const collegeSkills = useMemo(
    () => skills.filter((s) => s.portalType === 'college'),
    [skills]
  );

  const totalStudents = useMemo(
    () => departments.reduce((acc, d) => acc + d.totalStudents, 0) + managedStudents.length,
    [departments, managedStudents.length]
  );
  const avgCampusAttendance = useMemo(
    () =>
      departments.reduce((acc, d) => acc + d.avgAttendance, 0) / Math.max(1, departments.length),
    [departments]
  );
  const verifiedPassportsCount = useMemo(
    () =>
      departments.reduce((acc, d) => acc + d.verifiedSkills, 0) +
      collegeSkills.filter((s) => s.verifiedStatus === 'Verified').length,
    [departments, collegeSkills]
  );
  const openComplaintsCount = useMemo(
    () => collegeComplaints.filter((c) => c.status !== 'Resolved').length,
    [collegeComplaints]
  );

  const handleGenerateStudentId = () => {
    const nextNum = 101 + managedStudents.length;
    const generatedId = `CSE${nextNum}`;
    setStudentBadgeId(generatedId);
    if (studentName.trim()) {
      const cleanName = studentName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      setStudentUsername(`${cleanName}${nextNum}`);
    }
  };

  const handleGenerateCredentials = () => {
    const nextNum = 101 + managedStudents.length;
    const idToUse = studentBadgeId.trim() || `CSE${nextNum}`;
    if (!studentBadgeId.trim()) {
      setStudentBadgeId(idToUse);
    }
    const cleanName = (studentName.trim() || 'student')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const digits = idToUse.replace(/[^0-9]/g, '') || String(nextNum);
    setStudentUsername(`${cleanName}${digits}`);
    setStudentPassword('demo123');
  };

  const handleFillRahulExample = () => {
    setEditingStudentId(null);
    setAccountError(null);
    setStudentName('Rahul');
    setStudentBadgeId('CSE101');
    setStudentUsername('rahul101');
    setStudentPassword('demo123');
    setStudentDept('B.Tech Computer Science & Engineering (CSE)');
    setStudentSemester('Semester 6 (Autumn 2026)');
  };

  const handleSaveStudentAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError(null);
    setAccountFeedback(null);

    const validation = validateUserProvisioning(
      {
        name: studentName,
        badgeId: studentBadgeId,
        username: studentUsername,
        password: studentPassword,
        department: studentDept,
      },
      managedStudents,
      editingStudentId,
      'student'
    );

    if (!validation.valid) {
      setAccountError(validation.error || 'Please check the student account fields.');
      return;
    }

    const cleanName = sanitizeInput(studentName, 80);
    const cleanBadgeId = sanitizeInput(studentBadgeId, 32).toUpperCase();
    const cleanUsername = sanitizeInput(studentUsername, 60).toLowerCase();
    const cleanDept = sanitizeInput(studentDept, 120);
    const cleanSemester = sanitizeInput(studentSemester, 80);
    const cleanPass = studentPassword.trim();

    if (editingStudentId) {
      onUpdateStudent(editingStudentId, {
        name: cleanName,
        badgeId: cleanBadgeId,
        username: cleanUsername,
        email: `${cleanUsername}@shiftsync.ai`,
        password: cleanPass,
        department: cleanDept,
        semester: cleanSemester,
      });
      setAccountFeedback(
        `Updated student account for ${cleanName} (${cleanBadgeId}).`
      );
      setEditingStudentId(null);
    } else {
      onCreateStudent({
        name: cleanName,
        badgeId: cleanBadgeId,
        username: cleanUsername,
        email: `${cleanUsername}@shiftsync.ai`,
        password: cleanPass,
        department: cleanDept,
        semester: cleanSemester,
        advisor: `${user.name} (College Admin)`,
        gpa: '3.85 / 4.00',
        createdByAdmin: true,
      });
      setAccountFeedback(
        `Student account created! Name: ${cleanName} · ID: ${cleanBadgeId} · Username: ${cleanUsername} · Password: ${cleanPass} — Ready for immediate login.`
      );
    }

    setStudentName('');
    setStudentBadgeId('');
    setStudentUsername('');
    setStudentPassword('');
    setTimeout(() => setAccountFeedback(null), 6000);
  };

  const handleStartEditStudent = (stu: DemoUser) => {
    setAccountError(null);
    setEditingStudentId(stu.id);
    setStudentName(stu.name);
    setStudentBadgeId(stu.badgeId);
    setStudentUsername(stu.username);
    setStudentPassword(stu.password || '');
    setStudentDept(stu.department);
    setStudentSemester(stu.semester || 'Semester 6 (Autumn 2026)');
    setActiveSection('students');
  };

  const deanBriefing = `Campus Administration Summary for ${user.name}. Total enrolled students across 5 engineering departments is ${totalStudents}. Campus-wide attendance stands at ${avgCampusAttendance.toFixed(
    1
  )}%, with ${verifiedPassportsCount} verified skill credentials and ${openComplaintsCount} open student complaints.`;

  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 flex flex-col">
      <a
        href="#college-admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-[#2563EB] focus:text-white focus:rounded-lg focus:font-bold focus:text-sm"
      >
        Skip to main content
      </a>

      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header
        role="banner"
        className="sticky top-0 z-30 bg-[#111827] border-b border-slate-800 px-6 py-3.5 flex items-center justify-between gap-8"
      >
        <a
          href="#top"
          aria-label="ShiftSync AI College Admin Home"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('overview');
          }}
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 font-display"
        >
          ShiftSync AI
        </a>

        <nav
          aria-label="College Admin Primary Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-300"
        >
          <button
            type="button"
            aria-current={activeSection === 'overview' ? 'page' : undefined}
            onClick={() => setActiveSection('overview')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'overview' ? 'text-[#2563EB] underline underline-offset-8' : ''
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            aria-current={activeSection === 'students' ? 'page' : undefined}
            onClick={() => setActiveSection('students')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'students' ? 'text-[#2563EB] underline underline-offset-8' : ''
            }`}
          >
            Student Accounts
          </button>
          <button
            type="button"
            aria-current={activeSection === 'departments' ? 'page' : undefined}
            onClick={() => setActiveSection('departments')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'departments' ? 'text-[#2563EB] underline underline-offset-8' : ''
            }`}
          >
            Departments
          </button>
          <button
            type="button"
            aria-current={activeSection === 'verification' ? 'page' : undefined}
            onClick={() => setActiveSection('verification')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'verification' ? 'text-[#2563EB] underline underline-offset-8' : ''
            }`}
          >
            Skill Verification
          </button>
          <button
            type="button"
            aria-current={activeSection === 'complaints' ? 'page' : undefined}
            onClick={() => setActiveSection('complaints')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'complaints' ? 'text-[#2563EB] underline underline-offset-8' : ''
            }`}
          >
            Complaints
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            aria-label="Log out of College Admin Portal"
            onClick={onLogout}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Log Out</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Desktop Sidebar */}
        <aside
          aria-label="College Admin Sidebar Navigation"
          className="hidden lg:flex w-64 shrink-0 bg-[#111827] border-r border-slate-800 flex-col justify-between p-5"
        >
          <div className="space-y-6">
            <div className="pb-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div
                  aria-hidden="true"
                  className="w-11 h-11 rounded-lg bg-[#2563EB] text-white flex items-center justify-center font-bold shrink-0"
                >
                  <GraduationCap className="w-6 h-6" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-white truncate">{user.name}</div>
                  <div className="text-xs text-slate-300 truncate">
                    {user.roleLabel} · {user.badgeId}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-300">{user.department}</div>
            </div>

            <div className="space-y-1.5">
              <button
                type="button"
                aria-current={activeSection === 'overview' ? 'page' : undefined}
                onClick={() => setActiveSection('overview')}
                className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeSection === 'overview'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <BarChart3 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Student Statistics</span>
              </button>

              <button
                type="button"
                aria-current={activeSection === 'students' ? 'page' : undefined}
                onClick={() => setActiveSection('students')}
                className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeSection === 'students'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <UserPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Manage Students</span>
              </button>

              <button
                type="button"
                aria-current={activeSection === 'departments' ? 'page' : undefined}
                onClick={() => setActiveSection('departments')}
                className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeSection === 'departments'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <Building2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Department Overview</span>
              </button>

              <button
                type="button"
                aria-current={activeSection === 'verification' ? 'page' : undefined}
                onClick={() => setActiveSection('verification')}
                className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeSection === 'verification'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <Award className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Skill Verification</span>
              </button>

              <button
                type="button"
                aria-current={activeSection === 'complaints' ? 'page' : undefined}
                onClick={() => setActiveSection('complaints')}
                className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeSection === 'complaints'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <MessageSquareWarning className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Complaints Management</span>
              </button>

              <button
                type="button"
                aria-current={activeSection === 'ai' ? 'page' : undefined}
                onClick={() => setActiveSection('ai')}
                className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeSection === 'ai'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>AI Studio &amp; Voice</span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 text-xs text-slate-300 space-y-1">
            <div>University Accreditation Board</div>
            <div>Student Provisioning Enabled</div>
          </div>
        </aside>

        {/* Main Content */}
        <main
          id="college-admin-main"
          role="main"
          className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10 space-y-8"
        >
          {/* Header Banner */}
          <div className="bg-[#111827] rounded-xl border border-slate-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-[#0284C7]">
                College Admin Governance Console · {user.badgeId}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                {user.department}
              </h1>
              <p className="text-sm text-slate-300">
                Create and manage student login accounts, analyze department attendance, and verify skill passports.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveSection('students')}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                <span>Create Student Account</span>
              </button>
              <TTSBriefingButton
                text={deanBriefing}
                label="Listen to Campus Briefing"
                darkTheme={true}
              />
            </div>
          </div>

          {/* 4 Student Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-[#111827] rounded-xl border border-slate-800 p-6 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Total Enrolled Students</span>
                <GraduationCap className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
              </div>
              <div className="text-3xl font-bold font-mono tabular-nums text-white">
                {totalStudents.toLocaleString()}
              </div>
              <div className="text-xs text-slate-300">
                {managedStudents.length} admin-created · 5 departments
              </div>
            </div>

            <div className="bg-[#111827] rounded-xl border border-slate-800 p-6 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Attendance Analytics</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              </div>
              <div className="text-3xl font-bold font-mono tabular-nums text-emerald-400">
                {avgCampusAttendance.toFixed(1)}%
              </div>
              <div className="text-xs text-slate-300">Mean lecture &amp; lab attendance</div>
            </div>

            <div className="bg-[#111827] rounded-xl border border-slate-800 p-6 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Verified Skill Credentials</span>
                <Award className="w-4 h-4 text-[#0284C7]" aria-hidden="true" />
              </div>
              <div className="text-3xl font-bold font-mono tabular-nums text-[#0284C7]">
                {verifiedPassportsCount.toLocaleString()}
              </div>
              <div className="text-xs text-slate-300">Digital skill passports issued</div>
            </div>

            <div className="bg-[#111827] rounded-xl border border-slate-800 p-6 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Open Campus Complaints</span>
                <MessageSquareWarning className="w-4 h-4 text-amber-400" aria-hidden="true" />
              </div>
              <div className="text-3xl font-bold font-mono tabular-nums text-amber-400">
                {openComplaintsCount}
              </div>
              <div className="text-xs text-slate-300">Active lab &amp; facility grievances</div>
            </div>
          </div>

          {/* STUDENT ACCOUNT PROVISIONING & MANAGEMENT (Visible on Overview and Students tab) */}
          {(activeSection === 'students' || activeSection === 'overview') && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Create / Edit Student Form */}
              <div className="lg:col-span-5 bg-[#111827] rounded-xl border border-slate-800 p-6 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {editingStudentId ? 'Edit Student Account' : 'Create Student Account'}
                    </h2>
                    <p className="text-xs text-slate-300 mt-1">
                      Students cannot create accounts themselves. Generate Student ID, username, and password here.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleFillRahulExample}
                    className="px-3 py-1.5 min-h-[36px] rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-[#0284C7] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Fill Example (Rahul / CSE101)
                  </button>
                </div>

                {accountFeedback && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="p-4 rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-xs font-medium leading-relaxed"
                  >
                    {accountFeedback}
                  </div>
                )}

                {accountError && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="p-3.5 rounded-lg bg-red-950/70 border border-red-700/70 text-red-200 text-xs font-semibold leading-relaxed"
                  >
                    {accountError}
                  </div>
                )}

                <form onSubmit={handleSaveStudentAccount} className="space-y-4" noValidate>
                  <div>
                    <label
                      htmlFor="admin-student-name"
                      className="block text-xs font-semibold text-slate-200 mb-1.5"
                    >
                      Student Full Name
                    </label>
                    <input
                      id="admin-student-name"
                      type="text"
                      required
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="e.g., Rahul"
                      className="w-full px-4 py-2.5 min-h-[44px] rounded-lg bg-[#0B1220] border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="admin-student-id"
                        className="block text-xs font-semibold text-slate-200"
                      >
                        Student ID
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateStudentId}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0284C7] hover:underline cursor-pointer"
                      >
                        <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Generate Student ID</span>
                      </button>
                    </div>
                    <input
                      id="admin-student-id"
                      type="text"
                      required
                      value={studentBadgeId}
                      onChange={(e) => setStudentBadgeId(e.target.value)}
                      placeholder="e.g., CSE101"
                      className="w-full px-4 py-2.5 min-h-[44px] rounded-lg bg-[#0B1220] border border-slate-700 text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="admin-student-dept"
                        className="block text-xs font-semibold text-slate-200 mb-1.5"
                      >
                        Department / Program
                      </label>
                      <input
                        id="admin-student-dept"
                        type="text"
                        required
                        value={studentDept}
                        onChange={(e) => setStudentDept(e.target.value)}
                        className="w-full px-3.5 py-2.5 min-h-[44px] rounded-lg bg-[#0B1220] border border-slate-700 text-sm text-white"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="admin-student-semester"
                        className="block text-xs font-semibold text-slate-200 mb-1.5"
                      >
                        Semester
                      </label>
                      <input
                        id="admin-student-semester"
                        type="text"
                        required
                        value={studentSemester}
                        onChange={(e) => setStudentSemester(e.target.value)}
                        className="w-full px-3.5 py-2.5 min-h-[44px] rounded-lg bg-[#0B1220] border border-slate-700 text-sm text-white"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-300">
                        Login Credentials
                      </span>
                      <button
                        type="button"
                        onClick={handleGenerateCredentials}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Generate Username &amp; Password</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="admin-student-username"
                          className="block text-xs font-semibold text-slate-200 mb-1.5"
                        >
                          Username
                        </label>
                        <input
                          id="admin-student-username"
                          type="text"
                          required
                          value={studentUsername}
                          onChange={(e) => setStudentUsername(e.target.value)}
                          placeholder="e.g., rahul101"
                          className="w-full px-3.5 py-2.5 min-h-[44px] rounded-lg bg-[#0B1220] border border-slate-700 text-sm font-mono text-white placeholder:text-slate-500"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="admin-student-password"
                          className="block text-xs font-semibold text-slate-200 mb-1.5"
                        >
                          Password
                        </label>
                        <input
                          id="admin-student-password"
                          type="text"
                          required
                          value={studentPassword}
                          onChange={(e) => setStudentPassword(e.target.value)}
                          placeholder="e.g., demo123"
                          className="w-full px-3.5 py-2.5 min-h-[44px] rounded-lg bg-[#0B1220] border border-slate-700 text-sm font-mono text-white placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      className="flex-1 inline-flex items-center justify-center gap-2 py-3 min-h-[48px] rounded-lg bg-[#2563EB] text-white text-sm font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" aria-hidden="true" />
                      <span>
                        {editingStudentId ? 'Save Student Changes' : 'Create Student Account'}
                      </span>
                    </button>
                    {editingStudentId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStudentId(null);
                          setAccountError(null);
                          setStudentName('');
                          setStudentBadgeId('');
                          setStudentUsername('');
                          setStudentPassword('');
                        }}
                        className="px-4 py-3 min-h-[48px] rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Provisioned Student Accounts Table (Edit / Delete) */}
              <div className="lg:col-span-7 bg-[#111827] rounded-xl border border-slate-800 p-6 flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  <div className="pb-4 border-b border-slate-800 flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-white">
                        Provisioned Student Login Accounts
                      </h2>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Students listed here can immediately log in via College / School → Student.
                      </p>
                    </div>
                    <span className="text-xs font-mono text-[#0284C7]">
                      {managedStudents.length} Active Accounts
                    </span>
                  </div>

                  {managedStudents.length === 0 ? (
                    <div className="py-12 text-center space-y-3 bg-[#0B1220] rounded-lg border border-slate-800/80 p-6">
                      <p className="text-sm text-slate-200 font-semibold">
                        No student login accounts created yet.
                      </p>
                      <p className="text-xs text-slate-300 max-w-md mx-auto">
                        Use the form on the left or click &ldquo;Fill Example (Rahul / CSE101)&rdquo; to create a student account and test immediate login.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table
                        aria-label="Provisioned Student Accounts"
                        className="w-full text-left border-collapse"
                      >
                        <thead>
                          <tr className="border-b border-slate-800 text-xs font-semibold text-slate-300 bg-[#0B1220]">
                            <th scope="col" className="py-3 px-4">
                              Student ID
                            </th>
                            <th scope="col" className="py-3 px-4">
                              Name &amp; Department
                            </th>
                            <th scope="col" className="py-3 px-4">
                              Username
                            </th>
                            <th scope="col" className="py-3 px-4">
                              Password
                            </th>
                            <th scope="col" className="py-3 px-4 text-right">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-sm">
                          {managedStudents.map((stu) => (
                            <tr key={stu.id} className="hover:bg-slate-800/40">
                              <td className="py-3.5 px-4 font-mono text-xs font-bold text-[#0284C7]">
                                {stu.badgeId}
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="font-bold text-white">{stu.name}</div>
                                <div className="text-xs text-slate-300">{stu.department}</div>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-xs text-slate-200">
                                {stu.username}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-xs text-emerald-400">
                                {stu.password}
                              </td>
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    aria-label={`Edit student account ${stu.name}`}
                                    onClick={() => handleStartEditStudent(stu)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Delete student account ${stu.name}`}
                                    onClick={() => onDeleteStudent(stu.id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] rounded bg-red-950/70 hover:bg-red-900/80 text-xs font-semibold text-red-300 border border-red-800/50 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ATTENDANCE ANALYTICS CHART */}
          {(activeSection === 'overview' || activeSection === 'departments') && (
            <div className="bg-[#111827] rounded-xl border border-slate-800 p-6 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Department Attendance Analytics &amp; Verification Rate
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Comparative attendance percentage and verified skill passport coverage by department.
                </p>
              </div>

              <div className="space-y-4">
                {departments.map((dept) => (
                  <div key={dept.id} className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                      <span className="font-semibold text-white">
                        {dept.department} · <span className="text-slate-300">{dept.headOfDept}</span>
                      </span>
                      <span className="font-mono tabular-nums text-slate-200">
                        Attendance {dept.avgAttendance.toFixed(1)}% · {dept.verifiedSkills} Verified Skills
                      </span>
                    </div>
                    <div className="w-full h-3 bg-[#0B1220] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#2563EB] rounded-full"
                        style={{ width: `${dept.avgAttendance}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DEPARTMENT OVERVIEW TABLE */}
          {(activeSection === 'departments' || activeSection === 'overview') && (
            <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-800">
                <h2 className="text-lg font-bold text-white">Department Overview</h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Enrollment, attendance compliance, and pending skill verifications across academic departments.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table
                  aria-label="Academic Department Overview"
                  className="w-full text-left border-collapse"
                >
                  <thead>
                    <tr className="border-b border-slate-800 text-xs font-semibold text-slate-300 bg-[#0B1220]">
                      <th scope="col" className="py-3.5 px-6">
                        Department
                      </th>
                      <th scope="col" className="py-3.5 px-6">
                        Head of Department
                      </th>
                      <th scope="col" className="py-3.5 px-6 text-right">
                        Students
                      </th>
                      <th scope="col" className="py-3.5 px-6 text-right">
                        Avg Attendance
                      </th>
                      <th scope="col" className="py-3.5 px-6 text-right">
                        Verified Skills
                      </th>
                      <th scope="col" className="py-3.5 px-6 text-right">
                        Pending Review
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {departments.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-800/40">
                        <td className="py-4 px-6 font-semibold text-white">{d.department}</td>
                        <td className="py-4 px-6 text-slate-200">{d.headOfDept}</td>
                        <td className="py-4 px-6 text-right font-mono tabular-nums text-slate-200">
                          {d.totalStudents}
                        </td>
                        <td className="py-4 px-6 text-right font-mono tabular-nums text-emerald-400">
                          {d.avgAttendance.toFixed(1)}%
                        </td>
                        <td className="py-4 px-6 text-right font-mono tabular-nums text-[#0284C7] font-semibold">
                          {d.verifiedSkills}
                        </td>
                        <td className="py-4 px-6 text-right font-mono tabular-nums text-amber-400">
                          {d.pendingVerifications}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SKILL VERIFICATION QUEUE */}
          {(activeSection === 'verification' || activeSection === 'overview') && (
            <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-800">
                <h2 className="text-lg font-bold text-white">Student Skill Verification Queue</h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Verify student lab certifications, software proficiencies, and practicum hours.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table
                  aria-label="Student Skill Verification Queue"
                  className="w-full text-left border-collapse"
                >
                  <thead>
                    <tr className="border-b border-slate-800 text-xs font-semibold text-slate-300 bg-[#0B1220]">
                      <th scope="col" className="py-3.5 px-6">
                        Student Name
                      </th>
                      <th scope="col" className="py-3.5 px-6">
                        Certificate / Skill Title
                      </th>
                      <th scope="col" className="py-3.5 px-6">
                        Issuing Body
                      </th>
                      <th scope="col" className="py-3.5 px-6 text-right">
                        Practicum Hrs
                      </th>
                      <th scope="col" className="py-3.5 px-6">
                        Status
                      </th>
                      <th scope="col" className="py-3.5 px-6 text-right">
                        Verification Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {collegeSkills.map((sk) => (
                      <tr key={sk.id} className="hover:bg-slate-800/40">
                        <td className="py-4 px-6 font-semibold text-white whitespace-nowrap">
                          {sk.userName}
                        </td>
                        <td className="py-4 px-6 text-slate-200">{sk.title}</td>
                        <td className="py-4 px-6 text-slate-300">{sk.issuer}</td>
                        <td className="py-4 px-6 text-right font-mono tabular-nums text-slate-200">
                          {sk.experienceHours}h
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span
                            className={`text-xs font-semibold ${
                              sk.verifiedStatus === 'Verified'
                                ? 'text-emerald-400'
                                : 'text-amber-400'
                            }`}
                          >
                            {sk.verifiedStatus}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          {sk.verifiedStatus === 'Pending' ? (
                            <button
                              type="button"
                              onClick={() => onVerifySkill(sk.id)}
                              className="px-4 py-1.5 min-h-[36px] rounded-md bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
                            >
                              Verify Credential
                            </button>
                          ) : (
                            <span className="text-xs font-mono text-slate-400">Approved</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* COMPLAINTS MANAGEMENT TABLE */}
          {(activeSection === 'complaints' || activeSection === 'overview') && (
            <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-800">
                <h2 className="text-lg font-bold text-white">Campus Complaints Management</h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Review and resolve student laboratory, facility, and scheduling complaints.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table
                  aria-label="Campus Complaints Management"
                  className="w-full text-left border-collapse"
                >
                  <thead>
                    <tr className="border-b border-slate-800 text-xs font-semibold text-slate-300 bg-[#0B1220]">
                      <th scope="col" className="py-3.5 px-6">
                        Complaint &amp; Details
                      </th>
                      <th scope="col" className="py-3.5 px-6">
                        Student
                      </th>
                      <th scope="col" className="py-3.5 px-6">
                        Campus Location
                      </th>
                      <th scope="col" className="py-3.5 px-6">
                        Priority
                      </th>
                      <th scope="col" className="py-3.5 px-6">
                        Status
                      </th>
                      <th scope="col" className="py-3.5 px-6 text-right">
                        Resolution Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {collegeComplaints.map((cmp) => (
                      <tr key={cmp.id} className="hover:bg-slate-800/40">
                        <td className="py-4 px-6 max-w-md">
                          <div className="font-bold text-white">{cmp.title}</div>
                          <div className="text-xs text-slate-300 mt-1">{cmp.description}</div>
                        </td>
                        <td className="py-4 px-6 text-slate-200 whitespace-nowrap">
                          {cmp.authorName}
                        </td>
                        <td className="py-4 px-6 text-slate-300 whitespace-nowrap">
                          {cmp.location}
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span
                            className={`text-xs font-semibold ${
                              cmp.priority === 'High' || cmp.priority === 'Critical'
                                ? 'text-amber-400'
                                : 'text-slate-200'
                            }`}
                          >
                            {cmp.priority}
                          </span>
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span
                            className={`text-xs font-semibold ${
                              cmp.status === 'Resolved'
                                ? 'text-emerald-400'
                                : cmp.status === 'Under Review'
                                ? 'text-[#0284C7]'
                                : 'text-amber-400'
                            }`}
                          >
                            {cmp.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            {cmp.status === 'Submitted' && (
                              <button
                                type="button"
                                onClick={() => onUpdateComplaintStatus(cmp.id, 'Under Review')}
                                className="px-3 py-1.5 min-h-[36px] rounded-md bg-[#0284C7] text-white text-xs font-semibold hover:bg-sky-600 transition-colors cursor-pointer"
                              >
                                Review
                              </button>
                            )}
                            {cmp.status !== 'Resolved' && (
                              <button
                                type="button"
                                onClick={() => onUpdateComplaintStatus(cmp.id, 'Resolved')}
                                className="px-3 py-1.5 min-h-[36px] rounded-md bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
                              >
                                Mark Resolved
                              </button>
                            )}
                            {cmp.status === 'Resolved' && (
                              <span className="text-xs font-mono text-slate-400">Closed</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AI STUDIO */}
          {activeSection === 'ai' && (
            <Suspense
              fallback={
                <div
                  role="status"
                  aria-live="polite"
                  className="bg-[#111827] rounded-xl border border-slate-800 p-10 flex items-center justify-center gap-3 text-sm font-semibold text-slate-200"
                >
                  <Loader2 className="w-5 h-5 text-[#2563EB] animate-spin" aria-hidden="true" />
                  <span>Loading AI Transparency Studio...</span>
                </div>
              }
            >
              <AITransparencyStudio roleLabel="College Admin" darkTheme={true} />
            </Suspense>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="College Admin Mobile Bottom Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#111827] border-t border-slate-800 px-2 py-1.5 grid grid-cols-5 gap-1"
      >
        <button
          type="button"
          aria-current={activeSection === 'overview' ? 'page' : undefined}
          onClick={() => setActiveSection('overview')}
          className={`flex flex-col items-center justify-center py-2 min-h-[48px] rounded-lg text-xs font-semibold cursor-pointer ${
            activeSection === 'overview' ? 'text-[#2563EB] bg-slate-800' : 'text-slate-300'
          }`}
        >
          <BarChart3 className="w-4 h-4 mb-0.5" aria-hidden="true" />
          <span className="truncate">Stats</span>
        </button>
        <button
          type="button"
          aria-current={activeSection === 'students' ? 'page' : undefined}
          onClick={() => setActiveSection('students')}
          className={`flex flex-col items-center justify-center py-2 min-h-[48px] rounded-lg text-xs font-semibold cursor-pointer ${
            activeSection === 'students' ? 'text-[#2563EB] bg-slate-800' : 'text-slate-300'
          }`}
        >
          <UserPlus className="w-4 h-4 mb-0.5" aria-hidden="true" />
          <span className="truncate">Students</span>
        </button>
        <button
          type="button"
          aria-current={activeSection === 'departments' ? 'page' : undefined}
          onClick={() => setActiveSection('departments')}
          className={`flex flex-col items-center justify-center py-2 min-h-[48px] rounded-lg text-xs font-semibold cursor-pointer ${
            activeSection === 'departments' ? 'text-[#2563EB] bg-slate-800' : 'text-slate-300'
          }`}
        >
          <Building2 className="w-4 h-4 mb-0.5" aria-hidden="true" />
          <span className="truncate">Depts</span>
        </button>
        <button
          type="button"
          aria-current={activeSection === 'verification' ? 'page' : undefined}
          onClick={() => setActiveSection('verification')}
          className={`flex flex-col items-center justify-center py-2 min-h-[48px] rounded-lg text-xs font-semibold cursor-pointer ${
            activeSection === 'verification' ? 'text-[#2563EB] bg-slate-800' : 'text-slate-300'
          }`}
        >
          <Award className="w-4 h-4 mb-0.5" aria-hidden="true" />
          <span className="truncate">Verify</span>
        </button>
        <button
          type="button"
          aria-current={activeSection === 'complaints' ? 'page' : undefined}
          onClick={() => setActiveSection('complaints')}
          className={`flex flex-col items-center justify-center py-2 min-h-[48px] rounded-lg text-xs font-semibold cursor-pointer ${
            activeSection === 'complaints' ? 'text-[#2563EB] bg-slate-800' : 'text-slate-300'
          }`}
        >
          <MessageSquareWarning className="w-4 h-4 mb-0.5" aria-hidden="true" />
          <span className="truncate">Issues</span>
        </button>
      </nav>
    </div>
  );
};
