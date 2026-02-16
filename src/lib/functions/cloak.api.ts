import { invoke } from "@tauri-apps/api/core";

// Helper function to check if Cloak API should be used (e.g. dev admin key unlocks it)
export async function shouldUseCloakAPI(): Promise<boolean> {
  try {
    const response: { is_active: boolean; is_dev_license: boolean } =
      await invoke("validate_license_api");
    return response.is_dev_license;
  } catch {
    return false;
  }
}
