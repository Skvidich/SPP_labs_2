import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { trace, SpanStatusCode } from '@opentelemetry/api';

const SVC_NAME = 'collector';
const tracer = trace.getTracer(SVC_NAME);

function endpoint() {
  const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!base) return undefined;
  if (!/\/$/.test(base)) return `${base}/`;
  return base;
}

function makeResource() {
  return resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SVC_NAME,
    [ATTR_SERVICE_VERSION]: '1.0.0',
    'collector.worker': 'all',
  });
}

let sdk;

export function startTelemetry() {
  try {
    const base = endpoint();
    const traceExporter = base
      ? new OTLPTraceExporter({ url: `${base}v1/traces` })
      : undefined;

    if (traceExporter) {
      sdk = new NodeSDK({
        resource: makeResource(),
        traceExporter,
        serviceName: SVC_NAME,
      });
      sdk.start();
    }
    console.log(`[otel] trace exporter started, endpoint=${base ?? 'none'}`);
  } catch (e) {
    console.warn('[otel] start failed, tracing disabled:', e.message);
  }
}

export async function shutdownTelemetry() {
  try {
    if (sdk) await sdk.shutdown();
  } catch (e) {
    console.warn('[otel] shutdown failed:', e.message);
  }
}

/**
 * Выполняет fn в span'е, размеченном по воркеру и фазе (fetch/write), чтобы
 * трейсы было видно в Jaeger отдельно для каждого воркера.
 */
export async function tracePhase(name, phase, fn) {
  return await tracer.startActiveSpan(
    `${name}.${phase}`,
    { attributes: { 'collector.worker': name, 'collector.phase': phase } },
    async (span) => {
      try {
        const result = await fn();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err) {
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err?.message ?? 'error' });
        throw err;
      } finally {
        span.end();
      }
    }
  );
}