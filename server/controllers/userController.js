import User from '../models/User.js';

export const createStaffUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
      return res.status(400).json({ message: 'Name, valid email, and a password of at least 6 characters are required' });
    }
    if (!/^\S+@\S+\.\S+$/.test(String(email).trim())) {
      return res.status(400).json({ message: 'Enter a valid email address' });
    }
    if (!['superadmin', 'pharmacist'].includes(role)) {
      return res.status(400).json({ message: 'Staff role must be Admin or Pharmacist' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }
    const user = await User.create({ name: name.trim(), email: normalizedEmail, password, role, accountStatus: 'approved' });
    return res.status(201).json({ _id: user._id, name: user.name, email: user.email, role: user.role, accountStatus: user.accountStatus, isActive: user.isActive });
  } catch (error) {
    next(error);
  }
};

export const setUserActiveStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') return res.status(400).json({ message: 'isActive must be true or false' });
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (!isActive && String(target._id) === String(req.user._id)) return res.status(400).json({ message: 'You cannot deactivate your own account' });
    if (!isActive && target.isActive !== false && target.role === 'superadmin') {
      const activeAdmins = await User.countDocuments({ role: 'superadmin', isActive: { $ne: false } });
      if (activeAdmins <= 1) return res.status(400).json({ message: 'Cannot deactivate the last active Admin' });
    }
    target.isActive = isActive;
    target.tokenVersion = (target.tokenVersion || 0) + 1;
    await target.save();
    return res.json({ _id: target._id, name: target.name, email: target.email, role: target.role, isActive: target.isActive });
  } catch (error) { next(error); }
};

export const resetManagedUserPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (typeof password !== 'string' || password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });
    target.password = password;
    target.tokenVersion = (target.tokenVersion || 0) + 1;
    target.resetPasswordToken = undefined;
    target.resetPasswordExpire = undefined;
    target.resetPasswordOtp = undefined;
    await target.save();
    return res.json({ message: 'Password reset successfully' });
  } catch (error) { next(error); }
};

export const editManagedUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { name, email, phone } = req.body;
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ message: 'Name cannot be empty' });
      user.name = name.trim();
    }
    if (email !== undefined) {
      const normalized = String(email).trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(normalized)) return res.status(400).json({ message: 'Enter a valid email address' });
      const duplicate = await User.exists({ email: normalized, _id: { $ne: user._id } });
      if (duplicate) return res.status(409).json({ message: 'An account with this email already exists' });
      user.email = normalized;
    }
    if (phone !== undefined) user.phone = String(phone).trim();
    await user.save();
    return res.json({ _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, isActive: user.isActive, accountStatus: user.accountStatus });
  } catch (error) { next(error); }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Superadmin
export const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    next(error);
  }
};


// @desc    Update user role
// @route   PUT /api/users/:id/role
// @access  Private/Superadmin
export const updateUserRole = async (req, res, next) => {
  const { role } = req.body;
  const { id } = req.params;

  try {
    if (!['superadmin', 'pharmacist', 'customer'].includes(role)) {
      res.status(400);
      throw new Error('Invalid role specified');
    }

    if (String(id) === String(req.user._id) && role !== 'superadmin') {
      res.status(400);
      throw new Error('You cannot remove your own Admin role');
    }

    const userToChange = await User.findById(id);

    if (!userToChange) {
      res.status(404);
      throw new Error('User not found');
    }

    // Protect last superadmin from role change
    if (
      userToChange.role === 'superadmin' && userToChange.isActive !== false &&
      role !== 'superadmin'
    ) {
      const superadminCount = await User.countDocuments({
        role: 'superadmin',
        isActive: { $ne: false },
      });

      if (superadminCount <= 1) {
        res.status(400);
        throw new Error(
          'Cannot change the role of the only remaining superadmin'
        );
      }
    }

    const previousRole = userToChange.role;
    userToChange.role = role;
    if (previousRole !== role) userToChange.tokenVersion = (userToChange.tokenVersion || 0) + 1;

    if (role === 'customer' && previousRole !== 'customer') {
      userToChange.accountStatus = 'pending';
    }

    await userToChange.save();

    res.json({
      _id: userToChange._id,
      name: userToChange.name,
      email: userToChange.email,
      role: userToChange.role,
      accountStatus: userToChange.accountStatus,
      message: `User role updated to ${role} successfully`,
    });
  } catch (error) {
    next(error);
  }
};


// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Superadmin
export const deleteUser = async (req, res, next) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id);

    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    // Safety: prevent deleting yourself
    if (user._id.toString() === req.user._id.toString()) {
      res.status(400);
      throw new Error('You cannot delete your own account');
    }

    // Prevent deleting the last superadmin
    if (user.role === 'superadmin' && user.isActive !== false) {
      const superadminCount = await User.countDocuments({
        role: 'superadmin',
        isActive: { $ne: false },
      });

      if (superadminCount <= 1) {
        res.status(400);
        throw new Error(
          'Cannot delete the only remaining superadmin'
        );
      }
    }

    await User.findByIdAndDelete(id);

    res.json({
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};


// @desc    Get all customers
// @route   GET /api/users/customers
// @access  Private/Pharmacist/Superadmin
export const getCustomers = async (req, res, next) => {
  try {
    const customers = await User.find({
      role: 'customer',
      accountStatus: 'approved',
    })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json(customers);
  } catch (error) {
    next(error);
  }
};

// @desc    Get customer accounts waiting for approval
// @route   GET /api/users/pending-customers
// @access  Private/Pharmacist,Superadmin
export const getPendingCustomers = async (req, res, next) => {
  try {
    const customers = await User.find({
      role: 'customer',
      accountStatus: 'pending',
    })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json(customers);
  } catch (error) {
    next(error);
  }
};


// @desc    Update user profile name or phone
// @route   PATCH /api/users/profile
// @access  Private
export const updateProfileNameOrPhone = async (
  req,
  res,
  next
) => {
  const { name, phone, currentPassword } = req.body;

  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    if (phone !== undefined) {
      const normalizedNewPhone = phone.trim();
      const normalizedOldPhone = (user.phone || '').trim();

      if (normalizedNewPhone !== normalizedOldPhone) {
        if (!currentPassword) {
          res.status(400);
          throw new Error(
            'Password is required to confirm change'
          );
        }

        const isMatch = await user.matchPassword(
          currentPassword
        );

        if (!isMatch) {
          res.status(401);
          throw new Error('Incorrect password');
        }

        user.phone = normalizedNewPhone;
      }
    }

    if (name !== undefined && name.trim()) {
      user.name = name.trim();
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      accountStatus: updatedUser.accountStatus,
      phone: updatedUser.phone,
      createdAt: updatedUser.createdAt,
    });
  } catch (error) {
    next(error);
  }
};


// ==========================================================================
// PHARMACIST APPROVAL SYSTEM
// ==========================================================================


// @desc    Approve pharmacist
// @route   PUT /api/users/:id/approve-pharmacist
// @access  Private/Superadmin
export const approvePharmacist = async (
  req,
  res,
  next
) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.role !== 'pharmacist') {
      return res.status(400).json({
        success: false,
        message: 'This user is not a pharmacist',
      });
    }

    if (user.accountStatus === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Pharmacist is already approved',
      });
    }

    user.accountStatus = 'approved';

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Pharmacist approved successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        accountStatus: user.accountStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};


// @desc    Reject pharmacist
// @route   PUT /api/users/:id/reject-pharmacist
// @access  Private/Superadmin
export const rejectPharmacist = async (
  req,
  res,
  next
) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.role !== 'pharmacist') {
      return res.status(400).json({
        success: false,
        message: 'This user is not a pharmacist',
      });
    }

    if (user.accountStatus === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Pharmacist request is already rejected',
      });
    }

    user.accountStatus = 'rejected';

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Pharmacist request rejected successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        accountStatus: user.accountStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve a customer account
// @route   PUT /api/users/:id/approve-customer
// @access  Private/Superadmin
export const approveCustomer = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.role !== 'customer') {
      return res.status(400).json({
        success: false,
        message: 'This user is not a customer',
      });
    }

    user.accountStatus = 'approved';
    await user.save();

    return res.json({
      success: true,
      message: 'Customer approved successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        accountStatus: user.accountStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject a customer account
// @route   PUT /api/users/:id/reject-customer
// @access  Private/Superadmin
export const rejectCustomer = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.role !== 'customer') {
      return res.status(400).json({
        success: false,
        message: 'This user is not a customer',
      });
    }

    user.accountStatus = 'rejected';
    await user.save();

    return res.json({
      success: true,
      message: 'Customer request rejected successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        accountStatus: user.accountStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};
