#!/usr/bin/env bun

// Test if the claude-haiku-4-5 model is available

const modelsUrl = "https://models.dev/api.json";

async function testModel() {
  console.log("Fetching models.dev API...");
  const response = await fetch(modelsUrl);
  const data = await response.json();
  
  const anthropicModels = data.anthropic?.models || {};
  const modelId = "claude-haiku-4-5";
  
  console.log("\nChecking for model:", modelId);
  
  if (anthropicModels[modelId]) {
    console.log("✅ Model found!");
    console.log(JSON.stringify(anthropicModels[modelId], null, 2));
  } else {
    console.log("❌ Model NOT found");
    console.log("\nAvailable haiku models:");
    Object.keys(anthropicModels)
      .filter(k => k.includes("haiku"))
      .forEach(k => console.log(`  - ${k}`));
  }
}

testModel().catch(console.error);
