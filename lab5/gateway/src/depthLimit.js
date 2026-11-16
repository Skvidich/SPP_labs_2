import { GraphQLError, specifiedRules } from 'graphql';

const MAX_DEPTH = 5;
const ERROR_CODE = 'MAX_DEPTH_EXCEEDED';

/**
 * Ограничение максимальной глубины GraphQL-запроса (без учёта полей-обёрток
 * Introspection). Запросы глубже MAX_DEPTH отклоняются до выполнения резолверов.
 */
export function maxDepthRule(context) {
  return {
    OperationDefinition(node) {
      const depth = calculateDepth(node, 0);
      if (depth > MAX_DEPTH) {
        context.reportError(
          new GraphQLError(
            `operation exceeds maximum allowed depth of ${MAX_DEPTH} (actual ${depth})`,
            { nodes: [node], extensions: { code: ERROR_CODE } }
          )
        );
      }
    },
  };
}

function calculateDepth(node, depth) {
  let max = depth;
  for (const selection of node.selectionSet?.selections ?? []) {
    if (selection.kind === 'Field') {
      const next = selection.selectionSet ? calculateDepth(selection, depth + 1) : depth;
      if (next > max) max = next;
    }
  }
  return max;
}

export function buildValidationRules() {
  return [...specifiedRules, maxDepthRule];
}

export { ERROR_CODE };