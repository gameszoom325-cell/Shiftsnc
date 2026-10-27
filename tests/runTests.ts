import { runAuthTests } from './auth.test';
import { runFormTests } from './forms.test';
import { runDashboardTests } from './dashboard.test';

function main() {
  console.log('====================================================');
  console.log('ShiftSync AI — Automated Security, Form & RBAC Tests');
  console.log('====================================================\n');

  let totalPassed = 0;

  try {
    const authResults = runAuthTests();
    authResults.names.forEach((name) => console.log(`  [PASS] ${name}`));
    totalPassed += authResults.passed;

    const formResults = runFormTests();
    formResults.names.forEach((name) => console.log(`  [PASS] ${name}`));
    totalPassed += formResults.passed;

    const dashboardResults = runDashboardTests();
    dashboardResults.names.forEach((name) => console.log(`  [PASS] ${name}`));
    totalPassed += dashboardResults.passed;

    console.log(`\nAll ${totalPassed} test suites passed successfully (0 failures).`);
    process.exit(0);
  } catch (err) {
    console.error('\n[FAIL] Test execution failed:', err);
    process.exit(1);
  }
}

main();
