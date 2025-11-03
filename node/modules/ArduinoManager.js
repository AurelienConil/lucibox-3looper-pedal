const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

class ArduinoManager {
  constructor() {
    this.serialPort = null;
    this.isConnected = false;
    this.messageCallback = null;
  }

  // Recherche et se connecte à l'Arduino LUCIBOX
  async findAndConnect() {
        console.log('Scanning for LUCIBOX devices...');
    
    try {
      const ports = await SerialPort.list();
      console.log(`Found ${ports.length} serial ports`);
      
      for (const port of ports.reverse()) {
        console.log(`Testing ${port.path}...`);
        const isLucibox = await this.testPort(port.path);
        
        if (isLucibox) {
          console.log(`✓ LUCIBOX found on ${port.path}`);
          this.connectToPort(port.path);
          // clear the led strip 1 sec after connection
          setTimeout(() => {  
          console.log('Clearing LED strip...');
          this.sendCommand("/lucibox/led/strip/clear 0 0");
          }, 2000);
          return;
        }
      }
      
      console.log('❌ No LUCIBOX device found');
      
    } catch (error) {
      console.error('Error scanning ports:', error.message);
    }
  }

  // Teste si un port est un LUCIBOX
  async testPort(portPath) {    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve(false);
      }, 3000); // 3 secondes timeout
      
      let testPort;
      
      const cleanup = () => {
        clearTimeout(timeout);
        if (testPort && testPort.isOpen) {
          testPort.close();
        }
      };
      
      try {
        testPort = new SerialPort({
          path: portPath,
          baudRate: 38400
        });
        
        const parser = testPort.pipe(new ReadlineParser({ delimiter: '\n' }));
        
        parser.on('data', (data) => {
          const message = data.toString().trim();
          if (message === '# LUCIBOX OSC Interface Ready') {
            cleanup();
            resolve(true);
          }
        });
        
        testPort.on('error', () => {
          cleanup();
          resolve(false);
        });
        
      } catch (error) {
        cleanup();
        resolve(false);
      }
    });
  }

  // Se connecte à un port spécifique
  connectToPort(portPath) {
    //console log the portPath
    console.log(`Connecting to Arduino on ${portPath}`);
    this.serialPort = new SerialPort({
      path: portPath,
      baudRate: 38400
    });
    const parser = this.serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

    parser.on('data', (data) => {
      if (this.messageCallback) {
        this.messageCallback(data.trim());
      }
    });

    this.serialPort.on('open', () => {
      console.log(`Connected to Arduino on ${portPath}`);
      this.isConnected = true;
      
    });

    this.serialPort.on('error', (err) => {
      console.error('Serial port error:', err.message);
    });
}

  // Envoie une commande à l'Arduino
  sendCommand(message) {
    //Check if serialPort is connected
    if (this.serialPort && this.serialPort.isOpen) {
      this.serialPort.write(`${message}\n`, (err) => {
        if (err) {
          console.error('Error writing to serial port:', err.message);
        }
      });
    }
  }

  // Définit le callback pour les messages reçus
  onMessage(callback) {
    this.messageCallback = callback;
  }

  // Ferme la connexion
  disconnect() {
    // TODO: Fermer serialPort
    console.log('Arduino disconnected');
    if (this.serialPort && this.serialPort.isOpen) {
      this.serialPort.close((err) => {
        if (err) {
          console.error('Error closing serial port:', err.message);
        } else {
          console.log('Serial port closed');
        }
      });
      this.isConnected = false;
    } else {
      console.log('Serial port was not open');
    }
  }
}

module.exports = ArduinoManager;