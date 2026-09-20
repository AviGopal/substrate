import { surrealDB } from './repos/activity-api/src/db/surreal';

async function getLeastRecentlyValidatedTemplate() {
  const query = `
    SELECT template_id, evaluated_at
    FROM promote_gate_evaluations
    WHERE decision = 'promote'
    ORDER BY evaluated_at ASC
    LIMIT 1;
  `;
  try {
    const result = await surrealDB.query(query);
    if (result && result.length > 0) {
      console.log(JSON.stringify(result[0], null, 2));
    } else {
      console.log('No promoted templates found.');
    }
  } catch (error) {
    console.error('Error querying for promoted templates:', error);
  } finally {
    await surrealDB.close();
  }
}

getLeastRecentlyValidatedTemplate();
