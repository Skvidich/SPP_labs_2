import { createRequire } from 'node:module';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  trace as apiTrace,
  propagation as apiPropagation,
} from '@opentelemetry/api';

const SVC_NAME = 'gateway';

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

// @apollo/gateway подтягивает собственную (вложенную) копию
// @opentelemetry/api@1.9.x, которая НЕ разделяет глобальные регистры с
// верхнеуровневой копией @opentelemetry/api@1.10.x. Поэтому встроенные span'ы
// gateway (gateway.request/plan/fetch) создавались бы через no-op tracer и не
// попадали бы в Jaeger, а контекст не передавался бы в subgraph.
//
// Решение: зарегистрировать на вложенной копии API тот же tracer provider и
// propagator, что и на верхнеуровневой. Tracer provider берём как объект, на
// который уже делегирует верхнеуровневая копия (getTracerProvider), и
// регистрируем его во вложенной копии — span'ы из gateway при этом создаются
// способом, который заставляет обоих API использовать общий реальный provider.
const require = createRequire(import.meta.url);
const gatewayApi = (() => {
  try {
    return require('@apollo/gateway/node_modules/@opentelemetry/api');
  } catch {
    return null;
  }
})();

export function getGatewayApi() {
  return gatewayApi;
}

let sdk;

function wireGatewayApi() {
  if (!gatewayApi) return;
  try {
    const provider = apiTrace.getTracerProvider();
    if (provider && provider !== gatewayApi.trace.getTracerProvider()) {
      gatewayApi.trace.setGlobalTracerProvider(provider);
    }
  } catch (e) {
    console.warn('[otel] failed to wire gateway tracer provider:', e.message);
  }
  try {
    const propagator = apiPropagation._getGlobalPropagator?.();
    if (propagator && propagator !== gatewayApi.propagation._getGlobalPropagator?.()) {
      gatewayApi.propagation.setGlobalPropagator(propagator);
    }
  } catch (e) {
    console.warn('[otel] failed to wire gateway propagator:', e.message);
  }
}

export function startTelemetry() {
  try {
    const base = endpoint();
    if (base) {
      sdk = new NodeSDK({
        resource: makeResource(),
        traceExporter: new OTLPTraceExporter({ url: `${base}v1/traces` }),
        serviceName: SVC_NAME,
      });
      sdk.start();
      // После sdk.start() верхнеуровневая копия API уже имеет реальный
      // tracer provider; переносим его во вложенную копию, используемую
      // ApolloGateway.
      wireGatewayApi();
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