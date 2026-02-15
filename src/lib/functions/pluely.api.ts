// Helper function to check if Pluely API should be used
export async function shouldUsePluelyAPI(): Promise<boolean> {
  // Always return false for the non-api custom version
  return false;
}
