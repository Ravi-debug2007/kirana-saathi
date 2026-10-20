import { createExpoExecutor, getDatabase, initializeDatabase } from './database';
import { InventoryRepository, ProductRepository } from './repositories';
import type { Staff } from '../../packages/domain/src';

// Same local-owner model as manual billing, until staff sign-in is implemented.
export const catalogueOwner: Staff = { id: 'local-owner', name: 'Shop owner', active: true, permissions: ['products.write', 'inventory.adjust'] };
export function openCatalogue() {
  initializeDatabase();
  const database = getDatabase();
  if (!database) throw new Error('Local SQLite is unavailable in the web preview. Use an Android development build.');
  const executor = createExpoExecutor(database);
   return { executor, products: new ProductRepository(executor), inventory: new InventoryRepository(executor) };
}
export const operationKey = () => `inventory_${Date.now()}_${Math.random().toString(36).slice(2)}`;
