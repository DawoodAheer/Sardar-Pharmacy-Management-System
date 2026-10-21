import mongoose from 'mongoose';
import Medicine from '../models/Medicine.js';
import MedicineImportIssue from '../models/MedicineImportIssue.js';
import MedicineImportRun from '../models/MedicineImportRun.js';
import StockAdjustment from '../models/StockAdjustment.js';
import {MEDICINE_COLLATION} from '../utils/medicineOrdering.js';
import {normalizeMedicineImportRow} from '../utils/medicineImport.js';
import {ensureBatches,syncBatchTotals,roundMoney,inventoryError} from '../utils/batchInventory.js';
import {recordMedicineAudit,snapshotMedicine} from '../utils/medicineAudit.js';

export const sameName = (a,b) => String(a||'').trim().toLowerCase() === String(b||'').trim().toLowerCase();
export async function prepareInventoryLock() {
 await MedicineImportRun.updateOne({_id:'inventory-import-lock'},{$setOnInsert:{revision:0}},{upsert:true}).catch(error=>{if(error.code!==11000)throw error;});
}
export async function lockInventory(session){await MedicineImportRun.updateOne({_id:'inventory-import-lock'},{$inc:{revision:1}},{session});}
export const findSameName = (name,session) => Medicine.findOne({name:String(name).trim(),isDeleted:{$ne:true}}).collation(MEDICINE_COLLATION).session(session);
export async function approveDuplicateStock(req,res,next){
 try{
  if(req.user.role!=='superadmin')return res.status(403).json({message:'Only Admin can approve duplicate stock.'});
  if(!mongoose.isValidObjectId(req.params.id)||!mongoose.isValidObjectId(req.body.medicineId))throw inventoryError('Choose the existing medicine.',400);
  if(typeof req.body.expectedQuantity!=='number'||!Number.isSafeInteger(req.body.expectedQuantity)||req.body.expectedQuantity<0)throw inventoryError('Refresh the stock preview before approving.',400);
  await prepareInventoryLock();const session=await mongoose.startSession();let result;
  try{await session.withTransaction(async()=>{
   await lockInventory(session);
   const issue=await MedicineImportIssue.findOne({_id:req.params.id,status:'pending'}).session(session);
   if(!issue)throw inventoryError('This request is already processed or no longer pending.',409);
   const {medicine:incoming,errors}=normalizeMedicineImportRow(req.body.medicine || issue.normalizedRow || {});
   if(errors.length)throw inventoryError(errors.join(' '));
   if(!Number.isSafeInteger(incoming.quantity)||incoming.quantity<=0)throw inventoryError('Enter positive whole tablets / units to add.');
   // The incoming name cannot be changed to make an unrelated inventory item match.
   const original=normalizeMedicineImportRow(issue.normalizedRow || issue.originalRow).medicine;
   const target=await Medicine.findOne({_id:req.body.medicineId,isDeleted:{$ne:true}}).session(session);
   if(!target||!sameName(target.name,original.name)||!sameName(incoming.name,original.name))throw inventoryError('Select an active medicine with the same name as this request.',409);
   if(target.quantity!==req.body.expectedQuantity)throw inventoryError('Stock changed. Refresh the review and approve the new total.',409);
   if(incoming.unitsPerPack!==(Number(target.unitsPerPack)||1))throw inventoryError('Units per pack differ. Verify the delivery pack size before merging.');
   const before=target.quantity,after=before+incoming.quantity;
   if(!Number.isSafeInteger(after))throw inventoryError('Resulting stock is too large.');
   const previousValues=snapshotMedicine(target);ensureBatches(target);
   target.batches.push({batchNumber:'APPROVAL-'+issue._id,quantity:incoming.quantity,purchaseCost:roundMoney(incoming.purchasePrice/incoming.unitsPerPack),expiryDate:incoming.expiryDate || null});
   syncBatchTotals(target);await target.save({session});
   await StockAdjustment.create([{medicineId:target._id,medicineName:target.name,previousQuantity:before,newQuantity:after,quantityChanged:incoming.quantity,adjustmentType:'ADD',reason:'Admin approved duplicate delivery '+issue._id,adjustedBy:req.user._id}],{session});
   await recordMedicineAudit({medicine:target,action:'stock_adjusted',previousValues,reason:'Admin approved duplicate delivery '+issue._id,performedBy:req.user._id,session});
   issue.status='resolved';issue.resolvedMedicine=target._id;issue.resolvedBy=req.user._id;issue.resolvedAt=new Date();issue.stockApproval={previousQuantity:before,addedQuantity:incoming.quantity,newQuantity:after,delivery:incoming};await issue.save({session});
   result={message:target.name+': '+before+' + '+incoming.quantity+' = '+after+' units. Admin approval saved.',previousQuantity:before,addedQuantity:incoming.quantity,newQuantity:after,approvedAt:issue.resolvedAt,medicineId:target._id};
  });}finally{await session.endSession();}
  res.json(result);
 }catch(error){next(error);}
}
