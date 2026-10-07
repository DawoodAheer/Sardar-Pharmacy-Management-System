import User from '../models/User.js';

/**
 * Automatically seeds default accounts if database is empty.
 * Ensures cloning repo on a new laptop requires only `npm run dev`.
 * All seeded accounts are set to 'approved' so they can log in immediately.
 */
export const autoSeedIfEmpty = async () => {
  try {
    const userCount = await User.countDocuments({});
    if (userCount === 0) {
      console.log('🌱 Empty database detected. Running automatic initial seeding...');

      const superadmin = await User.create({
        name: 'Dawood Super Admin',
        email: 'aheerdawood014@gmail.com',
        password: 'Dawood@@5786',
        role: 'superadmin',
        accountStatus: 'approved',
      });

      const pharmacist = await User.create({
        name: 'Sardar Pharmacist',
        email: 'mlksardar6@gmail.com',
        password: 'Dawood@@5786',
        role: 'pharmacist',
        accountStatus: 'approved',
      });

      const customer = await User.create({
        name: 'Raza Customer',
        email: 'aheerraza0@gmail.com',
        password: 'Dawood@@5786',
        role: 'customer',
        accountStatus: 'approved',
      });

      console.log('🎉 Auto-seeding completed successfully!');
      console.log(`- Superadmin : ${superadmin.email}`);
      console.log(`- Pharmacist : ${pharmacist.email}`);
      console.log(`- Customer   : ${customer.email}`);
    }
  } catch (err) {
    console.warn('Auto-seeding check skipped:', err.message);
  }
};
