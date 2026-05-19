// SPDX-License-Identifier: AGPL-3.0-or-later
import { BriefGenerator } from "../BriefGenerator.js";

// Test suite for BriefGenerator
class BriefGeneratorTestSuite {
  private generator: BriefGenerator;

  setup() {
    this.generator = new BriefGenerator();
  }

  testInstantiation() {
    const gen = new BriefGenerator();
    if (!(gen instanceof BriefGenerator)) {
      throw new Error("Should be instantiated as BriefGenerator");
    }
  }

  testGenerateBrief() {
    this.setup();
    const brief = this.generator.generateBrief(
      "Test Brief",
      "This is a test summary",
      [
        { title: "Section 1", content: "Content 1", order: 1 },
        { title: "Section 2", content: "Content 2", order: 2 },
      ],
      [
        { id: "cite-1", source: "Source 1", entityIds: ["entity-1"], confidence: 0.9 },
        { id: "cite-2", source: "Source 2", entityIds: ["entity-2"], confidence: 0.7 },
      ],
      { test: "metadata" }
    );

    if (!brief.id) {
      throw new Error("Brief should have an id");
    }
    if (brief.title !== "Test Brief") {
      throw new Error(`Expected title 'Test Brief', got '${brief.title}'`);
    }
    if (brief.summary !== "This is a test summary") {
      throw new Error(`Expected summary 'This is a test summary', got '${brief.summary}'`);
    }
    if (brief.sections.length !== 2) {
      throw new Error(`Expected 2 sections, got ${brief.sections.length}`);
    }
    if (brief.citations.length !== 2) {
      throw new Error(`Expected 2 citations, got ${brief.citations.length}`);
    }
    if (brief.metadata.test !== "metadata") {
      throw new Error(`Expected metadata.test to be 'metadata', got '${brief.metadata.test}'`);
    }
    if (!brief.generatedAt) {
      throw new Error("Brief should have a generatedAt timestamp");
    }
  }

  testGenerateSignal() {
    this.setup();
    const signal = this.generator.generateSignal(
      "anomaly",
      "high",
      "Test Entity",
      "This is a test signal",
      ["related-1", "related-2"],
      ["source-1", "source-2"],
      0.85
    );

    if (!signal.id) {
      throw new Error("Signal should have an id");
    }
    if (signal.type !== "anomaly") {
      throw new Error(`Expected type 'anomaly', got '${signal.type}'`);
    }
    if (signal.severity !== "high") {
      throw new Error(`Expected severity 'high', got '${signal.severity}'`);
    }
    if (signal.entityName !== "Test Entity") {
      throw new Error(`Expected entityName 'Test Entity', got '${signal.entityName}'`);
    }
    if (signal.description !== "This is a test signal") {
      throw new Error(`Expected description 'This is a test signal', got '${signal.description}'`);
    }
    if (!Array.isArray(signal.relatedEntities) || signal.relatedEntities.length !== 2) {
      throw new Error(`Expected relatedEntities to be an array with 2 elements`);
    }
    if (!Array.isArray(signal.citedSources) || signal.citedSources.length !== 2) {
      throw new Error(`Expected citedSources to be an array with 2 elements`);
    }
    if (signal.confidence !== 0.85) {
      throw new Error(`Expected confidence 0.85, got ${signal.confidence}`);
    }
    if (!signal.detectedAt) {
      throw new Error("Signal should have a detectedAt timestamp");
    }
  }

  testRenderBriefUsingTemplate() {
    this.setup();
    const brief = this.generator.generateBrief(
      "Test Brief",
      "Test summary",
      [{ title: "Test Section", content: "Test content", order: 1 }],
      [{ id: "cite-1", source: "Test Source", entityIds: ["entity-1"], confidence: 0.9 }],
    );

    const rendered = this.generator.renderBrief("default-brief", brief);
    
    if (!rendered.includes("# Test Brief")) {
      throw new Error("Rendered brief should contain '# Test Brief'");
    }
    if (!rendered.includes("Test summary")) {
      throw new Error("Rendered brief should contain 'Test summary'");
    }
    if (!rendered.includes("Test Section")) {
      throw new Error("Rendered brief should contain 'Test Section'");
    }
    if (!rendered.includes("Test content")) {
      throw new Error("Rendered brief should contain 'Test content'");
    }
    if (!rendered.includes("[cite-1] Test Source (confidence: 0.9)")) {
      throw new Error("Rendered brief should contain '[cite-1] Test Source (confidence: 0.9)'");
    }
    if (!rendered.includes("Generated at")) {
      throw new Error("Rendered brief should contain 'Generated at'");
    }
  }

