#!/usr/bin/env node

// Test the activity tool with jiggle-documentation

const { McpClient } = require('@devbob/acp');

async function testJiggleActivity() {
  const client = new McpClient({
    transport: {
      type: 'stdio',
      command: 'node',
      args: ['/home/avi/documents/work/exp-repo/metabob-devbob/metabob-opencode/dist/mcp/server.js']
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to MCP server');

    // Step 1: Search for jiggle activity
    console.log('\n🔍 Searching for jiggle-documentation activity...');
    const searchResult = await client.callTool('search_activities', {
      category: 'refactor',
      limit: 10
    });
    console.log('Search result:', JSON.stringify(searchResult, null, 2));

    // Step 2: Get the activity details
    const activities = searchResult.content?.[0]?.text ? JSON.parse(searchResult.content[0].text) : null;
    if (!activities || activities.length === 0) {
      console.log('❌ No activities found in search results');
      return;
    }

    const jiggleActivity = activities.find(a => a.name?.toLowerCase().includes('jiggle') || a.id?.toLowerCase().includes('jiggle'));
    if (!jiggleActivity) {
      console.log('❌ Jiggle activity not found in results');
      console.log('Available activities:', activities.map(a => a.name || a.id).join(', '));
      return;
    }

    console.log('\n✅ Found jiggle activity:', jiggleActivity.id || jiggleActivity.name);

    // Step 3: Start activity execution
    console.log('\n🚀 Starting jiggle-documentation activity in dry-run mode...');
    const startResult = await client.callTool('start_activity_execution', {
      activity_id: jiggleActivity.id,
      variables: {
        scope: 'entire repo',
        mode: 'dryRun',
        recentDays: 30,
        mediumDays: 90,
        obsoleteDays: 180,
        archiveInsteadOfDelete: true
      },
      reason: 'Testing jiggle activity execution system'
    });

    console.log('\n📋 Execution started:', JSON.stringify(startResult, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.close();
  }
}

testJiggleActivity();
