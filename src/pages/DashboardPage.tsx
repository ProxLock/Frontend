import { useAuth } from "@clerk/clerk-react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useProjectsContext } from "../contexts/ProjectsContext";
import { useUserContext } from "../contexts/UserContext";
import ErrorToast from "../components/ErrorToast";
import NotFoundPage from "./NotFoundPage";
import type { Project } from "../types";
import { copyToClipboard } from "../utils/clipboard";

const API_URL = import.meta.env.VITE_API_URL;

// Directory of popular APIs and their whitelisted URLs
const API_DIRECTORY: Record<string, string[]> = {
  openai: ["api.openai.com"],
  "open ai": ["api.openai.com"],
  "open-ai": ["api.openai.com"],
  claude: ["api.anthropic.com"],
  anthropic: ["api.anthropic.com"],
  openrouter: ["openrouter.ai"],
  "open router": ["openrouter.ai"],
  "open-router": ["openrouter.ai"],
  groq: ["api.groq.com"],
  mistral: ["api.mistral.ai"],
  cohere: ["api.cohere.com"],
  together: ["api.together.xyz"],
  perplexity: ["api.perplexity.ai"],
  gemini: ["generativelanguage.googleapis.com"],
  google: ["generativelanguage.googleapis.com"],
  "google ai": ["generativelanguage.googleapis.com"],
  xai: ["api.x.ai"],
  "x ai": ["api.x.ai"],
  replicate: ["api.replicate.com"],
  stability: ["api.stability.ai"],
  "stability ai": ["api.stability.ai"],
  huggingface: ["api-inference.huggingface.co"],
  "hugging face": ["api-inference.huggingface.co"],
  "hugging-face": ["api-inference.huggingface.co"],
  aleph: ["api.aleph-alpha.com"],
  "aleph alpha": ["api.aleph-alpha.com"],
  "aleph-alpha": ["api.aleph-alpha.com"],
  ai21: ["api.ai21.com"],
  "ai21 labs": ["api.ai21.com"],
  "ai21-labs": ["api.ai21.com"],
  nvidia: ["integrate.api.nvidia.com"],
  "nvidia nims": ["integrate.api.nvidia.com"],
  "nvidia-nims": ["integrate.api.nvidia.com"],
};

const getWhitelistedUrlsFromName = (name: string): string[] => {
  if (!name) return [];

  const normalizedName = name.toLowerCase().trim();

  // Direct match
  if (API_DIRECTORY[normalizedName]) {
    return API_DIRECTORY[normalizedName];
  }

  // Partial match - only if input is at least 3 characters
  // Match if the normalized name starts with a key, or if a key is contained in the name
  if (normalizedName.length >= 3) {
    for (const [key, urls] of Object.entries(API_DIRECTORY)) {
      // Check if name starts with the key (e.g., "openai" matches "openai key")
      if (normalizedName.startsWith(key)) {
        return urls;
      }
      // Check if name contains the key as a whole word (e.g., "my openai key" matches "openai")
      // Split by spaces/hyphens and check if any part matches the key
      const nameParts = normalizedName.split(/[\s\-_]+/);
      if (nameParts.includes(key)) {
        return urls;
      }
    }
  }

  return [];
};

interface APIKey {
  id?: string;
  name?: string;
  description?: string;
  partialKey?: string;
  associationId?: string;
  whitelistedUrls?: string[];
  rateLimit?: number | null;
  allowsWeb?: boolean;
}

interface DeviceCheckKey {
  teamID: string;
  keyID: string;
  bypassToken: string;
}

interface PlayIntegrityConfig {
  projectID: string;
  bypassToken: string;
  clientEmail: string;
  packageName?: string;
  allowedAppRecognitionVerdicts?: string[];
}

