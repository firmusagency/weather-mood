import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AccuracyApp } from './AccuracyApp';
import '../styles.css';
import './accuracy.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccuracyApp />
  </StrictMode>,
);
