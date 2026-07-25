const Product = require('../models/Product');


async function decrementStockForOrder(order) {
  const items = order.items || [];
  await Promise.all(
    items.filter(item => item.productId).map(async (item) => {
      const product = await Product.findById(item.productId);
      if (!product) return; // product may have been deleted since the order was placed
      product.stock = Math.max(product.stock - item.qty, 0);
      await product.save();
    })
  );
}


async function validateStockForItems(items = []) {
  const insufficient = [];

  for (const item of items) {
    if (!item.productId) continue; // nothing to check against
    const product = await Product.findById(item.productId);
    if (!product || product.stock < item.qty) {
      insufficient.push({
        productId: item.productId,
        name: item.name,
        available: product ? product.stock : 0,
        requested: item.qty,
      });
    }
  }

  return { valid: insufficient.length === 0, insufficient };
}

module.exports = { decrementStockForOrder, validateStockForItems };