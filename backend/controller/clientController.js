const Client = require('../models/Client');
const { normalizeText } = require('../utils/textNormalize');

// Get all clients (user's own)
const getClients = async (req, res) => {
  try {
    const clients = await Client.find({ createdBy: req.user.id, isActive: true }).sort({ name: 1 });
    res.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all clients across company (all users)
const getAllClients = async (req, res) => {
  try {
    const clients = await Client.find({ isActive: true }).sort({ name: 1 }).lean();
    const userIdStr = req.user?.id?.toString();
    const withOwner = clients.map(c => ({ ...c, isMine: c.createdBy?.toString() === userIdStr }));
    res.json(withOwner);
  } catch (error) {
    console.error('Error fetching all clients:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new client
const createClient = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Client name is required' });
    }

    const existingClient = await Client.findOne({ createdBy: req.user.id, name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingClient) {
      return res.status(400).json({ message: 'Client already exists' });
    }

    const client = new Client({
      name: normalizeText(name),
      description: description?.trim(),
      createdBy: req.user.id
    });

    await client.save();
    res.status(201).json(client);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update a client
const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const client = await Client.findOne({ _id: id, createdBy: req.user.id });
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    if (name) {
      const existingClient = await Client.findOne({
        createdBy: req.user.id,
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: id }
      });
      if (existingClient) {
        return res.status(400).json({ message: 'Client name already exists' });
      }
      client.name = normalizeText(name);
    }

    if (description !== undefined) {
      client.description = description?.trim();
    }

    if (isActive !== undefined) {
      client.isActive = isActive;
    }

    client.updatedAt = new Date();
    await client.save();

    res.json(client);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a client (soft delete)
const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findOne({ _id: id, createdBy: req.user.id });
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    client.isActive = false;
    client.updatedAt = new Date();
    await client.save();

    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getClients,
  getAllClients,
  createClient,
  updateClient,
  deleteClient
};
