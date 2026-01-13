import { useAuth } from "@clerk/clerk-react";
import { UserButton } from "@clerk/clerk-react";
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from "react";
import logo from "../assets/logo.svg";

const API_URL = import.meta.env.VITE_API_URL;

interface Project {
  id?: string;
  name?: string;
  description: string;
  keys?: unknown[];
}

export interface SidebarRef {
  refreshProjects: () => void;
}

const Sidebar = forwardRef<SidebarRef>((_props, ref) => {
  const { getToken } = useAuth();
  const location = useLocation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRequestUsage, setCurrentRequestUsage] = useState<number | null>(null);
  const [requestLimit, setRequestLimit] = useState<number | null>(null);
  const [isPayingCustomer, setIsPayingCustomer] = useState<boolean | null>(null);
  const [hasScrollableContent, setHasScrollableContent] = useState(false);
  const sidebarNavRef = useRef<HTMLElement | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken({ template: "default" });

      const res = await fetch(`${API_URL}/me/projects`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setProjects(Array.isArray(data) ? data : []);
        setError(null);
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch projects: ${res.statusText}`);
      }
    } catch (err) {
      const errorMessage = (err as Error).message || "Failed to load projects";
      setError(errorMessage);
      console.error("Error fetching projects:", err);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

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
        // Check if user is a paying customer
        // First check if there's an explicit subscription status field
        if (userData.subscriptionStatus !== undefined) {
          setIsPayingCustomer(userData.subscriptionStatus === 'active' || userData.subscriptionStatus === 'paid');
        } else if (userData.isPayingCustomer !== undefined) {
          setIsPayingCustomer(userData.isPayingCustomer);
        } else {
          // Infer from requestLimit - typically free users have lower limits (e.g., <= 1000)
          // Adjust this threshold based on your actual free tier limit
          setIsPayingCustomer(userData.requestLimit ? userData.requestLimit > 1000 : false);
        }
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
  }, [getToken]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Check if sidebar nav has scrollable content
  useEffect(() => {
    const checkScrollable = () => {
      const nav = sidebarNavRef.current;
      if (nav) {
        // Check if there's scrollable content (scrollHeight > clientHeight)
        const hasScroll = nav.scrollHeight > nav.clientHeight;

        if (hasScroll) {
          // Check if we're at the bottom (no more content below)
          const isAtBottom = nav.scrollTop + nav.clientHeight >= nav.scrollHeight - 1; // -1 for rounding tolerance
          // Show shadow if there's scrollable content AND we're not at the bottom
          setHasScrollableContent(!isAtBottom);
        } else {
          // No scrollable content, hide shadow
          setHasScrollableContent(false);
        }
      }
    };

    const nav = sidebarNavRef.current;
    if (nav) {
      // Check initially
      checkScrollable();

      // Check on scroll
      nav.addEventListener('scroll', checkScrollable);

      // Check on resize (content might change)
      window.addEventListener('resize', checkScrollable);

      // Use ResizeObserver to detect content changes
      const resizeObserver = new ResizeObserver(checkScrollable);
      resizeObserver.observe(nav);

      return () => {
        nav.removeEventListener('scroll', checkScrollable);
        window.removeEventListener('resize', checkScrollable);
        resizeObserver.disconnect();
      };
    }
  }, [projects, loading]);

  useImperativeHandle(ref, () => ({
    refreshProjects: fetchProjects,
  }));

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const isProjectActive = (projectId: string) => {
    return location.pathname === `/projects/${projectId}`;
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Toggle Button */}
      <button
        className="sidebar-mobile-toggle"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label="Toggle sidebar"
      >
        {isMobileOpen ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.5 5H17.5M2.5 10H17.5M2.5 15H17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Sidebar */}
      <aside className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" className="sidebar-logo-link" onClick={() => setIsMobileOpen(false)}>
            <img src={logo} alt="ProxLock Logo" className="sidebar-logo-icon" />
            <h1 className="sidebar-logo">ProxLock</h1>
            <span className="sidebar-beta-badge">BETA</span>
          </Link>
        </div>

        <nav className="sidebar-nav" ref={sidebarNavRef}>
          <Link
            to="/"
            className={`sidebar-nav-item ${isActive("/") ? "active" : ""}`}
            onClick={() => setIsMobileOpen(false)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 2L3 7V17H8V12H12V17H17V7L10 2Z" fill="currentColor" />
            </svg>
            <span>Home</span>
          </Link>

          <div className="sidebar-divider"></div>

          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <h3 className="sidebar-section-title">Projects</h3>
            </div>

            {loading ? (
              <div className="sidebar-loading">
                <div className="sidebar-spinner"></div>
                <span>Loading...</span>
              </div>
            ) : error ? (
              <div className="sidebar-error">
                <p className="sidebar-error-message">{error}</p>
              </div>
            ) : projects.length === 0 ? (
              <div className="sidebar-empty">
                <p>No projects yet</p>
              </div>
            ) : (
              <div className="sidebar-projects">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    to={project.id ? `/projects/${project.id}` : "#"}
                    className={`sidebar-project-item ${project.id && isProjectActive(project.id) ? "active" : ""}`}
                    onClick={() => setIsMobileOpen(false)}
                  >
                    <div className="sidebar-project-icon">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 4L8 1L14 4V11L8 14L2 11V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="sidebar-project-info">
                      <span className="sidebar-project-name">
                        {project.name || "Unnamed Project"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="sidebar-bottom">
          <div className={`sidebar-user-button ${hasScrollableContent ? 'has-content-above' : ''}`}>
            <UserButton showName={false} />
            {currentRequestUsage !== null && requestLimit !== null && (
              <div className="sidebar-usage-container">
                <span className="sidebar-usage-label">Requests</span>
                <span className="sidebar-usage-badge">{currentRequestUsage}/{requestLimit === -1 ? "∞" : requestLimit}</span>
              </div>
            )}
          </div>

          <div className="sidebar-subscription-section">
            <Link
              to="/pricing"
              className="sidebar-subscription-button"
              onClick={() => setIsMobileOpen(false)}
            >
              {isPayingCustomer ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 1L10.5 5.5L15.5 6.5L12 9.5L12.5 14.5L8 12L3.5 14.5L4 9.5L0.5 6.5L5.5 5.5L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                  <span>Manage Subscription</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 1L10.5 5.5L15.5 6.5L12 9.5L12.5 14.5L8 12L3.5 14.5L4 9.5L0.5 6.5L5.5 5.5L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                  <span>Upgrade</span>
                </>
              )}
            </Link>
          </div>

          <div className="sidebar-footer">
            <p className="sidebar-footer-text">© {new Date().getFullYear()} ProxLock</p>
          </div>
        </div>
      </aside>
    </>
  );
});

Sidebar.displayName = "Sidebar";

export default Sidebar;
