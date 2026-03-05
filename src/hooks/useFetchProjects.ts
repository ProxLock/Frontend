import { useState, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { Project } from "../types";
import { useUserContext } from "../contexts/UserContext";

const API_URL = import.meta.env.VITE_API_URL;

export function useFetchProjects() {
  const { getToken } = useAuth();
  const { hasAcceptedLatestTOS, error: userError } = useUserContext();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!hasAcceptedLatestTOS && !userError) {
      // Keep loading as true, do not fetch projects or show error if TOS is not accepted yet
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = await getToken({ template: "default" });

      const res = await fetch(`${API_URL}/me/projects`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch projects: ${res.statusText}`);
      }

      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      setError((err as Error).message);
      console.error("Error fetching projects:", err);
    } finally {
      setLoading(false);
    }
  }, [getToken, hasAcceptedLatestTOS, userError]);

  return { projects, loading, error, fetchProjects };
}
