import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Client, Provider, cacheExchange, fetchExchange } from 'urql';
import App from './App.jsx';
import { API_URL } from './config.js';
import './index.css';

const client = new Client({
  url: API_URL,
  exchanges: [cacheExchange, fetchExchange],
  fetchOptions: () => ({ credentials: 'omit' }),
  requestPolicy: 'cache-first',
});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider value={client}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
);