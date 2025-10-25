const OSCManager = require('./modules/OSCManager');
const ArduinoManager = require('./modules/ArduinoManager');
const MIDIManager = require('./modules/MIDIManager');
const WebManager = require('./modules/WebManager');
const PdManager = require('./modules/PdManager');
const CLManager = require('./modules/CLManager');

class LuciboxBridge {
  constructor() {
    // Initialisation des managers
    this.oscManager = new OSCManager();
    this.arduinoManager = new ArduinoManager();
    this.midiManager = new MIDIManager();
    this.webManager = new WebManager({
      autoOpenBrowser: false,        // Ouvre automatiquement le navigateur
      htmlFileName: 'index.html'    // Nom du fichier HTML à ouvrir
    });
    this.PdManager = new PdManager();
    this.clManager = new CLManager({
      projectRoot: __dirname,
      allowedCommands: [
        'git_pull',
        'git_commit',
        'restart',
        'poweroff', 
        'reboot',
        'update_system',
        'check_status'
      ]
    });
    
    this.setupMessageRouting();
  }

  // Configure le routage des messages entre modules
  setupMessageRouting() {
    // Arduino -> OSC
    this.arduinoManager.onMessage((message) => {
      // TODO: Parser et router vers OSC
      console.log('Arduino message received:', message);
      if (message.startsWith('/lucibox/')) {
        // Reformater pour OSC: "/lucibox/led/set 4 2"
        const parts = message.split(' ');
        if (parts.length >= 2) {
          const address = parts[0];
          const value = parseInt(parts[1]);
          
          if (!isNaN(value) && address.startsWith('/')) {
            this.oscManager.sendMessage(address, value);
            console.log(`OSC -> ${address} ${value}`);
          }
        }
      
      }
    });

    // MIDI -> OSC
    this.midiManager.onMessage((message) => {
      // TODO: Convertir MIDI en OSC et router
      console.log('MIDI message received:', message);
    });

       // CLManager -> Web (pour notifier l'interface des résultats de commandes)
    this.clManager.onMessage((type, data) => {
      console.log(`CLManager event: ${type}`, data);
      
      // Envoyer les notifications vers l'interface web
      this.webManager.broadcast('command_status', {
        type,
        ...data
      });
      
      // Si c'est un git pull réussi, on peut envoyer un message OSC
      if (type === 'command_completed' && data.command === 'git_pull' && data.success) {
        this.oscManager.sendMessage('/lucibox/system/updated', 1);
      }
    });

    // Web -> OSC/Audio/CLManager
    this.webManager.onMessage((eventType, data, clientId) => {
      console.log(`Reçu ${eventType} de ${clientId}:`, data);
      
      switch(eventType) {
        case 'slider_change':
          // Traiter le changement de slider (logique existante)
          console.log(`Slider ${data.slider} changé à ${data.value}`);
          if (data.address && data.value !== undefined) {
            this.oscManager.sendMessage(data.address, data.value);
            console.log(`OSC -> ${data.address} ${data.value}`);
          }
          break;
          
        case 'button_click':
          // Traiter le clic de bouton (logique existante)
          console.log(`Bouton ${data.button} cliqué`);
          break;
          
        case 'command_request':
          // Nouvelle gestion pour les commandes système
          console.log(`Requête de commande reçue: ${data.command} avec params`, data.params);
          this.handleCommandRequest(data, clientId);
          break;
      }
    });


    // OSC -> Arduino/Web
    // Le routing OSC -> Arduino sera maintenant :
    this.oscManager.addMessageHandler((address, ...values) => {
      if (address.startsWith('/lucibox/')) {
        // Reformater pour Arduino: "/lucibox/led/set 4 2"
            if (Array.isArray(values) && address.startsWith('/')) {
              let message = `${address}`;
              // add value one by one with a space between
              for (const val of values) {
                message += ` ${val}`;
              }
              console.log(`OSC <- ${message}`);
              this.arduinoManager.sendCommand(message)
            }
      }
    });
  }

  // Gestion des requêtes de commandes système
  async handleCommandRequest(data, clientId) {
    const { command, params = {} } = data;
    
    try {
      console.log(`Exécution de la commande "${command}" demandée par ${clientId}`);
      
      // Vérifier si la commande existe
      const availableCommands = this.clManager.getAvailableCommands();
      const commandExists = availableCommands.some(cmd => cmd.name === command);
      
      if (!commandExists) {
        throw new Error(`Commande inconnue: ${command}`);
      }
      
      // Envoyer confirmation de démarrage via Socket.IO
      this.webManager.sendToClient(clientId, 'command_status', {
        type: 'command_started',
        command,
        message: `Exécution de ${command}...`
      });
      
      // Exécuter la commande
      const result = await this.clManager.executeCommand(command, params);
      
      // Envoyer le résultat via Socket.IO
      this.webManager.sendToClient(clientId, 'command_status', {
        type: 'command_completed',
        command,
        success: true,
        result,
        message: `${command} exécuté avec succès`
      });
      
    } catch (error) {
      console.error(`Erreur lors de l'exécution de ${command}:`, error.message);
      
      // Envoyer l'erreur au client via Socket.IO
      this.webManager.sendToClient(clientId, 'command_status', {
        type: 'command_error',
        command,
        error: error.message,
        message: `Erreur lors de l'exécution de ${command}`
      });
    }
  }

  // Démarre tous les services
  async start() {
    console.log("//////////////////////");
    console.log("BRIDGE ARDUINO OSC");
    console.log("//////////////////////");

    try {
      // Initialisation des modules
      this.oscManager.initialize();
      await this.arduinoManager.findAndConnect();
      //this.midiManager.initialize();
      this.webManager.start(3000);
      
      // Démarrage de l'écoute OSC
      this.oscManager.startListening();

      // Le CLManager n'a pas besoin d'initialisation spéciale
      // console.log('CLManager ready with commands:', 
      //   this.clManager.getAvailableCommands().map(cmd => cmd.name).join(', ')
      // );
      
      console.log('All modules started successfully');
      
    } catch (error) {
      console.error('Error starting bridge:', error);
    }
  }

  // Arrête tous les services
  stop() {
    console.log('\nStopping all modules...');
    
    this.oscManager.stop();
    this.arduinoManager.disconnect();
   // this.midiManager.disconnect();
    //this.webManager.stop();
    //this.clManager.stop();
    
    console.log('Bridge stopped');
  }
}

// Démarrage du programme
const bridge = new LuciboxBridge();
bridge.start();

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  bridge.stop();
  process.exit(0);
});

module.exports = LuciboxBridge;