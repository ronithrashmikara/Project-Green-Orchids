import { useAuth } from './auth';

const ROLE_MAP = {
  ADMIN: 'ADMIN',
  TRADE_BUYER: 'TRADE_BUYER',
  INVENTORY_MANAGER: 'INVENTORY_MANAGER',
  FINANCE_OFFICER: 'FINANCE_OFFICER',
  DELIVERY_COORDINATOR: 'DELIVERY_COORDINATOR',
  SALES_MANAGER: 'SALES_MANAGER',
};

export function hasPermission(permissions, code) {
  if (!permissions || !Array.isArray(permissions)) return false;
  return permissions.includes(code);
}

export function hasRole(user, role) {
  if (!user) return false;
  return user.role === role || user.roles?.includes(role);
}

export function usePermission(code) {
  const { user, permissions } = useAuth();
  return hasPermission(permissions, code);
}

export function useRole(role) {
  const { user } = useAuth();
  return hasRole(user, role);
}

export function useIsBuyer() {
  const { user } = useAuth();
  return hasRole(user, ROLE_MAP.TRADE_BUYER);
}

export function useIsAdmin() {
  const { user } = useAuth();
  return hasRole(user, ROLE_MAP.ADMIN);
}

export default ROLE_MAP;
