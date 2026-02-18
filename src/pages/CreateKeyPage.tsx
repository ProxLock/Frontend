import { useAuth } from "@clerk/clerk-react";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useProjectsContext } from "../contexts/ProjectsContext";
import { useUserContext } from "../contexts/UserContext";
import { useFetchProjects } from "../hooks/useFetchProjects";
import ErrorToast from "../components/ErrorToast";
import { parseKeyParams, buildKeyParamsUrl } from "../utils/keyParams";

const API_URL = import.meta.env.VITE_API_URL;

export default function CreateKeyPage() {
  const { getToken } = useAuth();
  const { user } = useUserContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshProjects } = useProjectsContext();
  const { projects, loading, error, fetchProjects } = useFetchProjects();
  
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showKeyLimitModal, setShowKeyLimitModal] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [isClosingKeyLimitModal, setIsClosingKeyLimitModal] = useState(false);
  const [projectFormData, setProjectFormData] = useState({
    name: "",
    description: "",
  });
  const [creating, setCreating] = useState(false);

  // Parse query parameters for key creation
  const keyParams = parseKeyParams(searchParams);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check project limit
    if (user?.projectLimit !== undefined && user.projectLimit > 0 && projects.length >= user.projectLimit) {
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

      // Navigate to the new project's create-key route with query params
      if (newProject.id) {
        const params = buildKeyParamsUrl(keyParams);
        navigate(`/projects/${newProject.id}/create-key?${params}`);
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
    // Find the selected project
    const selectedProject = projects.find(p => p.id === projectId);
    
    // Check if project has reached the API key limit (only enforce if limit > 0, -1 means unlimited)
    if (user?.apiKeyLimit !== undefined && user.apiKeyLimit > 0 && selectedProject?.keys && selectedProject.keys.length >= user.apiKeyLimit) {
      setShowKeyLimitModal(true);
      return;
    }
    
    // Build query params (without openModal flag since we're using the create-key route)
    const params = buildKeyParamsUrl(keyParams);
    // Navigate to the create-key route which will auto-open the modal
    navigate(`/projects/${projectId}/create-key?${params}`);
  };

  const handleCloseKeyLimitModal = () => {
    setIsClosingKeyLimitModal(true);
    setTimeout(() => {
      setShowKeyLimitModal(false);
      setIsClosingKeyLimitModal(false);
    }, 300);
  };

  const handleUpgrade = () => {
    navigate("/pricing");
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
                className={user?.projectLimit !== undefined && user.projectLimit > 0 && projects.length >= user.projectLimit ? "btn-solid btn-disabled-limit tooltip-right" : "btn-primary"}
                onClick={() => {
                  if (user?.projectLimit !== undefined && user.projectLimit > 0 && projects.length >= user.projectLimit) {
                    return;
                  } else {
                    setShowCreateProjectModal(true);
                  }
                }}
                data-tooltip={user?.projectLimit !== undefined && user.projectLimit > 0 && projects.length >= user.projectLimit ? `You have reached your limit of ${user.projectLimit} projects. Upgrade plan to create more.` : undefined}
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
                  className={user?.projectLimit !== undefined && user.projectLimit > 0 && projects.length >= user.projectLimit ? "btn-solid btn-disabled-limit" : "btn-primary"}
                  onClick={() => {
                    if (user?.projectLimit !== undefined && user.projectLimit > 0 && projects.length >= user.projectLimit) {
                      return;
                    } else {
                      setShowCreateProjectModal(true);
                    }
                  }}
                  data-tooltip={user?.projectLimit !== undefined && user.projectLimit > 0 && projects.length >= user.projectLimit ? `You have reached your limit of ${user.projectLimit} projects. Upgrade plan to create more.` : undefined}
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

      {/* Key Limit Modal */}
      {showKeyLimitModal && (
        <div className={`modal-overlay ${isClosingKeyLimitModal ? 'closing' : ''}`} onClick={handleCloseKeyLimitModal}>
          <div className={`modal-content ${isClosingKeyLimitModal ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">API Key Limit Reached</h2>
              <button
                className="modal-close-btn"
                onClick={handleCloseKeyLimitModal}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: "1rem" }}>
                This project has reached the maximum of <strong>{user?.apiKeyLimit}</strong> API keys allowed on your current plan.
              </p>
              <p>
                Upgrade your plan to add more API keys to this project.
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCloseKeyLimitModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleUpgrade}
              >
                Upgrade Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
