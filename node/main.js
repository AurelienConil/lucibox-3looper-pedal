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
    this.webManager = new WebManager();
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
    this.webManager.onMessage((message) => {
      // TODO: Router message web vers OSC ou contrôle audio
      console.log('Web message received:', message);
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
      this.webManager.start();
      
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