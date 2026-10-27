import React, { Suspense, lazy, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  FileBadge,
  GraduationCap,
  Loader2,
  LogOut,
  MessageSquareWarning,
  Plus,
  UserCheck,
} from 'lucide-react';
import {
  AttendanceItem,
  DemoUser,
  SafetyComplaintItem,
  SkillRecordItem,
} from '../types';
import { TTSBriefingButton, VoiceTranscribeButton } from './AudioTools';
import {
  sanitizeInput,
  validateComplaintForm,
  validateSkillForm,
} from '../security/validation';

const AITransparencyStudio = lazy(() =>
  import('./AITransparencyStudio').then((m) => ({ default: m.AITransparencyStudio }))
);

interface CollegeStudentPortalProps {
  user: DemoUser;
  attendance: AttendanceItem[];
  complaints: SafetyComplaintItem[];
  skills: SkillRecordItem[];
  onCheckInSession: (courseName: string) => void;
  onAddComplaint: (item: Omit<SafetyComplaintItem, 'id' | 'dateSubmitted' | 'status'>) => void;
  onAddSkill: (item: Omit<SkillRecordItem, 'id' | 'verifiedStatus'>) => void;
  onLogout: () => void;
}

type StudentSection = 'attendance' | 'skills' | 'certificates' | 'complaints' | 'profile';

const STUDENT_COURSES = [
  { code: 'CE-304', name: 'Structural Analysis & Lab', attended: 28, total: 29, rate: 96.5 },
  { code: 'CE-312', name: 'Geotechnical Engineering', attended: 26, total: 28, rate: 92.8 },
  { code: 'CE-319', name: 'Hydrology & Water Systems', attended: 25, total: 26, rate: 96.1 },
  { code: 'CE-325', name: 'Construction Project Management', attended: 23, total: 25, rate: 92.0 },
];

