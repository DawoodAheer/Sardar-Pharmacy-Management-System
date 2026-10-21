import { packUnitPrice, validBillLine } from '../utils/billingPack';

const money = amount => new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

export default function CounterBillLine({ item, number = 1, expanded = true, onToggle, disabled, saving, onChange, onSaveStock, onRemove }) {
  const price = packUnitPrice(item.packSalePrice, item.unitsPerPack);
  const valid = validBillLine({ ...item, quantity: item.billQuantity, stock: item.quantity });
  const input = 'mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-transparent p-2 text-sm';
  return <fieldset disabled={disabled} aria-label={`Medicine ${number}: ${item.name}`} className="mx-2 my-2 min-w-0 rounded-lg border border-teal-300 bg-white p-3 text-xs shadow-xs space-y-3 dark:border-teal-700 dark:bg-slate-900">
    <div className="flex items-center gap-2">
      <span className="shrink-0 rounded-sm bg-teal-700 px-2 py-1 font-bold text-white">{number}</span>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="min-w-0 flex-1 text-left" aria-label={`${expanded ? 'Collapse' : 'Edit'} medicine ${number}: ${item.name}`}><strong className="block wrap-break-word text-sm text-slate-900 dark:text-white">{item.name}</strong><span className="text-slate-600 dark:text-slate-300">{item.billQuantity} units × PKR {money(price ?? 0)} · {expanded ? 'Hide details ▴' : 'Edit ▾'}</span>{item.stockEditing && <span className="block font-semibold text-amber-700">Stock count not saved</span>}{!valid && <span className="block font-semibold text-red-600">Check price / quantity</span>}</button>
      <strong className="shrink-0 text-right text-sm text-teal-800 dark:text-teal-200">PKR {money((price ?? 0) * (Number(item.billQuantity) || 0))}</strong>
      <button type="button" aria-label={`Remove medicine ${number}: ${item.name}`} onClick={onRemove} className="shrink-0 rounded-sm border border-red-200 px-2 py-1 text-red-600">×</button>
    </div>
    {expanded && <div className="space-y-3 border-t border-teal-200 pt-3">
    <div className="grid grid-cols-2 gap-3">
      <label>Sale price / pack (PKR)
        <input aria-label={`Pack sale price for ${item.name}`} type="number" min="0.01" step="any" value={item.packSalePrice} onChange={e => onChange({ packSalePrice: e.target.value })} className={input} />
      </label>
      <label>Tablets / units in one pack
        <input aria-label={`Units per pack for ${item.name}`} type="number" min="1" step="1" value={item.unitsPerPack} onChange={e => onChange({ unitsPerPack: e.target.value, ...(item.saleMode === 'packs' ? { billQuantity: Number(item.packQuantity || 1) * Number(e.target.value) } : {}) })} className={input} />
      </label>
    </div>
    <p className="font-bold text-teal-700">{price === null ? 'Enter a positive pack price and whole units per pack.' : `${item.packSalePrice} ÷ ${item.unitsPerPack} = PKR ${money(price)} per tablet / unit`}</p>
    <p className="text-slate-500">For one bottle, tube or injection, use 1. This pack price applies to this bill.</p>
    {Number(item.unitsPerPack) !== item.inventoryUnitsPerPack && <p role="alert" className="rounded-sm border border-amber-300 p-2 text-amber-800">Inventory has {item.inventoryUnitsPerPack} units per pack and purchase cost PKR {money(Number(item.purchasePrice) / item.inventoryUnitsPerPack)} per unit. Changing the selling pack here does not change purchase costs. Correct inventory / batch costs if the saved pack size is wrong.</p>}
    <div className="grid grid-cols-2 items-end gap-3">
      <label>Sell as
        <select aria-label={`Sale mode for ${item.name}`} value={item.saleMode || 'units'} onChange={e => onChange({ saleMode: e.target.value, packQuantity: 1, billQuantity: e.target.value === 'packs' ? Number(item.unitsPerPack) : 1 })} className={input}><option value="units">Tablets / units</option><option value="packs">Whole packs</option></select>
      </label>
      <label>{item.saleMode === 'packs' ? 'Packs to sell' : 'Tablets / units to sell'}
        <input aria-label={`Quantity to sell for ${item.name}`} type="number" min="1" max={item.saleMode === 'packs' ? Math.floor(item.quantity / Number(item.unitsPerPack)) : item.quantity} step="1" value={item.saleMode === 'packs' ? item.packQuantity : item.billQuantity} onChange={e => onChange(item.saleMode === 'packs' ? { packQuantity: e.target.value, billQuantity: Number(e.target.value) * Number(item.unitsPerPack) } : { billQuantity: e.target.value })} className={input} />
      </label>
      <strong className="pb-2 text-right">Line total: PKR {money((price ?? 0) * (Number(item.billQuantity) || 0))}</strong>
    </div>
    <p>Stock before sale: <strong>{item.quantity} units</strong> · After sale: <strong>{item.quantity - Number(item.billQuantity)}</strong></p>
    {!valid && <p role="alert" className="text-red-600">Enter valid pack pricing and whole sale units within available stock.</p>}
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-slate-900">
      <label className="block">Counted stock before sale (tablets / units)
        <input aria-label={`Counted stock for ${item.name}`} type="number" min="0" step="1" value={item.stockDraft ?? String(item.quantity)} onChange={e => onChange({ stockDraft: e.target.value, stockEditing: e.target.value === '' || Number(e.target.value) !== Number(item.quantity) })} className={input} />
      </label>
      {item.stockEditing && <><p>Save this count before billing. The sale will subtract {item.billQuantity} units.</p>
      <button type="button" onClick={onSaveStock} className="rounded-sm bg-teal-700 px-3 py-2 font-bold text-white">{saving ? 'Saving stock…' : 'Save stock'}</button>
      <button type="button" onClick={() => onChange({ stockEditing: false, stockDraft: String(item.quantity) })} className="ml-3 underline">Undo count change</button></>}
    </div>
    </div>}
  </fieldset>;
}
