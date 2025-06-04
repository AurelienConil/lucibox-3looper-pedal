const OSCManager = require('./modules/OSCManager');
const ArduinoManager = require('./modules/ArduinoManager');
const MIDIManager = require('./modules/MIDIManager');
const WebManager = require('./modules/WebManager');
const PdManager = require('./modules/PdManager');

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

    // Web -> OSC/Audio
      this.webManager.onMessage((eventType, data, clientId) => {
        console.log(`Reçu ${eventType} de ${clientId}:`, data);
        
        switch(eventType) {
          case 'slider_change':
            // Traiter le changement de slider
            console.log(`Slider ${data.slider} changé à ${data.value} ` );
            //check if data.adress exists, if yet, send to OSC
            console.log( `Adresse: ${data.address}, Valeur: ${data.value}` );
            if (data.address && data.value !== undefined) {
              this.oscManager.sendMessage(data.address, data.value);
              console.log(`OSC -> ${data.address} ${data.value}`);
            }
            break;
            
          case 'button_click':
            // Traiter le clic de bouton
            console.log(`Bouton ${data.button} cliqué ` );
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

  // Démarre tous les services
  async start() {
    console.log("//////////////////////");
    console.log("BRIDGE ARDUINO OSC");
    console.log("//////////////////////");

    try {
      // Initialisation des modules
      this.oscManager.initialize();
      await this.arduinoManager.findAndConnect();
      this.midiManager.initialize();
      this.webManager.start(3000);
      
      // Démarrage de l'écoute OSC
      this.oscManager.startListening();
      
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
    this.midiManager.disconnect();
    this.webManager.stop();
    //this.audioManager.stop();
    
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