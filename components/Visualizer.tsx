import React, { useState } from 'react';
import { generateVisualization } from '../services/geminiService';
import { VisualizationData } from '../types';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';

export const Visualizer: React.FC = () => {
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<VisualizationData | null>(null);

    const handleVisualize = async () => {
        setLoading(true);
        try {
            const result = await generateVisualization(prompt);
            setData(result);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const renderChart = () => {
        if (!data) return null;
        const CommonProps = { data: data.data, margin: { top: 5, right: 30, left: 20, bottom: 5 } };

        switch (data.type) {
            case 'bar':
                return (
                    <BarChart {...CommonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey={data.xAxisKey} stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
                        <Legend />
                        <Bar dataKey="value" fill="#3b82f6" />
                    </BarChart>
                );
            case 'scatter':
                return (
                    <ScatterChart {...CommonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis type="number" dataKey="x" name="stature" unit="cm" stroke="#9ca3af" />
                        <YAxis type="number" dataKey="y" name="weight" unit="kg" stroke="#9ca3af" />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
                        <Scatter name={data.title} data={data.data} fill="#8884d8" />
                    </ScatterChart>
                );
            case 'line':
            default:
                return (
                    <LineChart {...CommonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey={data.xAxisKey} stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
                        <Legend />
                        <Line type="monotone" dataKey="value" stroke="#8b5cf6" activeDot={{ r: 8 }} />
                    </LineChart>
                );
        }
    };

    return (
        <div className="h-full flex flex-col p-8">
            <div className="mb-6">
                <h2 className="text-3xl font-bold text-white">Physics & Engineering Visualizer</h2>
                <div className="flex gap-4 mt-4">
                    <input 
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white" 
                        placeholder="Describe a concept (e.g., 'Projectile motion trajectory' or 'Stress-strain curve of steel')"
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                    />
                    <button 
                        onClick={handleVisualize} 
                        disabled={loading}
                        className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg font-medium"
                    >
                        {loading ? "Generating Data..." : "Visualize"}
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-gray-900 rounded-2xl border border-gray-800 p-6 flex items-center justify-center relative overflow-hidden">
                {loading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10"><div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full"></div></div>}
                
                {data ? (
                    <div className="w-full h-full flex flex-col">
                        <h3 className="text-xl font-bold text-center mb-4 text-gray-200">{data.title}</h3>
                        <div className="flex-1 w-full min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                {renderChart()!}
                            </ResponsiveContainer>
                        </div>
                        <p className="mt-4 text-center text-gray-400 text-sm max-w-2xl mx-auto">{data.description}</p>
                    </div>
                ) : (
                    <div className="text-center text-gray-600">
                        <span className="material-icons-outlined text-6xl mb-4">query_stats</span>
                        <p>Enter a prompt to visualize real-world data.</p>
                    </div>
                )}
            </div>
        </div>
    );
};