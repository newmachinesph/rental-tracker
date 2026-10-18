import type { PaymentStatus } from './types';

export function computeIncomeFields(
  rentAmount: number,
  additionalIncome: number,
  amountPaid: number,
  rentDueDate: string,
  paymentDate: string,
): { totalDue: number; outstandingBalance: number; paymentStatus: PaymentStatus; delayDays: number } {
  const totalDue = rentAmount + additionalIncome;
  const outstandingBalance = totalDue - amountPaid;
  let paymentStatus: PaymentStatus = 'Pending';
  if (!paymentDate) {
    paymentStatus = 'Unpaid';
  } else if (amountPaid >= totalDue) {
    paymentStatus = amountPaid > totalDue ? 'Overpaid' : 'Paid';
  } else if (amountPaid > 0) {
    paymentStatus = 'Partially Paid';
  } else {
    paymentStatus = 'Unpaid';
  }
  let delayDays = 0;
  if (paymentDate && rentDueDate) {
    const due = new Date(rentDueDate);
    const paid = new Date(paymentDate);
    delayDays = Math.max(0, Math.floor((paid.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
  }
  return { totalDue, outstandingBalance, paymentStatus, delayDays };
}
