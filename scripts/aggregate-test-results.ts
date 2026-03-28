#!/usr/bin/env bun

const TEST_RUN_ID = "k8s-local-validation-20260226";

async function aggregateTestResults() {
  console.log("=".repeat(80));
  console.log("METABOB STACK TEST RESULTS AGGREGATION");
  console.log("=".repeat(80));
  console.log();
  
  // Load all test results
  console.log("Loading test results...\n");
  
  const deploymentResults = await Bun.file("k8s-local-validation-results.json").json();
  const redisResults = await Bun.file("redis-test-results.json").json();
  const surrealdbResults = await Bun.file("surrealdb-test-results.json").json();
  const acpResults = await Bun.file("acp-test-results.json").json();
  const e2eResults = await Bun.file("e2e-test-results.json").json();
  
  console.log("✓ Loaded 5 test result files\n");
  
  // Analyze component results
  const componentResults = {
    deployment: {
      status: deploymentResults.validationScript === "PASS" ? "PASS" : "FAIL",
      componentsReady: Object.values(deploymentResults.deploymentStatus).every(
        (c: any) => c.status === "Running"
      )
    },
    redis: {
      status: redisResults.status || "UNKNOWN",
      dataFlowVerified: redisResults.status === "PASS"
    },
    surrealdb: {
      status: surrealdbResults.status || "UNKNOWN",
      dataFlowVerified: surrealdbResults.status === "PASS"
    },
    devbob: {
      status: acpResults.echoTest?.status === "PASS" && 
              acpResults.impulseShareTest?.status === "PASS" ? "PASS" : "FAIL",
      acpVerified: acpResults.acpServerStatus?.ready === true
    },
    e2e: {
      status: e2eResults.overallStatus || "UNKNOWN",
      fullFlowVerified: e2eResults.overallStatus === "PASS"
    }
  };
  
  // Analyze data flow requirements
  const dataFlowRequirements = {
    requirement1_redisRoundTrip: redisResults.status === "PASS" ? "PASS" : "FAIL",
    requirement2_surrealdbStructure: surrealdbResults.status === "PASS" && 
                                      surrealdbResults.transformation?.match === true ? "PASS" : "FAIL",
    requirement3_acpResponse: acpResults.acpServerStatus?.ready === true ? "PASS" : "FAIL",
    requirement4_impulseSharing: acpResults.impulseShareTest?.dependencyVerified === true ? "PASS" : "FAIL",
    requirement5_e2eDependency: e2eResults.dataFlow?.stage4_validation?.inputOutputDependency === "verified" ? "PASS" : "FAIL"
  };
  
  // Count input-output dependencies
  let totalTested = 0;
  let verified = 0;
  let failed = 0;
  
  // Redis test: 1 dependency (input === output)
  totalTested += 1;
  if (redisResults.status === "PASS") verified += 1;
  else failed += 1;
  
  // SurrealDB test: 3 data dependencies + 1 transformation
  totalTested += 4;
  if (surrealdbResults.dataDependencies) {
    verified += surrealdbResults.dataDependencies.filter((d: any) => d.match).length;
    failed += surrealdbResults.dataDependencies.filter((d: any) => !d.match).length;
  }
  if (surrealdbResults.transformation?.match) verified += 1;
  else failed += 1;
  
  // ACP test: 2 tests (echo + impulse share)
  totalTested += 2;
  if (acpResults.echoTest?.inputFoundInOutput) verified += 1;
  else failed += 1;
  if (acpResults.impulseShareTest?.dependencyVerified) verified += 1;
  else failed += 1;
  
  // E2E test: 4 stages
  totalTested += 4;
  if (e2eResults.dataFlow?.stage1_redis?.status === "PASS") verified += 1;
  else failed += 1;
  if (e2eResults.dataFlow?.stage2_surrealdb?.status === "PASS") verified += 1;
  else failed += 1;
  if (e2eResults.dataFlow?.stage3_devbob?.status === "PASS") verified += 1;
  else failed += 1;
  if (e2eResults.dataFlow?.stage4_validation?.status === "PASS") verified += 1;
  else failed += 1;
  
  const verificationRate = ((verified / totalTested) * 100).toFixed(1);
  
  const inputOutputDependencies = {
    totalTested,
    verified,
    failed,
    verificationRate: `${verificationRate}%`
  };
  
  // Determine overall status
  const allComponentsPassed = Object.values(componentResults).every(
    (c: any) => c.status === "PASS"
  );
  const allRequirementsPassed = Object.values(dataFlowRequirements).every(
    (r: any) => r === "PASS"
  );
  
  const overallStatus = allComponentsPassed && allRequirementsPassed ? "PASS" : "FAIL";
  
  // Generate recommendations
  const recommendations = [];
  
  if (overallStatus === "PASS") {
    recommendations.push("✅ All components operational - proceed with production deployment");
    recommendations.push("✅ Data flow integrity verified - stack ready for activity execution");
    recommendations.push("✅ Multi-agent coordination functional - can handle complex workflows");
    recommendations.push("Consider monitoring component health and data flow metrics in production");
    recommendations.push("Set up alerts for component failures and data integrity issues");
  } else {
    if (componentResults.redis.status === "FAIL") {
      recommendations.push("❌ Fix Redis connectivity issues before proceeding");
    }
    if (componentResults.surrealdb.status === "FAIL") {
      recommendations.push("❌ Fix SurrealDB schema and query issues");
    }
    if (componentResults.devbob.status === "FAIL") {
      recommendations.push("❌ Fix DevBob ACP server initialization or connectivity");
    }
    if (componentResults.e2e.status === "FAIL") {
      recommendations.push("❌ Fix end-to-end data flow issues across components");
    }
  }
  
  // Create aggregated report
  const report = {
    testRunId: TEST_RUN_ID,
    timestamp: new Date().toISOString(),
    overallStatus,
    componentResults,
    dataFlowRequirements,
    inputOutputDependencies,
    recommendations,
    testReportImpulseId: `test-report-${TEST_RUN_ID}`,
    testSummary: {
      totalTests: 5,
      passed: Object.values(componentResults).filter((c: any) => c.status === "PASS").length,
      failed: Object.values(componentResults).filter((c: any) => c.status === "FAIL").length
    },
    detailedResults: {
      deployment: deploymentResults,
      redis: redisResults,
      surrealdb: surrealdbResults,
      acp: acpResults,
      e2e: e2eResults
    }
  };
  
  // Display results
  console.log("=".repeat(80));
  console.log("TEST RESULTS SUMMARY");
  console.log("=".repeat(80));
  console.log();
  
  console.log(`Overall Status: ${overallStatus === "PASS" ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`Test Run ID: ${TEST_RUN_ID}`);
  console.log(`Timestamp: ${report.timestamp}`);
  console.log();
  
  console.log("Component Results:");
  console.log("-".repeat(80));
  Object.entries(componentResults).forEach(([component, result]: [string, any]) => {
    const icon = result.status === "PASS" ? "✅" : "❌";
    console.log(`${icon} ${component.padEnd(15)}: ${result.status}`);
  });
  console.log();
  
  console.log("Data Flow Requirements:");
  console.log("-".repeat(80));
  Object.entries(dataFlowRequirements).forEach(([req, status]: [string, any]) => {
    const icon = status === "PASS" ? "✅" : "❌";
    const name = req.replace(/_/g, ' ').replace(/requirement\d+/, '').trim();
    console.log(`${icon} ${name.padEnd(30)}: ${status}`);
  });
  console.log();
  
  console.log("Input-Output Dependencies:");
  console.log("-".repeat(80));
  console.log(`Total Tested: ${inputOutputDependencies.totalTested}`);
  console.log(`Verified: ${inputOutputDependencies.verified}`);
  console.log(`Failed: ${inputOutputDependencies.failed}`);
  console.log(`Verification Rate: ${inputOutputDependencies.verificationRate}`);
  console.log();
  
  console.log("Recommendations:");
  console.log("-".repeat(80));
  recommendations.forEach(rec => console.log(`  ${rec}`));
  console.log();
  
  console.log("=".repeat(80));
  console.log();
  
  return report;
}

// Run aggregation
const report = await aggregateTestResults();

// Save aggregated report
await Bun.write("test-report-aggregated.json", JSON.stringify(report, null, 2));
console.log("✓ Aggregated report saved to test-report-aggregated.json");
