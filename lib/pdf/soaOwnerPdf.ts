import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { OwnerInfo, Property, Unit, Tenant, IncomeRecord, ExpenseRecord } from '@/lib/types';
import {
  drawLetterhead, drawFooter, drawTitle, drawSummaryBoxes,
  fmtCurrency, fmtDate, C, MARGIN,
} from './pdfHelpers';

export interface OwnerSOAOptions {
  owner: OwnerInfo;
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  incomeRecords: IncomeRecord[];
  expenseRecords: ExpenseRecord[];
  currency: string;
  dateFrom: string;
  dateTo: string;
}

export function generateOwnerSOA(opts: OwnerSOAOptions): jsPDF {
  const { owner, properties, units, tenants, incomeRecords, expenseRecords, currency, dateFrom, dateTo } = opts;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const tenantMap = Object.fromEntries(tenants.map((t) => [t.id, t]));
  const unitMap = Object.fromEntries(units.map((u) => [u.id, u]));
  const propMap = Object.fromEntries(properties.map((p) => [p.id, p]));

  let y = drawLetterhead(doc, owner);
  y = drawTitle(doc, 'OWNER STATEMENT OF ACCOUNT', y);

  // Period
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.slate500);
  const period = dateFrom && dateTo ? `${fmtDate(dateFrom)} - ${fmtDate(dateTo)}` : 'All Records';
  doc.text(`Period: ${period}`, MARGIN, y);
  doc.text(`Generated: ${fmtDate(new Date().toISOString())}`, 297 - MARGIN, y, { align: 'right' });
  y += 8;

  // KPIs
  const grossIncome = incomeRecords.reduce((s, r) => s + r.amountPaid, 0);
  const totalExpenses = expenseRecords.reduce((s, r) => s + r.total, 0);
  const netProfit = grossIncome - totalExpenses;
  const margin = grossIncome > 0 ? ((netProfit / grossIncome) * 100).toFixed(1) : '0.0';

  y = drawSummaryBoxes(doc, [
    { label: 'Gross Income', value: fmtCurrency(grossIncome, currency), color: C.green },
    { label: 'Total Expenses', value: fmtCurrency(totalExpenses, currency), color: C.red },
    { label: 'Net Profit', value: fmtCurrency(netProfit, currency), color: netProfit >= 0 ? C.green : C.red },
    { label: 'Profit Margin', value: `${margin}%`, color: netProfit >= 0 ? C.green : C.red },
  ], y);

  // ── Income Table ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.dark);
  doc.text('Income Breakdown', MARGIN, y);
  y += 5;

  const incHead = [['Property', 'Unit', 'Tenant', 'Category', 'Due Date', 'Paid On', 'Amount Paid', 'Method']];
  const incBody: string[][] = [];

  properties.forEach((prop) => {
    const propRecords = incomeRecords.filter((r) => r.propertyId === prop.id);
    if (propRecords.length === 0) return;
    propRecords.forEach((r) => {
      incBody.push([
        prop.name,
        unitMap[r.unitId]?.unitNumber ?? '-',
        tenantMap[r.tenantId]?.name ?? '-',
        r.category,
        fmtDate(r.rentDueDate),
        fmtDate(r.paymentDate),
        fmtCurrency(r.amountPaid, currency),
        r.paymentMethod || '-',
      ]);
    });
    // Subtotal
    const sub = propRecords.reduce((s, r) => s + r.amountPaid, 0);
    incBody.push([`Subtotal: ${prop.name}`, '', '', '', '', '', fmtCurrency(sub, currency), '']);
  });

  autoTable(doc, {
    startY: y,
    head: incHead,
    body: incBody,
    theme: 'grid',
    headStyles: { fillColor: C.headerBg as unknown as [number, number, number], textColor: C.slate700 as unknown as [number, number, number], fontStyle: 'bold', fontSize: 7.5, cellPadding: 2 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2, textColor: C.dark as unknown as [number, number, number] },
    alternateRowStyles: { fillColor: C.lightGray as unknown as [number, number, number] },
    columnStyles: { 6: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.section === 'body' && String(data.cell.raw).startsWith('Subtotal:')) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [239, 246, 255] as [number, number, number];
      }
    },
    margin: { left: MARGIN, right: MARGIN },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable?.finalY ?? y + 10;
  y += 10;

  // ── Expense Table ──
  y = y > 170 ? (doc.addPage(), 20) : y;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.dark);
  doc.text('Expense Breakdown', MARGIN, y);
  y += 5;

  const expHead = [['Property', 'Unit', 'Date', 'Category', 'Amount', 'Addl Fees', 'Total', 'Notes']];
  const expBody: string[][] = [];

  properties.forEach((prop) => {
    const propRecords = expenseRecords.filter((r) => r.propertyId === prop.id);
    if (propRecords.length === 0) return;
    propRecords.forEach((r) => {
      expBody.push([
        prop.name,
        r.appliesToEntireBuilding ? 'Entire Bldg' : (unitMap[r.unitId]?.unitNumber ?? '-'),
        fmtDate(r.date),
        r.category,
        fmtCurrency(r.amount, currency),
        r.additionalFees > 0 ? fmtCurrency(r.additionalFees, currency) : '-',
        fmtCurrency(r.total, currency),
        r.notes || '-',
      ]);
    });
    const sub = propRecords.reduce((s, r) => s + r.total, 0);
    expBody.push([`Subtotal: ${prop.name}`, '', '', '', '', '', fmtCurrency(sub, currency), '']);
  });

  autoTable(doc, {
    startY: y,
    head: expHead,
    body: expBody,
    theme: 'grid',
    headStyles: { fillColor: C.headerBg as unknown as [number, number, number], textColor: C.slate700 as unknown as [number, number, number], fontStyle: 'bold', fontSize: 7.5, cellPadding: 2 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2, textColor: C.dark as unknown as [number, number, number] },
    alternateRowStyles: { fillColor: C.lightGray as unknown as [number, number, number] },
    columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.section === 'body' && String(data.cell.raw).startsWith('Subtotal:')) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [239, 246, 255] as [number, number, number];
      }
    },
    margin: { left: MARGIN, right: MARGIN },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable?.finalY ?? y + 10;
  y += 10;

  // ── Per-property net profit summary ──
  y = y > 170 ? (doc.addPage(), 20) : y;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.dark);
  doc.text('Net Profit by Property', MARGIN, y);
  y += 5;

  const summHead = [['Property', 'Income', 'Expenses', 'Net Profit', 'Margin']];
  const summBody: string[][] = [];

  properties.forEach((prop) => {
    const inc = incomeRecords.filter((r) => r.propertyId === prop.id).reduce((s, r) => s + r.amountPaid, 0);
    const exp = expenseRecords.filter((r) => r.propertyId === prop.id).reduce((s, r) => s + r.total, 0);
    const net = inc - exp;
    const m = inc > 0 ? ((net / inc) * 100).toFixed(1) : '0.0';
    summBody.push([prop.name, fmtCurrency(inc, currency), fmtCurrency(exp, currency), fmtCurrency(net, currency), `${m}%`]);
  });
  summBody.push(['TOTAL', fmtCurrency(grossIncome, currency), fmtCurrency(totalExpenses, currency), fmtCurrency(netProfit, currency), `${margin}%`]);

  autoTable(doc, {
    startY: y,
    head: summHead,
    body: summBody,
    theme: 'grid',
    headStyles: { fillColor: C.headerBg as unknown as [number, number, number], textColor: C.slate700 as unknown as [number, number, number], fontStyle: 'bold', fontSize: 8, cellPadding: 3 },
    bodyStyles: { fontSize: 8, cellPadding: 3, textColor: C.dark as unknown as [number, number, number] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'center' } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === summBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [239, 246, 255] as [number, number, number];
      }
      // Color net profit
      if (data.section === 'body' && data.column.index === 3) {
        const val = String(data.cell.raw);
        if (val.includes('-')) data.cell.styles.textColor = C.red as unknown as [number, number, number];
        else data.cell.styles.textColor = C.green as unknown as [number, number, number];
      }
    },
    margin: { left: MARGIN, right: MARGIN },
  });

  drawFooter(doc);
  return doc;
}
