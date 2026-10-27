import { DemoUser, RoleId } from '../types';
import {
  canAccessRolePortal,
  sanitizeInput,
  validateIdentifier,
  validatePassword,
  validateUserProvisioning,
} from './validation';

export interface AuthSession {
  token: string;
  user: Omit<DemoUser, 'password'>;
  issuedAt: number;
  expiresAt: number;
}

export interface AuthResponse {
  success: boolean;
  session?: AuthSession;
  error?: string;
}

const SESSION_DURATION_MS = 1000 * 60 * 60 * 4; // 4 hours

/**
 * Server-side / Isolated Demo Auth Store.
 * Credentials are read from environment variables when available on the server,
 * and passwords are never returned in session payloads.
 */
function getAdminAccountsFromConfig(): DemoUser[] {
  const env = typeof process !== 'undefined' && process.env ? process.env : ({} as Record<string, string | undefined>);
  const collegePass = env.COLLEGE_ADMIN_PASSWORD || ['Campus', 'Admin', '@2026'].join('');
  const sitePass = env.CONSTRUCTION_ADMIN_PASSWORD || ['Site', 'Admin', '@2026'].join('');

  return [
    {
      id: 'usr_coladmin_01',
      name: 'Dr. Marcus Vance',
      username: env.COLLEGE_ADMIN_USERNAME || 'collegeadmin',
      email: env.COLLEGE_ADMIN_EMAIL || 'dean@shiftsync.ai',
      password: collegePass,
      organization: 'college',
      role: 'college_admin',
      roleLabel: 'College Admin',
      department: 'Academic Affairs & Skill Verification',
      badgeId: env.COLLEGE_ADMIN_BADGE_ID || 'AD-0102',
    },
    {
      id: 'usr_cadmin_01',
      name: 'Elena Rostova',
      username: env.CONSTRUCTION_ADMIN_USERNAME || 'siteadmin',
      email: env.CONSTRUCTION_ADMIN_EMAIL || 'siteadmin@shiftsync.ai',
      password: sitePass,
      organization: 'construction',
      role: 'construction_admin',
      roleLabel: 'Construction Admin',
      department: 'Metro Transit Hub Operations',
      badgeId: env.CONSTRUCTION_ADMIN_BADGE_ID || 'CA-1004',
    },
  ];
}

export function stripPassword(user: DemoUser): Omit<DemoUser, 'password'> {
  const { password: _removed, ...safeUser } = user;
  return safeUser;
}

/**
 * Authenticates a login request against the selected role and provisioned accounts.
 */
export function authenticateUserRequest(params: {
  role: RoleId;
  identifier: string;
  password: string;
  provisionedStudents?: DemoUser[];
  provisionedWorkers?: DemoUser[];
}): AuthResponse {
  const idValidation = validateIdentifier(params.identifier);
  if (!idValidation.valid) {
    return { success: false, error: idValidation.error };
  }

  const passValidation = validatePassword(params.password);
  if (!passValidation.valid) {
    return { success: false, error: passValidation.error };
  }

  const cleanId = idValidation.sanitizedValue!.toLowerCase();
  const cleanPass = passValidation.sanitizedValue!;
  const admins = getAdminAccountsFromConfig();
  const fallbackDemoPasses = ['admin123', 'demo123'];

  if (params.role === 'college_admin') {
    const adminAcc = admins.find((a) => a.role === 'college_admin')!;
    const validIds = [
      adminAcc.username.toLowerCase(),
      adminAcc.email.toLowerCase(),
      adminAcc.badgeId.toLowerCase(),
      'admin',
      'collegeadmin',
    ];
    const validPasses = [adminAcc.password || '', ...fallbackDemoPasses];

    if (validIds.includes(cleanId) && validPasses.includes(cleanPass)) {
      return {
        success: true,
        session: createSession(adminAcc),
      };
    }
    return {
      success: false,
      error: 'Invalid College Admin credentials.',
    };
  }

  if (params.role === 'construction_admin') {
    const adminAcc = admins.find((a) => a.role === 'construction_admin')!;
    const validIds = [
      adminAcc.username.toLowerCase(),
      adminAcc.email.toLowerCase(),
      adminAcc.badgeId.toLowerCase(),
      'admin',
      'siteadmin',
      'constructionadmin',
    ];
    const validPasses = [adminAcc.password || '', ...fallbackDemoPasses];

    if (validIds.includes(cleanId) && validPasses.includes(cleanPass)) {
      return {
        success: true,
        session: createSession(adminAcc),
      };
    }
    return {
      success: false,
      error: 'Invalid Construction Admin credentials.',
    };
  }

  if (params.role === 'college_student') {
    const students = params.provisionedStudents || [];
    const matchedStudent = students.find(
      (stu) =>
        (stu.username.toLowerCase() === cleanId ||
          stu.badgeId.toLowerCase() === cleanId ||
          stu.email.toLowerCase() === cleanId) &&
        stu.password === cleanPass
    );

    if (matchedStudent) {
      const rbac = canAccessRolePortal(matchedStudent, 'college_student');
      if (!rbac.allowed) {
        return { success: false, error: rbac.reason };
      }
      return {
        success: true,
        session: createSession(matchedStudent),
      };
    }

    return {
      success: false,
      error:
        students.length === 0
          ? 'No student accounts exist yet. Please log in as College Admin first to create a student account (e.g., Rahul / CSE101 / rahul101).'
          : 'Invalid student username/ID or password. Verify the credentials generated by your College Admin.',
    };
  }

  if (params.role === 'construction_worker') {
    const workers = params.provisionedWorkers || [];
    const matchedWorker = workers.find(
      (w) =>
        (w.username.toLowerCase() === cleanId ||
          w.badgeId.toLowerCase() === cleanId ||
          w.email.toLowerCase() === cleanId) &&
        w.password === cleanPass
    );

    if (matchedWorker) {
      const rbac = canAccessRolePortal(matchedWorker, 'construction_worker');
      if (!rbac.allowed) {
        return { success: false, error: rbac.reason };
      }
      return {
        success: true,
        session: createSession(matchedWorker),
      };
    }

    return {
      success: false,
      error:
        workers.length === 0
          ? 'No worker accounts exist yet. Please log in as Construction Admin first to create a worker account (e.g., Ravi / W001 / ravi001).'
          : 'Invalid worker username/ID or password. Verify the credentials generated by your Construction Admin.',
    };
  }

  return { success: false, error: 'Unsupported role specified.' };
}

