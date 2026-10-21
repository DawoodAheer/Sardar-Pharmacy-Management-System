import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

test('same-name deliveries need Admin approval and increase stock exactly once', {skip:!process.env.TEST_MONGO_URI,timeout:120000},async()=>{
 const uri=new URL(process.env.TEST_MONGO_URI);assert.ok(['127.0.0.1','localhost'].includes(uri.hostname));
 const dbName='pharmadesk_test_duplicates_'+randomUUID().replaceAll('-','');uri.pathname='/'+dbName;process.env.MONGO_URI=uri.toString();process.env.JWT_ACCESS_SECRET=randomUUID();
 const {default:mongoose}=await import('mongoose');const {default:express}=await import('express');const {default:User}=await import('../models/User.js');const {default:Medicine}=await import('../models/Medicine.js');const {default:Issue}=await import('../models/MedicineImportIssue.js');const {default:Adjustment}=await import('../models/StockAdjustment.js');
 const {default:routes}=await import('../routes/medicineRoutes.js');const {default:billRoutes}=await import('../routes/billRoutes.js');const {generateAccessToken}=await import('../utils/generateToken.js');const {errorHandler}=await import('../middleware/errorMiddleware.js');let server;
 try{
  await mongoose.connect(uri.toString());await Promise.all(Object.values(mongoose.models).map(Model=>Model.init()));
  const admin=await User.create({name:'Admin',email:'admin@test.local',password:'Test5786!',role:'superadmin',accountStatus:'approved'});
  const staff=await User.create({name:'Staff',email:'staff@test.local',password:'Test5786!',role:'pharmacist',accountStatus:'approved'});
  const customer=await User.create({name:'Customer',email:'customer@test.local',password:'Test5786!',role:'customer',accountStatus:'approved'});
  const app=express();app.use(express.json());app.use('/medicines',routes);app.use('/bills',billRoutes);app.use(errorHandler);server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const request=async(path,{method='GET',body,user=admin}={})=>{const response=await fetch('http://127.0.0.1:'+server.address().port+path,{method,headers:{Authorization:'Bearer '+generateAccessToken(user._id,user.role),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return{status:response.status,data:await response.json()};};
  const med=await Medicine.create({name:'Panadol 500mg',manufacturer:'Original',purchasePrice:200,unitsPerPack:10,price:30,quantity:20,expiryDate:'2099-01-01',createdBy:admin._id});
  const other=await Medicine.create({name:'Unrelated',purchasePrice:100,quantity:7,expiryDate:'2099-01-01',createdBy:admin._id});
  const delivery={name:' PANADOL 500mg ',manufacturer:'Original',purchasePrice:250,unitsPerPack:10,price:35,quantity:10,expiryDate:'2099-06-01'};
  const pending=await request('/medicines',{method:'POST',body:delivery,user:staff});assert.equal(pending.status,202,JSON.stringify(pending.data));assert.equal(pending.data.approvalRequired,true);assert.equal(await Medicine.countDocuments(),2);assert.equal((await Medicine.findById(med._id)).quantity,20);
  const review=await request('/medicines/import-issues');const row=review.data.issues.find(row=>row._id===pending.data.issueId);assert.equal(row.stockCandidates[0].quantity,20);assert.equal(row.normalizedRow.quantity,10);
  const approve=(id,expectedQuantity,user=admin,medicineId=med._id,medicine)=>request('/medicines/import-issues/'+id+'/approve-stock',{method:'POST',user,body:{expectedQuantity,medicineId,medicine}});
  assert.equal((await approve(row._id,20,staff)).status,403);assert.equal((await approve(row._id,20,customer)).status,403);
  const approved=await approve(row._id,20);assert.equal(approved.status,200,JSON.stringify(approved.data));assert.equal(approved.data.previousQuantity,20);assert.equal(approved.data.addedQuantity,10);assert.equal(approved.data.newQuantity,30);
  const saved=await Medicine.findById(med._id);assert.equal(saved.quantity,30);assert.equal(saved.batches[0].purchaseCost,20);assert.equal(saved.batches[1].purchaseCost,25);assert.equal(saved.batches[1].expiryDate.toISOString().slice(0,10),'2099-06-01');assert.equal(saved.price,30);
  assert.equal((await approve(row._id,20)).status,409);assert.equal((await Medicine.findById(med._id)).quantity,30);assert.equal(await Adjustment.countDocuments({medicineId:med._id}),1);assert.equal((await Issue.findById(row._id)).stockApproval.newQuantity,30);
  const next=await request('/medicines',{method:'POST',body:{...delivery,quantity:5},user:staff});
  const sale=await request('/bills/instore',{method:'POST',user:staff,body:{items:[{medicineId:med._id,quantity:1,packSalePrice:300,unitsPerPack:10}]}});assert.equal(sale.status,201);
  assert.equal((await approve(next.data.issueId,30)).status,409);assert.equal((await Medicine.findById(med._id)).quantity,29);
  assert.equal((await approve(next.data.issueId,29,admin,other._id)).status,409);assert.equal((await approve(next.data.issueId,29,admin,med._id,{...delivery,quantity:5,unitsPerPack:1})).status,400);
  assert.equal((await approve(next.data.issueId,29)).status,200);assert.equal((await Medicine.findById(med._id)).quantity,34);assert.equal((await Medicine.findById(other._id)).quantity,7);
  const payload={sourceFile:'Duplicate test.xlsx',medicines:[{...delivery,quantity:3},{...delivery,quantity:4},{name:'Cough syrup',purchasePrice:100,quantity:5},{name:'Cough syrup',purchasePrice:100,quantity:6}]};
  const bulk=await request('/medicines/bulk',{method:'POST',user:staff,body:payload});assert.equal(bulk.status,201,JSON.stringify(bulk.data));assert.equal(bulk.data.insertedCount,1);assert.equal(bulk.data.skippedCount,3);assert.equal((await Medicine.findById(med._id)).quantity,34);
  const replay=await request('/medicines/bulk',{method:'POST',user:staff,body:payload});assert.equal(replay.data.replayed,true);
  const duplicates=await Issue.find({status:'pending','normalizedRow.name':'PANADOL 500mg'});assert.equal(duplicates.length,2);
  await Promise.all(duplicates.map(issue=>approve(String(issue._id),34)));assert.ok([37,38].includes((await Medicine.findById(med._id)).quantity));
  const remaining=await Issue.findOne({status:'pending','normalizedRow.name':'PANADOL 500mg'});assert.ok(remaining);const fresh=await Medicine.findById(med._id);assert.equal((await approve(String(remaining._id),fresh.quantity)).status,200);assert.equal((await Medicine.findById(med._id)).quantity,41);
  const syrup=await Medicine.findOne({name:'Cough syrup'}),syrupIssue=await Issue.findOne({status:'pending','normalizedRow.name':'Cough syrup'});assert.equal((await approve(String(syrupIssue._id),5,admin,syrup._id)).status,200);assert.equal((await Medicine.findById(syrup._id)).quantity,11);
  assert.equal(await Medicine.countDocuments({name:/panadol/i}),1);
 }finally{if(server)await new Promise(r=>server.close(r));if(mongoose.connection.name===dbName)await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
