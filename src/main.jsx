import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import App, { RenderBoundary } from './App.jsx';
import './styles/index.css';

const native = Capacitor.isNativePlatform();
const Router = native ? HashRouter : BrowserRouter;
createRoot(document.getElementById('root')).render(<StrictMode><RenderBoundary><Router><App native={native} /></Router></RenderBoundary></StrictMode>);