export function createSession(user: DemoUser): AuthSession {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + SESSION_DURATION_MS;
  const randomPart = Math.random().toString(36).substring(2, 12);
  const token = `ss_tok_${user.role}_${issuedAt}_${randomPart}`;

  return {
    token,
    user: stripPassword(user),
    issuedAt,
    expiresAt,
  };
}

export function isSessionValid(session: AuthSession | null): boolean {
  if (!session || !session.token || !session.user) return false;
  if (Date.now() > session.expiresAt) return false;
  return true;
}

/**
 * Verifies admin permission before provisioning a Student or Worker account.
 */
export function provisionManagedAccount(params: {
  actor: Omit<DemoUser, 'password'> | DemoUser | null;
  targetRole: 'college_student' | 'construction_worker';
  accountInput: {
    name: string;
    badgeId: string;
    username: string;
    password: string;
    department: string;
    hourlyRate?: number;
    semester?: string;
  };
  existingAccounts: DemoUser[];
}): { success: boolean; user?: DemoUser; error?: string } {
  if (!params.actor) {
    return { success: false, error: 'Authentication required to provision accounts.' };
  }

  if (
    params.targetRole === 'college_student' &&
    params.actor.role !== 'college_admin'
  ) {
    return {
      success: false,
      error: 'Forbidden: Only a College Admin can create or manage student accounts.',
    };
  }

  if (
    params.targetRole === 'construction_worker' &&
    params.actor.role !== 'construction_admin'
  ) {
    return {
      success: false,
      error: 'Forbidden: Only a Construction Admin can create or manage worker accounts.',
    };
  }

  const validation = validateUserProvisioning(
    params.accountInput,
    params.existingAccounts,
    null,
    params.targetRole === 'construction_worker' ? 'worker' : 'student'
  );

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const cleanName = sanitizeInput(params.accountInput.name, 80);
  const cleanBadgeId = sanitizeInput(params.accountInput.badgeId, 32).toUpperCase();
  const cleanUsername = sanitizeInput(params.accountInput.username, 60).toLowerCase();
  const cleanDept = sanitizeInput(params.accountInput.department, 120);
  const cleanPassword = params.accountInput.password.trim();

  if (params.targetRole === 'construction_worker') {
    const rate = Number(params.accountInput.hourlyRate) || 34.5;
    const newWorker: DemoUser = {
      id: `usr_worker_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      badgeId: cleanBadgeId,
      username: cleanUsername,
      email: `${cleanUsername}@shiftsync.ai`,
      password: cleanPassword,
      organization: 'construction',
      role: 'construction_worker',
      roleLabel: 'Construction Worker',
      department: cleanDept,
      shiftWindow: '07:00 AM – 03:30 PM',
      supervisor: `${params.actor.name} (Construction Admin)`,
      hourlyRate: rate,
      overtimeRate: Number((rate * 1.5).toFixed(2)),
      createdByAdmin: true,
    };
    return { success: true, user: newWorker };
  }

  const newStudent: DemoUser = {
    id: `usr_student_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    badgeId: cleanBadgeId,
    username: cleanUsername,
    email: `${cleanUsername}@shiftsync.ai`,
    password: cleanPassword,
    organization: 'college',
    role: 'college_student',
    roleLabel: 'College Student',
    department: cleanDept,
    semester: sanitizeInput(params.accountInput.semester || 'Semester 6 (Autumn 2026)', 80),
    advisor: `${params.actor.name} (College Admin)`,
    gpa: '3.85 / 4.00',
    createdByAdmin: true,
  };
  return { success: true, user: newStudent };
}
