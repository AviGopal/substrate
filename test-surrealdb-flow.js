const { Surreal } = require('surrealdb');

async function testSurrealDBFlow() {
  const testRunId = "k8s-backend-test-1772183335";
  const db = new Surreal();
  
  try {
    // Connect to SurrealDB
    console.log('Connecting to SurrealDB...');
    await db.connect('http://localhost:8000');
    
    // Sign in
    await db.signin({
      username: 'root',
      password: 'root',
    });
    
    // Use namespace and database
    await db.use({ namespace: 'metabob', database: 'metabob' });
    console.log('✓ Connected to SurrealDB');
    
    // Test inputs
    const inputs = {
      activityName: "test-activity-e2e-validation",
      status: "completed",
      data: "test-surreal-data-e2e"
    };
    
    console.log('\n=== Creating test record ===');
    console.log('Inputs:', JSON.stringify(inputs, null, 2));
    
    // Use query instead of create for more control
    const recordId = testRunId.replace(/-/g, '_');
    const createQuery = `
      CREATE test_activity:⟨${recordId}⟩ SET
        testRunId = "${testRunId}",
        activityName = "${inputs.activityName}",
        status = "${inputs.status}",
        input = "${inputs.data}",
        timestamp = time::now()
    `;
    
    console.log('Create query:', createQuery);
    const createResult = await db.query(createQuery);
    const createdRecord = createResult[0]?.[0] || createResult[0];
    
    console.log('✓ Record created');
    console.log('Create result:', JSON.stringify(createdRecord, null, 2));
    
    // Query the record back
    console.log('\n=== Querying record back ===');
    const queryResult = await db.query(`SELECT * FROM test_activity:⟨${recordId}⟩`);
    const record = queryResult[0]?.[0] || queryResult[0];
    console.log('Retrieved data:', JSON.stringify(record, null, 2));
    
    const outputs = {
      activityName: record.activityName,
      status: record.status,
      data: record.input
    };
    
    // Validate data dependencies
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
    
    console.log('\n=== Data Dependency Validation ===');
    dataDependencies.forEach(dep => {
      const status = dep.match ? '✓' : '✗';
      console.log(`${status} ${dep.field}: "${dep.expected}" === "${dep.actual}"`);
    });
    
    // Test data transformation
    console.log('\n=== Testing Data Transformation ===');
    const updateQuery = `
      UPDATE test_activity:⟨${recordId}⟩ SET
        status = "completed",
        result = "transformation of: " + input
      RETURN AFTER
    `;
    
    const updateResult = await db.query(updateQuery);
    const transformedRecord = updateResult[0]?.[0] || updateResult[0];
    console.log('Transformed record:', JSON.stringify(transformedRecord, null, 2));
    
    const expectedTransformation = `transformation of: ${inputs.data}`;
    const transformationValid = transformedRecord.result === expectedTransformation;
    console.log(`Transformation validation: ${transformationValid ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`Expected: "${expectedTransformation}"`);
    console.log(`Actual: "${transformedRecord.result}"`);
    
    // Build final result
    const result = {
      testRunId: testRunId,
      testName: "surrealdb-data-flow",
      inputs: inputs,
      outputs: outputs,
      dataDependencies: dataDependencies.map(dep => ({
        field: dep.field,
        match: dep.match
      })),
      dataTransformation: {
        applied: true,
        valid: transformationValid,
        input: inputs.data,
        result: transformedRecord.result
      },
      status: allMatch && transformationValid ? "PASS" : "FAIL",
      surrealdbTestImpulseId: `surrealdb-test-${testRunId}`
    };
    
    console.log('\n=== Final Test Result ===');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.status === "PASS") {
      console.log('\n✓ SurrealDB data flow test PASSED');
    } else {
      console.log('\n✗ SurrealDB data flow test FAILED');
    }
    
    // Cleanup
    await db.query(`DELETE test_activity:⟨${recordId}⟩`);
    console.log(`\n✓ Test record cleaned up: test_activity:⟨${recordId}⟩`);
    
    await db.close();
    return result;
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.stack) console.error(error.stack);
    try { await db.close(); } catch {}
    throw error;
  }
}

testSurrealDBFlow().catch(console.error);
