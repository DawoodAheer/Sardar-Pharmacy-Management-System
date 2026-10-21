import {useState} from 'react';
import {createPortal} from 'react-dom';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../context/AuthContext';
import {importIssueForm} from '../utils/importIssueForm';
import api from '../utils/api';

export default function DuplicateStockApproval({issue,onDone}){
 const {user}=useAuth();const queryClient=useQueryClient();const [open,setOpen]=useState(false),[targetId,setTarget]=useState(''),[form,setForm]=useState({}),[error,setError]=useState('');
 const candidates=issue.stockCandidates || [],target=candidates.find(item=>item._id===targetId);
 const added=Number(form.quantity),after=(Number(target?.quantity)||0)+added;
 const mutation=useMutation({mutationFn:async()=>(await api.post(`/medicines/import-issues/${issue._id}/approve-stock`,{medicineId:targetId,expectedQuantity:target.quantity,medicine:form})).data,
 onSuccess:async result=>{setOpen(false);onDone(result.message+' Approved: '+new Date(result.approvedAt).toLocaleString('en-PK'));await queryClient.invalidateQueries();},
 onError:async err=>{setError(err.response?.data?.message || 'Approval failed. Stock was not added.');await queryClient.invalidateQueries({queryKey:['medicineImportIssues']});}});
 if(!candidates.length)return null;
 if(user?.role!=='superadmin')return <span className="text-xs font-bold text-amber-700">Waiting for Admin stock approval</span>;
 const begin=()=>{const incoming=importIssueForm(issue);const {price,...rest}=incoming;setForm({...rest,packSalePrice:price===''?'':Number(price)*(Number(incoming.unitsPerPack)||1)});setTarget(candidates.length===1?candidates[0]._id:'');setError('');setOpen(true);};
 const field='mt-1 w-full rounded-sm border border-slate-300 bg-transparent p-2 text-sm';
 return <><button type="button" onClick={begin} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">Review stock addition</button>{open && createPortal(<div className="fixed inset-0 z-90 flex items-center justify-center bg-slate-950/60 p-4"><form role="dialog" aria-modal="true" aria-labelledby="duplicate-approval-title" className="max-h-[85vh] w-full max-w-xl space-y-4 overflow-auto rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900" onSubmit={event=>{event.preventDefault();if(!target || mutation.isPending)return;mutation.mutate();}}>
 <div className="flex items-center justify-between gap-2"><h3 id="duplicate-approval-title" className="font-bold">Admin approval: {form.name}</h3><button type="button" disabled={mutation.isPending} onClick={()=>setOpen(false)}>Close</button></div>
 <label className="block text-sm">Add to existing medicine<select required value={targetId} disabled={mutation.isPending} onChange={event=>setTarget(event.target.value)} className={field}><option value="">Choose the matching medicine</option>{candidates.map(item=><option key={item._id} value={item._id}>{item.name} · {item.manufacturer || 'Manufacturer unspecified'} · {item.unitsPerPack || 1} units/pack · stock {item.quantity}</option>)}</select></label>
 <p className="text-xs font-semibold">Delivery manufacturer: {form.manufacturer || 'Unspecified'} · Existing manufacturer: {target?.manufacturer || 'Unspecified'}</p>
 <p className="text-xs text-slate-500">Verify the same medicine, strength and manufacturer before approving. This adds a delivery batch and retains its purchase cost and expiry. Existing sale prices and old batches stay unchanged.</p>
 <fieldset disabled={mutation.isPending} className="grid gap-3 sm:grid-cols-2">{[['quantity','New delivery (total tablets / units)','number'],['unitsPerPack','Units in delivery pack','number'],['purchasePrice','Purchase cost per pack','number'],['packSalePrice','Sale price per pack (reference)','number'],['expiryDate','Delivery expiry (optional)','date']].map(([key,label,type])=><label key={key} className="text-sm">{label}<input type={type} required={['quantity','purchasePrice','unitsPerPack'].includes(key)} min={key==='purchasePrice'?'0.01':key==='packSalePrice'?'0':'1'} step={['quantity','unitsPerPack'].includes(key)?'1':'any'} value={form[key] ?? ''} onChange={event=>setForm({...form,[key]:event.target.value})} className={field}/></label>)}</fieldset>
 {target && <div className="grid grid-cols-3 gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-slate-900"><div><p className="text-xs">Current stock</p><strong>{target.quantity}</strong></div><div><p className="text-xs">Delivery to add</p><strong>+ {Number.isFinite(added)?added:'—'}</strong></div><div><p className="text-xs">After approval</p><strong>{Number.isFinite(after)?after:'—'}</strong></div></div>}
 {target && Number(form.unitsPerPack)!==(Number(target.unitsPerPack)||1) && <p role="alert" className="text-sm text-red-600">Pack size differs from inventory. Verify it before approving.</p>}
 {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
 <button disabled={mutation.isPending || !target || !Number.isSafeInteger(added) || added<=0 || Number(form.unitsPerPack)!==(Number(target?.unitsPerPack)||1)} className="w-full rounded-lg bg-teal-700 p-3 font-bold text-white disabled:opacity-50">{mutation.isPending?'Approving…':`Approve stock addition${target && Number.isFinite(added)?': '+target.quantity+' + '+added+' = '+after:''}`}</button>
 </form></div>,document.body)}</>;
}
