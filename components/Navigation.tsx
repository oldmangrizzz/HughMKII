import React from 'react';
import { AppMode } from '../types';

interface NavProps {
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
}

const NavItem = ({ mode, icon, label, current, onClick }: any) => (
  <button
    onClick={() => onClick(mode)}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      current === mode 
        ? 'bg-highland-900/40 text-highland-500 border border-highland-600/30' 
        : 'text-gray-400 hover:bg-grizzly-800 hover:text-gray-200'
    }`}
  >
    <span className="material-icons-outlined text-xl">{icon}</span>
    <span className="font-medium text-sm tracking-wide">{label}</span>
  </button>
);

export const Navigation: React.FC<NavProps> = ({ currentMode, setMode }) => {
  return (
    <div className="w-64 bg-grizzly-900 border-r border-grizzly-800 flex flex-col h-full p-4">
      <div className="mb-10 px-2 flex items-center space-x-3">
        <div className="w-10 h-10 bg-gradient-to-br from-highland-600 to-grizzly-800 rounded-lg flex items-center justify-center shadow-lg border border-highland-500/20">
            <span className="text-white font-bold text-xl font-mono">H</span>
        </div>
        <div>
            <h1 className="text-lg font-bold tracking-tight text-white font-mono">H.U.G.H.</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Guardian System</p>
        </div>
      </div>

      <nav className="space-y-1 flex-1 overflow-y-auto">
        <div className="text-[10px] font-bold text-gray-600 px-4 mb-2 uppercase tracking-widest">Command</div>
        <NavItem mode={AppMode.DASHBOARD} icon="account_tree" label="Mission Control" current={currentMode} onClick={setMode} />
        <NavItem mode={AppMode.CHAT} icon="chat" label="Comms Link" current={currentMode} onClick={setMode} />
        <NavItem mode={AppMode.HOME_CONTROL} icon="home_iot_device" label="Habitat Control" current={currentMode} onClick={setMode} />
        <NavItem mode={AppMode.SITUATIONAL_AWARENESS} icon="map" label="Harbormaster" current={currentMode} onClick={setMode} />
        
        <div className="text-[10px] font-bold text-gray-600 px-4 mt-6 mb-2 uppercase tracking-widest">Analysis</div>
        <NavItem mode={AppMode.VISUALIZER} icon="show_chart" label="Engineering" current={currentMode} onClick={setMode} />
        <NavItem mode={AppMode.MEDIA_STUDIO} icon="perm_media" label="Media Lab" current={currentMode} onClick={setMode} />
        <NavItem mode={AppMode.ANALYZER} icon="analytics" label="Analysis" current={currentMode} onClick={setMode} />
        
        <div className="pt-4 mt-4 border-t border-grizzly-800">
           <NavItem mode={AppMode.LIVE} icon="graphic_eq" label="Live Link" current={currentMode} onClick={setMode} />
           <NavItem mode={AppMode.SYSTEM} icon="settings_suggest" label="Architecture" current={currentMode} onClick={setMode} />
        </div>
      </nav>

      <div className="px-4 py-4 bg-grizzly-800/50 rounded-xl mt-auto border border-grizzly-700/50">
         <div className="flex items-center space-x-2 mb-1">
            <div className="w-2 h-2 bg-highland-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-400 font-mono">SOUL: ARAGON-1.0</span>
         </div>
      </div>
      
      <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet" />
    </div>
  );
};