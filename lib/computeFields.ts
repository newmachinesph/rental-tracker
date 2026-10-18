import { PaymentStatus } from '@prisma/client';

export function computeIncomeFields(body: {
  rentAmount?: number;
  additionalIncome?: number;
  amountPaid?: number;
  paymentDate?: string;
  rentDueDate?: string;
}) {
  const rentAmount = body.rentAmount ?? 0;
  const additionalIncome = body.additionalIncome ?? 0;
  const amountPaid = body.amountPaid ?? 0;
  const paymentDate = body.paymentDate ?? '';
  const rentDueDate = body.rentDueDate ?? '';

  const totalDue = rentAmount + additionalIncome;
  const outstandingBalance = totalDue - amountPaid;

  let paymentStatus: PaymentStatus;
  if (!paymentDate) {
    paymentStatus = PaymentStatus.Unpaid;
  } else if (amountPaid > totalDue) {
    paymentStatus = PaymentStatus.Overpaid;
  } else if (amountPaid >= totalDue && totalDue > 0) {
    paymentStatus = PaymentStatus.Paid;
  } else if (amountPaid > 0) {
    paymentStatus = PaymentStatus.PartiallyPaid;
  } else {
    paymentStatus = PaymentStatus.Unpaid;
  }

  let delayDays = 0;
  if (paymentDate && rentDueDate) {
    const due = new Date(rentDueDate);
    const paid = new Date(paymentDate);
    delayDays = Math.max(0, Math.floor((paid.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
  }

  return { totalDue, outstandingBalance, paymentStatus, delayDays };
}

export function computeExpenseTotal(amount: number, additionalFees: number): number {
  return amount + additionalFees;
}
