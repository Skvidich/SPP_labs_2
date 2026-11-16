import gqlTag from 'graphql-tag';

const { gql } = gqlTag;

export const typeDefs = gql`
  type Query {
    artists(
      search: String
      source: Source
      sort: SortInput
      page: PageInput
    ): [Artist!]!
    artist(id: ID!): Artist
    tracks(
      search: String
      source: Source
      sort: SortInput
      page: PageInput
    ): [Track!]!
    track(id: ID!): Track
  }

  enum ItemType {
    artist
    track
  }

  enum Source {
    musicbrainz
    itunes
    audius
  }

  enum SortDirection {
    asc
    desc
  }

  input SortInput {
    field: String!
    direction: SortDirection = asc
  }

  input PageInput {
    limit: Int = 20
    offset: Int = 0
  }

  scalar DateTime
  scalar JSON

  "Федеративная сущность каталога: единый объект исполнителя или трека, на который ссылается Collections Service по id."
  type Item @key(fields: "id") {
    id: ID!
    type: ItemType!
    title: String!
    source: Source!
    sourceId: String!
    description: String
    url: String
    metadata: JSON!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Artist {
    id: ID!
    type: ItemType!
    title: String!
    source: Source!
    sourceId: String!
    description: String
    url: String
    metadata: JSON!
    createdAt: DateTime!
    updatedAt: DateTime!
    tracks: [Track!]!
  }

  type Track {
    id: ID!
    type: ItemType!
    title: String!
    source: Source!
    sourceId: String!
    description: String
    url: String
    metadata: JSON!
    createdAt: DateTime!
    updatedAt: DateTime!
  }
`;