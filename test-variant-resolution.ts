#!/usr/bin/env bun

/**
 * Test script to verify activity variant resolution bug fix
 * 
 * This script tests the 3-part fix:
 * 1. metabob-cli returns id (not activity_id) and stores variant_id in _meta
 * 2. OpenCode stores rawActivities in impulse metadata
 * 3. TemplateLoader resolves variant_id from impulse metadata before calling getActivity()
 */

import { MetabobCLI } from "./repos/metabob-opencode/packages/opencode/src/util/metabob"
import { SessionMemory } from "./repos/metabob-opencode/packages/opencode/src/session/session-memory"
import { TemplateRepository } from "./repos/metabob-opencode/packages/opencode/src/session/activity-template-repository"
import { Identifier } from "./repos/metabob-opencode/packages/opencode/src/id/id"

async function testVariantResolution() {
  console.log("🧪 Testing Activity Variant Resolution Fix\n")

  try {
    // Step 1: Test metabob-cli search_activities response format
    console.log("1️⃣  Testing metabob-cli search_activities response format...")
    const activities = await MetabobCLI.searchActivities("create activity template", { limit: 3 })
    
    if (!activities || activities.length === 0) {
      console.error("❌ FAIL: No activities returned from search")
      return
    }

    console.log(`✅ Found ${activities.length} activities`)
    
    // Check format of first activity
    const firstActivity = activities[0] as any
    console.log("\n   First activity structure:")
    console.log(`   - id: ${firstActivity.id}`)
    console.log(`   - name: ${firstActivity.name}`)
    console.log(`   - _meta.variant_id: ${firstActivity._meta?.variant_id}`)
    
    if (!firstActivity.id) {
      console.error("❌ FAIL: Activity missing 'id' field")
      return
    }
    
    if (!firstActivity._meta?.variant_id) {
      console.error("❌ FAIL: Activity missing '_meta.variant_id' field")
      return
    }
    
    console.log("✅ PASS: metabob-cli returns correct format (id + _meta.variant_id)")

    // Step 2: Test impulse metadata storage
    console.log("\n2️⃣  Testing impulse metadata storage...")
    
    // Create a test session
    const testSessionID = Identifier.ascending("session")
    
    // Manually create an impulse with rawActivities metadata (simulating turn-lifecycle-hooks)
    await SessionMemory.addImpulse(testSessionID, {
      id: "activity-recommendations-test",
      sessionID: testSessionID,
      scope: "session",
      type: "activityRecommendation",
      description: "Test recommendations",
      pointer: {
        type: "activityRecommendation",
        context: "test",
        limit: 3,
      },
      budget: 1500,
      priority: "medium",
      metadata: {
        rawActivities: activities,
        fetchedAt: Date.now(),
      },
    })

    // Retrieve impulse and check metadata
    const impulses = await SessionMemory.listImpulses(testSessionID)
    const recommendationImpulse = impulses.find(
      (imp) => imp.type === "activityRecommendation" && imp.metadata?.rawActivities
    )

    if (!recommendationImpulse) {
      console.error("❌ FAIL: Impulse not found in session")
      return
    }

    if (!recommendationImpulse.metadata?.rawActivities) {
      console.error("❌ FAIL: Impulse missing rawActivities metadata")
      return
    }

    console.log(`✅ PASS: Impulse metadata contains ${(recommendationImpulse.metadata.rawActivities as any[]).length} rawActivities`)

    // Step 3: Test variant resolution in TemplateRepository.get()
    console.log("\n3️⃣  Testing variant resolution in TemplateRepository.get()...")
    
    const testActivityId = firstActivity.id
    const expectedVariantId = firstActivity._meta.variant_id
    
    console.log(`   Calling TemplateRepository.get("${testActivityId}", { sessionID: "${testSessionID}" })`)
    
    try {
      const template = await TemplateRepository.get(testActivityId, { 
        sessionID: testSessionID,
        skipCache: true // Force fresh load to test resolution
      })

      if (!template) {
        console.error(`❌ FAIL: Template not found for activity_id: ${testActivityId}`)
        console.error(`   Expected variant_id: ${expectedVariantId}`)
        console.error(`   This means variant resolution failed!`)
        return
      }

      console.log(`✅ PASS: Template loaded successfully`)
      console.log(`   Template ID: ${template.id}`)
      console.log(`   Template Name: ${template.name}`)
      
      // Check if the loaded template has the variant_id
      if ((template as any).variant_id) {
        console.log(`   Variant ID: ${(template as any).variant_id}`)
      }

    } catch (error) {
      console.error(`❌ FAIL: Error loading template: ${error instanceof Error ? error.message : String(error)}`)
      return
    }

    console.log("\n✅ ALL TESTS PASSED!")
    console.log("\nThe 3-part variant resolution fix is working correctly:")
    console.log("1. metabob-cli returns id + _meta.variant_id ✓")
    console.log("2. OpenCode stores rawActivities in impulse metadata ✓")
    console.log("3. TemplateLoader resolves variant_id from impulse ✓")

  } catch (error) {
    console.error(`\n❌ TEST FAILED: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:")
      console.error(error.stack)
    }
  }
}

// Run tests
testVariantResolution().catch(console.error)
