import React, { useState } from 'react';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { Visualizer } from './components/Visualizer';
import { OmniChat } from './components/OmniChat';
import { MediaStudio } from './components/MediaStudio';
import { LiveSession } from './components/LiveSession';
import { SystemMod } from './components/SystemMod';
import { HomeControl } from './components/HomeControl';
import { MapboxView } from './components/MapboxView';
import { AppMode } from './types';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.DASHBOARD);

  const renderContent = () => {
    switch (mode) {
      case AppMode.DASHBOARD: return <Dashboard />;
      case AppMode.CHAT: return <OmniChat />;
      case AppMode.VISUALIZER: return <Visualizer />;
      case AppMode.MEDIA_STUDIO: return <MediaStudio />;
      case AppMode.LIVE: return <LiveSession />;
      case AppMode.SYSTEM: return <SystemMod />;
      case AppMode.HOME_CONTROL: return <HomeControl />;
      case AppMode.SITUATIONAL_AWARENESS: return <MapboxView />;
      case AppMode.ANALYZER: return <div className="p-8 text-gray-500">Analyzer Module Loading...</div>;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-grizzly-900 overflow-hidden text-gray-200">
      <Navigation currentMode={mode} setMode={setMode} />
      <main className="flex-1 h-full min-w-0 bg-black/20 relative">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;