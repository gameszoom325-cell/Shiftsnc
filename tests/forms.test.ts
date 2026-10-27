import assert from 'node:assert/strict';
import {
  sanitizeInput,
  validateBadgeId,
  validateComplaintForm,
  validateIdentifier,
  validatePassword,
  validateSkillForm,
  validateUserProvisioning,
} from '../src/security/validation';
import { DemoUser } from '../src/types';

export function runFormTests(): { passed: number; names: string[] } {
  const names: string[] = [];

  // Test 1: Empty fields rejection
  {
    assert.equal(validateIdentifier('   ').valid, false, 'Empty identifier must fail');
    assert.equal(validatePassword('').valid, false, 'Empty password must fail');
    assert.equal(validateBadgeId('', 'worker').valid, false, 'Empty worker ID must fail');
    assert.equal(
      validateComplaintForm({ title: '', location: 'Sector B', description: 'Valid details' }).valid,
      false,
      'Empty hazard title must fail'
    );
    assert.equal(
      validateSkillForm({ title: '', issuer: 'OSHA', experienceHours: 40 }).valid,
      false,
      'Empty skill title must fail'
    );
    names.push('Forms: Empty fields validation');
  }

  // Test 2: Invalid input & XSS injection sanitization
  {
    const malicious = `<script>alert("xss")</script><b>Ravi</b> javascript:evil() onload=hack()`;
    const sanitized = sanitizeInput(malicious);
    assert.equal(sanitized.includes('<script>'), false, 'Script tags must be stripped');
    assert.equal(sanitized.includes('<b>'), false, 'HTML tags must be stripped');
    assert.equal(sanitized.includes('javascript:'), false, 'javascript: protocol must be stripped');
    assert.equal(sanitized.includes('onload='), false, 'Inline event handlers must be stripped');

    const badIdentifier = validateIdentifier('ravi; DROP TABLE users;--');
    assert.equal(badIdentifier.valid, false, 'SQL injection characters in username must be rejected');

    const shortPass = validatePassword('123');
    assert.equal(shortPass.valid, false, 'Passwords shorter than 6 chars must be rejected');

    const invalidHours = validateSkillForm({
      title: 'AWS Welding',
      issuer: 'AWS',
      experienceHours: -15,
    });
    assert.equal(invalidHours.valid, false, 'Negative experience hours must be rejected');
    names.push('Forms: Invalid input & XSS/injection sanitization');
  }

  // Test 3: Duplicate user creation prevention
  {
    const existingWorkers: DemoUser[] = [
      {
        id: 'usr_w1',
        name: 'Ravi',
        badgeId: 'W001',
        username: 'ravi001',
        email: 'ravi001@shiftsync.ai',
        organization: 'construction',
        role: 'construction_worker',
        roleLabel: 'Construction Worker',
        department: 'Structural Steel',
      },
    ];

    const duplicateBadge = validateUserProvisioning(
      {
        name: 'Another Worker',
        badgeId: 'w001',
        username: 'newworker02',
        password: 'demo123',
        department: 'Structural Steel',
      },
      existingWorkers,
      null,
      'worker'
    );
    assert.equal(duplicateBadge.valid, false, 'Duplicate Worker ID must be blocked');
    assert.ok(duplicateBadge.error?.includes('Duplicate account detected'));

    const duplicateUsername = validateUserProvisioning(
      {
        name: 'Another Worker',
        badgeId: 'W009',
        username: 'RAVI001',
        password: 'demo123',
        department: 'Structural Steel',
      },
      existingWorkers,
      null,
      'worker'
    );
    assert.equal(duplicateUsername.valid, false, 'Duplicate username must be blocked');

    const uniqueValid = validateUserProvisioning(
      {
        name: 'Kiran Kumar',
        badgeId: 'W002',
        username: 'kiran002',
        password: 'demo123',
        department: 'Electrical Conduit',
      },
      existingWorkers,
      null,
      'worker'
    );
    assert.equal(uniqueValid.valid, true, 'Unique valid worker should pass validation');
    names.push('Forms: Duplicate user creation blocked');
  }

  return { passed: names.length, names };
}
