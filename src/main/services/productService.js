const CharacterService = require('./characterService'); // Reusing logic for now

class ProductService {
  async uploadProductImage(payload) {
    return CharacterService.uploadImage(payload);
  }

  async generateProductScene(payload) {
    return CharacterService.generate(payload);
  }
}

module.exports = new ProductService();
