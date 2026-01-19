import { useAuth } from "@clerk/clerk-react";
import { useState, useEffect, useCallback } from "react";

const API_URL = import.meta.env.VITE_API_URL;

export default function UsageAlert() {
    const { getToken } = useAuth();
    const [currentRequestUsage, setCurrentRequestUsage] = useState<number | null>(null);
    const [requestLimit, setRequestLimit] = useState<number | null>(null);

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

    // Check if we should show the alert (less than 10% remaining)
    const shouldShowAlert =
        currentRequestUsage !== null &&
        requestLimit !== null &&
        requestLimit > 0 &&
        (currentRequestUsage / requestLimit) >= 0.9;

    if (!shouldShowAlert) {
        return null;
    }

    const remainingRequests = requestLimit - currentRequestUsage;
    const percentageRemaining = ((requestLimit - currentRequestUsage) / requestLimit) * 100;

    return (
        <div className="usage-alert">
            <div className="usage-alert-content">
                <div className="usage-alert-icon">
                    <span className="material-symbols-outlined">warning</span>
                </div>
                <div className="usage-alert-text">
                    <strong>Low Request Limit</strong>
                    <span>
                        You have {remainingRequests} request{remainingRequests !== 1 ? 's' : ''} remaining ({percentageRemaining.toFixed(0)}% left).
                        Upgrade your plan to get more requests.
                    </span>
                </div>
            </div>
        </div>
    );
}


