import { DemoUser, OrganizationType, RoleId } from '../types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedValue?: string;
}

/**
 * Sanitizes user input to prevent XSS, HTML injection, and script execution.
 */
export function sanitizeInput(input: string, maxLength = 500): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Validates username or user identifier (username, badge ID, or email).
 */
export function validateIdentifier(identifier: string): ValidationResult {
  const clean = sanitizeInput(identifier, 120);
  if (!clean) {
    return { valid: false, error: 'Username or ID is required.' };
  }
  if (clean.length < 3) {
    return { valid: false, error: 'Username or ID must be at least 3 characters.' };
  }
  if (!/^[a-zA-Z0-9._@-]+$/.test(clean)) {
    return {
      valid: false,
      error: 'Username or ID contains invalid characters. Use only letters, numbers, @, ., _, or -.',
    };
  }
  return { valid: true, sanitizedValue: clean };
}

/**
 * Validates password format and minimum length.
 */
export function validatePassword(password: string): ValidationResult {
  if (typeof password !== 'string' || !password.trim()) {
    return { valid: false, error: 'Password is required.' };
  }
  const clean = password.trim();
  if (clean.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters long.' };
  }
  if (clean.length > 128) {
    return { valid: false, error: 'Password cannot exceed 128 characters.' };
  }
  return { valid: true, sanitizedValue: clean };
}

/**
 * Validates Worker ID (e.g., W001) or Student ID (e.g., CSE101).
 */
export function validateBadgeId(badgeId: string, type: 'worker' | 'student'): ValidationResult {
  const clean = sanitizeInput(badgeId, 32).toUpperCase();
  if (!clean) {
    return {
      valid: false,
      error: `${type === 'worker' ? 'Worker ID' : 'Student ID'} is required.`,
    };
  }
  if (!/^[A-Z0-9-]+$/.test(clean) || clean.length < 2 || clean.length > 20) {
    return {
      valid: false,
      error: `Invalid ${
        type === 'worker' ? 'Worker ID (e.g., W001)' : 'Student ID (e.g., CSE101)'
      }. Use 2–20 alphanumeric characters.`,
    };
  }
  return { valid: true, sanitizedValue: clean };
}

/**
 * Validates user creation form fields and prevents duplicate usernames or badge IDs.
 */
export function validateUserProvisioning(
  input: {
    name: string;
    badgeId: string;
    username: string;
    password: string;
    department: string;
  },
  existingUsers: DemoUser[],
  editingUserId: string | null = null,
  type: 'worker' | 'student' = 'worker'
): ValidationResult {
  const cleanName = sanitizeInput(input.name, 80);
  if (!cleanName || cleanName.length < 2) {
    return { valid: false, error: 'Full name must be at least 2 characters.' };
  }

  const badgeCheck = validateBadgeId(input.badgeId, type);
  if (!badgeCheck.valid) {
    return badgeCheck;
  }

  const usernameCheck = validateIdentifier(input.username);
  if (!usernameCheck.valid) {
    return usernameCheck;
  }

  const passwordCheck = validatePassword(input.password);
  if (!passwordCheck.valid) {
    return passwordCheck;
  }

  const cleanDept = sanitizeInput(input.department, 120);
  if (!cleanDept) {
    return { valid: false, error: 'Department or sector is required.' };
  }

  // Check for duplicate badgeId or username
  const duplicate = existingUsers.find(
    (u) =>
      u.id !== editingUserId &&
      (u.badgeId.toLowerCase() === badgeCheck.sanitizedValue!.toLowerCase() ||
        u.username.toLowerCase() === usernameCheck.sanitizedValue!.toLowerCase())
  );

  if (duplicate) {
    return {
      valid: false,
      error: `Duplicate account detected: ${
        duplicate.badgeId.toLowerCase() === badgeCheck.sanitizedValue!.toLowerCase()
          ? `ID "${badgeCheck.sanitizedValue}"`
          : `Username "${usernameCheck.sanitizedValue}"`
      } is already assigned to ${duplicate.name}.`,
    };
  }

  return { valid: true };
}

/**
 * Validates safety complaint or campus grievance submissions.
 */
export function validateComplaintForm(input: {
  title: string;
  location: string;
  description: string;
}): ValidationResult {
  const cleanTitle = sanitizeInput(input.title, 150);
  const cleanLocation = sanitizeInput(input.location, 120);
  const cleanDesc = sanitizeInput(input.description, 1500);

  if (!cleanTitle || cleanTitle.length < 4) {
    return { valid: false, error: 'Title must be at least 4 characters.' };
  }
  if (!cleanLocation || cleanLocation.length < 2) {
    return { valid: false, error: 'Location is required.' };
  }
  if (!cleanDesc || cleanDesc.length < 6) {
    return { valid: false, error: 'Description must be at least 6 characters.' };
  }
  return { valid: true };
}

/**
 * Validates skill passport certificate submissions.
 */
export function validateSkillForm(input: {
  title: string;
  issuer: string;
  experienceHours: number;
}): ValidationResult {
  const cleanTitle = sanitizeInput(input.title, 150);
  const cleanIssuer = sanitizeInput(input.issuer, 120);

  if (!cleanTitle || cleanTitle.length < 3) {
    return { valid: false, error: 'Certificate or skill title is required.' };
  }
  if (!cleanIssuer || cleanIssuer.length < 2) {
    return { valid: false, error: 'Issuing organization is required.' };
  }
  if (
    typeof input.experienceHours !== 'number' ||
    Number.isNaN(input.experienceHours) ||
    input.experienceHours < 1 ||
    input.experienceHours > 10000
  ) {
    return { valid: false, error: 'Experience hours must be between 1 and 10,000.' };
  }
  return { valid: true };
}

/**
 * Role-Based Access Control (RBAC) URL & Portal Route Enforcer.
 * Maps each role to its sole permitted route path and blocks unauthorized URL changes.
 */
export const ROLE_ROUTES: Record<RoleId, string> = {
  construction_worker: '/portal/construction-worker',
  construction_admin: '/portal/construction-admin',
  college_student: '/portal/college-student',
  college_admin: '/portal/college-admin',
};

export function canAccessRolePortal(
  user: DemoUser | null,
  targetRole: RoleId
): { allowed: boolean; reason?: string } {
  if (!user) {
    return { allowed: false, reason: 'Authentication required. Please sign in first.' };
  }
  if (user.role !== targetRole) {
    return {
      allowed: false,
      reason: `Unauthorized access blocked: Role "${user.roleLabel}" cannot access the "${targetRole}" portal.`,
    };
  }
  const expectedOrg: OrganizationType =
    targetRole === 'college_admin' || targetRole === 'college_student'
      ? 'college'
      : 'construction';
  if (user.organization !== expectedOrg) {
    return {
      allowed: false,
      reason: `Organization mismatch: User belongs to "${user.organization}", not "${expectedOrg}".`,
    };
  }
  return { allowed: true };
}

export function resolveRoleFromPath(pathname: string): RoleId | null {
  const normalized = pathname.replace(/\/+$/, '').toLowerCase();
  for (const [role, route] of Object.entries(ROLE_ROUTES)) {
    if (normalized === route) {
      return role as RoleId;
    }
  }
  return null;
}
