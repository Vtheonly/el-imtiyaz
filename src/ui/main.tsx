/**
 * Renderer entry — mounts React with the router, store, and global providers.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { HashRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import './styles/global.css';
import './styles/components.css';

import { App } from './App';
import { store } from './state/store';
import { UndoManager } from './components/undo/UndoManager';

const container = document.getElementById('root')!;
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <HashRouter>
        <UndoManager>
          <App />
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--bg-elevated, #1e1f20)',
                color: 'var(--color-text-primary, #eff2f3)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                fontSize: '14px',
                padding: '12px 16px'
              },
              success: { iconTheme: { primary: '#3fa66e', secondary: '#fff' } },
              error: { iconTheme: { primary: '#c0504d', secondary: '#fff' } }
            }}
          />
        </UndoManager>
      </HashRouter>
    </Provider>
  </React.StrictMode>
);
