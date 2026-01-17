import { useAuth } from "@clerk/clerk-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";

const API_URL = import.meta.env.VITE_API_URL;

interface UpgradeBannerProps {
  showUpgradeButton?: boolean;
}

export default function UpgradeBanner({ showUpgradeButton = true }: UpgradeBannerProps) {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
    const interval = setInterval(fetchUserData, 30000);
    return () => clearInterval(interval);
  }, [fetchUserData]);

  const isPricingPage = location.pathname === '/pricing';

  const shouldShowBanner = 
    !isPricingPage &&
    currentRequestUsage !== null &&
    requestLimit !== null &&
    requestLimit > 0 &&
    (currentRequestUsage / requestLimit) >= 0.9;

  if (!shouldShowBanner) {
    return null;
  }

  const remainingRequests = requestLimit - currentRequestUsage;
  const percentageRemaining = ((requestLimit - currentRequestUsage) / requestLimit) * 100;

  const handleUpgrade = () => {
    navigate("/pricing");
  };

  const classPrefix = showUpgradeButton ? "upgrade-banner" : "usage-alert";

  return (
    <div className={classPrefix}>
      <div className={`${classPrefix}-content`}>
        <div className={`${classPrefix}-icon`}>
          <span className="material-symbols-outlined">warning</span>
        </div>
        <div className={`${classPrefix}-text`}>
          <strong>Low Request Limit</strong>
          <span>
            You have {remainingRequests} request{remainingRequests !== 1 ? 's' : ''} remaining ({percentageRemaining.toFixed(0)}% left). 
            Upgrade your plan to get more requests.
          </span>
        </div>
        {showUpgradeButton && (
          <div className="upgrade-banner-actions">
            <button className="upgrade-banner-btn" onClick={handleUpgrade}>
              Upgrade Plan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

