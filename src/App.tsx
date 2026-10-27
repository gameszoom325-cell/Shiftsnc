/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  GraduationCap,
  HardHat,
  KeyRound,
  Loader2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import {
  AttendanceItem,
  DemoUser,
  OrganizationType,
  RoleId,
  SafetyComplaintItem,
  SkillRecordItem,
} from './types';
import {
  COLLEGE_DEPARTMENTS,
  DEMO_USERS,
  INITIAL_ATTENDANCE,
  INITIAL_COMPLAINTS,
  INITIAL_SKILLS,
  WORKER_DIRECTORY,
} from './data/demoData';
import {
  saveAttendanceToFirestore,
  saveComplaintToFirestore,
  saveSkillToFirestore,
  signInWithGoogleForRole,
  signOutFirebaseUser,
  subscribeToAuthChanges,
  subscribeUserFirestoreData,
  updateSkillStatusInFirestore,
} from './lib/firebase';
import {
  AuthSession,
  authenticateUserRequest,
  createSession,
  isSessionValid,
  provisionManagedAccount,
} from './security/authEngine';
import {
  ROLE_ROUTES,
  canAccessRolePortal,
  resolveRoleFromPath,
  sanitizeInput,
  validateComplaintForm,
  validateIdentifier,
  validatePassword,
  validateSkillForm,
} from './security/validation';

// Lazy-load heavy role portals to reduce initial bundle size and speed up startup on low-end devices
const ConstructionWorkerPortal = lazy(() =>
  import('./components/ConstructionWorkerPortal').then((m) => ({
    default: m.ConstructionWorkerPortal,
  }))
);
const CollegeStudentPortal = lazy(() =>
  import('./components/CollegeStudentPortal').then((m) => ({
    default: m.CollegeStudentPortal,
  }))
);
const ConstructionAdminPortal = lazy(() =>
  import('./components/ConstructionAdminPortal').then((m) => ({
    default: m.ConstructionAdminPortal,
  }))
);
const CollegeAdminPortal = lazy(() =>
  import('./components/CollegeAdminPortal').then((m) => ({
    default: m.CollegeAdminPortal,
  }))
);

const STORAGE_KEY_WORKERS = 'shiftsync_provisioned_workers_v2';
const STORAGE_KEY_STUDENTS = 'shiftsync_provisioned_students_v2';
const STORAGE_KEY_REMEMBER_PREFS = 'shiftsync_remember_login_prefs_v1';
const STORAGE_KEY_ACTIVE_SESSION = 'shiftsync_active_session_v1';

interface RememberedLoginPrefs {
  rememberMe: boolean;
  organization: OrganizationType | null;
  role: RoleId | null;
}

function loadRememberedPrefs(): RememberedLoginPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REMEMBER_PREFS);
    if (!raw) return { rememberMe: false, organization: null, role: null };
    const parsed = JSON.parse(raw);
    const validOrg =
      parsed.organization === 'college' || parsed.organization === 'construction'
        ? (parsed.organization as OrganizationType)
        : null;
    const validRole =
      parsed.role === 'college_student' ||
      parsed.role === 'college_admin' ||
      parsed.role === 'construction_worker' ||
      parsed.role === 'construction_admin'
        ? (parsed.role as RoleId)
        : null;
    if (parsed.rememberMe && validOrg) {
      return {
        rememberMe: true,
        organization: validOrg,
        role: validRole,
      };
    }
  } catch {
    // ignore storage errors
  }
  return { rememberMe: false, organization: null, role: null };
}

function loadPersistedSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_ACTIVE_SESSION);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (isSessionValid(parsed)) {
      return parsed;
    }
    sessionStorage.removeItem(STORAGE_KEY_ACTIVE_SESSION);
  } catch {
    // ignore storage errors
  }
  return null;
}

