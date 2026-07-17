import { useQuery } from '@tanstack/react-query';
import { fetchCurrentAnnouncement } from '@/lib/api';

export function useAnnouncement() {
  return useQuery({
    queryKey: ['announcement/current'] as const,
    queryFn: fetchCurrentAnnouncement,
    staleTime: 0,
  });
}
