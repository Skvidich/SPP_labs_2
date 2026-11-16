import { observeGqlDuration, observeGqlError, observeGqlRequest } from './metrics.js';

export const graphqlMetricsPlugin = () => ({
  async requestDidStart({ request }) {
    const operationName = request.operationName ?? 'unknown';
    observeGqlRequest(operationName);
    const start = process.hrtime.bigint();
    return {
      async willSendResponse({ response }) {
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        observeGqlDuration(operationName, ms / 1000);
        if (response.body.kind === 'single' && response.body.singleResult.errors?.length) {
          observeGqlError(operationName);
        }
      },
    };
  },
});