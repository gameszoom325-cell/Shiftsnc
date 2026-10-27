import React, { Suspense, lazy, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CalendarCheck,
  CheckCircle2,
  Clock,
  DollarSign,
  HardHat,
  LayoutDashboard,
  Loader2,
  LogOut,
  Plus,
  Sparkles,
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

interface ConstructionWorkerPortalProps {
  user: DemoUser;
  attendance: AttendanceItem[];
  complaints: SafetyComplaintItem[];
  skills: SkillRecordItem[];
  onCheckInOut: () => void;
  isCheckedIn: boolean;
  activeCheckInTime: string;
  onAddComplaint: (item: Omit<SafetyComplaintItem, 'id' | 'dateSubmitted' | 'status'>) => void;
  onAddSkill: (item: Omit<SkillRecordItem, 'id' | 'verifiedStatus'>) => void;
  onLogout: () => void;
}

type WorkerSection = 'dashboard' | 'attendance' | 'safety' | 'skills' | 'ai';

export const ConstructionWorkerPortal: React.FC<ConstructionWorkerPortalProps> = ({
  user,
  attendance,
  complaints,
  skills,
  onCheckInOut,
  isCheckedIn,
  activeCheckInTime,
  onAddComplaint,
  onAddSkill,
  onLogout,
}) => {
  const [activeSection, setActiveSection] = useState<WorkerSection>('dashboard');

  // Hazard reporting form state
  const [hazardTitle, setHazardTitle] = useState('');
  const [hazardCategory, setHazardCategory] = useState('Fall Protection');
  const [hazardLocation, setHazardLocation] = useState('Sector B4 — East Bay');
  const [hazardPriority, setHazardPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>(
    'High'
  );
  const [hazardDesc, setHazardDesc] = useState('');
  const [hazardError, setHazardError] = useState<string | null>(null);
  const [hazardSubmittedBanner, setHazardSubmittedBanner] = useState(false);

  // Skill Passport form state
  const [skillTitle, setSkillTitle] = useState('');
  const [skillIssuer, setSkillIssuer] = useState('');
  const [skillHours, setSkillHours] = useState('40');
  const [skillError, setSkillError] = useState<string | null>(null);
  const [skillSubmittedBanner, setSkillSubmittedBanner] = useState(false);

  const myAttendance = useMemo(
    () =>
      attendance.filter(
        (a) =>
          a.portalType === 'construction' &&
          (a.userId === user.id || a.userName === user.name || a.userId === 'usr_worker_01')
      ),
    [attendance, user.id, user.name]
  );

  const myComplaints = useMemo(
    () => complaints.filter((c) => c.portalType === 'construction'),
    [complaints]
  );

  const mySkills = useMemo(
    () => skills.filter((s) => s.portalType === 'construction'),
    [skills]
  );

  const { totalRegularHours, totalOvertimeHours, hourlyRate, overtimeRate, basePay, overtimePay, totalSalary } =
    useMemo(() => {
      const reg = myAttendance.reduce((acc, item) => acc + item.regularHours, 0);
      const ot = myAttendance.reduce((acc, item) => acc + item.overtimeHours, 0);
      const hr = user.hourlyRate || 34.5;
      const otr = user.overtimeRate || 51.75;
      const bp = reg * hr;
      const otp = ot * otr;
      return {
        totalRegularHours: reg,
        totalOvertimeHours: ot,
        hourlyRate: hr,
        overtimeRate: otr,
        basePay: bp,
        overtimePay: otp,
        totalSalary: bp + otp,
      };
    }, [myAttendance, user.hourlyRate, user.overtimeRate]);

  const handleHazardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHazardError(null);

    const validation = validateComplaintForm({
      title: hazardTitle,
      location: hazardLocation,
      description: hazardDesc,
    });

    if (!validation.valid) {
      setHazardError(validation.error || 'Please check the hazard form fields.');
      return;
    }

    onAddComplaint({
      authorId: user.id,
      authorName: user.name,
      portalType: 'construction',
      title: sanitizeInput(hazardTitle, 150),
      category: sanitizeInput(hazardCategory, 80),
      location: sanitizeInput(hazardLocation, 120),
      priority: hazardPriority,
      description: sanitizeInput(hazardDesc, 1500),
    });
    setHazardTitle('');
    setHazardDesc('');
    setHazardSubmittedBanner(true);
    setTimeout(() => setHazardSubmittedBanner(false), 4000);
  };

  const handleSkillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSkillError(null);

    const hoursNum = Number(skillHours);
    const validation = validateSkillForm({
      title: skillTitle,
      issuer: skillIssuer,
      experienceHours: hoursNum,
    });

    if (!validation.valid) {
      setSkillError(validation.error || 'Please check the skill record fields.');
      return;
    }

    onAddSkill({
      userId: user.id,
      userName: user.name,
      portalType: 'construction',
      title: sanitizeInput(skillTitle, 150),
      issuer: sanitizeInput(skillIssuer, 120),
      issueDate: 'Oct 26, 2026',
      experienceHours: hoursNum,
    });
    setSkillTitle('');
    setSkillIssuer('');
    setSkillHours('40');
    setSkillSubmittedBanner(true);
    setTimeout(() => setSkillSubmittedBanner(false), 4000);
  };

  const briefingText = `Good morning ${user.name}. Your shift today is ${
    user.shiftWindow || '07:00 AM to 03:30 PM'
  } at ${user.department}. You have logged ${totalRegularHours.toFixed(
    1
  )} regular hours and ${totalOvertimeHours.toFixed(
    1
  )} overtime hours, with a verified salary balance of $${totalSalary.toFixed(2)}.`;

  return (
    <div className="min-h-screen bg-[#F8F5F0] text-[#111827] flex flex-col">
      <a
        href="#worker-main-content"
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
          aria-label="ShiftSync AI Worker Dashboard Home"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('dashboard');
          }}
          className="text-lg font-bold tracking-tight text-[#111827] whitespace-nowrap shrink-0 font-display"
        >
          ShiftSync AI
        </a>

        <nav
          aria-label="Construction Worker Primary Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600"
        >
          <button
            type="button"
            aria-current={activeSection === 'dashboard' ? 'page' : undefined}
            onClick={() => setActiveSection('dashboard')}
            className={`hover:text-[#111827] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'dashboard' ? 'text-[#2563EB] underline underline-offset-8' : ''
            }`}
          >
            Dashboard
          </button>
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
            aria-current={activeSection === 'safety' ? 'page' : undefined}
            onClick={() => setActiveSection('safety')}
            className={`hover:text-[#111827] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'safety' ? 'text-[#2563EB] underline underline-offset-8' : ''
            }`}
          >
            Safety Reporting
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
            aria-current={activeSection === 'ai' ? 'page' : undefined}
            onClick={() => setActiveSection('ai')}
            className={`hover:text-[#111827] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'ai' ? 'text-[#2563EB] underline underline-offset-8' : ''
            }`}
          >
            AI Assistant
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
        {/* Desktop Sidebar Navigation */}
        <aside
          aria-label="Worker Sidebar Menu"
          className="hidden lg:flex w-64 shrink-0 bg-white border-r border-slate-200 flex-col justify-between p-5"
        >
          <div className="space-y-6">
            <div className="pb-5 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div
                  aria-hidden="true"
                  className="w-11 h-11 rounded-lg bg-[#2563EB] text-white flex items-center justify-center font-bold text-base shrink-0"
                >
                  <HardHat className="w-6 h-6" aria-hidden="true" />
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
                aria-current={activeSection === 'dashboard' ? 'page' : undefined}
                onClick={() => setActiveSection('dashboard')}
                className={`w-full flex items-center gap-3 px-4 py-3 min-h-[48px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeSection === 'dashboard'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-[#111827] hover:bg-[#F8F5F0]'
                }`}
              >
                <LayoutDashboard className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>Dashboard</span>
              </button>

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
                aria-current={activeSection === 'safety' ? 'page' : undefined}
                onClick={() => setActiveSection('safety')}
                className={`w-full flex items-center gap-3 px-4 py-3 min-h-[48px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeSection === 'safety'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-[#111827] hover:bg-[#F8F5F0]'
                }`}
              >
                <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>Safety Reporting</span>
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
                aria-current={activeSection === 'ai' ? 'page' : undefined}
                onClick={() => setActiveSection('ai')}
                className={`w-full flex items-center gap-3 px-4 py-3 min-h-[48px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeSection === 'ai'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-[#111827] hover:bg-[#F8F5F0]'
                }`}
              >
                <Sparkles className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>AI Studio &amp; Voice</span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 text-xs text-slate-600 space-y-1">
            <div>Supervisor · {user.supervisor}</div>
            <div>Shift · {user.shiftWindow}</div>
          </div>
        </aside>

        {/* Main Viewport */}
        <main
          id="worker-main-content"
          role="main"
          className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10 space-y-8"
        >
          {/* Worker Header Bar with Large Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-600">
                Worker Transparency Portal · {user.badgeId} · {user.department}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Welcome, {user.name}
              </h1>
              <p className="text-sm text-slate-700">
                Fair shift tracking, verified overtime pay, and direct workplace hazard protection.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <TTSBriefingButton text={briefingText} label="Listen to Shift Summary" />
              <button
                type="button"
                onClick={onCheckInOut}
                className={`px-6 py-3.5 min-h-[48px] rounded-lg text-sm font-bold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isCheckedIn
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-[#2563EB] hover:bg-blue-700'
                }`}
              >
                {isCheckedIn
                  ? `Check Out of Shift (In at ${activeCheckInTime})`
                  : 'Check In to Shift Now'}
              </button>
            </div>
          </div>

          {/* SECTION 1: DASHBOARD */}
          {activeSection === 'dashboard' && (
            <div className="space-y-8">
              {/* 4 Core Worker Cards: Today's shift, Working hours, Overtime hours, Salary summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>Today&apos;s Shift</span>
                    <Clock className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
                  </div>
                  <div className="text-xl font-bold font-mono tabular-nums">
                    {user.shiftWindow || '07:00 AM – 03:30 PM'}
                  </div>
                  <div className="text-xs text-slate-700">
                    Status · {isCheckedIn ? `Active since ${activeCheckInTime}` : 'Scheduled'}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>Working Hours</span>
                    <CalendarCheck className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums">
                    {totalRegularHours.toFixed(1)} hrs
                  </div>
                  <div className="text-xs text-slate-700">
                    Verified regular shift hours · Rate ${hourlyRate.toFixed(2)}/hr
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>Overtime Hours</span>
                    <Award className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-[#2563EB]">
                    {totalOvertimeHours.toFixed(1)} hrs
                  </div>
                  <div className="text-xs text-slate-700">
                    1.5x Overtime rate · ${overtimeRate.toFixed(2)}/hr
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>Salary Summary</span>
                    <DollarSign className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
                    ${totalSalary.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-700 font-mono tabular-nums">
                    Base ${basePay.toFixed(2)} · OT ${overtimePay.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Large Touch Action Grid for Simple Navigation */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <button
                  type="button"
                  onClick={() => setActiveSection('attendance')}
                  className="bg-white rounded-xl border border-slate-200 p-6 text-left hover:border-[#2563EB] transition-colors cursor-pointer space-y-2"
                >
                  <div className="text-base font-bold text-[#111827]">
                    View Full Attendance History
                  </div>
                  <p className="text-sm text-slate-700">
                    Check your daily check-in and check-out timestamps and overtime logs.
                  </p>
                  <div className="text-xs font-semibold text-[#2563EB] pt-1">
                    Open Attendance Log →
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('safety')}
                  className="bg-white rounded-xl border border-slate-200 p-6 text-left hover:border-[#2563EB] transition-colors cursor-pointer space-y-2"
                >
                  <div className="text-base font-bold text-[#111827]">
                    Report a Workplace Hazard
                  </div>
                  <p className="text-sm text-slate-700">
                    Submit safety concerns by text or voice and track resolution priority.
                  </p>
                  <div className="text-xs font-semibold text-[#2563EB] pt-1">
                    Open Safety Reporting →
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('skills')}
                  className="bg-white rounded-xl border border-slate-200 p-6 text-left hover:border-[#2563EB] transition-colors cursor-pointer space-y-2"
                >
                  <div className="text-base font-bold text-[#111827]">
                    My Verified Skill Passport
                  </div>
                  <p className="text-sm text-slate-700">
                    Access your OSHA certificates, welding licenses, and logged experience hours.
                  </p>
                  <div className="text-xs font-semibold text-[#2563EB] pt-1">
                    Open Skill Passport →
                  </div>
                </button>
              </div>

              {/* Transparent Salary Breakdown Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
                  <div>
                    <h2 className="text-lg font-bold">Transparent Pay &amp; Shift Breakdown</h2>
                    <p className="text-xs text-slate-600">
                      Every regular and overtime hour is time-stamped so workers receive 100% fair compensation.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-700">
                    Pay Period · Oct 2026
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <div className="text-xs text-slate-600">Regular Shift Earnings</div>
                    <div className="text-lg font-bold font-mono tabular-nums mt-1">
                      ${basePay.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-600 font-mono tabular-nums">
                      {totalRegularHours.toFixed(1)} hrs × ${hourlyRate.toFixed(2)}/hr
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-600">Overtime Earnings (1.5x)</div>
                    <div className="text-lg font-bold font-mono tabular-nums text-[#2563EB] mt-1">
                      ${overtimePay.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-600 font-mono tabular-nums">
                      {totalOvertimeHours.toFixed(1)} hrs × ${overtimeRate.toFixed(2)}/hr
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-600">Total Verified Payout</div>
                    <div className="text-lg font-bold font-mono tabular-nums text-emerald-700 mt-1">
                      ${totalSalary.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-600">Direct Deposit Verified</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: ATTENDANCE */}
          {activeSection === 'attendance' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold">Shift Check-In &amp; Check-Out</h2>
                  <p className="text-sm text-slate-700">
                    Check-in time ·{' '}
                    <span className="font-mono font-semibold">
                      {isCheckedIn ? activeCheckInTime : '06:55 AM (Last Completed Shift)'}
                    </span>{' '}
                    · Check-out time ·{' '}
                    <span className="font-mono font-semibold">
                      {isCheckedIn ? 'Active On-Site' : '04:30 PM'}
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onCheckInOut}
                  className={`px-8 py-4 min-h-[52px] rounded-lg text-base font-bold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isCheckedIn
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-[#2563EB] hover:bg-blue-700'
                  }`}
                >
                  {isCheckedIn ? 'Record Shift Check-Out' : 'Record Shift Check-In'}
                </button>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                  <h3 className="text-lg font-bold">Attendance History</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Complete log of your check-in times, check-out times, regular hours, and overtime.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table
                    aria-label="Worker Shift Attendance History"
                    className="w-full text-left border-collapse"
                  >
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600 bg-[#F8F5F0]">
                        <th scope="col" className="py-3.5 px-6">
                          Date
                        </th>
                        <th scope="col" className="py-3.5 px-6">
                          Site Sector
                        </th>
                        <th scope="col" className="py-3.5 px-6">
                          Check-In Time
                        </th>
                        <th scope="col" className="py-3.5 px-6">
                          Check-Out Time
                        </th>
                        <th scope="col" className="py-3.5 px-6 text-right">
                          Regular Hrs
                        </th>
                        <th scope="col" className="py-3.5 px-6 text-right">
                          Overtime Hrs
                        </th>
                        <th scope="col" className="py-3.5 px-6">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {myAttendance.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="py-4 px-6 font-mono tabular-nums font-semibold">
                            {row.dateLabel}
                          </td>
                          <td className="py-4 px-6 text-slate-700">{row.department}</td>
                          <td className="py-4 px-6 font-mono tabular-nums">{row.checkInTime}</td>
                          <td className="py-4 px-6 font-mono tabular-nums">{row.checkOutTime}</td>
                          <td className="py-4 px-6 text-right font-mono tabular-nums">
                            {row.regularHours.toFixed(1)}
                          </td>
                          <td className="py-4 px-6 text-right font-mono tabular-nums text-[#2563EB] font-semibold">
                            +{row.overtimeHours.toFixed(1)}
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

          {/* SECTION 3: SAFETY REPORTING */}
          {activeSection === 'safety' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                <div>
                  <h2 className="text-xl font-bold">Report a Workplace Hazard</h2>
                  <p className="text-sm text-slate-700 mt-1">
                    Report unsafe conditions immediately. You can type or dictate with your microphone.
                  </p>
                </div>

                {hazardSubmittedBanner && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Safety report submitted and sent to Construction Admin.</span>
                  </div>
                )}

                {hazardError && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700"
                  >
                    {hazardError}
                  </div>
                )}

                <form onSubmit={handleHazardSubmit} className="space-y-4" noValidate>
                  <div>
                    <label
                      htmlFor="worker-hazard-title"
                      className="block text-sm font-semibold mb-1.5"
                    >
                      Hazard Title
                    </label>
                    <input
                      id="worker-hazard-title"
                      type="text"
                      required
                      value={hazardTitle}
                      onChange={(e) => setHazardTitle(e.target.value)}
                      placeholder="e.g., Missing guardrail pin on Level 2 ramp"
                      className="w-full px-4 py-3 min-h-[48px] rounded-lg border border-slate-300 bg-[#F8F5F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="worker-hazard-category"
                        className="block text-sm font-semibold mb-1.5"
                      >
                        Hazard Category
                      </label>
                      <select
                        id="worker-hazard-category"
                        value={hazardCategory}
                        onChange={(e) => setHazardCategory(e.target.value)}
                        className="w-full px-3 py-3 min-h-[48px] rounded-lg border border-slate-300 bg-[#F8F5F0] text-sm"
                      >
                        <option value="Fall Protection">Fall Protection</option>
                        <option value="Electrical Hazard">Electrical Hazard</option>
                        <option value="Heavy Machinery">Heavy Machinery</option>
                        <option value="PPE & Heat Safety">PPE &amp; Heat Safety</option>
                        <option value="Visibility & Rigging">Visibility &amp; Rigging</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="worker-hazard-priority"
                        className="block text-sm font-semibold mb-1.5"
                      >
                        Priority Level
                      </label>
                      <select
                        id="worker-hazard-priority"
                        value={hazardPriority}
                        onChange={(e) =>
                          setHazardPriority(
                            e.target.value as 'Low' | 'Medium' | 'High' | 'Critical'
                          )
                        }
                        className="w-full px-3 py-3 min-h-[48px] rounded-lg border border-slate-300 bg-[#F8F5F0] text-sm font-semibold"
                      >
                        <option value="Low">Low Priority</option>
                        <option value="Medium">Medium Priority</option>
                        <option value="High">High Priority</option>
                        <option value="Critical">Critical Priority</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="worker-hazard-location"
                      className="block text-sm font-semibold mb-1.5"
                    >
                      Site Location
                    </label>
                    <input
                      id="worker-hazard-location"
                      type="text"
                      required
                      value={hazardLocation}
                      onChange={(e) => setHazardLocation(e.target.value)}
                      className="w-full px-4 py-3 min-h-[48px] rounded-lg border border-slate-300 bg-[#F8F5F0] text-sm"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="worker-hazard-desc"
                        className="block text-sm font-semibold"
                      >
                        Hazard Details
                      </label>
                      <VoiceTranscribeButton
                        onTranscribed={(spoken) =>
                          setHazardDesc((prev) => (prev ? `${prev} ${spoken}` : spoken))
                        }
                      />
                    </div>
                    <textarea
                      id="worker-hazard-desc"
                      rows={4}
                      required
                      value={hazardDesc}
                      onChange={(e) => setHazardDesc(e.target.value)}
                      placeholder="Describe what you observed and any temporary safety barrier placed..."
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-[#F8F5F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 min-h-[52px] rounded-lg bg-[#2563EB] text-white text-base font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    Submit Safety Hazard Report
                  </button>
                </form>
              </div>

              <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                <div>
                  <h2 className="text-xl font-bold">Complaint Status Tracking</h2>
                  <p className="text-sm text-slate-700 mt-1">
                    Live transparency on all reported site hazards and supervisor action status.
                  </p>
                </div>

                <div className="divide-y divide-slate-200">
                  {myComplaints.map((item) => (
                    <div key={item.id} className="py-5 first:pt-0 last:pb-0 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-base font-bold text-[#111827]">{item.title}</h3>
                        <span className="text-xs font-semibold text-[#2563EB]">
                          Status · {item.status}
                        </span>
                      </div>

                      <p className="text-sm text-slate-700 leading-relaxed">{item.description}</p>

                      {/* Zero-Pill Unboxed Metadata */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pt-1">
                        <span
                          className={
                            item.priority === 'Critical' || item.priority === 'High'
                              ? 'font-semibold text-red-700'
                              : 'font-semibold text-slate-800'
                          }
                        >
                          Priority: {item.priority}
                        </span>
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

          {/* SECTION 4: SKILL PASSPORT */}
          {activeSection === 'skills' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                <div className="pb-4 border-b border-slate-200">
                  <h2 className="text-xl font-bold">
                    Training Certificates &amp; Experience Records
                  </h2>
                  <p className="text-sm text-slate-700 mt-1">
                    Portable, verified credentials that prove your trade qualifications and on-site experience hours.
                  </p>
                </div>

                <div className="divide-y divide-slate-200">
                  {mySkills.map((sk) => (
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
                        <span>Issuer: {sk.issuer}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          Experience: {sk.experienceHours} hrs
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">Issued {sk.issueDate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                <div>
                  <h2 className="text-xl font-bold">Add Certificate or Experience Record</h2>
                  <p className="text-sm text-slate-700 mt-1">
                    Submit a new trade training certificate for supervisor verification.
                  </p>
                </div>

                {skillSubmittedBanner && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800"
                  >
                    Certificate added to your Skill Passport for supervisor verification.
                  </div>
                )}

                {skillError && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700"
                  >
                    {skillError}
                  </div>
                )}

                <form onSubmit={handleSkillSubmit} className="space-y-4" noValidate>
                  <div>
                    <label
                      htmlFor="worker-skill-title"
                      className="block text-sm font-semibold mb-1.5"
                    >
                      Certificate or Trade Skill Name
                    </label>
                    <input
                      id="worker-skill-title"
                      type="text"
                      required
                      value={skillTitle}
                      onChange={(e) => setSkillTitle(e.target.value)}
                      placeholder="e.g., Confined Space Entry & Rescue Level 2"
                      className="w-full px-4 py-3 min-h-[48px] rounded-lg border border-slate-300 bg-[#F8F5F0] text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="worker-skill-issuer"
                      className="block text-sm font-semibold mb-1.5"
                    >
                      Issuing Organization
                    </label>
                    <input
                      id="worker-skill-issuer"
                      type="text"
                      required
                      value={skillIssuer}
                      onChange={(e) => setSkillIssuer(e.target.value)}
                      placeholder="e.g., National Construction Safety Council"
                      className="w-full px-4 py-3 min-h-[48px] rounded-lg border border-slate-300 bg-[#F8F5F0] text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="worker-skill-hours"
                      className="block text-sm font-semibold mb-1.5"
                    >
                      Logged Experience Hours
                    </label>
                    <input
                      id="worker-skill-hours"
                      type="number"
                      min="1"
                      max="10000"
                      required
                      value={skillHours}
                      onChange={(e) => setSkillHours(e.target.value)}
                      className="w-full px-4 py-3 min-h-[48px] rounded-lg border border-slate-300 bg-[#F8F5F0] text-sm font-mono tabular-nums"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 py-4 min-h-[52px] rounded-lg bg-[#2563EB] text-white text-base font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    <Plus className="w-5 h-5" aria-hidden="true" />
                    <span>Add to Skill Passport</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* SECTION 5: AI ASSISTANT & STUDIO */}
          {activeSection === 'ai' && (
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
              <AITransparencyStudio roleLabel="Construction Worker" darkTheme={false} />
            </Suspense>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (<= 15% viewport height) */}
      <nav
        aria-label="Worker Mobile Bottom Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 px-2 py-1.5 grid grid-cols-5 gap-1"
      >
        <button
          type="button"
          aria-current={activeSection === 'dashboard' ? 'page' : undefined}
          onClick={() => setActiveSection('dashboard')}
          className={`flex flex-col items-center justify-center py-2 min-h-[48px] rounded-lg text-xs font-semibold cursor-pointer ${
            activeSection === 'dashboard' ? 'text-[#2563EB] bg-blue-50/60' : 'text-slate-700'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 mb-0.5" aria-hidden="true" />
          <span className="truncate">Shift</span>
        </button>
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
          aria-current={activeSection === 'safety' ? 'page' : undefined}
          onClick={() => setActiveSection('safety')}
          className={`flex flex-col items-center justify-center py-2 min-h-[48px] rounded-lg text-xs font-semibold cursor-pointer ${
            activeSection === 'safety' ? 'text-[#2563EB] bg-blue-50/60' : 'text-slate-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4 mb-0.5" aria-hidden="true" />
          <span className="truncate">Safety</span>
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
          aria-current={activeSection === 'ai' ? 'page' : undefined}
          onClick={() => setActiveSection('ai')}
          className={`flex flex-col items-center justify-center py-2 min-h-[48px] rounded-lg text-xs font-semibold cursor-pointer ${
            activeSection === 'ai' ? 'text-[#2563EB] bg-blue-50/60' : 'text-slate-700'
          }`}
        >
          <Sparkles className="w-4 h-4 mb-0.5" aria-hidden="true" />
          <span className="truncate">AI Studio</span>
        </button>
      </nav>
    </div>
  );
};
