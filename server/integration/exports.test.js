import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

test('Excel inventory recovery format and full-range sales exports', {skip:!process.env.TEST_MONGO_URI,timeout:120000},async()=>{
  process.env.TZ='Asia/Karachi';
  const uri=new URL(process.env.TEST_MONGO_URI);assert.ok(['127.0.0.1','localhost'].includes(uri.hostname));
  const databaseName=`pharmadesk_test_exports_${randomUUID().replaceAll('-','')}`;uri.pathname=`/${databaseName}`;
  const {default:mongoose}=await import('mongoose');const {default:Medicine}=await import('../models/Medicine.js');const {default:Bill}=await import('../models/Bill.js');
  const {default:ExcelJS}=await import('exceljs');
  const {exportInventoryXlsx,exportSalesXlsx,INVENTORY_COLUMNS}=await import('../utils/excelExports.js');
  const {normalizeMedicineImportRow}=await import('../utils/medicineImport.js');const {getSalesPeriodReport}=await import('../utils/salesPeriodReport.js');
  const dir=await mkdtemp(path.join(tmpdir(),'pharmacy-export-check-'));
  try{
    await mongoose.connect(uri.toString());await Promise.all([Medicine.init(),Bill.init()]);
    const actor=new mongoose.Types.ObjectId();
    const original=await Medicine.create({name:'=Example tablets',manufacturer:'Maker',expiryDate:'2028-04-01',purchasePrice:200,unitsPerPack:10,price:30,quantity:25,rackLocation:'R2',createdBy:actor,batches:[{batchNumber:'FIRST',expiryDate:'2028-04-01',purchaseCost:20,quantity:25}]});
    await Medicine.create({name:'No expiry bottle',purchasePrice:100,unitsPerPack:1,price:0,quantity:3,createdBy:actor});
    await Medicine.create({name:'Archived',purchasePrice:100,quantity:1,isDeleted:true,createdBy:actor});
    const inventory=await exportInventoryXlsx('inventory',dir);const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(path.join(dir,inventory));
    const sheet=workbook.getWorksheet('Medicines');assert.deepEqual(sheet.getRow(1).values.slice(1),INVENTORY_COLUMNS);assert.equal(sheet.rowCount,3);assert.ok(sheet.getColumn(3).width>=18);
    const source=Array.from({length:sheet.rowCount-1},(_,i)=>Object.fromEntries(INVENTORY_COLUMNS.map((key,j)=>[key,sheet.getRow(i+2).getCell(j+1).value ?? ''])));
    const matched=source.find(row=>row['Medicine name']===original.name);assert.equal(matched['Expiry date'],'2028-04-01');assert.equal(matched['Sale price per pack (PKR)'],300);
    const reimport=normalizeMedicineImportRow(matched);assert.deepEqual(reimport.errors,[]);assert.equal(reimport.medicine.price,30);assert.equal(reimport.medicine.purchasePrice,200);assert.equal(reimport.medicine.quantity,25);assert.equal(reimport.medicine.rackLocation,'R2');assert.equal(reimport.medicine.expiryDate.toISOString().slice(0,10),'2028-04-01');
    assert.equal(sheet.getRow(source.findIndex(row=>row['Medicine name']===original.name)+2).getCell(1).type,ExcelJS.ValueType.String);
    assert.equal(workbook.getWorksheet('Batch reference').rowCount,2);
    const blank=normalizeMedicineImportRow(source.find(row=>row['Medicine name']==='No expiry bottle'));assert.deepEqual(blank.errors,[]);assert.equal(blank.medicine.expiryDate,null);assert.equal(blank.medicine.price,0);
    const bills=Array.from({length:55},(_,i)=>({billNumber:`RANGE-${i}`,billType:'INSTORE',orderStatus:'ACCEPTED',pharmacistId:actor,subtotal:110,discount:10,total:100,totalRefunded:10,paymentMethod:'Cash',createdAt:new Date(i===0?'2026-10-19T19:00:00Z':'2026-10-20T12:00:00Z')}));
    bills.push({billNumber:'ONLINE-ACCEPTED',billType:'ONLINE',orderStatus:'ACCEPTED',subtotal:200,total:200,paymentMethod:'Cash',createdAt:new Date('2026-10-01'),reviewedAt:new Date('2027-01-01T12:00:00Z')});
    for(const [name,when,status] of [['BEFORE','2026-10-19T18:59:59Z','ACCEPTED'],['AFTER','2027-10-19T19:00:00Z','ACCEPTED'],['PENDING','2026-10-20T12:00:00Z','PENDING'],['REJECTED','2026-10-20T12:00:00Z','REJECTED']])bills.push({billNumber:name,billType:'INSTORE',orderStatus:status,subtotal:999,total:999,createdAt:new Date(when)});
    await Bill.insertMany(bills);
    const report=page=>new Promise((resolve,reject)=>getSalesPeriodReport({query:{startDate:'2026-10-20',endDate:'2027-10-19',page}},{json:resolve},reject));
    const first=await report(1),second=await report(2);assert.equal(first.total,56);assert.equal(first.rows.length,50);assert.equal(second.rows.length,6);assert.equal(first.totals.billedSales,5700);assert.equal(first.totals.refunds,550);assert.equal(first.totals.netSales,5150);assert.equal(first.monthly.length,2);
    await assert.rejects(()=>new Promise((resolve,reject)=>getSalesPeriodReport({query:{startDate:'2027-02-30',endDate:'2027-03-01'}},{json:resolve},reject)),/valid start/);
    const file=await exportSalesXlsx('sales',dir,{startDate:'2026-10-20',endDate:'2027-10-19'});const sales=new ExcelJS.Workbook();await sales.xlsx.readFile(path.join(dir,file));
    assert.equal(sales.getWorksheet('Sales').rowCount,57,'Excel contains all pages');const monthly=sales.getWorksheet('Monthly totals');assert.equal(monthly.getRow(monthly.rowCount).getCell(7).value,5150);
    assert.equal(await Medicine.countDocuments(),3);assert.equal(await Bill.countDocuments(),60);
  }finally{if(mongoose.connection.name===databaseName)await mongoose.connection.dropDatabase();await mongoose.disconnect();await rm(dir,{recursive:true,force:true});}
});
