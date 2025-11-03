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

        const serialPort = new SerialPort({
          path: port.path,
          baudRate: 38400
        });

        const isLucibox = await this.testPort(serialPort);

        if (isLucibox) {
          console.log(`✓ LUCIBOX found on ${port.path}`);

          // Set up the parser and listeners directly on the open port
          const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

          parser.on('data', (data) => {
            console.log(`Message received: ${data.trim()}`);
            if (this.messageCallback) {
              this.messageCallback(data.trim());
            }
          });

          serialPort.on('open', () => {
            console.log(`Connected to Arduino on ${port.path}`);
            this.isConnected = true;
          });

          serialPort.on('error', (err) => {
            console.error('Serial port error:', err.message);
          });

          this.serialPort = serialPort; // Keep the port open

          // Clear the LED strip 1 sec after connection
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

  async testPort(serialPort) {
    return new Promise((resolve) => {
      console.log(`Testing port ${serialPort.path} for handshake...`);
      const timeout = setTimeout(() => {
        cleanup();
        resolve(false); // Return false if the test fails
      }, 5000); // 5 seconds timeout

      const cleanup = () => {
        clearTimeout(timeout);
        if (serialPort && serialPort.isOpen) {
          console.log(`Closing test port ${serialPort.path}`);
          serialPort.close();
        }
      };

      try {
        const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

        parser.on('data', (data) => {
          console.log(`Received on ${serialPort.path}: ${data.toString().trim()}`);
          const message = data.toString().trim();
          if (message.includes('LUCIBOX')) {
            clearTimeout(timeout); // Cancel the timeout
            parser.removeAllListeners(); // Clean up listeners
            console.log(`Handshake successful on ${serialPort.path}`);
            resolve(true); // Indicate the port is valid
          }
        });

        serialPort.on('error', (err) => {
          console.error(`Error on ${serialPort.path}:`, err.message);
          cleanup();
          resolve(false);
        });

      } catch (error) {
        console.error('Error testing port:', error.message);
        cleanup();
        resolve(false);
      }
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