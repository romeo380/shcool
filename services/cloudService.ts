import { FullAppState } from '../types';

// This is a mock service. In a real application, this would make API calls
// to a server. For now, it uses localStorage with a simulated delay.

const FAKE_LATENCY = 1000; // ms
const APP_DATA_KEY = 'election_app_data_cloud_mock';

export const cloudService = {
  async loadData(): Promise<FullAppState | null> {
    console.log('☁️ [Cloud Service] Fetching data...');
    return new Promise((resolve) => {
      setTimeout(() => {
        const savedData = localStorage.getItem(APP_DATA_KEY);
        if (savedData) {
          try {
            console.log('☁️ [Cloud Service] Data fetched successfully.');
            // Add migration logic here if data structure changes in the future
            const parsedData = JSON.parse(savedData) as FullAppState;
            resolve(parsedData);
          } catch (e) {
            console.error('☁️ [Cloud Service] Failed to parse data from storage.', e);
            resolve(null);
          }
        } else {
          console.log('☁️ [Cloud Service] No data found in cloud.');
          resolve(null);
        }
      }, FAKE_LATENCY);
    });
  },

  async saveData(state: FullAppState): Promise<void> {
    console.log('☁️ [Cloud Service] Saving data...');
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          const dataToSave = JSON.stringify(state);
          localStorage.setItem(APP_DATA_KEY, dataToSave);
          console.log('☁️ [Cloud Service] Data saved successfully.');
          resolve();
        } catch (e) {
          console.error('☁️ [Cloud Service] Failed to save data.', e);
          reject(e);
        }
      }, FAKE_LATENCY / 2); // Saving is usually faster
    });
  },
};
