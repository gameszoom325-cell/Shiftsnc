import assert from 'node:assert/strict';
import {
  authenticateUserRequest,
  provisionManagedAccount,
} from '../src/security/authEngine';
import { canAccessRolePortal } from '../src/security/validation';
import { DEMO_USERS } from '../src/data/demoData';

export function runDashboardTests(): { passed: number; names: string[] } {
  const names: string[] = [];

  // Test 1: College Admin provisions Student account -> Student logs in & accesses Student dashboard
  {
    const collegeAdmin = DEMO_USERS.college_admin;
    const provisionRes = provisionManagedAccount({
      actor: collegeAdmin,
      targetRole: 'college_student',
      accountInput: {
        name: 'Rahul',
        badgeId: 'CSE101',
        username: 'rahul101',
        password: 'demo123',
        department: 'B.Tech Computer Science & Engineering',
        semester: 'Semester 6',
      },
      existingAccounts: [],
    });

    assert.equal(provisionRes.success, true, 'College Admin should provision student Rahul');
    assert.ok(provisionRes.user);
    assert.equal(provisionRes.user.badgeId, 'CSE101');
    assert.equal(provisionRes.user.role, 'college_student');

    // Student login test
    const studentLogin = authenticateUserRequest({
      role: 'college_student',
      identifier: 'rahul101',
      password: 'demo123',
      provisionedStudents: [provisionRes.user],
    });
    assert.equal(studentLogin.success, true, 'Provisioned student Rahul can log in immediately');
    assert.equal(
      canAccessRolePortal(provisionRes.user, 'college_student').allowed,
      true,
      'Student has access to college_student dashboard'
    );
    assert.equal(
      canAccessRolePortal(provisionRes.user, 'college_admin').allowed,
      false,
      'Student cannot access college_admin dashboard'
    );
    names.push('Dashboard: College Admin student provisioning & Student portal access');
  }

  // Test 2: Construction Admin provisions Worker account -> Worker logs in & accesses Worker dashboard
  {
    const constructionAdmin = DEMO_USERS.construction_admin;
    const provisionRes = provisionManagedAccount({
      actor: constructionAdmin,
      targetRole: 'construction_worker',
      accountInput: {
        name: 'Ravi',
        badgeId: 'W001',
        username: 'ravi001',
        password: 'demo123',
        department: 'Structural Steel — Sector B4',
        hourlyRate: 34.5,
      },
      existingAccounts: [],
    });

    assert.equal(provisionRes.success, true, 'Construction Admin should provision worker Ravi');
    assert.ok(provisionRes.user);
    assert.equal(provisionRes.user.badgeId, 'W001');
    assert.equal(provisionRes.user.overtimeRate, 51.75, '1.5x overtime rate calculated accurately');

    // Worker login test using Worker ID (W001)
    const workerLogin = authenticateUserRequest({
      role: 'construction_worker',
      identifier: 'W001',
      password: 'demo123',
      provisionedWorkers: [provisionRes.user],
    });
    assert.equal(workerLogin.success, true, 'Provisioned worker Ravi can log in with Worker ID');
    assert.equal(
      canAccessRolePortal(provisionRes.user, 'construction_worker').allowed,
      true,
      'Worker has access to construction_worker dashboard'
    );
    assert.equal(
      canAccessRolePortal(provisionRes.user, 'construction_admin').allowed,
      false,
      'Worker cannot access construction_admin dashboard'
    );
    names.push('Dashboard: Construction Admin worker provisioning & Worker portal access');
  }

  // Test 3: Admin permission boundaries (Cross-org & non-admin account creation blocked)
  {
    const workerActor = DEMO_USERS.construction_worker;
    const studentActor = DEMO_USERS.college_student;
    const collegeAdmin = DEMO_USERS.college_admin;

    const workerTryCreate = provisionManagedAccount({
      actor: workerActor,
      targetRole: 'construction_worker',
      accountInput: {
        name: 'Unauthorized Worker',
        badgeId: 'W099',
        username: 'unauth99',
        password: 'demo123',
        department: 'Sector A',
      },
      existingAccounts: [],
    });
    assert.equal(workerTryCreate.success, false, 'Workers cannot create worker accounts');

    const studentTryCreate = provisionManagedAccount({
      actor: studentActor,
      targetRole: 'college_student',
      accountInput: {
        name: 'Unauthorized Student',
        badgeId: 'CSE999',
        username: 'unauthstu',
        password: 'demo123',
        department: 'CSE',
      },
      existingAccounts: [],
    });
    assert.equal(studentTryCreate.success, false, 'Students cannot create student accounts');

    const crossOrgTry = provisionManagedAccount({
      actor: collegeAdmin,
      targetRole: 'construction_worker',
      accountInput: {
        name: 'Cross Org Worker',
        badgeId: 'W055',
        username: 'cross55',
        password: 'demo123',
        department: 'Sector B',
      },
      existingAccounts: [],
    });
    assert.equal(
      crossOrgTry.success,
      false,
      'College Admin cannot create Construction Worker accounts'
    );
    names.push('Dashboard: Strict Admin permission boundaries enforced');
  }

  return { passed: names.length, names };
}
