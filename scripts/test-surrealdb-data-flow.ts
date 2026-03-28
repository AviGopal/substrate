#!/usr/bin/env bun
import { Surreal } from 'surrealdb';

const TEST_RUN_ID = "k8s-local-validation-20260226";

async function testSurrealDBDataFlow() {
  console.log("Starting SurrealDB data flow test...\n");
  
  const db = new Surreal();
  
  try {
    // Connect and authenticate
    await db.connect('http://localhost:8000/rpc');
    await db.signin({ username: 'root', password: 'root' });
    await db.use({ namespace: 'metabob', database: 'metabob' });
    console.log("✓ Connected and authenticated\n");
    
    // Define test inputs
    const inputs = {
      activityName: "k8s-validation-activity",
      status: "completed",
      data: "k8s-test-data"
    };
    
    console.log("Test Inputs:");
    console.log(JSON.stringify(inputs, null, 2));
    console.log();
    
    // Create test record using query
    const createQuery = `
      CREATE test_activity SET
        testRunId = $testRunId,
        activityName = $activityName,
        status = $status,
        input = $data,
        timestamp = time::now();
    `;
    
    const createResult = await db.query(createQuery, {
      testRunId: TEST_RUN_ID,
      activityName: inputs.activityName,
      status: inputs.status,
      data: inputs.data
    });
    
    const createdRecord = createResult[0];
    console.log(`✓ Created test record\n`);
    console.log("Created Record:");
    console.log(JSON.stringify(createdRecord, null, 2));
    console.log();
    
    // Query the record back
    const selectQuery = `SELECT * FROM test_activity WHERE testRunId = $testRunId;`;
    const selectResult = await db.query(selectQuery, { testRunId: TEST_RUN_ID });
    const record = selectResult[0][0];
    
    console.log("Retrieved Record:");
    console.log(JSON.stringify(record, null, 2));
    console.log();
    
    // Extract outputs
    const outputs = {
      activityName: record.activityName,
      status: record.status,
      data: record.input
    };
    
    console.log("Test Outputs:");
    console.log(JSON.stringify(outputs, null, 2));
    console.log();
    
    // Validate input-output dependencies
    const dataDependencies = [
      {
        field: "activityName",
        expected: inputs.activityName,
        actual: outputs.activityName,
        match: inputs.activityName === outputs.activityName
      },
      {
        field: "status",
        expected: inputs.status,
        actual: outputs.status,
        match: inputs.status === outputs.status
      },
      {
        field: "data",
        expected: inputs.data,
        actual: outputs.data,
        match: inputs.data === outputs.data
      }
    ];
    
    const allMatch = dataDependencies.every(dep => dep.match);
    
    console.log("=== Data Dependency Validation ===");
    dataDependencies.forEach(dep => {
      const icon = dep.match ? "✅" : "❌";
      console.log(`${icon} ${dep.field}: ${dep.expected} === ${dep.actual}`);
    });
    console.log();
    
    // Test data transformation
    console.log("Testing data transformation...");
    const expectedResult = `transformation of: ${inputs.data}`;
    
    const updateQuery = `
      UPDATE test_activity 
      SET result = "transformation of: " + input
      WHERE testRunId = $testRunId;
    `;
    
    await db.query(updateQuery, { testRunId: TEST_RUN_ID });
    console.log("✓ Applied transformation\n");
    
    // Query transformed record
    const transformedResult = await db.query(selectQuery, { testRunId: TEST_RUN_ID });
    const transformedRecord = transformedResult[0][0];
    
    console.log("Transformed Record:");
    console.log(JSON.stringify(transformedRecord, null, 2));
    console.log();
    
    // Verify transformation
    const actualResult = transformedRecord.result;
    const transformationMatch = expectedResult === actualResult;
    
    console.log("=== Transformation Validation ===");
    console.log(`Expected: ${expectedResult}`);
    console.log(`Actual: ${actualResult}`);
    console.log(`Match: ${transformationMatch ? "✅ PASS" : "❌ FAIL"}\n`);
    
    // Final result
    const finalStatus = allMatch && transformationMatch ? "PASS" : "FAIL";
    
    const result = {
      testRunId: TEST_RUN_ID,
      testName: "surrealdb-data-flow",
      inputs: inputs,
      outputs: outputs,
      dataDependencies: dataDependencies.map(dep => ({
        field: dep.field,
        match: dep.match
      })),
      transformation: {
        input: inputs.data,
        expectedOutput: expectedResult,
        actualOutput: actualResult,
        match: transformationMatch
      },
      status: finalStatus,
      surrealdbTestImpulseId: `surrealdb-test-${TEST_RUN_ID}`,
      details: {
        table: "test_activity",
        namespace: "metabob",
        database: "metabob",
        recordId: record.id,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log("\n=== Final Test Results ===");
    console.log(JSON.stringify(result, null, 2));
    
    if (finalStatus === "FAIL") {
      console.error("\n❌ TEST FAILED");
    } else {
      console.log("\n✅ TEST PASSED: All data dependencies verified");
    }
    
    // Cleanup
    const deleteQuery = `DELETE test_activity WHERE testRunId = $testRunId;`;
    await db.query(deleteQuery, { testRunId: TEST_RUN_ID });
    console.log(`\n✓ Cleaned up test records`);
    
    await db.close();
    console.log("✓ Disconnected from SurrealDB\n");
    
    return result;
    
  } catch (error) {
    console.error("Error during SurrealDB test:", error);
    try {
      await db.close();
    } catch {}
    throw error;
  }
}

// Run the test
const result = await testSurrealDBDataFlow();

// Save result to file
await Bun.write("surrealdb-test-results.json", JSON.stringify(result, null, 2));
console.log("✓ Test results saved to surrealdb-test-results.json");