  testRenderSignalUsingTemplate() {
    this.setup();
    const signal = this.generator.generateSignal(
      "test-signal",
      "medium",
      "Test Entity",
      "Test description",
      ["related-1"],
      ["source-1"],
      0.75
    );

    const rendered = this.generator.renderSignal("signal-alert", signal);
    
    if (!rendered.includes("🚨 **SIGNAL ALERT** 🚨")) {
      throw new Error("Rendered signal should contain '🚨 **SIGNAL ALERT** 🚨'");
    }
    if (!rendered.includes("**Type**: test-signal")) {
      throw new Error("Rendered signal should contain '**Type**: test-signal'");
    }
    if (!rendered.includes("**Severity**: medium")) {
      throw new Error("Rendered signal should contain '**Severity**: medium'");
    }
    if (!rendered.includes("**Entity**: Test Entity")) {
      throw new Error("Rendered signal should contain '**Entity**: Test Entity'");
    }
    if (!rendered.includes("**Confidence**: 0.75")) {
      throw new Error("Rendered signal should contain '**Confidence**: 0.75'");
    }
    if (!rendered.includes("Test description")) {
      throw new Error("Rendered signal should contain 'Test description'");
    }
    if (!rendered.includes("related-1")) {
      throw new Error("Rendered signal should contain 'related-1'");
    }
    if (!rendered.includes("source-1")) {
      throw new Error("Rendered signal should contain 'source-1'");
    }
    if (!rendered.includes("Detected at")) {
      throw new Error("Rendered signal should contain 'Detected at'");
    }
  }

  testGetAvailableTemplates() {
    this.setup();
    const templates = this.generator.getTemplates();
    
    if (!templates.includes("default-brief")) {
      throw new Error("Templates should include 'default-brief'");
    }
    if (!templates.includes("signal-alert")) {
      throw new Error("Templates should include 'signal-alert'");
    }
    if (!templates.includes("committee-report")) {
      throw new Error("Templates should include 'committee-report'");
    }
  }

  testAddAndRemoveCustomTemplate() {
    this.setup();
    const customTemplate = {
      name: "custom",
      template: "Custom template: {{title}}",
      render: (data: Record<string, unknown>) => {
        return `Custom template: ${data.title}`;
      }
    };
    
    this.generator.addTemplate("custom", customTemplate);
    const templates = this.generator.getTemplates();
    if (!templates.includes("custom")) {
      throw new Error("Templates should include 'custom' after adding");
    }
    
    const removed = this.generator.removeTemplate("custom");
    if (!removed) {
      throw new Error("Should return true when removing existing template");
    }
    
    const templatesAfterRemove = this.generator.getTemplates();
    if (templatesAfterRemove.includes("custom")) {
      throw new Error("Templates should not include 'custom' after removing");
    }
  }

  testThrowErrorForNonExistentTemplate() {
    this.setup();
    const brief = this.generator.generateBrief("Test", "Summary", [], []);
    
    try {
      this.generator.renderBrief("non-existent", brief);
      throw new Error("Should throw error for non-existent template");
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("Template not found")) {
        throw new Error(`Expected error with message containing 'Template not found', got ${error}`);
      }
    }
  }

  runAllTests() {
    const testMethods = [
      'testInstantiation',
      'testGenerateBrief',
      'testGenerateSignal',
      'testRenderBriefUsingTemplate',
      'testRenderSignalUsingTemplate',
      'testGetAvailableTemplates',
      'testAddAndRemoveCustomTemplate',
      'testThrowErrorForNonExistentTemplate'
    ];

    let passed = 0;
    let failed = 0;

    for (const methodName of testMethods) {
      try {
        // @ts-ignore
        this[methodName]();
        console.log(`✓ ${methodName}`);
        passed++;
      } catch (error) {
        console.error(`✗ ${methodName}: ${error.message}`);
        failed++;
      }
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
      process.exit(1);
    }
  }
}

// Run the tests
const testSuite = new BriefGeneratorTestSuite();
testSuite.runAllTests();