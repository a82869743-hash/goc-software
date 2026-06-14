import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './styles/globals.css';

// Initialize Theme (Force Light Mode, remove dark mode completely)
document.documentElement.classList.remove('dark');
localStorage.setItem('theme', 'light');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1A1C1C',
            color: '#E2E2E2',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '0.75rem',
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
          },
          success: {
            iconTheme: {
              primary: '#22C55E',
              secondary: '#1A1C1C',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#1A1C1C',
            },
          },
        }}
      />
    </BrowserRouter>
  </QueryClientProvider>
);
