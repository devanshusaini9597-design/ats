const Position = require('../models/Position');
const { normalizeText } = require('../utils/textNormalize');

// Get all positions (user's own)
const getPositions = async (req, res) => {
  try {
    const positions = await Position.find({ createdBy: req.user.id, isActive: true }).sort({ name: 1 });
    res.json(positions);
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all positions across company (all users) — for "View all positions added across company"
const getAllPositions = async (req, res) => {
  try {
    const positions = await Position.find({ isActive: true }).sort({ name: 1 }).lean();
    const userIdStr = req.user?.id?.toString();
    const withOwner = positions.map(p => ({ ...p, isMine: p.createdBy?.toString() === userIdStr }));
    res.json(withOwner);
  } catch (error) {
    console.error('Error fetching all positions:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new position
const createPosition = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Position name is required' });
    }

    const existingPosition = await Position.findOne({ createdBy: req.user.id, name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingPosition) {
      return res.status(400).json({ message: 'Position already exists' });
    }

    const position = new Position({
      name: normalizeText(name),
      description: description?.trim(),
      createdBy: req.user.id
    });

    await position.save();
    res.status(201).json(position);
  } catch (error) {
    console.error('Error creating position:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update a position
const updatePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const position = await Position.findOne({ _id: id, createdBy: req.user.id });
    if (!position) {
      return res.status(404).json({ message: 'Position not found' });
    }

    if (name) {
      const existingPosition = await Position.findOne({
        createdBy: req.user.id,
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: id }
      });
      if (existingPosition) {
        return res.status(400).json({ message: 'Position name already exists' });
      }
      position.name = normalizeText(name);
    }

    if (description !== undefined) {
      position.description = description?.trim();
    }

    if (isActive !== undefined) {
      position.isActive = isActive;
    }

    position.updatedAt = new Date();
    await position.save();

    res.json(position);
  } catch (error) {
    console.error('Error updating position:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a position (soft delete)
const deletePosition = async (req, res) => {
  try {
    const { id } = req.params;

    const position = await Position.findOne({ _id: id, createdBy: req.user.id });
    if (!position) {
      return res.status(404).json({ message: 'Position not found' });
    }

    position.isActive = false;
    position.updatedAt = new Date();
    await position.save();

    res.json({ message: 'Position deleted successfully' });
  } catch (error) {
    console.error('Error deleting position:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getPositions,
  getAllPositions,
  createPosition,
  updatePosition,
  deletePosition
};