export const CollegeStudentPortal: React.FC<CollegeStudentPortalProps> = ({
  user,
  attendance,
  complaints,
  skills,
  onCheckInSession,
  onAddComplaint,
  onAddSkill,
  onLogout,
}) => {
  const [activeSection, setActiveSection] = useState<StudentSection>('attendance');

  // Certificate submission form
  const [certTitle, setCertTitle] = useState('');
  const [certIssuer, setCertIssuer] = useState('');
  const [certHours, setCertHours] = useState('45');
  const [certError, setCertError] = useState<string | null>(null);
  const [certSaved, setCertSaved] = useState(false);

  // Campus complaint form
  const [cmpTitle, setCmpTitle] = useState('');
  const [cmpCategory, setCmpCategory] = useState('Lab Equipment Safety');
  const [cmpLocation, setCmpLocation] = useState('Engineering Block C — Room 108');
  const [cmpPriority, setCmpPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [cmpDesc, setCmpDesc] = useState('');
  const [cmpError, setCmpError] = useState<string | null>(null);
  const [cmpSaved, setCmpSaved] = useState(false);

  const studentAttendance = useMemo(
    () => attendance.filter((a) => a.portalType === 'college'),
    [attendance]
  );
  const studentSkills = useMemo(
    () => skills.filter((s) => s.portalType === 'college'),
    [skills]
  );
  const studentComplaints = useMemo(
    () => complaints.filter((c) => c.portalType === 'college'),
    [complaints]
  );

  const verifiedCount = useMemo(
    () => studentSkills.filter((s) => s.verifiedStatus === 'Verified').length,
    [studentSkills]
  );
  const totalPracticumHours = useMemo(
    () => studentSkills.reduce((acc, s) => acc + s.experienceHours, 0),
    [studentSkills]
  );

  const handleCreateCert = (e: React.FormEvent) => {
    e.preventDefault();
    setCertError(null);

    const hoursNum = Number(certHours);
    const validation = validateSkillForm({
      title: certTitle,
      issuer: certIssuer,
      experienceHours: hoursNum,
    });

    if (!validation.valid) {
      setCertError(validation.error || 'Please check the certificate form fields.');
      return;
    }

    onAddSkill({
      userId: user.id,
      userName: user.name,
      portalType: 'college',
      title: sanitizeInput(certTitle, 150),
      issuer: sanitizeInput(certIssuer, 120),
      issueDate: 'Oct 26, 2026',
      experienceHours: hoursNum,
    });
    setCertTitle('');
    setCertIssuer('');
    setCertHours('45');
    setCertSaved(true);
    setTimeout(() => setCertSaved(false), 4000);
  };

  const handleCreateComplaint = (e: React.FormEvent) => {
    e.preventDefault();
    setCmpError(null);

    const validation = validateComplaintForm({
      title: cmpTitle,
      location: cmpLocation,
      description: cmpDesc,
    });

    if (!validation.valid) {
      setCmpError(validation.error || 'Please check the complaint form fields.');
      return;
    }

    onAddComplaint({
      authorId: user.id,
      authorName: user.name,
      portalType: 'college',
      title: sanitizeInput(cmpTitle, 150),
      category: sanitizeInput(cmpCategory, 80),
      location: sanitizeInput(cmpLocation, 120),
      priority: cmpPriority,
      description: sanitizeInput(cmpDesc, 1500),
    });
    setCmpTitle('');
    setCmpDesc('');
    setCmpSaved(true);
    setTimeout(() => setCmpSaved(false), 4000);
  };

  const studentBriefing = `Hello ${user.name}. Your overall semester attendance is 94.4% across 4 core civil engineering courses. You have ${verifiedCount} verified certificates and ${totalPracticumHours} practical lab hours recorded in your Skill Passport.`;

  return (
    <div className="min-h-screen bg-[#F8F5F0] text-[#111827] flex flex-col">
      <a
        href="#student-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-[#2563EB] focus:text-white focus:rounded-lg focus:font-bold focus:text-sm"
      >
        Skip to main content
      </a>

      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header
        role="banner"
        className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-8"
      >
        <a
          href="#top"
          aria-label="ShiftSync AI Student Dashboard Home"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('attendance');
          }}
          className="text-lg font-bold tracking-tight text-[#111827] whitespace-nowrap shrink-0 font-display"
        >
          ShiftSync AI
        </a>

        <nav
          aria-label="College Student Primary Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600"
        >
          <button
            type="button"
            aria-current={activeSection === 'attendance' ? 'page' : undefined}
            onClick={() => setActiveSection('attendance')}
            className={`hover:text-[#111827] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'attendance' ? 'text-[#2563EB] underline underline-offset-8' : ''
            }`}
          >
            Attendance
          </button>
          <button
            type="button"
            aria-current={activeSection === 'skills' ? 'page' : undefined}
            onClick={() => setActiveSection('skills')}
            className={`hover:text-[#111827] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'skills' ? 'text-[#2563EB] underline underline-offset-8' : ''
            }`}
          >
            Skill Passport
          </button>
          <button
            type="button"
            aria-current={activeSection === 'certificates' ? 'page' : undefined}
            onClick={() => setActiveSection('certificates')}
            className={`hover:text-[#111827] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'certificates' ? 'text-[#2563EB] underline underline-offset-8' : ''
            }`}
          >
            Certificates
          </button>
          <button
            type="button"
            aria-current={activeSection === 'complaints' ? 'page' : undefined}
            onClick={() => setActiveSection('complaints')}
            className={`hover:text-[#111827] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'complaints' ? 'text-[#2563EB] underline underline-offset-8' : ''
            }`}
          >
            Complaints
          </button>
          <button
            type="button"
            aria-current={activeSection === 'profile' ? 'page' : undefined}
            onClick={() => setActiveSection('profile')}
            className={`hover:text-[#111827] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'profile' ? 'text-[#2563EB] underline underline-offset-8' : ''
            }`}
          >
            Profile
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            aria-label="Sign out and switch role"
            onClick={onLogout}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Switch Role</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Desktop Sidebar */}
        <aside
          aria-label="Student Sidebar Navigation"
          className="hidden lg:flex w-64 shrink-0 bg-white border-r border-slate-200 flex-col justify-between p-5"
        >
          <div className="space-y-6">
            <div className="pb-5 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div
                  aria-hidden="true"
                  className="w-11 h-11 rounded-lg bg-[#2563EB] text-white flex items-center justify-center font-bold shrink-0"
                >
                  <GraduationCap className="w-6 h-6" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{user.name}</div>
                  <div className="text-xs text-slate-600 truncate">
                    {user.roleLabel} · {user.badgeId}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-700">{user.department}</div>
            </div>

            <div className="space-y-1.5">
              <button
                type="button"
                aria-current={activeSection === 'attendance' ? 'page' : undefined}
                onClick={() => setActiveSection('attendance')}
                className={`w-full flex items-center gap-3 px-4 py-3 min-h-[48px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeSection === 'attendance'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-[#111827] hover:bg-[#F8F5F0]'
                }`}
              >
                <CalendarCheck className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>Attendance</span>
              </button>

              <button
                type="button"
                aria-current={activeSection === 'skills' ? 'page' : undefined}
                onClick={() => setActiveSection('skills')}
                className={`w-full flex items-center gap-3 px-4 py-3 min-h-[48px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeSection === 'skills'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-[#111827] hover:bg-[#F8F5F0]'
                }`}
              >
                <Award className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>Skill Passport</span>
              </button>

              <button
                type="button"
                aria-current={activeSection === 'certificates' ? 'page' : undefined}
                onClick={() => setActiveSection('certificates')}
                className={`w-full flex items-center gap-3 px-4 py-3 min-h-[48px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeSection === 'certificates'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-[#111827] hover:bg-[#F8F5F0]'
                }`}
              >
                <FileBadge className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>Certificates</span>
              </button>

              <button
                type="button"
                aria-current={activeSection === 'complaints' ? 'page' : undefined}
                onClick={() => setActiveSection('complaints')}
                className={`w-full flex items-center gap-3 px-4 py-3 min-h-[48px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeSection === 'complaints'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-[#111827] hover:bg-[#F8F5F0]'
                }`}
              >
                <MessageSquareWarning className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>Complaints</span>
              </button>

              <button
                type="button"
                aria-current={activeSection === 'profile' ? 'page' : undefined}
                onClick={() => setActiveSection('profile')}
                className={`w-full flex items-center gap-3 px-4 py-3 min-h-[48px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeSection === 'profile'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-[#111827] hover:bg-[#F8F5F0]'
                }`}
              >
                <UserCheck className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>Profile &amp; AI Studio</span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 text-xs text-slate-600 space-y-1">
            <div>Advisor · {user.advisor}</div>
            <div>{user.semester}</div>
          </div>
        </aside>

        {/* Main Content */}
        <main
          id="student-main-content"
          role="main"
          className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10 space-y-8"
        >
          {/* Student Header Summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-600">
                College Student Portal · {user.badgeId} · {user.semester}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{user.name}</h1>
              <p className="text-sm text-slate-700">
                {user.department} · Cumulative GPA {user.gpa}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <TTSBriefingButton text={studentBriefing} label="Listen to Academic Summary" />
              <button
                type="button"
                onClick={() => onCheckInSession('Structural Analysis Lab (CE-304)')}
                className="px-5 py-3 min-h-[48px] rounded-lg bg-[#2563EB] text-white text-sm font-bold hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Check In to Today&apos;s Lab Session
              </button>
            </div>
          </div>

          {/* SECTION 1: ATTENDANCE */}
          {activeSection === 'attendance' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {STUDENT_COURSES.map((course) => (
                  <div
                    key={course.code}
                    className="bg-white rounded-xl border border-slate-200 p-6 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                      <span className="font-mono">{course.code}</span>
                      <BookOpen className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
                    </div>
                    <div className="text-base font-bold leading-snug">{course.name}</div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-[#2563EB]">
                      {course.rate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-slate-600 font-mono tabular-nums">
                      Attended {course.attended} / {course.total} sessions
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                  <h2 className="text-lg font-bold">Verified Lecture &amp; Lab Attendance Log</h2>
                  <p className="text-xs text-slate-600 mt-1">
                    Real-time check-in records synchronized with department faculty.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table
                    aria-label="Student Course Attendance History"
                    className="w-full text-left border-collapse"
                  >
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600 bg-[#F8F5F0]">
                        <th scope="col" className="py-3.5 px-6">
                          Date
                        </th>
                        <th scope="col" className="py-3.5 px-6">
                          Course / Lab Session
                        </th>
                        <th scope="col" className="py-3.5 px-6">
                          Check-In
                        </th>
                        <th scope="col" className="py-3.5 px-6">
                          Check-Out
                        </th>
                        <th scope="col" className="py-3.5 px-6 text-right">
                          Session Hrs
                        </th>
                        <th scope="col" className="py-3.5 px-6">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {studentAttendance.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="py-4 px-6 font-mono tabular-nums font-semibold">
                            {row.dateLabel}
                          </td>
                          <td className="py-4 px-6">{row.department}</td>
                          <td className="py-4 px-6 font-mono tabular-nums">{row.checkInTime}</td>
                          <td className="py-4 px-6 font-mono tabular-nums">{row.checkOutTime}</td>
                          <td className="py-4 px-6 text-right font-mono tabular-nums">
                            {row.regularHours.toFixed(1)}
                          </td>
                          <td className="py-4 px-6 text-xs font-semibold text-emerald-700">
                            {row.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: SKILL PASSPORT */}
          {activeSection === 'skills' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-1">
                  <div className="text-xs font-semibold text-slate-600">Verified Competencies</div>
                  <div className="text-3xl font-bold font-mono tabular-nums text-[#2563EB]">
                    {verifiedCount}
                  </div>
                  <div className="text-xs text-slate-700">Approved by Faculty Board</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-1">
                  <div className="text-xs font-semibold text-slate-600">Total Practicum Hours</div>
                  <div className="text-3xl font-bold font-mono tabular-nums">
                    {totalPracticumHours} hrs
                  </div>
                  <div className="text-xs text-slate-700">Logged across labs &amp; fieldwork</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-1">
                  <div className="text-xs font-semibold text-slate-600">Employability Readiness</div>
                  <div className="text-3xl font-bold font-mono tabular-nums text-emerald-700">
                    Tier A
                  </div>
                  <div className="text-xs text-slate-700">Verified Industry Portfolio</div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                <div>
                  <h2 className="text-xl font-bold">Academic &amp; Technical Skill Passport</h2>
                  <p className="text-sm text-slate-700 mt-1">
                    Verified engineering competencies and practical laboratory hours.
                  </p>
                </div>

                <div className="divide-y divide-slate-200">
                  {studentSkills.map((sk) => (
                    <div key={sk.id} className="py-5 first:pt-0 last:pb-0 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-base font-bold">{sk.title}</h3>
                        <span
                          className={`text-xs font-semibold ${
                            sk.verifiedStatus === 'Verified'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {sk.verifiedStatus}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span>Department / Issuer: {sk.issuer}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          Lab &amp; Project Hours: {sk.experienceHours} hrs
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{sk.issueDate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: CERTIFICATES */}
          {activeSection === 'certificates' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                <div>
                  <h2 className="text-xl font-bold">Earned Certificates &amp; Credentials</h2>
                  <p className="text-sm text-slate-700 mt-1">
                    Official academic certificates verified by the College Admin portal.
                  </p>
                </div>

                <div className="space-y-4">
                  {studentSkills.map((cert) => (
                    <div
                      key={cert.id}
                      className="p-5 rounded-lg border border-slate-200 bg-[#F8F5F0]/60 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-bold text-base">{cert.title}</div>
                        <span
                          className={`text-xs font-semibold shrink-0 ${
                            cert.verifiedStatus === 'Verified'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {cert.verifiedStatus}
                        </span>
                      </div>
                      <div className="text-xs text-slate-700">
                        Issued by {cert.issuer} · <span className="font-mono">{cert.issueDate}</span> ·{' '}
                        <span className="font-mono tabular-nums">{cert.experienceHours} hrs</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                <div>
                  <h2 className="text-xl font-bold">Submit Certificate for Verification</h2>
                  <p className="text-sm text-slate-700 mt-1">
                    Log a new workshop, internship, or lab certification for admin approval.
                  </p>
                </div>

                {certSaved && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800"
                  >
                    Certificate submitted for College Admin verification.
                  </div>
                )}

                {certError && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700"
                  >
                    {certError}
                  </div>
                )}

                <form onSubmit={handleCreateCert} className="space-y-4" noValidate>
                  <div>
                    <label
                      htmlFor="student-cert-title"
                      className="block text-sm font-semibold mb-1.5"
                    >
                      Certificate Title
                    </label>
                    <input
                      id="student-cert-title"
                      type="text"
                      required
                      value={certTitle}
                      onChange={(e) => setCertTitle(e.target.value)}
                      placeholder="e.g., Finite Element Structural Analysis Workshop"
                      className="w-full px-4 py-3 min-h-[48px] rounded-lg border border-slate-300 bg-[#F8F5F0] text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="student-cert-issuer"
                      className="block text-sm font-semibold mb-1.5"
                    >
                      Issuing Authority
                    </label>
                    <input
                      id="student-cert-issuer"
                      type="text"
                      required
                      value={certIssuer}
                      onChange={(e) => setCertIssuer(e.target.value)}
                      placeholder="e.g., Department of Civil Engineering"
                      className="w-full px-4 py-3 min-h-[48px] rounded-lg border border-slate-300 bg-[#F8F5F0] text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="student-cert-hours"
                      className="block text-sm font-semibold mb-1.5"
                    >
                      Course / Practicum Hours
                    </label>
                    <input
                      id="student-cert-hours"
                      type="number"
                      min="1"
                      max="2000"
                      required
                      value={certHours}
                      onChange={(e) => setCertHours(e.target.value)}
                      className="w-full px-4 py-3 min-h-[48px] rounded-lg border border-slate-300 bg-[#F8F5F0] text-sm font-mono tabular-nums"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 py-4 min-h-[52px] rounded-lg bg-[#2563EB] text-white text-base font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    <Plus className="w-5 h-5" aria-hidden="true" />
                    <span>Submit Certificate</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* SECTION 4: COMPLAINTS */}
          {activeSection === 'complaints' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                <div>
                  <h2 className="text-xl font-bold">Submit Campus or Lab Complaint</h2>
                  <p className="text-sm text-slate-700 mt-1">
                    Report lab equipment issues, campus safety concerns, or scheduling grievances.
                  </p>
                </div>

                {cmpSaved && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Complaint logged and routed to College Admin.</span>
                  </div>
                )}

                {cmpError && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700"
                  >
                    {cmpError}
                  </div>
                )}

                <form onSubmit={handleCreateComplaint} className="space-y-4" noValidate>
                  <div>
                    <label
                      htmlFor="student-cmp-title"
                      className="block text-sm font-semibold mb-1.5"
                    >
                      Issue Summary
                    </label>
                    <input
                      id="student-cmp-title"
                      type="text"
                      required
                      value={cmpTitle}
                      onChange={(e) => setCmpTitle(e.target.value)}
                      placeholder="e.g., Total Station Theodolite Tripod Lock Loose"
                      className="w-full px-4 py-3 min-h-[48px] rounded-lg border border-slate-300 bg-[#F8F5F0] text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="student-cmp-category"
                        className="block text-sm font-semibold mb-1.5"
                      >
                        Category
                      </label>
                      <select
                        id="student-cmp-category"
                        value={cmpCategory}
                        onChange={(e) => setCmpCategory(e.target.value)}
                        className="w-full px-3 py-3 min-h-[48px] rounded-lg border border-slate-300 bg-[#F8F5F0] text-sm"
                      >
                        <option value="Lab Equipment Safety">Lab Equipment Safety</option>
                        <option value="Facility & Ventilation">Facility &amp; Ventilation</option>
                        <option value="Campus Safety">Campus Safety</option>
                        <option value="Academic Scheduling">Academic Scheduling</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="student-cmp-priority"
                        className="block text-sm font-semibold mb-1.5"
                      >
                        Priority
                      </label>
                      <select
                        id="student-cmp-priority"
                        value={cmpPriority}
                        onChange={(e) =>
                          setCmpPriority(
                            e.target.value as 'Low' | 'Medium' | 'High' | 'Critical'
                          )
                        }
                        className="w-full px-3 py-3 min-h-[48px] rounded-lg border border-slate-300 bg-[#F8F5F0] text-sm font-semibold"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="student-cmp-location"
                      className="block text-sm font-semibold mb-1.5"
                    >
                      Campus Location
                    </label>
                    <input
                      id="student-cmp-location"
                      type="text"
                      required
                      value={cmpLocation}
                      onChange={(e) => setCmpLocation(e.target.value)}
                      className="w-full px-4 py-3 min-h-[48px] rounded-lg border border-slate-300 bg-[#F8F5F0] text-sm"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="student-cmp-desc"
                        className="block text-sm font-semibold"
                      >
                        Description
                      </label>
                      <VoiceTranscribeButton
                        onTranscribed={(spoken) =>
                          setCmpDesc((prev) => (prev ? `${prev} ${spoken}` : spoken))
                        }
                      />
                    </div>
                    <textarea
                      id="student-cmp-desc"
                      rows={4}
                      required
                      value={cmpDesc}
                      onChange={(e) => setCmpDesc(e.target.value)}
                      placeholder="Describe the campus or laboratory issue in detail..."
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-[#F8F5F0] text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 min-h-[52px] rounded-lg bg-[#2563EB] text-white text-base font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    Submit Campus Complaint
                  </button>
                </form>
              </div>

              <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                <div>
                  <h2 className="text-xl font-bold">Campus Complaint Status Tracker</h2>
                  <p className="text-sm text-slate-700 mt-1">
                    Track administrative review and resolution for every submitted student report.
                  </p>
                </div>

                <div className="divide-y divide-slate-200">
                  {studentComplaints.map((item) => (
                    <div key={item.id} className="py-5 first:pt-0 last:pb-0 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-base font-bold">{item.title}</h3>
                        <span className="text-xs font-semibold text-[#2563EB]">
                          Status · {item.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{item.description}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className="font-semibold">Priority: {item.priority}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.location}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{item.dateSubmitted}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: PROFILE & AI STUDIO */}
          {activeSection === 'profile' && (
            <div className="space-y-8">
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
                <div className="pb-4 border-b border-slate-200">
                  <h2 className="text-xl font-bold">Student Academic Profile</h2>
                  <p className="text-sm text-slate-700 mt-1">
                    Verified enrollment, faculty advisor, and academic standing.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
                  <div>
                    <div className="text-xs text-slate-600">Full Name</div>
                    <div className="font-bold text-base mt-0.5">{user.name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-600">Student Registration ID</div>
                    <div className="font-mono font-bold text-base mt-0.5">{user.badgeId}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-600">Academic Program</div>
                    <div className="font-bold text-base mt-0.5">{user.department}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-600">Current Term</div>
                    <div className="font-semibold mt-0.5">{user.semester}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-600">Faculty Advisor</div>
                    <div className="font-semibold mt-0.5">{user.advisor}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-600">Cumulative GPA</div>
                    <div className="font-mono font-bold text-[#2563EB] text-base mt-0.5">
                      {user.gpa}
                    </div>
                  </div>
                </div>
              </div>

              <Suspense
                fallback={
                  <div
                    role="status"
                    aria-live="polite"
                    className="bg-white rounded-xl border border-slate-200 p-10 flex items-center justify-center gap-3 text-sm font-semibold text-slate-700"
                  >
                    <Loader2 className="w-5 h-5 text-[#2563EB] animate-spin" aria-hidden="true" />
                    <span>Loading AI Transparency Studio...</span>
                  </div>
                }
              >
                <AITransparencyStudio roleLabel="College Student" darkTheme={false} />
              </Suspense>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Student Mobile Bottom Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 px-2 py-1.5 grid grid-cols-5 gap-1"
      >
        <button
          type="button"
          aria-current={activeSection === 'attendance' ? 'page' : undefined}
          onClick={() => setActiveSection('attendance')}
          className={`flex flex-col items-center justify-center py-2 min-h-[48px] rounded-lg text-xs font-semibold cursor-pointer ${
            activeSection === 'attendance' ? 'text-[#2563EB] bg-blue-50/60' : 'text-slate-700'
          }`}
        >
          <CalendarCheck className="w-4 h-4 mb-0.5" aria-hidden="true" />
          <span className="truncate">Attendance</span>
        </button>
        <button
          type="button"
          aria-current={activeSection === 'skills' ? 'page' : undefined}
          onClick={() => setActiveSection('skills')}
          className={`flex flex-col items-center justify-center py-2 min-h-[48px] rounded-lg text-xs font-semibold cursor-pointer ${
            activeSection === 'skills' ? 'text-[#2563EB] bg-blue-50/60' : 'text-slate-700'
          }`}
        >
          <Award className="w-4 h-4 mb-0.5" aria-hidden="true" />
          <span className="truncate">Skills</span>
        </button>
        <button
          type="button"
          aria-current={activeSection === 'certificates' ? 'page' : undefined}
          onClick={() => setActiveSection('certificates')}
          className={`flex flex-col items-center justify-center py-2 min-h-[48px] rounded-lg text-xs font-semibold cursor-pointer ${
            activeSection === 'certificates' ? 'text-[#2563EB] bg-blue-50/60' : 'text-slate-700'
          }`}
        >
          <FileBadge className="w-4 h-4 mb-0.5" aria-hidden="true" />
          <span className="truncate">Certs</span>
        </button>
        <button
          type="button"
          aria-current={activeSection === 'complaints' ? 'page' : undefined}
          onClick={() => setActiveSection('complaints')}
          className={`flex flex-col items-center justify-center py-2 min-h-[48px] rounded-lg text-xs font-semibold cursor-pointer ${
            activeSection === 'complaints' ? 'text-[#2563EB] bg-blue-50/60' : 'text-slate-700'
          }`}
        >
          <MessageSquareWarning className="w-4 h-4 mb-0.5" aria-hidden="true" />
          <span className="truncate">Complaints</span>
        </button>
        <button
          type="button"
          aria-current={activeSection === 'profile' ? 'page' : undefined}
          onClick={() => setActiveSection('profile')}
          className={`flex flex-col items-center justify-center py-2 min-h-[48px] rounded-lg text-xs font-semibold cursor-pointer ${
            activeSection === 'profile' ? 'text-[#2563EB] bg-blue-50/60' : 'text-slate-700'
          }`}
        >
          <UserCheck className="w-4 h-4 mb-0.5" aria-hidden="true" />
          <span className="truncate">Profile</span>
        </button>
      </nav>
    </div>
  );
};
