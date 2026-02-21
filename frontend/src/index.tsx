import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// Apply saved theme before first render to prevent flash
const savedTheme = localStorage.getItem('selene-theme');
if (savedTheme === 'dark' || savedTheme === 'light') {
  document.documentElement.setAttribute('data-theme', savedTheme);
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
