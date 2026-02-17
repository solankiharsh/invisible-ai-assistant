/**
 * Cloak API model as returned by fetch_models and stored in secure storage.
 */
export interface CloakModel {
  provider: string;
  name: string;
  id: string;
  model: string;
  description: string;
  modality: string;
  isAvailable: boolean;
}
