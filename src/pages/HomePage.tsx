import { useAuth, useUser } from "@clerk/clerk-react";
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useProjectsContext } from "../contexts/ProjectsContext";
import { useSignupContext } from "../contexts/SignupContext";
import ErrorToast from "../components/ErrorToast";

const API_URL = import.meta.env.VITE_API_URL;

interface Project {
  id?: string;
  name?: string;
  description: string;
  keys?: unknown[];
}

export default function HomePage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const { refreshProjects } = useProjectsContext();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [projectFormData, setProjectFormData] = useState({
    name: "",
    description: "",
  });
  const [creating, setCreating] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

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
      const projectsRes = await fetch(`${API_URL}/me/projects`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "include",
      });

      if (projectsRes.ok) {
        const projectsData = await projectsRes.json();
        setProjects(Array.isArray(projectsData) ? projectsData : []);
      }

      // Refresh sidebar
      refreshProjects();

      // Close modal
      handleCloseModal();

      // Navigate to the new project
      if (newProject.id) {
        navigate(`/projects/${newProject.id}`);
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

  const userName = user?.fullName || user?.primaryEmailAddress?.emailAddress || "there";
  const { isNewSignup } = useSignupContext();

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
        <h1 className="hero-title">{isNewSignup ? "Welcome" : "Welcome back"}, {userName}!</h1>
        <p className="hero-subtext">
          Manage your API proxy projects and keys from one central dashboard.
        </p>
      </header>

      {/* Beta Pricing Banner */}
      <div className="beta-banner">
        <div className="beta-banner-content">
          <div className="beta-banner-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 1L12.5 6.5L18.5 7.5L14 11.5L15 17.5L10 14.5L5 17.5L6 11.5L1.5 7.5L7.5 6.5L10 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          <div className="beta-banner-text">
            <strong>Special Pricing</strong>
            <span>for <strong>CruzHacks</strong>. Get a 30-day free trial for new Plus subscribers</span>
          </div>
          <Link to="/pricing" className="beta-banner-btn">
            View Plans
          </Link>
        </div>
      </div>

      {/* Main Content */}
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
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📁</div>
            <h2>No projects yet</h2>
            <p>Get started by creating your first project to manage API keys securely.</p>
            <button className="btn-primary" onClick={() => setShowCreateProjectModal(true)}>
              Create Your First Project
            </button>
          </div>
        ) : (
          <>
            <div className="projects-header">
              <div className="projects-header-title">
                <h2 className="section-title">Your Projects</h2>
                <span className="project-count-badge">{projects.length}</span>
              </div>
              <button className="btn-primary" onClick={() => setShowCreateProjectModal(true)}>
                + Create Project
              </button>
            </div>
            <div className="projects-grid">
              {projects.map((project, index) => {
                const ProjectCardContent = (
                  <>
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
                      <span className="view-link">View details →</span>
                    </div>
                  </>
                );

                return project.id ? (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="project-card"
                  >
                    {ProjectCardContent}
                  </Link>
                ) : (
                  <div key={index} className="project-card" style={{ cursor: 'default', opacity: 0.7 }}>
                    {ProjectCardContent}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
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
