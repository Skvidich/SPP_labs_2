import { GraphQLScalarType, Kind } from 'graphql';
import {
  addItemToCollection,
  createCollection,
  deleteCollection,
  findCollectionById,
  listCollectionItems,
  listCollections,
  removeItemFromCollection,
  updateCollection,
} from './repository.js';
import { tracePhase } from './telemetry.js';

const DateTime = new GraphQLScalarType({
  name: 'DateTime',
  serialize(value) {
    if (value == null) return null;
    const date = value instanceof Date ? value : new Date(value);
    return date.toISOString();
  },
  parseValue(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new TypeError(`invalid DateTime: "${value}"`);
    }
    return date;
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      const date = new Date(ast.value);
      if (Number.isNaN(date.getTime())) {
        throw new TypeError(`invalid DateTime: "${ast.value}"`);
      }
      return date;
    }
    return null;
  },
});

export const resolvers = {
  Query: {
    collections: (_root, args, ctx) =>
      tracePhase('resolver', 'collections', () => listCollections(args), ctx?.__otelParentContext),
    collection: (_root, { id }, ctx) =>
      tracePhase('resolver', 'collection', () => findCollectionById(id), ctx?.__otelParentContext),
  },
  Mutation: {
    createCollection: (_root, { input }, ctx) =>
      tracePhase('resolver', 'createCollection', () => createCollection(input), ctx?.__otelParentContext),
    updateCollection: (_root, { id, input }, ctx) =>
      tracePhase('resolver', 'updateCollection', () => updateCollection(id, input), ctx?.__otelParentContext),
    deleteCollection: (_root, { id }, ctx) =>
      tracePhase('resolver', 'deleteCollection', () => deleteCollection(id), ctx?.__otelParentContext),
    addItemToCollection: (_root, { collectionId, itemId }, ctx) =>
      tracePhase('resolver', 'addItemToCollection', () =>
        addItemToCollection(collectionId, itemId), ctx?.__otelParentContext),
    removeItemFromCollection: (_root, { collectionId, itemId }, ctx) =>
      tracePhase('resolver', 'removeItemFromCollection', () =>
        removeItemFromCollection(collectionId, itemId), ctx?.__otelParentContext),
  },
  Collection: {
    __resolveReference: (reference, ctx) =>
      tracePhase('resolver', 'Collection.reference', () =>
        findCollectionById(reference.id), ctx?.__otelParentContext),
    items: (collection, _args, ctx) =>
      tracePhase('resolver', 'Collection.items', () =>
        listCollectionItems(collection.id), ctx?.__otelParentContext),
  },
  DateTime,
};