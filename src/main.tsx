import { configure } from 'mobx';
import ReactDOM from 'react-dom/client';
import { redirectToCanonicalHost } from '@/components/shared/utils/config/config';
import { AuthWrapper } from './app/AuthWrapper';
// Removed AnalyticsInitializer import - analytics dependency removed
// See migrate-docs/ANALYTICS_IMPLEMENTATION_GUIDE.md for re-implementation
import { performVersionCheck } from './utils/version-check';
import './styles/index.scss';

// Configure MobX to handle multiple instances in production builds
configure({ isolateGlobalState: true });

// www.<domain> -> <domain> so the OAuth redirect always matches the URL registered with Deriv
if (!redirectToCanonicalHost()) {
    // Perform version check FIRST - before any other operations
    performVersionCheck();

    // Removed AnalyticsInitializer() call - analytics dependency removed

    ReactDOM.createRoot(document.getElementById('root')!).render(<AuthWrapper />);
}
