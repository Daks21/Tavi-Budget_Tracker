export type WalletOption = {
  key: string;
  name: string;
  icon_key: string;
  type: 'cash' | 'ewallet' | 'bank';
};

export const WALLET_OPTIONS: WalletOption[] = [
  { key: 'cash', name: 'Cash on Hand', icon_key: 'cash', type: 'cash' },
  { key: 'gcash', name: 'GCash', icon_key: 'gcash', type: 'ewallet' },
  { key: 'maya', name: 'Maya', icon_key: 'maya', type: 'ewallet' },
  { key: 'shopeepay', name: 'ShopeePay', icon_key: 'shopeepay', type: 'ewallet' },
  { key: 'gotyme', name: 'GoTyme', icon_key: 'gotyme', type: 'ewallet' },
  { key: 'seabank', name: 'SeaBank', icon_key: 'seabank', type: 'ewallet' },
  { key: 'bpi', name: 'BPI', icon_key: 'bpi', type: 'bank' },
  { key: 'bdo', name: 'BDO', icon_key: 'bdo', type: 'bank' },
  { key: 'pnb', name: 'PNB', icon_key: 'pnb', type: 'bank' },
  { key: 'rcbc', name: 'RCBC', icon_key: 'rcbc', type: 'bank' },
  { key: 'metrobank', name: 'Metrobank', icon_key: 'metrobank', type: 'bank' },
  { key: 'landbank', name: 'Landbank', icon_key: 'landbank', type: 'bank' },
  { key: 'other', name: 'Other', icon_key: 'other', type: 'bank' },
];

export function getWalletByKey(key: string): WalletOption | undefined {
  return WALLET_OPTIONS.find((wallet) => wallet.key === key);
}