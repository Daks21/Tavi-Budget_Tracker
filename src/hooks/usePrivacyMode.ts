import useWalletStore from '@/store/useWalletStore';

export default function usePrivacyMode() {
  const isPrivate = useWalletStore((state) => state.privacyMode);
  const toggle = useWalletStore((state) => state.togglePrivacyMode);

  return {
    isPrivate,
    toggle,
  };
}