export interface Property {
  id: string;
  name: string;
  units: number;
  type: string;
  address?: string;
}

export interface Unit {
  id: string;
  propertyId: string;
  unitNumber: string;
  address: string;
}

export interface Tenant {
  id: string;
  name: string;
  phone: string;
  email: string;
}

export interface Lease {
  id: string;
  propertyId: string;
  unitId: string;
  tenantId: string;
  unitAddress: string;
  leaseStart: string;
  leaseEnd: string;
  monthlyRent: number;
  deposit: number;
  isCurrentTenant: boolean;
  isRecurringRent: boolean;
  notes: string;
}

export type PaymentStatus = 'Paid' | 'Partially Paid' | 'Overpaid' | 'Unpaid' | 'Pending';

export interface IncomeRecord {
  id: string;
  propertyId: string;
  unitId: string;
  tenantId: string;
  category: string;
  rentDueDate: string;
  rentAmount: number;
  additionalIncome: number;
  totalDue: number;
  paymentDate: string;
  amountPaid: number;
  outstandingBalance: number;
  paymentStatus: PaymentStatus;
  delayDays: number;
  paymentMethod: string;
  notes: string;
  receiptUrl: string;
}

export interface ExpenseRecord {
  id: string;
  date: string;
  propertyId: string;
  appliesToEntireBuilding: boolean;
  unitId: string;
  category: string;
  amount: number;
  additionalFees: number;
  total: number;
  notes: string;
}

export interface MileageRate {
  id: string;
  rate: number;
  startDate: string;
  endDate: string;
}

export interface MileageLog {
  id: string;
  date: string;
  distance: number;
  amount: number;
  propertyId: string;
  description: string;
}

export type MileageUnit = 'km' | 'miles';

export type MaintenancePriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type MaintenanceStatus = 'Open' | 'In Progress' | 'Completed' | 'On Hold';
export type MaintenancePaymentStatus = 'Unpaid' | 'Partially Paid' | 'Paid';

export interface OwnerInfo {
  name: string;
  company: string;
  address: string;
  phone: string;
  email: string;
}

export interface MaintenanceTask {
  id: string;
  propertyId: string;
  appliesToEntireBuilding: boolean;
  unitId: string;
  dateReported: string;
  description: string;
  priority: MaintenancePriority;
  category: string;
  contractor: string;
  estimatedCost: number;
  actualCost: number;
  paymentStatus: MaintenancePaymentStatus;
  completionDate: string;
  status: MaintenanceStatus;
  notes: string;
}
