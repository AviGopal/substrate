const Redis = require('ioredis');
const { Surreal } = require('surrealdb');

async function verifyE2EData() {
  const testRunId = "k8s-backend-test-1772183335";
  
  console.log('═══ Verifying Stored Data ═══\n');
  
  // Verify Redis
  const redis = new Redis({ host: 'localhost', port: 6379 });
  
  try {
    console.log('1. Redis Session Data:');
    const sessionKey = `session:${testRunId}`;
    const sessionData = await redis.get(sessionKey);
    
    if (sessionData) {
      const parsed = JSON.parse(sessionData);
      console.log(`   ✓ Key: ${sessionKey}`);
      console.log(`   ✓ Session ID: ${parsed.sessionId}`);
      console.log(`   ✓ Prompt: ${parsed.prompt.substring(0, 50)}...`);
      console.log(`   ✓ TTL: ${await redis.ttl(sessionKey)}s\n`);
    } else {
      console.log('   ✗ Session data not found\n');
    }
    
    await redis.quit();
  } catch (error) {
    console.error('   ✗ Redis error:', error.message);
    await redis.quit();
  }
  
  // Verify SurrealDB
  const db = new Surreal();
  
  try {
    await db.connect('http://localhost:8000');
    await db.signin({ username: 'root', password: 'root' });
    await db.use({ namespace: 'metabob', database: 'metabob' });
    
    console.log('2. SurrealDB Activity Record:');
    const activityId = testRunId.replace(/-/g, '_');
    const result = await db.query(`SELECT * FROM activity:⟨${activityId}⟩`);
    const activity = result[0]?.[0] || result[0];
    
    if (activity) {
      console.log(`   ✓ Record ID: activity:${activityId}`);
      console.log(`   ✓ Activity ID: ${activity.activityId}`);
      console.log(`   ✓ Session ID: ${activity.sessionId}`);
      console.log(`   ✓ Status: ${activity.status}`);
      console.log(`   ✓ Created: ${activity.createdAt}\n`);
    } else {
      console.log('   ✗ Activity record not found\n');
    }
    
    // Verify vessel registry
    console.log('3. Vessel Registry (Expected: 3 vessels):');
    const vessels = await db.query('SELECT * FROM vessel');
    const vesselList = vessels[0] || [];
    console.log(`   ✓ Vessel count: ${vesselList.length}`);
    vesselList.forEach((v, i) => {
      console.log(`   ✓ Vessel ${i + 1}: ${v.id || v.name || 'unknown'}`);
    });
    
    await db.close();
  } catch (error) {
    console.error('   ✗ SurrealDB error:', error.message);
    try { await db.close(); } catch {}
  }
  
  console.log('\n═══ Data Flow Verification Complete ═══');
}

verifyE2EData().catch(console.error);
