import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { useAuth, useUser as useClerkUser } from "@clerk/clerk-react";
import type { User } from "../types";

const API_URL = import.meta.env.VITE_API_URL;

interface UserContextType {
    user: User | null;
    loading: boolean;
    error: string | null;
    refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function useUserContext() {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error("useUserContext must be used within UserProvider");
    }
    return context;
}

interface UserProviderProps {
    children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
    const { getToken } = useAuth();
    const { user: clerkUser } = useClerkUser();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchUser = useCallback(async () => {
        try {
            // Don't set loading to true here to avoid flickering on refresh
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

                // Merge Clerk user data if needed for display name/email as fallback
                const mergedUser: User = {
                    ...userData,
                    fullName: userData.fullName || clerkUser?.fullName,
                    primaryEmailAddress: userData.primaryEmailAddress || {
                        emailAddress: clerkUser?.primaryEmailAddress?.emailAddress || ""
                    }
                };

                setUser(mergedUser);
                setError(null);
            } else {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || `Failed to fetch user data: ${res.statusText}`);
            }
        } catch (err) {
            console.error("Error fetching user data:", err);
            setError((err as Error).message || "Failed to load user data");
        } finally {
            setLoading(false);
        }
    }, [getToken, clerkUser]);

    useEffect(() => {
        if (clerkUser) {
            fetchUser();
        }
    }, [fetchUser, clerkUser]);

    return (
        <UserContext.Provider value={{ user, loading, error, refreshUser: fetchUser }}>
            {children}
        </UserContext.Provider>
    );
}
