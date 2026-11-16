import { GraphQLScalarType, Kind } from 'graphql';
import { findArtistById, findItemById, findTrackById, listArtists, listTracks, listTracksByArtist } from './repository.js';
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

const JSON = new GraphQLScalarType({
  name: 'JSON',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: (ast) => {
    switch (ast.kind) {
      case Kind.STRING:
      case Kind.BOOLEAN:
        return ast.value;
      case Kind.INT:
      case Kind.FLOAT:
        return Number(ast.value);
      case Kind.OBJECT: {
        const out = {};
        for (const field of ast.fields) out[field.name.value] = field.value;
        return out;
      }
      case Kind.LIST:
        return ast.values;
      case Kind.NULL:
        return null;
      default:
        return null;
    }
  },
});

export const resolvers = {
  Query: {
    artists: (_root, args, ctx) =>
      tracePhase('resolver', 'artists', () => listArtists(args), ctx?.__otelParentContext),
    artist: (_root, { id }, ctx) =>
      tracePhase('resolver', 'artist', () => findArtistById(id), ctx?.__otelParentContext),
    tracks: (_root, args, ctx) =>
      tracePhase('resolver', 'tracks', () => listTracks(args), ctx?.__otelParentContext),
    track: (_root, { id }, ctx) =>
      tracePhase('resolver', 'track', () => findTrackById(id), ctx?.__otelParentContext),
  },
  Artist: {
    tracks: (artist, _args, ctx) =>
      tracePhase('resolver', 'artist.tracks', () => listTracksByArtist(artist.id), ctx?.__otelParentContext),
  },
  Item: {
    __resolveReference: (reference, ctx) =>
      tracePhase('resolver', 'Item.reference', () => findItemById(reference.id), ctx?.__otelParentContext),
  },
  DateTime,
  JSON,
};