import { useAuth } from "@clerk/clerk-react";
import { UserButton } from "@clerk/clerk-react";
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from "react";
import { createPortal } from "react-dom";
import logo from "../assets/logo.svg";
import type { Project } from "../types";
import { useUserContext } from "../contexts/UserContext";

const API_URL = import.meta.env.VITE_API_URL;

// Extracted popout component that uses a portal to escape sidebar overflow clipping
import type { WebSocketUsage } from "../types";

interface UsagePopoutTriggerProps {
  currentRequestUsage: number | null;
  requestLimit: number | null;
  wsUsage: WebSocketUsage | null;
}

function UsagePopoutTrigger({ currentRequestUsage, requestLimit, wsUsage }: UsagePopoutTriggerProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [popoutStyle, setPopoutStyle] = useState<React.CSSProperties>({});
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPopout = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPopoutStyle({
        position: 'fixed',
        bottom: `${window.innerHeight - rect.top + 8}px`,
        left: `${rect.left}px`,
      });
    }
    setIsHovered(true);
  };

  const hidePopout = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 150);
  };

  // Compute the max usage ratio across all metered resources
  const usageRatios: number[] = [];
  if (currentRequestUsage !== null && requestLimit !== null && requestLimit > 0) {
    usageRatios.push(currentRequestUsage / requestLimit);
  }
  if (wsUsage) {
    if (wsUsage.connectionSecondLimit > 0) {
      usageRatios.push(wsUsage.connectionSeconds / wsUsage.connectionSecondLimit);
    }
    if (wsUsage.messageUnitLimit > 0) {
      usageRatios.push(wsUsage.messageUnits / wsUsage.messageUnitLimit);
    }
  }
  const maxRatio = Math.min(Math.max(...usageRatios, 0), 1);
  const percentage = Math.round(maxRatio * 100);

  // SVG circle math
  const size = 28;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (maxRatio * circumference);

  // Color based on usage level
  const ringColor = maxRatio >= 0.9 ? '#ef4444' : maxRatio >= 0.7 ? '#f59e0b' : 'var(--accent-purple-1)';

  return (
    <>
      <div
        ref={triggerRef}
        className={`sidebar-usage-trigger ${isHovered ? 'active' : ''}`}
        onMouseEnter={showPopout}
        onMouseLeave={hidePopout}
      >
        <div className="usage-ring-wrapper">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="usage-ring-svg">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--badge-bg)"
              strokeWidth={strokeWidth}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease' }}
            />
          </svg>
          <span className="usage-ring-text">{percentage}%</span>
        </div>
      </div>
      {isHovered && createPortal(
        <div
          className="sidebar-usage-popout visible"
          style={popoutStyle}
          onMouseEnter={showPopout}
          onMouseLeave={hidePopout}
        >
          <div className="usage-popout-header">
            <span className="usage-popout-title">Usage This Period</span>
          </div>
          <div className="usage-popout-body">
            {currentRequestUsage !== null && requestLimit !== null && (
              <div className="usage-popout-item">
                <div className="usage-popout-item-header">
                  <span className="usage-popout-item-label">HTTP Requests</span>
                  <span className="usage-popout-item-value">{currentRequestUsage.toLocaleString()} / {requestLimit === -1 ? "∞" : requestLimit.toLocaleString()}</span>
                </div>
                {requestLimit > 0 && (
                  <div className="usage-popout-bar">
                    <div
                      className={`usage-popout-bar-fill ${currentRequestUsage / requestLimit >= 0.9 ? 'critical' : currentRequestUsage / requestLimit >= 0.7 ? 'warning' : ''}`}
                      style={{ width: `${Math.min((currentRequestUsage / requestLimit) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}
            {wsUsage && (
              <>
                <div className="usage-popout-item">
                  <div className="usage-popout-item-header">
                    <span className="usage-popout-item-label">WS Connection Seconds</span>
                    <span className="usage-popout-item-value">{wsUsage.connectionSeconds.toLocaleString()} / {wsUsage.connectionSecondLimit === -1 ? "∞" : wsUsage.connectionSecondLimit.toLocaleString()}</span>
                  </div>
                  {wsUsage.connectionSecondLimit > 0 && (
                    <div className="usage-popout-bar">
                      <div
                        className={`usage-popout-bar-fill ${wsUsage.connectionSeconds / wsUsage.connectionSecondLimit >= 0.9 ? 'critical' : wsUsage.connectionSeconds / wsUsage.connectionSecondLimit >= 0.7 ? 'warning' : ''}`}
                        style={{ width: `${Math.min((wsUsage.connectionSeconds / wsUsage.connectionSecondLimit) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="usage-popout-item">
                  <div className="usage-popout-item-header">
                    <span className="usage-popout-item-label">WS Message Units</span>
                    <span className="usage-popout-item-value">{wsUsage.messageUnits.toLocaleString()} / {wsUsage.messageUnitLimit === -1 ? "∞" : wsUsage.messageUnitLimit.toLocaleString()}</span>
                  </div>
                  {wsUsage.messageUnitLimit > 0 && (
                    <div className="usage-popout-bar">
                      <div
                        className={`usage-popout-bar-fill ${wsUsage.messageUnits / wsUsage.messageUnitLimit >= 0.9 ? 'critical' : wsUsage.messageUnits / wsUsage.messageUnitLimit >= 0.7 ? 'warning' : ''}`}
                        style={{ width: `${Math.min((wsUsage.messageUnits / wsUsage.messageUnitLimit) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="usage-popout-divider" />
                <div className="usage-popout-stats">
                  <div className="usage-popout-stat">
                    <span className="usage-popout-stat-label">Active Connections</span>
                    <span className="usage-popout-stat-value">{wsUsage.connectionCount.toLocaleString()}</span>
                  </div>
                  <div className="usage-popout-stat">
                    <span className="usage-popout-stat-label">Messages</span>
                    <span className="usage-popout-stat-value">{wsUsage.messageCount.toLocaleString()}</span>
                  </div>
                  <div className="usage-popout-stat">
                    <span className="usage-popout-stat-label">Bandwidth</span>
                    <span className="usage-popout-stat-value">{((wsUsage.bytesClientToUpstream + wsUsage.bytesUpstreamToClient) / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export interface SidebarRef {
  refreshProjects: () => void;
}

const Sidebar = forwardRef<SidebarRef>((_props, ref) => {
  const { getToken } = useAuth();
  const { user, handleTOSRejection } = useUserContext();
  const location = useLocation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasScrollableContent, setHasScrollableContent] = useState(false);
  const sidebarNavRef = useRef<HTMLElement | null>(null);

  const requestLimit = user?.requestLimit ?? null;
  const currentRequestUsage = user?.currentRequestUsage ?? null;
  const isPayingCustomer = user?.isPayingCustomer ?? false;
  const wsUsage = user?.currentWebSocketUsage ?? null;


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
        if (res.headers.get("Code") === "-1") {
          handleTOSRejection();
          return;
        }
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
  }, [getToken, handleTOSRejection]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);


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

          <Link
            to="/api-keys"
            className={`sidebar-nav-item ${isActive("/api-keys") ? "active" : ""}`}
            onClick={() => setIsMobileOpen(false)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.5 8.5C12.5 10.433 10.933 12 9 12C8.46484 12 7.96094 11.877 7.51172 11.6563L5.5 13.5H4V15H2.5V16.5H1V14.293L6.34375 8.98828C6.12305 8.53906 6 8.03516 6 7.5C6 5.567 7.567 4 9.5 4C11.433 4 13 5.567 13 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="10" cy="7" r="1.25" fill="currentColor" />
            </svg>
            <span>Access Keys</span>
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
            {((currentRequestUsage !== null && requestLimit !== null) || wsUsage) && (
              <UsagePopoutTrigger
                currentRequestUsage={currentRequestUsage}
                requestLimit={requestLimit}
                wsUsage={wsUsage}
              />
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
