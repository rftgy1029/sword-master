import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import GameErrorBoundary from './components/GameErrorBoundary.jsx';
import '../styles.css';
import './styles/premium.css';
import './styles/dusk.css';

createRoot(document.getElementById('root')).render(
  <StrictMode><GameErrorBoundary><App /></GameErrorBoundary></StrictMode>,
);
