import { SystemConfig } from "../types";

const getConfig = (): SystemConfig => {
    return JSON.parse(localStorage.getItem('hugh_system_config') || '{}');
};

export const fetchHAStates = async () => {
    const config = getConfig();
    if (!config.homeAssistantUrl || !config.homeAssistantToken) return [];

    try {
        const response = await fetch(`${config.homeAssistantUrl}/api/states`, {
            headers: {
                'Authorization': `Bearer ${config.homeAssistantToken}`,
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            console.warn(`[H.U.G.H. HA Link] Fetch failed with status: ${response.status}`);
            return [];
        }
        return await response.json();
    } catch (e) {
        console.error("[H.U.G.H. HA Link] Connection Error (Check CORS/Network):", e);
        return [];
    }
};

export const callHAService = async (domain: string, service: string, entity_id: string) => {
    const config = getConfig();
    if (!config.homeAssistantUrl || !config.homeAssistantToken) return;

    try {
        const response = await fetch(`${config.homeAssistantUrl}/api/services/${domain}/${service}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.homeAssistantToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ entity_id }),
        });
        if (!response.ok) {
            console.warn(`[H.U.G.H. HA Link] Service call failed: ${response.status}`);
        }
    } catch (e) {
        console.error("[H.U.G.H. HA Link] Service Call Error:", e);
    }
};