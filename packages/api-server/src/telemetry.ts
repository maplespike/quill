/**
 * Quill — OpenTelemetry Tracing
 *
 * Initializes the OpenTelemetry SDK with OTLP gRPC exporter to Tempo.
 * Auto-instruments Express HTTP routes and propagates W3C trace context.
 *
 * Must be imported BEFORE any other module to capture early spans.
 * Use: import './telemetry.js' as the first import in the entry point.
 */
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/instrumentation-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

// Enable diagnostic logging in development
if (process.env.NODE_ENV !== 'production') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
}

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  || 'http://tempo.monitoring:4317';

const sdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: 'quill-api',
    [SEMRESATTRS_SERVICE_VERSION]: process.env.QUILL_VERSION || '0.1.0',
  }),
  spanProcessor: new BatchSpanProcessor(
    new OTLPTraceExporter({
      url: otlpEndpoint,
    }),
  ),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        enabled: true,
      },
    }),
  ],
});

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.error('OpenTelemetry SDK shut down'))
    .catch((err: unknown) => console.error('Error shutting down OpenTelemetry SDK', err))
    .finally(() => process.exit(0));
});

process.on('SIGINT', () => {
  sdk.shutdown()
    .then(() => console.error('OpenTelemetry SDK shut down'))
    .catch((err: unknown) => console.error('Error shutting down OpenTelemetry SDK', err))
    .finally(() => process.exit(0));
});

// Start the SDK
sdk.start();

export default sdk;
