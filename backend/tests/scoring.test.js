import assert from "node:assert";
import { classifySource } from "../src/services/sourceClassifier.js";
import { scoreFinding } from "../src/services/riskService.js";

function makeDetection(types) {
  return {
    matched: types.map((type) => ({
      type,
      value: "test-value",
    })),
  };
}

function runScenario(name, page, identifierTypes, expected) {
  const sourceRule = classifySource(page);
  const detection = makeDetection(identifierTypes);
  const result = scoreFinding(detection, sourceRule);

  console.log(`\n${name}`);
  console.log({
    sourceCategory: sourceRule.category,
    dpc: result.dpc,
    ei: result.ei,
    cb: result.cb,
    severity: result.severity,
    level: result.level,
  });

  assert.strictEqual(sourceRule.category, expected.category);
  assert.strictEqual(result.dpc, expected.dpc);
  assert.strictEqual(result.ei, expected.ei);
  assert.strictEqual(result.cb, expected.cb);
  assert.strictEqual(result.severity, expected.severity);
  assert.strictEqual(result.level, expected.level);

  console.log("✓ passed");
}

runScenario(
  "1. Name only on ordinary website",
  {
    domain: "smallsite.example",
    title: "About our contributors",
    snippet: "Contributor profile",
    pageText: "A general webpage with no special context.",
  },
  ["fullName"],
  {
    category: "general-web",
    dpc: 1,
    ei: 0.5,
    cb: 0.25,
    severity: 0.75,
    level: "Low",
  }
);

runScenario(
  "2. Name only on LinkedIn",
  {
    domain: "linkedin.com",
    title: "Professional profile",
    snippet: "Public LinkedIn profile",
    pageText: "",
  },
  ["fullName"],
  {
    category: "social-media",
    dpc: 1,
    ei: 0.5,
    cb: 0.5,
    severity: 1,
    level: "Low",
  }
);

runScenario(
  "3. Name + email on ordinary website",
  {
    domain: "smallsite.example",
    title: "Contact page",
    snippet: "Contributor contact details",
    pageText: "A general webpage with no special context.",
  },
  ["fullName", "email"],
  {
    category: "general-web",
    dpc: 1,
    ei: 0.75,
    cb: 0.25,
    severity: 1,
    level: "Low",
  }
);

runScenario(
  "4. Name + email in sensitive health context",
  {
    domain: "healthsite.example",
    title: "Diabetes support programme",
    snippet: "Diabetes patient support community",
    pageText: "This page discusses diabetes treatment and support.",
  },
  ["fullName", "email"],
  {
    category: "healthcare-sensitive",
    dpc: 3,
    ei: 0.75,
    cb: 0.25,
    severity: 2.5,
    level: "Medium",
  }
);

runScenario(
  "5. Name + email on a data broker",
  {
    domain: "spokeo.com",
    title: "People search profile",
    snippet: "Find people and public records",
    pageText: "",
  },
  ["fullName", "email"],
  {
    category: "data-broker",
    dpc: 1,
    ei: 0.75,
    cb: 1,
    severity: 1.75,
    level: "Low",
  }
);

console.log("\nAll scoring tests passed.");