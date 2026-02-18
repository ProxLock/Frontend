import { useAuth } from "@clerk/clerk-react";
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useProjectsContext } from "../contexts/ProjectsContext";
import { useUserContext } from "../contexts/UserContext";
import ErrorToast from "../components/ErrorToast";
import { parseKeyParams, buildKeyParamsUrl } from "../utils/keyParams";
import type { Project } from "../types";

const API_URL = import.meta.env.VITE_API_URL;

export default function CreateKeyPage() {
  const { getToken } = useAuth();
  const { user } = useUserContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshProjects } = useProjectsContext();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [projectFormData, setProjectFormData] = useState({
    name: "",
    description: "",
  });
  const [creating, setCreating] = useState(false);

  // Parse query parameters for key creation
  const keyParams = parseKeyParams(searchParams);
  const { name: keyName, key: keyValue, allowsWeb, whitelistedUrls, rateLimit } = keyParams;

  const fetchProjects = useCallback(async () => {
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
  }, [getToken]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check project limit
    if (user?.projectLimit !== undefined && projects.length >= user.projectLimit) {
      if (confirm(`You have reached your limit of ${user.projectLimit} projects. Upgrade your plan to create more.`)) {
        navigate("/pricing");
      }
      return;
    }

    try {
      setCreating(true);
      const token = await getToken({ template: "default" });

      const res = await fetch(`${API_URL}/me/projects`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "include",
        body: JSON.stringify({
          name: projectFormData.name,
          description: projectFormData.description || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to create project: ${res.statusText}`);
      }

      const newProject = await res.json();

      // Refresh projects list
      await fetchProjects();
      
      // Refresh sidebar
      refreshProjects();

      // Close modal
      handleCloseModal();

      // Navigate to the new project with query params
      if (newProject.id) {
        const params = buildKeyParamsUrl(keyParams, true);
        navigate(`/projects/${newProject.id}?${params}`);
      }
    } catch (err) {
      console.error("Error creating project:", err);
      setErrorToast((err as Error).message || "Failed to create project. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleCloseModal = () => {
    setIsClosingModal(true);
    setTimeout(() => {
      setShowCreateProjectModal(false);
      setIsClosingModal(false);
      setProjectFormData({ name: "", description: "" });
    }, 300);
  };

  const handleSelectProject = (projectId: string) => {
    const params = buildKeyParamsUrl(keyParams, true);
    navigate(`/projects/${projectId}?${params}`);
  };

  return (
    <div className="homepage-container">
      {errorToast && (
        <ErrorToast
          message={errorToast}
          onClose={() => setErrorToast(null)}
        />
      )}
      
      <header className="homepage-header">
        <h1 className="hero-title">Create New API Key</h1>
        <p className="hero-subtext">
          Select a project to add your API key to, or create a new project.
        </p>
      </header>

      {/* Show parsed parameters if any */}
      {(keyName || keyValue || whitelistedUrls.length > 0 || rateLimit > 0) && (
        <div className="beta-banner" style={{ marginBottom: "2rem" }}>
          <div className="beta-banner-content">
            <div className="beta-banner-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 1L12.5 6.5L18.5 7.5L14 11.5L15 17.5L10 14.5L5 17.5L6 11.5L1.5 7.5L7.5 6.5L10 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <div className="beta-banner-text">
              <strong>Key Details Ready</strong>
              <span>
                {keyName && `Name: ${keyName}. `}
                {whitelistedUrls.length > 0 && `URLs: ${whitelistedUrls.join(", ")}. `}
                {rateLimit > 0 && `Rate limit: ${rateLimit} req/min. `}
                {allowsWeb && "Web requests enabled."}
              </span>
            </div>
          </div>
        </div>
      )}

      <main className="homepage-main">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your projects...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <p className="error-message">{error}</p>
            <button
              className="btn-solid"
              onClick={() => {
                fetchProjects();
                refreshProjects();
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="projects-header">
              <h2 className="section-title">Select a Project</h2>
              <button
                className={user?.projectLimit !== undefined && projects.length >= user.projectLimit ? "btn-solid btn-disabled-limit tooltip-right" : "btn-primary"}
                onClick={() => {
                  if (user?.projectLimit !== undefined && projects.length >= user.projectLimit) {
                    return;
                  } else {
                    setShowCreateProjectModal(true);
                  }
                }}
                data-tooltip={user?.projectLimit !== undefined && projects.length >= user.projectLimit ? `You have reached your limit of ${user.projectLimit} projects. Upgrade plan to create more.` : undefined}
              >
                + Create New Project
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📁</div>
                <h2>No projects yet</h2>
                <p>Create a project to add your API key to.</p>
                <button
                  className={user?.projectLimit !== undefined && projects.length >= user.projectLimit ? "btn-solid btn-disabled-limit" : "btn-primary"}
                  onClick={() => {
                    if (user?.projectLimit !== undefined && projects.length >= user.projectLimit) {
                      return;
                    } else {
                      setShowCreateProjectModal(true);
                    }
                  }}
                  data-tooltip={user?.projectLimit !== undefined && projects.length >= user.projectLimit ? `You have reached your limit of ${user.projectLimit} projects. Upgrade plan to create more.` : undefined}
                >
                  Create Your First Project
                </button>
              </div>
            ) : (
              <div className="projects-grid">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => project.id && handleSelectProject(project.id)}
                    className="project-card"
                    style={{ cursor: "pointer", textAlign: "left", border: "2px solid transparent" }}
                  >
                    <div className="project-card-header">
                      <h3 className="project-name">
                        {project.name || "Unnamed Project"}
                      </h3>
                      {project.keys && project.keys.length > 0 && (
                        <span className="key-badge">{project.keys.length} {project.keys.length === 1 ? "key" : "keys"}</span>
                      )}
                    </div>
                    <p className="project-description">
                      {project.description || "No description provided"}
                    </p>
                    <div className="project-card-footer">
                      <span className="view-link">Select project →</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="page-footer">
        © {new Date().getFullYear()} ProxLock. All rights reserved.
      </footer>

      {/* Create Project Modal */}
      {showCreateProjectModal && (
        <div className={`modal-overlay ${isClosingModal ? 'closing' : ''}`} onClick={handleCloseModal}>
          <div className={`modal-content ${isClosingModal ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Project</h2>
              <button
                className="modal-close-btn"
                onClick={handleCloseModal}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="modal-form">
              <div className="form-group">
                <label htmlFor="project-name" className="form-label">
                  Project Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="project-name"
                  className="form-input"
                  value={projectFormData.name}
                  onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                  placeholder="e.g., My API Project"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="project-description" className="form-label">
                  Description (optional)
                </label>
                <textarea
                  id="project-description"
                  className="form-textarea"
                  value={projectFormData.description}
                  onChange={(e) => setProjectFormData({ ...projectFormData, description: e.target.value })}
                  placeholder="Describe what this project is for"
                  rows={4}
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseModal}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={creating || !projectFormData.name.trim()}>
                  {creating ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
