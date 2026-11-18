// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Telemetry
 *
 * Lightweight tracer setup for Tempo integration.
 * Uses dynamic imports to handle optional OTel packages gracefully.
 * Falls back to no-op if OTel packages aren't available.
 */
/* eslint-disable @typescript-eslint/no-var-requires */

// Try to load OTel API
let otel: any = null;
try {
  otel = require('@opentelemetry/api');
} catch {
  // OTel not available — everything below is a no-op
}

let provider: any = null;

if (otel && process.env.OTEL_ENABLED !== 'false') {
  const OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    || 'http://tempo.monitoring:4318/v1/traces';

  try {
    // Create a basic tracer provider
    const { BasicTracerProvider } = otel;

    provider = new BasicTracerProvider({
      resource: {
        'service.name': process.env.OTEL_SERVICE_NAME || 'quill-api',
        'service.version': process.env.QUILL_VERSION || '0.1.0',
      },
    });

    // Try HTTP exporter (simpler than gRPC, no native deps)
    try {
      const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
      if (OTLPTraceExporter) {
        const exporter = new OTLPTraceExporter({ url: OTLP_ENDPOINT });
        const { BatchSpanProcessor } = otel;
        provider.addSpanProcessor(new BatchSpanProcessor(exporter));
      }
    } catch {
      // No HTTP exporter — use console exporter in dev
      if (process.env.NODE_ENV !== 'production') {
        const { ConsoleSpanExporter, BatchSpanProcessor } = otel;
        provider.addSpanProcessor(new BatchSpanProcessor(new ConsoleSpanExporter()));
      }
    }

    provider.register();
    console.error(`[telemetry] OTel initialized, endpoint: ${OTLP_ENDPOINT}`);
  } catch (e) {
    console.error(`[telemetry] Failed to initialize: ${e}`);
    provider = null;
  }
}

// Export tracer (no-op if OTel unavailable)
export const tracer = otel && provider
  ? otel.trace.getTracer('quill-api')
  : {
      startSpan: (name: string) => ({
        end: () => {},
        setAttribute: () => {},
        setStatus: () => {},
      }),
    };

// Graceful shutdown
const shutdown = async () => {
  if (provider) {
    try {
      await provider.shutdown();
    } catch {
      // ignore shutdown errors
    }
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default tracer;
