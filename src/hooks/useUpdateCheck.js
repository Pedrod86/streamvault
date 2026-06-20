import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { APP_VERSION, isNewerVersion } from '@/lib/appVersion';

// Checks GitHub for the latest release and decides whether the installed
// app version is behind. Returns the release info + an `updateAvailable` flag.
export function useUpdateCheck() {
  const { data } = useQuery({
    queryKey: ['latestRelease'],
    queryFn: async () => {
      const res = await base44.functions.invoke('githubLatestRelease', {});
      return res.data || null;
    },
    staleTime: 1000 * 60 * 30, // re-check at most every 30 min
    retry: false,
  });

  const release = data && !data.error ? data : null;
  const updateAvailable =
    !!release?.tag && !!release?.apk && isNewerVersion(release.tag, APP_VERSION);

  return { release, updateAvailable };
}