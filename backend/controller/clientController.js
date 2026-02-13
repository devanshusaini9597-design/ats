const Client = require('../models/Client');

// Auto Title Case: "hr admin" → "Hr Admin"
const toTitleCase = (str) => str.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

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
      name: toTitleCase(name),
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
      client.name = toTitleCase(name);
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
  createClient,
  updateClient,
  deleteClient
};
