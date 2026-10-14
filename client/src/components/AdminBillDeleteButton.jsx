import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';

export default function AdminBillDeleteButton({ bill }) {
  const [pending, setPending] = useState(false);
  const queryClient = useQueryClient();
  const remove = async () => {
    if (window.prompt(`Delete ${bill.billNumber || bill._id}? This removes the sale from reports and restores stock. A deletion audit remains. Type DELETE:`) !== 'DELETE') return;
    setPending(true);
    try {
      const response = await api.delete(`/bills/${bill._id}`, { data: { confirmation: 'DELETE' } });
      await queryClient.invalidateQueries();
      window.alert(response.data.message);
    } catch (error) { window.alert(error.response?.data?.message || 'Bill deletion failed.'); }
    finally { setPending(false); }
  };
  return <button type="button" disabled={pending} onClick={remove} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-700 disabled:opacity-50">{pending ? 'Deleting…' : 'Delete bill'}</button>;
}
