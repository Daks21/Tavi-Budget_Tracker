export type WalletOption = {
  key: string;
  name: string;
  icon_key: string;
  type: 'cash' | 'ewallet' | 'bank';
};

export const WALLET_OPTIONS: WalletOption[] = [
  // Cash
  { key: 'cash', name: 'Cash on Hand', icon_key: 'cash', type: 'cash' },

  // E-wallets
  { key: 'gcash', name: 'GCash', icon_key: 'gcash', type: 'ewallet' },
  { key: 'maya', name: 'Maya', icon_key: 'maya', type: 'ewallet' },
  { key: 'shopeepay', name: 'ShopeePay', icon_key: 'shopeepay', type: 'ewallet' },
  { key: 'grabpay', name: 'GrabPay', icon_key: 'grabpay', type: 'ewallet' },
  { key: 'palawanpay', name: 'PalawanPay', icon_key: 'palawanpay', type: 'ewallet' },

  // Digital / traditional banks
  { key: 'bdo', name: 'BDO', icon_key: 'bdo', type: 'bank' },
  { key: 'bpi', name: 'BPI', icon_key: 'bpi', type: 'bank' },
  { key: 'metrobank', name: 'Metrobank', icon_key: 'metrobank', type: 'bank' },
  { key: 'landbank', name: 'LandBank', icon_key: 'landbank', type: 'bank' },
  { key: 'pnb', name: 'PNB', icon_key: 'pnb', type: 'bank' },
  { key: 'rcbc', name: 'RCBC', icon_key: 'rcbc', type: 'bank' },
  { key: 'unionbank', name: 'UnionBank', icon_key: 'unionbank', type: 'bank' },
  { key: 'securitybank', name: 'Security Bank', icon_key: 'securitybank', type: 'bank' },
  { key: 'chinabank', name: 'China Bank', icon_key: 'chinabank', type: 'bank' },
  { key: 'eastwest', name: 'EastWest', icon_key: 'eastwest', type: 'bank' },
  { key: 'aub', name: 'AUB', icon_key: 'aub', type: 'bank' },
  { key: 'dbp', name: 'DBP', icon_key: 'dbp', type: 'bank' },
  { key: 'gotyme', name: 'GoTyme', icon_key: 'gotyme', type: 'bank' },
  { key: 'seabank', name: 'SeaBank', icon_key: 'seabank', type: 'bank' },
  { key: 'cimb', name: 'CIMB', icon_key: 'cimb', type: 'bank' },
  { key: 'tonik', name: 'Tonik', icon_key: 'tonik', type: 'bank' },
  { key: 'mari', name: 'MariBank', icon_key: 'maribank', type: 'bank' },

  // Fallback
  { key: 'other', name: 'Other', icon_key: 'other', type: 'bank' },
];

export function getWalletByKey(key: string): WalletOption | undefined {
  return WALLET_OPTIONS.find((wallet) => wallet.key === key);
}