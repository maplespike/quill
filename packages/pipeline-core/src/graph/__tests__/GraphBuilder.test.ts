// SPDX-License-Identifier: AGPL-3.0-or-later
import { GraphBuilder } from "../GraphBuilder.js";

// Test suite for GraphBuilder
class GraphBuilderTestSuite {
  private builder: GraphBuilder;

  setup() {
    this.builder = new GraphBuilder();
  }

  testInstantiation() {
    const builder = new GraphBuilder();
    if (!(builder instanceof GraphBuilder)) {
      throw new Error("Should be instantiated as GraphBuilder");
    }
  }

  testDefaultOptions() {
    this.setup();
    // @ts-ignore - accessing private property for testing
    if ((this.builder as any).options.maxDepth !== 10) {
      throw new Error(`Expected maxDepth to be 10, got ${(this.builder as any).options.maxDepth}`);
    }
    // @ts-ignore - accessing private property for testing
    if ((this.builder as any).options.minWeight !== 0.1) {
      throw new Error(`Expected minWeight to be 0.1, got ${(this.builder as any).options.minWeight}`);
    }
  }

  testCustomOptions() {
    const customBuilder = new GraphBuilder({ maxDepth: 5, minWeight: 0.5 });
    // @ts-ignore - accessing private property for testing
    if ((customBuilder as any).options.maxDepth !== 5) {
      throw new Error(`Expected maxDepth to be 5, got ${(customBuilder as any).options.maxDepth}`);
    }
    // @ts-ignore - accessing private property for testing
    if ((customBuilder as any).options.minWeight !== 0.5) {
      throw new Error(`Expected minWeight to be 0.5, got ${(customBuilder as any).options.minWeight}`);
    }
  }

  testEmptyGraphInitially() {
    this.setup();
    if (this.builder.getAllNodes().length !== 0) {
      throw new Error(`Expected 0 nodes initially, got ${this.builder.getAllNodes().length}`);
    }
    if (this.builder.getAllEdges().length !== 0) {
      throw new Error(`Expected 0 edges initially, got ${this.builder.getAllEdges().length}`);
    }
  }

  testClearGraphData() {
    this.setup();
    // Add some mock data
    // @ts-ignore - accessing private property for testing
    (this.builder as any).nodes.set("test-id", { id: "test-id", type: "test", label: "Test", properties: {} });
    // @ts-ignore - accessing private property for testing
    (this.builder as any).edges.set("test-edge-id", { id: "test-edge-id", source: "test-id", target: "test-id", type: "test", weight: 1, properties: {}, sourceRef: "test" });

    if (this.builder.getAllNodes().length !== 1) {
      throw new Error(`Expected 1 node after adding, got ${this.builder.getAllNodes().length}`);
    }
    if (this.builder.getAllEdges().length !== 1) {
      throw new Error(`Expected 1 edge after adding, got ${this.builder.getAllEdges().length}`);
    }

    this.builder.clear();

    if (this.builder.getAllNodes().length !== 0) {
      throw new Error(`Expected 0 nodes after clearing, got ${this.builder.getAllNodes().length}`);
    }
    if (this.builder.getAllEdges().length !== 0) {
      throw new Error(`Expected 0 edges after clearing, got ${this.builder.getAllEdges().length}`);
    }
  }

  runAllTests() {
    const testMethods = [
      'testInstantiation',
      'testDefaultOptions',
      'testCustomOptions',
      'testEmptyGraphInitially',
      'testClearGraphData'
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
const testSuite = new GraphBuilderTestSuite();
testSuite.runAllTests();