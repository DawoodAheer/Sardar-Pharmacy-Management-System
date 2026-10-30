import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

test('same-name deliveries merge without approval and stock can be edited directly', {skip:!process.env.TEST_MONGO_URI,timeout:120000},async()=>{
 const uri=new URL(process.env.TEST_MONGO_URI);assert.ok(['127.0.0.1','localhost'].includes(uri.hostname));
 const dbName='pharmadesk_test_duplicates_'+randomUUID().replaceAll('-','');uri.pathname='/'+dbName;process.env.MONGO_URI=uri.toString();process.env.JWT_ACCESS_SECRET=randomUUID();
 const {default:mongoose}=await import('mongoose');const {default:express}=await import('express');const {default:User}=await import('../models/User.js');const {default:Medicine}=await import('../models/Medicine.js');const {default:Issue}=await import('../models/MedicineImportIssue.js');const {default:Adjustment}=await import('../models/StockAdjustment.js');
 const {default:operationsRoutes}=await import('../routes/operationsRoutes.js');
 const {default:routes}=await import('../routes/medicineRoutes.js');const {default:billRoutes}=await import('../routes/billRoutes.js');const {generateAccessToken}=await import('../utils/generateToken.js');const {errorHandler}=await import('../middleware/errorMiddleware.js');let server;
 try{
  await mongoose.connect(uri.toString());await Promise.all(Object.values(mongoose.models).map(Model=>Model.init()));
  const admin=await User.create({name:'Admin',email:'admin@test.local',password:'Test5786!',role:'superadmin',accountStatus:'approved'});
  const staff=await User.create({name:'Staff',email:'staff@test.local',password:'Test5786!',role:'pharmacist',accountStatus:'approved'});
  const customer=await User.create({name:'Customer',email:'customer@test.local',password:'Test5786!',role:'customer',accountStatus:'approved'});
  const app=express();app.use(express.json());app.use('/medicines',routes);app.use('/bills',billRoutes);app.use('/operations',operationsRoutes);app.use(errorHandler);server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const request=async(path,{method='GET',body,user=admin}={})=>{const response=await fetch('http://127.0.0.1:'+server.address().port+path,{method,headers:{Authorization:'Bearer '+generateAccessToken(user._id,user.role),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return{status:response.status,data:await response.json()};};
  const med=await Medicine.create({name:'Panadol 500mg',manufacturer:'Original',purchasePrice:200,unitsPerPack:10,price:30,quantity:20,expiryDate:'2099-01-01',createdBy:admin._id});
  const other=await Medicine.create({name:'Unrelated',purchasePrice:100,quantity:7,expiryDate:'2099-01-01',createdBy:admin._id});
  const delivery={name:' PANADOL 500mg ',manufacturer:'Original',purchasePrice:250,unitsPerPack:10,price:35,quantity:10,expiryDate:'2099-06-01'};

  const added=await request('/medicines',{method:'POST',body:delivery,user:staff});
  assert.equal(added.status,201,JSON.stringify(added.data));assert.equal(added.data.stockAddition.newQuantity,30);
  assert.equal(await Medicine.countDocuments(),2);assert.equal(await Issue.countDocuments(),0);
  const bulk={sourceFile:'delivery.xlsx',medicines:[{...delivery,quantity:3},{...delivery,quantity:4}]};
  const preview=await request('/medicines/bulk',{method:'POST',body:{...bulk,dryRun:true},user:staff});
  assert.equal(preview.data.validCount,2);assert.ok(preview.data.rows.every(row=>row.duplicate));
  const imported=await request('/medicines/bulk',{method:'POST',body:bulk,user:staff});
  assert.equal(imported.status,201,JSON.stringify(imported.data));assert.equal(imported.data.mergedCount,2);
  assert.equal((await Medicine.findById(med._id)).quantity,37);
  assert.equal((await request('/medicines/bulk',{method:'POST',body:bulk,user:staff})).data.replayed,true);
  assert.equal((await Medicine.findById(med._id)).quantity,37);
  const edited=await request('/medicines/'+med._id,{method:'PUT',user:staff,body:{name:'Panadol corrected',quantity:15,expectedQuantity:37,purchasePrice:300,unitsPerPack:10,price:40,expiryDate:'2098-01-01',rackLocation:'R4'}});
  assert.equal(edited.status,200,JSON.stringify(edited.data));assert.equal(edited.data.quantity,15);
  assert.equal(edited.data.batches.reduce((n,b)=>n+b.quantity,0),15);
  assert.ok(edited.data.batches.filter(b=>b.quantity).every(b=>b.purchaseCost===30&&b.expiryDate.startsWith('2098-01-01')));
  assert.equal((await request('/medicines/'+med._id,{method:'PUT',body:{quantity:20,expectedQuantity:37}})).status,409);
  const receipt=await request('/operations/batches/'+med._id,{method:'POST',user:staff,body:{quantity:5}});
  assert.equal(receipt.status,201,JSON.stringify(receipt.data));assert.equal(receipt.data.medicine.quantity,20);
  assert.ok(receipt.data.medicine.batches.at(-1).batchNumber);assert.equal(receipt.data.medicine.batches.at(-1).purchaseCost,30);
  for(const count of [12,25,0]) {
    const current=await Medicine.findById(med._id);
    const result=await request('/operations/batches/'+med._id,{method:'POST',user:staff,body:{mode:'SET',quantity:count,expectedQuantity:current.quantity}});
    assert.equal(result.status,201,JSON.stringify(result.data));assert.equal(result.data.medicine.quantity,count);
  }
  assert.equal((await request('/operations/batches/'+med._id,{method:'POST',body:{mode:'SET',quantity:-1,expectedQuantity:0}})).status,400);
  assert.equal((await request('/medicines',{method:'POST',body:delivery,user:customer})).status,403);
  const issue=await Issue.create({sourceFile:'old.xlsx',rowNumber:2,originalRow:delivery,normalizedRow:delivery,createdBy:admin._id});
  const fixed=await request('/medicines/import-issues/'+issue._id+'/resolve',{method:'POST',user:staff,body:{...delivery,name:'Panadol corrected',quantity:10,packSalePrice:650,unitsPerPack:30,price:undefined}});
  assert.equal(fixed.status,201,JSON.stringify(fixed.data));assert.equal(fixed.data.medicine.quantity,10);
  assert.equal((await request('/medicines/import-issues/'+issue._id+'/resolve',{method:'POST',body:delivery})).status,404);
  const bill=await request('/bills/instore',{method:'POST',body:{items:[{medicineId:med._id,quantity:5,packSalePrice:400,unitsPerPack:10}]}});
  assert.equal(bill.status,201,JSON.stringify(bill.data));assert.equal((await Medicine.findById(med._id)).quantity,5);
 }finally{if(server)await new Promise(r=>server.close(r));if(mongoose.connection.name===dbName)await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
