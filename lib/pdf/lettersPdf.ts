import jsPDF from 'jspdf';
import type { OwnerInfo, Tenant, Lease, Property, Unit, MaintenanceTask } from '@/lib/types';
import { drawLetterhead, drawFooter, fmtCurrency, fmtDate, C, MARGIN, PAGE_W } from './pdfHelpers';

export interface LetterOptions {
  owner: OwnerInfo;
  tenant: Tenant;
  lease: Lease;
  property: Property;
  unit: Unit;
  currency: string;
  letterDate?: string;
}

const BODY_W = PAGE_W - MARGIN * 2;

// ── Shared letter skeleton ──────────────────────────────────────

function buildLetter(
  opts: LetterOptions,
  subject: string,
  bodyParagraphs: string[],
): jsPDF {
  const { owner, tenant, unit, letterDate } = opts;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let y = drawLetterhead(doc, owner);

  // Date (right-aligned)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.dark);
  const dateStr = fmtDate(letterDate || new Date().toISOString());
  doc.text(dateStr, PAGE_W - MARGIN, y, { align: 'right' });
  y += 8;

  // Recipient
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(tenant.name, MARGIN, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.slate700);
  doc.text(unit.address, MARGIN, y);
  y += 10;

  // Subject
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C.dark);
  doc.text(`Re: ${subject}`, MARGIN, y);
  y += 8;

  // Salutation
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Dear ${tenant.name},`, MARGIN, y);
  y += 8;

  // Body paragraphs
  bodyParagraphs.forEach((para) => {
    const lines = doc.splitTextToSize(para, BODY_W);
    const lineHeight = 5;
    // Check page break
    if (y + lines.length * lineHeight > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...C.dark);
    doc.text(lines, MARGIN, y);
    y += lines.length * lineHeight + 4;
  });

  // Closing
  y += 4;
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...C.dark);
  doc.text('Sincerely,', MARGIN, y);
  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.text(owner.name, MARGIN, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.slate500);
  doc.text(owner.company, MARGIN, y);
  y += 4;
  if (owner.phone) { doc.text(`Tel: ${owner.phone}`, MARGIN, y); y += 4; }
  if (owner.email) { doc.text(owner.email, MARGIN, y); }

  drawFooter(doc);
  return doc;
}

// ── Custom Letter (for user-customized content) ─────────────────

export interface CustomLetterOptions extends LetterOptions {
  subject: string;
  bodyParagraphs: string[];
}

export function generateCustomLetter(opts: CustomLetterOptions): jsPDF {
  const { subject, bodyParagraphs } = opts;
  return buildLetter(opts, subject, bodyParagraphs);
}

// ── 1. Rent Reminder ────────────────────────────────────────────

export function generateRentReminder(opts: LetterOptions): jsPDF {
  const { lease, currency } = opts;
  return buildLetter(opts, 'Rent Payment Reminder', [
    `This is a friendly reminder that your monthly rent of ${fmtCurrency(lease.monthlyRent, currency)} is due on the 1st of the upcoming month.`,
    `Please ensure that your payment is made on time to avoid any late fees or penalties. You may use any of our accepted payment methods including bank transfer, e-transfer, or check.`,
    `If you have already submitted your payment, please disregard this notice. Should you have any questions or need to discuss alternative payment arrangements, please do not hesitate to contact us.`,
    `We appreciate your prompt attention to this matter and thank you for being a valued tenant.`,
  ]);
}

// ── 2. Late Payment Notice ──────────────────────────────────────

export interface LatePaymentOptions extends LetterOptions {
  outstandingBalance: number;
  daysPastDue: number;
  dueDate: string;
}

export function generateLatePaymentNotice(opts: LatePaymentOptions): jsPDF {
  const { lease, currency, outstandingBalance, daysPastDue, dueDate } = opts;
  return buildLetter(opts, 'Late Rent Payment Notice', [
    `Our records indicate that your rent payment of ${fmtCurrency(lease.monthlyRent, currency)} due on ${fmtDate(dueDate)} has not been received. As of the date of this letter, your payment is ${daysPastDue} day(s) overdue.`,
    `Your current outstanding balance is ${fmtCurrency(outstandingBalance, currency)}. Please be advised that continued non-payment may result in additional late fees and further action as outlined in your lease agreement.`,
    `We strongly urge you to make the full payment at your earliest convenience. If you are experiencing financial difficulties, please contact us immediately so we can discuss possible arrangements.`,
    `Please treat this matter as urgent and ensure payment is made within five (5) business days of receiving this notice.`,
  ]);
}

// ── 3. Lease Renewal ────────────────────────────────────────────

export interface LeaseRenewalOptions extends LetterOptions {
  newLeaseEnd: string;
  newMonthlyRent?: number;
}

export function generateLeaseRenewalLetter(opts: LeaseRenewalOptions): jsPDF {
  const { lease, currency, newLeaseEnd, newMonthlyRent } = opts;
  const newRent = newMonthlyRent ?? lease.monthlyRent;
  const rentChanged = newRent !== lease.monthlyRent;

  return buildLetter(opts, 'Lease Renewal Offer', [
    `Your current lease agreement is set to expire on ${fmtDate(lease.leaseEnd)}. We are pleased to offer you the opportunity to renew your lease for an additional term ending ${fmtDate(newLeaseEnd)}.`,
    rentChanged
      ? `The monthly rent for the renewal term will be ${fmtCurrency(newRent, currency)}, adjusted from the current rate of ${fmtCurrency(lease.monthlyRent, currency)}.`
      : `The monthly rent will remain at ${fmtCurrency(lease.monthlyRent, currency)} for the renewal term.`,
    `All other terms and conditions of the lease will remain unchanged unless otherwise specified in the renewal agreement. Please review the enclosed renewal terms carefully.`,
    `If you wish to renew, please sign and return the renewal agreement by ${fmtDate(lease.leaseEnd)}. If we do not hear from you by this date, we will assume you do not wish to renew, and the lease will terminate on the current end date.`,
    `We value your tenancy and hope you will continue to enjoy your home with us.`,
  ]);
}

// ── 4. Lease Termination ────────────────────────────────────────

export interface LeaseTerminationOptions extends LetterOptions {
  vacateByDate: string;
  reason?: string;
}

export function generateLeaseTerminationLetter(opts: LeaseTerminationOptions): jsPDF {
  const { vacateByDate, reason } = opts;

  const paragraphs = [
    `This letter serves as formal notice that your lease agreement will not be renewed and will terminate as scheduled. You are required to vacate the premises no later than ${fmtDate(vacateByDate)}.`,
  ];
  if (reason) {
    paragraphs.push(`Reason for termination: ${reason}`);
  }
  paragraphs.push(
    `Please ensure that the unit is returned in the same condition as it was at the commencement of your lease, subject to normal wear and tear. A move-out inspection will be scheduled prior to your departure.`,
    `Your security deposit will be returned in accordance with the terms of your lease and applicable local laws, within 30 days of the move-out inspection, minus any deductions for damages or outstanding balances.`,
    `Should you have any questions regarding the move-out process, please do not hesitate to contact our office.`,
  );

  return buildLetter(opts, 'Lease Termination Notice', paragraphs);
}

// ── 5. Move-In Welcome ──────────────────────────────────────────

export function generateMoveInWelcomeLetter(opts: LetterOptions): jsPDF {
  const { lease, currency } = opts;
  return buildLetter(opts, 'Welcome to Your New Home', [
    `We are delighted to welcome you to your new home! Your lease begins on ${fmtDate(lease.leaseStart)} and your monthly rent is ${fmtCurrency(lease.monthlyRent, currency)}.`,
    `Your security deposit of ${fmtCurrency(lease.deposit, currency)} has been received and recorded. Rent is due on the 1st of each month. Please ensure payments are made promptly using our accepted payment methods.`,
    `A move-in inspection will be conducted on your move-in date. Please report any existing damages or concerns within 48 hours of moving in so they can be documented appropriately.`,
    `For any maintenance requests or emergencies, please contact our office immediately. We are committed to ensuring your comfort and satisfaction throughout your tenancy.`,
    `Once again, welcome! We hope you enjoy your new home.`,
  ]);
}

// ── 6. Move-Out Notice ──────────────────────────────────────────

export interface MoveOutOptions extends LetterOptions {
  moveOutDate: string;
}

export function generateMoveOutNoticeLetter(opts: MoveOutOptions): jsPDF {
  const { moveOutDate, lease, currency } = opts;
  return buildLetter(opts, 'Move-Out Instructions', [
    `This letter confirms your scheduled move-out date of ${fmtDate(moveOutDate)}. Please ensure all personal belongings are removed from the premises by this date.`,
    `A move-out inspection will be scheduled within 3 business days of your departure. Please ensure the unit is cleaned and returned in good condition, subject to normal wear and tear.`,
    `Your security deposit of ${fmtCurrency(lease.deposit, currency)} will be reviewed following the inspection. Any deductions for damages, cleaning, or outstanding balances will be itemized and communicated to you. The remaining balance will be refunded within 30 days.`,
    `Please return all keys, access cards, and remote controls to our office on or before your move-out date. Failure to return these items may result in additional charges.`,
    `We thank you for your tenancy and wish you all the best in your future endeavors.`,
  ]);
}

// ── 7. Maintenance Request Confirmation ─────────────────────────

export interface MaintenanceLetterOptions extends LetterOptions {
  task: MaintenanceTask;
}

export function generateMaintenanceConfirmationLetter(opts: MaintenanceLetterOptions): jsPDF {
  const { task } = opts;
  return buildLetter(opts, `Maintenance Request Confirmation - Case #${task.id.toUpperCase()}`, [
    `We acknowledge receipt of your maintenance request submitted on ${fmtDate(task.dateReported)}. Your request has been logged and assigned the following case number: ${task.id.toUpperCase()}.`,
    `Request details:\n  - Category: ${task.category}\n  - Priority: ${task.priority}\n  - Description: ${task.description}`,
    task.contractor
      ? `A contractor (${task.contractor}) has been assigned to address this issue. The estimated cost for this repair is ${fmtCurrency(task.estimatedCost, opts.currency)}.`
      : `We are currently evaluating the request and will assign a contractor shortly. The estimated cost for this repair is ${fmtCurrency(task.estimatedCost, opts.currency)}.`,
    `We will make every effort to resolve this matter promptly. If you have any questions or need to provide additional information, please contact our office and reference your case number.`,
    `Thank you for reporting this issue. Your cooperation in maintaining the property is greatly appreciated.`,
  ]);
}

// ── 8. Maintenance Completion Notice ────────────────────────────

export function generateMaintenanceCompletionLetter(opts: MaintenanceLetterOptions): jsPDF {
  const { task, currency } = opts;
  return buildLetter(opts, `Maintenance Completed - Case #${task.id.toUpperCase()}`, [
    `We are pleased to inform you that the maintenance work for Case #${task.id.toUpperCase()} has been completed as of ${fmtDate(task.completionDate)}.`,
    `Work summary:\n  - Category: ${task.category}\n  - Description: ${task.description}\n  - Contractor: ${task.contractor || 'In-house'}\n  - Actual Cost: ${fmtCurrency(task.actualCost, currency)}`,
    `If you notice any issues related to the completed work, please contact our office within 7 days so we can arrange a follow-up inspection at no additional charge.`,
    `Thank you for your patience during the repair process. We strive to maintain the property to the highest standards for your comfort and safety.`,
  ]);
}
