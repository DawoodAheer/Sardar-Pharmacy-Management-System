import useScopedPage from './useScopedPage';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';

export default function useSalesPage(period) {
  const [page, setPage] = useScopedPage(period);
  const now = new Date();
  const start = period === 'daily' ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : period === 'monthly' ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now.getFullYear(), 0, 1);
  const date = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  const { data } = useQuery({ queryKey: ['bills', 'salesPage', period, page], enabled: Boolean(period), queryFn: async () => (await api.get('/bills', { params: { page, limit: 50, startDate: date(start), endDate: date(now), accepted: 'true' } })).data });
  return { data, page, setPage, bills: data?.bills || [] };
}