export default function DashboardPage() {
  const { getToken } = useAuth();
  const { user } = useUserContext();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { refreshProjects } = useProjectsContext();
  const [project, setProject] = useState<Project | null>(null);
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [deviceCheckKey, setDeviceCheckKey] = useState<DeviceCheckKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [showAddKeyModal, setShowAddKeyModal] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [showPartialKey, setShowPartialKey] = useState(false);
  const [isClosingPartialKey, setIsClosingPartialKey] = useState(false);
  const [partialKeyToShow, setPartialKeyToShow] = useState<string>("");
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [isClosingEditModal, setIsClosingEditModal] = useState(false);
  const [showEditKeyModal, setShowEditKeyModal] = useState(false);
  const [isClosingEditKeyModal, setIsClosingEditKeyModal] = useState(false);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    apiKey: "",
    whitelistedUrls: [] as string[],
    rateLimit: -1 as number,
    allowsWeb: false,
  });
  const [projectFormData, setProjectFormData] = useState({
    name: "",
    description: "",
  });
  const [keyFormData, setKeyFormData] = useState({
    name: "",
    description: "",
    whitelistedUrls: [] as string[],
    rateLimit: -1 as number,
    allowsWeb: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [updatingProject, setUpdatingProject] = useState(false);
  const [updatingKey, setUpdatingKey] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [showDeviceCheckModal, setShowDeviceCheckModal] = useState(false);
  const [isClosingDeviceCheckModal, setIsClosingDeviceCheckModal] = useState(false);
  const [deviceCheckFormData, setDeviceCheckFormData] = useState({
    teamID: "",
    keyID: "",
    privateKey: "",
  });
  const [uploadingDeviceCheck, setUploadingDeviceCheck] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [deviceCheckModalMode, setDeviceCheckModalMode] = useState<"upload" | "link">("upload");
  const [availableDeviceCheckKeys, setAvailableDeviceCheckKeys] = useState<DeviceCheckKey[]>([]);
  const [loadingAvailableKeys, setLoadingAvailableKeys] = useState(false);
  const [selectedKeyToLink, setSelectedKeyToLink] = useState<string>("");
  const [linkingKey, setLinkingKey] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [newWhitelistedUrl, setNewWhitelistedUrl] = useState("");
  const [newWhitelistedUrlEdit, setNewWhitelistedUrlEdit] = useState("");
  const [copiedButtonId, setCopiedButtonId] = useState<string | null>(null);
  const [showBulkRateLimitModal, setShowBulkRateLimitModal] = useState(false);
  const [isClosingBulkRateLimitModal, setIsClosingBulkRateLimitModal] = useState(false);
  const [bulkRateLimitEnabled, setBulkRateLimitEnabled] = useState(false);
  const [bulkRateLimitValue, setBulkRateLimitValue] = useState(60);
  const [applyingBulkRateLimit, setApplyingBulkRateLimit] = useState(false);

  // Play Integrity state
  const [playIntegrityConfig, setPlayIntegrityConfig] = useState<PlayIntegrityConfig | null>(null);
  const [showPlayIntegrityModal, setShowPlayIntegrityModal] = useState(false);
  const [isClosingPlayIntegrityModal, setIsClosingPlayIntegrityModal] = useState(false);
  const [playIntegrityServiceAccountJson, setPlayIntegrityServiceAccountJson] = useState("");
  const [playIntegrityPackageName, setPlayIntegrityPackageName] = useState("");
  const [playIntegrityAllowedVerdicts, setPlayIntegrityAllowedVerdicts] = useState<string[]>(["PLAY_RECOGNIZED"]);
  const [uploadingPlayIntegrity, setUploadingPlayIntegrity] = useState(false);
  const [updatingPlayIntegrityConfig, setUpdatingPlayIntegrityConfig] = useState(false);
  const [isDraggingOverPlayIntegrity, setIsDraggingOverPlayIntegrity] = useState(false);
  const [playIntegrityModalMode, setPlayIntegrityModalMode] = useState<"upload" | "link" | "update">("upload");
  const [availablePlayIntegrityConfigs, setAvailablePlayIntegrityConfigs] = useState<PlayIntegrityConfig[]>([]);
  const [loadingAvailablePlayIntegrityConfigs, setLoadingAvailablePlayIntegrityConfigs] = useState(false);
  const [selectedPlayIntegrityToLink, setSelectedPlayIntegrityToLink] = useState<string>("");
  const [linkingPlayIntegrity, setLinkingPlayIntegrity] = useState(false);

  const handleAddWhitelistedUrl = (isEdit: boolean = false) => {
    const url = isEdit ? newWhitelistedUrlEdit : newWhitelistedUrl;
    if (!url.trim()) return;

    // Remove protocol if present
    let cleanUrl = url.trim();
    cleanUrl = cleanUrl.replace(/^https?:\/\//i, "");
    cleanUrl = cleanUrl.replace(/^\/+/, ""); // Remove leading slashes

    if (isEdit) {
      if (!keyFormData.whitelistedUrls.includes(cleanUrl)) {
        setKeyFormData({
          ...keyFormData,
          whitelistedUrls: [...keyFormData.whitelistedUrls, cleanUrl],
        });
      }
      setNewWhitelistedUrlEdit("");
    } else {
      if (!formData.whitelistedUrls.includes(cleanUrl)) {
        setFormData({
          ...formData,
          whitelistedUrls: [...formData.whitelistedUrls, cleanUrl],
        });
      }
      setNewWhitelistedUrl("");
    }
  };

  const handleRemoveWhitelistedUrl = (url: string, isEdit: boolean = false) => {
    if (isEdit) {
      setKeyFormData({
        ...keyFormData,
        whitelistedUrls: keyFormData.whitelistedUrls.filter((u) => u !== url),
      });
    } else {
      setFormData({
        ...formData,
        whitelistedUrls: formData.whitelistedUrls.filter((u) => u !== url),
      });
    }
  };

  const handleNameChange = (name: string, isEdit: boolean = false) => {
    const autoUrls = getWhitelistedUrlsFromName(name);

    if (isEdit) {
      // If name is empty, clear whitelistedUrls
      // If name matches an API, always update whitelistedUrls
      const newWhitelistedUrls = !name.trim() ? [] : (autoUrls.length > 0 ? autoUrls : keyFormData.whitelistedUrls);

      setKeyFormData({
        ...keyFormData,
        name,
        whitelistedUrls: newWhitelistedUrls,
      });
    } else {
      // If name is empty, clear whitelistedUrls
      // If name matches an API, always update whitelistedUrls
      const newWhitelistedUrls = !name.trim() ? [] : (autoUrls.length > 0 ? autoUrls : formData.whitelistedUrls);

      setFormData({
        ...formData,
        name,
        whitelistedUrls: newWhitelistedUrls,
      });
    }
  };

  const handleFileRead = (file: File) => {
    if (file && (file.name.endsWith('.pem') || file.name.endsWith('.key') || file.name.endsWith('.txt') || file.name.endsWith('.p8'))) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;

        // Auto-fill keyID with filename (without extension and AuthKey_ prefix) if keyID is blank
        let newKeyID = deviceCheckFormData.keyID;
        if (!deviceCheckFormData.keyID.trim()) {
          let fileNameWithoutExt = file.name.replace(/\.(pem|key|txt|p8)$/i, '');
          // Remove "AuthKey_" prefix (case-insensitive)
          fileNameWithoutExt = fileNameWithoutExt.replace(/^AuthKey_/i, '');
          newKeyID = fileNameWithoutExt;
        }

        setDeviceCheckFormData({
          ...deviceCheckFormData,
          privateKey: content.trim(),
          keyID: newKeyID
        });
      };
      reader.readAsText(file);
    }
  };

  const handlePlayIntegrityFileRead = (file: File) => {
    if (file && file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setPlayIntegrityServiceAccountJson(content.trim());
      };
      reader.readAsText(file);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!projectId) {
        setError("Project ID is required");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setIsNotFound(false);
        // Reset device-specific configs when switching projects
        setDeviceCheckKey(null);
        setPlayIntegrityConfig(null);
        const token = await getToken({ template: "default" });

        // Fetch project details
        const projectRes = await fetch(`${API_URL}/me/projects/${projectId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=utf-8",
          },
          credentials: "include",
        });

        if (!projectRes.ok) {
          // Show 404 page for any error fetching the project (404, 403, 500, etc.)
          setIsNotFound(true);
          setLoading(false);
          return;
        }

        let projectData;
        try {
          projectData = await projectRes.json();
        } catch {
          setIsNotFound(true);
          setLoading(false);
          return;
        }
        setProject(projectData);

        // Fetch keys - don't fail the whole page if this fails
        try {
          const keysRes = await fetch(`${API_URL}/me/projects/${projectId}/keys`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json; charset=utf-8",
            },
            credentials: "include",
          });

          if (keysRes.ok) {
            const keysData = await keysRes.json();
            setKeys(Array.isArray(keysData) ? keysData : []);
          } else {
            // If keys fail to load, just log it but don't fail the page
            console.warn("Failed to fetch keys:", keysRes.statusText);
            setKeys([]);
          }
        } catch (keysError) {
          console.warn("Error fetching keys:", keysError);
          setKeys([]);
        }

        // Fetch DeviceCheck key for this project - don't fail the whole page if this fails
        try {
          const deviceCheckRes = await fetch(`${API_URL}/me/projects/${projectId}/device-check/`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json; charset=utf-8",
            },
            credentials: "include",
          });

          if (deviceCheckRes.ok) {
            const deviceCheckData = await deviceCheckRes.json();
            // Handle both array (legacy) and single object responses
            if (Array.isArray(deviceCheckData)) {
              setDeviceCheckKey(deviceCheckData.length > 0 ? deviceCheckData[0] : null);
            } else {
              setDeviceCheckKey(deviceCheckData || null);
            }
          }
        } catch (deviceCheckError) {
          console.warn("Error fetching device check key:", deviceCheckError);
          // Don't set device check key if it fails
        }

        // Fetch Play Integrity config for this project - don't fail the whole page if this fails
        try {
          const playIntegrityRes = await fetch(`${API_URL}/me/projects/${projectId}/play-integrity`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json; charset=utf-8",
            },
            credentials: "include",
          });

          if (playIntegrityRes.ok) {
            const playIntegrityData = await playIntegrityRes.json();
            setPlayIntegrityConfig(playIntegrityData || null);
          }
        } catch (playIntegrityError) {
          console.warn("Error fetching play integrity config:", playIntegrityError);
          // Don't set play integrity config if it fails
        }

        // Project loaded successfully, set loading to false
        setLoading(false);
      } catch (err) {
        // Only show 404 for errors fetching the project itself (network errors, etc.)
        console.error("Error fetching project:", err);
        setIsNotFound(true);
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId, getToken]);

  // Handle query parameters for auto-opening modal with prefilled data
  useEffect(() => {
    if (loading || !project) return;

    const openModal = searchParams.get("openModal");
    if (openModal === "true") {
      const keyName = searchParams.get("name") || "";
      const keyValue = searchParams.get("key") || "";
      const allowsWeb = searchParams.get("allowsWeb") === "true";
      const whitelistedUrlsParam = searchParams.get("whitelistedUrls") || "";
      const whitelistedUrls = whitelistedUrlsParam
        ? whitelistedUrlsParam.split(",").map(url => url.trim()).filter(url => url.length > 0)
        : [];

      // Prefill form data
      setFormData({
        name: keyName,
        description: "",
        apiKey: keyValue,
        whitelistedUrls: whitelistedUrls,
        rateLimit: -1,
        allowsWeb: allowsWeb,
      });

      // Open the modal
      setShowAddKeyModal(true);

      // Clear the query parameters
      setSearchParams({});
    }
  }, [loading, project, searchParams, setSearchParams]);

  const handleDeleteKey = async (keyId: string) => {
    if (!projectId || !confirm("Are you sure you want to delete this API key?")) {
      return;
    }

    try {
      const token = await getToken({ template: "default" });
      const res = await fetch(`${API_URL}/me/projects/${projectId}/keys/${keyId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "include",
      });

      if (res.ok) {
        // Remove the key from the list
        setKeys(keys.filter((key) => key.id !== keyId));
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to delete key: ${res.statusText}`);
      }
    } catch (err) {
      console.error("Error deleting key:", err);
      setErrorToast((err as Error).message || "Failed to delete key. Please try again.");
    }
  };

  /* handleCreateKey modified to respect disabled state if triggered somehow, though button should prevent it */
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    // Check API Key Limit - strictly enforce in case of bypass
    if (user?.apiKeyLimit !== undefined && keys.length >= user.apiKeyLimit) {
      return;
    }

    try {
      setSubmitting(true);
      const token = await getToken({ template: "default" });

      const res = await fetch(`${API_URL}/me/projects/${projectId}/keys`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "include",
        body: JSON.stringify({
          name: formData.name || undefined,
          description: formData.description || undefined,
          apiKey: formData.apiKey || undefined,
          whitelistedUrls: formData.whitelistedUrls,
          rateLimit: formData.rateLimit,
          allowsWeb: formData.allowsWeb,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to create key: ${res.statusText}`);
      }

      const newKey = await res.json();

      // Show the partial key one time
      if (newKey.userPartialKey) {
        setPartialKeyToShow(newKey.userPartialKey);
        setShowPartialKey(true);
        setShowAddKeyModal(false);
        // Reset form
        setFormData({ name: "", description: "", apiKey: "", whitelistedUrls: [], rateLimit: -1, allowsWeb: false });
      } else {
        // If no partial key returned, just close modal and refresh
        setShowAddKeyModal(false);
        setFormData({ name: "", description: "", apiKey: "", whitelistedUrls: [], rateLimit: -1, allowsWeb: false });
      }

      // Refresh keys list
      const keysRes = await fetch(`${API_URL}/me/projects/${projectId}/keys`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "include",
      });

      if (keysRes.ok) {
        const keysData = await keysRes.json();
        setKeys(Array.isArray(keysData) ? keysData : []);
      }
    } catch (err) {
      console.error("Error creating key:", err);
      setErrorToast((err as Error).message || "Failed to create key. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyToClipboard = async (text: string, buttonId: string) => {
    await copyToClipboard(
      text,
      () => {
        setCopiedButtonId(buttonId);
        setTimeout(() => setCopiedButtonId(null), 2000);
      },
      setErrorToast
    );
  };

  const handleCloseModal = () => {
    setIsClosingModal(true);
    setTimeout(() => {
      setShowAddKeyModal(false);
      setIsClosingModal(false);
      setFormData({ name: "", description: "", apiKey: "", whitelistedUrls: [], rateLimit: -1, allowsWeb: false });
      setNewWhitelistedUrl("");
    }, 300);
  };

  const handleClosePartialKey = () => {
    setIsClosingPartialKey(true);
    setTimeout(() => {
      setShowPartialKey(false);
      setIsClosingPartialKey(false);
      setPartialKeyToShow("");
    }, 300);
  };

  const handleOpenEditProject = () => {
    if (project) {
      setProjectFormData({
        name: project.name || "",
        description: project.description || "",
      });
      setShowEditProjectModal(true);
    }
  };

  const handleCloseEditProject = () => {
    setIsClosingEditModal(true);
    setTimeout(() => {
      setShowEditProjectModal(false);
      setIsClosingEditModal(false);
    }, 300);
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !project) return;

    try {
      setUpdatingProject(true);
      const token = await getToken({ template: "default" });

      const res = await fetch(`${API_URL}/me/projects/${projectId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "include",
        body: JSON.stringify({
          name: projectFormData.name || undefined,
          description: projectFormData.description,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update project: ${res.statusText}`);
      }

      const updatedProject = await res.json();
      setProject(updatedProject);
      handleCloseEditProject();
      // Refresh sidebar projects list
      refreshProjects();
    } catch (err) {
      console.error("Error updating project:", err);
      setErrorToast((err as Error).message || "Failed to update project. Please try again.");
    } finally {
      setUpdatingProject(false);
    }
  };

  const handleOpenEditKey = (key: APIKey) => {
    if (key.id) {
      setEditingKeyId(key.id);
      setKeyFormData({
        name: key.name || "",
        description: key.description || "",
        whitelistedUrls: key.whitelistedUrls || [],
        rateLimit: key.rateLimit ?? -1,
        allowsWeb: key.allowsWeb ?? false,
      });
      setShowEditKeyModal(true);
    }
  };

  const handleCloseEditKey = () => {
    setIsClosingEditKeyModal(true);
    setTimeout(() => {
      setShowEditKeyModal(false);
      setIsClosingEditKeyModal(false);
      setEditingKeyId(null);
      setKeyFormData({ name: "", description: "", whitelistedUrls: [], rateLimit: -1, allowsWeb: false });
      setNewWhitelistedUrlEdit("");
    }, 300);
  };

  const handleUpdateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !editingKeyId) return;

    try {
      setUpdatingKey(true);
      const token = await getToken({ template: "default" });

      const res = await fetch(`${API_URL}/me/projects/${projectId}/keys/${editingKeyId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "include",
        body: JSON.stringify({
          name: keyFormData.name || undefined,
          description: keyFormData.description,
          whitelistedUrls: keyFormData.whitelistedUrls,
          rateLimit: keyFormData.rateLimit,
          allowsWeb: keyFormData.allowsWeb,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update key: ${res.statusText}`);
      }

      // Refresh keys list
      const keysRes = await fetch(`${API_URL}/me/projects/${projectId}/keys`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "include",
      });

      if (keysRes.ok) {
        const keysData = await keysRes.json();
        setKeys(Array.isArray(keysData) ? keysData : []);
      }

      handleCloseEditKey();
    } catch (err) {
      console.error("Error updating key:", err);
      setErrorToast((err as Error).message || "Failed to update key. Please try again.");
    } finally {
      setUpdatingKey(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectId || !project) return;

    const projectName = project.name || "this project";
    if (!confirm(`Are you sure you want to delete "${projectName}"? This action cannot be undone and will delete all associated API keys.`)) {
      return;
    }

    try {
      setDeletingProject(true);
      const token = await getToken({ template: "default" });

      const res = await fetch(`${API_URL}/me/projects/${projectId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to delete project: ${res.statusText}`);
      }

      // Refresh sidebar
      refreshProjects();

      // Navigate back to home
      navigate("/");
    } catch (err) {
      console.error("Error deleting project:", err);
      setErrorToast((err as Error).message || "Failed to delete project. Please try again.");
    } finally {
      setDeletingProject(false);
    }
  };

  const handleUploadDeviceCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    try {
      setUploadingDeviceCheck(true);
      const token = await getToken({ template: "default" });

      const res = await fetch(`${API_URL}/me/projects/${projectId}/device-check`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "include",
        body: JSON.stringify({
          teamID: deviceCheckFormData.teamID,
          keyID: deviceCheckFormData.keyID,
          privateKey: deviceCheckFormData.privateKey,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to upload DeviceCheck key: ${res.statusText}`);
      }

      // Refresh DeviceCheck key
      const deviceCheckRes = await fetch(`${API_URL}/me/projects/${projectId}/device-check/`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "include",
      });

      if (deviceCheckRes.ok) {
        const deviceCheckData = await deviceCheckRes.json();
        // Handle both array (legacy) and single object responses
        if (Array.isArray(deviceCheckData)) {
          setDeviceCheckKey(deviceCheckData.length > 0 ? deviceCheckData[0] : null);
        } else {
          setDeviceCheckKey(deviceCheckData || null);
        }
      }

      handleCloseDeviceCheckModal();
    } catch (err) {
      console.error("Error uploading DeviceCheck key:", err);
      setErrorToast((err as Error).message || "Failed to upload DeviceCheck key. Please try again.");
    } finally {
      setUploadingDeviceCheck(false);
    }
  };

  const handleCloseDeviceCheckModal = () => {
    setIsClosingDeviceCheckModal(true);
    setTimeout(() => {
      setShowDeviceCheckModal(false);
      setIsClosingDeviceCheckModal(false);
      setDeviceCheckFormData({ teamID: "", keyID: "", privateKey: "" });
      setIsDraggingOver(false);
      setDeviceCheckModalMode("upload");
      setSelectedKeyToLink("");
      setAvailableDeviceCheckKeys([]);
    }, 300);
  };

  const handleDeviceCheckModalModeChange = async (mode: "upload" | "link") => {
    setDeviceCheckModalMode(mode);

    if (mode === "link") {
      setLoadingAvailableKeys(true);
      setSelectedKeyToLink("");

      try {
        const token = await getToken({ template: "default" });
        const res = await fetch(`${API_URL}/me/device-check/`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=utf-8",
          },
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          setAvailableDeviceCheckKeys(Array.isArray(data) ? data : []);
        } else {
          console.error("Failed to fetch available DeviceCheck keys");
          setAvailableDeviceCheckKeys([]);
        }
      } catch (err) {
        console.error("Error fetching available DeviceCheck keys:", err);
        setAvailableDeviceCheckKeys([]);
      } finally {
        setLoadingAvailableKeys(false);
      }
    }
  };

  const handleLinkKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !selectedKeyToLink) return;

    const selectedKey = availableDeviceCheckKeys.find(
      (key) => `${key.teamID}-${key.keyID}` === selectedKeyToLink
    );

    if (!selectedKey) return;

    try {
      setLinkingKey(true);
      const token = await getToken({ template: "default" });

      const res = await fetch(`${API_URL}/me/projects/${projectId}/device-check`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "include",
        body: JSON.stringify({
          teamID: selectedKey.teamID,
          keyID: selectedKey.keyID,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to link DeviceCheck key: ${res.statusText}`);
      }

      // Refresh DeviceCheck key
      const deviceCheckRes = await fetch(`${API_URL}/me/projects/${projectId}/device-check/`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "include",
      });

      if (deviceCheckRes.ok) {
        const deviceCheckData = await deviceCheckRes.json();
        // Handle both array (legacy) and single object responses
        if (Array.isArray(deviceCheckData)) {
          setDeviceCheckKey(deviceCheckData.length > 0 ? deviceCheckData[0] : null);
        } else {
          setDeviceCheckKey(deviceCheckData || null);
        }
      }

      handleCloseDeviceCheckModal();
    } catch (err) {
      console.error("Error linking DeviceCheck key:", err);
      setErrorToast((err as Error).message || "Failed to link DeviceCheck key. Please try again.");
    } finally {
      setLinkingKey(false);
    }
  };

  // Play Integrity handlers
  const handleUploadPlayIntegrity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    try {
      setUploadingPlayIntegrity(true);
      const token = await getToken({ template: "default" });

      // Parse the JSON to send it as the request body
      let jsonBody;
      try {
        jsonBody = JSON.parse(playIntegrityServiceAccountJson);
      } catch {
        throw new Error("Invalid JSON format. Please provide a valid service account JSON.");
      }

      const res = await fetch(`${API_URL}/me/projects/${projectId}/play-integrity`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "include",
        body: JSON.stringify({
          gcloud_json: jsonBody,
          package_name: playIntegrityPackageName,
          allowedAppRecognitionVerdicts: playIntegrityAllowedVerdicts,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to upload Play Integrity key: ${res.statusText}`);
      }

      // Refresh Play Integrity config
      const playIntegrityRes = await fetch(`${API_URL}/me/projects/${projectId}/play-integrity`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "include",
      });

      if (playIntegrityRes.ok) {
        const playIntegrityData = await playIntegrityRes.json();
        setPlayIntegrityConfig(playIntegrityData || null);
      }

      handleClosePlayIntegrityModal();
    } catch (err) {
      console.error("Error uploading Play Integrity key:", err);
      setErrorToast((err as Error).message || "Failed to upload Play Integrity key. Please try again.");
    } finally {
      setUploadingPlayIntegrity(false);
    }
  };

  const handleUpdatePlayIntegrityConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    try {
      setUpdatingPlayIntegrityConfig(true);
      const token = await getToken({ template: "default" });

      const res = await fetch(`${API_URL}/me/projects/${projectId}/play-integrity`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "include",
        body: JSON.stringify({
          package_name: playIntegrityPackageName || undefined, // Send only if provided/changed
          allowedAppRecognitionVerdicts: playIntegrityAllowedVerdicts,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update Play Integrity config: ${res.statusText}`);
      }

      // Refresh Play Integrity config
      const playIntegrityRes = await fetch(`${API_URL}/me/projects/${projectId}/play-integrity`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "include",
        body: null // Explicitly null for GET
      });

      if (playIntegrityRes.ok) {
        const playIntegrityData = await playIntegrityRes.json();
        setPlayIntegrityConfig(playIntegrityData || null);
      }

      handleClosePlayIntegrityModal();
    } catch (err) {
      console.error("Error updating Play Integrity config:", err);
      setErrorToast((err as Error).message || "Failed to update Play Integrity config. Please try again.");
    } finally {
      setUpdatingPlayIntegrityConfig(false);
    }
  };

  const handleClosePlayIntegrityModal = () => {
    setIsClosingPlayIntegrityModal(true);
    setTimeout(() => {
      setShowPlayIntegrityModal(false);
      setIsClosingPlayIntegrityModal(false);
      setPlayIntegrityServiceAccountJson("");
      setPlayIntegrityPackageName("");
      setPlayIntegrityAllowedVerdicts(["PLAY_RECOGNIZED"]);
      setIsDraggingOverPlayIntegrity(false);
      setPlayIntegrityModalMode("upload");
      setSelectedPlayIntegrityToLink("");
      setAvailablePlayIntegrityConfigs([]);
    }, 300);
  };

  const handlePlayIntegrityModalModeChange = async (mode: "upload" | "link") => {
    setPlayIntegrityModalMode(mode);

    if (mode === "link") {
      setLoadingAvailablePlayIntegrityConfigs(true);
      setSelectedPlayIntegrityToLink("");

      try {
        const token = await getToken({ template: "default" });
        const res = await fetch(`${API_URL}/me/play-integrity`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=utf-8",
          },
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          setAvailablePlayIntegrityConfigs(Array.isArray(data) ? data : []);
        } else {
          console.error("Failed to fetch available Play Integrity configs");
          setAvailablePlayIntegrityConfigs([]);
        }
      } catch (err) {
        console.error("Error fetching available Play Integrity configs:", err);
        setAvailablePlayIntegrityConfigs([]);
      } finally {
        setLoadingAvailablePlayIntegrityConfigs(false);
      }
    } else if (mode === "upload") {
      setPlayIntegrityPackageName("");
      setPlayIntegrityAllowedVerdicts(["PLAY_RECOGNIZED"]);
    }
  };

  const handleLinkPlayIntegrity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !selectedPlayIntegrityToLink) return;

    try {
      setLinkingPlayIntegrity(true);
      const token = await getToken({ template: "default" });

      const res = await fetch(`${API_URL}/me/projects/${projectId}/play-integrity`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "include",
        body: JSON.stringify({
          projectID: selectedPlayIntegrityToLink,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to link Play Integrity config: ${res.statusText}`);
      }

      // Refresh Play Integrity config
      const playIntegrityRes = await fetch(`${API_URL}/me/projects/${projectId}/play-integrity`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "include",
      });

      if (playIntegrityRes.ok) {
        const playIntegrityData = await playIntegrityRes.json();
        setPlayIntegrityConfig(playIntegrityData || null);
      }

      handleClosePlayIntegrityModal();
    } catch (err) {
      console.error("Error linking Play Integrity config:", err);
      setErrorToast((err as Error).message || "Failed to link Play Integrity config. Please try again.");
    } finally {
      setLinkingPlayIntegrity(false);
    }
  };

  const handleCloseBulkRateLimitModal = () => {
    setIsClosingBulkRateLimitModal(true);
    setTimeout(() => {
      setShowBulkRateLimitModal(false);
      setIsClosingBulkRateLimitModal(false);
      setBulkRateLimitEnabled(false);
      setBulkRateLimitValue(60);
    }, 300);
  };

  const handleApplyBulkRateLimit = async () => {
    if (!projectId || keys.length === 0) return;

    const rateLimit = bulkRateLimitEnabled ? bulkRateLimitValue : null;

    try {
      setApplyingBulkRateLimit(true);
      const token = await getToken({ template: "default" });

      // Update all keys in parallel
      await Promise.all(
        keys.map((key) =>
          fetch(`${API_URL}/me/projects/${projectId}/keys/${key.id}`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json; charset=utf-8",
            },
            credentials: "include",
            body: JSON.stringify({
              name: key.name || undefined,
              description: key.description,
              whitelistedUrls: key.whitelistedUrls,
              rateLimit,
            }),
          })
        )
      );

      // Refresh keys list
      const keysRes = await fetch(`${API_URL}/me/projects/${projectId}/keys`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "include",
      });

      if (keysRes.ok) {
        const keysData = await keysRes.json();
        setKeys(Array.isArray(keysData) ? keysData : []);
      }

      handleCloseBulkRateLimitModal();
    } catch (err) {
      console.error("Error applying bulk rate limit:", err);
      setErrorToast((err as Error).message || "Failed to apply rate limit. Please try again.");
    } finally {
      setApplyingBulkRateLimit(false);
    }
  };

  if (isNotFound) {
    return <NotFoundPage />;
  }

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading project details...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="dashboard-container">
        <div className="error-state">
          <p className="error-message">{error || "Project not found"}</p>
          <button className="btn-solid" onClick={() => navigate("/")}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {errorToast && (
        <ErrorToast
          message={errorToast}
          onClose={() => setErrorToast(null)}
        />
      )}
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-title-section">
          <div className="dashboard-title-row">
            <h1 className="dashboard-title">{project.name || "Unnamed Project"}</h1>
            <button
              className="edit-project-btn"
              onClick={handleOpenEditProject}
              title="Edit project"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.5 1.5L16.5 4.5L5.25 15.75H1.5V12L13.5 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <p className="dashboard-description">{project.description || "No description provided"}</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="keys-section">
          <div className="keys-header">
            <h2 className="section-title">API Keys</h2>
            <div className="keys-header-actions">
              {keys.length > 0 && (
                <button className="btn-secondary" onClick={() => setShowBulkRateLimitModal(true)}>
                  Set Rate Limit for All
                </button>
              )}
              <button
                className={user?.apiKeyLimit !== undefined && keys.length >= user.apiKeyLimit ? "btn-solid btn-disabled-limit tooltip-right" : "btn-primary"}
                onClick={() => {
                  if (user?.apiKeyLimit !== undefined && keys.length >= user.apiKeyLimit) {
                    return;
                  } else {
                    setShowAddKeyModal(true);
                  }
                }}
                data-tooltip={user?.apiKeyLimit !== undefined && keys.length >= user.apiKeyLimit ? `You have reached your limit of ${user.apiKeyLimit} API keys per project. Upgrade plan to create more.` : undefined}
              >
                + Add Key
              </button>
            </div>
          </div>

          {keys.length === 0 ? (
            <div className="empty-keys-state">
              <div className="empty-icon">🔑</div>
              <h3>No API keys yet</h3>
              <p>Add your first API key to get started with secure proxy requests.</p>
              <button
                className={user?.apiKeyLimit !== undefined && keys.length >= user.apiKeyLimit ? "btn-solid btn-disabled-limit" : "btn-primary"}
                onClick={() => {
                  if (user?.apiKeyLimit !== undefined && keys.length >= user.apiKeyLimit) {
                    return;
                  } else {
                    setShowAddKeyModal(true);
                  }
                }}
                data-tooltip={user?.apiKeyLimit !== undefined && keys.length >= user.apiKeyLimit ? `You have reached your limit of ${user.apiKeyLimit} API keys per project. Upgrade plan to create more.` : undefined}
              >
                Create Your First Key
              </button>
            </div>
          ) : (
            <div className="keys-grid">
              {keys.map((key) => (
                <div key={key.id} className="key-card">
                  <div className="key-card-header">
                    <div className="key-name-container">
                      <h3 className="key-name">{key.name || "Unnamed Key"}</h3>
                      {key.allowsWeb && (
                        <span className="allows-web-badge" data-tooltip="Web requests enabled">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                            <path d="M2 12h20" stroke="currentColor" strokeWidth="2" />
                            <path d="M12 2c2.5 2.5 4 5.5 4 10s-1.5 7.5-4 10c-2.5-2.5-4-5.5-4-10s1.5-7.5 4-10z" stroke="currentColor" strokeWidth="2" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="key-card-actions">
                      <button
                        className="key-edit-btn"
                        onClick={() => handleOpenEditKey(key)}
                        title="Edit key"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M11.5 1.5L14.5 4.5L4.5 14.5H1.5V11.5L11.5 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        className="key-delete-btn"
                        onClick={() => key.id && handleDeleteKey(key.id)}
                        title="Delete key"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M5.5 5.5C5.77614 5.5 6 5.72386 6 6V12C6 12.2761 5.77614 12.5 5.5 12.5C5.22386 12.5 5 12.2761 5 12V6C5 5.72386 5.22386 5.5 5.5 5.5Z" fill="currentColor" />
                          <path d="M8 5.5C8.27614 5.5 8.5 5.72386 8.5 6V12C8.5 12.2761 8.27614 12.5 8 12.5C7.72386 12.5 7.5 12.2761 7.5 12V6C7.5 5.72386 7.72386 5.5 8 5.5Z" fill="currentColor" />
                          <path d="M11 6C11 5.72386 10.7761 5.5 10.5 5.5C10.2239 5.5 10 5.72386 10 6V12C10 12.2761 10.2239 12.5 10.5 12.5C10.7761 12.5 11 12.2761 11 12V6Z" fill="currentColor" />
                          <path fillRule="evenodd" clipRule="evenodd" d="M10.5 2C10.7761 2 11 2.22386 11 2.5V3H13.5C13.7761 3 14 3.22386 14 3.5C14 3.77614 13.7761 4 13.5 4H12.5V13C12.5 13.8284 11.8284 14.5 11 14.5H5C4.17157 14.5 3.5 13.8284 3.5 13V4H2.5C2.22386 4 2 3.77614 2 3.5C2 3.22386 2.22386 3 2.5 3H5V2.5C5 2.22386 5.22386 2 5.5 2H10.5ZM4.5 4V13C4.5 13.2761 4.72386 13.5 5 13.5H11C11.2761 13.5 11.5 13.2761 11.5 13V4H4.5Z" fill="currentColor" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {key.description && (
                    <p className="key-description">{key.description}</p>
                  )}
                  <div className="key-details">
                    {key.associationId && (
                      <div className="key-detail-row">
                        <span className="key-detail-label">Association ID:</span>
                        <div className="key-id-container">
                          <code className="key-id">{key.associationId}</code>
                          <button
                            className={`devicecheck-copy-btn ${copiedButtonId === `association-${key.id}` ? 'copied' : ''}`}
                            onClick={() => handleCopyToClipboard(key.associationId || "", `association-${key.id}`)}
                            title={copiedButtonId === `association-${key.id}` ? "Copied!" : "Copy association ID"}
                          >
                            {copiedButtonId === `association-${key.id}` ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                    {key.id && (
                      <div className="key-detail-row">
                        <span className="key-detail-label">Association ID:</span>
                        <div className="key-id-container">
                          <code className="key-id">{key.id}</code>
                          <button
                            className={`devicecheck-copy-btn ${copiedButtonId === `keyid-${key.id}` ? 'copied' : ''}`}
                            onClick={() => handleCopyToClipboard(key.id || "", `keyid-${key.id}`)}
                            title={copiedButtonId === `keyid-${key.id}` ? "Copied!" : "Copy key ID"}
                          >
                            {copiedButtonId === `keyid-${key.id}` ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                    {key.whitelistedUrls && key.whitelistedUrls.length > 0 && (
                      <div className="key-detail-row">
                        <span className="key-detail-label">Whitelisted URLs:</span>
                        <div className="whitelisted-urls-list">
                          {key.whitelistedUrls.map((url, index) => (
                            <div key={index} className="whitelisted-url-item">
                              <code className="whitelisted-url-value">{url}/*</code>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="key-detail-row">
                      <span className="key-detail-label">Rate Limit:</span>
                      <span className="key-detail-value">
                        {key.rateLimit != null && key.rateLimit > 0 ? `${key.rateLimit} requests/min` : "Unlimited"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* iOS SDK Setup Guide Info Alert */}
        <div className="info-alert">
          <div className="info-alert-content">
            <div className="info-alert-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor" />
              </svg>
            </div>
            <div className="info-alert-text">
              <strong>ProxLock Platform Setup Guide</strong>
              <span>
                Need help setting up for your platform? Check out our{" "}
                <a
                  href="https://docs.proxlock.dev/getting-started/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="info-alert-link"
                >
                  ProxLock SDK setup guides
                </a>
                .
              </span>
            </div>
          </div>
        </div>

        {/* DeviceCheck Key Section */}
        <div className="devicecheck-section">
          <div className="devicecheck-header">
            <h2 className="section-title">Apple Device Check</h2>
            <button className="btn-primary" onClick={() => setShowDeviceCheckModal(true)}>
              {deviceCheckKey ? "Update Key" : "+ Upload DeviceCheck Key"}
            </button>
          </div>

          {!deviceCheckKey ? (
            <div className="empty-devicecheck-state">
              <div className="empty-icon">🍎</div>
              <h3>No Device Check key yet</h3>
              <p>Upload your Apple Device Check private key to enable device verification.</p>
            </div>
          ) : (
            <div className="devicecheck-card">
              <div className="devicecheck-card-header">
                <h3 className="devicecheck-team-id">Team ID: {deviceCheckKey.teamID}</h3>
              </div>
              <div className="devicecheck-details">
                <div className="devicecheck-detail-row">
                  <span className="devicecheck-detail-label">Key ID:</span>
                  <code className="devicecheck-detail-value">{deviceCheckKey.keyID}</code>
                </div>
                <div className="devicecheck-detail-row">
                  <span className="devicecheck-detail-label">Bypass Token:</span>
                  <div className="devicecheck-value-container">
                    <code className="devicecheck-detail-value">{deviceCheckKey.bypassToken}</code>
                    <button
                      className={`devicecheck-copy-btn ${copiedButtonId === 'bypass-token' ? 'copied' : ''}`}
                      onClick={() => handleCopyToClipboard(deviceCheckKey.bypassToken, 'bypass-token')}
                      title={copiedButtonId === 'bypass-token' ? "Copied!" : "Copy bypass token"}
                    >
                      {copiedButtonId === 'bypass-token' ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Play Integrity Section */}
        <div className="playintegrity-section">
          <div className="playintegrity-header">
            <h2 className="section-title">Google Play Integrity</h2>
            <div className="playintegrity-actions">
              <button
                className="btn-primary"
                onClick={() => {
                  if (playIntegrityConfig) {
                    setPlayIntegrityPackageName(playIntegrityConfig.packageName || "");

                    if (playIntegrityConfig.allowedAppRecognitionVerdicts) {
                      setPlayIntegrityAllowedVerdicts(playIntegrityConfig.allowedAppRecognitionVerdicts);
                    }
                    setPlayIntegrityModalMode("update");
                    setShowPlayIntegrityModal(true);
                  } else {
                    setPlayIntegrityModalMode("upload");
                    setShowPlayIntegrityModal(true);
                  }
                }}
              >
                {playIntegrityConfig ? "Update Config" : "+ Upload Play Integrity Config"}
              </button>
            </div>
          </div>

          {!playIntegrityConfig ? (
            <div className="empty-playintegrity-state">
              <div className="empty-icon">🤖</div>
              <h3>No Play Integrity key yet</h3>
              <p>Upload your Google Cloud service account JSON to enable Play Integrity verification.</p>
            </div>
          ) : (
            <div className="playintegrity-card">
              <div className="playintegrity-details">
                <div className="playintegrity-detail-row">
                  <span className="playintegrity-detail-label">Service Account Email:</span>
                  <code className="playintegrity-detail-value">{playIntegrityConfig.clientEmail}</code>
                </div>
                <div className="playintegrity-detail-row">
                  <span className="playintegrity-detail-label">Bypass Token:</span>
                  <div className="playintegrity-value-container">
                    <code className="playintegrity-detail-value">{playIntegrityConfig.bypassToken}</code>
                    <button
                      className={`playintegrity-copy-btn ${copiedButtonId === 'pi-bypass-token' ? 'copied' : ''}`}
                      onClick={() => handleCopyToClipboard(playIntegrityConfig.bypassToken, 'pi-bypass-token')}
                      title={copiedButtonId === 'pi-bypass-token' ? "Copied!" : "Copy bypass token"}
                    >
                      {copiedButtonId === 'pi-bypass-token' ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="playintegrity-detail-row">
                  <span className="playintegrity-detail-label" style={{ alignSelf: 'flex-start', marginTop: '0.25rem' }}>Allowed Verdicts:</span>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {(playIntegrityConfig.allowedAppRecognitionVerdicts && playIntegrityConfig.allowedAppRecognitionVerdicts.length > 0) ? (
                      playIntegrityConfig.allowedAppRecognitionVerdicts.map(verdict => {
                        const config = {
                          "PLAY_RECOGNIZED": { label: "Play Recognized", color: "#10b981", bg: "rgba(16, 185, 129, 0.1)" },
                          "UNRECOGNIZED_VERSION": { label: "Unrecognized Version", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)" },
                          "UNEVALUATED": { label: "Unevaluated", color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)" }
                        }[verdict] || { label: verdict, color: 'var(--text-primary)', bg: 'var(--bg-secondary)' };

                        return (
                          <span key={verdict} style={{
                            fontSize: '0.75rem',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '0.25rem',
                            backgroundColor: config.bg,
                            color: config.color,
                            fontWeight: 500,
                            border: `1px solid ${config.bg}`
                          }}>
                            {config.label}
                          </span>
                        );
                      })
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>None selected (Default: Play Recognized)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main >

      {/* Delete Project Section */}
      < div className="dashboard-delete-section" >
        <div className="dashboard-delete-content">
          <div className="dashboard-delete-info">
            <h3 className="dashboard-delete-title">Danger Zone</h3>
            <p className="dashboard-delete-description">
              Deleting this project will permanently remove it and all associated API keys. This action cannot be undone.
            </p>
          </div>
          <button
            className="btn-danger"
            onClick={handleDeleteProject}
            disabled={deletingProject}
          >
            {deletingProject ? "Deleting..." : "Delete Project"}
          </button>
        </div>
      </div >

      {/* Add Key Modal */}
      {
        showAddKeyModal && (
          <div className={`modal-overlay ${isClosingModal ? 'closing' : ''}`} onClick={handleCloseModal}>
            <div className={`modal-content ${isClosingModal ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Add New API Key</h2>
                <button
                  className="modal-close-btn"
                  onClick={handleCloseModal}
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleCreateKey} className="modal-form">
                <div className="form-group">
                  <label htmlFor="key-name" className="form-label">
                    Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="key-name"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value, false)}
                    placeholder="e.g., OpenAI, Stripe"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="key-description" className="form-label">
                    Description (optional)
                  </label>
                  <textarea
                    id="key-description"
                    className="form-textarea"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe what this key is used for"
                    rows={3}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="key-apiKey" className="form-label">
                    Full API Key <span className="required">*</span>
                  </label>
                  <input
                    type="password"
                    id="key-apiKey"
                    className="form-input"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    placeholder="Enter your full API key"
                    required
                  />
                  <p className="form-hint">
                    ⚠️ This key will be split and stored securely. You'll receive a partial key once to copy.
                  </p>
                </div>
                <div className="form-group">
                  <label htmlFor="key-whitelisted-urls" className="form-label">
                    Whitelisted URLs <span className="required">*</span>
                  </label>
                  <div className="whitelisted-urls-input-group">
                    <input
                      type="text"
                      id="key-whitelisted-urls"
                      className="form-input"
                      value={newWhitelistedUrl}
                      onChange={(e) => setNewWhitelistedUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddWhitelistedUrl(false);
                        }
                      }}
                      placeholder="e.g., api.example.com or api.example.com/path"
                    />
                    <button
                      type="button"
                      className="btn-secondary btn-small"
                      onClick={(e) => {
                        e.preventDefault();
                        handleAddWhitelistedUrl(false);
                      }}
                    >
                      Add
                    </button>
                  </div>
                  <p className="form-hint">
                    At least one URL is required. URLs are treated as wildcards (e.g., "api.example.com" matches "api.example.com/*"). Protocol is not required.
                  </p>
                  {formData.whitelistedUrls.length > 0 && (
                    <div className="whitelisted-urls-list">
                      {formData.whitelistedUrls.map((url, index) => (
                        <div key={index} className="whitelisted-url-item">
                          <code className="whitelisted-url-value">{url}/*</code>
                          <button
                            type="button"
                            className="whitelisted-url-remove"
                            onClick={(e) => {
                              e.preventDefault();
                              handleRemoveWhitelistedUrl(url, false);
                            }}
                            title="Remove URL"
                          >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Rate Limit (optional)
                  </label>
                  <div className="rate-limit-input-group">
                    <label className="toggle-container">
                      <input
                        type="checkbox"
                        checked={formData.rateLimit !== null && formData.rateLimit > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, rateLimit: 60 });
                          } else {
                            setFormData({ ...formData, rateLimit: -1 });
                          }
                        }}
                      />
                      <span className="toggle-label">Enable rate limiting</span>
                    </label>
                    {formData.rateLimit !== null && formData.rateLimit > 0 && (
                      <div className="rate-limit-value-input">
                        <input
                          type="number"
                          id="key-rate-limit"
                          className="form-input"
                          value={formData.rateLimit}
                          onChange={(e) => setFormData({ ...formData, rateLimit: parseInt(e.target.value) || 1 })}
                          min={1}
                          placeholder="60"
                        />
                        <span className="rate-limit-unit">requests/min</span>
                      </div>
                    )}
                  </div>
                  <p className="form-hint">
                    Limit the number of requests per minute for this key. Leave unchecked for unlimited requests.
                  </p>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Allow Web Requests
                  </label>
                  <div className="allow-web-input-group">
                    <label className="toggle-container">
                      <input
                        type="checkbox"
                        checked={formData.allowsWeb}
                        onChange={(e) => setFormData({ ...formData, allowsWeb: e.target.checked })}
                      />
                      <span className="toggle-label">Enable web requesting</span>
                    </label>
                  </div>
                  {formData.allowsWeb && (
                    <div className="allow-web-warning">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 1L15 14H1L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M8 6V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
                      </svg>
                      <div>
                        <strong>Security Warning:</strong> Enabling this allows any web service to make proxy requests using this key, bypassing device verification protection. <strong>Strongly consider enabling rate limiting above</strong> to mitigate potential abuse.
                      </div>
                    </div>
                  )}
                  <p className="form-hint">
                    When enabled, requests can be made from any web origin without device verification.
                  </p>
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleCloseModal}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={submitting || !formData.apiKey || formData.whitelistedUrls.length === 0}>
                    {submitting ? "Creating..." : "Create Key"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Edit Project Modal */}
      {
        showEditProjectModal && (
          <div className={`modal-overlay ${isClosingEditModal ? 'closing' : ''}`} onClick={handleCloseEditProject}>
            <div className={`modal-content ${isClosingEditModal ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Edit Project</h2>
                <button
                  className="modal-close-btn"
                  onClick={handleCloseEditProject}
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleUpdateProject} className="modal-form">
                <div className="form-group">
                  <label htmlFor="project-name" className="form-label">
                    Project Name
                  </label>
                  <input
                    type="text"
                    id="project-name"
                    className="form-input"
                    value={projectFormData.name}
                    onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                    placeholder="Enter project name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="project-description" className="form-label">
                    Description
                  </label>
                  <textarea
                    id="project-description"
                    className="form-textarea"
                    value={projectFormData.description}
                    onChange={(e) => setProjectFormData({ ...projectFormData, description: e.target.value })}
                    placeholder="Enter project description"
                    rows={4}
                  />
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleCloseEditProject}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={updatingProject}>
                    {updatingProject ? "Updating..." : "Update Project"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Edit Key Modal */}
      {
        showEditKeyModal && (
          <div className={`modal-overlay ${isClosingEditKeyModal ? 'closing' : ''}`} onClick={handleCloseEditKey}>
            <div className={`modal-content ${isClosingEditKeyModal ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Edit API Key</h2>
                <button
                  className="modal-close-btn"
                  onClick={handleCloseEditKey}
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleUpdateKey} className="modal-form">
                <div className="form-group">
                  <label htmlFor="key-edit-name" className="form-label">
                    Key Name
                  </label>
                  <input
                    type="text"
                    id="key-edit-name"
                    className="form-input"
                    value={keyFormData.name}
                    onChange={(e) => handleNameChange(e.target.value, true)}
                    placeholder="Enter key name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="key-edit-description" className="form-label">
                    Description
                  </label>
                  <textarea
                    id="key-edit-description"
                    className="form-textarea"
                    value={keyFormData.description}
                    onChange={(e) => setKeyFormData({ ...keyFormData, description: e.target.value })}
                    placeholder="Enter key description"
                    rows={4}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="key-edit-whitelisted-urls" className="form-label">
                    Whitelisted URLs <span className="required">*</span>
                  </label>
                  <div className="whitelisted-urls-input-group">
                    <input
                      type="text"
                      id="key-edit-whitelisted-urls"
                      className="form-input"
                      value={newWhitelistedUrlEdit}
                      onChange={(e) => setNewWhitelistedUrlEdit(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddWhitelistedUrl(true);
                        }
                      }}
                      placeholder="e.g., api.example.com or api.example.com/path"
                    />
                    <button
                      type="button"
                      className="btn-secondary btn-small"
                      onClick={(e) => {
                        e.preventDefault();
                        handleAddWhitelistedUrl(true);
                      }}
                    >
                      Add
                    </button>
                  </div>
                  <p className="form-hint">
                    At least one URL is required. URLs are treated as wildcards (e.g., "api.example.com" matches "api.example.com/*"). Protocol is not required.
                  </p>
                  {keyFormData.whitelistedUrls.length > 0 && (
                    <div className="whitelisted-urls-list">
                      {keyFormData.whitelistedUrls.map((url, index) => (
                        <div key={index} className="whitelisted-url-item">
                          <code className="whitelisted-url-value">{url}/*</code>
                          <button
                            type="button"
                            className="whitelisted-url-remove"
                            onClick={(e) => {
                              e.preventDefault();
                              handleRemoveWhitelistedUrl(url, true);
                            }}
                            title="Remove URL"
                          >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Rate Limit (optional)
                  </label>
                  <div className="rate-limit-input-group">
                    <label className="toggle-container">
                      <input
                        type="checkbox"
                        checked={keyFormData.rateLimit !== null && keyFormData.rateLimit > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setKeyFormData({ ...keyFormData, rateLimit: 60 });
                          } else {
                            setKeyFormData({ ...keyFormData, rateLimit: -1 });
                          }
                        }}
                      />
                      <span className="toggle-label">Enable rate limiting</span>
                    </label>
                    {keyFormData.rateLimit !== null && keyFormData.rateLimit > 0 && (
                      <div className="rate-limit-value-input">
                        <input
                          type="number"
                          id="key-edit-rate-limit"
                          className="form-input"
                          value={keyFormData.rateLimit}
                          onChange={(e) => setKeyFormData({ ...keyFormData, rateLimit: parseInt(e.target.value) || 1 })}
                          min={1}
                          placeholder="60"
                        />
                        <span className="rate-limit-unit">requests/min</span>
                      </div>
                    )}
                  </div>
                  <p className="form-hint">
                    Limit the number of requests per minute for this key. Leave unchecked for unlimited requests.
                  </p>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Allow Web Requests
                  </label>
                  <div className="allow-web-input-group">
                    <label className="toggle-container">
                      <input
                        type="checkbox"
                        checked={keyFormData.allowsWeb}
                        onChange={(e) => setKeyFormData({ ...keyFormData, allowsWeb: e.target.checked })}
                      />
                      <span className="toggle-label">Enable web requesting</span>
                    </label>
                  </div>
                  {keyFormData.allowsWeb && (
                    <div className="allow-web-warning">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 1L15 14H1L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M8 6V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
                      </svg>
                      <div>
                        <strong>Security Warning:</strong> Enabling this allows any web service to make proxy requests using this key, bypassing device verification protection. <strong>Strongly consider enabling rate limiting above</strong> to mitigate potential abuse.
                      </div>
                    </div>
                  )}
                  <p className="form-hint">
                    When enabled, requests can be made from any web origin without device verification.
                  </p>
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleCloseEditKey}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={updatingKey || keyFormData.whitelistedUrls.length === 0}>
                    {updatingKey ? "Updating..." : "Update Key"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Partial Key Display (One-time) */}
      {
        showPartialKey && (
          <div className={`modal-overlay ${isClosingPartialKey ? 'closing' : ''}`}>
            <div className={`partial-key-modal ${isClosingPartialKey ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
              <div className="partial-key-header">
                <h2 className="partial-key-title">⚠️ Save Your Partial Key</h2>
                <p className="partial-key-warning">
                  This is the only time you'll see your partial key. Copy it now!
                </p>
              </div>
              <div className="partial-key-content">
                <label className="form-label">Your Partial Key:</label>
                <div className="partial-key-display">
                  <code className="partial-key-value">{partialKeyToShow}</code>
                </div>
                <p className="partial-key-instruction">
                  After closing, this key will never be shown again. Use it in your requests with the format: <code>%ProxLock_PARTIAL_KEY:your_partial_key%</code>
                </p>
              </div>
              <div className="partial-key-actions">
                <button
                  className={`btn-primary ${copiedButtonId === 'partial-key' ? 'copied' : ''}`}
                  onClick={async () => {
                    await handleCopyToClipboard(partialKeyToShow, 'partial-key');
                    setTimeout(() => {
                      handleClosePartialKey();
                    }, 500);
                  }}
                >
                  {copiedButtonId === 'partial-key' ? '✓ Copied!' : 'Copy & Close'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Upload/Link DeviceCheck Key Modal */}
      {
        showDeviceCheckModal && (
          <div className={`modal-overlay ${isClosingDeviceCheckModal ? 'closing' : ''}`} onClick={handleCloseDeviceCheckModal}>
            <div className={`modal-content ${isClosingDeviceCheckModal ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">
                  {deviceCheckModalMode === "upload" ? "Upload Device Check Key" : "Link Device Check Key"}
                </h2>
                <button
                  className="modal-close-btn"
                  onClick={handleCloseDeviceCheckModal}
                >
                  ×
                </button>
              </div>

              {/* Mode Toggle */}
              <div className="modal-mode-toggle">
                <button
                  type="button"
                  className={`modal-mode-btn ${deviceCheckModalMode === "upload" ? "active" : ""}`}
                  onClick={() => handleDeviceCheckModalModeChange("upload")}
                >
                  Upload New Key
                </button>
                <button
                  type="button"
                  className={`modal-mode-btn ${deviceCheckModalMode === "link" ? "active" : ""}`}
                  onClick={() => handleDeviceCheckModalModeChange("link")}
                >
                  Link Existing Key
                </button>
              </div>

              {deviceCheckModalMode === "upload" ? (
                <form onSubmit={handleUploadDeviceCheck} className="modal-form">
                  <div className="form-group">
                    <label htmlFor="devicecheck-teamid" className="form-label">
                      Team ID <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      id="devicecheck-teamid"
                      className="form-input"
                      value={deviceCheckFormData.teamID}
                      onChange={(e) => setDeviceCheckFormData({ ...deviceCheckFormData, teamID: e.target.value })}
                      placeholder="e.g., XYZ789GHI0"
                      required
                      minLength={10}
                      maxLength={10}
                      pattern=".{10}"
                    />
                    <p className="form-hint">
                      Team ID must be exactly 10 characters.
                    </p>
                  </div>
                  <div className="form-group">
                    <label htmlFor="devicecheck-keyid" className="form-label">
                      Key ID <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      id="devicecheck-keyid"
                      className="form-input"
                      value={deviceCheckFormData.keyID}
                      onChange={(e) => setDeviceCheckFormData({ ...deviceCheckFormData, keyID: e.target.value })}
                      placeholder="e.g., ABC123DEF4"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="devicecheck-privatekey" className="form-label">
                      Private Key (PEM format) <span className="required">*</span>
                    </label>
                    <div className="file-upload-container">
                      <input
                        type="file"
                        id="devicecheck-file-upload"
                        accept=".pem,.key,.txt,.p8"
                        className="file-upload-input"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileRead(file);
                          }
                        }}
                      />
                      <label
                        htmlFor="devicecheck-file-upload"
                        className={`file-upload-label ${isDraggingOver ? 'dragging' : ''}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingOver(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingOver(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingOver(false);

                          const file = e.dataTransfer.files?.[0];
                          if (file) {
                            handleFileRead(file);
                          }
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9 12V6M9 6L6 9M9 6L12 9M3 15H15C15.5523 15 16 14.5523 16 14V4C16 3.44772 15.5523 3 15 3H3C2.44772 3 2 3.44772 2 4V14C2 14.5523 2.44772 15 3 15Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>{isDraggingOver ? 'Drop Key File Here' : 'Upload Key File'}</span>
                      </label>
                    </div>
                    <textarea
                      id="devicecheck-privatekey"
                      className="form-textarea"
                      value={deviceCheckFormData.privateKey}
                      onChange={(e) => setDeviceCheckFormData({ ...deviceCheckFormData, privateKey: e.target.value })}
                      placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                      rows={8}
                      required
                    />
                    <p className="form-hint">
                      Paste your ES256 private key in PEM format here, or upload a .p8 file.
                    </p>
                  </div>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleCloseDeviceCheckModal}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={uploadingDeviceCheck || !deviceCheckFormData.teamID.trim() || deviceCheckFormData.teamID.trim().length !== 10 || !deviceCheckFormData.keyID.trim() || !deviceCheckFormData.privateKey.trim()}>
                      {uploadingDeviceCheck ? "Uploading..." : "Upload Key"}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleLinkKey} className="modal-form">
                  <div className="form-group">
                    <label htmlFor="link-key-select" className="form-label">
                      Select Key <span className="required">*</span>
                    </label>
                    {loadingAvailableKeys ? (
                      <div className="form-loading">
                        <div className="spinner"></div>
                        <span>Loading available keys...</span>
                      </div>
                    ) : availableDeviceCheckKeys.length === 0 ? (
                      <div className="form-empty">
                        <p>No DeviceCheck keys available. Please upload a key first.</p>
                      </div>
                    ) : (
                      <div className="custom-key-selector-inline">
                        {availableDeviceCheckKeys.map((key) => {
                          const keyValue = `${key.teamID}-${key.keyID}`;
                          const isSelected = selectedKeyToLink === keyValue;
                          return (
                            <button
                              key={keyValue}
                              type="button"
                              className={`custom-key-selector-option-inline ${isSelected ? 'selected' : ''}`}
                              onClick={() => {
                                setSelectedKeyToLink(keyValue);
                              }}
                            >
                              <div className="custom-key-option-content">
                                <div className="custom-key-option-header">
                                  <span className="custom-key-option-label">Team ID</span>
                                  <code className="custom-key-option-value">{key.teamID}</code>
                                  <span className="custom-key-option-label" style={{ marginLeft: '1rem' }}>Key ID</span>
                                  <code className="custom-key-option-value">{key.keyID}</code>
                                </div>
                              </div>
                              {isSelected && (
                                <svg
                                  width="20"
                                  height="20"
                                  viewBox="0 0 20 20"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="custom-key-option-check"
                                >
                                  <path
                                    d="M16 5L7.5 13.5L4 10"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <p className="form-hint">
                      Select an existing DeviceCheck key to link to this project. This will copy the key from your account.
                    </p>
                  </div>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleCloseDeviceCheckModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={linkingKey || !selectedKeyToLink || availableDeviceCheckKeys.length === 0}
                    >
                      {linkingKey ? "Linking..." : "Link Key"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )
      }

      {/* Bulk Rate Limit Modal */}
      {
        showBulkRateLimitModal && (
          <div className={`modal-overlay ${isClosingBulkRateLimitModal ? 'closing' : ''}`} onClick={handleCloseBulkRateLimitModal}>
            <div className={`modal-content ${isClosingBulkRateLimitModal ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Set Rate Limit for All Keys</h2>
                <button
                  className="modal-close-btn"
                  onClick={handleCloseBulkRateLimitModal}
                >
                  ×
                </button>
              </div>
              <div className="modal-form">
                <div className="form-group">
                  <p className="form-description">
                    Apply a rate limit to all {keys.length} key{keys.length !== 1 ? 's' : ''} in this project.
                  </p>
                  <div className="rate-limit-input-group">
                    <label className="toggle-container">
                      <input
                        type="checkbox"
                        checked={bulkRateLimitEnabled}
                        onChange={(e) => setBulkRateLimitEnabled(e.target.checked)}
                      />
                      <span className="toggle-label">Enable rate limiting</span>
                    </label>
                    {bulkRateLimitEnabled && (
                      <div className="rate-limit-value-input">
                        <input
                          type="number"
                          id="bulk-rate-limit"
                          className="form-input"
                          value={bulkRateLimitValue}
                          onChange={(e) => setBulkRateLimitValue(parseInt(e.target.value) || 1)}
                          min={1}
                          placeholder="60"
                        />
                        <span className="rate-limit-unit">requests/min</span>
                      </div>
                    )}
                  </div>
                  <p className="form-hint">
                    {bulkRateLimitEnabled
                      ? `All keys will be limited to ${bulkRateLimitValue} requests per minute.`
                      : "All keys will have unlimited requests (no rate limit)."}
                  </p>
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleCloseBulkRateLimitModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleApplyBulkRateLimit}
                    disabled={applyingBulkRateLimit}
                  >
                    {applyingBulkRateLimit ? "Applying..." : "Apply to All Keys"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Play Integrity Modal */}
      {
        showPlayIntegrityModal && (
          <div className={`modal-overlay ${isClosingPlayIntegrityModal ? 'closing' : ''}`} onClick={handleClosePlayIntegrityModal}>
            <div className={`modal-content ${isClosingPlayIntegrityModal ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">
                  Upload Play Integrity Config
                </h2>
                <button
                  className="modal-close-btn"
                  onClick={handleClosePlayIntegrityModal}
                >
                  ×
                </button>
              </div>

              {/* Mode Toggle */}
              <div className="modal-mode-toggle">
                <button
                  type="button"
                  className={`modal-mode-btn ${playIntegrityModalMode === "upload" ? "active" : ""}`}
                  onClick={() => handlePlayIntegrityModalModeChange("upload")}
                >
                  Upload New Config
                </button>
                <button
                  type="button"
                  className={`modal-mode-btn ${playIntegrityModalMode === "link" ? "active" : ""}`}
                  onClick={() => handlePlayIntegrityModalModeChange("link")}
                >
                  Link Existing Config
                </button>
              </div>

              {playIntegrityModalMode === "upload" ? (
                <form onSubmit={handleUploadPlayIntegrity} className="modal-form">
                  <div className="form-group">
                    <label htmlFor="playintegrity-package-name" className="form-label">
                      Android Package Name <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      id="playintegrity-package-name"
                      className="form-input"
                      value={playIntegrityPackageName}
                      onChange={(e) => setPlayIntegrityPackageName(e.target.value)}
                      placeholder="e.g., com.example.app"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Allowed App Recognition Verdicts
                    </label>
                    <div className="checkbox-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {[
                        { value: "PLAY_RECOGNIZED", label: "Play Recognized", description: "The app and certificate match the versions distributed by Google Play.", tag: "Recommended", tagColor: "#10b981", tagBg: "rgba(16, 185, 129, 0.1)" },
                        { value: "UNRECOGNIZED_VERSION", label: "Unrecognized Version", description: "The certificate or package name does not match Google Play records.", tag: "Development", tagColor: "#f59e0b", tagBg: "rgba(245, 158, 11, 0.1)" },
                        { value: "UNEVALUATED", label: "Unevaluated", description: "Application integrity was not evaluated.", tag: "Not Recommended", tagColor: "#ef4444", tagBg: "rgba(239, 68, 68, 0.1)" }
                      ].map((verdict) => (
                        <label key={verdict.value} className="checkbox-container" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={playIntegrityAllowedVerdicts.includes(verdict.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPlayIntegrityAllowedVerdicts([...playIntegrityAllowedVerdicts, verdict.value]);
                              } else {
                                setPlayIntegrityAllowedVerdicts(playIntegrityAllowedVerdicts.filter(v => v !== verdict.value));
                              }
                            }}
                            style={{ marginTop: '0.25rem' }}
                          />
                          <div className="checkbox-content">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.125rem' }}>
                              <span className="checkbox-label" style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{verdict.label}</span>
                              {verdict.tag && (
                                <span style={{
                                  fontSize: '0.7rem',
                                  padding: '0.125rem 0.375rem',
                                  borderRadius: '0.25rem',
                                  backgroundColor: verdict.tagBg,
                                  color: verdict.tagColor,
                                  fontWeight: 600,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.025em'
                                }}>
                                  {verdict.tag}
                                </span>
                              )}
                            </div>
                            <span className="checkbox-description" style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{verdict.description}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="playintegrity-json" className="form-label">
                      Service Account JSON <span className="required">*</span>
                    </label>
                    <div className="file-upload-container">
                      <input
                        type="file"
                        id="playintegrity-file-upload"
                        accept=".json"
                        className="file-upload-input"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handlePlayIntegrityFileRead(file);
                          }
                        }}
                      />
                      <label
                        htmlFor="playintegrity-file-upload"
                        className={`file-upload-label ${isDraggingOverPlayIntegrity ? 'dragging' : ''}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingOverPlayIntegrity(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingOverPlayIntegrity(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingOverPlayIntegrity(false);

                          const file = e.dataTransfer.files?.[0];
                          if (file) {
                            handlePlayIntegrityFileRead(file);
                          }
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9 12V6M9 6L6 9M9 6L12 9M3 15H15C15.5523 15 16 14.5523 16 14V4C16 3.44772 15.5523 3 15 3H3C2.44772 3 2 3.44772 2 4V14C2 14.5523 2.44772 15 3 15Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>{isDraggingOverPlayIntegrity ? 'Drop JSON File Here' : 'Upload JSON File'}</span>
                      </label>
                    </div>
                    <textarea
                      id="playintegrity-json"
                      className="form-textarea"
                      value={playIntegrityServiceAccountJson}
                      onChange={(e) => setPlayIntegrityServiceAccountJson(e.target.value)}
                      placeholder='{"type": "service_account", "project_id": "...", ...}'
                      rows={8}
                      required
                    />
                    <p className="form-hint">
                      Paste your Google Cloud service account JSON here, or upload a .json file.
                    </p>
                  </div>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleClosePlayIntegrityModal}
                    >
                      Cancel
                    </button>

                    <button type="submit" className="btn-primary" disabled={uploadingPlayIntegrity || !playIntegrityServiceAccountJson.trim() || !playIntegrityPackageName.trim()}>
                      {uploadingPlayIntegrity ? "Uploading..." : "Upload Config"}
                    </button>
                  </div>
                </form>
              ) : playIntegrityModalMode === "update" ? (
                <form onSubmit={handleUpdatePlayIntegrityConfig} className="modal-form">
                  <div className="form-group">
                    <label htmlFor="playintegrity-package-name-update" className="form-label">
                      Android Package Name (Optional)
                    </label>
                    <input
                      type="text"
                      id="playintegrity-package-name-update"
                      className="form-input"
                      value={playIntegrityPackageName}
                      onChange={(e) => setPlayIntegrityPackageName(e.target.value)}
                      placeholder="e.g., com.example.app"
                    />
                    <p className="form-hint">Leave blank to keep existing package name.</p>
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Allowed App Recognition Verdicts
                    </label>
                    <div className="checkbox-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {[
                        { value: "PLAY_RECOGNIZED", label: "Play Recognized", description: "The app and certificate match the versions distributed by Google Play.", tag: "Recommended", tagColor: "#10b981", tagBg: "rgba(16, 185, 129, 0.1)" },
                        { value: "UNRECOGNIZED_VERSION", label: "Unrecognized Version", description: "The certificate or package name does not match Google Play records.", tag: "Development", tagColor: "#f59e0b", tagBg: "rgba(245, 158, 11, 0.1)" },
                        { value: "UNEVALUATED", label: "Unevaluated", description: "Application integrity was not evaluated.", tag: "Not Recommended", tagColor: "#ef4444", tagBg: "rgba(239, 68, 68, 0.1)" }
                      ].map((verdict) => (
                        <label key={verdict.value} className="checkbox-container" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={playIntegrityAllowedVerdicts.includes(verdict.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPlayIntegrityAllowedVerdicts([...playIntegrityAllowedVerdicts, verdict.value]);
                              } else {
                                setPlayIntegrityAllowedVerdicts(playIntegrityAllowedVerdicts.filter(v => v !== verdict.value));
                              }
                            }}
                            style={{ marginTop: '0.25rem' }}
                          />
                          <div className="checkbox-content">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.125rem' }}>
                              <span className="checkbox-label" style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{verdict.label}</span>
                              {verdict.tag && (
                                <span style={{
                                  fontSize: '0.7rem',
                                  padding: '0.125rem 0.375rem',
                                  borderRadius: '0.25rem',
                                  backgroundColor: verdict.tagBg,
                                  color: verdict.tagColor,
                                  fontWeight: 600,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.025em'
                                }}>
                                  {verdict.tag}
                                </span>
                              )}
                            </div>
                            <span className="checkbox-description" style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{verdict.description}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleClosePlayIntegrityModal}
                    >
                      Cancel
                    </button>

                    <button type="submit" className="btn-primary" disabled={updatingPlayIntegrityConfig}>
                      {updatingPlayIntegrityConfig ? "Updating..." : "Update Config"}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleLinkPlayIntegrity} className="modal-form">
                  <div className="form-group">
                    <label htmlFor="link-playintegrity-select" className="form-label">
                      Select Key <span className="required">*</span>
                    </label>
                    {loadingAvailablePlayIntegrityConfigs ? (
                      <div className="form-loading">
                        <div className="spinner"></div>
                        <span>Loading available keys...</span>
                      </div>
                    ) : availablePlayIntegrityConfigs.length === 0 ? (
                      <div className="form-empty">
                        <p>No Play Integrity keys available. Please upload a key first.</p>
                      </div>
                    ) : (
                      <div className="custom-key-selector-inline">
                        {availablePlayIntegrityConfigs.map((config) => {
                          const keyValue = config.projectID;
                          const isSelected = selectedPlayIntegrityToLink === keyValue;
                          return (
                            <button
                              key={keyValue}
                              type="button"
                              className={`custom-key-selector-option-inline ${isSelected ? 'selected' : ''}`}
                              onClick={() => {
                                setSelectedPlayIntegrityToLink(keyValue);
                              }}
                            >
                              <div className="custom-key-option-content">
                                <div className="custom-key-option-header">
                                  <span className="custom-key-option-label">Client Email</span>
                                  <code className="custom-key-option-value">{config.clientEmail}</code>
                                </div>
                              </div>
                              {isSelected && (
                                <svg
                                  width="20"
                                  height="20"
                                  viewBox="0 0 20 20"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="custom-key-option-check"
                                >
                                  <path
                                    d="M16 5L7.5 13.5L4 10"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <p className="form-hint">
                      Select an existing Play Integrity key to link to this project. This will copy the key from your account.
                    </p>
                  </div>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleClosePlayIntegrityModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={linkingPlayIntegrity || !selectedPlayIntegrityToLink || availablePlayIntegrityConfigs.length === 0}
                    >
                      {linkingPlayIntegrity ? "Linking..." : "Link Key"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div >
        )
      }
    </div >
  );
}
