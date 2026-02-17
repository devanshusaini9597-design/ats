const Source = require('../models/Source');
const { normalizeText } = require('../utils/textNormalize');

// Get all sources (user's own)
const getSources = async (req, res) => {
  try {
    const sources = await Source.find({ createdBy: req.user.id, isActive: true }).sort({ name: 1 });
    res.json(sources);
  } catch (error) {
    console.error('Error fetching sources:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new source
const createSource = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Source name is required' });
    }

    const existingSource = await Source.findOne({ createdBy: req.user.id, name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingSource) {
      return res.status(400).json({ message: 'Source already exists' });
    }

    const source = new Source({
      name: normalizeText(name),
      description: description?.trim(),
      createdBy: req.user.id
    });

    await source.save();
    res.status(201).json(source);
  } catch (error) {
    console.error('Error creating source:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update a source
const updateSource = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const source = await Source.findOne({ _id: id, createdBy: req.user.id });
    if (!source) {
      return res.status(404).json({ message: 'Source not found' });
    }

    if (name) {
      const existingSource = await Source.findOne({
        createdBy: req.user.id,
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: id }
      });
      if (existingSource) {
        return res.status(400).json({ message: 'Source name already exists' });
      }
      source.name = normalizeText(name);
    }

    if (description !== undefined) {
      source.description = description?.trim();
    }

    if (isActive !== undefined) {
      source.isActive = isActive;
    }

    source.updatedAt = new Date();
    await source.save();

    res.json(source);
  } catch (error) {
    console.error('Error updating source:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a source (soft delete)
const deleteSource = async (req, res) => {
  try {
    const { id } = req.params;

    const source = await Source.findOne({ _id: id, createdBy: req.user.id });
    if (!source) {
      return res.status(404).json({ message: 'Source not found' });
    }

    source.isActive = false;
    source.updatedAt = new Date();
    await source.save();

    res.json({ message: 'Source deleted successfully' });
  } catch (error) {
    console.error('Error deleting source:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getSources,
  createSource,
  updateSource,
  deleteSource
};
