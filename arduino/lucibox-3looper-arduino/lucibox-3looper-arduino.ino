/*
 *        LUCIBOX Looper 3 channel - OSC Version
 *        SOPHIE MARTA
 *        github.com/undessens/lucibox
 *        
 *        Author : Aurelien Conil
 *        aurelienconil.fr
 */

#include "lucibox.h"

// Variables globales
int valueCount = 0;
int values[MAX_VALUES];

// Instance du NeoPixel (doit être globale pour être accessible par LedStrip)

// Instances des contrôleurs
Potentiometer potars[] = {
  Potentiometer(A0, "/lucibox/potar1"),
  Potentiometer(A1, "/lucibox/potar2"),
  Potentiometer(A2, "/lucibox/potar3"),
  Potentiometer(A3, "/lucibox/potar4")
};

Button buttons[] = {
  
  Button(2, "/lucibox/loop/channel3/play"),
  Button(3, "/lucibox/loop/channel3/rec"),
  Button(4, "/lucibox/loop/channel2/play"),
  Button(5, "/lucibox/loop/channel2/rec"),
  Button(6, "/lucibox/loop/channel1/play"),
  Button(7, "/lucibox/loop/channel1/rec"),
  Button(8, "/lucibox/global/play")
  
};

LedStrip ledStrip;

const int NUM_POTARS = sizeof(potars) / sizeof(potars[0]);
const int NUM_BUTTONS = sizeof(buttons) / sizeof(buttons[0]);

//---------------------------------------------------------
//          MAIN
//---------------------------------------------------------

void setup() {
  
  // Initialisation des potentiomètres
  for(int i = 0; i < NUM_POTARS; i++) {
    potars[i].init();
  }
  
  // Initialisation des boutons
  for(int i = 0; i < NUM_BUTTONS; i++) {
    buttons[i].init();
  }
  
  // Initialisation des LEDs
  ledStrip.pixels.begin();
  ledStrip.setFader(100,2);
  
  // Try to connect to serial . Display something until the serial is connected
  Serial.begin(38400);
  int fader = 0;

  Serial.println("# LUCIBOX OSC Interface Ready");
  //ledStrip.clear();
}

void loop() {
  // Lecture des potentiomètres
  for(int i = 0; i < NUM_POTARS; i++) {
    if(potars[i].hasChanged()) {
      potars[i].sendOSC();
    }
  }
  
  // Lecture des boutons
  for(int i = 0; i < NUM_BUTTONS; i++) {
    bool result = buttons[i].hasChanged();
    if(result) {
      buttons[i].sendOSC();
    }
  }
  
  // Gestion des messages OSC entrants pour LEDs
  handleIncomingOSC();
  delay(5);
}

void handleIncomingOSC() {
  if(Serial.available() > 0) {
    String message = Serial.readStringUntil('\n');
    message.trim();
    
    if(message.length() > 0) {
      parseOSCMessage(message);
    }
  }
}

void parseOSCMessage(String message) {
  // "message" est une chaine de caractère "/mon/adresse/ici value1 value2 value3"
  // On considere que value sont de "int"
  // On cherche donc à séparer dynamiquement msg + value[]

  valueCount = 0; // Réinitialise le compteur de valeurs
  // Trouver l'index de la fin de l'adresse
  int addressEndIndex = message.indexOf(' ');

  // Si aucun espace n'est trouvé, il n'y a pas de valeurs
  if (addressEndIndex == -1) {
    return;
  }

  int startIndex = addressEndIndex + 1;  // Commence la recherche des values après l'adresse
  int spaceIndex;

  // Boucle pour extraire les valeurs
  while ((spaceIndex = message.indexOf(' ', startIndex)) != -1 && valueCount < MAX_VALUES) {
    values[valueCount] = message.substring(startIndex, spaceIndex).toInt();
    valueCount++;
    startIndex = spaceIndex + 1;
  }

  // Ajoute la dernière valeur
  if (startIndex < message.length() && valueCount < MAX_VALUES) {
    values[valueCount] = message.substring(startIndex).toInt();
    valueCount++;
  }

  // -------------- STRIP ONE ------------------------
  if(message.startsWith("/lucibox/led/strip/one")) {
    // Format attendu: "/lucibox/led/set index color"
    // Exemple: "/lucibox/led/set 0 2" (LED 0 en rouge)
    Serial.println("#receive lucibox-ledstrip-set");
        
    if(valueCount == 2) {
      int ledIndex = values[0];
      int colorValue = values[1];
      
      Serial.println("#set led");
      ledStrip.setLed(ledIndex, colorValue);
      Serial.println("#update led");
      ledStrip.update();
    }
  }
  // -------------- CLEAR ------------------------
  else if(message.startsWith("/lucibox/led/strip/clear")) {
    Serial.println("# Clear pixels");
    ledStrip.clear();
  }
  // -------------- LOOPER  ------------------------
  else if(message.startsWith("/lucibox/led/strip/looper")) {  
    // Pattern pour looper: affiche le statut des 4 channels
    // Format attendu: "/lucibox/led/strip/looper looperchannel ledindex value"

    if(valueCount == 3) {
      int index = values[0] - 1; // Channel1 is index0 
      int ledindex = values[1];
      int value = values[2];

      if(index >= 0) ledStrip.set3DotsLooper(index, ledindex, value);
      ledStrip.update3DotsLooper();
    }
  }
  else if(message.startsWith("/lucibox/led/strip/level")) {
    // Pattern niveau: affiche une barre de niveau
    if(valueCount == 1) {
      int index = values[0] ;
      ledStrip.setFader(index, 5);
    }
  }
}

