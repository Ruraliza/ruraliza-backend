const { CATEGORIES } = require('../constants/categories');

// GET /api/categories - Lista fixa de categorias de serviço
exports.listCategories = (req, res) => {
  return res.status(200).json(CATEGORIES);
};
