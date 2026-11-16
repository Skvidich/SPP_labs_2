import { RemoteGraphQLDataSource } from '@apollo/gateway/dist/datasources/RemoteGraphQLDataSource.js';
import { getGatewayApi } from './telemetry.js';

/**
 * RemoteGraphQLDataSource, который прокидывает trace-контекст (W3C
 * traceparent) в исходящий HTTP-запрос к subgraph.
 *
 * Active-контекст во время `willSendRequest` не несёт span'а gateway
 * (Apollo создаёт span fetch позже и не по active-context), поэтому
 * контекст читается с .__otelTraceContext, который gatewayTracePlugin
 * кладёт на incomingRequestContext. Контекст инжектится через
 * propagation нested-копии @opentelemetry/api (см. telemetry.js) в
 * plain-объект carrier, а затем переносится в request.http.headers,
 * который RemoteGraphQLDataSource отправляет через make-fetch-happen.
 */
export class GatewayTraceDataSource extends RemoteGraphQLDataSource {
  constructor(config) {
    super(config);
  }

  async willSendRequest({ request, kind, incomingRequestContext }) {
    const gatewayApi = getGatewayApi();
    if (!gatewayApi) return;
    try {
      const cv =
        kind === 'incoming operation'
          ? incomingRequestContext?.contextValue ?? incomingRequestContext?.context
          : undefined;
      const fromCtx = cv?.__otelTraceContext;
      const ctx = fromCtx || gatewayApi.context.active();

      const carrier = {};
      gatewayApi.propagation.inject(ctx, carrier);
      for (const [name, value] of Object.entries(carrier)) {
        if (value !== undefined) request.http.headers.set(name, value);
      }
    } catch (e) {
      console.warn('[otel] failed to inject traceparent into subgraph request:', e.message);
    }
  }
}