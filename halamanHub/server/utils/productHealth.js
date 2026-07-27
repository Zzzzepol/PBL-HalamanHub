// HalamanHub Server — Product stock health checker
// Runs periodically. Uses the same stock <= 8 cutoff your
// Product model already uses for its "low-stock" status badge,

const Product = require('../models/Product');
const { createAlertIfEnabled } = require('./alerts');

const LOW_STOCK_CUTOFF = 8;

async function checkProductStock() {
  try {
    const low = await Product.find({ stock: { $lte: LOW_STOCK_CUTOFF }, lowStockAlerted: false });
    for (const product of low) {
      product.lowStockAlerted = true;
      await product.save();
      await createAlertIfEnabled('lowStock', {
        type: product.stock === 0 ? 'error' : 'warning',
        icon: product.stock === 0 ? 'ti-alert-triangle' : 'ti-package',
        message: product.stock === 0
          ? `${product.name} is out of stock.`
          : `${product.name} is running low (${product.stock} left).`,
      });
    }

    // Reset the flag once restocked, so it can alert again on the next dip
    await Product.updateMany(
      { stock: { $gt: LOW_STOCK_CUTOFF }, lowStockAlerted: true },
      { lowStockAlerted: false }
    );
  } catch (err) {
    console.error('Product stock health check failed:', err.message);
  }
}

module.exports = { checkProductStock };