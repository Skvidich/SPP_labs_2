import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { context as apiContext, propagation, trace, SpanStatusCode } from '@opentelemetry/api';

const SVC_NAME = 'collections-service';
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
        instrumentations: [new HttpInstrumentation()],
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
 * Выполняет fn в span'е. Используется для репозитория и резолверов, чтобы
 * трейсы Gateway -> Collections Service -> PostgreSQL были видны в Jaeger.
 *
 * Если передан parent (извлечённый из входящего traceparent контекст), span
 * становится его ребёнком и трейс связывается с gateway.
 */
export async function tracePhase(name, phase, fn, parentContext) {
  const base = parentContext ?? apiContext.active();
  return await apiContext.with(base, () =>
    tracer.startActiveSpan(
      `${name}.${phase}`,
      { attributes: { 'collections.phase': phase } },
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
    )
  );
}

/**
 * Извлекает trace-контекст (traceparent) из входящего HTTP-запроса.
 */
export function extractIncomingContext(headers) {
  if (!headers) return null;
  try {
    return propagation.extract(apiContext.active(), headers);
  } catch (e) {
    return null;
  }
}