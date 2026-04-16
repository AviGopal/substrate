#!/usr/bin/env bun
/**
 * Register application development activities with the production backend
 *
 * These activities enable minibob instances to develop applications using
 * knowledge pulled from the network rather than hardcoded patterns.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ACTIVITY_API_ENDPOINT = process.env.ACTIVITY_API_ENDPOINT || 'https://activity.metabob.com';
const ACTIVITIES_DIR = join(__dirname, '../repos/metabob-proto/activities/development');

interface ActivityTemplate {
  id: string;
  name: string;
  description: string;
  tags: string[];
  category?: string;
  variables?: Array<{
    name: string;
    description: string;
    required: boolean;
    default?: string;
  }>;
  input_shapes?: string[];
  output_shapes?: string[];
  tasks: Array<{
    id: string;
    description: string;
    prompt: {
      template: string;
      variables?: string[];
    };
    validation?: {
      requiredPatterns?: string[];
      forbiddenPatterns?: string[];
    };
  }>;
}

async function registerActivity(activity: ActivityTemplate): Promise<boolean> {
  // Build the request using the new shapes format
  const requestBody = {
    id: activity.id,
    name: activity.name,
    description: activity.description,
    tags: activity.tags,
    category: activity.category,
    tasks: activity.tasks,
    scope: 'global', // Make these globally available
    input_shapes: activity.input_shapes || [],
    output_shapes: activity.output_shapes || [],
  };

  console.log(`\nRegistering: ${activity.id}`);
  console.log(`  Name: ${activity.name}`);
  console.log(`  Tags: ${activity.tags.join(', ')}`);
  console.log(`  Tasks: ${activity.tasks.length}`);

  try {
    const response = await fetch(`${ACTIVITY_API_ENDPOINT}/v2/activities/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`  ✓ Registered successfully`);
      return true;
    } else if (response.status === 409) {
      console.log(`  ⚠ Already exists (skipping)`);
      return true;
    } else {
      console.error(`  ✗ Failed: ${response.status} - ${JSON.stringify(result)}`);
      return false;
    }
  } catch (error) {
    console.error(`  ✗ Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Registering Development Activities with Backend');
  console.log('='.repeat(60));
  console.log(`Endpoint: ${ACTIVITY_API_ENDPOINT}`);
  console.log(`Activities directory: ${ACTIVITIES_DIR}`);

  // Find all JSON files in the activities/development directory
  const files = readdirSync(ACTIVITIES_DIR).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.error('\nNo activity files found!');
    process.exit(1);
  }

  console.log(`\nFound ${files.length} activity files:`);
  files.forEach(f => console.log(`  - ${f}`));

  let successCount = 0;
  let failCount = 0;

  for (const file of files) {
    const filePath = join(ACTIVITIES_DIR, file);
    try {
      const content = readFileSync(filePath, 'utf-8');
      const activity = JSON.parse(content) as ActivityTemplate;

      const success = await registerActivity(activity);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      console.error(`\nFailed to read/parse ${file}: ${error}`);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Registration complete: ${successCount} succeeded, ${failCount} failed`);
  console.log('='.repeat(60));

  // Verify by fetching templates with development tag
  console.log('\nVerifying registration...');
  try {
    const response = await fetch(`${ACTIVITY_API_ENDPOINT}/v2/activities/templates?limit=50`);
    const templates = await response.json();

    // Find development-tagged activities
    const devActivities = templates.filter((t: any) =>
      t.tags?.some((tag: string) => tag.startsWith('development'))
    );

    console.log(`\nDevelopment activities on backend: ${devActivities.length}`);
    devActivities.forEach((a: any) => {
      console.log(`  - ${a.id}: ${a.name}`);
    });
  } catch (error) {
    console.error(`Verification failed: ${error}`);
  }
}

main().catch(console.error);
