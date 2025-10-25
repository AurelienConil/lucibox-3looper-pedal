const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { exec } = require('child_process');
const path = require('path');

class WebManager {
  constructor(options = {}) {
    this.app = express();
    this.server = null;
    this.io = null;
    this.clients = new Map(); // Map pour stocker les clients avec leurs infos
    this.messageCallback = null;
    this.autoOpenBrowser = options.autoOpenBrowser || false;
    this.htmlFileName = options.htmlFileName || 'index.html';
  }

  // Démarre le serveur web et Socket.IO
  start(port = 3000) {
    // Créer serveur HTTP
    this.server = createServer(this.app);
    
    // Initialiser Socket.IO
    this.io = new Server(this.server, {
      cors: {
        origin: "*", // En production, spécifie les domaines autorisés
        methods: ["GET", "POST"]
      }
    });

    // Servir fichiers statiques (optionnel - pour servir ta page HTML)
    this.app.use(express.static('public'));
    
    // Route de base
    this.app.get('/', (req, res) => {
      res.send('WebManager Server is running');
    });

    // Gérer les connexions Socket.IO
    this.io.on('connection', (socket) => {
      console.log(`Client connecté: ${socket.id}`);
      
      // Ajouter le client à la liste
      this.clients.set(socket.id, {
        id: socket.id,
        socket: socket,
        connectedAt: new Date()
      });

      // Écouter les événements des sliders
      socket.on('slider_change', (data) => {
        if (this.messageCallback) {
          this.messageCallback('slider_change', data, socket.id);
        }
      });

      // Écouter les événements des boutons
      socket.on('command_request', (data) => {
        if (this.messageCallback) {
          this.messageCallback('command_request', data, socket.id);
        }
      });

      // Gérer la déconnexion
      socket.on('disconnect', (reason) => {
        console.log(`Client déconnecté: ${socket.id} (${reason})`);
        this.clients.delete(socket.id);
      });

      // Envoyer un message de bienvenue
      socket.emit('server_message', { 
        message: `Bienvenue! Connecté en tant que ${socket.id}` 
      });
    });

    // Démarrer le serveur
    this.server.listen(port, '0.0.0.0', () => {
      console.log(`Web server started on port ${port}`);
      console.log(`Socket.IO server ready`);
      
      // Ouvrir le navigateur si demandé
      if (this.autoOpenBrowser) {
        setTimeout(() => {
          this.openBrowser();
        }, 1000);
      }
    });
  }

  // Fonction pour ouvrir le navigateur selon l'OS
  openBrowser() {
    //const htmlPath = path.join(process.cwd(), this.htmlFileName);
    // The file is located in the 'public' directory
    const htmlPath = path.join(__dirname, '../public', this.htmlFileName);

    let command;
    
    switch (process.platform) {
      case 'darwin': // macOS
        command = `open "${htmlPath}"`;
        break;
      case 'win32': // Windows
        command = `start "" "${htmlPath}"`;
        break;
      default: // Linux et autres
        command = `xdg-open "${htmlPath}"`;
        break;
    }
    
    exec(command, (error) => {
      if (error) {
        console.error(`Erreur lors de l'ouverture du navigateur: ${error}`);
        console.log(`Vous pouvez ouvrir manuellement: ${htmlPath}`);
      } else {
        console.log(`Navigateur ouvert: ${htmlPath}`);
      }
    });
  }

  // Envoie un message à tous les clients connectés
  broadcast(message) {
    if (this.io) {
      this.io.emit('server_message', { message: message });
      console.log(`Broadcasting to ${this.clients.size} clients: ${message}`);
    }
  }

  // Envoie une notification à tous les clients
  broadcastNotification(text) {
    if (this.io) {
      this.io.emit('notification', { text: text });
      console.log(`Broadcasting notification to ${this.clients.size} clients: ${text}`);
    }
  }

  // Envoie un message à un client spécifique, avec type d'événement personnalisé
  sendToClient(clientId, eventType, payload) {
    const client = this.clients.get(clientId);
    if (client && client.socket) {
      client.socket.emit(eventType, payload);
      console.log(`Sending to client ${clientId}: ${eventType}`);
    } else {
      console.log(`Client ${clientId} not found`);
    }
  }

  // Envoie une notification à un client spécifique
  sendNotificationToClient(clientId, text) {
    const client = this.clients.get(clientId);
    if (client && client.socket) {
      client.socket.emit('notification', { text: text });
      console.log(`Sending notification to client ${clientId}: ${text}`);
    }
  }

  // Définit le callback pour les messages reçus
  onMessage(callback) {
    this.messageCallback = callback;
  }

  // Retourne la liste des clients connectés
  getConnectedClients() {
    return Array.from(this.clients.keys());
  }

  // Retourne le nombre de clients connectés
  getClientCount() {
    return this.clients.size;
  }

  // Arrête le serveur
  stop() {
    if (this.server) {
      this.server.close(() => {
        console.log('Web server stopped');
      });
    }
    if (this.io) {
      this.io.close();
      console.log('Socket.IO server stopped');
    }
    this.clients.clear();
  }
}

module.exports = WebManager;