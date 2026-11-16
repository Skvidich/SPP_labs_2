import gqlTag from 'graphql-tag';

const { gql } = gqlTag;

export const typeDefs = gql`
  type Query {
    collections(
      search: String
      sort: SortInput
      page: PageInput
    ): [Collection!]!
    collection(id: ID!): Collection
  }

  type Mutation {
    createCollection(input: CreateCollectionInput!): Collection!
    updateCollection(id: ID!, input: UpdateCollectionInput!): Collection!
    deleteCollection(id: ID!): Boolean!
    addItemToCollection(collectionId: ID!, itemId: ID!): Collection!
    removeItemFromCollection(collectionId: ID!, itemId: ID!): Collection!
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

  input CreateCollectionInput {
    title: String!
    description: String
  }

  input UpdateCollectionInput {
    title: String
    description: String
  }

  scalar DateTime

  "Федеративная сущность подборки: владеет полями Collection только Collections Service."
  type Collection @key(fields: "id") {
    id: ID!
    title: String!
    description: String
    createdAt: DateTime!
    updatedAt: DateTime!
    items: [Item!]!
  }

  "Федеративная ссылка на объект каталога. Поля Item принадлежат Catalog Service; здесь только ключ id для объединения Gateway."
  type Item @key(fields: "id") {
    id: ID!
  }
`;