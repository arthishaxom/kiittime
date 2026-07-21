import { useQuery } from '@tanstack/react-query';
import { fetchSections } from '@kiittime/api/api';

export function useSections(year?: number) {
  return useQuery({
    queryKey: ['sections', year] as const,
    queryFn: () => fetchSections(year),
    enabled: year !== undefined,
  });
}
