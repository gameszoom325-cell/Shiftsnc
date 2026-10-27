import assert from 'node:assert/strict';
import {
  authenticateUserRequest,
  createSession,
  isSessionValid,
} from '../src/security/authEngine';
import {
  canAccessRolePortal,
  resolveRoleFromPath,
} from '../src/security/validation';
import { DEMO_USERS } from '../src/data/demoData';

export function runAuthTests(): { passed: number; names: string[] } {
  const names: string[] = [];

  // Test 1: Valid College Admin login
  {
    const res = authenticateUserRequest({
      role: 'college_admin',
      identifier: 'collegeadmin',
      password: 'admin123',
    });
    assert.equal(res.success, true, 'College Admin should authenticate with valid credentials');
    assert.ok(res.session?.token.startsWith('ss_tok_college_admin_'));
    assert.equal(res.session?.user.role, 'college_admin');
    assert.equal(
      'password' in (res.session?.user || {}),
      false,
      'Session user payload must strip plaintext password'
    );
    names.push('Auth: Valid College Admin login & password stripping');
  }

  // Test 2: Valid Construction Admin login
  {
    const res = authenticateUserRequest({
      role: 'construction_admin',
      identifier: 'siteadmin',
      password: 'admin123',
    });
    assert.equal(res.success, true, 'Construction Admin should authenticate with valid credentials');
    assert.equal(res.session?.user.role, 'construction_admin');
    names.push('Auth: Valid Construction Admin login');
  }

  // Test 3: Invalid password rejection
  {
    const res = authenticateUserRequest({
      role: 'college_admin',
      identifier: 'collegeadmin',
      password: 'wrongPassword999',
    });
    assert.equal(res.success, false, 'Invalid password must be rejected');
    assert.equal(res.session, undefined);
    assert.ok(res.error?.includes('Invalid College Admin credentials'));
    names.push('Auth: Invalid password rejection');
  }

  // Test 4: Unauthorized role access & URL route guard
  {
    const workerUser = DEMO_USERS.construction_worker;
    const workerCheck = canAccessRolePortal(workerUser, 'construction_worker');
    assert.equal(workerCheck.allowed, true, 'Worker can access construction_worker portal');

    const unauthorizedAdminCheck = canAccessRolePortal(workerUser, 'construction_admin');
    assert.equal(
      unauthorizedAdminCheck.allowed,
      false,
      'Worker must be blocked from accessing construction_admin portal'
    );

    const unauthorizedCollegeCheck = canAccessRolePortal(workerUser, 'college_student');
    assert.equal(
      unauthorizedCollegeCheck.allowed,
      false,
      'Worker must be blocked from accessing college_student portal'
    );

    const unauthenticatedCheck = canAccessRolePortal(null, 'college_admin');
    assert.equal(unauthenticatedCheck.allowed, false, 'Unauthenticated user must be blocked');

    assert.equal(resolveRoleFromPath('/portal/college-admin'), 'college_admin');
    assert.equal(resolveRoleFromPath('/portal/construction-worker/'), 'construction_worker');
    assert.equal(resolveRoleFromPath('/unknown-route'), null);
    names.push('Auth: Unauthorized role & manual URL access blocked (RBAC)');
  }

  // Test 5: Session lifecycle & expiration handling
  {
    const session = createSession(DEMO_USERS.college_admin);
    assert.equal(isSessionValid(session), true, 'Newly created session should be valid');

    const expiredSession = {
      ...session,
      expiresAt: Date.now() - 1000,
    };
    assert.equal(isSessionValid(expiredSession), false, 'Expired session must be rejected');
    assert.equal(isSessionValid(null), false, 'Null session must be rejected');
    names.push('Auth: Session token validation & expiration enforcement');
  }

  return { passed: names.length, names };
}
