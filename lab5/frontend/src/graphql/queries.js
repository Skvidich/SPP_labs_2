import { gql } from 'urql';

export const ARTISTS_QUERY = gql`
  query Artists($search: String, $source: Source, $sort: SortInput, $page: PageInput) {
    artists(search: $search, source: $source, sort: $sort, page: $page) {
      id
      type
      title
      source
      description
      url
      createdAt
      tracks {
        id
        title
      }
    }
  }
`;

export const ARTIST_QUERY = gql`
  query Artist($id: ID!) {
    artist(id: $id) {
      id
      type
      title
      source
      sourceId
      description
      url
      metadata
      createdAt
      updatedAt
      tracks {
        id
        type
        title
        source
        sourceId
        description
        url
        createdAt
      }
    }
  }
`;

export const TRACKS_QUERY = gql`
  query Tracks($search: String, $source: Source, $sort: SortInput, $page: PageInput) {
    tracks(search: $search, source: $source, sort: $sort, page: $page) {
      id
      type
      title
      source
      description
      url
      createdAt
    }
  }
`;

export const COLLECTIONS_QUERY = gql`
  query Collections($search: String, $sort: SortInput, $page: PageInput) {
    collections(search: $search, sort: $sort, page: $page) {
      id
      title
      description
      createdAt
      updatedAt
      items {
        id
        type
        title
        source
      }
    }
  }
`;

export const CREATE_COLLECTION = gql`
  mutation CreateCollection($input: CreateCollectionInput!) {
    createCollection(input: $input) {
      id
      title
      description
      createdAt
      items {
        id
        type
        title
      }
    }
  }
`;

export const UPDATE_COLLECTION = gql`
  mutation UpdateCollection($id: ID!, $input: UpdateCollectionInput!) {
    updateCollection(id: $id, input: $input) {
      id
      title
      description
      updatedAt
      items {
        id
        type
        title
      }
    }
  }
`;

export const DELETE_COLLECTION = gql`
  mutation DeleteCollection($id: ID!) {
    deleteCollection(id: $id)
  }
`;

export const ADD_ITEM_TO_COLLECTION = gql`
  mutation AddItemToCollection($collectionId: ID!, $itemId: ID!) {
    addItemToCollection(collectionId: $collectionId, itemId: $itemId) {
      id
      title
      items {
        id
        type
        title
      }
    }
  }
`;

export const REMOVE_ITEM_FROM_COLLECTION = gql`
  mutation RemoveItemFromCollection($collectionId: ID!, $itemId: ID!) {
    removeItemFromCollection(collectionId: $collectionId, itemId: $itemId) {
      id
      title
      items {
        id
        type
        title
      }
    }
  }
`;