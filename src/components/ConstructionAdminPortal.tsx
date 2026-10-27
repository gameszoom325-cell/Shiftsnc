import React, { Suspense, lazy, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Edit3,
  KeyRound,
  Loader2,
  LogOut,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Wand2,
} from 'lucide-react';
import {
  AttendanceItem,
  DemoUser,
  SafetyComplaintItem,
  SkillRecordItem,
  WorkerDirectoryItem,
} from '../types';
import { CONSTRUCTION_WEEKLY_METRICS } from '../data/demoData';
import { TTSBriefingButton } from './AudioTools';
import { sanitizeInput, validateUserProvisioning } from '../security/validation';

const AITransparencyStudio = lazy(() =>
  import('./AITransparencyStudio').then((m) => ({ default: m.AITransparencyStudio }))
);

interface ConstructionAdminPortalProps {
  user: DemoUser;
  workers: WorkerDirectoryItem[];
  managedWorkers: DemoUser[];
  onCreateWorker: (worker: Omit<DemoUser, 'id' | 'organization' | 'role' | 'roleLabel'>) => void;
  onUpdateWorker: (id: string, updated: Partial<DemoUser>) => void;
  onDeleteWorker: (id: string) => void;
  attendance: AttendanceItem[];
  complaints: SafetyComplaintItem[];
  skills: SkillRecordItem[];
  onUpdateComplaintStatus: (
    id: string,
    nextStatus: 'Submitted' | 'Under Review' | 'Resolved'
  ) => void;
  onVerifySkill: (id: string) => void;
  onLogout: () => void;
}

type AdminSection = 'overview' | 'workers' | 'shifts' | 'complaints' | 'ai';

