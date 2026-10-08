import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { RecordsProvider } from './records/RecordsProvider';
import { mockReady, recoverMocks } from './mocks/browser';
import { configureNetwork } from './records/network';
import './styles.css';

const root = document.getElementById('root');
configureNetwork(mockReady, recoverMocks);
if (!root) throw new Error('Application root was not found.');
createRoot(root).render(<StrictMode><RecordsProvider><App /></RecordsProvider></StrictMode>);
