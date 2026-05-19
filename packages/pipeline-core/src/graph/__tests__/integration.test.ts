// SPDX-License-Identifier: AGPL-3.0-or-later
import { GraphBuilder } from "../GraphBuilder.js";
import { BriefGenerator } from "../../brief/BriefGenerator.js";
import { pipelineStages } from "../../pipeline.js";

// Test suite for integration between GraphBuilder and BriefGenerator
class GraphBuilderBriefGeneratorIntegrationTest {
  private builder: GraphBuilder;
  private generator: BriefGenerator;

  setup() {
    this.builder = new GraphBuilder();
    this.generator = new BriefGenerator();
  }

  testPipelineStageComposition() {
    this.setup();

    // Test that both classes can be instantiated and used together
    if (!(this.builder instanceof GraphBuilder)) {
      throw new Error("Builder should be instance of GraphBuilder");
    }
    if (!(this.generator instanceof BriefGenerator)) {
      throw new Error("Generator should be instance of BriefGenerator");
    }

    // Test that we can generate a brief after building a graph (even if empty)
    const brief = this.generator.generateBrief(
      "Integration Test",
      "Testing pipeline composition",
      [{ title: "Test", content: "Content", order: 1 }],
      [{ id: "cite-1", source: "Test Source", entityIds: ["test-entity"], confidence: 0.9 }]
    );

    if (brief.title !== "Integration Test") {
      throw new Error(`Expected title 'Integration Test', got '${brief.title}'`);
    }
    if (brief.summary !== "Testing pipeline composition") {
      throw new Error(`Expected summary 'Testing pipeline composition', got '${brief.summary}'`);
    }

    // Test that we can render the brief
    const rendered = this.generator.renderBrief("default-brief", brief);
    if (!rendered.includes("# Integration Test")) {
      throw new Error("Rendered brief should contain '# Integration Test'");
    }
    if (!rendered.includes("Testing pipeline composition")) {
      throw new Error("Rendered brief should contain 'Testing pipeline composition'");
    }
  }

  testGetPipelineStages() {
    if (typeof pipelineStages !== "object" || pipelineStages === null) {
      throw new Error("pipelineStages should be an object");
    }
    if (typeof pipelineStages.graphBuilder !== "function") {
      throw new Error("pipelineStages.graphBuilder should be a function");
    }
    if (typeof pipelineStages.briefGenerator !== "function") {
      throw new Error("pipelineStages.briefGenerator should be a function");
    }
  }

  runAllTests() {
    const testMethods = [
      'testPipelineStageComposition',
      'testGetPipelineStages'
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
const testSuite = new GraphBuilderBriefGeneratorIntegrationTest();
testSuite.runAllTests();