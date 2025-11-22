import { z } from 'zod';

/**
 * Validation schemas for all RPC function parameters
 * This prevents sending invalid data to the database and improves security
 */

export const assignRoleSchema = z.object({
  _user_id: z.string().uuid({ message: 'Invalid user ID format' }),
  _role: z.string().min(1, { message: 'Role is required' }),
});

export const setOrderScheduleSchema = z.object({
  _order_id: z.string().uuid({ message: 'Invalid order ID format' }),
  _execution_start_date: z.string().datetime({ message: 'Invalid datetime format' }),
});

export const approveOrderSchema = z.object({
  _order_id: z.string().uuid({ message: 'Invalid order ID format' }),
});

export const rejectOrderSchema = z.object({
  _order_id: z.string().uuid({ message: 'Invalid order ID format' }),
  _rejection_reason: z.string().min(1, { message: 'Rejection reason is required' }),
});

export const sendNotificationSchema = z.object({
  _user_id: z.string().uuid({ message: 'Invalid user ID format' }),
  _title: z.string().min(1, { message: 'Title is required' }),
  _body: z.string().min(1, { message: 'Body is required' }),
  _link: z.string().optional(),
  _type: z.string().optional(),
});

export const getOrCreateProjectSchema = z.object({
  _user_id: z.string().uuid({ message: 'Invalid user ID format' }),
  _location_id: z.string().uuid({ message: 'Invalid location ID format' }),
  _service_type_id: z.string().uuid({ message: 'Invalid service type ID format' }),
  _subcategory_id: z.string().uuid({ message: 'Invalid subcategory ID format' }),
});

export const createProjectV3Schema = z.object({
  _customer_id: z.string().uuid({ message: 'Invalid customer ID format' }),
  _province_id: z.string().uuid({ message: 'Invalid province ID format' }),
  _district_id: z.string().uuid({ message: 'Invalid district ID format' }).nullable().optional(),
  _subcategory_id: z.string().uuid({ message: 'Invalid subcategory ID format' }),
  _address: z.string().min(1, { message: 'Address is required' }),
  _detailed_address: z.string().optional().nullable(),
  _customer_name: z.string().optional().nullable(),
  _customer_phone: z.string().optional().nullable(),
  _location_lat: z.number().optional().nullable(),
  _location_lng: z.number().optional().nullable(),
  _notes: z.string().optional().nullable(),
  _hierarchy_project_id: z.string().uuid().optional().nullable(),
});
