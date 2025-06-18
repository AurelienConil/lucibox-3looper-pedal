#ifndef POTENTIOMETER_H
#define POTENTIOMETER_H

#include "Arduino.h"

#ifndef ANALOG_THRESH
#define ANALOG_THRESH 5
#endif

struct Potentiometer {
  int pin;
  String oscAddress;
  int currentValue;
  int lastSentValue;
  
  Potentiometer(int p, String addr) : pin(p), oscAddress(addr), currentValue(0), lastSentValue(0) {}
  
  void init() {
    pinMode(pin, INPUT);
    currentValue = analogRead(pin);
    lastSentValue = currentValue;
  }
  
  bool hasChanged() {
    int newValue = analogRead(pin);
    if (abs(newValue - currentValue) > ANALOG_THRESH) {
      currentValue = newValue;
      return true;
    }
    return false;
  }
  
  void sendOSC() {
    int mappedValue = map(currentValue, 0, 1023, 0, 1000);
    Serial.print(oscAddress);
    Serial.print(" ");
    Serial.print(mappedValue);
    Serial.println();
    lastSentValue = currentValue;
  }
};

#endif