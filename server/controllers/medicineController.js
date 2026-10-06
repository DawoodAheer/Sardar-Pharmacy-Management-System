import mongoose from 'mongoose';
import Medicine from '../models/Medicine.js';
import StockAdjustment from '../models/StockAdjustment.js';
import { checkExpiryStatus } from '../utils/expiryCheck.js';
import { parseExplicitDecimalPrice } from '../utils/ocrParsing.js';
import { getStockStatus } from '../utils/stockStatus.js';
import { checkAndSendExpiryAlerts } from '../utils/notificationScheduler.js';
import Tesseract from 'tesseract.js';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const controllerDirectory = path.dirname(fileURLToPath(import.meta.url));
const englishOcrDataPath = path.resolve(
  controllerDirectory,
  '../node_modules/@tesseract.js-data/eng/4.0.0_best_int'
);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

// @desc    Get all medicines (with filters)
// @route   GET /api/medicines
// @access  Private
export const getAllMedicines = async (req, res, next) => {
  const { search, category, status, reorder } = req.query;

  try {
    const query = {};

    // 1. Search filter (name, genericName, manufacturer, batch and rack)
    if (search) {
      const escapedSearch = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { genericName: { $regex: escapedSearch, $options: 'i' } },
        { manufacturer: { $regex: escapedSearch, $options: 'i' } },
        { rackLocation: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    // 2. Category filter
    if (category) {
      query.category = category;
    }

    // 3. Expiry status filter
    if (status) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const msInDay = 24 * 60 * 60 * 1000;
      const thirtyDays = new Date(today.getTime() + 30 * msInDay);
      const sixtyDays = new Date(today.getTime() + 60 * msInDay);
      const sixMonths = new Date(today.getTime() + 180 * msInDay);

      if (status === 'EXPIRED') {
        query.expiryDate = { $lt: today };
      } else if (status === 'EXPIRING') {
        query.expiryDate = { $gte: today, $lte: sixMonths };
      } else if (status === 'CRITICAL') {
        query.expiryDate = { $gte: today, $lte: thirtyDays };
      } else if (status === 'WARNING') {
        query.expiryDate = { $gt: thirtyDays, $lte: sixtyDays };
      } else if (status === 'CAUTION') {
        query.expiryDate = { $gt: sixtyDays, $lte: sixMonths };
      } else if (status === 'SAFE') {
        query.expiryDate = { $gt: sixMonths };
      }
    }

    // 4. Reorder level filter (quantity <= reorderLevel)
    if (reorder === 'true') {
      query.quantity = { $lt: 5 };
    }

    const medicines = await Medicine.find(query)
      .populate('createdBy', 'name email')
      .sort({ name: 1 });

    // Append calculated status to each item for frontend convenience
    const medicinesWithStatus = medicines.map((med) => {
      const medObj = med.toObject();
      medObj.expiryStatus = checkExpiryStatus(med.expiryDate);
      medObj.stockStatus = getStockStatus(med.quantity);
      return medObj;
    });

    res.json(medicinesWithStatus);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new medicine
// @route   POST /api/medicines
// @access  Private/Pharmacist,Superadmin
export const createMedicine = async (req, res, next) => {
  const {
    name,
    genericName,
    manufacturer,
    expiryDate,
    quantity,
    reorderLevel,
    price,
    purchasePrice,
    category,
    barcode,
    rackLocation,
    labelImageUrl,
  } = req.body;

  try {
    const numericPurchasePrice = purchasePrice !== undefined ? Number(purchasePrice) : 0;
    const numericPrice = price !== undefined ? Number(price) : 0;

    if (Number.isFinite(numericPrice) && Number.isFinite(numericPurchasePrice) && numericPrice < numericPurchasePrice) {
      res.status(400);
      return next(new Error('Sale price cannot be lower than the purchase price'));
    }

    const medicine = await Medicine.create({
      name,
      genericName,
      manufacturer,
      expiryDate,
      quantity,
      reorderLevel,
      price,
      purchasePrice: numericPurchasePrice,
      category,
      barcode,
      rackLocation,
      labelImageUrl,
      createdBy: req.user._id,
    });

    const populatedMed = await Medicine.findById(medicine._id).populate('createdBy', 'name email');
    const medObj = populatedMed.toObject();
    medObj.expiryStatus = checkExpiryStatus(populatedMed.expiryDate);

    // Evaluate new inventory immediately so six-month expiry warnings are not delayed.
    checkAndSendExpiryAlerts({ medicineId: medicine._id }).catch((err) => {
      console.error('[New Medicine Alert Error]:', err.message);
    });

    res.status(201).json(medObj);
  } catch (error) {
    next(error);
  }
};

// @desc    Update a medicine
// @route   PUT /api/medicines/:id
// @access  Private/Pharmacist,Superadmin
export const updateMedicine = async (req, res, next) => {
  const { id } = req.params;
  const {
    name,
    genericName,
    manufacturer,
    expiryDate,
    quantity,
    reorderLevel,
    price,
    purchasePrice,
    category,
    barcode,
    rackLocation,
    labelImageUrl,
  } = req.body;

  try {
    const medicine = await Medicine.findById(id);

    if (!medicine) {
      res.status(404);
      throw new Error('Medicine not found');
    }

    const nextPurchasePrice = purchasePrice !== undefined ? Number(purchasePrice) : medicine.purchasePrice;
    const nextSalePrice = price !== undefined ? Number(price) : Number(medicine.price);

    if (Number.isFinite(nextSalePrice) && Number.isFinite(nextPurchasePrice) && nextSalePrice < nextPurchasePrice) {
      res.status(400);
      throw new Error('Sale price cannot be lower than the purchase price');
    }

    medicine.name = name !== undefined ? name : medicine.name;
    medicine.genericName = genericName !== undefined ? genericName : medicine.genericName;
    medicine.manufacturer = manufacturer !== undefined ? manufacturer : medicine.manufacturer;
    if (expiryDate !== undefined && String(expiryDate) !== String(medicine.expiryDate)) {
      medicine.expiryDate = expiryDate;
      // Reset alert flags so that alerts fire appropriately for the new date
      medicine.expiryAlert10Sent = false;
      medicine.expiryAlert1Sent = false;
      medicine.expiryAlert180Sent = false;
      medicine.expiryAlertExpiredSent = false;
    }

    medicine.quantity = quantity !== undefined ? quantity : medicine.quantity;
    medicine.reorderLevel = reorderLevel !== undefined ? reorderLevel : medicine.reorderLevel;
    medicine.price = price !== undefined ? price : medicine.price;
    medicine.purchasePrice = nextPurchasePrice;
    medicine.category = category !== undefined ? category : medicine.category;
    medicine.barcode = barcode !== undefined ? barcode : medicine.barcode;
    medicine.rackLocation = rackLocation !== undefined ? rackLocation : medicine.rackLocation;
    medicine.labelImageUrl = labelImageUrl !== undefined ? labelImageUrl : medicine.labelImageUrl;

    const updatedMedicine = await medicine.save();
    const populatedMed = await Medicine.findById(updatedMedicine._id).populate('createdBy', 'name email');
    const medObj = populatedMed.toObject();
    medObj.expiryStatus = checkExpiryStatus(populatedMed.expiryDate);

    // Trigger alert evaluation for the updated medicine
    checkAndSendExpiryAlerts({ medicineId: updatedMedicine._id }).catch((err) => {
      console.error('[Update Medicine Alert Error]:', err.message);
    });

    res.json(medObj);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a medicine
// @route   DELETE /api/medicines/:id
// @access  Private/Pharmacist,Superadmin
export const deleteMedicine = async (req, res, next) => {
  const { id } = req.params;

  try {
    const medicine = await Medicine.findById(id);

    if (!medicine) {
      res.status(404);
      throw new Error('Medicine not found');
    }

    await Medicine.findByIdAndDelete(id);
    res.json({ message: 'Medicine deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk import medicines
// @route   POST /api/medicines/bulk
// @access  Private/Pharmacist,Superadmin
export const bulkImportMedicines = async (req, res, next) => {
  const medicineArray = req.body;

  if (!Array.isArray(medicineArray)) {
    res.status(400);
    return next(new Error('Payload must be a JSON array of medicines'));
  }

  try {
    let insertedCount = 0;
    let skippedCount = 0;
    const skippedBatches = [];

    for (const med of medicineArray) {
      const {
        name,
        genericName,
        manufacturer,
        expiryDate,
        quantity,
        reorderLevel,
        price,
        purchasePrice,
        category,
        barcode,
        rackLocation,
        labelImageUrl,
      } = med;

      // Only name and price are truly required; everything else is optional
      if (!name) {
        skippedCount++;
        skippedBatches.push({ name: name || 'UNKNOWN', reason: 'Missing medicine name' });
        continue;
      }

      if (price === undefined || price === null || price === '') {
        skippedCount++;
        skippedBatches.push({ name: name || 'UNKNOWN', reason: 'Missing price' });
        continue;
      }

      await Medicine.create({
        name: String(name).trim(),
        genericName: genericName ? String(genericName).trim() : '',
        manufacturer: manufacturer ? String(manufacturer).trim() : '',
        expiryDate: expiryDate || null,
        quantity: quantity !== undefined ? Number(quantity) : 0,
        reorderLevel: reorderLevel !== undefined ? Number(reorderLevel) : 10,
        price: Number(price),
        purchasePrice: purchasePrice !== undefined ? Number(purchasePrice) : 0,
        category: category ? String(category).trim() : '',
        barcode: barcode ? String(barcode).trim() : '',
        rackLocation: rackLocation ? String(rackLocation).trim() : '',
        labelImageUrl: labelImageUrl ? String(labelImageUrl).trim() : '',
        createdBy: req.user._id,
      });

      insertedCount++;
    }

    // Evaluate newly bulk imported medicines
    checkAndSendExpiryAlerts().catch((err) => {
      console.error('[Bulk Import Alert Error]:', err.message);
    });

    res.status(201).json({
      message: 'Bulk import complete',
      insertedCount,
      skippedCount,
      skippedDetails: skippedBatches,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Process a bill checkout and validate medicine statuses
// @route   POST /api/medicines/bill
// @access  Private
export const processBill = async (req, res, next) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400);
    return next(new Error('Bill items list cannot be empty'));
  }

  try {
    const checkedItems = [];
    let subtotal = 0;
    const stockRequirements = new Map();

    for (const item of items) {
      const requestedQty = Number(item.quantity);
      if (!Number.isInteger(requestedQty) || requestedQty < 1) {
        res.status(400);
        return next(new Error('Medicine quantities must be positive whole units'));
      }

      const medicine = await Medicine.findById(item.medicineId);

      if (!medicine) {
        res.status(404);
        return next(new Error(`Medicine with ID ${item.medicineId} not found`));
      }

      const expiryStatus = checkExpiryStatus(medicine.expiryDate);
      if (expiryStatus === 'EXPIRED') {
        return res.status(403).json({
          message: 'This medicine is expired and cannot be billed',
          code: 'MEDICINE_EXPIRED',
          medicineName: medicine.name,
        });
      }

      if (medicine.quantity < requestedQty) {
        res.status(400);
        return next(new Error(`Insufficient stock for '${medicine.name}'. Available: ${medicine.quantity}, Requested: ${requestedQty}`));
      }

      subtotal += medicine.price * requestedQty;
      const medicineId = String(medicine._id);
      stockRequirements.set(
        medicineId,
        (stockRequirements.get(medicineId) || 0) + requestedQty
      );
      checkedItems.push({ medicine, requestedQty });
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const [medicineId, quantity] of stockRequirements) {
          const result = await Medicine.updateOne(
            { _id: medicineId, quantity: { $gte: quantity } },
            { $inc: { quantity: -quantity } },
            { session }
          );
          if (!result.modifiedCount) {
            const error = new Error('Stock changed during billing. Please refresh and try again.');
            error.statusCode = 409;
            throw error;
          }
        }
      });
    } finally {
      await session.endSession();
    }

    res.json({
      message: 'Bill processed successfully',
      billId: 'BILL-' + Math.floor(100000 + Math.random() * 900000),
      items: checkedItems.map(c => ({
        medicineId: c.medicine._id,
        name: c.medicine.name,
        quantity: c.requestedQty,
        price: c.medicine.price,
      })),
      subtotal,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    OCR Scan medicine labels
// @route   POST /api/medicines/scan-label
// @access  Private/Pharmacist,Superadmin
export const scanLabel = async (req, res, next) => {
  if (!req.file) {
    res.status(400);
    return next(new Error('No labelImage file uploaded'));
  }

  const filePath = req.file.path;

  try {
    // 1. Run Tesseract OCR on local image
    const result = await Tesseract.recognize(filePath, 'eng', {
      langPath: englishOcrDataPath,
      gzip: true,
      cacheMethod: 'none',
    });
    const rawText = result.data.text;

    // 2. Parse raw text
    const normalizedText = rawText.replace(/\s+/g, ' ');
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const titleCase = (str) => {
      if (!str) return '';
      return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };

    const cleanLine = (line) => {
      let cleaned = line.replace(/[^a-zA-Z0-9\s-/]/g, '').trim();
      const words = cleaned.split(/\s+/);
      const validWords = words.filter(word => {
        if (word.length > 1) return true;
        if (/^[0-9]$/.test(word)) return true;
        return false;
      });
      return validWords.join(' ').replace(/\s+/g, ' ').trim();
    };

    // 1) Direct regex matcher for common medicines
    let foundBrand = '';
    let foundGeneric = '';

    const brandRegexes = [
      /\b(dolo(?:-?\s*\d+)?)\b/i,
      /\b(crocin(?:-?\s*\d+)?)\b/i,
      /\b(calpol(?:-?\s*\d+)?)\b/i,
      /\b(combiflam(?:-?\s*\d+)?)\b/i,
      /\b(pantocid(?:-?\s*\d+)?)\b/i,
      /\b(limcee(?:-?\s*\d+)?)\b/i,
      /\b(becosules(?:-?\s*\d+)?)\b/i,
      /\b(advil(?:-?\s*\d+)?)\b/i,
      /\b(tylenol(?:-?\s*\d+)?)\b/i,
      /\b(saridon(?:-?\s*\d+)?)\b/i,
      /\b(benadryl(?:-?\s*\d+)?)\b/i,
      /\b(allegra(?:-?\s*\d+)?)\b/i,
      /\b(zinetac(?:-?\s*\d+)?)\b/i,
    ];

    const genericRegexes = [
      /\b(paracetamol(?:\s+tablets?(?:\s+ip)?)?)\b/i,
      /\b(acetaminophen(?:\s+tablets?(?:\s+ip)?)?)\b/i,
      /\b(ibuprofen(?:\s+tablets?(?:\s+ip)?)?)\b/i,
      /\b(amoxicillin(?:\s+capsules?(?:\s+ip)?)?)\b/i,
      /\b(augmentin(?:\s+tablets?(?:\s+ip)?)?)\b/i,
      /\b(pantoprazole(?:\s+tablets?(?:\s+ip)?)?)\b/i,
      /\b(cetirizine(?:\s+tablets?(?:\s+ip)?)?)\b/i,
      /\b(omeprazole(?:\s+capsules?(?:\s+ip)?)?)\b/i,
      /\b(metformin(?:\s+tablets?(?:\s+ip)?)?)\b/i,
      /\b(gliclazide(?:\s+tablets?(?:\s+ip)?)?)\b/i,
      /\b(atorvastatin(?:\s+tablets?(?:\s+ip)?)?)\b/i,
      /\b(azithromycin(?:\s+tablets?(?:\s+ip)?)?)\b/i,
      /\b(ranitidine(?:\s+tablets?(?:\s+ip)?)?)\b/i,
      /\b(famotidine(?:\s+tablets?(?:\s+ip)?)?)\b/i,
    ];

    for (const regex of brandRegexes) {
      const match = normalizedText.match(regex);
      if (match) {
        foundBrand = match[1];
        break;
      }
    }

    for (const regex of genericRegexes) {
      const match = normalizedText.match(regex);
      if (match) {
        foundGeneric = match[1];
        break;
      }
    }

    // 2) Extract Manufacturer
    let manufacturer = '';
    const mfgKeywords = ['limited', 'ltd', 'labs', 'pharma', 'industries', 'corp', 'co', 'incorporated'];
    const mfgLines = lines.filter(line => {
      const clean = cleanLine(line).toLowerCase();
      return mfgKeywords.some(kw => clean.includes(kw));
    });

    if (mfgLines.length > 0) {
      let mfgClean = cleanLine(mfgLines[0]);
      const words = mfgClean.split(' ');
      const mfgIndex = words.findIndex(w => mfgKeywords.some(kw => w.toLowerCase().includes(kw)));
      if (mfgIndex !== -1) {
        const start = Math.max(0, mfgIndex - 2);
        mfgClean = words.slice(start, mfgIndex + 1).join(' ');
      }
      manufacturer = titleCase(mfgClean);
    }

    // 3) Parse Expiry Date
    let expiryDate = '';
    const expRegexes = [
      /(?:exp|expiry|use\s+before)[:\s-]*\b((?:0[1-9]|[12]\d|3[01])[-/])?(0[1-9]|1[0-2])[-/](\d{4}|\d{2})\b/i,
      /\b((?:0[1-9]|[12]\d|3[01])[-/])?(0[1-9]|1[0-2])[-/](\d{4}|\d{2})\b/ // fallback
    ];

    for (const regex of expRegexes) {
      const match = rawText.match(regex);
      if (match) {
        const day = match[1] ? match[1].replace(/[-/]/, '') : '01';
        const month = match[2];
        let year = match[3];
        if (year.length === 2) {
          year = '20' + year;
        }
        expiryDate = `${year}-${month}-${day.padStart(2, '0')}`;
        break;
      }
    }

    // Only auto-fill names recognized by the explicit medicine-name patterns.
    let medicineName = foundBrand
      ? titleCase(foundBrand)
      : foundGeneric
        ? titleCase(foundGeneric)
        : '';
    let genericName = foundGeneric ? titleCase(foundGeneric) : '';

    // Calculate confidence based on how many fields were found
    let foundCount = 0;
    if (medicineName) foundCount++;
    if (expiryDate) foundCount++;
    if (genericName) foundCount++;

    const scannedPrices = {
      purchasePrice: parseExplicitDecimalPrice(rawText, 'purchase'),
      salePrice: parseExplicitDecimalPrice(rawText, 'sale'),
      mrp: parseExplicitDecimalPrice(rawText, 'mrp'),
    };

    let confidence = 'low';
    if (foundCount === 3) confidence = 'high';
    else if (foundCount === 2) confidence = 'medium';

    // 3. Upload image to Cloudinary (if configured)
    let labelImageUrl = '';
    const isCloudinaryConfigured = 
      process.env.CLOUDINARY_CLOUD_NAME && 
      process.env.CLOUDINARY_API_KEY && 
      process.env.CLOUDINARY_API_SECRET;

    if (isCloudinaryConfigured) {
      const uploadResult = await cloudinary.uploader.upload(filePath, {
        folder: 'medicine_labels',
      });
      labelImageUrl = uploadResult.secure_url;

      // Clean up local temp file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } else {
      // Fallback: Local static hosting
      labelImageUrl = `http://localhost:${process.env.PORT || 5000}/uploads/${req.file.filename}`;
    }

    res.json({
      medicineName,
      genericName,
      manufacturer,
      expiryDate,
      scannedPrices,
      labelImageUrl,
      rawText,
      confidence,
    });
  } catch (error) {
    // Clean up local file in case of error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    next(error);
  }
};

// @desc    Adjust medicine stock level with reason
// @route   POST /api/medicines/:id/adjust-stock
// @access  Private/Pharmacist,Superadmin
export const adjustStock = async (req, res, next) => {
  const { id } = req.params;
  const { adjustmentType, amount, reason } = req.body;

  try {
    const medicine = await Medicine.findById(id);

    if (!medicine) {
      res.status(404);
      return next(new Error('Medicine not found'));
    }

    if (!reason || !reason.trim()) {
      res.status(400);
      return next(new Error('Adjustment reason is required'));
    }

    const qtyAmount = Number(amount);
    if (
      !Number.isInteger(qtyAmount) ||
      qtyAmount < 0 ||
      (adjustmentType !== 'SET' && qtyAmount === 0)
    ) {
      res.status(400);
      return next(new Error('Amount must be a valid whole quantity'));
    }

    const previousQuantity = medicine.quantity;
    let newQuantity = previousQuantity;
    let quantityChanged = 0;

    if (adjustmentType === 'ADD') {
      newQuantity = previousQuantity + qtyAmount;
      quantityChanged = qtyAmount;
    } else if (adjustmentType === 'SUBTRACT') {
      if (qtyAmount > previousQuantity) {
        res.status(400);
        return next(new Error(`Cannot subtract ${qtyAmount} items. Current stock is only ${previousQuantity}.`));
      }
      newQuantity = previousQuantity - qtyAmount;
      quantityChanged = -qtyAmount;
    } else if (adjustmentType === 'SET') {
      newQuantity = qtyAmount;
      quantityChanged = newQuantity - previousQuantity;
    } else {
      res.status(400);
      return next(new Error('Invalid adjustmentType. Must be ADD, SUBTRACT, or SET.'));
    }

    const session = await mongoose.startSession();
    let adjustmentLog;
    try {
      await session.withTransaction(async () => {
        const updatedMedicine = await Medicine.findOneAndUpdate(
          { _id: medicine._id, quantity: previousQuantity },
          { $set: { quantity: newQuantity } },
          { new: true, session }
        );
        if (!updatedMedicine) {
          const error = new Error('Stock changed during adjustment. Refresh and try again.');
          error.statusCode = 409;
          throw error;
        }

        [adjustmentLog] = await StockAdjustment.create(
          [{
            medicineId: medicine._id,
            medicineName: medicine.name,
            previousQuantity,
            newQuantity,
            adjustmentType,
            quantityChanged,
            reason: reason.trim(),
            adjustedBy: req.user._id,
          }],
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    const populatedLog = await StockAdjustment.findById(adjustmentLog._id).populate('adjustedBy', 'name email role');

    res.json({
      success: true,
      message: `Stock successfully updated from ${previousQuantity} to ${newQuantity}`,
      medicine: await Medicine.findById(medicine._id),
      adjustmentLog: populatedLog,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get stock adjustment history logs
// @route   GET /api/medicines/stock-adjustments
// @access  Private/Pharmacist,Superadmin
export const getStockAdjustments = async (req, res, next) => {
  try {
    const logs = await StockAdjustment.find({})
      .populate('medicineId', 'name genericName rackLocation')
      .populate('adjustedBy', 'name email role')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(logs);
  } catch (error) {
    next(error);
  }
};
