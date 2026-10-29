export interface OrderCustomerIdentity {
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_code?: string | null;
}

export function resolveOrderCustomerIdentity(order: OrderCustomerIdentity, profile?: OrderCustomerIdentity | null) {
  const usable = (value?: string | null) => value && value !== 'نامشخص' && value !== '-' ? value : '';
  return {
    customer_name: usable(profile?.customer_name) || usable(order.customer_name),
    customer_phone: usable(profile?.customer_phone) || usable(order.customer_phone),
    customer_code: usable(profile?.customer_code) || usable(order.customer_code),
  };
}