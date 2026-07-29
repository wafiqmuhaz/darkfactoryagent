import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { aiModelManager } from '../ai/model-manager';
import { MODEL_CATALOG } from '../ai/model-registry';

export const aiRoutes = Router();

// GET /api/ai/providers — list all providers and their availability
aiRoutes.get('/providers', authenticate, (req, res) => {
  res.json({ providers: aiModelManager.getAvailableProviders() });
});

// GET /api/ai/models — list model catalog
aiRoutes.get('/models', authenticate, (req, res) => {
  const { capability, tier, provider } = req.query as Record<string, string>;
  let models = MODEL_CATALOG;

  if (capability) models = models.filter((m) => m.capabilities.includes(capability as any));
  if (tier) models = models.filter((m) => m.tier === tier);
  if (provider) models = models.filter((m) => m.provider === provider as any);

  res.json({ models, total: models.length });
});

// GET /api/ai/models/lifecycle — model lifecycle status
aiRoutes.get('/models/lifecycle', authenticate, (req, res) => {
  res.json({ lifecycle: aiModelManager.getLifecycleStatus() });
});

// GET /api/ai/metrics — model performance report (6.9)
aiRoutes.get('/metrics', authenticate, (req, res) => {
  res.json({ report: aiModelManager.getModelReport() });
});

// POST /api/ai/deprecate/:modelId — deprecate a model (6.10)
aiRoutes.post('/deprecate/:modelId', authenticate, (req, res) => {
  const modelId = req.params.modelId as string;
  const { note } = req.body;
  try {
    aiModelManager.deprecateModel(modelId, note ?? 'Deprecated by admin');
    res.json({ success: true, message: `Model ${modelId} deprecated` });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// POST /api/ai/complete — direct AI completion (6.6, 6.7)
aiRoutes.post('/complete', authenticate, async (req, res) => {
  const { messages, strategy, model, capability, maxTokens, temperature } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  try {
    const response = await aiModelManager.complete(
      messages,
      {
        strategy: strategy ?? 'cheapest',
        specificModelId: model,
        requiredCapability: capability,
      },
      { maxTokens, temperature }
    );
    return res.json(response);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/models/register — register a fine-tuned custom model (6.8)
aiRoutes.post('/models/register', authenticate, (req, res) => {
  const { id, provider, displayName, tier, capabilities, contextWindow, costPerInputToken, costPerOutputToken } = req.body;

  if (!id || !provider || !displayName) {
    return res.status(400).json({ error: 'id, provider, displayName are required' });
  }

  try {
    aiModelManager.registerCustomModel({
      id,
      provider,
      displayName,
      tier: tier ?? 'balanced',
      capabilities: capabilities ?? ['general'],
      contextWindow: contextWindow ?? 128000,
      costPerInputToken: costPerInputToken ?? 0,
      costPerOutputToken: costPerOutputToken ?? 0,
    });
    return res.json({ success: true, message: `Model ${id} registered` });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});
