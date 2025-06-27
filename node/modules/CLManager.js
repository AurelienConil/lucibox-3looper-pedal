const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class CLManager {
  constructor(options = {}) {
    this.allowedCommands = options.allowedCommands || [
      'git_pull',
      'restart',
      'poweroff',
      'reboot',
      'update_system',
      'check_status'
  ];
    
  this.projectRoot = options.projectRoot || process.cwd();
  this.messageCallback = null;
  this.isExecuting = false;
    
  console.log('CLManager initialized with allowed commands:', this.allowedCommands);
  }

  // Callback pour recevoir les messages
  onMessage(callback) {
          this.messageCallback = callback;    
  }

  // Méthode pour notifier les autres modules
    sendMessage(type, data) {
        if (this.messageCallback) {
            this.messageCallback(type, data);
    }
  }

  // Exécute une commande système de manière sécurisée
  async executeCommand(commandName, params = {}) {
    if (this.isExecuting) {
      throw new Error('Une commande est déjà en cours d\'exécution');
    }

    if (!this.allowedCommands.includes(commandName)) {
      throw new Error(`Commande non autorisée: ${commandName}`);
    }

    this.isExecuting = true;
    
    try {
      console.log(`Exécution de la commande: ${commandName}`);
      this.sendMessage('command_started', { command: commandName, params });
      
      const result = await this._executeSpecificCommand(commandName, params);
      
      this.sendMessage('command_completed', { 
        command: commandName, 
        success: true, 
        result 
      });
      
      return result;
      
    } catch (error) {
      console.error(`Erreur lors de l'exécution de ${commandName}:`, error.message);
      
      this.sendMessage('command_error', { 
        command: commandName, 
        error: error.message 
      });
      
      throw error;
      
    } finally {
      this.isExecuting = false;
    }
  }

  // Exécute la commande spécifique
  async _executeSpecificCommand(commandName, params) {
    switch (commandName) {
      case 'git_pull':
        return await this._gitPull();
        
      case 'restart':
        return await this._restart();
        
      case 'poweroff':
        return await this._poweroff();
        
      case 'reboot':
        return await this._reboot();
        
      case 'update_system':
        return await this._updateSystem();
        
      case 'check_status':
        return await this._checkStatus();
        
      default:
        throw new Error(`Commande inconnue: ${commandName}`);
    }
  }

  // Git pull
  async _gitPull() {
    return new Promise((resolve, reject) => {
      const gitProcess = exec('git pull', { 
        cwd: this.projectRoot,
        timeout: 30000 // 30 secondes max
      }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Git pull failed: ${error.message}`));
          return;
        }
        
        const output = stdout + stderr;
        console.log('Git pull output:', output);
        
        resolve({
          success: true,
          output: output.trim(),
          message: 'Mise à jour Git réussie'
        });
      });
    });
  }

  // Redémarrage du service (pas de l'OS)
  async _restart() {
    return new Promise((resolve) => {
      console.log('Redémarrage du service programmé dans 2 secondes...');
      
      setTimeout(() => {
        resolve({
          success: true,
          message: 'Redémarrage du service en cours...'
        });
        
        // Redémarre le processus Node.js
        process.exit(0);
      }, 2000);
    });
  }

  // Arrêt du système (Raspberry Pi)
  async _poweroff() {
    return new Promise((resolve, reject) => {
      // Vérification si on est sur un système Unix/Linux
      if (process.platform !== 'linux') {
        reject(new Error('Poweroff disponible uniquement sur Linux'));
        return;
      }
      
      console.log('Arrêt du système programmé dans 5 secondes...');
      
      setTimeout(() => {
        exec('sudo poweroff', (error) => {
          if (error) {
            reject(new Error(`Poweroff failed: ${error.message}`));
          }
        });
      }, 5000);
      
      resolve({
        success: true,
        message: 'Arrêt du système programmé dans 5 secondes'
      });
    });
  }

  // Redémarrage du système (Raspberry Pi)
  async _reboot() {
    return new Promise((resolve, reject) => {
      if (process.platform !== 'linux') {
        reject(new Error('Reboot disponible uniquement sur Linux'));
        return;
      }
      
      console.log('Redémarrage du système programmé dans 5 secondes...');
      
      setTimeout(() => {
        exec('sudo reboot', (error) => {
          if (error) {
            reject(new Error(`Reboot failed: ${error.message}`));
          }
        });
      }, 5000);
      
      resolve({
        success: true,
        message: 'Redémarrage du système programmé dans 5 secondes'
      });
    });
  }

  // Mise à jour du système
  async _updateSystem() {
    return new Promise((resolve, reject) => {
      if (process.platform !== 'linux') {
        reject(new Error('Update disponible uniquement sur Linux'));
        return;
      }
      
      console.log('Mise à jour du système...');
      
      const updateProcess = exec('sudo apt update && sudo apt upgrade -y', {
        timeout: 300000 // 5 minutes max
      }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`System update failed: ${error.message}`));
          return;
        }
        
        resolve({
          success: true,
          output: stdout + stderr,
          message: 'Mise à jour système terminée'
        });
      });
    });
  }

  // Vérification du statut
  async _checkStatus() {
    return new Promise((resolve) => {
      const status = {
        platform: process.platform,
        nodeVersion: process.version,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        projectRoot: this.projectRoot,
        timestamp: new Date().toISOString()
      };
      
      // Ajouter des infos système si on est sur Linux
      if (process.platform === 'linux') {
        exec('uptime && df -h / && free -h', (error, stdout) => {
          if (!error) {
            status.systemInfo = stdout;
          }
          
          resolve({
            success: true,
            status,
            message: 'Statut système récupéré'
          });
        });
      } else {
        resolve({
          success: true,
          status,
          message: 'Statut système récupéré'
        });
      }
    });
  }

  // Méthode pour ajouter des commandes personnalisées
  addCustomCommand(name, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Le handler doit être une fonction');
    }
    
    this.allowedCommands.push(name);
    this[`_${name}`] = handler;
    
    console.log(`Commande personnalisée ajoutée: ${name}`);
  }

  // Obtenir la liste des commandes disponibles
  getAvailableCommands() {
    return this.allowedCommands.map(cmd => ({
      name: cmd,
      description: this._getCommandDescription(cmd)
    }));
  }

  // Descriptions des commandes
  _getCommandDescription(command) {
    const descriptions = {
      'git_pull': 'Met à jour le code depuis Git',
      'restart': 'Redémarre le service Node.js',
      'poweroff': 'Éteint le Raspberry Pi',
      'reboot': 'Redémarre le Raspberry Pi',
      'update_system': 'Met à jour le système (apt)',
      'check_status': 'Vérifie le statut du système'
    };
    
    return descriptions[command] || 'Commande personnalisée';
  }

  // Arrêt du module
  stop() {
    console.log('CLManager stopped');
  }
}

module.exports = CLManager;