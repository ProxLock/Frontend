export const copyToClipboard = async (
  text: string,
  onSuccess?: () => void,
  onError?: (message: string) => void
): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    onSuccess?.();
    return true;
  } catch (err) {
    console.error("Failed to copy:", err);
    onError?.("Failed to copy to clipboard. Please copy manually.");
    return false;
  }
};
