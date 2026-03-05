import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useUserContext } from "../contexts/UserContext";

const API_URL = import.meta.env.VITE_API_URL;
const LANDING_URL = "https://proxlock.dev"; // Adjust if needed
const REQUIRED_TOS_EPOCH = Number(import.meta.env.VITE_TOS_EPOCH_DATE) || 0; // Epoch in seconds/ms as provided by the user

export default function TOSModal() {
    const { user, loading, refreshUser } = useUserContext();
    const { getToken } = useAuth();
    const [isAccepting, setIsAccepting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // If still loading or user has accepted a TOS version newer than or equal to the required one
    // user.lastAcceptedTOS is compared against REQUIRED_TOS_EPOCH 
    const hasAcceptedLatestTOS = typeof user?.lastAcceptedTOS === 'number' && user.lastAcceptedTOS >= REQUIRED_TOS_EPOCH;
    
    console.log("hasAcceptedLatestTOS", hasAcceptedLatestTOS);
    console.log("REQUIRED_TOS_EPOCH", REQUIRED_TOS_EPOCH);

    if (loading || !user || hasAcceptedLatestTOS) {
        return null;
    }

    const handleAcceptTOS = async () => {
        setIsAccepting(true);
        setError(null);
        
        try {
            const token = await getToken({ template: "default" });
            const res = await fetch(`${API_URL}/me/accept-tos`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || "Failed to accept Terms of Service");
            }

            // Refresh user data to update hasAcceptedTOS and auto-hide this modal
            await refreshUser();
            window.location.reload();
        } catch (err) {
            console.error("Error accepting TOS:", err);
            setError((err as Error).message || "An error occurred while accepting the Terms of Service. Please try again.");
            setIsAccepting(false);
        }
    };

    return (
        <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "var(--bg-modal)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999, // ensures it sits above everything
            backdropFilter: "blur(4px)"
        }}>
            <div style={{
                backgroundColor: "var(--bg-card)",
                borderRadius: "12px",
                padding: "2.5rem 2rem",
                maxWidth: "500px",
                width: "90%",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
                border: "1px solid var(--border-default)",
                textAlign: "center"
            }}>
                <h2 style={{ marginBottom: "1rem", color: "var(--text-primary)", fontSize: "1.75rem", fontWeight: 700 }}>
                    Terms of Service Update
                </h2>
                
                <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem", lineHeight: "1.5", fontSize: "1.05rem" }}>
                    Before you continue to your dashboard, please review and accept our updated Terms of Service. 
                    This is required to use the ProxLock platform.
                </p>

                <a 
                    href={`${LANDING_URL}/terms`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ 
                        color: "var(--accent-purple-1)", 
                        textDecoration: "underline",
                        marginBottom: "2.5rem",
                        display: "inline-block",
                        fontWeight: 600,
                        fontSize: "1.05rem"
                    }}
                >
                    View the Terms of Service
                </a>

                {error && (
                    <div style={{ 
                        color: "var(--color-error)", 
                        backgroundColor: "var(--color-error-bg)", 
                        border: "1px solid var(--color-error-border)",
                        padding: "0.75rem", 
                        borderRadius: "6px", 
                        marginBottom: "1.5rem",
                        fontSize: "0.9rem",
                        textAlign: "left"
                    }}>
                        {error}
                    </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <button 
                        onClick={handleAcceptTOS} 
                        disabled={isAccepting}
                        className="btn-solid"
                        style={{
                            padding: "0.85rem",
                            width: "100%",
                            cursor: isAccepting ? "not-allowed" : "pointer",
                            opacity: isAccepting ? 0.7 : 1,
                            fontSize: "1.05rem"
                        }}
                    >
                        {isAccepting ? "Accepting..." : "I Accept the Terms of Service"}
                    </button>
                    {/* Note: No dismiss button is provided to ensure mandatory acceptance */}
                </div>
            </div>
        </div>
    );
}
