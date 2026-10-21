import fs from 'node:fs/promises';
import path from 'node:path';
import Medicine from '../models/Medicine.js';
import Bill from '../models/Bill.js';
import { MANUFACTURER_SORT, MEDICINE_COLLATION } from './medicineOrdering.js';
import { salesReportStages, salesTotals } from './salesPeriodReport.js';

export const INVENTORY_COLUMNS = ['Medicine name','Manufacturer','Expiry date','Purchase cost per pack (PKR)','Units per pack','Sale price per pack (PKR)','Stock quantity (units)','Rack / shelf location'];
const date = value => value ? new Date(value).toISOString().slice(0,10) : '';
function sheet(book, name, headers, widths) {
  const ws = book.addWorksheet(name, { views: [{ state:'frozen', ySplit:1 }] });
  ws.columns = headers.map((header,index) => ({header, width:widths?.[index] || 22}));
  ws.getRow(1).font = { bold:true }; ws.getRow(1).commit(); return ws;
}
async function workbookFile(id, dir, write) {
  const {default:ExcelJS}=await import('exceljs');
  await fs.mkdir(dir,{recursive:true}); const artifact=`${id}.xlsx`, partial=path.join(dir,`${id}.tmp`);
  try { const book = new ExcelJS.stream.xlsx.WorkbookWriter({filename:partial,useStyles:true,useSharedStrings:false}); await write(book); await book.commit(); await fs.rename(partial,path.join(dir,artifact)); return artifact; }
  catch(error) { await fs.rm(partial,{force:true}); throw error; }
}
export async function exportInventoryXlsx(id, dir) {
  return workbookFile(id,dir,async book => {
    const ws=sheet(book,'Medicines',INVENTORY_COLUMNS,[36,28,18,30,18,30,26,26]);

    for await (const med of Medicine.find({isDeleted:{$ne:true}}).collation(MEDICINE_COLLATION).sort(MANUFACTURER_SORT).lean().cursor()) {
      const units=Number(med.unitsPerPack)||1;
      ws.addRow([med.name,med.manufacturer||'',date(med.expiryDate),Number(med.purchasePrice)||0,units,(Number(med.price)||0)*units,Number(med.quantity)||0,med.rackLocation||'']).commit();

    }
    ws.commit();
    const batches=sheet(book,'Batch reference',['Medicine','Manufacturer','Batch number','Expiry date','Stock quantity (units)','Purchase cost per unit (PKR)'],[36,28,28,18,26,30]);
    for await (const med of Medicine.find({isDeleted:{$ne:true}}).select('name manufacturer batches').collation(MEDICINE_COLLATION).sort(MANUFACTURER_SORT).lean().cursor()) {
      for(const batch of med.batches || []) batches.addRow([med.name,med.manufacturer||'',batch.batchNumber||'',date(batch.expiryDate),batch.quantity,batch.purchaseCost]).commit();
    }
    batches.commit();
    const instructions=sheet(book,'Instructions',['Inventory export / reimport instructions'],[120]);
    for(const line of ['Import the Medicines sheet using Bulk Medicine Import. Only Medicine name and positive Purchase cost per pack are required.','Expiry dates are visible YYYY-MM-DD text. Keep the date values unchanged when reimporting.','Sale price per pack is divided by Units per pack. Stock quantity is total tablets / sellable units.','Blank defaults: units=1, stock=0, sale pack price=purchase pack cost. Other fields may stay blank.','This file contains all active medicines, independent of the page or search filter. Archived medicines are excluded.','Batch reference preserves batch details for reference; the normal medicine importer does not restore batch history.','Excel reimport restores the basic medicine list in a fresh/empty inventory. Existing duplicates require review.','Use the full database backup for recovery of bills, refunds, users, batches and audit history.']) instructions.addRow([line]).commit();
    instructions.commit();
  });
}
export async function exportSalesXlsx(id,dir,payload) {
  const stages=salesReportStages(payload.startDate,payload.endDate);
  return workbookFile(id,dir,async book => {
    const rows=sheet(book,'Sales',['Bill number','Sale date (Pakistan)','Type','Payment method','Gross before discount','Discount','Billed sales','Refunds on these bills','Net sales'],[28,30,18,20,26,20,24,28,24]);
    for await(const bill of Bill.aggregate([...stages,{$sort:{saleDate:1,_id:1}},{$project:{billNumber:1,saleDate:1,billType:1,paymentMethod:1,subtotal:1,discount:1,total:1,refunded:1,netSales:1}}]).allowDiskUse(true).cursor()) {
      rows.addRow([bill.billNumber || String(bill._id),new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Karachi',dateStyle:'medium',timeStyle:'short'}).format(bill.saleDate),bill.billType,bill.paymentMethod,bill.subtotal,bill.discount||0,bill.total,bill.refunded,bill.netSales]).commit();
    }
    rows.commit();
    const months=await Bill.aggregate([...stages,{$group:{_id:{$dateToString:{date:'$saleDate',format:'%Y-%m',timezone:'Asia/Karachi'}},...salesTotals}},{$sort:{_id:1}}]).allowDiskUse(true);
    const monthly=sheet(book,'Monthly totals',['Month','Bills','Gross before discount','Discount','Billed sales','Refunds on these bills','Net sales'],[20,16,26,20,24,28,24]);
    const totals={billCount:0,grossSales:0,discount:0,billedSales:0,refunds:0,netSales:0};
    for(const m of months) { monthly.addRow([m._id,m.billCount,m.grossSales,m.discount,m.billedSales,m.refunds,m.netSales]).commit();for(const key of Object.keys(totals))totals[key]+=m[key]; }
    monthly.addRow(['TOTAL',totals.billCount,totals.grossSales,totals.discount,totals.billedSales,totals.refunds,totals.netSales]).commit();monthly.commit();
    const summary=sheet(book,'Report information',['Setting','Value'],[32,115]);
    for(const row of [['Start date',payload.startDate],['End date (inclusive)',payload.endDate],['Time zone','Asia/Karachi'],['Created',new Date().toISOString()],['Scope','Sales made in this range, less all recorded refunds on those bills as of report generation.'],['Online orders','Counted on acceptance date; pending and rejected orders are excluded.'],['Payment methods','All methods are included. Net sales is revenue, not cash collected.'],['Recovery','This is a sales report; restore a full database backup to recover bills.']]) summary.addRow(row).commit(); summary.commit();
  });
}
