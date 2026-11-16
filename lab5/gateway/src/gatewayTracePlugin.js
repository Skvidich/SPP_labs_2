import { trace, context as apiContext, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('gateway');

/**
 * Apollo Server plugin, который открывает корневой span gateway на каждый
 * GraphQL-запрос и закрывает его при формировании ответа.
 *
 * Span создаётся через верхнеуровневую копию @opentelemetry/api (ту же, что
 * регистрирует sdk-node в telemetry.js), поэтому корректно экспортируется в
 * Jaeger по OTLP. Span добавляет атрибуты операции; отдельные span'ы
 * PostgreSQL создаются внутри Catalog/Collections Service при обращении к БД.
 *
 * Контекст span'а кладётся в requestContext.__otelTraceContext, чтобы
 * GatewayTraceDataSource мог построить заголовок traceparent для каждого
 * subgraph-запроса.
 */
export function gatewayTracePlugin() {
  return {
    async requestDidStart(requestContext) {
      const request = requestContext?.request;
      const operationName = request?.operationName ?? 'anonymous';
      const span = tracer.startSpan('gateway.request', {
        attributes: {
          'graphql.operation.name': operationName,
          'gateway.service': 'gateway',
        },
      });
      span.setAttribute('gateway.subgraph.count', 2);
      const contextValue =
        requestContext?.contextValue ?? requestContext?.context ?? {};
      if (contextValue && contextValue.__otelTraceContext === undefined) {
        contextValue.__otelTraceContext = trace.setSpan(
          apiContext.active(),
          span
        );
      }

      return {
        async didResolveOperation() {
          span.setAttribute('gateway.operation.resolved', true);
        },
        async willSendResponse({ response }) {
          if (response.body.kind === 'single' && response.body.singleResult.errors?.length) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: 'graphql response contained errors',
            });
          } else {
            span.setStatus({ code: SpanStatusCode.OK });
          }
          span.end();
        },
      };
    },
  };
}