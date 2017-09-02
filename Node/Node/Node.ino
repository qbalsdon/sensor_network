#include <OneWire.h>
#include <ESP8266WiFi.h>
#include <WiFiClient.h>
#include <ESP8266WebServer.h>
#include <ESP8266mDNS.h>

#include "constants.h"

#define DS18S20_Pin D8
#define BLUE_PIN D6
#define GREEN_PIN D5
#define RED_PIN D4

#define COLOUR_COUNT 10

String colours[COLOUR_COUNT] = { "e6194b", "3cb44b", "ffe119", "0082c8", "f58231", "911eb4", "46f0f0", "d2f53c", "fabebe", "e6beff" };
int colourIndex = 0;

OneWire ds(DS18S20_Pin);

void setup() {
  Serial.begin(115200);
  Serial.println("");
  Serial.println("Hello ESP8266");
  pinMode(LED_BUILTIN, OUTPUT);
  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);

  digitalWrite(LED_BUILTIN, LOW);
}

void setColour(int red, int green, int blue)
{
  analogWrite(RED_PIN, red);
  analogWrite(GREEN_PIN, green);
  analogWrite(BLUE_PIN, blue);  
}

int hexToInt(String hex) {
  int value = 0;
  int a = 0;
  int b = hex.length() - 1;
  for (; b >= 0; a++, b--) {
    if (hex[b] >= '0' && hex[b] <= '9') {
      value += (hex[b] - '0') * (1 << (a * 4));
      } else {
        value += ((hex[b] - 'A') + 10) * (1 << (a * 4));
      }
    }
    return value;
}

void setColour(String hex)
{
  hex.toUpperCase();
  String redString = hex.substring(0, 2);
  String greenString = hex.substring(2, 4);
  String blueString = hex.substring(4, 6);
      
  setColour(hexToInt(redString), hexToInt(greenString), hexToInt(blueString));
}

float getTemp(){
 //returns the temperature in Celsius

 byte data[12];
 byte addr[8];

 if ( !ds.search(addr)) {
   //no more sensors on chain, reset search
   ds.reset_search();
   return -1001;
 }

 if ( OneWire::crc8( addr, 7) != addr[7]) {
   Serial.println("CRC is not valid!");
   return -1002;
 }

 if ( addr[0] != 0x10 && addr[0] != 0x28) {
   Serial.print("Device is not recognized");
   return -1003;
 }

 ds.reset();
 ds.select(addr);
 ds.write(0x44,1); // start conversion, with parasite power on at the end

 byte present = ds.reset();
 ds.select(addr);  
 ds.write(0xBE); // Read Scratchpad

 
 for (int i = 0; i < 9; i++) { // we need 9 bytes
  data[i] = ds.read();
 }
 
 ds.reset_search();
 
 byte MSB = data[1];
 byte LSB = data[0];

 float tempRead = ((MSB << 8) | LSB); //using two's compliment
 float TemperatureSum = tempRead / 16;
 
 return TemperatureSum;
}

void loop() {
  
  //float temperature = getTemp();
  //String temp = String(temperature);
  //Serial.print("TEMPERATURE: ");
  //Serial.println(temp);
  //delay(250);  
  setColour(colours[colourIndex]);
  colourIndex = (colourIndex + 1) % COLOUR_COUNT;
  delay(1000);

  Serial.println(WIFI_SSID);
}

