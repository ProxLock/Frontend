import { useAuth } from "@clerk/clerk-react";
import { useState, useEffect, useCallback } from "react";
import type { WebSocketUsage } from "../types";

const API_URL = import.meta.env.VITE_API_URL;

export default function UsageAlert() {
    const { getToken } = useAuth();
    const [currentRequestUsage, setCurrentRequestUsage] = useState<number | null>(null);
    const [requestLimit, setRequestLimit] = useState<number | null>(null);
    const [wsUsage, setWsUsage] = useState<WebSocketUsage | null>(null);

    const fetchUserData = useCallback(async () => {
        try {
            const token = await getToken({ template: "default" });

            const res = await fetch(`${API_URL}/me`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json; charset=utf-8",
                },
                credentials: "include",
            });

            if (res.ok) {
                const userData = await res.json();
                setCurrentRequestUsage(userData.currentRequestUsage ?? null);
                setRequestLimit(userData.requestLimit ?? null);
                setWsUsage(userData.currentWebSocketUsage ?? null);
            }
        } catch (err) {
            console.error("Error fetching user data:", err);
        }
    }, [getToken]);

    useEffect(() => {
        fetchUserData();
        // Refresh every 30 seconds to keep usage up to date
        const interval = setInterval(fetchUserData, 30000);
        return () => clearInterval(interval);
    }, [fetchUserData]);

    // Check HTTP request alert
    const httpNearLimit =
        currentRequestUsage !== null &&
        requestLimit !== null &&
        requestLimit > 0 &&
        (currentRequestUsage / requestLimit) >= 0.9;

    // Check WebSocket connection-seconds alert
    const wsConnNearLimit =
        wsUsage !== null &&
        wsUsage.connectionSecondLimit > 0 &&
        (wsUsage.connectionSeconds / wsUsage.connectionSecondLimit) >= 0.9;

    // Check WebSocket message-units alert
    const wsMsgNearLimit =
        wsUsage !== null &&
        wsUsage.messageUnitLimit > 0 &&
        (wsUsage.messageUnits / wsUsage.messageUnitLimit) >= 0.9;

    const shouldShowAlert = httpNearLimit || wsConnNearLimit || wsMsgNearLimit;

    if (!shouldShowAlert) {
        return null;
    }

    return (
        <div className="usage-alert">
            <div className="usage-alert-content">
                <div className="usage-alert-icon">
                    <span className="material-symbols-outlined">warning</span>
                </div>
                <div className="usage-alert-text">
                    <strong>Approaching Usage Limits</strong>
                    <div className="usage-alert-items">
                        {httpNearLimit && requestLimit !== null && currentRequestUsage !== null && (
                            <span>
                                HTTP Requests: {(requestLimit - currentRequestUsage).toLocaleString()} remaining ({((requestLimit - currentRequestUsage) / requestLimit * 100).toFixed(0)}% left)
                            </span>
                        )}
                        {wsConnNearLimit && wsUsage && (
                            <span>
                                WS Connection: {Math.round((wsUsage.connectionSecondLimit - wsUsage.connectionSeconds) / 60).toLocaleString()} min remaining ({((wsUsage.connectionSecondLimit - wsUsage.connectionSeconds) / wsUsage.connectionSecondLimit * 100).toFixed(0)}% left)
                            </span>
                        )}
                        {wsMsgNearLimit && wsUsage && (
                            <span>
                                WS Messages: {(wsUsage.messageUnitLimit - wsUsage.messageUnits).toLocaleString()} remaining ({((wsUsage.messageUnitLimit - wsUsage.messageUnits) / wsUsage.messageUnitLimit * 100).toFixed(0)}% left)
                            </span>
                        )}
                        <span className="usage-alert-cta">Upgrade your plan to increase limits.</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
