import '@builder.io/qwik/qwikloader.js';
import { render } from '@builder.io/qwik';
import './index.css';
import { App } from './app.tsx';

if (import.meta.env.DEV && window.location.pathname.startsWith('/studio')) {
  import('./studio/StudioScreen').then(({ StudioScreen }) => {
    render(document.getElementById('app') as HTMLElement, <StudioScreen />);
  });
} else {
  render(document.getElementById('app') as HTMLElement, <App />);
}
