import React, { useEffect, useState } from 'react';
import { fetchHAStates, callHAService } from '../services/homeAssistant';

export const HomeControl: React.FC = () => {
    const [entities, setEntities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const refresh = async () => {
        setLoading(true);
        const states = await fetchHAStates();
        if (states.length === 0) {
            setError("Could not fetch entities. Check configuration in 'Architecture'.");
        } else {
            setError('');
            // Filter for interesting domains
            const relevant = states.filter((s: any) => 
                s.entity_id.startsWith('light.') || 
                s.entity_id.startsWith('switch.') || 
                s.entity_id.startsWith('sensor.') ||
                s.entity_id.startsWith('climate.')
            );
            setEntities(relevant);
        }
        setLoading(false);
    };

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    const toggleDevice = async (entity: any) => {
        const service = entity.state === 'on' ? 'turn_off' : 'turn_on';
        const domain = entity.entity_id.split('.')[0];
        await callHAService(domain, service, entity.entity_id);
        setTimeout(refresh, 500); // Quick refresh after action
    };

    return (
        <div className="h-full p-8 overflow-y-auto bg-grizzly-900">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-white font-mono">Habitat Control</h2>
                    <p className="text-gray-400">Home Assistant Integration Link</p>
                </div>
                <button onClick={refresh} className="p-2 bg-grizzly-800 rounded-lg hover:bg-grizzly-700 text-gray-300">
                    <span className="material-icons-outlined">refresh</span>
                </button>
            </header>

            {error && (
                <div className="bg-red-900/20 border border-red-800 text-red-400 p-4 rounded-lg mb-6">
                    {error}
                </div>
            )}

            {loading && entities.length === 0 ? (
                <div className="text-center text-gray-500 mt-20">Scanning habitat frequencies...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {entities.map(ent => (
                        <div key={ent.entity_id} className="bg-grizzly-800 border border-grizzly-700 rounded-xl p-4 flex flex-col justify-between hover:border-highland-500/30 transition-all">
                            <div className="flex justify-between items-start">
                                <div className="p-2 bg-grizzly-900 rounded-lg text-gray-300">
                                    <span className="material-icons-outlined">
                                        {ent.entity_id.startsWith('light') ? 'lightbulb' : 
                                         ent.entity_id.startsWith('sensor') ? 'sensors' : 'toggle_on'}
                                    </span>
                                </div>
                                <div className={`text-xs px-2 py-1 rounded font-bold uppercase ${
                                    ent.state === 'on' ? 'bg-highland-900 text-highland-300' : 'bg-grizzly-900 text-gray-500'
                                }`}>
                                    {ent.state}
                                </div>
                            </div>
                            
                            <div className="mt-4">
                                <h4 className="font-bold text-gray-200 truncate">{ent.attributes.friendly_name || ent.entity_id}</h4>
                                <p className="text-xs text-gray-500 font-mono">{ent.entity_id}</p>
                            </div>

                            {!ent.entity_id.startsWith('sensor') && (
                                <button 
                                    onClick={() => toggleDevice(ent)}
                                    className="mt-4 w-full py-2 rounded-lg bg-grizzly-700 hover:bg-grizzly-600 text-sm font-medium text-gray-300 transition-colors"
                                >
                                    Toggle
                                </button>
                            )}
                            
                            {ent.entity_id.startsWith('sensor') && (
                                <div className="mt-4 text-2xl font-bold text-white">
                                    {ent.state} <span className="text-sm text-gray-500">{ent.attributes.unit_of_measurement}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};