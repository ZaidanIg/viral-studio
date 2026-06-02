const CharacterService = require('./characterService'); // Reusing generate logic for now

class MarketingService {
  async generateStoryboard(payload) {
    // For now, marketing generation uses the same base generation logic as character
    // In the future, this can include logic specific to batch generation or prompt chaining
    return CharacterService.generate(payload);
  }
}

module.exports = new MarketingService();