export const ConstructionAdminPortal: React.FC<ConstructionAdminPortalProps> = ({
  user,
  workers,
  managedWorkers,
  onCreateWorker,
  onUpdateWorker,
  onDeleteWorker,
  attendance,
  complaints,
  skills,
  onUpdateComplaintStatus,
  onVerifySkill,
  onLogout,
}) => {
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'All' | 'Submitted' | 'Under Review' | 'Resolved'
  >('All');

  // Create / Edit Worker Account State
  const [workerName, setWorkerName] = useState('');
  const [workerBadgeId, setWorkerBadgeId] = useState('');
  const [workerUsername, setWorkerUsername] = useState('');
  const [workerPassword, setWorkerPassword] = useState('');
  const [workerDepartment, setWorkerDepartment] = useState('Structural Steel — Sector B4');
  const [workerHourlyRate, setWorkerHourlyRate] = useState('34.50');
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [accountFeedback, setAccountFeedback] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  const constructionAttendance = useMemo(
    () => attendance.filter((a) => a.portalType === 'construction'),
    [attendance]
  );
  const constructionComplaints = useMemo(
    () => complaints.filter((c) => c.portalType === 'construction'),
    [complaints]
  );
  const constructionSkills = useMemo(
    () => skills.filter((s) => s.portalType === 'construction'),
    [skills]
  );

  // Combine created worker accounts with baseline site directory
  const combinedWorkers: WorkerDirectoryItem[] = useMemo(
    () => [
      ...managedWorkers.map((mw) => ({
        id: mw.id,
        name: mw.name,
        badgeId: mw.badgeId,
        username: mw.username,
        password: mw.password,
        trade: mw.department,
        siteZone: mw.department,
        shiftTime: mw.shiftWindow || '07:00 AM – 03:30 PM',
        regularHoursWeek: 40.0,
        overtimeHoursWeek: 3.5,
        attendanceRate: 100.0,
        activeShift: true,
        hourlyRate: mw.hourlyRate || 34.5,
      })),
      ...workers,
    ],
    [managedWorkers, workers]
  );

  const totalWorkersCount = combinedWorkers.length;
  const activeShiftsCount = useMemo(
    () => combinedWorkers.filter((w) => w.activeShift).length,
    [combinedWorkers]
  );
  const avgAttendanceRate = useMemo(
    () =>
      combinedWorkers.reduce((acc, w) => acc + w.attendanceRate, 0) /
      Math.max(1, combinedWorkers.length),
    [combinedWorkers]
  );
  const openSafetyIssuesCount = useMemo(
    () => constructionComplaints.filter((c) => c.status !== 'Resolved').length,
    [constructionComplaints]
  );

  const filteredWorkers = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return combinedWorkers.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.badgeId.toLowerCase().includes(q) ||
        w.username.toLowerCase().includes(q) ||
        w.trade.toLowerCase().includes(q)
    );
  }, [combinedWorkers, searchTerm]);

  const filteredComplaints = useMemo(
    () =>
      constructionComplaints.filter((c) =>
        statusFilter === 'All' ? true : c.status === statusFilter
      ),
    [constructionComplaints, statusFilter]
  );

  const handleGenerateWorkerId = () => {
    const nextNum = managedWorkers.length + 1;
    const formattedId = `W${String(nextNum).padStart(3, '0')}`;
    setWorkerBadgeId(formattedId);
    if (workerName.trim()) {
      const cleanName = workerName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      setWorkerUsername(`${cleanName}${String(nextNum).padStart(3, '0')}`);
    }
  };

  const handleGenerateCredentials = () => {
    const idToUse =
      workerBadgeId.trim() || `W${String(managedWorkers.length + 1).padStart(3, '0')}`;
    if (!workerBadgeId.trim()) {
      setWorkerBadgeId(idToUse);
    }
    const cleanName = (workerName.trim() || 'worker')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const numericSuffix = idToUse.replace(/[^0-9]/g, '') || '001';
    setWorkerUsername(`${cleanName}${numericSuffix}`);
    setWorkerPassword('demo123');
  };

  const handleFillRaviExample = () => {
    setEditingWorkerId(null);
    setAccountError(null);
    setWorkerName('Ravi');
    setWorkerBadgeId('W001');
    setWorkerUsername('ravi001');
    setWorkerPassword('demo123');
    setWorkerDepartment('Structural Steel — Sector B4');
    setWorkerHourlyRate('34.50');
  };

  const handleSaveWorkerAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError(null);
    setAccountFeedback(null);

    const validation = validateUserProvisioning(
      {
        name: workerName,
        badgeId: workerBadgeId,
        username: workerUsername,
        password: workerPassword,
        department: workerDepartment,
      },
      managedWorkers,
      editingWorkerId,
      'worker'
    );

    if (!validation.valid) {
      setAccountError(validation.error || 'Please check the worker account fields.');
      return;
    }

    const cleanName = sanitizeInput(workerName, 80);
    const cleanBadgeId = sanitizeInput(workerBadgeId, 32).toUpperCase();
    const cleanUsername = sanitizeInput(workerUsername, 60).toLowerCase();
    const cleanDept = sanitizeInput(workerDepartment, 120);
    const cleanPass = workerPassword.trim();
    const rate = Number(workerHourlyRate) || 34.5;

    if (editingWorkerId) {
      onUpdateWorker(editingWorkerId, {
        name: cleanName,
        badgeId: cleanBadgeId,
        username: cleanUsername,
        email: `${cleanUsername}@shiftsync.ai`,
        password: cleanPass,
        department: cleanDept,
        hourlyRate: rate,
        overtimeRate: Number((rate * 1.5).toFixed(2)),
      });
      setAccountFeedback(
        `Updated worker account for ${cleanName} (${cleanBadgeId}).`
      );
      setEditingWorkerId(null);
    } else {
      onCreateWorker({
        name: cleanName,
        badgeId: cleanBadgeId,
        username: cleanUsername,
        email: `${cleanUsername}@shiftsync.ai`,
        password: cleanPass,
        department: cleanDept,
        shiftWindow: '07:00 AM – 03:30 PM',
        supervisor: `${user.name} (Construction Admin)`,
        hourlyRate: rate,
        overtimeRate: Number((rate * 1.5).toFixed(2)),
        createdByAdmin: true,
      });
      setAccountFeedback(
        `Worker account created! Name: ${cleanName} · ID: ${cleanBadgeId} · Username: ${cleanUsername} · Password: ${cleanPass} — Ready for immediate login.`
      );
    }

    setWorkerName('');
    setWorkerBadgeId('');
    setWorkerUsername('');
    setWorkerPassword('');
    setTimeout(() => setAccountFeedback(null), 6000);
  };

  const handleStartEditWorker = (w: DemoUser) => {
    setAccountError(null);
    setEditingWorkerId(w.id);
    setWorkerName(w.name);
    setWorkerBadgeId(w.badgeId);
    setWorkerUsername(w.username);
    setWorkerPassword(w.password || '');
    setWorkerDepartment(w.department);
    setWorkerHourlyRate(String(w.hourlyRate || 34.5));
    setActiveSection('workers');
  };

  const adminBriefing = `Site Operations Report for ${user.name}. Total workforce is ${totalWorkersCount} technicians with ${activeShiftsCount} active shifts on-site. Site-wide attendance rate is ${avgAttendanceRate.toFixed(
    1
  )}%, and there are ${openSafetyIssuesCount} active safety reports requiring supervisor oversight.`;

  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 flex flex-col">
      <a
        href="#construction-admin-main"
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
          aria-label="ShiftSync AI Construction Admin Home"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('overview');
          }}
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 font-display"
        >
          ShiftSync AI
        </a>

        <nav
          aria-label="Construction Admin Primary Navigation"
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
            Analytics Overview
          </button>
          <button
            type="button"
            aria-current={activeSection === 'workers' ? 'page' : undefined}
            onClick={() => setActiveSection('workers')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'workers' ? 'text-[#2563EB] underline underline-offset-8' : ''
            }`}
          >
            Worker Accounts
          </button>
          <button
            type="button"
            aria-current={activeSection === 'shifts' ? 'page' : undefined}
            onClick={() => setActiveSection('shifts')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'shifts' ? 'text-[#2563EB] underline underline-offset-8' : ''
            }`}
          >
            Shift Records
          </button>
          <button
            type="button"
            aria-current={activeSection === 'complaints' ? 'page' : undefined}
            onClick={() => setActiveSection('complaints')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'complaints' ? 'text-[#2563EB] underline underline-offset-8' : ''
            }`}
          >
            Safety Reports
          </button>
          <button
            type="button"
            aria-current={activeSection === 'ai' ? 'page' : undefined}
            onClick={() => setActiveSection('ai')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'ai' ? 'text-[#2563EB] underline underline-offset-8' : ''
            }`}
          >
            AI Studio
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            aria-label="Log out of Construction Admin Portal"
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
          aria-label="Construction Admin Sidebar Navigation"
          className="hidden lg:flex w-64 shrink-0 bg-[#111827] border-r border-slate-800 flex-col justify-between p-5"
        >
          <div className="space-y-6">
            <div className="pb-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div
                  aria-hidden="true"
                  className="w-11 h-11 rounded-lg bg-[#2563EB] text-white flex items-center justify-center font-bold shrink-0"
                >
                  <BarChart3 className="w-6 h-6" aria-hidden="true" />
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
                <span>Analytics &amp; Charts</span>
              </button>

              <button
                type="button"
                aria-current={activeSection === 'workers' ? 'page' : undefined}
                onClick={() => setActiveSection('workers')}
                className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeSection === 'workers'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <UserPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Manage Workers</span>
              </button>

              <button
                type="button"
                aria-current={activeSection === 'shifts' ? 'page' : undefined}
                onClick={() => setActiveSection('shifts')}
                className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeSection === 'shifts'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <CalendarClock className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Shift Records</span>
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
                <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Complaint Reports</span>
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
            <div>Metro Transit Hub · All Sectors</div>
            <div>Worker Provisioning Enabled</div>
          </div>
        </aside>

        {/* Main Content */}
        <main
          id="construction-admin-main"
          role="main"
          className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10 space-y-8"
        >
          {/* Header Banner */}
          <div className="bg-[#111827] rounded-xl border border-slate-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-[#0284C7]">
                Construction Admin Operations Console · {user.badgeId}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                {user.department}
              </h1>
              <p className="text-sm text-slate-300">
                Create and manage worker credentials, monitor attendance &amp; overtime charts, and resolve safety hazards.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveSection('workers')}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                <span>Create Worker Account</span>
              </button>
              <TTSBriefingButton
                text={adminBriefing}
                label="Play Site Briefing"
                dualSpeaker={true}
                darkTheme={true}
              />
            </div>
          </div>

          {/* 4 Analytics Cards: Total workers, Active shifts, Attendance rate, Safety issues */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-[#111827] rounded-xl border border-slate-800 p-6 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Total Workers</span>
                <Users className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
              </div>
              <div className="text-3xl font-bold font-mono tabular-nums text-white">
                {totalWorkersCount}
              </div>
              <div className="text-xs text-slate-300">
                {managedWorkers.length} admin-provisioned · {workers.length} site roster
              </div>
            </div>

            <div className="bg-[#111827] rounded-xl border border-slate-800 p-6 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Active Shifts</span>
                <CalendarClock className="w-4 h-4 text-[#0284C7]" aria-hidden="true" />
              </div>
              <div className="text-3xl font-bold font-mono tabular-nums text-[#0284C7]">
                {activeShiftsCount}
              </div>
              <div className="text-xs text-slate-300">
                Currently checked in on active site zones
              </div>
            </div>

            <div className="bg-[#111827] rounded-xl border border-slate-800 p-6 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Attendance Rate</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              </div>
              <div className="text-3xl font-bold font-mono tabular-nums text-emerald-400">
                {avgAttendanceRate.toFixed(1)}%
              </div>
              <div className="text-xs text-slate-300">
                Weekly verified shift punctuality
              </div>
            </div>

            <div className="bg-[#111827] rounded-xl border border-slate-800 p-6 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Safety Issues</span>
                <AlertTriangle className="w-4 h-4 text-amber-400" aria-hidden="true" />
              </div>
              <div className="text-3xl font-bold font-mono tabular-nums text-amber-400">
                {openSafetyIssuesCount}
              </div>
              <div className="text-xs text-slate-300">
                Open hazard reports · {constructionComplaints.length} total logged
              </div>
            </div>
          </div>

          {/* WORKER ACCOUNT PROVISIONING & MANAGEMENT (Visible in Workers tab AND Overview) */}
          {(activeSection === 'workers' || activeSection === 'overview') && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Create / Edit Worker Form */}
              <div className="lg:col-span-5 bg-[#111827] rounded-xl border border-slate-800 p-6 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {editingWorkerId ? 'Edit Worker Account' : 'Create Worker Account'}
                    </h2>
                    <p className="text-xs text-slate-300 mt-1">
                      Workers cannot self-register. Generate their Worker ID, username, and password here for immediate login.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleFillRaviExample}
                    className="px-3 py-1.5 min-h-[36px] rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-[#0284C7] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Fill Example (Ravi / W001)
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

                <form onSubmit={handleSaveWorkerAccount} className="space-y-4" noValidate>
                  <div>
                    <label
                      htmlFor="admin-worker-name"
                      className="block text-xs font-semibold text-slate-200 mb-1.5"
                    >
                      Worker Full Name
                    </label>
                    <input
                      id="admin-worker-name"
                      type="text"
                      required
                      value={workerName}
                      onChange={(e) => setWorkerName(e.target.value)}
                      placeholder="e.g., Ravi"
                      className="w-full px-4 py-2.5 min-h-[44px] rounded-lg bg-[#0B1220] border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="admin-worker-id"
                        className="block text-xs font-semibold text-slate-200"
                      >
                        Worker ID
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateWorkerId}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0284C7] hover:underline cursor-pointer"
                      >
                        <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Generate Worker ID</span>
                      </button>
                    </div>
                    <input
                      id="admin-worker-id"
                      type="text"
                      required
                      value={workerBadgeId}
                      onChange={(e) => setWorkerBadgeId(e.target.value)}
                      placeholder="e.g., W001"
                      className="w-full px-4 py-2.5 min-h-[44px] rounded-lg bg-[#0B1220] border border-slate-700 text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="admin-worker-dept"
                        className="block text-xs font-semibold text-slate-200 mb-1.5"
                      >
                        Trade / Site Sector
                      </label>
                      <input
                        id="admin-worker-dept"
                        type="text"
                        required
                        value={workerDepartment}
                        onChange={(e) => setWorkerDepartment(e.target.value)}
                        className="w-full px-3.5 py-2.5 min-h-[44px] rounded-lg bg-[#0B1220] border border-slate-700 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="admin-worker-rate"
                        className="block text-xs font-semibold text-slate-200 mb-1.5"
                      >
                        Hourly Rate ($/hr)
                      </label>
                      <input
                        id="admin-worker-rate"
                        type="number"
                        step="0.5"
                        min="15"
                        required
                        value={workerHourlyRate}
                        onChange={(e) => setWorkerHourlyRate(e.target.value)}
                        className="w-full px-3.5 py-2.5 min-h-[44px] rounded-lg bg-[#0B1220] border border-slate-700 text-sm font-mono tabular-nums text-white"
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
                        <span>Auto-Generate Username &amp; Password</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="admin-worker-username"
                          className="block text-xs font-semibold text-slate-200 mb-1.5"
                        >
                          Username
                        </label>
                        <input
                          id="admin-worker-username"
                          type="text"
                          required
                          value={workerUsername}
                          onChange={(e) => setWorkerUsername(e.target.value)}
                          placeholder="e.g., ravi001"
                          className="w-full px-3.5 py-2.5 min-h-[44px] rounded-lg bg-[#0B1220] border border-slate-700 text-sm font-mono text-white placeholder:text-slate-500"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="admin-worker-password"
                          className="block text-xs font-semibold text-slate-200 mb-1.5"
                        >
                          Password
                        </label>
                        <input
                          id="admin-worker-password"
                          type="text"
                          required
                          value={workerPassword}
                          onChange={(e) => setWorkerPassword(e.target.value)}
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
                        {editingWorkerId ? 'Save Worker Changes' : 'Create Worker Account'}
                      </span>
                    </button>
                    {editingWorkerId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingWorkerId(null);
                          setAccountError(null);
                          setWorkerName('');
                          setWorkerBadgeId('');
                          setWorkerUsername('');
                          setWorkerPassword('');
                        }}
                        className="px-4 py-3 min-h-[48px] rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Provisioned Worker Accounts List (Edit / Delete) */}
              <div className="lg:col-span-7 bg-[#111827] rounded-xl border border-slate-800 p-6 flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  <div className="pb-4 border-b border-slate-800 flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-white">
                        Provisioned Worker Login Accounts
                      </h2>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Workers listed here can immediately sign in via Construction Site → Worker.
                      </p>
                    </div>
                    <span className="text-xs font-mono text-[#0284C7]">
                      {managedWorkers.length} Active Accounts
                    </span>
                  </div>

                  {managedWorkers.length === 0 ? (
                    <div className="py-12 text-center space-y-3 bg-[#0B1220] rounded-lg border border-slate-800/80 p-6">
                      <p className="text-sm text-slate-200 font-semibold">
                        No worker login accounts provisioned yet.
                      </p>
                      <p className="text-xs text-slate-300 max-w-md mx-auto">
                        Use the form on the left or click &ldquo;Fill Example (Ravi / W001)&rdquo; to create a worker account and test immediate login.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table
                        aria-label="Provisioned Worker Accounts"
                        className="w-full text-left border-collapse"
                      >
                        <thead>
                          <tr className="border-b border-slate-800 text-xs font-semibold text-slate-300 bg-[#0B1220]">
                            <th scope="col" className="py-3 px-4">
                              Worker ID
                            </th>
                            <th scope="col" className="py-3 px-4">
                              Name &amp; Sector
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
                          {managedWorkers.map((mw) => (
                            <tr key={mw.id} className="hover:bg-slate-800/40">
                              <td className="py-3.5 px-4 font-mono text-xs font-bold text-[#0284C7]">
                                {mw.badgeId}
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="font-bold text-white">{mw.name}</div>
                                <div className="text-xs text-slate-300">{mw.department}</div>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-xs text-slate-200">
                                {mw.username}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-xs text-emerald-400">
                                {mw.password}
                              </td>
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    aria-label={`Edit worker account ${mw.name}`}
                                    onClick={() => handleStartEditWorker(mw)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Delete worker account ${mw.name}`}
                                    onClick={() => onDeleteWorker(mw.id)}
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

          {/* OVERVIEW SECTION: 3 Mandatory Charts */}
          {activeSection === 'overview' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart 1: Attendance Chart */}
                <div className="bg-[#111827] rounded-xl border border-slate-800 p-6 space-y-4">
                  <div>
                    <h2 className="text-base font-bold text-white">Attendance Chart (Weekly %)</h2>
                    <p className="text-xs text-slate-300">
                      Daily verified check-in completion across sectors
                    </p>
                  </div>
                  <div className="h-44 flex items-end justify-between gap-3 pt-4">
                    {CONSTRUCTION_WEEKLY_METRICS.map((item) => (
                      <div key={item.day} className="flex-1 flex flex-col items-center gap-2">
                        <span className="text-[11px] font-mono tabular-nums text-slate-300">
                          {item.attendance}%
                        </span>
                        <div className="w-full bg-[#0B1220] rounded-t-md h-28 flex items-end overflow-hidden">
                          <div
                            className="w-full bg-[#2563EB] rounded-t-md transition-all"
                            style={{ height: `${item.attendance}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-slate-300">{item.day}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chart 2: Overtime Chart */}
                <div className="bg-[#111827] rounded-xl border border-slate-800 p-6 space-y-4">
                  <div>
                    <h2 className="text-base font-bold text-white">Overtime Chart (Total Hrs)</h2>
                    <p className="text-xs text-slate-300">
                      Approved daily overtime hours across all trades
                    </p>
                  </div>
                  <div className="h-44 flex items-end justify-between gap-3 pt-4">
                    {CONSTRUCTION_WEEKLY_METRICS.map((item) => {
                      const heightPct = Math.round((item.overtimeHours / 80) * 100);
                      return (
                        <div key={item.day} className="flex-1 flex flex-col items-center gap-2">
                          <span className="text-[11px] font-mono tabular-nums text-[#0284C7]">
                            {item.overtimeHours}h
                          </span>
                          <div className="w-full bg-[#0B1220] rounded-t-md h-28 flex items-end overflow-hidden">
                            <div
                              className="w-full bg-[#0284C7] rounded-t-md transition-all"
                              style={{ height: `${heightPct}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-slate-300">{item.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Chart 3: Safety Issue Chart */}
                <div className="bg-[#111827] rounded-xl border border-slate-800 p-6 space-y-4">
                  <div>
                    <h2 className="text-base font-bold text-white">Safety Issue Chart</h2>
                    <p className="text-xs text-slate-300">
                      Hazards by resolution state &amp; priority severity
                    </p>
                  </div>
                  <div className="space-y-4 pt-2">
                    {(['Submitted', 'Under Review', 'Resolved'] as const).map((st) => {
                      const count = constructionComplaints.filter((c) => c.status === st).length;
                      const pct = Math.round(
                        (count / Math.max(1, constructionComplaints.length)) * 100
                      );
                      return (
                        <div key={st} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-200 font-semibold">{st}</span>
                            <span className="font-mono tabular-nums text-slate-300">
                              {count} reports ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-3 bg-[#0B1220] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                st === 'Resolved'
                                  ? 'bg-emerald-500'
                                  : st === 'Under Review'
                                  ? 'bg-[#0284C7]'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.max(12, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Skill Passport Verification Queue */}
              <div className="bg-[#111827] rounded-xl border border-slate-800 p-6 space-y-4">
                <div className="pb-4 border-b border-slate-800">
                  <h2 className="text-lg font-bold text-white">
                    Worker Skill Passport Verification Queue
                  </h2>
                  <p className="text-xs text-slate-300">
                    Approve trade certifications and experience logs submitted by site workers.
                  </p>
                </div>

                <div className="divide-y divide-slate-800">
                  {constructionSkills.map((sk) => (
                    <div
                      key={sk.id}
                      className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-sm text-white">{sk.title}</div>
                        <div className="text-xs text-slate-300">
                          Worker: {sk.userName} · Issuer: {sk.issuer} ·{' '}
                          <span className="font-mono tabular-nums">{sk.experienceHours} hrs</span> ·{' '}
                          <span className="font-mono">{sk.issueDate}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {sk.verifiedStatus === 'Pending' ? (
                          <button
                            type="button"
                            onClick={() => onVerifySkill(sk.id)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
                          >
                            <Award className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Approve Credential</span>
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-400">
                            Verified Credential
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TABLE 1: WORKER LIST */}
          {(activeSection === 'workers' || activeSection === 'overview') && (
            <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Complete Site Worker Roster</h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Includes all newly created worker accounts and active site personnel.
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <label htmlFor="worker-roster-search" className="sr-only">
                    Filter workers by name, ID, or sector
                  </label>
                  <Search
                    className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    id="worker-roster-search"
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filter by worker, ID, or sector..."
                    className="w-full pl-9 pr-4 py-2 min-h-[40px] rounded-lg bg-[#0B1220] border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table
                  aria-label="Complete Site Worker Roster"
                  className="w-full text-left border-collapse"
                >
                  <thead>
                    <tr className="border-b border-slate-800 text-xs font-semibold text-slate-300 bg-[#0B1220]">
                      <th scope="col" className="py-3.5 px-6">
                        Worker ID
                      </th>
                      <th scope="col" className="py-3.5 px-6">
                        Worker Name
                      </th>
                      <th scope="col" className="py-3.5 px-6">
                        Username
                      </th>
                      <th scope="col" className="py-3.5 px-6">
                        Trade / Site Sector
                      </th>
                      <th scope="col" className="py-3.5 px-6 text-right">
                        Regular Hrs
                      </th>
                      <th scope="col" className="py-3.5 px-6 text-right">
                        Overtime Hrs
                      </th>
                      <th scope="col" className="py-3.5 px-6 text-right">
                        Attendance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {filteredWorkers.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-800/40">
                        <td className="py-3.5 px-6 font-mono text-xs font-semibold text-[#0284C7]">
                          {w.badgeId}
                        </td>
                        <td className="py-3.5 px-6 font-semibold text-white">{w.name}</td>
                        <td className="py-3.5 px-6 font-mono text-xs text-slate-200">
                          {w.username}
                        </td>
                        <td className="py-3.5 px-6 text-slate-200">{w.trade}</td>
                        <td className="py-3.5 px-6 text-right font-mono tabular-nums text-slate-200">
                          {w.regularHoursWeek.toFixed(1)}
                        </td>
                        <td className="py-3.5 px-6 text-right font-mono tabular-nums text-[#0284C7] font-semibold">
                          +{w.overtimeHoursWeek.toFixed(1)}
                        </td>
                        <td className="py-3.5 px-6 text-right font-mono tabular-nums text-emerald-400">
                          {w.attendanceRate.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TABLE 2: SHIFT RECORDS */}
          {(activeSection === 'shifts' || activeSection === 'overview') && (
            <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-800">
                <h2 className="text-lg font-bold text-white">Shift Records</h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Audited check-in and check-out logs across construction sectors.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table
                  aria-label="Construction Shift Records"
                  className="w-full text-left border-collapse"
                >
                  <thead>
                    <tr className="border-b border-slate-800 text-xs font-semibold text-slate-300 bg-[#0B1220]">
                      <th scope="col" className="py-3.5 px-6">
                        Date
                      </th>
                      <th scope="col" className="py-3.5 px-6">
                        Worker
                      </th>
                      <th scope="col" className="py-3.5 px-6">
                        Sector
                      </th>
                      <th scope="col" className="py-3.5 px-6">
                        Check-In
                      </th>
                      <th scope="col" className="py-3.5 px-6">
                        Check-Out
                      </th>
                      <th scope="col" className="py-3.5 px-6 text-right">
                        Regular
                      </th>
                      <th scope="col" className="py-3.5 px-6 text-right">
                        Overtime
                      </th>
                      <th scope="col" className="py-3.5 px-6">
                        State
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {constructionAttendance.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-800/40">
                        <td className="py-3.5 px-6 font-mono tabular-nums text-slate-200">
                          {row.dateLabel}
                        </td>
                        <td className="py-3.5 px-6 font-semibold text-white">{row.userName}</td>
                        <td className="py-3.5 px-6 text-slate-300">{row.department}</td>
                        <td className="py-3.5 px-6 font-mono tabular-nums text-slate-200">
                          {row.checkInTime}
                        </td>
                        <td className="py-3.5 px-6 font-mono tabular-nums text-slate-200">
                          {row.checkOutTime}
                        </td>
                        <td className="py-3.5 px-6 text-right font-mono tabular-nums">
                          {row.regularHours.toFixed(1)}h
                        </td>
                        <td className="py-3.5 px-6 text-right font-mono tabular-nums text-[#0284C7] font-semibold">
                          +{row.overtimeHours.toFixed(1)}h
                        </td>
                        <td className="py-3.5 px-6 text-xs font-semibold text-emerald-400">
                          {row.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TABLE 3: COMPLAINT REPORTS */}
          {(activeSection === 'complaints' || activeSection === 'overview') && (
            <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Safety &amp; Workplace Complaint Reports
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Review worker hazard submissions and update workflow status in real time.
                  </p>
                </div>

                <div
                  role="group"
                  aria-label="Filter safety reports by status"
                  className="flex items-center gap-1 p-1 bg-[#0B1220] rounded-lg"
                >
                  {(['All', 'Submitted', 'Under Review', 'Resolved'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setStatusFilter(tab)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        statusFilter === tab
                          ? 'bg-[#2563EB] text-white'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table
                  aria-label="Safety and Workplace Complaint Reports"
                  className="w-full text-left border-collapse"
                >
                  <thead>
                    <tr className="border-b border-slate-800 text-xs font-semibold text-slate-300 bg-[#0B1220]">
                      <th scope="col" className="py-3.5 px-6">
                        Hazard Title &amp; Details
                      </th>
                      <th scope="col" className="py-3.5 px-6">
                        Reported By
                      </th>
                      <th scope="col" className="py-3.5 px-6">
                        Location
                      </th>
                      <th scope="col" className="py-3.5 px-6">
                        Priority
                      </th>
                      <th scope="col" className="py-3.5 px-6">
                        Status
                      </th>
                      <th scope="col" className="py-3.5 px-6 text-right">
                        Supervisor Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {filteredComplaints.map((cmp) => (
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
                              cmp.priority === 'Critical' || cmp.priority === 'High'
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
                                Mark Under Review
                              </button>
                            )}
                            {cmp.status !== 'Resolved' && (
                              <button
                                type="button"
                                onClick={() => onUpdateComplaintStatus(cmp.id, 'Resolved')}
                                className="px-3 py-1.5 min-h-[36px] rounded-md bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
                              >
                                Resolve Issue
                              </button>
                            )}
                            {cmp.status === 'Resolved' && (
                              <span className="text-xs text-slate-400 font-mono">Closed</span>
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

          {/* AI STUDIO SECTION */}
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
              <AITransparencyStudio roleLabel="Construction Admin" darkTheme={true} />
            </Suspense>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Construction Admin Mobile Bottom Navigation"
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
          <span className="truncate">Overview</span>
        </button>
        <button
          type="button"
          aria-current={activeSection === 'workers' ? 'page' : undefined}
          onClick={() => setActiveSection('workers')}
          className={`flex flex-col items-center justify-center py-2 min-h-[48px] rounded-lg text-xs font-semibold cursor-pointer ${
            activeSection === 'workers' ? 'text-[#2563EB] bg-slate-800' : 'text-slate-300'
          }`}
        >
          <UserPlus className="w-4 h-4 mb-0.5" aria-hidden="true" />
          <span className="truncate">Workers</span>
        </button>
        <button
          type="button"
          aria-current={activeSection === 'shifts' ? 'page' : undefined}
          onClick={() => setActiveSection('shifts')}
          className={`flex flex-col items-center justify-center py-2 min-h-[48px] rounded-lg text-xs font-semibold cursor-pointer ${
            activeSection === 'shifts' ? 'text-[#2563EB] bg-slate-800' : 'text-slate-300'
          }`}
        >
          <CalendarClock className="w-4 h-4 mb-0.5" aria-hidden="true" />
          <span className="truncate">Shifts</span>
        </button>
        <button
          type="button"
          aria-current={activeSection === 'complaints' ? 'page' : undefined}
          onClick={() => setActiveSection('complaints')}
          className={`flex flex-col items-center justify-center py-2 min-h-[48px] rounded-lg text-xs font-semibold cursor-pointer ${
            activeSection === 'complaints' ? 'text-[#2563EB] bg-slate-800' : 'text-slate-300'
          }`}
        >
          <ShieldAlert className="w-4 h-4 mb-0.5" aria-hidden="true" />
          <span className="truncate">Safety</span>
        </button>
        <button
          type="button"
          aria-current={activeSection === 'ai' ? 'page' : undefined}
          onClick={() => setActiveSection('ai')}
          className={`flex flex-col items-center justify-center py-2 min-h-[48px] rounded-lg text-xs font-semibold cursor-pointer ${
            activeSection === 'ai' ? 'text-[#2563EB] bg-slate-800' : 'text-slate-300'
          }`}
        >
          <Sparkles className="w-4 h-4 mb-0.5" aria-hidden="true" />
          <span className="truncate">AI Studio</span>
        </button>
      </nav>
    </div>
  );
};
