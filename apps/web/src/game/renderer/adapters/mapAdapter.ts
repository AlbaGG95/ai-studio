import { loadCampaignViewModelFromStorage, type CampaignViewModel } from "../../campaign/campaignViewModel";

export async function getCampaignViewModel(): Promise<CampaignViewModel | null> {
  return loadCampaignViewModelFromStorage();
}
