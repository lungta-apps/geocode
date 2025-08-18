// Currently no data storage is required for property lookup application
// This file is kept for future user management if needed

export interface IStorage {
  // Storage interface placeholder for future functionality
}

export class MemStorage implements IStorage {
  constructor() {
    // Memory storage placeholder
  }
}

export const storage = new MemStorage();
