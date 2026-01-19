import { SignedIn, SignedOut, RedirectToSignIn, useAuth, useUser } from "@clerk/clerk-react";
import { Routes, Route } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import NotFoundPage from "./pages/NotFoundPage";
import PricingPage from "./pages/PricingPage";
import UserAccessKeysPage from "./pages/UserAccessKeysPage";
import Sidebar, { type SidebarRef } from "./components/Sidebar";
import UpgradeBanner from "./components/UpgradeBanner";
import { ProjectsProvider } from "./contexts/ProjectsContext";
import { SignupProvider, useSignupContext } from "./contexts/SignupContext";

const API_URL = import.meta.env.VITE_API_URL;

function AppWithSidebar() {
  const sidebarRef = useRef<SidebarRef>(null);

  const refreshProjects = () => {
    if (sidebarRef.current) {
      sidebarRef.current.refreshProjects();
    }
  };

  return (
    <ProjectsProvider refreshProjects={refreshProjects}>
      <div className="app-layout">
        <Sidebar ref={sidebarRef} />
        <div className="main-content">
          <UpgradeBanner />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/api-keys" element={<UserAccessKeysPage />} />
            <Route path="/projects/:projectId" element={<DashboardPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </div>
    </ProjectsProvider>
  );
}

export default function AuthRouter() {
  const { getToken } = useAuth();
  const [accountCreated, setAccountCreated] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);

  const createUser = async () => {
    try {
      const token = await getToken({ template: "default" });

      const res = await fetch(`${API_URL}/me`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include" // optional if using cookies
      });

      if (res.ok) {
        const data = await res.json();
        setJustRegistered(data.justRegistered === true);
      }
      setAccountCreated(true);
    } catch {
      setAccountCreated(true);
    }
  };

  const { isLoaded, isSignedIn } = useUser();
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    createUser();
  }, [isLoaded, isSignedIn]);

  return (
    <div>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>

      <SignedIn>
        {accountCreated ? (
          <SignupProvider>
            <AppWithSidebarWrapper justRegistered={justRegistered} />
          </SignupProvider>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading your account...</p>
            </div>
          </div>
        )}
      </SignedIn>
    </div>
  );
}

function AppWithSidebarWrapper({ justRegistered }: { justRegistered: boolean }) {
  const { setIsNewSignup } = useSignupContext();

  useEffect(() => {
    setIsNewSignup(justRegistered);
  }, [justRegistered, setIsNewSignup]);

  return <AppWithSidebar />;
}
