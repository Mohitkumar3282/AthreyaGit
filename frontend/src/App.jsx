import { Suspense, useState } from 'react';
import AppRouter from '@core/routes/AppRouter';
import { AuthProvider } from '@core/context/AuthContext';
import { SettingsProvider } from '@core/context/SettingsContext';
import { SupportUnreadProvider } from '@core/context/SupportUnreadContext';
import SeoHead from '@core/components/SeoHead';
import { ToastProvider } from './shared/components/ui/Toast';
import Loader from './shared/components/ui/Loader';
import ErrorBoundary from './shared/components/ErrorBoundary';
import LenisScroll from './shared/components/LenisScroll';
import SplashScreen from './components/shared/SplashScreen';

function App() {
    const [showSplash, setShowSplash] = useState(true);

    return (
        <ErrorBoundary>
            <AuthProvider>
                <SettingsProvider>
                    <SeoHead />
                    <ToastProvider>
                        <Suspense fallback={<Loader fullScreen />}>
                            <SupportUnreadProvider>
                                <LenisScroll />
                                <AppRouter />
                                <svg className="sr-only" width="0" height="0" style={{ position: 'absolute', width: 0, height: 0 }}>
                                    <defs>
                                        <filter id="logo-yellow-watch-green-rider">
                                            <feColorMatrix type="matrix" values="1.3 0 -1.2 0 0  0 1.25 -0.82 0 0  0.28 0 -0.10 0 0  0 0 0 1.0 0" />
                                        </filter>
                                    </defs>
                                </svg>
                                {showSplash && (
                                    <SplashScreen onFinished={() => setShowSplash(false)} />
                                )}
                            </SupportUnreadProvider>
                        </Suspense>
                    </ToastProvider>
                </SettingsProvider>
            </AuthProvider>
        </ErrorBoundary>
    );
}

export default App;
