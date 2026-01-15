import { useAuth } from "@clerk/clerk-react";
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import ErrorToast from "../components/ErrorToast";

const API_URL = import.meta.env.VITE_API_URL;

interface UserAPIKey {
    key: string;
}

// Determine API key limit based on subscription tier
const getAPIKeyLimit = (subscription: string | null): number => {
    if (!subscription || subscription === 'free') return 0; // Free tier
    if (subscription === '10k_requests') return 5; // 10k tier
    return -1; // 25k_requests or higher = unlimited
};

const getTierName = (subscription: string | null): string => {
    if (!subscription || subscription === 'free') return "Free";
    if (subscription === '10k_requests') return "Plus";
    return "Pro";
};

export default function UserAPIKeysPage() {
    const { getToken } = useAuth();
    const [apiKeys, setApiKeys] = useState<UserAPIKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentSubscription, setCurrentSubscription] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [newKey, setNewKey] = useState<string | null>(null);
    const [showNewKeyModal, setShowNewKeyModal] = useState(false);
    const [isClosingNewKeyModal, setIsClosingNewKeyModal] = useState(false);
    const [errorToast, setErrorToast] = useState<string | null>(null);
    const [copiedButtonId, setCopiedButtonId] = useState<string | null>(null);

    const apiKeyLimit = getAPIKeyLimit(currentSubscription);
    const canCreateKey = apiKeyLimit === -1 || apiKeys.length < apiKeyLimit;
    const tierName = getTierName(currentSubscription);

    const fetchUserData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const token = await getToken({ template: "default" });

            const res = await fetch(`${API_URL}/me`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json; charset=utf-8",
                },
                credentials: "include",
            });

            if (!res.ok) {
                throw new Error(`Failed to fetch user data: ${res.statusText}`);
            }

            const userData = await res.json();
            setCurrentSubscription(userData.currentSubscription ?? null);

            // API keys come from the /me endpoint as an array of strings
            const keys: UserAPIKey[] = (userData.apiKeys || []).map((key: string) => ({ key }));
            setApiKeys(keys);
        } catch (err) {
            setError((err as Error).message);
            console.error("Error fetching user data:", err);
        } finally {
            setLoading(false);
        }
    }, [getToken]);

    const refreshAPIKeys = useCallback(async () => {
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
                const keys: UserAPIKey[] = (userData.apiKeys || []).map((key: string) => ({ key }));
                setApiKeys(keys);
            }
        } catch (err) {
            console.error("Error refreshing API keys:", err);
        }
    }, [getToken]);

    useEffect(() => {
        fetchUserData();
    }, [fetchUserData]);

    const handleCreateKey = async () => {
        try {
            setCreating(true);
            const token = await getToken({ template: "default" });

            const res = await fetch(`${API_URL}/me/api-keys`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json; charset=utf-8",
                },
                credentials: "include",
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || `Failed to create API key: ${res.statusText}`);
            }

            const data = await res.json();

            // Show the new key in a modal (it's only shown once)
            setNewKey(data.key);
            setShowNewKeyModal(true);

            // Refresh the list
            refreshAPIKeys();
        } catch (err) {
            console.error("Error creating API key:", err);
            setErrorToast((err as Error).message || "Failed to create API key. Please try again.");
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteKey = async (key: string) => {
        if (!confirm("Are you sure you want to delete this API key? This action cannot be undone.")) {
            return;
        }

        try {
            const token = await getToken({ template: "default" });

            const res = await fetch(`${API_URL}/me/api-keys`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json; charset=utf-8",
                },
                credentials: "include",
                body: JSON.stringify({ key }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || `Failed to delete API key: ${res.statusText}`);
            }

            // Refresh the list
            refreshAPIKeys();
        } catch (err) {
            console.error("Error deleting API key:", err);
            setErrorToast((err as Error).message || "Failed to delete API key. Please try again.");
        }
    };

    const handleCopyToClipboard = async (text: string, buttonId: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedButtonId(buttonId);
            setTimeout(() => {
                setCopiedButtonId(null);
            }, 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
            setErrorToast("Failed to copy to clipboard. Please copy manually.");
        }
    };

    const handleCloseNewKeyModal = () => {
        setIsClosingNewKeyModal(true);
        setTimeout(() => {
            setShowNewKeyModal(false);
            setIsClosingNewKeyModal(false);
            setNewKey(null);
        }, 300);
    };

    // Mask the key for display (show first 6 characters only)
    const maskKey = (key: string): string => {
        if (key.length <= 6) return key;
        return `${key.slice(0, 6)}${'•'.repeat(Math.min(24, key.length - 6))}`;
    };

    return (
        <div className="homepage-container">
            {errorToast && (
                <ErrorToast
                    message={errorToast}
                    onClose={() => setErrorToast(null)}
                />
            )}

            {/* Header Section */}
            <header className="homepage-header">
                <h1 className="hero-title">API Keys</h1>
                <p className="hero-subtext">
                    Manage your personal ProxLock API keys for programmatic access.
                </p>
            </header>

            {/* Tier Info Banner */}
            <div className="api-keys-tier-banner">
                <div className="api-keys-tier-content">
                    <div className="api-keys-tier-info">
                        <span className="api-keys-tier-label">Current Plan:</span>
                        <span className="api-keys-tier-name">{tierName}</span>
                    </div>
                    <div className="api-keys-limit-info">
                        <span className="api-keys-limit-label">API Keys:</span>
                        <span className="api-keys-limit-value">
                            {apiKeys.length}/{apiKeyLimit === -1 ? "∞" : apiKeyLimit}
                        </span>
                    </div>
                    {apiKeyLimit === 0 && (
                        <Link to="/pricing" className="api-keys-upgrade-btn">
                            Upgrade to Create API Keys
                        </Link>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <main className="homepage-main">
                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading your API keys...</p>
                    </div>
                ) : error ? (
                    <div className="error-state">
                        <p className="error-message">{error}</p>
                        <button className="btn-solid" onClick={fetchUserData}>
                            Retry
                        </button>
                    </div>
                ) : apiKeyLimit === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🔐</div>
                        <h2>API Keys Unavailable</h2>
                        <p>Upgrade your plan to create personal API keys for programmatic access to ProxLock.</p>
                        <Link to="/pricing" className="btn-primary">
                            View Upgrade Options
                        </Link>
                    </div>
                ) : apiKeys.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🔑</div>
                        <h2>No API keys yet</h2>
                        <p>Create your first API key to get programmatic access to ProxLock.</p>
                        <button className="btn-primary" onClick={handleCreateKey} disabled={creating}>
                            {creating ? "Creating..." : "Create Your First API Key"}
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="projects-header">
                            <div className="projects-header-title">
                                <h2 className="section-title">Your API Keys</h2>
                                <span className="project-count-badge">{apiKeys.length}</span>
                            </div>
                            {canCreateKey && (
                                <button className="btn-primary" onClick={handleCreateKey} disabled={creating}>
                                    {creating ? "Creating..." : "+ Create API Key"}
                                </button>
                            )}
                        </div>
                        <div className="api-keys-list">
                            {apiKeys.map((apiKey, index) => (
                                <div key={index} className="api-key-card">
                                    <div className="api-key-info">
                                        <div className="api-key-value">
                                            <code>{maskKey(apiKey.key)}</code>
                                            <button
                                                className="api-key-copy-btn"
                                                onClick={() => handleCopyToClipboard(apiKey.key, `key-${index}`)}
                                                title="Copy full key"
                                            >
                                                {copiedButtonId === `key-${index}` ? (
                                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                ) : (
                                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                                                        <path d="M11 5V3.5C11 2.67157 10.3284 2 9.5 2H3.5C2.67157 2 2 2.67157 2 3.5V9.5C2 10.3284 2.67157 11 3.5 11H5" stroke="currentColor" strokeWidth="1.5" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    <button
                                        className="api-key-delete-btn"
                                        onClick={() => handleDeleteKey(apiKey.key)}
                                        title="Delete API key"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M2 4H14M5 4V3C5 2.44772 5.44772 2 6 2H10C10.5523 2 11 2.44772 11 3V4M12 4V13C12 13.5523 11.5523 14 11 14H5C4.44772 14 4 13.5523 4 13V4H12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        Delete
                                    </button>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </main>

            {/* Footer */}
            <footer className="page-footer">
                © {new Date().getFullYear()} ProxLock. All rights reserved.
            </footer>

            {/* New Key Display Modal */}
            {showNewKeyModal && newKey && (
                <div className={`modal-overlay ${isClosingNewKeyModal ? 'closing' : ''}`} onClick={handleCloseNewKeyModal}>
                    <div className={`modal-content ${isClosingNewKeyModal ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">API Key Created</h2>
                            <button className="modal-close-btn" onClick={handleCloseNewKeyModal}>
                                ×
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="modal-success">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M16.6667 5L7.5 14.1667L3.33333 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span>Your API key has been created successfully!</span>
                            </div>
                            <p className="modal-description">
                                Copy your API key now. For security reasons, it won't be shown again.
                            </p>
                            <div className="new-key-display">
                                <code>{newKey}</code>
                                <button
                                    className="api-key-copy-btn"
                                    onClick={() => handleCopyToClipboard(newKey, 'new-key')}
                                >
                                    {copiedButtonId === 'new-key' ? (
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    ) : (
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                                            <path d="M11 5V3.5C11 2.67157 10.3284 2 9.5 2H3.5C2.67157 2 2 2.67157 2 3.5V9.5C2 10.3284 2.67157 11 3.5 11H5" stroke="currentColor" strokeWidth="1.5" />
                                        </svg>
                                    )}
                                    {copiedButtonId === 'new-key' ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="btn-primary" onClick={handleCloseNewKeyModal}>
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