export default function App() {
  // Active authenticated session & user
  const [authSession, setAuthSession] = useState<AuthSession | null>(() =>
    loadPersistedSession()
  );
  const loggedInUser: DemoUser | null = authSession ? authSession.user : null;

  // Load persisted organization & role if 'Remember Me' was checked
  const initialPrefs = loadRememberedPrefs();

  // 3-Step Login Wizard State: Step 1 (Organization) -> Step 2 (Role) -> Step 3 (Login Form)
  const [loginStep, setLoginStep] = useState<1 | 2 | 3>(() => {
    if (initialPrefs.rememberMe && initialPrefs.organization && initialPrefs.role) {
      return 3;
    }
    if (initialPrefs.rememberMe && initialPrefs.organization) {
      return 2;
    }
    return 1;
  });
  const [selectedOrg, setSelectedOrg] = useState<OrganizationType | null>(
    initialPrefs.organization
  );
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(initialPrefs.role);
  const [rememberMe, setRememberMe] = useState<boolean>(initialPrefs.rememberMe);

  // Step 3 Login Form Inputs & Loading Guard
  const [identifierInput, setIdentifierInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [rbacAlert, setRbacAlert] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [googleAuthName, setGoogleAuthName] = useState<string | null>(null);

  // Sync active session to sessionStorage
  useEffect(() => {
    try {
      if (authSession && isSessionValid(authSession)) {
        sessionStorage.setItem(STORAGE_KEY_ACTIVE_SESSION, JSON.stringify(authSession));
      } else {
        sessionStorage.removeItem(STORAGE_KEY_ACTIVE_SESSION);
      }
    } catch {
      // ignore storage errors
    }
  }, [authSession]);

  // URL Route Guard: Prevent users from accessing other role dashboards by changing URLs manually
  useEffect(() => {
    const enforceRouteProtection = () => {
      const targetRoleFromUrl = resolveRoleFromPath(window.location.pathname);
      if (targetRoleFromUrl) {
        const check = canAccessRolePortal(loggedInUser, targetRoleFromUrl);
        if (!check.allowed) {
          setRbacAlert(
            check.reason ||
              'Unauthorized URL access blocked by Role-Based Access Control (RBAC).'
          );
          const safeUrl = loggedInUser ? ROLE_ROUTES[loggedInUser.role] : '/';
          window.history.replaceState({}, '', safeUrl);
        }
      } else if (loggedInUser) {
        const expectedRoute = ROLE_ROUTES[loggedInUser.role];
        if (window.location.pathname !== expectedRoute) {
          window.history.replaceState({}, '', expectedRoute);
        }
      }
    };

    enforceRouteProtection();
    window.addEventListener('popstate', enforceRouteProtection);
    return () => window.removeEventListener('popstate', enforceRouteProtection);
  }, [loggedInUser]);

  // Persist or clear organization and role in localStorage when rememberMe, selectedOrg, or selectedRole changes
  useEffect(() => {
    try {
      if (rememberMe) {
        localStorage.setItem(
          STORAGE_KEY_REMEMBER_PREFS,
          JSON.stringify({
            rememberMe: true,
            organization: selectedOrg,
            role: selectedRole,
          })
        );
      } else {
        localStorage.removeItem(STORAGE_KEY_REMEMBER_PREFS);
      }
    } catch {
      // ignore storage errors
    }
  }, [rememberMe, selectedOrg, selectedRole]);

  // Admin-Provisioned Accounts (Persisted in localStorage so created accounts can log in immediately)
  const [managedWorkers, setManagedWorkers] = useState<DemoUser[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WORKERS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [managedStudents, setManagedStudents] = useState<DemoUser[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STUDENTS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WORKERS, JSON.stringify(managedWorkers));
    } catch {
      // ignore storage errors
    }
  }, [managedWorkers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(managedStudents));
    } catch {
      // ignore storage errors
    }
  }, [managedStudents]);

  // Shared application state across portals
  const [attendance, setAttendance] = useState<AttendanceItem[]>(INITIAL_ATTENDANCE);
  const [complaints, setComplaints] = useState<SafetyComplaintItem[]>(INITIAL_COMPLAINTS);
  const [skills, setSkills] = useState<SkillRecordItem[]>(INITIAL_SKILLS);
  const [isWorkerCheckedIn, setIsWorkerCheckedIn] = useState<boolean>(true);
  const [workerCheckInTime, setWorkerCheckInTime] = useState<string>('06:55 AM');

  useEffect(() => {
    let unsubData: (() => void) | null = null;
    const unsubAuth = subscribeToAuthChanges((fbUser) => {
      if (fbUser) {
        setGoogleAuthName(fbUser.displayName || fbUser.email || 'Authenticated User');
        unsubData = subscribeUserFirestoreData(fbUser.uid, (cloudData) => {
          if (cloudData.attendance.length > 0) {
            setAttendance((prev) => {
              const existingIds = new Set(cloudData.attendance.map((a) => a.id));
              return [...cloudData.attendance, ...prev.filter((p) => !existingIds.has(p.id))];
            });
          }
          if (cloudData.complaints.length > 0) {
            setComplaints((prev) => {
              const existingIds = new Set(cloudData.complaints.map((c) => c.id));
              return [...cloudData.complaints, ...prev.filter((p) => !existingIds.has(p.id))];
            });
          }
          if (cloudData.skills.length > 0) {
            setSkills((prev) => {
              const existingIds = new Set(cloudData.skills.map((s) => s.id));
              return [...cloudData.skills, ...prev.filter((p) => !existingIds.has(p.id))];
            });
          }
        });
      } else {
        setGoogleAuthName(null);
        if (unsubData) {
          unsubData();
          unsubData = null;
        }
      }
    });

    return () => {
      unsubAuth();
      if (unsubData) unsubData();
    };
  }, []);

  // Step 1 Handler: Choose Organization
  const handleChooseOrganization = (org: OrganizationType) => {
    setSelectedOrg(org);
    setSelectedRole(null);
    setLoginError(null);
    setRbacAlert(null);
    setIdentifierInput('');
    setPasswordInput('');
    setLoginStep(2);
  };

  // Step 2 Handler: Choose Role
  const handleChooseRole = (role: RoleId) => {
    setSelectedRole(role);
    setLoginError(null);
    setRbacAlert(null);
    setIdentifierInput('');
    setPasswordInput('');
    setLoginStep(3);
  };

  // Step 3 Handler: Validate & Authenticate User via Backend Service
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthenticating || !selectedRole) return;

    setLoginError(null);
    setRbacAlert(null);

    // Input validation & sanitization before network request
    const idCheck = validateIdentifier(identifierInput);
    if (!idCheck.valid) {
      setLoginError(idCheck.error || 'Invalid username or ID.');
      return;
    }

    const passCheck = validatePassword(passwordInput);
    if (!passCheck.valid) {
      setLoginError(passCheck.error || 'Invalid password.');
      return;
    }

    setIsAuthenticating(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          identifier: idCheck.sanitizedValue,
          password: passCheck.sanitizedValue,
          provisionedStudents: managedStudents,
          provisionedWorkers: managedWorkers,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success || !data.session) {
        setLoginError(data.error || 'Authentication failed. Please check your credentials.');
        setIsAuthenticating(false);
        return;
      }

      setAuthSession(data.session);
      setIdentifierInput('');
      setPasswordInput('');
      window.history.replaceState({}, '', ROLE_ROUTES[selectedRole]);
    } catch {
      // Offline / local fallback using validated authEngine
      const fallbackResult = authenticateUserRequest({
        role: selectedRole,
        identifier: idCheck.sanitizedValue!,
        password: passCheck.sanitizedValue!,
        provisionedStudents: managedStudents,
        provisionedWorkers: managedWorkers,
      });

      if (!fallbackResult.success || !fallbackResult.session) {
        setLoginError(fallbackResult.error || 'Authentication failed.');
      } else {
        setAuthSession(fallbackResult.session);
        setIdentifierInput('');
        setPasswordInput('');
        window.history.replaceState({}, '', ROLE_ROUTES[selectedRole]);
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!selectedRole || isAuthenticating) return;
    setLoginError(null);
    setIsAuthenticating(true);
    try {
      const templateUser = DEMO_USERS[selectedRole];
      const fbUser = await signInWithGoogleForRole(selectedRole, templateUser.department);
      const session = createSession({
        ...templateUser,
        name: sanitizeInput(fbUser.displayName || templateUser.name, 80),
        email: sanitizeInput(fbUser.email || templateUser.email, 120),
      });
      setAuthSession(session);
      window.history.replaceState({}, '', ROLE_ROUTES[selectedRole]);
    } catch (err: unknown) {
      setLoginError(
        err instanceof Error ? err.message : 'Google Sign-In could not be completed.'
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    const token = authSession?.token;
    setAuthSession(null);
    window.history.replaceState({}, '', '/');

    if (rememberMe && selectedOrg && selectedRole) {
      setLoginStep(3);
    } else if (rememberMe && selectedOrg) {
      setLoginStep(2);
    } else {
      setLoginStep(1);
      setSelectedOrg(null);
      setSelectedRole(null);
    }
    setIdentifierInput('');
    setPasswordInput('');
    setLoginError(null);

    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }).catch(() => {});
    }

    try {
      if (googleAuthName) {
        await signOutFirebaseUser();
      }
    } catch {
      // ignore sign-out error
    }
  };

  // Admin Account Management Handlers (Construction Admin -> Workers)
  const handleCreateWorker = (
    workerData: Omit<DemoUser, 'id' | 'organization' | 'role' | 'roleLabel'>
  ) => {
    const result = provisionManagedAccount({
      actor: loggedInUser,
      targetRole: 'construction_worker',
      accountInput: {
        name: workerData.name,
        badgeId: workerData.badgeId,
        username: workerData.username,
        password: workerData.password || '',
        department: workerData.department,
        hourlyRate: workerData.hourlyRate,
      },
      existingAccounts: managedWorkers,
    });

    if (!result.success || !result.user) {
      return;
    }

    const newWorker = result.user;
    setManagedWorkers((prev) => [newWorker, ...prev]);

    // Seed an initial shift attendance entry for the newly created worker
    const initialShift: AttendanceItem = {
      id: `att_init_${Date.now()}`,
      userId: newWorker.id,
      userName: newWorker.name,
      portalType: 'construction',
      department: newWorker.department,
      dateLabel: 'Oct 26, 2026',
      checkInTime: '07:00 AM',
      checkOutTime: '03:30 PM',
      regularHours: 8.0,
      overtimeHours: 1.5,
      status: 'Completed',
    };
    setAttendance((prev) => [initialShift, ...prev]);
  };

  const handleUpdateWorker = (id: string, updated: Partial<DemoUser>) => {
    if (loggedInUser?.role !== 'construction_admin') return;
    setManagedWorkers((prev) =>
      prev.map((w) =>
        w.id === id
          ? {
              ...w,
              ...updated,
              name: updated.name ? sanitizeInput(updated.name, 80) : w.name,
              badgeId: updated.badgeId ? sanitizeInput(updated.badgeId, 32).toUpperCase() : w.badgeId,
              username: updated.username ? sanitizeInput(updated.username, 60).toLowerCase() : w.username,
              department: updated.department ? sanitizeInput(updated.department, 120) : w.department,
            }
          : w
      )
    );
  };

  const handleDeleteWorker = (id: string) => {
    if (loggedInUser?.role !== 'construction_admin') return;
    setManagedWorkers((prev) => prev.filter((w) => w.id !== id));
  };

  // Admin Account Management Handlers (College Admin -> Students)
  const handleCreateStudent = (
    studentData: Omit<DemoUser, 'id' | 'organization' | 'role' | 'roleLabel'>
  ) => {
    const result = provisionManagedAccount({
      actor: loggedInUser,
      targetRole: 'college_student',
      accountInput: {
        name: studentData.name,
        badgeId: studentData.badgeId,
        username: studentData.username,
        password: studentData.password || '',
        department: studentData.department,
        semester: studentData.semester,
      },
      existingAccounts: managedStudents,
    });

    if (!result.success || !result.user) {
      return;
    }

    const newStudent = result.user;
    setManagedStudents((prev) => [newStudent, ...prev]);

    // Seed an initial lab attendance entry for the newly created student
    const initialLab: AttendanceItem = {
      id: `att_stu_init_${Date.now()}`,
      userId: newStudent.id,
      userName: newStudent.name,
      portalType: 'college',
      department: newStudent.department,
      dateLabel: 'Oct 26, 2026',
      checkInTime: '09:00 AM',
      checkOutTime: '11:00 AM',
      regularHours: 2.0,
      overtimeHours: 0.0,
      status: 'Completed',
    };
    setAttendance((prev) => [initialLab, ...prev]);
  };

  const handleUpdateStudent = (id: string, updated: Partial<DemoUser>) => {
    if (loggedInUser?.role !== 'college_admin') return;
    setManagedStudents((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              ...updated,
              name: updated.name ? sanitizeInput(updated.name, 80) : s.name,
              badgeId: updated.badgeId ? sanitizeInput(updated.badgeId, 32).toUpperCase() : s.badgeId,
              username: updated.username ? sanitizeInput(updated.username, 60).toLowerCase() : s.username,
              department: updated.department ? sanitizeInput(updated.department, 120) : s.department,
            }
          : s
      )
    );
  };

  const handleDeleteStudent = (id: string) => {
    if (loggedInUser?.role !== 'college_admin') return;
    setManagedStudents((prev) => prev.filter((s) => s.id !== id));
  };

  // Interactive Handlers inside Portals
  const handleWorkerCheckInOut = () => {
    if (!loggedInUser) return;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isWorkerCheckedIn) {
      setIsWorkerCheckedIn(false);
      const newRecord: AttendanceItem = {
        id: `att_${Date.now()}`,
        userId: loggedInUser.id,
        userName: loggedInUser.name,
        portalType: 'construction',
        department: loggedInUser.department,
        dateLabel: 'Today',
        checkInTime: workerCheckInTime,
        checkOutTime: nowTime,
        regularHours: 8.0,
        overtimeHours: 1.0,
        status: 'Completed',
      };
      setAttendance((prev) => [newRecord, ...prev]);
      saveAttendanceToFirestore(newRecord).catch(() => {});
    } else {
      setWorkerCheckInTime(nowTime);
      setIsWorkerCheckedIn(true);
    }
  };

  const handleStudentCheckInSession = (courseName: string) => {
    if (!loggedInUser) return;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newRecord: AttendanceItem = {
      id: `att_stu_${Date.now()}`,
      userId: loggedInUser.id,
      userName: loggedInUser.name,
      portalType: 'college',
      department: sanitizeInput(courseName, 120),
      dateLabel: 'Today',
      checkInTime: nowTime,
      checkOutTime: 'Session Logged',
      regularHours: 2.0,
      overtimeHours: 0.0,
      status: 'Completed',
    };
    setAttendance((prev) => [newRecord, ...prev]);
    saveAttendanceToFirestore(newRecord).catch(() => {});
  };

  const handleAddComplaint = (
    item: Omit<SafetyComplaintItem, 'id' | 'dateSubmitted' | 'status'>
  ) => {
    const check = validateComplaintForm({
      title: item.title,
      location: item.location,
      description: item.description,
    });
    if (!check.valid) return;

    const created: SafetyComplaintItem = {
      ...item,
      id: `cmp_${Date.now()}`,
      title: sanitizeInput(item.title, 150),
      category: sanitizeInput(item.category, 80),
      location: sanitizeInput(item.location, 120),
      description: sanitizeInput(item.description, 1500),
      status: 'Submitted',
      dateSubmitted: 'Oct 26, 2026',
    };
    setComplaints((prev) => [created, ...prev]);
    saveComplaintToFirestore(created).catch(() => {});
  };

  const handleUpdateComplaintStatus = (
    id: string,
    nextStatus: 'Submitted' | 'Under Review' | 'Resolved'
  ) => {
    setComplaints((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: nextStatus } : c))
    );
  };

  const handleAddSkill = (item: Omit<SkillRecordItem, 'id' | 'verifiedStatus'>) => {
    const check = validateSkillForm({
      title: item.title,
      issuer: item.issuer,
      experienceHours: item.experienceHours,
    });
    if (!check.valid) return;

    const created: SkillRecordItem = {
      ...item,
      id: `sk_${Date.now()}`,
      title: sanitizeInput(item.title, 150),
      issuer: sanitizeInput(item.issuer, 120),
      verifiedStatus: 'Pending',
    };
    setSkills((prev) => [created, ...prev]);
    saveSkillToFirestore(created).catch(() => {});
  };

  const handleVerifySkill = (id: string) => {
    const target = skills.find((s) => s.id === id);
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, verifiedStatus: 'Verified' } : s))
    );
    if (target) {
      updateSkillStatusInFirestore(target, 'Verified').catch(() => {});
    }
  };

  // Render Active Dashboard if Logged In (Wrapped in Suspense for fast code-splitting)
  if (loggedInUser) {
    return (
      <>
        {rbacAlert && (
          <div
            role="alert"
            aria-live="assertive"
            className="bg-amber-600 text-white px-6 py-2.5 text-xs font-semibold flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{rbacAlert}</span>
            </div>
            <button
              type="button"
              onClick={() => setRbacAlert(null)}
              className="underline font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
        <Suspense
          fallback={
            <div
              role="status"
              aria-live="polite"
              className="min-h-screen bg-[#F8F5F0] text-[#111827] flex flex-col items-center justify-center p-6 gap-3"
            >
              <Loader2 className="w-7 h-7 text-[#2563EB] animate-spin" aria-hidden="true" />
              <span className="text-sm font-semibold text-slate-700">
                Loading {loggedInUser.roleLabel} Portal...
              </span>
            </div>
          }
        >
          {loggedInUser.role === 'construction_worker' && (
            <ConstructionWorkerPortal
              user={loggedInUser}
              attendance={attendance}
              complaints={complaints}
              skills={skills}
              onCheckInOut={handleWorkerCheckInOut}
              isCheckedIn={isWorkerCheckedIn}
              activeCheckInTime={workerCheckInTime}
              onAddComplaint={handleAddComplaint}
              onAddSkill={handleAddSkill}
              onLogout={handleLogout}
            />
          )}

          {loggedInUser.role === 'college_student' && (
            <CollegeStudentPortal
              user={loggedInUser}
              attendance={attendance}
              complaints={complaints}
              skills={skills}
              onCheckInSession={handleStudentCheckInSession}
              onAddComplaint={handleAddComplaint}
              onAddSkill={handleAddSkill}
              onLogout={handleLogout}
            />
          )}

          {loggedInUser.role === 'construction_admin' && (
            <ConstructionAdminPortal
              user={loggedInUser}
              workers={WORKER_DIRECTORY}
              managedWorkers={managedWorkers}
              onCreateWorker={handleCreateWorker}
              onUpdateWorker={handleUpdateWorker}
              onDeleteWorker={handleDeleteWorker}
              attendance={attendance}
              complaints={complaints}
              skills={skills}
              onUpdateComplaintStatus={handleUpdateComplaintStatus}
              onVerifySkill={handleVerifySkill}
              onLogout={handleLogout}
            />
          )}

          {loggedInUser.role === 'college_admin' && (
            <CollegeAdminPortal
              user={loggedInUser}
              departments={COLLEGE_DEPARTMENTS}
              managedStudents={managedStudents}
              onCreateStudent={handleCreateStudent}
              onUpdateStudent={handleUpdateStudent}
              onDeleteStudent={handleDeleteStudent}
              complaints={complaints}
              skills={skills}
              onVerifySkill={handleVerifySkill}
              onUpdateComplaintStatus={handleUpdateComplaintStatus}
              onLogout={handleLogout}
            />
          )}
        </Suspense>
      </>
    );
  }

  // ============================================================================
  // LANDING LOGIN PAGE: 3-STEP GUIDED WORKFLOW
  // Step 1: Organization Selection -> Step 2: Role Selection -> Step 3: Login
  // ============================================================================
  return (
    <div className="min-h-screen bg-[#F8F5F0] text-[#111827] flex flex-col">
      {/* Accessible Skip-to-Content Link for Keyboard Users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-[#2563EB] focus:text-white focus:rounded-lg focus:font-bold focus:text-sm"
      >
        Skip to main content
      </a>

      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header
        role="banner"
        className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-8"
      >
        <a
          href="#top"
          aria-label="ShiftSync AI Home — Reset to Step 1"
          onClick={(e) => {
            e.preventDefault();
            setLoginStep(1);
            setSelectedOrg(null);
            setSelectedRole(null);
          }}
          className="text-lg font-bold tracking-tight text-[#111827] whitespace-nowrap shrink-0 font-display"
        >
          ShiftSync AI
        </a>

        <nav
          aria-label="Login Wizard Steps"
          className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600"
        >
          <button
            type="button"
            aria-current={loginStep === 1 ? 'step' : undefined}
            onClick={() => {
              setLoginStep(1);
              setSelectedOrg(null);
              setSelectedRole(null);
            }}
            className={`hover:text-[#111827] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              loginStep === 1 ? 'text-[#2563EB] underline underline-offset-8' : ''
            }`}
          >
            1. Organization
          </button>
          <button
            type="button"
            disabled={!selectedOrg}
            aria-current={loginStep === 2 ? 'step' : undefined}
            onClick={() => {
              if (selectedOrg) setLoginStep(2);
            }}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              !selectedOrg
                ? 'text-slate-400 cursor-not-allowed'
                : loginStep === 2
                ? 'text-[#2563EB] underline underline-offset-8 cursor-pointer'
                : 'hover:text-[#111827] cursor-pointer'
            }`}
          >
            2. Role Selection
          </button>
          <button
            type="button"
            disabled={!selectedRole}
            aria-current={loginStep === 3 ? 'step' : undefined}
            onClick={() => {
              if (selectedRole) setLoginStep(3);
            }}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              !selectedRole
                ? 'text-slate-400 cursor-not-allowed'
                : loginStep === 3
                ? 'text-[#2563EB] underline underline-offset-8 cursor-pointer'
                : 'hover:text-[#111827] cursor-pointer'
            }`}
          >
            3. Account Sign-In
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          {loginStep > 1 ? (
            <button
              type="button"
              aria-label="Go to previous login step"
              onClick={() => {
                setLoginError(null);
                setLoginStep(loginStep === 3 ? 2 : 1);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-semibold text-[#111827] bg-[#F8F5F0] border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Previous Step</span>
            </button>
          ) : (
            <span className="text-xs font-semibold text-[#2563EB] whitespace-nowrap shrink-0">
              Select Organization
            </span>
          )}
        </div>
      </header>

      <main
        id="main-content"
        role="main"
        className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-14 flex flex-col justify-center space-y-10"
      >
        {rbacAlert && (
          <div
            role="alert"
            aria-live="assertive"
            className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs sm:text-sm font-semibold flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" aria-hidden="true" />
              <span>{rbacAlert}</span>
            </div>
            <button
              type="button"
              onClick={() => setRbacAlert(null)}
              className="text-xs font-bold underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Step Progress Indicator */}
        <div className="space-y-4">
          <div
            aria-label="Current step progress"
            className="flex flex-wrap items-center gap-3 text-xs font-semibold"
          >
            <span className={loginStep >= 1 ? 'text-[#2563EB]' : 'text-slate-500'}>
              Step 1: Choose Organization
            </span>
            <span aria-hidden="true" className="text-slate-400">
              /
            </span>
            <span className={loginStep >= 2 ? 'text-[#2563EB]' : 'text-slate-500'}>
              Step 2: Choose Role
            </span>
            <span aria-hidden="true" className="text-slate-400">
              /
            </span>
            <span className={loginStep === 3 ? 'text-[#2563EB]' : 'text-slate-500'}>
              Step 3: Sign In
            </span>
          </div>

          <div className="max-w-2xl space-y-2">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              {loginStep === 1 && 'Choose Your Organization'}
              {loginStep === 2 &&
                (selectedOrg === 'college'
                  ? 'College / School — Choose Your Role'
                  : 'Construction Site — Choose Your Role')}
              {loginStep === 3 &&
                `Sign In as ${
                  selectedRole === 'college_admin'
                    ? 'College Admin'
                    : selectedRole === 'college_student'
                    ? 'College Student'
                    : selectedRole === 'construction_admin'
                    ? 'Construction Admin'
                    : 'Construction Worker'
                }`}
            </h1>
            <p className="text-sm sm:text-base text-slate-700">
              {loginStep === 1 &&
                'Select your institution or worksite type to access your role-based transparency portal.'}
              {loginStep === 2 &&
                'Select whether you are signing in as an organization administrator or as a provisioned member.'}
              {loginStep === 3 &&
                (selectedRole === 'college_admin' || selectedRole === 'construction_admin'
                  ? 'Enter your administrator credentials to manage accounts, monitor analytics, and verify records.'
                  : 'Enter the username (or ID) and password generated for you by your administrator.')}
            </p>
          </div>

          <div className="pt-1 flex flex-wrap items-center gap-4">
            <label
              htmlFor="remember-me-global"
              className="inline-flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer select-none"
            >
              <input
                id="remember-me-global"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB] cursor-pointer"
              />
              <span>Remember Me (Save last selected organization &amp; role)</span>
            </label>
            {rememberMe && (selectedOrg || selectedRole) && (
              <span className="text-xs font-mono text-[#2563EB]">
                Saved:{' '}
                {selectedOrg === 'college' ? 'College / School' : 'Construction Site'}
                {selectedRole
                  ? ` → ${
                      selectedRole === 'college_admin'
                        ? 'Admin'
                        : selectedRole === 'college_student'
                        ? 'Student'
                        : selectedRole === 'construction_admin'
                        ? 'Admin'
                        : 'Worker'
                    }`
                  : ''}
              </span>
            )}
          </div>
        </div>

        {/* STEP 1: CHOOSE ORGANIZATION ([ College / School ] vs [ Construction Site ]) */}
        {loginStep === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 transition-opacity duration-150">
            {/* Card 1: College / School */}
            <button
              type="button"
              aria-label="Select College or School Organization"
              onClick={() => handleChooseOrganization('college')}
              className="group bg-white rounded-xl border border-slate-200 hover:border-[#2563EB] p-8 text-left transition-all cursor-pointer flex flex-col justify-between min-h-[260px]"
            >
              <div className="space-y-4">
                <div
                  aria-hidden="true"
                  className="w-14 h-14 rounded-xl bg-[#2563EB] text-white flex items-center justify-center"
                >
                  <GraduationCap className="w-7 h-7" aria-hidden="true" />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-mono font-semibold text-[#2563EB]">
                    01 · ACADEMIC INSTITUTION
                  </div>
                  <h2 className="text-2xl font-bold text-[#111827]">
                    College / School
                  </h2>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Academic attendance tracking, verified student Skill Passports, laboratory certificates, and campus grievance management.
                  </p>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-[#2563EB]">
                <span>Select College / School</span>
                <ArrowRight
                  className="w-4 h-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </div>
            </button>

            {/* Card 2: Construction Site */}
            <button
              type="button"
              aria-label="Select Construction Site Organization"
              onClick={() => handleChooseOrganization('construction')}
              className="group bg-white rounded-xl border border-slate-200 hover:border-[#2563EB] p-8 text-left transition-all cursor-pointer flex flex-col justify-between min-h-[260px]"
            >
              <div className="space-y-4">
                <div
                  aria-hidden="true"
                  className="w-14 h-14 rounded-xl bg-[#2563EB] text-white flex items-center justify-center"
                >
                  <HardHat className="w-7 h-7" aria-hidden="true" />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-mono font-semibold text-[#2563EB]">
                    02 · FIELD &amp; INFRASTRUCTURE
                  </div>
                  <h2 className="text-2xl font-bold text-[#111827]">
                    Construction Site
                  </h2>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Daily shift check-in/out auditing, transparent regular &amp; overtime salary tracking, workplace safety reporting, and trade Skill Passports.
                  </p>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-[#2563EB]">
                <span>Select Construction Site</span>
                <ArrowRight
                  className="w-4 h-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </div>
            </button>
          </div>
        )}

        {/* STEP 2: CHOOSE ROLE */}
        {loginStep === 2 && selectedOrg === 'college' && (
          <div className="space-y-6 transition-opacity duration-150">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Student Role Card */}
              <button
                type="button"
                aria-label="Continue as College Student"
                onClick={() => handleChooseRole('college_student')}
                className="group bg-white rounded-xl border border-slate-200 hover:border-[#2563EB] p-8 text-left transition-all cursor-pointer flex flex-col justify-between min-h-[250px]"
              >
                <div className="space-y-4">
                  <div
                    aria-hidden="true"
                    className="w-14 h-14 rounded-xl bg-[#2563EB] text-white flex items-center justify-center"
                  >
                    <UserCheck className="w-7 h-7" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-mono font-semibold text-slate-600">
                      COLLEGE / SCHOOL ROLE
                    </div>
                    <h2 className="text-2xl font-bold text-[#111827]">Student</h2>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      Sign in with the Student ID, username, and password issued by your College Admin to view attendance, certificates, and your Skill Passport.
                    </p>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-[#2563EB]">
                  <span>Continue as Student</span>
                  <ArrowRight
                    className="w-4 h-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </div>
              </button>

              {/* College Admin Role Card */}
              <button
                type="button"
                aria-label="Continue as College Admin"
                onClick={() => handleChooseRole('college_admin')}
                className="group bg-white rounded-xl border border-slate-200 hover:border-[#2563EB] p-8 text-left transition-all cursor-pointer flex flex-col justify-between min-h-[250px]"
              >
                <div className="space-y-4">
                  <div
                    aria-hidden="true"
                    className="w-14 h-14 rounded-xl bg-[#111827] text-white flex items-center justify-center"
                  >
                    <Building2 className="w-7 h-7" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-mono font-semibold text-[#2563EB]">
                      ADMINISTRATOR CONSOLE
                    </div>
                    <h2 className="text-2xl font-bold text-[#111827]">Admin</h2>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      Create and manage student accounts, generate student IDs &amp; credentials, review department analytics, and verify skill certificates.
                    </p>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-[#2563EB]">
                  <span>Continue as College Admin</span>
                  <ArrowRight
                    className="w-4 h-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </div>
              </button>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setLoginStep(1)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-[#111827] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>Back to Organization Selection</span>
              </button>
            </div>
          </div>
        )}

        {loginStep === 2 && selectedOrg === 'construction' && (
          <div className="space-y-6 transition-opacity duration-150">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Construction Worker Role Card */}
              <button
                type="button"
                aria-label="Continue as Construction Worker"
                onClick={() => handleChooseRole('construction_worker')}
                className="group bg-white rounded-xl border border-slate-200 hover:border-[#2563EB] p-8 text-left transition-all cursor-pointer flex flex-col justify-between min-h-[250px]"
              >
                <div className="space-y-4">
                  <div
                    aria-hidden="true"
                    className="w-14 h-14 rounded-xl bg-[#2563EB] text-white flex items-center justify-center"
                  >
                    <HardHat className="w-7 h-7" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-mono font-semibold text-slate-600">
                      CONSTRUCTION SITE ROLE
                    </div>
                    <h2 className="text-2xl font-bold text-[#111827]">Worker</h2>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      Sign in with the Worker ID, username, and password created by your Construction Admin to track shifts, overtime pay, and report hazards.
                    </p>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-[#2563EB]">
                  <span>Continue as Worker</span>
                  <ArrowRight
                    className="w-4 h-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </div>
              </button>

              {/* Construction Admin Role Card */}
              <button
                type="button"
                aria-label="Continue as Construction Admin"
                onClick={() => handleChooseRole('construction_admin')}
                className="group bg-white rounded-xl border border-slate-200 hover:border-[#2563EB] p-8 text-left transition-all cursor-pointer flex flex-col justify-between min-h-[250px]"
              >
                <div className="space-y-4">
                  <div
                    aria-hidden="true"
                    className="w-14 h-14 rounded-xl bg-[#111827] text-white flex items-center justify-center"
                  >
                    <ShieldCheck className="w-7 h-7" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-mono font-semibold text-[#2563EB]">
                      SITE OPERATIONS CONSOLE
                    </div>
                    <h2 className="text-2xl font-bold text-[#111827]">Admin</h2>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      Create and manage worker accounts, generate Worker IDs &amp; credentials, audit shift &amp; overtime analytics, and resolve safety hazards.
                    </p>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-[#2563EB]">
                  <span>Continue as Construction Admin</span>
                  <ArrowRight
                    className="w-4 h-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </div>
              </button>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setLoginStep(1)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-[#111827] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>Back to Organization Selection</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: ROLE-SPECIFIC LOGIN FORM */}
        {loginStep === 3 && selectedRole && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start transition-opacity duration-150">
            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div className="space-y-1">
                  <div className="text-xs font-mono font-semibold text-[#2563EB]">
                    {selectedOrg === 'college' ? 'COLLEGE / SCHOOL' : 'CONSTRUCTION SITE'} ·{' '}
                    {selectedRole === 'college_admin' || selectedRole === 'construction_admin'
                      ? 'ADMIN PORTAL'
                      : selectedRole === 'college_student'
                      ? 'STUDENT PORTAL'
                      : 'WORKER PORTAL'}
                  </div>
                  <h2 className="text-xl font-bold text-[#111827]">
                    Account Authentication
                  </h2>
                </div>
                <Lock className="w-5 h-5 text-[#2563EB]" aria-hidden="true" />
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-5" noValidate>
                <div>
                  <label
                    htmlFor="login-identifier"
                    className="block text-sm font-semibold text-[#111827] mb-1.5"
                  >
                    {selectedRole === 'college_student'
                      ? 'Username or Student ID'
                      : selectedRole === 'construction_worker'
                      ? 'Username or Worker ID'
                      : 'Admin Username or Email'}
                  </label>
                  <input
                    id="login-identifier"
                    name="identifier"
                    type="text"
                    required
                    autoComplete="username"
                    aria-invalid={Boolean(loginError)}
                    aria-describedby={loginError ? 'login-error-message' : undefined}
                    value={identifierInput}
                    onChange={(e) => setIdentifierInput(e.target.value)}
                    placeholder={
                      selectedRole === 'college_student'
                        ? 'Enter your username or Student ID...'
                        : selectedRole === 'construction_worker'
                        ? 'Enter your username or Worker ID...'
                        : 'Enter administrator username or email...'
                    }
                    className="w-full px-4 py-3.5 min-h-[48px] rounded-lg border border-slate-300 bg-[#F8F5F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-semibold text-[#111827] mb-1.5"
                  >
                    Password
                  </label>
                  <input
                    id="login-password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    aria-invalid={Boolean(loginError)}
                    aria-describedby={loginError ? 'login-error-message' : undefined}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter password..."
                    className="w-full px-4 py-3.5 min-h-[48px] rounded-lg border border-slate-300 bg-[#F8F5F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label
                    htmlFor="remember-me-login"
                    className="inline-flex items-center gap-2.5 text-sm font-semibold text-[#111827] cursor-pointer select-none"
                  >
                    <input
                      id="remember-me-login"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB] cursor-pointer"
                    />
                    <span>Remember Me</span>
                  </label>
                  <span className="text-xs text-slate-600">
                    Persists organization &amp; role
                  </span>
                </div>

                {loginError && (
                  <div
                    id="login-error-message"
                    role="alert"
                    aria-live="assertive"
                    className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700 leading-relaxed"
                  >
                    {loginError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="w-full py-4 min-h-[52px] rounded-lg bg-[#2563EB] text-white text-base font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  {isAuthenticating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <span>Sign In to Dashboard</span>
                  )}
                </button>
              </form>

              {(selectedRole === 'college_admin' || selectedRole === 'construction_admin') && (
                <div className="pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={isAuthenticating}
                    onClick={handleGoogleSignIn}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] rounded-lg border border-slate-300 bg-[#F8F5F0] text-[#111827] text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
                    <span>Continue with Google Sign-In (Firebase Auth)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right Column: Role Governance Info Card */}
            <aside
              aria-label="Role Access Governance Information"
              className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 space-y-5"
            >
              <div className="flex items-center gap-2.5 text-sm font-bold text-[#111827]">
                <KeyRound className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
                <span>How ShiftSync AI Access Works</span>
              </div>

              {selectedRole === 'college_student' || selectedRole === 'construction_worker' ? (
                <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
                  <p>
                    For security and workforce transparency,{' '}
                    <strong>
                      {selectedRole === 'college_student' ? 'students' : 'workers'} cannot
                      self-register
                    </strong>
                    .
                  </p>
                  <p>
                    Your account, ID, username, and password are created by your{' '}
                    <strong>
                      {selectedRole === 'college_student'
                        ? 'College Admin'
                        : 'Construction Admin'}
                    </strong>
                    . Once created in the Admin portal, you can log in here immediately.
                  </p>
                  <div className="p-4 rounded-lg bg-[#F8F5F0] border border-slate-200 text-xs space-y-1.5">
                    <div className="font-bold text-[#111827] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                      <span>
                        Active Provisioned Accounts:{' '}
                        {selectedRole === 'college_student'
                          ? managedStudents.length
                          : managedWorkers.length}
                      </span>
                    </div>
                    <p className="text-slate-700">
                      Need an account? Switch to the Admin role to generate a new{' '}
                      {selectedRole === 'college_student' ? 'Student' : 'Worker'} ID, username,
                      and password.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
                  <p>
                    <strong>Administrator accounts</strong> are the initial root accounts for
                    your organization.
                  </p>
                  <p>
                    After signing in as{' '}
                    <strong>
                      {selectedRole === 'college_admin'
                        ? 'College Admin'
                        : 'Construction Admin'}
                    </strong>
                    , you can create, edit, and delete{' '}
                    {selectedRole === 'college_admin' ? 'student' : 'worker'} accounts and
                    generate their IDs, usernames, and passwords for immediate login.
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setLoginStep(2)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-[#111827] cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Change Role</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginStep(1);
                    setSelectedOrg(null);
                    setSelectedRole(null);
                  }}
                  className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
                >
                  Change Organization
                </button>
              </div>
            </aside>
          </div>
        )}
      </main>

      <footer
        role="contentinfo"
        className="bg-white border-t border-slate-200 px-6 py-4 text-xs text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-2"
      >
        <span>ShiftSync AI — Workforce &amp; Campus Transparency Platform</span>
        <span>Organization Selection → Role Selection → Login → Dashboard</span>
      </footer>
    </div>
  );
}
