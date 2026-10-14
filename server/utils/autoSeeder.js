import User from '../models/User.js';
export const defaultAccounts = [
  { name: 'Dawood Super Admin', email: 'aheerdawood014@gmail.com', role: 'superadmin' },
  { name: 'Sardar Pharmacist', email: 'mlksardar6@gmail.com', role: 'pharmacist' },
  { name: 'Raza Customer', email: 'aheerraza0@gmail.com', role: 'customer' },
];
// Add missing accounts only. Never reset existing passwords or business data.
export const autoSeedIfEmpty = async () => {
  await User.init();
  for (const account of defaultAccounts) {
    if (await User.exists({ email: account.email })) continue;
    try {
      await User.create({ ...account, password: 'Dawood@@5786', accountStatus: 'approved', isActive: true });
      console.log(`Created default ${account.role} account: ${account.email}`);
    } catch (error) { if (error.code !== 11000) throw error; }
  }
};
