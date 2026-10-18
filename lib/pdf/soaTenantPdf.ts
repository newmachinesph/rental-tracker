import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { OwnerInfo, Tenant, Lease, Property, Unit, IncomeRecord } from '@/lib/types';
import {
  drawLetterhead, drawFooter, drawTitle, drawInfoBlock, drawSummaryBoxes,
  fmtCurrency, fmtDate, C, MARGIN,
} from './pdfHelpers';

export interface TenantSOAOptions {
  owner: OwnerInfo;
  tenant: Tenant;
  lease: Lease;
  property: Property;
  unit: Unit;
  records: IncomeRecord[];
  currency: string;
  dateFrom?: string;
  dateTo?: string;
}

export function generateTenantSOA(opts: TenantSOAOptions): jsPDF {
  const { owner, tenant, lease, property, unit, records, currency, dateFrom, dateTo } = opts;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let y = drawLetterhead(doc, owner);
  y = drawTitle(doc, 'STATEMENT OF ACCOUNT', y);

  // Reference
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.slate500);
  const ref = `Ref: SOA-${tenant.id}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  doc.text(ref, 210 - MARGIN, y - 4, { align: 'right' });
  y += 2;

  // Info block
  const period = dateFrom && dateTo
    ? `${fmtDate(dateFrom)} - ${fmtDate(dateTo)}`
    : 'All Records';

  y = drawInfoBlock(
    doc,
    [
      ['Tenant:', tenant.name],
      ['Phone:', tenant.phone],
      ['Email:', tenant.email],
      ['Unit:', `${unit.unitNumber} - ${property.name}`],
      ['Address:', unit.address],
    ],
    [
      ['Report Date:', fmtDate(new Date().toISOString())],
      ['Period:', period],
      ['Lease Start:', fmtDate(lease.leaseStart)],
      ['Lease End:', fmtDate(lease.leaseEnd)],
      ['Monthly Rent:', fmtCurrency(lease.monthlyRent, currency)],
    ],
    y,
  );

  // Summary boxes
  const totalBilled = records.reduce((s, r) => s + r.totalDue, 0);
  const totalPaid = records.reduce((s, r) => s + r.amountPaid, 0);
  const outstanding = records.reduce((s, r) => s + r.outstandingBalance, 0);

  y = drawSummaryBoxes(doc, [
    { label: 'Total Billed', value: fmtCurrency(totalBilled, currency), color: C.dark },
    { label: 'Total Paid', value: fmtCurrency(totalPaid, currency), color: C.green },
    { label: 'Outstanding', value: fmtCurrency(outstanding, currency), color: outstanding > 0 ? C.red : C.green },
    { label: 'Records', value: String(records.length) },
  ], y);

  // Transaction table
  const head = [['Due Date', 'Category', 'Rent', 'Addl', 'Total Due', 'Paid On', 'Paid', 'Balance', 'Status', 'Delay', 'Method']];
  const body = records.map((r) => [
    fmtDate(r.rentDueDate),
    r.category,
    fmtCurrency(r.rentAmount, currency),
    r.additionalIncome > 0 ? fmtCurrency(r.additionalIncome, currency) : '-',
    fmtCurrency(r.totalDue, currency),
    fmtDate(r.paymentDate),
    fmtCurrency(r.amountPaid, currency),
    fmtCurrency(r.outstandingBalance, currency),
    r.paymentStatus,
    r.delayDays > 0 ? `${r.delayDays}d` : '-',
    r.paymentMethod || '-',
  ]);

  // Totals row
  body.push([
    'TOTALS', '', fmtCurrency(records.reduce((s, r) => s + r.rentAmount, 0), currency),
    fmtCurrency(records.reduce((s, r) => s + r.additionalIncome, 0), currency),
    fmtCurrency(totalBilled, currency), '',
    fmtCurrency(totalPaid, currency),
    fmtCurrency(outstanding, currency), '', '', '',
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: 'grid',
    headStyles: {
      fillColor: C.headerBg as unknown as [number, number, number],
      textColor: C.slate700 as unknown as [number, number, number],
      fontStyle: 'bold',
      fontSize: 7,
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: C.dark as unknown as [number, number, number],
    },
    alternateRowStyles: { fillColor: C.lightGray as unknown as [number, number, number] },
    columnStyles: {
      0: { cellWidth: 18 },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'center', cellWidth: 16 },
      9: { halign: 'center', cellWidth: 10 },
    },
    didParseCell: (data) => {
      // Color status column
      if (data.section === 'body' && data.column.index === 8) {
        const val = String(data.cell.raw);
        if (val === 'Paid' || val === 'Overpaid') data.cell.styles.textColor = C.green as unknown as [number, number, number];
        else if (val === 'Unpaid') data.cell.styles.textColor = C.red as unknown as [number, number, number];
        else if (val.includes('Partial')) data.cell.styles.textColor = C.amber as unknown as [number, number, number];
      }
      // Color balance column
      if (data.section === 'body' && data.column.index === 7) {
        const row = data.row.index;
        if (row < records.length && records[row].outstandingBalance > 0) {
          data.cell.styles.textColor = C.red as unknown as [number, number, number];
        }
      }
      // Bold totals row
      if (data.section === 'body' && data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [239, 246, 255] as [number, number, number];
      }
    },
    margin: { left: MARGIN, right: MARGIN },
  });

  // Signature block
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY ?? 200;
  let sy = finalY + 16;
  sy = sy > 260 ? (doc.addPage(), 30) : sy;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.slate500);
  doc.text('Prepared by:', MARGIN, sy);
  doc.setDrawColor(...C.border);
  doc.line(MARGIN + 22, sy + 1, MARGIN + 80, sy + 1);
  doc.text(`Date: ${fmtDate(new Date().toISOString())}`, MARGIN, sy + 8);

  drawFooter(doc);
  return doc;
}
