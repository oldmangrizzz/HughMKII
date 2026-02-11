
import React, { useState } from 'react';
import { generateImage, generateVideo, editImage } from '../services/geminiService';
import { GeminiModel } from '../types';

type Tab = 'image' | 'video' | 'edit';

export const MediaStudio: React.FC = () => {
    const [tab, setTab] = useState<Tab>('image');
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);

    // Image Options
    const [aspectRatio, setAspectRatio] = useState("1:1");
    const [size, setSize] = useState("1K");

    const handleGenerate = async () => {
        setLoading(true);
        setResultUrl(null);
        try {
            let url: string | null = null;
            if (tab === 'image') {
                url = await generateImage(prompt, aspectRatio, size, GeminiModel.PRO_IMAGE);
            } else if (tab === 'video') {
                // If uploading image for Veo, pass it (strip header)
                const cleanImage = uploadedImage ? uploadedImage.split(',')[1] : undefined;
                url = await generateVideo(prompt, aspectRatio === '9:16' ? '9:16' : '16:9', cleanImage);
            } else if (tab === 'edit' && uploadedImage) {
                // Remove header for editImage if present
                const cleanBase64 = uploadedImage.split(',')[1];
                url = await editImage(cleanBase64, prompt);
            }
            setResultUrl(url);
        } catch (e) {
            console.error(e);
            alert("Generation failed. Please ensure you have selected a Paid API Key (Pro/Veo models).");
        }
        setLoading(false);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                setUploadedImage(evt.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="h-full flex flex-col p-6">
            <h2 className="text-3xl font-bold text-white mb-6">Media Studio</h2>
            
            {/* Tabs */}
            <div className="flex space-x-1 bg-gray-900 p-1 rounded-lg w-fit mb-6">
                {(['image', 'video', 'edit'] as Tab[]).map(t => (
                    <button 
                        key={t}
                        onClick={() => { setTab(t); setResultUrl(null); setUploadedImage(null); }}
                        className={`px-6 py-2 rounded-md font-medium text-sm capitalize transition-all ${tab === t ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            <div className="flex gap-8 h-full min-h-0">
                {/* Controls */}
                <div className="w-80 flex flex-col space-y-4">
                    <textarea 
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-4 text-white focus:outline-none focus:border-blue-500 min-h-[120px]"
                        placeholder={tab === 'edit' ? "Describe changes (e.g. 'Add a retro filter')" : "Describe what you want to create..."}
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                    />

                    {/* Upload for Edit/Video */}
                    {(tab === 'edit' || tab === 'video') && (
                        <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 text-center hover:bg-gray-800/50 transition-colors relative">
                            <input type="file" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                            {uploadedImage ? (
                                <img src={uploadedImage} alt="Preview" className="h-32 mx-auto object-contain" />
                            ) : (
                                <div className="text-gray-500">
                                    <span className="material-icons-outlined block text-2xl mb-1">upload_file</span>
                                    <span className="text-sm">Upload Reference Image</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Options */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-500 uppercase font-bold">Aspect Ratio</label>
                            <select 
                                value={aspectRatio} 
                                onChange={e => setAspectRatio(e.target.value)}
                                className="w-full mt-1 bg-gray-800 text-white p-2 rounded border border-gray-700"
                            >
                                <option value="1:1">1:1 (Square)</option>
                                <option value="16:9">16:9 (Landscape)</option>
                                <option value="9:16">9:16 (Portrait)</option>
                                <option value="4:3">4:3</option>
                                <option value="3:4">3:4</option>
                                {/* Video strictly supports 16:9 or 9:16 usually, but for Image we allow more */}
                            </select>
                        </div>
                        {tab === 'image' && (
                        <div>
                            <label className="text-xs text-gray-500 uppercase font-bold">Resolution</label>
                            <select 
                                value={size} 
                                onChange={e => setSize(e.target.value)}
                                className="w-full mt-1 bg-gray-800 text-white p-2 rounded border border-gray-700"
                            >
                                <option value="1K">1K</option>
                                <option value="2K">2K (High)</option>
                                <option value="4K">4K (Ultra)</option>
                            </select>
                        </div>
                        )}
                    </div>

                    <button 
                        onClick={handleGenerate}
                        disabled={loading || !prompt}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-bold shadow-lg mt-4 disabled:opacity-50"
                    >
                        {loading ? 'Generating...' : `Generate ${tab}`}
                    </button>
                    
                    {loading && tab === 'video' && <p className="text-xs text-yellow-500 mt-2">Video generation takes a few minutes...</p>}
                </div>

                {/* Preview */}
                <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl flex items-center justify-center p-4">
                    {loading ? (
                        <div className="text-center">
                            <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-gray-500 animate-pulse">Creating masterpiece...</p>
                        </div>
                    ) : resultUrl ? (
                        tab === 'video' ? (
                            <video src={resultUrl} controls className="max-h-full max-w-full rounded-lg shadow-2xl" autoPlay loop />
                        ) : (
                            <img src={resultUrl} alt="Generated" className="max-h-full max-w-full rounded-lg shadow-2xl" />
                        )
                    ) : (
                        <div className="text-gray-700 flex flex-col items-center">
                            <span className="material-icons-outlined text-6xl opacity-20 mb-2">image</span>
                            <p className="opacity-40">Output will appear here</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
